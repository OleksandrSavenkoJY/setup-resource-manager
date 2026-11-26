"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type Option = { value: string; label: string };

const box = { width: 16, height: 16, margin: 0, padding: 0, flexShrink: 0 } as const;
const row = { display: "flex", gap: 8, alignItems: "center", margin: 0, fontWeight: 400, cursor: "pointer", whiteSpace: "nowrap" } as const;

// Excel-like header: the label plus a button that opens a popup; the filter applies immediately.
function FilterHeader({ label, active, children }: { label: string; active: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <th ref={ref} style={{ position: "relative", whiteSpace: "nowrap" }}>
      {label}{" "}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={active ? "Filter is on" : "Filter"}
        aria-label={`Filter ${label}`}
        style={{
          padding: "0 6px", lineHeight: "20px", fontSize: 12, borderRadius: 4,
          background: active ? "#2563eb" : "transparent", color: active ? "#fff" : "inherit",
          border: "1px solid var(--border)",
        }}
      >
        {active ? "▼" : "▾"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, zIndex: 50, minWidth: 180, display: "grid", gap: 6,
            padding: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "0 4px 12px var(--shadow)", fontWeight: 400, textAlign: "left",
          }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </th>
  );
}

export function ValueFilter({
  label, options, selected, onChange,
}: {
  label: string;
  options: Option[];
  selected: string[] | null; // null = no filter
  onChange: (next: string[] | null) => void;
}) {
  const current = selected ?? options.map((o) => o.value);
  const set = (next: string[]) => onChange(next.length === options.length ? null : next);
  return (
    <FilterHeader label={label} active={selected !== null}>
      {() => (
        <>
          <label style={{ ...row, fontWeight: 700 }}>
            <input
              type="checkbox" style={box}
              checked={current.length === options.length}
              onChange={(e) => set(e.target.checked ? options.map((o) => o.value) : [])}
            />
            Select all
          </label>
          <div style={{ borderTop: "1px solid var(--border-soft)" }} />
          {options.map((o) => (
            <label key={o.value} style={row}>
              <input
                type="checkbox" style={box}
                checked={current.includes(o.value)}
                onChange={(e) => set(e.target.checked ? [...current, o.value] : current.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </>
      )}
    </FilterHeader>
  );
}

export function TextFilter({
  label, value, placeholder, onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  return (
    <FilterHeader label={label} active={value.trim() !== ""}>
      {(close) => (
        <>
          <input
            autoFocus
            style={{ margin: 0, minWidth: 200 }}
            placeholder={placeholder ?? "Contains..."}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close()}
          />
          {value && (
            <button type="button" className="secondary" onClick={() => onChange("")}>Clear</button>
          )}
        </>
      )}
    </FilterHeader>
  );
}
