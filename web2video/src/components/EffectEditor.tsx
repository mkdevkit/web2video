import type { AnimKind, BlockEffect, LayoutBlock, Scene, SpeakAnchor, TimeRef } from "../types";
import { speakChoices } from "../lib/calendar";
import { defaultSpeakId, effectsOf, itemEffects, newEffect } from "../lib/effects";
import { sourceLangOf } from "../lib/textI18n";
import { useEditor } from "../store/useEditor";
import { Field } from "./ui";

const ANIMS: { id: AnimKind; label: string }[] = [
  { id: "fade", label: "淡入" },
  { id: "slide", label: "滑入" },
  { id: "scale", label: "缩放" },
  { id: "kenburns", label: "Ken Burns" },
  { id: "highlight", label: "高亮" },
];

function parseSignedSec(raw: string, min = -10, max = 30) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(min, n)) * 1000);
}

function secSigned(ms: number) {
  return Number(((ms ?? 0) / 1000).toFixed(2));
}

export function TimeRefFields({
  label,
  value,
  scene,
  onChange,
}: {
  label: string;
  value: TimeRef;
  scene: Scene;
  onChange: (next: TimeRef) => void;
}) {
  const choices = speakChoices(scene, useEditor.getState().project.previewLang, sourceLangOf(useEditor.getState().project));
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-ink-400">{label}</div>
      <div className="grid grid-cols-[1fr_auto_4.5rem] gap-1">
        <select
          className="field py-0.5"
          value={value.speakId}
          onChange={(e) => onChange({ ...value, speakId: e.target.value })}
        >
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="field py-0.5"
          value={value.anchor}
          onChange={(e) => onChange({ ...value, anchor: e.target.value as SpeakAnchor })}
        >
          <option value="start">开始</option>
          <option value="end">结束</option>
        </select>
        <input
          type="number"
          step={0.1}
          className="field py-0.5"
          title="偏移（秒）"
          value={secSigned(value.offsetMs ?? 0)}
          onChange={(e) => onChange({ ...value, offsetMs: parseSignedSec(e.target.value) })}
        />
      </div>
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
          <label className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
            <input
              type="checkbox"
              checked={Boolean(fx.to)}
              onChange={(e) =>
                setList(
                  list.map((x) =>
                    x.id === fx.id
                      ? e.target.checked
                        ? { ...x, to: x.to ?? { speakId, anchor: "end" as const, offsetMs: 0 }, durationMs: undefined }
                        : { ...x, to: undefined, durationMs: x.durationMs ?? 400 }
                      : x,
                  ),
                )
              }
            />
            用口播锚点作为结束
          </label>
          {fx.to ? (
            <TimeRefFields
              label="到"
              value={fx.to}
              scene={scene}
              onChange={(to) => setList(list.map((x) => (x.id === fx.id ? { ...x, to } : x)))}
            />
          ) : (
            <Field label="时长（秒）">
              <input
                type="number"
                min={0.04}
                step={0.1}
                className="field py-0.5"
                value={secSigned(fx.durationMs ?? 400)}
                onChange={(e) =>
                  setList(list.map((x) => (x.id === fx.id ? { ...x, durationMs: Math.max(40, parseSignedSec(e.target.value, 0, 60)) } : x)))
                }
              />
            </Field>
          )}
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
