import { useState } from "react";
import { translateText, translateTexts } from "../../lib/edgeTranslate";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { sourceLangOf, writeI18n } from "../../lib/textI18n";
import { synthScenes } from "../../lib/synthProject";
import { isGapSpeak, lineDurationMs, newGapLine, newSpeakLine, speakLineText, speaksOf } from "../../lib/speaks";
import { markAllAudioStale, markLangAudioStale } from "../../lib/narration";
import { defaultRoleForLang } from "../../lib/tts";
import { profileLabel, qwenRoles } from "../../lib/voices";
import { useEditor } from "../../store/useEditor";
import type { Scene, SpeakLine } from "../../types";
import { Field, Modal } from "../ui";

function secInput(ms: number) {
  return Number((Math.max(0, ms) / 1000).toFixed(2));
}

function parseSec(raw: string, max = 60) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 1000);
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
  const [alsoTts, setAlsoTts] = useState(true);

  if (!scene) return null;
  const lines = speaksOf(scene);

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
        每条口播有独立 id 与时长。口播驱动按此列表走时钟；句间留白请加延时。时长各语言共用，未手改时用合成实测或按字数估计。机翻请校对专有名词。
      </p>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={line.id} className="rounded-lg border border-ink-600 p-2">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <span className="w-5 shrink-0 text-[10px] text-ink-500">{i + 1}</span>
              {isGapSpeak(line) ? (
                <span className="text-[11px] text-ink-200">延时</span>
              ) : (
                <input
                  className="field max-w-[10rem] py-0.5 text-[11px]"
                  placeholder="备注名（可选）"
                  value={line.name ?? ""}
                  onChange={(e) => patchLine(line.id, { name: e.target.value })}
                />
              )}
              <span className="truncate font-mono text-[10px] text-ink-500" title={line.id}>
                {line.id}
              </span>
              <Field label="时长（秒）">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="field w-20 py-0.5"
                  value={secInput(lineDurationMs(scene, line, preview, source))}
                  onChange={(e) => patchLine(line.id, { durationMs: Math.max(50, parseSec(e.target.value)) })}
                />
              </Field>
              {!isGapSpeak(line) && roles.length > 0 && (
                <Field label="角色">
                  <select
                    className="field w-36 py-0.5"
                    value={roles.some((r) => r.id === (line.role ?? "")) ? line.role : ""}
                    onChange={(e) => patchLine(line.id, { role: e.target.value.trim() || undefined }, "all")}
                  >
                    <option value="">默认（{fallback ? profileLabel(fallback) : "语言默认"}）</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {profileLabel(r)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <button className="btn px-1 py-0.5" disabled={i === 0} onClick={() => move(line.id, -1)}>
                ↑
              </button>
              <button className="btn px-1 py-0.5" disabled={i === lines.length - 1} onClick={() => move(line.id, 1)}>
                ↓
              </button>
              <button className="btn px-1.5 py-0.5" onClick={() => write(lines.filter((x) => x.id !== line.id), "all")}>
                ×
              </button>
            </div>
            {!isGapSpeak(line) && (
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {LANGS.map((l) => (
                  <Field key={l.id} label={`${langZhName(l.id)}${l.id === source ? " · 源" : ""}${l.id === preview ? " · 预览" : ""}`}>
                    <textarea
                      className="field min-h-[52px] text-[11px]"
                      value={line.i18n?.[l.id] ?? ""}
                      onChange={(e) =>
                        patchLine(line.id, { i18n: writeI18n(line.i18n, l.id, source, e.target.value) }, l.id)
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
            {!isGapSpeak(line) && (
              <button
                className="btn mt-1"
                disabled={Boolean(busy)}
                onClick={() => {
                  setBusy(line.id);
                  void Promise.all(LANGS.filter((l) => l.id !== source).map((l) => translateLine(line, l.id, true)))
                    .catch((e) => setError(e instanceof Error ? e.message : "翻译失败"))
                    .finally(() => setBusy(null));
                }}
              >
                {busy === line.id ? "…" : "翻译此条"}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={() => write([...lines, newSpeakLine(source)], "all")}>
          添加口播
        </button>
        <button className="btn" onClick={() => write([...lines, newGapLine()])}>
          加延时
        </button>
      </div>
    </Modal>
  );
}
