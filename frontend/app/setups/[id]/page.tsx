import Link from "next/link";
import { fetchSetup, fetchPrompt } from "@/lib/api";

export default async function SetupDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setup = await fetchSetup(Number(id));
  const promptData = await fetchPrompt(Number(id));

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
        <pre style={{ whiteSpace: "pre-wrap" }}>{promptData.prompt}</pre>
      </div>

      <div className="card">
        <Link href={`/setups/${setup.id}/edit`}>
          <button>Edit</button>
        </Link>
        {" "}
        <Link href="/">
          <button className="secondary">Back</button>
        </Link>
      </div>
    </main>
  );
}
