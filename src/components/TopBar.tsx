import {
  Download,
  FilePlus,
  FileText,
  FolderOpen,
  HelpCircle,
  Languages,
  Mic,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Undo2,
} from "lucide-react";
import { LANGS, langZhName, type LangId } from "../lib/langs";
import { openProjectFolder, saveProjectFolder } from "../lib/projectFolder";
import { sceneStarts, totalDuration, formatMs } from "../lib/timeline";
import { useEditor } from "../store/useEditor";
import { AddBlockMenu } from "./AddBlockMenu";

export function TopBar() {
  const project = useEditor((s) => s.project);
  const playing = useEditor((s) => s.playing);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);
  const playheadMs = useEditor((s) => s.playheadMs);
  const total = totalDuration(project, project.previewLang);

  return (
    <header className="flex h-12 w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b border-ink-600 bg-ink-900 px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        <div className="mr-1 flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-copper text-paper">
            <Play className="h-4 w-4" strokeWidth={2.4} fill="currentColor" />
          </div>
          <div className="hidden min-[900px]:block">
            <div className="font-display text-sm leading-none text-paper">Web2Video</div>
            <div className="text-[10px] text-ink-400">口播网页转视频</div>
          </div>
        </div>
        <input
          className="field min-w-0 w-36 shrink px-1.5 sm:w-44"
          value={project.name}
          onChange={(e) => useEditor.getState().setProjectName(e.target.value)}
        />
        <div className="mx-0.5 h-5 w-px shrink-0 bg-ink-600" />
        <button className="btn shrink-0" onClick={() => useEditor.getState().setDialog("welcome")}>
          <FilePlus className="h-3.5 w-3.5" /> 新建
        </button>
        <button className="btn shrink-0" onClick={() => void openProjectFolder()}>
          <FolderOpen className="h-3.5 w-3.5" /> 打开
        </button>
        <button className="btn shrink-0" onClick={() => void saveProjectFolder()}>
          <Save className="h-3.5 w-3.5" /> 保存
        </button>
        <button className="btn shrink-0" onClick={() => useEditor.getState().setDialog("script")}>
          <FileText className="h-3.5 w-3.5" /> 口播稿
        </button>
        <button
          className="btn btn-accent shrink-0"
          onClick={() => {
            const s = useEditor.getState();
            s.setRightTab("ai");
            s.setDialog("ai");
          }}
        >
          <Sparkles className="h-3.5 w-3.5" /> AI
        </button>
        <button className="btn shrink-0" onClick={() => useEditor.getState().setDialog("texts")}>
          <Languages className="h-3.5 w-3.5" /> 文本
        </button>
        <button className="btn shrink-0" onClick={() => useEditor.getState().setDialog("tts")}>
          <Mic className="h-3.5 w-3.5" /> 配音
        </button>
        <button className="btn shrink-0" title="字体、字幕、画幅" onClick={() => useEditor.getState().setDialog("prefs")}>
          <Settings2 className="h-3.5 w-3.5" /> 配置
        </button>
        <AddBlockMenu />
        <button className="btn btn-accent shrink-0" onClick={() => useEditor.getState().setDialog("export")}>
          <Download className="h-3.5 w-3.5" /> 导出
        </button>
        <button className="btn shrink-0 px-2" disabled={!past.length} onClick={() => useEditor.getState().undo()}>
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button className="btn shrink-0 px-2" disabled={!future.length} onClick={() => useEditor.getState().redo()}>
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          className="btn px-2"
          title="重播当前场景"
          onClick={() => {
            const s = useEditor.getState();
            const idx = s.project.scenes.findIndex((sc) => sc.id === s.currentSceneId);
            const start = sceneStarts(s.project, s.project.previewLang)[idx] ?? 0;
            s.setPlayhead(start);
            s.setPlaying(true);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          className="btn btn-accent px-2"
          onClick={() => useEditor.getState().setPlaying(!playing)}
          title="空格播放/暂停"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <span className="w-20 text-center font-mono text-[11px] text-ink-400">
          {formatMs(playheadMs)} / {formatMs(total)}
        </span>
        <select
          className="field w-28"
          value={project.previewLang}
          onChange={(e) => useEditor.getState().setPreviewLang(e.target.value as LangId)}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {langZhName(l.id)}
            </option>
          ))}
        </select>
        <button className="btn px-2" onClick={() => useEditor.getState().setDialog("help")}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
