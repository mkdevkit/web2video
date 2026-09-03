import { useEffect, useRef, useState } from "react";
import { StageView } from "../layouts/StageView";
import { blockWindow, windowProgress } from "../lib/effects";
import { fontStack, hexAlpha, progressStyleOf } from "../lib/fonts";
import { sourceLangOf } from "../lib/textI18n";
import { sceneBlocks } from "../lib/blocks";
import { sceneLayersAt, sceneCalendar, sceneDuration, sceneStarts, totalDuration, type SceneLayer } from "../lib/timeline";
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
        selectedId={selectedId ?? null}
        onSelect={(id) => useEditor.getState().setSelectedBlock(id)}
        onTransformStart={canEdit ? () => useEditor.getState().commit() : undefined}
        onTransform={
          canEdit
            ? (id, pose) => {
                const cal = sceneCalendar(layer.scene, lang, project);
                const block = sceneBlocks(layer.scene).find((b) => b.id === id);
                const sampleMs = layer.localMs;
                const win = block ? blockWindow(block, layer.scene, source, cal) : undefined;
                useEditor.getState().writeBlockTransform(layer.scene.id, id, pose, windowProgress(sampleMs, win));
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
      {project.showTopProgress && <FilmProgressBar project={project} lang={lang} playheadMs={playheadMs} />}
    </div>
  );
}

function FilmProgressBar({ project, lang, playheadMs }: { project: Project; lang: LangId; playheadMs: number }) {
  const st = progressStyleOf(project.progressStyle);
  const total = Math.max(1, totalDuration(project, lang));
  const ratio = Math.min(1, Math.max(0, playheadMs / total));
  const starts = sceneStarts(project, lang);
  const fontId = st.fontId ?? project.captionFontId ?? project.fontId;
  const weight = st.fontWeight === "bold" ? 700 : st.fontWeight === "medium" ? 500 : 400;
  const inset = `${st.insetX}%`;
  return (
    <div
      className="pointer-events-none absolute z-30 overflow-hidden"
      style={{
        left: inset,
        right: inset,
        top: st.position === "top" ? 0 : undefined,
        bottom: st.position === "bottom" ? 0 : undefined,
        height: `${st.height}cqw`,
        fontFamily: fontStack(fontId, lang),
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: hexAlpha(st.bg, st.bgOpacity),
          backdropFilter: st.blur ? "blur(0.45cqw)" : undefined,
        }}
      />
      <div className="absolute inset-y-0 left-0" style={{ width: `${ratio * 100}%`, background: hexAlpha(st.fill, st.fillOpacity) }} />
      {project.scenes.map((s, i) => {
        const dur = sceneDuration(s, lang, project);
        const left = (starts[i] / total) * 100;
        const width = (dur / total) * 100;
        const active = playheadMs >= starts[i] && playheadMs < starts[i] + dur;
        return (
          <div
            key={s.id}
            className="absolute top-0 h-full overflow-hidden"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              borderRight:
                st.showDividers && i < project.scenes.length - 1 ? `0.07cqw solid ${hexAlpha("#ffffff", 0.28)}` : undefined,
              paddingLeft: "0.45cqw",
              paddingRight: "0.35cqw",
              fontSize: `${st.fontSize}cqw`,
              lineHeight: `${st.height}cqw`,
              fontWeight: active ? Math.min(800, weight + 200) : weight,
              color: active ? st.activeColor : st.color,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {st.showNames ? s.name : null}
          </div>
        );
      })}
      {st.showPlayhead && (
        <div className="absolute top-0 h-full" style={{ left: `${ratio * 100}%`, width: "0.14cqw", background: st.playhead }} />
      )}
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
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const px = ASPECT_PX[project.aspect];
  const box = { w: px.w * fit * zoom, h: px.h * fit * zoom };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const pad = 48;
      const bw = Math.max(120, el.clientWidth - pad);
      const bh = Math.max(80, el.clientHeight - pad);
      setFit(Math.min(bw / px.w, bh / px.h));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [px.w, px.h]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const prev = zoomRef.current;
      const next = Math.min(6, Math.max(0.2, prev * Math.exp(-e.deltaY * 0.0016)));
      if (Math.abs(next - prev) < 0.0001) return;
      const sr = stageRef.current?.getBoundingClientRect();
      const relX = sr && sr.width > 0 ? (e.clientX - sr.left) / sr.width : 0.5;
      const relY = sr && sr.height > 0 ? (e.clientY - sr.top) / sr.height : 0.5;
      zoomRef.current = next;
      setZoom(next);
      requestAnimationFrame(() => {
        const nr = stageRef.current?.getBoundingClientRect();
        if (!nr) return;
        wrap.scrollLeft += nr.left + relX * nr.width - e.clientX;
        wrap.scrollTop += nr.top + relY * nr.height - e.clientY;
      });
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  const resetZoom = () => {
    zoomRef.current = 1;
    setZoom(1);
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.scrollLeft = 0;
      wrap.scrollTop = 0;
    }
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={wrapRef}
        className="stage-checker h-full overflow-auto"
        onMouseDown={(e) => {
          if (stageRef.current && !stageRef.current.contains(e.target as Node)) {
            useEditor.getState().setSelectedBlock(null);
          }
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            minWidth: "100%",
            minHeight: "100%",
            width: box.w + 48,
            height: box.h + 48,
          }}
        >
          <div
            ref={stageRef}
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
      </div>
      <button
        className="btn pointer-events-auto absolute bottom-2 right-2 z-10 py-0.5 text-[10px]"
        title="滚轮缩放，点此恢复适应窗口"
        onClick={resetZoom}
      >
        {Math.round(zoom * 100)}%
      </button>
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
