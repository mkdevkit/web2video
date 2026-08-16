import type { LangId } from "./langs";
import type { TtsProvider, VoiceProfile } from "../types";
import { DEFAULT_VOICE, VOICES } from "./voices";

const KEY = "web2video.tts-secrets";

export interface TtsSecrets {
  azureKey: string;
  azureRegion: string;
  openaiKey: string;
  openaiModel: string;
}

const EMPTY: TtsSecrets = {
  azureKey: "",
  azureRegion: "eastasia",
  openaiKey: "",
  openaiModel: "tts-1-hd",
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

export function defaultVoiceProfiles(): VoiceProfile[] {
  return (Object.keys(DEFAULT_VOICE) as LangId[]).map((lang) => {
    const id = DEFAULT_VOICE[lang];
    const meta = VOICES[lang].find((v) => v.id === id);
    return {
      id: `vp-${lang}`,
      name: meta ? `${meta.label}` : id,
      lang,
      provider: "edge" as TtsProvider,
      voiceId: id,
      gender: meta?.gender,
    };
  });
}

export function defaultVoiceByLang(voices: VoiceProfile[]): Partial<Record<LangId, string>> {
  const out: Partial<Record<LangId, string>> = {};
  for (const v of voices) {
    if (!out[v.lang]) out[v.lang] = v.id;
  }
  return out;
}
