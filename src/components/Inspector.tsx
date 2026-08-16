import { useState } from "react";
import { pickImageFile } from "../lib/insertImage";
import { sceneBlocks } from "../lib/blocks";
import { mergedSettings, restPose } from "../lib/interpolate";
import { sourceLangOf, textOf, itemText } from "../lib/textI18n";
import { sceneAt } from "../lib/timeline";
import { synthScenes } from "../lib/synthProject";
import { BLOCK_TYPES, LAYOUTS, type AnimKind, type BlockType } from "../types";
import { useEditor } from "../store/useEditor";
import { Field } from "./ui";

const ANIMS: { id: AnimKind; label: string }[] = [
  { id: "fade", label: "淡入" },
  { id: "slide", label: "滑入" },
  { id: "scale", label: "缩放" },
  { id: "kenburns", label: "Ken Burns" },
  { id: "highlight", label: "高亮" },
];

export function Inspector() {
  const project = useEditor((s) => s.project);
  const currentSceneId = useEditor((s) => s.currentSceneId);
  const selectedCueId = useEditor((s) => s.selectedCueId);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const playheadMs = useEditor((s) => s.playheadMs);
  const scene = project.scenes.find((s) => s.id === currentSceneId);
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [addType, setAddType] = useState<BlockType>("title");

  if (!scene) return <aside className="w-72 shrink-0 border-l border-ink-600 bg-ink-900" />;

  const blocks = sceneBlocks(scene);
  const block = blocks.find((b) => b.id === selectedBlockId);
  const at = sceneAt(project, lang, playheadMs);
  const progress = at && at.scene.id === scene.id && at.durationMs ? at.localMs / at.durationMs : 0;
  const set = block ? mergedSettings(block) : null;

  const slot = (key: "title" | "subtitle" | "body" | "caption" | "quote" | "author" | "number" | "narration", label: string, rows = 2) => (
    <Field label={label}>
      <textarea
        className="field min-h-[52px]"
        rows={rows}
        value={key === "narration" ? textOf(scene.narration, lang, source) : textOf(scene.slots[key], lang, source)}
        onChange={(e) => useEditor.getState().patchSlotText(scene.id, key, e.target.value)}
      />
    </Field>
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-auto border-l border-ink-600 bg-ink-900 p-3">
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
      <div className="mt-2 flex gap-1">
        <select className="field" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)}>
          {BLOCK_TYPES.map((b) => (
            <option key={b.type} value={b.type}>
              {b.label}
            </option>
          ))}
        </select>
        <button className="btn shrink-0" onClick={() => useEditor.getState().addBlock(scene.id, addType)}>
          添加元件
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {blocks.map((b) => (
          <button
            key={b.id}
            className={`btn py-0.5 ${selectedBlockId === b.id ? "btn-accent" : ""}`}
            onClick={() => useEditor.getState().setSelectedBlock(b.id)}
          >
            {b.name || BLOCK_TYPES.find((t) => t.type === b.type)?.label}
          </button>
        ))}
      </div>

      {block && set ? (
        <div className="mt-4 space-y-2">
          <div className="section-label">元件 · {BLOCK_TYPES.find((t) => t.type === block.type)?.label}</div>
          <Field label="名称">
            <input className="field" value={block.name ?? ""} placeholder="可选" onChange={(e) => useEditor.getState().patchBlock(scene.id, block.id, { name: e.target.value })} />
          </Field>
          {block.type !== "image" && block.type !== "shape" && block.type !== "list" && slot(block.type as "title", "内容")}
          {block.type === "list" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-ink-400">列表项（子模块）</span>
                <button className="btn py-0.5" onClick={() => useEditor.getState().addItem(scene.id)}>
                  添加
                </button>
              </div>
              {(scene.slots.items ?? []).map((it, i) => (
                <div key={it.id} className="mb-1 flex gap-1">
                  <textarea className="field min-h-[36px]" value={itemText(it, lang, source)} onChange={(e) => useEditor.getState().patchItemText(scene.id, it.id, e.target.value)} />
                  <button className="btn shrink-0 px-1.5" onClick={() => useEditor.getState().removeItem(scene.id, it.id)}>
                    ×
                  </button>
                  <span className="sr-only">{i + 1}</span>
                </div>
              ))}
              <Field label="排列">
                <select
                  className="field"
                  value={set.listLayout ?? "stack"}
                  onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { listLayout: e.target.value as "stack" | "row" | "grid" })}
                >
                  <option value="stack">纵向</option>
                  <option value="row">横向</option>
                  <option value="grid">宫格</option>
                </select>
              </Field>
            </div>
          )}
          {block.type === "image" && (
            <button className="btn w-full" onClick={() => void pickImageFile().then((src) => src && useEditor.getState().setImage(scene.id, src))}>
              更换配图
            </button>
          )}
          {(block.type === "title" || block.type === "subtitle" || block.type === "body" || block.type === "caption" || block.type === "quote" || block.type === "author" || block.type === "number" || block.type === "list") && (
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
                  <input className="field h-8" type="color" value={set.color ?? "#f3eee3"} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { color: e.target.value })} />
                </Field>
                <Field label="对齐">
                  <select className="field" value={set.align} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { align: e.target.value as "left" | "center" | "right" })}>
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
              <input className="field h-8" type="color" value={set.fill ?? "#c45c26"} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { fill: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-1">
            <Field label="圆角">
              <input type="number" className="field" value={set.radius ?? 0} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { radius: Number(e.target.value) })} />
            </Field>
            <Field label="旋转">
              <input type="number" className="field" value={set.rotation ?? 0} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { rotation: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label={`不透明度 ${Math.round((set.opacity ?? 1) * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} className="w-full" value={set.opacity ?? 1} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { opacity: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-[11px] text-ink-200">
            <input type="checkbox" checked={Boolean(set.shadow)} onChange={(e) => useEditor.getState().patchBlockSettings(scene.id, block.id, { shadow: e.target.checked })} />
            阴影
          </label>
          <button className="btn w-full text-red-300" onClick={() => useEditor.getState().removeBlock(scene.id, block.id)}>
            删除此元件
          </button>
          <div className="section-label mt-2">关键帧（插值）</div>
          <p className="text-[10px] text-ink-400">拖动播放头后再拖舞台，会在当前时间写入关键帧并在两点间插值。</p>
          <button
            className="btn w-full"
            onClick={() => {
              const pose = restPose(block);
              useEditor.getState().commit();
              useEditor.getState().writeBlockTransform(scene.id, block.id, pose, progress);
            }}
          >
            在当前时间打关键帧
          </button>
          <div className="space-y-1">
            {(block.keys ?? []).map((k) => (
              <div key={k.t} className="flex items-center gap-1 text-[10px]">
                <button className="btn flex-1 py-0.5" onClick={() => {
                  const start = at?.startMs ?? 0;
                  const dur = at?.durationMs ?? 1;
                  useEditor.getState().setPlayhead(start + k.t * dur);
                }}>
                  t={k.t.toFixed(2)}
                </button>
                <button className="btn px-1.5 py-0.5" onClick={() => useEditor.getState().removeBlockKey(scene.id, block.id, k.t)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] text-ink-400">在舞台上点选一个元件，或从上方芯片选择。元件可拖动、拉角缩放。</p>
        </div>
      )}

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
      {slot("narration", "口播稿", 3)}
      <div className="mt-3">
        <div className="section-label">入场窗口</div>
        {scene.cues
          .filter((c) => !block || c.target === block.id || c.target.startsWith("item:"))
          .map((cue) => (
            <div
              key={cue.id}
              className={`mb-1 rounded border px-1.5 py-1 text-[11px] ${selectedCueId === cue.id ? "border-brass/50 bg-ink-700" : "border-ink-600"}`}
              onClick={() => useEditor.getState().setSelectedCue(cue.id)}
            >
              <div className="mb-1 flex items-center gap-1">
                <span className="w-14 truncate text-ink-400">{cue.target.replace("item:", "条:")}</span>
                <select className="field flex-1 py-0.5" value={cue.anim} onChange={(e) => useEditor.getState().setCueAnim(scene.id, cue.id, e.target.value as AnimKind)}>
                  {ANIMS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-ink-400">
                <span>入</span>
                <input type="range" min={0} max={98} className="flex-1" value={Math.round(cue.at * 100)} onChange={(e) => useEditor.getState().setCueRange(scene.id, cue.id, Number(e.target.value) / 100, cue.until ?? 1)} />
                <span>出</span>
                <input type="range" min={2} max={100} className="flex-1" value={Math.round((cue.until ?? 1) * 100)} onChange={(e) => useEditor.getState().setCueRange(scene.id, cue.id, cue.at, Number(e.target.value) / 100)} />
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}
