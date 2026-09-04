import type { LangId } from "./lib/langs";

export type { LangId } from "./lib/langs";

export type TtsProvider = "qwen";

export type TimeBind = "speech" | "fixed";

/** Who owns the speech calendar. Default narration. */
export type DriveMode = "narration" | "script";

export type BeatKind = "speech" | "gap";

export interface Beat {
  id: string;
  /** Default speech. Gap = delay row, duration only. */
  kind?: BeatKind;
  text: Partial<Record<LangId, string>>;
  /** Gap row silence (ms). Same across languages. */
  gapMs?: number;
  /** Override voice profile id for this beat. */
  roleId?: string;
}

/** One scheduled line after speech.play() (script-driven). */
export interface PlayCue {
  id: string;
  startMs: number;
  ms: number;
}

export interface VisualEvent {
  id: string;
  label: string;
  bind: TimeBind;
  beatId: string;
  at: number;
  until?: number;
  durationMs?: number;
}

export type BeatDurations = Record<string, number>;

export interface ScriptAudio {
  src: string;
  durationMs: number;
  voice?: string;
  beatMs: BeatDurations;
  stale?: boolean;
}

export interface LangAudio {
  lang: LangId;
  beatMs: BeatDurations;
}

export interface MappedEvent {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
}

export type EngineId = "gsap" | "hyperframes" | "remotion" | "manim";

export interface StageCopy {
  id: string;
  /** querySelector to the text node wrapper */
  sel: string;
  /** Last HTML extract (source-language seed). */
  extracted?: string;
  text: Partial<Record<LangId, string>>;
}

export interface SceneScript {
  id: string;
  name: string;
  beats: Beat[];
  events: VisualEvent[];
  /** Σ speech.sleepS pauses (ms). Written from tool code, not the speech table. */
  holdMs?: number;
  audioByLang?: Partial<Record<LangId, ScriptAudio>>;
  /** Who renders this beat. Export concatenates scripts in list order. */
  engine?: EngineId;
  /** Source per engine. `code` is the current engine (and legacy GSAP). */
  sources?: Partial<Record<EngineId, string>>;
  /** Animation source for the selected engine. Query durations with speech.s("hook"). */
  code?: string;
  /** This script's stage DOM (GSAP / HyperFrames). */
  stageHtml?: string;
  /** On-stage copy, translated like beats. Overlay at preview/export by previewLang. */
  stageTexts?: StageCopy[];
  /**
   * narration: list order (including gap rows) is the clock.
   * script: speech.play() schedules lines; list is a library.
   */
  drive?: DriveMode;
  /** Last speech.play() schedule (GSAP / HyperFrames run). */
  driveSchedule?: PlayCue[];
  /** Last speech.totalMs() in script-driven mode. */
  driveTotalMs?: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  provider?: TtsProvider;
  voiceId: string;
  gender?: "女" | "男";
  targetModel?: string;
}

export interface Project {
  name: string;
  sourceLang: LangId;
  previewLang: LangId;
  voices: VoiceProfile[];
  voiceId?: string;
  voiceByLang?: Partial<Record<LangId, string>>;
  scripts: SceneScript[];
  /** Frame size for preview and export. */
  aspect?: AspectId;
  /** Shared stage look: colors and fonts. */
  stageTheme?: StageTheme;
  /** Shared stage CSS (classes used by each script's HTML). */
  stageCss?: string;
  showCaptions?: boolean;
  bilingualCaptions?: boolean;
  bilingualCaptionLang?: LangId;
  exportSettings?: Partial<ExportSettings>;
}

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

export interface StageTheme {
  bg: string;
  color: string;
  accent: string;
  fontId: StageFontId;
  titleFontId: StageFontId;
  /** Burned-in / preview caption bar. */
  captionFontId: StageFontId;
}

export type AspectId = "16:9" | "9:16" | "1:1";
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

export const ASPECT_PX: Record<AspectId, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
};
