import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { ScriptList } from "./components/ScriptList";
import { BeatEditor } from "./components/BeatEditor";
import { StageTextEditor } from "./components/StageTextEditor";
import { CodeEditor } from "./components/CodeEditor";
import { PreviewPane } from "./components/PreviewPane";
import { TtsDialog } from "./components/TtsDialog";
import { StageDialog } from "./components/StageDialog";
import { AiDialog } from "./components/AiDialog";
import { AiChatPanel } from "./components/AiChatPanel";
import { ExportStage } from "./components/ExportStage";
import { ExportDialog } from "./components/ExportDialog";
import { UsagePane } from "./components/UsagePane";
import { useStudio } from "./store/useStudio";
import { ensureStageFonts, stageThemeOf } from "./lib/stage";
import { restoreBoundDir, saveProjectFolder } from "./lib/projectFolder";

export default function App() {
  const dialog = useStudio((s) => s.dialog);
  const status = useStudio((s) => s.status);
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  const stageTheme = useStudio((s) => s.project.stageTheme);
  const projectDirName = useStudio((s) => s.projectDirName);

  useEffect(() => {
    void restoreBoundDir();
  }, []);

  useEffect(() => {
    const t = stageThemeOf(stageTheme);
    ensureStageFonts(t.baseFontId, t.fontId, t.titleFontId, t.captionFontId);
  }, [stageTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProjectFolder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-100">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ScriptList />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-ink-700 px-3 pt-2">
            <button
              className={`rounded-t border border-b-0 px-3 py-1 text-sm ${tab === "speech" ? "border-ink-600 bg-ink-800" : "border-transparent text-ink-400"}`}
              onClick={() => setTab("speech")}
            >
              口播
            </button>
            <button
              className={`rounded-t border border-b-0 px-3 py-1 text-sm ${tab === "text" ? "border-ink-600 bg-ink-800" : "border-transparent text-ink-400"}`}
              onClick={() => setTab("text")}
            >
              文本
            </button>
            <button
              className={`rounded-t border border-b-0 px-3 py-1 text-sm ${tab === "code" ? "border-ink-600 bg-ink-800" : "border-transparent text-ink-400"}`}
              onClick={() => setTab("code")}
            >
              脚本
            </button>
            <button
              className={`rounded-t border border-b-0 px-3 py-1 text-sm ${tab === "ai" ? "border-ink-600 bg-ink-800" : "border-transparent text-ink-400"}`}
              onClick={() => setTab("ai")}
            >
              AI
            </button>
            <button
              className={`rounded-t border border-b-0 px-3 py-1 text-sm ${tab === "usage" ? "border-ink-600 bg-ink-800" : "border-transparent text-ink-400"}`}
              onClick={() => setTab("usage")}
            >
              用法
            </button>
          </div>
          {tab === "speech" ? (
            <BeatEditor />
          ) : tab === "text" ? (
            <StageTextEditor />
          ) : tab === "code" ? (
            <CodeEditor />
          ) : tab === "ai" ? (
            <AiChatPanel />
          ) : (
            <UsagePane />
          )}
        </main>
        <PreviewPane />
      </div>
      <footer className="border-t border-ink-700 px-3 py-1 text-xs text-ink-400">
        {projectDirName ? `${projectDirName}/` : "未绑定文件夹"}
        {" · "}
        {status || "保存写入项目名文件夹；Ctrl+S。文本页译画面字；脚本页选工具；AI 页生成口播"}
      </footer>
      {dialog === "tts" && <TtsDialog />}
      {dialog === "stage" && <StageDialog />}
      {dialog === "ai" && <AiDialog />}
      {dialog === "export" && <ExportDialog />}
      <ExportStage />
    </div>
  );
}
