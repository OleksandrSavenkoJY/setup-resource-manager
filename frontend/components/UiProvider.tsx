"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastAction = { label: string; onClick: () => void | Promise<void> };
type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; text: string; kind: ToastKind; action?: ToastAction };
type ConfirmState = { text: string; confirmLabel: string; resolve: (ok: boolean) => void } | null;

type Ui = {
  toast: (text: string, opts?: { kind?: ToastKind; action?: ToastAction; ms?: number }) => void;
  confirm: (text: string, confirmLabel?: string) => Promise<boolean>;
};

const UiContext = createContext<Ui>({
  toast: () => {},
  confirm: async (text) => window.confirm(text),
});

export const useUi = () => useContext(UiContext);

const COLORS: Record<ToastKind, string> = { success: "#16a34a", error: "#dc2626", info: "#2563eb" };

export default function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<ConfirmState>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<Ui["toast"]>((text, opts) => {
    const id = nextId.current++;
    const kind = opts?.kind ?? "success";
    setToasts((list) => [...list, { id, text, kind, action: opts?.action }]);
    // Toasts with an action (Undo) stay a bit longer; errors stay until closed.
    const ms = opts?.ms ?? (opts?.action ? 10000 : 4000);
    if (kind !== "error") setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const confirm = useCallback<Ui["confirm"]>(
    (text, confirmLabel = "Confirm") => new Promise<boolean>((resolve) => setDialog({ text, confirmLabel, resolve })),
    [],
  );

  const answer = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{ borderLeft: "4px solid " + COLORS[t.kind] }}>
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={async () => {
                  dismiss(t.id);
                  await t.action!.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="secondary" aria-label="Close" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="modal-backdrop" onClick={() => answer(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <p style={{ marginTop: 0 }}>{dialog.text}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => answer(false)}>Cancel</button>
              <button type="button" autoFocus onClick={() => answer(true)}>{dialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}
