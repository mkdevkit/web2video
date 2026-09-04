import type { LangId } from "./langs";
import type { StageCopy } from "../types";

const SKIP = new Set([
  "STYLE",
  "SCRIPT",
  "BR",
  "HR",
  "PATH",
  "CIRCLE",
  "RECT",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "POLYLINE",
  "USE",
  "DEFS",
  "CLIPPATH",
  "MASK",
  "IMAGE",
  "FILTER",
  "LINEARGRADIENT",
  "RADIALGRADIENT",
]);

function cssEscape(id: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(id);
  return id.replace(/([^\w-])/g, "\\$1");
}

function visibleText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 有字母/汉字等可译文字。纯符号、纯数字、省略号不进文本页。 */
export function hasTranslatableCopy(s: string | undefined): boolean {
  return /\p{L}/u.test((s ?? "").trim());
}

function nthPath(el: Element): string {
  const parts: string[] = [];
  let n: Element | null = el;
  while (n && n.parentElement) {
    if (n.id) {
      parts.unshift(`#${cssEscape(n.id)}`);
      break;
    }
    const p: Element = n.parentElement;
    const idx = [...p.children].indexOf(n) + 1;
    parts.unshift(`:nth-child(${idx})`);
    n = p;
  }
  return parts.join(" > ");
}

function locFor(el: Element): { id: string; sel: string } {
  const data = (el.getAttribute("data-text") ?? "").trim();
  if (data) return { id: data, sel: `[data-text="${cssEscape(data)}"]` };
  if (el.id) return { id: el.id, sel: `#${cssEscape(el.id)}` };
  return { id: "", sel: nthPath(el) };
}

function walk(el: Element, parentId: string | null, out: { id: string; sel: string; text: string }[]) {
  if (SKIP.has(el.tagName)) return;
  const kids = [...el.children].filter((c) => !SKIP.has(c.tagName));
  if (kids.some((c) => hasTranslatableCopy(visibleText(c)))) {
    const nextParent = (el.getAttribute("data-text") ?? "").trim() || el.id || parentId;
    for (const c of kids) {
      if (hasTranslatableCopy(visibleText(c))) walk(c, nextParent, out);
    }
    return;
  }
  const text = visibleText(el);
  if (!hasTranslatableCopy(text)) return;
  const loc = locFor(el);
  let id = loc.id || (parentId ? `${parentId}__${out.filter((r) => r.id.startsWith(`${parentId}__`)).length}` : `t${out.length}`);
  if (out.some((r) => r.id === id)) id = `${id}_${out.length}`;
  out.push({ id, sel: loc.sel, text });
}

export function extractStageCopies(html: string): { id: string; sel: string; text: string }[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div id="__stage_wrap">${html}</div>`, "text/html");
  const wrap = doc.getElementById("__stage_wrap");
  if (!wrap) return [];
  const out: { id: string; sel: string; text: string }[] = [];
  for (const child of wrap.children) walk(child, null, out);
  return out;
}

export function displayCopy(text: Partial<Record<LangId, string>> | undefined, lang: LangId, source: LangId): string {
  return (text?.[lang] || text?.[source] || "").trim();
}

export function syncStageTexts(
  html: string,
  existing: StageCopy[] | undefined,
  source: LangId,
): StageCopy[] {
  const extracted = extractStageCopies(html);
  const prev = new Map((existing ?? []).map((t) => [t.id, t]));
  return extracted.map((ex) => {
    const old = prev.get(ex.id);
    const text = { ...(old?.text ?? {}) };
    if (!text[source]?.trim() || old?.extracted !== ex.text) text[source] = ex.text;
    return { id: ex.id, sel: ex.sel, extracted: ex.text, text };
  });
}

export function stageTextsChanged(a: StageCopy[] | undefined, b: StageCopy[]): boolean {
  const x = a ?? [];
  if (x.length !== b.length) return true;
  return x.some((row, i) => row.id !== b[i].id || row.sel !== b[i].sel || row.extracted !== b[i].extracted);
}

export function applyStageTexts(root: HTMLElement, copies: StageCopy[] | undefined, lang: LangId, source: LangId) {
  if (!copies?.length) return;
  for (const row of copies) {
    let el: Element | null = null;
    try {
      el = root.querySelector(row.sel);
    } catch {
      el = null;
    }
    if (!el) continue;
    const next = displayCopy(row.text, lang, source);
    if (next) el.textContent = next;
  }
}

export function createStageApi(copies: StageCopy[] | undefined, lang: LangId, source: LangId) {
  const map = new Map((copies ?? []).map((t) => [t.id, t]));
  return {
    text(id: string) {
      return displayCopy(map.get(id)?.text, lang, source);
    },
    ids() {
      return [...map.keys()];
    },
  };
}
