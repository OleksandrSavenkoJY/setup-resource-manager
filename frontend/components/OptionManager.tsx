"use client";

import { useState } from "react";

type Item = { id: number; name: string; icon?: string };
export type IconDef = { key: string; label: string; svg: string };

type Props = {
  label: string;
  placeholder: string;
  items: Item[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
  icons?: IconDef[];
  autoIcon?: (item: Item) => string;
  onIconChange?: (item: Item, icon: string) => Promise<void>;
  onRename?: (item: Item, name: string) => Promise<void>;
};

export default function OptionManager({ label, placeholder, items, onAdd, onDelete, icons, autoIcon, onIconChange, onRename }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pickFor, setPickFor] = useState<number | null>(null);

  const iconSvg = (key?: string) => icons?.find((i) => i.key === key)?.svg ?? "";

  async function add() {
    const value = name.trim();
    if (!value) return;
    await onAdd(value);
    setName("");
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="secondary" onClick={() => setOpen((v) => !v)}>
        {open ? `Hide ${label}` : `Manage ${label}`}
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            border: "1px solid var(--border, #d4d4d8)",
            borderRadius: 8,
            background: "var(--surface-alt)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ flex: 1, margin: 0 }}
              placeholder={placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            />
            <button type="button" onClick={add} disabled={!name.trim()}>Add</button>
          </div>
          {icons && onIconChange ? (
            <div style={{ display: "grid", gap: 6 }}>
              {items.map((t) => {
                const auto = !t.icon;
                const shown = t.icon || autoIcon?.(t) || "generic";
                return (
                  <div key={t.id} style={{ border: "1px solid var(--border, #d4d4d8)", borderRadius: 8, padding: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        className="secondary"
                        title="Change icon"
                        onClick={() => setPickFor(pickFor === t.id ? null : t.id)}
                        style={{ width: 44, height: 44, padding: 4, background: "#fff" }}
                        dangerouslySetInnerHTML={{ __html: iconSvg(shown) }}
                      />
                      <div style={{ flex: 1 }}>
                        <div>{t.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {auto ? "Icon: auto" : `Icon: ${icons.find((i) => i.key === t.icon)?.label ?? t.icon}`}
                        </div>
                      </div>
                      {onRename ? (
                        <button type="button" className="secondary" title="Rename" onClick={() => {
                          const next = window.prompt(`Rename "${t.name}" to:`, t.name)?.trim();
                          if (next && next !== t.name) onRename(t, next);
                        }}>
                          Rename
                        </button>
                      ) : null}
                      <button type="button" className="secondary" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => onDelete(t)}>
                        ×
                      </button>
                    </div>
                    {pickFor === t.id && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={async () => { await onIconChange(t, ""); setPickFor(null); }}
                          style={{ fontWeight: auto ? 700 : 400 }}
                        >
                          Auto
                        </button>
                        {icons.map((i) => (
                          <button
                            key={i.key}
                            type="button"
                            className="secondary"
                            title={i.label}
                            onClick={async () => { await onIconChange(t, i.key); setPickFor(null); }}
                            style={{
                              width: 56,
                              padding: 4,
                              display: "grid",
                              justifyItems: "center",
                              fontSize: 11,
                              outline: t.icon === i.key ? "2px solid #2563eb" : "none",
                            }}
                          >
                            <span style={{ width: 32, height: 32, background: "#fff", borderRadius: 4 }} dangerouslySetInnerHTML={{ __html: i.svg }} />
                            {i.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {items.length === 0 ? <span style={{ opacity: 0.7 }}>Nothing here yet.</span> : null}
            </div>
          ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {items.map((t) => (
              <span
                key={t.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 4px 2px 10px",
                  border: "1px solid var(--border, #d4d4d8)",
                  borderRadius: 999,
                  fontSize: 14,
                }}
              >
                {t.name}
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Delete ${t.name}`}
                  title="Delete"
                  onClick={() => onDelete(t)}
                  style={{ padding: "0 8px", lineHeight: 1.4, borderRadius: 999 }}
                >
                  ×
                </button>
              </span>
            ))}
            {items.length === 0 ? <span style={{ opacity: 0.7 }}>Nothing here yet.</span> : null}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
