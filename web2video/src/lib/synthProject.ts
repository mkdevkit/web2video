import type { LangId } from "./langs";
import { concatAudioBlobs, measureDuration, putAudioBlob } from "./audioStore";
import { resolveSpeakRole, synthesizeClip, synthesizeScene, voiceSynthParams } from "./tts";
import { sourceLangOf } from "./textI18n";
import { collectNarrationBeats, joinBeatTexts } from "./narration";
import { useEditor } from "../store/useEditor";
import type { SceneAudio, VoiceProfile } from "../types";

type RoleGroup = { role: VoiceProfile; texts: string[] };

export type SynthProgress = {
  lang: LangId;
  sceneIndex: number;
  sceneCount: number;
  sceneName: string;
  clipIndex: number;
  clipCount: number;
  roleName: string;
  text: string;
};

function groupByRole(beats: { text: string; role: VoiceProfile }[]): RoleGroup[] {
  const groups: RoleGroup[] = [];
  for (const beat of beats) {
    const last = groups[groups.length - 1];
    if (last && last.role.id === beat.role.id) last.texts.push(beat.text);
    else groups.push({ role: beat.role, texts: [beat.text] });
  }
  return groups;
}

export async function synthScenes(
  sceneIds: string[],
  lang: LangId,
  onProgress?: (p: SynthProgress) => void,
): Promise<void> {
  const { project } = useEditor.getState();
  const source = sourceLangOf(project);
  const scenes = project.scenes.filter((s) => sceneIds.includes(s.id));
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const beats = collectNarrationBeats(scene, lang, source);
    const resolved = beats.map((b) => {
      const role = resolveSpeakRole(project, scene, lang, b.target);
      if (!role) throw new Error("请先在配音窗口添加角色并指定音色");
      return { ...b, role };
    });
    const report = (clipIndex: number, clipCount: number, roleName: string, text: string) => {
      onProgress?.({
        lang,
        sceneIndex: si,
        sceneCount: scenes.length,
        sceneName: scene.name,
        clipIndex,
        clipCount,
        roleName,
        text,
      });
    };
    if (!resolved.length) {
      report(0, 0, "", "（本场无口播，跳过）");
      continue;
    }
    const groups = groupByRole(resolved);
    let audio: SceneAudio;
    if (groups.length === 1) {
      const text = joinBeatTexts(groups[0].texts);
      const { voiceId, provider, targetModel } = voiceSynthParams(groups[0].role);
      report(0, 1, groups[0].role.name, text);
      audio = await synthesizeScene(scene.id, lang, text, voiceId, provider, targetModel);
    } else {
      const blobs: Blob[] = [];
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        const text = joinBeatTexts(group.texts);
        const { voiceId, targetModel } = voiceSynthParams(group.role);
        report(gi, groups.length, group.role.name, text);
        blobs.push(await synthesizeClip(lang, text, voiceId, targetModel));
      }
      const blob = await concatAudioBlobs(blobs);
      const stored = await putAudioBlob(scene.id, lang, blob);
      const durationMs = await measureDuration(stored);
      audio = {
        src: `media/${lang}/${scene.id}.mp3`,
        durationMs,
        voice: groups.map((g) => g.role.voiceId).join(","),
        words: [],
        stale: false,
      };
    }
    useEditor.getState().markAudio(scene.id, lang, audio);
  }
}
