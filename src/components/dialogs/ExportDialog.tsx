import { useState } from "react";
import { saveAs } from "file-saver";
import { recordProject } from "../../lib/exportVideo";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { sourceLangOf } from "../../lib/textI18n";
import { synthScenes } from "../../lib/synthProject";
import { getAudio } from "../../lib/audioStore";
import { useEditor } from "../../store/useEditor";
import { Field, Modal } from "../ui";

export function ExportDialog() {
  const project = useEditor((s) => s.project);
  const source = sourceLangOf(project);
  const [langs, setLangs] = useState<LangId[]>([project.previewLang ?? source]);
  const [captions, setCaptions] = useState(project.showCaptions);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggle = (id: LangId) => {
    setLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const run = async () => {
    if (!langs.length) {
      setErr("请至少选择一种语言");
      return;
    }
    setBusy(true);
    setErr("");
    const store = useEditor.getState();
    store.setDialog(null);
    store.setPlaying(false);
    store.updateProject({ showCaptions: captions }, false);
    store.setExporting(true);
    store.setExportHint("准备导出…");
    try {
      for (const lang of langs) {
        store.setExportHint(`${langZhName(lang)}：检查配音…`);
        const latest = useEditor.getState().project;
        const need: string[] = [];
        for (const scene of latest.scenes) {
          const blob = await getAudio(scene.id, lang);
          if (!blob || scene.audioByLang?.[lang]?.stale) need.push(scene.id);
        }
        if (need.length) {
          store.setExportHint(`${langZhName(lang)}：正在合成 ${need.length} 段配音…`);
          await synthScenes(need, lang);
        }
        store.setPreviewLang(lang);
        store.setPlayhead(0);
        await new Promise((r) => setTimeout(r, 120));
        const stage = document.getElementById("export-stage");
        if (!stage) throw new Error("找不到导出舞台");
        store.setExportHint(`${langZhName(lang)}：正在录制…`);
        const blob = await recordProject({
          project: useEditor.getState().project,
          lang,
          stage,
          setPlayhead: (ms) => useEditor.getState().setPlayhead(ms),
          onProgress: (p) => store.setExportHint(`${langZhName(lang)}：${Math.round(p * 100)}%`),
        });
        saveAs(blob, `${useEditor.getState().project.name}-${langZhName(lang)}.webm`);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "导出失败");
    } finally {
      store.setExporting(false);
      store.setPlaying(false);
      store.setExportHint("");
      setBusy(false);
    }
  };

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
          <button className="btn btn-accent" disabled={busy || !langs.length} onClick={() => void run()}>
            {busy ? "正在导出…" : langs.length > 1 ? `导出 ${langs.length} 种语言` : "开始导出"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs text-ink-400">
        逐语言播放舞台并录制成 WebM（画面 + TTS）。请使用 Chrome / Edge。缺配音时会先自动合成。
      </p>
      {err && <p className="mb-2 text-xs text-red-400">{err}</p>}
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
      <label className="mt-3 flex items-center gap-2 text-xs text-ink-200">
        <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
        烧录字幕条
      </label>
    </Modal>
  );
}
