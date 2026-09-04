export type LangId = "zh" | "en" | "ja" | "fr" | "de" | "ru" | "es" | "pt" | "it";

export interface LangMeta {
  id: LangId;
  label: string;
  native: string;
  html: string;
  cjk: boolean;
  sans: string;
}

export const LANGS: LangMeta[] = [
  {
    id: "zh",
    label: "中文",
    native: "中文",
    html: "zh-CN",
    cjk: true,
    sans: '"Noto Sans SC", "Noto Sans JP", "Noto Sans"',
  },
  {
    id: "en",
    label: "English",
    native: "English",
    html: "en",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
  {
    id: "ja",
    label: "日本語",
    native: "日本語",
    html: "ja",
    cjk: true,
    sans: '"Noto Sans JP", "Noto Sans SC", "Noto Sans"',
  },
  {
    id: "fr",
    label: "Français",
    native: "Français",
    html: "fr",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
  {
    id: "de",
    label: "Deutsch",
    native: "Deutsch",
    html: "de",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
  {
    id: "ru",
    label: "Русский",
    native: "Русский",
    html: "ru",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
  {
    id: "es",
    label: "Español",
    native: "Español",
    html: "es",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
  {
    id: "pt",
    label: "Português",
    native: "Português",
    html: "pt",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
  {
    id: "it",
    label: "Italiano",
    native: "Italiano",
    html: "it",
    cjk: false,
    sans: '"Noto Sans", "Noto Sans SC", "Noto Sans JP"',
  },
];

export const LANG_IDS = LANGS.map((l) => l.id);

export function langMeta(id: LangId): LangMeta {
  return LANGS.find((l) => l.id === id) ?? LANGS[0];
}

export function isLangId(v: string): v is LangId {
  return LANG_IDS.includes(v as LangId);
}

export const LANG_ZH: Record<LangId, string> = {
  zh: "中文",
  en: "英语",
  ja: "日语",
  fr: "法语",
  de: "德语",
  ru: "俄语",
  es: "西班牙语",
  pt: "葡萄牙语",
  it: "意大利语",
};

export function langZhName(id: LangId): string {
  return LANG_ZH[id] ?? id;
}
