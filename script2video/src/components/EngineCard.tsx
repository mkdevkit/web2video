import { captionLinesAt } from "../lib/subtitles";
import { engineMeta, engineOf } from "../lib/engines";
import { fontStack, stageThemeOf } from "../lib/stage";
import { useStudio } from "../store/useStudio";
import type { LangId } from "../lib/langs";
import type { SceneScript } from "../types";

export function EngineCard({
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
  const meta = engineMeta(engineOf(script));
  const lines = captionLinesAt(script, clockLang, source, localMs, secondLang);
  const captionFontId = useStudio((s) => stageThemeOf(s.project.stageTheme).captionFontId);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_70%_40%,#2a3026,#10120e_62%)] px-6 text-center">
      <p className={`uppercase tracking-wider text-ink-400 ${large ? "mb-4 text-sm" : "mb-2 text-[10px]"}`}>
        {meta.label} · {script.name}
      </p>
      <div
        className={`max-w-[90%] font-medium leading-snug ${large ? "text-4xl" : "text-sm"}`}
        style={{ fontFamily: fontStack(captionFontId, clockLang) }}
      >
        {lines.length
          ? lines.map((line, i) => (
              <div
                key={i}
                style={i === 1 && secondLang ? { fontFamily: fontStack(captionFontId, secondLang) } : undefined}
              >
                {line}
              </div>
            ))
          : "—"}
      </div>
      <p className={`mt-3 max-w-[24em] text-ink-400 ${large ? "text-sm" : "text-[10px]"}`}>节拍卡（时长跟口播走）。完整画面用 {meta.label} 渲染该段后再拼进成片。</p>
    </div>
  );
}
