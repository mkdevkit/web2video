import { create } from "zustand";
import type { Beat, EngineId, LangId, Project, SceneScript, VisualEvent, VoiceProfile } from "../types";
import { emptyScript, normalizeProject, sampleProject } from "../sample";
import { uid } from "../lib/ids";
import { isLangId } from "../lib/langs";
import { patchSource, switchEngine } from "../lib/engines";
import { DEFAULT_GAP_MS, isGapBeat } from "../lib/beats";

const AUTOSAVE = "script2video.autosave";

function loadSaved(): Project | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE);
    if (!raw) return null;
    const data = JSON.parse(raw) as Project;
    if (!data?.scripts?.length) return null;
    return normalizeProject(data);
  } catch {
    return null;
  }
}

function persist(project: Project) {
  try {
    localStorage.setItem(AUTOSAVE, JSON.stringify(project));
  } catch {
    /* quota */
  }
}

type Dialog = null | "tts" | "export" | "ai" | "stage";
type MainTab = "speech" | "code" | "usage" | "ai";

interface Studio {
  project: Project;
  scriptId: string;
  dialog: Dialog;
  tab: MainTab;
  status: string;
  projectDirName: string | null;
  setDialog: (d: Dialog) => void;
  setTab: (t: MainTab) => void;
  setStatus: (s: string) => void;
  setProjectDirName: (name: string | null) => void;
  setProject: (p: Project) => void;
  patchProject: (patch: Partial<Project>) => void;
  setPreviewLang: (lang: LangId) => void;
  setSourceLang: (lang: LangId) => void;
  selectScript: (id: string) => void;
  addScript: () => void;
  removeScript: (id: string) => void;
  moveScript: (id: string, delta: number) => void;
  setScriptEngine: (id: string, engine: EngineId) => void;
  patchScriptSource: (id: string, text: string) => void;
  patchScript: (id: string, patch: Partial<SceneScript>) => void;
  patchBeat: (scriptId: string, beatId: string, patch: Partial<Beat>) => void;
  renameBeat: (scriptId: string, beatId: string, nextId: string) => void;
  addBeat: (scriptId: string) => void;
  addGap: (scriptId: string) => void;
  removeBeat: (scriptId: string, beatId: string) => void;
  addEvent: (scriptId: string) => void;
  patchEvent: (scriptId: string, eventId: string, patch: Partial<VisualEvent>) => void;
  removeEvent: (scriptId: string, eventId: string) => void;
  upsertVoice: (voice: VoiceProfile) => void;
  removeVoice: (id: string) => void;
  exporting: boolean;
  exportScriptId: string;
  exportLang: LangId;
  exportLocalMs: number;
  burnCaptions: boolean;
  setExporting: (v: boolean) => void;
  setExportLang: (lang: LangId) => void;
  setExportHead: (scriptId: string, localMs: number) => void;
  setBurnCaptions: (v: boolean) => void;
}

function currentId(project: Project, fallback?: string) {
  if (fallback && project.scripts.some((s) => s.id === fallback)) return fallback;
  return project.scripts[0]?.id ?? "";
}

export const useStudio = create<Studio>((set, get) => {
  const initial = loadSaved() ?? sampleProject;
  return {
    project: initial,
    scriptId: currentId(initial),
    dialog: null,
    tab: "speech",
    status: "",
    projectDirName: null,
    setDialog: (dialog) => set({ dialog }),
    setTab: (tab) => set({ tab }),
    setStatus: (status) => set({ status }),
    setProjectDirName: (projectDirName) => set({ projectDirName }),
    setProject: (project) => {
      const next = normalizeProject(project);
      persist(next);
      set({ project: next, scriptId: currentId(next, get().scriptId) });
    },
    patchProject: (patch) => {
      const project = { ...get().project, ...patch };
      persist(project);
      set({ project });
    },
    setPreviewLang: (previewLang) => get().patchProject({ previewLang }),
    setSourceLang: (sourceLang) => get().patchProject({ sourceLang }),
    selectScript: (scriptId) => set({ scriptId }),
    addScript: () => {
      const script = emptyScript();
      script.id = uid("sc");
      const project = { ...get().project, scripts: [...get().project.scripts, script] };
      persist(project);
      set({ project, scriptId: script.id });
    },
    removeScript: (id) => {
      const scripts = get().project.scripts.filter((s) => s.id !== id);
      if (!scripts.length) return;
      const project = { ...get().project, scripts };
      persist(project);
      set({ project, scriptId: currentId(project, get().scriptId === id ? undefined : get().scriptId) });
    },
    moveScript: (id, delta) => {
      const scripts = [...get().project.scripts];
      const i = scripts.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= scripts.length) return;
      const swap = scripts[i];
      scripts[i] = scripts[j];
      scripts[j] = swap;
      const project = { ...get().project, scripts };
      persist(project);
      set({ project });
    },
    setScriptEngine: (id, engine) => {
      const script = get().project.scripts.find((s) => s.id === id);
      if (!script) return;
      get().patchScript(id, switchEngine(script, engine));
    },
    patchScriptSource: (id, text) => {
      const script = get().project.scripts.find((s) => s.id === id);
      if (!script) return;
      get().patchScript(id, patchSource(script, text));
    },
    patchScript: (id, patch) => {
      const project = {
        ...get().project,
        scripts: get().project.scripts.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      };
      persist(project);
      set({ project });
    },
    patchBeat: (scriptId, beatId, patch) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script) return;
      const prev = script.beats.find((b) => b.id === beatId);
      const beats = script.beats.map((b) => (b.id === beatId ? { ...b, ...patch } : b));
      let audioByLang = script.audioByLang;
      if (patch.text && prev && !isGapBeat(prev)) {
        audioByLang = { ...audioByLang };
        for (const lang of Object.keys(patch.text).filter(isLangId)) {
          if ((patch.text[lang] ?? "") === (prev.text[lang] ?? "")) continue;
          const existing = audioByLang[lang];
          if (existing) audioByLang[lang] = { ...existing, stale: true };
        }
      }
      if (patch.gapMs != null && prev && patch.gapMs !== prev.gapMs) {
        audioByLang = { ...audioByLang };
        for (const lang of Object.keys(audioByLang).filter(isLangId)) {
          const existing = audioByLang[lang];
          if (existing) audioByLang[lang] = { ...existing, stale: true };
        }
      }
      get().patchScript(scriptId, { beats, audioByLang });
    },
    renameBeat: (scriptId, beatId, nextId) => {
      const id = nextId.replace(/[^\w-]/g, "").replace(/^([^a-zA-Z_])/, "_$1");
      if (!id || id === beatId) return;
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script || script.beats.some((b) => b.id === id)) return;
      const beats = script.beats.map((b) => (b.id === beatId ? { ...b, id } : b));
      const events = script.events.map((e) => (e.beatId === beatId ? { ...e, beatId: id } : e));
      get().patchScript(scriptId, { beats, events });
    },
    addBeat: (scriptId) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script) return;
      get().patchScript(scriptId, {
        beats: [...script.beats, { id: uid("b"), kind: "speech", text: { [get().project.sourceLang]: "" } }],
      });
    },
    addGap: (scriptId) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script) return;
      get().patchScript(scriptId, {
        beats: [...script.beats, { id: uid("wait"), kind: "gap", text: {}, gapMs: DEFAULT_GAP_MS }],
      });
    },
    removeBeat: (scriptId, beatId) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script || script.beats.length < 2) return;
      get().patchScript(scriptId, { beats: script.beats.filter((b) => b.id !== beatId) });
    },
    addEvent: (scriptId) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script) return;
      const beatId = script.beats[0]?.id ?? "";
      const ev: VisualEvent = {
        id: uid("ev"),
        label: "新事件",
        bind: "fixed",
        beatId,
        at: 0,
        durationMs: 400,
      };
      get().patchScript(scriptId, { events: [...script.events, ev] });
    },
    patchEvent: (scriptId, eventId, patch) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script) return;
      get().patchScript(scriptId, {
        events: script.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
      });
    },
    removeEvent: (scriptId, eventId) => {
      const script = get().project.scripts.find((s) => s.id === scriptId);
      if (!script) return;
      get().patchScript(scriptId, { events: script.events.filter((e) => e.id !== eventId) });
    },
    upsertVoice: (voice) => {
      const list = get().project.voices.filter((v) => v.id !== voice.id);
      const voices = [...list, voice];
      get().patchProject({ voices, voiceId: get().project.voiceId || voice.id });
    },
    removeVoice: (id) => {
      const voices = get().project.voices.filter((v) => v.id !== id);
      const voiceId = get().project.voiceId === id ? voices[0]?.id : get().project.voiceId;
      get().patchProject({ voices, voiceId });
    },
    exporting: false,
    exportScriptId: currentId(initial),
    exportLang: initial.previewLang,
    exportLocalMs: 0,
    burnCaptions: false,
    setExporting: (exporting) => set({ exporting }),
    setExportLang: (exportLang) => set({ exportLang }),
    setExportHead: (exportScriptId, exportLocalMs) => set({ exportScriptId, exportLocalMs }),
    setBurnCaptions: (burnCaptions) => set({ burnCaptions }),
  };
});
