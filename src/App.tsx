import { useEffect } from "react";
import { ExportStage, Stage } from "./components/Stage";
import { RightDock } from "./components/RightDock";
import { PlaybackClock, AudioEngine } from "./components/Playback";
import { SceneList } from "./components/SceneList";
import { StatusBar } from "./components/StatusBar";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import { ExportDialog } from "./components/dialogs/ExportDialog";
import { HelpDialog } from "./components/dialogs/HelpDialog";
import { AiDialog } from "./components/dialogs/AiDialog";
import { PrefsDialog } from "./components/dialogs/PrefsDialog";
import { TextI18nDialog } from "./components/dialogs/TextI18nDialog";
import { TtsDialog } from "./components/dialogs/TtsDialog";
import { WelcomeDialog } from "./components/dialogs/WelcomeDialog";
import { useKeyboard } from "./hooks/useKeyboard";
import { restoreBoundDir } from "./lib/projectFolder";
import { useEditor } from "./store/useEditor";

export default function App() {
  useKeyboard();
  const dialog = useEditor((s) => s.dialog);

  useEffect(() => {
    void restoreBoundDir();
  }, []);

  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-100">
      <PlaybackClock />
      <AudioEngine />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <SceneList />
        <main className="relative flex min-w-0 flex-1 flex-col">
          <Stage />
        </main>
        <RightDock />
      </div>
      <Timeline />
      <StatusBar />
      <ExportStage />
      {dialog === "welcome" && <WelcomeDialog />}
      {dialog === "export" && <ExportDialog />}
      {dialog === "help" && <HelpDialog />}
      {dialog === "texts" && <TextI18nDialog />}
      {dialog === "tts" && <TtsDialog />}
      {dialog === "ai" && <AiDialog />}
      {dialog === "prefs" && <PrefsDialog />}
    </div>
  );
}
