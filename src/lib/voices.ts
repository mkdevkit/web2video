import type { LangId } from "./langs";
import type { TtsProvider, VoiceProfile } from "../types";
import { loadTimbres } from "./voiceLibrary";

export interface VoiceOpt {
  id: string;
  label: string;
  gender: "女" | "男";
}

export const VOICES: Record<LangId, VoiceOpt[]> = {
  zh: [
    { id: "zh-CN-XiaoxiaoNeural", label: "晓晓", gender: "女" },
    { id: "zh-CN-YunxiNeural", label: "云希", gender: "男" },
    { id: "zh-CN-XiaoyiNeural", label: "晓伊", gender: "女" },
    { id: "zh-CN-YunjianNeural", label: "云健", gender: "男" },
  ],
  en: [
    { id: "en-US-AriaNeural", label: "Aria", gender: "女" },
    { id: "en-US-GuyNeural", label: "Guy", gender: "男" },
    { id: "en-US-JennyNeural", label: "Jenny", gender: "女" },
  ],
  ja: [
    { id: "ja-JP-NanamiNeural", label: "七海", gender: "女" },
    { id: "ja-JP-KeitaNeural", label: "圭太", gender: "男" },
  ],
  fr: [
    { id: "fr-FR-DeniseNeural", label: "Denise", gender: "女" },
    { id: "fr-FR-HenriNeural", label: "Henri", gender: "男" },
  ],
  de: [
    { id: "de-DE-KatjaNeural", label: "Katja", gender: "女" },
    { id: "de-DE-ConradNeural", label: "Conrad", gender: "男" },
  ],
  ru: [
    { id: "ru-RU-SvetlanaNeural", label: "Svetlana", gender: "女" },
    { id: "ru-RU-DmitryNeural", label: "Dmitry", gender: "男" },
  ],
  es: [
    { id: "es-ES-ElviraNeural", label: "Elvira", gender: "女" },
    { id: "es-ES-AlvaroNeural", label: "Alvaro", gender: "男" },
  ],
  pt: [
    { id: "pt-BR-FranciscaNeural", label: "Francisca", gender: "女" },
    { id: "pt-BR-AntonioNeural", label: "Antonio", gender: "男" },
  ],
  it: [
    { id: "it-IT-ElsaNeural", label: "Elsa", gender: "女" },
    { id: "it-IT-DiegoNeural", label: "Diego", gender: "男" },
  ],
};

export const OPENAI_VOICES: VoiceOpt[] = [
  { id: "alloy", label: "Alloy", gender: "女" },
  { id: "echo", label: "Echo", gender: "男" },
  { id: "fable", label: "Fable", gender: "男" },
  { id: "onyx", label: "Onyx", gender: "男" },
  { id: "nova", label: "Nova", gender: "女" },
  { id: "shimmer", label: "Shimmer", gender: "女" },
];

export const DEFAULT_VOICE: Record<LangId, string> = {
  zh: "zh-CN-XiaoxiaoNeural",
  en: "en-US-AriaNeural",
  ja: "ja-JP-NanamiNeural",
  fr: "fr-FR-DeniseNeural",
  de: "de-DE-KatjaNeural",
  ru: "ru-RU-SvetlanaNeural",
  es: "es-ES-ElviraNeural",
  pt: "pt-BR-FranciscaNeural",
  it: "it-IT-ElsaNeural",
};

export const PROVIDER_LABEL: Record<TtsProvider, string> = {
  edge: "Edge（免费）",
  azure: "Azure Speech",
  openai: "OpenAI TTS",
  qwen: "千问 TTS",
};

export const PROVIDERS: TtsProvider[] = ["edge", "azure", "openai", "qwen"];

export function catalogFor(provider: TtsProvider, lang: LangId): VoiceOpt[] {
  if (provider === "openai") return OPENAI_VOICES;
  if (provider === "qwen") {
    return loadTimbres().map((t) => ({
      id: t.voice,
      label: t.name,
      gender: t.gender ?? "女",
    }));
  }
  return VOICES[lang];
}

export function voiceLabel(id: string): string {
  for (const list of Object.values(VOICES)) {
    const hit = list.find((v) => v.id === id);
    if (hit) return `${hit.label}（${hit.gender}）`;
  }
  const o = OPENAI_VOICES.find((v) => v.id === id);
  if (o) return `${o.label}（${o.gender}）`;
  return id;
}

export function qwenRoles(voices: VoiceProfile[] | undefined): VoiceProfile[] {
  return (voices ?? []).filter((v) => !v.provider || v.provider === "qwen");
}

export function profileLabel(p: VoiceProfile): string {
  return p.name;
}
