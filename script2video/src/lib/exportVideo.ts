import { toCanvas } from "html-to-image";
import { flushSync } from "react-dom";
import { getAudio } from "./audioStore";
import { langAudioOf, sceneDurationMs } from "./clock";
import { exportPx, exportSettingsOf, formatExt, pickMimeFor } from "./exportSettings";
import { projectDurationMs } from "./subtitles";
import type { LangId } from "./langs";
import type { ExportSettings, Project } from "../types";

export async function recordProject(opts: {
  project: Project;
  lang: LangId;
  stage: HTMLElement;
  setHead: (scriptId: string, localMs: number) => void;
  onProgress?: (ratio: number) => void;
  settings?: Partial<ExportSettings>;
}): Promise<{ blob: Blob; ext: "webm" | "mp4" }> {
  const { project, lang, stage, setHead, onProgress } = opts;
  const st = exportSettingsOf({ ...project.exportSettings, ...opts.settings });
  const mime = pickMimeFor(st.format) || pickMimeFor("webm-vp9") || pickMimeFor("webm-vp8");
  if (!mime) throw new Error("当前浏览器不支持视频录制，请使用 Chrome 或 Edge");
  const ext = mime.includes("mp4") ? "mp4" : formatExt(st.format);
  const fps = st.fps;
  const aspect = project.aspect ?? "16:9";
  const { w, h } = exportPx(aspect, st.height);

  const duration = projectDurationMs(project, lang);
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
  for (const script of project.scripts) {
    const dur = sceneDurationMs(script, langAudioOf(script, lang)) / 1000;
    const blob = await getAudio(script.id, lang);
    if (blob) {
      const buf = await audioCtx.decodeAudioData(await blob.arrayBuffer());
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      src.start(Math.max(audioCtx.currentTime, audioCtx.currentTime + offset));
    }
    offset += dur;
  }

  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(combined, {
    mimeType: mime,
    videoBitsPerSecond: Math.round(st.videoMbps * 1_000_000),
    audioBitsPerSecond: Math.round(st.audioKbps * 1000),
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => {
      const type = rec.mimeType || (ext === "mp4" ? "video/mp4" : "video/webm");
      resolve(new Blob(chunks, { type }));
    };
    rec.onerror = () => reject(new Error("录制失败"));
  });

  rec.start(200);
  const frameMs = 1000 / fps;
  const t0 = performance.now();
  let lastDraw = -1;
  let lastScript = "";

  const atGlobal = (globalMs: number): { scriptId: string; localMs: number } => {
    let t = 0;
    for (const script of project.scripts) {
      const dur = sceneDurationMs(script, langAudioOf(script, lang));
      if (globalMs < t + dur || script === project.scripts[project.scripts.length - 1]) {
        return { scriptId: script.id, localMs: Math.min(dur, Math.max(0, globalMs - t)) };
      }
      t += dur;
    }
    const last = project.scripts[project.scripts.length - 1];
    return { scriptId: last.id, localMs: 0 };
  };

  const draw = async (globalMs: number) => {
    const head = atGlobal(globalMs);
    const rebuild = head.scriptId !== lastScript;
    lastScript = head.scriptId;
    flushSync(() => setHead(head.scriptId, head.localMs));
    if (rebuild) await new Promise((r) => setTimeout(r, 50));
    const shot = await toCanvas(stage, { pixelRatio: 1, cacheBust: false, width: w, height: h });
    ctx.drawImage(shot, 0, 0, w, h);
  };

  await new Promise<void>((resolve, reject) => {
    const tick = async () => {
      try {
        const elapsed = performance.now() - t0;
        if (elapsed >= duration) {
          await draw(duration);
          onProgress?.(1);
          resolve();
          return;
        }
        if (elapsed - lastDraw >= frameMs * 0.7) {
          lastDraw = elapsed;
          await draw(elapsed);
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
  return { blob, ext };
}
