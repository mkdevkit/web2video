import { STAGE_FONTS, fontStack, stageFont } from "../lib/fonts";
import type { LangId } from "../lib/langs";
import type { StageFontId } from "../types";

export function FontSelect({
  value,
  onChange,
  lang,
  emptyLabel,
}: {
  value: StageFontId | "";
  onChange: (id: StageFontId | undefined) => void;
  lang: LangId;
  emptyLabel?: string;
}) {
  const active = value ? stageFont(value) : emptyLabel ? null : stageFont(undefined);
  return (
    <>
      <select
        className="field"
        value={value}
        style={{ fontFamily: value ? fontStack(value, lang) : undefined }}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? (v as StageFontId) : undefined);
        }}
      >
        {emptyLabel != null && <option value="">{emptyLabel}</option>}
        {STAGE_FONTS.map((f) => (
          <option
            key={f.id}
            value={f.id}
            title={`${f.hint} ${f.detail}`}
            style={{ fontFamily: fontStack(f.id, lang) }}
          >
            {f.label} · {f.langs} · {f.license}
          </option>
        ))}
      </select>
      {active && (
        <div className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-ink-500">
          <p className="text-ink-300" style={{ fontFamily: fontStack(active.id, lang) }}>
            {active.label} · {active.langs} · {active.license}
          </p>
          <p className="text-ink-400">{active.hint}</p>
          <p>{active.detail}</p>
        </div>
      )}
    </>
  );
}
