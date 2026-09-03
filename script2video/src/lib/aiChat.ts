import { uid } from "./ids";
import type { ChatMessage } from "./ai/agent";

const KEY = "script2video.llm-chat";
const MAX_LINES = 200;
const MAX_HISTORY = 48;
const MAX_SESSIONS = 20;

export type ChatLine =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; text: string; ok: boolean }
  | { kind: "error"; text: string };

export type LlmChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  lines: ChatLine[];
  history: ChatMessage[];
};

type ChatStore = {
  currentId: string;
  sessions: LlmChatSession[];
};

function emptySession(): LlmChatSession {
  return {
    id: uid("chat"),
    title: "新对话",
    updatedAt: Date.now(),
    lines: [],
    history: [],
  };
}

function titleOf(lines: ChatLine[]): string {
  const first = lines.find((l) => l.kind === "user" && l.text.trim());
  const t = first?.text.replace(/\s+/g, " ").trim() ?? "";
  return t ? t.slice(0, 24) : "新对话";
}

function capSession(session: LlmChatSession): LlmChatSession {
  return {
    ...session,
    title: titleOf(session.lines),
    updatedAt: Date.now(),
    lines: session.lines.slice(-MAX_LINES),
    history: session.history.slice(-MAX_HISTORY),
  };
}

function readStore(): ChatStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = emptySession();
      return { currentId: s.id, sessions: [s] };
    }
    const data = JSON.parse(raw) as Partial<ChatStore> & Partial<LlmChatSession>;
    if (Array.isArray(data.sessions) && data.sessions.length) {
      const sessions = data.sessions.map((s) => ({
        id: s.id || uid("chat"),
        title: s.title || titleOf(s.lines ?? []),
        updatedAt: s.updatedAt || Date.now(),
        lines: Array.isArray(s.lines) ? s.lines.slice(-MAX_LINES) : [],
        history: Array.isArray(s.history) ? s.history.slice(-MAX_HISTORY) : [],
      }));
      const currentId = sessions.some((s) => s.id === data.currentId) ? (data.currentId as string) : sessions[0].id;
      return { currentId, sessions };
    }
    const migrated = capSession({
      ...emptySession(),
      lines: Array.isArray(data.lines) ? data.lines : [],
      history: Array.isArray(data.history) ? data.history : [],
    });
    return { currentId: migrated.id, sessions: [migrated] };
  } catch {
    const s = emptySession();
    return { currentId: s.id, sessions: [s] };
  }
}

function writeStore(store: ChatStore) {
  try {
    const sessions = store.sessions.slice(0, MAX_SESSIONS);
    const currentId = sessions.some((s) => s.id === store.currentId) ? store.currentId : sessions[0]?.id ?? "";
    localStorage.setItem(KEY, JSON.stringify({ currentId, sessions }));
  } catch {
    /* quota */
  }
}

export function loadLlmChat(): LlmChatSession {
  const store = readStore();
  return store.sessions.find((s) => s.id === store.currentId) ?? store.sessions[0] ?? emptySession();
}

export function listLlmChats(): { currentId: string; sessions: { id: string; title: string }[] } {
  const store = readStore();
  return {
    currentId: store.currentId,
    sessions: store.sessions.map((s) => ({ id: s.id, title: s.title || "新对话" })),
  };
}

export function saveLlmChat(session: Pick<LlmChatSession, "lines" | "history"> & { id?: string }) {
  const store = readStore();
  const id = session.id || store.currentId;
  const prev = store.sessions.find((s) => s.id === id);
  const next = capSession({
    id,
    title: prev?.title || "新对话",
    updatedAt: Date.now(),
    lines: session.lines,
    history: session.history,
  });
  const sessions = [next, ...store.sessions.filter((s) => s.id !== id)].slice(0, MAX_SESSIONS);
  writeStore({ currentId: id, sessions });
}

export function switchLlmChat(id: string): LlmChatSession {
  const store = readStore();
  const hit = store.sessions.find((s) => s.id === id);
  if (!hit) return loadLlmChat();
  writeStore({ ...store, currentId: id });
  return hit;
}

export function newLlmChat(): LlmChatSession {
  const store = readStore();
  const s = emptySession();
  writeStore({ currentId: s.id, sessions: [s, ...store.sessions].slice(0, MAX_SESSIONS) });
  return s;
}

export function deleteLlmChat(id?: string): LlmChatSession {
  const store = readStore();
  const target = id || store.currentId;
  const remain = store.sessions.filter((s) => s.id !== target);
  const sessions = remain.length ? remain : [emptySession()];
  writeStore({ currentId: sessions[0].id, sessions });
  return sessions[0];
}
