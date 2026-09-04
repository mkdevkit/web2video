import { useMemo, useState, type ReactNode } from "react";
import { useStudio } from "../store/useStudio";
import { LANGS, langZhName, type LangId } from "../lib/langs";
import {
  loadTtsSecrets,
  QWEN_REGIONS,
  QWEN_VC_MODELS,
  QWEN_VD_MODELS,
  saveTtsSecrets,
  type TtsSecrets,
} from "../lib/ttsSecrets";
import { uid } from "../lib/ids";
import { beatsForLang, defaultRoleForLang } from "../lib/tts";
import { synthScript } from "../lib/synthScript";
import {
  fileToDataUri,
  qwenCreateClone,
  qwenCreateDesign,
  qwenDeleteVoice,
  qwenListVoices,
  qwenPreviewBase64,
  qwenSynthesize,
  qwenVoiceId,
} from "../lib/qwenTts";
import {
  loadTimbres,
  mergeCloudTimbres,
  preferredNameOf,
  removeTimbre,
  upsertTimbre,
  type Timbre,
} from "../lib/voiceLibrary";
import { profileLabel, qwenRoles } from "../lib/voices";
import type { VoiceProfile } from "../types";

type Tab = "synth" | "ai" | "roles" | "timbres";

const TABS: { id: Tab; label: string }[] = [
  { id: "synth", label: "合成" },
  { id: "ai", label: "AI 配置" },
  { id: "roles", label: "配音角色" },
  { id: "timbres", label: "音色管理" },
];

const PREVIEW_LINE = "大家好，欢迎收听本期科普。今天我们把一件复杂的事讲清楚。";
const inputCls = "w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm";
const btnCls = "rounded border border-ink-600 px-2 py-1 text-sm disabled:opacity-50";
const accentCls = "rounded bg-copper px-3 py-1 text-sm text-paper disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-ink-400">{label}</span>
      {children}
    </label>
  );
}

function playBase64(b64: string, type = "audio/wav") {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.onerror = () => URL.revokeObjectURL(url);
  void audio.play();
}

export function TtsDialog() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const setDialog = useStudio((s) => s.setDialog);
  const setStatus = useStudio((s) => s.setStatus);
  const [tab, setTab] = useState<Tab>("synth");
  const [secrets, setSecrets] = useState<TtsSecrets>(() => loadTtsSecrets());
  const [timbres, setTimbres] = useState<Timbre[]>(() => loadTimbres());
  const [langs, setLangs] = useState<LangId[]>([project.previewLang]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const role = useMemo(() => defaultRoleForLang(project, project.previewLang), [project]);

  const patchSecrets = (patch: Partial<TtsSecrets>) => {
    const next = { ...secrets, ...patch };
    setSecrets(next);
    saveTtsSecrets(next);
  };

  const runSynth = async (scriptIds: string[]) => {
    if (!langs.length) {
      setErr("请至少选择一种语言");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const source = project.sourceLang;
      const latest = useStudio.getState().project;
      let done = 0;
      const jobs = scriptIds.flatMap((id) => langs.map((lang) => ({ id, lang })));
      for (const job of jobs) {
        const script = latest.scripts.find((s) => s.id === job.id);
        if (!script) continue;
        if (!beatsForLang(script, job.lang, source).length) {
          setMsg(`${script.name} · ${langZhName(job.lang)} 无口播，跳过`);
          setStatus(`${langZhName(job.lang)} 无口播，跳过`);
          continue;
        }
        setMsg(`正在合成 ${script.name} · ${langZhName(job.lang)}…`);
        setStatus(`正在合成 ${langZhName(job.lang)}「${script.name}」…`);
        await synthScript(job.id, job.lang, setStatus);
        done += 1;
      }
      const text = done ? `合成完成 ${done} 段` : "没有可合成的口播";
      setMsg(text);
      setStatus(text);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setErr(text);
      setStatus(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-900">
        <div className="flex items-center justify-between border-b border-ink-600 px-4">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`px-3 py-2.5 text-[12px] ${tab === t.id ? "border-b-2 border-brass text-paper" : "text-ink-400 hover:text-ink-200"}`}
                onClick={() => {
                  setTab(t.id);
                  setErr("");
                  if (!busy) setMsg("");
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="text-ink-400 hover:text-paper" onClick={() => setDialog(null)} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === "synth" && (
            <SynthTab
              role={role}
              langs={langs}
              setLangs={setLangs}
              busy={busy}
              msg={msg}
              err={err}
              scriptId={scriptId}
              onRun={runSynth}
            />
          )}
          {tab === "ai" && <AiTab secrets={secrets} patchSecrets={patchSecrets} />}
          {tab === "roles" && <RolesTab timbres={timbres} onNeedTimbres={() => setTab("timbres")} />}
          {tab === "timbres" && (
            <TimbresTab
              secrets={secrets}
              timbres={timbres}
              setTimbres={setTimbres}
              busy={busy}
              setBusy={setBusy}
              msg={msg}
              err={err}
              setMsg={setMsg}
              setErr={setErr}
              onNeedAi={() => setTab("ai")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SynthTab({
  role,
  langs,
  setLangs,
  busy,
  msg,
  err,
  scriptId,
  onRun,
}: {
  role: VoiceProfile | undefined;
  langs: LangId[];
  setLangs: (ids: LangId[] | ((cur: LangId[]) => LangId[])) => void;
  busy: boolean;
  msg: string;
  err: string;
  scriptId: string;
  onRun: (scriptIds: string[]) => void;
}) {
  const project = useStudio((s) => s.project);
  const roles = qwenRoles(project.voices);
  const script = project.scripts.find((s) => s.id === scriptId);
  const toggleLang = (id: LangId) => {
    setLangs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        只用千问合成。角色与语言无关。每种语言可指定默认角色；单句口播可再覆盖。没配的句子用该语言默认角色，语言未指定则跟随当前角色。
      </p>
      {roles.length > 0 && (
        <>
          <Field label="当前角色">
            <select
              className={`${inputCls} mb-3 max-w-xs`}
              value={project.voiceId && roles.some((v) => v.id === project.voiceId) ? project.voiceId : (role?.id ?? "")}
              onChange={(e) => useStudio.getState().patchProject({ voiceId: e.target.value || undefined })}
            >
              {roles.map((v) => (
                <option key={v.id} value={v.id}>
                  {profileLabel(v)}
                </option>
              ))}
            </select>
          </Field>
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">各语言默认角色</div>
            <div className="grid grid-cols-2 gap-1">
              {LANGS.map((l) => (
                <label key={l.id} className="flex items-center gap-1.5 text-[11px] text-ink-200">
                  <span className="w-14 shrink-0 text-ink-400">{langZhName(l.id)}</span>
                  <select
                    className={`${inputCls} py-0.5`}
                    value={project.voiceByLang?.[l.id] ?? ""}
                    onChange={(e) => useStudio.getState().setLangVoice(l.id, e.target.value)}
                  >
                    <option value="">跟随当前角色</option>
                    {roles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {profileLabel(v)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="mb-4 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-ink-300">
        <p>
          当前脚本：{script?.name ?? "未选"} · 预览语言：{langZhName(project.previewLang)} · 引擎：千问 TTS
        </p>
        <p className="mt-1">角色：{role ? profileLabel(role) : "还没有角色，请先在「配音角色」里添加"}</p>
      </div>
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
        <button type="button" className="text-xs text-ink-400 hover:text-brass" onClick={() => setLangs(LANGS.map((l) => l.id))}>
          全选
        </button>
        <button
          type="button"
          className="text-xs text-ink-400 hover:text-brass"
          onClick={() => setLangs([project.previewLang])}
        >
          仅预览语言
        </button>
      </div>
      {msg && <p className="mb-2 text-xs text-brass">{msg}</p>}
      {err && <p className="mb-2 text-xs text-copper">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={btnCls} disabled={busy || !role || !scriptId || !langs.length} onClick={() => void onRun([scriptId])}>
          {busy ? "合成中…" : `合成当前脚本（${langs.length} 种语言）`}
        </button>
        <button
          className={accentCls}
          disabled={busy || !role || !langs.length}
          onClick={() => void onRun(project.scripts.map((s) => s.id))}
        >
          合成全部脚本
        </button>
      </div>
    </>
  );
}

function AiTab({ secrets, patchSecrets }: { secrets: TtsSecrets; patchSecrets: (p: Partial<TtsSecrets>) => void }) {
  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        配音只用千问。API Key 存在本机（<code className="text-ink-200">script2video.tts-secrets</code>
        ），不会写入工程。开发期走 Vite <code className="text-ink-200">/__tts/qwen</code>，Tauri 打包后走 Rust 命令。
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="API Key">
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            value={secrets.dashscopeKey}
            onChange={(e) => patchSecrets({ dashscopeKey: e.target.value })}
            placeholder="sk-..."
          />
        </Field>
        <Field label="地域">
          <select className={inputCls} value={secrets.dashscopeBaseUrl} onChange={(e) => patchSecrets({ dashscopeBaseUrl: e.target.value })}>
            {QWEN_REGIONS.map((r) => (
              <option key={r.id} value={r.baseUrl}>
                {r.label}
              </option>
            ))}
            {!QWEN_REGIONS.some((r) => r.baseUrl === secrets.dashscopeBaseUrl) && (
              <option value={secrets.dashscopeBaseUrl}>自定义</option>
            )}
          </select>
        </Field>
        <Field label="声音设计合成模型">
          <select className={inputCls} value={secrets.qwenVdModel} onChange={(e) => patchSecrets({ qwenVdModel: e.target.value })}>
            {QWEN_VD_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {!QWEN_VD_MODELS.includes(secrets.qwenVdModel as (typeof QWEN_VD_MODELS)[number]) && secrets.qwenVdModel && (
              <option value={secrets.qwenVdModel}>{secrets.qwenVdModel}</option>
            )}
          </select>
        </Field>
        <Field label="声音复刻合成模型">
          <select className={inputCls} value={secrets.qwenVcModel} onChange={(e) => patchSecrets({ qwenVcModel: e.target.value })}>
            {QWEN_VC_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {!QWEN_VC_MODELS.includes(secrets.qwenVcModel as (typeof QWEN_VC_MODELS)[number]) && secrets.qwenVcModel && (
              <option value={secrets.qwenVcModel}>{secrets.qwenVcModel}</option>
            )}
          </select>
        </Field>
      </div>
      <p className="mt-3 text-[11px] text-ink-500">
        设计音色用 <code className="text-ink-300">qwen-voice-design</code> 创建、用{" "}
        <code className="text-ink-300">qwen3-tts-vd</code> 合成。复刻音色用{" "}
        <code className="text-ink-300">qwen-voice-enrollment</code> 创建、必须用对应的{" "}
        <code className="text-ink-300">qwen3-tts-vc</code>，不能混用。
      </p>
    </>
  );
}

function RolesTab({ timbres, onNeedTimbres }: { timbres: Timbre[]; onNeedTimbres: () => void }) {
  const project = useStudio((s) => s.project);
  const voices = qwenRoles(project.voices);
  const [draftName, setDraftName] = useState("新角色");
  const [draftVoice, setDraftVoice] = useState(timbres[0]?.voice ?? "");
  const current = voices.find((v) => v.id === project.voiceId) ?? voices[0];

  const addVoice = () => {
    if (!timbres.length) {
      onNeedTimbres();
      return;
    }
    const voiceId = timbres.some((t) => t.voice === draftVoice) ? draftVoice : timbres[0].voice;
    const timbre = timbres.find((t) => t.voice === voiceId);
    useStudio.getState().upsertVoice({
      id: uid("vc"),
      name: draftName.trim() || "未命名角色",
      provider: "qwen",
      voiceId,
      gender: timbre?.gender,
      targetModel: timbre?.targetModel,
    });
  };

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        角色与语言无关，全片共用。每种语言的默认角色在「合成」页指定。音色须先在「音色管理」里有了，再挂到角色上。
      </p>
      {voices.length > 0 && (
        <>
          <Field label="当前使用">
            <select
              className={`${inputCls} mb-3 max-w-xs`}
              value={current?.id ?? ""}
              onChange={(e) => useStudio.getState().patchProject({ voiceId: e.target.value || undefined })}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {profileLabel(v)}
                </option>
              ))}
            </select>
          </Field>
          <div className="mb-3 overflow-auto rounded-lg border border-ink-600">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-ink-950 text-[10px] text-ink-400">
                <tr>
                  <th className="px-2 py-1.5">名称</th>
                  {timbres.length > 0 && <th className="px-2 py-1.5">音色</th>}
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {voices.map((v) => (
                  <tr key={v.id} className="border-t border-ink-700">
                    <td className="px-1 py-1">
                      <input
                        className={inputCls}
                        value={v.name}
                        onChange={(e) => useStudio.getState().upsertVoice({ ...v, name: e.target.value })}
                      />
                    </td>
                    {timbres.length > 0 && (
                      <td className="px-1 py-1">
                        <select
                          className={inputCls}
                          value={v.voiceId}
                          onChange={(e) => {
                            const voiceId = e.target.value;
                            const tb = timbres.find((t) => t.voice === voiceId);
                            useStudio.getState().upsertVoice({ ...v, voiceId, targetModel: tb?.targetModel });
                          }}
                        >
                          {!timbres.some((t) => t.voice === v.voiceId) && v.voiceId && (
                            <option value={v.voiceId}>{v.voiceId}</option>
                          )}
                          {timbres.map((t) => (
                            <option key={t.id} value={t.voice}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-1 py-1">
                      <button className={btnCls} onClick={() => useStudio.getState().removeVoice(v.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="新角色名">
          <input className={`${inputCls} w-28`} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </Field>
        {timbres.length > 0 && (
          <Field label="音色">
            <select className={`${inputCls} w-40`} value={draftVoice} onChange={(e) => setDraftVoice(e.target.value)}>
              {timbres.map((t) => (
                <option key={t.id} value={t.voice}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <button className={btnCls} onClick={addVoice}>
          {timbres.length ? "添加角色" : "去创建音色"}
        </button>
      </div>
    </>
  );
}

function TimbresTab({
  secrets,
  timbres,
  setTimbres,
  busy,
  setBusy,
  msg,
  err,
  setMsg,
  setErr,
  onNeedAi,
}: {
  secrets: TtsSecrets;
  timbres: Timbre[];
  setTimbres: (t: Timbre[]) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  msg: string;
  err: string;
  setMsg: (s: string) => void;
  setErr: (s: string) => void;
  onNeedAi: () => void;
}) {
  const previewLang = useStudio((s) => s.project.previewLang);
  const [prompt, setPrompt] = useState("沉稳的中年男性，语速适中，音色低沉有磁性，适合科普解说。");
  const [previewText, setPreviewText] = useState(PREVIEW_LINE);
  const [designName, setDesignName] = useState("科普男声");
  const [cloneName, setCloneName] = useState("复刻音色");
  const [cloneFile, setCloneFile] = useState<File | null>(null);

  const requireKey = () => {
    if (secrets.dashscopeKey.trim()) return true;
    onNeedAi();
    setErr("请先填写千问 API Key");
    return false;
  };

  const refresh = () => setTimbres(loadTimbres());

  const wrap = async (label: string, fn: () => Promise<void>) => {
    if (!requireKey()) return;
    setBusy(true);
    setErr("");
    setMsg(label);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : label);
    } finally {
      setBusy(false);
    }
  };

  const useAsRole = (t: Timbre) => {
    useStudio.getState().upsertVoice({
      id: uid("vc"),
      name: t.name,
      provider: "qwen",
      voiceId: t.voice,
      gender: t.gender,
      targetModel: t.targetModel,
    });
    setMsg(`已添加角色「${t.name}」`);
  };

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        音色 ID 绑在千问账号上，本机目录存在 <code className="text-ink-200">script2video.voice-library</code>
        ，可跨工程复用。设计音色走 <code className="text-ink-200">qwen-voice-design</code>，复刻走{" "}
        <code className="text-ink-200">qwen-voice-enrollment</code>。
      </p>

      <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">声音设计</div>
      <div className="mb-4 grid gap-2">
        <Field label="显示名称">
          <input className={`${inputCls} max-w-xs`} value={designName} onChange={(e) => setDesignName(e.target.value)} />
        </Field>
        <Field label="声音描述（中英，最多 2048 字）">
          <textarea className={`${inputCls} min-h-[72px]`} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <Field label="预览朗读文本">
          <input className={inputCls} value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
        </Field>
        <button
          className={`${accentCls} w-fit`}
          disabled={busy || !prompt.trim()}
          onClick={() =>
            void wrap("正在设计音色…", async () => {
              const targetModel = secrets.qwenVdModel || QWEN_VD_MODELS[0];
              const data = await qwenCreateDesign({
                prompt: prompt.trim(),
                previewText: previewText.trim() || PREVIEW_LINE,
                preferredName: preferredNameOf(designName, "vd"),
                targetModel,
              });
              const voice = qwenVoiceId(data);
              upsertTimbre({
                name: designName.trim() || "设计音色",
                kind: "design",
                voice,
                targetModel,
                prompt: prompt.trim(),
              });
              refresh();
              const preview = qwenPreviewBase64(data);
              if (preview) playBase64(preview.b64, preview.type);
              setMsg(`已创建设计音色 ${voice}`);
            })
          }
        >
          创建设计音色
        </button>
      </div>

      <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">声音复刻</div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="显示名称">
          <input className={`${inputCls} w-36`} value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
        </Field>
        <Field label="参考音频（建议 10–20 秒干声，≤10MB）">
          <input
            className={`${inputCls} text-[11px]`}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a"
            onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <button
          className={btnCls}
          disabled={busy || !cloneFile}
          onClick={() =>
            void wrap("正在复刻音色…", async () => {
              if (!cloneFile) return;
              if (cloneFile.size > 10 * 1024 * 1024) throw new Error("音频超过 10MB");
              const targetModel = secrets.qwenVcModel || QWEN_VC_MODELS[0];
              const data = await qwenCreateClone({
                dataUri: await fileToDataUri(cloneFile),
                preferredName: preferredNameOf(cloneName, "vc"),
                targetModel,
              });
              const voice = qwenVoiceId(data);
              upsertTimbre({
                name: cloneName.trim() || "复刻音色",
                kind: "clone",
                voice,
                targetModel,
              });
              refresh();
              setMsg(`已创建复刻音色 ${voice}`);
            })
          }
        >
          创建复刻音色
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        {timbres.length > 0 ? <div className="text-[10px] uppercase tracking-wider text-ink-400">本机音色库</div> : <span />}
        <button
          className={`${btnCls} px-2 py-0.5`}
          disabled={busy}
          onClick={() =>
            void wrap("正在从千问同步…", async () => {
              const [designed, cloned] = await Promise.allSettled([
                qwenListVoices("qwen-voice-design"),
                qwenListVoices("qwen-voice-enrollment"),
              ]);
              const rows = [
                ...(designed.status === "fulfilled" ? designed.value.map((r) => ({ ...r, kind: "design" as const })) : []),
                ...(cloned.status === "fulfilled" ? cloned.value.map((r) => ({ ...r, kind: "clone" as const })) : []),
              ];
              if (!rows.length) {
                const why =
                  (designed.status === "rejected" && designed.reason instanceof Error ? designed.reason.message : "") ||
                  (cloned.status === "rejected" && cloned.reason instanceof Error ? cloned.reason.message : "");
                throw new Error(why || "千问未返回音色列表");
              }
              mergeCloudTimbres(rows);
              refresh();
              setMsg(`已同步，本机共 ${loadTimbres().length} 条`);
            })
          }
        >
          从千问同步
        </button>
      </div>
      {timbres.length > 0 && (
        <div className="mb-3 overflow-auto rounded-lg border border-ink-600">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-ink-950 text-[10px] text-ink-400">
              <tr>
                <th className="px-2 py-1.5">名称</th>
                <th className="px-2 py-1.5">来源</th>
                <th className="px-2 py-1.5">合成模型</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {timbres.map((t) => (
                <tr key={t.id} className="border-t border-ink-700">
                  <td className="px-1 py-1">
                    <input
                      className={inputCls}
                      value={t.name}
                      onChange={(e) => {
                        upsertTimbre({ ...t, name: e.target.value });
                        refresh();
                      }}
                    />
                    <p className="mt-0.5 truncate px-1 font-mono text-[10px] text-ink-500" title={t.voice}>
                      {t.voice}
                    </p>
                  </td>
                  <td className="px-2 py-1 text-ink-300">{t.kind === "clone" ? "复刻" : "设计"}</td>
                  <td className="px-2 py-1 font-mono text-[10px] text-ink-400">{t.targetModel || "—"}</td>
                  <td className="px-1 py-1">
                    <div className="flex flex-wrap gap-1">
                      <button
                        className={`${btnCls} px-1.5 py-0.5`}
                        disabled={busy}
                        onClick={() =>
                          void wrap("试听中…", async () => {
                            const model = t.targetModel || (t.kind === "clone" ? secrets.qwenVcModel : secrets.qwenVdModel);
                            const out = await qwenSynthesize({
                              text: previewText.trim() || PREVIEW_LINE,
                              voice: t.voice,
                              model,
                              lang: previewLang,
                            });
                            playBase64(out.audioBase64, out.contentType);
                            setMsg("正在播放试听");
                          })
                        }
                      >
                        试听
                      </button>
                      <button className={`${btnCls} px-1.5 py-0.5`} onClick={() => useAsRole(t)}>
                        用作角色
                      </button>
                      <button
                        className={`${btnCls} px-1.5 py-0.5 text-red-300`}
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`删除本机音色「${t.name}」？`)) return;
                          const alsoCloud = window.confirm("是否同时从千问账号删除该音色？");
                          void wrap("正在删除…", async () => {
                            if (alsoCloud) {
                              const model = t.kind === "clone" ? "qwen-voice-enrollment" : "qwen-voice-design";
                              await qwenDeleteVoice(model, t.voice);
                            }
                            removeTimbre(t.id);
                            refresh();
                            setMsg("已删除");
                          });
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p className="text-xs text-brass">{msg}</p>}
      {err && <p className="text-xs text-copper">{err}</p>}
    </>
  );
}
