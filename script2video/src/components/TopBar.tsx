import { Mic } from "lucide-react";
import { useStudio } from "../store/useStudio";
import { LANGS } from "../lib/langs";
import { isTauri } from "../lib/platform";
import { clearBoundDir, openProjectFolder, saveProjectFolder } from "../lib/projectFolder";
import { DEFAULT_PROJECT_NAME, emptyScript } from "../sample";
import type { AspectId, Project } from "../types";

export function TopBar() {
  const project = useStudio((s) => s.project);
  const patchProject = useStudio((s) => s.patchProject);
  const setProject = useStudio((s) => s.setProject);
  const setDialog = useStudio((s) => s.setDialog);
  const setStatus = useStudio((s) => s.setStatus);
  const desktop = isTauri();

  return (
    <header className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2">
      <div className="mr-2 flex shrink-0 items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
        <h1 className="text-sm font-semibold tracking-wide">Script2Video</h1>
      </div>
      <span className="rounded border border-ink-600 px-1.5 py-0.5 text-[11px] text-ink-400">
        {desktop ? "Tauri" : "Web"}
      </span>
      <input
        className="w-40 rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
        value={project.name}
        onChange={(e) => patchProject({ name: e.target.value })}
      />
      <button
        className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper"
        onClick={() => {
          clearBoundDir();
          const blank: Project = {
            name: DEFAULT_PROJECT_NAME,
            sourceLang: "zh",
            previewLang: "zh",
            voices: [],
            aspect: "16:9",
            scripts: [emptyScript()],
          };
          setProject(blank);
          setStatus("新工程，保存时会写入「项目名」文件夹");
        }}
      >
        新建
      </button>
      <button
        className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper"
        onClick={() => void openProjectFolder()}
      >
        打开
      </button>
      <button
        className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper"
        onClick={() => void saveProjectFolder()}
      >
        保存
      </button>
      <button
        className="inline-flex items-center gap-1 rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper"
        onClick={() => setDialog("tts")}
      >
        <Mic className="h-3.5 w-3.5" />
        配音
      </button>
      <div className="mx-1 h-4 w-px bg-ink-600" />
      <label className="text-xs text-ink-400">
        源
        <select
          className="ml-1 rounded border border-ink-600 bg-ink-800 px-1 py-1"
          value={project.sourceLang}
          onChange={(e) => patchProject({ sourceLang: e.target.value as Project["sourceLang"] })}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-ink-400">
        预览
        <select
          className="ml-1 rounded border border-ink-600 bg-ink-800 px-1 py-1"
          value={project.previewLang}
          onChange={(e) => patchProject({ previewLang: e.target.value as Project["previewLang"] })}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-ink-400">
        画幅
        <select
          className="ml-1 rounded border border-ink-600 bg-ink-800 px-1 py-1"
          value={project.aspect ?? "16:9"}
          onChange={(e) => patchProject({ aspect: e.target.value as AspectId })}
        >
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="1:1">1:1</option>
        </select>
      </label>
      <div className="flex-1" />
      <button className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper" onClick={() => setDialog("stage")}>
        外观
      </button>
      <button
        className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper"
        onClick={() => {
          useStudio.getState().setTab("ai");
          setDialog("ai");
        }}
      >
        AI
      </button>
      <button className="rounded border border-ink-600 px-2 py-1 text-sm hover:border-copper" onClick={() => setDialog("export")}>
        导出
      </button>
    </header>
  );
}
