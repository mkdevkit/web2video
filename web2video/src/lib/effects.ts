import type { MsWindow } from "./interpolate";
import { uid } from "./ids";
import type { AnimKind, BlockEffect, Cue, CueBind, LayoutBlock, Scene, TimeRef } from "../types";
import { SPEAK_BODY, SPEAK_SCENE, calendarTailMs, type SceneCalendar, effectEndMs, isPlayBlock, resolveTimeRef } from "./calendar";
import { findSpeak, isGapSpeak, itemSpeakKey, speakLineText, speaksOf } from "./speaks";
import { speakText } from "./narration";
import { sceneBlocks } from "./blocks";
import type { LangId } from "./langs";

function cueBindOf(cue: Cue, scene: Scene, source: LangId): CueBind {
  if (cue.bind === "speak" || cue.bind === "visual") return cue.bind;
  if (speakText(scene, cue.target, source, source).trim()) return "speak";
  return "visual";
}

export function defaultTimeRef(speakId: string, anchor: TimeRef["anchor"] = "start", offsetMs = 0): TimeRef {
  const scene = speakId === SPEAK_SCENE || speakId === SPEAK_BODY;
  return { kind: scene ? "scene" : "speak", speakId, anchor, offsetMs };
}

function isOwnEffect(fx: BlockEffect, blockId: string) {
  return !fx.target || fx.target === blockId;
}

export function effectsOf(block: LayoutBlock, scene: Scene, source: LangId): BlockEffect[] {
  const stored = (block.effects ?? []).filter((fx) => isOwnEffect(fx, block.id));
  if (stored.length) return stored;
  const cue = scene.cues.find((c) => c.target === block.id);
  if (!cue) return [];
  return [effectFromCue(cue, scene, source)];
}

export function itemEffects(scene: Scene, itemKey: string, source: LangId, listBlock?: LayoutBlock): BlockEffect[] {
  const stored = (listBlock?.effects ?? []).filter((fx) => fx.target === itemKey);
  if (stored.length) return stored;
  const cue = scene.cues.find((c) => c.target === itemKey);
  if (!cue) return [];
  return [effectFromCue(cue, scene, source)];
}

export function effectFromCue(cue: Cue, scene: Scene, source: LangId): BlockEffect {
  const bind = cueBindOf(cue, scene, source);
  const target = cue.target.startsWith("item:") ? cue.target : undefined;
  if (bind === "speak") {
    const from: TimeRef = { kind: "speak", speakId: cue.target, anchor: "start", offsetMs: -(cue.leadMs ?? 0) };
    const to: TimeRef =
      cue.stay === "speech"
        ? { kind: "speak", speakId: cue.target, anchor: "end", offsetMs: cue.trailMs ?? 0 }
        : { kind: "scene", speakId: SPEAK_BODY, anchor: "end", offsetMs: 0 };
    return { id: cue.id, anim: cue.anim, from, to, target };
  }
  return {
    id: cue.id,
    anim: cue.anim,
    from: { kind: "scene", speakId: SPEAK_BODY, anchor: "start", offsetMs: 0 },
    to: { kind: "scene", speakId: SPEAK_BODY, anchor: "end", offsetMs: 0 },
    target,
  };
}

export function resolveEffectWindow(fx: BlockEffect, cal: SceneCalendar, scene: Scene, source: LangId): MsWindow {
  const fromCue = scene.cues.find((c) => c.id === fx.id);
  const materialized = scene.blocks?.some((b) => b.effects?.length);
  const isLegacyVisual = fromCue && cueBindOf(fromCue, scene, source) === "visual" && !materialized;
  if (isLegacyVisual && fromCue) {
    const body = Math.max(1, cal.bodyEndMs - cal.bodyStartMs);
    const startMs = cal.bodyStartMs + fromCue.at * body;
    const endMs = cal.bodyStartMs + (fromCue.until ?? 1) * body;
    return { startMs, endMs, anim: fx.anim };
  }
  const startMs = resolveTimeRef(fx.from, cal, cal.bodyStartMs);
  const endMs = effectEndMs(startMs, fx.to, fx.durationMs, cal);
  return { startMs, endMs, anim: fx.anim };
}

export function unionWindow(windows: MsWindow[]): MsWindow | undefined {
  if (!windows.length) return undefined;
  return {
    startMs: Math.min(...windows.map((w) => w.startMs)),
    endMs: Math.max(...windows.map((w) => w.endMs)),
    anim: windows[0].anim,
  };
}

export function blockWindow(block: LayoutBlock, scene: Scene, source: LangId, cal: SceneCalendar): MsWindow | undefined {
  const fxs = effectsOf(block, scene, source);
  return unionWindow(fxs.map((fx) => resolveEffectWindow(fx, cal, scene, source)));
}

export function targetWindow(
  target: string,
  scene: Scene,
  source: LangId,
  cal: SceneCalendar,
  block?: LayoutBlock,
): MsWindow | undefined {
  if (block && target === block.id) return blockWindow(block, scene, source, cal);
  const fxs = itemEffects(scene, target, source, block);
  if (fxs.length) return unionWindow(fxs.map((fx) => resolveEffectWindow(fx, cal, scene, source)));
  const span = cal.byTarget[target];
  if (span) return { startMs: span.startMs, endMs: span.endMs, anim: "fade" };
  return undefined;
}

export function defaultSpeakId(scene: Scene, blockId: string, source: LangId): string {
  if (speakLineText(findSpeak(scene, blockId), source, source).trim()) return blockId;
  const first = speaksOf(scene).find((s) => !isGapSpeak(s));
  return first?.id ?? SPEAK_BODY;
}

export function newEffect(speakId: string, anim: AnimKind = "fade", target?: string): BlockEffect {
  return {
    id: uid("fx"),
    anim,
    from: defaultTimeRef(speakId, "start", 0),
    to: defaultTimeRef(speakId, "end", 0),
    target,
  };
}

export function nudgeTimeRef(ref: TimeRef | undefined, deltaMs: number): TimeRef | undefined {
  if (!ref) return ref;
  if (ref.kind === "fixed" || (ref.atMs != null && ref.kind !== "speak" && ref.kind !== "scene")) {
    return { ...ref, kind: "fixed", atMs: Math.max(0, (ref.atMs ?? 0) + deltaMs) };
  }
  return { ...ref, offsetMs: (ref.offsetMs ?? 0) + deltaMs };
}

export function nudgeEffect(fx: BlockEffect, startDeltaMs: number, endDeltaMs: number): BlockEffect {
  return {
    ...fx,
    from: nudgeTimeRef(fx.from, startDeltaMs) ?? fx.from,
    to: fx.to ? nudgeTimeRef(fx.to, endDeltaMs) : fx.to,
    durationMs: fx.to ? fx.durationMs : Math.max(40, (fx.durationMs ?? 400) + (endDeltaMs - startDeltaMs)),
  };
}

export function materializeBlockEffects(block: LayoutBlock, scene: Scene, source: LangId): LayoutBlock {
  if (isPlayBlock(block)) return block;
  if (block.effects?.length) return block;
  const own = effectsOf(block, scene, source);
  const extra: BlockEffect[] = [];
  if (block.type === "list") {
    for (const it of scene.slots.items ?? []) extra.push(...itemEffects(scene, itemSpeakKey(it.id), source, block));
  }
  if (block.type === "dialogue") {
    for (const it of scene.slots.dialogue ?? []) extra.push(...itemEffects(scene, itemSpeakKey(it.id), source, block));
  }
  const effects = [...own, ...extra];
  return effects.length ? { ...block, effects } : block;
}

export function extendCalendarForEffects(cal: SceneCalendar, scene: Scene, source: LangId): SceneCalendar {
  if (cal.drive !== "config") return cal;
  let end = cal.bodyEndMs;
  for (const block of sceneBlocks(scene)) {
    if (isPlayBlock(block)) continue;
    for (const fx of effectsOf(block, scene, source)) {
      const win = resolveEffectWindow(fx, cal, scene, source);
      end = Math.max(end, win.endMs);
    }
    if (block.type === "list") {
      for (const it of scene.slots.items ?? []) {
        for (const fx of itemEffects(scene, itemSpeakKey(it.id), source, block)) {
          end = Math.max(end, resolveEffectWindow(fx, cal, scene, source).endMs);
        }
      }
    }
    if (block.type === "dialogue") {
      for (const it of scene.slots.dialogue ?? []) {
        for (const fx of itemEffects(scene, itemSpeakKey(it.id), source, block)) {
          end = Math.max(end, resolveEffectWindow(fx, cal, scene, source).endMs);
        }
      }
    }
  }
  if (end <= cal.bodyEndMs) return cal;
  const bodyStartMs = cal.bodyStartMs;
  const totalMs = Math.max(1, end + calendarTailMs(cal));
  return {
    ...cal,
    bodyEndMs: end,
    totalMs,
    byTarget: {
      ...cal.byTarget,
      scene: { startMs: 0, endMs: totalMs },
      body: { startMs: bodyStartMs, endMs: end },
    },
  };
}

export function windowProgress(localMs: number, win: MsWindow | undefined): number {
  if (!win) return 0;
  return (localMs - win.startMs) / Math.max(1, win.endMs - win.startMs);
}
