import { useState } from "react";
import { translateText, translateTexts } from "../../lib/edgeTranslate";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { sourceLangOf, writeI18n } from "../../lib/textI18n";
import { synthScenes } from "../../lib/synthProject";
import { isGapSpeak, lineDurationMs, newGapLine, newSpeakLine, speakLineText, speaksOf } from "../../lib/speaks";
import { sceneBlocks } from "../../lib/blocks";
import { markAllAudioStale, markLangAudioStale } from "../../lib/narration";
import { defaultRoleForLang } from "../../lib/tts";
import { profileLabel, qwenRoles } from "../../lib/voices";
import { useEditor } from "../../store/useEditor";
import type { LayoutBlock, Scene, SpeakLine, TimeRef } from "../../types";
import { Field, Modal } from "../ui";

function secInput(ms: number) {
  return Number((Math.max(0, ms) / 1000).toFixed(2));
}

function parseSec(raw: string, max = 60) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 1000);
}

function remapRef(ref: TimeRef | undefined, from: string, to: string): TimeRef | undefined {
  if (!ref || ref.speakId !== from) return ref;
  if (ref.kind === "fixed" || ref.kind === "scene") return ref;
  return { ...ref, speakId: to };
}

function remapSpeakId(scene: Scene, from: string, to: string): Scene {
  const speaks = speaksOf(scene).map((line) => (line.id === from ? { ...line, id: to } : line));
  const blocks = sceneBlocks(scene).map((b) => {
    const effects = b.effects?.map((fx) => ({
      ...fx,
      from: remapRef(fx.from, from, to) ?? fx.from,
      to: remapRef(fx.to, from, to),
    }));
    const playFrom = remapRef(b.settings?.playFrom, from, to);
    const playTarget = b.settings?.playTarget === from ? to : b.settings?.playTarget;
    const settings = { ...b.settings, playFrom, playTarget };
    return { ...b, effects, settings } satisfies LayoutBlock;
  });
  return { ...scene, speaks, blocks };
}

export function SpeakEditorDialog() {
  const project = useEditor((s) => s.project);
  const sceneId = useEditor((s) => s.currentSceneId);
  const scene = project.scenes.find((s) => s.id === sceneId);
  const source = sourceLangOf(project);
  const preview = project.previewLang;
  const roles = qwenRoles(project.voices);
  const fallback = defaultRoleForLang(project, preview);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [alsoTts, setAlsoTts] = useState(false);
  const [filter, setFilter] = useState("");

  if (!scene) return null;
  const lines = speaksOf(scene);
  const clip = scene.audioByLang?.[preview];

  const write = (next: SpeakLine[], staleLang?: LangId | "all") => {
    useEditor.getState().patchScene(
      scene.id,
      (s) => {
        let out: Scene = { ...s, speaks: next, speakTrack: undefined };
        if (staleLang === "all") out = markAllAudioStale(out);
        else if (staleLang) out = markLangAudioStale(out, staleLang);
        return out;
      },
      true,
    );
  };

  const patchLine = (id: string, patch: Partial<SpeakLine>, staleLang?: LangId | "all") => {
    write(
      speaksOf(useEditor.getState().project.scenes.find((s) => s.id === scene.id) ?? scene).map((line) =>
        line.id === id ? { ...line, ...patch, id: line.id } : line,
      ),
      staleLang,
    );
  };

  const renameLine = (from: string, raw: string) => {
    const to = raw.trim();
    if (!to || to === from) return;
    const latest = speaksOf(useEditor.getState().project.scenes.find((s) => s.id === scene.id) ?? scene);
    if (latest.some((x) => x.id === to)) return;
    useEditor.getState().patchScene(scene.id, (s) => remapSpeakId(s, from, to), true);
  };

  const move = (id: string, dir: -1 | 1) => {
    const next = [...lines];
    const i = next.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };

  const translateLine = async (line: SpeakLine, to: LangId, overwrite: boolean) => {
    if (isGapSpeak(line) || to === source) return;
    const src = speakLineText(line, source, source).trim();
    if (!src) return;
    if (!overwrite && (line.i18n?.[to] ?? "").trim()) return;
    const out = await translateText(src, source, to);
    const latest = speaksOf(useEditor.getState().project.scenes.find((s) => s.id === scene.id) ?? scene);
    const hit = latest.find((x) => x.id === line.id) ?? line;
    patchLine(line.id, { i18n: writeI18n(hit.i18n, to, source, out) }, to);
  };

  const ttsAfter = async (targets: LangId[]) => {
    if (!alsoTts) return;
    for (const to of targets) await synthScenes([scene.id], to);
  };

  const translateAll = async (overwrite: boolean) => {
    const targets = LANGS.map((l) => l.id).filter((id) => id !== source);
    const speech = lines.filter((l) => !isGapSpeak(l));
    if (!speech.length || !targets.length) return;
    setError("");
    setBusy(overwrite ? "all" : "empty");
    try {
      const sources = speech.map((l) => speakLineText(l, source, source));
      for (const to of targets) {
        const need = speech
          .map((l, i) => ({ l, src: sources[i] }))
          .filter(({ l, src }) => src.trim() && (overwrite || !(l.i18n?.[to] ?? "").trim()));
        if (!need.length) continue;
        const out = await translateTexts(
          need.map((n) => n.src),
          source,
          to,
        );
        const latest = speaksOf(useEditor.getState().project.scenes.find((s) => s.id === scene.id) ?? scene);
        const next = latest.map((line) => {
          const idx = need.findIndex((n) => n.l.id === line.id);
          if (idx < 0) return line;
          return { ...line, i18n: writeI18n(line.i18n, to, source, out[idx] ?? need[idx].src) };
        });
        write(next, to);
      }
      await ttsAfter(targets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "翻译失败");
    } finally {
      setBusy(null);
    }
  };

  const translateRow = async (line: SpeakLine) => {
    if (isGapSpeak(line)) return;
    setBusy(line.id);
    setError("");
    try {
      await Promise.all(LANGS.filter((l) => l.id !== source).map((l) => translateLine(line, l.id, true)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "翻译失败");
    } finally {
      setBusy(null);
    }
  };

  const rows = lines.filter((line) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    if (line.id.toLowerCase().includes(q)) return true;
    if ((line.name ?? "").toLowerCase().includes(q)) return true;
    if (isGapSpeak(line)) return "延时".includes(q) || "gap".includes(q);
    return Object.values(line.i18n ?? {}).some((t) => (t ?? "").toLowerCase().includes(q));
  });

  return (
    <Modal title={`口播 · ${scene.name}`} xl onClose={() => useEditor.getState().setDialog(null)}>
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
        <button className="btn" onClick={() => write([...lines, newSpeakLine(source)], "all")}>
          加一句
        </button>
        <button className="btn" onClick={() => write([...lines, newGapLine()])}>
          加延时
        </button>
        <input
          className="field w-36"
          placeholder="筛选 id / 内容"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
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
        <span className="pb-1 text-[11px] text-ink-400">
          {clip ? (clip.stale ? "配音已过期" : `${(clip.durationMs / 1000).toFixed(1)}s`) : "未合成则按时长估算"}
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-400">
        九种语言写在同一张表里。口播驱动按此列表走时钟；句间留白请加延时。时长各语言共用，未手改时用合成实测或按字数估计。机翻请校对专有名词。
      </p>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <div className="overflow-auto rounded-lg border border-ink-600">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-ink-900 text-[10px] text-ink-400">
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
            {rows.map((line) => {
              const idx = lines.findIndex((x) => x.id === line.id);
              return isGapSpeak(line) ? (
                <tr key={line.id} className="border-t border-ink-700 bg-ink-950/50 align-top">
                  <td className="px-1 py-1">
                    <input
                      className="field w-24 py-0.5 font-mono text-[11px]"
                      defaultValue={line.id}
                      key={line.id}
                      onBlur={(e) => renameLine(line.id, e.target.value)}
                    />
                    <div className="px-1 text-[10px] text-ink-500">延时</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <label className="flex items-center gap-1 font-mono text-brass">
                      <input
                        type="number"
                        min={0.05}
                        step={0.05}
                        className="field w-16 py-0.5"
                        value={secInput(lineDurationMs(scene, line, preview, source))}
                        onChange={(e) => patchLine(line.id, { durationMs: Math.max(50, parseSec(e.target.value)) })}
                      />
                      s
                    </label>
                  </td>
                  <td className="px-2 py-1.5 text-ink-500">—</td>
                  <td className="whitespace-nowrap px-1 py-1">
                    <button className="btn px-1 py-0.5" disabled={idx <= 0} onClick={() => move(line.id, -1)}>
                      ↑
                    </button>
                    <button className="btn ml-0.5 px-1 py-0.5" disabled={idx < 0 || idx >= lines.length - 1} onClick={() => move(line.id, 1)}>
                      ↓
                    </button>
                    <button className="btn ml-0.5 px-1.5 py-0.5" onClick={() => write(lines.filter((x) => x.id !== line.id), "all")}>
                      删
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-ink-500" colSpan={LANGS.length}>
                    无文案。插入这段静音后，后面的口播后移。
                  </td>
                </tr>
              ) : (
                <tr key={line.id} className="border-t border-ink-700 align-top">
                  <td className="px-1 py-1">
                    <input
                      className="field w-24 py-0.5 font-mono text-[11px]"
                      defaultValue={line.id}
                      key={line.id}
                      onBlur={(e) => renameLine(line.id, e.target.value)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-brass" title="由合成实测或按字数估计，不可手改">
                    {secInput(lineDurationMs(scene, line, preview, source)).toFixed(2)}s
                  </td>
                  <td className="px-1 py-1">
                    <select
                      className="field min-w-[7rem] py-0.5"
                      value={roles.some((r) => r.id === (line.role ?? "")) ? line.role : ""}
                      onChange={(e) => patchLine(line.id, { role: e.target.value.trim() || undefined }, "all")}
                    >
                      <option value="">默认{fallback ? `（${profileLabel(fallback)}）` : ""}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {profileLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-1 py-1">
                    <button
                      className="btn px-1.5 py-0.5"
                      disabled={Boolean(busy)}
                      onClick={() => void translateRow(line)}
                    >
                      {busy === line.id ? "…" : "翻译此句"}
                    </button>
                    <button className="btn ml-0.5 px-1 py-0.5" disabled={idx <= 0} onClick={() => move(line.id, -1)}>
                      ↑
                    </button>
                    <button className="btn ml-0.5 px-1 py-0.5" disabled={idx < 0 || idx >= lines.length - 1} onClick={() => move(line.id, 1)}>
                      ↓
                    </button>
                    <button className="btn ml-0.5 px-1.5 py-0.5" onClick={() => write(lines.filter((x) => x.id !== line.id), "all")}>
                      删
                    </button>
                  </td>
                  {LANGS.map((l) => (
                    <td key={l.id} className="px-1 py-1">
                      <textarea
                        className={`field min-h-[52px] w-full text-[11px] ${l.id === source ? "border-brass/50" : ""}`}
                        value={line.i18n?.[l.id] ?? ""}
                        onChange={(e) =>
                          patchLine(line.id, { i18n: writeI18n(line.i18n, l.id, source, e.target.value) }, l.id)
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
