import { create } from "zustand";
import { uid } from "../lib/ids";
import { collectI18nRows, patchSceneI18n, writeI18n } from "../lib/textI18n";
import { defaultCues, ensureCues, makeBlock, presetBlocks, sceneBlocks } from "../lib/blocks";
import { upsertKey, removeKeyAt } from "../lib/interpolate";
import { emptyScene, normalizeProject, sampleProject } from "../lib/templates";
import { sceneAt, sceneStarts } from "../lib/timeline";
import { applyResolvedCueRange, bakeCueBind } from "../lib/cues";
import { itemSpeakKey, markLangAudioStale, ensureCuesFromBeats, writeSpeak } from "../lib/narration";
import type { BlockSettings, BlockType, Cue, CueBind, EditorSnapshot, LayoutBlock, LayoutId, Project, Scene, SceneAudio, TtsProvider, VoiceProfile } from "../types";
import type { LangId } from "../lib/langs";
import type { I18nRow } from "../lib/textI18n";

const STORAGE_KEY = "web2video.autosave";
const HISTORY_LIMIT = 60;

function snapshotOf(project: Project, currentSceneId: string): EditorSnapshot {
  return { project: structuredClone(project), currentSceneId };
}

function loadAutosave(): { project: Project; currentSceneId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { project: Project; currentSceneId: string };
    if (!data?.project?.scenes?.length) return null;
    return { project: normalizeProject(data.project), currentSceneId: data.currentSceneId };
  } catch {
    return null;
  }
}

function persist(project: Project, currentSceneId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, currentSceneId }));
  } catch {
    /* quota */
  }
}

const boot = sampleProject();

export type DialogId = null | "welcome" | "export" | "texts" | "script" | "tts" | "help";

interface EditorState {
  project: Project;
  currentSceneId: string;
  selectedCueId: string | null;
  selectedBlockId: string | null;
  playheadMs: number;
  playing: boolean;
  exporting: boolean;
  exportHint: string;
  dialog: DialogId;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  projectDirName: string | null;

  currentScene: () => Scene | undefined;
  setDialog: (dialog: DialogId) => void;
  setPlaying: (playing: boolean) => void;
  setExporting: (exporting: boolean) => void;
  setExportHint: (hint: string) => void;
  setPlayhead: (ms: number) => void;
  setSelectedCue: (id: string | null) => void;
  setSelectedBlock: (id: string | null) => void;
  writeBlockTransform: (sceneId: string, blockId: string, pose: { x?: number; y?: number; w?: number; h?: number }, progress: number) => void;
  patchBlockSettings: (sceneId: string, blockId: string, settings: Partial<BlockSettings>) => void;
  removeBlockKey: (sceneId: string, blockId: string, t: number) => void;
  setProjectDirName: (name: string | null) => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  setProjectName: (name: string) => void;
  replaceProject: (project: Project, sceneId?: string) => void;
  newProject: (project: Project) => void;
  updateProject: (patch: Partial<Project>, history?: boolean) => void;
  setPreviewLang: (lang: LangId) => void;
  setSourceLang: (lang: LangId) => void;
  setVoice: (lang: LangId, voice: string) => void;

  addScene: (layout?: LayoutId) => void;
  duplicateScene: (id?: string) => void;
  removeScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  moveScene: (id: string, dir: -1 | 1) => void;
  setCurrentScene: (id: string, seek?: boolean) => void;
  replaceScenes: (scenes: Scene[]) => void;
  patchScene: (id: string, patch: Partial<Scene> | ((s: Scene) => Scene), history?: boolean) => void;
  setLayout: (id: string, layout: LayoutId) => void;
  patchSlotText: (sceneId: string, key: "title" | "subtitle" | "body" | "caption" | "quote" | "author" | "number" | "narration" | "narrationClose", value: string) => void;
  patchItemText: (sceneId: string, itemId: string, value: string) => void;
  patchSpeak: (sceneId: string, key: string, value: string) => void;
  addItem: (sceneId: string) => void;
  removeItem: (sceneId: string, itemId: string) => void;
  setImage: (sceneId: string, src: string) => void;
  setCueAt: (sceneId: string, cueId: string, at: number) => void;
  setCueRange: (sceneId: string, cueId: string, at: number, until: number) => void;
  setCueBind: (sceneId: string, cueId: string, bind: CueBind) => void;
  patchCue: (sceneId: string, cueId: string, patch: Partial<Cue>) => void;
  setCueAnim: (sceneId: string, cueId: string, anim: Cue["anim"]) => void;
  addBlock: (sceneId: string, type: BlockType) => void;
  patchBlock: (sceneId: string, blockId: string, patch: Partial<LayoutBlock>) => void;
  removeBlock: (sceneId: string, blockId: string) => void;
  setTtsProvider: (provider: TtsProvider) => void;
  addVoice: (voice: VoiceProfile) => void;
  updateVoice: (id: string, patch: Partial<VoiceProfile>) => void;
  removeVoice: (id: string) => void;
  applyI18nRow: (row: I18nRow, lang: LangId, value: string, history?: boolean) => void;
  markAudio: (sceneId: string, lang: LangId, audio: SceneAudio) => void;
}

function mapScenes(project: Project, id: string, fn: (s: Scene) => Scene): Project {
  return { ...project, scenes: project.scenes.map((s) => (s.id === id ? fn(s) : s)) };
}

export const useEditor = create<EditorState>((set, get) => ({
  project: boot,
  currentSceneId: boot.scenes[0]?.id ?? "",
  selectedCueId: null,
  selectedBlockId: null,
  playheadMs: 0,
  playing: false,
  exporting: false,
  exportHint: "",
  dialog: "welcome",
  past: [],
  future: [],
  projectDirName: null,

  currentScene: () => get().project.scenes.find((s) => s.id === get().currentSceneId),

  setDialog: (dialog) => set({ dialog }),
  setPlaying: (playing) => set({ playing }),
  setExporting: (exporting) => set({ exporting, exportHint: exporting ? get().exportHint : "" }),
  setExportHint: (hint) => set({ exportHint: hint }),
  setPlayhead: (ms) => {
    const { project } = get();
    const lang = project.previewLang;
    const at = sceneAt(project, lang, ms);
    set({
      playheadMs: Math.max(0, ms),
      currentSceneId: at?.scene.id ?? get().currentSceneId,
    });
  },
  setSelectedCue: (id) => set({ selectedCueId: id }),
  setSelectedBlock: (id) => {
    const scene = get().currentScene();
    const cueId = id ? scene?.cues.find((c) => c.target === id)?.id ?? null : null;
    set({ selectedBlockId: id, selectedCueId: cueId });
  },
  writeBlockTransform: (sceneId, blockId, pose, progress) => {
    get().patchScene(
      sceneId,
      (s) => {
        const blocks = s.blocks?.length ? s.blocks : presetBlocks(s.layoutId);
        return {
          ...s,
          blocks: blocks.map((b) => (b.id === blockId ? upsertKey(b, progress, pose) : b)),
        };
      },
      false,
    );
  },
  patchBlockSettings: (sceneId, blockId, settings) => {
    get().patchScene(
      sceneId,
      (s) => {
        const blocks = s.blocks?.length ? s.blocks : presetBlocks(s.layoutId);
        return {
          ...s,
          blocks: blocks.map((b) =>
            b.id === blockId ? { ...b, settings: { ...b.settings, ...settings } } : b,
          ),
        };
      },
      false,
    );
  },
  removeBlockKey: (sceneId, blockId, t) => {
    get().patchScene(
      sceneId,
      (s) => ({
        ...s,
        blocks: (s.blocks ?? []).map((b) => (b.id === blockId ? removeKeyAt(b, t) : b)),
      }),
      true,
    );
  },
  setProjectDirName: (name) => set({ projectDirName: name }),

  commit: () => {
    const { project, currentSceneId, past } = get();
    set({
      past: [...past, snapshotOf(project, currentSceneId)].slice(-HISTORY_LIMIT),
      future: [],
    });
  },
  undo: () => {
    const { past, project, currentSceneId, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({
      project: prev.project,
      currentSceneId: prev.currentSceneId,
      past: past.slice(0, -1),
      future: [...future, snapshotOf(project, currentSceneId)],
      playing: false,
    });
    persist(prev.project, prev.currentSceneId);
  },
  redo: () => {
    const { future, project, currentSceneId, past } = get();
    const next = future[future.length - 1];
    if (!next) return;
    set({
      project: next.project,
      currentSceneId: next.currentSceneId,
      future: future.slice(0, -1),
      past: [...past, snapshotOf(project, currentSceneId)],
      playing: false,
    });
    persist(next.project, next.currentSceneId);
  },

  setProjectName: (name) => {
    const project = { ...get().project, name };
    set({ project });
    persist(project, get().currentSceneId);
  },
  replaceProject: (project, sceneId) => {
    const currentSceneId = sceneId ?? project.scenes[0]?.id ?? "";
    set({ project, currentSceneId, past: [], future: [], playheadMs: 0, playing: false, dialog: null, selectedCueId: null, selectedBlockId: null });
    persist(project, currentSceneId);
  },
  newProject: (project) => {
    get().replaceProject(project);
  },
  updateProject: (patch, history = true) => {
    if (history) get().commit();
    const project = { ...get().project, ...patch };
    set({ project });
    persist(project, get().currentSceneId);
  },
  setPreviewLang: (lang) => {
    const project = { ...get().project, previewLang: lang };
    set({ project, playheadMs: 0, playing: false });
    persist(project, get().currentSceneId);
  },
  setSourceLang: (lang) => {
    const project = { ...get().project, sourceLang: lang };
    set({ project });
    persist(project, get().currentSceneId);
  },
  setVoice: (lang, voice) => {
    const project = { ...get().project, voiceByLang: { ...get().project.voiceByLang, [lang]: voice } };
    set({ project });
    persist(project, get().currentSceneId);
  },

  addScene: (layout = "cover") => {
    get().commit();
    const scene = emptyScene(get().project.sourceLang, layout);
    const project = { ...get().project, scenes: [...get().project.scenes, scene] };
    set({ project, currentSceneId: scene.id });
    persist(project, scene.id);
  },
  duplicateScene: (id) => {
    const src = get().project.scenes.find((s) => s.id === (id ?? get().currentSceneId));
    if (!src) return;
    get().commit();
    const copy: Scene = structuredClone(src);
    copy.id = uid("sc");
    copy.name = `${src.name} 副本`;
    copy.audioByLang = undefined;
    copy.cues = copy.cues.map((c) => ({ ...c, id: uid("cue") }));
    const idx = get().project.scenes.findIndex((s) => s.id === src.id);
    const scenes = [...get().project.scenes];
    scenes.splice(idx + 1, 0, copy);
    const project = { ...get().project, scenes };
    set({ project, currentSceneId: copy.id });
    persist(project, copy.id);
  },
  removeScene: (id) => {
    const { project } = get();
    if (project.scenes.length <= 1) return;
    get().commit();
    const scenes = project.scenes.filter((s) => s.id !== id);
    const currentSceneId = get().currentSceneId === id ? scenes[0].id : get().currentSceneId;
    const next = { ...project, scenes };
    set({ project: next, currentSceneId });
    persist(next, currentSceneId);
  },
  renameScene: (id, name) => {
    get().patchScene(id, { name }, true);
  },
  moveScene: (id, dir) => {
    const scenes = [...get().project.scenes];
    const i = scenes.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= scenes.length) return;
    get().commit();
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    const project = { ...get().project, scenes };
    set({ project });
    persist(project, get().currentSceneId);
  },
  setCurrentScene: (id, seek = true) => {
    const { project } = get();
    const lang = project.previewLang;
    const starts = sceneStarts(project, lang);
    const idx = project.scenes.findIndex((s) => s.id === id);
    set({
      currentSceneId: id,
      selectedCueId: null,
      selectedBlockId: null,
      playheadMs: seek && idx >= 0 ? starts[idx] : get().playheadMs,
      playing: false,
    });
  },
  replaceScenes: (scenes) => {
    get().commit();
    const project = { ...get().project, scenes };
    const currentSceneId = scenes[0]?.id ?? "";
    set({ project, currentSceneId, playheadMs: 0 });
    persist(project, currentSceneId);
  },
  patchScene: (id, patch, history = true) => {
    if (history) get().commit();
    const fn = typeof patch === "function" ? patch : (s: Scene) => ({ ...s, ...patch });
    const project = mapScenes(get().project, id, fn);
    set({ project });
    persist(project, get().currentSceneId);
  },
  setLayout: (id, layout) => {
    get().patchScene(
      id,
      (s) => {
        const items = s.slots.items;
        if (layout === "custom") {
          const blocks = s.blocks?.length ? s.blocks : presetBlocks(s.layoutId === "custom" ? "cover" : s.layoutId);
          return { ...s, layoutId: layout, blocks, cues: defaultCues(layout, items, blocks) };
        }
        return { ...s, layoutId: layout, blocks: undefined, cues: defaultCues(layout, items) };
      },
      true,
    );
  },
  patchSlotText: (sceneId, key, value) => {
    const lang = get().project.previewLang;
    const source = get().project.sourceLang;
    get().patchScene(
      sceneId,
      (s) => {
        if (key === "narration" || key === "narrationClose") {
          const next = writeSpeak(s, key === "narration" ? "open" : "close", {
            i18n: writeI18n(key === "narration" ? s.narration.i18n : s.narrationClose?.i18n, lang, source, value),
          });
          return markLangAudioStale(next, lang);
        }
        const slot = s.slots[key];
        return {
          ...s,
          slots: {
            ...s.slots,
            [key]: { i18n: writeI18n(slot?.i18n, lang, source, value) },
          },
        };
      },
      true,
    );
  },
  patchSpeak: (sceneId, key, value) => {
    const lang = get().project.previewLang;
    const source = get().project.sourceLang;
    get().patchScene(
      sceneId,
      (s) => {
        const prev = key === "open" ? s.narration : key === "close" ? s.narrationClose : s.speak?.[key];
        const next = markLangAudioStale(writeSpeak(s, key, { i18n: writeI18n(prev?.i18n, lang, source, value) }), lang);
        return { ...next, cues: ensureCuesFromBeats(next, lang, source) };
      },
      true,
    );
  },
  patchItemText: (sceneId, itemId, value) => {
    const lang = get().project.previewLang;
    const source = get().project.sourceLang;
    get().patchScene(
      sceneId,
      (s) => ({
        ...s,
        slots: {
          ...s.slots,
          items: (s.slots.items ?? []).map((it) =>
            it.id === itemId ? { ...it, i18n: writeI18n(it.i18n, lang, source, value) } : it,
          ),
        },
      }),
      true,
    );
  },
  addItem: (sceneId) => {
    const lang = get().project.sourceLang;
    get().patchScene(
      sceneId,
      (s) => {
        const items = [...(s.slots.items ?? []), { id: uid("it"), i18n: { [lang]: "新条目" } }];
        const blocks = sceneBlocks(s);
        return { ...s, slots: { ...s.slots, items }, cues: defaultCues(s.layoutId, items, s.layoutId === "custom" ? blocks : undefined) };
      },
      true,
    );
  },
  removeItem: (sceneId, itemId) => {
    get().patchScene(
      sceneId,
      (s) => {
        const items = (s.slots.items ?? []).filter((it) => it.id !== itemId);
        const speak = { ...s.speak };
        delete speak[itemSpeakKey(itemId)];
        const blocks = sceneBlocks(s);
        return { ...s, speak, slots: { ...s.slots, items }, cues: defaultCues(s.layoutId, items, s.layoutId === "custom" ? blocks : undefined) };
      },
      true,
    );
  },
  setImage: (sceneId, src) => {
    get().patchScene(sceneId, (s) => ({ ...s, slots: { ...s.slots, image: src } }), true);
  },
  setCueAt: (sceneId, cueId, at) => {
    const project = get().project;
    const scene = project.scenes.find((s) => s.id === sceneId);
    const cue = scene?.cues.find((c) => c.id === cueId);
    if (!cue) return;
    const resolved = scene
      ? applyResolvedCueRange(scene, cue, at, cue.until ?? 1, project.previewLang, project.sourceLang, project)
      : cue;
    get().setCueRange(sceneId, cueId, resolved.at, resolved.until);
  },
  setCueRange: (sceneId, cueId, at, until) => {
    const project = get().project;
    const lang = project.previewLang;
    const source = project.sourceLang;
    get().patchScene(
      sceneId,
      (s) => {
        const cue = s.cues.find((c) => c.id === cueId);
        if (!cue) return s;
        const next = applyResolvedCueRange(s, cue, at, until, lang, source, project);
        return { ...s, cues: ensureCues(s.cues).map((c) => (c.id === cueId ? next : c)) };
      },
      false,
    );
  },
  setCueBind: (sceneId, cueId, bind) => {
    const project = get().project;
    get().patchScene(
      sceneId,
      (s) => {
        const cue = s.cues.find((c) => c.id === cueId);
        if (!cue) return s;
        const next = bakeCueBind(s, cue, bind, project.previewLang, project.sourceLang, project);
        return { ...s, cues: s.cues.map((c) => (c.id === cueId ? next : c)) };
      },
      true,
    );
  },
  patchCue: (sceneId, cueId, patch) => {
    get().patchScene(
      sceneId,
      (s) => ({
        ...s,
        cues: s.cues.map((c) => (c.id === cueId ? { ...c, ...patch } : c)),
      }),
      true,
    );
  },
  setCueAnim: (sceneId, cueId, anim) => {
    get().patchScene(
      sceneId,
      (s) => ({ ...s, cues: s.cues.map((c) => (c.id === cueId ? { ...c, anim } : c)) }),
      true,
    );
  },
  addBlock: (sceneId, type) => {
    const block = makeBlock(type);
    get().patchScene(
      sceneId,
      (s) => {
        const blocks = [...sceneBlocks(s), block];
        return {
          ...s,
          blocks,
          cues: defaultCues(s.layoutId, s.slots.items, blocks),
        };
      },
      true,
    );
    set({ selectedBlockId: block.id });
  },
  patchBlock: (sceneId, blockId, patch) => {
    get().patchScene(
      sceneId,
      (s) => {
        const blocks = s.blocks?.length ? s.blocks : presetBlocks(s.layoutId);
        return {
          ...s,
          blocks: blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
        };
      },
      false,
    );
  },
  removeBlock: (sceneId, blockId) => {
    get().patchScene(
      sceneId,
      (s) => {
        const blocks = sceneBlocks(s).filter((b) => b.id !== blockId);
        const speak = { ...s.speak };
        delete speak[blockId];
        return {
          ...s,
          blocks,
          speak,
          cues: (s.cues ?? []).filter((c) => c.target !== blockId),
        };
      },
      true,
    );
    if (get().selectedBlockId === blockId) set({ selectedBlockId: null });
  },
  setTtsProvider: (provider) => {
    get().updateProject({ ttsProvider: provider }, false);
  },
  addVoice: (voice) => {
    const project = get().project;
    get().updateProject({ voices: [...(project.voices ?? []), voice] }, true);
  },
  updateVoice: (id, patch) => {
    const voices = (get().project.voices ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v));
    get().updateProject({ voices }, false);
  },
  removeVoice: (id) => {
    const project = get().project;
    const voices = (project.voices ?? []).filter((v) => v.id !== id);
    const voiceByLang = { ...project.voiceByLang };
    for (const lang of Object.keys(voiceByLang) as (keyof typeof voiceByLang)[]) {
      if (voiceByLang[lang] === id) delete voiceByLang[lang];
    }
    get().updateProject({ voices, voiceByLang }, true);
  },
  applyI18nRow: (row, lang, value, history = false) => {
    const source = get().project.sourceLang;
    if (history) get().commit();
    const project = {
      ...get().project,
      scenes: get().project.scenes.map((s) => {
        if (s.id !== row.sceneId) return s;
        const latest = collectI18nRows({ ...get().project, scenes: [s] }).find(
          (r) => r.kind === row.kind && r.itemId === row.itemId && r.speakKey === row.speakKey,
        );
        const i18n = writeI18n(latest?.i18n ?? row.i18n, lang, source, value);
        const next = patchSceneI18n(s, row, i18n);
        if ((row.kind === "narration" || row.kind === "narrationClose" || row.kind === "speak") && next.audioByLang?.[lang]) {
          return { ...markLangAudioStale(next, lang), cues: ensureCuesFromBeats(next, lang, source) };
        }
        if (row.kind === "speak") return { ...next, cues: ensureCuesFromBeats(next, lang, source) };
        return next;
      }),
    };
    set({ project });
    persist(project, get().currentSceneId);
  },
  markAudio: (sceneId, lang, audio) => {
    const source = get().project.sourceLang;
    get().patchScene(
      sceneId,
      (s) => ({
        ...s,
        audioByLang: { ...s.audioByLang, [lang]: audio },
        cues: ensureCuesFromBeats(s, lang, source),
      }),
      false,
    );
  },
}));

export function tryRestoreAutosave(): boolean {
  const data = loadAutosave();
  if (!data) return false;
  useEditor.getState().replaceProject(data.project, data.currentSceneId);
  return true;
}
