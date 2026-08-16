import { useState } from "react";
import { emptyProject, sampleProject } from "../../lib/templates";
import { clearBoundDir, openProjectFolder } from "../../lib/projectFolder";
import { tryRestoreAutosave, useEditor } from "../../store/useEditor";
import { Field, Modal } from "../ui";
import type { AspectId } from "../../types";

export function WelcomeDialog() {
  const [name, setName] = useState("未命名口播");
  const [aspect, setAspect] = useState<AspectId>("16:9");
  const hasSave = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("web2video.autosave"));

  const start = (sample: boolean) => {
    clearBoundDir();
    const project = sample ? { ...sampleProject(), name: name || sampleProject().name, aspect } : { ...emptyProject(name), aspect };
    useEditor.getState().newProject(project);
  };

  return (
    <Modal title="开始一份口播视频" wide onClose={() => useEditor.getState().setDialog(null)}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-200">
          把科普口播做成网页场景，配上 TTS 与时间轴动画，再按语言导出视频。建议使用 Chrome 或 Edge。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="作品名称">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="画幅">
            <select className="field" value={aspect} onChange={(e) => setAspect(e.target.value as AspectId)}>
              <option value="16:9">横屏 16:9</option>
              <option value="9:16">竖屏 9:16</option>
              <option value="1:1">方形 1:1</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-lg border border-ink-600 bg-ink-900 p-3 text-left transition hover:border-brass/60" onClick={() => start(true)}>
            <div className="font-medium text-paper">示例：黑洞不是洞</div>
            <div className="mt-1 text-[11px] text-ink-400">六种版面的科普样片，可直接预览与翻译</div>
          </button>
          <button className="rounded-lg border border-ink-600 bg-ink-900 p-3 text-left transition hover:border-brass/60" onClick={() => start(false)}>
            <div className="font-medium text-paper">空白工程</div>
            <div className="mt-1 text-[11px] text-ink-400">从一个封面场景开始，或稍后导入口播稿</div>
          </button>
        </div>
        <button className="btn w-full" onClick={() => void openProjectFolder()}>
          打开工程目录
        </button>
        {hasSave && (
          <button className="btn w-full" onClick={() => tryRestoreAutosave()}>
            恢复上次草稿
          </button>
        )}
      </div>
    </Modal>
  );
}
