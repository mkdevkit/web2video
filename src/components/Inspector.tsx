import { useState } from "react";
import { pickImageFile } from "../lib/insertImage";
import { sceneBlocks } from "../lib/blocks";
import { cueBind, cueKeyProgress, cueStay, resolveCueOnScene } from "../lib/cues";
import { mergedSettings, restPose } from "../lib/interpolate";
import { itemText, sourceLangOf, textOf } from "../lib/textI18n";
import { composeNarration, itemSpeakKey, speakText } from "../lib/narration";
import {
  formatMs,
  sceneAt,
  sceneClosePadAfterMs,
  sceneClosePadBeforeMs,
  sceneClock,
  sceneHoldMs,
  sceneOpenPadAfterMs,
  sceneOpenPadBeforeMs,
  sceneOverridesTiming,
  sceneTransitionKind,
  sceneTransitionMs,
} from "../lib/timeline";
import { synthScenes } from "../lib/synthProject";
import { BLOCK_TYPES, LAYOUTS, type AnimKind, type CueBind, type Scene, type SceneTransition } from "../types";
import { useEditor } from "../store/useEditor";
import { Field } from "./ui";
import type { LangId } from "../lib/langs";
import type { LayoutBlock } from "../types";

const ANIMS: { id: AnimKind; label: string }[] = [
  { id: "fade", label: "淡入" },
  { id: "slide", label: "滑入" },
  { id: "scale", label: "缩放" },
  { id: "kenburns", label: "Ken Burns" },
  { id: "highlight", label: "高亮" },
];

function secInput(ms: number) {
  return Number((Math.max(0, ms) / 1000).toFixed(2));
}

function parseSec(raw: string, max = 30) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 1000);
}

function parseSignedSec(raw: string, min = -5, max = 10) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(min, n)) * 1000);
}

function secSigned(ms: number) {
  return Number((ms / 1000).toFixed(2));
}

function SlotField({
  scene,
  lang,
  source,
  field,
  label,
  rows = 2,
}: {
  scene: Scene;
  lang: LangId;
  source: LangId;
  field: "title" | "subtitle" | "body" | "caption" | "quote" | "author" | "number" | "narration" | "narrationClose";
  label: string;
  rows?: number;
}) {
  const value =
    field === "narration"
      ? textOf(scene.narration, lang, source)
      : field === "narrationClose"
        ? textOf(scene.narrationClose, lang, source)
        : textOf(scene.slots[field], lang, source);
  return (
    <Field label={label}>
      <textarea
        className="field min-h-[52px]"
        rows={rows}
        value={value}
        onChange={(e) => useEditor.getState().patchSlotText(scene.id, field, e.target.value)}
      />
    </Field>
  );
}

function SceneInspector({ scene }: { scene: Scene }) {
  const project = useEditor((s) => s.project);
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
      <div className="section-label">场景</div>
      <Field label="名称">
        <input className="field" value={scene.name} onChange={(e) => useEditor.getState().renameScene(scene.id, e.target.value)} />
      </Field>
      <div className="mt-2">
        <Field label="版面模板">
          <select
            className="field"
            value={scene.layoutId}
            onChange={(e) => useEditor.getState().setLayout(scene.id, e.target.value as (typeof LAYOUTS)[number]["id"])}
          >
            {LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <div className="section-label">切场</div>
        <Field label="片级默认 · 口播后停留（秒）">
          <input
            type="number"
            min={0}
            max={30}
            step={0.1}
            className="field"
            value={secInput(project.holdMs)}
            onChange={(e) => useEditor.getState().updateProject({ holdMs: parseSec(e.target.value) })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-1">
          <Field label="切场方式">
            <select
              className="field"
              value={project.transition}
              onChange={(e) => useEditor.getState().updateProject({ transition: e.target.value as SceneTransition })}
            >
              <option value="cut">硬切</option>
              <option value="crossfade">交叉淡化</option>
            </select>
          </Field>
          <Field label="叠化时长（秒）">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="field"
              disabled={project.transition !== "crossfade"}
              value={secInput(project.transitionMs)}
              onChange={(e) => useEditor.getState().updateProject({ transitionMs: parseSec(e.target.value, 5) })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-ink-200">
          <input
            type="checkbox"
            checked={sceneOverridesTiming(scene)}
            onChange={(e) => {
              if (e.target.checked) {
                useEditor.getState().patchScene(scene.id, {
                  holdMs: sceneHoldMs(scene, project),
                  transition: sceneTransitionKind(scene, project),
                  transitionMs: sceneTransitionMs(scene, project),
                  openPadBeforeMs: sceneOpenPadBeforeMs(scene, project),
                  openPadAfterMs: sceneOpenPadAfterMs(scene, project),
                  closePadBeforeMs: sceneClosePadBeforeMs(scene, project),
                  closePadAfterMs: sceneClosePadAfterMs(scene, project),
                });
              } else {
                useEditor.getState().patchScene(scene.id, (s) => {
                  const next = { ...s };
                  delete next.holdMs;
                  delete next.transition;
                  delete next.transitionMs;
                  delete next.openPadBeforeMs;
                  delete next.openPadAfterMs;
                  delete next.closePadBeforeMs;
                  delete next.closePadAfterMs;
                  return next;
                });
              }
            }}
          />
          本场单独设置
        </label>
        {sceneOverridesTiming(scene) && (
          <>
            <Field label="本场 · 口播后停留（秒）">
              <input
                type="number"
                min={0}
                max={30}
                step={0.1}
                className="field"
                value={secInput(sceneHoldMs(scene, project))}
                onChange={(e) => useEditor.getState().patchScene(scene.id, { holdMs: parseSec(e.target.value) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-1">
              <Field label="开场前空白（秒）">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  className="field"
                  value={secInput(sceneOpenPadBeforeMs(scene, project))}
                  onChange={(e) => useEditor.getState().patchScene(scene.id, { openPadBeforeMs: parseSec(e.target.value, 10) })}
                />
              </Field>
              <Field label="开场后空白（秒）">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  className="field"
                  value={secInput(sceneOpenPadAfterMs(scene, project))}
                  onChange={(e) => useEditor.getState().patchScene(scene.id, { openPadAfterMs: parseSec(e.target.value, 10) })}
                />
              </Field>
              <Field label="结束前空白（秒）">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  className="field"
                  value={secInput(sceneClosePadBeforeMs(scene, project))}
                  onChange={(e) => useEditor.getState().patchScene(scene.id, { closePadBeforeMs: parseSec(e.target.value, 10) })}
                />
              </Field>
              <Field label="结束后空白（秒）">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  className="field"
                  value={secInput(sceneClosePadAfterMs(scene, project))}
                  onChange={(e) => useEditor.getState().patchScene(scene.id, { closePadAfterMs: parseSec(e.target.value, 10) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Field label="切场方式">
                <select
                  className="field"
                  value={sceneTransitionKind(scene, project)}
                  onChange={(e) => useEditor.getState().patchScene(scene.id, { transition: e.target.value as SceneTransition })}
                >
                  <option value="cut">硬切</option>
                  <option value="crossfade">交叉淡化</option>
                </select>
              </Field>
              <Field label="叠化时长（秒）">
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  className="field"
                  disabled={sceneTransitionKind(scene, project) !== "crossfade"}
                  value={secInput(sceneTransitionMs(scene, project))}
                  onChange={(e) => useEditor.getState().patchScene(scene.id, { transitionMs: parseSec(e.target.value, 5) })}
                />
              </Field>
            </div>
          </>
        )}
        <p className="text-[10px] leading-relaxed text-ink-400">
          时长 = 开场（冻第一帧）+ 空白 + 主体动画/元件口播 + 结束（冻最后一帧）+ 停留。叠化发生在本场末尾；配音不会交叉。
        </p>
        <button
          className="btn w-full"
          onClick={() => {
            useEditor.getState().updateProject({
              scenes: project.scenes.map((s) => {
                const next = { ...s };
                delete next.holdMs;
                delete next.transition;
                delete next.transitionMs;
                delete next.openPadBeforeMs;
                delete next.openPadAfterMs;
                delete next.closePadBeforeMs;
                delete next.closePadAfterMs;
                return next;
              }),
            });
          }}
        >
          全部场景跟随片级默认
        </button>
      </div>
      <button
        className="btn btn-accent mt-3 w-full"
        disabled={busy}
        onClick={() => {
          setErr("");
          setBusy(true);
          void synthScenes([scene.id], lang)
            .catch((e) => setErr(e instanceof Error ? e.message : "合成失败"))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "合成中…" : "合成此场景配音"}
      </button>
      {err && <p className="mt-1 text-[11px] text-red-400">{err}</p>}
      <div className="mt-3 space-y-2">
        <div className="section-label">口播</div>
        <SlotField scene={scene} lang={lang} source={source} field="narration" label="开场口播（钉在第一帧）" rows={3} />
        <SlotField scene={scene} lang={lang} source={source} field="narrationClose" label="结束口播（钉在最后一帧）" rows={2} />
        <div className="grid grid-cols-2 gap-1">
          <Field label="片级 · 开场前空白（秒）">
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="field"
              value={secInput(project.openPadBeforeMs)}
              onChange={(e) => useEditor.getState().updateProject({ openPadBeforeMs: parseSec(e.target.value, 10) })}
            />
          </Field>
          <Field label="开场后空白（秒）">
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="field"
              value={secInput(project.openPadAfterMs)}
              onChange={(e) => useEditor.getState().updateProject({ openPadAfterMs: parseSec(e.target.value, 10) })}
            />
          </Field>
          <Field label="结束前空白（秒）">
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="field"
              value={secInput(project.closePadBeforeMs)}
              onChange={(e) => useEditor.getState().updateProject({ closePadBeforeMs: parseSec(e.target.value, 10) })}
            />
          </Field>
          <Field label="结束后空白（秒）">
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="field"
              value={secInput(project.closePadAfterMs)}
              onChange={(e) => useEditor.getState().updateProject({ closePadAfterMs: parseSec(e.target.value, 10) })}
            />
          </Field>
        </div>
        <p className="text-[10px] leading-relaxed text-ink-400">
          开场口播在第一帧播完后，才开始动画和元件口播。结束口播在全部元件口播之后、钉在最后一帧。空白为静音。无开场/结束口播时不插入空白。本场覆盖请勾选上方「本场单独设置」。有口播的元件默认跟该语言的那一句入场；切预览语言后色块会跟着变长。
        </p>
        <Field label="将合成的全文（只读）">
          <textarea className="field min-h-[64px] text-ink-400" rows={3} readOnly value={composeNarration(scene, lang, source)} />
        </Field>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        在左侧检视或舞台上点选元件，右侧会只显示该元件的属性。
      </p>
    </>
  );
}

function BlockInspector({ scene, block }: { scene: Scene; block: LayoutBlock }) {
  const project = useEditor((s) => s.project);
  const selectedCueId = useEditor((s) => s.selectedCueId);
  const playheadMs = useEditor((s) => s.playheadMs);
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const at = sceneAt(project, lang, playheadMs);
  const sceneProgress = at && at.scene.id === scene.id && at.animDurationMs ? at.animLocalMs / at.animDurationMs : 0;
  const blockCueRaw = scene.cues.find((c) => c.target === block.id);
  const blockCue = blockCueRaw ? resolveCueOnScene(blockCueRaw, scene, lang, source, project) : undefined;
  const progress = cueKeyProgress(sceneProgress, blockCue);
  const set = mergedSettings(block);
  const typeLabel = BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type;
  const cues = scene.cues.filter(
    (c) => c.target === block.id || (block.type === "list" && c.target.startsWith("item:")),
  );

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="section-label mb-0">元件 · {typeLabel}</div>
        <button className="btn py-0.5 text-[10px]" onClick={() => useEditor.getState().setSelectedBlock(null)}>
          场景属性
        </button>
      </div>
      <Field label="名称">
        <input
          className="field"
          value={block.name ?? ""}
          placeholder={typeLabel}
          onChange={(e) => useEditor.getState().patchBlock(scene.id, block.id, { name: e.target.value })}
        />
      </Field>
      {block.type !== "image" && block.type !== "shape" && block.type !== "list" && (
        <div className="mt-2">
          <SlotField scene={scene} lang={lang} source={source} field={block.type as "title"} label="内容" />
        </div>
      )}
      {block.type !== "list" && (
        <div className="mt-2">
          <Field label="口播（空则跳过）">
            <textarea
              className="field min-h-[52px]"
              rows={2}
              value={speakText(scene, block.id, lang, source)}
              onChange={(e) => useEditor.getState().patchSpeak(scene.id, block.id, e.target.value)}
            />
          </Field>
          {block.type !== "image" && block.type !== "shape" && (
            <button
              className="btn mt-1 w-full"
              onClick={() => {
                const copy = textOf(scene.slots[block.type as "title"], lang, source);
                if (copy.trim()) useEditor.getState().patchSpeak(scene.id, block.id, copy);
              }}
            >
              用画面文案填口播
            </button>
          )}
        </div>
      )}
      {block.type === "list" && (
        <div className="mt-2">
          <Field label="列表导语口播（空则跳过）">
            <textarea
              className="field min-h-[44px]"
              rows={2}
              value={speakText(scene, block.id, lang, source)}
              onChange={(e) => useEditor.getState().patchSpeak(scene.id, block.id, e.target.value)}
            />
          </Field>
          <div className="mb-1 mt-2 flex items-center justify-between">
            <span className="text-[10px] text-ink-400">列表项（画面 + 口播）</span>
            <button className="btn py-0.5" onClick={() => useEditor.getState().addItem(scene.id)}>
              添加
            </button>
          </div>
          {(scene.slots.items ?? []).map((it, i) => {
            const cue = scene.cues.find((c) => c.target === `item:${it.id}`);
            const active = selectedCueId === cue?.id;
            const key = itemSpeakKey(it.id);
            return (
              <div
                key={it.id}
                className={`mb-2 space-y-1 rounded border px-1.5 py-1.5 ${active ? "border-brass/50 bg-ink-700" : "border-ink-600"}`}
                onClick={() => cue && useEditor.getState().setSelectedCue(cue.id)}
              >
                <div className="flex gap-1">
                  <textarea
                    className="field min-h-[36px]"
                    placeholder={`画面 ${i + 1}`}
                    value={itemText(it, lang, source)}
                    onChange={(e) => useEditor.getState().patchItemText(scene.id, it.id, e.target.value)}
                  />
                  <button className="btn shrink-0 px-1.5" onClick={() => useEditor.getState().removeItem(scene.id, it.id)}>
                    ×
                  </button>
                </div>
                <textarea
                  className="field min-h-[36px]"
                  placeholder="口播（空则跳过）"
                  value={speakText(scene, key, lang, source)}
                  onChange={(e) => useEditor.getState().patchSpeak(scene.id, key, e.target.value)}
                />
                <button
                  className="btn w-full py-0.5"
                  onClick={() => {
                    const copy = itemText(it, lang, source);
                    if (copy.trim()) useEditor.getState().patchSpeak(scene.id, key, copy);
                  }}
                >
                  用画面填口播
                </button>
              </div>
            );
          })}
          <Field label="排列">
            <select
              className="field"
              value={set.listLayout ?? "stack"}
              onChange={(e) =>
                useEditor.getState().patchBlockSettings(scene.id, block.id, { listLayout: e.target.value as "stack" | "row" | "grid" })
              }
            >
              <option value="stack">纵向</option>
              <option value="row">横向</option>
              <option value="grid">宫格</option>
            </select>
          </Field>
        </div>
      )}
      {block.type === "image" && (
        <button className="btn mt-2 w-full" onClick={() => void pickImageFile().then((src) => src && useEditor.getState().setImage(scene.id, src))}>
          更换配图
        </button>
      )}
      {(block.type === "title" ||
        block.type === "subtitle" ||
        block.type === "body" ||
        block.type === "caption" ||
        block.type === "quote" ||
        block.type === "author" ||
        block.type === "number" ||
        block.type === "list") && (
        <>
          <Field label={`字号 ${set.fontSize}`}>
            <input
              type="range"
              min={1}
              max={12}
              step={0.1}
              className="w-full"
              value={set.fontSize ?? 2}
              onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { fontSize: Number(e.target.value) })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-1">
            <Field label="颜色">
              <input
                className="field h-8"
                type="color"
                value={set.color ?? "#f3eee3"}
                onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { color: e.target.value })}
              />
            </Field>
            <Field label="对齐">
              <select
                className="field"
                value={set.align}
                onChange={(e) =>
                  useEditor.getState().patchBlockSettings(scene.id, block.id, { align: e.target.value as "left" | "center" | "right" })
                }
              >
                <option value="left">左</option>
                <option value="center">中</option>
                <option value="right">右</option>
              </select>
            </Field>
          </div>
        </>
      )}
      {block.type === "shape" && (
        <Field label="填充">
          <input
            className="field h-8"
            type="color"
            value={set.fill ?? "#c45c26"}
            onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { fill: e.target.value })}
          />
        </Field>
      )}
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Field label="圆角">
          <input
            type="number"
            className="field"
            value={set.radius ?? 0}
            onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { radius: Number(e.target.value) })}
          />
        </Field>
        <Field label="旋转">
          <input
            type="number"
            className="field"
            value={set.rotation ?? 0}
            onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { rotation: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label={`不透明度 ${Math.round((set.opacity ?? 1) * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          className="w-full"
          value={set.opacity ?? 1}
          onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { opacity: Number(e.target.value) })}
        />
      </Field>
      <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-200">
        <input
          type="checkbox"
          checked={Boolean(set.shadow)}
          onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { shadow: e.target.checked })}
        />
        阴影
      </label>
      <button className="btn mt-2 w-full text-red-300" onClick={() => useEditor.getState().removeBlock(scene.id, block.id)}>
        删除此元件
      </button>
      <div className="section-label mt-3">关键帧（插值）</div>
      <p className="text-[10px] text-ink-400">拖动播放头后再拖舞台，会在当前元件在场时段写入关键帧。</p>
      <button
        className="btn mt-1 w-full"
        onClick={() => {
          const pose = restPose(block);
          useEditor.getState().commit();
          useEditor.getState().writeBlockTransform(scene.id, block.id, pose, progress);
        }}
      >
        在当前时间打关键帧
      </button>
      <div className="mt-1 space-y-1">
        {(block.keys ?? []).map((k) => (
          <div key={k.t} className="flex items-center gap-1 text-[10px]">
            <button
              className="btn flex-1 py-0.5"
              onClick={() => {
                const start = at?.startMs ?? 0;
                const bodyStart = (at?.localMs ?? 0) - (at?.animLocalMs ?? 0);
                const dur = at?.animDurationMs ?? 1;
                const span = blockCue ? (blockCue.until ?? 1) - blockCue.at : 1;
                const t = blockCue ? blockCue.at + k.t * span : k.t;
                useEditor.getState().setPlayhead(start + bodyStart + t * dur);
              }}
            >
              t={k.t.toFixed(2)}
            </button>
            <button className="btn px-1.5 py-0.5" onClick={() => useEditor.getState().removeBlockKey(scene.id, block.id, k.t)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="section-label">入场窗口</div>
        {cues.map((cue) => {
          const bind = cueBind(cue, scene, source);
          const resolved = resolveCueOnScene(cue, scene, lang, source, project);
          const bodyMs = sceneClock(scene, lang, project).bodyMs;
          return (
          <div
            key={cue.id}
            className={`mb-1 rounded border px-1.5 py-1 text-[11px] ${selectedCueId === cue.id ? "border-brass/50 bg-ink-700" : "border-ink-600"}`}
            onClick={() => useEditor.getState().setSelectedCue(cue.id)}
          >
            <div className="mb-1 flex items-center gap-1">
              <span className="w-14 truncate text-ink-400">{cue.target.replace("item:", "条:")}</span>
              <select
                className="field flex-1 py-0.5"
                value={cue.anim}
                onChange={(e) => useEditor.getState().setCueAnim(scene.id, cue.id, e.target.value as AnimKind)}
              >
                {ANIMS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <Field label="入场跟随">
              <select
                className="field py-0.5"
                value={bind}
                onChange={(e) => useEditor.getState().setCueBind(scene.id, cue.id, e.target.value as CueBind)}
              >
                <option value="speak">跟口播（当前语言的那一句）</option>
                <option value="visual">跟画面（主体 0–1，各语言拉伸）</option>
              </select>
            </Field>
            {bind === "speak" ? (
              <div className="mt-1 space-y-1 text-[10px] text-ink-400">
                <label className="flex items-center gap-1.5">
                  <span className="w-24 shrink-0">提前出现（秒）</span>
                  <input
                    type="number"
                    min={-5}
                    max={10}
                    step={0.1}
                    className="field py-0.5"
                    value={secSigned(cue.leadMs ?? 0)}
                    onChange={(e) => useEditor.getState().patchCue(scene.id, cue.id, { leadMs: parseSignedSec(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cueStay(cue) === "body"}
                    onChange={(e) =>
                      useEditor.getState().patchCue(scene.id, cue.id, { stay: e.target.checked ? "body" : "speech" })
                    }
                  />
                  留到主体结束
                </label>
                {cueStay(cue) === "speech" && (
                  <label className="flex items-center gap-1.5">
                    <span className="w-24 shrink-0">结束后再留（秒）</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      className="field py-0.5"
                      value={secInput(cue.trailMs ?? 0)}
                      onChange={(e) => useEditor.getState().patchCue(scene.id, cue.id, { trailMs: parseSec(e.target.value, 10) })}
                    />
                  </label>
                )}
                <p className="text-[10px] text-ink-500">
                  本语言：{formatMs(resolved.at * bodyMs)} – {formatMs(resolved.until * bodyMs)}
                </p>
              </div>
            ) : (
            <div className="min-w-0 space-y-1 text-[10px] text-ink-400">
              <label className="flex min-w-0 items-center gap-1.5">
                <span className="w-4 shrink-0">入</span>
                <input
                  type="range"
                  min={0}
                  max={98}
                  className="min-w-0 flex-1"
                  value={Math.round(resolved.at * 100)}
                  onChange={(e) => useEditor.getState().setCueRange(scene.id, cue.id, Number(e.target.value) / 100, resolved.until)}
                />
                <span className="w-8 shrink-0 text-right font-mono">{Math.round(resolved.at * 100)}%</span>
              </label>
              <label className="flex min-w-0 items-center gap-1.5">
                <span className="w-4 shrink-0">出</span>
                <input
                  type="range"
                  min={2}
                  max={100}
                  className="min-w-0 flex-1"
                  value={Math.round(resolved.until * 100)}
                  onChange={(e) => useEditor.getState().setCueRange(scene.id, cue.id, resolved.at, Number(e.target.value) / 100)}
                />
                <span className="w-8 shrink-0 text-right font-mono">{Math.round(resolved.until * 100)}%</span>
              </label>
            </div>
            )}
          </div>
          );
        })}
        {cues.length === 0 && <p className="text-[10px] text-ink-400">此元件还没有入场窗口。</p>}
      </div>
    </>
  );
}

export function Inspector() {
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const scene = project.scenes.find((s) => s.id === currentSceneId);

  if (!scene) return <aside className="w-72 shrink-0 border-l border-ink-600 bg-ink-900" />;

  const block = selectedBlockId ? sceneBlocks(scene).find((b) => b.id === selectedBlockId) : undefined;

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-auto border-l border-ink-600 bg-ink-900 p-3">
      {block ? <BlockInspector scene={scene} block={block} /> : <SceneInspector scene={scene} />}
    </aside>
  );
}
