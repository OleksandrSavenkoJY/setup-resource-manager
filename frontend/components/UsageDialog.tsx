"use client";

import { useState } from "react";
import { useEscape } from "@/lib/useEscape";

export type UsageValue = { used_by: string; used_until: string; usage_note: string };

export default function UsageDialog({
  title, initial, onCancel, onSave,
}: {
  title: string;
  initial?: Partial<UsageValue>;
  onCancel: () => void;
  onSave: (value: UsageValue) => Promise<void> | void;
}) {
  const [value, setValue] = useState<UsageValue>({
    used_by: initial?.used_by ?? "", used_until: initial?.used_until ?? "", usage_note: initial?.usage_note ?? "",
  });
  const [busy, setBusy] = useState(false);
  useEscape(true, onCancel);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.used_by.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({ ...value, used_by: value.used_by.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <label>Who uses it
          <input autoFocus value={value.used_by} maxLength={100} onChange={(e) => setValue({ ...value, used_by: e.target.value })} />
        </label>
        <label>Until (optional)
          <input type="date" value={value.used_until} onChange={(e) => setValue({ ...value, used_until: e.target.value })} />
        </label>
        <label>Note (optional)
          <input value={value.usage_note} maxLength={255} onChange={(e) => setValue({ ...value, usage_note: e.target.value })} />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={busy || !value.used_by.trim()}>{busy ? "Saving..." : "Reserve"}</button>
        </div>
      </form>
    </div>
  );
}
