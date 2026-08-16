import { uid } from "./ids";
import { defaultCues } from "./blocks";
import { t18 } from "./scriptSplit";
import { defaultVoiceByLang, defaultVoiceProfiles } from "./ttsSecrets";
import type { LayoutId, Project, Scene } from "../types";
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
    bg: "#141811",
  };
}

export function sampleProject(): Project {
  const lang: LangId = "zh";
  const sc = (
    name: string,
    layout: LayoutId,
    narration: string,
    slots: Scene["slots"],
  ): Scene => {
    const items = slots.items;
    return {
      id: uid("sc"),
      name,
      layoutId: layout,
      narration: t18(lang, narration),
      slots: { image: PLACEHOLDER, ...slots },
      cues: defaultCues(layout, items),
      bg: "#141811",
    };
  };

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
    scenes: [
      sc("开场", "cover", "黑洞，并不是宇宙里的一个洞。它是质量大到连光都逃不出去的天体。", {
        title: t18(lang, "黑洞不是洞"),
        subtitle: t18(lang, "三分钟看懂事件视界"),
      }),
      sc(
        "事件视界",
        "splitLeft",
        "事件视界是一道看不见的边界。一旦越过，就再也无法把信号传回外面的宇宙。",
        {
          title: t18(lang, "事件视界"),
          body: t18(lang, "它不是实体的墙，而是时空弯曲到极致后，连光也回不来的分界。"),
        },
      ),
      sc("误解", "bullets", "关于黑洞，有三个常见误解：它会吞噬一切、它是通往异世界的门、靠近就会被立刻吸走。", {
        title: t18(lang, "三个常见误解"),
        items: [
          { id: uid("it"), i18n: { zh: "会把整个星系一口吞掉" } },
          { id: uid("it"), i18n: { zh: "是通往异世界的传送门" } },
          { id: uid("it"), i18n: { zh: "靠近就会立刻被吸走" } },
        ],
      }),
      sc("金句", "quote", "霍金曾经说，黑洞并不那么黑。它们也会缓慢辐射，最终蒸发。", {
        number: t18(lang, "ħ"),
        quote: t18(lang, "黑洞并不那么黑。"),
        author: t18(lang, "史蒂芬·霍金"),
      }),
      sc("坍缩", "steps", "大质量恒星燃料耗尽后，核心失去支撑，层层坍缩，最终可能形成黑洞。", {
        title: t18(lang, "恒星如何坍缩"),
        items: [
          { id: uid("it"), i18n: { zh: "燃料耗尽，辐射压下降" } },
          { id: uid("it"), i18n: { zh: "核心被自身引力压垮" } },
          { id: uid("it"), i18n: { zh: "若质量足够，坍缩成黑洞" } },
        ],
      }),
      sc("结尾", "fullImage", "下一次抬头看夜空，记得：最暗的地方，往往藏着最极端的物理。", {
        caption: t18(lang, "最暗的地方，藏着最极端的物理"),
      }),
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
    scenes: [emptyScene("zh", "cover")],
  };
}

export function normalizeProject(data: Project): Project {
  const base = emptyProject(data.name || DEFAULT_PROJECT_NAME);
  const scenes = (data.scenes?.length ? data.scenes : base.scenes).map((s) => ({
    ...s,
    cues: (s.cues ?? []).map((c) => ({ ...c, until: c.until ?? 1 })),
  }));
  return {
    ...base,
    ...data,
    ttsProvider: data.ttsProvider ?? "edge",
    voices: data.voices?.length ? data.voices : base.voices,
    voiceByLang: data.voiceByLang ?? base.voiceByLang,
    scenes,
  };
}

export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text) as Project;
  if (!data || !Array.isArray(data.scenes)) throw new Error("不是有效的 web2video 工程");
  return normalizeProject(data);
}
