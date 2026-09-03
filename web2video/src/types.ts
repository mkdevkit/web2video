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
  | "dialogue"
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
  | "dialogue"
  | "image"
  | "video"
  | "gif"
  | "shape"
  | "play";
export type TtsProvider = "edge" | "azure" | "openai" | "qwen";
export type SceneTransition = "cut" | "crossfade";
export type StageFontId =
  | "noto-sans"
  | "noto-serif"
  | "source-sans"
  | "source-serif"
  | "ibm-plex"
  | "pt-sans"
  | "nunito"
  | "literata"
  | "inter"
  | "dm-sans";
export type CaptionBox = "pill" | "bar" | "none";

export interface CaptionStyle {
  box: CaptionBox;
  bg: string;
  bgOpacity: number;
  color: string;
  fontSize: number;
  fontWeight: "normal" | "medium" | "bold";
  align: "left" | "center" | "right";
  position: "bottom" | "top";
  insetX: number;
  insetY: number;
  paddingX: number;
  paddingY: number;
  outline: boolean;
  blur: boolean;
}

export type ExportFormatId = "webm-vp9" | "webm-vp8" | "mp4-h264";
export type ExportHeightId = 1080 | 720 | 480;

export interface ExportSettings {
  format: ExportFormatId;
  height: ExportHeightId;
  fps: number;
  videoMbps: number;
  audioKbps: number;
  exportSubtitles: boolean;
  subtitleFormat: "srt" | "vtt";
}

export interface ProgressStyle {
  position: "top" | "bottom";
  height: number;
  bg: string;
  bgOpacity: number;
  fill: string;
  fillOpacity: number;
  playhead: string;
  color: string;
  activeColor: string;
  fontSize: number;
  fontWeight: "normal" | "medium" | "bold";
  fontId?: StageFontId;
  showNames: boolean;
  showPlayhead: boolean;
  showDividers: boolean;
  blur: boolean;
  insetX: number;
}

export type ListMarkerKind = "number" | "image";
export type ListMarkerShape = "circle" | "rounded" | "square";

/** Project-wide list index badge (1, 2, 3…). */
export interface ListMarkerStyle {
  show: boolean;
  kind: ListMarkerKind;
  bg: string;
  color: string;
  /** Size in cqw. */
  size: number;
  shape: ListMarkerShape;
  /** Data URL when kind is image. */
  image?: string;
  /** Draw 1, 2, 3 on top of the image. */
  overlayIndex: boolean;
}

export interface TextI18n {
  i18n: Partial<Record<LangId, string>>;
}

export interface ListItem {
  id: string;
  i18n: Partial<Record<LangId, string>>;
}

export type DialogueSide = "left" | "right";

/** One line in a two-speaker game-style dialogue window. */
export interface DialogueLine {
  id: string;
  side: DialogueSide;
  /** Display name above the bubble. */
  name?: string;
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
  /** Per-line duration after synth (target → ms). */
  beatMs?: Record<string, number>;
  stale?: boolean;
}

export type CueBind = "speak" | "visual";
export type CueStay = "speech" | "body";

/** narration: list clock. config: play blocks + TimeRef effects. */
export type DriveMode = "narration" | "config";
export type SpeakAnchor = "start" | "end";

/** Point on the scene clock: a beat's start/end plus offset (ms). */
export interface TimeRef {
  speakId: string;
  anchor: SpeakAnchor;
  offsetMs?: number;
}

/** One animation on a block, timed from a TimeRef. */
export interface BlockEffect {
  id: string;
  anim: AnimKind;
  from: TimeRef;
  to?: TimeRef;
  /** Used when `to` is omitted. */
  durationMs?: number;
  /** List/dialogue item key (`item:{id}`). Missing = the block itself. */
  target?: string;
}

export interface SpeakLine {
  id: string;
  kind?: "speech" | "gap";
  /** Short label in the editor. */
  name?: string;
  i18n?: Partial<Record<LangId, string>>;
  /** Clock duration in ms. Missing = synth beatMs or estimate. */
  durationMs?: number;
  /** VoiceProfile.id override. */
  role?: string;
}

export interface SpeakTrackItem {
  id: string;
  kind: "speech" | "gap";
  /** Speech target: a SpeakLine.id (legacy: open / close / block id). */
  target?: string;
  /** Gap row duration (ms), same across languages. */
  gapMs?: number;
}

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
  /** If unset, inherit the project default for this block type. */
  fontId?: StageFontId;
  lineHeight?: number;
  padding?: number;
  radius?: number;
  opacity?: number;
  rotation?: number;
  objectFit?: "cover" | "contain";
  /** Image / video / GIF payload (data URL). Image blocks may fall back to `slots.image`. */
  src?: string;
  /** Video / GIF: restart after the clip ends. */
  loop?: boolean;
  listLayout?: "stack" | "row" | "grid";
  shadow?: boolean;
  /** Play block: which narration id to play (config-driven). */
  playTarget?: string;
  /** Play block: when to start (default = after previous play / scene start). */
  playFrom?: TimeRef;
}

export interface LayoutBlock {
  id: string;
  type: BlockType;
  name?: TextI18n;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  settings?: BlockSettings;
  keys?: BlockKeyframe[];
  /** Timed animations (config / narration). Empty = derived from cues. */
  effects?: BlockEffect[];
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
  dialogue?: DialogueLine[];
  image?: string;
}

export interface Scene {
  id: string;
  name: string;
  layoutId: LayoutId;
  /** narration = speak list is the clock. config = play blocks schedule speech. */
  drive?: DriveMode;
  /** Unified speech lines (own id + duration). Gaps are kind=gap. */
  speaks?: SpeakLine[];
  /** @deprecated Folded into `speaks`. */
  speakTrack?: SpeakTrackItem[];
  /** @deprecated Folded into `speaks`. */
  narration?: TextI18n;
  /** @deprecated Folded into `speaks`. */
  narrationClose?: TextI18n;
  /** @deprecated Folded into `speaks`. */
  speak?: Partial<Record<string, TextI18n>>;
  /** @deprecated Use SpeakLine.role. */
  speakRole?: Partial<Record<string, string>>;
  audioByLang?: Partial<Record<LangId, SceneAudio>>;
  slots: SceneSlots;
  cues: Cue[];
  blocks?: LayoutBlock[];
  /** Solid fill behind the stage. */
  bg: string;
  /** Full-frame backdrop photo; independent of the layout image block. */
  bgImage?: string;
  bgFit?: "cover" | "contain";
  /** Black overlay 0–1 on top of the backdrop, to keep type readable. */
  bgDim?: number;
  /** Extra ms after speech before the next scene. Undefined inherits the project default. */
  holdMs?: number;
  /** Config drive: silence before scheduled plays / body. Ignored in narration drive. */
  openPadBeforeMs?: number;
  /** Config drive: extra silence after the opening pad, before body. Ignored in narration drive. */
  openPadAfterMs?: number;
  /** Config drive: silence after body, before the closing pad. Ignored in narration drive. */
  closePadBeforeMs?: number;
  /** Config drive: silence after the closing pad, before hold. Ignored in narration drive. */
  closePadAfterMs?: number;
  /** How this scene leaves. Undefined inherits the project default. */
  transition?: SceneTransition;
  /** Crossfade length in ms. Undefined inherits the project default. */
  transitionMs?: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  /** @deprecated Roles are language-agnostic. Kept for old project files. */
  lang?: LangId;
  provider?: TtsProvider;
  voiceId: string;
  gender?: "女" | "男";
  /** Qwen custom voice: synthesis model bound at enrollment/design time. */
  targetModel?: string;
}

export interface Project {
  name: string;
  sourceLang: LangId;
  previewLang: LangId;
  aspect: AspectId;
  ttsProvider: TtsProvider;
  voices: VoiceProfile[];
  /** Fallback character when a language has no default. */
  voiceId: string;
  /** Default character per preview language. Missing = `voiceId`. */
  voiceByLang: Partial<Record<LangId, string>>;
  showCaptions: boolean;
  /** Second caption line in another language (same beat as the spoken line). */
  bilingualCaptions: boolean;
  /** Language for the second caption line. Missing = source, or en/zh as fallback. */
  bilingualCaptionLang?: LangId;
  /** Thin global playhead at the top of the stage column. */
  showTopProgress: boolean;
  fontId: StageFontId;
  titleFontId: StageFontId;
  subtitleFontId: StageFontId;
  quoteFontId: StageFontId;
  captionFontId: StageFontId;
  captionStyle: CaptionStyle;
  progressStyle: ProgressStyle;
  listMarkerStyle: ListMarkerStyle;
  exportSettings: ExportSettings;
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
  { id: "dialogue", label: "对话窗", desc: "左右双人对话，像游戏对白" },
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
  { type: "dialogue", label: "对话窗" },
  { type: "image", label: "图片" },
  { type: "video", label: "视频" },
  { type: "gif", label: "GIF" },
  { type: "shape", label: "色块" },
  { type: "play", label: "播放口播" },
];
