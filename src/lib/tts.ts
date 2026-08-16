import { langMeta, type LangId } from "./langs";
import { DEFAULT_VOICE } from "./voices";
import { measureDuration, putAudioFromBase64 } from "./audioStore";
import { loadTtsSecrets } from "./ttsSecrets";
import type { Project, SceneAudio, TtsProvider, WordTs } from "../types";

interface SynthRes {
  audioBase64?: string;
  contentType?: string;
  words?: WordTs[];
  error?: string;
}

export function resolveVoice(
  project: Project,
  lang: LangId,
): { provider: TtsProvider; voiceId: string } {
  const raw = project.voiceByLang[lang];
  const hit = (project.voices ?? []).find((v) => v.id === raw);
  if (hit) return { provider: hit.provider, voiceId: hit.voiceId };
  if (raw?.includes("Neural")) return { provider: "edge", voiceId: raw };
  if (raw && ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(raw)) {
    return { provider: "openai", voiceId: raw };
  }
  return { provider: project.ttsProvider ?? "edge", voiceId: DEFAULT_VOICE[lang] };
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<SynthRes> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as SynthRes;
  if (!res.ok || !data.audioBase64) throw new Error(data.error || "TTS 失败");
  return data;
}

export async function synthesizeScene(
  sceneId: string,
  lang: LangId,
  text: string,
  voice?: string,
  provider?: TtsProvider,
): Promise<SceneAudio> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("口播稿为空");
  const secrets = loadTtsSecrets();
  const engine = provider ?? "edge";
  const voiceId = voice || DEFAULT_VOICE[lang];
  let data: SynthRes;

  if (engine === "azure") {
    if (!secrets.azureKey.trim()) throw new Error("请先在配音面板填写 Azure Key");
    data = await postJson(
      "/__tts/azure",
      { text: trimmed, voice: voiceId, lang: langMeta(lang).html },
      { "x-tts-key": secrets.azureKey, "x-tts-region": secrets.azureRegion || "eastasia" },
    );
  } else if (engine === "openai") {
    if (!secrets.openaiKey.trim()) throw new Error("请先在配音面板填写 OpenAI API Key");
    data = await postJson(
      "/__tts/openai",
      { text: trimmed, voice: voiceId, model: secrets.openaiModel || "tts-1-hd" },
      { "x-tts-key": secrets.openaiKey },
    );
  } else {
    data = await postJson("/__edge_tts/synthesize", {
      text: trimmed,
      voice: voiceId,
      lang: langMeta(lang).html,
    });
  }

  const blob = await putAudioFromBase64(sceneId, lang, data.audioBase64!, data.contentType || "audio/mpeg");
  const durationMs = await measureDuration(blob);
  return {
    src: `media/${lang}/${sceneId}.mp3`,
    durationMs,
    voice: voiceId,
    words: data.words ?? [],
    stale: false,
  };
}
