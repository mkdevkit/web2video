import type { CSSProperties } from "react";
import type { LangId } from "./langs";
import type { Project, StageFontId, StageTheme } from "../types";

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

/** All SIL Open Font License — free for commercial use. CJK/Cyrillic via Noto fallbacks. */
export const STAGE_FONTS: StageFont[] = [
  {
    id: "noto-sans",
    label: "Noto Sans",
    license: "SIL OFL",
    hint: "谷歌多语种无衬线",
    detail: "默认正文、字幕。九语都自带字形，知识讲解片首选，不靠中日文回落。",
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
    hint: "谷歌多语种衬线，适合标题",
    detail: "默认标题。多语衬线，正式，适合大字和引用。",
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
    hint: "Adobe 开源西文，中日文回落 Noto",
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
    label: "IBM Plex Sans",
    license: "SIL OFL",
    hint: "IBM 开源，西文/俄文/日文，中文走 Noto",
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
    hint: "圆润无衬线，中日文回落 Noto",
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
    detail: "界面级西文，小字也清晰。适合字幕条、节拍卡这类小字。",
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
    hint: "阅读向衬线，中日文回落 Noto Serif",
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
    detail: "按钮、表单、用法页、时间轴。固定用这两套，不随工程改。中文走 Noto Sans SC。",
  },
  {
    where: "舞台正文",
    fonts: "外观 → 字体 → 正文字体（默认 Noto Sans）",
    license: "SIL OFL",
    detail: "舞台 DOM 正文。上面下拉改 fontId，CSS 里用 var(--stage-font)。中日文不足回落 Noto Sans CJK。",
  },
  {
    where: "舞台标题",
    fonts: "外观 → 字体 → 标题字体（默认 Noto Serif）",
    license: "SIL OFL",
    detail: "舞台标题。上面下拉改 titleFontId，CSS 里用 var(--stage-title-font)。",
  },
  {
    where: "字幕条、节拍卡",
    fonts: "外观 → 字体 → 字幕字体（默认 Noto Sans）",
    license: "SIL OFL",
    detail: "预览和烧录到画面的口播字幕，以及节拍卡上的字。上面下拉改 captionFontId。",
  },
  {
    where: "中日文缺字回落",
    fonts: "Noto Sans/Serif SC、JP；IBM Plex 日文走 IBM Plex Sans JP",
    license: "SIL OFL",
    detail: "西文/俄文字体没有中日文时自动回落。九语口播用 Noto 覆盖最完整。",
  },
  {
    where: "HyperFrames 示例页",
    fonts: "Noto Sans SC",
    license: "SIL OFL",
    detail: "HyperFrames 内置示例页用 Noto Sans SC，不随工程字体改。",
  },
  {
    where: "KaTeX 公式",
    fonts: "KaTeX_*（脚本引入 KaTeX 样式时）",
    license: "SIL OFL",
    detail: "工具不捆绑 KaTeX。若脚本自行引入其样式，公式字体 KaTeX_* 同样是 SIL OFL。",
  },
];

const FONT_ID_SET = new Set<string>(STAGE_FONT_IDS);

export const DEFAULT_STAGE_THEME: StageTheme = {
  bg: "#10120e",
  color: "#ece7db",
  accent: "#d4a84b",
  fontId: "noto-sans",
  titleFontId: "noto-serif",
  captionFontId: "noto-sans",
};

export const DEFAULT_STAGE_HTML = `<div id="title" class="clip title">黑洞不是洞</div>
<div id="stat" class="clip stat">c = 3×10⁸ m/s</div>
<div id="ring" class="clip ring"></div>`;

/** Shared layout classes. Sizes follow --stage-w so preview scale and export match. */
export const DEFAULT_STAGE_CSS = `.root, .fill { position: absolute; inset: 0; }
.clip { position: absolute; }
.title {
  top: 22%;
  left: 8%;
  font-size: calc(var(--stage-w) * 0.033);
  font-weight: 700;
  font-family: var(--stage-title-font);
  color: var(--stage-color);
  opacity: 0;
}
.stat {
  top: 52%;
  left: 8%;
  font-size: calc(var(--stage-w) * 0.019);
  font-family: var(--stage-font);
  color: var(--stage-accent);
  opacity: 0;
}
.ring {
  right: 12%;
  top: 28%;
  width: calc(var(--stage-w) * 0.094);
  height: calc(var(--stage-w) * 0.094);
  border: calc(var(--stage-w) * 0.003) solid var(--stage-accent);
  border-radius: 50%;
  opacity: 0;
}`;

export function isStageFontId(v: unknown): v is StageFontId {
  return typeof v === "string" && FONT_ID_SET.has(v);
}

export function asCssHex(value: string | undefined, fallback: string): string {
  const s = (value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function fontOf(id: StageFontId): StageFont {
  return STAGE_FONTS.find((f) => f.id === id) ?? STAGE_FONTS[0];
}

export function fontStack(id: StageFontId, lang?: LangId): string {
  const f = fontOf(id);
  if (lang === "zh") return `${f.zh}, ${f.ja}, ${f.latin}, ${f.generic}`;
  if (lang === "ja") return `${f.ja}, ${f.zh}, ${f.latin}, ${f.generic}`;
  return `${f.latin}, ${f.zh}, ${f.ja}, ${f.generic}`;
}

/** Load only the selected families (plus Noto CJK/Cyrillic fallbacks). */
export function ensureStageFonts(...ids: StageFontId[]) {
  if (typeof document === "undefined") return;
  const families = new Set<string>(["Noto+Sans:wght@400;500;700", "Noto+Sans+SC:wght@400;500;700", "Noto+Sans+JP:wght@400;500;700"]);
  for (const id of ids) {
    for (const g of fontOf(id).google) families.add(g);
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

/** Load selected families then wait until the browser has them (export frames). */
export async function waitStageFonts(...ids: StageFontId[]) {
  ensureStageFonts(...ids);
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.race([document.fonts.ready, new Promise<void>((r) => window.setTimeout(r, 4000))]);
  } catch {
    /* ignore */
  }
}

export function stageThemeOf(raw?: Partial<StageTheme> | null): StageTheme {
  return {
    bg: asCssHex(raw?.bg, DEFAULT_STAGE_THEME.bg),
    color: asCssHex(raw?.color, DEFAULT_STAGE_THEME.color),
    accent: asCssHex(raw?.accent, DEFAULT_STAGE_THEME.accent),
    fontId: isStageFontId(raw?.fontId) ? raw.fontId : DEFAULT_STAGE_THEME.fontId,
    titleFontId: isStageFontId(raw?.titleFontId) ? raw.titleFontId : DEFAULT_STAGE_THEME.titleFontId,
    captionFontId: isStageFontId(raw?.captionFontId) ? raw.captionFontId : DEFAULT_STAGE_THEME.captionFontId,
  };
}

export function stageCssOf(project: { stageCss?: string }): string {
  const css = (project.stageCss ?? "").trim();
  return css || DEFAULT_STAGE_CSS;
}

export function stageHtmlOf(script: { stageHtml?: string }): string {
  const html = (script.stageHtml ?? "").trim();
  return html || DEFAULT_STAGE_HTML;
}

export function stageBoxStyle(project: Project, w: number, h: number): CSSProperties {
  const t = stageThemeOf(project.stageTheme);
  return {
    width: w,
    height: h,
    background: t.bg,
    color: t.color,
    fontFamily: fontStack(t.fontId),
    ["--stage-w" as string]: `${w}px`,
    ["--stage-h" as string]: `${h}px`,
    ["--stage-bg" as string]: t.bg,
    ["--stage-color" as string]: t.color,
    ["--stage-accent" as string]: t.accent,
    ["--stage-font" as string]: fontStack(t.fontId),
    ["--stage-title-font" as string]: fontStack(t.titleFontId),
    ["--stage-caption-font" as string]: fontStack(t.captionFontId),
  };
}

export function mountStage(root: HTMLElement, script: { stageHtml?: string }, project: { stageCss?: string }) {
  const css = stageCssOf(project);
  const base = `.root,.fill{position:absolute;inset:0;overflow:hidden}.fill{overflow:visible}`;
  root.innerHTML = `<style data-stage-css>${base}\n${css}</style>${stageHtmlOf(script)}`;
}

function cssEscapeId(id: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(id);
  return id.replace(/([^\w-])/g, "\\$1");
}

function fillIfEmpty(el: Element | null, text: string) {
  if (!(el instanceof HTMLElement) || !text) return;
  if (el.textContent?.replace(/\s+/g, "").trim()) return;
  el.textContent = text;
}

/** Put beat text into empty stage nodes so AI-generated empty #title/#stat still preview. */
export function hydrateStageSpeech(root: HTMLElement, speech: { ids: () => string[]; text: (id: string) => string }) {
  const ids = speech.ids();
  for (const id of ids) {
    const text = speech.text(id);
    if (!text) continue;
    const sel = cssEscapeId(id);
    root.querySelectorAll(`#${sel}, [data-speech="${sel}"]`).forEach((el) => fillIfEmpty(el, text));
  }
  const slots = ["title", "stat", "body", "caption"];
  ids.forEach((id, i) => {
    const slot = slots[i];
    if (!slot) return;
    fillIfEmpty(root.querySelector(`#${slot}`), speech.text(id));
  });
}

/** Selectors used in timeline/gsap tweens but missing from the stage DOM. */
export function missingGsapTargets(code: string, root: HTMLElement): string[] {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const found = new Set<string>();
  for (const m of stripped.matchAll(/\.(?:fromTo|from|to|set)\(\s*["']([^"']+)["']/g)) {
    const sel = m[1]?.trim();
    if (sel && (sel.startsWith("#") || sel.startsWith("."))) found.add(sel);
  }
  const missing: string[] = [];
  for (const sel of found) {
    try {
      if (!root.querySelector(sel)) missing.push(sel);
    } catch {
      missing.push(sel);
    }
  }
  return missing;
}
