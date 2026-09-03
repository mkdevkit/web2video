import type { LangId } from "./langs";
import { concatParts, measureDuration, putAudioBlob, putBeatAudio } from "./audioStore";
import { beatsForLang, resolveBeatRole, synthesizeClip, voiceSynthParams } from "./tts";
import { useStudio } from "../store/useStudio";
import type { BeatDurations, ScriptAudio } from "../types";
import { gapMsOf, isGapBeat } from "./beats";

export async function synthScript(
  scriptId: string,
  lang: LangId,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const { project, patchScript } = useStudio.getState();
  const script = project.scripts.find((s) => s.id === scriptId);
  if (!script) throw new Error("找不到脚本");
  const source = project.sourceLang;
  const spoken = beatsForLang(script, lang, source);
  if (!spoken.length && !script.beats.some(isGapBeat)) throw new Error("该语言没有口播句");

  const parts: { blob?: Blob; silenceMs?: number }[] = [];
  const beatMs: BeatDurations = {};
  let lastVoice = "";
  let spokenIndex = 0;
  for (const beat of script.beats) {
    if (isGapBeat(beat)) {
      const ms = gapMsOf(beat);
      beatMs[beat.id] = ms;
      parts.push({ silenceMs: ms });
      continue;
    }
    const row = spoken.find((s) => s.id === beat.id);
    if (!row) continue;
    const role = resolveBeatRole(project, beat, lang);
    if (!role) throw new Error("请先在配音窗口添加角色并指定音色");
    const { voiceId, targetModel } = voiceSynthParams(role);
    lastVoice = voiceId;
    spokenIndex += 1;
    onProgress?.(`${spokenIndex}/${spoken.length} ${role.name}：${row.text.slice(0, 24)}`);
    const blob = await synthesizeClip(lang, row.text, voiceId, targetModel);
    const ms = await measureDuration(blob);
    beatMs[beat.id] = ms;
    await putBeatAudio(scriptId, lang, beat.id, blob);
    parts.push({ blob });
  }
  if (!parts.length) throw new Error("该语言没有口播句");
  const all = await concatParts(parts);
  await putAudioBlob(scriptId, lang, all);
  const durationMs = await measureDuration(all);
  const audio: ScriptAudio = {
    src: `media/${lang}/${scriptId}.wav`,
    durationMs,
    voice: lastVoice,
    beatMs,
    stale: false,
  };
  patchScript(scriptId, { audioByLang: { ...script.audioByLang, [lang]: audio } });
}
