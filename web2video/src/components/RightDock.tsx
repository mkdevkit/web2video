import { Sparkles } from "lucide-react";
import { Inspector } from "./Inspector";
import { AiChatPanel } from "./AiChatPanel";
import { useEditor } from "../store/useEditor";

export function RightDock() {
  const tab = useEditor((s) => s.rightTab);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-ink-600 bg-ink-900">
      <div className="flex shrink-0 border-b border-ink-600">
        <button
          className={`flex-1 px-2 py-1.5 text-[11px] ${tab === "inspector" ? "bg-ink-800 text-paper" : "text-ink-400 hover:text-ink-200"}`}
          onClick={() => useEditor.getState().setRightTab("inspector")}
        >
          属性
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] ${tab === "ai" ? "bg-ink-800 text-paper" : "text-ink-400 hover:text-ink-200"}`}
          onClick={() => useEditor.getState().setRightTab("ai")}
        >
          <Sparkles className="h-3 w-3" />
          AI
        </button>
      </div>
      <div className={`min-h-0 flex-1 overflow-auto p-3 ${tab === "inspector" ? "" : "hidden"}`}>
        <Inspector />
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${tab === "ai" ? "" : "hidden"}`}>
        <AiChatPanel />
      </div>
    </aside>
  );
}
