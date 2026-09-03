import { beatOrder, langAudioOf, sceneDurationMs } from "./clock";
import type { LangId } from "./langs";
import type { Project, SceneScript } from "../types";

export type SubtitleCue = { startMs: number; endMs: number; text: string; beatId: string };

export function beatLine(script: SceneScript, beatId: string, lang: LangId, source: LangId): string {
  const beat = script.beats.find((b) => b.id === beatId);
  if (!beat) return "";
  return (beat.text[lang] || beat.text[source] || "").replace(/\s+/g, " ").trim();
}

export function beatSpans(script: SceneScript, lang: LangId): { id: string; text: string; startMs: number; endMs: number }[] {
  const audio = langAudioOf(script, lang);
  let t = 0;
  return beatOrder(script, audio).map((b) => {
    const span = { id: b.id, text: b.text, startMs: t, endMs: t + b.ms };
    t += b.ms;
    return span;
  });
}

export function captionLinesAt(
  script: SceneScript,
  clockLang: LangId,
  source: LangId,
  localMs: number,
  secondLang?: LangId | null,
): string[] {
  const hit = beatSpans(script, clockLang).find((s) => localMs >= s.startMs && localMs < s.endMs);
  if (!hit) return [];
  const primary = beatLine(script, hit.id, clockLang, source) || hit.text;
  if (!primary) return [];
  if (!secondLang || secondLang === clockLang) return [primary];
  const secondary = beatLine(script, hit.id, secondLang, source);
  return secondary && secondary !== primary ? [primary, secondary] : [primary];
}

export type CollectSubtitleOpts = {
  includeClockLang?: boolean;
};

/**
 * Cue times follow `clockLang` (the spoken / video language).
 * `textLang` only swaps the written line so several files can share one video timeline.
 */
export function collectScriptSubtitles(
  script: SceneScript,
  clockLang: LangId,
  textLang: LangId,
  source: LangId,
  opts?: CollectSubtitleOpts,
): SubtitleCue[] {
  const same = textLang === clockLang;
  const pair = Boolean(opts?.includeClockLang) && !same;
  const cues: SubtitleCue[] = [];
  for (const span of beatSpans(script, clockLang)) {
    const spoken = beatLine(script, span.id, clockLang, source) || span.text;
    const written = same ? spoken : beatLine(script, span.id, textLang, source);
    let text = "";
    if (pair) text = written && written !== spoken ? `${spoken}\n${written}` : spoken;
    else text = written;
    if (!text) continue;
    cues.push({
      beatId: span.id,
      startMs: span.startMs,
      endMs: Math.max(span.endMs, span.startMs + 200),
      text,
    });
  }
  return cues;
}

export function scriptStarts(project: Project, lang: LangId): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const script of project.scripts) {
    starts.push(t);
    t += sceneDurationMs(script, langAudioOf(script, lang));
  }
  return starts;
}

export function projectDurationMs(project: Project, lang: LangId): number {
  return project.scripts.reduce((n, s) => n + sceneDurationMs(s, langAudioOf(s, lang)), 0);
}

export function collectSubtitles(
  project: Project,
  clockLang: LangId,
  textLang: LangId = clockLang,
  opts?: CollectSubtitleOpts,
): SubtitleCue[] {
  const source = project.sourceLang;
  const starts = scriptStarts(project, clockLang);
  const cues: SubtitleCue[] = [];
  project.scripts.forEach((script, i) => {
    const origin = starts[i];
    for (const c of collectScriptSubtitles(script, clockLang, textLang, source, opts)) {
      cues.push({ ...c, startMs: c.startMs + origin, endMs: c.endMs + origin });
    }
  });
  cues.sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].startMs < cues[i - 1].endMs) cues[i - 1].endMs = cues[i].startMs;
  }
  return cues.filter((c) => c.endMs - c.startMs >= 80);
}

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
