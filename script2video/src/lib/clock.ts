import type { BeatDurations, LangAudio, MappedEvent, PlayCue, SceneScript } from "../types";
import type { LangId } from "./langs";
import { driveOf, gapMsOf, isGapBeat } from "./beats";

const FALLBACK_MS_PER_CHAR = 180;

export function estimateBeatMs(text: string): number {
  const n = text.replace(/\s+/g, "").length;
  return Math.max(400, n * FALLBACK_MS_PER_CHAR);
}

export type OrderedBeat = {
  id: string;
  text: string;
  ms: number;
  kind: "speech" | "gap";
  startMs: number;
};

function speechText(beat: SceneScript["beats"][number], lang: LangId): string {
  return (beat.text[lang] ?? "").replace(/\s+/g, " ").trim();
}

/** List-order clock: speech lines + gap rows. */
export function narrationOrder(script: SceneScript, audio: LangAudio): OrderedBeat[] {
  const out: OrderedBeat[] = [];
  let t = 0;
  for (const beat of script.beats) {
    if (isGapBeat(beat)) {
      const ms = gapMsOf(beat);
      if (ms <= 0) continue;
      out.push({ id: beat.id, text: "", ms, kind: "gap", startMs: t });
      t += ms;
      continue;
    }
    const text = speechText(beat, audio.lang);
    if (!text) continue;
    const ms = audio.beatMs[beat.id] ?? estimateBeatMs(text);
    if (ms <= 0) continue;
    out.push({ id: beat.id, text, ms, kind: "speech", startMs: t });
    t += ms;
  }
  return out;
}

function scheduleOrder(script: SceneScript, audio: LangAudio, cues: PlayCue[]): OrderedBeat[] {
  return cues.map((cue) => {
    const beat = script.beats.find((b) => b.id === cue.id);
    const text = beat && !isGapBeat(beat) ? speechText(beat, audio.lang) : "";
    return {
      id: cue.id,
      text,
      ms: cue.ms,
      kind: beat && isGapBeat(beat) ? "gap" : "speech",
      startMs: cue.startMs,
    };
  });
}

export function beatOrder(script: SceneScript, audio: LangAudio): OrderedBeat[] {
  if (driveOf(script) === "script" && script.driveSchedule?.length) {
    return scheduleOrder(script, audio, script.driveSchedule);
  }
  return narrationOrder(script, audio);
}

export function sceneDurationMs(script: SceneScript, audio: LangAudio): number {
  if (driveOf(script) === "script" && script.driveTotalMs && script.driveTotalMs > 0) {
    return Math.max(1, Math.round(script.driveTotalMs));
  }
  const order = beatOrder(script, audio);
  const end = order.reduce((n, b) => Math.max(n, b.startMs + b.ms), 0);
  const tail = driveOf(script) === "script" ? 0 : Math.max(0, script.holdMs ?? 0);
  return Math.max(1, end + tail);
}

export function beatWindow(script: SceneScript, audio: LangAudio, beatId: string): { start: number; duration: number } | null {
  const hit = beatOrder(script, audio).find((b) => b.id === beatId);
  if (!hit) return null;
  return { start: hit.startMs, duration: hit.ms };
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
    if (isGapBeat(beat)) {
      beatMs[beat.id] = gapMsOf(beat);
      continue;
    }
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
    drive: driveOf(script),
    duration_ms: sceneDurationMs(script, audio),
    /** Sum of speech.sleepS pauses (not a single tail). */
    sleep_ms: Math.max(0, script.holdMs ?? 0),
    /** @deprecated Same as sleep_ms */
    tail_ms: Math.max(0, script.holdMs ?? 0),
    beats: beatOrder(script, audio).map((b) => ({
      id: b.id,
      kind: b.kind,
      text: b.text,
      ms: b.ms,
      start_ms: Math.round(b.startMs),
    })),
    events: mapEvents(script, audio).map((e) => ({
      id: e.id,
      label: e.label,
      start_ms: Math.round(e.startMs),
      end_ms: Math.round(e.endMs),
    })),
  };
}
