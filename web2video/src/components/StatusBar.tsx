import { formatMs, totalDuration } from "../lib/timeline";
import { langZhName } from "../lib/langs";
import { isTauri } from "../lib/platform";
import { useEditor } from "../store/useEditor";

export function StatusBar() {
  const project = useEditor((s) => s.project);
  const dir = useEditor((s) => s.projectDirName);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const idx = project.scenes.findIndex((s) => s.id === currentSceneId);
  const total = totalDuration(project, project.previewLang);
  const stale = project.scenes.some((s) => s.audioByLang?.[project.previewLang]?.stale);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-ink-600 bg-ink-900 px-3 text-[10px] text-ink-400">
      <span>
        {dir ? `${dir}/project.json` : "未绑定文件夹"} · 场景 {Math.max(1, idx + 1)}/{project.scenes.length} ·{" "}
        {project.aspect} · {langZhName(project.previewLang)}
      </span>
      <span>
        {stale ? "口播已改，需重新合成  ·  " : ""}
        总时长 {formatMs(total)} · {isTauri() ? "Tauri" : "Chrome / Edge"}
      </span>
    </footer>
  );
}
