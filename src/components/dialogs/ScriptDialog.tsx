import { useState } from "react";
import { splitScript } from "../../lib/scriptSplit";
import { useEditor } from "../../store/useEditor";
import { Modal } from "../ui";

const SAMPLE = `# 黑洞不是洞
黑洞并不是宇宙里的一个洞。它是质量大到连光都逃不出去的天体。

## 事件视界
事件视界是一道看不见的边界。一旦越过，就再也无法把信号传回外面的宇宙。

## 三个常见误解
- 会把整个星系一口吞掉
- 是通往异世界的传送门
- 靠近就会立刻被吸走

## 恒星如何坍缩
- 燃料耗尽，辐射压下降
- 核心被自身引力压垮
- 若质量足够，坍缩成黑洞
`;

export function ScriptDialog() {
  const source = useEditor((s) => s.project.sourceLang);
  const [md, setMd] = useState(SAMPLE);
  const [replace, setReplace] = useState(true);

  const apply = () => {
    const scenes = splitScript(md, source);
    if (!scenes.length) return;
    if (replace) useEditor.getState().replaceScenes(scenes);
    else {
      const cur = useEditor.getState().project.scenes;
      useEditor.getState().replaceScenes([...cur, ...scenes]);
    }
    useEditor.getState().setDialog(null);
  };

  return (
    <Modal
      title="从口播稿生成场景"
      wide
      onClose={() => useEditor.getState().setDialog(null)}
      footer={
        <>
          <button className="btn" onClick={() => useEditor.getState().setDialog(null)}>
            取消
          </button>
          <button className="btn btn-accent" onClick={apply}>
            生成场景
          </button>
        </>
      }
    >
      <p className="mb-2 text-xs text-ink-400">
        用 <code className="text-ink-200"># 标题</code> 分段；列表会生成要点或步骤版面。也可按空行分段。
      </p>
      <label className="mb-2 flex items-center gap-2 text-xs text-ink-200">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        替换现有场景（取消则追加）
      </label>
      <textarea className="field min-h-[320px] font-mono text-[12px] leading-relaxed" value={md} onChange={(e) => setMd(e.target.value)} />
    </Modal>
  );
}
