import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function allowedTarget(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return true;
    return false;
  } catch {
    return false;
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const path = req.url ?? "";
  if (!path.startsWith("/__llm/")) return next();
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (path !== "/__llm/chat" || req.method !== "POST") {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  try {
    const payload = JSON.parse(await readBody(req)) as {
      url?: string;
      headers?: Record<string, string>;
      body?: unknown;
    };
    const url = (payload.url ?? "").trim();
    if (!allowedTarget(url)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "只允许 https 或本机 http 接口" }));
      return;
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    for (const [k, v] of Object.entries(payload.headers ?? {})) {
      if (/^(authorization|content-type)$/i.test(k) && typeof v === "string") headers[k] = v;
    }
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload.body ?? {}),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.end(text);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "LLM 代理失败" }));
  }
}

export function llmProxyPlugin(): Plugin {
  return {
    name: "llm-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next);
      });
    },
  };
}
