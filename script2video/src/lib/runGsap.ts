import gsap from "gsap";
import type { SpeechApi } from "./speech";

function padTimeline(timeline: gsap.core.Timeline, totalS: number) {
  const need = Math.max(0.001, totalS);
  const dur = timeline.duration();
  if (dur < need) timeline.to({}, { duration: need - dur }, dur);
}

function applyPausedVars(timeline: gsap.core.Timeline, vars?: gsap.TimelineVars) {
  if (!vars?.defaults) return;
  const prev = (timeline.vars?.defaults ?? {}) as Record<string, unknown>;
  timeline.vars = { ...timeline.vars, defaults: { ...prev, ...vars.defaults } };
}

function gsapWithInjectedTimeline(injected: gsap.core.Timeline) {
  const timelineFn = (vars?: gsap.TimelineVars) => {
    if (vars?.paused === true && injected.getChildren().length === 0) {
      applyPausedVars(injected, vars);
      return injected;
    }
    return gsap.timeline(vars);
  };
  return new Proxy(gsap, {
    get(target, prop, receiver) {
      if (prop === "timeline") return timelineFn;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function runGsapScript(
  code: string,
  speech: SpeechApi,
  root: HTMLElement,
  stage?: { text: (id: string) => string; ids: () => string[] },
): { timeline: gsap.core.Timeline; revert: () => void; error?: string; sleepMs: number } {
  let timeline = gsap.timeline({ paused: true });
  const stageApi = stage ?? { text: () => "", ids: () => [] };
  try {
    const ctx = gsap.context(() => {
      timeline = gsap.timeline({ paused: true });
      const fn = new Function("speech", "gsap", "timeline", "root", "stage", `"use strict";\n${code}`);
      fn(speech, gsapWithInjectedTimeline(timeline), timeline, root, stageApi);
    }, root);
    const empty = timeline.getChildren().length === 0;
    padTimeline(timeline, speech.totalS());
    return {
      timeline,
      sleepMs: speech.sleepMs(),
      revert: () => {
        ctx.revert();
        timeline.kill();
      },
      error: empty
        ? "没有往注入的 timeline 上加动画。请用 timeline.fromTo(...)，或 gsap.timeline({paused:true})（第一个暂停轴会接到预览）。"
        : undefined,
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
