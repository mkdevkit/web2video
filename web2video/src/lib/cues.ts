import type { Cue, CueBind, CueStay, Project, Scene } from "../types";
import type { LangId } from "./langs";
import { beatSpansForScene, speakText, type BeatSpan } from "./narration";
import { sceneClock, type SceneClock } from "./timeline";

export function bodyBeatSpans(scene: Scene, lang: LangId, source: LangId): BeatSpan[] {
  return beatSpansForScene(scene, lang, source);
}

export function cueBind(cue: Cue, scene: Scene, source: LangId): CueBind {
  if (cue.bind === "speak" || cue.bind === "visual") return cue.bind;
  if (speakText(scene, cue.target, source, source).trim()) return "speak";
  return "visual";
}

export function cueStay(cue: Cue): CueStay {
  return cue.stay === "speech" ? "speech" : "body";
}

export function resolveCue(cue: Cue, clock: SceneClock, bodySpans: BeatSpan[], scene: Scene, source: LangId): Cue {
  const until = cue.until ?? 1;
  if (cueBind(cue, scene, source) !== "speak") return { ...cue, at: cue.at, until };
  const span = bodySpans.find((s) => s.target === cue.target);
  if (!span) return { ...cue, at: cue.at, until };
  const bodyMs = Math.max(1, clock.bodyMs);
  const beatStart = span.startMs - clock.audioBodyStartMs;
  const beatEnd = span.endMs - clock.audioBodyStartMs;
  const lead = cue.leadMs ?? 0;
  const trail = Math.max(0, cue.trailMs ?? 0);
  const at = Math.min(0.98, Math.max(0, (beatStart - lead) / bodyMs));
  const end = cueStay(cue) === "speech" ? (beatEnd + trail) / bodyMs : 1;
  return { ...cue, at, until: Math.min(1, Math.max(at + 0.02, end)) };
}

export function resolveCueOnScene(cue: Cue, scene: Scene, lang: LangId, source: LangId, project: Project): Cue {
  const clock = sceneClock(scene, lang, project);
  return resolveCue(cue, clock, bodyBeatSpans(scene, lang, source), scene, source);
}

export function applyResolvedCueRange(
  scene: Scene,
  cue: Cue,
  at: number,
  until: number,
  lang: LangId,
  source: LangId,
  project: Project,
): Cue {
  const a = Math.min(0.98, Math.max(0, at));
  const u = Math.min(1, Math.max(a + 0.02, until));
  if (cueBind(cue, scene, source) !== "speak") {
    return { ...cue, bind: "visual", at: a, until: u };
  }
  const clock = sceneClock(scene, lang, project);
  const span = bodyBeatSpans(scene, lang, source).find((s) => s.target === cue.target);
  if (!span) return { ...cue, bind: "speak", at: a, until: u };
  const bodyMs = Math.max(1, clock.bodyMs);
  const beatStart = span.startMs - clock.audioBodyStartMs;
  const beatEnd = span.endMs - clock.audioBodyStartMs;
  const leadMs = Math.round(beatStart - a * bodyMs);
  const stay: CueStay = u >= 0.975 ? "body" : "speech";
  const trailMs = stay === "speech" ? Math.round(Math.max(0, u * bodyMs - beatEnd)) : 0;
  return { ...cue, bind: "speak", at: a, until: u, leadMs, trailMs, stay };
}

export function bakeCueBind(
  scene: Scene,
  cue: Cue,
  bind: CueBind,
  lang: LangId,
  source: LangId,
  project: Project,
): Cue {
  const resolved = resolveCueOnScene(cue, scene, lang, source, project);
  if (bind === "visual") {
    return { ...cue, bind: "visual", at: resolved.at, until: resolved.until };
  }
  const clock = sceneClock(scene, lang, project);
  const span = bodyBeatSpans(scene, lang, source).find((s) => s.target === cue.target);
  if (!span) return { ...cue, bind: "speak", at: resolved.at, until: resolved.until };
  const bodyMs = Math.max(1, clock.bodyMs);
  const beatStart = span.startMs - clock.audioBodyStartMs;
  const beatEnd = span.endMs - clock.audioBodyStartMs;
  const leadMs = Math.round(beatStart - resolved.at * bodyMs);
  const stay: CueStay = resolved.until >= 0.975 ? "body" : "speech";
  const trailMs = stay === "speech" ? Math.round(Math.max(0, resolved.until * bodyMs - beatEnd)) : 0;
  return { ...cue, bind: "speak", leadMs, trailMs, stay, at: resolved.at, until: resolved.until };
}

export function cueKeyProgress(sceneProgress: number, cue: Cue | undefined): number {
  if (!cue) return sceneProgress;
  const until = cue.until ?? 1;
  return (sceneProgress - cue.at) / Math.max(0.0001, until - cue.at);
}
