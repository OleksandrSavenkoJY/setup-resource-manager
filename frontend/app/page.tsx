"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSetups } from "@/lib/api";
import ExportButton from "@/components/ExportButton";
import CriticalityBadge from "@/components/Criticality";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CRITICALITY } from "@/components/Criticality";
import { TextFilter, ValueFilter } from "@/components/ColumnFilter";

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

      {filtered && (
        <p>
          Showing {shown.length} of {setups.length}{" "}
          <button type="button" className="secondary" onClick={clearFilters}>Clear filters</button>
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>#</th>
            <TextFilter label="Name" value={nameFilter} onChange={setNameFilter} placeholder="Name contains..." />
            <ValueFilter
              label="Chamber" selected={chamberFilter} onChange={setChamberFilter}
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
            />
            <ValueFilter
              label="Criticality" selected={critFilter} onChange={setCritFilter}
              options={CRITICALITY.map((c) => ({ value: String(c.level), label: c.label }))}
            />
            <ValueFilter label="Outlets" selected={outletsFilter} onChange={setOutletsFilter} options={outletOptions} />
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
