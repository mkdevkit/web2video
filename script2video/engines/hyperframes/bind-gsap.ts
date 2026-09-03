import gsap from "gsap";
import { mapEvents, sceneDurationMs } from "../../src/clock";
import type { LangAudio, SceneScript } from "../../src/types";

/**
 * HyperFrames owns the playhead: one paused timeline, never play().
 * Duration comes from TTS; tweens are placed in real seconds after mapping.
 */
export function bindGsapTimeline(
  script: SceneScript,
  audio: LangAudio,
  targets: Record<string, Element | string>,
): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const total = sceneDurationMs(script, audio) / 1000;
  tl.to({}, { duration: total }, 0);
  for (const ev of mapEvents(script, audio)) {
    const el = targets[ev.id];
    if (!el) continue;
    const start = ev.startMs / 1000;
    const dur = Math.max(0.08, (ev.endMs - ev.startMs) / 1000);
    if (ev.id.endsWith("-in")) {
      tl.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: dur, ease: "power2.out" }, start);
    } else {
      tl.set(el, { opacity: 1 }, start);
    }
  }
  return tl;
}

declare global {
  interface Window {
    __timelines?: Record<string, gsap.core.Timeline>;
  }
}

export function registerHyperframes(id: string, tl: gsap.core.Timeline) {
  window.__timelines = window.__timelines ?? {};
  window.__timelines[id] = tl;
}
