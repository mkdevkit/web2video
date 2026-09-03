import type { LangId } from "./langs";
import { measureDuration, putAudioBlob } from "./audioStore";
import { loadTtsSecrets } from "./ttsSecrets";
import { findTimbreByVoice } from "./voiceLibrary";
import { qwenSynthesize } from "./qwenTts";
import { findSpeak } from "./speaks";
import { qwenRoles } from "./voices";
import type { Project, Scene, SceneAudio, TtsProvider, VoiceProfile } from "../types";

function pickRole(roles: VoiceProfile[], id?: string): VoiceProfile | undefined {
  if (!id) return undefined;
  return roles.find((v) => v.id === id);
}

export function defaultRoleForLang(project: Project, lang: LangId): VoiceProfile | undefined {
  const roles = qwenRoles(project.voices);
  return pickRole(roles, project.voiceByLang?.[lang]) || pickRole(roles, project.voiceId) || roles[0];
}

export function activeVoice(project: Project): VoiceProfile | undefined {
  const roles = qwenRoles(project.voices);
  return pickRole(roles, project.voiceId) || defaultRoleForLang(project, project.previewLang) || roles[0];
}

export function resolveSpeakRole(project: Project, scene: Scene, lang: LangId, key: string): VoiceProfile | undefined {
  const roles = qwenRoles(project.voices);
  const line = findSpeak(scene, key);
  return pickRole(roles, line?.role) || pickRole(roles, scene.speakRole?.[key]) || defaultRoleForLang(project, lang);
}

export function voiceSynthParams(role: VoiceProfile): { provider: TtsProvider; voiceId: string; targetModel?: string } {
  const timbre = findTimbreByVoice(role.voiceId);
  return { provider: "qwen", voiceId: role.voiceId, targetModel: role.targetModel || timbre?.targetModel };
}

export function resolveVoice(
  project: Project,
  lang?: LangId,
): { provider: TtsProvider; voiceId: string; targetModel?: string } {
  const hit = lang ? defaultRoleForLang(project, lang) : activeVoice(project);
  if (!hit) throw new Error("请先在配音窗口添加角色并指定音色");
  return voiceSynthParams(hit);
}

export async function synthesizeClip(
  lang: LangId,
  text: string,
  voice?: string,
  targetModel?: string,
): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("口播稿为空");
  const voiceId = voice?.trim();
  if (!voiceId) throw new Error("请先在配音窗口添加角色并指定音色");
  const secrets = loadTtsSecrets();
  const model =
    targetModel ||
    findTimbreByVoice(voiceId)?.targetModel ||
    secrets.qwenVdModel ||
    "qwen3-tts-vd-2026-01-26";
  const qwen = await qwenSynthesize({ text: trimmed, voice: voiceId, model, lang });
  const bin = atob(qwen.audioBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: qwen.contentType || "audio/wav" });
}

export async function synthesizeScene(
  sceneId: string,
  lang: LangId,
  text: string,
  voice?: string,
  _provider?: TtsProvider,
  targetModel?: string,
): Promise<SceneAudio> {
  const blob = await putAudioBlob(sceneId, lang, await synthesizeClip(lang, text, voice, targetModel));
  const durationMs = await measureDuration(blob);
  return {
    src: `media/${lang}/${sceneId}.mp3`,
    durationMs,
    voice: voice?.trim(),
    words: [],
    stale: false,
  };
}
