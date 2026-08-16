import { useEffect, useRef, useState } from "react";
import { audioObjectUrl } from "../lib/audioStore";
import { sceneAt, totalDuration } from "../lib/timeline";
import { useEditor } from "../store/useEditor";

export function PlaybackClock() {
  const playing = useEditor((s) => s.playing);
  const exporting = useEditor((s) => s.exporting);

  useEffect(() => {
    if (!playing || exporting) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const s = useEditor.getState();
      const total = totalDuration(s.project, s.project.previewLang);
      const next = s.playheadMs + dt;
      if (next >= total) {
        s.setPlayhead(total);
        s.setPlaying(false);
        return;
      }
      s.setPlayhead(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, exporting]);

  return null;
}

export function AudioEngine() {
  const playing = useEditor((s) => s.playing);
  const exporting = useEditor((s) => s.exporting);
  const playheadMs = useEditor((s) => s.playheadMs);
  const project = useEditor((s) => s.project);
  const lang = project.previewLang;
  const at = sceneAt(project, lang, playheadMs);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | undefined>();
  const sceneId = at?.scene.id;
  const stamp = at?.scene.audioByLang?.[lang]?.src;

  useEffect(() => {
    if (!sceneId || exporting) {
      setSrc(undefined);
      return;
    }
    let dead = false;
    void audioObjectUrl(sceneId, lang).then((url) => {
      if (!dead) setSrc(url ?? undefined);
    });
    return () => {
      dead = true;
    };
  }, [sceneId, lang, stamp, exporting]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !at || exporting) return;
    const local = at.localMs / 1000;
    if (Number.isFinite(el.duration) && Math.abs(el.currentTime - local) > 0.12) {
      el.currentTime = Math.min(local, el.duration || local);
    }
    if (playing && src && el.paused) void el.play().catch(() => undefined);
    if (!playing && !el.paused) el.pause();
  }, [playing, playheadMs, src, exporting, at]);

  return <audio ref={audioRef} src={src} preload="auto" className="hidden" />;
}
