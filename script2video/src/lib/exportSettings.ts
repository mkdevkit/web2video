import type { AspectId, ExportFormatId, ExportHeightId, ExportSettings } from "../types";
import { ASPECT_PX } from "../types";

export const EXPORT_FORMATS: {
  id: ExportFormatId;
  label: string;
  hint: string;
  ext: "webm" | "mp4";
  mimes: string[];
}[] = [
  {
    id: "webm-vp9",
    label: "WebM · VP9",
    hint: "体积较小，Chrome / Edge 都能录",
    ext: "webm",
    mimes: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9"],
  },
  {
    id: "webm-vp8",
    label: "WebM · VP8",
    hint: "兼容更好，文件略大",
    ext: "webm",
    mimes: ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"],
  },
  {
    id: "mp4-h264",
    label: "MP4 · H.264",
    hint: "剪辑软件更认；需较新的 Chrome / Edge",
    ext: "mp4",
    mimes: [
      'video/mp4;codecs="avc1.640028,mp4a.40.2"',
      "video/mp4;codecs=avc1.640028,mp4a.40.2",
      "video/mp4",
    ],
  },
];

export const EXPORT_HEIGHTS: { id: ExportHeightId; label: string }[] = [
  { id: 1080, label: "1080p" },
  { id: 720, label: "720p" },
  { id: 480, label: "480p" },
];

export const EXPORT_FPS = [24, 25, 30] as const;

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "webm-vp9",
  height: 1080,
  fps: 24,
  videoMbps: 6,
  audioKbps: 128,
  exportSubtitles: false,
  subtitleFormat: "srt",
};

export const EXPORT_PRESETS: { id: string; label: string; patch: Partial<ExportSettings> }[] = [
  { id: "draft", label: "草稿", patch: { height: 720, fps: 24, videoMbps: 3 } },
  { id: "standard", label: "标准", patch: { height: 1080, fps: 24, videoMbps: 6 } },
  { id: "high", label: "高清", patch: { height: 1080, fps: 30, videoMbps: 12 } },
];

function even(n: number) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

export function exportPx(aspect: AspectId, height: number): { w: number; h: number } {
  const base = ASPECT_PX[aspect] ?? ASPECT_PX["16:9"];
  const short = Math.min(base.w, base.h);
  const scale = height / short;
  return { w: even(base.w * scale), h: even(base.h * scale) };
}

export function exportSettingsOf(partial?: Partial<ExportSettings> | null): ExportSettings {
  const p = partial ?? {};
  const format: ExportFormatId =
    p.format === "webm-vp8" || p.format === "mp4-h264" || p.format === "webm-vp9" ? p.format : DEFAULT_EXPORT_SETTINGS.format;
  const height: ExportHeightId = p.height === 720 || p.height === 480 || p.height === 1080 ? p.height : DEFAULT_EXPORT_SETTINGS.height;
  const fps = p.fps === 24 || p.fps === 25 || p.fps === 30 ? p.fps : DEFAULT_EXPORT_SETTINGS.fps;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
    return Math.min(max, Math.max(min, v));
  };
  return {
    format,
    height,
    fps,
    videoMbps: clamp(p.videoMbps, 1, 20, DEFAULT_EXPORT_SETTINGS.videoMbps),
    audioKbps: clamp(p.audioKbps, 64, 256, DEFAULT_EXPORT_SETTINGS.audioKbps),
    exportSubtitles: typeof p.exportSubtitles === "boolean" ? p.exportSubtitles : DEFAULT_EXPORT_SETTINGS.exportSubtitles,
    subtitleFormat: p.subtitleFormat === "vtt" ? "vtt" : "srt",
  };
}

export function pickMimeFor(id: ExportFormatId): string {
  const spec = EXPORT_FORMATS.find((f) => f.id === id);
  if (!spec || typeof MediaRecorder === "undefined") return "";
  return spec.mimes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function formatSupported(id: ExportFormatId): boolean {
  return Boolean(pickMimeFor(id));
}

export function formatExt(id: ExportFormatId): "webm" | "mp4" {
  return EXPORT_FORMATS.find((f) => f.id === id)?.ext ?? "webm";
}
