import { uid } from "../ids";
import { defaultCues, sceneBlocks } from "../blocks";
import { t18, guessLayout } from "../scriptSplit";
import { asCssHex, defaultDialogueLines, emptyScene } from "../templates";
import { itemSpeakKey } from "../narration";
import { itemText, textOf } from "../textI18n";
import { LAYOUTS, type DialogueLine, type DialogueSide, type LayoutId, type Scene, type SceneTransition } from "../../types";
import type { LangId } from "../langs";

export interface StoryboardSpeak {
  title?: string;
  subtitle?: string;
  body?: string;
  caption?: string;
  quote?: string;
  author?: string;
  number?: string;
  list?: string;
  items?: string[];
  dialogue?: string[];
}

export interface StoryboardSpeakRole {
  open?: string;
  close?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  caption?: string;
  quote?: string;
  author?: string;
  number?: string;
  list?: string;
  items?: string[];
  dialogue?: string[];
}

export interface StoryboardDialogueLine {
  side?: DialogueSide;
  name?: string;
  text?: string;
  speak?: string;
  role?: string;
}

export interface StoryboardScene {
  name: string;
  layout?: LayoutId;
  bg?: string;
  bgFit?: "cover" | "contain";
  bgDim?: number;
  holdMs?: number;
  transition?: SceneTransition;
  transitionMs?: number;
  title?: string;
  subtitle?: string;
  body?: string;
  caption?: string;
  quote?: string;
  author?: string;
  number?: string;
  items?: string[];
  dialogue?: StoryboardDialogueLine[];
  narration?: string;
  narrationClose?: string;
  speak?: StoryboardSpeak;
  speakRole?: StoryboardSpeakRole;
}

const SLOT_KEYS = ["title", "subtitle", "body", "caption", "quote", "author", "number"] as const;
const ROLE_SLOT_KEYS = ["open", "close", ...SLOT_KEYS] as const;

function asLayout(value: string | undefined, title: string, body: string, items: string[], dialogue?: StoryboardDialogueLine[]): LayoutId {
  if (value && LAYOUTS.some((l) => l.id === value)) return value as LayoutId;
  if (dialogue?.length) return "dialogue";
  return guessLayout(title, body, items);
}

function asSide(value: unknown, index: number): DialogueSide {
  if (value === "left" || value === "right") return value;
  return index % 2 === 0 ? "left" : "right";
}

function linesFromSpec(spec: StoryboardDialogueLine[], lang: LangId): DialogueLine[] {
  return spec.map((d, i) => ({
    id: uid("it"),
    side: asSide(d.side, i),
    name: (d.name ?? (i % 2 === 0 ? "角色A" : "角色B")).trim() || undefined,
    i18n: { [lang]: (d.text ?? "").trim() || "……" },
  }));
}

function clamp01(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

function fillSpeak(scene: Scene, spec: Partial<StoryboardScene>, lang: LangId): Scene {
  const speak: NonNullable<Scene["speak"]> = { ...scene.speak };
  for (const key of SLOT_KEYS) {
    const raw = spec.speak?.[key];
    const visual = spec[key] !== undefined ? spec[key] ?? "" : textOf(scene.slots[key], lang, lang);
    const text = (raw !== undefined ? raw : visual).trim();
    if (text) speak[key] = t18(lang, text);
    else delete speak[key];
  }
  const listBlock = sceneBlocks(scene).find((b) => b.type === "list");
  if (listBlock) {
    const intro = spec.speak?.list;
    if (intro !== undefined) {
      if (intro.trim()) speak[listBlock.id] = t18(lang, intro.trim());
      else delete speak[listBlock.id];
    }
  }
  for (const [i, it] of (scene.slots.items ?? []).entries()) {
    const line = (spec.speak?.items?.[i] ?? spec.items?.[i] ?? itemText(it, lang, lang)).trim();
    const key = itemSpeakKey(it.id);
    if (line) speak[key] = t18(lang, line);
    else delete speak[key];
  }
  for (const [i, it] of (scene.slots.dialogue ?? []).entries()) {
    const line = (spec.speak?.dialogue?.[i] ?? spec.dialogue?.[i]?.speak ?? spec.dialogue?.[i]?.text ?? itemText(it, lang, lang)).trim();
    const key = itemSpeakKey(it.id);
    if (line) speak[key] = t18(lang, line);
    else delete speak[key];
  }
  return { ...scene, speak };
}

function applySpeakRoles(scene: Scene, spec: Partial<StoryboardScene>): Scene {
  const speakRole: NonNullable<Scene["speakRole"]> = { ...scene.speakRole };
  const sr = spec.speakRole;
  const setRole = (key: string, id: unknown) => {
    if (typeof id !== "string") return;
    if (id.trim()) speakRole[key] = id.trim();
    else delete speakRole[key];
  };
  if (sr) {
    for (const key of ROLE_SLOT_KEYS) setRole(key, sr[key]);
    const listBlock = sceneBlocks(scene).find((b) => b.type === "list");
    if (listBlock) setRole(listBlock.id, sr.list);
    (scene.slots.items ?? []).forEach((it, i) => setRole(itemSpeakKey(it.id), sr.items?.[i]));
    (scene.slots.dialogue ?? []).forEach((it, i) => setRole(itemSpeakKey(it.id), sr.dialogue?.[i]));
  }
  (scene.slots.dialogue ?? []).forEach((it, i) => setRole(itemSpeakKey(it.id), spec.dialogue?.[i]?.role));
  return { ...scene, speakRole };
}

function applySceneChrome(scene: Scene, spec: Partial<StoryboardScene>): Scene {
  let next = scene;
  if (spec.bg?.trim()) next = { ...next, bg: asCssHex(spec.bg.trim(), next.bg) };
  if (spec.bgFit === "cover" || spec.bgFit === "contain") next = { ...next, bgFit: spec.bgFit };
  const dim = clamp01(spec.bgDim);
  if (dim !== undefined) next = { ...next, bgDim: dim };
  if (typeof spec.holdMs === "number" && Number.isFinite(spec.holdMs)) next = { ...next, holdMs: Math.max(0, spec.holdMs) };
  if (spec.transition === "cut" || spec.transition === "crossfade") next = { ...next, transition: spec.transition };
  if (typeof spec.transitionMs === "number" && Number.isFinite(spec.transitionMs)) {
    next = { ...next, transitionMs: Math.max(0, spec.transitionMs) };
  }
  return next;
}

export function sceneFromStoryboard(spec: StoryboardScene, lang: LangId): Scene {
  const title = (spec.title ?? spec.name).trim() || "未命名";
  const body = (spec.body ?? "").trim();
  const itemsText = (spec.items ?? []).map((t) => t.trim()).filter(Boolean);
  const dialogueSpec = Array.isArray(spec.dialogue) ? spec.dialogue : undefined;
  const layout = asLayout(spec.layout, title, body, itemsText, dialogueSpec);
  let scene = emptyScene(lang, layout);
  const items = itemsText.length
    ? itemsText.map((t) => ({ id: uid("it"), i18n: { [lang]: t } }))
    : scene.slots.items;
  const dialogue = dialogueSpec?.length ? linesFromSpec(dialogueSpec, lang) : scene.slots.dialogue;
  scene = {
    ...scene,
    name: (spec.name || title).slice(0, 24),
    layoutId: layout,
    narration: t18(lang, (spec.narration ?? (layout === "dialogue" ? "" : title)).trim()),
    narrationClose: t18(lang, (spec.narrationClose ?? "").trim()),
    slots: {
      ...scene.slots,
      title: t18(lang, title),
      subtitle: t18(lang, (spec.subtitle ?? "").trim()),
      body: t18(lang, body),
      caption: t18(lang, (spec.caption ?? "").trim()),
      quote: t18(lang, (spec.quote ?? (layout === "quote" ? body || title : "")).trim()),
      author: t18(lang, (spec.author ?? "").trim()),
      number: t18(lang, (spec.number ?? "").trim()),
      items,
      dialogue,
    },
    cues: defaultCues(layout, items, layout === "custom" ? scene.blocks : undefined, dialogue),
  };
  return applySpeakRoles(fillSpeak(applySceneChrome(scene, spec), spec, lang), spec);
}

export function patchSceneFromStoryboard(scene: Scene, spec: Partial<StoryboardScene>, lang: LangId): Scene {
  const title = spec.title ?? spec.name;
  const itemsText = spec.items?.map((t) => t.trim()).filter(Boolean);
  const layout = spec.layout && LAYOUTS.some((l) => l.id === spec.layout) ? spec.layout : scene.layoutId;
  let next: Scene = applySceneChrome({ ...scene, layoutId: layout }, spec);
  if (spec.name?.trim()) next = { ...next, name: spec.name.trim().slice(0, 24) };
  if (spec.narration !== undefined) next = { ...next, narration: t18(lang, spec.narration.trim()) };
  if (spec.narrationClose !== undefined) next = { ...next, narrationClose: t18(lang, spec.narrationClose.trim()) };
  const slots = { ...next.slots };
  for (const key of SLOT_KEYS) {
    const value = spec[key];
    if (value !== undefined) slots[key] = t18(lang, value.trim());
  }
  if (title !== undefined && spec.title === undefined && spec.name) slots.title = t18(lang, spec.name.trim());
  if (itemsText) {
    slots.items = itemsText.map((t) => ({ id: uid("it"), i18n: { [lang]: t } }));
  }
  if (spec.dialogue) {
    slots.dialogue = spec.dialogue.length ? linesFromSpec(spec.dialogue, lang) : [];
  } else if (layout === "dialogue" && !(slots.dialogue?.length)) {
    slots.dialogue = defaultDialogueLines(lang);
  }
  next = {
    ...next,
    slots,
    cues: defaultCues(layout, slots.items, layout === "custom" ? next.blocks ?? sceneBlocks(next) : undefined, slots.dialogue),
  };
  const touchVisual = Boolean(spec.speak || itemsText || spec.dialogue || SLOT_KEYS.some((k) => spec[k] !== undefined));
  if (touchVisual) next = fillSpeak(next, spec, lang);
  if (spec.speakRole || spec.dialogue?.some((d) => d.role)) next = applySpeakRoles(next, spec);
  return next;
}
