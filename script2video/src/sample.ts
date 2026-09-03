import type { EngineId, Project, SceneScript } from "./types";
import { durationsFromEstimate } from "./lib/clock";
import { DEFAULT_CODE } from "./lib/defaultScript";
import { DEFAULT_STAGE_CSS, DEFAULT_STAGE_HTML, DEFAULT_STAGE_THEME, stageThemeOf } from "./lib/stage";
import { DEFAULT_SOURCES, isEngineId } from "./lib/engines";
import type { LangAudio } from "./types";

export const sampleScript: SceneScript = {
  id: "black-hole",
  name: "黑洞不是洞",
  holdMs: 400,
  engine: "gsap",
  code: DEFAULT_CODE,
  sources: { gsap: DEFAULT_CODE },
  stageHtml: DEFAULT_STAGE_HTML,
  beats: [
    {
      id: "hook",
      text: {
        zh: "黑洞，并不是宇宙里的一个洞。",
        en: "A black hole is not a hole in space.",
        ja: "ブラックホールは、宇宙に開いた穴ではありません。",
      },
    },
    {
      id: "fact",
      text: {
        zh: "它是质量大到连光都逃不出去的天体。",
        en: "It is an object so massive that even light cannot escape.",
        ja: "光さえも逃げ出せないほど質量が大きい天体です。",
      },
    },
    {
      id: "close",
      text: {
        zh: "所以我们看到的，其实是它的边界。",
        en: "What we see is only its boundary.",
        ja: "私たちが見ているのは、その境界だけです。",
      },
    },
  ],
  events: [
    { id: "title-in", label: "标题入场", bind: "fixed", beatId: "hook", at: 0, durationMs: 480 },
    { id: "title-hold", label: "标题停留", bind: "speech", beatId: "hook", at: 0, until: 1 },
    { id: "stat-in", label: "数据入场", bind: "fixed", beatId: "fact", at: 0, durationMs: 420 },
    { id: "stat-hold", label: "数据停留", bind: "speech", beatId: "fact", at: 0.15, until: 1 },
    { id: "ring-in", label: "视界圈入场", bind: "fixed", beatId: "close", at: 0, durationMs: 500 },
    { id: "ring-hold", label: "视界圈停留", bind: "speech", beatId: "close", at: 0, until: 1 },
  ],
};

export const sampleAudio: LangAudio[] = (["zh", "en", "ja"] as const).map((lang) => ({
  lang,
  beatMs: durationsFromEstimate(sampleScript, lang),
}));

export const DEFAULT_PROJECT_NAME = "未命名工程";

export function emptyScript(name = "未命名脚本"): SceneScript {
  return {
    id: `sc_${Math.random().toString(36).slice(2, 8)}`,
    name,
    holdMs: 400,
    engine: "gsap",
    stageHtml: DEFAULT_STAGE_HTML,
    beats: [{ id: "hook", text: { zh: "" } }],
    events: [],
    code: DEFAULT_CODE,
    sources: { gsap: DEFAULT_CODE },
  };
}

export function normalizeScript(s: SceneScript): SceneScript {
  const engine: EngineId = isEngineId(s.engine) ? s.engine : "gsap";
  const sources: NonNullable<SceneScript["sources"]> = { ...(s.sources ?? {}) };
  if ((s.code ?? "").trim() && !sources[engine]) sources[engine] = s.code;
  if ((s.code ?? "").trim() && !sources.gsap && engine === "gsap") sources.gsap = s.code;
  const code = sources[engine] ?? s.code ?? DEFAULT_SOURCES[engine];
  return {
    id: s.id,
    name: s.name,
    beats: s.beats?.length ? s.beats : [{ id: "hook", text: {} }],
    events: s.events ?? [],
    engine,
    sources: { ...sources, [engine]: code },
    code,
    holdMs: s.holdMs ?? 0,
    audioByLang: s.audioByLang,
    stageHtml: (s.stageHtml ?? "").trim() || DEFAULT_STAGE_HTML,
  };
}

export function normalizeProject(p: Project & { stageHtml?: string }): Project {
  const legacyHtml = (p.stageHtml ?? "").trim();
  const scripts = (p.scripts ?? []).map((s) =>
    normalizeScript({
      ...s,
      stageHtml: (s.stageHtml ?? "").trim() || legacyHtml || DEFAULT_STAGE_HTML,
    }),
  );
  const { stageHtml: _drop, ...rest } = p;
  return {
    ...rest,
    scripts,
    aspect: p.aspect ?? "16:9",
    stageTheme: stageThemeOf(p.stageTheme),
    stageCss: typeof p.stageCss === "string" && p.stageCss.trim() ? p.stageCss : DEFAULT_STAGE_CSS,
  };
}

export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text) as Project;
  if (!data || typeof data !== "object") throw new Error("不是有效的 Script2Video 工程");
  if (!Array.isArray(data.scripts) || !data.scripts.length) throw new Error("工程里没有脚本");
  return normalizeProject(data);
}

export const sampleProject: Project = {
  name: "黑洞不是洞",
  sourceLang: "zh",
  previewLang: "zh",
  voices: [],
  aspect: "16:9",
  showCaptions: true,
  bilingualCaptions: true,
  bilingualCaptionLang: "en",
  stageTheme: DEFAULT_STAGE_THEME,
  stageCss: DEFAULT_STAGE_CSS,
  scripts: [sampleScript],
};
