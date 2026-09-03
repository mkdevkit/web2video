import { bilingualCaptionLangOf, captionSecondaryText, speakText } from "./narration";
import { sourceLangOf } from "./textI18n";
import { sceneCalendar, sceneStarts } from "./timeline";
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

export type CollectSubtitleOpts = {
  /** Put the spoken / video-language line above the translation in the same cue. */
  includeClockLang?: boolean;
};

/**
 * Cue times follow `clockLang` (the video / spoken language).
 * `textLang` only swaps the written line so several subtitle files can share one video timeline.
 */
export function collectSubtitles(
  project: Project,
  clockLang: LangId,
  textLang: LangId = clockLang,
  opts?: CollectSubtitleOpts,
): SubtitleCue[] {
  const source = sourceLangOf(project);
  const starts = sceneStarts(project, clockLang);
  const cues: SubtitleCue[] = [];
  const sameLang = textLang === clockLang;
  const pair = Boolean(opts?.includeClockLang) && !sameLang;
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const cal = sceneCalendar(scene, clockLang, project);
    const origin = starts[i];
    for (const beat of cal.spans) {
      if (beat.kind !== "speech") continue;
      const timed = beat.text.replace(/\s+/g, " ").trim();
      if (!timed) continue;
      const translated = sameLang
        ? timed
        : speakText(scene, beat.target, textLang, source).replace(/\s+/g, " ").trim();
      let text = "";
      if (pair) {
        text = translated && translated !== timed ? `${timed}\n${translated}` : timed;
      } else {
        if (!translated) continue;
        const other = sameLang ? bilingualCaptionLangOf(project, clockLang) : null;
        const secondary = other ? captionSecondaryText(scene, beat.target, other, source, translated) : "";
        text = secondary ? `${translated}\n${secondary}` : translated;
      }
      let start = origin + beat.startMs;
      let end = origin + beat.endMs;
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

export function subtitleFile(
  project: Project,
  clockLang: LangId,
  format: "srt" | "vtt",
  textLang: LangId = clockLang,
  opts?: CollectSubtitleOpts,
): { name: string; text: string; type: string } | null {
  const cues = collectSubtitles(project, clockLang, textLang, opts);
  if (!cues.length) return null;
  const stem = project.name || "export";
  const base = textLang === clockLang ? `${stem}-${clockLang}` : `${stem}-${clockLang}-${textLang}`;
  if (format === "vtt") return { name: `${base}.vtt`, text: formatVtt(cues), type: "text/vtt;charset=utf-8" };
  return { name: `${base}.srt`, text: formatSrt(cues), type: "application/x-subrip;charset=utf-8" };
}
