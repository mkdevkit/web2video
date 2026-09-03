import { uid } from "./ids";
import { defaultSettings } from "./interpolate";
import type { AnimKind, BlockType, Cue, CueBind, DialogueLine, LayoutBlock, LayoutId, ListItem, SceneSlots } from "../types";

export function cueUntil(cue: Cue): number {
  return cue.until ?? 1;
}

export type BoxAlign = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "stretchX" | "stretchY";

function roundPct(n: number) {
  return Math.round(n * 100) / 100;
}

/** Align a block box to the 0–100 canvas. Size is kept except for stretch. */
export function alignBlockBox(
  box: { x: number; y: number; w: number; h: number },
  kind: BoxAlign,
): { x: number; y: number; w: number; h: number } {
  const w = Math.max(1, Math.min(100, box.w));
  const h = Math.max(1, Math.min(100, box.h));
  let x = box.x;
  let y = box.y;
  let nw = w;
  let nh = h;
  if (kind === "left") x = 0;
  else if (kind === "hcenter") x = roundPct((100 - w) / 2);
  else if (kind === "right") x = roundPct(100 - w);
  else if (kind === "top") y = 0;
  else if (kind === "vcenter") y = roundPct((100 - h) / 2);
  else if (kind === "bottom") y = roundPct(100 - h);
  else if (kind === "stretchX") {
    x = 0;
    nw = 100;
  } else if (kind === "stretchY") {
    y = 0;
    nh = 100;
  }
  return {
    x: roundPct(Math.max(0, Math.min(x, 100 - nw))),
    y: roundPct(Math.max(0, Math.min(y, 100 - nh))),
    w: nw,
    h: nh,
  };
}

export function boxAlignActive(box: { x: number; y: number; w: number; h: number }, kind: BoxAlign): boolean {
  const next = alignBlockBox(box, kind);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  if (kind === "stretchX") return near(box.x, 0) && near(box.w, 100);
  if (kind === "stretchY") return near(box.y, 0) && near(box.h, 100);
  if (kind === "left" || kind === "hcenter" || kind === "right") {
    if (near(box.w, 100) && near(box.x, 0)) return false;
    return near(box.x, next.x);
  }
  if (near(box.h, 100) && near(box.y, 0)) return false;
  return near(box.y, next.y);
}

function blk(
  type: BlockType,
  x: number,
  y: number,
  w: number,
  h: number,
  settings: Partial<LayoutBlock["settings"]> = {},
): LayoutBlock {
  return {
    id: type === "shape" ? uid("blk") : type,
    type,
    x,
    y,
    w,
    h,
    settings: { ...defaultSettings(type), ...settings },
  };
}

export function presetBlocks(layout: LayoutId): LayoutBlock[] {
  const c = { align: "center" as const };
  switch (layout) {
    case "cover":
      return [blk("title", 8, 30, 84, 28, c), blk("subtitle", 14, 62, 72, 16, c)];
    case "splitLeft":
      return [blk("image", 0, 0, 48, 100), blk("title", 52, 22, 44, 18), blk("body", 52, 44, 44, 40)];
    case "splitRight":
      return [blk("title", 4, 22, 44, 18), blk("body", 4, 44, 44, 40), blk("image", 52, 0, 48, 100)];
    case "bullets":
      return [blk("title", 8, 10, 84, 14), blk("list", 8, 28, 84, 62, { listLayout: "stack" })];
    case "quote":
      return [blk("number", 10, 12, 80, 22, c), blk("quote", 10, 36, 80, 36, c), blk("author", 10, 76, 80, 10, c)];
    case "steps":
      return [blk("title", 8, 12, 84, 14), blk("list", 8, 32, 84, 52, { listLayout: "row" })];
    case "fullImage":
      return [blk("image", 0, 0, 100, 100), blk("caption", 6, 72, 88, 20)];
    case "compare":
      return [blk("title", 8, 8, 84, 14, c), blk("body", 6, 28, 42, 60), blk("caption", 52, 28, 42, 60)];
    case "bigStat":
      return [blk("number", 8, 18, 84, 36, c), blk("title", 10, 58, 80, 14, c), blk("body", 14, 74, 72, 16, c)];
    case "chapter":
      return [blk("subtitle", 10, 28, 80, 10, c), blk("title", 8, 40, 84, 28, c)];
    case "overlay":
      return [blk("image", 0, 0, 100, 100), blk("title", 8, 58, 84, 18), blk("subtitle", 8, 78, 70, 12)];
    case "threeCol":
      return [blk("title", 8, 10, 84, 14, c), blk("list", 6, 30, 88, 56, { listLayout: "row" })];
    case "qa":
      return [blk("title", 8, 18, 84, 22), blk("body", 8, 46, 84, 38)];
    case "cards":
      return [blk("title", 8, 8, 84, 12), blk("list", 6, 24, 88, 68, { listLayout: "grid" })];
    case "dialogue":
      return [blk("title", 8, 6, 84, 12), blk("dialogue", 8, 20, 84, 72)];
    case "custom":
      return [blk("title", 8, 10, 84, 16), blk("body", 8, 32, 84, 40)];
    default:
      return [blk("title", 8, 30, 84, 20, c)];
  }
}

export function sceneBlocks(scene: { layoutId: LayoutId; blocks?: LayoutBlock[] }): LayoutBlock[] {
  if (scene.blocks?.length) return scene.blocks;
  return presetBlocks(scene.layoutId);
}

export function makeBlock(type: BlockType): LayoutBlock {
  const defaults: Record<BlockType, [number, number, number, number]> = {
    title: [8, 8, 84, 16],
    subtitle: [8, 26, 84, 10],
    body: [8, 40, 84, 36],
    caption: [8, 78, 84, 14],
    quote: [10, 30, 80, 30],
    author: [10, 64, 80, 10],
    number: [10, 12, 80, 22],
    list: [8, 28, 84, 56],
    dialogue: [8, 20, 84, 72],
    image: [50, 10, 44, 80],
    video: [8, 18, 84, 64],
    gif: [8, 18, 84, 64],
    shape: [8, 8, 30, 20],
    play: [82, 2, 16, 8],
  };
  const [x, y, w, h] = defaults[type];
  return {
    id: type === "shape" || type === "play" ? uid(type === "play" ? "play" : "blk") : `${type}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    x,
    y,
    w,
    h,
    settings: defaultSettings(type),
  };
}

export function isItemLike(type: BlockType): boolean {
  return type === "list" || type === "dialogue";
}

export function defaultCues(
  layout: LayoutId,
  items: ListItem[] = [],
  blocks?: LayoutBlock[],
  dialogue: DialogueLine[] = [],
): Cue[] {
  const cue = (target: string, at: number, anim: AnimKind, bind: CueBind, until = 1): Cue => ({
    id: uid("cue"),
    target,
    bind,
    at,
    until,
    stay: bind === "speak" ? "body" : undefined,
    anim,
  });
  const itemCues = (lines: { id: string }[], start: number) =>
    lines.map((it, j) => cue(`item:${it.id}`, Math.min(0.85, start + j * 0.12), "slide", "speak"));
  const list = blocks ?? presetBlocks(layout);
  if (layout === "custom" || blocks?.length) {
    const out: Cue[] = [];
    let i = 0;
    for (const b of list) {
      if (b.type === "play") continue;
      const bind: CueBind = b.type === "image" || b.type === "video" || b.type === "gif" || b.type === "shape" ? "visual" : "speak";
      if (b.type === "list") {
        out.push(...itemCues(items, 0.12 + i * 0.08));
      } else if (b.type === "dialogue") {
        out.push(...itemCues(dialogue, 0.12 + i * 0.08));
      } else {
        const anim: AnimKind = b.type === "image" ? "kenburns" : b.type === "title" || b.type === "number" ? "scale" : "fade";
        out.push(cue(b.id, Math.min(0.8, i * 0.1), anim, bind));
        i += 1;
      }
    }
    return out.length ? out : [cue("title", 0, "fade", "speak")];
  }
  switch (layout) {
    case "cover":
      return [cue("title", 0, "scale", "speak"), cue("subtitle", 0.18, "slide", "speak")];
    case "splitLeft":
    case "splitRight":
      return [cue("image", 0, "kenburns", "visual"), cue("title", 0.06, "slide", "speak"), cue("body", 0.22, "fade", "speak")];
    case "bullets":
    case "steps":
    case "threeCol":
    case "cards":
      return [cue("title", 0, "slide", "speak"), ...itemCues(items, 0.14)];
    case "dialogue":
      return [cue("title", 0, "slide", "speak"), ...itemCues(dialogue, 0.14)];
    case "quote":
      return [cue("number", 0, "scale", "speak"), cue("quote", 0.08, "scale", "speak"), cue("author", 0.45, "fade", "speak")];
    case "fullImage":
      return [cue("image", 0, "kenburns", "visual"), cue("caption", 0.2, "slide", "speak")];
    case "compare":
      return [cue("title", 0, "fade", "speak"), cue("body", 0.12, "slide", "speak"), cue("caption", 0.28, "slide", "speak")];
    case "bigStat":
      return [cue("number", 0, "scale", "speak"), cue("title", 0.2, "fade", "speak"), cue("body", 0.38, "slide", "speak")];
    case "chapter":
      return [cue("subtitle", 0, "fade", "speak"), cue("title", 0.12, "scale", "speak")];
    case "overlay":
      return [cue("image", 0, "kenburns", "visual"), cue("title", 0.15, "slide", "speak"), cue("subtitle", 0.32, "fade", "speak")];
    case "qa":
      return [cue("title", 0, "slide", "speak"), cue("body", 0.28, "fade", "speak")];
    default:
      return [cue("title", 0, "fade", "speak")];
  }
}

export function rebuildCues(scene: { layoutId: LayoutId; slots: SceneSlots; blocks?: LayoutBlock[] }): Cue[] {
  return defaultCues(
    scene.layoutId,
    scene.slots.items ?? [],
    scene.blocks?.length ? scene.blocks : undefined,
    scene.slots.dialogue ?? [],
  );
}

export function ensureCues(cues: Cue[]): Cue[] {
  return cues.map((c) => ({ ...c, until: c.until ?? 1 }));
}
