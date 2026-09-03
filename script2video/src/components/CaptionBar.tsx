import { captionLinesAt } from "../lib/subtitles";
import { fontStack, stageThemeOf } from "../lib/stage";
import { useStudio } from "../store/useStudio";
import type { LangId } from "../lib/langs";
import type { SceneScript } from "../types";

export function CaptionBar({
  script,
  clockLang,
  source,
  localMs,
  secondLang,
  large,
}: {
  script: SceneScript;
  clockLang: LangId;
  source: LangId;
  localMs: number;
  secondLang?: LangId | null;
  large?: boolean;
}) {
  const captionFontId = useStudio((s) => stageThemeOf(s.project.stageTheme).captionFontId);
  const lines = captionLinesAt(script, clockLang, source, localMs, secondLang);
  if (!lines.length) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center ${large ? "px-16 pb-16" : "px-3 pb-3"}`}
    >
      <div
        className={`max-w-[90%] rounded-lg bg-black/70 text-center text-paper ${large ? "px-8 py-4 text-3xl leading-snug" : "px-3 py-1.5 text-xs leading-snug"}`}
        style={{ fontFamily: fontStack(captionFontId, clockLang) }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={large && lines.length > 1 && i === 1 ? "mt-1 text-lg text-ink-200" : ""}
            style={i === 1 && secondLang ? { fontFamily: fontStack(captionFontId, secondLang) } : undefined}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
