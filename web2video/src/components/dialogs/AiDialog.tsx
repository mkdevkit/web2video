import { useState } from "react";
import { LLM_PRESETS, loadLlmSecrets, saveLlmSecrets, type LlmProviderId, type LlmSecrets } from "../../lib/aiSecrets";
import { useEditor } from "../../store/useEditor";
import { Field, Modal } from "../ui";

export function AiDialog() {
  const [secrets, setSecrets] = useState<LlmSecrets>(() => loadLlmSecrets());
  const preset = LLM_PRESETS[secrets.provider];

  const patchSecrets = (patch: Partial<LlmSecrets>) => {
    const next = { ...secrets, ...patch };
    setSecrets(next);
    saveLlmSecrets(next);
  };

  const pickProvider = (provider: LlmProviderId) => {
    const next = LLM_PRESETS[provider];
    patchSecrets({
      provider,
      baseUrl: next.baseUrl,
      model: secrets.provider === provider ? secrets.model : next.model,
    });
  };

  return (
    <Modal
      title="生成式 AI 接口"
      wide
      onClose={() => useEditor.getState().setDialog(null)}
      footer={
        <button
          className="btn btn-accent"
          onClick={() => {
            useEditor.getState().setRightTab("ai");
            useEditor.getState().setDialog(null);
          }}
        >
          完成，去右侧对话
        </button>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        {preset.hint} 密钥只存在本机浏览器，不会写入工程。请用 <code className="text-ink-200">npm run dev</code>{" "}
        启动，以便本机代理转发、避免跨域。Flash / Pro 在右侧聊天顶栏切换。
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <Field label="服务商">
          <select className="field" value={secrets.provider} onChange={(e) => pickProvider(e.target.value as LlmProviderId)}>
            {(Object.keys(LLM_PRESETS) as LlmProviderId[]).map((id) => (
              <option key={id} value={id}>
                {LLM_PRESETS[id].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="API Key">
          <input
            className="field"
            type="password"
            autoComplete="off"
            placeholder="sk-..."
            value={secrets.apiKey}
            onChange={(e) => patchSecrets({ apiKey: e.target.value })}
          />
        </Field>
        <Field label="接口地址">
          <input
            className="field font-mono text-[11px]"
            value={secrets.baseUrl}
            onChange={(e) => patchSecrets({ baseUrl: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
