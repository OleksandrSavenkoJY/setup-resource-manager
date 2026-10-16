"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExportButton from "@/components/ExportButton";
import { cloneSetup, deletePhoto, deleteSetup, fetchPhotoUrl, generateDiagram, uploadPhoto, type Diagram } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Props = {
  setup: any;
  prompt: string | null;
  diagram: Diagram | null;
};

export default function SetupDetailsClient({ setup, prompt, diagram: initialDiagram }: Props) {
  const router = useRouter();
  const me = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const [diagram, setDiagram] = useState<Diagram | null>(initialDiagram);
  const [isGenerating, setIsGenerating] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [view, setView] = useState<"photo" | "generated">("photo");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotoUrl(setup.id).then(setPhotoUrl).catch(console.error);
  }, [setup.id]);

  async function handlePhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Photo is larger than 10 MB");
      return;
    }
    try {
      setPhotoBusy(true);
      setError(null);
      await uploadPhoto(setup.id, file);
      setPhotoUrl(await fetchPhotoUrl(setup.id));
      setView("photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePhotoRemove() {
    if (!window.confirm("Remove the setup photo?")) return;
    try {
      setPhotoBusy(true);
      setError(null);
      await deletePhoto(setup.id);
      setPhotoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleGenerate() {
    if (isGenerating) return;
    try {
      setIsGenerating(true);
      setError(null);
      setDiagram(await generateDiagram(setup.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate diagram");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!diagram?.drawio_xml) return;
    const url = URL.createObjectURL(new Blob([diagram.drawio_xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `setup-${setup.id}.drawio`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === "DELETE";

  const [isCloning, setIsCloning] = useState(false);

  async function handleClone() {
    if (isCloning) return;
    try {
      setIsCloning(true);
      setError(null);
      const copy = await cloneSetup(setup.id);
      router.push(`/setups/${copy.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone setup");
      setIsCloning(false);
    }
  }

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
        {setup.chamber ? <p><b>Chambers:</b> {setup.chamber_count ?? 0}</p> : null}
        <p><b>Outlets used:</b> {setup.outlets_used}</p>
      </div>

      <div className="card">
        <h2>Devices</h2>
        {setup.devices?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Type</th><th>Name</th><th>Location</th><th>Powered from</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {setup.devices.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.type}</td>
                    <td>{d.name}</td>
                    <td>{d.location || "-"}</td>
                    <td>{d.power_from === "__outlet__" ? "Wall outlet" : d.power_from || "-"}</td>
                    <td>{d.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No devices</p>
        )}
      </div>

      <div className="card">
        <h2>Connections</h2>
        {setup.connections?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>From device</th><th>From interface</th><th>To device</th><th>To interface</th><th>Cable</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {setup.connections.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.from_device}</td>
                    <td>{c.from_port || "-"}</td>
                    <td>{c.to_device}</td>
                    <td>{c.to_port || "-"}</td>
                    <td>{c.cable_type || "-"}</td>
                    <td>{c.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No connections</p>
        )}
      </div>

      <div className="card">
        <h2>Schema</h2>
        {photoUrl && diagram ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button type="button" className={view === "photo" ? "" : "secondary"} onClick={() => setView("photo")}>Photo</button>
            <button type="button" className={view === "generated" ? "" : "secondary"} onClick={() => setView("generated")}>Generated schema</button>
          </div>
        ) : null}
        {photoUrl && (view === "photo" || !diagram) ? (
          <img
            alt="Setup photo"
            src={photoUrl}
            style={{ maxWidth: "100%", height: "auto", borderRadius: 8 }}
          />
        ) : diagram ? (
          <>
            {/* <img> with a data URI keeps the SVG inert (no script execution). */}
            <img
              alt="Setup schema"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagram.svg)}`}
              style={{ maxWidth: "100%", height: "auto", background: "#fff", borderRadius: 8 }}
            />
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Generated {new Date(diagram.generated_at + "Z").toLocaleString()}
            </p>
          </>
        ) : (
          <p>No photo or generated schema yet.</p>
        )}
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={handlePhotoChosen} />
            <button type="button" disabled={photoBusy} onClick={() => fileInput.current?.click()}>
              {photoBusy ? "Working..." : photoUrl ? "Replace photo" : "Upload photo"}
            </button>
            {photoUrl ? (
              <button type="button" className="secondary" disabled={photoBusy} onClick={handlePhotoRemove}>
                Remove photo
              </button>
            ) : null}
            <button type="button" disabled={isGenerating} onClick={handleGenerate}>
              {isGenerating ? "Generating..." : diagram ? "Regenerate schema" : "Generate schema"}
            </button>
            {diagram?.drawio_xml ? (
              <button type="button" className="secondary" onClick={handleDownload}>
                Download .drawio
              </button>
            ) : null}
          </div>
        )}
      </div>

      {isAdmin && prompt !== null && (
        <div className="card">
          <h2>Generated prompt</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{prompt}</pre>
        </div>
      )}

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <ExportButton setupId={setup.id} />
        {isAdmin && (
          <Link href={`/setups/${setup.id}/edit`}>
            <button>Edit</button>
          </Link>
        )}
        <Link href="/">
          <button className="secondary">Back</button>
        </Link>
        {isAdmin && (
          <button type="button" disabled={isCloning} onClick={handleClone}>
            {isCloning ? "Cloning..." : "Clone"}
          </button>
        )}
        {isAdmin && (showConfirm ? (
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
        ))}
      </div>

      {error ? <div className="field-error" style={{ padding: 12 }}>{error}</div> : null}
    </main>
  );
}
