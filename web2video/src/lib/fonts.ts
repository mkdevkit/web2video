import type { LangId } from "./langs";
import type { CaptionStyle, ProgressStyle, StageFontId, BlockType, Project } from "../types";

export interface StageFont {
  id: StageFontId;
  label: string;
  license: "SIL OFL";
  hint: string;
  detail: string;
  langs: string;
  latin: string;
  zh: string;
  ja: string;
  generic: "sans-serif" | "serif";
  google: string[];
}

/** All SIL Open Font License, free for commercial use. CJK falls back to Noto. */
export const STAGE_FONTS: StageFont[] = [
  {
    id: "noto-sans",
    label: "Noto Sans",
    license: "SIL OFL",
    hint: "谷歌多语种无衬线，中英日欧俄都完整",
    detail: "默认正文、列表、字幕。九语都自带字形，知识讲解片首选，不靠中日文回落。",
    langs: "中英日法德俄西葡意",
    latin: '"Noto Sans"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
    google: ["Noto+Sans:wght@400;500;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"],
  },
  {
    id: "noto-serif",
    label: "Noto Serif",
    license: "SIL OFL",
    hint: "谷歌多语种衬线，适合标题和金句",
    detail: "默认标题、数字、金句。多语衬线，正式，适合大字和引用。",
    langs: "中英日法德俄西葡意",
    latin: '"Noto Serif"',
    zh: '"Noto Serif SC"',
    ja: '"Noto Serif JP"',
    generic: "serif",
    google: ["Noto+Serif:wght@400;700", "Noto+Serif+SC:wght@400;700", "Noto+Serif+JP:wght@400;700"],
  },
  {
    id: "source-sans",
    label: "Source Sans 3",
    license: "SIL OFL",
    hint: "Adobe 开源西文 + Noto 中日文",
    detail: "Adobe 无衬线。西文/俄文走 Source Sans 3，中日文回落 Noto Sans。",
    langs: "英欧俄 + 中日",
    latin: '"Source Sans 3"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
    google: ["Source+Sans+3:wght@400;600;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"],
  },
  {
    id: "source-serif",
    label: "Source Serif 4",
    license: "SIL OFL",
    hint: "Adobe 开源衬线，西文/俄文，中日文回落 Noto Serif",
    detail: "Adobe 衬线。标题想更「出版」时可换这套；中日文回落 Noto Serif。",
    langs: "英欧俄 + 中日",
    latin: '"Source Serif 4"',
    zh: '"Noto Serif SC"',
    ja: '"Noto Serif JP"',
    generic: "serif",
    google: ["Source+Serif+4:opsz,wght@8..60,400;8..60,700", "Noto+Serif+SC:wght@400;700", "Noto+Serif+JP:wght@400;700"],
  },
  {
    id: "ibm-plex",
    label: "IBM Plex",
    license: "SIL OFL",
    hint: "IBM 开源，西文/俄文 + 日文，中文走 Noto",
    detail: "科技感无衬线。日文走 IBM Plex Sans JP，中文仍回落 Noto Sans SC。",
    langs: "英欧俄日 + 中",
    latin: '"IBM Plex Sans"',
    zh: '"Noto Sans SC"',
    ja: '"IBM Plex Sans JP"',
    generic: "sans-serif",
    google: [
      "IBM+Plex+Sans:wght@400;500;600;700",
      "IBM+Plex+Sans+JP:wght@400;500;700",
      "Noto+Sans+SC:wght@400;500;700",
    ],
  },
  {
    id: "pt-sans",
    label: "PT Sans",
    license: "SIL OFL",
    hint: "ParaType 开源，西里尔文口碑好，中日文回落 Noto",
    detail: "俄文口碑好。西里尔文片可优先考虑；中日文回落 Noto Sans。",
    langs: "英欧俄 + 中日",
    latin: '"PT Sans"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
    google: ["PT+Sans:wght@400;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"],
  },
  {
    id: "nunito",
    label: "Nunito Sans",
    license: "SIL OFL",
    hint: "圆润无衬线，中日文回落到 Noto",
    detail: "圆角无衬线，偏轻松。少儿向、轻松讲解可用；中日文回落 Noto。",
    langs: "英欧俄 + 中日",
    latin: '"Nunito Sans"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
    google: ["Nunito+Sans:wght@400;600;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"],
  },
  {
    id: "inter",
    label: "Inter",
    license: "SIL OFL",
    hint: "界面向无衬线，西文/俄文清晰，中日文回落 Noto",
    detail: "界面级西文，小字也清晰。适合进度条、字幕这类小字。",
    langs: "英欧俄 + 中日",
    latin: '"Inter"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
    google: ["Inter:wght@400;500;600;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"],
  },
  {
    id: "literata",
    label: "Literata",
    license: "SIL OFL",
    hint: "阅读向衬线，中日文回落到 Noto Serif",
    detail: "阅读向衬线。长段落比 Noto Serif 更「书」；中日文回落 Noto Serif。",
    langs: "英欧俄 + 中日",
    latin: '"Literata"',
    zh: '"Noto Serif SC"',
    ja: '"Noto Serif JP"',
    generic: "serif",
    google: ["Literata:wght@400;700", "Noto+Serif+SC:wght@400;700", "Noto+Serif+JP:wght@400;700"],
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    license: "SIL OFL",
    hint: "和工作台 UI 同一套西文，中日文回落 Noto",
    detail: "工作台界面同一套西文。成片想跟界面气质一致时用；中日文回落 Noto。",
    langs: "英欧 + 中日",
    latin: '"DM Sans"',
    zh: '"Noto Sans SC"',
    ja: '"Noto Sans JP"',
    generic: "sans-serif",
    google: ["DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"],
  },
];

export const STAGE_FONT_IDS = STAGE_FONTS.map((f) => f.id);

/** Where each font is used. All SIL OFL — free for commercial use. */
export const FONT_USAGE: { where: string; fonts: string; license: "SIL OFL"; detail: string }[] = [
  {
    where: "工作台界面",
    fonts: "DM Sans、Noto Sans SC",
    license: "SIL OFL",
    detail: "按钮、表单、检视、时间轴。固定用这两套，不随工程改。中文走 Noto Sans SC。",
  },
  {
    where: "工作台标题",
    fonts: "Fraunces、Noto Serif SC",
    license: "SIL OFL",
    detail: "顶栏品牌名、对话框标题。固定衬线，不随工程改。中文走 Noto Serif SC。",
  },
  {
    where: "画面正文、列表",
    fonts: "配置 → 字体 → 正文 / 列表（默认 Noto Sans）",
    license: "SIL OFL",
    detail: "版面里的正文和列表。上面下拉改 fontId。中日文不足回落 Noto Sans CJK。",
  },
  {
    where: "画面标题、数字",
    fonts: "配置 → 字体 → 标题 / 数字（默认 Noto Serif）",
    license: "SIL OFL",
    detail: "大标题和数字统计。上面下拉改 titleFontId。衬线默认 Noto Serif。",
  },
  {
    where: "副标题、署名",
    fonts: "配置 → 字体 → 副标题 / 署名（默认 Noto Sans）",
    license: "SIL OFL",
    detail: "副标题和金句下的署名。上面下拉改 subtitleFontId。",
  },
  {
    where: "金句",
    fonts: "配置 → 字体 → 金句（默认 Noto Serif）",
    license: "SIL OFL",
    detail: "引用/金句元件。上面下拉改 quoteFontId。",
  },
  {
    where: "口播字幕条",
    fonts: "配置 → 字体 → 口播字幕（默认 Noto Sans）",
    license: "SIL OFL",
    detail: "预览和烧录到画面的口播字幕。上面下拉改 captionFontId。底色、位置在「字幕」页。",
  },
  {
    where: "进度条场次名",
    fonts: "配置 → 字体 → 进度条场次名（可回落字幕字体）",
    license: "SIL OFL",
    detail: "画布顶/底进度条上的场次名。不单独选则跟口播字幕同一套。",
  },
  {
    where: "单个元件覆盖",
    fonts: "检视里可选；缺省跟该类型全局字体",
    license: "SIL OFL",
    detail: "某个标题或正文可在检视里改字体，只影响该元件。不选则用上面的全局项。",
  },
  {
    where: "中日文缺字回落",
    fonts: "Noto Sans/Serif SC、JP；IBM Plex 日文走 IBM Plex Sans JP",
    license: "SIL OFL",
    detail: "西文/俄文字体没有中日文时自动回落。九语口播用 Noto 覆盖最完整。",
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

/** Load only the selected families (plus Noto CJK fallbacks). */
export function ensureStageFonts(...ids: Array<StageFontId | undefined>) {
  if (typeof document === "undefined") return;
  const families = new Set<string>(["Noto+Sans:wght@400;500;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"]);
  for (const id of ids) {
    if (!isStageFontId(id)) continue;
    for (const g of stageFont(id).google) families.add(g);
  }
  const key = [...families].sort().join("|");
  let link = document.getElementById("stage-fonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "stage-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.dataset.key === key) return;
  link.dataset.key = key;
  link.href = `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join("&")}&display=swap`;
}

export async function waitStageFonts(...ids: Array<StageFontId | undefined>) {
  ensureStageFonts(...ids);
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.race([document.fonts.ready, new Promise<void>((r) => window.setTimeout(r, 4000))]);
  } catch {
    /* ignore */
  }
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
