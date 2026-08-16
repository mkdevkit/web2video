import { useEditor } from "../../store/useEditor";
import { Modal } from "../ui";

export function HelpDialog() {
  return (
    <Modal title="快捷键与用法" onClose={() => useEditor.getState().setDialog(null)}>
      <div className="space-y-3 text-sm text-ink-200">
        <p>建议流程：口播稿切场景 → 调版面与入场时间 → 合成配音 → 翻译 → 导出各语言视频。</p>
        <ul className="space-y-1 text-xs text-ink-300">
          <li>
            <kbd className="text-paper">空格</kbd> 播放 / 暂停；顶栏重播按钮从当前场景开头再播
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
          左侧下方是检视：列出当前场景的全部元件。点选后，右侧只显示该元件属性，与场景属性分开。点检视顶部的场景名、舞台空白处，或右侧「场景属性」，可回到场景设置。顶栏「元件」可向当前场景添加元件。开场口播钉在第一帧，播完后才播动画和元件口播；结束口播钉在最后一帧，排在全部元件口播之后。开场/结束可配前后空白（静音）。有口播的元件默认跟「当前语言的那一句」入场，合成配音不会改共用入场轨；配图等可改为跟画面（主体比例，各语言拉伸）。元件可在舞台上拖动、拉角缩放；播放头不在动画段起点时拖动会写入关键帧。
        </p>
      </div>
    </Modal>
  );
}
