import Link from "next/link";
import { fetchSetups } from "@/lib/api";

export default async function HomePage() {
  const setups = await fetchSetups();
  const newSetupId = typeof window !== "undefined" ? window.localStorage.getItem("setup_resource_manager_new_setup") : null;

  return (
    <main>
      <h1>Setup Resource Manager</h1>
      <p>MVP list of setups</p>

      <div className="card">
        <Link href="/new">
          <button>Create new setup</button>
        </Link>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Chamber</th>
            <th>Outlets</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {setups.map((setup: any) => {
            const isNew = String(setup.id) === newSetupId;
            return (
              <tr key={setup.id}>
                <td>{setup.id}</td>
                <td>
                  {setup.name} {isNew ? <span style={{ color: "#16a34a", fontWeight: 700 }}>(New)</span> : null}
                </td>
                <td>{setup.chamber ? "Yes" : "No"}</td>
                <td>{setup.outlets_used}</td>
                <td>
                  <Link href={`/setups/${setup.id}`}>Open</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
