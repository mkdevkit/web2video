import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Hash, Image, List, MessageSquare, Plus, Quote, Square, Type, User } from "lucide-react";
import { BLOCK_TYPES, type BlockType } from "../types";
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

export function AddBlockMenu() {
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const add = (type: BlockType) => {
    if (!currentSceneId) return;
    useEditor.getState().addBlock(currentSceneId, type);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        className="btn shrink-0"
        disabled={!currentSceneId}
        title="添加元件"
        onClick={toggle}
      >
        <Plus className="h-3.5 w-3.5" />
        元件
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] w-44 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 py-1 shadow-paper"
            style={{ top: pos.top, left: pos.left }}
          >
            {BLOCK_TYPES.map((b) => {
              const Icon = TYPE_ICON[b.type];
              return (
                <button
                  key={b.type}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-ink-100 hover:bg-ink-700"
                  onClick={() => add(b.type)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  {b.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
