import type { LangId } from "./langs";
import type { CaptionStyle, ProgressStyle, StageFontId, BlockType, Project } from "../types";

export interface StageFont {
  id: StageFontId;
  label: string;
  license: "SIL OFL";
  hint: string;
  latin: string;
  zh: string;
  ja: string;
  generic: "sans-serif" | "serif";
}

/** All SIL Open Font License, free for commercial use. CJK falls back to Noto. */
export const STAGE_FONTS: StageFont[] = [
  {
    id: "noto-sans",
    label: "Noto Sans",
    license: "SIL OFL",
    hint: "谷歌多语种无衬线，中英日欧俄都完整",
    latin: '"Noto Sans"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
  },
  {
    id: "noto-serif",
    label: "Noto Serif",
    license: "SIL OFL",
    hint: "谷歌多语种衬线，适合标题和金句",
    latin: '"Noto Serif"',
    zh: '"Noto Serif SC"',
    ja: '"Noto Serif JP"',
    generic: "serif",
  },
  {
    id: "source-sans",
    label: "Source Sans 3",
    license: "SIL OFL",
    hint: "Adobe 开源西文 + Noto 中日文",
    latin: '"Source Sans 3"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
  },
  {
    id: "ibm-plex",
    label: "IBM Plex",
    license: "SIL OFL",
    hint: "IBM 开源，西文/俄文 + 日文，中文走 Noto",
    latin: '"IBM Plex Sans"',
    zh: '"Noto Sans SC"',
    ja: '"IBM Plex Sans JP"',
    generic: "sans-serif",
  },
  {
    id: "nunito",
    label: "Nunito Sans",
    license: "SIL OFL",
    hint: "圆润无衬线，中日文回落到 Noto",
    latin: '"Nunito Sans"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
  },
  {
    id: "literata",
    label: "Literata",
    license: "SIL OFL",
    hint: "阅读向衬线，中日文回落到 Noto Serif",
    latin: '"Literata"',
    zh: '"Noto Serif SC"',
    ja: '"Noto Serif JP"',
    generic: "serif",
  },
];

export const DEFAULT_FONT_ID: StageFontId = "noto-sans";
export const DEFAULT_TITLE_FONT_ID: StageFontId = "noto-serif";
export const DEFAULT_SUBTITLE_FONT_ID: StageFontId = "noto-sans";
export const DEFAULT_QUOTE_FONT_ID: StageFontId = "noto-serif";
export const DEFAULT_CAPTION_FONT_ID: StageFontId = "noto-sans";

export const DEFAULT_PROGRESS_STYLE: ProgressStyle = {
  position: "top",
  height: 2.6,
  bg: "#000000",
  bgOpacity: 0.58,
  fill: "#d4a84b",
  fillOpacity: 0.42,
  playhead: "#d4a84b",
  color: "#c8c2b6",
  activeColor: "#f3eee3",
  fontSize: 1.15,
  fontWeight: "normal",
  showNames: true,
  showPlayhead: true,
  showDividers: true,
  blur: false,
  insetX: 0,
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  box: "pill",
  bg: "#000000",
  bgOpacity: 0.55,
  color: "#f3eee3",
  fontSize: 1.7,
  fontWeight: "normal",
  align: "center",
  position: "bottom",
  insetX: 10,
  insetY: 3,
  paddingX: 2,
  paddingY: 0.9,
  outline: false,
  blur: true,
};

export function isStageFontId(v: unknown): v is StageFontId {
  return typeof v === "string" && STAGE_FONTS.some((f) => f.id === v);
}

export function stageFont(id: string | undefined): StageFont {
  return STAGE_FONTS.find((f) => f.id === id) ?? STAGE_FONTS[0];
}

export function fontStack(id: string | undefined, lang: LangId): string {
  const f = stageFont(id);
  if (lang === "zh") return `${f.zh}, ${f.ja}, ${f.latin}, ${f.generic}`;
  if (lang === "ja") return `${f.ja}, ${f.zh}, ${f.latin}, ${f.generic}`;
  return `${f.latin}, ${f.zh}, ${f.ja}, ${f.generic}`;
}

export function blockFontId(project: Pick<Project, "fontId" | "titleFontId" | "subtitleFontId" | "quoteFontId">, type: BlockType): StageFontId {
  if (type === "title" || type === "number") return project.titleFontId || DEFAULT_TITLE_FONT_ID;
  if (type === "quote") return project.quoteFontId || DEFAULT_QUOTE_FONT_ID;
  if (type === "subtitle" || type === "author") return project.subtitleFontId || DEFAULT_SUBTITLE_FONT_ID;
  return project.fontId || DEFAULT_FONT_ID;
}

export function resolveBlockFont(
  project: Pick<Project, "fontId" | "titleFontId" | "subtitleFontId" | "quoteFontId">,
  block: { type: BlockType; settings?: { fontId?: StageFontId } },
): StageFontId {
  return isStageFontId(block.settings?.fontId) ? block.settings.fontId : blockFontId(project, block.type);
}

export function hexAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  const n = Number.parseInt(full.padEnd(6, "0"), 16);
  if (!Number.isFinite(n)) return `rgba(0,0,0,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

export function captionStyleOf(partial?: Partial<CaptionStyle> | null): CaptionStyle {
  const p = partial ?? {};
  const box = p.box === "bar" || p.box === "none" || p.box === "pill" ? p.box : DEFAULT_CAPTION_STYLE.box;
  const align = p.align === "left" || p.align === "right" || p.align === "center" ? p.align : DEFAULT_CAPTION_STYLE.align;
  const position = p.position === "top" || p.position === "bottom" ? p.position : DEFAULT_CAPTION_STYLE.position;
  const fontWeight =
    p.fontWeight === "bold" || p.fontWeight === "medium" || p.fontWeight === "normal" ? p.fontWeight : DEFAULT_CAPTION_STYLE.fontWeight;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
    return Math.min(max, Math.max(min, v));
  };
  return {
    box,
    bg: typeof p.bg === "string" && p.bg.trim() ? p.bg : DEFAULT_CAPTION_STYLE.bg,
    bgOpacity: clamp(p.bgOpacity, 0, 1, DEFAULT_CAPTION_STYLE.bgOpacity),
    color: typeof p.color === "string" && p.color.trim() ? p.color : DEFAULT_CAPTION_STYLE.color,
    fontSize: clamp(p.fontSize, 0.8, 6, DEFAULT_CAPTION_STYLE.fontSize),
    fontWeight,
    align,
    position,
    insetX: clamp(p.insetX, 0, 30, DEFAULT_CAPTION_STYLE.insetX),
    insetY: clamp(p.insetY, 0, 20, DEFAULT_CAPTION_STYLE.insetY),
    paddingX: clamp(p.paddingX, 0, 8, DEFAULT_CAPTION_STYLE.paddingX),
    paddingY: clamp(p.paddingY, 0, 4, DEFAULT_CAPTION_STYLE.paddingY),
    outline: typeof p.outline === "boolean" ? p.outline : DEFAULT_CAPTION_STYLE.outline,
    blur: typeof p.blur === "boolean" ? p.blur : DEFAULT_CAPTION_STYLE.blur,
  };
}

export function progressStyleOf(partial?: Partial<ProgressStyle> | null): ProgressStyle {
  const p = partial ?? {};
  const position = p.position === "bottom" || p.position === "top" ? p.position : DEFAULT_PROGRESS_STYLE.position;
  const fontWeight =
    p.fontWeight === "bold" || p.fontWeight === "medium" || p.fontWeight === "normal" ? p.fontWeight : DEFAULT_PROGRESS_STYLE.fontWeight;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
    return Math.min(max, Math.max(min, v));
  };
  return {
    position,
    height: clamp(p.height, 1.2, 8, DEFAULT_PROGRESS_STYLE.height),
    bg: typeof p.bg === "string" && p.bg.trim() ? p.bg : DEFAULT_PROGRESS_STYLE.bg,
    bgOpacity: clamp(p.bgOpacity, 0, 1, DEFAULT_PROGRESS_STYLE.bgOpacity),
    fill: typeof p.fill === "string" && p.fill.trim() ? p.fill : DEFAULT_PROGRESS_STYLE.fill,
    fillOpacity: clamp(p.fillOpacity, 0, 1, DEFAULT_PROGRESS_STYLE.fillOpacity),
    playhead: typeof p.playhead === "string" && p.playhead.trim() ? p.playhead : DEFAULT_PROGRESS_STYLE.playhead,
    color: typeof p.color === "string" && p.color.trim() ? p.color : DEFAULT_PROGRESS_STYLE.color,
    activeColor: typeof p.activeColor === "string" && p.activeColor.trim() ? p.activeColor : DEFAULT_PROGRESS_STYLE.activeColor,
    fontSize: clamp(p.fontSize, 0.6, 3, DEFAULT_PROGRESS_STYLE.fontSize),
    fontWeight,
    fontId: isStageFontId(p.fontId) ? p.fontId : undefined,
    showNames: typeof p.showNames === "boolean" ? p.showNames : DEFAULT_PROGRESS_STYLE.showNames,
    showPlayhead: typeof p.showPlayhead === "boolean" ? p.showPlayhead : DEFAULT_PROGRESS_STYLE.showPlayhead,
    showDividers: typeof p.showDividers === "boolean" ? p.showDividers : DEFAULT_PROGRESS_STYLE.showDividers,
    blur: typeof p.blur === "boolean" ? p.blur : DEFAULT_PROGRESS_STYLE.blur,
    insetX: clamp(p.insetX, 0, 20, DEFAULT_PROGRESS_STYLE.insetX),
  };
}
