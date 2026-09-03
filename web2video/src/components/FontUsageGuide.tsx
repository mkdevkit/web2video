import { useState } from "react";
import { FONT_USAGE, STAGE_FONTS, fontStack } from "../lib/fonts";
import { useEditor } from "../store/useEditor";

/** 各处用字：用在哪 / 每种字体两页表格。 */
export function FontUsageGuide() {
  const lang = useEditor((s) => s.project.previewLang);
  const [catalog, setCatalog] = useState<"where" | "faces">("where");

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">各处用字</p>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={`rounded border px-2 py-0.5 text-xs ${catalog === "where" ? "border-copper bg-ink-800" : "border-ink-600 text-ink-400"}`}
          onClick={() => setCatalog("where")}
        >
          用在哪
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-0.5 text-xs ${catalog === "faces" ? "border-copper bg-ink-800" : "border-ink-600 text-ink-400"}`}
          onClick={() => setCatalog("faces")}
        >
          每种字体
        </button>
      </div>
      {catalog === "where" ? (
        <div className="overflow-auto rounded border border-ink-700">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-ink-800 text-ink-400">
                <th className="px-2 py-1.5 text-left font-medium">用在哪</th>
                <th className="px-2 py-1.5 text-left font-medium">字体</th>
                <th className="px-2 py-1.5 text-left font-medium">许可</th>
              </tr>
            </thead>
            <tbody>
              {FONT_USAGE.map((row) => (
                <tr key={row.where} className="border-t border-ink-700">
                  <td className="whitespace-nowrap px-2 py-1.5 align-top">{row.where}</td>
                  <td className="px-2 py-1.5 align-top">
                    <span className="text-ink-300">{row.fonts}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">{row.detail}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 align-top">{row.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto rounded border border-ink-700">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-ink-800 text-ink-400">
                <th className="px-2 py-1.5 text-left font-medium">字体</th>
                <th className="px-2 py-1.5 text-left font-medium">语种</th>
                <th className="px-2 py-1.5 text-left font-medium">许可</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_FONTS.map((f) => (
                <tr key={f.id} className="border-t border-ink-700">
                  <td className="px-2 py-1.5 align-top">
                    <span style={{ fontFamily: fontStack(f.id, lang) }}>{f.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-400">{f.hint}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">{f.detail}</span>
                  </td>
                  <td className="px-2 py-1.5 align-top text-ink-300">{f.langs}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 align-top">{f.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-ink-500">
        可选字体均为 SIL OFL，免费可商用。不随工具分发任何专有字体。system-ui 只是系统回落，不是捆绑字体。
      </p>
    </div>
  );
}
