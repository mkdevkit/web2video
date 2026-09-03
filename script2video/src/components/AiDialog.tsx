import { useState } from "react";
import { LLM_PRESETS, loadLlmSecrets, saveLlmSecrets, type LlmProviderId, type LlmSecrets } from "../lib/aiSecrets";
import { useStudio } from "../store/useStudio";

export function AiDialog() {
  const [secrets, setSecrets] = useState<LlmSecrets>(() => loadLlmSecrets());
  const setDialog = useStudio((s) => s.setDialog);
  const setTab = useStudio((s) => s.setTab);
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-ink-600 bg-ink-900 p-4">
        <h2 className="mb-2 text-lg font-medium">生成式 AI 接口</h2>
        <p className="mb-3 text-xs leading-relaxed text-ink-400">
          {preset.hint} 密钥只存在本机浏览器，不会写入工程。请用 <code className="text-ink-200">npm run dev</code>{" "}
          启动，以便本机代理转发。Flash / Pro 在 AI 页顶栏切换。
        </p>
        <label className="mb-2 block text-xs text-ink-400">
          服务商
          <select
            className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
            value={secrets.provider}
            onChange={(e) => pickProvider(e.target.value as LlmProviderId)}
          >
            {(Object.keys(LLM_PRESETS) as LlmProviderId[]).map((id) => (
              <option key={id} value={id}>
                {LLM_PRESETS[id].label}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-2 block text-xs text-ink-400">
          API Key
          <input
            className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
            type="password"
            autoComplete="off"
            placeholder="sk-..."
            value={secrets.apiKey}
            onChange={(e) => patchSecrets({ apiKey: e.target.value })}
          />
        </label>
        <label className="mb-4 block text-xs text-ink-400">
          接口地址
          <input
            className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-xs"
            value={secrets.baseUrl}
            onChange={(e) => patchSecrets({ baseUrl: e.target.value })}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className="rounded border border-ink-600 px-3 py-1 text-sm" onClick={() => setDialog(null)}>
            关闭
          </button>
          <button
            className="rounded border border-copper px-3 py-1 text-sm hover:bg-ink-800"
            onClick={() => {
              setTab("ai");
              setDialog(null);
            }}
          >
            完成，去 AI 页
          </button>
        </div>
      </div>
    </div>
  );
}
