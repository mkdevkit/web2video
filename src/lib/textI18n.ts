import type { LangId } from "./langs";
import type { ListItem, Project, Scene, TextI18n } from "../types";

export function sourceLangOf(project: Project): LangId {
  return project.sourceLang ?? "zh";
}

export function displayI18n(i18n: Partial<Record<LangId, string>> | undefined, lang: LangId, source: LangId): string {
  return i18n?.[lang] || i18n?.[source] || "";
}

export function writeI18n(
  i18n: Partial<Record<LangId, string>> | undefined,
  lang: LangId,
  source: LangId,
  value: string,
): Partial<Record<LangId, string>> {
  const next = { ...(i18n ?? {}), [lang]: value };
  if (lang === source || !next[source]) next[source] = lang === source ? value : next[source] ?? value;
  return next;
}

export function textOf(slot: TextI18n | undefined, lang: LangId, source: LangId): string {
  return displayI18n(slot?.i18n, lang, source);
}

export function itemText(item: ListItem, lang: LangId, source: LangId): string {
  return displayI18n(item.i18n, lang, source);
}

export type I18nRowKind = "narration" | "title" | "subtitle" | "body" | "caption" | "quote" | "author" | "number" | "item";

export interface I18nRow {
  sceneId: string;
  sceneName: string;
  kind: I18nRowKind;
  itemId?: string;
  label: string;
  i18n: Partial<Record<LangId, string>>;
}

const KIND_LABEL: Record<Exclude<I18nRowKind, "item">, string> = {
  narration: "口播",
  title: "标题",
  subtitle: "副标题",
  body: "正文",
  caption: "字幕/说明",
  quote: "金句",
  author: "署名",
  number: "数字",
};

export function collectI18nRows(project: Project): I18nRow[] {
  const rows: I18nRow[] = [];
  for (const scene of project.scenes) {
    const push = (kind: Exclude<I18nRowKind, "item">, slot?: TextI18n) => {
      if (!slot) return;
      rows.push({
        sceneId: scene.id,
        sceneName: scene.name,
        kind,
        label: KIND_LABEL[kind],
        i18n: slot.i18n ?? {},
      });
    };
    push("narration", scene.narration);
    push("title", scene.slots.title);
    push("subtitle", scene.slots.subtitle);
    push("body", scene.slots.body);
    push("caption", scene.slots.caption);
    push("quote", scene.slots.quote);
    push("author", scene.slots.author);
    push("number", scene.slots.number);
    for (const [i, item] of (scene.slots.items ?? []).entries()) {
      rows.push({
        sceneId: scene.id,
        sceneName: scene.name,
        kind: "item",
        itemId: item.id,
        label: `条目 ${i + 1}`,
        i18n: item.i18n ?? {},
      });
    }
  }
  return rows;
}

export function sourceTextOf(row: I18nRow, source: LangId): string {
  return row.i18n[source] ?? "";
}

export function patchSceneI18n(scene: Scene, row: I18nRow, i18n: Partial<Record<LangId, string>>): Scene {
  if (row.kind === "narration") return { ...scene, narration: { i18n } };
  if (row.kind === "item") {
    return {
      ...scene,
      slots: {
        ...scene.slots,
        items: (scene.slots.items ?? []).map((it) => (it.id === row.itemId ? { ...it, i18n } : it)),
      },
    };
  }
  return {
    ...scene,
    slots: {
      ...scene.slots,
      [row.kind]: { i18n },
    },
  };
}
