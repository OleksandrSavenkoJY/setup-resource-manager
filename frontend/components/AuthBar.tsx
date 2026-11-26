"use client";

import { useState } from "react";
import { useEscape } from "@/lib/useEscape";
import { usePathname } from "next/navigation";
import { changePassword, logout } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function AuthBar({ part }: { part: "status" | "actions" }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEscape(open, () => setOpen(false));

  if (pathname === "/login" || pathname === "/setup-admin" || !user) return null;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.href = "/";
    }
  }

  const isAdmin = user.role === "admin";

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters" });
    if (next !== again) return setMsg({ ok: false, text: "Passwords do not match" });
    setBusy(true);
    setMsg(null);
    try {
      await changePassword(cur, next);
      setMsg({ ok: true, text: "Password changed" });
      setCur(""); setNext(""); setAgain("");
      setTimeout(() => setOpen(false), 1200);
    } catch (err) {
      const t = err instanceof Error ? err.message : "Failed";
      setMsg({ ok: false, text: t.includes("incorrect") ? "Current password is incorrect" : t.replace(/^API \d+: /, "") });
    } finally {
      setBusy(false);
    }
  }

  if (part === "status") {
    return <span style={{ fontWeight: isAdmin ? 700 : 400 }}>{isAdmin ? "Admin mode" : "Guest (view only)"}</span>;
  }

  return (
    <>
      {isAdmin ? (
        <>
          <button type="button" className="secondary" onClick={() => { setOpen(true); setMsg(null); }}>Change password</button>
          <button type="button" className="secondary" onClick={handleLogout}>Exit admin mode</button>
        </>
      ) : (
        <button type="button" onClick={() => (window.location.href = "/login")}>Admin mode</button>
      )}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitPassword} role="dialog" aria-modal="true" aria-label="Change admin password" className="card" style={{ width: 340, background: "var(--surface)" }}>
            <h2 style={{ marginTop: 0 }}>Change admin password</h2>
            <label>Current password<input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus /></label>
            <label>New password (min 8)<input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
            <label>Repeat new password<input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
            {msg ? <p style={{ color: msg.ok ? "#15803d" : "#b91c1c" }}>{msg.text}</p> : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={busy || !cur || !next}>{busy ? "Saving..." : "Change"}</button>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
