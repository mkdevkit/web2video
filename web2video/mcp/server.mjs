#!/usr/bin/env node
/**
 * stdio MCP：把 Cursor 的工具调用转到正在运行的 Web2Video 编辑器（/__mcp）。
 * 需先 npm run dev 或 tauri:dev，并保持编辑器打开。
 */
import { Buffer } from "node:buffer";

const BASE = (process.env.WEB2VIDEO_MCP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");

function log(msg) {
  process.stderr.write(`[web2video-mcp] ${msg}\n`);
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function postCall(name, args) {
  const res = await fetch(`${BASE}/__mcp/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args: args ?? {} }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return typeof data.result === "string" ? data.result : JSON.stringify(data.result ?? data);
}

function asMcpTools(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((t) => t?.function)
    .filter((fn) => fn && typeof fn.name === "string")
    .map((fn) => ({
      name: fn.name,
      description: fn.description || fn.name,
      inputSchema:
        fn.parameters && typeof fn.parameters === "object"
          ? fn.parameters
          : { type: "object", properties: {} },
    }));
}

const FONT_POLICY =
  "成片字体必须免费可商用。只用 list_catalog.fonts 的 id（均为 SIL OFL，字文件随工具打包，不请求 Google Fonts）。缺省：正文/列表/字幕 noto-sans，标题/数字/金句 noto-serif。元件覆盖也必须是目录 id。栈末回落 Noto。禁止 Arial、微软雅黑、PingFang、Hiragino、Times、system-ui、sans-serif、serif。不要发明目录外字体名。KaTeX_* 同样 SIL OFL。嵌进视频可以，不要把字体文件单独拿去卖。";

const FALLBACK = [
  {
    name: "get_project",
    description: "读取工程概要。请先打开 Web2Video 编辑器（npm run dev）。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_catalog",
    description: `列出版面、元件、字体。${FONT_POLICY} 请先打开 Web2Video 编辑器。`,
    inputSchema: { type: "object", properties: {} },
  },
];

async function listTools() {
  try {
    const data = await getJson("/__mcp/tools");
    const tools = asMcpTools(data.tools);
    return tools.length ? tools : FALLBACK;
  } catch (e) {
    log(e instanceof Error ? e.message : String(e));
    return FALLBACK;
  }
}

async function serverInstructions() {
  try {
    const data = await getJson("/__mcp/tools");
    if (typeof data.instructions === "string" && data.instructions.trim()) return data.instructions;
  } catch {
    /* editor not open */
  }
  return FONT_POLICY;
}

async function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || !msg.method) return null;
  const { id, method, params } = msg;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "web2video", version: "0.1.0" },
        instructions: await serverInstructions(),
      },
    };
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: await listTools() } };
  }
  if (method === "tools/call") {
    const name = params?.name;
    try {
      const text = await postCall(name, params?.arguments);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
    } catch (e) {
      const text = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: true } };
    }
  }
  if (id === undefined) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${method}` } };
}

let buf = Buffer.alloc(0);

function takeMessage() {
  const headerEnd = buf.indexOf("\r\n\r\n");
  if (headerEnd < 0) return null;
  const header = buf.subarray(0, headerEnd).toString("utf8");
  const match = /Content-Length:\s*(\d+)/i.exec(header);
  if (!match) {
    buf = buf.subarray(headerEnd + 4);
    return null;
  }
  const len = Number(match[1]);
  const start = headerEnd + 4;
  if (buf.length < start + len) return null;
  const body = buf.subarray(start, start + len).toString("utf8");
  buf = buf.subarray(start + len);
  return JSON.parse(body);
}

function write(msg) {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  void (async () => {
    for (;;) {
      let parsed;
      try {
        parsed = takeMessage();
      } catch (e) {
        log(e instanceof Error ? e.message : String(e));
        break;
      }
      if (!parsed) break;
      try {
        const out = await handle(parsed);
        if (out) write(out);
      } catch (e) {
        if (parsed.id !== undefined) {
          write({
            jsonrpc: "2.0",
            id: parsed.id,
            error: { code: -32000, message: e instanceof Error ? e.message : String(e) },
          });
        }
      }
    }
  })();
});

log(`stdio ready → ${BASE}/__mcp`);
