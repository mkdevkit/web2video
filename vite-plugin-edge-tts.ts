import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import type { Plugin } from "vite";
import { WebSocket } from "ws";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11_644_473_600;
const CHROMIUM_FULL_VERSION = "130.0.2849.68";
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

function secMsGec(clockSkewSeconds = 0): string {
  let ticks = Math.floor((Date.now() / 1000 + clockSkewSeconds + WIN_EPOCH) * 10_000_000);
  ticks -= ticks % 3_000_000_000;
  return createHash("sha256").update(`${ticks}${TRUSTED_CLIENT_TOKEN}`).digest("hex").toUpperCase();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoStamp(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function wsHeaders(): Record<string, string> {
  return {
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
    Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

type WordTs = { text: string; startMs: number; endMs: number };

function parseMetadata(json: string, words: WordTs[]) {
  try {
    const data = JSON.parse(json) as {
      Metadata?: { Type?: string; Data?: { Offset?: number; Duration?: number; text?: { Text?: string } } }[];
    };
    for (const row of data.Metadata ?? []) {
      if (row.Type !== "WordBoundary") continue;
      const offset = (row.Data?.Offset ?? 0) / 10_000;
      const dur = (row.Data?.Duration ?? 0) / 10_000;
      const text = row.Data?.text?.Text ?? "";
      words.push({ text, startMs: offset, endMs: offset + dur });
    }
  } catch {
    /* ignore */
  }
}

function synthesize(text: string, voice: string, lang: string, clockSkew = 0): Promise<{ audio: Buffer; words: WordTs[] }> {
  return new Promise((resolve, reject) => {
    const connId = randomUUID().replace(/-/g, "").toUpperCase();
    const reqId = randomUUID().replace(/-/g, "").toUpperCase();
    const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connId}&Sec-MS-GEC=${secMsGec(clockSkew)}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    const ws = new WebSocket(url, { headers: wsHeaders() });
    const chunks: Buffer[] = [];
    const words: WordTs[] = [];
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };

    const timer = setTimeout(() => fail(new Error("TTS 超时")), 45_000);

    ws.on("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));
    ws.on("unexpected-response", (_req, res) => {
      const date = res.headers.date;
      fail(Object.assign(new Error(`TTS 握手失败 ${res.statusCode}`), { statusCode: res.statusCode, date }));
    });

    ws.on("open", () => {
      const config = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "true" },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      });
      ws.send(
        `X-Timestamp:${isoStamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${config}`,
      );
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${escapeXml(lang)}'><voice name='${escapeXml(voice)}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(
        `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${isoStamp()}\r\nPath:ssml\r\n\r\n${ssml}`,
      );
    });

    ws.on("message", (raw, isBinary) => {
      if (isBinary || raw instanceof Buffer) {
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        const audio = buf.subarray(2 + headerLen);
        if (audio.length) chunks.push(audio);
        return;
      }
      const msg = String(raw);
      if (msg.includes("Path:audio.metadata")) {
        const body = msg.split("\r\n\r\n").slice(1).join("\r\n\r\n");
        parseMetadata(body, words);
      }
      if (msg.includes("Path:turn.end")) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        resolve({ audio: Buffer.concat(chunks), words });
      }
    });

    ws.on("close", () => {
      if (!settled) fail(new Error("TTS 连接已关闭"));
    });
  });
}

async function synthesizeWithSkew(text: string, voice: string, lang: string) {
  try {
    return await synthesize(text, voice, lang, 0);
  } catch (e) {
    const err = e as Error & { statusCode?: number; date?: string };
    if (err.statusCode === 403 && err.date) {
      const server = Date.parse(err.date);
      if (!Number.isNaN(server)) {
        const skew = (server - Date.now()) / 1000;
        return synthesize(text, voice, lang, skew);
      }
    }
    throw e;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url ?? "";
  if (!url.startsWith("/__edge_tts/") && !url.startsWith("/__tts/")) return next();

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (url.startsWith("/__edge_tts/synthesize") && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as { text?: string; voice?: string; lang?: string };
      const text = (body.text ?? "").trim();
      if (!text) return json(res, 400, { error: "文本为空" });
      const voice = body.voice || "zh-CN-XiaoxiaoNeural";
      const lang = body.lang || "zh-CN";
      const { audio, words } = await synthesizeWithSkew(text, voice, lang);
      if (!audio.length) return json(res, 502, { error: "未收到音频" });
      json(res, 200, {
        audioBase64: audio.toString("base64"),
        contentType: "audio/mpeg",
        words,
      });
    } catch (e) {
      json(res, 502, { error: e instanceof Error ? e.message : "TTS 失败" });
    }
    return;
  }

  if (url.startsWith("/__tts/azure") && req.method === "POST") {
    try {
      const key = String(req.headers["x-tts-key"] ?? "");
      const region = String(req.headers["x-tts-region"] ?? "eastasia");
      if (!key) return json(res, 400, { error: "缺少 Azure Key" });
      const body = JSON.parse(await readBody(req)) as { text?: string; voice?: string; lang?: string };
      const text = (body.text ?? "").trim();
      if (!text) return json(res, 400, { error: "文本为空" });
      const voice = body.voice || "zh-CN-XiaoxiaoNeural";
      const lang = body.lang || "zh-CN";
      const ssml = `<speak version='1.0' xml:lang='${escapeXml(lang)}'><voice name='${escapeXml(voice)}'>${escapeXml(text)}</voice></speak>`;
      const azureRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        },
        body: ssml,
      });
      if (!azureRes.ok) {
        const hint = await azureRes.text().catch(() => "");
        return json(res, 502, { error: `Azure TTS ${azureRes.status}${hint ? `: ${hint.slice(0, 160)}` : ""}` });
      }
      const buf = Buffer.from(await azureRes.arrayBuffer());
      json(res, 200, { audioBase64: buf.toString("base64"), contentType: "audio/mpeg", words: [] });
    } catch (e) {
      json(res, 502, { error: e instanceof Error ? e.message : "Azure TTS 失败" });
    }
    return;
  }

  if (url.startsWith("/__tts/openai") && req.method === "POST") {
    try {
      const key = String(req.headers["x-tts-key"] ?? "");
      if (!key) return json(res, 400, { error: "缺少 OpenAI Key" });
      const body = JSON.parse(await readBody(req)) as { text?: string; voice?: string; model?: string };
      const text = (body.text ?? "").trim();
      if (!text) return json(res, 400, { error: "文本为空" });
      const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: body.model || "tts-1-hd",
          voice: body.voice || "alloy",
          input: text,
          response_format: "mp3",
        }),
      });
      if (!openaiRes.ok) {
        const hint = await openaiRes.text().catch(() => "");
        return json(res, 502, { error: `OpenAI TTS ${openaiRes.status}${hint ? `: ${hint.slice(0, 160)}` : ""}` });
      }
      const buf = Buffer.from(await openaiRes.arrayBuffer());
      json(res, 200, { audioBase64: buf.toString("base64"), contentType: "audio/mpeg", words: [] });
    } catch (e) {
      json(res, 502, { error: e instanceof Error ? e.message : "OpenAI TTS 失败" });
    }
    return;
  }

  res.statusCode = 404;
  res.end("not found");
}

export function edgeTtsPlugin(): Plugin {
  return {
    name: "edge-tts",
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
