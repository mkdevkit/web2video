import { useState } from "react";
import { saveAs } from "file-saver";
import { recordProject } from "../../lib/exportVideo";
import {
  EXPORT_FORMATS,
  EXPORT_FPS,
  EXPORT_HEIGHTS,
  EXPORT_PRESETS,
  exportPx,
  exportSettingsOf,
  formatExt,
  formatSupported,
} from "../../lib/exportSettings";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { sourceLangOf } from "../../lib/textI18n";
import { synthScenes } from "../../lib/synthProject";
import { getAudio } from "../../lib/audioStore";
import { subtitleFile } from "../../lib/subtitles";
import { useEditor } from "../../store/useEditor";
import type { ExportSettings, Project } from "../../types";
import { Field, Modal } from "../ui";

type ExportMode = "perLang" | "videoPlusSubs";

function saveSubtitle(
  project: Project,
  clockLang: LangId,
  textLang: LangId,
  format: "srt" | "vtt",
  includeClockLang = false,
) {
  const sub = subtitleFile(project, clockLang, format, textLang, { includeClockLang });
  if (!sub) return;
  const video = langZhName(clockLang);
  const line = langZhName(textLang);
  const name =
    clockLang === textLang ? `${project.name}-${line}.${format}` : `${project.name}-${video}-${line}.${format}`;
  saveAs(new Blob([sub.text], { type: sub.type }), name);
}

export function ExportDialog() {
  const project = useEditor((s) => s.project);
  const source = sourceLangOf(project);
  const st = exportSettingsOf(project.exportSettings);
  const size = exportPx(project.aspect, st.height);
  const defaultLang = project.previewLang ?? source;
  const [mode, setMode] = useState<ExportMode>("perLang");
  const [langs, setLangs] = useState<LangId[]>([defaultLang]);
  const [videoLang, setVideoLang] = useState<LangId>(defaultLang);
  const [subLangs, setSubLangs] = useState<LangId[]>(
    source !== defaultLang ? [defaultLang, source] : [defaultLang],
  );
  const [captions, setCaptions] = useState(false);
  const [includeVideoLangInSubs, setIncludeVideoLangInSubs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const patch = (next: Partial<ExportSettings>) => {
    useEditor.getState().updateProject({ exportSettings: exportSettingsOf({ ...st, ...next }) }, false);
  };

  const toggle = (id: LangId) => {
    setLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleSub = (id: LangId) => {
    setSubLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const pickMode = (next: ExportMode) => {
    setMode(next);
    setErr("");
    if (next === "videoPlusSubs" && !st.exportSubtitles) patch({ exportSubtitles: true });
  };

  const ensureAudio = async (lang: LangId) => {
    const store = useEditor.getState();
    store.setExportHint(`${langZhName(lang)}：检查配音…`);
    const latest = useEditor.getState().project;
    const need: string[] = [];
    for (const scene of latest.scenes) {
      const blob = await getAudio(scene.id, lang);
      if (!blob || scene.audioByLang?.[lang]?.stale) need.push(scene.id);
    }
    if (need.length) {
      store.setExportHint(`${langZhName(lang)}：正在合成 ${need.length} 段配音…`);
      await synthScenes(need, lang, (p) => {
        const line = p.text.replace(/\s+/g, " ").trim();
        const snippet = line.length > 48 ? `${line.slice(0, 48)}…` : line;
        store.setExportHint(
          `${langZhName(lang)}：${p.sceneIndex + 1}/${p.sceneCount} ${p.sceneName}${p.roleName ? ` · ${p.roleName}` : ""}${snippet ? ` · ${snippet}` : ""}`,
        );
      });
    }
  };

  const recordLang = async (lang: LangId) => {
    const store = useEditor.getState();
    store.setPreviewLang(lang);
    store.setPlayhead(0);
    await new Promise((r) => setTimeout(r, 120));
    const stage = document.getElementById("export-stage");
    if (!stage) throw new Error("找不到导出舞台");
    store.setExportHint(`${langZhName(lang)}：正在录制…`);
    const { blob, ext } = await recordProject({
      project: useEditor.getState().project,
      lang,
      stage,
      setPlayhead: (ms) => useEditor.getState().setPlayhead(ms),
      onProgress: (p) => store.setExportHint(`${langZhName(lang)}：${Math.round(p * 100)}%`),
    });
    saveAs(blob, `${useEditor.getState().project.name}-${langZhName(lang)}.${ext}`);
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
    const store = useEditor.getState();
    const prevCaptions = store.project.showCaptions;
    store.setDialog(null);
    store.setPlaying(false);
    store.updateProject({ showCaptions: captions }, false);
    store.setExporting(true);
    store.setExportHint("准备导出…");
    try {
      if (mode === "videoPlusSubs") {
        await ensureAudio(videoLang);
        const ready = useEditor.getState().project;
        store.setExportHint("写出字幕…");
        for (const subLang of subLangs) {
          saveSubtitle(ready, videoLang, subLang, st.subtitleFormat, includeVideoLangInSubs);
        }
        await recordLang(videoLang);
      } else {
        for (const lang of langs) {
          await ensureAudio(lang);
          const ready = useEditor.getState().project;
          if (st.exportSubtitles) saveSubtitle(ready, lang, lang, st.subtitleFormat);
          await recordLang(lang);
        }
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "导出失败");
    } finally {
      store.updateProject({ showCaptions: prevCaptions }, false);
      store.setExporting(false);
      store.setPlaying(false);
      store.setExportHint("");
      setBusy(false);
    }
  };

  const canRun = mode === "videoPlusSubs" ? subLangs.length > 0 : langs.length > 0;
  const runLabel =
    mode === "videoPlusSubs"
      ? `导出 ${langZhName(videoLang)} 视频 + ${subLangs.length} 份字幕`
      : langs.length > 1
        ? `导出 ${langs.length} 种语言`
        : "开始导出";

  return (
    <Modal
      title="导出视频"
      wide
      onClose={() => useEditor.getState().setDialog(null)}
      footer={
        <>
          <button className="btn" onClick={() => useEditor.getState().setDialog(null)}>
            取消
          </button>
          <button className="btn btn-accent" disabled={busy || !canRun} onClick={() => void run()}>
            {busy ? "正在导出…" : runLabel}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs text-ink-400">
        播放舞台并录制（画面 + TTS）。请使用 Chrome / Edge。缺配音时会先自动合成。规格会写入工程。
      </p>
      {err && <p className="mb-2 text-xs text-red-400">{err}</p>}
      <Field label="导出模式">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`btn py-1 ${mode === "perLang" ? "btn-accent" : ""}`}
            onClick={() => pickMode("perLang")}
          >
            每种语言各一段视频
          </button>
          <button
            type="button"
            className={`btn py-1 ${mode === "videoPlusSubs" ? "btn-accent" : ""}`}
            onClick={() => pickMode("videoPlusSubs")}
          >
            一段视频 + 多语言字幕
          </button>
        </div>
      </Field>
      {mode === "perLang" ? (
        <Field label="语言">
          <div className="flex flex-wrap gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`btn py-1 ${langs.includes(l.id) ? "btn-accent" : ""}`}
                onClick={() => toggle(l.id)}
              >
                {langZhName(l.id)}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <>
          <Field label="视频语言（配音与时间轴）">
            <div className="flex flex-wrap gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`btn py-1 ${videoLang === l.id ? "btn-accent" : ""}`}
                  onClick={() => {
                    setVideoLang(l.id);
                    setSubLangs((cur) => (cur.includes(l.id) ? cur : [...cur, l.id]));
                  }}
                >
                  {langZhName(l.id)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="字幕语言（共用视频时间标记）">
            <div className="flex flex-wrap gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`btn py-1 ${subLangs.includes(l.id) ? "btn-accent" : ""}`}
                  onClick={() => toggleSub(l.id)}
                >
                  {langZhName(l.id)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-ink-500">
              只录 {langZhName(videoLang)} 这一段。各字幕文件的起止时间跟这段视频一致。请先译好对应口播。
            </p>
          </Field>
          <label className="mt-2 flex items-center gap-2 text-xs text-ink-200">
            <input
              type="checkbox"
              checked={includeVideoLangInSubs}
              onChange={(e) => setIncludeVideoLangInSubs(e.target.checked)}
            />
            字幕文件附带视频语言（双语）
          </label>
          <p className="text-[10px] text-ink-500">
            {includeVideoLangInSubs
              ? `打开后，每种其它语言的字幕文件里先写 ${langZhName(videoLang)}，再写该语言，时间标记相同。与视频语言相同的那一份仍只有一行。`
              : "关闭后，每种字幕文件只含该语言文案。"}
          </p>
        </>
      )}
      <label className="mt-3 flex items-center gap-2 text-xs text-ink-200">
        <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
        烧录字幕条到画面
      </label>
      {mode === "perLang" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-ink-200">
          <input
            type="checkbox"
            checked={st.exportSubtitles}
            onChange={(e) => patch({ exportSubtitles: e.target.checked })}
          />
          同时导出字幕文件
        </label>
      )}
      {(mode === "videoPlusSubs" || st.exportSubtitles) && (
        <Field label="字幕格式">
          <select
            className="field max-w-[8rem]"
            value={st.subtitleFormat}
            onChange={(e) => patch({ subtitleFormat: e.target.value as "srt" | "vtt" })}
          >
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
          </select>
        </Field>
      )}
      <p className="mt-1 text-[10px] text-ink-500">
        {mode === "videoPlusSubs"
          ? `将得到 1 个视频和 ${subLangs.length} 个字幕文件（时间轴相同${includeVideoLangInSubs ? "，其它语言文件为双语" : ""}）。烧录只影响画面上的字幕条。`
          : "烧录会画进视频；字幕文件按该语言口播时间轴另存。双语在顶栏「配置 → 字幕」开关。"}
      </p>

      <div className="mt-4 border-t border-ink-700 pt-3">
        <div className="section-label">规格</div>
        <Field label="预设">
          <div className="flex flex-wrap gap-1.5">
            {EXPORT_PRESETS.map((p) => (
              <button key={p.id} type="button" className="btn py-1" onClick={() => patch(p.patch)}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <Field label="格式">
            <select
              className="field"
              value={st.format}
              onChange={(e) => patch({ format: e.target.value as ExportSettings["format"] })}
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.id} value={f.id} disabled={!formatSupported(f.id)}>
                  {f.label}
                  {formatSupported(f.id) ? "" : "（本机不支持）"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-ink-500">{EXPORT_FORMATS.find((f) => f.id === st.format)?.hint}</p>
          </Field>
          <Field label={`分辨率 ${size.w}×${size.h}`}>
            <select
              className="field"
              value={st.height}
              onChange={(e) => patch({ height: Number(e.target.value) as ExportSettings["height"] })}
            >
              {EXPORT_HEIGHTS.map((h) => {
                const px = exportPx(project.aspect, h.id);
                return (
                  <option key={h.id} value={h.id}>
                    {h.label} · {px.w}×{px.h}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="帧率">
            <select className="field" value={st.fps} onChange={(e) => patch({ fps: Number(e.target.value) })}>
              {EXPORT_FPS.map((n) => (
                <option key={n} value={n}>
                  {n} fps
                </option>
              ))}
            </select>
          </Field>
          <Field label={`视频码率 ${st.videoMbps} Mbps`}>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              className="w-full"
              value={st.videoMbps}
              onChange={(e) => patch({ videoMbps: Number(e.target.value) })}
            />
          </Field>
          <Field label={`音频码率 ${st.audioKbps} kbps`}>
            <input
              type="range"
              min={64}
              max={192}
              step={16}
              className="w-full"
              value={st.audioKbps}
              onChange={(e) => patch({ audioKbps: Number(e.target.value) })}
            />
          </Field>
        </div>
        <p className="mt-2 text-[10px] text-ink-500">
          将导出 {size.w}×{size.h} · {st.fps} fps · {st.videoMbps} Mbps · {formatExt(st.format).toUpperCase()}
          。浏览器录制不是专业编码器，码率只是目标值。
        </p>
      </div>
    </Modal>
  );
}
