import { beatWindow, estimateBeatMs, langAudioOf, narrationOrder } from "./clock";
import { driveOf, gapMsOf, isGapBeat } from "./beats";
import type { LangId } from "./langs";
import type { PlayCue, SceneScript } from "../types";

type LibBeat = { id: string; text: string; ms: number; kind: "speech" | "gap" };

/** Runtime clock injected into animation code. Durations follow TTS for the preview language. */
export interface SpeechApi {
  /** Beat length in milliseconds. Missing / empty beat → 0. */
  ms(id: string): number;
  /** Beat length in seconds — use this as a *section*'s total duration. */
  s(id: string): number;
  startMs(id: string): number;
  startS(id: string): number;
  endMs(id: string): number;
  endS(id: string): number;
  /**
   * Seconds left in this beat after a fixed entrance.
   * holdS("hook", 0.48) === max(0, s("hook") - 0.48).
   * Entrance stays 0.48s in every language; the hold absorbs extra TTS.
   */
  holdS(id: string, usedS: number): number;
  holdMs(id: string, usedMs: number): number;
  /** Spoken body only: Σ beats on the calendar (no pauses / gaps). */
  bodyMs(): number;
  bodyS(): number;
  /**
   * Pause (seconds).
   * narration: adds to the tail after the list clock.
   * script: advances the play() cursor (inserts silence before the next play).
   * With no argument, returns the sum of pauses recorded in this run.
   */
  sleepS(seconds?: number): number;
  sleepMs(ms?: number): number;
  /** @deprecated Use sleepS — same accumulate-pause semantics. */
  tailS(seconds?: number): number;
  /** @deprecated Use sleepMs */
  tailMs(ms?: number): number;
  /**
   * Script-driven: put this line on the speech calendar and return its start (seconds).
   * Use as a GSAP position: timeline.fromTo(..., speech.play("hook")).
   * Optional atS places it at that time (overlap allowed). Default = play cursor.
   * Narration-driven: same as startS — list order already scheduled the line.
   */
  play(id: string, atS?: number): number;
  /** Scheduled cues after play() (script) or the list clock (narration). */
  cues(): PlayCue[];
  /** Whole scene. narration: body + list gaps + sleepS. script: play cursor. */
  totalMs(): number;
  totalS(): number;
  text(id: string): string;
  ids(): string[];
}

function library(script: SceneScript, lang: LangId): Map<string, LibBeat> {
  const audio = langAudioOf(script, lang);
  const byId = new Map<string, LibBeat>();
  for (const beat of script.beats) {
    if (isGapBeat(beat)) {
      byId.set(beat.id, { id: beat.id, text: "", ms: gapMsOf(beat), kind: "gap" });
      continue;
    }
    const text = (beat.text[audio.lang] ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const ms = audio.beatMs[beat.id] ?? estimateBeatMs(text);
    if (ms <= 0) continue;
    byId.set(beat.id, { id: beat.id, text, ms, kind: "speech" });
  }
  return byId;
}

export function createSpeech(script: SceneScript, lang: LangId): SpeechApi {
  const audio = langAudioOf(script, lang);
  const lib = library(script, lang);
  const lookup = (id: string) => beatWindow(script, audio, id);
  const scriptDrive = driveOf(script) === "script";

  const startOf = new Map<string, number>();
  const scheduled: PlayCue[] = [];
  let cursor = 0;
  let addedSleepMs = 0;

  if (!scriptDrive) {
    for (const b of narrationOrder(script, audio)) {
      startOf.set(b.id, b.startMs);
      scheduled.push({ id: b.id, startMs: b.startMs, ms: b.ms });
      cursor = b.startMs + b.ms;
    }
  }

  const addSleepMs = (ms: number) => {
    const n = Math.max(0, ms);
    addedSleepMs += n;
    if (scriptDrive) cursor += n;
    return n;
  };

  const playAt = (id: string, atMs?: number) => {
    if (!scriptDrive) return startOf.get(id) ?? lookup(id)?.start ?? 0;
    const existing = scheduled.find((c) => c.id === id);
    if (existing) return existing.startMs;
    const beat = lib.get(id);
    const ms = beat?.ms ?? 0;
    const start = Math.max(0, atMs ?? cursor);
    scheduled.push({ id, startMs: start, ms });
    startOf.set(id, start);
    cursor = Math.max(cursor, start + ms);
    return start;
  };

  const bodyOfCalendar = () =>
    scheduled.filter((c) => lib.get(c.id)?.kind !== "gap").reduce((n, c) => n + c.ms, 0);

  return {
    ms(id) {
      return lib.get(id)?.ms ?? 0;
    },
    s(id) {
      return this.ms(id) / 1000;
    },
    startMs(id) {
      return startOf.get(id) ?? lookup(id)?.start ?? 0;
    },
    startS(id) {
      return this.startMs(id) / 1000;
    },
    endMs(id) {
      return this.startMs(id) + this.ms(id);
    },
    endS(id) {
      return this.endMs(id) / 1000;
    },
    holdMs(id, usedMs) {
      return Math.max(0, this.ms(id) - usedMs);
    },
    holdS(id, usedS) {
      return Math.max(0, this.s(id) - usedS);
    },
    bodyMs() {
      return scriptDrive ? bodyOfCalendar() : scheduled.filter((c) => lib.get(c.id)?.kind !== "gap").reduce((n, c) => n + c.ms, 0);
    },
    bodyS() {
      return this.bodyMs() / 1000;
    },
    sleepMs(ms) {
      if (ms != null && Number.isFinite(ms)) return addSleepMs(ms);
      return addedSleepMs;
    },
    sleepS(seconds) {
      if (seconds != null && Number.isFinite(seconds)) return addSleepMs(seconds * 1000) / 1000;
      return addedSleepMs / 1000;
    },
    tailMs(ms) {
      return this.sleepMs(ms);
    },
    tailS(seconds) {
      return this.sleepS(seconds);
    },
    play(id, atS) {
      const atMs = atS != null && Number.isFinite(atS) ? atS * 1000 : undefined;
      return playAt(id, atMs) / 1000;
    },
    cues() {
      return scheduled.map((c) => ({ ...c }));
    },
    totalMs() {
      if (scriptDrive) return Math.max(1, cursor);
      return Math.max(1, cursor + addedSleepMs);
    },
    totalS() {
      return this.totalMs() / 1000;
    },
    text(id) {
      return lib.get(id)?.text ?? "";
    },
    ids() {
      return [...lib.values()].filter((b) => b.kind === "speech").map((b) => b.id);
    },
  };
}
