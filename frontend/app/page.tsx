"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSetups } from "@/lib/api";
import ExportButton from "@/components/ExportButton";
import CriticalityBadge from "@/components/Criticality";
import { useCurrentUser } from "@/lib/useCurrentUser";

type SortKey = "name" | "chamber" | "criticality" | "outlets" | "status";

const today = () => new Date().toISOString().slice(0, 10);

function StatusBadge({ setup }: { setup: any }) {
  if (!setup.used_by) {
    return <span style={{ background: "#16a34a", color: "#fff", borderRadius: 999, padding: "2px 10px", fontWeight: 700 }}>Free</span>;
  }
  const overdue = !!setup.used_until && setup.used_until < today();
  const label = setup.used_by + (setup.used_until ? " until " + setup.used_until : "") + (overdue ? " (overdue)" : "");
  return (
    <span
      title={setup.usage_note || undefined}
      style={{ background: overdue ? "#e00000" : "#f59e0b", color: "#fff", borderRadius: 999, padding: "2px 10px", fontWeight: 700, whiteSpace: "nowrap" }}
    >
      {label}
    </span>
  );
}

function sortValue(s: any, key: SortKey): string | number {
  if (key === "name") return s.name;
  if (key === "chamber") return s.chamber ? 1 : 0;
  if (key === "criticality") return s.criticality;
  if (key === "status") {
    // Free first, then in use by the earliest end date, then in use without an end date.
    if (!s.used_by) return 0;
    const t = s.used_until ? Date.parse(s.used_until) : NaN;
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t + 1;
  }
  return s.outlets_used;
}

export default function HomePage() {
  const me = useCurrentUser();
  const [setups, setSetups] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [tag, setTag] = useState("");
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

  const shown = useMemo(() => {
    const raw = query.trim().toLowerCase();
    const list = setups.filter((s: any) =>
      (!raw || s.name.toLowerCase().includes(raw) || (s.tags || []).some((t: string) => t.toLowerCase().includes(raw))) &&
      (!tag || (s.tags || []).includes(tag)));
    if (!sort) return list;
    const { key, dir } = sort;
    return [...list].sort((x: any, y: any) => {
      const a = sortValue(x, key), b = sortValue(y, key);
      if (typeof a === "number" && typeof b === "number") return dir * (a - b);
      return dir * String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [setups, query, sort, tag]);
  const allTags: string[] = useMemo(
    () => Array.from(new Set<string>(setups.flatMap((s: any) => s.tags || []))).sort((a, b) => a.localeCompare(b)),
    [setups],
  );

  // Click: ascending, again: descending, again: original order.
  const toggleSort = (key: SortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const sortTh = (key: SortKey, label: string) => (
    <th onClick={() => toggleSort(key)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Click to sort">
      {label}{sort?.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

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
        {me?.role === "admin" && (
          <Link href="/trash">
            <button className="secondary">Trash</button>
          </Link>
        )}
      </div>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ maxWidth: 260, margin: 0 }}
          placeholder="Search name or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{shown.length} of {setups.length}</span>
        {allTags.map((t) => (
          <button
            key={t}
            className={tag === t ? undefined : "secondary"}
            style={{ padding: "2px 10px", borderRadius: 999 }}
            onClick={() => setTag(tag === t ? "" : t)}
          >
            {t}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            {sortTh("name", "Name")}
            {sortTh("chamber", "Chamber")}
            {sortTh("criticality", "Criticality")}
            {sortTh("outlets", "Outlets")}
            {sortTh("status", "Status")}
            <th>Tags</th>
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
                <td><StatusBadge setup={setup} /></td>
                <td>
                  {(setup.tags || []).map((t: string) => (
                    <span
                      key={t}
                      onClick={() => setTag(t)}
                      style={{ cursor: "pointer", background: "#e5e7eb", color: "#111", borderRadius: 999, padding: "1px 8px", marginRight: 4, fontSize: 12 }}
                    >
                      {t}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
