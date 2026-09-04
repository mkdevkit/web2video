import { useEditor } from "../../store/useEditor";
import { FontUsageGuide } from "../FontUsageGuide";
import { Modal } from "../ui";

export function HelpDialog() {
  return (
    <Modal title="快捷键与用法" wide onClose={() => useEditor.getState().setDialog(null)}>
      <div className="space-y-3 text-sm text-ink-200">
        <p>建议流程：AI 分镜 → 选时钟模式并配置动效 → 合成配音 → 翻译 → 导出各语言视频。</p>
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
          顶栏「配置」改全局字体、字幕样式和画幅。口播字幕条的字体在「字体」页，底色/位置等在「字幕」页。「AI」只配置 DeepSeek 等接口；聊天在右侧「AI」页签。密钥只存在本机。左侧下方是检视：列出当前场景的全部元件。
          每场可选口播驱动或配置驱动。场景属性里点「编辑口播」管理本场口播（各有 id 与时长）；口播驱动按该列表走时钟，句间留白用延时。配置驱动在属性区给元件配多条动效（口播 / 场景 / 固定时间），并用「播放口播」元件排期，全部播完再切场。
        </p>
        <FontUsageGuide />
      </div>
    </Modal>
  );
}
