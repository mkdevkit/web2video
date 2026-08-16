import { uid } from "./ids";
import { defaultCues } from "./blocks";
import { t18 } from "./scriptSplit";
import { defaultVoiceByLang, defaultVoiceProfiles } from "./ttsSecrets";
import { DEFAULT_HOLD_MS, DEFAULT_TRANSITION, DEFAULT_TRANSITION_MS, DEFAULT_OPEN_PAD_BEFORE_MS, DEFAULT_OPEN_PAD_AFTER_MS, DEFAULT_CLOSE_PAD_BEFORE_MS, DEFAULT_CLOSE_PAD_AFTER_MS } from "./timeline";
import { itemSpeakKey } from "./narration";
import type { LayoutId, Project, Scene, SceneTransition } from "../types";
import type { LangId } from "./langs";

export const DEFAULT_PROJECT_NAME = "未命名口播";

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
      image: PLACEHOLDER,
    },
    cues: defaultCues(layout, items),
    narrationClose: t18(lang, ""),
    bg: "#141811",
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
      cues: defaultCues(layout, items),
      bg: "#141811",
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
    ttsProvider: "edge",
    voices,
    voiceByLang: defaultVoiceByLang(voices),
    showCaptions: true,
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
    ttsProvider: "edge",
    voices,
    voiceByLang: defaultVoiceByLang(voices),
    showCaptions: true,
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
  }));
  return {
    ...base,
    ...data,
    ttsProvider: data.ttsProvider ?? "edge",
    voices: data.voices?.length ? data.voices : base.voices,
    voiceByLang: data.voiceByLang ?? base.voiceByLang,
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
