import { saveAs } from "file-saver";
import { getAudio, putAudio } from "./audioStore";
import { LANG_IDS } from "./langs";
import { isTauri } from "./platform";
import { parseProjectFile, DEFAULT_PROJECT_NAME } from "./templates";
import { useEditor } from "../store/useEditor";
import type { Project } from "../types";

const FILE_NAME = "project.json";
const DB_NAME = "web2video";
const STORE = "handles";
const HANDLE_KEY = "project-dir";
const PATH_KEY = "web2video.project-dir";
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

type Bound =
  | { kind: "fsa"; handle: FileSystemDirectoryHandle }
  | { kind: "path"; path: string };

let bound: Bound | null = null;

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
  useEditor.getState().setProjectDirName(dirLabel(next));
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
    return await window.showDirectoryPicker({ id: "web2video-project", mode });
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
  const prefer = folderNameFromProject(useEditor.getState().project.name);
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
  for (const scene of project.scenes) {
    for (const lang of LANG_IDS) {
      if (!scene.audioByLang?.[lang]) continue;
      const blob = await getAudio(scene.id, lang);
      if (!blob) continue;
      const langDir = await media.getDirectoryHandle(lang, { create: true });
      const file = await langDir.getFileHandle(`${scene.id}.mp3`, { create: true });
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
  for (const scene of project.scenes) {
    for (const lang of LANG_IDS) {
      try {
        const langDir = await media.getDirectoryHandle(lang);
        const file = await langDir.getFileHandle(`${scene.id}.mp3`);
        const blob = await (await file.getFile()).slice(0, undefined, "audio/mpeg");
        await putAudio(scene.id, lang, blob);
      } catch {
        /* missing clip */
      }
    }
  }
}

async function fsaWriteJson(dir: FileSystemDirectoryHandle, project: Project) {
  const file = await dir.getFileHandle(FILE_NAME, { create: true });
  const writable = await file.createWritable();
  await writable.write(`${JSON.stringify(project, null, 2)}\n`);
  await writable.close();
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
  const prefer = folderNameFromProject(useEditor.getState().project.name);
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
  for (const scene of project.scenes) {
    for (const lang of LANG_IDS) {
      if (!scene.audioByLang?.[lang]) continue;
      const blob = await getAudio(scene.id, lang);
      if (!blob) continue;
      const langDir = joinPath(dir, "media", lang);
      await mkdir(langDir, { recursive: true });
      await writeFile(joinPath(langDir, `${scene.id}.mp3`), new Uint8Array(await blob.arrayBuffer()));
    }
  }
}

async function pathLoadMedia(dir: string, project: Project) {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  for (const scene of project.scenes) {
    for (const lang of LANG_IDS) {
      const mp3 = joinPath(dir, "media", lang, `${scene.id}.mp3`);
      try {
        if (!(await pathExists(mp3))) continue;
        const bytes = await readFile(mp3);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        await putAudio(scene.id, lang, new Blob([copy], { type: "audio/mpeg" }));
      } catch {
        /* missing clip */
      }
    }
  }
}

async function pathWriteJson(dir: string, project: Project) {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(joinPath(dir, FILE_NAME), `${JSON.stringify(project, null, 2)}\n`);
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
    useEditor.getState().replaceProject(project);
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
    useEditor.getState().setProjectDirName(handle.name);
    return;
  }
  try {
    const path = localStorage.getItem(PATH_KEY);
    if (path) {
      bound = { kind: "path", path };
      useEditor.getState().setProjectDirName(dirLabel(bound));
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
      const text = await (await (await dir.getFileHandle(FILE_NAME)).getFile()).text();
      const project = parseProjectFile(text);
      await fsaLoadMedia(dir, project);
      bindDir({ kind: "fsa", handle: dir });
      useEditor.getState().replaceProject(project);
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
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const project = parseProjectFile(await readTextFile(joinPath(dir, FILE_NAME)));
      await pathLoadMedia(dir, project);
      bindDir({ kind: "path", path: dir });
      useEditor.getState().replaceProject(project);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "无法打开工程目录");
    }
    return;
  }

  await openJsonFallback();
}

export async function saveProjectFolder(): Promise<void> {
  const s = useEditor.getState();
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
      await fsaWriteJson(dir, project);
      await fsaWriteMedia(dir, project);
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
      await pathWriteJson(dir, project);
      await pathWriteMedia(dir, project);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    }
    return;
  }

  saveAs(new Blob([`${JSON.stringify(project, null, 2)}\n`], { type: "application/json" }), `${project.name || "project"}.json`);
}
