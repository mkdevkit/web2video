/**
 * Remotion adapter — this package does not install @remotion/*.
 * Copy the clock helpers into a Remotion composition:
 *
 *   const { fps } = useVideoConfig();
 *   const frame = useCurrentFrame();
 *   const { live, localMs } = remotionClock(script, audio, frame, fps);
 *
 * durationInFrames must come from TTS, not a hardcoded 150.
 */
import { eventAt, mapEvents, progressIn, sceneDurationMs } from "../../src/clock";
import type { LangAudio, MappedEvent, SceneScript } from "../../src/types";

export const FPS = 30;

export function durationInFrames(script: SceneScript, audio: LangAudio, fps = FPS): number {
  return Math.max(1, Math.round((sceneDurationMs(script, audio) / 1000) * fps));
}

export function remotionClock(
  script: SceneScript,
  audio: LangAudio,
  frame: number,
  fps = FPS,
): { localMs: number; events: MappedEvent[]; live: MappedEvent[] } {
  const localMs = (frame / fps) * 1000;
  const events = mapEvents(script, audio);
  return { localMs, events, live: eventAt(events, localMs) };
}

export function eventProgress(ev: MappedEvent, localMs: number): number {
  return progressIn(ev, localMs);
}

export function clockJson(script: SceneScript, audio: LangAudio) {
  return {
    durationInFrames: durationInFrames(script, audio),
    durationMs: sceneDurationMs(script, audio),
    events: mapEvents(script, audio),
  };
}
