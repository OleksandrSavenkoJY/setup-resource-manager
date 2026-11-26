"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emptyTrash, fetchTrash, purgeFromTrash, restoreFromTrash, type TrashEntry } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useUi } from "@/components/UiProvider";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");

export default function TrashPage() {
  const me = useCurrentUser();
  const [items, setItems] = useState<TrashEntry[] | null>(null);
  const { toast, confirm } = useUi();

  const load = () => fetchTrash().then(setItems).catch((e) => toast(e.message, { kind: "error" }));
  useEffect(() => {
    if (me?.role === "admin") load();
  }, [me]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast(done);
      await load();
    } catch (e: any) {
      toast(e.message, { kind: "error" });
    }
  };

  if (me && me.role !== "admin") {
    return <main><h1>Trash</h1><p>Only the admin can see the trash.</p><Link href="/">← Back</Link></main>;
  }

  return (
    <main>
      <h1>Trash</h1>
      <p><Link href="/">← Back to setups</Link></p>
      <p>Deleted setups can be restored (with devices, connections, photo and access point links). A restored setup gets a new id.</p>

      {items && items.length > 0 && (
        <div className="card">
          <button
            className="secondary"
            onClick={async () => {
              if (await confirm("Delete everything in the trash permanently?", "Empty trash")) run(emptyTrash, "Trash emptied");
            }}
          >
            Empty trash
          </button>
        </div>
      )}

      {items && items.length === 0 && <p>The trash is empty.</p>}
      {items && items.length > 0 && (
        <table>
          <thead>
            <tr><th>Name</th><th>Devices</th><th>Connections</th><th>Deleted</th><th>By</th><th>Removed for good</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.devices}</td>
                <td>{t.connections}</td>
                <td>{fmt(t.deleted_at)}</td>
                <td>{t.deleted_by}</td>
                <td>{fmt(t.expires_at)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button onClick={() => run(() => restoreFromTrash(t.id), "Restored " + t.name)}>↩ Restore</button>{" "}
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (await confirm("Delete " + t.name + " permanently?", "Delete forever")) run(() => purgeFromTrash(t.id), "Deleted permanently");
                    }}
                  >
                    🗑 Delete forever
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
