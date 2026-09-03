import { useRef, type CSSProperties, type MouseEvent } from "react";
import { sceneBlocks } from "../lib/blocks";
import { isPlayBlock } from "../lib/calendar";
import { blockWindow, targetWindow } from "../lib/effects";
import { mergedSettings, sampleBlock } from "../lib/interpolate";
import { bilingualCaptionLangOf, captionSecondaryText, itemSpeakKey } from "../lib/narration";
import { captionStyleOf, fontStack, hexAlpha, resolveBlockFont } from "../lib/fonts";
import { itemText, textOf } from "../lib/textI18n";
import { type LangId } from "../lib/langs";
import { sceneCalendar } from "../lib/timeline";
import { captionSpanAt } from "../lib/calendar";
import { MediaFrame } from "./MediaFrame";
import { mediaSrcOf } from "../lib/insertImage";
import { listMarkerRadius, listMarkerStyleOf } from "../lib/listMarker";
import type { LayoutBlock, ListMarkerStyle, Project, Scene } from "../types";

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
  durationMs: _durationMs,
  animLocalMs: _animLocalMs,
  animDurationMs: _animDurationMs,
  phase,
  audioMs: _audioMs,
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
  const cal = sceneCalendar(scene, lang, project);
  const sampleOpts = { freeze: undefined as "start" | "end" | undefined, freezeMs: undefined as number | undefined };
  const sampleT = localMs;
  const winOf = (block: LayoutBlock, target?: string) =>
    target && target !== block.id
      ? targetWindow(target, scene, source, cal, block)
      : blockWindow(block, scene, source, cal);
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
  const blocks = sceneBlocks(scene);
  const skipCaptionPhase =
    phase === "openPad" || phase === "openGap" || phase === "closePad" || phase === "closeGap" || phase === "hold";
  const capSpan = showCaptions && !skipCaptionPhase ? captionSpanAt(cal, localMs) : undefined;
  const cap = capSpan?.text.replace(/\s+/g, " ").trim() ?? "";
  const capOtherLang = bilingualCaptionLangOf(project, lang);
  const cap2 =
    capSpan && cap && capOtherLang ? captionSecondaryText(scene, capSpan.target, capOtherLang, source, cap) : "";
  const cap2Font = capOtherLang ? fontStack(project.captionFontId || project.fontId, capOtherLang) : captionFont;
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
    e.stopPropagation();
    onSelect?.(id);
    if (!editable) return;
    e.preventDefault();
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
      <div
        className="absolute inset-0 z-0"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect?.(null);
        }}
      />
      {blocks.map((b) => {
        if (isPlayBlock(b) && !editable) return null;
        const cueWin = winOf(b);
        const pose = sampleBlock(b, sampleT, isPlayBlock(b) ? { startMs: 0, endMs: cal.totalMs, anim: "fade" } : cueWin, isPlayBlock(b) ? undefined : sampleOpts);
        const set = mergedSettings(b);
        const typeFont = fontStack(resolveBlockFont(project, b), lang);
        const selected = selectedId === b.id;
        const box: CSSProperties = {
          position: "absolute",
          left: `${pose.x}%`,
          top: `${pose.y}%`,
          width: `${pose.w}%`,
          height: `${pose.h}%`,
          zIndex: Math.max(1, b.z ?? 1),
          opacity: pose.opacity,
          transform: `rotate(${pose.rotation}deg)`,
          textAlign: set.align,
          color: set.color,
          padding: `${set.padding ?? 0}cqw`,
          borderRadius: `${set.radius ?? 0}cqw`,
          overflow: selected && editable ? "visible" : "hidden",
          boxShadow: set.shadow ? "0 1cqw 3cqw rgba(0,0,0,.45)" : undefined,
          cursor: editable ? "move" : "pointer",
          pointerEvents: !editable && pose.opacity < 0.04 && !selected ? "none" : undefined,
        };

        const inner = (() => {
          if (b.type === "play") {
            const tgt = (b.settings?.playTarget ?? "").trim();
            return (
              <div className="flex h-full w-full items-center justify-center rounded-[0.6cqw] border border-dashed border-brass/50 bg-ink-950/40 text-[1.4cqw] text-brass">
                ▶ {tgt || "播放口播"}
              </div>
            );
          }
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
                  const itemCue = winOf(b, itemSpeakKey(it.id));
                  const ip = sampleBlock({ ...b, id: it.id, keys: undefined }, sampleT, itemCue, sampleOpts);
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
                  const itemCue = winOf(b, itemSpeakKey(it.id));
                  const ip = sampleBlock({ ...b, id: it.id, keys: undefined }, sampleT, itemCue, sampleOpts);
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
          <div>{cap}</div>
          {cap2 ? (
            <div
              className="mt-[0.25em]"
              style={{
                fontSize: "0.82em",
                fontFamily: cap2Font,
                fontWeight: 400,
                opacity: 0.92,
              }}
            >
              {cap2}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
