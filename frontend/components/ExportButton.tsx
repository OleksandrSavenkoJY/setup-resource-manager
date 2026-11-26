"use client";

import { useState } from "react";
import { downloadExport } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Props = {
  // Setups to export; an empty list means all setups.
  setupIds: number[];
  title?: string;
  label?: string;
};

const SCOPES = [
  { value: "setups", label: "Setups + devices" },
  { value: "connections", label: "Setups + devices + connections" },
  { value: "full", label: "Setups + devices + connections + schema image" },
];

export default function ExportButton({ setupIds, title, label = "Export" }: Props) {
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>(["data"]);
  const [scope, setScope] = useState("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (item: string) =>
    setItems((cur) => (cur.includes(item) ? cur.filter((i) => i !== item) : [...cur, item]));

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadExport(setupIds, items, scope);
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
        {label}
      </button>
    );
  }

  const heading =
    title ?? (setupIds.length ? `Export ${setupIds.length} selected setup(s)` : "Export all setups");

  return (
    <div className="card" style={{ display: "grid", gap: 8, maxWidth: 460 }}>
      <strong>{heading}</strong>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={items.includes("data")} onChange={() => toggle("data")} />
        Data (Excel .xlsx)
      </label>
      {items.includes("data") && (
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ marginLeft: 24 }}>
          {SCOPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={items.includes("png")} onChange={() => toggle("png")} />
        Schema as image (.png)
      </label>
      {me?.role === "admin" && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={items.includes("drawio")} onChange={() => toggle("drawio")} />
          Schema for draw.io (.drawio)
        </label>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={items.includes("photo")} onChange={() => toggle("photo")} />
        Photo
      </label>
      <small style={{ opacity: 0.7 }}>
        One file is downloaded as is; several files come as a .zip. Schemas that were not generated yet are generated now, which can take a while for many setups.
      </small>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={busy || items.length === 0} onClick={run}>
          {busy ? "Exporting..." : "Download"}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
