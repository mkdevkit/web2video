import { useEditor } from "../../store/useEditor";
import { FONT_USAGE, STAGE_FONTS } from "../../lib/fonts";
import { Modal } from "../ui";

export function HelpDialog() {
  return (
    <Modal title="快捷键与用法" onClose={() => useEditor.getState().setDialog(null)}>
      <div className="space-y-3 text-sm text-ink-200">
        <p>建议流程：AI 分镜 → 调版面与入场时间 → 合成配音 → 翻译 → 导出各语言视频。</p>
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
          顶栏「配置」改全局字体、字幕样式和画幅。口播字幕条的字体在「字体」页，底色/位置等在「字幕」页。「AI」只配置 DeepSeek 等接口；聊天在右侧「AI」页签。密钥只存在本机。左侧下方是检视：列出当前场景的全部元件。开场口播钉在第一帧，播完后才播动画和元件口播；结束口播钉在最后一帧。有口播的元件默认跟当前语言的那一句入场。
        </p>
        <div>
          <p className="mb-1 text-xs font-medium text-paper">字体（均为 SIL OFL，免费可商用）</p>
          <div className="overflow-auto rounded border border-ink-700">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-ink-800 text-ink-400">
                  <th className="px-2 py-1 text-left font-medium">用在哪</th>
                  <th className="px-2 py-1 text-left font-medium">字体</th>
                  <th className="px-2 py-1 text-left font-medium">许可</th>
                </tr>
              </thead>
              <tbody>
                {FONT_USAGE.map((row) => (
                  <tr key={row.where} className="border-t border-ink-700">
                    <td className="px-2 py-1">{row.where}</td>
                    <td className="px-2 py-1 text-ink-300">{row.fonts}</td>
                    <td className="px-2 py-1">{row.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            成片可选：{STAGE_FONTS.map((f) => f.label).join("、")}。中日文不足回落 Noto CJK。明细在「配置 → 字体」。
          </p>
        </div>
      </div>
    </Modal>
  );
}
