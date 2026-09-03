import { beatOrder, beatWindow, langAudioOf } from "./clock";
import type { LangId } from "./langs";
import type { SceneScript } from "../types";

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
  /** Seconds left in the beat after a fixed entrance (e.g. fade). */
  /**
   * Seconds left in this beat after a fixed entrance.
   * holdS("hook", 0.48) === max(0, s("hook") - 0.48).
   * Entrance stays 0.48s in every language; the hold absorbs extra TTS.
   */
  holdS(id: string, usedS: number): number;
  holdMs(id: string, usedMs: number): number;
  /** Spoken body only: Σ beats, no pauses. */
  bodyMs(): number;
  bodyS(): number;
  /**
   * Pause (seconds). Each call adds that pause to the scene length and returns it
   * (use as a tween duration). totalS() = bodyS() + Σ sleepS(...).
   * With no argument, returns the sum of pauses recorded in this run.
   */
  sleepS(seconds?: number): number;
  sleepMs(ms?: number): number;
  /** @deprecated Use sleepS — same accumulate-pause semantics. */
  tailS(seconds?: number): number;
  /** @deprecated Use sleepMs */
  tailMs(ms?: number): number;
  /** Whole scene: body + all pauses. */
  totalMs(): number;
  totalS(): number;
  text(id: string): string;
  ids(): string[];
}

export function createSpeech(script: SceneScript, lang: LangId): SpeechApi {
  const audio = langAudioOf(script, lang);
  const order = beatOrder(script, audio);
  const startOf = new Map<string, number>();
  let t = 0;
  for (const b of order) {
    startOf.set(b.id, t);
    t += b.ms;
  }
  const byId = new Map(order.map((b) => [b.id, b]));
  const lookup = (id: string) => beatWindow(script, audio, id);
  const body = order.reduce((n, b) => n + b.ms, 0);
  let addedSleepMs = 0;

  const addSleepMs = (ms: number) => {
    const n = Math.max(0, ms);
    addedSleepMs += n;
    return n;
  };

  return {
    ms(id) {
      return byId.get(id)?.ms ?? 0;
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
      return body;
    },
    bodyS() {
      return body / 1000;
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
    totalMs() {
      return Math.max(1, body + addedSleepMs);
    },
    totalS() {
      return this.totalMs() / 1000;
    },
    text(id) {
      return byId.get(id)?.text ?? "";
    },
    ids() {
      return order.map((b) => b.id);
    },
  };
}
