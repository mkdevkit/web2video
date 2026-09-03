import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
  wide,
  xl,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  xl?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={`max-h-[90vh] overflow-auto rounded-xl border border-ink-600 bg-ink-800 shadow-paper ${xl ? "w-[min(1100px,96vw)]" : wide ? "w-[720px]" : "w-[440px]"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-600 px-4 py-3">
          <h2 className="font-display text-lg text-paper">{title}</h2>
          <button className="btn-ghost btn h-7 w-7 p-0" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-600 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-ink-400">{label}</span>
      {children}
    </label>
  );
}
