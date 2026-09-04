import { isLangId, LANGS, type LangId } from "../langs";
import { uid } from "../ids";
import { ENGINES, isEngineId, sourceOf } from "../engines";
import { DEFAULT_STAGE_HTML } from "../defaultScript";
import { STAGE_FONTS, STAGE_FONT_IDS, stageThemeOf } from "../stage";
import { emptyScript, normalizeScript } from "../../sample";
import { useStudio } from "../../store/useStudio";
import type { AspectId, Beat, EngineId, SceneScript, StageTheme } from "../../types";
import { DEFAULT_GAP_MS, isGapBeat } from "../beats";
import { syncStageTexts } from "../stageText";

export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** In-app AI. Keep in sync with skill/script2video 字体. */
export const FONT_POLICY =
  "成片字体必须免费可商用。舞台/字幕只用 list_catalog.fonts 的 id（均为 SIL OFL，字文件随工具打包，不请求 Google Fonts）。baseFontId（HTML 未写 font-family 时）/ fontId（正文）/ titleFontId / captionFontId。CSS 用 var(--stage-base-font)、var(--stage-font)、var(--stage-title-font)、var(--stage-caption-font) 或 inherit。禁止在 stageHtml/stageCss 写 Arial、微软雅黑、PingFang、Hiragino、Times、system-ui、sans-serif、serif。不要发明目录外字体名。KaTeX_* 同样 SIL OFL。嵌进视频可以，不要把字体文件单独拿去卖。";

const LANG_ENUM = LANGS.map((l) => l.id);
const ENGINE_ENUM = ENGINES.map((e) => e.id);

const beatProperties = {
  id: { type: "string", description: "口播 id，给脚本用，如 hook / fact / close。字母开头，勿用空格。" },
  kind: { type: "string", enum: ["speech", "gap"], description: "speech 为台词；gap 为延时行，只有时长。" },
  text: { type: "string", description: "源语言口播文案。口语化，一句一事。gap 行不要填。" },
  gapMs: { type: "number", description: "延时行时长（毫秒），跨语言相同。默认 400。" },
  roleId: { type: "string", description: "配音角色 VoiceProfile.id，见 get_project.voices。省略用该语言默认。" },
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
    description: "当前引擎源码。GSAP/HyperFrames：paused timeline，用 speech.s/holdS/startS。脚本驱动用 speech.play(id)。不要写死秒数，不要 timeline.play()。",
  },
  stageHtml: { type: "string", description: "本脚本舞台 DOM。字体用 inherit 或 var(--stage-*)，禁止 Arial/微软雅黑/system-ui/sans-serif。有字的节点会出现在文本页。画幅/字体/底色/全局 CSS 是工程级，用 set_project。" },
};

export const AI_TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "get_project",
      description: "读取工程概要：名称、语言、画幅、舞台外观、配音角色、脚本列表。改之前先调用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_script",
      description: "读取一个脚本的口播、画面文案 stageTexts、引擎、源码与节拍。",
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
      description: "列出引擎、语言、speech API、字体约束（SIL OFL，禁止系统字体）与写作规则。写 GSAP 前先看。",
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
          stageCss: { type: "string", description: "全工程共用舞台 CSS。字体用 var(--stage-font) 等，禁止 Arial/微软雅黑/system-ui/sans-serif。" },
          stageTheme: {
            type: "object",
            description: "全工程舞台外观。字体 id 仅 list_catalog（SIL OFL，随工具打包）",
            properties: {
              bg: { type: "string", description: "#rrggbb 底色" },
              color: { type: "string", description: "#rrggbb 字色" },
              accent: { type: "string", description: "#rrggbb 强调色" },
              fontId: { type: "string", enum: STAGE_FONT_IDS, description: "正文字体 var(--stage-font)。仅目录 SIL OFL id，默认 noto-sans" },
              titleFontId: { type: "string", enum: STAGE_FONT_IDS, description: "标题字体 var(--stage-title-font)。默认 noto-serif" },
              baseFontId: { type: "string", enum: STAGE_FONT_IDS, description: "默认舞台字体 var(--stage-base-font)：HTML 没写 font-family 时用。缺省跟 fontId" },
              captionFontId: { type: "string", enum: STAGE_FONT_IDS, description: "字幕条。仅目录 id，禁止系统字体" },
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
          stageCss: { type: "string", description: "可选：覆盖工程级全局 CSS。字体用 var(--stage-*)，禁止系统字体名" },
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
          drive: { type: "string", enum: ["narration", "script"], description: "narration 列表时钟；script 用 speech.play 排期" },
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
          roleId: { type: "string", description: "add 时的配音角色 id" },
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
  {
    type: "function",
    function: {
      name: "manage_stage_texts",
      description:
        "舞台画面文案（不是口播）。sync 从 HTML 抽出有字的节点；set_text 写某一语言。预览/导出走 previewLang。不要代劳机翻。",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["sync", "set_text"] },
          scriptId: { type: "string" },
          id: { type: "string", description: "节点 id（HTML id 或 data-text）" },
          lang: { type: "string", enum: LANG_ENUM },
          text: { type: "string" },
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

function beatFromSpec(spec: { id?: unknown; text?: unknown; i18n?: unknown; kind?: unknown; gapMs?: unknown; roleId?: unknown }, lang: LangId, used: Set<string>): Beat {
  const id = sanitizeBeatId(String(spec.id ?? "beat"), used);
  if (spec.kind === "gap") {
    const gapMs = typeof spec.gapMs === "number" && spec.gapMs > 0 ? Math.round(spec.gapMs) : DEFAULT_GAP_MS;
    return { id, kind: "gap", text: {}, gapMs };
  }
  const text: Beat["text"] = {};
  const source = typeof spec.text === "string" ? spec.text.trim() : "";
  if (source) text[lang] = source;
  if (spec.i18n && typeof spec.i18n === "object") {
    for (const [k, v] of Object.entries(spec.i18n as Record<string, unknown>)) {
      if (isLangId(k) && typeof v === "string" && v.trim()) text[k] = v.trim();
    }
  }
  const roleId = typeof spec.roleId === "string" && spec.roleId.trim() ? spec.roleId.trim() : undefined;
  return { id, kind: "speech", text, roleId };
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
    lines.push(`{`);
    lines.push(`  const el = root.querySelector("${sel}");`);
    lines.push(`  if (el && !el.textContent.trim()) el.textContent = speech.text("${id}");`);
    lines.push(
      `  timeline.fromTo("${sel}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: fade, ease: "power2.out" }, speech.startS("${id}"));`,
    );
    lines.push(`  timeline.to("${sel}", { duration: speech.holdS("${id}", fade) }, speech.startS("${id}") + fade);`);
    lines.push(`}`);
    lines.push("");
  });
  lines.push("const pause = speech.sleepS(0.4);");
  lines.push("timeline.to({}, { duration: pause }, speech.bodyS());");
  return lines.join("\n");
}

function stageHtmlFromBeats(ids: string[]): string {
  const nodes = ids.map((id, i) => {
    if (i === 0) return `<div id="title" class="clip title" data-speech="${id}"></div>`;
    if (i === 1) return `<div id="stat" class="clip stat" data-speech="${id}"></div>`;
    if (i === 2) return `<div id="ring" class="clip ring"></div>`;
    return `<div id="el${i + 1}" class="clip title" data-speech="${id}">${id}</div>`;
  });
  return nodes.join("\n") || DEFAULT_STAGE_HTML;
}

function scriptFromSpec(spec: Record<string, unknown>, lang: LangId, fallbackHtml?: string): SceneScript {
  const used = new Set<string>();
  const rawBeats = Array.isArray(spec.beats) ? spec.beats : [];
  const beats = rawBeats.map((b, i) => {
    const row = b && typeof b === "object" ? (b as { id?: unknown; text?: unknown; i18n?: unknown; kind?: unknown; gapMs?: unknown; roleId?: unknown }) : {};
    return beatFromSpec({ ...row, id: row.id ?? `beat${i + 1}` }, lang, used);
  });
  const ids = beats.filter((b) => b.kind !== "gap").map((b) => b.id);
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
    drive: script.drive === "script" ? "script" : "narration",
    holdMs: script.holdMs ?? 0,
    beats: script.beats.map((b) =>
      isGapBeat(b)
        ? { id: b.id, kind: "gap", gapMs: b.gapMs ?? DEFAULT_GAP_MS }
        : {
            id: b.id,
            kind: "speech",
            text: b.text[lang] ?? "",
            roleId: b.roleId ?? "",
            langs: Object.fromEntries(Object.entries(b.text).filter(([, t]) => (t ?? "").trim())),
          },
    ),
    code: sourceOf(script),
    stageHtml: script.stageHtml ?? "",
    stageTexts: (script.stageTexts ?? []).map((t) => ({ id: t.id, sel: t.sel, text: t.text })),
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
        fontPolicy: FONT_POLICY,
        stageCss: p.stageCss ?? "",
        voices: p.voices.map((v) => ({ id: v.id, name: v.name, gender: v.gender })),
        voiceId: p.voiceId ?? "",
        voiceByLang: p.voiceByLang ?? {},
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
          "speech.startS(id)": "这一句从哪一秒开始。口播驱动＝列表时钟（含延时行）。",
          "speech.play(id)": "脚本驱动：排期并返回开始秒，可当 GSAP position。口播驱动＝startS。",
          "speech.endS(id)": "这一句口播哪一秒结束。",
          "speech.holdS(id, fade)": "s(id) − fade。入场固定 fade；剩下的时间画面停住直到这句说完。",
          "speech.sleepS(n)": "暂停。每次调用把 n 秒加进全长并返回 n。可多次。totalS = bodyS + Σ sleepS。",
          "speech.bodyS()": "各句口播之和，不含暂停。",
          "speech.totalS()": "全长 = bodyS + 所有 sleepS。写在全部 sleepS 之后。",
          "speech.text(id)": "当前预览语言的口播文案，可写进 DOM。",
          "stage.text(id)": "当前预览语言的画面文案（文本页），不是口播。",
        },
        notes: {
          clock: "不要写死 3 秒。入场用固定秒；换语言只换 TTS。",
          gsap: "timeline 已 paused。不要 timeline.play()。脚本驱动用 speech.play(id)。预览和导出 seek。",
          stage: "每个脚本自己的 stageHtml。画幅/字体/底色/stageCss 是工程级。HTML 里用 #title 等选择器。有字的节点会出现在文本页，预览/导出按 previewLang 覆盖。",
          fonts: FONT_POLICY,
          sleep: "口播驱动：句间留白用延时行（kind=gap）。sleepS 加在片尾。脚本驱动：speech.play + sleepS。",
          tts: "密钥和配音合成不用你处理。用户在顶栏「配音」：合成 / AI 配置 / 配音角色 / 音色管理。翻译后合成默认关。改口播后配音会过期。画面文案翻译在「文本」页，不要代劳机翻。",
          role: "每句可设 roleId（get_project.voices）。缺省用 voiceId / voiceByLang。",
        },
        fonts: STAGE_FONTS.map((f) => ({ id: f.id, label: f.label, langs: f.langs, hint: f.hint, detail: f.detail, license: f.license })),
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
      if (args.drive === "narration" || args.drive === "script") store.patchScript(scriptId, { drive: args.drive });
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
          const row = b && typeof b === "object" ? (b as { id?: unknown; text?: unknown; i18n?: unknown; kind?: unknown; gapMs?: unknown; roleId?: unknown }) : {};
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
        const beat = beatFromSpec({ id: args.beatId ?? args.name, text: args.text, roleId: args.roleId }, lang, used);
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

    if (name === "manage_stage_texts") {
      const action = String(args.action ?? "");
      const scriptId = typeof args.scriptId === "string" ? args.scriptId : store.scriptId;
      const script = store.project.scripts.find((x) => x.id === scriptId);
      if (!script) return fail("找不到脚本");
      if (action === "sync") {
        const stageTexts = syncStageTexts(script.stageHtml ?? "", script.stageTexts, lang);
        store.patchScript(scriptId, { stageTexts });
        return ok({ ok: true, ids: stageTexts.map((t) => t.id) });
      }
      if (action === "set_text") {
        const id = String(args.id ?? "").trim();
        if (!id) return fail("缺少 id");
        const target = isLangId(String(args.lang ?? "")) ? (args.lang as LangId) : lang;
        const text = String(args.text ?? "");
        let stageTexts = script.stageTexts ?? syncStageTexts(script.stageHtml ?? "", undefined, lang);
        if (!stageTexts.some((t) => t.id === id)) {
          stageTexts = [...stageTexts, { id, sel: `#${id}`, text: {} }];
        }
        stageTexts = stageTexts.map((t) => (t.id === id ? { ...t, text: { ...t.text, [target]: text } } : t));
        store.patchScript(scriptId, { stageTexts });
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
- 口播驱动（默认）：列表顺序即时钟。句间留白用 kind=gap 的延时行，不要用 sleepS 当句间停顿。
- 脚本驱动：列表是台词库。必须 speech.play("hook") 才会出声；返回开始秒，可当 GSAP position。sleepS 插在两次 play 之间。
- speech.startS / endS 是口播轴上的起止。
- 入场用固定秒。holdS(id, fade) = s(id) − fade。
- 不要整条时间轴 timeScale。不要 timeline.play()（那是动画播放，不是口播）。

舞台与代码：
- 每个脚本自己的舞台 HTML（DOM，不是 canvas）。GSAP 只写 paused timeline。
- 画幅、字体、底色、全局 CSS 是工程级，用 set_project（stageTheme / stageCss / aspect）。
- 字体：${FONT_POLICY}
- 口播文案用 speech.text(id)；画面文案用 stage.text(id)（文本页），不要把口播写进舞台字。
- Remotion / Manim 工作台里是节拍卡；仍把口播写进 beats，code 可留草稿。

写作：
- 口播口语化，一句一事。每句一个稳定 id（hook / fact / close 或英文短词）。
- 整片重做：apply_scripts mode=replace，每个脚本给出 stageHtml 与 GSAP code。
- 加一段：mode=append，或 manage_scripts add。
- 改现有工程先 get_project / get_script，再 update_script / manage_beats。
- 每句可指定 roleId（get_project.voices）；缺省用语言默认角色。
- 画面文案写在 HTML 里，和口播分开。预览/导出按 previewLang 覆盖 DOM。脚本可用 stage.text("id")。翻译由用户在「文本」页操作，不要代劳机翻。
- 密钥、翻译、TTS、导出不用你处理。用户在顶栏「配音」操作（合成 / AI 配置 / 角色 / 音色）。翻译后合成默认关。
- 用中文回复用户，简短说明做了什么。`;
