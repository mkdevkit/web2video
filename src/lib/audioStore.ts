import type { LangId } from "./langs";

const DB_NAME = "web2video-audio";
const STORE = "clips";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function audioKey(sceneId: string, lang: LangId): string {
  return `${sceneId}:${lang}`;
}

export async function putAudio(sceneId: string, lang: LangId, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, audioKey(sceneId, lang));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudio(sceneId: string, lang: LangId): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(audioKey(sceneId, lang));
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudio(sceneId: string, lang: LangId): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(audioKey(sceneId, lang));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const urlCache = new Map<string, string>();

export async function audioObjectUrl(sceneId: string, lang: LangId): Promise<string | null> {
  const key = audioKey(sceneId, lang);
  const hit = urlCache.get(key);
  if (hit) return hit;
  const blob = await getAudio(sceneId, lang);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function revokeAudioUrl(sceneId: string, lang: LangId) {
  const key = audioKey(sceneId, lang);
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

export async function putAudioFromBase64(sceneId: string, lang: LangId, b64: string, type = "audio/mpeg"): Promise<Blob> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type });
  revokeAudioUrl(sceneId, lang);
  await putAudio(sceneId, lang, blob);
  return blob;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export async function measureDuration(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    const audio = new Audio();
    audio.preload = "metadata";
    const dur = await new Promise<number>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve(audio.duration * 1000);
      audio.onerror = () => reject(new Error("无法读取音频时长"));
      audio.src = url;
    });
    return Number.isFinite(dur) ? dur : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}
