import { uid } from "./ids";
import { sceneBlocks } from "./blocks";
import { displayI18n } from "./textI18n";
import type { LangId } from "./langs";
import type { Scene, SpeakLine, TextI18n } from "../types";

export const SPEAK_OPEN = "open";
export const SPEAK_CLOSE = "close";

export function itemSpeakKey(itemId: string) {
  return `item:${itemId}`;
}

export function isGapSpeak(line: Pick<SpeakLine, "kind">): boolean {
  return line.kind === "gap";
}

export function findSpeak(scene: Scene, id: string): SpeakLine | undefined {
  return speaksOf(scene).find((s) => s.id === id);
}

function slotI18n(slot: TextI18n | undefined): Partial<Record<LangId, string>> | undefined {
  return slot?.i18n;
}

function hasText(i18n: Partial<Record<LangId, string>> | undefined): boolean {
  return Object.values(i18n ?? {}).some((v) => (v ?? "").trim());
}

function fromLegacyMap(scene: Scene): SpeakLine[] {
  const lines: SpeakLine[] = [];
  const seen = new Set<string>();
  const pushSpeech = (id: string, i18n: Partial<Record<LangId, string>> | undefined, role?: string) => {
    if (!id || seen.has(id) || !hasText(i18n)) return;
    seen.add(id);
    lines.push({
      id,
      kind: "speech",
      i18n: { ...(i18n ?? {}) },
      role: role?.trim() || undefined,
    });
  };

  const track = scene.speakTrack;
  if (track?.length) {
    for (const item of track) {
      if (item.kind === "gap") {
        lines.push({ id: item.id || uid("gap"), kind: "gap", durationMs: item.gapMs });
        continue;
      }
      const target = item.target ?? item.id;
      if (target === SPEAK_OPEN) pushSpeech(target, slotI18n(scene.narration), scene.speakRole?.[SPEAK_OPEN]);
      else if (target === SPEAK_CLOSE) pushSpeech(target, slotI18n(scene.narrationClose), scene.speakRole?.[SPEAK_CLOSE]);
      else pushSpeech(target, scene.speak?.[target]?.i18n, scene.speakRole?.[target]);
    }
    return lines;
  }

  pushSpeech(SPEAK_OPEN, slotI18n(scene.narration), scene.speakRole?.[SPEAK_OPEN]);
  for (const block of sceneBlocks(scene)) {
    if (block.type === "play" || block.type === "katex" || block.type === "three") continue;
    pushSpeech(block.id, scene.speak?.[block.id]?.i18n, scene.speakRole?.[block.id]);
    if (block.type === "list") {
      for (const it of scene.slots.items ?? []) {
        const key = itemSpeakKey(it.id);
        pushSpeech(key, scene.speak?.[key]?.i18n, scene.speakRole?.[key]);
      }
    }
    if (block.type === "dialogue") {
      for (const it of scene.slots.dialogue ?? []) {
        const key = itemSpeakKey(it.id);
        pushSpeech(key, scene.speak?.[key]?.i18n, scene.speakRole?.[key]);
      }
    }
  }
  pushSpeech(SPEAK_CLOSE, slotI18n(scene.narrationClose), scene.speakRole?.[SPEAK_CLOSE]);
  return lines;
}

/** Unified speech list. Migrates old open/close/speak/speakTrack on the fly. */
export function speaksOf(scene: Scene): SpeakLine[] {
  if (scene.speaks?.length) return scene.speaks;
  return fromLegacyMap(scene);
}

export function speakLineText(line: SpeakLine | undefined, lang: LangId, source: LangId): string {
  if (!line || isGapSpeak(line)) return "";
  return displayI18n(line.i18n, lang, source);
}

export function newSpeakLine(lang: LangId, text = ""): SpeakLine {
  return { id: uid("sp"), kind: "speech", i18n: { [lang]: text } };
}

export function newGapLine(durationMs = 400): SpeakLine {
  return { id: uid("gap"), kind: "gap", durationMs };
}

export function persistSpeaks(scene: Scene): Scene {
  return { ...scene, speaks: speaksOf(scene), speakTrack: undefined };
}

/** Rebuild `speaks` from legacy narration / speak / speakTrack fields. */
export function migrateSpeaks(scene: Scene): Scene {
  return { ...scene, speaks: fromLegacyMap(scene), speakTrack: undefined };
}

export function speakSummary(scene: Scene, lang: LangId, source: LangId): { count: number; durationMs: number } {
  let count = 0;
  let durationMs = 0;
  for (const line of speaksOf(scene)) {
    durationMs += lineDurationMs(scene, line, lang, source);
    if (!isGapSpeak(line) && speakLineText(line, lang, source).trim()) count += 1;
  }
  return { count, durationMs };
}

export function speakLabel(line: SpeakLine, lang: LangId, source: LangId): string {
  if (isGapSpeak(line)) return "延时";
  const name = (line.name ?? "").trim();
  if (name) return name;
  const text = speakLineText(line, lang, source).replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 20);
  return line.id;
}

export function patchSpeakLine(scene: Scene, id: string, patch: Partial<SpeakLine>): Scene {
  const speaks = speaksOf(scene).map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s));
  return { ...scene, speaks };
}

export function estimateSpeakMs(text: string): number {
  const n = text.replace(/\s+/g, "").length;
  return Math.max(400, n * 180);
}

export function lineDurationMs(scene: Scene, line: SpeakLine, lang: LangId, source: LangId): number {
  if (isGapSpeak(line)) {
    const n = line.durationMs;
    return Number.isFinite(n) && (n ?? 0) > 0 ? Math.round(n as number) : 400;
  }
  if (line.durationMs && line.durationMs > 0) return Math.round(line.durationMs);
  const stored = scene.audioByLang?.[lang];
  const fromStore = stored && !stored.stale ? stored.beatMs?.[line.id] : undefined;
  if (fromStore && fromStore > 0) return fromStore;
  const text = speakLineText(line, lang, source);
  return text.trim() ? estimateSpeakMs(text) : 0;
}
