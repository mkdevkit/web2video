import { useMemo } from "react";
import katex from "katex";

export function KatexFrame({
  tex,
  displayMode = true,
  color,
  fontSize,
  align = "center",
}: {
  tex: string;
  displayMode?: boolean;
  color?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
}) {
  const html = useMemo(() => {
    const src = tex.trim() || "\\;";
    try {
      return katex.renderToString(src, { throwOnError: false, displayMode, output: "html" });
    } catch (e) {
      return `<span class="katex-error">${e instanceof Error ? e.message : "公式无效"}</span>`;
    }
  }, [tex, displayMode]);

  return (
    <div
      className="flex h-full w-full items-center overflow-auto [&_.katex-display]:m-0 [&_.katex-error]:text-[1.2cqw] [&_.katex-error]:text-red-300"
      style={{
        color: color || "#f3eee3",
        fontSize: `${fontSize ?? 2.8}cqw`,
        justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        textAlign: align,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
