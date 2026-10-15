"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSetup } from "@/lib/api";

type Props = {
  setup: any;
  prompt: string;
};

export default function SetupDetailsClient({ setup, prompt }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === "DELETE";

  async function handleDelete() {
    if (!canDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      setError(null);
      await deleteSetup(setup.id);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete setup");
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
      setConfirmText("");
    }
  }

  return (
    <main>
      <h1>Setup details</h1>

      <div className="card">
        <p><b>ID:</b> {setup.id}</p>
        <p><b>Name:</b> {setup.name}</p>
        <p><b>Description:</b> {setup.description || "-"}</p>
        <p><b>Chamber:</b> {setup.chamber ? "Yes" : "No"}</p>
        <p><b>Outlets used:</b> {setup.outlets_used}</p>
      </div>

      <div className="card">
        <h2>Devices</h2>
        {setup.devices?.length ? (
          <ul>
            {setup.devices.map((d: any) => (
              <li key={d.id}>
                {d.type} — {d.name} (qty: {d.quantity}) {d.location ? `@ ${d.location}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>No devices</p>
        )}
      </div>

      <div className="card">
        <h2>Connections</h2>
        {setup.connections?.length ? (
          <ul>
            {setup.connections.map((c: any) => (
              <li key={c.id}>
                {c.from_device}:{c.from_port || "-"} → {c.to_device}:{c.to_port || "-"}
                {c.cable_type ? ` (${c.cable_type})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>No connections</p>
        )}
      </div>

      <div className="card">
        <h2>Generated prompt</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{prompt}</pre>
      </div>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/setups/${setup.id}/edit`}>
          <button>Edit</button>
        </Link>
        <Link href="/">
          <button className="secondary">Back</button>
        </Link>
        {showConfirm ? (
          <>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type DELETE to confirm'
              style={{ maxWidth: 220 }}
            />
            <button type="button" className="secondary" disabled={!canDelete || isDeleting} onClick={handleDelete}>
              {isDeleting ? "Deleting..." : "Confirm delete"}
            </button>
            <button type="button" className="secondary" onClick={() => { setShowConfirm(false); setConfirmText(""); }}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="secondary" onClick={() => setShowConfirm(true)}>
            Delete setup
          </button>
        )}
      </div>

      {error ? <div className="field-error" style={{ padding: 12 }}>{error}</div> : null}
    </main>
  );
}
