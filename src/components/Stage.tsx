import { useEffect, useRef, useState } from "react";
import { StageView } from "../layouts/StageView";
import { sourceLangOf } from "../lib/textI18n";
import { sceneAt } from "../lib/timeline";
import { ASPECT_PX } from "../types";
import { useEditor } from "../store/useEditor";

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
  const at = sceneAt(project, lang, playheadMs);
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
        {at ? (
          <StageView
            scene={at.scene}
            lang={lang}
            source={source}
            localMs={at.localMs}
            durationMs={at.durationMs}
            showCaptions={project.showCaptions}
            editable={!playing && !exporting}
            selectedId={selectedBlockId}
            onSelect={(id) => useEditor.getState().setSelectedBlock(id)}
            onTransformStart={() => useEditor.getState().commit()}
            onTransform={(id, pose) =>
              useEditor.getState().writeBlockTransform(at.scene.id, id, pose, at.durationMs ? at.localMs / at.durationMs : 0)
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">还没有场景</div>
        )}
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
  const at = sceneAt(project, lang, playheadMs);
  const px = ASPECT_PX[project.aspect];
  if (!exporting || !at) return null;
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
            <StageView
              scene={at.scene}
              lang={lang}
              source={source}
              localMs={at.localMs}
              durationMs={at.durationMs}
              showCaptions={project.showCaptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
