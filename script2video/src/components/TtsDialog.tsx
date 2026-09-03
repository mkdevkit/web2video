import { useState } from "react";
import { useStudio } from "../store/useStudio";
import { LANGS, langZhName, type LangId } from "../lib/langs";
import { loadTtsSecrets, QWEN_REGIONS, saveTtsSecrets } from "../lib/ttsSecrets";
import { uid } from "../lib/ids";
import { beatsForLang } from "../lib/tts";
import { synthScript } from "../lib/synthScript";
import { fileToDataUri, qwenCreateClone, qwenCreateDesign, qwenVoiceId } from "../lib/qwenTts";
import { preferredNameOf, upsertTimbre } from "../lib/voiceLibrary";
import type { VoiceProfile } from "../types";

export function TtsDialog() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const patchProject = useStudio((s) => s.patchProject);
  const upsertVoice = useStudio((s) => s.upsertVoice);
  const removeVoice = useStudio((s) => s.removeVoice);
  const setDialog = useStudio((s) => s.setDialog);
  const setStatus = useStudio((s) => s.setStatus);
  const [secrets, setSecrets] = useState(loadTtsSecrets());
  const [langs, setLangs] = useState<LangId[]>([project.previewLang]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [prompt, setPrompt] = useState("沉稳男声，适合科普解说");
  const [name, setName] = useState("narrator");

  const saveSecrets = (patch: Partial<typeof secrets>) => {
    const next = { ...secrets, ...patch };
    setSecrets(next);
    saveTtsSecrets(next);
  };

  const addRole = () => {
    const v: VoiceProfile = { id: uid("vc"), name: "旁白", provider: "qwen", voiceId: "" };
    upsertVoice(v);
  };

  const toggleLang = (id: LangId) => {
    setLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const runSynth = async () => {
    if (!langs.length) {
      setErr("请至少选择一种语言");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const source = project.sourceLang;
      const script = useStudio.getState().project.scripts.find((s) => s.id === scriptId);
      if (!script) throw new Error("找不到脚本");
      for (const id of langs) {
        if (!beatsForLang(script, id, source).length) {
          setStatus(`${langZhName(id)} 无口播，跳过`);
          continue;
        }
        setStatus(`正在合成 ${langZhName(id)}…`);
        await synthScript(scriptId, id, setStatus);
      }
      setStatus(`合成完成：${langs.map(langZhName).join("、")}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const design = async () => {
    setBusy(true);
    setErr("");
    try {
      const data = await qwenCreateDesign({
        prompt,
        previewText: "黑洞并不是宇宙里的一个洞。",
        preferredName: preferredNameOf(name, "vd"),
        targetModel: secrets.qwenVdModel,
      });
      const voice = qwenVoiceId(data);
      upsertTimbre({ name, kind: "design", voice, targetModel: secrets.qwenVdModel, prompt });
      const role: VoiceProfile = {
        id: project.voices[0]?.id ?? uid("vc"),
        name,
        provider: "qwen",
        voiceId: voice,
        targetModel: secrets.qwenVdModel,
      };
      upsertVoice(role);
      setStatus(`已创建音色 ${voice}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl border border-ink-600 bg-ink-900 p-4">
        <h2 className="mb-3 text-lg font-medium">配音（千问 TTS）</h2>
        <p className="mb-3 text-sm text-ink-400">与 web2video 相同：DashScope 合成；开发期走 Vite `/__tts/qwen`，Tauri 打包后走 Rust 命令。</p>

        <h3 className="mb-1 text-xs uppercase tracking-wider text-ink-400">AI 配置</h3>
        <input
          className="mb-2 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
          placeholder="千问 API Key"
          type="password"
          value={secrets.dashscopeKey}
          onChange={(e) => saveSecrets({ dashscopeKey: e.target.value })}
        />
        <select
          className="mb-3 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
          value={secrets.dashscopeBaseUrl}
          onChange={(e) => saveSecrets({ dashscopeBaseUrl: e.target.value })}
        >
          {QWEN_REGIONS.map((r) => (
            <option key={r.id} value={r.baseUrl}>
              {r.label}
            </option>
          ))}
        </select>

        <h3 className="mb-1 text-xs uppercase tracking-wider text-ink-400">角色</h3>
        {project.voices.map((v) => (
          <div key={v.id} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
              value={v.name}
              onChange={(e) => upsertVoice({ ...v, name: e.target.value })}
            />
            <input
              className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
              placeholder="音色 voiceId"
              value={v.voiceId}
              onChange={(e) => upsertVoice({ ...v, voiceId: e.target.value })}
            />
            <button className="text-xs text-ink-400" onClick={() => removeVoice(v.id)}>
              删
            </button>
          </div>
        ))}
        <button className="mb-3 rounded border border-ink-600 px-2 py-1 text-sm" onClick={addRole}>
          加角色
        </button>
        <label className="mb-3 block text-sm text-ink-400">
          默认角色
          <select
            className="ml-2 rounded border border-ink-600 bg-ink-800 px-1 py-1"
            value={project.voiceId ?? ""}
            onChange={(e) => patchProject({ voiceId: e.target.value || undefined })}
          >
            <option value="">（未选）</option>
            {project.voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <h3 className="mb-1 text-xs uppercase tracking-wider text-ink-400">声音设计</h3>
        <input className="mb-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="mb-2 h-16 w-full rounded border border-ink-600 bg-ink-800 p-2 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="mb-3 flex gap-2">
          <button className="rounded border border-ink-600 px-2 py-1 text-sm" disabled={busy} onClick={() => void design()}>
            设计音色并绑到角色
          </button>
          <label className="rounded border border-ink-600 px-2 py-1 text-sm">
            复刻音频
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void (async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    const data = await qwenCreateClone({
                      dataUri: await fileToDataUri(file),
                      preferredName: preferredNameOf(name, "vc"),
                      targetModel: secrets.qwenVcModel,
                    });
                    const voice = qwenVoiceId(data);
                    upsertTimbre({ name, kind: "clone", voice, targetModel: secrets.qwenVcModel });
                    upsertVoice({
                      id: project.voices[0]?.id ?? uid("vc"),
                      name,
                      provider: "qwen",
                      voiceId: voice,
                      targetModel: secrets.qwenVcModel,
                    });
                  } catch (er) {
                    setErr(er instanceof Error ? er.message : String(er));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </label>
        </div>

        <h3 className="mb-1 text-xs uppercase tracking-wider text-ink-400">合成当前脚本</h3>
        <p className="mb-2 text-xs text-ink-400">勾选要配音的语言，只合成有口播文案的语言。</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`rounded border px-2 py-0.5 text-xs ${langs.includes(l.id) ? "border-copper bg-ink-800" : "border-ink-600"}`}
              onClick={() => toggleLang(l.id)}
            >
              {langZhName(l.id)}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="text-xs text-ink-400 hover:text-brass"
            onClick={() => setLangs(LANGS.map((l) => l.id))}
          >
            全选
          </button>
          <button type="button" className="text-xs text-ink-400 hover:text-brass" onClick={() => setLangs([project.previewLang])}>
            仅预览语言
          </button>
          <button className="rounded bg-copper px-3 py-1 text-sm text-paper" disabled={busy || !langs.length} onClick={() => void runSynth()}>
            {busy ? "合成中…" : `合成 ${langs.length} 种语言`}
          </button>
        </div>
        {err && <p className="mb-2 text-sm text-copper">{err}</p>}
        <div className="flex justify-end">
          <button className="rounded border border-ink-600 px-3 py-1" onClick={() => setDialog(null)}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
