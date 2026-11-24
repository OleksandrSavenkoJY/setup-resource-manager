"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSetups } from "@/lib/api";
import ExportButton from "@/components/ExportButton";
import CriticalityBadge from "@/components/Criticality";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function HomePage() {
  const me = useCurrentUser();
  const [setups, setSetups] = useState<any[]>([]);
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

  return (
    <main>
      <h1>Setup Resource Manager</h1>
      <p>List of setups</p>

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
        <ExportButton />
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Chamber</th>
            <th>Criticality</th>
            <th>Outlets</th>
          </tr>
        </thead>
        <tbody>
          {setups.map((setup: any) => {
            const isNew = String(setup.id) === newSetupId;
            return (
              <tr key={setup.id}>
                <td>{setup.id}</td>
                <td>
                  <Link href={`/setups/${setup.id}`}>{setup.name}</Link> {isNew ? <span style={{ color: "#16a34a", fontWeight: 700 }}>(New)</span> : null}
                </td>
                <td>{setup.chamber ? "Yes" : "No"}</td>
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
