import { SPEAK_CLOSE, SPEAK_OPEN, beatSpansForScene } from "./narration";
import { sourceLangOf } from "./textI18n";
import { sceneClock, sceneStarts } from "./timeline";
import type { LangId } from "./langs";
import type { Project } from "../types";

export type SubtitleCue = { startMs: number; endMs: number; text: string };

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

function stamp(ms: number, decimal: "," | ".") {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const frac = t % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${decimal}${pad(frac, 3)}`;
}

function audioToLocal(clock: ReturnType<typeof sceneClock>, audioMs: number, target: string): number {
  if (target === SPEAK_OPEN) return clock.openBeforeMs + (audioMs - clock.audioOpenStartMs);
  if (target === SPEAK_CLOSE) return clock.closeSpeechStartMs + (audioMs - clock.audioCloseStartMs);
  return clock.bodyStartMs + (audioMs - clock.audioBodyStartMs);
}

export function collectSubtitles(project: Project, lang: LangId): SubtitleCue[] {
  const source = sourceLangOf(project);
  const starts = sceneStarts(project, lang);
  const cues: SubtitleCue[] = [];
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const clock = sceneClock(scene, lang, project);
    const origin = starts[i];
    for (const beat of beatSpansForScene(scene, lang, source)) {
      const text = beat.text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      let start = origin + audioToLocal(clock, beat.startMs, beat.target);
      let end = origin + audioToLocal(clock, beat.endMs, beat.target);
      if (end < start) [start, end] = [end, start];
      end = Math.max(end, start + 200);
      cues.push({ startMs: Math.max(0, start), endMs: end, text });
    }
  }
  cues.sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].startMs < cues[i - 1].endMs) cues[i - 1].endMs = cues[i].startMs;
  }
  return cues.filter((c) => c.endMs - c.startMs >= 80);
}

function escapeVtt(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/-->/g, "→");
}

export function formatSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.startMs, ",")} --> ${stamp(c.endMs, ",")}\n${c.text}\n`)
    .join("\n");
}

export function formatVtt(cues: SubtitleCue[]): string {
  const body = cues.map((c) => `${stamp(c.startMs, ".")} --> ${stamp(c.endMs, ".")}\n${escapeVtt(c.text)}\n`).join("\n");
  return `WEBVTT\n\n${body}`;
}

export function subtitleFile(project: Project, lang: LangId, format: "srt" | "vtt"): { name: string; text: string; type: string } | null {
  const cues = collectSubtitles(project, lang);
  if (!cues.length) return null;
  const base = `${project.name || "export"}-${lang}`;
  if (format === "vtt") return { name: `${base}.vtt`, text: formatVtt(cues), type: "text/vtt;charset=utf-8" };
  return { name: `${base}.srt`, text: formatSrt(cues), type: "application/x-subrip;charset=utf-8" };
}
