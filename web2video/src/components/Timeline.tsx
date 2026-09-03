import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { getAudio } from "../lib/audioStore";
import { formatMs, sceneAt, sceneClock, sceneDuration, sceneHoldMs, sceneStarts, totalDuration, type ScenePhase } from "../lib/timeline";
import { useEditor } from "../store/useEditor";

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

function ratioFromX(clientX: number, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
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

function pct(ms: number, total: number) {
  return (ms / Math.max(1, total)) * 100;
}

function slicePeaks(peaks: number[], startMs: number, endMs: number, audioMs: number): number[] {
  if (!peaks.length || audioMs <= 0 || endMs <= startMs) return [];
  const a = Math.max(0, Math.floor((startMs / audioMs) * peaks.length));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil((endMs / audioMs) * peaks.length)));
  return peaks.slice(a, b);
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

type ScrubKind = "global" | "local";

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
  const [peaks, setPeaks] = useState<number[]>([]);
  const scrub = useRef<{ kind: ScrubKind; el: HTMLElement } | null>(null);

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

  const seekScrub = (kind: ScrubKind, el: HTMLElement, clientX: number) => {
    const ratio = ratioFromX(clientX, el);
    const s = useEditor.getState();
    const p = s.project;
    const l = p.previewLang;
    if (kind === "global") {
      s.setPlayhead(ratio * Math.max(1, totalDuration(p, l)));
    } else {
      const sc = p.scenes.find((x) => x.id === s.currentSceneId) ?? sceneAt(p, l, s.playheadMs)?.scene;
      if (!sc) return;
      const idx = p.scenes.findIndex((x) => x.id === sc.id);
      const start = sceneStarts(p, l)[idx] ?? 0;
      s.setPlayhead(start + ratio * sceneDuration(sc, l, p));
    }
    s.setPlaying(false);
  };

  const beginScrub = (e: ReactMouseEvent, kind: ScrubKind, el: HTMLElement) => {
    if (e.button !== 0) return;
    e.preventDefault();
    scrub.current = { kind, el };
    seekScrub(kind, el, e.clientX);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const sc = scrub.current;
      if (sc) seekScrub(sc.kind, sc.el, e.clientX);
    };
    const up = () => {
      scrub.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const localRatio = sceneDur > 0 && at && scene && at.scene.id === scene.id ? at.localMs / sceneDur : 0;
  const bodyLeft = clock ? pct(clock.bodyStartMs, clock.totalMs) : 0;
  const bodyWidth = clock ? pct(clock.bodyMs, clock.totalMs) : 100;
  const audioMs = clock ? Math.max(1, clock.audioCloseEndMs, clock.audioBodyEndMs, clock.audioOpenEndMs) : 1;
  const openPeaks = clock ? slicePeaks(peaks, clock.audioOpenStartMs, clock.audioOpenEndMs, audioMs) : [];
  const bodyPeaks = clock ? slicePeaks(peaks, clock.audioBodyStartMs, clock.audioBodyEndMs, audioMs) : [];
  const closePeaks = clock ? slicePeaks(peaks, clock.audioCloseStartMs, clock.audioCloseEndMs, audioMs) : [];

  return (
    <div className="flex h-[4.75rem] shrink-0 flex-col border-t border-ink-600 bg-ink-900 select-none">
      <GlobalProgressBar />
      <div className="mx-2 mb-1 mt-1">
        <div
          className="relative h-7 cursor-ew-resize overflow-hidden rounded border border-ink-700 bg-ink-950"
          onMouseDown={(e) => beginScrub(e, "local", e.currentTarget)}
        >
          {clock && clock.openBeforeMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 bg-ink-800/90"
              style={{ left: 0, width: `${pct(clock.openBeforeMs, clock.totalMs)}%` }}
              title="开场前空白"
            />
          )}
          {clock && clock.openSpeechMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 flex items-end gap-px bg-copper/20 px-px"
              style={{ left: `${pct(clock.openBeforeMs, clock.totalMs)}%`, width: `${pct(clock.openSpeechMs, clock.totalMs)}%` }}
              title="开场口播"
            >
              {openPeaks.map((p, i) => (
                <div key={i} className="flex-1 bg-brass/70" style={{ height: `${Math.max(6, p * 100)}%` }} />
              ))}
            </div>
          )}
          {clock && clock.openAfterMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 bg-ink-800/70"
              style={{ left: `${pct(clock.openBeforeMs + clock.openSpeechMs, clock.totalMs)}%`, width: `${pct(clock.openAfterMs, clock.totalMs)}%` }}
              title="开场后空白"
            />
          )}
          {clock && clock.bodyMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 flex items-end gap-px px-px"
              style={{ left: `${bodyLeft}%`, width: `${bodyWidth}%` }}
              title="主体"
            >
              {bodyPeaks.map((p, i) => (
                <div key={i} className="flex-1 bg-brass/70" style={{ height: `${Math.max(6, p * 100)}%` }} />
              ))}
            </div>
          )}
          {clock && clock.closeBeforeMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 bg-ink-800/70"
              style={{ left: `${pct(clock.closeHeadMs, clock.totalMs)}%`, width: `${pct(clock.closeBeforeMs, clock.totalMs)}%` }}
              title="结束前空白"
            />
          )}
          {clock && clock.closeSpeechMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 flex items-end gap-px bg-copper/20 px-px"
              style={{
                left: `${pct(clock.closeSpeechStartMs, clock.totalMs)}%`,
                width: `${pct(clock.closeSpeechMs, clock.totalMs)}%`,
              }}
              title="结束口播"
            >
              {closePeaks.map((p, i) => (
                <div key={i} className="flex-1 bg-brass/70" style={{ height: `${Math.max(6, p * 100)}%` }} />
              ))}
            </div>
          )}
          {clock && clock.closeAfterMs > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 bg-ink-800/80"
              style={{
                left: `${pct(clock.closeSpeechStartMs + clock.closeSpeechMs, clock.totalMs)}%`,
                width: `${pct(clock.closeAfterMs, clock.totalMs)}%`,
              }}
              title="结束后空白"
            />
          )}
          {holdMs > 0 && sceneDur > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 border-l border-ink-600 bg-ink-800/80"
              style={{ width: `${(holdMs / sceneDur) * 100}%` }}
              title="口播后停留"
            />
          )}
          {at && scene && (
            <div className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-paper" style={{ left: `${localRatio * 100}%` }} />
          )}
        </div>
        <div className="flex justify-between py-0.5 font-mono text-[10px] text-ink-400">
          <span>
            {scene
              ? `当前场景 ${formatMs(at?.localMs ?? 0)} / ${formatMs(sceneDur)}${at?.phase ? ` · ${phaseLabel(at.phase)}` : ""}${holdMs ? `（含停留 ${formatMs(holdMs)}）` : ""}`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
