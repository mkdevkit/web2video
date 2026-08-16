import { Hash, Image, List, MessageSquare, Quote, Square, Type, User } from "lucide-react";
import { sceneBlocks } from "../lib/blocks";
import { blockNameOf, itemText, sourceLangOf, textOf } from "../lib/textI18n";
import { itemSpeakKey, speakText } from "../lib/narration";
import type { LangId } from "../lib/langs";
import { BLOCK_TYPES, type BlockType, type LayoutBlock, type Scene } from "../types";
import { useEditor } from "../store/useEditor";

const TYPE_ICON: Record<BlockType, typeof Type> = {
  title: Type,
  subtitle: Type,
  body: Type,
  caption: Type,
  quote: Quote,
  author: User,
  number: Hash,
  list: List,
  dialogue: MessageSquare,
  image: Image,
  shape: Square,
};

function typeLabel(type: BlockType) {
  return BLOCK_TYPES.find((b) => b.type === type)?.label ?? type;
}

function previewOf(scene: Scene, block: LayoutBlock, lang: LangId, source: LangId) {
  if (block.type === "image") return "配图";
  if (block.type === "shape") return "色块";
  if (block.type === "list") return `${scene.slots.items?.length ?? 0} 项`;
  if (block.type === "dialogue") return `${scene.slots.dialogue?.length ?? 0} 句`;
  const key = block.type as "title" | "subtitle" | "body" | "caption" | "quote" | "author" | "number";
  const text = textOf(scene.slots[key], lang, source);
  return text.replace(/\s+/g, " ").trim() || typeLabel(block.type);
}

export function OutlinePanel() {
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const selectedCueId = useEditor((s) => s.selectedCueId);
  const scene = project.scenes.find((s) => s.id === currentSceneId);
  const lang = project.previewLang;
  const source = sourceLangOf(project);

  if (!scene) {
    return (
      <div className="flex min-h-0 flex-[2] flex-col border-t border-ink-600">
        <div className="section-label mb-0 px-3 py-2">检视</div>
      </div>
    );
  }

  const blocks = sceneBlocks(scene);
  const sceneSelected = !selectedBlockId;

  const selectScene = () => useEditor.getState().setSelectedBlock(null);
  const selectBlock = (id: string, cueId?: string | null) => {
    useEditor.getState().setSelectedBlock(id);
    if (cueId) useEditor.getState().setSelectedCue(cueId);
  };

  return (
    <div className="flex min-h-0 flex-[2] flex-col border-t border-ink-600">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="section-label mb-0">检视</div>
        <span className="text-[10px] text-ink-400">{blocks.length} 个元件</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <button
          className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] ${
            sceneSelected ? "border-brass/50 bg-copper/15 text-paper" : "border-transparent text-ink-200 hover:bg-ink-800"
          }`}
          onClick={selectScene}
        >
          <span className="truncate font-medium">{scene.name || "当前场景"}</span>
        </button>
        {blocks.map((block) => {
          const Icon = TYPE_ICON[block.type];
          const active = selectedBlockId === block.id;
          const items =
            block.type === "list" ? (scene.slots.items ?? []) : block.type === "dialogue" ? (scene.slots.dialogue ?? []) : [];
          return (
            <div key={block.id} className="mb-0.5">
              <button
                className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left ${
                  active ? "border-brass/50 bg-copper/15" : "border-transparent hover:bg-ink-800"
                }`}
                onClick={() => selectBlock(block.id)}
              >
                <Icon className="h-3 w-3 shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-paper">
                    {blockNameOf(block, lang, source) || typeLabel(block.type)}
                    {speakText(scene, block.id, lang, source).trim() ? " ·口" : ""}
                  </span>
                  <span className="block truncate text-[10px] text-ink-400">{previewOf(scene, block, lang, source)}</span>
                </span>
              </button>
              {items.map((it, i) => {
                const cue = scene.cues.find((c) => c.target === `item:${it.id}`);
                const itemActive = active && selectedCueId === cue?.id;
                return (
                  <button
                    key={it.id}
                    className={`ml-4 mt-0.5 flex w-[calc(100%-1rem)] items-center gap-1.5 rounded-md border px-2 py-1 text-left ${
                      itemActive ? "border-brass/40 bg-copper/10" : "border-transparent hover:bg-ink-800"
                    }`}
                    onClick={() => selectBlock(block.id, cue?.id ?? null)}
                  >
                    <span className="w-3 shrink-0 text-center text-[10px] text-ink-400">{i + 1}</span>
                    <span className="truncate text-[11px] text-ink-200">
                      {block.type === "dialogue"
                        ? `${"name" in it && it.name ? `${it.name} · ` : ""}${itemText(it, lang, source) || `对白 ${i + 1}`}`
                        : itemText(it, lang, source) || `条目 ${i + 1}`}
                      {speakText(scene, itemSpeakKey(it.id), lang, source).trim() ? " ·口" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {blocks.length === 0 && <p className="px-1 py-2 text-[11px] text-ink-400">本场还没有元件</p>}
      </div>
    </div>
  );
}
