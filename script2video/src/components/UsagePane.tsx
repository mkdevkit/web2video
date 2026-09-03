import { useEffect, useState } from "react";
import { useStudio } from "../store/useStudio";
import { CLOCK_LAYERS, DONT, ENGINE_GUIDES, EXTRA_GUIDES, MANIM_INSTEAD, SCRIPT_DRIVE_EXAMPLE, SPEECH_API, TS_ENGINE_IDS } from "../lib/engineGuide";
import { ENGINES, engineOf } from "../lib/engines";
import type { EngineId } from "../types";

function CopyBlock({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-auto rounded border border-ink-600 bg-ink-800 p-3 font-mono text-xs leading-5">{text}</pre>
      <button
        type="button"
        className="absolute right-2 top-2 rounded border border-ink-600 bg-ink-900 px-1.5 py-0.5 text-[11px] text-ink-400 hover:border-copper"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setOk(true);
            window.setTimeout(() => setOk(false), 1200);
          });
        }}
      >
        {ok ? "已复制" : "复制"}
      </button>
    </div>
  );
}

export function UsagePane() {
  const project = useStudio((s) => s.project);
  const scriptId = useStudio((s) => s.scriptId);
  const script = project.scripts.find((s) => s.id === scriptId);
  const current = script ? engineOf(script) : "gsap";
  const [focus, setFocus] = useState<EngineId>(current);
  const [extraId, setExtraId] = useState<(typeof EXTRA_GUIDES)[number]["id"]>("katex");
  const guide = ENGINE_GUIDES[focus];
  const extra = EXTRA_GUIDES.find((e) => e.id === extraId) ?? EXTRA_GUIDES[0];

  useEffect(() => {
    setFocus(current);
  }, [current, scriptId]);

  return (
    <section className="min-h-0 flex-1 overflow-auto p-4 text-sm">
      <h2 className="mb-1 text-base font-medium">用法</h2>
      <p className="mb-4 text-xs leading-relaxed text-ink-400">
        画面跟<strong className="font-medium text-ink-200">口播节拍</strong>走，不要写死秒数。口播页可选
        <strong className="font-medium text-ink-200"> 口播驱动</strong>（列表顺序 + 延时行）或
        <strong className="font-medium text-ink-200"> 脚本驱动</strong>（<code className="text-brass">speech.play</code>）。
        当前脚本：
        {script ? ` ${script.name} · ${ENGINE_GUIDES[current].label}` : " 无"}
      </p>

      <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-400">怎么取口播时长</h3>
      <div className="mb-3 overflow-auto rounded border border-ink-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-ink-800 text-ink-400">
              <th className="px-2 py-1.5 text-left font-medium">层</th>
              <th className="px-2 py-1.5 text-left font-medium">存什么</th>
              <th className="px-2 py-1.5 text-left font-medium">随语言变</th>
            </tr>
          </thead>
          <tbody>
            {CLOCK_LAYERS.map((row) => (
              <tr key={row.layer} className="border-t border-ink-700">
                <td className="px-2 py-1.5">{row.layer}</td>
                <td className="px-2 py-1.5 text-ink-300">{row.store}</td>
                <td className="px-2 py-1.5">{row.varies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-4 overflow-auto rounded border border-ink-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-ink-800 text-ink-400">
              <th className="px-2 py-1.5 text-left font-medium">API</th>
              <th className="px-2 py-1.5 text-left font-medium">含义</th>
            </tr>
          </thead>
          <tbody>
            {SPEECH_API.map((row) => (
              <tr key={row.name} className="border-t border-ink-700">
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-brass">{row.name}</td>
                <td className="px-2 py-1.5 text-ink-300">{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-2 text-xs text-ink-400">
        入场用固定秒（各语言一样快）；<strong className="font-medium text-ink-200">这一段总时长 = speech.s(id)</strong>
        。多出来的时间用 hold 停住。右侧预览表列出每个 id 的秒数。字体说明在顶栏「外观 → 字体」。
      </p>
      <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-400">脚本驱动：speech.play</h3>
      <p className="mb-2 text-xs text-ink-400">
        口播页切到「脚本驱动」后，列表只是台词库。必须 <code className="text-brass">speech.play("hook")</code>{" "}
        才会出声；返回值当 GSAP position。不要调用 <code className="text-brass">timeline.play()</code>。
      </p>
      <div className="mb-4">
        <CopyBlock text={SCRIPT_DRIVE_EXAMPLE} />
      </div>

      <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-400">各工具怎么写</h3>
      <div className="mb-3 flex flex-wrap gap-1">
        {ENGINES.map((eng) => (
          <button
            key={eng.id}
            type="button"
            className={`rounded border px-2 py-0.5 text-xs ${focus === eng.id ? "border-copper bg-ink-800" : "border-ink-600 text-ink-400"}`}
            onClick={() => setFocus(eng.id)}
          >
            {eng.label}
            {current === eng.id ? " · 当前" : ""}
          </button>
        ))}
      </div>
      <div className="mb-4 rounded-xl border border-ink-700 bg-ink-900 p-3">
        <h4 className="mb-1 font-medium">{guide.label}</h4>
        <p className="mb-2 text-xs leading-relaxed text-ink-400">{guide.summary}</p>
        <p className="mb-2 text-xs leading-relaxed">
          <span className="text-ink-400">取时长：</span>
          {guide.duration}
        </p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-ink-300">
          {guide.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mb-1 text-xs text-ink-400">{guide.exampleTitle}</p>
        <CopyBlock text={guide.example} />
      </div>

      <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-400">KaTeX / Three.js（不是独立工具）</h3>
      <p className="mb-2 text-xs leading-relaxed text-ink-400">
        只给 TypeScript 工具用：GSAP、HyperFrames、Remotion。在脚本页仍选这三个之一，公式和三维写在该脚本源码里。
        {focus === "manim" ? ` ${MANIM_INSTEAD}` : ""}
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {EXTRA_GUIDES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded border px-2 py-0.5 text-xs ${extraId === item.id ? "border-copper bg-ink-800" : "border-ink-600 text-ink-400"}`}
            onClick={() => setExtraId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 rounded-xl border border-ink-700 bg-ink-900 p-3">
        <h4 className="mb-1 font-medium">
          {extra.label}
          <span className="ml-2 text-xs font-normal text-ink-400">
            {TS_ENGINE_IDS.map((id) => ENGINE_GUIDES[id].label).join(" · ")}
          </span>
        </h4>
        <p className="mb-2 text-xs leading-relaxed text-ink-400">{extra.summary}</p>
        <p className="mb-2 text-xs leading-relaxed">
          <span className="text-ink-400">取时长：</span>
          {extra.duration}
        </p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-ink-300">
          {extra.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mb-1 text-xs text-ink-400">{extra.htmlTitle}</p>
        <CopyBlock text={extra.html} />
        <p className="mb-1 mt-3 text-xs text-ink-400">{extra.remotionTitle}</p>
        <CopyBlock text={extra.remotion} />
      </div>

      <h3 className="mb-2 text-xs uppercase tracking-wider text-ink-400">不要做的</h3>
      <ul className="mb-6 list-disc space-y-1 pl-5 text-xs text-ink-300">
        {DONT.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
