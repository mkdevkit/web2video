import type { ListMarkerKind, ListMarkerShape, ListMarkerStyle } from "../types";

export const DEFAULT_LIST_MARKER_STYLE: ListMarkerStyle = {
  show: true,
  kind: "number",
  bg: "#c45c26",
  color: "#f3eee3",
  size: 2.2,
  shape: "circle",
  overlayIndex: true,
};

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
}

export function listMarkerStyleOf(partial?: Partial<ListMarkerStyle> | null): ListMarkerStyle {
  const p = partial ?? {};
  const kind: ListMarkerKind = p.kind === "image" ? "image" : "number";
  const shape: ListMarkerShape = p.shape === "rounded" || p.shape === "square" ? p.shape : "circle";
  const image = typeof p.image === "string" && p.image.trim() ? p.image.trim() : undefined;
  return {
    show: typeof p.show === "boolean" ? p.show : DEFAULT_LIST_MARKER_STYLE.show,
    kind,
    bg: typeof p.bg === "string" && p.bg.trim() ? p.bg : DEFAULT_LIST_MARKER_STYLE.bg,
    color: typeof p.color === "string" && p.color.trim() ? p.color : DEFAULT_LIST_MARKER_STYLE.color,
    size: clamp(p.size, 1.2, 5, DEFAULT_LIST_MARKER_STYLE.size),
    shape,
    image,
    overlayIndex: typeof p.overlayIndex === "boolean" ? p.overlayIndex : DEFAULT_LIST_MARKER_STYLE.overlayIndex,
  };
}

export function listMarkerRadius(shape: ListMarkerShape): string {
  if (shape === "square") return "0";
  if (shape === "rounded") return "0.45cqw";
  return "999px";
}
