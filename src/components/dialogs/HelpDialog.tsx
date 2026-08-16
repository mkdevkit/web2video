import { useEditor } from "../../store/useEditor";
import { Modal } from "../ui";

export function HelpDialog() {
  return (
    <Modal title="快捷键与用法" onClose={() => useEditor.getState().setDialog(null)}>
      <div className="space-y-3 text-sm text-ink-200">
        <p>建议流程：AI 或口播稿切场景 → 调版面与入场时间 → 合成配音 → 翻译 → 导出各语言视频。</p>
        <ul className="space-y-1 text-xs text-ink-300">
          <li>
            <kbd className="text-paper">空格</kbd> 播放 / 暂停；顶栏重播按钮从当前场景开头再播
          </li>
          <li>
            <kbd className="text-paper">Ctrl+S</kbd> 保存：选择上级目录后写入「项目名」子文件夹
          </li>
          <li>
            <kbd className="text-paper">Ctrl+E</kbd> 导出：可选格式、分辨率、帧率和码率
          </li>
          <li>
            <kbd className="text-paper">Ctrl+Z / Y</kbd> 撤销 / 重做
          </li>
          <li>
            <kbd className="text-paper">?</kbd> 本面板
          </li>
        </ul>
        <p className="text-xs text-ink-400">
          顶栏「配置」改全局字体、字幕样式和画幅。「AI」只配置 DeepSeek 等接口；聊天在右侧「AI」页签。密钥只存在本机。左侧下方是检视：列出当前场景的全部元件。开场口播钉在第一帧，播完后才播动画和元件口播；结束口播钉在最后一帧。有口播的元件默认跟当前语言的那一句入场。
        </p>
      </div>
    </Modal>
  );
}
