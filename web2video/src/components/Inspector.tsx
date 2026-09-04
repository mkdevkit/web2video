import { useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";
import { pickGifFile, pickImageFile, pickVideoFile } from "../lib/insertImage";
import { DEFAULT_THREE_SRC } from "../lib/threePreset";
import { alignBlockBox, boxAlignActive, sceneBlocks, type BoxAlign } from "../lib/blocks";
import { mergedSettings, restPose } from "../lib/interpolate";
import { itemText, sourceLangOf, textOf, writeI18n } from "../lib/textI18n";
import { itemSpeakKey } from "../lib/speaks";
import { asCssHex, sceneBgDim, sceneBgFit } from "../lib/templates";
import {
  sceneAt,
  sceneCalendar,
  sceneClosePadAfterMs,
  sceneClosePadBeforeMs,
  sceneHoldMs,
  sceneOpenPadAfterMs,
  sceneOpenPadBeforeMs,
  sceneOverridesTiming,
  sceneTransitionKind,
  sceneTransitionMs,
} from "../lib/timeline";
import { driveOf, playTargetChoices } from "../lib/calendar";
import { blockWindow, windowProgress } from "../lib/effects";
import { synthScenes } from "../lib/synthProject";
import { BLOCK_TYPES, LAYOUTS, type DriveMode, type DialogueSide, type Scene, type SceneTransition, type StageFontId } from "../types";
import { useEditor } from "../store/useEditor";
import { Field } from "./ui";
import type { LangId } from "../lib/langs";
import type { LayoutBlock, TimeRef } from "../types";
import { STAGE_FONTS, blockFontId, stageFont } from "../lib/fonts";
import { EffectList, TimeRefFields } from "./EffectEditor";
import { SpeakTrackEditor } from "./SpeakTrackEditor";

function secInput(ms: number) {
  return Number((Math.max(0, ms) / 1000).toFixed(2));
}

function parseSec(raw: string, max = 30) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 1000);
}

function isMediaType(type: string) {
  return type === "image" || type === "video" || type === "gif";
}

function AlignBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      className={`btn h-7 flex-1 p-0 ${active ? "border-brass/50 bg-ink-600" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
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
  field: "title" | "subtitle" | "body" | "caption" | "quote" | "author" | "number";
  label: string;
  rows?: number;
}) {
  const value = textOf(scene.slots[field], lang, source);
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [synthLine, setSynthLine] = useState("");

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
      <div className="mt-2">
        <Field label="时钟">
          <select
            className="field"
            value={driveOf(scene)}
            onChange={(e) => useEditor.getState().patchScene(scene.id, { drive: e.target.value as DriveMode })}
          >
            <option value="narration">口播驱动（列表顺序就是时钟）</option>
            <option value="config">配置驱动（播放元件 + 动效锚点）</option>
          </select>
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <div className="section-label">背景</div>
        <div className="grid grid-cols-2 gap-1">
          <Field label="背景色">
            <div className="flex gap-1">
              <input
                className="field h-8 w-10 shrink-0 p-0.5"
                type="color"
                value={asCssHex(scene.bg)}
                onChange={(e) => useEditor.getState().patchScene(scene.id, { bg: e.target.value }, false)}
              />
              <input
                className="field"
                value={scene.bg}
                onChange={(e) => useEditor.getState().patchScene(scene.id, { bg: e.target.value }, false)}
              />
            </div>
          </Field>
          <Field label="铺满">
            <select
              className="field"
              value={sceneBgFit(scene)}
              disabled={!scene.bgImage}
              onChange={(e) =>
                useEditor.getState().patchScene(scene.id, { bgFit: e.target.value as "cover" | "contain" }, false)
              }
            >
              <option value="cover">铺满裁切</option>
              <option value="contain">完整显示</option>
            </select>
          </Field>
        </div>
        <Field label={`遮罩 ${Math.round(sceneBgDim(scene) * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            className="w-full"
            value={sceneBgDim(scene)}
            onChange={(e) => useEditor.getState().patchScene(scene.id, { bgDim: Number(e.target.value) }, false)}
          />
        </Field>
        {scene.bgImage && (
          <img src={scene.bgImage} alt="" className="h-16 w-full rounded border border-ink-600 object-cover" />
        )}
        <div className="flex gap-1">
          <button
            className="btn flex-1"
            onClick={() =>
              void pickImageFile().then((src) => src && useEditor.getState().patchScene(scene.id, { bgImage: src }))
            }
          >
            {scene.bgImage ? "更换背景图" : "选择背景图"}
          </button>
          {scene.bgImage && (
            <button
              className="btn"
              onClick={() =>
                useEditor.getState().patchScene(scene.id, (s) => {
                  const next = { ...s };
                  delete next.bgImage;
                  return next;
                })
              }
            >
              清除
            </button>
          )}
        </div>
        <p className="text-[10px] leading-relaxed text-ink-400">
          背景图铺在整场后面，和版面里的「图片」元件分开。无图时显示底色。遮罩压暗背景，方便看清文字。
        </p>
      </div>
      <button className="btn mt-2 w-full" onClick={() => useEditor.getState().setDialog("prefs")}>
        全局配置：字体 / 字幕 / 列表
      </button>
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
        {driveOf(scene) === "config" && (
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
        )}
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
                  ...(driveOf(scene) === "config"
                    ? {
                        openPadBeforeMs: sceneOpenPadBeforeMs(scene, project),
                        openPadAfterMs: sceneOpenPadAfterMs(scene, project),
                        closePadBeforeMs: sceneClosePadBeforeMs(scene, project),
                        closePadAfterMs: sceneClosePadAfterMs(scene, project),
                      }
                    : {}),
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
            {driveOf(scene) === "config" && (
              <div className="grid grid-cols-2 gap-1">
                <Field label="本场 · 开场前空白（秒）">
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
            )}
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
          口播驱动：口播列表播完后加停留再切场。配置驱动：开场/结束空白 + 播放元件与动效全部结束后切场（可加停留）。叠化发生在本场末尾。
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
          setSynthLine("");
          setBusy(true);
          void synthScenes([scene.id], lang, (p) => setSynthLine(p.text))
            .catch((e) => setErr(e instanceof Error ? e.message : "合成失败"))
            .finally(() => {
              setBusy(false);
              setSynthLine("");
            });
        }}
      >
        {busy ? "合成中…" : "合成此场景配音"}
      </button>
      {busy && synthLine && (
        <p className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-300">{synthLine}</p>
      )}
      {err && <p className="mt-1 text-[11px] text-red-400">{err}</p>}
      <div className="mt-3 space-y-2">
        <div className="section-label">口播</div>
        <SpeakTrackEditor scene={scene} />
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
  const cal = sceneCalendar(scene, lang, project);
  const win = blockWindow(block, scene, source, cal);
  const sampleMs = at && at.scene.id === scene.id ? at.localMs : 0;
  const progress = windowProgress(sampleMs, win);
  const set = mergedSettings(block);
  const typeLabel = BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type;
  const applyBoxAlign = (kind: BoxAlign) => {
    const store = useEditor.getState();
    store.commit();
    store.patchBlock(scene.id, block.id, alignBlockBox(block, kind));
  };

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
          value={textOf(block.name, lang, source)}
          placeholder={typeLabel}
          onChange={(e) =>
            useEditor.getState().patchBlock(scene.id, block.id, {
              name: { i18n: writeI18n(block.name?.i18n, lang, source, e.target.value) },
            })
          }
        />
      </Field>
      <div className="mt-2">
        <span className="mb-1 block text-[10px] text-ink-400">画布对齐</span>
        <div className="flex gap-0.5">
          {(
            [
              ["left", "左对齐", AlignHorizontalJustifyStart],
              ["hcenter", "水平居中", AlignHorizontalJustifyCenter],
              ["right", "右对齐", AlignHorizontalJustifyEnd],
              ["stretchX", "铺满宽度", StretchHorizontal],
            ] as const
          ).map(([kind, title, Icon]) => (
            <AlignBtn key={kind} title={title} active={boxAlignActive(block, kind)} onClick={() => applyBoxAlign(kind)}>
              <Icon className="h-3.5 w-3.5" />
            </AlignBtn>
          ))}
        </div>
        <div className="mt-0.5 flex gap-0.5">
          {(
            [
              ["top", "顶对齐", AlignVerticalJustifyStart],
              ["vcenter", "垂直居中", AlignVerticalJustifyCenter],
              ["bottom", "底对齐", AlignVerticalJustifyEnd],
              ["stretchY", "铺满高度", StretchVertical],
            ] as const
          ).map(([kind, title, Icon]) => (
            <AlignBtn key={kind} title={title} active={boxAlignActive(block, kind)} onClick={() => applyBoxAlign(kind)}>
              <Icon className="h-3.5 w-3.5" />
            </AlignBtn>
          ))}
        </div>
      </div>
      {block.type === "play" && (
        <div className="mt-2 space-y-2">
          <Field label="播放哪句口播">
            <select
              className="field"
              value={block.settings?.playTarget ?? ""}
              onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { playTarget: e.target.value })}
            >
              <option value="">（未指定）</option>
              {playTargetChoices(scene, lang, source).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[11px] text-ink-200">
            <input
              type="checkbox"
              checked={!block.settings?.playFrom}
              onChange={(e) =>
                useEditor.getState().patchBlockSettings(
                  scene.id,
                  block.id,
                  e.target.checked ? { playFrom: undefined } : { playFrom: { speakId: "body", anchor: "start", offsetMs: 0 } },
                )
              }
            />
            接在上一句播放之后
          </label>
          {block.settings?.playFrom && (
            <TimeRefFields
              label="开始于"
              value={block.settings.playFrom}
              scene={scene}
              onChange={(playFrom: TimeRef) => useEditor.getState().patchBlockSettings(scene.id, block.id, { playFrom })}
            />
          )}
          <p className="text-[10px] text-ink-400">舞台上不渲染此元件。本场所有播放与动效结束后切到下一场。</p>
        </div>
      )}
      {block.type !== "image" &&
        block.type !== "video" &&
        block.type !== "gif" &&
        block.type !== "shape" &&
        block.type !== "list" &&
        block.type !== "dialogue" &&
        block.type !== "play" &&
        block.type !== "katex" &&
        block.type !== "three" && (
        <div className="mt-2">
          <SlotField scene={scene} lang={lang} source={source} field={block.type as "title"} label="内容" />
        </div>
      )}
      {block.type === "list" && (
        <div className="mt-2">
          <div className="mb-1 mt-2 flex items-center justify-between">
            <span className="text-[10px] text-ink-400">列表项</span>
            <button className="btn py-0.5" onClick={() => useEditor.getState().addItem(scene.id)}>
              添加
            </button>
          </div>
          {(scene.slots.items ?? []).map((it, i) => {
            const cue = scene.cues.find((c) => c.target === `item:${it.id}`);
            const active = selectedCueId === cue?.id;
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
          <p className="text-[10px] text-ink-500">序号样式（颜色、图片、是否显示）在全局配置「列表」里改，全片共用。</p>
        </div>
      )}
      {block.type === "dialogue" && (
        <div className="mt-2">
          <div className="mb-1 mt-2 flex items-center justify-between">
            <span className="text-[10px] text-ink-400">对白</span>
            <button className="btn py-0.5" onClick={() => useEditor.getState().addDialogueLine(scene.id)}>
              添加
            </button>
          </div>
          {(scene.slots.dialogue ?? []).map((it, i) => {
            const cue = scene.cues.find((c) => c.target === `item:${it.id}`);
            const active = selectedCueId === cue?.id;
            return (
              <div
                key={it.id}
                className={`mb-2 space-y-1 rounded border px-1.5 py-1.5 ${active ? "border-brass/50 bg-ink-700" : "border-ink-600"}`}
                onClick={() => cue && useEditor.getState().setSelectedCue(cue.id)}
              >
                <div className="flex gap-1">
                  <select
                    className="field w-[4.5rem] shrink-0 py-0.5"
                    value={it.side}
                    onChange={(e) =>
                      useEditor.getState().patchDialogueLine(scene.id, it.id, { side: e.target.value as DialogueSide })
                    }
                  >
                    <option value="left">左</option>
                    <option value="right">右</option>
                  </select>
                  <input
                    className="field"
                    placeholder="说话人"
                    value={it.name ?? ""}
                    onChange={(e) => useEditor.getState().patchDialogueLine(scene.id, it.id, { name: e.target.value })}
                  />
                  <button className="btn shrink-0 px-1.5" onClick={() => useEditor.getState().removeDialogueLine(scene.id, it.id)}>
                    ×
                  </button>
                </div>
                <textarea
                  className="field min-h-[36px]"
                  placeholder={`对白 ${i + 1}`}
                  value={itemText(it, lang, source)}
                  onChange={(e) => useEditor.getState().patchDialogueText(scene.id, it.id, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}
      {block.type === "katex" && (
        <div className="mt-2 space-y-2">
          <Field label="TeX">
            <textarea
              className="field min-h-[72px] font-mono text-[11px]"
              placeholder="E = mc^{2}"
              value={set.tex ?? ""}
              onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { tex: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-[11px] text-ink-200">
            <input
              type="checkbox"
              checked={set.displayMode !== false}
              onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { displayMode: e.target.checked })}
            />
            独立成行（display）
          </label>
          <p className="text-[10px] text-ink-500">KaTeX 排版，跟元件动效走。字体是 KaTeX 自带（SIL OFL），与成片字体无关。</p>
        </div>
      )}
      {block.type === "three" && (
        <div className="mt-2 space-y-2">
          <Field label="场景脚本">
            <textarea
              className="field min-h-[140px] font-mono text-[10px] leading-snug"
              spellCheck={false}
              value={set.threeSrc ?? ""}
              onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { threeSrc: e.target.value })}
            />
          </Field>
          <button
            type="button"
            className="btn w-full"
            onClick={() => useEditor.getState().patchBlockSettings(scene.id, block.id, { threeSrc: DEFAULT_THREE_SRC })}
          >
            恢复默认场景
          </button>
          <p className="text-[10px] leading-relaxed text-ink-500">
            可用 THREE、scene、camera。可 return function update({"{ t, localMs }"})。t 是本元件窗口 0–1（无动效则跟整场）。预览与导出都按播放头 seek，不要 requestAnimationFrame / play()。只用内置几何，不要编造模型或贴图 URL。
          </p>
        </div>
      )}
      {isMediaType(block.type) && (
        <div className="mt-2 space-y-2">
          <button
            className="btn w-full"
            onClick={() => {
              const pick = block.type === "video" ? pickVideoFile : block.type === "gif" ? pickGifFile : pickImageFile;
              void pick().then((src) => {
                if (!src) return;
                if (block.type === "image" && block.id === "image") useEditor.getState().setImage(scene.id, src);
                else useEditor.getState().patchBlockSettings(scene.id, block.id, { src });
              });
            }}
          >
            {block.type === "video" ? "选择视频" : block.type === "gif" ? "选择 GIF" : "更换配图"}
          </button>
          <Field label="铺满">
            <select
              className="field"
              value={set.objectFit ?? "cover"}
              onChange={(e) =>
                useEditor.getState().patchBlockSettings(scene.id, block.id, { objectFit: e.target.value as "cover" | "contain" })
              }
            >
              <option value="cover">裁切铺满</option>
              <option value="contain">完整显示</option>
            </select>
          </Field>
          {(block.type === "video") && (
            <label className="flex items-center gap-2 text-[11px] text-ink-200">
              <input
                type="checkbox"
                checked={set.loop !== false}
                onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { loop: e.target.checked })}
              />
              循环播放
            </label>
          )}
          <p className="text-[10px] text-ink-500">
            {block.type === "video"
              ? "无声画面，跟场景时间轴走。导出时按当前帧截进视频。建议 MP4 / WebM，不超过 24MB。"
              : block.type === "gif"
                ? "GIF 会动，导出时按当前帧截进视频。文件请控制在 24MB 内。"
                : "也可选 GIF，动画会画进导出。"}
          </p>
        </div>
      )}
      {(block.type === "title" ||
        block.type === "subtitle" ||
        block.type === "body" ||
        block.type === "caption" ||
        block.type === "quote" ||
        block.type === "author" ||
        block.type === "number" ||
        block.type === "list" ||
        block.type === "dialogue" ||
        block.type === "katex") && (
        <>
          {block.type !== "katex" && (
            <Field label="字体">
              <select
                className="field"
                value={block.settings?.fontId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  useEditor.getState().patchBlockSettings(scene.id, block.id, {
                    fontId: v ? (v as StageFontId) : undefined,
                  });
                }}
              >
                <option value="">默认（{stageFont(blockFontId(project, block.type)).label}）</option>
                {STAGE_FONTS.map((f) => (
                  <option key={f.id} value={f.id} title={f.detail}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
                {stageFont(block.settings?.fontId || blockFontId(project, block.type)).detail}
              </p>
            </Field>
          )}
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
          <Field label="颜色">
            <input
              className="field h-8"
              type="color"
              value={set.color ?? "#f3eee3"}
              onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { color: e.target.value })}
            />
          </Field>
          <Field label="文字对齐">
            <div className="flex gap-0.5">
              {(
                [
                  ["left", "左对齐", AlignLeft],
                  ["center", "居中", AlignCenter],
                  ["right", "右对齐", AlignRight],
                ] as const
              ).map(([id, title, Icon]) => (
                <AlignBtn
                  key={id}
                  title={title}
                  active={set.align === id}
                  onClick={() => useEditor.getState().patchBlockSettings(scene.id, block.id, { align: id })}
                >
                  <Icon className="h-3.5 w-3.5" />
                </AlignBtn>
              ))}
            </div>
          </Field>
        </>
      )}
      {(block.type === "shape" || block.type === "three") && (
        <Field label={block.type === "three" ? "场景底色" : "填充"}>
          <input
            className="field h-8"
            type="color"
            value={set.fill && set.fill !== "transparent" ? set.fill : block.type === "three" ? "#141811" : "#c45c26"}
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
      {block.type !== "play" && (
      <>
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
                const span = win ? win.endMs - win.startMs : 1;
                useEditor.getState().setPlayhead(start + (win?.startMs ?? 0) + k.t * span);
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
      </>
      )}
      {block.type !== "play" && (
      <div className="mt-3">
        <div className="section-label">动效</div>
        <p className="text-[10px] leading-relaxed text-ink-400">
          可配多条。起点和终点可选用口播、场景锚点、固定时间；终点也可设为时长。
        </p>
        <EffectList scene={scene} block={block} />
        {block.type === "list" &&
          (scene.slots.items ?? []).map((it, i) => (
            <div key={it.id} className="mt-2">
              <div className="text-[10px] text-ink-400">条目 {i + 1} 动效</div>
              <EffectList scene={scene} block={block} target={itemSpeakKey(it.id)} />
            </div>
          ))}
        {block.type === "dialogue" &&
          (scene.slots.dialogue ?? []).map((it, i) => (
            <div key={it.id} className="mt-2">
              <div className="text-[10px] text-ink-400">对白 {i + 1} 动效</div>
              <EffectList scene={scene} block={block} target={itemSpeakKey(it.id)} />
            </div>
          ))}
      </div>
      )}
    </>
  );
}

export function Inspector() {
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const scene = project.scenes.find((s) => s.id === currentSceneId);

  if (!scene) return <div className="p-3 text-[11px] text-ink-400">还没有场景</div>;

  const block = selectedBlockId ? sceneBlocks(scene).find((b) => b.id === selectedBlockId) : undefined;

  return block ? <BlockInspector scene={scene} block={block} /> : <SceneInspector scene={scene} />;
}
