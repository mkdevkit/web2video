import type { LangId } from "./langs";
import type { Cue, Project, Scene, SceneTransition, WordTs } from "../types";
import { SPEAK_CLOSE, SPEAK_OPEN } from "./narration";
import { audioMsAt, buildSceneCalendar, driveOf, type SceneCalendar } from "./calendar";
import { extendCalendarForEffects } from "./effects";

export const FALLBACK_DURATION_MS = 5000;
export const DEFAULT_HOLD_MS = 0;
export const DEFAULT_OPEN_PAD_BEFORE_MS = 0;
export const DEFAULT_OPEN_PAD_AFTER_MS = 0;
export const DEFAULT_CLOSE_PAD_BEFORE_MS = 0;
export const DEFAULT_CLOSE_PAD_AFTER_MS = 0;
export const DEFAULT_TRANSITION: SceneTransition = "cut";
export const DEFAULT_TRANSITION_MS = 500;

export type ScenePhase = "openPad" | "open" | "openGap" | "body" | "closePad" | "close" | "closeGap" | "hold";

export type SceneHit = {
  scene: Scene;
  index: number;
  localMs: number;
  startMs: number;
  durationMs: number;
  animLocalMs: number;
  animDurationMs: number;
  audioMs: number | null;
  phase: ScenePhase;
};

export type SceneLayer = SceneHit & { opacity: number };

function clampMs(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value as number);
}

export function projectHoldMs(project: Project): number {
  return clampMs(project.holdMs, DEFAULT_HOLD_MS);
}

export function projectTransition(project: Project): SceneTransition {
  return project.transition === "crossfade" ? "crossfade" : DEFAULT_TRANSITION;
}

export function projectTransitionMs(project: Project): number {
  return clampMs(project.transitionMs, DEFAULT_TRANSITION_MS);
}

export function sceneHoldMs(scene: Scene, project: Project): number {
  return clampMs(scene.holdMs, projectHoldMs(project));
}

export function sceneTransitionKind(scene: Scene, project: Project): SceneTransition {
  return scene.transition === "cut" || scene.transition === "crossfade" ? scene.transition : projectTransition(project);
}

export function sceneTransitionMs(scene: Scene, project: Project): number {
  return clampMs(scene.transitionMs, projectTransitionMs(project));
}

export function sceneOverridesTiming(scene: Scene): boolean {
  return (
    scene.holdMs != null ||
    scene.transition != null ||
    scene.transitionMs != null ||
    scene.openPadBeforeMs != null ||
    scene.openPadAfterMs != null ||
    scene.closePadBeforeMs != null ||
    scene.closePadAfterMs != null
  );
}

export function sceneOpenPadBeforeMs(scene: Scene, project: Project): number {
  return clampMs(scene.openPadBeforeMs, clampMs(project.openPadBeforeMs, DEFAULT_OPEN_PAD_BEFORE_MS));
}
export function sceneOpenPadAfterMs(scene: Scene, project: Project): number {
  return clampMs(scene.openPadAfterMs, clampMs(project.openPadAfterMs, DEFAULT_OPEN_PAD_AFTER_MS));
}
export function sceneClosePadBeforeMs(scene: Scene, project: Project): number {
  return clampMs(scene.closePadBeforeMs, clampMs(project.closePadBeforeMs, DEFAULT_CLOSE_PAD_BEFORE_MS));
}
export function sceneClosePadAfterMs(scene: Scene, project: Project): number {
  return clampMs(scene.closePadAfterMs, clampMs(project.closePadAfterMs, DEFAULT_CLOSE_PAD_AFTER_MS));
}

export type SceneClock = {
  drive: ReturnType<typeof driveOf>;
  mixed: boolean;
  openBeforeMs: number;
  openSpeechMs: number;
  openAfterMs: number;
  bodyMs: number;
  closeBeforeMs: number;
  closeSpeechMs: number;
  closeAfterMs: number;
  holdMs: number;
  audioOpenStartMs: number;
  audioOpenEndMs: number;
  audioBodyStartMs: number;
  audioBodyEndMs: number;
  audioCloseStartMs: number;
  audioCloseEndMs: number;
  totalMs: number;
  openHeadMs: number;
  bodyStartMs: number;
  closeHeadMs: number;
  closeSpeechStartMs: number;
};

export function sceneCalendar(scene: Scene, lang: LangId, project: Project): SceneCalendar {
  const source = project.sourceLang ?? lang;
  return extendCalendarForEffects(buildSceneCalendar(scene, lang, project), scene, source);
}

function fileEnd(span: { fileStartMs: number; startMs: number; endMs: number }): number {
  if (span.fileStartMs < 0) return 0;
  return span.fileStartMs + (span.endMs - span.startMs);
}

export function sceneClock(scene: Scene, lang: LangId, project: Project): SceneClock {
  const cal = sceneCalendar(scene, lang, project);
  const mixed = cal.drive === "config";
  const holdMs = cal.holdMs;
  if (mixed) {
    const openBeforeMs = cal.openPadBeforeMs;
    const openAfterMs = cal.openPadAfterMs;
    const closeBeforeMs = cal.closePadBeforeMs;
    const closeAfterMs = cal.closePadAfterMs;
    const openHeadMs = openBeforeMs + openAfterMs;
    return {
      drive: "config",
      mixed: true,
      openBeforeMs,
      openSpeechMs: 0,
      openAfterMs,
      bodyMs: Math.max(0, cal.bodyEndMs - cal.bodyStartMs),
      closeBeforeMs,
      closeSpeechMs: 0,
      closeAfterMs,
      holdMs,
      audioOpenStartMs: 0,
      audioOpenEndMs: 0,
      audioBodyStartMs: cal.bodyStartMs,
      audioBodyEndMs: cal.bodyEndMs,
      audioCloseStartMs: 0,
      audioCloseEndMs: 0,
      totalMs: cal.totalMs,
      openHeadMs,
      bodyStartMs: cal.bodyStartMs,
      closeHeadMs: cal.bodyEndMs,
      closeSpeechStartMs: cal.bodyEndMs + closeBeforeMs,
    };
  }

  const openSpans = cal.spans.filter((s) => s.target === SPEAK_OPEN);
  const closeSpans = cal.spans.filter((s) => s.target === SPEAK_CLOSE);
  const bodySpans = cal.spans.filter((s) => s.target !== SPEAK_OPEN && s.target !== SPEAK_CLOSE);

  const openSpeechMs = openSpans.length ? openSpans[openSpans.length - 1].endMs - openSpans[0].startMs : 0;
  const closeSpeechMs = closeSpans.length ? closeSpans[closeSpans.length - 1].endMs - closeSpans[0].startMs : 0;
  const openBeforeMs = openSpans[0]?.startMs ?? 0;
  const openAfterMs = openSpans.length ? Math.max(0, cal.bodyStartMs - openSpans[openSpans.length - 1].endMs) : 0;
  const closeBeforeMs = closeSpans.length ? Math.max(0, closeSpans[0].startMs - cal.bodyEndMs) : 0;
  const closeAfterMs = closeSpans.length
    ? Math.max(0, cal.totalMs - holdMs - closeSpans[closeSpans.length - 1].endMs)
    : 0;
  const bodyMs = Math.max(0, cal.bodyEndMs - cal.bodyStartMs);
  const openHeadMs = openBeforeMs + openSpeechMs + openAfterMs;
  const closeHeadMs = cal.bodyEndMs;
  const closeSpeechStartMs = closeSpans[0]?.startMs ?? closeHeadMs;

  const audioOpenStartMs = openSpans[0] && openSpans[0].fileStartMs >= 0 ? openSpans[0].fileStartMs : 0;
  const audioOpenEndMs = openSpans.length ? fileEnd(openSpans[openSpans.length - 1]) : 0;
  const audioCloseStartMs = closeSpans[0] && closeSpans[0].fileStartMs >= 0 ? closeSpans[0].fileStartMs : audioOpenEndMs;
  const audioCloseEndMs = closeSpans.length ? fileEnd(closeSpans[closeSpans.length - 1]) : audioCloseStartMs;
  const bodyFile = bodySpans.filter((s) => s.fileStartMs >= 0);
  const audioBodyStartMs = bodyFile[0]?.fileStartMs ?? audioOpenEndMs;
  const audioBodyEndMs = bodyFile.length ? fileEnd(bodyFile[bodyFile.length - 1]) : audioBodyStartMs;

  return {
    drive: "narration",
    mixed: false,
    openBeforeMs,
    openSpeechMs,
    openAfterMs,
    bodyMs,
    closeBeforeMs,
    closeSpeechMs,
    closeAfterMs,
    holdMs,
    audioOpenStartMs,
    audioOpenEndMs,
    audioBodyStartMs,
    audioBodyEndMs,
    audioCloseStartMs,
    audioCloseEndMs,
    totalMs: cal.totalMs,
    openHeadMs,
    bodyStartMs: cal.bodyStartMs,
    closeHeadMs,
    closeSpeechStartMs,
  };
}

export function mapSceneLocal(
  clock: SceneClock,
  localMs: number,
  cal?: SceneCalendar,
): { phase: ScenePhase; animLocalMs: number; animDurationMs: number; audioMs: number | null } {
  const t = Math.max(0, localMs);
  const animDurationMs = Math.max(1, clock.totalMs);
  if (clock.mixed) {
    const holdStart = clock.totalMs - clock.holdMs;
    if (clock.holdMs > 0 && t >= holdStart) {
      return { phase: "hold", animLocalMs: t, animDurationMs, audioMs: null };
    }
    if (t < clock.openBeforeMs) return { phase: "openPad", animLocalMs: t, animDurationMs, audioMs: null };
    if (t < clock.openHeadMs) return { phase: "openGap", animLocalMs: t, animDurationMs, audioMs: null };
    if (t >= clock.closeHeadMs) {
      if (t < clock.closeSpeechStartMs) return { phase: "closePad", animLocalMs: t, animDurationMs, audioMs: null };
      return { phase: "closeGap", animLocalMs: t, animDurationMs, audioMs: null };
    }
    return {
      phase: "body",
      animLocalMs: t,
      animDurationMs,
      audioMs: cal ? audioMsAt(cal, t, true) : t < clock.bodyStartMs + clock.bodyMs ? t : null,
    };
  }

  const inOpen = (phase: ScenePhase, audioMs: number | null) => ({
    phase,
    animLocalMs: t,
    animDurationMs,
    audioMs,
  });
  const inClose = (phase: ScenePhase, audioMs: number | null) => ({
    phase,
    animLocalMs: t,
    animDurationMs,
    audioMs,
  });

  if (t < clock.openBeforeMs) return inOpen("openPad", null);
  if (t < clock.openBeforeMs + clock.openSpeechMs) {
    return inOpen("open", clock.audioOpenStartMs + (t - clock.openBeforeMs));
  }
  if (t < clock.openHeadMs) return inOpen("openGap", null);
  if (t < clock.closeHeadMs) {
    const audioMs = cal ? audioMsAt(cal, t, false) : clock.audioBodyStartMs + Math.min(Math.max(0, clock.audioBodyEndMs - clock.audioBodyStartMs), t - clock.bodyStartMs);
    return {
      phase: "body",
      animLocalMs: t,
      animDurationMs,
      audioMs,
    };
  }
  if (t < clock.closeSpeechStartMs) return inClose("closePad", null);
  if (t < clock.closeSpeechStartMs + clock.closeSpeechMs) {
    return inClose("close", clock.audioCloseStartMs + (t - clock.closeSpeechStartMs));
  }
  if (t < clock.closeSpeechStartMs + clock.closeSpeechMs + clock.closeAfterMs) return inClose("closeGap", null);
  return inClose("hold", null);
}

/** Speech file length (no visual pads). */
export function speechDuration(scene: Scene, lang: LangId, source?: LangId): number {
  const audio = scene.audioByLang?.[lang];
  if (audio?.durationMs && !audio.stale) return audio.durationMs;
  const projectLike = { sourceLang: source ?? lang, holdMs: 0, openPadBeforeMs: 0, openPadAfterMs: 0, closePadBeforeMs: 0, closePadAfterMs: 0, scenes: [scene] } as Project;
  const cal = buildSceneCalendar(scene, lang, projectLike);
  const last = [...cal.spans.filter((s) => s.fileStartMs >= 0)].pop();
  if (last) return Math.max(1, last.fileStartMs + (last.endMs - last.startMs));
  return FALLBACK_DURATION_MS;
}

export function sceneDuration(scene: Scene, lang: LangId, project: Project): number {
  return sceneClock(scene, lang, project).totalMs;
}

export function sceneStarts(project: Project, lang: LangId): number[] {
  let t = 0;
  return project.scenes.map((s) => {
    const start = t;
    t += sceneDuration(s, lang, project);
    return start;
  });
}

export function totalDuration(project: Project, lang: LangId): number {
  return project.scenes.reduce((sum, s) => sum + sceneDuration(s, lang, project), 0);
}

export function sceneAt(project: Project, lang: LangId, playheadMs: number): SceneHit | null {
  if (!project.scenes.length) return null;
  const starts = sceneStarts(project, lang);
  for (let i = 0; i < project.scenes.length; i++) {
    const durationMs = sceneDuration(project.scenes[i], lang, project);
    const end = starts[i] + durationMs;
    if (playheadMs < end || i === project.scenes.length - 1) {
      const scene = project.scenes[i];
      const clock = sceneClock(scene, lang, project);
      const cal = sceneCalendar(scene, lang, project);
      const mapped = mapSceneLocal(clock, Math.max(0, Math.min(durationMs, playheadMs - starts[i])), cal);
      return {
        scene,
        index: i,
        startMs: starts[i],
        durationMs,
        localMs: Math.max(0, Math.min(durationMs, playheadMs - starts[i])),
        animLocalMs: mapped.animLocalMs,
        animDurationMs: mapped.animDurationMs,
        audioMs: mapped.audioMs,
        phase: mapped.phase,
      };
    }
  }
  return null;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Current scene plus an optional incoming overlay during a crossfade at the end of this scene. */
export function sceneLayersAt(
  project: Project,
  lang: LangId,
  playheadMs: number,
): { current: SceneLayer; overlay: SceneLayer | null } | null {
  const at = sceneAt(project, lang, playheadMs);
  if (!at) return null;
  const current: SceneLayer = { ...at, opacity: 1 };
  const next = project.scenes[at.index + 1];
  if (!next) return { current, overlay: null };
  if (sceneTransitionKind(at.scene, project) !== "crossfade") return { current, overlay: null };
  const fade = Math.min(sceneTransitionMs(at.scene, project), at.durationMs);
  if (fade <= 0) return { current, overlay: null };
  const remain = at.durationMs - at.localMs;
  if (remain > fade) return { current, overlay: null };
  const t = easeInOut(1 - remain / fade);
  return {
    current,
    overlay: {
      scene: next,
      index: at.index + 1,
      localMs: 0,
      startMs: at.startMs + at.durationMs,
      durationMs: sceneDuration(next, lang, project),
      animLocalMs: 0,
      animDurationMs: sceneClock(next, lang, project).totalMs || 1,
      audioMs: null,
      phase: "openPad",
      opacity: t,
    },
  };
}

export function cueProgress(cue: Cue, progress: number): number {
  if (progress < cue.at - 0.001) return 0;
  const until = cue.until ?? 1;
  if (progress > until + 0.001) return 0;
  const span = 0.08;
  let vis = 1;
  if (cue.at > 0.001) vis = Math.min(1, Math.max(0, (progress - cue.at) / span));
  if (until < 0.999) {
    const exitStart = until - span;
    if (progress > exitStart) vis = Math.min(vis, Math.max(0, (until - progress) / span));
  }
  return vis;
}

export function cueVisible(cue: Cue, progress: number): boolean {
  const until = cue.until ?? 1;
  return progress >= cue.at - 0.001 && progress <= until + 0.001;
}

export function currentWord(words: WordTs[] | undefined, localMs: number): WordTs | null {
  if (!words?.length) return null;
  return words.find((w) => localMs >= w.startMs && localMs < w.endMs) ?? null;
}

export function currentCaption(words: WordTs[] | undefined, narration: string, localMs: number): string {
  if (!words?.length) return narration;
  const ends = /[。！？；.!?]/;
  const groups: WordTs[][] = [];
  let cur: WordTs[] = [];
  for (const w of words) {
    cur.push(w);
    if (ends.test(w.text) || cur.length >= 14) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const hit = groups.find((g) => {
    const start = g[0].startMs;
    const end = g[g.length - 1].endMs + 120;
    return localMs >= start && localMs <= end;
  });
  if (!hit) {
    if (localMs < words[0].startMs) return words.slice(0, 8).map((w) => w.text).join("");
    return words.slice(-10).map((w) => w.text).join("");
  }
  return hit.map((w) => w.text).join("");
}

export function formatMs(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
}
