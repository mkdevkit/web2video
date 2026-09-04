import { useState } from "react";
import { STAGE_FONTS, asCssHex, fontOf, fontStack, stageCssOf, stageThemeOf } from "../lib/stage";
import { useStudio } from "../store/useStudio";
import type { StageFontId, StageTheme } from "../types";
import { FontUsageGuide } from "./FontUsageGuide";

export function StageDialog() {
  const project = useStudio((s) => s.project);
  const patchProject = useStudio((s) => s.patchProject);
  const setDialog = useStudio((s) => s.setDialog);
  const theme = stageThemeOf(project.stageTheme);
  const [tab, setTab] = useState<"fonts" | "stage">("fonts");

  const patchTheme = (patch: Partial<StageTheme>) => {
    patchProject({ stageTheme: stageThemeOf({ ...theme, ...patch }) });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-ink-600 bg-ink-900 p-4">
        <h2 className="mb-1 text-lg font-medium">舞台外观</h2>
        <div className="-mx-4 mb-3 flex border-b border-ink-700">
          <button
            type="button"
            className={`px-4 py-2 text-[12px] ${tab === "fonts" ? "border-b-2 border-brass text-paper" : "text-ink-400 hover:text-ink-200"}`}
            onClick={() => setTab("fonts")}
          >
            字体
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-[12px] ${tab === "stage" ? "border-b-2 border-brass text-paper" : "text-ink-400 hover:text-ink-200"}`}
            onClick={() => setTab("stage")}
          >
            舞台
          </button>
        </div>
        {tab === "fonts" ? (
          <>
            <p className="mb-3 text-xs leading-relaxed text-ink-400">
              这些字体是<strong className="font-medium text-ink-200">整个工程共用</strong>
              。均为 <strong className="font-medium text-ink-200">SIL OFL</strong>，免费可商用，字文件随工具打包。中日文不足的字体会回落到 Noto
              Sans / Serif CJK。
            </p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-ink-400">
                默认舞台字体
                <select
                  className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                  value={theme.baseFontId}
                  onChange={(e) => patchTheme({ baseFontId: e.target.value as StageFontId })}
                >
                  {STAGE_FONTS.map((f) => (
                    <option key={f.id} value={f.id} title={f.detail}>
                      {f.label} · {f.langs}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-ink-400">
                  HTML 没写 font-family 时整台用它。{fontOf(theme.baseFontId).hint} · {fontOf(theme.baseFontId).license}
                </span>
              </label>
              <label className="text-xs text-ink-400">
                正文字体
                <select
                  className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                  value={theme.fontId}
                  onChange={(e) => patchTheme({ fontId: e.target.value as StageFontId })}
                >
                  {STAGE_FONTS.map((f) => (
                    <option key={f.id} value={f.id} title={f.detail}>
                      {f.label} · {f.langs}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-ink-400">
                  CSS 里 var(--stage-font)，默认 .stat。{fontOf(theme.fontId).hint} · {fontOf(theme.fontId).license}
                </span>
              </label>
              <label className="text-xs text-ink-400">
                标题字体
                <select
                  className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                  value={theme.titleFontId}
                  onChange={(e) => patchTheme({ titleFontId: e.target.value as StageFontId })}
                >
                  {STAGE_FONTS.map((f) => (
                    <option key={f.id} value={f.id} title={f.detail}>
                      {f.label} · {f.langs}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-ink-400">
                  要大标题时在 CSS 里写 var(--stage-title-font)。{fontOf(theme.titleFontId).hint} · {fontOf(theme.titleFontId).license}
                </span>
              </label>
              <label className="text-xs text-ink-400">
                字幕字体
                <select
                  className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                  value={theme.captionFontId}
                  onChange={(e) => patchTheme({ captionFontId: e.target.value as StageFontId })}
                >
                  {STAGE_FONTS.map((f) => (
                    <option key={f.id} value={f.id} title={f.detail}>
                      {f.label} · {f.langs}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-ink-400">
                  {fontOf(theme.captionFontId).hint} · {fontOf(theme.captionFontId).license}
                </span>
              </label>
            </div>
            <p
              className="mb-3 rounded-lg bg-black/70 px-3 py-2 text-center text-sm text-paper"
              style={{ fontFamily: fontStack(theme.captionFontId, project.previewLang) }}
            >
              字幕预览：黑洞并不是宇宙里的一个洞。
            </p>
            <FontUsageGuide />
          </>
        ) : (
          <>
            <p className="mb-3 text-xs leading-relaxed text-ink-400">
              画幅在顶栏。底色、字色、强调色和这段 CSS 是<strong className="font-medium text-ink-200">整个工程共用</strong>
              ，所有脚本的舞台 HTML 都套这一份。
            </p>
            <div className="mb-3 space-y-2 rounded border border-ink-700 bg-ink-950/60 px-3 py-2 text-[11px] leading-relaxed text-ink-300">
              <p>
                <strong className="font-medium text-ink-200">默认舞台字体</strong>
                套在舞台根上。HTML / CSS 不写 <code className="text-brass">font-family</code>{" "}
                时整台字都用它。变量是 <code className="text-brass">var(--stage-base-font)</code>
                。旧工程没这项时跟正文字体。
              </p>
              <p>
                <strong className="font-medium text-ink-200">正文字体</strong>是{" "}
                <code className="text-brass">var(--stage-font)</code>
                ，默认 CSS 里 <code className="text-brass">.stat</code> 用它。
                <strong className="font-medium text-ink-200"> 标题字体</strong>不会自动认标题。默认{" "}
                <code className="text-brass">.title</code> 用 <code className="text-brass">var(--stage-title-font)</code>
                。自己的节点要当标题，加 class 或写这句变量。字幕字体只管口播字幕条。
              </p>
              <p>
                还可用 <code className="text-brass">var(--stage-color)</code>、
                <code className="text-brass">var(--stage-accent)</code>、
                <code className="text-brass">var(--stage-w)</code>（舞台宽度，字号按它缩放，预览和导出才一致）。
                成片要免费可商用：不要写 Arial、微软雅黑、PingFang、<code className="text-brass">system-ui</code>、
                <code className="text-brass">sans-serif</code>，用上面的变量或外观里选的 SIL OFL。
              </p>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <label className="text-xs text-ink-400">
                底色
                <input
                  className="mt-1 h-8 w-full cursor-pointer rounded border border-ink-600 bg-ink-800"
                  type="color"
                  value={theme.bg}
                  onChange={(e) => patchTheme({ bg: asCssHex(e.target.value, theme.bg) })}
                />
              </label>
              <label className="text-xs text-ink-400">
                字色
                <input
                  className="mt-1 h-8 w-full cursor-pointer rounded border border-ink-600 bg-ink-800"
                  type="color"
                  value={theme.color}
                  onChange={(e) => patchTheme({ color: asCssHex(e.target.value, theme.color) })}
                />
              </label>
              <label className="text-xs text-ink-400">
                强调色
                <input
                  className="mt-1 h-8 w-full cursor-pointer rounded border border-ink-600 bg-ink-800"
                  type="color"
                  value={theme.accent}
                  onChange={(e) => patchTheme({ accent: asCssHex(e.target.value, theme.accent) })}
                />
              </label>
            </div>
            <label className="mb-3 block text-xs text-ink-400">
              全局 CSS
              <textarea
                className="mt-1 h-44 w-full resize-y rounded border border-ink-600 bg-ink-800 p-2 font-mono text-xs leading-5"
                value={stageCssOf(project)}
                onChange={(e) => patchProject({ stageCss: e.target.value })}
                spellCheck={false}
              />
            </label>
          </>
        )}
        <div className="mt-3 flex justify-end">
          <button className="rounded border border-copper px-3 py-1 text-sm" onClick={() => setDialog(null)}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
