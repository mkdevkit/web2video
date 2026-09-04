import { useState } from "react";
import { useStudio } from "../store/useStudio";
import { LANGS, langZhName } from "../lib/langs";
import { createSpeech } from "../lib/speech";
import { translateText, translateTexts } from "../lib/edgeTranslate";
import { synthScript } from "../lib/synthScript";
import { driveOf, isGapBeat } from "../lib/beats";
import type { DriveMode } from "../types";

export function BeatEditor() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const addBeat = useStudio((s) => s.addBeat);
  const addGap = useStudio((s) => s.addGap);
  const removeBeat = useStudio((s) => s.removeBeat);
  const patchBeat = useStudio((s) => s.patchBeat);
  const renameBeat = useStudio((s) => s.renameBeat);
  const patchScript = useStudio((s) => s.patchScript);
  const setStatus = useStudio((s) => s.setStatus);
  const [alsoTts, setAlsoTts] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("");
  const script = project.scripts.find((x) => x.id === scriptId);

  if (!script) return <div className="p-6 text-ink-400">没有脚本</div>;

  const source = project.sourceLang;
  const preview = project.previewLang;
  const speech = createSpeech(script, preview);
  const clip = script.audioByLang?.[preview];
  const targets = LANGS.map((l) => l.id).filter((id) => id !== source);
  const drive = driveOf(script);

  const rows = script.beats.filter((b) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    if (b.id.toLowerCase().includes(q)) return true;
    if (isGapBeat(b)) return "延时".includes(q) || "gap".includes(q);
    return Object.values(b.text).some((t) => (t ?? "").toLowerCase().includes(q));
  });

  const spoken = (list: typeof script.beats) => list.filter((b) => !isGapBeat(b));

  const translateAll = async (overwrite: boolean) => {
    setErr("");
    setBusy(overwrite ? "all" : "empty");
    try {
      for (const to of targets) {
        const current = useStudio.getState().project.scripts.find((s) => s.id === script.id);
        if (!current) throw new Error("找不到脚本");
        const need = spoken(current.beats)
          .map((b) => ({ b, src: (b.text[source] ?? "").trim() }))
          .filter(({ b, src }) => src && (overwrite || !(b.text[to] ?? "").trim()));
        if (!need.length) continue;
        const out = await translateTexts(
          need.map((n) => n.src),
          source,
          to,
        );
        need.forEach((n, j) => {
          const latest = useStudio.getState().project.scripts.find((s) => s.id === script.id)?.beats.find((x) => x.id === n.b.id);
          if (!latest) return;
          patchBeat(script.id, n.b.id, { text: { ...latest.text, [to]: out[j] ?? n.src } });
        });
      }
      if (alsoTts) {
        for (const to of targets) await synthScript(script.id, to, setStatus);
      }
      setStatus("翻译完成");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const translateRow = async (beatId: string) => {
    const beat = script.beats.find((b) => b.id === beatId);
    const src = (beat?.text[source] ?? "").trim();
    if (!beat || isGapBeat(beat) || !src) return;
    setBusy(beatId);
    setErr("");
    try {
      let text = { ...beat.text };
      for (const lang of targets) {
        text = { ...text, [lang]: await translateText(src, source, lang) };
      }
      patchBeat(script.id, beatId, { text });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const setDrive = (next: DriveMode) => {
    if (next === drive) return;
    patchScript(script.id, { drive: next, driveSchedule: undefined, driveTotalMs: undefined });
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">口播</h2>
        <div className="flex rounded border border-ink-600 text-xs">
          <button
            type="button"
            className={`px-2 py-1 ${drive === "narration" ? "bg-ink-800 text-ink-100" : "text-ink-400"}`}
            onClick={() => setDrive("narration")}
          >
            口播驱动
          </button>
          <button
            type="button"
            className={`px-2 py-1 ${drive === "script" ? "bg-ink-800 text-ink-100" : "text-ink-400"}`}
            onClick={() => setDrive("script")}
          >
            脚本驱动
          </button>
        </div>
        <span className="text-xs text-ink-400">
          {drive === "narration"
            ? "列表顺序即时钟；加延时行插入静音。脚本用 speech.startS(id)"
            : "列表是台词库。脚本用 speech.play(\"hook\") 排期，sleepS 插在 play 之间"}
        </span>
        <button className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper" onClick={() => addBeat(script.id)}>
          加一句
        </button>
        <button className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper" onClick={() => addGap(script.id)}>
          加延时
        </button>
        <input
          className="w-36 rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
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
        <label className="flex items-center gap-1.5 text-xs text-ink-300">
          <input type="checkbox" checked={alsoTts} onChange={(e) => setAlsoTts(e.target.checked)} />
          翻译后合成语音
        </label>
        <span className="text-[11px] text-ink-400">
          {clip ? (clip.stale ? "配音已过期" : `${(clip.durationMs / 1000).toFixed(1)}s`) : "未合成则按时长估算"}
        </span>
      </div>
      <p className="mb-2 text-xs text-ink-400">
        {drive === "narration"
          ? "延时行只有时长、跨语言相同，合成时插入静音，后面的 startS 会后移。九种语言写在同一张表里。"
          : "脚本驱动不按表顺序自动播。GSAP 里 speech.play(\"hook\") 返回开始秒，可当 timeline 的 position。"}
      </p>
      {err && <p className="mb-2 text-sm text-copper">{err}</p>}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-ink-700">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-ink-800 text-[10px] text-ink-400">
            <tr>
              <th className="px-2 py-1.5 font-medium">id</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">时长</th>
              <th className="px-2 py-1.5 font-medium">角色</th>
              <th className="px-2 py-1.5 font-medium">操作</th>
              {LANGS.map((l) => (
                <th key={l.id} className="min-w-[140px] px-2 py-1.5 font-medium">
                  {langZhName(l.id)}
                  {l.id === source ? " · 源" : ""}
                  {l.id === preview ? " · 预览" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((beat) =>
              isGapBeat(beat) ? (
                <tr key={beat.id} className="border-t border-ink-700 bg-ink-900/60 align-top">
                  <td className="px-1 py-1">
                    <input
                      className="w-24 rounded border border-ink-600 bg-ink-800 px-1 py-1 font-mono text-xs"
                      defaultValue={beat.id}
                      onBlur={(e) => renameBeat(script.id, beat.id, e.target.value.trim())}
                    />
                    <div className="px-1 text-[10px] text-ink-500">延时</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <label className="flex items-center gap-1 font-mono text-brass">
                      <input
                        type="number"
                        min={0.05}
                        step={0.05}
                        className="w-16 rounded border border-ink-600 bg-ink-800 px-1 py-1 text-xs"
                        defaultValue={((beat.gapMs ?? 400) / 1000).toString()}
                        key={`${beat.id}-${beat.gapMs ?? 400}`}
                        onBlur={(e) => {
                          const s = Number(e.target.value);
                          if (!Number.isFinite(s) || s <= 0) return;
                          patchBeat(script.id, beat.id, { gapMs: Math.round(s * 1000) });
                        }}
                      />
                      s
                    </label>
                  </td>
                  <td className="px-2 py-1.5 text-ink-500">—</td>
                  <td className="whitespace-nowrap px-1 py-1">
                    <button className="text-ink-400 hover:text-copper" onClick={() => removeBeat(script.id, beat.id)}>
                      删
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-ink-500" colSpan={LANGS.length}>
                    无文案。{drive === "narration" ? "插入这段静音后，后面的口播后移。" : "脚本驱动下不会自动插入；要用 speech.play(id) 或 sleepS。"}
                  </td>
                </tr>
              ) : (
                <tr key={beat.id} className="border-t border-ink-700 align-top">
                  <td className="px-1 py-1">
                    <input
                      className="w-24 rounded border border-ink-600 bg-ink-800 px-1 py-1 font-mono text-xs"
                      defaultValue={beat.id}
                      onBlur={(e) => renameBeat(script.id, beat.id, e.target.value.trim())}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-brass">{speech.s(beat.id).toFixed(2)}s</td>
                  <td className="px-1 py-1">
                    <select
                      className="rounded border border-ink-600 bg-ink-800 px-1 py-1"
                      value={beat.roleId ?? ""}
                      onChange={(e) => patchBeat(script.id, beat.id, { roleId: e.target.value || undefined })}
                    >
                      <option value="">默认</option>
                      {project.voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-1 py-1">
                    <button className="mr-2 text-ink-400 hover:text-brass disabled:opacity-40" disabled={Boolean(busy)} onClick={() => void translateRow(beat.id)}>
                      {busy === beat.id ? "…" : "翻译此句"}
                    </button>
                    <button className="text-ink-400 hover:text-copper" onClick={() => removeBeat(script.id, beat.id)}>
                      删
                    </button>
                  </td>
                  {LANGS.map((l) => (
                    <td key={l.id} className="px-1 py-1">
                      <textarea
                        className={`min-h-[52px] w-full rounded border bg-ink-800 p-1 text-[11px] ${l.id === source ? "border-brass/50" : "border-ink-600"}`}
                        value={beat.text[l.id] ?? ""}
                        onChange={(e) => patchBeat(script.id, beat.id, { text: { ...beat.text, [l.id]: e.target.value } })}
                      />
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
