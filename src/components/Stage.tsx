import { useEffect, useRef, useState } from "react";
import { StageView } from "../layouts/StageView";
import { bodyBeatSpans, cueKeyProgress, resolveCue } from "../lib/cues";
import { sourceLangOf } from "../lib/textI18n";
import { sceneLayersAt, sceneClock, type SceneLayer } from "../lib/timeline";
import { ASPECT_PX } from "../types";
import { useEditor } from "../store/useEditor";
import type { LangId } from "../lib/langs";
import type { Project } from "../types";

function StageLayers({
  project,
  lang,
  source,
  playheadMs,
  editable,
  selectedId,
}: {
  project: Project;
  lang: LangId;
  source: LangId;
  playheadMs: number;
  editable: boolean;
  selectedId?: string | null;
}) {
  const layers = sceneLayersAt(project, lang, playheadMs);
  if (!layers) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-400">还没有场景</div>;
  }
  const render = (layer: SceneLayer, canEdit: boolean, overlay: boolean) => (
    <div className={`absolute inset-0 ${overlay ? "pointer-events-none" : ""}`} style={{ opacity: layer.opacity }}>
      <StageView
        scene={layer.scene}
        lang={lang}
        source={source}
        project={project}
        localMs={layer.localMs}
        durationMs={layer.durationMs}
        animLocalMs={layer.animLocalMs}
        animDurationMs={layer.animDurationMs}
        phase={layer.phase}
        audioMs={layer.audioMs}
        showCaptions={project.showCaptions}
        editable={canEdit}
        selectedId={canEdit ? selectedId : null}
        onSelect={canEdit ? (id) => useEditor.getState().setSelectedBlock(id) : undefined}
        onTransformStart={canEdit ? () => useEditor.getState().commit() : undefined}
        onTransform={
          canEdit
            ? (id, pose) => {
                const clock = sceneClock(layer.scene, lang, project);
                const spans = bodyBeatSpans(layer.scene, lang, source);
                const raw = layer.scene.cues.find((c) => c.target === id);
                const cue = raw ? resolveCue(raw, clock, spans, layer.scene, source) : undefined;
                const sceneP = layer.animDurationMs ? layer.animLocalMs / layer.animDurationMs : 0;
                useEditor.getState().writeBlockTransform(layer.scene.id, id, pose, cueKeyProgress(sceneP, cue));
              }
            : undefined
        }
      />
    </div>
  );
  return (
    <div className="relative h-full w-full bg-ink-950">
      {render(layers.current, editable && !layers.overlay, false)}
      {layers.overlay ? render(layers.overlay, false, true) : null}
    </div>
  );
}

export function Stage() {
  const project = useEditor((s) => s.project);
  const playheadMs = useEditor((s) => s.playheadMs);
  const playing = useEditor((s) => s.playing);
  const exporting = useEditor((s) => s.exporting);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 640, h: 360 });
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const px = ASPECT_PX[project.aspect];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const pad = 48;
      const bw = Math.max(120, el.clientWidth - pad);
      const bh = Math.max(80, el.clientHeight - pad);
      const s = Math.min(bw / px.w, bh / px.h);
      setBox({ w: px.w * s, h: px.h * s });
    };
    fit();
    const obs = new ResizeObserver(fit);
    obs.observe(el);
    return () => obs.disconnect();
  }, [px.w, px.h]);

  return (
    <div ref={wrapRef} className="stage-checker relative flex min-h-0 flex-1 items-center justify-center">
      <div
        id="stage-root"
        className="overflow-hidden rounded-md shadow-paper"
        style={{ width: box.w, height: box.h, containerType: "size" }}
      >
        <StageLayers
          project={project}
          lang={lang}
          source={source}
          playheadMs={playheadMs}
          editable={!playing && !exporting}
          selectedId={selectedBlockId}
        />
      </div>
    </div>
  );
}

export function ExportStage() {
  const project = useEditor((s) => s.project);
  const playheadMs = useEditor((s) => s.playheadMs);
  const exporting = useEditor((s) => s.exporting);
  const hint = useEditor((s) => s.exportHint);
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const px = ASPECT_PX[project.aspect];
  if (!exporting) return null;
  return (
    <div className="pointer-events-none fixed left-0 top-0 z-30 flex h-full w-full flex-col bg-ink-950/90">
      <div className="py-2 text-center text-xs text-brass">{hint || "正在导出…"}</div>
      <div className="pointer-events-none flex flex-1 items-center justify-center overflow-hidden p-6">
        <div
          style={{
            transform: `scale(${Math.min((window.innerWidth - 48) / px.w, (window.innerHeight - 80) / px.h, 1)})`,
            transformOrigin: "center",
          }}
        >
          <div id="export-stage" style={{ width: px.w, height: px.h, containerType: "size" }}>
            <StageLayers project={project} lang={lang} source={source} playheadMs={playheadMs} editable={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
