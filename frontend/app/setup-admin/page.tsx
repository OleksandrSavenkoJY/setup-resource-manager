"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchAuthStatus, setupAdmin } from "@/lib/api";

export default function SetupAdminPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAuthStatus()
      .then((s) => {
        if (s.admin_configured) window.location.href = "/login";
      })
      .catch(console.error);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    setError(null);
    try {
      await setupAdmin(password);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^API \d+: /, "") : "Setup failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Create admin account</h1>
      <p>First run: set a password for the <b>admin</b> user.</p>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
        <label>
          Admin password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Creating..." : "Create admin"}</button>
        {error ? <div className="field-error" style={{ padding: 12 }}>{error}</div> : null}
      </form>
    </main>
  );
}
