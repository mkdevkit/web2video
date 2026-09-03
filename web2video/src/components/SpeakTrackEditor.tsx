import { driveOf } from "../lib/calendar";
import { sourceLangOf } from "../lib/textI18n";
import { isGapSpeak, speakSummary, speaksOf } from "../lib/speaks";
import type { Scene } from "../types";
import { useEditor } from "../store/useEditor";

export function SpeakTrackEditor({ scene }: { scene: Scene }) {
  const project = useEditor((s) => s.project);
  const lang = project.previewLang;
  const source = sourceLangOf(project);
  const { count, durationMs } = speakSummary(scene, lang, source);
  const gaps = speaksOf(scene).filter(isGapSpeak).length;
  const sec = Number((Math.max(0, durationMs) / 1000).toFixed(2));

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-ink-300">
        {count} 句{gaps ? ` · ${gaps} 段延时` : ""} · {sec} 秒
      </p>
      <button className="btn w-full" onClick={() => useEditor.getState().setDialog("speaks")}>
        编辑口播
      </button>
      <p className="text-[10px] leading-relaxed text-ink-400">
        {driveOf(scene) === "config"
          ? "配置驱动：口播是台词库。用「播放口播」元件排期；动效用某句的开始/结束 + 偏移。全部结束后切场。"
          : "口播驱动按列表顺序走时钟。句间留白在编辑页加延时。"}
      </p>
    </div>
  );
}
