import type { LangId } from "./lib/langs";

export type AspectId = "16:9" | "9:16" | "1:1";
export type LayoutId =
  | "cover"
  | "splitLeft"
  | "splitRight"
  | "bullets"
  | "quote"
  | "steps"
  | "fullImage"
  | "compare"
  | "bigStat"
  | "chapter"
  | "overlay"
  | "threeCol"
  | "qa"
  | "cards"
  | "custom";
export type AnimKind = "fade" | "slide" | "scale" | "highlight" | "kenburns";
export type BlockType =
  | "title"
  | "subtitle"
  | "body"
  | "caption"
  | "quote"
  | "author"
  | "number"
  | "list"
  | "image"
  | "shape";
export type TtsProvider = "edge" | "azure" | "openai";
export type SceneTransition = "cut" | "crossfade";

export interface TextI18n {
  i18n: Partial<Record<LangId, string>>;
}

export interface ListItem {
  id: string;
  i18n: Partial<Record<LangId, string>>;
}

export interface WordTs {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SceneAudio {
  src: string;
  durationMs: number;
  voice?: string;
  words?: WordTs[];
  stale?: boolean;
}

export type CueBind = "speak" | "visual";
export type CueStay = "speech" | "body";

export interface Cue {
  id: string;
  target: string;
  /** speak = follow this element's line in the current language. visual = 0–1 of the body, stretched per language. */
  bind?: CueBind;
  /** visual: start as 0–1 of body. speak: fallback if that line is missing. */
  at: number;
  /** visual: end as 0–1 of body. speak: fallback if that line is missing. */
  until: number;
  /** speak: appear this many ms before the line (negative = after the line starts). */
  leadMs?: number;
  /** speak: extra ms after the line ends, when stay is `speech`. */
  trailMs?: number;
  /** speak: stay until the line ends, or until the body ends. Default `body`. */
  stay?: CueStay;
  anim: AnimKind;
}

export type EaseKind = "linear" | "ease" | "easeIn" | "easeOut";

export interface BlockKeyframe {
  /** 0–1 of this element's on-stage window. */
  t: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  opacity?: number;
  rotation?: number;
  ease?: EaseKind;
}

export interface BlockSettings {
  align?: "left" | "center" | "right";
  color?: string;
  fill?: string;
  fontSize?: number;
  fontWeight?: "normal" | "medium" | "bold";
  lineHeight?: number;
  padding?: number;
  radius?: number;
  opacity?: number;
  rotation?: number;
  objectFit?: "cover" | "contain";
  listLayout?: "stack" | "row" | "grid";
  shadow?: boolean;
}

export interface LayoutBlock {
  id: string;
  type: BlockType;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  settings?: BlockSettings;
  keys?: BlockKeyframe[];
}

export interface SceneSlots {
  title?: TextI18n;
  subtitle?: TextI18n;
  body?: TextI18n;
  caption?: TextI18n;
  quote?: TextI18n;
  author?: TextI18n;
  number?: TextI18n;
  items?: ListItem[];
  image?: string;
}

export interface Scene {
  id: string;
  name: string;
  layoutId: LayoutId;
  /** Opening narration (scene start). */
  narration: TextI18n;
  /** Closing narration (scene end). */
  narrationClose?: TextI18n;
  /** Per-element spoken lines. Keys are block ids or `item:{id}`. */
  speak?: Partial<Record<string, TextI18n>>;
  audioByLang?: Partial<Record<LangId, SceneAudio>>;
  slots: SceneSlots;
  cues: Cue[];
  blocks?: LayoutBlock[];
  bg: string;
  /** Extra ms after speech before the next scene. Undefined inherits the project default. */
  holdMs?: number;
  /** Silence before opening narration. Ignored if there is no opening line. */
  openPadBeforeMs?: number;
  /** Silence after opening narration, before body animation. */
  openPadAfterMs?: number;
  /** Silence after body, before closing narration. */
  closePadBeforeMs?: number;
  /** Silence after closing narration, before hold. */
  closePadAfterMs?: number;
  /** How this scene leaves. Undefined inherits the project default. */
  transition?: SceneTransition;
  /** Crossfade length in ms. Undefined inherits the project default. */
  transitionMs?: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  lang: LangId;
  provider: TtsProvider;
  voiceId: string;
  gender?: "女" | "男";
}

export interface Project {
  name: string;
  sourceLang: LangId;
  previewLang: LangId;
  aspect: AspectId;
  ttsProvider: TtsProvider;
  voices: VoiceProfile[];
  voiceByLang: Partial<Record<LangId, string>>;
  showCaptions: boolean;
  /** Extra ms after each scene's speech before cutting away. */
  holdMs: number;
  openPadBeforeMs: number;
  openPadAfterMs: number;
  closePadBeforeMs: number;
  closePadAfterMs: number;
  transition: SceneTransition;
  transitionMs: number;
  scenes: Scene[];
}

export interface EditorSnapshot {
  project: Project;
  currentSceneId: string;
}

export const ASPECT_PX: Record<AspectId, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
};

export const LAYOUTS: { id: LayoutId; label: string; desc: string }[] = [
  { id: "cover", label: "封面", desc: "大标题 + 副标题" },
  { id: "splitLeft", label: "左图右文", desc: "配图在左，文案在右" },
  { id: "splitRight", label: "右图左文", desc: "配图在右，文案在左" },
  { id: "bullets", label: "要点列表", desc: "标题 + 逐条入场" },
  { id: "quote", label: "金句", desc: "引用 + 署名" },
  { id: "steps", label: "步骤条", desc: "按顺序展开步骤" },
  { id: "fullImage", label: "全幅图", desc: "大图 + 底部字幕条" },
  { id: "compare", label: "左右对比", desc: "两个观点并排" },
  { id: "bigStat", label: "大数字", desc: "核心数据 + 说明" },
  { id: "chapter", label: "章节过场", desc: "小节编号 + 大标题" },
  { id: "overlay", label: "图上叠字", desc: "全幅图叠标题" },
  { id: "threeCol", label: "三栏卡片", desc: "三个要点并排" },
  { id: "qa", label: "问答", desc: "问题 + 回答" },
  { id: "cards", label: "宫格卡片", desc: "多条目网格" },
  { id: "custom", label: "自定义", desc: "自由摆放公共元件" },
];

export const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "title", label: "标题" },
  { type: "subtitle", label: "副标题" },
  { type: "body", label: "正文" },
  { type: "caption", label: "说明" },
  { type: "quote", label: "金句" },
  { type: "author", label: "署名" },
  { type: "number", label: "数字" },
  { type: "list", label: "列表" },
  { type: "image", label: "图片" },
  { type: "shape", label: "色块" },
];
