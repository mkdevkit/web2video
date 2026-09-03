import gsap from "gsap";
import type { SpeechApi } from "./speech";

function padTimeline(timeline: gsap.core.Timeline, totalS: number) {
  const need = Math.max(0.001, totalS);
  const dur = timeline.duration();
  if (dur < need) timeline.to({}, { duration: need - dur }, dur);
}

export function runGsapScript(
  code: string,
  speech: SpeechApi,
  root: HTMLElement,
): { timeline: gsap.core.Timeline; revert: () => void; error?: string; sleepMs: number } {
  const timeline = gsap.timeline({ paused: true });
  try {
    const ctx = gsap.context(() => {
      const fn = new Function("speech", "gsap", "timeline", "root", `"use strict";\n${code}`);
      fn(speech, gsap, timeline, root);
    }, root);
    padTimeline(timeline, speech.totalS());
    return {
      timeline,
      sleepMs: speech.sleepMs(),
      revert: () => {
        ctx.revert();
        timeline.kill();
      },
    };
  } catch (e) {
    timeline.kill();
    const fallback = gsap.timeline({ paused: true });
    padTimeline(fallback, speech.totalS());
    return {
      timeline: fallback,
      sleepMs: speech.sleepMs(),
      revert: () => undefined,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
