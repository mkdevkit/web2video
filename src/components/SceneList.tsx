import { Copy, Plus, Trash2 } from "lucide-react";
import { sceneDuration, formatMs } from "../lib/timeline";
import { LAYOUTS } from "../types";
import { useEditor } from "../store/useEditor";

export function SceneList() {
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const lang = project.previewLang;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-ink-600 bg-ink-900">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="section-label mb-0">场景</div>
        <button className="btn px-1.5 py-1" onClick={() => useEditor.getState().addScene("cover")} title="添加场景">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {project.scenes.map((scene, i) => {
          const active = scene.id === currentSceneId;
          const stale = scene.audioByLang?.[lang]?.stale;
          const hasAudio = Boolean(scene.audioByLang?.[lang] && !stale);
          return (
            <button
              key={scene.id}
              className={`mb-1 w-full rounded-lg border px-2 py-2 text-left transition ${active ? "border-brass/50 bg-copper/15" : "border-transparent bg-ink-800 hover:bg-ink-700"}`}
              onClick={() => useEditor.getState().setCurrentScene(scene.id)}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium text-paper">
                  {i + 1}. {scene.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink-400">{formatMs(sceneDuration(scene, lang))}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-ink-400">
                <span>{LAYOUTS.find((l) => l.id === scene.layoutId)?.label}</span>
                <span className={hasAudio ? "text-brass" : stale ? "text-copper" : ""}>
                  {hasAudio ? "已配音" : stale ? "需重合成" : "无配音"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-1 border-t border-ink-600 p-2">
        <button className="btn flex-1" onClick={() => useEditor.getState().duplicateScene()}>
          <Copy className="h-3 w-3" /> 复制
        </button>
        <button
          className="btn flex-1"
          disabled={project.scenes.length <= 1}
          onClick={() => useEditor.getState().removeScene(currentSceneId)}
        >
          <Trash2 className="h-3 w-3" /> 删除
        </button>
      </div>
    </aside>
  );
}
