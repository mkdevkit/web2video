import { saveAs } from "file-saver";
import { getAudio, putAudio } from "./audioStore";
import { LANG_IDS } from "./langs";
import { isTauri } from "./platform";
import { DEFAULT_PROJECT_NAME, parseProjectFile, mergeProjectFiles, splitProjectFiles } from "../sample";
import { dumpLlmChatStore, hydrateLlmChatStore } from "./aiChat";
import { useStudio } from "../store/useStudio";
import type { Project } from "../types";

const FILE_NAME = "project.json";
const SCRIPT_FILE = "script.json";
const AI_FILE = "aisession.json";
const DB_NAME = "script2video";
const STORE = "handles";
const HANDLE_KEY = "project-dir";
const PATH_KEY = "script2video.project-dir";
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

type Bound =
  | { kind: "fsa"; handle: FileSystemDirectoryHandle }
  | { kind: "path"; path: string };

let bound: Bound | null = null;
let sessionDirReady = false;

function canPickDirectory(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function isNotFound(e: unknown): boolean {
  return e instanceof DOMException && e.name === "NotFoundError";
}

function dirLabel(next: Bound | null): string | null {
  if (!next) return null;
  if (next.kind === "fsa") return next.handle.name;
  const parts = next.path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || next.path;
}

function joinPath(root: string, ...parts: string[]) {
  const sep = root.includes("\\") ? "\\" : "/";
  return [root.replace(/[\\/]+$/, ""), ...parts].join(sep);
}

function pretty(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

async function fsaReadText(dir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    return await (await (await dir.getFileHandle(name)).getFile()).text();
  } catch {
    return null;
  }
}

async function fsaWriteText(dir: FileSystemDirectoryHandle, name: string, text: string) {
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(text.endsWith("\n") ? text : `${text}\n`);
  await writable.close();
}

let aiTimer: ReturnType<typeof setTimeout> | null = null;

async function writeAiSessionNow() {
  if (!bound) return;
  const text = dumpLlmChatStore();
  if (bound.kind === "fsa") {
    const ok = await ensurePermission(bound.handle, "readwrite");
    if (!ok) return;
    await fsaWriteText(bound.handle, AI_FILE, text);
    return;
  }
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(joinPath(bound.path, AI_FILE), text);
}

export function persistAiSession() {
  if (!bound || !sessionDirReady) return;
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = setTimeout(() => {
    aiTimer = null;
    void writeAiSessionNow().catch(() => undefined);
  }, 400);
}

async function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistHandle(handle: FileSystemDirectoryHandle | null) {
  try {
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      if (handle) tx.objectStore(STORE).put(handle, HANDLE_KEY);
      else tx.objectStore(STORE).delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

async function loadPersistedHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

function bindDir(next: Bound | null) {
  bound = next;
  sessionDirReady = Boolean(next);
  useStudio.getState().setProjectDirName(dirLabel(next));
  if (next?.kind === "fsa") void persistHandle(next.handle);
  else void persistHandle(null);
  try {
    if (next?.kind === "path") localStorage.setItem(PATH_KEY, next.path);
    else localStorage.removeItem(PATH_KEY);
  } catch {
    /* ignore */
  }
}

type DirMode = "read" | "readwrite";

async function ensurePermission(handle: FileSystemDirectoryHandle, mode: DirMode) {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

async function pickFsaDirectory(mode: DirMode): Promise<FileSystemDirectoryHandle | null> {
  if (!canPickDirectory()) return null;
  try {
    return await window.showDirectoryPicker({ id: "script2video-project", mode });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

async function pickTauriDirectory(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({ directory: true, multiple: false });
  return typeof path === "string" && path ? path : null;
}

export function folderNameFromProject(name: string): string {
  let s = (name.trim() || DEFAULT_PROJECT_NAME)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
    .trim();
  if (!s) s = DEFAULT_PROJECT_NAME;
  if (WIN_RESERVED.test(s)) s = `_${s}`;
  return s;
}

async function fsaHasProject(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await dir.getFileHandle(FILE_NAME);
    return true;
  } catch {
    return false;
  }
}

async function fsaFindProjects(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle[]> {
  if (await fsaHasProject(dir)) return [dir];
  const found: FileSystemDirectoryHandle[] = [];
  for await (const handle of dir.values()) {
    if (handle.kind !== "directory" || handle.name === "media") continue;
    const child = handle as FileSystemDirectoryHandle;
    if (await fsaHasProject(child)) found.push(child);
  }
  return found;
}

async function fsaResolveProject(picked: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  const hits = await fsaFindProjects(picked);
  if (hits.length === 1) return hits[0];
  if (!hits.length) return null;
  const prefer = folderNameFromProject(useStudio.getState().project.name);
  const named = hits.find((h) => h.name === prefer);
  if (named) return named;
  window.alert(`此目录下有多个工程：${hits.map((h) => h.name).join("、")}。请直接打开那个项目名文件夹。`);
  return null;
}

async function fsaProjectDirIn(parent: FileSystemDirectoryHandle, projectName: string): Promise<FileSystemDirectoryHandle> {
  if (await fsaHasProject(parent)) return parent;
  return parent.getDirectoryHandle(folderNameFromProject(projectName), { create: true });
}

async function fsaWriteMedia(dir: FileSystemDirectoryHandle, project: Project) {
  const media = await dir.getDirectoryHandle("media", { create: true });
  for (const script of project.scripts) {
    for (const lang of LANG_IDS) {
      if (!script.audioByLang?.[lang]) continue;
      const blob = await getAudio(script.id, lang);
      if (!blob) continue;
      const langDir = await media.getDirectoryHandle(lang, { create: true });
      const file = await langDir.getFileHandle(`${script.id}.wav`, { create: true });
      const writable = await file.createWritable();
      await writable.write(blob);
      await writable.close();
    }
  }
}

async function fsaLoadMedia(dir: FileSystemDirectoryHandle, project: Project) {
  let media: FileSystemDirectoryHandle;
  try {
    media = await dir.getDirectoryHandle("media");
  } catch {
    return;
  }
  for (const script of project.scripts) {
    for (const lang of LANG_IDS) {
      try {
        const langDir = await media.getDirectoryHandle(lang);
        let file: File;
        try {
          file = await (await langDir.getFileHandle(`${script.id}.wav`)).getFile();
        } catch {
          file = await (await langDir.getFileHandle(`${script.id}.mp3`)).getFile();
        }
        const mime = file.name.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
        await putAudio(script.id, lang, file.slice(0, undefined, mime));
      } catch {
        /* missing clip */
      }
    }
  }
}

async function fsaWriteBundle(dir: FileSystemDirectoryHandle, project: Project) {
  const { meta, scripts } = splitProjectFiles(project);
  await fsaWriteText(dir, FILE_NAME, pretty(meta));
  await fsaWriteText(dir, SCRIPT_FILE, pretty({ scripts }));
  await fsaWriteText(dir, AI_FILE, dumpLlmChatStore());
}

async function fsaLoadBundle(dir: FileSystemDirectoryHandle): Promise<Project> {
  const projectText = await fsaReadText(dir, FILE_NAME);
  if (!projectText) throw new Error("没有 project.json");
  const scriptText = await fsaReadText(dir, SCRIPT_FILE);
  const project = mergeProjectFiles(projectText, scriptText);
  hydrateLlmChatStore(await fsaReadText(dir, AI_FILE));
  return project;
}

async function pathExists(path: string): Promise<boolean> {
  const { exists } = await import("@tauri-apps/plugin-fs");
  return exists(path);
}

async function pathFindProjects(root: string): Promise<string[]> {
  if (await pathExists(joinPath(root, FILE_NAME))) return [root];
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const found: string[] = [];
  try {
    for (const entry of await readDir(root)) {
      if (!entry.isDirectory || entry.name === "media") continue;
      const child = joinPath(root, entry.name);
      if (await pathExists(joinPath(child, FILE_NAME))) found.push(child);
    }
  } catch {
    /* ignore */
  }
  return found;
}

async function pathResolveProject(picked: string): Promise<string | null> {
  const hits = await pathFindProjects(picked);
  if (hits.length === 1) return hits[0];
  if (!hits.length) return null;
  const prefer = folderNameFromProject(useStudio.getState().project.name);
  const named = hits.find((p) => dirLabel({ kind: "path", path: p }) === prefer);
  if (named) return named;
  window.alert(`此目录下有多个工程：${hits.map((p) => dirLabel({ kind: "path", path: p })).join("、")}。请直接打开那个项目名文件夹。`);
  return null;
}

async function pathProjectDirIn(parent: string, projectName: string): Promise<string> {
  if (await pathExists(joinPath(parent, FILE_NAME))) return parent;
  const { mkdir } = await import("@tauri-apps/plugin-fs");
  const dir = joinPath(parent, folderNameFromProject(projectName));
  await mkdir(dir, { recursive: true });
  return dir;
}

async function pathWriteMedia(dir: string, project: Project) {
  const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
  for (const script of project.scripts) {
    for (const lang of LANG_IDS) {
      if (!script.audioByLang?.[lang]) continue;
      const blob = await getAudio(script.id, lang);
      if (!blob) continue;
      const langDir = joinPath(dir, "media", lang);
      await mkdir(langDir, { recursive: true });
      await writeFile(joinPath(langDir, `${script.id}.wav`), new Uint8Array(await blob.arrayBuffer()));
    }
  }
}

async function pathLoadMedia(dir: string, project: Project) {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  for (const script of project.scripts) {
    for (const lang of LANG_IDS) {
      const wav = joinPath(dir, "media", lang, `${script.id}.wav`);
      const mp3 = joinPath(dir, "media", lang, `${script.id}.mp3`);
      try {
        let bytes: Uint8Array;
        let mime = "audio/wav";
        if (await pathExists(wav)) bytes = await readFile(wav);
        else if (await pathExists(mp3)) {
          bytes = await readFile(mp3);
          mime = "audio/mpeg";
        } else continue;
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        await putAudio(script.id, lang, new Blob([copy], { type: mime }));
      } catch {
        /* missing clip */
      }
    }
  }
}

async function pathWriteBundle(dir: string, project: Project) {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const { meta, scripts } = splitProjectFiles(project);
  await writeTextFile(joinPath(dir, FILE_NAME), pretty(meta));
  await writeTextFile(joinPath(dir, SCRIPT_FILE), pretty({ scripts }));
  await writeTextFile(joinPath(dir, AI_FILE), dumpLlmChatStore());
}

async function pathLoadBundle(dir: string): Promise<Project> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const projectText = await readTextFile(joinPath(dir, FILE_NAME));
  let scriptText: string | null = null;
  try {
    if (await pathExists(joinPath(dir, SCRIPT_FILE))) scriptText = await readTextFile(joinPath(dir, SCRIPT_FILE));
  } catch {
    scriptText = null;
  }
  const project = mergeProjectFiles(projectText, scriptText);
  try {
    hydrateLlmChatStore((await pathExists(joinPath(dir, AI_FILE))) ? await readTextFile(joinPath(dir, AI_FILE)) : null);
  } catch {
    hydrateLlmChatStore(null);
  }
  return project;
}

async function openJsonFallback(): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return;
  try {
    const project = parseProjectFile(await file.text());
    clearBoundDir();
    useStudio.getState().setProject(project);
    useStudio.getState().setStatus("已打开工程（无文件夹，配音未读入）");
  } catch (e) {
    window.alert(e instanceof Error ? e.message : "无法打开工程文件");
  }
}

const NO_PROJECT = "此目录没有 project.json。保存时工程写在「项目名」子文件夹里，请打开那个文件夹，或选择包含它的上级目录。";

export function clearBoundDir() {
  bindDir(null);
}

export async function restoreBoundDir() {
  const handle = await loadPersistedHandle();
  if (handle) {
    bound = { kind: "fsa", handle };
    useStudio.getState().setProjectDirName(handle.name);
    return;
  }
  try {
    const path = localStorage.getItem(PATH_KEY);
    if (path) {
      bound = { kind: "path", path };
      useStudio.getState().setProjectDirName(dirLabel(bound));
    }
  } catch {
    /* ignore */
  }
}

export async function openProjectFolder(): Promise<void> {
  if (canPickDirectory()) {
    const picked = await pickFsaDirectory("readwrite");
    if (!picked) return;
    try {
      const dir = await fsaResolveProject(picked);
      if (!dir) {
        window.alert(NO_PROJECT);
        return;
      }
      const project = await fsaLoadBundle(dir);
      await fsaLoadMedia(dir, project);
      bindDir({ kind: "fsa", handle: dir });
      useStudio.getState().setProject(project);
      useStudio.getState().setStatus(`已打开 ${dir.name}/`);
    } catch (e) {
      if (isNotFound(e)) {
        window.alert(NO_PROJECT);
        return;
      }
      window.alert(e instanceof Error ? e.message : "无法打开工程目录");
    }
    return;
  }

  if (isTauri()) {
    try {
      const picked = await pickTauriDirectory();
      if (!picked) return;
      const dir = await pathResolveProject(picked);
      if (!dir) {
        window.alert(NO_PROJECT);
        return;
      }
      const project = await pathLoadBundle(dir);
      await pathLoadMedia(dir, project);
      bindDir({ kind: "path", path: dir });
      useStudio.getState().setProject(project);
      useStudio.getState().setStatus(`已打开 ${dirLabel({ kind: "path", path: dir })}/`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "无法打开工程目录");
    }
    return;
  }

  await openJsonFallback();
}

export async function saveProjectFolder(): Promise<void> {
  const s = useStudio.getState();
  const project = s.project;

  if (canPickDirectory()) {
    let dir = bound?.kind === "fsa" ? bound.handle : null;
    if (dir) {
      const ok = await ensurePermission(dir, "readwrite");
      if (!ok) dir = null;
    }
    if (!dir) {
      const parent = await pickFsaDirectory("readwrite");
      if (!parent) return;
      try {
        dir = await fsaProjectDirIn(parent, project.name);
      } catch (e) {
        if (isAbort(e)) return;
        window.alert(e instanceof Error ? e.message : "无法创建项目文件夹");
        return;
      }
      bindDir({ kind: "fsa", handle: dir });
    }
    try {
      await fsaWriteBundle(dir, project);
      await fsaWriteMedia(dir, project);
      s.setStatus(`已保存到 ${dir.name}/`);
    } catch (e) {
      if (isAbort(e)) return;
      window.alert(e instanceof Error ? e.message : "保存失败");
    }
    return;
  }

  if (isTauri()) {
    let dir = bound?.kind === "path" ? bound.path : null;
    if (!dir) {
      const parent = await pickTauriDirectory();
      if (!parent) return;
      try {
        dir = await pathProjectDirIn(parent, project.name);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "无法创建项目文件夹");
        return;
      }
      bindDir({ kind: "path", path: dir });
    }
    try {
      await pathWriteBundle(dir, project);
      await pathWriteMedia(dir, project);
      s.setStatus(`已保存到 ${dirLabel({ kind: "path", path: dir })}/`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    }
    return;
  }

  saveAs(new Blob([`${JSON.stringify(project, null, 2)}\n`], { type: "application/json" }), `${project.name || "project"}.json`);
}
