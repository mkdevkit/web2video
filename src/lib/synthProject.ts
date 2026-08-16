import type { SceneAudio } from "../types";
import type { LangId } from "./langs";
import { resolveVoice, synthesizeScene } from "./tts";
import { textOf } from "./textI18n";
import { useEditor } from "../store/useEditor";

export async function synthScenes(
  sceneIds: string[],
  lang: LangId,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { project } = useEditor.getState();
  const source = project.sourceLang;
  const { provider, voiceId } = resolveVoice(project, lang);
  const scenes = project.scenes.filter((s) => sceneIds.includes(s.id));
  let done = 0;
  for (const scene of scenes) {
    const text = textOf(scene.narration, lang, source);
    if (text.trim()) {
      const audio: SceneAudio = await synthesizeScene(scene.id, lang, text, voiceId, provider);
      useEditor.getState().markAudio(scene.id, lang, audio);
    }
    done += 1;
    onProgress?.(done, scenes.length);
  }
}
