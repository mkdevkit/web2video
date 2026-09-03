import { useStudio } from "../store/useStudio";
import { engineMeta, engineOf } from "../lib/engines";

export function ScriptList() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const selectScript = useStudio((s) => s.selectScript);
  const addScript = useStudio((s) => s.addScript);
  const removeScript = useStudio((s) => s.removeScript);
  const moveScript = useStudio((s) => s.moveScript);
  const patchScript = useStudio((s) => s.patchScript);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wider text-ink-400">
        脚本（导出顺序）
        <button className="rounded border border-ink-600 px-1.5 py-0.5 text-ink-100 hover:border-copper" onClick={addScript}>
          +
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {project.scripts.map((s, i) => (
          <li key={s.id} className={`mb-1 rounded px-2 py-1.5 ${s.id === scriptId ? "bg-ink-700" : "hover:bg-ink-800"}`}>
            <button className="w-full text-left text-sm" onClick={() => selectScript(s.id)}>
              <input
                className="w-full bg-transparent"
                value={s.name}
                onChange={(e) => patchScript(s.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-[11px] text-ink-400">
                {i + 1} · {engineMeta(engineOf(s)).label} · {s.beats.length} 句
              </span>
            </button>
            <div className="mt-1 flex gap-1 text-[11px]">
              <button
                className="text-ink-400 hover:text-ink-100 disabled:opacity-30"
                disabled={i === 0}
                onClick={() => moveScript(s.id, -1)}
              >
                上移
              </button>
              <button
                className="text-ink-400 hover:text-ink-100 disabled:opacity-30"
                disabled={i === project.scripts.length - 1}
                onClick={() => moveScript(s.id, 1)}
              >
                下移
              </button>
              {project.scripts.length > 1 && (
                <button className="ml-auto text-ink-400 hover:text-copper" onClick={() => removeScript(s.id)}>
                  删除
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
