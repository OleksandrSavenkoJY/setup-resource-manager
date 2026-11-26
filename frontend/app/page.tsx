"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSetups } from "@/lib/api";
import ExportButton from "@/components/ExportButton";
import CriticalityBadge from "@/components/Criticality";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CRITICALITY } from "@/components/Criticality";

type Option = { value: string; label: string };

// Toggle buttons instead of a dropdown; no button pressed means no filter.
function Chips({ label, options, selected, onChange }: {
  label: string;
  options: Option[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const toggle = (value: string) => {
    const cur = selected ?? [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    onChange(next.length === 0 ? null : next);
  };
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ opacity: 0.7 }}>{label}:</span>
      {options.map((o) => {
        const on = !!selected?.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={on ? undefined : "secondary"}
            style={{ margin: 0, padding: "4px 10px" }}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const me = useCurrentUser();
  const [setups, setSetups] = useState<any[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  // null = column not filtered
  const [chamberFilter, setChamberFilter] = useState<string[] | null>(null);
  const [critFilter, setCritFilter] = useState<string[] | null>(null);
  const [outletsFilter, setOutletsFilter] = useState<string[] | null>(null);
  const [newSetupId, setNewSetupId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await fetchSetups();
      setSetups(data);
      setNewSetupId(window.localStorage.getItem("setup_resource_manager_new_setup"));
      window.localStorage.removeItem("setup_resource_manager_new_setup");
    };

    load().catch(console.error);
  }, []);

  const outletOptions = useMemo(
    () =>
      [...new Set(setups.map((s: any) => s.outlets_used as number))]
        .sort((a, b) => a - b)
        .map((n) => ({ value: String(n), label: String(n) })),
    [setups]
  );

  const shown = useMemo(() => {
    const raw = nameFilter.trim().toLowerCase();
    return setups.filter(
      (s: any) =>
        (!raw || s.name.toLowerCase().includes(raw)) &&
        (!chamberFilter || chamberFilter.includes(s.chamber ? "yes" : "no")) &&
        (!critFilter || critFilter.includes(String(s.criticality))) &&
        (!outletsFilter || outletsFilter.includes(String(s.outlets_used)))
    );
  }, [setups, nameFilter, chamberFilter, critFilter, outletsFilter]);

  const filtered = !!nameFilter.trim() || !!chamberFilter || !!critFilter || !!outletsFilter;
  const clearFilters = () => {
    setNameFilter("");
    setChamberFilter(null);
    setCritFilter(null);
    setOutletsFilter(null);
  };

  return (
    <main>
      <h1>Setup Resource Manager</h1>
      <p>List of setups ({setups.length})</p>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        {me?.role === "admin" && (
          <Link href="/new">
            <button>Create new setup</button>
          </Link>
        )}
        <Link href="/access-points">
          <button className="secondary">Access points</button>
        </Link>
        <Link href="/map">
          <button className="secondary">Office map</button>
        </Link>
        <ExportButton setups={setups} />
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ maxWidth: 260, margin: 0 }}
          placeholder="Search name..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <Chips label="Chamber" selected={chamberFilter} onChange={setChamberFilter}
          options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
        <Chips label="Criticality" selected={critFilter} onChange={setCritFilter}
          options={CRITICALITY.map((c) => ({ value: String(c.level), label: c.label }))} />
        <Chips label="Outlets" selected={outletsFilter} onChange={setOutletsFilter} options={outletOptions} />
        {filtered && <button type="button" className="secondary" onClick={clearFilters}>Clear filters</button>}
        <span>{shown.length} of {setups.length}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Chamber</th>
            <th>Criticality</th>
            <th>Outlets</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((setup: any, index: number) => {
            const isNew = String(setup.id) === newSetupId;
            return (
              <tr key={setup.id}>
                <td>{index + 1}</td>
                <td>
                  <Link href={`/setups/${setup.id}`}>{setup.name}</Link> {isNew ? <span style={{ color: "#16a34a", fontWeight: 700 }}>(New)</span> : null}
                </td>
                <td>
                  <span
                    style={{
                      background: setup.chamber ? "#2563eb" : "#6b7280", color: "#fff", borderRadius: 999,
                      padding: "2px 10px", fontWeight: 700, whiteSpace: "nowrap",
                    }}
                  >
                    {setup.chamber ? "Yes" : "No"}
                  </span>
                </td>
                <td><CriticalityBadge level={setup.criticality} /></td>
                <td>{setup.outlets_used}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
