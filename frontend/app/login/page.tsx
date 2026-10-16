"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchAuthStatus, login } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
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
      await login(username, password);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^API \d+: /, "") : "Login failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
        <label>
          Login
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        {error ? <div className="field-error" style={{ padding: 12 }}>{error}</div> : null}
      </form>
    </main>
  );
}
