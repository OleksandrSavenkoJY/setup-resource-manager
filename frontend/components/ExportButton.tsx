"use client";

import { useState } from "react";
import { downloadExport } from "@/lib/api";

type Props = { setupId?: number };

const SCOPES = [
  { value: "setups", label: "Setups + devices" },
  { value: "connections", label: "Setups + devices + connections" },
  { value: "full", label: "Setups + devices + connections + schema" },
];

export default function ExportButton({ setupId }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("xlsx");
  const [scope, setScope] = useState("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadExport(setupId ?? null, setupId ? { format } : { format, scope });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        Export
      </button>
    );
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      <strong>{setupId ? "Export this setup (devices, connections, schema)" : "Export all setups"}</strong>
      <label>
        Format
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="png">{setupId ? "Image (.png schema)" : "Images (.zip of schema PNGs)"}</option>
        </select>
      </label>
      {!setupId && format === "xlsx" && (
        <label>
          Content
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={busy} onClick={run}>{busy ? "Exporting..." : "Download"}</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
