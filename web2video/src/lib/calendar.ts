import type { DriveMode, LayoutBlock, Project, Scene, SpeakLine, TimeRef, TimeRefKind } from "../types";
import { sceneBlocks } from "./blocks";
import type { LangId } from "./langs";
import { isGapSpeak, lineDurationMs, speakLabel, speakLineText, speaksOf } from "./speaks";
import { speakText } from "./narration";

export const SPEAK_SCENE = "scene";
export const SPEAK_BODY = "body";
export const DEFAULT_GAP_MS = 400;

export function driveOf(scene: Pick<Scene, "drive">): DriveMode {
  return scene.drive === "config" ? "config" : "narration";
}

export function isPlayBlock(block: Pick<LayoutBlock, "type">): boolean {
  return block.type === "play";
}

export function gapMsOf(line: Pick<SpeakLine, "durationMs">): number {
  const n = line.durationMs;
  return Number.isFinite(n) && (n ?? 0) > 0 ? Math.round(n as number) : DEFAULT_GAP_MS;
}

export type CalSpan = {
  id: string;
  kind: "speech" | "gap";
  target: string;
  text: string;
  startMs: number;
  endMs: number;
  fileStartMs: number;
};

export type SceneCalendar = {
  drive: DriveMode;
  totalMs: number;
  bodyStartMs: number;
  bodyEndMs: number;
  holdMs: number;
  openPadBeforeMs: number;
  openPadAfterMs: number;
  closePadBeforeMs: number;
  closePadAfterMs: number;
  spans: CalSpan[];
  byTarget: Record<string, { startMs: number; endMs: number }>;
};

export function speaksClock(scene: Scene): SpeakLine[] {
  return speaksOf(scene);
}

export function targetDurationMs(scene: Scene, lang: LangId, source: LangId, target: string): number {
  const line = speaksOf(scene).find((s) => s.id === target);
  if (line) return lineDurationMs(scene, line, lang, source);
  const stored = scene.audioByLang?.[lang];
  const fromStore = stored && !stored.stale ? stored.beatMs?.[target] : undefined;
  if (fromStore && fromStore > 0) return fromStore;
  const text = speakText(scene, target, lang, source);
  const n = text.replace(/\s+/g, "").length;
  return text.trim() ? Math.max(400, n * 180) : 0;
}

function emptyCal(drive: DriveMode, holdMs: number): SceneCalendar {
  return {
    drive,
    totalMs: Math.max(1, holdMs),
    bodyStartMs: 0,
    bodyEndMs: Math.max(1, holdMs),
    holdMs,
    openPadBeforeMs: 0,
    openPadAfterMs: 0,
    closePadBeforeMs: 0,
    closePadAfterMs: 0,
    spans: [],
    byTarget: {},
  };
}

function withSceneBody(cal: SceneCalendar): SceneCalendar {
  cal.byTarget[SPEAK_SCENE] = { startMs: 0, endMs: cal.totalMs };
  cal.byTarget[SPEAK_BODY] = { startMs: cal.bodyStartMs, endMs: cal.bodyEndMs };
  return cal;
}

export function timeRefKind(ref: TimeRef | undefined): TimeRefKind {
  if (!ref) return "speak";
  if (ref.kind === "fixed" || ref.kind === "scene" || ref.kind === "speak") return ref.kind;
  if (ref.atMs != null) return "fixed";
  if (ref.speakId === SPEAK_SCENE || ref.speakId === SPEAK_BODY) return "scene";
  return "speak";
}

export function resolveTimeRef(ref: TimeRef | undefined, cal: SceneCalendar, fallback = 0): number {
  if (!ref) return fallback;
  if (timeRefKind(ref) === "fixed") return Math.max(0, ref.atMs ?? ref.offsetMs ?? 0);
  const span = cal.byTarget[ref.speakId];
  const base = span ? (ref.anchor === "end" ? span.endMs : span.startMs) : fallback;
  return Math.max(0, base + (ref.offsetMs ?? 0));
}

function playBlocks(scene: Scene): LayoutBlock[] {
  return sceneBlocks(scene).filter(isPlayBlock);
}

export function calendarTailMs(cal: Pick<SceneCalendar, "closePadBeforeMs" | "closePadAfterMs" | "holdMs">): number {
  return cal.closePadBeforeMs + cal.closePadAfterMs + cal.holdMs;
}

function buildConfigCalendar(scene: Scene, lang: LangId, source: LangId, project: Project): SceneCalendar {
  const holdMs = Math.max(0, scene.holdMs ?? project.holdMs ?? 0);
  const openPadBeforeMs = Math.max(0, scene.openPadBeforeMs ?? project.openPadBeforeMs ?? 0);
  const openPadAfterMs = Math.max(0, scene.openPadAfterMs ?? project.openPadAfterMs ?? 0);
  const closePadBeforeMs = Math.max(0, scene.closePadBeforeMs ?? project.closePadBeforeMs ?? 0);
  const closePadAfterMs = Math.max(0, scene.closePadAfterMs ?? project.closePadAfterMs ?? 0);
  const head = openPadBeforeMs + openPadAfterMs;
  const cal = emptyCal("config", holdMs);
  cal.openPadBeforeMs = openPadBeforeMs;
  cal.openPadAfterMs = openPadAfterMs;
  cal.closePadBeforeMs = closePadBeforeMs;
  cal.closePadAfterMs = closePadAfterMs;
  const plays = playBlocks(scene).filter((b) => (b.settings?.playTarget ?? "").trim());
  if (!plays.length) {
    cal.bodyStartMs = head;
    cal.bodyEndMs = head;
    cal.totalMs = Math.max(1, head + calendarTailMs(cal));
    return withSceneBody(cal);
  }
  const place = () => {
    cal.spans = [];
    cal.byTarget = {};
    let cursor = head;
    for (const block of plays) {
      const target = (block.settings?.playTarget ?? "").trim();
      const from = block.settings?.playFrom;
      const start = from ? resolveTimeRef(from, cal, cursor) : cursor;
      const dur = targetDurationMs(scene, lang, source, target);
      const end = start + Math.max(0, dur);
      cal.byTarget[target] = { startMs: start, endMs: end };
      cal.spans.push({
        id: block.id,
        kind: "speech",
        target,
        text: speakText(scene, target, lang, source),
        startMs: start,
        endMs: end,
        fileStartMs: start,
      });
      cursor = Math.max(cursor, end);
    }
    cal.bodyStartMs = head;
    cal.bodyEndMs = cursor;
    cal.totalMs = Math.max(1, cursor + calendarTailMs(cal));
    withSceneBody(cal);
  };
  place();
  place();
  return cal;
}

export function buildSceneCalendar(scene: Scene, lang: LangId, project: Project): SceneCalendar {
  const source = project.sourceLang ?? lang;
  const holdMs = Math.max(0, scene.holdMs ?? project.holdMs ?? 0);
  if (driveOf(scene) === "config") return buildConfigCalendar(scene, lang, source, project);

  const cal = emptyCal("narration", holdMs);
  let t = 0;
  let fileT = 0;
  const gapsInFile = Boolean(scene.audioByLang?.[lang]?.beatMs);
  const lines = speaksOf(scene);

  for (const line of lines) {
    const gap = isGapSpeak(line);
    const text = gap ? "" : speakLineText(line, lang, source).replace(/\s+/g, " ").trim();
    const dur = lineDurationMs(scene, line, lang, source);
    if (!gap && !text && dur <= 0) continue;
    const inFile = !gap || gapsInFile;
    const end = t + Math.max(0, dur);
    cal.spans.push({
      id: line.id,
      kind: gap ? "gap" : "speech",
      target: line.id,
      text,
      startMs: t,
      endMs: end,
      fileStartMs: inFile ? fileT : -1,
    });
    if (inFile) fileT += Math.max(0, dur);
    if (!gap) cal.byTarget[line.id] = { startMs: t, endMs: end };
    t = end;
  }

  cal.bodyStartMs = 0;
  cal.bodyEndMs = t;
  t += holdMs;
  cal.totalMs = Math.max(1, t);
  if (!cal.spans.length) {
    cal.bodyEndMs = Math.max(1, cal.totalMs - holdMs);
  }
  return withSceneBody(cal);
}

export function effectEndMs(fromMs: number, to: TimeRef | undefined, durationMs: number | undefined, cal: SceneCalendar): number {
  if (to) return Math.max(fromMs + 40, resolveTimeRef(to, cal, fromMs + 400));
  if (durationMs != null && Number.isFinite(durationMs)) return fromMs + Math.max(40, durationMs);
  return Math.max(fromMs + 40, cal.bodyEndMs);
}

export function audioMsAt(cal: SceneCalendar, localMs: number, mixed: boolean): number | null {
  const t = Math.max(0, localMs);
  if (t >= cal.totalMs - cal.holdMs && cal.holdMs > 0) return null;
  if (mixed) return t < cal.bodyEndMs ? t : null;
  const span = cal.spans.find((s) => t >= s.startMs && t < s.endMs);
  if (!span || span.fileStartMs < 0) return null;
  return span.fileStartMs + (t - span.startMs);
}

export function captionSpanAt(cal: SceneCalendar, localMs: number): CalSpan | undefined {
  return cal.spans.find((s) => s.kind === "speech" && localMs >= s.startMs && localMs < s.endMs + 80);
}

export function playTargetChoices(scene: Scene, lang?: LangId, source?: LangId): { id: string; label: string }[] {
  return speakChoices(scene, lang, source).filter((c) => c.id !== SPEAK_SCENE && c.id !== SPEAK_BODY);
}

export function speakChoices(scene: Scene, lang: LangId = "zh", source: LangId = lang): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [
    { id: SPEAK_SCENE, label: "场景" },
    { id: SPEAK_BODY, label: "主体" },
  ];
  for (const line of speaksOf(scene)) {
    if (isGapSpeak(line)) continue;
    out.push({ id: line.id, label: speakLabel(line, lang, source) });
  }
  return out;
}
