import Link from "next/link";
import { fetchSetups } from "@/lib/api";

export default async function HomePage() {
  const setups = await fetchSetups();

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
          {setups.map((setup: any) => (
            <tr key={setup.id}>
              <td>{setup.id}</td>
              <td>{setup.name}</td>
              <td>{setup.chamber ? "Yes" : "No"}</td>
              <td>{setup.outlets_used}</td>
              <td>
                <Link href={`/setups/${setup.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
