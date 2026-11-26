"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSetups } from "@/lib/api";
import ExportButton from "@/components/ExportButton";
import CriticalityBadge from "@/components/Criticality";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CRITICALITY } from "@/components/Criticality";

export default function HomePage() {
  const me = useCurrentUser();
  const [setups, setSetups] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [chamberFilter, setChamberFilter] = useState("all");
  const [critFilter, setCritFilter] = useState("all");
  const [outletsFilter, setOutletsFilter] = useState("all");
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
    () => [...new Set(setups.map((s: any) => s.outlets_used as number))].sort((a, b) => a - b),
    [setups]
  );

  const shown = useMemo(() => {
    const raw = query.trim().toLowerCase();
    return setups.filter(
      (s: any) =>
        (!raw || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(raw)) &&
        (chamberFilter === "all" || (chamberFilter === "yes") === !!s.chamber) &&
        (critFilter === "all" || String(s.criticality) === critFilter) &&
        (outletsFilter === "all" || String(s.outlets_used) === outletsFilter)
    );
  }, [setups, query, chamberFilter, critFilter, outletsFilter]);

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

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ maxWidth: 260, margin: 0 }}
          placeholder="Search name, description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={{ maxWidth: 170, margin: 0 }} value={chamberFilter} onChange={(e) => setChamberFilter(e.target.value)}>
          <option value="all">All chamber</option>
          <option value="yes">Chamber: Yes</option>
          <option value="no">Chamber: No</option>
        </select>
        <select style={{ maxWidth: 190, margin: 0 }} value={critFilter} onChange={(e) => setCritFilter(e.target.value)}>
          <option value="all">All criticality</option>
          {CRITICALITY.map((c) => (
            <option key={c.level} value={String(c.level)}>{c.label}</option>
          ))}
        </select>
        <select style={{ maxWidth: 170, margin: 0 }} value={outletsFilter} onChange={(e) => setOutletsFilter(e.target.value)}>
          <option value="all">All outlets</option>
          {outletOptions.map((n) => (
            <option key={n} value={String(n)}>{n} outlet(s)</option>
          ))}
        </select>
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
                      background: setup.chamber ? "#00a000" : "#e00000", color: "#fff", borderRadius: 999,
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
