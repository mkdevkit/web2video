import { STAGE_FONTS, captionStyleOf, fontStack, progressStyleOf, stageFont } from "../lib/fonts";
import { useEditor } from "../store/useEditor";
import type { CaptionBox, StageFontId } from "../types";
import { Field } from "./ui";
import type { LangId } from "../lib/langs";

function FontPick({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value: StageFontId;
  onChange: (id: StageFontId) => void;
  lang: LangId;
}) {
  return (
    <Field label={label}>
      <select
        className="field"
        value={value}
        style={{ fontFamily: fontStack(value, lang) }}
        onChange={(e) => onChange(e.target.value as StageFontId)}
      >
        {STAGE_FONTS.map((f) => (
          <option key={f.id} value={f.id} style={{ fontFamily: fontStack(f.id, lang) }}>
            {f.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function FontFields() {
  const project = useEditor((s) => s.project);
  const lang = project.previewLang;
  const set = (patch: Partial<typeof project>) => useEditor.getState().updateProject(patch);

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-ink-400">
        均为 SIL OFL，可商用。中日文不足时回落到 Noto。当前预览语言：按该语言优先选字形。
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <FontPick label="正文 / 列表" value={project.fontId} lang={lang} onChange={(fontId) => set({ fontId })} />
        <FontPick label="标题 / 数字" value={project.titleFontId} lang={lang} onChange={(titleFontId) => set({ titleFontId })} />
        <FontPick
          label="副标题 / 署名"
          value={project.subtitleFontId}
          lang={lang}
          onChange={(subtitleFontId) => set({ subtitleFontId })}
        />
        <FontPick label="金句" value={project.quoteFontId} lang={lang} onChange={(quoteFontId) => set({ quoteFontId })} />
        <FontPick label="口播字幕" value={project.captionFontId} lang={lang} onChange={(captionFontId) => set({ captionFontId })} />
        <FontPick
          label="进度条场次名"
          value={progressStyleOf(project.progressStyle).fontId ?? project.captionFontId}
          lang={lang}
          onChange={(fontId) =>
            set({ progressStyle: { ...progressStyleOf(project.progressStyle), fontId } })
          }
        />
      </div>
      <p className="text-[10px] leading-relaxed text-ink-500">{stageFont(project.fontId).hint}</p>
      <p
        className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-paper"
        style={{ fontFamily: fontStack(project.captionFontId, lang) }}
      >
        字幕预览：黑洞并不是宇宙里的一个洞。
      </p>
    </div>
  );
}

export function CaptionFields() {
  const project = useEditor((s) => s.project);
  const cap = captionStyleOf(project.captionStyle);
  const patchCap = (patch: Partial<typeof cap>, history = false) => {
    useEditor.getState().updateProject({ captionStyle: { ...cap, ...patch } }, history);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-ink-200">
        <input
          type="checkbox"
          checked={project.showCaptions}
          onChange={(e) => useEditor.getState().updateProject({ showCaptions: e.target.checked })}
        />
        显示口播字幕条
      </label>
      <p className="text-[10px] text-ink-500">默认关闭。烧录到画面请在导出里勾选；也可另存字幕文件。字体在「字体」页选。</p>
      {project.showCaptions && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="字幕底">
              <select className="field" value={cap.box} onChange={(e) => patchCap({ box: e.target.value as CaptionBox }, true)}>
                <option value="pill">胶囊</option>
                <option value="bar">色条</option>
                <option value="none">无底</option>
              </select>
            </Field>
            <Field label="位置">
              <select
                className="field"
                value={cap.position}
                onChange={(e) => patchCap({ position: e.target.value as "bottom" | "top" }, true)}
              >
                <option value="bottom">底部</option>
                <option value="top">顶部</option>
              </select>
            </Field>
            <Field label="对齐">
              <select
                className="field"
                value={cap.align}
                onChange={(e) => patchCap({ align: e.target.value as "left" | "center" | "right" }, true)}
              >
                <option value="left">左</option>
                <option value="center">中</option>
                <option value="right">右</option>
              </select>
            </Field>
            <Field label="字重">
              <select
                className="field"
                value={cap.fontWeight}
                onChange={(e) => patchCap({ fontWeight: e.target.value as "normal" | "medium" | "bold" }, true)}
              >
                <option value="normal">常规</option>
                <option value="medium">中等</option>
                <option value="bold">粗</option>
              </select>
            </Field>
            <Field label="背景色">
              <input className="field h-8" type="color" value={cap.bg} onChange={(e) => patchCap({ bg: e.target.value })} />
            </Field>
            <Field label="文字色">
              <input className="field h-8" type="color" value={cap.color} onChange={(e) => patchCap({ color: e.target.value })} />
            </Field>
          </div>
          <Field label={`背景透明度 ${Math.round(cap.bgOpacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full"
              value={cap.bgOpacity}
              onChange={(e) => patchCap({ bgOpacity: Number(e.target.value) })}
            />
          </Field>
          <Field label={`字号 ${cap.fontSize.toFixed(1)}`}>
            <input
              type="range"
              min={1}
              max={3.5}
              step={0.1}
              className="w-full"
              value={cap.fontSize}
              onChange={(e) => patchCap({ fontSize: Number(e.target.value) })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`左右边距 ${cap.insetX}%`}>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                className="w-full"
                value={cap.insetX}
                onChange={(e) => patchCap({ insetX: Number(e.target.value) })}
              />
            </Field>
            <Field label={`上下边距 ${cap.insetY}%`}>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                className="w-full"
                value={cap.insetY}
                onChange={(e) => patchCap({ insetY: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-ink-200">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={cap.outline} onChange={(e) => patchCap({ outline: e.target.checked }, true)} />
              描边
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={cap.blur} onChange={(e) => patchCap({ blur: e.target.checked }, true)} />
              毛玻璃
            </label>
          </div>
        </>
      )}
    </div>
  );
}

export function ProgressFields() {
  const project = useEditor((s) => s.project);
  const st = progressStyleOf(project.progressStyle);
  const patch = (next: Partial<typeof st>, history = false) => {
    useEditor.getState().updateProject({ progressStyle: { ...st, ...next } }, history);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-ink-200">
        <input
          type="checkbox"
          checked={Boolean(project.showTopProgress)}
          onChange={(e) => useEditor.getState().updateProject({ showTopProgress: e.target.checked })}
        />
        画面上显示全片进度条
      </label>
      <p className="text-[10px] text-ink-500">画在舞台画布里，预览和导出都会带上。字体可在「字体」页单独选。</p>
      {project.showTopProgress && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="位置">
              <select
                className="field"
                value={st.position}
                onChange={(e) => patch({ position: e.target.value as "top" | "bottom" }, true)}
              >
                <option value="top">顶部</option>
                <option value="bottom">底部</option>
              </select>
            </Field>
            <Field label="字重">
              <select
                className="field"
                value={st.fontWeight}
                onChange={(e) => patch({ fontWeight: e.target.value as "normal" | "medium" | "bold" }, true)}
              >
                <option value="normal">常规</option>
                <option value="medium">中等</option>
                <option value="bold">粗</option>
              </select>
            </Field>
            <Field label="底色">
              <input className="field h-8" type="color" value={st.bg} onChange={(e) => patch({ bg: e.target.value })} />
            </Field>
            <Field label="进度色">
              <input className="field h-8" type="color" value={st.fill} onChange={(e) => patch({ fill: e.target.value })} />
            </Field>
            <Field label="场次名">
              <input className="field h-8" type="color" value={st.color} onChange={(e) => patch({ color: e.target.value })} />
            </Field>
            <Field label="当前场">
              <input className="field h-8" type="color" value={st.activeColor} onChange={(e) => patch({ activeColor: e.target.value })} />
            </Field>
            <Field label="播放头">
              <input className="field h-8" type="color" value={st.playhead} onChange={(e) => patch({ playhead: e.target.value })} />
            </Field>
          </div>
          <Field label={`底透明度 ${Math.round(st.bgOpacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full"
              value={st.bgOpacity}
              onChange={(e) => patch({ bgOpacity: Number(e.target.value) })}
            />
          </Field>
          <Field label={`进度透明度 ${Math.round(st.fillOpacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full"
              value={st.fillOpacity}
              onChange={(e) => patch({ fillOpacity: Number(e.target.value) })}
            />
          </Field>
          <Field label={`高度 ${st.height.toFixed(1)}`}>
            <input
              type="range"
              min={1.4}
              max={6}
              step={0.1}
              className="w-full"
              value={st.height}
              onChange={(e) => patch({ height: Number(e.target.value) })}
            />
          </Field>
          <Field label={`场次名字号 ${st.fontSize.toFixed(1)}`}>
            <input
              type="range"
              min={0.7}
              max={2.4}
              step={0.05}
              className="w-full"
              value={st.fontSize}
              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
            />
          </Field>
          <Field label={`左右边距 ${st.insetX}%`}>
            <input
              type="range"
              min={0}
              max={16}
              step={0.5}
              className="w-full"
              value={st.insetX}
              onChange={(e) => patch({ insetX: Number(e.target.value) })}
            />
          </Field>
          <div className="flex flex-wrap gap-3 text-xs text-ink-200">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={st.showNames} onChange={(e) => patch({ showNames: e.target.checked }, true)} />
              场次名
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={st.showPlayhead} onChange={(e) => patch({ showPlayhead: e.target.checked }, true)} />
              播放头
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={st.showDividers} onChange={(e) => patch({ showDividers: e.target.checked }, true)} />
              场次分隔
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={st.blur} onChange={(e) => patch({ blur: e.target.checked }, true)} />
              毛玻璃
            </label>
          </div>
        </>
      )}
    </div>
  );
}
