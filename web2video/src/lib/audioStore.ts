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
  return concatParts(blobs.map((blob) => ({ blob })));
}

export function beatAudioKey(sceneId: string, lang: LangId, beatId: string): string {
  return `${sceneId}:${lang}:beat:${beatId}`;
}

export async function putBeatAudio(sceneId: string, lang: LangId, beatId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, beatAudioKey(sceneId, lang, beatId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBeatAudio(sceneId: string, lang: LangId, beatId: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(beatAudioKey(sceneId, lang, beatId));
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Sequential concat of clips and silence. */
export async function concatParts(parts: { blob?: Blob; silenceMs?: number }[]): Promise<Blob> {
  const nonempty = parts.filter((p) => p.blob || (p.silenceMs ?? 0) > 0);
  if (!nonempty.length) throw new Error("没有可拼接的音频");
  const ctx = new AudioContext();
  try {
    const decoded: AudioBuffer[] = [];
    for (const p of nonempty) {
      if (!p.blob) continue;
      const copy = await p.blob.arrayBuffer();
      decoded.push(await ctx.decodeAudioData(copy.slice(0)));
    }
    const sampleRate = decoded[0]?.sampleRate ?? 24000;
    const channels = decoded.length ? Math.max(...decoded.map((b) => b.numberOfChannels)) : 1;
    const pieces: AudioBuffer[] = [];
    let di = 0;
    for (const p of nonempty) {
      if ((p.silenceMs ?? 0) > 0 && !p.blob) {
        const n = Math.max(1, Math.round((sampleRate * (p.silenceMs ?? 0)) / 1000));
        pieces.push(ctx.createBuffer(channels, n, sampleRate));
        continue;
      }
      if (p.blob) pieces.push(decoded[di++]);
    }
    if (!pieces.length) throw new Error("没有可拼接的音频");
    if (pieces.length === 1 && decoded.length === 1) {
      const blob = nonempty.find((p) => p.blob)?.blob;
      if (blob) return blob;
    }
    const length = pieces.reduce((n, b) => n + b.length, 0);
    const out = ctx.createBuffer(channels, length, sampleRate);
    let offset = 0;
    for (const buf of pieces) {
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

function silentWav(ms: number, sampleRate = 24000, channels = 1): Blob {
  const samples = Math.max(1, Math.round((sampleRate * Math.max(0, ms)) / 1000));
  const ctxLen = samples;
  const bytes = new ArrayBuffer(44 + ctxLen * channels * 2);
  const view = new DataView(bytes);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + ctxLen * channels * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, ctxLen * channels * 2, true);
  return new Blob([bytes], { type: "audio/wav" });
}

/** Place clips at startMs on a timeline of totalMs (overlap is mixed). */
export async function mixClips(clips: { blob: Blob; startMs: number }[], totalMs: number): Promise<Blob> {
  const duration = Math.max(1, totalMs);
  if (!clips.length) return silentWav(duration);
  const ctx = new AudioContext();
  try {
    const decoded: { buf: AudioBuffer; startMs: number }[] = [];
    for (const clip of clips) {
      const copy = await clip.blob.arrayBuffer();
      decoded.push({ buf: await ctx.decodeAudioData(copy.slice(0)), startMs: clip.startMs });
    }
    const sampleRate = decoded[0].buf.sampleRate;
    const channels = Math.max(...decoded.map((d) => d.buf.numberOfChannels));
    const length = Math.max(1, Math.round((sampleRate * duration) / 1000));
    const out = ctx.createBuffer(channels, length, sampleRate);
    for (const { buf, startMs } of decoded) {
      const offset = Math.max(0, Math.round((sampleRate * startMs) / 1000));
      for (let c = 0; c < channels; c++) {
        const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        const dest = out.getChannelData(c);
        for (let i = 0; i < src.length && offset + i < dest.length; i++) {
          dest[offset + i] = Math.max(-1, Math.min(1, dest[offset + i] + src[i]));
        }
      }
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
