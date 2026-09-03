import { STAGE_FONTS, asCssHex, fontOf, fontStack, stageCssOf, stageThemeOf } from "../lib/stage";
import { useStudio } from "../store/useStudio";
import type { StageFontId, StageTheme } from "../types";

export function StageDialog() {
  const project = useStudio((s) => s.project);
  const patchProject = useStudio((s) => s.patchProject);
  const setDialog = useStudio((s) => s.setDialog);
  const theme = stageThemeOf(project.stageTheme);

  const patchTheme = (patch: Partial<StageTheme>) => {
    patchProject({ stageTheme: stageThemeOf({ ...theme, ...patch }) });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-ink-600 bg-ink-900 p-4">
        <h2 className="mb-1 text-lg font-medium">舞台外观</h2>
        <p className="mb-3 text-xs leading-relaxed text-ink-400">
          画幅、底色、字体和这段 CSS 是<strong className="font-medium text-ink-200">整个工程共用</strong>
          。字体均为 <strong className="font-medium text-ink-200">SIL OFL</strong>，免费可商用。中日文不足的字体会回落到 Noto Sans / Serif CJK。样式里可用{" "}
          <code className="text-brass">var(--stage-color)</code>、<code className="text-brass">var(--stage-accent)</code>、
          <code className="text-brass">var(--stage-w)</code>。
        </p>
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
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-400">
            正文字体
            <select
              className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
              value={theme.fontId}
              onChange={(e) => patchTheme({ fontId: e.target.value as StageFontId })}
            >
              {STAGE_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} · {f.langs}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-ink-400">
              {fontOf(theme.fontId).hint} · {fontOf(theme.fontId).license}
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
                <option key={f.id} value={f.id}>
                  {f.label} · {f.langs}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-ink-400">
              {fontOf(theme.titleFontId).hint} · {fontOf(theme.titleFontId).license}
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
                <option key={f.id} value={f.id}>
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
        <label className="mb-3 block text-xs text-ink-400">
          全局 CSS
          <textarea
            className="mt-1 h-44 w-full resize-y rounded border border-ink-600 bg-ink-800 p-2 font-mono text-xs leading-5"
            value={stageCssOf(project)}
            onChange={(e) => patchProject({ stageCss: e.target.value })}
            spellCheck={false}
          />
        </label>
        <div className="flex justify-end">
          <button className="rounded border border-copper px-3 py-1 text-sm" onClick={() => setDialog(null)}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
