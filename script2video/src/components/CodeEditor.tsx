import { useStudio } from "../store/useStudio";
import { ENGINES, engineMeta, engineOf, sourceOf, usesGsapPreview } from "../lib/engines";
import type { EngineId } from "../types";
import { driveOf } from "../lib/beats";

export function CodeEditor() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const patchScript = useStudio((s) => s.patchScript);
  const patchScriptSource = useStudio((s) => s.patchScriptSource);
  const setScriptEngine = useStudio((s) => s.setScriptEngine);
  const setTab = useStudio((s) => s.setTab);
  const setDialog = useStudio((s) => s.setDialog);
  const script = project.scripts.find((s) => s.id === scriptId);

  if (!script) return null;

  const engine = engineOf(script);
  const meta = engineMeta(engine);
  const htmlEngine = usesGsapPreview(script);
  const source = sourceOf(script);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-ink-400">工具</span>
        {ENGINES.map((eng) => (
          <button
            key={eng.id}
            type="button"
            className={`rounded border px-2 py-0.5 text-xs ${engine === eng.id ? "border-copper bg-ink-800" : "border-ink-600 text-ink-400"}`}
            onClick={() => setScriptEngine(script.id, eng.id as EngineId)}
          >
            {eng.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-1 text-xs text-ink-400 underline decoration-ink-600 hover:text-brass"
          onClick={() => setTab("usage")}
        >
          用法
        </button>
      </div>
      <p className="mb-2 text-xs leading-relaxed text-ink-400">
        {htmlEngine ? (
          <>
            动画代码用口播 id 取时长：<code className="text-brass">speech.s("hook")</code> 是这一句的总秒数，
            <code className="text-brass">speech.holdS("hook", 0.48)</code> 是入场后还要停多久。
            {driveOf(script) === "script" ? (
              <>
                当前是<strong>脚本驱动</strong>：用 <code className="text-brass">speech.play("hook")</code>{" "}
                排期（返回开始秒）。不要 <code className="text-brass">timeline.play()</code>。
              </>
            ) : (
              <>
                当前是<strong>口播驱动</strong>：用 <code className="text-brass">speech.startS("hook")</code>
                ，句间留白用口播表延时行。
              </>
            )}{" "}
            全片 <code className="text-brass">speech.totalS()</code>。不要写死 3 秒。
          </>
        ) : (
          <>
            这段是 {meta.label} 源码草稿。时长仍跟口播走；工作台预览/导出走节拍卡。完整画面在 {meta.label}{" "}
            里渲染该段，再按脚本列表顺序拼进成片。
          </>
        )}
      </p>
      {htmlEngine && (
        <>
          <label className="mb-1 flex items-baseline justify-between text-xs text-ink-400">
            <span>本脚本舞台 HTML（DOM，不是 canvas）</span>
            <button type="button" className="underline decoration-ink-600 hover:text-brass" onClick={() => setDialog("stage")}>
              外观：字体 / 舞台 CSS
            </button>
          </label>
          <textarea
            className="mb-3 h-24 resize-y rounded border border-ink-600 bg-ink-800 p-2 font-mono text-xs"
            value={script.stageHtml ?? ""}
            onChange={(e) => patchScript(script.id, { stageHtml: e.target.value })}
            spellCheck={false}
          />
        </>
      )}
      <label className="mb-1 text-xs text-ink-400">
        {meta.label}
        {htmlEngine ? "（paused timeline，由预览 seek）" : ` · ${meta.hint}`}
      </label>
      <textarea
        className="min-h-0 flex-1 resize-none rounded border border-ink-600 bg-ink-800 p-3 font-mono text-xs leading-5"
        value={source}
        onChange={(e) => patchScriptSource(script.id, e.target.value)}
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const next = `${el.value.slice(0, start)}  ${el.value.slice(end)}`;
          patchScriptSource(script.id, next);
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = start + 2;
          });
        }}
      />
    </section>
  );
}
