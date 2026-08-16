import { uid } from "./ids";
import { sceneBlocks } from "./blocks";
import { textOf } from "./textI18n";
import type { LangId } from "./langs";
import type { AnimKind, Cue, Scene, TextI18n, WordTs } from "../types";

export const SPEAK_OPEN = "open";
export const SPEAK_CLOSE = "close";

export function itemSpeakKey(itemId: string) {
  return `item:${itemId}`;
}

export function speakText(scene: Scene, key: string, lang: LangId, source: LangId): string {
  if (key === SPEAK_OPEN) return textOf(scene.narration, lang, source);
  if (key === SPEAK_CLOSE) return textOf(scene.narrationClose, lang, source);
  return textOf(scene.speak?.[key], lang, source);
}

export type NarrationBeat = {
  target: string;
  text: string;
};

/** Open → each element (list items nested) → close. Empty lines are skipped. */
export function collectNarrationBeats(scene: Scene, lang: LangId, source: LangId): NarrationBeat[] {
  const beats: NarrationBeat[] = [];
  const push = (target: string, text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t) beats.push({ target, text: t });
  };
  push(SPEAK_OPEN, speakText(scene, SPEAK_OPEN, lang, source));
  for (const block of sceneBlocks(scene)) {
    push(block.id, speakText(scene, block.id, lang, source));
    if (block.type === "list") {
      for (const it of scene.slots.items ?? []) {
        push(itemSpeakKey(it.id), speakText(scene, itemSpeakKey(it.id), lang, source));
      }
    }
  }
  push(SPEAK_CLOSE, speakText(scene, SPEAK_CLOSE, lang, source));
  return beats;
}

export function composeNarration(scene: Scene, lang: LangId, source: LangId): string {
  return joinBeatTexts(collectNarrationBeats(scene, lang, source).map((b) => b.text));
}

export function joinBeatTexts(parts: string[]): string {
  let text = "";
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (text && !/[。！？.!?…]$/.test(text) && !/^[。！？.!?…]/.test(p)) text += "。";
    text += p;
  }
  return text;
}

function strip(s: string) {
  return s.replace(/\s+/g, "").replace(/[。，、！？；：""''“”‘’—…,.!?;:()（）【】]/g, "");
}

export function alignBeatsToWords(
  beats: NarrationBeat[],
  words: WordTs[],
  durationMs: number,
): { target: string; startMs: number; endMs: number }[] {
  if (!beats.length) return [];
  const dur = Math.max(1, durationMs);
  if (!words.length) {
    const total = beats.reduce((n, b) => n + Math.max(1, strip(b.text).length), 0);
    let t = 0;
    return beats.map((b) => {
      const span = (Math.max(1, strip(b.text).length) / total) * dur;
      const startMs = t;
      t += span;
      return { target: b.target, startMs, endMs: Math.min(dur, t) };
    });
  }

  let wi = 0;
  const skipEmpty = () => {
    while (wi < words.length && !strip(words[wi].text)) wi += 1;
  };
  return beats.map((beat, i) => {
    skipEmpty();
    const startMs = words[wi]?.startMs ?? (i === 0 ? 0 : words[words.length - 1]?.endMs ?? 0);
    const last = i === beats.length - 1;
    if (last) {
      const endMs = words[words.length - 1]?.endMs ?? dur;
      wi = words.length;
      return { target: beat.target, startMs, endMs };
    }
    const need = Math.max(1, strip(beat.text).length);
    let acc = 0;
    let endMs = startMs;
    while (wi < words.length && acc < need) {
      acc += strip(words[wi].text).length;
      endMs = words[wi].endMs;
      wi += 1;
      if (acc >= need) break;
    }
    return { target: beat.target, startMs, endMs };
  });
}

function cueAnimFor(target: string): AnimKind {
  if (target.startsWith("item:")) return "slide";
  return "fade";
}

/** Ensure each spoken element has a cue. Does not rewrite shared at/until. */
export function ensureCuesFromBeats(scene: Scene, lang: LangId, source: LangId): Cue[] {
  const beats = collectNarrationBeats(scene, lang, source);
  const next = [...(scene.cues ?? [])];
  const seen = new Set(next.map((c) => c.target));
  for (const beat of beats) {
    if (beat.target === SPEAK_OPEN || beat.target === SPEAK_CLOSE) continue;
    if (seen.has(beat.target)) continue;
    seen.add(beat.target);
    next.push({
      id: uid("cue"),
      target: beat.target,
      bind: "speak",
      at: 0,
      until: 1,
      stay: "body",
      anim: cueAnimFor(beat.target),
    });
  }
  return next;
}

export function writeSpeak(scene: Scene, key: string, slot: TextI18n): Scene {
  if (key === SPEAK_OPEN) return { ...scene, narration: slot };
  if (key === SPEAK_CLOSE) return { ...scene, narrationClose: slot };
  return { ...scene, speak: { ...scene.speak, [key]: slot } };
}

export function markLangAudioStale(scene: Scene, lang: LangId): Scene {
  const audio = scene.audioByLang?.[lang];
  if (!audio) return scene;
  return { ...scene, audioByLang: { ...scene.audioByLang, [lang]: { ...audio, stale: true } } };
}

export type BeatSpan = { target: string; text: string; startMs: number; endMs: number };

export function beatSpansForScene(scene: Scene, lang: LangId, source: LangId): BeatSpan[] {
  const beats = collectNarrationBeats(scene, lang, source);
  if (!beats.length) return [];
  const audio = scene.audioByLang?.[lang];
  const fresh = audio && !audio.stale ? audio : undefined;
  const durationMs = fresh?.durationMs && fresh.durationMs > 0
    ? fresh.durationMs
    : Math.max(1000, composeNarration(scene, lang, source).length * 180);
  const aligned = alignBeatsToWords(beats, fresh?.words ?? [], durationMs);
  return aligned.map((s, i) => ({
    target: s.target,
    text: beats[i]?.text ?? "",
    startMs: s.startMs,
    endMs: s.endMs,
  }));
}

function targetOnStage(scene: Scene, target: string, progress: number, onStage?: (target: string) => boolean): boolean {
  if (target === SPEAK_OPEN || target === SPEAK_CLOSE) return true;
  if (onStage) return onStage(target);
  const cue = scene.cues.find((c) => c.target === target);
  if (!cue) return true;
  const until = cue.until ?? 1;
  return progress >= cue.at - 0.001 && progress <= until + 0.001;
}

/** Caption for the beat currently being spoken, only if that element is on stage. */
export function captionForTime(
  scene: Scene,
  lang: LangId,
  source: LangId,
  localMs: number,
  durationMs: number,
  phase?: string,
  audioMs?: number | null,
  animLocalMs?: number,
  animDurationMs?: number,
  onStage?: (target: string) => boolean,
): string {
  if (phase === "openPad" || phase === "openGap" || phase === "closePad" || phase === "closeGap" || phase === "hold") {
    return "";
  }
  if (phase === "open") return speakText(scene, SPEAK_OPEN, lang, source);
  if (phase === "close") return speakText(scene, SPEAK_CLOSE, lang, source);

  const spans = beatSpansForScene(scene, lang, source);
  if (!spans.length) return "";
  const t = audioMs ?? localMs;
  const lastEnd = spans[spans.length - 1]?.endMs ?? 0;
  if (t > lastEnd + 240) return "";
  let hit: BeatSpan | undefined;
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].target === SPEAK_OPEN || spans[i].target === SPEAK_CLOSE) continue;
    const start = spans[i].startMs;
    const end = spans[i + 1]?.startMs ?? spans[i].endMs + 80;
    if (t >= start && t < end) {
      hit = spans[i];
      break;
    }
  }
  if (!hit) return "";
  const progress =
    animDurationMs && animDurationMs > 0
      ? (animLocalMs ?? 0) / animDurationMs
      : durationMs > 0
        ? localMs / durationMs
        : 0;
  if (!targetOnStage(scene, hit.target, progress, onStage)) return "";
  return hit.text;
}
