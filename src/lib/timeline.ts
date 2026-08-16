import type { LangId } from "./langs";
import type { Cue, Project, Scene, WordTs } from "../types";

export const FALLBACK_DURATION_MS = 5000;

export function sceneDuration(scene: Scene, lang: LangId): number {
  const audio = scene.audioByLang?.[lang];
  if (audio?.durationMs && !audio.stale) return audio.durationMs;
  const text = scene.narration.i18n[lang] || Object.values(scene.narration.i18n).find(Boolean) || "";
  if (text.trim()) return Math.max(3000, Math.min(20_000, text.trim().length * 180));
  return FALLBACK_DURATION_MS;
}

export function sceneStarts(scenes: Scene[], lang: LangId): number[] {
  let t = 0;
  return scenes.map((s) => {
    const start = t;
    t += sceneDuration(s, lang);
    return start;
  });
}

export function totalDuration(project: Project, lang: LangId): number {
  return project.scenes.reduce((sum, s) => sum + sceneDuration(s, lang), 0);
}

export function sceneAt(
  project: Project,
  lang: LangId,
  playheadMs: number,
): { scene: Scene; index: number; localMs: number; startMs: number; durationMs: number } | null {
  if (!project.scenes.length) return null;
  const starts = sceneStarts(project.scenes, lang);
  for (let i = 0; i < project.scenes.length; i++) {
    const durationMs = sceneDuration(project.scenes[i], lang);
    const end = starts[i] + durationMs;
    if (playheadMs < end || i === project.scenes.length - 1) {
      const scene = project.scenes[i];
      return {
        scene,
        index: i,
        startMs: starts[i],
        durationMs,
        localMs: Math.max(0, Math.min(durationMs, playheadMs - starts[i])),
      };
    }
  }
  return null;
}

export function cueProgress(cue: Cue, progress: number): number {
  if (progress < cue.at) return 0;
  const until = cue.until ?? 1;
  if (progress > until) return 0;
  const span = 0.08;
  const enter = Math.min(1, (progress - cue.at) / span);
  const exitStart = until - span;
  if (progress > exitStart) return Math.max(0, (until - progress) / span);
  return enter;
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
