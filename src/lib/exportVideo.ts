import { toCanvas } from "html-to-image";
import { flushSync } from "react-dom";
import { getAudio } from "./audioStore";
import { sceneClock, totalDuration } from "./timeline";
import { ASPECT_PX } from "../types";
import type { LangId } from "./langs";
import type { Project } from "../types";

function copySlice(ctx: AudioContext, src: AudioBuffer, startSec: number, endSec: number): AudioBuffer | null {
  const sr = src.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sr));
  const end = Math.min(src.length, Math.floor(endSec * sr));
  const len = end - start;
  if (len < 32) return null;
  const out = ctx.createBuffer(src.numberOfChannels, len, sr);
  for (let c = 0; c < src.numberOfChannels; c++) {
    out.getChannelData(c).set(src.getChannelData(c).subarray(start, start + len));
  }
  return out;
}

function playSlice(
  ctx: AudioContext,
  dest: AudioNode,
  buf: AudioBuffer,
  startSec: number,
  endSec: number,
  when: number,
) {
  const slice = copySlice(ctx, buf, startSec, endSec);
  if (!slice) return;
  const src = ctx.createBufferSource();
  src.buffer = slice;
  src.connect(dest);
  src.start(Math.max(ctx.currentTime, when));
}

function pickMime(): string {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export async function recordProject(opts: {
  project: Project;
  lang: LangId;
  stage: HTMLElement;
  setPlayhead: (ms: number) => void;
  onProgress?: (ratio: number) => void;
  fps?: number;
}): Promise<Blob> {
  const { project, lang, stage, setPlayhead, onProgress } = opts;
  const fps = opts.fps ?? 24;
  const { w, h } = ASPECT_PX[project.aspect];
  const mime = pickMime();
  if (!mime) throw new Error("当前浏览器不支持 WebM 录制，请使用 Chrome 或 Edge");

  const duration = totalDuration(project, lang);
  if (duration <= 0) throw new Error("时长为 0");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  const canvasStream = canvas.captureStream(fps);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  let offset = 0;
  for (const scene of project.scenes) {
    const clock = sceneClock(scene, lang, project);
    const dur = clock.totalMs / 1000;
    const blob = await getAudio(scene.id, lang);
    if (blob) {
      const buf = await audioCtx.decodeAudioData(await blob.arrayBuffer());
      const t0 = audioCtx.currentTime + offset;
      playSlice(audioCtx, dest, buf, clock.audioOpenStartMs / 1000, clock.audioOpenEndMs / 1000, t0 + clock.openBeforeMs / 1000);
      playSlice(audioCtx, dest, buf, clock.audioBodyStartMs / 1000, clock.audioBodyEndMs / 1000, t0 + clock.bodyStartMs / 1000);
      playSlice(audioCtx, dest, buf, clock.audioCloseStartMs / 1000, clock.audioCloseEndMs / 1000, t0 + clock.closeSpeechStartMs / 1000);
    }
    offset += dur;
  }

  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime.startsWith("video/") ? "video/webm" : mime }));
    rec.onerror = () => reject(new Error("录制失败"));
  });

  rec.start(200);
  const frameMs = 1000 / fps;
  const t0 = performance.now();
  let lastDraw = -1;

  await new Promise<void>((resolve, reject) => {
    const tick = async () => {
      try {
        const elapsed = performance.now() - t0;
        if (elapsed >= duration) {
          flushSync(() => setPlayhead(duration));
          const shot = await toCanvas(stage, { pixelRatio: 1, cacheBust: false, width: w, height: h });
          ctx.drawImage(shot, 0, 0, w, h);
          onProgress?.(1);
          resolve();
          return;
        }
        if (elapsed - lastDraw >= frameMs * 0.7) {
          lastDraw = elapsed;
          flushSync(() => setPlayhead(elapsed));
          const shot = await toCanvas(stage, { pixelRatio: 1, cacheBust: false, width: w, height: h });
          ctx.drawImage(shot, 0, 0, w, h);
          onProgress?.(elapsed / duration);
        }
        requestAnimationFrame(() => void tick());
      } catch (e) {
        reject(e instanceof Error ? e : new Error("截帧失败"));
      }
    };
    void tick();
  });

  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  const blob = await stopped;
  await audioCtx.close();
  return blob;
}
