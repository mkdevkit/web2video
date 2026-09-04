import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Plugin } from "vite";
import { WebSocket, WebSocketServer } from "ws";

type Pending = {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export function mcpBridgePlugin(): Plugin {
  let browser: WebSocket | null = null;
  let tools: unknown[] = [];
  let instructions = "";
  const pending = new Map<string, Pending>();

  const callEditor = (name: string, args: unknown) =>
    new Promise<string>((resolve, reject) => {
      if (!browser || browser.readyState !== WebSocket.OPEN) {
        reject(new Error("Web2Video 未打开。请先 npm run dev（或 tauri:dev）并保持编辑器窗口。"));
        return;
      }
      const id = randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("MCP 调用超时"));
      }, 60_000);
      pending.set(id, { resolve, reject, timer });
      browser.send(JSON.stringify({ type: "call", id, name, args: args ?? {} }));
    });

  const handleHttp = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? "";
    const path = url.split("?")[0];
    if (!path.startsWith("/__mcp")) return next();
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (path === "/__mcp/health" && req.method === "GET") {
      json(res, 200, {
        ok: true,
        connected: Boolean(browser && browser.readyState === WebSocket.OPEN),
        tools: tools.length,
      });
      return;
    }
    if (path === "/__mcp/tools" && req.method === "GET") {
      json(res, 200, { tools, instructions });
      return;
    }
    if (path === "/__mcp/call" && req.method === "POST") {
      try {
        const payload = JSON.parse(await readBody(req)) as { name?: string; args?: unknown };
        const name = (payload.name ?? "").trim();
        if (!name) {
          json(res, 400, { error: "缺少 name" });
          return;
        }
        const result = await callEditor(name, payload.args);
        json(res, 200, { result });
      } catch (e) {
        json(res, 503, { error: e instanceof Error ? e.message : "MCP 调用失败" });
      }
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  };

  return {
    name: "mcp-bridge",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      wss.on("connection", (ws) => {
        if (browser && browser.readyState === WebSocket.OPEN) browser.close();
        browser = ws;
        ws.on("message", (raw) => {
          let msg: { type?: string; id?: string; result?: string; tools?: unknown[]; instructions?: string };
          try {
            msg = JSON.parse(String(raw)) as typeof msg;
          } catch {
            return;
          }
          if (msg.type === "hello" && Array.isArray(msg.tools)) {
            tools = msg.tools;
            if (typeof msg.instructions === "string") instructions = msg.instructions;
            return;
          }
          if (msg.type === "result" && typeof msg.id === "string") {
            const p = pending.get(msg.id);
            if (!p) return;
            pending.delete(msg.id);
            clearTimeout(p.timer);
            p.resolve(typeof msg.result === "string" ? msg.result : JSON.stringify(msg.result ?? null));
          }
        });
        ws.on("close", () => {
          if (browser === ws) browser = null;
        });
      });
      server.httpServer?.on("upgrade", (req, socket, head) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname !== "/__mcp") return;
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      });
      server.middlewares.use((req, res, next) => {
        void handleHttp(req, res, next);
      });
    },
  };
}
