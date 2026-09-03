import { useEffect, useRef, useState } from "react";
import { DEEPSEEK_MODELS, loadLlmSecrets, saveLlmSecrets } from "../lib/aiSecrets";
import {
  deleteLlmChat,
  listLlmChats,
  loadLlmChat,
  newLlmChat,
  saveLlmChat,
  switchLlmChat,
  type ChatLine,
} from "../lib/aiChat";
import { runAgent, type ChatMessage } from "../lib/ai/agent";
import { useStudio } from "../store/useStudio";

const EXAMPLES = [
  "重做当前工程：三句口播讲「黑洞不是洞」，GSAP 标题/数据/视界圈跟节拍走。",
  "再加一个脚本，讲光为什么逃不出去，两句口播。",
  "把当前脚本收束句改得更口语一点。",
];

export function AiChatPanel() {
  const dialog = useStudio((s) => s.dialog);
  const setDialog = useStudio((s) => s.setDialog);
  const boot = useRef(loadLlmChat());
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(boot.current.id);
  const [list, setList] = useState(() => listLlmChats());
  const [lines, setLines] = useState<ChatLine[]>(() => boot.current.lines);
  const [busy, setBusy] = useState(false);
  const [secrets, setSecrets] = useState(() => loadLlmSecrets());
  const history = useRef<ChatMessage[]>(boot.current.history);
  const linesRef = useRef(lines);
  const sessionRef = useRef(sessionId);
  linesRef.current = lines;
  sessionRef.current = sessionId;
  const abort = useRef<AbortController | null>(null);
  const hasKey = Boolean(secrets.apiKey.trim());

  useEffect(() => {
    setSecrets(loadLlmSecrets());
  }, [dialog]);

  useEffect(() => {
    saveLlmChat({ id: sessionId, lines, history: history.current });
    setList(listLlmChats());
  }, [lines, sessionId]);

  const applySession = (session: ReturnType<typeof loadLlmChat>) => {
    abort.current?.abort();
    setBusy(false);
    sessionRef.current = session.id;
    setSessionId(session.id);
    history.current = session.history;
    setLines(session.lines);
    setList(listLlmChats());
  };

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const latest = loadLlmSecrets();
    if (!latest.apiKey.trim() && !latest.baseUrl.includes("127.0.0.1") && !latest.baseUrl.includes("localhost")) {
      setDialog("ai");
      return;
    }
    setInput("");
    setLines((xs) => [...xs, { kind: "user", text: prompt }]);
    setBusy(true);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    try {
      const next = await runAgent({
        secrets: latest,
        history: history.current,
        userText: prompt,
        signal: ac.signal,
        onEvent: (ev) => {
          if (ev.type === "text") setLines((xs) => [...xs, { kind: "assistant", text: ev.text }]);
          if (ev.type === "tool") setLines((xs) => [...xs, { kind: "tool", text: ev.summary, ok: ev.ok }]);
          if (ev.type === "error") setLines((xs) => [...xs, { kind: "error", text: ev.message }]);
        },
      });
      history.current = next.filter((m) => m.role !== "system");
      saveLlmChat({ id: sessionRef.current, lines: linesRef.current, history: history.current });
      setList(listLlmChats());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      if (msg !== "已停止") setLines((xs) => [...xs, { kind: "error", text: msg }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {secrets.provider === "deepseek" ? (
          <select
            className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
            value={secrets.model}
            title="切换模型"
            onChange={(e) => {
              saveLlmSecrets({ model: e.target.value });
              setSecrets(loadLlmSecrets());
            }}
          >
            {DEEPSEEK_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === "deepseek-v4-pro" ? "DeepSeek Pro" : "DeepSeek Flash"}
              </option>
            ))}
            {!DEEPSEEK_MODELS.some((m) => m.id === secrets.model) && secrets.model && (
              <option value={secrets.model}>{secrets.model}</option>
            )}
          </select>
        ) : (
          <input
            className="w-48 rounded border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-xs"
            value={secrets.model}
            title="模型名"
            onChange={(e) => {
              saveLlmSecrets({ model: e.target.value });
              setSecrets(loadLlmSecrets());
            }}
          />
        )}
        <button className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper" onClick={() => setDialog("ai")}>
          接口配置
        </button>
        <select
          className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
          value={sessionId}
          title="会话"
          onChange={(e) => applySession(switchLlmChat(e.target.value))}
        >
          {list.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button className="rounded border border-ink-600 px-2 py-1 text-sm" onClick={() => applySession(newLlmChat())}>
          新对话
        </button>
        <button
          className="rounded border border-ink-600 px-2 py-1 text-sm text-red-300"
          onClick={() => {
            if (!window.confirm("删除当前会话？此操作不能恢复。")) return;
            applySession(deleteLlmChat(sessionId));
          }}
        >
          删除
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto rounded border border-ink-600 bg-ink-800 p-3">
        {lines.length === 0 && (
          <div className="space-y-2 text-xs text-ink-400">
            <p>用自然语言生成或改口播脚本。模型会调用本地工具写 beats / 舞台 / GSAP，和 Web2Video 的 AI 分镜同一套方式。</p>
            {!hasKey && <p className="text-copper">还没填 API Key，点「接口配置」或顶栏「AI」。默认 DeepSeek。</p>}
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="block w-full rounded border border-ink-700 px-2 py-1.5 text-left hover:border-copper hover:text-ink-200"
                onClick={() => void send(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed ${
              line.kind === "user"
                ? "text-ink-100"
                : line.kind === "tool"
                  ? line.ok
                    ? "text-brass"
                    : "text-red-400"
                  : line.kind === "error"
                    ? "text-red-400"
                    : "text-ink-200"
            }`}
          >
            {line.kind === "user" ? "你： " : line.kind === "tool" ? "工具： " : line.kind === "error" ? "错误： " : "AI： "}
            {line.text}
          </div>
        ))}
        {busy && <p className="text-xs text-ink-400">正在调用模型与工具…</p>}
      </div>
      <textarea
        className="mt-2 h-24 resize-y rounded border border-ink-600 bg-ink-800 p-2 text-sm"
        placeholder="例如：做三句口播讲光合作用，画面跟节拍走"
        value={input}
        disabled={busy}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send(input);
          }
        }}
      />
      <div className="mt-2 flex gap-2">
        <button
          className="rounded border border-copper px-3 py-1 text-sm disabled:opacity-50"
          disabled={busy || !input.trim()}
          onClick={() => void send(input)}
        >
          发送
        </button>
        {busy && (
          <button
            className="rounded border border-ink-600 px-3 py-1 text-sm"
            onClick={() => {
              abort.current?.abort();
              setBusy(false);
            }}
          >
            停止
          </button>
        )}
        <span className="self-center text-xs text-ink-400">Ctrl+Enter 发送</span>
      </div>
    </section>
  );
}
