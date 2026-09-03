import type { LangId } from "./langs";
import { concatParts, measureDuration, mixClips, putAudioBlob, putBeatAudio } from "./audioStore";
import { resolveSpeakRole, synthesizeClip, voiceSynthParams } from "./tts";
import { sourceLangOf } from "./textI18n";
import { speakText } from "./narration";
import { driveOf, isPlayBlock } from "./calendar";
import { isGapSpeak, lineDurationMs, speakLineText, speaksOf } from "./speaks";
import { sceneBlocks } from "./blocks";
import { sceneCalendar } from "./timeline";
import { useEditor } from "../store/useEditor";
import type { Scene, SceneAudio, VoiceProfile } from "../types";

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

function uniqueTargets(scene: Scene, lang: LangId, source: LangId): string[] {
  if (driveOf(scene) === "config") {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const b of sceneBlocks(scene).filter(isPlayBlock)) {
      const t = (b.settings?.playTarget ?? "").trim();
      if (!t || seen.has(t)) continue;
      if (!speakText(scene, t, lang, source).trim()) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of speaksOf(scene)) {
    if (isGapSpeak(line) || seen.has(line.id)) continue;
    if (!speakLineText(line, lang, source).trim()) continue;
    seen.add(line.id);
    out.push(line.id);
  }
  return out;
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
    const targets = uniqueTargets(scene, lang, source);
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
    if (!targets.length) {
      report(0, 0, "", "（本场无口播，跳过）");
      continue;
    }

    const blobs = new Map<string, Blob>();
    const beatMs: Record<string, number> = {};
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const text = speakText(scene, target, lang, source).replace(/\s+/g, " ").trim();
      const role = resolveSpeakRole(project, scene, lang, target);
      if (!role) throw new Error("请先在配音窗口添加角色并指定音色");
      report(i, targets.length, role.name, text);
      const { voiceId, targetModel } = voiceSynthParams(role);
      const blob = await synthesizeClip(lang, text, voiceId, targetModel);
      blobs.set(target, blob);
      await putBeatAudio(scene.id, lang, target, blob);
      beatMs[target] = await measureDuration(blob);
    }

    useEditor.getState().patchScene(
      scene.id,
      (s) => ({
        ...s,
        speaks: speaksOf(s).map((line) =>
          isGapSpeak(line) || line.durationMs
            ? line
            : beatMs[line.id]
              ? { ...line, durationMs: beatMs[line.id] }
              : line,
        ),
        audioByLang: {
          ...s.audioByLang,
          [lang]: {
            src: `media/${lang}/${scene.id}.wav`,
            durationMs: Object.values(beatMs).reduce((n, v) => n + v, 0),
            voice: [...new Set(targets.map((t) => resolveSpeakRole(project, s, lang, t)?.voiceId).filter(Boolean))].join(","),
            words: [],
            beatMs,
            stale: false,
          },
        },
      }),
      false,
    );

    const fresh = useEditor.getState().project.scenes.find((x) => x.id === scene.id) ?? scene;
    let stored: Blob;
    let durationMs: number;
    if (driveOf(fresh) === "config") {
      const cal = sceneCalendar(fresh, lang, useEditor.getState().project);
      const clips: { blob: Blob; startMs: number }[] = [];
      for (const span of cal.spans) {
        const blob = blobs.get(span.target);
        if (blob) clips.push({ blob, startMs: span.startMs });
      }
      stored = await mixClips(clips, Math.max(1, cal.bodyEndMs));
      durationMs = await measureDuration(stored);
    } else {
      const parts: { blob?: Blob; silenceMs?: number }[] = [];
      for (const line of speaksOf(fresh)) {
        if (isGapSpeak(line)) {
          parts.push({ silenceMs: lineDurationMs(fresh, line, lang, source) });
          continue;
        }
        const blob = blobs.get(line.id);
        if (blob) parts.push({ blob });
      }
      if (!parts.some((p) => p.blob)) {
        report(0, 0, "", "（本场无口播，跳过）");
        continue;
      }
      stored = await concatParts(parts);
      durationMs = await measureDuration(stored);
    }
    await putAudioBlob(scene.id, lang, stored);
    const voices = targets
      .map((t) => resolveSpeakRole(project, scene, lang, t))
      .filter((r): r is VoiceProfile => Boolean(r));
    const audio: SceneAudio = {
      src: `media/${lang}/${scene.id}.wav`,
      durationMs,
      voice: [...new Set(voices.map((r) => r.voiceId))].join(","),
      words: [],
      beatMs,
      stale: false,
    };
    useEditor.getState().markAudio(scene.id, lang, audio);
  }
}
