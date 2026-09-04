import { AI_TOOLS, executeTool } from "./ai/tools";

export function connectMcpBridge() {
  if (!import.meta.env.DEV) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}/__mcp`;
  let ws: WebSocket | null = null;
  let delay = 800;
  let closed = false;

  const attach = () => {
    if (closed) return;
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      delay = 800;
      ws?.send(JSON.stringify({ type: "hello", tools: AI_TOOLS }));
    });
    ws.addEventListener("message", (ev) => {
      let msg: { type?: string; id?: string; name?: string; args?: unknown };
      try {
        msg = JSON.parse(String(ev.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.type !== "call" || !msg.id || !msg.name) return;
      try {
        const result = executeTool(msg.name, msg.args);
        ws?.send(JSON.stringify({ type: "result", id: msg.id, result }));
      } catch (e) {
        ws?.send(
          JSON.stringify({
            type: "result",
            id: msg.id,
            result: JSON.stringify({ error: e instanceof Error ? e.message : "工具执行失败" }),
          }),
        );
      }
    });
    ws.addEventListener("close", () => {
      if (closed) return;
      window.setTimeout(attach, delay);
      delay = Math.min(8000, delay * 1.6);
    });
    ws.addEventListener("error", () => ws?.close());
  };

  attach();
  return () => {
    closed = true;
    ws?.close();
  };
}
