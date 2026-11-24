"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAccessPoint, deleteAccessPoint, deleteAccessPointPhoto, fetchAccessPoints, fetchSetups, exportAccessPoints,
  updateAccessPoint, uploadAccessPointPhoto, type AccessPoint, type AccessPointInput,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import Linkify from "@/components/Linkify";

const AUTOMATION: Record<string, { label: string; color: string }> = {
  "": { label: "?", color: "#6b7280" },
  yes: { label: "Yes", color: "#00a000" },
  no: { label: "No", color: "#e00000" },
  in_progress: { label: "In progress", color: "#f59e0b" },
};

function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ background: color, color: "#fff", borderRadius: 999, padding: "2px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>;
}

type SortKey = "name" | "model" | "wifi_standard" | "ip" | "automation" | "place" | "notes";
const AUTO_ORDER: Record<string, string> = { yes: "1", in_progress: "2", no: "3", "": "4" };

function compareIp(a: string, b: string): number {
  const pa = a.split(/[.:]/).map(Number), pb = b.split(/[.:]/).map(Number);
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return a.localeCompare(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

function sortValue(a: AccessPoint, key: SortKey): string {
  if (key === "place") return (a.setup_name || a.location || "").trim();
  if (key === "automation") return AUTO_ORDER[a.automation] ?? "4";
  return String(a[key] ?? "").trim();
}

const EMPTY: AccessPointInput = {
  name: "", model: "", wifi_standard: "", ip: "", username: "", password: "", automation: "",
  setup_id: null, location: "", notes: "",
};

export default function AccessPointsPage() {
  const me = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const [items, setItems] = useState<AccessPoint[]>([]);
  const [setups, setSetups] = useState<{ id: number; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [autoFilter, setAutoFilter] = useState("all");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<AccessPointInput>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [withPasswords, setWithPasswords] = useState(false);
  const [lightbox, setLightbox] = useState<AccessPoint | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const highlightDone = useRef(false);
  const lightboxOpen = useRef(false);
  lightboxOpen.current = lightbox !== null;

  useEffect(() => {
    if (highlightDone.current || items.length === 0) return;
    const id = Number(new URLSearchParams(window.location.search).get("highlight"));
    highlightDone.current = true;
    if (!id || !items.some((a) => a.id === id)) return;
    setQuery("");
    setAutoFilter("all");
    setHighlight(id);
    setTimeout(() => document.getElementById(`ap-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    setTimeout(() => setHighlight(null), 3500);
  }, [items]);

  async function load() {
    setItems(await fetchAccessPoints());
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightboxOpen.current) setLightbox(null);
      else setQuery("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    fetchSetups().then(setSetups).catch(console.error);
  }, []);

  const shown = useMemo(() => {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]/g, "");
    const raw = query.trim().toLowerCase();
    const q = norm(query);
    const fuzzy = /[a-z\u0400-\u04ff]/.test(raw);
    const match = (v: string) => v.toLowerCase().includes(raw) || (fuzzy && norm(v).includes(q));
    const list = items.filter((a) =>
      (autoFilter === "all" || a.automation === autoFilter) &&
      (!raw || [a.name, a.model, a.ip, a.wifi_standard, a.setup_name ?? "", a.location, a.notes ?? ""].some(match))
    );
    if (!sort) return list;
    const { key, dir } = sort;
    // Empty values always go last; numeric-aware compare sorts IPs and "AX55" < "AX100" naturally.
    return [...list].sort((x, y) => {
      const a = sortValue(x, key), b = sortValue(y, key);
      if (!a || !b) return a === b ? 0 : !a ? 1 : -1;
      return dir * (key === "ip" ? compareIp(a, b) : a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    });
  }, [items, query, autoFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  }
  function sortTh(key: SortKey, label: string) {
    const arrow = sort?.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "";
    return (
      <th onClick={() => toggleSort(key)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Click to sort">
        {label}{arrow}
      </th>
    );
  }

  const duplicateIps = useMemo(() => {
    const seen = new Map<string, number>();
    items.forEach((a) => a.ip && seen.set(a.ip, (seen.get(a.ip) ?? 0) + 1));
    return new Set([...seen].filter(([, n]) => n > 1).map(([ip]) => ip));
  }, [items]);

  function startEdit(a: AccessPoint | null) {
    setError(null);
    setPhoto(null);
    setRemovePhoto(false);
    if (a) {
      setEditing(a.id);
      setForm({ ...a, username: a.username ?? "", password: a.password ?? "", notes: a.notes ?? "" });
    } else {
      setEditing("new");
      setForm(EMPTY);
    }
    setTimeout(() => document.getElementById("ap-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function save() {
    if (!form.name.trim()) return setError("Name is required");
    setBusy(true);
    setError(null);
    try {
      const payload: AccessPointInput = {
        name: form.name.trim(), model: form.model ?? "", wifi_standard: form.wifi_standard ?? "", ip: form.ip ?? "",
        username: form.username ?? "", password: form.password ?? "", automation: form.automation ?? "",
        setup_id: form.setup_id || null, location: form.setup_id ? "" : form.location ?? "", notes: form.notes?.trim() || null,
      };
      const saved = editing === "new" ? await createAccessPoint(payload) : await updateAccessPoint(editing as number, payload);
      if (removePhoto) await deleteAccessPointPhoto(saved.id);
      if (photo) await uploadAccessPointPhoto(saved.id, photo);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API \d+: /, "") : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: AccessPoint) {
    if (!window.confirm(`Delete access point "${a.name}" (${a.ip || "no IP"})?`)) return;
    try {
      await deleteAccessPoint(a.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function copyInfo(a: AccessPoint) {
    const text = [
      `${a.name}${a.model ? ` (${a.model})` : ""}`,
      a.ip ? `IP: ${a.ip}` : null,
      `Setup: ${a.setup_name || a.location || "-"}`,
      `Automation: ${AUTOMATION[a.automation]?.label === "?" ? "unknown" : AUTOMATION[a.automation]?.label ?? "unknown"}`,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs HTTPS; fall back for plain-http deployments.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(a.id);
    setTimeout(() => setCopied((c) => (c === a.id ? null : c)), 1500);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      await exportAccessPoints(isAdmin && withPasswords);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof AccessPointInput>(k: K, v: AccessPointInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <main style={{ maxWidth: "min(1800px, 96vw)" }}>
      <h1>Access points</h1>
      <p>Routers and access points: where they stand, how to log in and what works. Link them to setups to see them on both sides.</p>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {isAdmin && <button onClick={() => startEdit(null)}>+ Add access point</button>}
        <button className="secondary" disabled={busy} onClick={handleExport}>Export to Excel</button>
        {isAdmin && (
          <select style={{ maxWidth: 190, margin: 0 }} value={withPasswords ? "yes" : "no"} onChange={(e) => setWithPasswords(e.target.value === "yes")}>
            <option value="no">Without passwords</option>
            <option value="yes">With passwords</option>
          </select>
        )}
        <input style={{ maxWidth: 260, margin: 0 }} placeholder="Search name, model, IP, setup..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select style={{ maxWidth: 190, margin: 0 }} value={autoFilter} onChange={(e) => setAutoFilter(e.target.value)}>
          <option value="all">All automation</option>
          <option value="yes">Yes</option>
          <option value="in_progress">In progress</option>
          <option value="no">No</option>
          <option value="">Unknown</option>
        </select>
        <span>{shown.length} of {items.length}</span>
      </div>

      {error && editing === null ? <div className="field-error" style={{ padding: 12, marginBottom: 12 }}>{error}</div> : null}
      {info ? <div className="card" style={{ borderColor: "#16a34a" }}>{info}</div> : null}

      {editing !== null && isAdmin && (
        <div id="ap-form" className="card" style={{ border: "2px solid #2563eb" }}>
          <h2>{editing === "new" ? "New access point" : "Edit access point"}</h2>
          {error ? <div className="field-error" style={{ padding: 12, marginBottom: 12 }}>{error}</div> : null}
          <label>Name *<input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. TP-Link BE3600" /></label>
          <label>Model<input value={form.model} onChange={(e) => set("model", e.target.value)} /></label>
          <label>Wi-Fi standard<input value={form.wifi_standard} onChange={(e) => set("wifi_standard", e.target.value)} placeholder="WIFI 6, WIFI 7..." /></label>
          <label>IP<input value={form.ip} onChange={(e) => set("ip", e.target.value)} placeholder="192.168.100.x" /></label>
          {form.ip && items.some((a) => a.ip === form.ip && a.id !== editing) ? (
            <p style={{ color: "#dc2626", marginTop: 0 }}>Another access point already uses this IP.</p>
          ) : null}
          <label>Login<input value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" /></label>
          <label>Password<input value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="off" /></label>
          <label>Automation support
            <select value={form.automation} onChange={(e) => set("automation", e.target.value)}>
              <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option><option value="in_progress">In progress</option>
            </select>
          </label>
          <label>Setup (where it stands)
            <select value={form.setup_id ?? ""} onChange={(e) => set("setup_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Not in a setup</option>
              {[...setups].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {!form.setup_id && (
            <label>Location (free text)<input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. iop.ua, shelf 2" /></label>
          )}
          <label>Notes<textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
          <label>Photo
            <input type="file" accept="image/*" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); setRemovePhoto(false); }} />
          </label>
          {editing !== "new" && items.find((a) => a.id === editing)?.has_photo && !photo ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} /> Remove current photo
            </label>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button disabled={busy} onClick={save}>{busy ? "Saving..." : "Save"}</button>
            <button className="secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-scroll"><style>{`.ap-table th,.ap-table td{padding:6px 8px;font-size:14px;vertical-align:middle}.ap-table td{transition:background-color 1.5s ease-out}.ap-table tr.ap-hl td{background-color:rgba(250,204,21,.55)!important;transition:background-color .3s}`}</style>
        <table className="data-table ap-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Photo</th>{sortTh("name", "Name")}{sortTh("model", "Model")}{sortTh("wifi_standard", "Wi-Fi")}{sortTh("ip", "IP")}
              {isAdmin && <th>Login / password</th>}
              {sortTh("automation", "Automation")}{sortTh("place", "Setup / location")}{sortTh("notes", "Notes")}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id} id={`ap-row-${a.id}`} className={highlight === a.id ? "ap-hl" : undefined}>
                <td>
                  {a.has_photo ? (
                    <button type="button" onClick={() => setLightbox(a)} title="Open photo" style={{ background: "none", border: 0, padding: 0, cursor: "zoom-in" }}>
                      <img src={`/api/access-points/${a.id}/photo?v=${encodeURIComponent(a.updated_at ?? "")}`} alt={a.name} loading="lazy"
                        style={{ width: 72, height: 72, objectFit: "contain", background: "#fff", borderRadius: 6, display: "block" }} />
                    </button>
                  ) : "-"}
                </td>
                <td>
                  <b>{a.name}</b>
                </td>
                <td>{a.model || "-"}</td>
                <td>{a.wifi_standard || "-"}</td>
                <td style={duplicateIps.has(a.ip) ? { color: "#dc2626", fontWeight: 700 } : undefined} title={duplicateIps.has(a.ip) ? "Duplicate IP" : undefined}>{a.ip || "-"}</td>
                {isAdmin && (
                  <td>
                    {a.username || "-"} / {revealed.has(a.id) ? (a.password || "-") : (a.password ? "••••••" : "-")}{" "}
                    {a.password ? (
                      <button type="button" className="secondary" style={{ padding: "0 6px" }} onClick={() => setRevealed((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}>
                        {revealed.has(a.id) ? "Hide" : "Show"}
                      </button>
                    ) : null}
                  </td>
                )}
                <td><Pill {...(AUTOMATION[a.automation] ?? AUTOMATION[""])} /></td>
                <td>{a.setup_id ? <Link href={`/setups/${a.setup_id}`}>{a.setup_name}</Link> : a.location || "-"}</td>
                <td style={{ minWidth: 120 }}><Linkify text={a.notes} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="secondary" onClick={() => copyInfo(a)} title="Copy short info to clipboard">
                    {copied === a.id ? "Copied ✓" : "Copy"}
                  </button>
                  {isAdmin && (
                    <>
                      {" "}<button className="secondary" onClick={() => startEdit(a)}>Edit</button>{" "}
                      <button className="secondary" onClick={() => remove(a)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colSpan={isAdmin ? 10 : 9}>No access points.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <img src={`/api/access-points/${lightbox.id}/photo?v=${encodeURIComponent(lightbox.updated_at ?? "")}`} alt={lightbox.name}
            onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain", background: "#fff", borderRadius: 8 }} />
          <button type="button" aria-label="Close" onClick={() => setLightbox(null)}
            style={{ position: "fixed", top: 16, right: 20, width: 44, height: 44, borderRadius: 999, border: 0, fontSize: 28, lineHeight: "44px", padding: 0, color: "#fff", background: "rgba(0,0,0,.45)", opacity: 0.7, cursor: "pointer" }}>×</button>
        </div>
      )}
      {!isAdmin && <p>Logins and passwords are visible in admin mode only.</p>}
    </main>
  );
}
