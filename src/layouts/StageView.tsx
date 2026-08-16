import { useRef, type CSSProperties, type MouseEvent } from "react";
import { sceneBlocks } from "../lib/blocks";
import { bodyBeatSpans, resolveCue } from "../lib/cues";
import { mergedSettings, sampleBlock } from "../lib/interpolate";
import { captionForTime } from "../lib/narration";
import { itemText, textOf } from "../lib/textI18n";
import { langMeta, type LangId } from "../lib/langs";
import { cueVisible, sceneClock } from "../lib/timeline";
import type { Cue, LayoutBlock, Project, Scene } from "../types";

function cueOf(scene: Scene, target: string): Cue | undefined {
  return scene.cues.find((c) => c.target === target);
}

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

export function StageView({
  scene,
  lang,
  source,
  project,
  localMs,
  durationMs,
  animLocalMs,
  animDurationMs,
  phase,
  audioMs,
  showCaptions,
  editable = false,
  selectedId = null,
  onSelect,
  onTransformStart,
  onTransform,
}: {
  scene: Scene;
  lang: LangId;
  source: LangId;
  project: Project;
  localMs: number;
  durationMs: number;
  animLocalMs?: number;
  animDurationMs?: number;
  phase?: string;
  audioMs?: number | null;
  showCaptions: boolean;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onTransformStart?: () => void;
  onTransform?: (id: string, pose: { x: number; y: number; w: number; h: number }) => void;
}) {
  const animDur = animDurationMs ?? durationMs;
  const animLocal = animLocalMs ?? localMs;
  const progress = animDur > 0 ? animLocal / animDur : 0;
  const freeze: "start" | "end" | undefined =
    phase === "openPad" || phase === "open" || phase === "openGap"
      ? "start"
      : phase === "closePad" || phase === "close" || phase === "closeGap" || phase === "hold"
        ? "end"
        : undefined;
  const clock = sceneClock(scene, lang, project);
  const spans = bodyBeatSpans(scene, lang, source);
  const resolvedOf = (target: string) => {
    const cue = cueOf(scene, target);
    return cue ? resolveCue(cue, clock, spans, scene, source) : undefined;
  };
  const blocks = sceneBlocks(scene);
  const firstAt = Math.min(
    1,
    ...[...blocks.map((b) => resolvedOf(b.id)?.at ?? 0), ...(scene.slots.items ?? []).map((it) => resolvedOf(`item:${it.id}`)?.at ?? 1)],
  );
  const sampleOpts = { freeze, firstAt: Number.isFinite(firstAt) ? firstAt : 0 };
  const title = textOf(scene.slots.title, lang, source);
  const subtitle = textOf(scene.slots.subtitle, lang, source);
  const body = textOf(scene.slots.body, lang, source);
  const caption = textOf(scene.slots.caption, lang, source);
  const quote = textOf(scene.slots.quote, lang, source);
  const author = textOf(scene.slots.author, lang, source);
  const number = textOf(scene.slots.number, lang, source);
  const items = scene.slots.items ?? [];
  const img = scene.slots.image;
  const font = langMeta(lang).sans;
  const cap = showCaptions
    ? captionForTime(scene, lang, source, localMs, durationMs, phase, audioMs, animLocal, animDur, (target) => {
        const cue = resolvedOf(target);
        if (!cue) return true;
        if (freeze === "start") return cue.at <= sampleOpts.firstAt + 0.02;
        if (freeze === "end") return cueVisible(cue, 1);
        return cueVisible(cue, progress);
      })
    : "";
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    handle: Handle | "move";
    ox: number;
    oy: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const textFor = (type: LayoutBlock["type"]) => {
    if (type === "title") return title;
    if (type === "subtitle") return subtitle;
    if (type === "body") return body;
    if (type === "caption") return caption || title;
    if (type === "quote") return quote;
    if (type === "author") return author ? `— ${author}` : "";
    if (type === "number") return number;
    return "";
  };

  const applyDrag = (e: MouseEvent | globalThis.MouseEvent) => {
    const d = drag.current;
    const root = rootRef.current;
    if (!d || !root || !onTransform) return;
    const rect = root.getBoundingClientRect();
    const dx = ((e.clientX - d.ox) / rect.width) * 100;
    const dy = ((e.clientY - d.oy) / rect.height) * 100;
    let { x, y, w, h } = d;
    if (d.handle === "move") {
      x = d.x + dx;
      y = d.y + dy;
    } else {
      if (d.handle.includes("e")) w = d.w + dx;
      if (d.handle.includes("s")) h = d.h + dy;
      if (d.handle.includes("w")) {
        x = d.x + dx;
        w = d.w - dx;
      }
      if (d.handle.includes("n")) {
        y = d.y + dy;
        h = d.h - dy;
      }
    }
    onTransform(d.id, {
      x: Math.min(98, Math.max(-20, x)),
      y: Math.min(98, Math.max(-20, y)),
      w: Math.min(120, Math.max(4, w)),
      h: Math.min(120, Math.max(4, h)),
    });
  };

  const startDrag = (e: MouseEvent, id: string, handle: Handle | "move", pose: { x: number; y: number; w: number; h: number }) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect?.(id);
    onTransformStart?.();
    drag.current = { id, handle, ox: e.clientX, oy: e.clientY, ...pose };
    const move = (ev: globalThis.MouseEvent) => applyDrag(ev);
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: scene.bg || "#141811", fontFamily: font, color: "#f3eee3", containerType: "size" }}
      onMouseDown={() => {
        if (editable) onSelect?.(null);
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 20% 10%, #c45c2633, transparent 42%)" }} />
      {blocks.map((b) => {
        const cue = resolvedOf(b.id);
        const pose = sampleBlock(b, progress, cue, sampleOpts);
        const set = mergedSettings(b);
        const selected = selectedId === b.id;
        const box: CSSProperties = {
          position: "absolute",
          left: `${pose.x}%`,
          top: `${pose.y}%`,
          width: `${pose.w}%`,
          height: `${pose.h}%`,
          zIndex: selected ? 30 : (b.z ?? 1),
          opacity: pose.opacity,
          transform: `rotate(${pose.rotation}deg)`,
          textAlign: set.align,
          color: set.color,
          padding: `${set.padding ?? 0}cqw`,
          borderRadius: `${set.radius ?? 0}cqw`,
          overflow: selected && editable ? "visible" : "hidden",
          boxShadow: set.shadow ? "0 1cqw 3cqw rgba(0,0,0,.45)" : undefined,
          cursor: editable ? "move" : undefined,
        };

        const inner = (() => {
          if (b.type === "shape") {
            return <div className="h-full w-full" style={{ background: set.fill || "#c45c26", borderRadius: `${set.radius ?? 1}cqw` }} />;
          }
          if (b.type === "image") {
            return img ? (
              <img src={img} alt="" className="h-full w-full origin-center" style={{ objectFit: set.objectFit ?? "cover" }} />
            ) : null;
          }
          if (b.type === "list") {
            const layout = set.listLayout ?? "stack";
            const grid =
              layout === "grid" ? "grid grid-cols-2 gap-[1.4cqw]" : layout === "row" ? "flex gap-[1.4cqw]" : "flex flex-col gap-[1.4cqw]";
            return (
              <div className={`h-full ${grid}`}>
                {items.map((it, i) => {
                  const itemCue = resolvedOf(`item:${it.id}`);
                  const ip = sampleBlock({ ...b, id: it.id, keys: undefined }, progress, itemCue, sampleOpts);
                  return (
                    <div
                      key={it.id}
                      className={
                        layout === "stack" ? "flex items-start gap-[1.2cqw]" : "flex-1 rounded-[1cqw] border border-white/10 bg-white/5 p-[1.4cqw]"
                      }
                      style={{ opacity: ip.opacity }}
                    >
                      <span className="flex h-[2.2cqw] w-[2.2cqw] shrink-0 items-center justify-center rounded-full bg-[#c45c26] text-[1.2cqw]">
                        {i + 1}
                      </span>
                      <span className="leading-snug" style={{ fontSize: `${set.fontSize ?? 1.8}cqw` }}>
                        {itemText(it, lang, source)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }
          const content = textFor(b.type);
          if (!content) return null;
          return (
            <div
              className={`flex h-full w-full items-center ${b.type === "title" || b.type === "quote" || b.type === "number" ? "font-display" : ""}`}
              style={{
                fontSize: `${set.fontSize}cqw`,
                fontWeight: set.fontWeight === "bold" ? 700 : set.fontWeight === "medium" ? 500 : 400,
                lineHeight: set.lineHeight,
              }}
            >
              <div className="w-full">{content}</div>
            </div>
          );
        })();

        return (
          <div
            key={b.id}
            style={box}
            onMouseDown={(e) => startDrag(e, b.id, "move", pose)}
          >
            {inner}
            {editable && selected && (
              <>
                <div className="pointer-events-none absolute inset-0 rounded-[0.3cqw] ring-2 ring-brass" />
                {HANDLES.map((h) => {
                  const pos: CSSProperties = {
                    position: "absolute",
                    width: 10,
                    height: 10,
                    background: "#d4a84b",
                    border: "1px solid #10120e",
                    zIndex: 40,
                    cursor: `${h}-resize`,
                  };
                  if (h.includes("n")) pos.top = -5;
                  if (h.includes("s")) pos.bottom = -5;
                  if (h.includes("w")) pos.left = -5;
                  if (h.includes("e")) pos.right = -5;
                  if (h === "n" || h === "s") {
                    pos.left = "50%";
                    pos.marginLeft = -5;
                  }
                  if (h === "e" || h === "w") {
                    pos.top = "50%";
                    pos.marginTop = -5;
                  }
                  return (
                    <div
                      key={h}
                      style={pos}
                      onMouseDown={(e) => startDrag(e, b.id, h, pose)}
                    />
                  );
                })}
              </>
            )}
          </div>
        );
      })}
      {showCaptions && cap && (
        <div className="pointer-events-none absolute inset-x-[10%] bottom-[3%] z-20 rounded-full bg-black/55 px-[2cqw] py-[0.9cqw] text-center text-[1.7cqw] leading-snug backdrop-blur-sm">
          {cap}
        </div>
      )}
    </div>
  );
}
