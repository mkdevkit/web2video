import type { Project, SceneScript } from "../types";
import type { LangId } from "./langs";
import { driveOf, isGapBeat } from "./beats";
import { getBeatAudio, mixClips, putAudioBlob } from "./audioStore";
import { createSpeech, type SpeechApi } from "./speech";
import { mountStage } from "./stage";
import { sourceOf, usesGsapPreview } from "./engines";
import { runGsapScript } from "./runGsap";
import { useStudio } from "../store/useStudio";

function sameCues(
  a: { id: string; startMs: number; ms: number }[] | undefined,
  b: { id: string; startMs: number; ms: number }[],
) {
  if (!a || a.length !== b.length) return false;
  return a.every((c, i) => c.id === b[i].id && c.startMs === b[i].startMs && c.ms === b[i].ms);
}

export function persistSpeechRun(script: SceneScript, speech: SpeechApi) {
  const cues = speech.cues();
  const totalMs = Math.round(speech.totalMs());
  const sleepMs = Math.round(speech.sleepMs());
  const patch: Partial<SceneScript> = {};
  if (driveOf(script) === "script") {
    if (!sameCues(script.driveSchedule, cues) || Math.round(script.driveTotalMs ?? 0) !== totalMs) {
      patch.driveSchedule = cues;
      patch.driveTotalMs = totalMs;
    }
  } else if (Math.round(script.holdMs ?? 0) !== sleepMs) {
    patch.holdMs = sleepMs;
  }
  if (Object.keys(patch).length) useStudio.getState().patchScript(script.id, patch);
}

export async function mixScriptSoundtrack(script: SceneScript, lang: LangId, speech: SpeechApi): Promise<void> {
  if (driveOf(script) !== "script") return;
  const clips: { blob: Blob; startMs: number }[] = [];
  for (const cue of speech.cues()) {
    const beat = script.beats.find((b) => b.id === cue.id);
    if (!beat || isGapBeat(beat)) continue;
    const blob = await getBeatAudio(script.id, lang, cue.id);
    if (blob) clips.push({ blob, startMs: cue.startMs });
  }
  if (!clips.length) return;
  const mixed = await mixClips(clips, speech.totalMs());
  await putAudioBlob(script.id, lang, mixed);
}

/** Run GSAP off-DOM so play() schedule is known, then mix the wav. */
export async function bakeSoundtrack(script: SceneScript, project: Project, lang: LangId): Promise<void> {
  if (driveOf(script) !== "script") return;
  if (!usesGsapPreview(script)) return;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:180px;opacity:0;pointer-events:none";
  document.body.appendChild(root);
  try {
    mountStage(root, script, project);
    const speech = createSpeech(script, lang);
    const { revert } = runGsapScript(sourceOf(script), speech, root);
    persistSpeechRun(script, speech);
    await mixScriptSoundtrack(script, lang, speech);
    revert();
  } finally {
    root.remove();
  }
}
