import { useState } from "react";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { catalogFor, PROVIDER_LABEL, profileLabel } from "../../lib/voices";
import { loadTtsSecrets, saveTtsSecrets, type TtsSecrets } from "../../lib/ttsSecrets";
import { synthScenes } from "../../lib/synthProject";
import { uid } from "../../lib/ids";
import { useEditor } from "../../store/useEditor";
import type { TtsProvider, VoiceProfile } from "../../types";
import { Field, Modal } from "../ui";

export function TtsDialog() {
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [secrets, setSecrets] = useState<TtsSecrets>(() => loadTtsSecrets());
  const [draft, setDraft] = useState<Pick<VoiceProfile, "name" | "lang" | "provider" | "voiceId">>({
    name: "新角色",
    lang: project.previewLang,
    provider: project.ttsProvider ?? "edge",
    voiceId: catalogFor(project.ttsProvider ?? "edge", project.previewLang)[0]?.id ?? "",
  });
  const lang = project.previewLang;
  const voices = project.voices ?? [];

  const patchSecrets = (patch: Partial<TtsSecrets>) => {
    const next = { ...secrets, ...patch };
    setSecrets(next);
    saveTtsSecrets(next);
  };

  const run = async (ids: string[], langs: LangId[]) => {
    setBusy(true);
    setErr("");
    try {
      let n = 0;
      const total = ids.length * langs.length;
      for (const l of langs) {
        await synthScenes(ids, l, (done) => {
          n = langs.indexOf(l) * ids.length + done;
          setMsg(`合成中 ${n}/${total}`);
        });
      }
      setMsg(`完成 ${total} 段`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "合成失败");
    } finally {
      setBusy(false);
    }
  };

  const addVoice = () => {
    const catalog = catalogFor(draft.provider, draft.lang);
    const voiceId = catalog.some((v) => v.id === draft.voiceId) ? draft.voiceId : catalog[0]?.id ?? "";
    const gender = catalog.find((v) => v.id === voiceId)?.gender;
    useEditor.getState().addVoice({
      id: uid("vp"),
      name: draft.name.trim() || "未命名角色",
      lang: draft.lang,
      provider: draft.provider,
      voiceId,
      gender,
    });
  };

  return (
    <Modal title="语音合成" xl onClose={() => useEditor.getState().setDialog(null)}>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        引擎可选 Edge（免费、无需密钥）或 Azure / OpenAI（在下方填写 Key）。配音角色可增删，每种语言指定一个角色。密钥只存在本机浏览器，不会写入工程文件。
      </p>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Field label="默认引擎（新角色用）">
          <select
            className="field"
            value={project.ttsProvider ?? "edge"}
            onChange={(e) => useEditor.getState().setTtsProvider(e.target.value as TtsProvider)}
          >
            {(Object.keys(PROVIDER_LABEL) as TtsProvider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Azure Key">
          <input
            className="field"
            type="password"
            autoComplete="off"
            value={secrets.azureKey}
            onChange={(e) => patchSecrets({ azureKey: e.target.value })}
            placeholder="Ocp-Apim-Subscription-Key"
          />
        </Field>
        <Field label="Azure 区域">
          <input className="field" value={secrets.azureRegion} onChange={(e) => patchSecrets({ azureRegion: e.target.value })} />
        </Field>
        <Field label="OpenAI Key">
          <input
            className="field"
            type="password"
            autoComplete="off"
            value={secrets.openaiKey}
            onChange={(e) => patchSecrets({ openaiKey: e.target.value })}
            placeholder="sk-..."
          />
        </Field>
        <Field label="OpenAI 模型">
          <select className="field" value={secrets.openaiModel} onChange={(e) => patchSecrets({ openaiModel: e.target.value })}>
            <option value="tts-1">tts-1</option>
            <option value="tts-1-hd">tts-1-hd</option>
            <option value="gpt-4o-mini-tts">gpt-4o-mini-tts</option>
          </select>
        </Field>
      </div>

      <div className="section-label">配音角色</div>
      <div className="mb-3 overflow-auto rounded-lg border border-ink-600">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-ink-900 text-[10px] text-ink-400">
            <tr>
              <th className="px-2 py-1.5">名称</th>
              <th className="px-2 py-1.5">语言</th>
              <th className="px-2 py-1.5">引擎</th>
              <th className="px-2 py-1.5">音色</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {voices.map((v) => (
              <tr key={v.id} className="border-t border-ink-700">
                <td className="px-1 py-1">
                  <input className="field" value={v.name} onChange={(e) => useEditor.getState().updateVoice(v.id, { name: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <select
                    className="field"
                    value={v.lang}
                    onChange={(e) => useEditor.getState().updateVoice(v.id, { lang: e.target.value as LangId })}
                  >
                    {LANGS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {langZhName(l.id)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <select
                    className="field"
                    value={v.provider}
                    onChange={(e) => {
                      const provider = e.target.value as TtsProvider;
                      const first = catalogFor(provider, v.lang)[0]?.id ?? v.voiceId;
                      useEditor.getState().updateVoice(v.id, { provider, voiceId: first });
                    }}
                  >
                    {(Object.keys(PROVIDER_LABEL) as TtsProvider[]).map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <select
                    className="field"
                    value={v.voiceId}
                    onChange={(e) => useEditor.getState().updateVoice(v.id, { voiceId: e.target.value })}
                  >
                    {catalogFor(v.provider, v.lang).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}（{opt.gender}）
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <button className="btn" onClick={() => useEditor.getState().removeVoice(v.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="新角色名">
          <input className="field w-28" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="语言">
          <select
            className="field w-28"
            value={draft.lang}
            onChange={(e) => {
              const next = e.target.value as LangId;
              const provider = draft.provider;
              setDraft({ ...draft, lang: next, voiceId: catalogFor(provider, next)[0]?.id ?? "" });
            }}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {langZhName(l.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="引擎">
          <select
            className="field w-36"
            value={draft.provider}
            onChange={(e) => {
              const provider = e.target.value as TtsProvider;
              setDraft({ ...draft, provider, voiceId: catalogFor(provider, draft.lang)[0]?.id ?? "" });
            }}
          >
            {(Object.keys(PROVIDER_LABEL) as TtsProvider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="音色">
          <select className="field w-36" value={draft.voiceId} onChange={(e) => setDraft({ ...draft, voiceId: e.target.value })}>
            {catalogFor(draft.provider, draft.lang).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}（{opt.gender}）
              </option>
            ))}
          </select>
        </Field>
        <button className="btn" onClick={addVoice}>
          添加角色
        </button>
      </div>

      <div className="section-label">各语言使用的角色</div>
      <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
        {LANGS.map((l) => {
          const options = voices.filter((v) => v.lang === l.id);
          return (
            <Field key={l.id} label={langZhName(l.id)}>
              <select
                className="field"
                value={project.voiceByLang[l.id] ?? ""}
                onChange={(e) => useEditor.getState().setVoice(l.id, e.target.value)}
              >
                <option value="">（未指定）</option>
                {options.map((v) => (
                  <option key={v.id} value={v.id}>
                    {profileLabel(v)}
                  </option>
                ))}
              </select>
            </Field>
          );
        })}
      </div>

      {msg && <p className="mt-2 text-xs text-brass">{msg}</p>}
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn" disabled={busy} onClick={() => void run([currentSceneId], [lang])}>
          合成当前场景（{langZhName(lang)}）
        </button>
        <button className="btn btn-accent" disabled={busy} onClick={() => void run(project.scenes.map((s) => s.id), [lang])}>
          合成全部场景（{langZhName(lang)}）
        </button>
        <button className="btn" disabled={busy} onClick={() => void run(project.scenes.map((s) => s.id), LANGS.map((l) => l.id))}>
          全部语言全部场景
        </button>
      </div>
    </Modal>
  );
}
