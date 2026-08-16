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
  const blob = blobFromBase64(b64, type);
  return putAudioBlob(sceneId, lang, blob);
}

export function blobFromBase64(b64: string, type = "audio/mpeg"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function putAudioBlob(sceneId: string, lang: LangId, blob: Blob): Promise<Blob> {
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

export async function concatAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (!blobs.length) throw new Error("没有可拼接的音频");
  if (blobs.length === 1) return blobs[0];
  const ctx = new AudioContext();
  try {
    const buffers: AudioBuffer[] = [];
    for (const blob of blobs) {
      const copy = await blob.arrayBuffer();
      buffers.push(await ctx.decodeAudioData(copy.slice(0)));
    }
    const sampleRate = buffers[0].sampleRate;
    const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
    const length = buffers.reduce((n, b) => n + b.length, 0);
    const out = ctx.createBuffer(channels, length, sampleRate);
    let offset = 0;
    for (const buf of buffers) {
      for (let c = 0; c < channels; c++) {
        const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        out.getChannelData(c).set(src, offset);
      }
      offset += buf.length;
    }
    return encodeWav(out);
  } finally {
    await ctx.close();
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const dataSize = samples * numChannels * 2;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i] ?? 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}
