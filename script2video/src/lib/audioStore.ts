import type { LangId } from "./langs";

const DB_NAME = "script2video-audio";
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

export function audioKey(scriptId: string, lang: LangId): string {
  return `${scriptId}:${lang}`;
}

export function beatAudioKey(scriptId: string, lang: LangId, beatId: string): string {
  return `${scriptId}:${lang}:beat:${beatId}`;
}

export async function putAudio(scriptId: string, lang: LangId, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, audioKey(scriptId, lang));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudio(scriptId: string, lang: LangId): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(audioKey(scriptId, lang));
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

const urlCache = new Map<string, string>();

export async function audioObjectUrl(scriptId: string, lang: LangId): Promise<string | null> {
  const key = audioKey(scriptId, lang);
  const hit = urlCache.get(key);
  if (hit) return hit;
  const blob = await getAudio(scriptId, lang);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function revokeAudioUrl(scriptId: string, lang: LangId) {
  const key = audioKey(scriptId, lang);
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

export async function putAudioBlob(scriptId: string, lang: LangId, blob: Blob): Promise<Blob> {
  revokeAudioUrl(scriptId, lang);
  await putAudio(scriptId, lang, blob);
  return blob;
}

export async function putBeatAudio(scriptId: string, lang: LangId, beatId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, beatAudioKey(scriptId, lang, beatId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBeatAudio(scriptId: string, lang: LangId, beatId: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(beatAudioKey(scriptId, lang, beatId));
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
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
  return concatParts(blobs.map((blob) => ({ blob })));
}

/** Sequential concat of clips and silence, matching the first clip's sample rate. */
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

export function silentWav(ms: number, sampleRate = 24000, channels = 1): Blob {
  const samples = Math.max(1, Math.round((sampleRate * Math.max(0, ms)) / 1000));
  const chans = Array.from({ length: Math.max(1, channels) }, () => new Float32Array(samples));
  return encodeWavFromChannels(chans, sampleRate);
}

/** Place clips at startMs on a timeline of totalMs (overlap is mixed). */
export async function mixClips(
  clips: { blob: Blob; startMs: number }[],
  totalMs: number,
): Promise<Blob> {
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
          const mixed = dest[offset + i] + src[i];
          dest[offset + i] = Math.max(-1, Math.min(1, mixed));
        }
      }
    }
    return encodeWav(out);
  } finally {
    await ctx.close();
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const chans: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  return encodeWavFromChannels(chans, buffer.sampleRate);
}

function encodeWavFromChannels(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = Math.max(1, channels.length);
  const samples = channels[0]?.length ?? 0;
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
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}
