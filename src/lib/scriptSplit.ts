import type { LayoutId, TextI18n } from "../types";
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
