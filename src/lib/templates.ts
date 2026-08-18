import { uid } from "./ids";
import { defaultCues } from "./blocks";
import { t18 } from "./scriptSplit";
import { defaultVoiceByLang, defaultVoiceProfiles } from "./ttsSecrets";
import { DEFAULT_CAPTION_STYLE, DEFAULT_PROGRESS_STYLE, DEFAULT_CAPTION_FONT_ID, DEFAULT_FONT_ID, DEFAULT_QUOTE_FONT_ID, DEFAULT_SUBTITLE_FONT_ID, DEFAULT_TITLE_FONT_ID, captionStyleOf, progressStyleOf, isStageFontId } from "./fonts";
import { DEFAULT_LIST_MARKER_STYLE, listMarkerStyleOf } from "./listMarker";
import { DEFAULT_EXPORT_SETTINGS, exportSettingsOf } from "./exportSettings";
import { DEFAULT_HOLD_MS, DEFAULT_TRANSITION, DEFAULT_TRANSITION_MS, DEFAULT_OPEN_PAD_BEFORE_MS, DEFAULT_OPEN_PAD_AFTER_MS, DEFAULT_CLOSE_PAD_BEFORE_MS, DEFAULT_CLOSE_PAD_AFTER_MS } from "./timeline";
import { itemSpeakKey } from "./narration";
import { asNameI18n } from "./textI18n";
import type { DialogueLine, DialogueSide, LayoutId, Project, Scene, SceneTransition } from "../types";
import { isLangId, type LangId } from "./langs";

export const DEFAULT_PROJECT_NAME = "未命名口播";
export const DEFAULT_SCENE_BG = "#141811";

export function defaultDialogueLines(lang: LangId): DialogueLine[] {
  return [
    { id: uid("it"), side: "left", name: "角色A", i18n: { [lang]: "……" } },
    { id: uid("it"), side: "right", name: "角色B", i18n: { [lang]: "……" } },
  ];
}

export function nextDialogueSide(lines: DialogueLine[]): DialogueSide {
  return lines[lines.length - 1]?.side === "left" ? "right" : "left";
}

const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2a3026"/>
        <stop offset="1" stop-color="#c45c26"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#g)"/>
    <circle cx="1180" cy="260" r="180" fill="#d4a84b" fill-opacity="0.25"/>
    <circle cx="1280" cy="620" r="260" fill="#10120e" fill-opacity="0.35"/>
  </svg>`,
)}`;

export function emptyScene(lang: LangId = "zh", layout: LayoutId = "cover"): Scene {
  const items =
    layout === "bullets" || layout === "steps" || layout === "threeCol" || layout === "cards"
      ? [
          { id: uid("it"), i18n: { [lang]: "要点一" } },
          { id: uid("it"), i18n: { [lang]: "要点二" } },
          { id: uid("it"), i18n: { [lang]: "要点三" } },
        ]
      : layout === "compare"
        ? [
            { id: uid("it"), i18n: { [lang]: "观点 A" } },
            { id: uid("it"), i18n: { [lang]: "观点 B" } },
          ]
        : undefined;
  const dialogue = layout === "dialogue" ? defaultDialogueLines(lang) : undefined;
  return {
    id: uid("sc"),
    name: "新场景",
    layoutId: layout,
    narration: t18(lang, "在这里写下口播稿。"),
    slots: {
      title: t18(lang, "场景标题"),
      subtitle: t18(lang, "副标题"),
      body: t18(lang, "在这里填写正文。"),
      caption: t18(lang, "图说"),
      quote: t18(lang, "一句能记住的话。"),
      author: t18(lang, "出处"),
      number: t18(lang, "42"),
      items,
      dialogue,
      image: PLACEHOLDER,
    },
    cues: defaultCues(layout, items, undefined, dialogue),
    narrationClose: t18(lang, ""),
    bg: DEFAULT_SCENE_BG,
  };
}

export function sampleProject(): Project {
  const lang: LangId = "zh";
  const sc = (
    name: string,
    layout: LayoutId,
    open: string,
    slots: Scene["slots"],
    extra?: { close?: string; speak?: Record<string, string> },
  ): Scene => {
    const items = slots.items;
    const dialogue = slots.dialogue;
    const speak: Scene["speak"] = {};
    if (extra?.speak) {
      for (const [k, v] of Object.entries(extra.speak)) speak[k] = t18(lang, v);
    }
    return {
      id: uid("sc"),
      name,
      layoutId: layout,
      narration: t18(lang, open),
      narrationClose: extra?.close ? t18(lang, extra.close) : t18(lang, ""),
      speak,
      slots: { image: PLACEHOLDER, ...slots },
      cues: defaultCues(layout, items, undefined, dialogue),
      bg: DEFAULT_SCENE_BG,
    };
  };

    const miss = [
      { id: uid("it"), i18n: { zh: "会把整个星系一口吞掉" } },
      { id: uid("it"), i18n: { zh: "是通往异世界的传送门" } },
      { id: uid("it"), i18n: { zh: "靠近就会立刻被吸走" } },
    ];
    const steps = [
      { id: uid("it"), i18n: { zh: "燃料耗尽，辐射压下降" } },
      { id: uid("it"), i18n: { zh: "核心被自身引力压垮" } },
      { id: uid("it"), i18n: { zh: "若质量足够，坍缩成黑洞" } },
    ];

    const voices = defaultVoiceProfiles();
    return {
    name: "黑洞不是洞",
    sourceLang: "zh",
    previewLang: "zh",
    aspect: "16:9",
    ttsProvider: "qwen",
    voices,
    voiceId: "",
    voiceByLang: defaultVoiceByLang(voices),
    showCaptions: false,
    bilingualCaptions: false,
    showTopProgress: false,
    fontId: DEFAULT_FONT_ID,
    titleFontId: DEFAULT_TITLE_FONT_ID,
    subtitleFontId: DEFAULT_SUBTITLE_FONT_ID,
    quoteFontId: DEFAULT_QUOTE_FONT_ID,
    captionFontId: DEFAULT_CAPTION_FONT_ID,
    captionStyle: { ...DEFAULT_CAPTION_STYLE },
    progressStyle: { ...DEFAULT_PROGRESS_STYLE },
    listMarkerStyle: { ...DEFAULT_LIST_MARKER_STYLE },
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
    holdMs: DEFAULT_HOLD_MS,
    openPadBeforeMs: DEFAULT_OPEN_PAD_BEFORE_MS,
    openPadAfterMs: DEFAULT_OPEN_PAD_AFTER_MS,
    closePadBeforeMs: DEFAULT_CLOSE_PAD_BEFORE_MS,
    closePadAfterMs: DEFAULT_CLOSE_PAD_AFTER_MS,
    transition: DEFAULT_TRANSITION,
    transitionMs: DEFAULT_TRANSITION_MS,
    scenes: [
      sc(
        "开场",
        "cover",
        "黑洞，并不是宇宙里的一个洞。",
        {
          title: t18(lang, "黑洞不是洞"),
          subtitle: t18(lang, "三分钟看懂事件视界"),
        },
        {
          speak: { title: "我们先记住这句话：黑洞不是洞。" },
          close: "它是质量大到连光都逃不出去的天体。",
        },
      ),
      sc(
        "事件视界",
        "splitLeft",
        "先看这张图。",
        {
          title: t18(lang, "事件视界"),
          body: t18(lang, "它不是实体的墙，而是时空弯曲到极致后，连光也回不来的分界。"),
        },
        {
          speak: {
            title: "事件视界是一道看不见的边界。",
            body: "一旦越过，就再也无法把信号传回外面的宇宙。",
          },
        },
      ),
      sc(
        "误解",
        "bullets",
        "关于黑洞，有三个常见误解。",
        {
          title: t18(lang, "三个常见误解"),
          items: miss,
        },
        {
          speak: {
            title: "一个一个来看。",
            [itemSpeakKey(miss[0].id)]: "它并不会把整个星系一口吞掉，只影响靠近的物质。",
            [itemSpeakKey(miss[1].id)]: "它也不是通往异世界的传送门，那是电影里的想象。",
            [itemSpeakKey(miss[2].id)]: "更不是靠近就会立刻被吸走，安全距离之外可以稳定绕转。",
          },
        },
      ),
      sc(
        "金句",
        "quote",
        "霍金曾经说，",
        {
          number: t18(lang, "ħ"),
          quote: t18(lang, "黑洞并不那么黑。"),
          author: t18(lang, "史蒂芬·霍金"),
        },
        {
          speak: {
            quote: "黑洞并不那么黑。",
            author: "它们也会缓慢辐射，最终蒸发。",
          },
        },
      ),
      sc(
        "坍缩",
        "steps",
        "大质量恒星燃料耗尽之后，会怎样？",
        {
          title: t18(lang, "恒星如何坍缩"),
          items: steps,
        },
        {
          speak: {
            [itemSpeakKey(steps[0].id)]: "燃料耗尽，向外的辐射压下降。",
            [itemSpeakKey(steps[1].id)]: "核心被自身引力压垮。",
            [itemSpeakKey(steps[2].id)]: "若剩余质量足够，就会坍缩成黑洞。",
          },
        },
      ),
      sc(
        "结尾",
        "fullImage",
        "下一次抬头看夜空，",
        {
          caption: t18(lang, "最暗的地方，藏着最极端的物理"),
        },
        {
          speak: { caption: "记得：最暗的地方，往往藏着最极端的物理。" },
        },
      ),
    ],
  };
}

export function emptyProject(name = DEFAULT_PROJECT_NAME): Project {
  const voices = defaultVoiceProfiles();
  return {
    name,
    sourceLang: "zh",
    previewLang: "zh",
    aspect: "16:9",
    ttsProvider: "qwen",
    voices,
    voiceId: "",
    voiceByLang: defaultVoiceByLang(voices),
    showCaptions: false,
    bilingualCaptions: false,
    showTopProgress: false,
    fontId: DEFAULT_FONT_ID,
    titleFontId: DEFAULT_TITLE_FONT_ID,
    subtitleFontId: DEFAULT_SUBTITLE_FONT_ID,
    quoteFontId: DEFAULT_QUOTE_FONT_ID,
    captionFontId: DEFAULT_CAPTION_FONT_ID,
    captionStyle: { ...DEFAULT_CAPTION_STYLE },
    progressStyle: { ...DEFAULT_PROGRESS_STYLE },
    listMarkerStyle: { ...DEFAULT_LIST_MARKER_STYLE },
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
    holdMs: DEFAULT_HOLD_MS,
    openPadBeforeMs: DEFAULT_OPEN_PAD_BEFORE_MS,
    openPadAfterMs: DEFAULT_OPEN_PAD_AFTER_MS,
    closePadBeforeMs: DEFAULT_CLOSE_PAD_BEFORE_MS,
    closePadAfterMs: DEFAULT_CLOSE_PAD_AFTER_MS,
    transition: DEFAULT_TRANSITION,
    transitionMs: DEFAULT_TRANSITION_MS,
    scenes: [emptyScene("zh", "cover")],
  };
}

function finiteMs(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, value as number);
}

function finiteLead(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.round(Math.max(-10_000, Math.min(10_000, value as number)));
}

function asBind(value: Scene["cues"][number]["bind"]): Scene["cues"][number]["bind"] {
  return value === "speak" || value === "visual" ? value : undefined;
}

function asStay(value: Scene["cues"][number]["stay"]): Scene["cues"][number]["stay"] {
  return value === "speech" || value === "body" ? value : undefined;
}

function asTransition(value: SceneTransition | undefined): SceneTransition | undefined {
  return value === "cut" || value === "crossfade" ? value : undefined;
}

function asFit(value: Scene["bgFit"]): Scene["bgFit"] {
  return value === "contain" || value === "cover" ? value : undefined;
}

function finite01(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value as number));
}

export function asCssHex(value: string | undefined, fallback = DEFAULT_SCENE_BG): string {
  const s = (value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return fallback;
}

export function sceneBgFit(scene: Pick<Scene, "bgFit">): "cover" | "contain" {
  return scene.bgFit === "contain" ? "contain" : "cover";
}

export function sceneBgDim(scene: Pick<Scene, "bgDim">): number {
  return finite01(scene.bgDim) ?? 0;
}

export function normalizeProject(data: Project): Project {
  const base = emptyProject(data.name || DEFAULT_PROJECT_NAME);
  const scenes = (data.scenes?.length ? data.scenes : base.scenes).map((s) => ({
    ...s,
    cues: (s.cues ?? []).map((c) => ({
      ...c,
      until: c.until ?? 1,
      bind: asBind(c.bind),
      stay: asStay(c.stay),
      leadMs: finiteLead(c.leadMs),
      trailMs: finiteMs(c.trailMs),
    })),
    holdMs: finiteMs(s.holdMs),
    openPadBeforeMs: finiteMs(s.openPadBeforeMs),
    openPadAfterMs: finiteMs(s.openPadAfterMs),
    closePadBeforeMs: finiteMs(s.closePadBeforeMs),
    closePadAfterMs: finiteMs(s.closePadAfterMs),
    transition: asTransition(s.transition),
    transitionMs: finiteMs(s.transitionMs),
    bg: asCssHex(s.bg),
    bgImage: typeof s.bgImage === "string" && s.bgImage.trim() ? s.bgImage : undefined,
    bgFit: asFit(s.bgFit),
    bgDim: finite01(s.bgDim),
    blocks: s.blocks?.map((b) => {
      const name = asNameI18n(b.name, data.sourceLang ?? "zh");
      return name ? { ...b, name } : { ...b, name: undefined };
    }),
  }));
  return {
    ...base,
    ...data,
    ttsProvider: "qwen",
    voices: (Array.isArray(data.voices) ? data.voices : base.voices).filter((v) => !v.provider || v.provider === "qwen"),
    voiceByLang: data.voiceByLang ?? base.voiceByLang,
    voiceId: typeof data.voiceId === "string" && data.voiceId.trim()
      ? data.voiceId
      : data.voiceByLang
        ? (Object.values(data.voiceByLang).find(Boolean) as string | undefined) ?? ""
        : "",
    showCaptions: data.showCaptions === true,
    bilingualCaptions: data.bilingualCaptions === true,
    bilingualCaptionLang: isLangId(data.bilingualCaptionLang as string) ? data.bilingualCaptionLang : undefined,
    showTopProgress: data.showTopProgress === true,
    fontId: isStageFontId(data.fontId) ? data.fontId : DEFAULT_FONT_ID,
    titleFontId: isStageFontId(data.titleFontId) ? data.titleFontId : DEFAULT_TITLE_FONT_ID,
    subtitleFontId: isStageFontId(data.subtitleFontId) ? data.subtitleFontId : isStageFontId(data.fontId) ? data.fontId : DEFAULT_SUBTITLE_FONT_ID,
    quoteFontId: isStageFontId(data.quoteFontId) ? data.quoteFontId : isStageFontId(data.titleFontId) ? data.titleFontId : DEFAULT_QUOTE_FONT_ID,
    captionFontId: isStageFontId(data.captionFontId) ? data.captionFontId : isStageFontId(data.fontId) ? data.fontId : DEFAULT_CAPTION_FONT_ID,
    captionStyle: captionStyleOf(data.captionStyle),
    progressStyle: progressStyleOf(data.progressStyle),
    listMarkerStyle: listMarkerStyleOf(data.listMarkerStyle),
    exportSettings: exportSettingsOf(data.exportSettings),
    holdMs: finiteMs(data.holdMs) ?? DEFAULT_HOLD_MS,
    openPadBeforeMs: finiteMs(data.openPadBeforeMs) ?? DEFAULT_OPEN_PAD_BEFORE_MS,
    openPadAfterMs: finiteMs(data.openPadAfterMs) ?? DEFAULT_OPEN_PAD_AFTER_MS,
    closePadBeforeMs: finiteMs(data.closePadBeforeMs) ?? DEFAULT_CLOSE_PAD_BEFORE_MS,
    closePadAfterMs: finiteMs(data.closePadAfterMs) ?? DEFAULT_CLOSE_PAD_AFTER_MS,
    transition: asTransition(data.transition) ?? DEFAULT_TRANSITION,
    transitionMs: finiteMs(data.transitionMs) ?? DEFAULT_TRANSITION_MS,
    scenes,
  };
}

export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text) as Project;
  if (!data || !Array.isArray(data.scenes)) throw new Error("不是有效的 web2video 工程");
  return normalizeProject(data);
}
