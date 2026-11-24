"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchAuthStatus, login } from "@/lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // First run: no admin yet, so send the user to the admin setup screen.
    fetchAuthStatus()
      .then((s) => {
        if (!s.admin_configured) window.location.href = "/setup-admin";
      })
      .catch(console.error);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login("admin", password);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^API \d+: /, "") : "Wrong password");
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Admin mode</h1>
      <p>Enter the admin password to create, edit and delete. Without it you can only view.</p>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Checking..." : "Enter admin mode"}</button>
        {error ? <div className="field-error" style={{ padding: 12 }}>{error}</div> : null}
      </form>
    </main>
  );
}
