export type LangId = "zh" | "en" | "ja" | "fr" | "de" | "ru" | "es" | "pt" | "it";

export interface LangMeta {
  id: LangId;
  label: string;
  native: string;
}

export const LANGS: LangMeta[] = [
  { id: "zh", label: "中文", native: "中文" },
  { id: "en", label: "英语", native: "English" },
  { id: "ja", label: "日语", native: "日本語" },
  { id: "fr", label: "法语", native: "Français" },
  { id: "de", label: "德语", native: "Deutsch" },
  { id: "ru", label: "俄语", native: "Русский" },
  { id: "es", label: "西语", native: "Español" },
  { id: "pt", label: "葡语", native: "Português" },
  { id: "it", label: "意语", native: "Italiano" },
];

export const LANG_IDS = LANGS.map((l) => l.id);

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
