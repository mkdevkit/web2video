import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cueUntil, sceneBlocks } from "../lib/blocks";
import { getAudio } from "../lib/audioStore";
import { formatMs, sceneAt, sceneDuration, sceneStarts, totalDuration } from "../lib/timeline";
import { BLOCK_TYPES } from "../types";
import { useEditor } from "../store/useEditor";
import type { Cue } from "../types";

function labelOf(cue: Cue, items: { id: string }[]): string {
  if (cue.target.startsWith("item:")) {
    const id = cue.target.slice(5);
    const i = items.findIndex((it) => it.id === id);
    return i >= 0 ? `条目 ${i + 1}` : "条目";
  }
  return BLOCK_TYPES.find((b) => b.type === cue.target)?.label ?? cue.target;
}

async function peaksOf(blob: Blob, n: number): Promise<number[]> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / n));
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      let m = 0;
      const start = i * size;
      for (let j = 0; j < size; j++) m = Math.max(m, Math.abs(data[start + j] ?? 0));
      peaks.push(m);
    }
    return peaks;
  } finally {
    await ctx.close();
  }
}

type DragKind = "move" | "start" | "end";

export function Timeline() {
  const project = useEditor((s) => s.project);
  const playheadMs = useEditor((s) => s.playheadMs);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const selectedCueId = useEditor((s) => s.selectedCueId);
  const lang = project.previewLang;
  const total = Math.max(1, totalDuration(project, lang));
  const starts = sceneStarts(project.scenes, lang);
  const at = sceneAt(project, lang, playheadMs);
  const scene = project.scenes.find((s) => s.id === currentSceneId) ?? at?.scene;
  const sceneDur = scene ? sceneDuration(scene, lang) : 1;
  const [peaks, setPeaks] = useState<number[]>([]);
  const drag = useRef<{ id: string; sceneId: string; kind: DragKind; originAt: number; originUntil: number; originX: number; width: number } | null>(null);

  useEffect(() => {
    let dead = false;
    if (!scene) {
      setPeaks([]);
      return;
    }
    void getAudio(scene.id, lang).then(async (blob) => {
      if (!blob || dead) return setPeaks([]);
      const p = await peaksOf(blob, 120);
      if (!dead) setPeaks(p);
    });
    return () => {
      dead = true;
    };
  }, [scene?.id, lang, scene?.audioByLang?.[lang]?.src]);

  const seekGlobal = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    useEditor.getState().setPlayhead(ratio * total);
    useEditor.getState().setPlaying(false);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.originX) / d.width;
      if (d.kind === "move") {
        const span = d.originUntil - d.originAt;
        const nextAt = Math.min(1 - span, Math.max(0, d.originAt + dx));
        useEditor.getState().setCueRange(d.sceneId, d.id, nextAt, nextAt + span);
      } else if (d.kind === "start") {
        useEditor.getState().setCueRange(d.sceneId, d.id, d.originAt + dx, d.originUntil);
      } else {
        useEditor.getState().setCueRange(d.sceneId, d.id, d.originAt, d.originUntil + dx);
      }
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const beginDrag = (e: ReactMouseEvent, cue: Cue, kind: DragKind, track: HTMLElement) => {
    if (!scene) return;
    e.stopPropagation();
    e.preventDefault();
    useEditor.getState().commit();
    useEditor.getState().setSelectedCue(cue.id);
    if (!cue.target.startsWith("item:")) useEditor.getState().setSelectedBlock(cue.target);
    drag.current = {
      id: cue.id,
      sceneId: scene.id,
      kind,
      originAt: cue.at,
      originUntil: cueUntil(cue),
      originX: e.clientX,
      width: track.getBoundingClientRect().width,
    };
  };

  return (
    <div className="flex h-56 shrink-0 flex-col border-t border-ink-600 bg-ink-900">
      <div
        className="relative mx-2 mt-2 h-8 cursor-pointer overflow-hidden rounded border border-ink-600 bg-ink-800"
        onMouseDown={(e) => seekGlobal(e.clientX, e.currentTarget)}
      >
        {project.scenes.map((s, i) => {
          const dur = sceneDuration(s, lang);
          const left = (starts[i] / total) * 100;
          const width = (dur / total) * 100;
          const active = s.id === currentSceneId;
          return (
            <div
              key={s.id}
              className={`absolute top-0 h-full border-r border-ink-700 px-1.5 py-1 text-[10px] ${active ? "bg-copper/25 text-paper" : "text-ink-200"}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={s.name}
            >
              <div className="truncate">{s.name}</div>
            </div>
          );
        })}
        <div className="pointer-events-none absolute top-0 z-10 h-full w-px bg-brass" style={{ left: `${(playheadMs / total) * 100}%` }} />
      </div>
      <div className="mx-2 mt-1 flex min-h-0 flex-1 flex-col">
        <div className="relative h-7 overflow-hidden rounded border border-ink-700 bg-ink-950">
          {peaks.length > 0 && (
            <div className="flex h-full items-end gap-px px-px">
              {peaks.map((p, i) => (
                <div key={i} className="flex-1 bg-brass/70" style={{ height: `${Math.max(6, p * 100)}%` }} />
              ))}
            </div>
          )}
          {at && scene && (
            <div className="pointer-events-none absolute top-0 z-10 h-full w-px bg-paper" style={{ left: `${(at.localMs / sceneDur) * 100}%` }} />
          )}
        </div>
        <div className="mt-1 min-h-0 flex-1 overflow-auto">
          {(scene?.cues ?? []).map((cue) => {
            const until = cueUntil(cue);
            const left = cue.at * 100;
            const width = Math.max(2, (until - cue.at) * 100);
            const selected = selectedCueId === cue.id;
            const keys = sceneBlocks(scene ?? { layoutId: "cover", blocks: [] }).find((b) => b.id === cue.target)?.keys ?? [];
            return (
              <div key={cue.id} className="mb-0.5 flex h-6 items-center gap-1">
                <span className="w-14 shrink-0 truncate text-[10px] text-ink-400">{labelOf(cue, scene?.slots.items ?? [])}</span>
                <div
                  className="relative h-5 flex-1 rounded bg-ink-800"
                  onMouseDown={(e) => {
                    if (!scene) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                    const start = starts[project.scenes.findIndex((s) => s.id === scene.id)] ?? 0;
                    useEditor.getState().setPlayhead(start + ratio * sceneDur);
                    useEditor.getState().setPlaying(false);
                  }}
                >
                  <div
                    className={`absolute top-0.5 h-4 rounded ${selected ? "bg-brass text-ink-950" : "bg-copper/85 text-paper"}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onMouseDown={(e) => beginDrag(e, cue, "move", e.currentTarget.parentElement!)}
                  >
                    <span
                      className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l bg-black/30"
                      onMouseDown={(e) => beginDrag(e, cue, "start", e.currentTarget.parentElement!.parentElement!)}
                    />
                    <span className="pointer-events-none block truncate px-2 text-[10px] leading-4">
                      {labelOf(cue, scene?.slots.items ?? [])}
                    </span>
                    <span
                      className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r bg-black/30"
                      onMouseDown={(e) => beginDrag(e, cue, "end", e.currentTarget.parentElement!.parentElement!)}
                    />
                  </div>
                  {keys.map((k) => (
                    <button
                      key={k.t}
                      className="absolute top-1.5 z-20 h-2 w-2 rotate-45 border border-ink-950 bg-paper"
                      style={{ left: `calc(${k.t * 100}% - 4px)` }}
                      title={`关键帧 ${k.t.toFixed(2)}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (!scene) return;
                        const start = starts[project.scenes.findIndex((s) => s.id === scene.id)] ?? 0;
                        useEditor.getState().setPlayhead(start + k.t * sceneDur);
                        useEditor.getState().setSelectedBlock(cue.target);
                      }}
                    />
                  ))}
                  {at && scene && (
                    <div className="pointer-events-none absolute top-0 z-10 h-full w-px bg-paper/70" style={{ left: `${(at.localMs / sceneDur) * 100}%` }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between py-0.5 font-mono text-[10px] text-ink-400">
          <span>{scene ? `当前场景 ${formatMs(at?.localMs ?? 0)} / ${formatMs(sceneDur)}` : ""}</span>
          <span>色块=入场窗口；菱形=关键帧。拖舞台会在当前时间插值。</span>
        </div>
      </div>
    </div>
  );
}
