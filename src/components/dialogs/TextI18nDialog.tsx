import { useMemo, useState } from "react";
import { translateText, translateTexts } from "../../lib/edgeTranslate";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { collectI18nRows, sourceLangOf, sourceTextOf, writeI18n } from "../../lib/textI18n";
import { synthScenes } from "../../lib/synthProject";
import { useEditor } from "../../store/useEditor";
import type { I18nRow } from "../../lib/textI18n";
import { Field, Modal } from "../ui";

export function TextI18nDialog() {
  const project = useEditor((s) => s.project);
  const source = sourceLangOf(project);
  const preview = project.previewLang;
  const rows = useMemo(() => collectI18nRows(project), [project]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [alsoTts, setAlsoTts] = useState(true);

  const shown = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      r.label.toLowerCase().includes(q) ||
      r.sceneName.toLowerCase().includes(q) ||
      sourceTextOf(r, source).toLowerCase().includes(q)
    );
  });

  const patchOne = (row: I18nRow, lang: LangId, value: string) => {
    useEditor.getState().applyI18nRow(row, lang, value, false);
  };

  const translateRow = async (row: I18nRow, to: LangId, overwrite: boolean) => {
    const src = sourceTextOf(row, source).trim();
    if (!src || to === source) return;
    if (!overwrite && row.i18n[to]?.trim()) return;
    const out = await translateText(src, source, to);
    useEditor.getState().applyI18nRow(row, to, out, true);
  };

  const ttsAfter = async (targets: LangId[]) => {
    if (!alsoTts) return;
    const ids = [...new Set(project.scenes.map((s) => s.id))];
    for (const to of targets) await synthScenes(ids, to);
  };

  const translateAll = async (overwrite: boolean) => {
    const targets = LANGS.map((l) => l.id).filter((id) => id !== source);
    if (!rows.length || !targets.length) return;
    setError("");
    setBusy(overwrite ? "all" : "empty");
    try {
      const sources = rows.map((r) => sourceTextOf(r, source));
      for (const to of targets) {
        const need = rows
          .map((r, i) => ({ r, i, src: sources[i] }))
          .filter(({ r, src }) => src.trim() && (overwrite || !r.i18n[to]?.trim()));
        if (!need.length) continue;
        const out = await translateTexts(
          need.map((n) => n.src),
          source,
          to,
        );
        const latest = collectI18nRows(useEditor.getState().project);
        need.forEach((n, j) => {
          const hit =
            latest.find((x) => x.sceneId === n.r.sceneId && x.kind === n.r.kind && x.itemId === n.r.itemId) ?? n.r;
          const i18n = writeI18n(hit.i18n, to, source, out[j] ?? n.src);
          useEditor.getState().applyI18nRow(hit, to, i18n[to] ?? out[j] ?? n.src, false);
        });
      }
      await ttsAfter(targets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "翻译失败");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="多语言文本" xl onClose={() => useEditor.getState().setDialog(null)}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="源语言">
          <select
            className="field w-36"
            value={source}
            onChange={(e) => useEditor.getState().setSourceLang(e.target.value as LangId)}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {langZhName(l.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="预览语言">
          <select
            className="field w-36"
            value={preview}
            onChange={(e) => useEditor.getState().setPreviewLang(e.target.value as LangId)}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {langZhName(l.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="筛选">
          <input className="field w-40" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="名称 / 内容" />
        </Field>
        <button className="btn" disabled={Boolean(busy)} onClick={() => void translateAll(false)}>
          {busy === "empty" ? "翻译中…" : "一键翻译空缺"}
        </button>
        <button className="btn" disabled={Boolean(busy)} onClick={() => void translateAll(true)}>
          {busy === "all" ? "翻译中…" : "全部重译"}
        </button>
        <label className="flex items-center gap-1.5 pb-1 text-[11px] text-ink-300">
          <input type="checkbox" checked={alsoTts} onChange={(e) => setAlsoTts(e.target.checked)} />
          翻译后合成语音
        </label>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-400">
        使用 Microsoft Edge 免费翻译（无需密钥）。开场/结束口播、元件名称、元件口播与画面文案分开翻译；合成配音后会按各段口播写入场时间。机翻请校对专有名词。
      </p>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {!rows.length && <p className="py-8 text-center text-sm text-ink-400">还没有可翻译的文本。</p>}
      {shown.length > 0 && (
        <div className="overflow-auto rounded-lg border border-ink-600">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-900 text-[10px] text-ink-400">
              <tr>
                <th className="px-2 py-1.5 font-medium">场景</th>
                <th className="px-2 py-1.5 font-medium">字段</th>
                {LANGS.map((l) => (
                  <th key={l.id} className="min-w-[140px] px-2 py-1.5 font-medium">
                    {langZhName(l.id)}
                    {l.id === source ? " · 源" : ""}
                    {l.id === preview ? " · 预览" : ""}
                  </th>
                ))}
                <th className="px-2 py-1.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={`${row.sceneId}-${row.kind}-${row.itemId ?? ""}-${row.speakKey ?? ""}`} className="border-t border-ink-700 align-top">
                  <td className="max-w-[88px] truncate px-2 py-1.5 text-ink-200">{row.sceneName}</td>
                  <td className="max-w-[72px] truncate px-2 py-1.5 text-ink-400">{row.label}</td>
                  {LANGS.map((l) => (
                    <td key={l.id} className="px-1 py-1">
                      <textarea
                        className="field min-h-[52px] text-[11px]"
                        value={row.i18n[l.id] ?? ""}
                        onChange={(e) => patchOne(row, l.id, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button
                      className="btn whitespace-nowrap"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        setBusy(row.sceneId + row.kind);
                        void Promise.all(LANGS.filter((l) => l.id !== source).map((l) => translateRow(row, l.id, true)))
                          .catch((e) => setError(e instanceof Error ? e.message : "翻译失败"))
                          .finally(() => setBusy(null));
                      }}
                    >
                      {busy === row.sceneId + row.kind ? "…" : "翻译此条"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
