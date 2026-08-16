import type { BlockKeyframe, BlockSettings, Cue, EaseKind, LayoutBlock } from "../types";
import { cueProgress, cueVisible } from "./timeline";

export interface BlockPose {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  rotation: number;
}

export function defaultSettings(type: LayoutBlock["type"]): BlockSettings {
  const text: Record<string, number> = {
    title: 4.2,
    subtitle: 2,
    body: 2,
    caption: 2,
    quote: 3.2,
    author: 1.6,
    number: 9,
    list: 1.8,
  };
  return {
    align: type === "title" || type === "quote" || type === "number" || type === "author" ? "center" : "left",
    color: type === "number" ? "#d4a84b" : type === "subtitle" || type === "author" ? "#d8d2c4" : "#f3eee3",
    fill: type === "shape" ? "#c45c26" : "transparent",
    fontSize: text[type] ?? 2,
    fontWeight: type === "title" || type === "number" ? "bold" : "normal",
    lineHeight: 1.25,
    padding: type === "list" ? 0.6 : 0,
    radius: type === "shape" || type === "list" ? 1 : 0,
    opacity: 1,
    rotation: 0,
    objectFit: "cover",
    listLayout: "stack",
    shadow: false,
  };
}

export function mergedSettings(block: LayoutBlock): BlockSettings {
  return { ...defaultSettings(block.type), ...block.settings };
}

function easeFn(kind: EaseKind | undefined, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  if (kind === "easeIn") return x * x;
  if (kind === "easeOut") return 1 - (1 - x) * (1 - x);
  if (kind === "ease" || !kind) return x * x * (3 - 2 * x);
  return x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function restPose(block: LayoutBlock): BlockPose {
  const s = mergedSettings(block);
  return {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    opacity: s.opacity ?? 1,
    rotation: s.rotation ?? 0,
  };
}

export function sampleBlock(block: LayoutBlock, progress: number, cue?: Cue): BlockPose {
  const rest = restPose(block);
  const keys = [...(block.keys ?? [])].sort((a, b) => a.t - b.t);
  let pose = rest;
  if (keys.length === 1) {
    pose = { ...rest, ...pick(rest, keys[0]) };
  } else if (keys.length >= 2) {
    if (progress <= keys[0].t) pose = { ...rest, ...pick(rest, keys[0]) };
    else if (progress >= keys[keys.length - 1].t) pose = { ...rest, ...pick(rest, keys[keys.length - 1]) };
    else {
      let i = 0;
      while (i < keys.length - 1 && keys[i + 1].t < progress) i += 1;
      const a = keys[i];
      const b = keys[i + 1];
      const span = Math.max(0.0001, b.t - a.t);
      const t = easeFn(b.ease ?? a.ease, (progress - a.t) / span);
      const pa = pick(rest, a);
      const pb = pick(rest, b);
      pose = {
        x: lerp(pa.x, pb.x, t),
        y: lerp(pa.y, pb.y, t),
        w: lerp(pa.w, pb.w, t),
        h: lerp(pa.h, pb.h, t),
        opacity: lerp(pa.opacity, pb.opacity, t),
        rotation: lerp(pa.rotation, pb.rotation, t),
      };
    }
  }

  let vis = 1;
  if (cue) {
    if (!cueVisible(cue, progress)) vis = 0;
    else vis = keys.length ? 1 : cueProgress(cue, progress);
  }
  return { ...pose, opacity: pose.opacity * vis };
}

function pick(rest: BlockPose, k: BlockKeyframe): BlockPose {
  return {
    x: k.x ?? rest.x,
    y: k.y ?? rest.y,
    w: k.w ?? rest.w,
    h: k.h ?? rest.h,
    opacity: k.opacity ?? rest.opacity,
    rotation: k.rotation ?? rest.rotation,
  };
}

export function upsertKey(block: LayoutBlock, t: number, pose: Partial<BlockPose>): LayoutBlock {
  const q = Math.round(Math.min(1, Math.max(0, t)) * 100) / 100;
  const rest = restPose(block);
  if (!block.keys?.length && q <= 0.02) {
    return {
      ...block,
      x: pose.x ?? block.x,
      y: pose.y ?? block.y,
      w: pose.w ?? block.w,
      h: pose.h ?? block.h,
      settings: {
        ...block.settings,
        ...(pose.opacity != null ? { opacity: pose.opacity } : {}),
        ...(pose.rotation != null ? { rotation: pose.rotation } : {}),
      },
    };
  }
  const start: BlockKeyframe = {
    t: 0,
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    opacity: rest.opacity,
    rotation: rest.rotation,
    ease: "ease",
  };
  const keys = block.keys?.length ? [...block.keys] : [start];
  const next: BlockKeyframe = { t: q, ease: "ease", ...pose };
  const i = keys.findIndex((k) => Math.abs(k.t - q) < 0.02);
  if (i >= 0) keys[i] = { ...keys[i], ...next };
  else keys.push(next);
  keys.sort((a, b) => a.t - b.t);
  const restPatch = q <= 0.02 ? { x: pose.x ?? block.x, y: pose.y ?? block.y, w: pose.w ?? block.w, h: pose.h ?? block.h } : {};
  return { ...block, ...restPatch, keys };
}

export function removeKeyAt(block: LayoutBlock, t: number): LayoutBlock {
  const keys = (block.keys ?? []).filter((k) => Math.abs(k.t - t) >= 0.02);
  return { ...block, keys: keys.length ? keys : undefined };
}
