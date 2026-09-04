import { collectVisualRows, sourceLangOf, sourceTextOf } from "../lib/textI18n";
import type { Scene } from "../types";
import { useEditor } from "../store/useEditor";

export function VisualTextEditor({ scene }: { scene: Scene }) {
  const project = useEditor((s) => s.project);
  const source = sourceLangOf(project);
  const preview = project.previewLang;
  const rows = collectVisualRows(project, scene.id);
  const missing =
    preview !== source ? rows.filter((r) => sourceTextOf(r, source).trim() && !r.i18n[preview]?.trim()).length : 0;

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-ink-300">
        {rows.length} 条画面文案
        {missing ? ` · 预览语言缺 ${missing} 条` : ""}
      </p>
      <button className="btn w-full" onClick={() => useEditor.getState().setDialog("texts")}>
        编辑文本
      </button>
      <p className="text-[10px] leading-relaxed text-ink-400">
        舞台上的标题、列表、对白等，和口播分开翻译。预览语言与导出语言走顶栏；机翻请校对。
      </p>
    </div>
  );
}
