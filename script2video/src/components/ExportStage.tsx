import { useEffect, useRef } from "react";
import { useStudio } from "../store/useStudio";
import { createSpeech } from "../lib/speech";
import { persistSpeechRun, mixScriptSoundtrack } from "../lib/soundtrack";
import { driveOf } from "../lib/beats";
import { runGsapScript } from "../lib/runGsap";
import { mountStage, stageBoxStyle } from "../lib/stage";
import { sourceOf, usesGsapPreview } from "../lib/engines";
import { exportPx, exportSettingsOf } from "../lib/exportSettings";
import { CaptionBar } from "./CaptionBar";
import { EngineCard } from "./EngineCard";

export function ExportStage() {
  const project = useStudio((s) => s.project);
  const exporting = useStudio((s) => s.exporting);
  const exportScriptId = useStudio((s) => s.exportScriptId);
  const exportLang = useStudio((s) => s.exportLang);
  const exportLocalMs = useStudio((s) => s.exportLocalMs);
  const burnCaptions = useStudio((s) => s.burnCaptions);
  const status = useStudio((s) => s.status);
  const stageRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<{ seek: (t: number, suppress?: boolean) => unknown } | null>(null);

  const script = project.scripts.find((s) => s.id === exportScriptId) ?? project.scripts[0];
  const lang = exportLang;
  const localMs = exportLocalMs;
  const st = exportSettingsOf(project.exportSettings);
  const { w, h } = exportPx(project.aspect ?? "16:9", st.height);
  const second = project.bilingualCaptions ? (project.bilingualCaptionLang ?? project.sourceLang) : null;
  const scale =
    typeof window === "undefined" ? 0.4 : Math.min((window.innerWidth - 48) / w, (window.innerHeight - 80) / h, 1);

  useEffect(() => {
    if (!exporting) return;
    const root = stageRef.current;
    if (!script || !usesGsapPreview(script)) {
      if (root) root.innerHTML = "";
      tlRef.current = null;
      return;
    }
    if (!root) return;
    mountStage(root, script, project);
    const speech = createSpeech(script, lang);
    const { timeline, revert } = runGsapScript(sourceOf(script), speech, root);
    tlRef.current = timeline;
    timeline.seek(localMs / 1000, false);
    persistSpeechRun(script, speech);
    if (driveOf(script) === "script") {
      void mixScriptSoundtrack(script, lang, speech);
    }
    return () => {
      revert();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exporting, script?.id, script?.engine, script?.code, script?.sources, script?.beats, script?.audioByLang, script?.holdMs, script?.stageHtml, script?.drive, project.stageCss, project.stageTheme, lang]);

  useEffect(() => {
    tlRef.current?.seek(localMs / 1000, false);
  }, [localMs]);

  if (!exporting || !script) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col bg-ink-950/90">
      <div className="py-2 text-center text-xs text-brass">{status || "正在导出…"}</div>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <div id="export-stage" className="export-stage relative overflow-hidden" style={stageBoxStyle(project, w, h)}>
            <div ref={stageRef} className="stage-root absolute inset-0" />
            {usesGsapPreview(script) ? null : (
              <EngineCard
                script={script}
                clockLang={lang}
                source={project.sourceLang}
                localMs={localMs}
                secondLang={second && second !== lang ? second : null}
                large
              />
            )}
            {burnCaptions && usesGsapPreview(script) && (
              <CaptionBar
                script={script}
                clockLang={lang}
                source={project.sourceLang}
                localMs={localMs}
                secondLang={second && second !== lang ? second : null}
                large
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
