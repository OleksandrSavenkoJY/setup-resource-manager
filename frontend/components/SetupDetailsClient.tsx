"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExportButton from "@/components/ExportButton";
import Badge, { BADGE_COLORS } from "@/components/Badge";
import CriticalityBadge from "@/components/Criticality";
import ZoomableImage from "@/components/ZoomableImage";
import DiagramEditor from "@/components/DiagramEditor";
import OfficeMapView from "@/components/OfficeMapView";
import Linkify from "@/components/Linkify";
import { cloneSetup, deletePhoto, deleteSetup, fetchMapUrl, fetchNetworkSvg, fetchPhotoUrl, generateDiagram, resetDiagramLayout, restoreFromTrash, saveDiagramLayout, setSetupLocation, updateUsage, uploadPhoto, type Diagram } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useUi } from "@/components/UiProvider";
import { copyText } from "@/lib/clipboard";

type Props = {
  setup: any;
  prompt: string | null;
  diagram: Diagram | null;
};

export default function SetupDetailsClient({ setup, prompt, diagram: initialDiagram }: Props) {
  const router = useRouter();
  const me = useCurrentUser();
  const { toast } = useUi();
  const isAdmin = me?.role === "admin";
  const [diagram, setDiagram] = useState<Diagram | null>(initialDiagram);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [view, setView] = useState<"photo" | "generated" | "location" | "network">("photo");
  const [netSvg, setNetSvg] = useState<string | null>(null);
  const netRows = (setup.devices ?? []).flatMap((d: any) => (d.net_interfaces ?? []).map((n: any) => ({ device: d.name, ...n })));
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    setup.map_x != null && setup.map_y != null ? { x: setup.map_x, y: setup.map_y } : null
  );
  const [placing, setPlacing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotoUrl(setup.id).then(setPhotoUrl).catch(console.error);
    fetchMapUrl().then(setMapUrl).catch(console.error);
    if (netRows.length) fetchNetworkSvg(setup.id).then((s) => setNetSvg(s || null)).catch(console.error);
  }, [setup.id]);

  async function handlePlace(x: number, y: number) {
    try {
      setError(null);
      await setSetupLocation(setup.id, { x, y });
      setPos({ x, y });
      setPlacing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save location");
    }
  }

  async function handleClearLocation() {
    try {
      setError(null);
      await setSetupLocation(setup.id, null);
      setPos(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear location");
    }
  }

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

  const [editing, setEditing] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(false);

  async function runLayout(action: () => Promise<Diagram>, done: string) {
    setLayoutBusy(true);
    try {
      setDiagram(await action());
      setEditing(false);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update the layout", { kind: "error" });
    } finally {
      setLayoutBusy(false);
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
  const [usage, setUsage] = useState({ used_by: setup.used_by ?? "", used_until: setup.used_until ?? "", usage_note: setup.usage_note ?? "" });
  const [usageBusy, setUsageBusy] = useState(false);

  async function saveUsage(next: typeof usage) {
    setUsageBusy(true);
    try {
      const saved: any = await updateUsage(setup.id, next);
      setUsage({ used_by: saved.used_by ?? "", used_until: saved.used_until ?? "", usage_note: saved.usage_note ?? "" });
      toast(saved.used_by ? "Reserved" : "Released");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", { kind: "error" });
    } finally {
      setUsageBusy(false);
    }
  }
  const overdue = !!usage.used_by && !!usage.used_until && usage.used_until < new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<"devices" | "network" | "connections">("devices");
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
      const res = await deleteSetup(setup.id);
      toast("Moved \"" + setup.name + "\" to the Trash", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const restored = await restoreFromTrash(res.trash_id);
              toast("Restored");
              window.location.href = "/setups/" + restored.id;
            } catch (e) {
              toast(e instanceof Error ? e.message : "Failed to restore", { kind: "error" });
            }
          },
        },
      });
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
    <main style={{ maxWidth: "min(1400px, 96vw)" }}>
      <h1 style={{ marginBottom: 8 }}>{setup.name}</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <CriticalityBadge level={setup.criticality} />
        {usage.used_by ? (
          <Badge
            label={"In use by " + usage.used_by + (usage.used_until ? " until " + usage.used_until : "") + (overdue ? " (overdue)" : "")}
            color={overdue ? BADGE_COLORS.red : BADGE_COLORS.purple}
            title={usage.usage_note || undefined}
          />
        ) : (
          <Badge label="Free" color={BADGE_COLORS.green} />
        )}
        {setup.chamber ? <Badge label="Chamber" color={BADGE_COLORS.blue} /> : null}
        {(setup.tags ?? []).map((t: string) => <span key={t} className="tag">{t}</span>)}
      </div>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <ExportButton setups={[{ id: setup.id, name: setup.name }]} />
        {isAdmin && (
          <Link href={`/setups/${setup.id}/edit`}>
            <button>✏️ Edit</button>
          </Link>
        )}
        <Link href="/">
          <button className="secondary">← Back</button>
        </Link>
        {isAdmin && (
          <button type="button" disabled={isCloning} onClick={handleClone}>
            {isCloning ? "Cloning..." : "⧉ Clone"}
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
              {isDeleting ? "Deleting..." : "Move to Trash"}
            </button>
            <button type="button" className="secondary" onClick={() => { setShowConfirm(false); setConfirmText(""); }}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="secondary" title="The setup goes to the Trash and can be restored" onClick={() => setShowConfirm(true)}>
            🗑 Delete setup
          </button>
        ))}
      </div>


      <div className="details-grid">
        <div>
      <div className="card">
        <p><b>ID:</b> {setup.id}</p>
        <p><b>Description:</b> {setup.description || "-"}</p>
        {setup.chamber ? <p><b>Chambers:</b> {setup.chamber_count ?? 0}</p> : null}
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <input style={{ maxWidth: 160, margin: 0 }} placeholder="Who uses it" value={usage.used_by} onChange={(e) => setUsage({ ...usage, used_by: e.target.value })} />
            <input type="date" style={{ maxWidth: 160, margin: 0 }} value={usage.used_until} onChange={(e) => setUsage({ ...usage, used_until: e.target.value })} />
            <input style={{ maxWidth: 240, margin: 0 }} placeholder="Note (optional)" value={usage.usage_note} onChange={(e) => setUsage({ ...usage, usage_note: e.target.value })} />
            <button type="button" disabled={usageBusy || !usage.used_by.trim()} onClick={() => saveUsage(usage)}>Reserve</button>
            <button type="button" className="secondary" disabled={usageBusy || !usage.used_by} onClick={() => saveUsage({ used_by: "", used_until: "", usage_note: "" })}>Release</button>
          </div>
        )}
        {(() => {
          const withPfa = (setup.devices ?? []).filter((d: any) => d.pfa_ip);
          const main = withPfa.find((d: any) => /mgmt/i.test(d.notes ?? "")) ?? withPfa[0];
          return main ? (
            <p>
              <b>PFA:</b>{" "}
              <a href={`http://${main.pfa_ip}:8080`} target="_blank" rel="noreferrer">http://{main.pfa_ip}:8080</a> ({main.name})
            </p>
          ) : null;
        })()}
        <p>
          <b>Access points:</b>{" "}
          {(setup.access_points ?? []).length
            ? setup.access_points.map((a: any, i: number) => (
                <span key={a.id}>{i ? ", " : ""}<Link href={`/access-points?highlight=${a.id}`}>{a.name}{a.ip ? ` (${a.ip})` : ""}</Link></span>
              ))
            : "-"}
        </p>
        <p><b>Outlets used:</b> {setup.outlets_used}</p>
      </div>
        </div>
        <div>
      <div className="card">
        <h2>Schema</h2>
        {[photoUrl, diagram, mapUrl, netSvg].filter(Boolean).length > 1 ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {photoUrl && <button type="button" className={view === "photo" ? "" : "secondary"} onClick={() => setView("photo")}>Photo</button>}
            {diagram && <button type="button" className={view === "generated" ? "" : "secondary"} onClick={() => setView("generated")}>Generated schema</button>}
            {netSvg && <button type="button" className={view === "network" ? "" : "secondary"} onClick={() => setView("network")}>Network diagram</button>}
            {mapUrl && <button type="button" className={view === "location" ? "" : "secondary"} onClick={() => setView("location")}>Office location</button>}
          </div>
        ) : null}
        {netSvg && (view === "network" || (!photoUrl && !diagram && !mapUrl)) ? (
          <ZoomableImage alt="Network diagram" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(netSvg)}`} />
        ) : mapUrl && (view === "location" || (!photoUrl && !diagram)) ? (
          <>
            <OfficeMapView
              imageUrl={mapUrl}
              markers={pos ? [{ id: setup.id, name: setup.name, ...pos }] : []}
              activeIds={pos ? [setup.id] : []}
              placing={placing}
              onPlace={handlePlace}
            />
            {!pos && !placing ? <p>This setup is not placed on the office map yet.</p> : null}
            {placing ? <p><b>Click on the map to set the location.</b></p> : null}
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setPlacing((p) => !p)}>
                  {placing ? "Cancel" : pos ? "Move marker" : "Set location"}
                </button>
                {pos && !placing ? <button type="button" className="secondary" onClick={handleClearLocation}>Remove marker</button> : null}
              </div>
            )}
          </>
        ) : photoUrl && (view === "photo" || !diagram) ? (
          <img
            alt="Setup photo"
            src={photoUrl}
            style={{ maxWidth: "100%", height: "auto", borderRadius: 8 }}
          />
        ) : diagram ? (
          <>
            {editing && diagram.layout ? (
              <DiagramEditor
                diagram={diagram}
                busy={layoutBusy}
                onSave={(changed) => runLayout(() => saveDiagramLayout(setup.id, changed), "Layout saved")}
                onReset={() => runLayout(() => resetDiagramLayout(setup.id), "Automatic layout restored")}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <ZoomableImage alt="Setup schema" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagram.svg)}`} />
                <p style={{ fontSize: 12, opacity: 0.7 }}>
                  Generated {new Date(diagram.generated_at + "Z").toLocaleString()}
                  {diagram.manual?.length ? " · " + diagram.manual.length + " device(s) placed by hand" : ""}
                </p>
              </>
            )}
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
            {diagram?.layout && !editing && view === "generated" ? (
              <button type="button" className="secondary" onClick={() => setEditing(true)}>✥ Edit layout</button>
            ) : null}
            {diagram?.drawio_xml ? (
              <button type="button" className="secondary" onClick={() => handleDownload()}>
                Download .drawio
              </button>
            ) : null}
          </div>
        )}
      </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {([
          ["devices", "Devices", setup.devices?.length ?? 0],
          ...(netRows.length > 0 ? [["network", "Network", netRows.length]] : []),
          ["connections", "Connections", setup.connections?.length ?? 0],
        ] as [string, string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "tab active" : "tab"}
            onClick={() => setTab(key as "devices" | "network" | "connections")}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {tab === "devices" && (
      <div className="card">
        {setup.devices?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Type</th><th>Name</th><th>Location</th><th>Powered from</th><th>PFA</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {setup.devices.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.type}</td>
                    <td>{d.name}</td>
                    <td>{d.location || "-"}</td>
                    <td>{d.power_from === "__outlet__" ? "Wall outlet" : d.power_from || "-"}</td>
                    <td>{d.pfa_ip ? <a href={`http://${d.pfa_ip}:8080`} target="_blank" rel="noreferrer">{d.pfa_ip}</a> : "-"}</td>
                    <td><Linkify text={d.notes} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No devices</p>
        )}
      </div>
      )}

      {tab === "network" && netRows.length > 0 && (
        <div className="card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Device</th><th>Interface</th><th>Type</th><th>IP</th><th>MAC</th></tr>
              </thead>
              <tbody>
                {netRows.map((n: any, i: number) => (
                  <tr key={i}>
                    <td>{n.device}</td>
                    <td>{n.name || "-"}</td>
                    <td>{n.type || "-"}</td>
                    <td>{n.ip || "-"}</td>
                    <td>{n.mac || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "connections" && (
      <div className="card">
        {setup.connections?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>From device</th><th>From interface</th><th>To device</th><th>To interface</th><th>Cable</th><th>Power</th><th>Radio</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {setup.connections.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.from_device}</td>
                    <td>{c.from_port || "-"}</td>
                    <td>{c.to_device}</td>
                    <td>{c.to_port || "-"}</td>
                    <td>{c.cable_type || "-"}</td>
                    <td>{c.powers === "from" ? `${c.from_device} → ${c.to_device}` : c.powers === "to" ? `${c.to_device} → ${c.from_device}` : "-"}</td>
                    <td>{{ ota: "Over the air", conducted: "Conducted", hybrid: "Hybrid" }[c.radio_mode as string] ?? "-"}</td>
                    <td><Linkify text={c.notes} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No connections</p>
        )}
      </div>
      )}

      {isAdmin && prompt !== null && (
        <div className="card">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, marginRight: "auto" }}>Generated prompt</h2>
            <button type="button" className="secondary" onClick={() => { copyText(prompt).then(() => toast("Prompt copied")); }}>Copy</button>
            <button type="button" className="secondary" aria-expanded={showPrompt} onClick={() => setShowPrompt((v) => !v)}>
              {showPrompt ? "Hide" : "Show"}
            </button>
          </div>
          {showPrompt && <pre style={{ whiteSpace: "pre-wrap" }}>{prompt}</pre>}
        </div>
      )}


      {error ? <div className="field-error" style={{ padding: 12 }}>{error}</div> : null}
    </main>
  );
}
