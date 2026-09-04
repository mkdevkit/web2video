import { useEffect, useState } from "react";
import { useStudio } from "../store/useStudio";
import { LANGS, langZhName } from "../lib/langs";
import { translateText, translateTexts } from "../lib/edgeTranslate";
import { stageTextsChanged, syncStageTexts } from "../lib/stageText";
import type { LangId } from "../lib/langs";

export function StageTextEditor() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const patchScript = useStudio((s) => s.patchScript);
  const setStatus = useStudio((s) => s.setStatus);
  const script = project.scripts.find((x) => x.id === scriptId);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("");

  const source = project.sourceLang;
  const preview = project.previewLang;

  useEffect(() => {
    if (!script) return;
    const next = syncStageTexts(script.stageHtml ?? "", script.stageTexts, source);
    if (stageTextsChanged(script.stageTexts, next)) patchScript(script.id, { stageTexts: next });
  }, [script?.id, script?.stageHtml, source]);

  if (!script) return <div className="p-6 text-ink-400">没有脚本</div>;

  const rows = (script.stageTexts ?? []).filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    if (r.id.toLowerCase().includes(q)) return true;
    return Object.values(r.text).some((t) => (t ?? "").toLowerCase().includes(q));
  });
  const targets = LANGS.map((l) => l.id).filter((id) => id !== source);

  const setCell = (id: string, lang: LangId, value: string) => {
    const latest = useStudio.getState().project.scripts.find((s) => s.id === script.id);
    const stageTexts = (latest?.stageTexts ?? []).map((t) =>
      t.id === id ? { ...t, text: { ...t.text, [lang]: value } } : t,
    );
    patchScript(script.id, { stageTexts });
  };

  const translateAll = async (overwrite: boolean) => {
    setErr("");
    setBusy(overwrite ? "all" : "empty");
    try {
      for (const to of targets) {
        const current = useStudio.getState().project.scripts.find((s) => s.id === script.id);
        if (!current) throw new Error("找不到脚本");
        const need = (current.stageTexts ?? [])
          .map((r) => ({ r, src: (r.text[source] ?? "").trim() }))
          .filter(({ r, src }) => src && (overwrite || !(r.text[to] ?? "").trim()));
        if (!need.length) continue;
        const out = await translateTexts(
          need.map((n) => n.src),
          source,
          to,
        );
        const latest = useStudio.getState().project.scripts.find((s) => s.id === script.id);
        const stageTexts = (latest?.stageTexts ?? []).map((t) => {
          const i = need.findIndex((n) => n.r.id === t.id);
          if (i < 0) return t;
          return { ...t, text: { ...t.text, [to]: out[i] ?? need[i].src } };
        });
        patchScript(script.id, { stageTexts });
      }
      setStatus("画面文本翻译完成");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const translateRow = async (id: string) => {
    const row = script.stageTexts?.find((t) => t.id === id);
    const src = (row?.text[source] ?? "").trim();
    if (!row || !src) return;
    setBusy(id);
    setErr("");
    try {
      let text = { ...row.text };
      for (const lang of targets) {
        text = { ...text, [lang]: await translateText(src, source, lang) };
      }
      const latest = useStudio.getState().project.scripts.find((s) => s.id === script.id);
      patchScript(script.id, {
        stageTexts: (latest?.stageTexts ?? []).map((t) => (t.id === id ? { ...t, text } : t)),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">文本</h2>
        <input
          className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
          placeholder="筛选 id / 内容"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="rounded border border-ink-600 px-2 py-1 text-sm" disabled={Boolean(busy)} onClick={() => void translateAll(false)}>
          {busy === "empty" ? "翻译中…" : "一键翻译空缺"}
        </button>
        <button className="rounded border border-ink-600 px-2 py-1 text-sm" disabled={Boolean(busy)} onClick={() => void translateAll(true)}>
          {busy === "all" ? "翻译中…" : "全部重译"}
        </button>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-400">
        从本脚本舞台 HTML 抽出需要翻译的节点（含字母或汉字；id 或 data-text）。箭头、间隔号、省略号、纯数字等只有符号的不进表。和口播分开。预览 / 导出走顶栏预览语言。脚本里可用{" "}
        <code className="text-brass">stage.text("id")</code>。改 HTML 后会重新扫描；已译的其它语言会尽量保留。
      </p>
      {err && <p className="mb-2 text-xs text-copper">{err}</p>}
      {!rows.length && <p className="text-sm text-ink-400">舞台 HTML 里还没有可翻译的字。给节点加 id 或 data-text。</p>}
      {rows.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto rounded border border-ink-600">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-900 text-[10px] text-ink-400">
              <tr>
                <th className="px-2 py-1.5 font-medium">id</th>
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
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-ink-700 align-top">
                  <td className="px-2 py-1.5 font-mono text-[11px] text-ink-300">{row.id}</td>
                  {LANGS.map((l) => (
                    <td key={l.id} className="px-1 py-1">
                      <textarea
                        className="min-h-[52px] w-full rounded border border-ink-600 bg-ink-800 p-1 text-[11px]"
                        value={row.text[l.id] ?? ""}
                        onChange={(e) => setCell(row.id, l.id, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button className="rounded border border-ink-600 px-2 py-1 disabled:opacity-40" disabled={Boolean(busy)} onClick={() => void translateRow(row.id)}>
                      {busy === row.id ? "…" : "翻译此条"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
