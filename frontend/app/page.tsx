"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { bulkAction, fetchSetups, restoreFromTrash, updateUsage } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import ExportButton from "@/components/ExportButton";
import Badge, { BADGE_COLORS } from "@/components/Badge";
import CriticalityBadge, { criticalityInfo } from "@/components/Criticality";
import UsageDialog, { type UsageValue } from "@/components/UsageDialog";
import { useUi } from "@/components/UiProvider";
import { useCurrentUser } from "@/lib/useCurrentUser";

type SortKey = "name" | "chamber" | "criticality" | "outlets" | "status";
type Sort = { key: SortKey; dir: 1 | -1 } | null;
const SORT_KEYS: SortKey[] = ["name", "chamber", "criticality", "outlets", "status"];

const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (s: any) => !!s.used_by && !!s.used_until && s.used_until < today();

function sortValue(s: any, key: SortKey): string | number {
  if (key === "name") return s.name;
  if (key === "chamber") return s.chamber ? 1 : 0;
  if (key === "criticality") return s.criticality;
  // Free first, then by who uses it (so one person's setups are grouped), then by end date.
  if (key === "status") return s.used_by ? "1 " + s.used_by.toLowerCase() + " " + (s.used_until || "9999-99-99") : "0";
  return s.outlets_used;
}

function statusText(s: any) {
  if (!s.used_by) return "Free";
  return "In use by " + s.used_by + (s.used_until ? " until " + s.used_until : "") + (isOverdue(s) ? " (overdue)" : "");
}

function StatusBadge({ setup }: { setup: any }) {
  if (!setup.used_by) return <Badge label="Free" color={BADGE_COLORS.green} />;
  const label = setup.used_by + (setup.used_until ? " until " + setup.used_until : "") + (isOverdue(setup) ? " (overdue)" : "");
  return <Badge label={label} color={isOverdue(setup) ? BADGE_COLORS.red : BADGE_COLORS.amber} title={setup.usage_note || undefined} />;
}

export default function HomePage() {
  const me = useCurrentUser();
  const { toast, confirm } = useUi();
  const isAdmin = me?.role === "admin";
  const [setups, setSetups] = useState<any[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const [tag, setTag] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [newSetupId, setNewSetupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reserveFor, setReserveFor] = useState<number[] | null>(null);

  const reload = () => fetchSetups().then(setSetups);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    setTag(params.get("tag") ?? "");
    const [key, dir] = (params.get("sort") ?? "").split(":");
    if ((SORT_KEYS as string[]).includes(key)) setSort({ key: key as SortKey, dir: dir === "desc" ? -1 : 1 });
    setUrlReady(true);

    reload().catch((e) => {
      setSetups([]);
      toast(e.message, { kind: "error" });
    });
    setNewSetupId(window.localStorage.getItem("setup_resource_manager_new_setup"));
    window.localStorage.removeItem("setup_resource_manager_new_setup");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep search, tag and sort in the URL so the view can be shared and survives a reload.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (tag) params.set("tag", tag);
    if (sort) params.set("sort", sort.key + ":" + (sort.dir === 1 ? "asc" : "desc"));
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }, [query, tag, sort, urlReady]);

  const all = setups ?? [];

  const shown = useMemo(() => {
    const raw = query.trim().toLowerCase();
    const list = all.filter((s: any) =>
      (!raw || s.name.toLowerCase().includes(raw) || (s.tags || []).some((t: string) => t.toLowerCase().includes(raw))) &&
      (!tag || (s.tags || []).includes(tag)));
    if (!sort) return list;
    const { key, dir } = sort;
    return [...list].sort((x: any, y: any) => {
      const a = sortValue(x, key), b = sortValue(y, key);
      if (typeof a === "number" && typeof b === "number") return dir * (a - b);
      return dir * String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [all, query, sort, tag]);

  const allTags: string[] = useMemo(
    () => Array.from(new Set<string>(all.flatMap((s: any) => s.tags || []))).sort((a, b) => a.localeCompare(b)),
    [all],
  );

  // Click: ascending, again: descending, again: original order.
  const toggleSort = (key: SortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const sortTh = (key: SortKey, label: string) => (
    <th
      scope="col"
      tabIndex={0}
      aria-sort={sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => toggleSort(key)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(key); } }}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      title="Click to sort"
    >
      {label}{sort?.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  const shownIds = shown.map((s: any) => s.id as number);
  const selectedShown = shownIds.filter((id) => selected.has(id));
  const allShownSelected = shownIds.length > 0 && selectedShown.length === shownIds.length;
  const chosen = all.filter((s: any) => selected.has(s.id));

  const toggleOne = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      shownIds.forEach((id) => (allShownSelected ? next.delete(id) : next.add(id)));
      return next;
    });

  async function copyInfo(s: any) {
    const text = [
      s.name,
      "Criticality: " + criticalityInfo(s.criticality).label,
      "Chamber: " + (s.chamber ? "yes" : "no"),
      "Status: " + statusText(s),
      (s.tags || []).length ? "Tags: " + s.tags.join(", ") : "",
      window.location.origin + "/setups/" + s.id,
    ].filter(Boolean).join("\n");
    await copyText(text);
    toast("Copied: " + s.name, { ms: 1500 });
  }

  async function reserve(ids: number[], value: UsageValue) {
    try {
      if (ids.length === 1) await updateUsage(ids[0], value);
      else await bulkAction({ ids, action: "reserve", ...value });
      await reload();
      toast(ids.length === 1 ? "Reserved" : "Reserved " + ids.length + " setups");
      setReserveFor(null);
    } catch (e: any) {
      toast(e.message, { kind: "error" });
    }
  }

  async function release(ids: number[]) {
    try {
      await bulkAction({ ids, action: "release" });
      await reload();
      toast(ids.length === 1 ? "Released" : "Released " + ids.length + " setups");
    } catch (e: any) {
      toast(e.message, { kind: "error" });
    }
  }

  async function tagBulk(action: "add_tag" | "remove_tag") {
    const text = window.prompt(action === "add_tag" ? "Tag to add to " + selected.size + " setups:" : "Tag to remove from " + selected.size + " setups:");
    if (!text || !text.trim()) return;
    try {
      await bulkAction({ ids: Array.from(selected), action, tag: text.trim() });
      await reload();
      toast(action === "add_tag" ? "Tag added" : "Tag removed");
    } catch (e: any) {
      toast(e.message, { kind: "error" });
    }
  }

  async function deleteBulk(ids: number[]) {
    const ok = await confirm("Move " + ids.length + " setup(s) to the Trash? You can restore them from there.", "Move to Trash");
    if (!ok) return;
    try {
      const res = await bulkAction({ ids, action: "delete" });
      setSelected(new Set());
      await reload();
      toast("Moved " + res.done + " setup(s) to the Trash", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await Promise.all(res.trash_ids.map((t) => restoreFromTrash(t)));
              await reload();
              toast("Restored");
            } catch (e: any) {
              toast(e.message, { kind: "error" });
            }
          },
        },
      });
    } catch (e: any) {
      toast(e.message, { kind: "error" });
    }
  }

  const loading = setups === null;
  const colCount = isAdmin ? 9 : 8;

  return (
    <main>
      <h1>Setup Resource Manager</h1>
      <p>List of setups ({all.length})</p>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        {isAdmin && (
          <Link href="/new">
            <button>＋ Create new setup</button>
          </Link>
        )}
        <ExportButton setups={all} />
      </div>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ maxWidth: 260, margin: 0 }}
          aria-label="Search setups by name or tag" placeholder="🔍 Search name or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{shown.length} of {all.length}</span>
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
        {(query || tag || sort) && (
          <button className="secondary" style={{ padding: "2px 10px" }} onClick={() => { setQuery(""); setTag(""); setSort(null); }}>
            ✕ Reset
          </button>
        )}
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="card bulk-bar">
          <b>{selected.size} selected</b>
          <button onClick={() => setReserveFor(Array.from(selected))}>Reserve</button>
          <button className="secondary" onClick={() => release(Array.from(selected))}>Release</button>
          <button className="secondary" onClick={() => tagBulk("add_tag")}>＋ Tag</button>
          <button className="secondary" onClick={() => tagBulk("remove_tag")}>− Tag</button>
          <ExportButton setups={chosen} />
          <button className="secondary" onClick={() => deleteBulk(Array.from(selected))}>🗑 Delete</button>
          <button className="secondary" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <table className="list-table">
        <thead>
          <tr>
            {isAdmin && (
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allShownSelected}
                  onChange={toggleAll}
                  style={{ width: 16, height: 16, margin: 0 }}
                />
              </th>
            )}
            <th>#</th>
            {sortTh("name", "Name")}
            {sortTh("chamber", "Chamber")}
            {sortTh("criticality", "Criticality")}
            {sortTh("outlets", "Outlets")}
            {sortTh("status", "Status")}
            <th>Tags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <tr key={"sk" + i}>
              <td colSpan={colCount}><div className="skeleton" /></td>
            </tr>
          ))}
          {!loading && shown.length === 0 && (
            <tr>
              <td colSpan={colCount} className="empty-state">
                {all.length === 0 ? "No setups yet." : "No setups match the current search or filter."}
                {all.length === 0 && isAdmin && <> <Link href="/new">Create the first one</Link></>}
              </td>
            </tr>
          )}
          {shown.map((setup: any, index: number) => {
            const isNew = String(setup.id) === newSetupId;
            return (
              <tr key={setup.id}>
                {isAdmin && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={"Select " + setup.name}
                      checked={selected.has(setup.id)}
                      onChange={() => toggleOne(setup.id)}
                      style={{ width: 16, height: 16, margin: 0 }}
                    />
                  </td>
                )}
                <td>{index + 1}</td>
                <td>
                  <Link href={"/setups/" + setup.id}>{setup.name}</Link> {isNew ? <span className="text-ok" style={{ fontWeight: 700 }}>(New)</span> : null}
                </td>
                <td><Badge label={setup.chamber ? "Yes" : "No"} color={setup.chamber ? BADGE_COLORS.blue : BADGE_COLORS.grey} /></td>
                <td><CriticalityBadge level={setup.criticality} /></td>
                <td>{setup.outlets_used}</td>
                <td><StatusBadge setup={setup} /></td>
                <td>
                  {(setup.tags || []).map((t: string) => (
                    <span key={t} className="tag" style={{ cursor: "pointer" }} onClick={() => setTag(t)}>{t}</span>
                  ))}
                </td>
                <td className="actions">
                  {isAdmin && (setup.used_by ? (
                    <button className="secondary" title="Mark as free" onClick={() => release([setup.id])}>↩ Release</button>
                  ) : (
                    <button title="Reserve this setup" onClick={() => setReserveFor([setup.id])}>⏱ Reserve</button>
                  ))}
                  <button className="secondary" title="Copy short info to clipboard" onClick={() => copyInfo(setup)}>⧉ Copy info</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {reserveFor && (
        <UsageDialog
          title={reserveFor.length === 1 ? "Reserve setup" : "Reserve " + reserveFor.length + " setups"}
          onCancel={() => setReserveFor(null)}
          onSave={(value) => reserve(reserveFor, value)}
        />
      )}
    </main>
  );
}
