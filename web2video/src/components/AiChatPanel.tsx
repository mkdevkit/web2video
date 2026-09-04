import { Plus, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEEPSEEK_MODELS, loadLlmSecrets, saveLlmSecrets } from "../lib/aiSecrets";
import {
  deleteLlmChat,
  listLlmChats,
  loadLlmChat,
  newLlmChat,
  saveLlmChat,
  subscribeLlmChat,
  switchLlmChat,
  type ChatLine,
} from "../lib/aiChat";
import { persistAiSession } from "../lib/projectFolder";
import { runAgent, type ChatMessage } from "../lib/ai/agent";
import { useEditor } from "../store/useEditor";

const EXAMPLES = [
  "把当前片子重做成三分钟科普：黑洞不是洞。分 5 场，每场写好口播列表。",
  "在最后追加一场总结，金句版面。",
  "把第 2 场改成要点列表，三条常见误解。",
];

export function AiChatPanel() {
  const dialog = useEditor((s) => s.dialog);
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
    persistAiSession();
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

  useEffect(() => subscribeLlmChat(() => applySession(loadLlmChat())), []);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const latest = loadLlmSecrets();
    if (!latest.apiKey.trim() && !latest.baseUrl.includes("127.0.0.1") && !latest.baseUrl.includes("localhost")) {
      useEditor.getState().setDialog("ai");
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
      persistAiSession();
      setList(listLlmChats());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      if (msg !== "已停止") setLines((xs) => [...xs, { kind: "error", text: msg }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-ink-700 px-2 py-1.5">
        {secrets.provider === "deepseek" ? (
          <select
            className="field min-w-0 flex-1 py-0.5 text-[11px]"
            value={secrets.model}
            title="切换模型"
            onChange={(e) => {
              saveLlmSecrets({ model: e.target.value });
              setSecrets(loadLlmSecrets());
            }}
          >
            {DEEPSEEK_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === "deepseek-v4-pro" ? "Pro" : "Flash"}
              </option>
            ))}
            {!DEEPSEEK_MODELS.some((m) => m.id === secrets.model) && secrets.model && (
              <option value={secrets.model}>{secrets.model}</option>
            )}
          </select>
        ) : (
          <input
            className="field min-w-0 flex-1 py-0.5 font-mono text-[10px]"
            value={secrets.model}
            title="模型名"
            onChange={(e) => {
              saveLlmSecrets({ model: e.target.value });
              setSecrets(loadLlmSecrets());
            }}
          />
        )}
        <button className="btn px-1.5 py-0.5" title="接口配置" onClick={() => useEditor.getState().setDialog("ai")}>
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-ink-700 px-2 py-1">
        <select
          className="field min-w-0 flex-1 py-0.5 text-[11px]"
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
        <button className="btn px-1.5 py-0.5" title="新对话" onClick={() => applySession(newLlmChat())}>
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          className="btn px-1.5 py-0.5 text-red-300"
          title="删除当前会话"
          onClick={() => {
            if (!window.confirm("删除当前会话？此操作不能恢复。")) return;
            applySession(deleteLlmChat(sessionId));
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto px-3 py-2">
        {lines.length === 0 && (
          <div className="space-y-2 text-[11px] text-ink-400">
            <p>边看舞台边生成或改场景。会话写入工程目录的 aisession.json；打开该文件夹即可恢复。没有独立记忆库，模型只看到当前会话最近若干轮。</p>
            {!hasKey && <p className="text-copper">还没填 API Key，点右上角齿轮或顶栏「AI」配置。</p>}
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="block w-full rounded border border-ink-700 px-2 py-1.5 text-left hover:border-brass/40 hover:text-ink-200"
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
            className={`text-[12px] leading-relaxed ${
              line.kind === "user"
                ? "text-paper"
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
        {busy && <p className="text-[11px] text-ink-500">正在调用模型与工具…</p>}
      </div>
      <div className="shrink-0 border-t border-ink-700 p-2">
        <textarea
          className="field min-h-[64px] w-full text-[12px]"
          placeholder="例如：做一部四场短片，讲光合作用"
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
        <div className="mt-1 flex gap-1">
          <button className="btn btn-accent flex-1" disabled={busy || !input.trim()} onClick={() => void send(input)}>
            发送
          </button>
          {busy && (
            <button
              className="btn"
              onClick={() => {
                abort.current?.abort();
                setBusy(false);
              }}
            >
              停止
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-ink-500">Ctrl+Enter 发送</p>
      </div>
    </div>
  );
}
