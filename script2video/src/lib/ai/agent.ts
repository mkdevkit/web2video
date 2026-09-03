import { chatCompletionsUrl, type LlmSecrets } from "../aiSecrets";
import { AI_TOOLS, executeTool, SYSTEM_PROMPT } from "./tools";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; ok: boolean; summary: string }
  | { type: "error"; message: string };

type CompletionsMessage = {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
};

async function postChat(secrets: LlmSecrets, messages: ChatMessage[], signal?: AbortSignal): Promise<CompletionsMessage> {
  if (!secrets.apiKey.trim() && !secrets.baseUrl.includes("127.0.0.1") && !secrets.baseUrl.includes("localhost")) {
    throw new Error("请先填写生成式 AI 的 API Key");
  }
  const url = chatCompletionsUrl(secrets.baseUrl);
  const payload = {
    model: secrets.model.trim() || "deepseek-v4-flash",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.filter((m) => m.role !== "system")],
    tools: AI_TOOLS,
    tool_choice: "auto",
    temperature: 0.6,
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secrets.apiKey.trim()) headers.Authorization = `Bearer ${secrets.apiKey.trim()}`;

  let res: Response;
  try {
    res = await fetch("/__llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, headers, body: payload }),
      signal,
    });
    if (res.status === 404) {
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal });
    }
  } catch {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal });
  }

  const raw = await res.text();
  let data: {
    error?: { message?: string } | string;
    choices?: { message?: CompletionsMessage }[];
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(res.ok ? "接口返回不是 JSON" : raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = data.error;
    const msg = typeof err === "string" ? err : err?.message;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("接口没有返回消息");
  return message;
}

function summarizeTool(name: string, result: string): { ok: boolean; summary: string } {
  try {
    const data = JSON.parse(result) as { error?: string; ok?: boolean; count?: number; mode?: string };
    if (data.error) return { ok: false, summary: `${name}：${data.error}` };
    if (name === "apply_scripts") return { ok: true, summary: `已${data.mode === "append" ? "追加" : "写入"} ${data.count ?? 0} 个脚本` };
    if (name === "update_script") return { ok: true, summary: "已更新脚本" };
    if (name === "get_project" || name === "get_script" || name === "list_catalog") return { ok: true, summary: `已读取 ${name}` };
    return { ok: true, summary: `已执行 ${name}` };
  } catch {
    return { ok: true, summary: `已执行 ${name}` };
  }
}

export async function runAgent(opts: {
  secrets: LlmSecrets;
  history: ChatMessage[];
  userText: string;
  onEvent: (ev: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [...opts.history, { role: "user", content: opts.userText }];
  for (let round = 0; round < 12; round++) {
    if (opts.signal?.aborted) throw new Error("已停止");
    const reply = await postChat(opts.secrets, messages, opts.signal);
    const calls = reply.tool_calls ?? [];
    if (!calls.length) {
      const text = (reply.content ?? "").trim();
      if (text) opts.onEvent({ type: "text", text });
      messages.push({ role: "assistant", content: reply.content ?? "" });
      return messages;
    }
    messages.push({ role: "assistant", content: reply.content ?? "", tool_calls: calls });
    for (const call of calls) {
      if (opts.signal?.aborted) throw new Error("已停止");
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(call.function.arguments || "{}");
      } catch {
        parsed = {};
      }
      const result = executeTool(call.function.name, parsed);
      const { ok, summary } = summarizeTool(call.function.name, result);
      opts.onEvent({ type: "tool", name: call.function.name, ok, summary });
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  throw new Error("工具调用轮次过多，请把需求拆短再试");
}
