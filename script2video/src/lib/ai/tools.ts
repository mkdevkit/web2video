import { isLangId, LANGS, type LangId } from "../langs";
import { uid } from "../ids";
import { ENGINES, isEngineId, sourceOf } from "../engines";
import { DEFAULT_STAGE_HTML } from "../defaultScript";
import { STAGE_FONTS, STAGE_FONT_IDS, stageThemeOf } from "../stage";
import { emptyScript, normalizeScript } from "../../sample";
import { useStudio } from "../../store/useStudio";
import type { AspectId, Beat, EngineId, SceneScript, StageTheme } from "../../types";

export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const LANG_ENUM = LANGS.map((l) => l.id);
const ENGINE_ENUM = ENGINES.map((e) => e.id);

const beatProperties = {
  id: { type: "string", description: "口播 id，给脚本用，如 hook / fact / close。字母开头，勿用空格。" },
  text: { type: "string", description: "源语言口播文案。口语化，一句一事。" },
  i18n: {
    type: "object",
    description: "可选：各语言文案。键为 zh/en/ja/fr/de/ru/es/pt/it。省略则只写源语言。",
    additionalProperties: { type: "string" },
  },
};

const scriptSpecProperties = {
  name: { type: "string", description: "脚本短名，列表上显示" },
  engine: { type: "string", enum: ENGINE_ENUM, description: "默认 gsap" },
  beats: {
    type: "array",
    description: "按播放顺序的口播句。id 给 speech.s(id) 用。",
    items: { type: "object", properties: beatProperties, required: ["id", "text"] },
  },
  code: {
    type: "string",
    description: "当前引擎源码。GSAP/HyperFrames：paused timeline，用 speech.s/holdS/startS/sleepS，不要写死秒数，不要 play()。",
  },
  stageHtml: { type: "string", description: "本脚本舞台 DOM。画幅/字体/底色/全局 CSS 是工程级，用 set_project。" },
};

export const AI_TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "get_project",
      description: "读取工程概要：名称、语言、画幅、舞台外观、脚本列表。改之前先调用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_script",
      description: "读取一个脚本的口播、引擎、源码与节拍。",
      parameters: {
        type: "object",
        properties: {
          scriptId: { type: "string", description: "省略则读当前选中脚本" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_catalog",
      description: "列出引擎、语言、speech API 与写作规则。写 GSAP 前先看。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_project",
      description: "修改片级设置。只传要改的字段。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          sourceLang: { type: "string", enum: LANG_ENUM },
          previewLang: { type: "string", enum: LANG_ENUM },
          aspect: { type: "string", enum: ["16:9", "9:16", "1:1"] },
          stageCss: { type: "string", description: "全工程共用舞台 CSS。可用 var(--stage-color) 等。" },
          stageTheme: {
            type: "object",
            description: "全工程舞台外观",
            properties: {
              bg: { type: "string", description: "#rrggbb 底色" },
              color: { type: "string", description: "#rrggbb 字色" },
              accent: { type: "string", description: "#rrggbb 强调色" },
              fontId: { type: "string", enum: STAGE_FONT_IDS },
              titleFontId: { type: "string", enum: STAGE_FONT_IDS },
              captionFontId: { type: "string", enum: STAGE_FONT_IDS, description: "烧录/预览字幕条" },
            },
          },
          showCaptions: { type: "boolean" },
          bilingualCaptions: { type: "boolean" },
          bilingualCaptionLang: { type: "string", enum: LANG_ENUM },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_scripts",
      description: "用分镜一次性生成多个脚本（口播 + 可选画面代码）。新片用 replace；在现有片后加脚本用 append。",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["replace", "append"], description: "默认 replace" },
          projectName: { type: "string" },
          stageCss: { type: "string", description: "可选：覆盖工程级全局 CSS" },
          scripts: { type: "array", items: { type: "object", properties: scriptSpecProperties, required: ["name", "beats"] } },
        },
        required: ["scripts"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_script",
      description: "改一个脚本的名称、引擎或源码。只传要改的字段。改口播请用 manage_beats 或 apply_scripts。",
      parameters: {
        type: "object",
        properties: {
          scriptId: { type: "string" },
          name: { type: "string" },
          engine: { type: "string", enum: ENGINE_ENUM },
          code: { type: "string" },
          stageHtml: { type: "string", description: "本脚本舞台 HTML" },
        },
        required: ["scriptId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_scripts",
      description: "添加、删除、重命名、调序或选中脚本。",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "remove", "rename", "move", "select"] },
          scriptId: { type: "string" },
          name: { type: "string" },
          dir: { type: "integer", enum: [-1, 1], description: "move：-1 上移，1 下移" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_beats",
      description: "增删改当前或指定脚本的口播句。replace 会整表替换并标配音过期。",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "remove", "rename", "set_text", "replace"] },
          scriptId: { type: "string" },
          beatId: { type: "string" },
          name: { type: "string", description: "rename 的新 id" },
          text: { type: "string", description: "set_text / add 的源语言文案" },
          lang: { type: "string", enum: LANG_ENUM, description: "set_text 的语言，默认源语言" },
          beats: {
            type: "array",
            description: "replace 时的完整口播表",
            items: { type: "object", properties: beatProperties, required: ["id", "text"] },
          },
        },
        required: ["action"],
      },
    },
  },
];

function sanitizeBeatId(raw: string, used: Set<string>): string {
  let id = raw.replace(/[^\w-]/g, "").replace(/^([^a-zA-Z_])/, "_$1");
  if (!id) id = uid("b");
  let n = id;
  let i = 2;
  while (used.has(n)) {
    n = `${id}_${i}`;
    i += 1;
  }
  used.add(n);
  return n;
}

function beatFromSpec(spec: { id?: unknown; text?: unknown; i18n?: unknown }, lang: LangId, used: Set<string>): Beat {
  const id = sanitizeBeatId(String(spec.id ?? "beat"), used);
  const text: Beat["text"] = {};
  const source = typeof spec.text === "string" ? spec.text.trim() : "";
  if (source) text[lang] = source;
  if (spec.i18n && typeof spec.i18n === "object") {
    for (const [k, v] of Object.entries(spec.i18n as Record<string, unknown>)) {
      if (isLangId(k) && typeof v === "string" && v.trim()) text[k] = v.trim();
    }
  }
  return { id, text };
}

function codeFromBeats(ids: string[]): string {
  const sels = ["#title", "#stat", "#ring"];
  const lines = [
    "// 用口播 id 取时长，不要写死秒数。timeline 保持 paused，由预览 seek。",
    "const fade = 0.48;",
    "",
  ];
  ids.forEach((id, i) => {
    const sel = sels[i] ?? `#el${i + 1}`;
    lines.push(
      `timeline.fromTo("${sel}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: fade, ease: "power2.out" }, speech.startS("${id}"));`,
    );
    lines.push(`timeline.to("${sel}", { duration: speech.holdS("${id}", fade) }, speech.startS("${id}") + fade);`);
    lines.push("");
  });
  lines.push("const pause = speech.sleepS(0.4);");
  lines.push("timeline.to({}, { duration: pause }, speech.bodyS());");
  return lines.join("\n");
}

function stageHtmlFromBeats(ids: string[]): string {
  const nodes = ids.map((id, i) => {
    if (i === 0) return `<div id="title" class="clip title"></div>`;
    if (i === 1) return `<div id="stat" class="clip stat"></div>`;
    if (i === 2) return `<div id="ring" class="clip ring"></div>`;
    return `<div id="el${i + 1}" class="clip title">${id}</div>`;
  });
  return nodes.join("\n") || DEFAULT_STAGE_HTML;
}

function scriptFromSpec(spec: Record<string, unknown>, lang: LangId, fallbackHtml?: string): SceneScript {
  const used = new Set<string>();
  const rawBeats = Array.isArray(spec.beats) ? spec.beats : [];
  const beats = rawBeats.map((b, i) => {
    const row = b && typeof b === "object" ? (b as { id?: unknown; text?: unknown; i18n?: unknown }) : {};
    return beatFromSpec({ ...row, id: row.id ?? `beat${i + 1}` }, lang, used);
  });
  const ids = beats.map((b) => b.id);
  const engine: EngineId = isEngineId(spec.engine) ? spec.engine : "gsap";
  const draft = emptyScript(String(spec.name ?? "未命名脚本").trim() || "未命名脚本");
  const code = typeof spec.code === "string" && spec.code.trim() ? spec.code : codeFromBeats(ids.length ? ids : ["hook"]);
  const html =
    typeof spec.stageHtml === "string" && spec.stageHtml.trim()
      ? spec.stageHtml
      : fallbackHtml?.trim() || stageHtmlFromBeats(ids.length ? ids : ["hook"]);
  return normalizeScript({
    ...draft,
    id: uid("sc"),
    engine,
    beats: beats.length ? beats : draft.beats,
    events: [],
    holdMs: 0,
    code,
    sources: { ...draft.sources, [engine]: code },
    stageHtml: html,
  });
}

function dumpScript(scriptId?: string) {
  const s = useStudio.getState();
  const script = s.project.scripts.find((x) => x.id === (scriptId || s.scriptId));
  if (!script) return { error: "找不到脚本" };
  const lang = s.project.sourceLang;
  return {
    id: script.id,
    name: script.name,
    engine: script.engine ?? "gsap",
    holdMs: script.holdMs ?? 0,
    beats: script.beats.map((b) => ({
      id: b.id,
      text: b.text[lang] ?? "",
      langs: Object.fromEntries(Object.entries(b.text).filter(([, t]) => (t ?? "").trim())),
    })),
    code: sourceOf(script),
    stageHtml: script.stageHtml ?? "",
  };
}

function staleAll(script: SceneScript): SceneScript["audioByLang"] {
  const audioByLang = { ...(script.audioByLang ?? {}) };
  for (const lang of Object.keys(audioByLang)) {
    if (!isLangId(lang)) continue;
    const clip = audioByLang[lang];
    if (clip) audioByLang[lang] = { ...clip, stale: true };
  }
  return audioByLang;
}

function ok(data: unknown) {
  return JSON.stringify(data);
}

function fail(message: string) {
  return JSON.stringify({ error: message });
}

export function executeTool(name: string, rawArgs: unknown): string {
  try {
    const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
    const store = useStudio.getState();
    const lang = store.project.sourceLang;

    if (name === "get_project") {
      const p = store.project;
      return ok({
        name: p.name,
        sourceLang: p.sourceLang,
        previewLang: p.previewLang,
        aspect: p.aspect ?? "16:9",
        currentScriptId: store.scriptId,
        showCaptions: Boolean(p.showCaptions),
        bilingualCaptions: Boolean(p.bilingualCaptions),
        bilingualCaptionLang: p.bilingualCaptionLang ?? null,
        stageTheme: stageThemeOf(p.stageTheme),
        stageCss: p.stageCss ?? "",
        voices: p.voices.map((v) => ({ id: v.id, name: v.name, gender: v.gender })),
        scripts: p.scripts.map((sc) => ({
          id: sc.id,
          name: sc.name,
          engine: sc.engine ?? "gsap",
          beats: sc.beats.map((b) => b.id),
          firstLine: (sc.beats[0]?.text[lang] ?? "").slice(0, 80),
        })),
      });
    }

    if (name === "get_script") {
      return ok(dumpScript(typeof args.scriptId === "string" ? args.scriptId : undefined));
    }

    if (name === "list_catalog") {
      return ok({
        engines: ENGINES.map((e) => ({ id: e.id, label: e.label, hint: e.hint })),
        langs: LANGS.map((l) => ({ id: l.id, label: l.label })),
        speech: {
          "speech.s(id)": "这一句配音有多长（秒）。这一段画面总时长用它。",
          "speech.startS(id)": "这一句口播从哪一秒开始（不含 sleep）。",
          "speech.endS(id)": "这一句口播哪一秒结束。",
          "speech.holdS(id, fade)": "s(id) − fade。入场固定 fade；剩下的时间画面停住直到这句说完。",
          "speech.sleepS(n)": "暂停。每次调用把 n 秒加进全长并返回 n。可多次。totalS = bodyS + Σ sleepS。",
          "speech.bodyS()": "各句口播之和，不含暂停。",
          "speech.totalS()": "全长 = bodyS + 所有 sleepS。写在全部 sleepS 之后。",
          "speech.text(id)": "当前预览语言的口播文案，可写进 DOM。",
        },
        notes: {
          clock: "不要写死 3 秒。入场用固定秒；换语言只换 TTS。",
          gsap: "timeline 已 paused。不要 play()。预览和导出 seek。",
          stage: "每个脚本自己的 stageHtml。画幅/字体/底色/stageCss 是工程级。HTML 里用 #title 等选择器。",
          fonts: "舞台与字幕字体均为 SIL OFL，免费可商用。字幕条用 captionFontId。中日文不足时回落 Noto CJK。",
          sleep: "startS/endS 不含暂停。句间留白要把后面的起点加上这段 sleep。",
          tts: "密钥和配音合成不用你处理。改口播后配音会过期，用户自己点配音。",
        },
        fonts: STAGE_FONTS.map((f) => ({ id: f.id, label: f.label, langs: f.langs, hint: f.hint, license: f.license })),
      });
    }

    if (name === "set_project") {
      const patch: Record<string, unknown> = {};
      if (typeof args.name === "string" && args.name.trim()) patch.name = args.name.trim();
      if (isLangId(String(args.sourceLang ?? ""))) patch.sourceLang = args.sourceLang;
      if (isLangId(String(args.previewLang ?? ""))) patch.previewLang = args.previewLang;
      if (args.aspect === "16:9" || args.aspect === "9:16" || args.aspect === "1:1") patch.aspect = args.aspect as AspectId;
      if (typeof args.stageCss === "string") patch.stageCss = args.stageCss;
      if (args.stageTheme && typeof args.stageTheme === "object") {
        patch.stageTheme = stageThemeOf({ ...store.project.stageTheme, ...(args.stageTheme as Partial<StageTheme>) });
      }
      if (typeof args.showCaptions === "boolean") patch.showCaptions = args.showCaptions;
      if (typeof args.bilingualCaptions === "boolean") patch.bilingualCaptions = args.bilingualCaptions;
      if (isLangId(String(args.bilingualCaptionLang ?? ""))) patch.bilingualCaptionLang = args.bilingualCaptionLang;
      if (!Object.keys(patch).length) return fail("没有可更新的字段");
      store.patchProject(patch);
      return ok({ ok: true, patch: Object.keys(patch) });
    }

    if (name === "apply_scripts") {
      const list = Array.isArray(args.scripts) ? args.scripts : [];
      if (!list.length) return fail("scripts 为空");
      const sharedHtml = typeof args.stageHtml === "string" ? args.stageHtml : undefined;
      const built = list.map((spec, i) => {
        if (!spec || typeof spec !== "object") throw new Error(`scripts[${i}] 无效`);
        return scriptFromSpec(spec as Record<string, unknown>, lang, sharedHtml);
      });
      if (typeof args.projectName === "string" && args.projectName.trim()) {
        store.patchProject({ name: args.projectName.trim() });
      }
      if (typeof args.stageCss === "string") store.patchProject({ stageCss: args.stageCss });
      const mode = args.mode === "append" ? "append" : "replace";
      const project = useStudio.getState().project;
      const scripts = mode === "append" ? [...project.scripts, ...built] : built;
      store.setProject({ ...project, scripts });
      store.selectScript(built[0].id);
      return ok({
        ok: true,
        mode,
        count: built.length,
        scripts: built.map((sc) => ({ id: sc.id, name: sc.name, engine: sc.engine, beats: sc.beats.map((b) => b.id) })),
      });
    }

    if (name === "update_script") {
      const scriptId = String(args.scriptId ?? "");
      const script = store.project.scripts.find((x) => x.id === scriptId);
      if (!script) return fail("找不到脚本");
      if (typeof args.name === "string" && args.name.trim()) store.patchScript(scriptId, { name: args.name.trim() });
      if (isEngineId(args.engine)) store.setScriptEngine(scriptId, args.engine);
      if (typeof args.code === "string") store.patchScriptSource(scriptId, args.code);
      if (typeof args.stageHtml === "string") store.patchScript(scriptId, { stageHtml: args.stageHtml });
      return ok({ ok: true, script: dumpScript(scriptId) });
    }

    if (name === "manage_scripts") {
      const action = String(args.action ?? "");
      const scriptId = typeof args.scriptId === "string" ? args.scriptId : store.scriptId;
      if (action === "add") {
        store.addScript();
        const id = useStudio.getState().scriptId;
        if (typeof args.name === "string" && args.name.trim()) store.patchScript(id, { name: args.name.trim() });
        return ok({ ok: true, scriptId: id });
      }
      if (action === "remove") {
        if (store.project.scripts.length <= 1) return fail("至少保留一个脚本");
        store.removeScript(scriptId);
        return ok({ ok: true, currentScriptId: useStudio.getState().scriptId });
      }
      if (action === "rename") {
        const name = String(args.name ?? "").trim();
        if (!name) return fail("缺少 name");
        store.patchScript(scriptId, { name });
        return ok({ ok: true });
      }
      if (action === "move") {
        const dir = args.dir === -1 || args.dir === 1 ? args.dir : 1;
        store.moveScript(scriptId, dir);
        return ok({ ok: true });
      }
      if (action === "select") {
        store.selectScript(scriptId);
        return ok({ ok: true, currentScriptId: scriptId });
      }
      return fail("未知 action");
    }

    if (name === "manage_beats") {
      const action = String(args.action ?? "");
      const scriptId = typeof args.scriptId === "string" ? args.scriptId : store.scriptId;
      const script = store.project.scripts.find((x) => x.id === scriptId);
      if (!script) return fail("找不到脚本");
      if (action === "replace") {
        const list = Array.isArray(args.beats) ? args.beats : [];
        if (!list.length) return fail("beats 为空");
        const used = new Set<string>();
        const beats = list.map((b, i) => {
          const row = b && typeof b === "object" ? (b as { id?: unknown; text?: unknown; i18n?: unknown }) : {};
          return beatFromSpec({ ...row, id: row.id ?? `beat${i + 1}` }, lang, used);
        });
        const keep = new Set(beats.map((b) => b.id));
        store.patchScript(scriptId, {
          beats,
          events: script.events.filter((e) => keep.has(e.beatId)),
          audioByLang: staleAll(script),
        });
        return ok({ ok: true, beats: beats.map((b) => b.id) });
      }
      if (action === "add") {
        const used = new Set(script.beats.map((b) => b.id));
        const beat = beatFromSpec({ id: args.beatId ?? args.name, text: args.text }, lang, used);
        store.patchScript(scriptId, { beats: [...script.beats, beat], audioByLang: staleAll(script) });
        return ok({ ok: true, beatId: beat.id });
      }
      const beatId = String(args.beatId ?? "");
      if (!beatId) return fail("缺少 beatId");
      if (action === "remove") {
        if (script.beats.length < 2) return fail("至少保留一句");
        store.removeBeat(scriptId, beatId);
        return ok({ ok: true });
      }
      if (action === "rename") {
        store.renameBeat(scriptId, beatId, String(args.name ?? ""));
        return ok({ ok: true });
      }
      if (action === "set_text") {
        const text = String(args.text ?? "");
        const target = isLangId(String(args.lang ?? "")) ? (args.lang as LangId) : lang;
        const beat = script.beats.find((b) => b.id === beatId);
        if (!beat) return fail("找不到该句");
        store.patchBeat(scriptId, beatId, { text: { ...beat.text, [target]: text } });
        return ok({ ok: true });
      }
      return fail("未知 action");
    }

    return fail(`未知工具 ${name}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "工具执行失败");
  }
}

export const SYSTEM_PROMPT = `你是 Script2Video 的分镜助手。这是本地口播脚本工作台：多脚本、多语言口播、GSAP/HyperFrames/Remotion/Manim，画面跟节拍走。

时钟：
- speech.s("hook") 是这一句配音有多长，这一段画面总时长用它，不要写死 3。
- speech.startS / endS 是口播轴上的起止，不含 sleep。
- 入场用固定秒（各语言一样快）。holdS(id, fade) = s(id) − fade，画面停到这句说完。
- sleepS(n) 是暂停，可多次，每次加进全长。totalS = bodyS + Σ sleepS。
- 不要整条时间轴 timeScale。不要 timeline.play()。

舞台与代码：
- 每个脚本自己的舞台 HTML（DOM，不是 canvas）。GSAP 只写 paused timeline。
- 画幅、字体、底色、全局 CSS 是工程级，用 set_project（stageTheme / stageCss / aspect）。
- 舞台字体均为 SIL OFL（免费可商用）。fontId / titleFontId / captionFontId 用 list_catalog.fonts 里的 id。字幕条烧录到画面时走 captionFontId。中日文不足会回落 Noto CJK。
- 画面文案可用 speech.text(id) 写进 DOM。
- Remotion / Manim 工作台里是节拍卡；仍把口播写进 beats，code 可留草稿。

写作：
- 口播口语化，一句一事。每句一个稳定 id（hook / fact / close 或英文短词）。
- 整片重做：apply_scripts mode=replace，每个脚本给出 stageHtml 与 GSAP code。
- 加一段：mode=append，或 manage_scripts add。
- 改现有工程先 get_project / get_script，再 update_script / manage_beats。
- 密钥、翻译、TTS、导出不用你处理。
- 用中文回复用户，简短说明做了什么。`;
