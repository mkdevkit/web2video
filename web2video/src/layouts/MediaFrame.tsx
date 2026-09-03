import { useEffect, useRef } from "react";
import { isGifSrc } from "../lib/insertImage";
import { useEditor } from "../store/useEditor";

function fitDraw(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  cw: number,
  ch: number,
  fit: "cover" | "contain",
) {
  if (!sw || !sh || !cw || !ch) return;
  ctx.clearRect(0, 0, cw, ch);
  const scale = fit === "contain" ? Math.min(cw / sw, ch / sh) : Math.max(cw / sw, ch / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

export function MediaFrame({
  src,
  kind,
  objectFit = "cover",
  loop = true,
  timeMs,
}: {
  src: string;
  kind: "image" | "gif" | "video";
  objectFit?: "cover" | "contain";
  loop?: boolean;
  timeMs: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const exporting = useEditor((s) => s.exporting);
  const playing = useEditor((s) => s.playing);
  const animated = kind === "video" || kind === "gif" || isGifSrc(src);

  useEffect(() => {
    if (!animated) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const apply = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.round(r.width * dpr));
      const h = Math.max(2, Math.round(r.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [animated, src]);

  useEffect(() => {
    if (kind !== "video") return;
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const t = loop ? ((timeMs / 1000) % dur + dur) % dur : Math.min(Math.max(0, timeMs / 1000), Math.max(0, dur - 0.04));
      const drift = Math.abs(video.currentTime - t);
      if (exporting || !playing) {
        video.pause();
        if (drift > 0.03) video.currentTime = t;
        return;
      }
      if (drift > 0.35) video.currentTime = t;
      if (video.paused) void video.play().catch(() => undefined);
    };
    video.addEventListener("loadedmetadata", sync);
    sync();
    return () => video.removeEventListener("loadedmetadata", sync);
  }, [kind, timeMs, loop, playing, exporting, src]);

  useEffect(() => {
    if (!animated) return;
    let raf = 0;
    const tick = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        if (kind === "video" && videoRef.current && videoRef.current.readyState >= 2) {
          const v = videoRef.current;
          fitDraw(ctx, v, v.videoWidth, v.videoHeight, canvas.width, canvas.height, objectFit);
        } else if (imgRef.current?.naturalWidth) {
          const img = imgRef.current;
          fitDraw(ctx, img, img.naturalWidth, img.naturalHeight, canvas.width, canvas.height, objectFit);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animated, kind, src, objectFit]);

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#10120e] text-[1.4cqw] text-ink-400">
        {kind === "video" ? "选择视频" : kind === "gif" ? "选择 GIF" : "选择图片"}
      </div>
    );
  }

  if (!animated) {
    return <img src={src} alt="" className="h-full w-full" style={{ objectFit }} />;
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="relative z-[1] h-full w-full" />
      {kind === "video" ? (
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          loop={loop}
          preload="auto"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0"
        />
      ) : (
        <img ref={imgRef} src={src} alt="" className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0" />
      )}
    </div>
  );
}
