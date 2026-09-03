import type { BeatDurations, LangAudio, MappedEvent, SceneScript } from "../types";
import type { LangId } from "./langs";

const FALLBACK_MS_PER_CHAR = 180;

export function estimateBeatMs(text: string): number {
  const n = text.replace(/\s+/g, "").length;
  return Math.max(400, n * FALLBACK_MS_PER_CHAR);
}

export function beatOrder(script: SceneScript, audio: LangAudio): { id: string; text: string; ms: number }[] {
  const out: { id: string; text: string; ms: number }[] = [];
  for (const beat of script.beats) {
    const text = (beat.text[audio.lang] ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const ms = audio.beatMs[beat.id] ?? estimateBeatMs(text);
    if (ms <= 0) continue;
    out.push({ id: beat.id, text, ms });
  }
  return out;
}

export function sceneDurationMs(script: SceneScript, audio: LangAudio): number {
  const body = beatOrder(script, audio).reduce((n, b) => n + b.ms, 0);
  return Math.max(1, body + (script.holdMs ?? 0)); // holdMs = Σ speech.sleepS
}

export function beatWindow(script: SceneScript, audio: LangAudio, beatId: string): { start: number; duration: number } | null {
  let t = 0;
  for (const b of beatOrder(script, audio)) {
    if (b.id === beatId) return { start: t, duration: b.ms };
    t += b.ms;
  }
  return null;
}

export function mapEvents(script: SceneScript, audio: LangAudio): MappedEvent[] {
  const mapped: MappedEvent[] = [];
  for (const ev of script.events) {
    const win = beatWindow(script, audio, ev.beatId);
    if (!win) continue;
    if (ev.bind === "fixed") {
      const start = win.start;
      const end = start + Math.max(80, ev.durationMs ?? 400);
      mapped.push({ id: ev.id, label: ev.label, startMs: start, endMs: Math.min(end, win.start + win.duration) });
      continue;
    }
    const at = Math.min(1, Math.max(0, ev.at));
    const until = ev.until == null ? 1 : Math.min(1, Math.max(at, ev.until));
    const start = win.start + at * win.duration;
    const end = win.start + until * win.duration;
    mapped.push({ id: ev.id, label: ev.label, startMs: start, endMs: Math.max(start + 80, end) });
  }
  return mapped.sort((a, b) => a.startMs - b.startMs);
}

export function eventAt(events: MappedEvent[], localMs: number): MappedEvent[] {
  return events.filter((e) => localMs >= e.startMs && localMs < e.endMs);
}

export function progressIn(ev: MappedEvent, localMs: number): number {
  const span = Math.max(1, ev.endMs - ev.startMs);
  return Math.min(1, Math.max(0, (localMs - ev.startMs) / span));
}

export function compareLangs(script: SceneScript, audios: LangAudio[]): Record<string, Record<string, string>> {
  const rows: Record<string, Record<string, string>> = {};
  for (const audio of audios) {
    const total = sceneDurationMs(script, audio);
    rows.__duration__ = rows.__duration__ ?? {};
    rows.__duration__[audio.lang] = `${(total / 1000).toFixed(2)}s`;
    for (const ev of mapEvents(script, audio)) {
      rows[ev.id] = rows[ev.id] ?? { label: ev.label };
      rows[ev.id][audio.lang] = `${(ev.startMs / 1000).toFixed(2)}–${(ev.endMs / 1000).toFixed(2)}s`;
    }
  }
  return rows;
}

export function durationsFromEstimate(script: SceneScript, lang: LangId): BeatDurations {
  const beatMs: BeatDurations = {};
  for (const beat of script.beats) {
    const text = (beat.text[lang] ?? "").trim();
    if (text) beatMs[beat.id] = estimateBeatMs(text);
  }
  return beatMs;
}

export function langAudioOf(script: SceneScript, lang: LangId): LangAudio {
  const stored = script.audioByLang?.[lang];
  if (stored && !stored.stale && Object.keys(stored.beatMs).length) {
    return { lang, beatMs: stored.beatMs };
  }
  return { lang, beatMs: durationsFromEstimate(script, lang) };
}

export function toClockJson(script: SceneScript, audio: LangAudio) {
  return {
    lang: audio.lang,
    duration_ms: sceneDurationMs(script, audio),
    /** Sum of speech.sleepS pauses (not a single tail). */
    sleep_ms: Math.max(0, script.holdMs ?? 0),
    /** @deprecated Same as sleep_ms */
    tail_ms: Math.max(0, script.holdMs ?? 0),
    beats: beatOrder(script, audio).map((b) => ({ id: b.id, text: b.text, ms: b.ms })),
    events: mapEvents(script, audio).map((e) => ({
      id: e.id,
      label: e.label,
      start_ms: Math.round(e.startMs),
      end_ms: Math.round(e.endMs),
    })),
  };
}
