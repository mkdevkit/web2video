import type { AnimKind, BlockKeyframe, BlockSettings, EaseKind, LayoutBlock } from "../types";

export type MsWindow = { startMs: number; endMs: number; anim: AnimKind };

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
    dialogue: 1.7,
  };
  return {
    align: type === "title" || type === "quote" || type === "number" || type === "author" ? "center" : "left",
    color: type === "number" ? "#d4a84b" : type === "subtitle" || type === "author" ? "#d8d2c4" : "#f3eee3",
    fill: type === "shape" ? "#c45c26" : "transparent",
    fontSize: text[type] ?? 2,
    fontWeight: type === "title" || type === "number" ? "bold" : "normal",
    lineHeight: 1.25,
    padding: type === "list" || type === "dialogue" ? 0.6 : 0,
    radius: type === "shape" || type === "list" || type === "dialogue" ? 1 : 0,
    opacity: 1,
    rotation: 0,
    objectFit: "cover",
    loop: type === "gif" || type === "video",
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

export type SampleOpts = {
  /** Hold the first or last body frame (opening / closing narration). */
  freeze?: "start" | "end";
  freezeMs?: number;
};

function windowVis(t: number, startMs: number, endMs: number, anim: AnimKind, keyed: boolean): number {
  if (t < startMs - 0.5 || t > endMs + 0.5) return 0;
  if (keyed) return 1;
  const fade = anim === "fade" || anim === "slide" || anim === "scale" ? 90 : 40;
  let vis = 1;
  vis = Math.min(vis, Math.max(0, (t - startMs) / fade));
  vis = Math.min(vis, Math.max(0, (endMs - t) / fade));
  return vis;
}

export function sampleBlock(block: LayoutBlock, localMs: number, win?: MsWindow, opts?: SampleOpts): BlockPose {
  const rest = restPose(block);
  const t =
    opts?.freeze === "start" || opts?.freeze === "end"
      ? (opts.freezeMs ?? localMs)
      : localMs;
  const keyProgress = win ? (t - win.startMs) / Math.max(1, win.endMs - win.startMs) : 0;
  const keys = [...(block.keys ?? [])].sort((a, b) => a.t - b.t);
  let pose = rest;
  if (keys.length === 1) {
    pose = { ...rest, ...pick(rest, keys[0]) };
  } else if (keys.length >= 2) {
    if (keyProgress <= keys[0].t) pose = { ...rest, ...pick(rest, keys[0]) };
    else if (keyProgress >= keys[keys.length - 1].t) pose = { ...rest, ...pick(rest, keys[keys.length - 1]) };
    else {
      let i = 0;
      while (i < keys.length - 1 && keys[i + 1].t < keyProgress) i += 1;
      const a = keys[i];
      const b = keys[i + 1];
      const span = Math.max(0.0001, b.t - a.t);
      const u = easeFn(b.ease ?? a.ease, (keyProgress - a.t) / span);
      const pa = pick(rest, a);
      const pb = pick(rest, b);
      pose = {
        x: lerp(pa.x, pb.x, u),
        y: lerp(pa.y, pb.y, u),
        w: lerp(pa.w, pb.w, u),
        h: lerp(pa.h, pb.h, u),
        opacity: lerp(pa.opacity, pb.opacity, u),
        rotation: lerp(pa.rotation, pb.rotation, u),
      };
    }
  }

  let vis = 1;
  if (win) vis = windowVis(t, win.startMs, win.endMs, win.anim, keys.length > 0);
  if (win?.anim === "slide" && vis < 1 && vis > 0) pose = { ...pose, y: pose.y + (1 - vis) * 3 };
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
