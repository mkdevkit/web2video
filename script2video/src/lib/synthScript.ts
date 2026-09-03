import type { LangId } from "./langs";
import { concatAudioBlobs, measureDuration, putAudioBlob } from "./audioStore";
import { beatsForLang, resolveBeatRole, synthesizeClip, voiceSynthParams } from "./tts";
import { useStudio } from "../store/useStudio";
import type { BeatDurations, ScriptAudio } from "../types";

export async function synthScript(
  scriptId: string,
  lang: LangId,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const { project, patchScript } = useStudio.getState();
  const script = project.scripts.find((s) => s.id === scriptId);
  if (!script) throw new Error("找不到脚本");
  const source = project.sourceLang;
  const beats = beatsForLang(script, lang, source);
  if (!beats.length) throw new Error("该语言没有口播句");

  const blobs: Blob[] = [];
  const beatMs: BeatDurations = {};
  let lastVoice = "";
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const role = resolveBeatRole(project, beat, lang);
    if (!role) throw new Error("请先在配音窗口添加角色并指定音色");
    const { voiceId, targetModel } = voiceSynthParams(role);
    lastVoice = voiceId;
    onProgress?.(`${i + 1}/${beats.length} ${role.name}：${beat.text.slice(0, 24)}`);
    const blob = await synthesizeClip(lang, beat.text, voiceId, targetModel);
    beatMs[beat.id] = await measureDuration(blob);
    blobs.push(blob);
  }
  const all = await concatAudioBlobs(blobs);
  await putAudioBlob(scriptId, lang, all);
  const durationMs = Object.values(beatMs).reduce((n, x) => n + x, 0);
  const audio: ScriptAudio = {
    src: `media/${lang}/${scriptId}.wav`,
    durationMs,
    voice: lastVoice,
    beatMs,
    stale: false,
  };
  patchScript(scriptId, { audioByLang: { ...script.audioByLang, [lang]: audio } });
}
