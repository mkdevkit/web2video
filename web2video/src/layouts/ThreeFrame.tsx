import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DEFAULT_THREE_SRC } from "../lib/threePreset";

type UpdateFn = (ctx: { t: number; localMs: number }) => void;

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (!mat) return;
    const list = Array.isArray(mat) ? mat : [mat];
    for (const m of list) m.dispose();
  });
}

function compileScene(
  src: string,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): { update?: UpdateFn; error?: string } {
  const body = (src.trim() || DEFAULT_THREE_SRC).replace(/^\uFEFF/, "");
  try {
    const factory = new Function(
      "THREE",
      "scene",
      "camera",
      `"use strict";\n${body}`,
    ) as (three: typeof THREE, sc: THREE.Scene, cam: THREE.PerspectiveCamera) => unknown;
    const ret = factory(THREE, scene, camera);
    if (typeof ret === "function") return { update: ret as UpdateFn };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "三维脚本无效" };
  }
}

export function ThreeFrame({
  src,
  localMs,
  t,
  fill,
}: {
  src: string;
  localMs: number;
  t: number;
  fill?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    update?: UpdateFn;
    code: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pose = useRef({ t, localMs, fill });
  pose.current = { t, localMs, fill };

  const paint = () => {
    const w = world.current;
    const view = viewRef.current;
    if (!w || !view || !view.width || !view.height) return;
    const bg = (pose.current.fill ?? "").trim();
    if (bg && bg !== "transparent") {
      w.scene.background = new THREE.Color(bg);
      w.renderer.setClearColor(bg, 1);
    } else {
      w.scene.background = null;
      w.renderer.setClearColor(0x000000, 0);
    }
    try {
      w.update?.({ t: pose.current.t, localMs: pose.current.localMs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "三维 update 失败");
      return;
    }
    w.renderer.render(w.scene, w.camera);
    const ctx = view.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(w.renderer.domElement, 0, 0);
  };

  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    camera.position.z = 2.6;
    const built = compileScene(src, scene, camera);
    world.current = { renderer, scene, camera, update: built.update, code: src };
    setError(built.error ?? null);
    paint();
    return () => {
      disposeObject(scene);
      renderer.dispose();
      world.current = null;
    };
  }, [src]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const view = viewRef.current;
    if (!wrap || !view) return;
    const apply = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wpx = Math.max(2, Math.round(r.width * dpr));
      const hpx = Math.max(2, Math.round(r.height * dpr));
      if (view.width !== wpx) view.width = wpx;
      if (view.height !== hpx) view.height = hpx;
      const w = world.current;
      if (w) {
        w.renderer.setPixelRatio(1);
        w.renderer.setSize(wpx, hpx, false);
        w.camera.aspect = wpx / hpx;
        w.camera.updateProjectionMatrix();
      }
      paint();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [src]);

  useEffect(() => {
    paint();
  }, [localMs, t, fill, src]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={viewRef} className="h-full w-full" />
      {error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/70 p-[1cqw] text-center text-[1.2cqw] leading-snug text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
