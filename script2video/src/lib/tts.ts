import type { LangId } from "./langs";
import { findTimbreByVoice } from "./voiceLibrary";
import { loadTtsSecrets } from "./ttsSecrets";
import { qwenSynthesize } from "./qwenTts";
import { qwenRoles } from "./voices";
import type { Project, SceneScript, VoiceProfile } from "../types";

function pickRole(roles: VoiceProfile[], id?: string): VoiceProfile | undefined {
  if (!id) return undefined;
  return roles.find((v) => v.id === id);
}

export function defaultRoleForLang(project: Project, lang: LangId): VoiceProfile | undefined {
  const roles = qwenRoles(project.voices);
  return pickRole(roles, project.voiceByLang?.[lang]) || pickRole(roles, project.voiceId) || roles[0];
}

export function resolveBeatRole(project: Project, beat: { roleId?: string }, lang: LangId): VoiceProfile | undefined {
  const roles = qwenRoles(project.voices);
  return pickRole(roles, beat.roleId) || defaultRoleForLang(project, lang);
}

export function voiceSynthParams(role: VoiceProfile): { voiceId: string; targetModel?: string } {
  const timbre = findTimbreByVoice(role.voiceId);
  return { voiceId: role.voiceId, targetModel: role.targetModel || timbre?.targetModel };
}

export async function synthesizeClip(lang: LangId, text: string, voice?: string, targetModel?: string): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("口播稿为空");
  const voiceId = voice?.trim();
  if (!voiceId) throw new Error("请先在配音窗口添加角色并指定音色");
  const secrets = loadTtsSecrets();
  const model = targetModel || findTimbreByVoice(voiceId)?.targetModel || secrets.qwenVdModel || "qwen3-tts-vd-2026-01-26";
  const qwen = await qwenSynthesize({ text: trimmed, voice: voiceId, model, lang });
  const bin = atob(qwen.audioBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: qwen.contentType || "audio/wav" });
}

export function beatsForLang(script: SceneScript, lang: LangId, source: LangId): { id: string; text: string; roleId?: string }[] {
  return script.beats
    .map((b) => ({
      id: b.id,
      text: (b.text[lang] ?? (lang === source ? "" : b.text[source]) ?? "").replace(/\s+/g, " ").trim(),
      roleId: b.roleId,
    }))
    .filter((b) => b.text);
}
