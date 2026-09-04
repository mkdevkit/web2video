import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStudio } from "../store/useStudio";
import { beatOrder, langAudioOf, sceneDurationMs } from "../lib/clock";
import { createSpeech } from "../lib/speech";
import { persistSpeechRun, mixScriptSoundtrack } from "../lib/soundtrack";
import { driveOf } from "../lib/beats";
import { runGsapScript } from "../lib/runGsap";
import { LANGS } from "../lib/langs";
import { audioObjectUrl } from "../lib/audioStore";
import { sourceOf, usesGsapPreview } from "../lib/engines";
import { hydrateStageSpeech, missingGsapTargets, mountStage, stageBoxStyle } from "../lib/stage";
import { applyStageTexts, createStageApi, syncStageTexts } from "../lib/stageText";
import { ASPECT_PX } from "../types";
import { CaptionBar } from "./CaptionBar";
import { EngineCard } from "./EngineCard";

const PREVIEW_W_KEY = "script2video.previewWidth";
const PREVIEW_W_MIN = 320;
const PREVIEW_W_MAX = 760;
const PREVIEW_W_DEFAULT = 480;

function clampPreviewWidth(n: number) {
  return Math.min(PREVIEW_W_MAX, Math.max(PREVIEW_W_MIN, Math.round(n)));
}

function loadPreviewWidth() {
  try {
    const n = Number(localStorage.getItem(PREVIEW_W_KEY));
    if (Number.isFinite(n) && n > 0) return clampPreviewWidth(n);
  } catch {
    /* ignore */
  }
  return PREVIEW_W_DEFAULT;
}

export function PreviewPane() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const script = project.scripts.find((s) => s.id === scriptId);
  const lang = project.previewLang;
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const revertRef = useRef<(() => void) | null>(null);
  const tlRef = useRef<{ seek: (t: number, suppress?: boolean) => unknown } | null>(null);
  const [localMs, setLocalMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [paneW, setPaneW] = useState(loadPreviewWidth);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_W_KEY, String(paneW));
    } catch {
      /* ignore */
    }
  }, [paneW]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [script?.id, paneW, project.aspect]);

  useEffect(() => {
    if (!script) return;
    void audioObjectUrl(script.id, lang).then(setAudioUrl);
  }, [script, lang, script?.audioByLang?.[lang]?.stale, script?.audioByLang?.[lang]?.durationMs]);

  useEffect(() => {
    setLocalMs(0);
    setPlaying(false);
  }, [script?.id]);

  useLayoutEffect(() => {
    const root = stageRef.current;
    if (!script || !usesGsapPreview(script)) {
      if (root) root.innerHTML = "";
      setError("");
      return;
    }
    if (!root) return;
    mountStage(root, script, project);
    const source = project.sourceLang;
    const copies = syncStageTexts(script.stageHtml ?? "", script.stageTexts, source);
    applyStageTexts(root, copies, lang, source);
    const speech = createSpeech(script, lang);
    hydrateStageSpeech(root, speech);
    const code = sourceOf(script);
    const { timeline, revert, error: err } = runGsapScript(code, speech, root, createStageApi(copies, lang, source));
    revertRef.current = revert;
    tlRef.current = timeline;
    const missing = missingGsapTargets(code, root);
    const hints: string[] = [];
    if (err) hints.push(err);
    if (missing.length) hints.push(`舞台 HTML 里没有：${missing.join("、")}。脚本页改 HTML，或让 GSAP 选择器对上现有 id。`);
    setError(hints.join(" "));
    timeline.seek(localMs / 1000, false);
    persistSpeechRun(script, speech);
    if (driveOf(script) === "script") {
      void mixScriptSoundtrack(script, lang, speech).then(() => audioObjectUrl(script.id, lang).then(setAudioUrl));
    }
    return () => {
      revert();
      if (revertRef.current === revert) revertRef.current = null;
    };
    // localMs is applied via seek below; rebuild when script/lang/code changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id, script?.engine, script?.code, script?.sources, script?.beats, script?.audioByLang, script?.holdMs, script?.stageHtml, script?.stageTexts, script?.drive, project.stageCss, project.stageTheme, lang, project.sourceLang]);

  useEffect(() => {
    tlRef.current?.seek(localMs / 1000, false);
  }, [localMs]);

  useEffect(() => {
    if (!playing || !script) return;
    const total = sceneDurationMs(script, langAudioOf(script, lang));
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setLocalMs((ms) => {
        const next = Math.min(total, ms + dt);
        if (next >= total) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, script, lang]);

  if (!script) return null;

  const audio = langAudioOf(script, lang);
  const total = sceneDurationMs(script, audio);
  const beats = beatOrder(script, audio);
  const clip = script.audioByLang?.[lang];
  const speech = createSpeech(script, lang);
  const aspect = project.aspect ?? "16:9";
  const frame = ASPECT_PX[aspect];
  const scale =
    boxSize.w > 0 && boxSize.h > 0 ? Math.min(boxSize.w / frame.w, boxSize.h / frame.h) : boxSize.w > 0 ? boxSize.w / frame.w : 0.2;
  const stageLeft = (boxSize.w - frame.w * scale) / 2;
  const stageTop = (boxSize.h - frame.h * scale) / 2;

  const startResize = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = paneW;
    const move = (ev: PointerEvent) => {
      setPaneW(clampPreviewWidth(startW + (startX - ev.clientX)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside className="relative flex shrink-0 flex-col border-l border-ink-700 bg-ink-900" style={{ width: paneW }}>
      <button
        type="button"
        aria-label="拖动调整预览宽度"
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-copper/70"
        onPointerDown={startResize}
      />
      <div className="border-b border-ink-700 p-3 pl-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-xs uppercase tracking-wider text-ink-400">
            预览 · {LANGS.find((l) => l.id === lang)?.label} · {(total / 1000).toFixed(2)}s
            {usesGsapPreview(script) ? " · 舞台" : " · 节拍卡"}
          </h2>
          <button
            type="button"
            className="rounded border border-ink-600 px-1.5 py-0.5 text-[11px] text-ink-400 hover:border-copper"
            onClick={() => setPaneW((w) => clampPreviewWidth(w - 80))}
          >
            窄
          </button>
          <button
            type="button"
            className="rounded border border-ink-600 px-1.5 py-0.5 text-[11px] text-ink-400 hover:border-copper"
            onClick={() => setPaneW((w) => clampPreviewWidth(w + 80))}
          >
            宽
          </button>
        </div>
        <div
          ref={boxRef}
          className="relative w-full overflow-hidden rounded-xl border border-ink-600 bg-[radial-gradient(circle_at_70%_40%,#2a3026,#10120e_62%)]"
          style={{ aspectRatio: `${frame.w} / ${frame.h}`, maxHeight: "52vh" }}
        >
          {usesGsapPreview(script) ? (
            <div
              className="export-stage absolute overflow-hidden"
              style={{
                ...stageBoxStyle(project, frame.w, frame.h),
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                left: Number.isFinite(stageLeft) ? stageLeft : 0,
                top: Number.isFinite(stageTop) ? stageTop : 0,
              }}
            >
              <div ref={stageRef} className="stage-root absolute inset-0" />
            </div>
          ) : (
            <EngineCard
              script={script}
              clockLang={lang}
              source={project.sourceLang}
              localMs={localMs}
              secondLang={
                project.bilingualCaptions && project.bilingualCaptionLang && project.bilingualCaptionLang !== lang
                  ? project.bilingualCaptionLang
                  : null
              }
            />
          )}
          {usesGsapPreview(script) && !playing && localMs < 80 && (
            <p className="pointer-events-none absolute inset-x-0 bottom-1 z-10 px-2 text-center text-[10px] text-ink-400">
              入场前元件是透明的，点播放或拖进度条
            </p>
          )}
          {project.showCaptions && usesGsapPreview(script) && (
            <CaptionBar
              script={script}
              clockLang={lang}
              source={project.sourceLang}
              localMs={localMs}
              secondLang={
                project.bilingualCaptions && project.bilingualCaptionLang && project.bilingualCaptionLang !== lang
                  ? project.bilingualCaptionLang
                  : null
              }
            />
          )}
        </div>
        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-400">
          <input
            type="checkbox"
            checked={Boolean(project.showCaptions)}
            onChange={(e) => useStudio.getState().patchProject({ showCaptions: e.target.checked })}
          />
          显示字幕（跟口播句对齐）
        </label>
        {error && <p className="mt-2 text-xs leading-relaxed text-copper">{error}</p>}
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded border border-ink-600 px-2 py-1 text-sm" onClick={() => setPlaying((p) => !p)}>
            {playing ? "暂停" : "播放"}
          </button>
          <input
            type="range"
            className="flex-1"
            min={0}
            max={total}
            value={Math.min(localMs, total)}
            onChange={(e) => {
              setPlaying(false);
              setLocalMs(Number(e.target.value));
            }}
          />
          <span className="w-24 text-right text-xs text-ink-400">
            {(localMs / 1000).toFixed(2)} / {(total / 1000).toFixed(2)}s
          </span>
        </div>
        {audioUrl && <audio className="mt-2 w-full" controls src={audioUrl} />}
        <p className="mt-2 min-h-[2.4em] text-sm">
          {(() => {
            const hit = beats.find((b) => b.kind === "speech" && localMs >= b.startMs && localMs < b.startMs + b.ms);
            return hit?.text || "—";
          })()}
        </p>
        <p className="text-[11px] text-ink-400">
          {clip ? (clip.stale ? "配音已过期，请重合成" : `已合成 ${(clip.durationMs / 1000).toFixed(1)}s`) : "尚未合成，时长按字数估算"}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        <table className="w-full">
          <thead>
            <tr className="text-ink-400">
              <th className="pb-1 text-left">口播 id</th>
              <th className="pb-1 text-left">startS</th>
              <th className="pb-1 text-left">speech.s</th>
            </tr>
          </thead>
          <tbody>
            {speech.ids().map((id) => {
              const hit = beats.find((b) => b.id === id);
              const start = hit ? hit.startMs / 1000 : speech.startS(id);
              return (
              <tr key={id}>
                <td className="py-0.5 font-mono">{id}</td>
                <td>{start.toFixed(2)}s</td>
                <td>{speech.s(id).toFixed(2)}s</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
