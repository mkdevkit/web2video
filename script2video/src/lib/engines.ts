import type { EngineId, SceneScript } from "../types";
import { DEFAULT_CODE } from "./defaultScript";

export const ENGINES = [
  {
    id: "gsap" as const,
    label: "GSAP",
    hint: "本机舞台：paused timeline，预览/导出 seek",
    preview: "gsap" as const,
  },
  {
    id: "hyperframes" as const,
    label: "HyperFrames",
    hint: "HTML 合成 + GSAP，框架 seek，不要 play()",
    preview: "gsap" as const,
  },
  {
    id: "remotion" as const,
    label: "Remotion",
    hint: "durationInFrames 由口播算出；本机导出为节拍卡",
    preview: "card" as const,
  },
  {
    id: "manim" as const,
    label: "Manim",
    hint: "FadeIn 固定 run_time，多余口播 wait()；本机导出为节拍卡",
    preview: "card" as const,
  },
];

export type EnginePreview = (typeof ENGINES)[number]["preview"];

const ENGINE_IDS = new Set<string>(ENGINES.map((e) => e.id));

export function isEngineId(v: unknown): v is EngineId {
  return typeof v === "string" && ENGINE_IDS.has(v);
}

export function engineOf(script: { engine?: EngineId }): EngineId {
  return isEngineId(script.engine) ? script.engine : "gsap";
}

export function engineMeta(id: EngineId) {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[0];
}

export function usesGsapPreview(script: { engine?: EngineId }): boolean {
  return engineMeta(engineOf(script)).preview === "gsap";
}

export const DEFAULT_SOURCES: Record<EngineId, string> = {
  gsap: DEFAULT_CODE,
  hyperframes: `// HyperFrames 会 seek 这条 paused timeline，不要 timeline.play()。
// 时长跟口播走：speech.s("hook") / speech.holdS("hook", fade)

${DEFAULT_CODE}`,
  remotion: `/**
 * Remotion 构图草稿。durationInFrames 必须来自口播，不要写死 150。
 * 拷到 Remotion 项目，配合 engines/remotion/NarratedScene.ts：
 *
 *   durationInFrames = round((bodyS + Σ sleepS) * fps)
 *   每次 speech.sleepS(n) 加一段暂停；clock.sleep_ms 是合计
 *
 *   const { fps } = useVideoConfig();
 *   const frame = useCurrentFrame();
 *   const { live, localMs } = remotionClock(script, audio, frame, fps);
 *
 * 工作台里预览/导出按口播时长显示节拍卡；完整画面用 Remotion 渲染该段。
 */
`,
  manim: `"""Manim 草稿。run_time 来自时钟 JSON，不要写死秒数。

FadeIn 保持固定时长；句内多余口播 wait()；暂停多次 self.wait(n)，
对应多次 speech.sleepS；clock.sleep_ms 是合计。见 engines/manim/narrated_scene.py

工作台里预览/导出按口播时长显示节拍卡；完整画面用 Manim 渲染该段。
"""
`,
};

export function sourceOf(script: SceneScript): string {
  const engine = engineOf(script);
  const fromMap = script.sources?.[engine];
  if (fromMap != null && fromMap !== "") return fromMap;
  if ((engine === "gsap" || engine === "hyperframes") && (script.code ?? "").trim()) return script.code ?? "";
  return DEFAULT_SOURCES[engine];
}

export function patchSource(script: SceneScript, text: string): Pick<SceneScript, "code" | "sources"> {
  const engine = engineOf(script);
  return {
    code: text,
    sources: { ...script.sources, [engine]: text },
  };
}

export function switchEngine(script: SceneScript, next: EngineId): Pick<SceneScript, "engine" | "code" | "sources"> {
  const prev = engineOf(script);
  const sources: NonNullable<SceneScript["sources"]> = {
    ...script.sources,
    [prev]: script.code ?? script.sources?.[prev] ?? sourceOf(script),
  };
  let nextCode = sources[next];
  if (nextCode == null || nextCode === "") {
    if (next === "hyperframes" && (sources.gsap ?? "").trim()) nextCode = sources.gsap;
    else if (next === "gsap" && (sources.hyperframes ?? "").trim()) nextCode = sources.hyperframes;
    else nextCode = DEFAULT_SOURCES[next];
  }
  return { engine: next, code: nextCode, sources: { ...sources, [next]: nextCode } };
}
