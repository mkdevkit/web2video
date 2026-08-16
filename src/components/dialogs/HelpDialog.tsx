import { useEditor } from "../../store/useEditor";
import { Modal } from "../ui";

export function HelpDialog() {
  return (
    <Modal title="快捷键与用法" onClose={() => useEditor.getState().setDialog(null)}>
      <div className="space-y-3 text-sm text-ink-200">
        <p>建议流程：口播稿切场景 → 调版面与入场时间 → 合成配音 → 翻译 → 导出各语言视频。</p>
        <ul className="space-y-1 text-xs text-ink-300">
          <li>
            <kbd className="text-paper">空格</kbd> 播放 / 暂停
          </li>
          <li>
            <kbd className="text-paper">Ctrl+S</kbd> 保存工程目录
          </li>
          <li>
            <kbd className="text-paper">Ctrl+E</kbd> 导出
          </li>
          <li>
            <kbd className="text-paper">Ctrl+Z / Y</kbd> 撤销 / 重做
          </li>
          <li>
            <kbd className="text-paper">?</kbd> 本面板
          </li>
        </ul>
        <p className="text-xs text-ink-400">
          元件是子模块：舞台上拖动/拉角缩放。播放头不在起点时拖动会写入关键帧，时间轴在关键帧之间插值。选中元件后，右侧是该模块的内部设置（字号、颜色、列表排列等）。
        </p>
      </div>
    </Modal>
  );
}
