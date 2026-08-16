import { useMemo, useState } from "react";
import { LANGS, langZhName, type LangId } from "../../lib/langs";
import { profileLabel, qwenRoles } from "../../lib/voices";
import {
  loadTtsSecrets,
  QWEN_REGIONS,
  QWEN_VC_MODELS,
  QWEN_VD_MODELS,
  saveTtsSecrets,
  type TtsSecrets,
} from "../../lib/ttsSecrets";
import {
  loadTimbres,
  mergeCloudTimbres,
  preferredNameOf,
  removeTimbre,
  upsertTimbre,
  type Timbre,
} from "../../lib/voiceLibrary";
import {
  fileToDataUri,
  qwenCreateClone,
  qwenCreateDesign,
  qwenDeleteVoice,
  qwenListVoices,
  qwenPreviewBase64,
  qwenSynthesize,
  qwenVoiceId,
} from "../../lib/qwenTts";
import { synthScenes, type SynthProgress } from "../../lib/synthProject";
import { activeVoice, defaultRoleForLang } from "../../lib/tts";
import { uid } from "../../lib/ids";
import { useEditor } from "../../store/useEditor";
import type { VoiceProfile } from "../../types";
import { Field, Modal } from "../ui";

type Tab = "synth" | "ai" | "roles" | "timbres";

const TABS: { id: Tab; label: string }[] = [
  { id: "synth", label: "合成" },
  { id: "ai", label: "AI 配置" },
  { id: "roles", label: "配音角色" },
  { id: "timbres", label: "音色管理" },
];

const PREVIEW_LINE = "大家好，欢迎收听本期科普。今天我们把一件复杂的事讲清楚。";

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
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const [tab, setTab] = useState<Tab>("synth");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState<SynthProgress | null>(null);
  const [secrets, setSecrets] = useState<TtsSecrets>(() => loadTtsSecrets());
  const [timbres, setTimbres] = useState<Timbre[]>(() => loadTimbres());
  const lang = project.previewLang;
  const role = useMemo(() => defaultRoleForLang(project, lang), [project, lang]);

  const patchSecrets = (patch: Partial<TtsSecrets>) => {
    const next = { ...secrets, ...patch };
    setSecrets(next);
    saveTtsSecrets(next);
  };

  const run = async (ids: string[], langs: LangId[]) => {
    setBusy(true);
    setErr("");
    setProgress(null);
    try {
      const total = ids.length * langs.length;
      for (const l of langs) {
        await synthScenes(ids, l, (p) => {
          setProgress({ ...p, sceneIndex: langs.indexOf(l) * ids.length + p.sceneIndex, sceneCount: total });
          setMsg(`合成中 ${langs.indexOf(l) * ids.length + p.sceneIndex + 1}/${total}`);
        });
      }
      setProgress(null);
      setMsg(`完成 ${total} 段`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "合成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="语音合成" xl onClose={() => useEditor.getState().setDialog(null)}>
      <div className="-mx-4 -mt-4 mb-4 flex border-b border-ink-600">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-2 text-[12px] ${tab === t.id ? "border-b-2 border-brass text-paper" : "text-ink-400 hover:text-ink-200"}`}
            onClick={() => {
              setTab(t.id);
              setErr("");
              if (!busy) {
                setMsg("");
                setProgress(null);
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "synth" && (
        <SynthTab
          lang={lang}
          role={role}
          busy={busy}
          msg={msg}
          err={err}
          progress={progress}
          onRun={run}
          currentSceneId={currentSceneId}
          sceneCount={project.scenes.length}
        />
      )}
      {tab === "ai" && <AiTab secrets={secrets} patchSecrets={patchSecrets} />}
      {tab === "roles" && (
        <RolesTab
          timbres={timbres}
          onNeedTimbres={() => setTab("timbres")}
        />
      )}
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
    </Modal>
  );
}

function SynthTab({
  lang,
  role,
  busy,
  msg,
  err,
  progress,
  onRun,
  currentSceneId,
  sceneCount,
}: {
  lang: LangId;
  role: VoiceProfile | undefined;
  busy: boolean;
  msg: string;
  err: string;
  progress: SynthProgress | null;
  onRun: (ids: string[], langs: LangId[]) => void;
  currentSceneId: string;
  sceneCount: number;
}) {
  const project = useEditor((s) => s.project);
  const roles = qwenRoles(project.voices);
  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        只用千问合成。角色与语言无关。每种语言可指定默认角色；单句口播可再覆盖。没配的句子用该语言默认角色，语言未指定则跟随当前角色。
      </p>
      {roles.length > 0 && (
        <>
          <Field label="当前角色">
            <select
              className="field mb-3 max-w-xs"
              value={project.voiceId && roles.some((v) => v.id === project.voiceId) ? project.voiceId : (role?.id ?? "")}
              onChange={(e) => useEditor.getState().setVoice(e.target.value)}
            >
              {roles.map((v) => (
                <option key={v.id} value={v.id}>
                  {profileLabel(v)}
                </option>
              ))}
            </select>
          </Field>
          <div className="mb-3">
            <div className="section-label">各语言默认角色</div>
            <div className="grid grid-cols-2 gap-1">
              {LANGS.map((l) => (
                <label key={l.id} className="flex items-center gap-1.5 text-[11px] text-ink-200">
                  <span className="w-14 shrink-0 text-ink-400">{langZhName(l.id)}</span>
                  <select
                    className="field py-0.5"
                    value={project.voiceByLang[l.id] ?? ""}
                    onChange={(e) => useEditor.getState().setLangVoice(l.id, e.target.value)}
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
      <div className="mb-4 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-ink-300">
        <p>当前语言：{langZhName(lang)} · 引擎：千问 TTS</p>
        <p className="mt-1">角色：{role ? profileLabel(role) : "还没有角色，请先在「配音角色」里添加"}</p>
      </div>
      {msg && <p className="mb-2 text-xs text-brass">{msg}</p>}
      {progress && (
        <div className="mb-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
          <p className="text-[11px] text-ink-400">
            {langZhName(progress.lang)} · {progress.sceneName}
            {progress.roleName ? ` · ${progress.roleName}` : ""}
            {progress.clipCount > 1 ? ` · 片段 ${progress.clipIndex + 1}/${progress.clipCount}` : ""}
          </p>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-paper">
            {progress.text}
          </p>
        </div>
      )}
      {err && <p className="mb-2 text-xs text-red-400">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={busy || !role} onClick={() => onRun([currentSceneId], [lang])}>
          合成当前场景（{langZhName(lang)}）
        </button>
        <button className="btn btn-accent" disabled={busy || !role} onClick={() => onRun(project.scenes.map((s) => s.id), [lang])}>
          合成全部场景（{langZhName(lang)}，{sceneCount} 场）
        </button>
        <button className="btn" disabled={busy || !role} onClick={() => onRun(project.scenes.map((s) => s.id), LANGS.map((l) => l.id))}>
          全部语言全部场景
        </button>
      </div>
    </>
  );
}

function AiTab({ secrets, patchSecrets }: { secrets: TtsSecrets; patchSecrets: (p: Partial<TtsSecrets>) => void }) {
  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        配音只用千问。API Key 存在本机（<code className="text-ink-200">web2video.tts-secrets</code>
        ），不会写入工程。请用 <code className="text-ink-200">npm run dev</code> 启动以便本机代理转发。
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="API Key">
          <input
            className="field"
            type="password"
            autoComplete="off"
            value={secrets.dashscopeKey}
            onChange={(e) => patchSecrets({ dashscopeKey: e.target.value })}
            placeholder="sk-..."
          />
        </Field>
        <Field label="地域">
          <select
            className="field"
            value={secrets.dashscopeBaseUrl}
            onChange={(e) => patchSecrets({ dashscopeBaseUrl: e.target.value })}
          >
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
          <select className="field" value={secrets.qwenVdModel} onChange={(e) => patchSecrets({ qwenVdModel: e.target.value })}>
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
          <select className="field" value={secrets.qwenVcModel} onChange={(e) => patchSecrets({ qwenVcModel: e.target.value })}>
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
  const project = useEditor((s) => s.project);
  const voices = qwenRoles(project.voices);
  const [draftName, setDraftName] = useState("新角色");
  const [draftVoice, setDraftVoice] = useState(timbres[0]?.voice ?? "");
  const current = activeVoice(project);

  const addVoice = () => {
    if (!timbres.length) {
      onNeedTimbres();
      return;
    }
    const voiceId = timbres.some((t) => t.voice === draftVoice) ? draftVoice : timbres[0].voice;
    const timbre = timbres.find((t) => t.voice === voiceId);
    useEditor.getState().addVoice({
      id: uid("vp"),
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
              className="field mb-3 max-w-xs"
              value={current?.id ?? ""}
              onChange={(e) => useEditor.getState().setVoice(e.target.value)}
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
              <thead className="bg-ink-900 text-[10px] text-ink-400">
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
                      <input className="field" value={v.name} onChange={(e) => useEditor.getState().updateVoice(v.id, { name: e.target.value })} />
                    </td>
                    {timbres.length > 0 && (
                      <td className="px-1 py-1">
                        <select
                          className="field"
                          value={v.voiceId}
                          onChange={(e) => {
                            const voiceId = e.target.value;
                            const tb = timbres.find((t) => t.voice === voiceId);
                            useEditor.getState().updateVoice(v.id, { voiceId, targetModel: tb?.targetModel });
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
                      <button className="btn" onClick={() => useEditor.getState().removeVoice(v.id)}>
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
          <input className="field w-28" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </Field>
        {timbres.length > 0 && (
          <Field label="音色">
            <select className="field w-40" value={draftVoice} onChange={(e) => setDraftVoice(e.target.value)}>
              {timbres.map((t) => (
                <option key={t.id} value={t.voice}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <button className="btn" onClick={addVoice}>
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
  const previewLang = useEditor((s) => s.project.previewLang);
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
    useEditor.getState().addVoice({
      id: uid("vp"),
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
        音色 ID 绑在千问账号上，本机目录存在 <code className="text-ink-200">web2video.voice-library</code>
        ，可跨工程复用。设计音色走 <code className="text-ink-200">qwen-voice-design</code>，复刻走{" "}
        <code className="text-ink-200">qwen-voice-enrollment</code>。
      </p>

      <div className="section-label">声音设计</div>
      <div className="mb-4 grid gap-2">
        <Field label="显示名称">
          <input className="field max-w-xs" value={designName} onChange={(e) => setDesignName(e.target.value)} />
        </Field>
        <Field label="声音描述（中英，最多 2048 字）">
          <textarea className="field min-h-[72px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <Field label="预览朗读文本">
          <input className="field" value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
        </Field>
        <button
          className="btn btn-accent w-fit"
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

      <div className="section-label">声音复刻</div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="显示名称">
          <input className="field w-36" value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
        </Field>
        <Field label="参考音频（建议 10–20 秒干声，≤10MB）">
          <input
            className="field text-[11px]"
            type="file"
            accept="audio/*,.wav,.mp3,.m4a"
            onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <button
          className="btn"
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
        {timbres.length > 0 ? <div className="section-label mb-0">本机音色库</div> : <span />}
        <button
          className="btn px-2 py-0.5"
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
          <thead className="bg-ink-900 text-[10px] text-ink-400">
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
                    className="field"
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
                      className="btn px-1.5 py-0.5"
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
                    <button className="btn px-1.5 py-0.5" onClick={() => useAsRole(t)}>
                      用作角色
                    </button>
                    <button
                      className="btn px-1.5 py-0.5 text-red-300"
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
      {err && <p className="text-xs text-red-400">{err}</p>}
    </>
  );
}
