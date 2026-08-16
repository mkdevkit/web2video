import { saveAs } from "file-saver";
import { getAudio, putAudio } from "./audioStore";
import { LANG_IDS } from "./langs";
import { parseProjectFile, DEFAULT_PROJECT_NAME } from "./templates";
import { useEditor } from "../store/useEditor";
import type { Project } from "../types";

const FILE_NAME = "project.json";
const DB_NAME = "web2video";
const STORE = "handles";
const HANDLE_KEY = "project-dir";
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

let boundDir: FileSystemDirectoryHandle | null = null;

function canPickDirectory(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function isNotFound(e: unknown): boolean {
  return e instanceof DOMException && e.name === "NotFoundError";
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

function bindDir(handle: FileSystemDirectoryHandle | null) {
  boundDir = handle;
  useEditor.getState().setProjectDirName(handle?.name ?? null);
  void persistHandle(handle);
}

type DirMode = "read" | "readwrite";

async function ensurePermission(handle: FileSystemDirectoryHandle, mode: DirMode) {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

async function pickDirectory(mode: DirMode): Promise<FileSystemDirectoryHandle | null> {
  if (!canPickDirectory()) return null;
  try {
    return await window.showDirectoryPicker({ id: "web2video-project", mode });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
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

async function hasProjectFile(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await dir.getFileHandle(FILE_NAME);
    return true;
  } catch {
    return false;
  }
}

async function findProjectDirs(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle[]> {
  if (await hasProjectFile(dir)) return [dir];
  const found: FileSystemDirectoryHandle[] = [];
  for await (const handle of dir.values()) {
    if (handle.kind !== "directory" || handle.name === "media") continue;
    const child = handle as FileSystemDirectoryHandle;
    if (await hasProjectFile(child)) found.push(child);
  }
  return found;
}

async function resolveProjectDir(picked: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  const hits = await findProjectDirs(picked);
  if (hits.length === 1) return hits[0];
  if (!hits.length) return null;
  const prefer = folderNameFromProject(useEditor.getState().project.name);
  const named = hits.find((h) => h.name === prefer);
  if (named) return named;
  window.alert(`此目录下有多个工程：${hits.map((h) => h.name).join("、")}。请直接打开那个项目名文件夹。`);
  return null;
}

async function projectDirIn(parent: FileSystemDirectoryHandle, projectName: string): Promise<FileSystemDirectoryHandle> {
  if (await hasProjectFile(parent)) return parent;
  return parent.getDirectoryHandle(folderNameFromProject(projectName), { create: true });
}

async function writeMedia(dir: FileSystemDirectoryHandle, project: Project) {
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

async function loadMedia(dir: FileSystemDirectoryHandle, project: Project) {
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

async function writeProjectJson(dir: FileSystemDirectoryHandle, project: Project) {
  const file = await dir.getFileHandle(FILE_NAME, { create: true });
  const writable = await file.createWritable();
  await writable.write(`${JSON.stringify(project, null, 2)}\n`);
  await writable.close();
}

export function clearBoundDir() {
  bindDir(null);
}

export async function restoreBoundDir() {
  const handle = await loadPersistedHandle();
  if (!handle) return;
  boundDir = handle;
  useEditor.getState().setProjectDirName(handle.name);
}

export async function openProjectFolder(): Promise<void> {
  if (!canPickDirectory()) {
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
    return;
  }
  const picked = await pickDirectory("readwrite");
  if (!picked) return;
  try {
    const dir = await resolveProjectDir(picked);
    if (!dir) {
      window.alert("此目录没有 project.json。保存时工程写在「项目名」子文件夹里，请打开那个文件夹，或选择包含它的上级目录。");
      return;
    }
    const fileHandle = await dir.getFileHandle(FILE_NAME);
    const text = await (await fileHandle.getFile()).text();
    const project = parseProjectFile(text);
    await loadMedia(dir, project);
    bindDir(dir);
    useEditor.getState().replaceProject(project);
  } catch (e) {
    if (isNotFound(e)) {
      window.alert("此目录没有 project.json。保存时工程写在「项目名」子文件夹里，请打开那个文件夹，或选择包含它的上级目录。");
      return;
    }
    window.alert(e instanceof Error ? e.message : "无法打开工程目录");
  }
}

export async function saveProjectFolder(): Promise<void> {
  const s = useEditor.getState();
  if (!canPickDirectory()) {
    saveAs(new Blob([`${JSON.stringify(s.project, null, 2)}\n`], { type: "application/json" }), `${s.project.name || "project"}.json`);
    return;
  }
  let dir = boundDir;
  if (dir) {
    const ok = await ensurePermission(dir, "readwrite");
    if (!ok) dir = null;
  }
  if (!dir) {
    const parent = await pickDirectory("readwrite");
    if (!parent) return;
    try {
      dir = await projectDirIn(parent, s.project.name);
    } catch (e) {
      if (isAbort(e)) return;
      window.alert(e instanceof Error ? e.message : "无法创建项目文件夹");
      return;
    }
    bindDir(dir);
  }

  const project = s.project;

  try {
    await writeProjectJson(dir, project);
    await writeMedia(dir, project);
  } catch (e) {
    if (isAbort(e)) return;
    window.alert(e instanceof Error ? e.message : "保存失败");
  }
}
