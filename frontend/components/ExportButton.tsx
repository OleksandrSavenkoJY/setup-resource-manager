"use client";

import { useState } from "react";
import { useEscape } from "@/lib/useEscape";
import { downloadExport } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type SetupRef = { id: number; name: string };

const SCOPES = [
  { value: "setups", label: "Setups + devices" },
  { value: "connections", label: "Setups + devices + connections" },
  { value: "full", label: "Setups + devices + connections + schema image" },
];

const row = { display: "flex", gap: 8, alignItems: "center", margin: 0 } as const;
const box = { width: 16, height: 16, margin: 0, padding: 0, flexShrink: 0 } as const;

export default function ExportButton({ setups }: { setups: SetupRef[] }) {
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [items, setItems] = useState<string[]>(["data"]);
  const [scope, setScope] = useState("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEscape(open && !busy, () => setOpen(false));
  const single = setups.length === 1;
  const ids = single ? [setups[0].id] : selected;

  const openDialog = () => {
    setSelected([]);
    setError("");
    setOpen(true);
  };
  const toggleItem = (item: string) =>
    setItems((cur) => (cur.includes(item) ? cur.filter((i) => i !== item) : [...cur, item]));
  const toggleSetup = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]));

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadExport(ids, items, scope);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="secondary" onClick={openDialog}>
        Export
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export"
          onClick={() => !busy && setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", display: "grid", gap: 10 }}
          >
            <h2 style={{ margin: 0 }}>Export</h2>

            {!single && (
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ ...row, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    style={box}
                    checked={selected.length === setups.length && setups.length > 0}
                    onChange={(e) => setSelected(e.target.checked ? setups.map((s) => s.id) : [])}
                  />
                  Select all ({selected.length}/{setups.length})
                </label>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border-soft)", borderRadius: 6, padding: 8, display: "grid", gap: 4 }}>
                  {setups.map((s) => (
                    <label key={s.id} style={row}>
                      <input type="checkbox" style={box} checked={selected.includes(s.id)} onChange={() => toggleSetup(s.id)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {single && <div><b>{setups[0].name}</b></div>}

            <b>What to export</b>
            <label style={row}>
              <input type="checkbox" style={box} checked={items.includes("data")} onChange={() => toggleItem("data")} />
              Data (Excel .xlsx)
            </label>
            {items.includes("data") && (
              <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ marginLeft: 24, marginTop: 0, marginBottom: 0, width: "auto" }}>
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
            <label style={row}>
              <input type="checkbox" style={box} checked={items.includes("png")} onChange={() => toggleItem("png")} />
              Schema as image (.png)
            </label>
            {me?.role === "admin" && (
              <label style={row}>
                <input type="checkbox" style={box} checked={items.includes("drawio")} onChange={() => toggleItem("drawio")} />
                Schema for draw.io (.drawio)
              </label>
            )}
            <label style={row}>
              <input type="checkbox" style={box} checked={items.includes("photo")} onChange={() => toggleItem("photo")} />
              Photo
            </label>
            <label style={row}>
              <input type="checkbox" style={box} checked={items.includes("location")} onChange={() => toggleItem("location")} />
              Office location (map with marker, .png)
            </label>
            <small style={{ opacity: 0.7 }}>
              One file is downloaded as is; several files come as a .zip. Schemas that were not generated yet are generated now, which can take a while for many setups.
            </small>
            {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={busy || items.length === 0 || ids.length === 0} onClick={run}>
                {busy ? "Exporting..." : "Download"}
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
