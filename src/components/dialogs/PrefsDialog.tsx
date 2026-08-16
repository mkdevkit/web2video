import { useState } from "react";
import { ASPECT_PX, type AspectId } from "../../types";
import { CaptionFields, FontFields, ProgressFields } from "../AppearancePanel";
import { Field, Modal } from "../ui";
import { useEditor } from "../../store/useEditor";

type Tab = "fonts" | "captions" | "progress" | "film";

const TABS: { id: Tab; label: string }[] = [
  { id: "fonts", label: "字体" },
  { id: "captions", label: "字幕" },
  { id: "progress", label: "进度" },
  { id: "film", label: "片子" },
];

export function PrefsDialog() {
  const [tab, setTab] = useState<Tab>("fonts");
  const project = useEditor((s) => s.project);

  return (
    <Modal title="全局配置" wide onClose={() => useEditor.getState().setDialog(null)}>
      <div className="-mx-4 -mt-4 mb-4 flex border-b border-ink-600">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-2 text-[12px] ${tab === t.id ? "border-b-2 border-brass text-paper" : "text-ink-400 hover:text-ink-200"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "fonts" && <FontFields />}
      {tab === "captions" && <CaptionFields />}
      {tab === "progress" && <ProgressFields />}
      {tab === "film" && (
        <div className="space-y-3">
          <Field label="画幅">
            <select
              className="field max-w-xs"
              value={project.aspect}
              onChange={(e) => useEditor.getState().updateProject({ aspect: e.target.value as AspectId })}
            >
              {(Object.keys(ASPECT_PX) as AspectId[]).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-ink-400">切场停留、开场/结束空白仍在右侧属性里按场景调。导出格式、分辨率和码率在「导出」窗口里配，会写入工程文件。</p>
        </div>
      )}
    </Modal>
  );
}
