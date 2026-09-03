import type { Beat, BeatKind, DriveMode, SceneScript } from "../types";

export const DEFAULT_GAP_MS = 400;

export function driveOf(script: Pick<SceneScript, "drive">): DriveMode {
  return script.drive === "script" ? "script" : "narration";
}

export function beatKind(beat: Pick<Beat, "kind">): BeatKind {
  return beat.kind === "gap" ? "gap" : "speech";
}

export function isGapBeat(beat: Pick<Beat, "kind">): boolean {
  return beatKind(beat) === "gap";
}

export function gapMsOf(beat: Pick<Beat, "gapMs">): number {
  const n = beat.gapMs;
  return Number.isFinite(n) && (n ?? 0) > 0 ? Math.round(n as number) : DEFAULT_GAP_MS;
}

export function normalizeBeat(beat: Beat): Beat {
  if (isGapBeat(beat)) {
    return { id: beat.id, kind: "gap", text: {}, gapMs: gapMsOf(beat) };
  }
  return { ...beat, kind: "speech" };
}
