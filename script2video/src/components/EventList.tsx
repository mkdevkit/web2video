import { useStudio } from "../store/useStudio";
import type { TimeBind } from "../types";

export function EventList() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const script = project.scripts.find((s) => s.id === scriptId);
  const addEvent = useStudio((s) => s.addEvent);
  const patchEvent = useStudio((s) => s.patchEvent);
  const removeEvent = useStudio((s) => s.removeEvent);

  if (!script) return null;

  return (
    <section className="border-t border-ink-700 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-medium">画面事件</h2>
        <button className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper" onClick={() => addEvent(script.id)}>
          加事件
        </button>
        <span className="text-xs text-ink-400">speech 跟口播 0–1；fixed 固定毫秒入场</span>
      </div>
      <div className="space-y-2">
        {script.events.map((ev) => (
          <div key={ev.id} className="grid grid-cols-6 items-center gap-2 text-xs">
            <input
              className="rounded border border-ink-600 bg-ink-800 px-1 py-1"
              value={ev.label}
              onChange={(e) => patchEvent(script.id, ev.id, { label: e.target.value })}
            />
            <select
              className="rounded border border-ink-600 bg-ink-800 px-1 py-1"
              value={ev.bind}
              onChange={(e) => patchEvent(script.id, ev.id, { bind: e.target.value as TimeBind })}
            >
              <option value="speech">speech</option>
              <option value="fixed">fixed</option>
            </select>
            <select
              className="rounded border border-ink-600 bg-ink-800 px-1 py-1"
              value={ev.beatId}
              onChange={(e) => patchEvent(script.id, ev.id, { beatId: e.target.value })}
            >
              {script.beats.map((b, i) => (
                <option key={b.id} value={b.id}>
                  {i + 1}. {b.id}
                </option>
              ))}
            </select>
            {ev.bind === "speech" ? (
              <>
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  className="rounded border border-ink-600 bg-ink-800 px-1 py-1"
                  value={ev.at}
                  onChange={(e) => patchEvent(script.id, ev.id, { at: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  className="rounded border border-ink-600 bg-ink-800 px-1 py-1"
                  value={ev.until ?? 1}
                  onChange={(e) => patchEvent(script.id, ev.id, { until: Number(e.target.value) })}
                />
              </>
            ) : (
              <input
                type="number"
                className="col-span-2 rounded border border-ink-600 bg-ink-800 px-1 py-1"
                value={ev.durationMs ?? 400}
                onChange={(e) => patchEvent(script.id, ev.id, { durationMs: Number(e.target.value) })}
              />
            )}
            <button className="text-ink-400 hover:text-copper" onClick={() => removeEvent(script.id, ev.id)}>
              删
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
