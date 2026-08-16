import { uid } from "./ids";

const KEY = "web2video.voice-library";
const MAX = 80;

export type TimbreKind = "design" | "clone";

export interface Timbre {
  id: string;
  name: string;
  kind: TimbreKind;
  /** DashScope voice identifier returned by enrollment/design. */
  voice: string;
  targetModel: string;
  prompt?: string;
  preferredName?: string;
  gender?: "女" | "男";
  createdAt: number;
}

function read(): Timbre[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { voices?: Partial<Timbre>[] } | Partial<Timbre>[];
    const list = Array.isArray(data) ? data : data.voices;
    if (!Array.isArray(list)) return [];
    return list
      .filter((t) => t && typeof t.voice === "string" && t.voice.trim())
      .map((t) => ({
        id: t.id || uid("tb"),
        name: (t.name || t.preferredName || t.voice || "未命名音色").toString().slice(0, 40),
        kind: t.kind === "clone" ? "clone" : "design",
        voice: t.voice!.trim(),
        targetModel: (t.targetModel || "").trim(),
        prompt: typeof t.prompt === "string" ? t.prompt : undefined,
        preferredName: typeof t.preferredName === "string" ? t.preferredName : undefined,
        gender: t.gender === "男" || t.gender === "女" ? t.gender : undefined,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function write(voices: Timbre[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ voices: voices.slice(0, MAX) }));
  } catch {
    /* quota */
  }
}

export function loadTimbres(): Timbre[] {
  return read();
}

export function upsertTimbre(timbre: Omit<Timbre, "id" | "createdAt"> & { id?: string; createdAt?: number }): Timbre {
  const list = read();
  const id = timbre.id || uid("tb");
  const next: Timbre = {
    id,
    name: timbre.name.trim() || "未命名音色",
    kind: timbre.kind,
    voice: timbre.voice.trim(),
    targetModel: timbre.targetModel.trim(),
    prompt: timbre.prompt,
    preferredName: timbre.preferredName,
    gender: timbre.gender,
    createdAt: timbre.createdAt ?? Date.now(),
  };
  const without = list.filter((t) => t.id !== id && t.voice !== next.voice);
  write([next, ...without]);
  return next;
}

export function removeTimbre(id: string) {
  write(read().filter((t) => t.id !== id));
}

export function findTimbreByVoice(voice: string): Timbre | undefined {
  return read().find((t) => t.voice === voice);
}

export function mergeCloudTimbres(
  rows: { voice: string; targetModel?: string; name?: string; kind?: TimbreKind }[],
): Timbre[] {
  const list = read();
  const known = new Set(list.map((t) => t.voice));
  const added: Timbre[] = [];
  for (const row of rows) {
    const voice = row.voice.trim();
    if (!voice || known.has(voice)) continue;
    known.add(voice);
    const model = (row.targetModel || "").trim();
    const kind = row.kind ?? (model.includes("-vc") || model.includes("tts-vc") ? "clone" : "design");
    added.push({
      id: uid("tb"),
      name: (row.name || voice).slice(0, 40),
      kind,
      voice,
      targetModel: model,
      createdAt: Date.now(),
    });
  }
  write([...added, ...list]);
  return loadTimbres();
}

export function preferredNameOf(label: string, fallback: string): string {
  const t = label.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
  if (t) return t;
  return `${fallback}${Date.now().toString(36).slice(-8)}`.slice(0, 16);
}
