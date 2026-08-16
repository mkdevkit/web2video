import { uid } from "./ids";
import { defaultCues } from "./blocks";
import type { LayoutId, ListItem, Scene, SceneSlots, TextI18n } from "../types";
import type { LangId } from "./langs";

export function t18(lang: LangId, text: string): TextI18n {
  return { i18n: { [lang]: text } };
}

export function guessLayout(title: string, body: string, items: string[]): LayoutId {
  if (items.length >= 4) return "cards";
  if (items.length >= 3) return "bullets";
  if (items.length >= 2) return "steps";
  if (body.length < 40 && title.length < 24) return "quote";
  if (body.length > 20) return "splitLeft";
  return "cover";
}

function parseItems(body: string): { rest: string; items: string[] } {
  const lines = body.split("\n");
  const items: string[] = [];
  const other: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (m) items.push(m[1].trim());
    else other.push(line);
  }
  return { rest: other.join("\n").trim(), items };
}

export function splitScript(md: string, lang: LangId = "zh"): Scene[] {
  const text = md.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  if (/^#{1,3}\s/m.test(text)) {
    const parts = text.split(/^(?=#{1,3}\s)/m).map((p) => p.trim()).filter(Boolean);
    chunks.push(...parts);
  } else {
    chunks.push(...text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean));
  }

  return chunks.map((chunk, i) => {
    const lines = chunk.split("\n");
    let title = "";
    let rest = chunk;
    const hm = lines[0].match(/^#{1,3}\s+(.*)$/);
    if (hm) {
      title = hm[1].trim();
      rest = lines.slice(1).join("\n").trim();
    }
    const parsed = parseItems(rest);
    const body = parsed.rest;
    if (!title) title = (body || parsed.items[0] || `场景 ${i + 1}`).slice(0, 18);
    const layout = i === 0 && chunks.length > 1 ? "cover" : guessLayout(title, body, parsed.items);
    const items: ListItem[] = parsed.items.map((t) => ({ id: uid("it"), i18n: { [lang]: t } }));
    const slots: SceneSlots = {
      title: t18(lang, title),
      subtitle: layout === "cover" ? t18(lang, body.split("\n")[0] ?? "") : undefined,
      body: layout === "cover" ? undefined : t18(lang, body),
      quote: layout === "quote" ? t18(lang, body || title) : undefined,
      author: layout === "quote" ? t18(lang, "") : undefined,
      items: items.length ? items : undefined,
      caption: layout === "fullImage" ? t18(lang, body || title) : undefined,
    };
    const speak = Object.fromEntries(items.map((it) => [`item:${it.id}`, t18(lang, it.i18n[lang] ?? "")]));
    const narration = t18(lang, [title, body].filter(Boolean).join("。") || parsed.items.join("。"));
    return {
      id: uid("sc"),
      name: title.slice(0, 16) || `场景 ${i + 1}`,
      layoutId: layout,
      narration,
      narrationClose: t18(lang, ""),
      speak,
      slots,
      cues: defaultCues(layout, items),
      bg: "#141811",
    } satisfies Scene;
  });
}
