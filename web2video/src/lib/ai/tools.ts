import { BLOCK_TYPES, LAYOUTS, type AnimKind, type AspectId, type BlockType, type CaptionStyle, type CueBind, type CueStay, type LayoutId, type ListMarkerStyle, type ProgressStyle, type StageFontId } from "../../types";
import { sceneBlocks } from "../blocks";
import { captionStyleOf, isStageFontId, progressStyleOf, STAGE_FONTS, stampLegacyBlockFonts } from "../fonts";
import { listMarkerStyleOf } from "../listMarker";
import { exportSettingsOf } from "../exportSettings";
import { itemSpeakKey } from "../narration";
import { isGapSpeak, lineDurationMs, speakLineText, speaksOf } from "../speaks";
import { textOf, itemText, sourceLangOf, blockNameOf, writeI18n, collectVisualRows, isVisualI18nKind, type I18nRowKind } from "../textI18n";
import { useEditor } from "../../store/useEditor";
import { patchSceneFromStoryboard, sceneFromStoryboard, type StoryboardScene } from "./storyboard";
import { isLangId, type LangId } from "../langs";

export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const FONT_IDS = STAGE_FONTS.map((f) => f.id);

/** In-app AI + Cursor MCP. Keep in sync with skill/web2video 字体. */
export const FONT_POLICY =
  "成片字体必须免费可商用。只用 list_catalog.fonts 的 id（均为 SIL OFL，字文件随工具打包，不请求 Google Fonts）。片级 fontId 是所有文字元件的默认，captionFontId 是口播字幕条。标题/金句等也是元件，未指定时跟 fontId；要例外写元件 settings.fontId。进度条场次名用 progressStyle.fontId（可回落字幕）。栈末回落 Noto。禁止 Arial、微软雅黑、PingFang、Hiragino、Times、system-ui、sans-serif、serif。不要发明目录外字体名。KaTeX_* 同样 SIL OFL。嵌进视频可以，不要把字体文件单独拿去卖。";

const sceneSpecProperties = {
  name: { type: "string", description: "场景短名，时间轴与进度条上显示" },
  layout: { type: "string", description: "版面 id，见 list_catalog。对白场用 dialogue" },
  bg: { type: "string", description: "场景底色，如 #141811。与版面图片元件无关" },
  bgFit: { type: "string", enum: ["cover", "contain"], description: "已有背景图时的铺满方式" },
  bgDim: { type: "number", description: "背景图遮罩 0–1，让字更清楚" },
  holdMs: { type: "number", description: "本场口播后停留毫秒，省略跟片级" },
  drive: { type: "string", enum: ["narration", "config"], description: "narration=口播列表即时钟；config=播放元件排期 + 动效锚点" },
  transition: { type: "string", enum: ["cut", "crossfade"], description: "切到下一场，省略跟片级" },
  transitionMs: { type: "number", description: "叠化时长毫秒" },
  title: { type: "string" },
  subtitle: { type: "string" },
  body: { type: "string" },
  caption: { type: "string" },
  quote: { type: "string" },
  author: { type: "string" },
  number: { type: "string" },
  items: { type: "array", items: { type: "string" }, description: "列表条目画面文案" },
  dialogue: {
    type: "array",
    description: "对话窗对白。layout=dialogue 时必填。左右交替。",
    items: {
      type: "object",
      properties: {
        side: { type: "string", enum: ["left", "right"] },
        name: { type: "string", description: "气泡上的角色名" },
        text: { type: "string", description: "画面对白" },
        speak: { type: "string", description: "口播，省略则用 text" },
        role: { type: "string", description: "配音角色 id，见 get_project.voices" },
      },
    },
  },
  speaks: {
    type: "array",
    items: { type: "string" },
    description: "本场口播列表，顺序即播放顺序。每条有独立 id；时长只读。优先用这个，不要再拆开场/结束。",
  },
  narration: { type: "string", description: "兼容旧字段。无 speaks 时作为口播列表的一句" },
  narrationClose: { type: "string", description: "兼容旧字段。无 speaks 时接到口播列表末尾" },
  speak: {
    type: "object",
    description: "兼容旧字段：按元件拆口播。新片子请用 speaks 数组。",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      body: { type: "string" },
      caption: { type: "string" },
      quote: { type: "string" },
      author: { type: "string" },
      number: { type: "string" },
      list: { type: "string", description: "列表导语口播" },
      items: { type: "array", items: { type: "string" } },
      dialogue: { type: "array", items: { type: "string" }, description: "对白口播，与 dialogue 一一对应" },
    },
  },
  speakRole: {
    type: "object",
    description: "口播角色 VoiceProfile.id。缺省用该语言默认角色。",
    properties: {
      open: { type: "string" },
      close: { type: "string" },
      title: { type: "string" },
      subtitle: { type: "string" },
      body: { type: "string" },
      caption: { type: "string" },
      quote: { type: "string" },
      author: { type: "string" },
      number: { type: "string" },
      list: { type: "string" },
      items: { type: "array", items: { type: "string" } },
      dialogue: { type: "array", items: { type: "string" } },
    },
  },
};

const captionStyleProperties = {
  box: { type: "string", enum: ["pill", "bar", "none"] },
  bg: { type: "string" },
  bgOpacity: { type: "number" },
  color: { type: "string" },
  fontSize: { type: "number" },
  fontWeight: { type: "string", enum: ["normal", "medium", "bold"] },
  align: { type: "string", enum: ["left", "center", "right"] },
  position: { type: "string", enum: ["bottom", "top"] },
  insetX: { type: "number" },
  insetY: { type: "number" },
  outline: { type: "boolean" },
  blur: { type: "boolean" },
};

const progressStyleProperties = {
  position: { type: "string", enum: ["top", "bottom"] },
  height: { type: "number", description: "相对画幅宽度，约 1.4–6" },
  bg: { type: "string" },
  bgOpacity: { type: "number" },
  fill: { type: "string", description: "已播放填充色" },
  fillOpacity: { type: "number" },
  playhead: { type: "string" },
  color: { type: "string", description: "场次名颜色" },
  activeColor: { type: "string", description: "当前场次名颜色" },
  fontSize: { type: "number" },
  fontWeight: { type: "string", enum: ["normal", "medium", "bold"] },
  fontId: { type: "string", enum: FONT_IDS, description: "仅 list_catalog SIL OFL id" },
  showNames: { type: "boolean" },
  showPlayhead: { type: "boolean" },
  showDividers: { type: "boolean" },
  blur: { type: "boolean" },
  insetX: { type: "number", description: "左右边距百分比" },
};

const listMarkerStyleProperties = {
  show: { type: "boolean", description: "是否显示列表序号" },
  kind: { type: "string", enum: ["number", "image"], description: "数字色块或用户上传的图片" },
  bg: { type: "string", description: "色块底色" },
  color: { type: "string", description: "数字颜色" },
  size: { type: "number", description: "相对画幅宽度，约 1.2–5" },
  shape: { type: "string", enum: ["circle", "rounded", "square"] },
  overlayIndex: { type: "boolean", description: "图片样式时是否叠 1、2、3" },
};

export const AI_TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "get_project",
      description: "读取工程概要：名称、语言、画幅、字体、字幕/进度条、配音角色、场景列表。改之前先调用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_scene",
      description: "读取一场的画面文案（含 visual i18n）、口播列表、元件与动效。",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string", description: "省略则读当前场景" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_catalog",
      description: "列出版面、元件、字体（SIL OFL，随工具打包；禁止系统字体），以及字幕/进度条可配字段。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_project",
      description: "修改片级设置：名称、画幅、停留、切场、字体（仅 list_catalog SIL OFL id）、字幕条、画布进度条、列表序号、导出规格。只传要改的字段。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          aspect: { type: "string", enum: ["16:9", "9:16", "1:1"] },
          holdMs: { type: "number", description: "口播后停留毫秒" },
          openPadBeforeMs: { type: "number" },
          openPadAfterMs: { type: "number" },
          closePadBeforeMs: { type: "number" },
          closePadAfterMs: { type: "number" },
          transition: { type: "string", enum: ["cut", "crossfade"] },
          transitionMs: { type: "number" },
          showCaptions: { type: "boolean", description: "预览口播字幕条，默认关。导出烧录请在导出窗勾选" },
          bilingualCaptions: { type: "boolean", description: "双语字幕：主行当前配音语言，副行第二语言" },
          bilingualCaptionLang: { type: "string", enum: ["zh", "en", "ja", "fr", "de", "ru", "es", "pt", "it"], description: "双语字幕的第二语言" },
          showTopProgress: { type: "boolean", description: "画布进度条，会进导出" },
          fontId: { type: "string", enum: FONT_IDS, description: "元件默认。标题/正文/金句等未单独指定时都用这个。仅 list_catalog.fonts，SIL OFL，默认 noto-sans" },
          titleFontId: { type: "string", enum: FONT_IDS, description: "兼容旧字段。打开旧工程时会盖到标题/数字元件上；新片请用 fontId 或元件 settings.fontId" },
          subtitleFontId: { type: "string", enum: FONT_IDS, description: "兼容旧字段。打开旧工程时会盖到副标题/署名元件上；新片请用 fontId 或元件 settings.fontId" },
          quoteFontId: { type: "string", enum: FONT_IDS, description: "兼容旧字段。打开旧工程时会盖到金句元件上；新片请用 fontId 或元件 settings.fontId" },
          captionFontId: { type: "string", enum: FONT_IDS, description: "口播字幕条。仅目录 id，默认 noto-sans。禁止系统字体" },
          captionStyle: { type: "object", properties: captionStyleProperties },
          progressStyle: { type: "object", properties: progressStyleProperties },
          listMarkerStyle: { type: "object", properties: listMarkerStyleProperties },
          exportSettings: {
            type: "object",
            description: "导出规格，浏览器录制",
            properties: {
              format: { type: "string", enum: ["webm-vp9", "webm-vp8", "mp4-h264"] },
              height: { type: "number", enum: [1080, 720, 480] },
              fps: { type: "number", enum: [24, 25, 30] },
              videoMbps: { type: "number" },
              audioKbps: { type: "number" },
              exportSubtitles: { type: "boolean", description: "导出时另存 SRT/VTT，默认关。烧录字幕条也默认关，需在导出窗勾选" },
              subtitleFormat: { type: "string", enum: ["srt", "vtt"] },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_storyboard",
      description: "用分镜一次性生成多场。新片用 replace；在现有片后加场用 append。每场需要画面文案；列表填 items，对话填 dialogue。",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["replace", "append"], description: "默认 replace" },
          projectName: { type: "string" },
          scenes: { type: "array", items: { type: "object", properties: sceneSpecProperties, required: ["name"] } },
        },
        required: ["scenes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_scene",
      description: "改一场的版面、文案、口播或列表。只传要改的字段。",
      parameters: {
        type: "object",
        properties: { sceneId: { type: "string" }, ...sceneSpecProperties },
        required: ["sceneId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_scenes",
      description: "添加、删除、复制、重命名、调序或选中场景。",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "remove", "duplicate", "rename", "move", "select"] },
          sceneId: { type: "string" },
          name: { type: "string" },
          layout: { type: "string" },
          dir: { type: "integer", enum: [-1, 1], description: "move：-1 上移，1 下移" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_blocks",
      description: "增删或调整当前/指定场景的元件位置与样式。",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "remove", "patch"] },
          sceneId: { type: "string" },
          blockId: { type: "string" },
          type: { type: "string", description: "add 时的元件类型" },
          name: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
          z: { type: "number" },
          settings: {
            type: "object",
            description: "元件样式。只传要改的字段。",
            properties: {
              align: { type: "string", enum: ["left", "center", "right"] },
              color: { type: "string" },
              fill: { type: "string" },
              fontSize: { type: "number" },
              fontWeight: { type: "string", enum: ["normal", "medium", "bold"] },
              fontId: { type: "string", enum: FONT_IDS, description: "覆盖片级元件默认。仅 list_catalog.fonts（SIL OFL）。禁止 Arial/微软雅黑/system-ui" },
              tex: { type: "string", description: "katex 元件的 TeX 源，如 E = mc^{2}" },
              displayMode: { type: "boolean", description: "katex 是否独立成行，默认 true" },
              threeSrc: { type: "string", description: "three 元件脚本：可用 THREE/scene/camera，可 return function update({ t, localMs })。不要 rAF，不要编造模型/贴图 URL" },
            },
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_visual_text",
      description:
        "写画面文案某一语言（标题/列表/对白/元件名），不是口播。kind=title|subtitle|body|caption|quote|author|number|item|dialogue|blockName。item 和 dialogue 要 itemId。不要代劳机翻。",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          kind: {
            type: "string",
            enum: ["title", "subtitle", "body", "caption", "quote", "author", "number", "item", "dialogue", "blockName"],
          },
          itemId: { type: "string", description: "item / dialogue / blockName 的 id" },
          lang: { type: "string", enum: ["zh", "en", "ja", "fr", "de", "ru", "es", "pt", "it"] },
          text: { type: "string" },
        },
        required: ["kind", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_cue",
      description: "设置元件动效（兼容旧 cues，无 effects 时仍可读）。target 为元件 id 或 item:{id}。优先用口播 id 的开始/结束，不要用主体 0–1 拉伸。用户侧动效还可选场景锚点、固定时间或时长。",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          target: { type: "string" },
          bind: { type: "string", enum: ["speak", "visual"], description: "speak=跟口播句；visual=跟主体（仅兼容旧片）" },
          anim: { type: "string", enum: ["fade", "slide", "scale", "highlight", "kenburns"], description: "kenburns 界面名「缓推缩放」" },
          leadMs: { type: "number", description: "相对口播开始的偏移毫秒，负数为提前" },
          stay: { type: "string", enum: ["body", "speech"], description: "speech=跟到该句结束；body=跟到主体结束" },
          trailMs: { type: "number", description: "相对结束锚点的偏移毫秒" },
          at: { type: "number", description: "仅兼容旧 visual：主体 0–1 起点，新片不要用" },
          until: { type: "number", description: "仅兼容旧 visual：主体 0–1 终点，新片不要用" },
        },
        required: ["target"],
      },
    },
  },
];

function dumpScene(sceneId?: string) {
  const s = useEditor.getState();
  const lang = s.project.sourceLang;
  const source = sourceLangOf(s.project);
  const scene = s.project.scenes.find((x) => x.id === (sceneId || s.currentSceneId));
  if (!scene) return { error: "找不到场景" };
  const items = scene.slots.items ?? [];
  const speaks = speaksOf(scene).map((line) => ({
    id: line.id,
    kind: line.kind ?? "speech",
    text: isGapSpeak(line) ? "" : speakLineText(line, lang, source),
    durationMs: lineDurationMs(scene, line, lang, source),
    role: line.role ?? "",
  }));
  return {
    id: scene.id,
    name: scene.name,
    layoutId: scene.layoutId,
    bg: scene.bg,
    hasBgImage: Boolean(scene.bgImage),
    bgFit: scene.bgFit ?? "cover",
    bgDim: scene.bgDim ?? 0,
    holdMs: scene.holdMs,
    drive: scene.drive ?? "narration",
    transition: scene.transition,
    transitionMs: scene.transitionMs,
    speaks,
    slots: {
      title: textOf(scene.slots.title, lang, source),
      subtitle: textOf(scene.slots.subtitle, lang, source),
      body: textOf(scene.slots.body, lang, source),
      caption: textOf(scene.slots.caption, lang, source),
      quote: textOf(scene.slots.quote, lang, source),
      author: textOf(scene.slots.author, lang, source),
      number: textOf(scene.slots.number, lang, source),
      items: items.map((it) => ({ id: it.id, text: itemText(it, lang, source) })),
      dialogue: (scene.slots.dialogue ?? []).map((it) => ({
        id: it.id,
        side: it.side,
        name: it.name ?? "",
        text: itemText(it, lang, source),
        role: scene.speakRole?.[itemSpeakKey(it.id)] ?? "",
      })),
      hasImage: Boolean(scene.slots.image),
    },
    visual: collectVisualRows(s.project, scene.id).map((r) => ({
      kind: r.kind,
      itemId: r.itemId ?? "",
      label: r.label,
      i18n: r.i18n,
    })),
    blocks: sceneBlocks(scene).map((b) => ({
      id: b.id,
      type: b.type,
      name: blockNameOf(b, lang, source) || b.type,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      z: b.z ?? 1,
      hasSrc: Boolean(b.settings?.src) || (b.type === "image" && Boolean(scene.slots.image)),
      playTarget: b.settings?.playTarget ?? "",
      tex: b.settings?.tex ?? "",
      threeSrc: b.type === "three" ? (b.settings?.threeSrc ?? "").slice(0, 400) : "",
      effects: (b.effects ?? []).map((fx) => ({
        id: fx.id,
        anim: fx.anim,
        target: fx.target ?? "",
        from: fx.from,
        to: fx.to ?? null,
        durationMs: fx.durationMs ?? null,
      })),
    })),
    cues: scene.cues.map((c) => ({
      id: c.id,
      target: c.target,
      bind: c.bind ?? "auto",
      at: c.at,
      until: c.until,
      leadMs: c.leadMs ?? 0,
      stay: c.stay ?? "body",
      anim: c.anim,
    })),
  };
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
    const store = useEditor.getState();
    const lang = store.project.sourceLang as LangId;

    if (name === "get_project") {
      const p = store.project;
      return ok({
        name: p.name,
        sourceLang: p.sourceLang,
        previewLang: p.previewLang,
        aspect: p.aspect,
        currentSceneId: store.currentSceneId,
        holdMs: p.holdMs,
        transition: p.transition,
        transitionMs: p.transitionMs,
        showCaptions: p.showCaptions,
        bilingualCaptions: Boolean(p.bilingualCaptions),
        bilingualCaptionLang: p.bilingualCaptionLang ?? null,
        showTopProgress: Boolean(p.showTopProgress),
        fonts: {
          policy: FONT_POLICY,
          fontId: p.fontId,
          captionFontId: p.captionFontId,
          titleFontId: p.titleFontId,
          subtitleFontId: p.subtitleFontId,
          quoteFontId: p.quoteFontId,
        },
        captionStyle: captionStyleOf(p.captionStyle),
        progressStyle: progressStyleOf(p.progressStyle),
        listMarkerStyle: (() => {
          const { image, ...rest } = listMarkerStyleOf(p.listMarkerStyle);
          return { ...rest, hasImage: Boolean(image) };
        })(),
        exportSettings: exportSettingsOf(p.exportSettings),
        voices: p.voices.map((v) => ({ id: v.id, name: v.name, gender: v.gender })),
        voiceId: p.voiceId,
        voiceByLang: p.voiceByLang,
        scenes: p.scenes.map((sc) => {
          const first = speaksOf(sc).find((line) => !isGapSpeak(line));
          return {
            id: sc.id,
            name: sc.name,
            layoutId: sc.layoutId,
            speaks: speaksOf(sc).length,
            firstSpeak: first ? speakLineText(first, lang, lang).slice(0, 80) : "",
          };
        }),
      });
    }

    if (name === "get_scene") {
      return ok(dumpScene(typeof args.sceneId === "string" ? args.sceneId : undefined));
    }

    if (name === "list_catalog") {
      return ok({
        layouts: LAYOUTS.map((l) => ({ id: l.id, label: l.label, desc: l.desc })),
        blocks: BLOCK_TYPES.map((b) => ({ type: b.type, label: b.label })),
        fonts: STAGE_FONTS.map((f) => ({ id: f.id, label: f.label, langs: f.langs, hint: f.hint, detail: f.detail, license: f.license })),
        notes: {
          fonts: FONT_POLICY,
          speaks: "口播是场景上的独立列表，各有 id。时长只读（合成 beatMs 或字数估计）。句间留白用延时行。不要再拆开场/结束口播。",
          speakBind: "动效 TimeRef.kind：speak（某句开始/结束+偏移）、scene（场景/主体起止+偏移）、fixed（从场景开始的绝对毫秒）。终点也可只用 durationMs。不要 0–1 拉伸。",
          play: "play 元件只在配置驱动里播口播。开场/结束空白只在配置驱动下生效。",
          dialogue: "dialogue 版面是左右双人对话窗。对白写在 dialogue 数组，口播写在 speaks，每句可配 role",
          bg: "bg 是场景底色；bgImage / 图片 / 视频 / GIF 只能用户本地选文件，不要编造 URL",
          media: "video、gif 元件用 manage_blocks 添加后，src 由用户在检视里选择，存在 settings.src",
          katex: "katex 元件写 settings.tex（TeX 源）。公式跟元件动效走。字体是 KaTeX_*（SIL OFL）。不要编造公式图片 URL。",
          three: "three 元件写 settings.threeSrc。可用 THREE、scene、camera；可 return function update({ t, localMs })。t 是本元件窗口 0–1。不要 requestAnimationFrame / setAnimationLoop，不要编造模型或贴图 URL，只用内置几何。",
          captions: "showCaptions 只控制预览字幕条。烧录/另存字幕文件默认关，导出窗勾选。captionFontId 仅目录 SIL OFL。bilingualCaptions 双语。导出窗可选：每种语言各一段视频，或一段视频+多语言字幕（时间轴跟视频语言走）",
          progress: "工作区底部是全片进度条。showTopProgress + progressStyle 是画布上的进度条，会进导出。",
          listMarker: "listMarkerStyle 控制全片列表序号：show 开关，kind=number 色块或 image 用户上传图，不要编造图片 URL",
          speakRole: "每句 speaks[].role 填 get_project.voices 的 id；缺省用 voiceByLang 该语言默认",
          visual: "画面文案与口播分开。get_scene.visual 是各语言 i18n。源语言用 update_scene 的 title/items/dialogue；其它语言用 set_visual_text。预览/导出走 previewLang。翻译由用户在属性「文本」里点，不要代劳机翻。",
          tts: "密钥和配音合成不用你处理。用户在配音窗口：合成 / AI 配置 / 配音角色 / 音色管理。翻译后合成默认关。",
        },
      });
    }

    if (name === "set_project") {
      const patch: Record<string, unknown> = {};
      if (typeof args.name === "string" && args.name.trim()) patch.name = args.name.trim();
      if (args.aspect === "16:9" || args.aspect === "9:16" || args.aspect === "1:1") patch.aspect = args.aspect as AspectId;
      for (const k of ["holdMs", "openPadBeforeMs", "openPadAfterMs", "closePadBeforeMs", "closePadAfterMs", "transitionMs"] as const) {
        if (typeof args[k] === "number" && Number.isFinite(args[k])) patch[k] = Math.max(0, args[k] as number);
      }
      if (args.transition === "cut" || args.transition === "crossfade") patch.transition = args.transition;
      if (typeof args.showCaptions === "boolean") patch.showCaptions = args.showCaptions;
      if (typeof args.bilingualCaptions === "boolean") patch.bilingualCaptions = args.bilingualCaptions;
      if (isLangId(String(args.bilingualCaptionLang ?? ""))) patch.bilingualCaptionLang = args.bilingualCaptionLang as LangId;
      if (typeof args.showTopProgress === "boolean") patch.showTopProgress = args.showTopProgress;
      if (isStageFontId(args.fontId)) {
        patch.fontId = args.fontId as StageFontId;
        if (!isStageFontId(args.titleFontId)) patch.titleFontId = args.fontId as StageFontId;
        if (!isStageFontId(args.subtitleFontId)) patch.subtitleFontId = args.fontId as StageFontId;
        if (!isStageFontId(args.quoteFontId)) patch.quoteFontId = args.fontId as StageFontId;
      }
      for (const k of ["titleFontId", "subtitleFontId", "quoteFontId", "captionFontId"] as const) {
        if (isStageFontId(args[k])) patch[k] = args[k] as StageFontId;
      }
      if (args.captionStyle && typeof args.captionStyle === "object") {
        patch.captionStyle = captionStyleOf({ ...store.project.captionStyle, ...(args.captionStyle as Partial<CaptionStyle>) });
      }
      if (args.progressStyle && typeof args.progressStyle === "object") {
        patch.progressStyle = progressStyleOf({ ...store.project.progressStyle, ...(args.progressStyle as Partial<ProgressStyle>) });
      }
      if (args.listMarkerStyle && typeof args.listMarkerStyle === "object") {
        const raw = args.listMarkerStyle as Partial<ListMarkerStyle>;
        const { image: _ignore, ...rest } = raw;
        patch.listMarkerStyle = listMarkerStyleOf({ ...store.project.listMarkerStyle, ...rest });
      }
      if (args.exportSettings && typeof args.exportSettings === "object") {
        patch.exportSettings = exportSettingsOf({ ...store.project.exportSettings, ...(args.exportSettings as object) });
      }
      const typedFont =
        isStageFontId(args.titleFontId) || isStageFontId(args.subtitleFontId) || isStageFontId(args.quoteFontId);
      if (typedFont) {
        const fonts = {
          fontId: (patch.fontId as StageFontId | undefined) ?? store.project.fontId,
          titleFontId: (patch.titleFontId as StageFontId | undefined) ?? store.project.titleFontId,
          subtitleFontId: (patch.subtitleFontId as StageFontId | undefined) ?? store.project.subtitleFontId,
          quoteFontId: (patch.quoteFontId as StageFontId | undefined) ?? store.project.quoteFontId,
        };
        patch.scenes = store.project.scenes.map((sc) => ({
          ...sc,
          blocks: stampLegacyBlockFonts(sc.blocks?.length ? sc.blocks : sceneBlocks(sc), fonts),
        }));
      }
      if (!Object.keys(patch).length) return fail("没有可更新的字段");
      store.updateProject(patch);
      return ok({ ok: true, patch });
    }

    if (name === "apply_storyboard") {
      const list = Array.isArray(args.scenes) ? (args.scenes as StoryboardScene[]) : [];
      if (!list.length) return fail("scenes 为空");
      const built = list.map((spec, i) => {
        if (!spec || typeof spec !== "object") throw new Error(`scenes[${i}] 无效`);
        const name = String(spec.name ?? "").trim() || `场景 ${i + 1}`;
        return sceneFromStoryboard({ ...spec, name }, lang);
      });
      if (typeof args.projectName === "string" && args.projectName.trim()) {
        store.updateProject({ name: args.projectName.trim() });
      }
      const mode = args.mode === "append" ? "append" : "replace";
      if (mode === "append") store.replaceScenes([...store.project.scenes, ...built]);
      else store.replaceScenes(built);
      return ok({
        ok: true,
        mode,
        count: built.length,
        scenes: built.map((sc) => ({ id: sc.id, name: sc.name, layoutId: sc.layoutId })),
      });
    }

    if (name === "update_scene") {
      const sceneId = String(args.sceneId ?? "");
      const scene = store.project.scenes.find((x) => x.id === sceneId);
      if (!scene) return fail("找不到场景");
      const next = patchSceneFromStoryboard(scene, args as Partial<StoryboardScene>, lang);
      store.patchScene(sceneId, next, true);
      return ok({ ok: true, scene: dumpScene(sceneId) });
    }

    if (name === "manage_scenes") {
      const action = String(args.action ?? "");
      const sceneId = typeof args.sceneId === "string" ? args.sceneId : store.currentSceneId;
      if (action === "add") {
        const layout =
          typeof args.layout === "string" && LAYOUTS.some((l) => l.id === args.layout) ? (args.layout as LayoutId) : "cover";
        store.addScene(layout);
        const id = useEditor.getState().currentSceneId;
        if (typeof args.name === "string" && args.name.trim()) store.renameScene(id, args.name.trim());
        return ok({ ok: true, sceneId: id });
      }
      if (action === "remove") {
        if (store.project.scenes.length <= 1) return fail("至少保留一场");
        store.removeScene(sceneId);
        return ok({ ok: true, currentSceneId: useEditor.getState().currentSceneId });
      }
      if (action === "duplicate") {
        store.duplicateScene(sceneId);
        return ok({ ok: true, sceneId: useEditor.getState().currentSceneId });
      }
      if (action === "rename") {
        const name = String(args.name ?? "").trim();
        if (!name) return fail("缺少 name");
        store.renameScene(sceneId, name);
        return ok({ ok: true });
      }
      if (action === "move") {
        const dir = args.dir === -1 || args.dir === 1 ? args.dir : 1;
        store.moveScene(sceneId, dir);
        return ok({ ok: true });
      }
      if (action === "select") {
        store.setCurrentScene(sceneId);
        return ok({ ok: true, currentSceneId: sceneId });
      }
      return fail("未知 action");
    }

    if (name === "manage_blocks") {
      const action = String(args.action ?? "");
      const sceneId = typeof args.sceneId === "string" ? args.sceneId : store.currentSceneId;
      const scene = store.project.scenes.find((x) => x.id === sceneId);
      if (!scene) return fail("找不到场景");
      if (action === "add") {
        const type = String(args.type ?? "") as BlockType;
        if (!BLOCK_TYPES.some((b) => b.type === type)) return fail("未知元件类型");
        store.addBlock(sceneId, type);
        return ok({ ok: true, selectedBlockId: useEditor.getState().selectedBlockId });
      }
      const blockId = String(args.blockId ?? "");
      if (!blockId) return fail("缺少 blockId");
      if (action === "remove") {
        store.removeBlock(sceneId, blockId);
        return ok({ ok: true });
      }
      if (action === "patch") {
        const patch: Record<string, unknown> = {};
        if (typeof args.name === "string") {
          const block = sceneBlocks(scene).find((b) => b.id === blockId);
          patch.name = { i18n: writeI18n(typeof block?.name === "object" ? block.name.i18n : undefined, lang, lang, args.name) };
        }
        for (const k of ["x", "y", "w", "h", "z"] as const) {
          if (typeof args[k] === "number") patch[k] = args[k];
        }
        let did = false;
        if (Object.keys(patch).length) {
          store.patchBlock(sceneId, blockId, patch as { name?: { i18n: Partial<Record<LangId, string>> }; x?: number; y?: number; w?: number; h?: number; z?: number });
          did = true;
        }
        if (args.settings && typeof args.settings === "object") {
          const raw = args.settings as Record<string, unknown>;
          const settings: Record<string, unknown> = {};
          if (raw.align === "left" || raw.align === "center" || raw.align === "right") settings.align = raw.align;
          if (typeof raw.color === "string" && raw.color.trim()) settings.color = raw.color.trim();
          if (typeof raw.fill === "string" && raw.fill.trim()) settings.fill = raw.fill.trim();
          if (typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)) settings.fontSize = raw.fontSize;
          if (raw.fontWeight === "normal" || raw.fontWeight === "medium" || raw.fontWeight === "bold") settings.fontWeight = raw.fontWeight;
          if (isStageFontId(raw.fontId)) settings.fontId = raw.fontId;
          if (typeof raw.tex === "string") settings.tex = raw.tex;
          if (typeof raw.displayMode === "boolean") settings.displayMode = raw.displayMode;
          if (typeof raw.threeSrc === "string") settings.threeSrc = raw.threeSrc;
          if (Object.keys(settings).length) {
            store.patchBlockSettings(sceneId, blockId, settings as Parameters<typeof store.patchBlockSettings>[2]);
            did = true;
          }
        }
        if (!did) return fail("没有可更新的字段");
        return ok({ ok: true });
      }
      return fail("未知 action");
    }

    if (name === "set_cue") {
      const sceneId = typeof args.sceneId === "string" ? args.sceneId : store.currentSceneId;
      const scene = store.project.scenes.find((x) => x.id === sceneId);
      if (!scene) return fail("找不到场景");
      const target = String(args.target ?? "");
      const cue = scene.cues.find((c) => c.target === target);
      if (!cue) return fail("找不到该 target 的入场窗口");
      if (args.bind === "speak" || args.bind === "visual") store.setCueBind(sceneId, cue.id, args.bind as CueBind);
      if (typeof args.anim === "string") store.setCueAnim(sceneId, cue.id, args.anim as AnimKind);
      const patch: { leadMs?: number; stay?: CueStay; trailMs?: number } = {};
      if (typeof args.leadMs === "number") patch.leadMs = args.leadMs;
      if (args.stay === "body" || args.stay === "speech") patch.stay = args.stay;
      if (typeof args.trailMs === "number") patch.trailMs = args.trailMs;
      if (Object.keys(patch).length) store.patchCue(sceneId, cue.id, patch);
      if (typeof args.at === "number" || typeof args.until === "number") {
        store.setCueRange(sceneId, cue.id, typeof args.at === "number" ? args.at : cue.at, typeof args.until === "number" ? args.until : cue.until ?? 1);
      }
      return ok({ ok: true });
    }

    if (name === "set_visual_text") {
      const sceneId = typeof args.sceneId === "string" ? args.sceneId : store.currentSceneId;
      const kind = String(args.kind ?? "") as I18nRowKind;
      if (!isVisualI18nKind(kind)) return fail("kind 必须是画面字段，不能是口播");
      const text = String(args.text ?? "");
      const targetLang = isLangId(String(args.lang ?? "")) ? (args.lang as LangId) : lang;
      const itemId = typeof args.itemId === "string" && args.itemId.trim() ? args.itemId : undefined;
      const rows = collectVisualRows(store.project, sceneId);
      const row = rows.find((r) => r.kind === kind && (itemId ? r.itemId === itemId : !r.itemId));
      if (!row) return fail("找不到该画面文案。item/dialogue/blockName 需要 itemId。");
      store.applyI18nRow(row, targetLang, text, true);
      return ok({ ok: true });
    }

    return fail(`未知工具 ${name}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "工具执行失败");
  }
}

export const SYSTEM_PROMPT = `你是 Web2Video 的分镜助手。这是本地口播网页转视频工具：多场景、版面元件、每场独立口播列表、多语言。

时间规则：
- 每场默认口播驱动：口播列表顺序就是时钟。句间留白用延时行，不要按主体时长 0–1 拉伸。
- 口播是场景上的独立条目，各有 id；时长只读（合成或按字数估计），不要让用户手改时长。不要再拆开场口播/结束口播。
- 配置驱动：口播是台词库，用「播放口播」元件排期；元件动效的起点/终点可选口播、场景锚点或固定时间，终点也可设时长。本场播放与动效全部结束后切场。开场/结束空白只在配置驱动下生效。

版面与对白：
- 封面 cover，要点 bullets/cards，步骤 steps，金句 quote，数据 bigStat，对话 dialogue。
- 对话场填 dialogue:[{side,name,text,role?}]，左右交替。口播用 speaks 数组，对白每句可单独写成一条口播。
- 场景底色用 bg；遮罩 bgDim 0–1。不要编造图片、视频、GIF、三维模型或贴图的 URL。视频/GIF 元件让用户在检视里选本地文件。
- 公式用 katex 元件，settings.tex 写 TeX。三维用 three 元件，settings.threeSrc 写内置几何脚本，用 update({ t, localMs }) 跟播放头，不要自己开动画循环。

外观：
- 口播字幕条：showCaptions 默认关，只影响预览。导出窗里「烧录字幕条」和「同时导出字幕文件」默认都不勾；要烧录或另存 SRT/VTT 需用户勾选。双语：bilingualCaptions + bilingualCaptionLang。
- 画布进度条：showTopProgress + progressStyle，画在画布顶/底，导出会带上。工作区底部另有全片分段条，不是这个。
- 密钥、翻译、配音合成不用你处理。用户在配音窗口操作（合成 / AI 配置 / 角色 / 音色）。画面文案翻译在属性「文本」。
- 列表序号：listMarkerStyle.show / kind / 颜色 / 形状。图片只能用户在全局配置里上传，不要编造 URL。
- 字体：${FONT_POLICY}
- 每句口播可指定角色，id 来自 get_project.voices。

写作要求：
- 口播口语化、适合配音，一句一事，避免书面长句。
- 每场：画面文案 + speaks 口播列表；列表用 items；对话用 dialogue。画面字不要写进口播。
- 源语言画面用 update_scene 的 title/items/dialogue；其它语言用 set_visual_text。预览/导出走 previewLang。
- 改现有工程先 get_project / get_scene，再 update_scene 或 apply_storyboard。
- 用户要整片重做时 apply_storyboard mode=replace；要加场用 append。
- 用户提到字幕、进度条、字体、配色时用 set_project，不要只改文案。
- 用中文回复用户，简短说明做了什么。`;
