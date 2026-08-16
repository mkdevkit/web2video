import type { LangId } from "./langs";
import type { VoiceProfile } from "../types";

const KEY = "web2video.tts-secrets";

export const QWEN_REGIONS = [
  { id: "beijing", label: "北京", baseUrl: "https://dashscope.aliyuncs.com" },
  { id: "singapore", label: "新加坡", baseUrl: "https://dashscope-intl.aliyuncs.com" },
] as const;

export const QWEN_VD_MODELS = ["qwen3-tts-vd-2026-01-26"] as const;
export const QWEN_VC_MODELS = ["qwen3-tts-vc-2026-01-22"] as const;

export interface TtsSecrets {
  azureKey: string;
  azureRegion: string;
  openaiKey: string;
  openaiModel: string;
  dashscopeKey: string;
  dashscopeBaseUrl: string;
  qwenVdModel: string;
  qwenVcModel: string;
}

const EMPTY: TtsSecrets = {
  azureKey: "",
  azureRegion: "eastasia",
  openaiKey: "",
  openaiModel: "tts-1-hd",
  dashscopeKey: "",
  dashscopeBaseUrl: QWEN_REGIONS[0].baseUrl,
  qwenVdModel: QWEN_VD_MODELS[0],
  qwenVcModel: QWEN_VC_MODELS[0],
};

export function loadTtsSecrets(): TtsSecrets {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<TtsSecrets>) };
  } catch {
    return { ...EMPTY };
  }
}

export function saveTtsSecrets(patch: Partial<TtsSecrets>) {
  const next = { ...loadTtsSecrets(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function dashscopeOrigin(baseUrl: string): string {
  const b = (baseUrl || EMPTY.dashscopeBaseUrl).trim().replace(/\/$/, "");
  return b.replace(/\/api\/v1.*$/, "") || EMPTY.dashscopeBaseUrl;
}

export function defaultVoiceProfiles(): VoiceProfile[] {
  return [];
}

export function defaultVoiceByLang(_voices?: VoiceProfile[]): Partial<Record<LangId, string>> {
  return {};
}
