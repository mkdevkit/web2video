import { flushSync } from "react-dom";
import { useState } from "react";
import { saveAs } from "file-saver";
import { recordProject } from "../lib/exportVideo";
import { stageThemeOf, waitStageFonts } from "../lib/stage";
import {
  EXPORT_FORMATS,
  EXPORT_FPS,
  EXPORT_HEIGHTS,
  EXPORT_PRESETS,
  exportPx,
  exportSettingsOf,
  formatSupported,
} from "../lib/exportSettings";
import { LANGS, langZhName, type LangId } from "../lib/langs";
import { synthScript } from "../lib/synthScript";
import { getAudio } from "../lib/audioStore";
import { subtitleFile } from "../lib/subtitles";
import { engineMeta, engineOf } from "../lib/engines";
import { useStudio } from "../store/useStudio";
import type { ExportSettings, Project } from "../types";

type ExportMode = "perLang" | "videoPlusSubs";

function saveSubtitle(project: Project, clockLang: LangId, textLang: LangId, format: "srt" | "vtt", includeClockLang = false) {
  const sub = subtitleFile(project, clockLang, format, textLang, { includeClockLang });
  if (!sub) return;
  const video = langZhName(clockLang);
  const line = langZhName(textLang);
  const name =
    clockLang === textLang ? `${project.name}-${line}.${format}` : `${project.name}-${video}-${line}.${format}`;
  saveAs(new Blob([sub.text], { type: sub.type }), name);
}

export function ExportDialog() {
  const project = useStudio((s) => s.project);
  const st = exportSettingsOf(project.exportSettings);
  const size = exportPx(project.aspect ?? "16:9", st.height);
  const defaultLang = project.previewLang ?? project.sourceLang;
  const [mode, setMode] = useState<ExportMode>("perLang");
  const [langs, setLangs] = useState<LangId[]>([defaultLang]);
  const [videoLang, setVideoLang] = useState<LangId>(defaultLang);
  const [subLangs, setSubLangs] = useState<LangId[]>(
    project.sourceLang !== defaultLang ? [defaultLang, project.sourceLang] : [defaultLang],
  );
  const [captions, setCaptions] = useState(true);
  const [includeVideoLangInSubs, setIncludeVideoLangInSubs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const patch = (next: Partial<ExportSettings>) => {
    useStudio.getState().patchProject({ exportSettings: exportSettingsOf({ ...st, ...next }) });
  };

  const toggle = (id: LangId) => {
    setLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleSub = (id: LangId) => {
    setSubLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const ensureAudio = async (lang: LangId) => {
    const store = useStudio.getState();
    store.setStatus(`${langZhName(lang)}：检查配音…`);
    const latest = useStudio.getState().project;
    for (const script of latest.scripts) {
      const blob = await getAudio(script.id, lang);
      if (!blob || script.audioByLang?.[lang]?.stale) {
        store.setStatus(`${langZhName(lang)}：正在合成「${script.name}」…`);
        await synthScript(script.id, lang, store.setStatus);
      }
    }
  };

  const recordLang = async (lang: LangId) => {
    const store = useStudio.getState();
    store.setPreviewLang(lang);
    store.setExportLang(lang);
    const stage = document.getElementById("export-stage");
    if (!stage) throw new Error("找不到导出舞台");
    const theme = stageThemeOf(useStudio.getState().project.stageTheme);
    await waitStageFonts(theme.fontId, theme.titleFontId, theme.captionFontId);
    store.setStatus(`${langZhName(lang)}：正在录制…`);
    const { blob, ext } = await recordProject({
      project: useStudio.getState().project,
      lang,
      stage,
      setHead: (scriptId, localMs) => store.setExportHead(scriptId, localMs),
      onProgress: (p) => store.setStatus(`${langZhName(lang)}：${Math.round(p * 100)}%`),
    });
    saveAs(blob, `${useStudio.getState().project.name}-${langZhName(lang)}.${ext}`);
  };

  const run = async () => {
    if (mode === "perLang" && !langs.length) {
      setErr("请至少选择一种语言");
      return;
    }
    if (mode === "videoPlusSubs" && !subLangs.length) {
      setErr("请至少选择一种字幕语言");
      return;
    }
    if (!formatSupported(st.format)) {
      setErr("当前浏览器录不了所选格式，请改用 WebM，或换较新的 Chrome / Edge");
      return;
    }
    setBusy(true);
    setErr("");
    const store = useStudio.getState();
    store.setDialog(null);
    flushSync(() => {
      store.setBurnCaptions(captions);
      store.setExporting(true);
    });
    await new Promise((r) => setTimeout(r, 80));
    store.setStatus("准备导出…");
    try {
      if (mode === "videoPlusSubs") {
        await ensureAudio(videoLang);
        const ready = useStudio.getState().project;
        store.setStatus("写出字幕…");
        for (const subLang of subLangs) {
          saveSubtitle(ready, videoLang, subLang, st.subtitleFormat, includeVideoLangInSubs);
        }
        await recordLang(videoLang);
      } else {
        for (const lang of langs) {
          await ensureAudio(lang);
          const ready = useStudio.getState().project;
          if (st.exportSubtitles) saveSubtitle(ready, lang, lang, st.subtitleFormat);
          await recordLang(lang);
        }
      }
      store.setStatus("导出完成");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      store.setStatus(e instanceof Error ? e.message : "导出失败");
      store.setDialog("export");
    } finally {
      store.setExporting(false);
      store.setBurnCaptions(false);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-ink-600 bg-ink-900 p-4">
        <h2 className="mb-2 text-lg font-medium">导出</h2>
        <p className="mb-3 text-sm text-ink-400">
          成片按左侧脚本列表顺序拼接。字幕时间轴跟口播节拍走（speech.s(id)），不是均分整段。
        </p>
        <ol className="mb-3 list-decimal space-y-0.5 pl-5 text-xs text-ink-400">
          {project.scripts.map((s) => (
            <li key={s.id}>
              <span className="text-ink-100">{s.name}</span>
              <span className="ml-1">· {engineMeta(engineOf(s)).label}</span>
            </li>
          ))}
        </ol>

        <div className="mb-3 flex gap-2">
          <button
            className={`rounded border px-2 py-1 text-sm ${mode === "perLang" ? "border-copper bg-ink-800" : "border-ink-600"}`}
            onClick={() => setMode("perLang")}
          >
            每种语言各一段视频
          </button>
          <button
            className={`rounded border px-2 py-1 text-sm ${mode === "videoPlusSubs" ? "border-copper bg-ink-800" : "border-ink-600"}`}
            onClick={() => {
              setMode("videoPlusSubs");
              if (!st.exportSubtitles) patch({ exportSubtitles: true });
            }}
          >
            一段视频 + 多语言字幕
          </button>
        </div>

        {mode === "perLang" ? (
          <>
            <p className="mb-1 text-xs text-ink-400">视频语言（配音与字幕时间轴）</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs ${langs.includes(l.id) ? "border-copper" : "border-ink-600"}`}
                  onClick={() => toggle(l.id)}
                >
                  {langZhName(l.id)}
                </button>
              ))}
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={st.exportSubtitles}
                onChange={(e) => patch({ exportSubtitles: e.target.checked })}
              />
              同时导出字幕文件（时间 = 该语言口播）
            </label>
          </>
        ) : (
          <>
            <label className="mb-2 block text-xs text-ink-400">
              视频语言
              <select
                className="ml-2 rounded border border-ink-600 bg-ink-800 px-1 py-1"
                value={videoLang}
                onChange={(e) => setVideoLang(e.target.value as LangId)}
              >
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {langZhName(l.id)}
                  </option>
                ))}
              </select>
            </label>
            <p className="mb-1 text-xs text-ink-400">字幕语言（共用视频口播时间轴）</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs ${subLangs.includes(l.id) ? "border-copper" : "border-ink-600"}`}
                  onClick={() => toggleSub(l.id)}
                >
                  {langZhName(l.id)}
                </button>
              ))}
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeVideoLangInSubs} onChange={(e) => setIncludeVideoLangInSubs(e.target.checked)} />
              其它语言字幕文件附带视频语言（双语、同一时间标记）
            </label>
          </>
        )}

        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
          烧录字幕条到画面（字体在「外观 → 字体」；跟当前口播句对齐；双语见下方）
        </label>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(project.bilingualCaptions)}
            onChange={(e) => useStudio.getState().patchProject({ bilingualCaptions: e.target.checked })}
          />
          画面双语字幕
        </label>
        {project.bilingualCaptions && (
          <label className="mb-3 block text-xs text-ink-400">
            副行语言
            <select
              className="ml-2 rounded border border-ink-600 bg-ink-800 px-1 py-1"
              value={project.bilingualCaptionLang ?? project.sourceLang}
              onChange={(e) => useStudio.getState().patchProject({ bilingualCaptionLang: e.target.value as LangId })}
            >
              {LANGS.filter((l) => l.id !== defaultLang).map((l) => (
                <option key={l.id} value={l.id}>
                  {langZhName(l.id)}
                </option>
              ))}
            </select>
          </label>
        )}

        {(mode === "videoPlusSubs" || st.exportSubtitles) && (
          <label className="mb-3 block text-xs text-ink-400">
            字幕格式
            <select
              className="ml-2 rounded border border-ink-600 bg-ink-800 px-1 py-1"
              value={st.subtitleFormat}
              onChange={(e) => patch({ subtitleFormat: e.target.value as "srt" | "vtt" })}
            >
              <option value="srt">SRT</option>
              <option value="vtt">VTT</option>
            </select>
          </label>
        )}

        <div className="border-t border-ink-700 pt-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {EXPORT_PRESETS.map((p) => (
              <button key={p.id} type="button" className="rounded border border-ink-600 px-2 py-0.5 text-xs" onClick={() => patch(p.patch)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>
              格式
              <select
                className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-1 py-1"
                value={st.format}
                onChange={(e) => patch({ format: e.target.value as ExportSettings["format"] })}
              >
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.id} value={f.id} disabled={!formatSupported(f.id)}>
                    {f.label}
                    {formatSupported(f.id) ? "" : "（不支持）"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              分辨率 {size.w}×{size.h}
              <select
                className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-1 py-1"
                value={st.height}
                onChange={(e) => patch({ height: Number(e.target.value) as ExportSettings["height"] })}
              >
                {EXPORT_HEIGHTS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              帧率
              <select
                className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-1 py-1"
                value={st.fps}
                onChange={(e) => patch({ fps: Number(e.target.value) })}
              >
                {EXPORT_FPS.map((n) => (
                  <option key={n} value={n}>
                    {n} fps
                  </option>
                ))}
              </select>
            </label>
            <label>
              画幅
              <select
                className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-1 py-1"
                value={project.aspect ?? "16:9"}
                onChange={(e) => useStudio.getState().patchProject({ aspect: e.target.value as Project["aspect"] })}
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </label>
          </div>
        </div>

        {err && <p className="mt-2 text-sm text-copper">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-ink-600 px-3 py-1" onClick={() => useStudio.getState().setDialog(null)} disabled={busy}>
            取消
          </button>
          <button className="rounded bg-copper px-3 py-1 text-paper" onClick={() => void run()} disabled={busy}>
            {busy ? "导出中…" : "开始导出"}
          </button>
        </div>
      </div>
    </div>
  );
}
