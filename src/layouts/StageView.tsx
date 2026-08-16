import { useRef, type CSSProperties, type MouseEvent } from "react";
import { sceneBlocks } from "../lib/blocks";
import { bodyBeatSpans, resolveCue } from "../lib/cues";
import { mergedSettings, sampleBlock } from "../lib/interpolate";
import { captionForTime } from "../lib/narration";
import { captionStyleOf, fontStack, hexAlpha, resolveBlockFont } from "../lib/fonts";
import { itemText, textOf } from "../lib/textI18n";
import { type LangId } from "../lib/langs";
import { cueVisible, sceneClock } from "../lib/timeline";
import { MediaFrame } from "./MediaFrame";
import { mediaSrcOf } from "../lib/insertImage";
import { listMarkerRadius, listMarkerStyleOf } from "../lib/listMarker";
import type { Cue, LayoutBlock, ListMarkerStyle, Project, Scene } from "../types";

function cueOf(scene: Scene, target: string): Cue | undefined {
  return scene.cues.find((c) => c.target === target);
}

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

function ListIndexMark({ index, style }: { index: number; style: ListMarkerStyle }) {
  if (!style.show) return null;
  const img = style.kind === "image" && style.image ? style.image : undefined;
  const digit = !img || style.overlayIndex;
  const size = `${style.size}cqw`;
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: listMarkerRadius(style.shape),
        background: img ? "transparent" : style.bg,
        color: style.color,
        fontSize: `${style.size * 0.55}cqw`,
      }}
    >
      {img ? <img src={img} alt="" className="absolute inset-0 h-full w-full object-contain" /> : null}
      {digit ? <span className="relative z-[1]">{index}</span> : null}
    </span>
  );
}

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
    ...[
      ...blocks.map((b) => resolvedOf(b.id)?.at ?? 0),
      ...(scene.slots.items ?? []).map((it) => resolvedOf(`item:${it.id}`)?.at ?? 1),
      ...(scene.slots.dialogue ?? []).map((it) => resolvedOf(`item:${it.id}`)?.at ?? 1),
    ],
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
  const bodyFont = fontStack(project.fontId, lang);
  const captionFont = fontStack(project.captionFontId || project.fontId, lang);
  const capStyle = captionStyleOf(project.captionStyle);
  const listMark = listMarkerStyleOf(project.listMarkerStyle);
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
      style={{ background: scene.bg || "#141811", fontFamily: bodyFont, color: "#f3eee3", containerType: "size" }}
      onMouseDown={() => {
        if (editable) onSelect?.(null);
      }}
    >
      {scene.bgImage ? (
        <img
          src={scene.bgImage}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ objectFit: scene.bgFit === "contain" ? "contain" : "cover" }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 20% 10%, #c45c2633, transparent 42%)" }} />
      )}
      {(scene.bgDim ?? 0) > 0 && (
        <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(0,0,0,${Math.min(1, Math.max(0, scene.bgDim ?? 0))})` }} />
      )}
      {blocks.map((b) => {
        const cue = resolvedOf(b.id);
        const pose = sampleBlock(b, progress, cue, sampleOpts);
        const set = mergedSettings(b);
        const typeFont = fontStack(resolveBlockFont(project, b), lang);
        const selected = selectedId === b.id;
        const box: CSSProperties = {
          position: "absolute",
          left: `${pose.x}%`,
          top: `${pose.y}%`,
          width: `${pose.w}%`,
          height: `${pose.h}%`,
          zIndex: b.z ?? 1,
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
          if (b.type === "image" || b.type === "video" || b.type === "gif") {
            const src = mediaSrcOf(b, img);
            return (
              <MediaFrame
                src={src}
                kind={b.type}
                objectFit={set.objectFit ?? "cover"}
                loop={set.loop !== false}
                timeMs={localMs}
              />
            );
          }
          if (b.type === "dialogue") {
            const lines = scene.slots.dialogue ?? [];
            return (
              <div className="flex h-full flex-col justify-end gap-[1.1cqw]">
                {lines.map((it) => {
                  const left = it.side !== "right";
                  const itemCue = resolvedOf(`item:${it.id}`);
                  const ip = sampleBlock({ ...b, id: it.id, keys: undefined }, progress, itemCue, sampleOpts);
                  const name = (it.name ?? "").trim() || (left ? "左" : "右");
                  return (
                    <div
                      key={it.id}
                      className={`flex ${left ? "justify-start" : "justify-end"}`}
                      style={{ opacity: ip.opacity }}
                    >
                      <div
                        className={`max-w-[78%] px-[1.5cqw] py-[1cqw] ${
                          left ? "rounded-[1.2cqw] rounded-bl-[0.25cqw] bg-white/12" : "rounded-[1.2cqw] rounded-br-[0.25cqw] bg-[#c45c26]/40"
                        }`}
                      >
                        <div
                          className="mb-[0.25cqw] opacity-70"
                          style={{ fontSize: `${Math.max(1, (set.fontSize ?? 1.7) * 0.62)}cqw`, fontFamily: typeFont, textAlign: left ? "left" : "right" }}
                        >
                          {name}
                        </div>
                        <div
                          className="leading-snug"
                          style={{ fontSize: `${set.fontSize ?? 1.7}cqw`, fontFamily: typeFont, textAlign: left ? "left" : "right" }}
                        >
                          {itemText(it, lang, source)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
          if (b.type === "list") {
            const layout = set.listLayout ?? "stack";
            const grid =
              layout === "grid" ? "grid grid-cols-2 gap-[1.4cqw]" : layout === "row" ? "flex gap-[1.4cqw]" : "flex flex-col gap-[1.4cqw]";
            const row =
              layout === "stack"
                ? "flex items-start gap-[1.2cqw]"
                : "flex flex-1 items-start gap-[1.2cqw] rounded-[1cqw] border border-white/10 bg-white/5 p-[1.4cqw]";
            return (
              <div className={`h-full ${grid}`}>
                {items.map((it, i) => {
                  const itemCue = resolvedOf(`item:${it.id}`);
                  const ip = sampleBlock({ ...b, id: it.id, keys: undefined }, progress, itemCue, sampleOpts);
                  return (
                    <div key={it.id} className={row} style={{ opacity: ip.opacity }}>
                      <ListIndexMark index={i + 1} style={listMark} />
                      <span className="leading-snug" style={{ fontSize: `${set.fontSize ?? 1.8}cqw`, fontFamily: typeFont }}>
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
              className="flex h-full w-full items-center"
              style={{
                fontFamily: typeFont,
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
        <div
          className="pointer-events-none absolute z-20 leading-snug"
          style={{
            left: `${capStyle.insetX}%`,
            right: `${capStyle.insetX}%`,
            top: capStyle.position === "top" ? `${capStyle.insetY}%` : undefined,
            bottom: capStyle.position === "bottom" ? `${capStyle.insetY}%` : undefined,
            textAlign: capStyle.align,
            fontSize: `${capStyle.fontSize}cqw`,
            fontFamily: captionFont,
            fontWeight: capStyle.fontWeight === "bold" ? 700 : capStyle.fontWeight === "medium" ? 500 : 400,
            color: capStyle.color,
            background: capStyle.box === "none" ? "transparent" : hexAlpha(capStyle.bg, capStyle.bgOpacity),
            borderRadius: capStyle.box === "pill" ? 999 : capStyle.box === "bar" ? "0.5cqw" : 0,
            padding: `${capStyle.paddingY}cqw ${capStyle.paddingX}cqw`,
            backdropFilter: capStyle.blur && capStyle.box !== "none" ? "blur(8px)" : undefined,
            textShadow: capStyle.outline ? "0 0.06cqw 0.18cqw #000, 0 0 0.35cqw rgba(0,0,0,.85)" : undefined,
          }}
        >
          {cap}
        </div>
      )}
    </div>
  );
}
