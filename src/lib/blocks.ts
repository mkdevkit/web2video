import { uid } from "./ids";
import { defaultSettings } from "./interpolate";
import type { AnimKind, BlockType, Cue, LayoutBlock, LayoutId, ListItem } from "../types";

export function cueUntil(cue: Cue): number {
  return cue.until ?? 1;
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
    image: [50, 10, 44, 80],
    shape: [8, 8, 30, 20],
  };
  const [x, y, w, h] = defaults[type];
  return {
    id: type === "shape" ? uid("blk") : `${type}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    x,
    y,
    w,
    h,
    settings: defaultSettings(type),
  };
}

export function defaultCues(layout: LayoutId, items: ListItem[] = [], blocks?: LayoutBlock[]): Cue[] {
  const cue = (target: string, at: number, anim: AnimKind, until = 1): Cue => ({
    id: uid("cue"),
    target,
    at,
    until,
    anim,
  });
  const list = blocks ?? presetBlocks(layout);
  if (layout === "custom" || blocks?.length) {
    const out: Cue[] = [];
    let i = 0;
    for (const b of list) {
      if (b.type === "list") {
        items.forEach((it, j) => out.push(cue(`item:${it.id}`, Math.min(0.85, 0.12 + i * 0.08 + j * 0.12), "slide")));
      } else {
        const anim: AnimKind = b.type === "image" ? "kenburns" : b.type === "title" || b.type === "number" ? "scale" : "fade";
        out.push(cue(b.id, Math.min(0.8, i * 0.1), anim));
        i += 1;
      }
    }
    return out.length ? out : [cue("title", 0, "fade")];
  }
  switch (layout) {
    case "cover":
      return [cue("title", 0, "scale"), cue("subtitle", 0.18, "slide")];
    case "splitLeft":
    case "splitRight":
      return [cue("image", 0, "kenburns"), cue("title", 0.06, "slide"), cue("body", 0.22, "fade")];
    case "bullets":
    case "steps":
    case "threeCol":
    case "cards":
      return [cue("title", 0, "slide"), ...items.map((it, i) => cue(`item:${it.id}`, Math.min(0.85, 0.14 + i * 0.14), "slide"))];
    case "quote":
      return [cue("number", 0, "scale"), cue("quote", 0.08, "scale"), cue("author", 0.45, "fade")];
    case "fullImage":
      return [cue("image", 0, "kenburns"), cue("caption", 0.2, "slide")];
    case "compare":
      return [cue("title", 0, "fade"), cue("body", 0.12, "slide"), cue("caption", 0.28, "slide")];
    case "bigStat":
      return [cue("number", 0, "scale"), cue("title", 0.2, "fade"), cue("body", 0.38, "slide")];
    case "chapter":
      return [cue("subtitle", 0, "fade"), cue("title", 0.12, "scale")];
    case "overlay":
      return [cue("image", 0, "kenburns"), cue("title", 0.15, "slide"), cue("subtitle", 0.32, "fade")];
    case "qa":
      return [cue("title", 0, "slide"), cue("body", 0.28, "fade")];
    default:
      return [cue("title", 0, "fade")];
  }
}

export function ensureCues(cues: Cue[]): Cue[] {
  return cues.map((c) => ({ ...c, until: c.until ?? 1 }));
}
