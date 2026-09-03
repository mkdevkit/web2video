import type { VoiceProfile } from "../types";

export function qwenRoles(voices: VoiceProfile[] | undefined): VoiceProfile[] {
  return (voices ?? []).filter((v) => !v.provider || v.provider === "qwen");
}
