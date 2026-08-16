import { useEffect } from "react";
import { saveProjectFolder } from "../lib/projectFolder";
import { useEditor } from "../store/useEditor";

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      const s = useEditor.getState();

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProjectFolder();
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        s.setDialog("export");
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (typing) return;
      if (e.key === " " && !s.exporting) {
        e.preventDefault();
        s.setPlaying(!s.playing);
      }
      if (e.key === "?" ) s.setDialog("help");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
