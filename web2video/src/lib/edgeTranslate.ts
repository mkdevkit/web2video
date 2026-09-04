import type { LangId } from "./langs";
import { isTauri } from "./platform";

export const MS_LANG: Record<LangId, string> = {
  zh: "zh-Hans",
  en: "en",
  ja: "ja",
  fr: "fr",
  de: "de",
  ru: "ru",
  es: "es",
  pt: "pt",
  it: "it",
};

const DIRECT = "https://edge.microsoft.com/translate/translatetext";
const PROXY = "/__edge_translate/translatetext";

type EdgeRow = {
  text?: string;
  translations?: { text?: string }[];
};

function parseTranslations(data: unknown, fallback: string[]): string[] {
  if (!Array.isArray(data)) return fallback;
  return data.map((row, i) => {
    if (typeof row === "string") return row || fallback[i];
    if (row && typeof row === "object") {
      const r = row as EdgeRow;
      return r.translations?.[0]?.text ?? r.text ?? fallback[i];
    }
    return fallback[i];
  });
}

async function postTranslate(url: string, texts: string[], from: LangId, to: LangId): Promise<string[]> {
  const qs = new URLSearchParams({
    from: MS_LANG[from],
    to: MS_LANG[to],
    isEnterpriseClient: "false",
  });
  const res = await fetch(`${url}?${qs.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(texts),
  });
  if (!res.ok) {
    const hint = await res.text().catch(() => "");
    throw new Error(`Edge 翻译失败 ${res.status}${hint ? `: ${hint.slice(0, 120)}` : ""}`);
  }
  return parseTranslations(await res.json(), texts);
}

async function viaEdgeApi(texts: string[], from: LangId, to: LangId): Promise<string[]> {
  const errors: string[] = [];
  for (const url of [PROXY, DIRECT]) {
    try {
      return await postTranslate(url, texts, from, to);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join("；") || "Edge 翻译失败");
}

export async function translateTexts(texts: string[], from: LangId, to: LangId): Promise<string[]> {
  if (from === to) return [...texts];
  const packed = texts.map((t) => t.trim());
  if (!packed.some(Boolean)) return packed;

  if (isTauri() && !import.meta.env.DEV) {
    const { invoke } = await import("@tauri-apps/api/core");
    const rows = await invoke<string[]>("edge_translate", { texts: packed, from: MS_LANG[from], to: MS_LANG[to] });
    return rows.map((t, i) => t || packed[i]);
  }

  return viaEdgeApi(packed, from, to);
}

export async function translateText(text: string, from: LangId, to: LangId): Promise<string> {
  const [out] = await translateTexts([text], from, to);
  return out ?? text;
}
