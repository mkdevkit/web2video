const KEY = "web2video.llm-secrets";

export type LlmProviderId = "deepseek" | "openai" | "compatible";

export interface LlmSecrets {
  provider: LlmProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash", label: "V4 Flash（快、便宜，适合日常分镜）" },
  { id: "deepseek-v4-pro", label: "V4 Pro（更强，适合复杂多场）" },
] as const;

const LEGACY_DEEPSEEK: Record<string, string> = {
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-flash",
};

export const LLM_PRESETS: Record<LlmProviderId, { label: string; baseUrl: string; model: string; hint: string }> = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    hint: "在 platform.deepseek.com 创建 API Key。V4 分 Flash（快）和 Pro（强）；旧名 deepseek-chat 已停用。",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "官方 Chat Completions。也可填兼容网关。",
  },
  compatible: {
    label: "兼容接口",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    hint: "任意 OpenAI 兼容服务：SiliconFlow、OpenRouter、Ollama（http://127.0.0.1:11434/v1）等。",
  },
};

const EMPTY: LlmSecrets = {
  provider: "deepseek",
  apiKey: "",
  baseUrl: LLM_PRESETS.deepseek.baseUrl,
  model: LLM_PRESETS.deepseek.model,
};

export function loadLlmSecrets(): LlmSecrets {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const data = JSON.parse(raw) as Partial<LlmSecrets>;
    return {
      provider: data.provider === "openai" || data.provider === "compatible" ? data.provider : "deepseek",
      apiKey: typeof data.apiKey === "string" ? data.apiKey : "",
      baseUrl: typeof data.baseUrl === "string" && data.baseUrl.trim() ? data.baseUrl : EMPTY.baseUrl,
      model: migrateModel(typeof data.model === "string" ? data.model : EMPTY.model),
    };
  } catch {
    return { ...EMPTY };
  }
}

function migrateModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return EMPTY.model;
  return LEGACY_DEEPSEEK[trimmed] ?? trimmed;
}

export function saveLlmSecrets(patch: Partial<LlmSecrets>) {
  const next = { ...loadLlmSecrets(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function chatCompletionsUrl(baseUrl: string): string {
  const b = baseUrl.trim().replace(/\/$/, "");
  if (b.endsWith("/chat/completions")) return b;
  return `${b}/chat/completions`;
}
