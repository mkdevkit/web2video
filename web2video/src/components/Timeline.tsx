import { useEffect, useRef } from "react";
import { formatMs, sceneAt, sceneClock, sceneDuration, sceneHoldMs, sceneStarts, totalDuration, type ScenePhase } from "../lib/timeline";
import { useEditor } from "../store/useEditor";

function ratioFromX(clientX: number, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
}

function phaseLabel(phase: ScenePhase): string {
  if (phase === "openPad") return "开场前空白";
  if (phase === "open") return "开场口播";
  if (phase === "openGap") return "开场后空白";
  if (phase === "body") return "主体";
  if (phase === "closePad") return "结束前空白";
  if (phase === "close") return "结束口播";
  if (phase === "closeGap") return "结束后空白";
  return "停留";
}

export function GlobalProgressBar() {
  const project = useEditor((s) => s.project);
  const playheadMs = useEditor((s) => s.playheadMs);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const lang = project.previewLang;
  const total = Math.max(1, totalDuration(project, lang));
  const starts = sceneStarts(project, lang);
  const elRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const seek = (clientX: number) => {
    const el = elRef.current;
    if (!el) return;
    const s = useEditor.getState();
    const p = s.project;
    s.setPlayhead(ratioFromX(clientX, el) * Math.max(1, totalDuration(p, p.previewLang)));
    s.setPlaying(false);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (scrubbing.current) seek(e.clientX);
    };
    const up = () => {
      scrubbing.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <div
      ref={elRef}
      className="relative mx-2 mt-2 h-8 cursor-ew-resize overflow-hidden rounded border border-ink-600 bg-ink-800"
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        scrubbing.current = true;
        seek(e.clientX);
      }}
    >
      {project.scenes.map((s, i) => {
        const dur = sceneDuration(s, lang, project);
        const left = (starts[i] / total) * 100;
        const width = (dur / total) * 100;
        const hold = sceneHoldMs(s, project);
        const holdPct = dur > 0 ? (hold / dur) * 100 : 0;
        const active = s.id === currentSceneId;
        return (
          <div
            key={s.id}
            className={`pointer-events-none absolute top-0 h-full border-r border-ink-700 px-1.5 py-1 text-[10px] ${active ? "bg-copper/25 text-paper" : "text-ink-200"}`}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={hold ? `${s.name}（含停留 ${formatMs(hold)}）` : s.name}
          >
            {holdPct > 0 && <div className="absolute inset-y-0 right-0 bg-ink-950/45" style={{ width: `${holdPct}%` }} />}
            <div className="relative truncate">{s.name}</div>
          </div>
        );
      })}
      <div className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-brass" style={{ left: `${(playheadMs / total) * 100}%` }} />
    </div>
  );
}

export function Timeline() {
  const project = useEditor((s) => s.project);
  const playheadMs = useEditor((s) => s.playheadMs);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const lang = project.previewLang;
  const at = sceneAt(project, lang, playheadMs);
  const scene = project.scenes.find((s) => s.id === currentSceneId) ?? at?.scene;
  const sceneDur = scene ? sceneDuration(scene, lang, project) : 1;
  const clock = scene ? sceneClock(scene, lang, project) : null;
  const holdMs = clock?.holdMs ?? 0;

  return (
    <div className="flex h-14 shrink-0 flex-col border-t border-ink-600 bg-ink-900 select-none">
      <GlobalProgressBar />
      <div className="mx-2 py-0.5 font-mono text-[10px] text-ink-400">
        {scene
          ? `${formatMs(playheadMs)} / ${formatMs(totalDuration(project, lang))} · ${scene.name} ${formatMs(at?.localMs ?? 0)} / ${formatMs(sceneDur)}${at?.phase ? ` · ${phaseLabel(at.phase)}` : ""}${holdMs ? `（含停留 ${formatMs(holdMs)}）` : ""}`
          : ""}
      </div>
    </div>
  );
}
