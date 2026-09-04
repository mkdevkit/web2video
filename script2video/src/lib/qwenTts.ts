import type { LangId } from "./langs";
import { isTauri } from "./platform";
import { loadTtsSecrets } from "./ttsSecrets";

export const QWEN_LANG: Record<LangId, string> = {
  zh: "Chinese",
  en: "English",
  ja: "Japanese",
  fr: "French",
  de: "German",
  ru: "Russian",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
};

type Json = Record<string, unknown>;

function asRecord(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}

function errOf(data: Json, fallback: string): string {
  const msg = data.message ?? data.error ?? data.msg;
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

async function postQwen(path: "/__tts/qwen" | "/__tts/qwen-voice", body: unknown): Promise<Json> {
  const secrets = loadTtsSecrets();
  if (!secrets.dashscopeKey.trim()) throw new Error("请先在配音窗口填写千问 API Key");

  if (isTauri() && !import.meta.env.DEV) {
    const { invoke } = await import("@tauri-apps/api/core");
    const cmd = path === "/__tts/qwen-voice" ? "qwen_customize" : "qwen_generate";
    const data = asRecord(
      await invoke<Json>(cmd, {
        key: secrets.dashscopeKey,
        base: secrets.dashscopeBaseUrl,
        body,
      }),
    );
    if (typeof data.error === "string" && data.error) throw new Error(data.error);
    return data;
  }

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tts-key": secrets.dashscopeKey,
      "x-tts-base": secrets.dashscopeBaseUrl,
    },
    body: JSON.stringify(body),
  });
  const data = asRecord(await res.json().catch(() => ({})));
  if (!res.ok) throw new Error(errOf(data, `千问请求失败 ${res.status}`));
  return data;
}

export async function qwenCustomize(body: unknown): Promise<Json> {
  const data = await postQwen("/__tts/qwen-voice", body);
  if (typeof data.code === "string" && data.code) throw new Error(errOf(data, "千问音色失败"));
  return data;
}

function outputOf(data: Json): Json {
  return asRecord(data.output);
}

export function qwenVoiceId(data: Json): string {
  const out = outputOf(data);
  const voice = out.voice ?? out.voice_id;
  if (typeof voice === "string" && voice.trim()) return voice.trim();
  throw new Error("千问未返回音色 ID");
}

export function qwenPreviewBase64(data: Json): { b64: string; type: string } | null {
  const preview = asRecord(outputOf(data).preview_audio);
  const raw = preview.data;
  if (typeof raw !== "string" || !raw) return null;
  const m = /^data:([^;]+);base64,(.+)$/.exec(raw);
  if (m) return { b64: m[2], type: m[1] };
  return { b64: raw, type: "audio/wav" };
}

export async function qwenListVoices(model: "qwen-voice-design" | "qwen-voice-enrollment"): Promise<
  { voice: string; targetModel: string }[]
> {
  const data = await qwenCustomize({
    model,
    input: { action: "list", page_size: 100, page_index: 0 },
  });
  const list = outputOf(data).voice_list ?? outputOf(data).voices;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      const r = asRecord(row);
      const voice = typeof r.voice === "string" ? r.voice : typeof r.voice_id === "string" ? r.voice_id : "";
      const targetModel = typeof r.target_model === "string" ? r.target_model : "";
      return { voice, targetModel };
    })
    .filter((r) => r.voice);
}

export async function qwenDeleteVoice(
  model: "qwen-voice-design" | "qwen-voice-enrollment",
  voice: string,
): Promise<void> {
  await qwenCustomize({ model, input: { action: "delete", voice } });
}

export async function qwenCreateDesign(opts: {
  prompt: string;
  previewText: string;
  preferredName: string;
  targetModel: string;
}): Promise<Json> {
  return qwenCustomize({
    model: "qwen-voice-design",
    input: {
      action: "create",
      target_model: opts.targetModel,
      preferred_name: opts.preferredName,
      voice_prompt: opts.prompt,
      preview_text: opts.previewText,
      language: "zh",
    },
    parameters: { sample_rate: 24000, response_format: "wav" },
  });
}

export async function qwenCreateClone(opts: {
  dataUri: string;
  preferredName: string;
  targetModel: string;
}): Promise<Json> {
  return qwenCustomize({
    model: "qwen-voice-enrollment",
    input: {
      action: "create",
      target_model: opts.targetModel,
      preferred_name: opts.preferredName,
      audio: { data: opts.dataUri },
    },
  });
}

export async function qwenSynthesize(opts: {
  text: string;
  voice: string;
  model: string;
  lang: LangId;
}): Promise<{ audioBase64: string; contentType: string }> {
  const data = await postQwen("/__tts/qwen", {
    text: opts.text,
    voice: opts.voice,
    model: opts.model,
    language_type: QWEN_LANG[opts.lang] ?? "Chinese",
  });
  const b64 = data.audioBase64;
  if (typeof b64 !== "string" || !b64) throw new Error(errOf(data, "千问未返回音频"));
  return { audioBase64: b64, contentType: typeof data.contentType === "string" ? data.contentType : "audio/wav" };
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("无法读取音频文件"));
    reader.readAsDataURL(file);
  });
}
