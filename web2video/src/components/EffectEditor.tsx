import type { AnimKind, BlockEffect, LayoutBlock, Scene, SpeakAnchor, TimeRef, TimeRefKind } from "../types";
import { playTargetChoices, SPEAK_BODY, SPEAK_SCENE, timeRefKind } from "../lib/calendar";
import { defaultSpeakId, defaultTimeRef, effectsOf, itemEffects, newEffect } from "../lib/effects";
import { sourceLangOf } from "../lib/textI18n";
import { useEditor } from "../store/useEditor";
import { Field } from "./ui";

const ANIMS: { id: AnimKind; label: string }[] = [
  { id: "fade", label: "淡入" },
  { id: "slide", label: "滑入" },
  { id: "scale", label: "缩放" },
  { id: "kenburns", label: "缓推缩放" },
  { id: "highlight", label: "高亮" },
];

type SceneMark = "start" | "end" | "bodyStart" | "bodyEnd";
type EndMode = TimeRefKind | "duration";

function parseSignedSec(raw: string, min = -10, max = 60) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(min, n)) * 1000);
}

function secSigned(ms: number) {
  return Number(((ms ?? 0) / 1000).toFixed(2));
}

function sceneMarkOf(ref: TimeRef): SceneMark {
  if (ref.speakId === SPEAK_BODY) return ref.anchor === "end" ? "bodyEnd" : "bodyStart";
  return ref.anchor === "end" ? "end" : "start";
}

function sceneRef(mark: SceneMark, offsetMs = 0): TimeRef {
  if (mark === "bodyStart") return { kind: "scene", speakId: SPEAK_BODY, anchor: "start", offsetMs };
  if (mark === "bodyEnd") return { kind: "scene", speakId: SPEAK_BODY, anchor: "end", offsetMs };
  if (mark === "end") return { kind: "scene", speakId: SPEAK_SCENE, anchor: "end", offsetMs };
  return { kind: "scene", speakId: SPEAK_SCENE, anchor: "start", offsetMs };
}

function speakRef(speakId: string, anchor: SpeakAnchor, offsetMs = 0): TimeRef {
  return { kind: "speak", speakId, anchor, offsetMs };
}

function fixedRef(atMs: number): TimeRef {
  return { kind: "fixed", speakId: SPEAK_SCENE, anchor: "start", offsetMs: 0, atMs: Math.max(0, atMs) };
}

function switchKind(value: TimeRef, kind: TimeRefKind, fallbackSpeak: string): TimeRef {
  if (kind === "fixed") {
    const at = value.kind === "fixed" ? (value.atMs ?? 0) : value.speakId === SPEAK_SCENE && value.anchor === "start" ? (value.offsetMs ?? 0) : 0;
    return fixedRef(at);
  }
  if (kind === "scene") return sceneRef(value.kind === "scene" ? sceneMarkOf(value) : "start", value.offsetMs ?? 0);
  const id = timeRefKind(value) === "speak" ? value.speakId : fallbackSpeak;
  return speakRef(id || fallbackSpeak, value.anchor ?? "start", value.offsetMs ?? 0);
}

export function TimeRefFields({
  label,
  value,
  scene,
  onChange,
  allowDuration,
  durationMs,
  onDuration,
}: {
  label: string;
  value: TimeRef | null;
  scene: Scene;
  onChange: (next: TimeRef) => void;
  allowDuration?: boolean;
  durationMs?: number;
  onDuration?: (ms: number) => void;
}) {
  const project = useEditor.getState().project;
  const source = sourceLangOf(project);
  const speaks = playTargetChoices(scene, project.previewLang, source);
  const fallbackSpeak = speaks[0]?.id ?? SPEAK_BODY;
  const usingDuration = Boolean(allowDuration && !value);
  const current = value ?? defaultTimeRef(fallbackSpeak);
  const mode: EndMode = usingDuration ? "duration" : timeRefKind(current);

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-ink-400">{label}</div>
      <select
        className="field py-0.5"
        value={usingDuration ? "duration" : mode}
        onChange={(e) => {
          const next = e.target.value as EndMode;
          if (next === "duration") {
            onDuration?.(durationMs && durationMs > 0 ? durationMs : 400);
            return;
          }
          onChange(switchKind(current, next, fallbackSpeak));
        }}
      >
        <option value="speak">口播</option>
        <option value="scene">场景</option>
        <option value="fixed">固定时间</option>
        {allowDuration && <option value="duration">时长</option>}
      </select>
      {usingDuration ? (
        <Field label="持续（秒）">
          <input
            type="number"
            min={0.04}
            step={0.1}
            className="field py-0.5"
            value={secSigned(durationMs ?? 400)}
            onChange={(e) => onDuration?.(Math.max(40, parseSignedSec(e.target.value, 0, 60)))}
          />
        </Field>
      ) : mode === "speak" ? (
        <div className="grid grid-cols-[1fr_auto_4.5rem] gap-1">
          <select
            className="field py-0.5"
            value={speaks.some((c) => c.id === current.speakId) ? current.speakId : (speaks[0]?.id ?? "")}
            onChange={(e) => onChange(speakRef(e.target.value, current.anchor ?? "start", current.offsetMs ?? 0))}
          >
            {!speaks.length && <option value="">（还没有口播）</option>}
            {speaks.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className="field py-0.5"
            value={current.anchor ?? "start"}
            onChange={(e) => onChange(speakRef(current.speakId || fallbackSpeak, e.target.value as SpeakAnchor, current.offsetMs ?? 0))}
          >
            <option value="start">开始</option>
            <option value="end">结束</option>
          </select>
          <input
            type="number"
            step={0.1}
            className="field py-0.5"
            title="偏移（秒）"
            value={secSigned(current.offsetMs ?? 0)}
            onChange={(e) => onChange(speakRef(current.speakId || fallbackSpeak, current.anchor ?? "start", parseSignedSec(e.target.value)))}
          />
        </div>
      ) : mode === "scene" ? (
        <div className="grid grid-cols-[1fr_4.5rem] gap-1">
          <select
            className="field py-0.5"
            value={sceneMarkOf(current)}
            onChange={(e) => onChange(sceneRef(e.target.value as SceneMark, current.offsetMs ?? 0))}
          >
            <option value="start">场景开始</option>
            <option value="end">场景结束</option>
            <option value="bodyStart">主体开始</option>
            <option value="bodyEnd">主体结束</option>
          </select>
          <input
            type="number"
            step={0.1}
            className="field py-0.5"
            title="偏移（秒）"
            value={secSigned(current.offsetMs ?? 0)}
            onChange={(e) => onChange(sceneRef(sceneMarkOf(current), parseSignedSec(e.target.value)))}
          />
        </div>
      ) : (
        <Field label="从场景开始（秒）">
          <input
            type="number"
            min={0}
            step={0.1}
            className="field py-0.5"
            value={secSigned(current.atMs ?? 0)}
            onChange={(e) => onChange(fixedRef(parseSignedSec(e.target.value, 0, 600)))}
          />
        </Field>
      )}
    </div>
  );
}

function writeEffects(sceneId: string, block: LayoutBlock, next: BlockEffect[]) {
  useEditor.getState().patchBlock(sceneId, block.id, { effects: next });
}

export function EffectList({
  scene,
  block,
  target,
}: {
  scene: Scene;
  block: LayoutBlock;
  /** Item key, or omit for the block itself. */
  target?: string;
}) {
  const project = useEditor.getState().project;
  const source = sourceLangOf(project);
  const selectedCueId = useEditor((s) => s.selectedCueId);
  const all = block.effects?.length
    ? block.effects
    : target
      ? itemEffects(scene, target, source, block)
      : effectsOf(block, scene, source);
  const list = target ? all.filter((fx) => fx.target === target) : all.filter((fx) => !fx.target || fx.target === block.id);
  const speakId = target ?? defaultSpeakId(scene, block.id, source);

  const setList = (nextSlice: BlockEffect[]) => {
    const rest = (block.effects?.length ? block.effects : all).filter((fx) =>
      target ? fx.target !== target : Boolean(fx.target) && fx.target !== block.id,
    );
    const tagged = nextSlice.map((fx) => (target ? { ...fx, target } : { ...fx, target: undefined }));
    writeEffects(scene.id, { ...block, effects: all }, [...rest, ...tagged]);
  };

  return (
    <div className="mt-2 space-y-1">
      {list.map((fx, i) => (
        <div
          key={fx.id}
          className={`rounded border px-1.5 py-1.5 ${selectedCueId === fx.id ? "border-brass/50 bg-ink-700" : "border-ink-600"}`}
          onClick={() => useEditor.getState().setSelectedCue(fx.id)}
        >
          <div className="mb-1 flex items-center gap-1">
            <span className="w-8 shrink-0 text-[10px] text-ink-400">#{i + 1}</span>
            <select
              className="field flex-1 py-0.5"
              value={fx.anim}
              onChange={(e) =>
                setList(list.map((x) => (x.id === fx.id ? { ...x, anim: e.target.value as AnimKind } : x)))
              }
            >
              {ANIMS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <button
              className="btn px-1.5 py-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setList(list.filter((x) => x.id !== fx.id));
              }}
            >
              ×
            </button>
          </div>
          <TimeRefFields
            label="从"
            value={fx.from}
            scene={scene}
            onChange={(from) => setList(list.map((x) => (x.id === fx.id ? { ...x, from } : x)))}
          />
          <TimeRefFields
            label="到"
            value={fx.to ?? null}
            scene={scene}
            allowDuration
            durationMs={fx.durationMs}
            onDuration={(durationMs) =>
              setList(list.map((x) => (x.id === fx.id ? { ...x, to: undefined, durationMs } : x)))
            }
            onChange={(to) => setList(list.map((x) => (x.id === fx.id ? { ...x, to, durationMs: undefined } : x)))}
          />
        </div>
      ))}
      <button
        className="btn w-full"
        onClick={() => {
          const seed = list.length ? list : target ? itemEffects(scene, target, source, block) : effectsOf(block, scene, source);
          const next = [...seed, newEffect(speakId, "fade", target)];
          setList(next);
        }}
      >
        添加动效
      </button>
    </div>
  );
}
