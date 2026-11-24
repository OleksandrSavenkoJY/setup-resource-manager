"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OfficeMapView from "@/components/OfficeMapView";
import { deleteMap, fetchMapUrl, fetchSetups, setSetupLocation, uploadMap } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function OfficeMapPage() {
  const router = useRouter();
  const me = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [setups, setSetups] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [placingId, setPlacingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const [url, list] = await Promise.all([fetchMapUrl(), fetchSetups()]);
    setMapUrl(url);
    setSetups(list);
    setLoaded(true);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load map"));
  }, []);

  const markers = useMemo(
    () => setups.filter((s) => s.map_x != null && s.map_y != null).map((s) => ({ id: s.id, name: s.name, x: s.map_x, y: s.map_y })),
    [setups]
  );
  const q = query.trim().toLowerCase();
  const activeIds = useMemo(
    () => (q ? markers.filter((m) => m.name.toLowerCase().includes(q)).map((m) => m.id) : []),
    [markers, q]
  );
  const unplaced = setups.filter((s) => s.map_x == null);

  async function run(action: () => Promise<void>) {
    try {
      setBusy(true);
      setError(null);
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Map is larger than 10 MB");
    run(async () => {
      await uploadMap(file);
      await load();
    });
  };

  const place = (x: number, y: number) => {
    const id = placingId;
    if (id == null) return;
    setPlacingId(null);
    run(async () => {
      await setSetupLocation(id, { x, y });
      await load();
    });
  };

  return (
    <main>
      <h1>Office map</h1>
      {error ? <div className="field-error" style={{ padding: 12, marginBottom: 12 }}>{error}</div> : null}

      {loaded && !mapUrl ? <p>No office map yet.{isAdmin ? " Upload a floor plan image (PNG/JPG)." : ""}</p> : null}

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {mapUrl && (
          <input placeholder="Find a setup..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 260 }} />
        )}
        {isAdmin && (
          <>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
              {mapUrl ? "Replace map" : "Upload map"}
            </button>
            {mapUrl && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => window.confirm("Remove the map and all setup markers?") && run(async () => { await deleteMap(); setPlacingId(null); await load(); })}
              >
                Remove map
              </button>
            )}
          </>
        )}
      </div>

      {mapUrl && isAdmin && (
        <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={placingId ?? ""} onChange={(e) => setPlacingId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Place a setup on the map...</option>
            {[...setups].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.map_x != null ? " (placed)" : ""}</option>
            ))}
          </select>
          {placingId != null && <b>Click on the map to set the location.</b>}
          {placingId != null && (
            <button type="button" className="secondary" onClick={() => setPlacingId(null)}>Cancel</button>
          )}
          {placingId != null && setups.find((s) => s.id === placingId)?.map_x != null && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => { const id = placingId; setPlacingId(null); run(async () => { await setSetupLocation(id, null); await load(); }); }}
            >
              Remove marker
            </button>
          )}
        </div>
      )}

      {mapUrl && (
        <div className="card">
          <OfficeMapView
            imageUrl={mapUrl}
            markers={markers}
            activeIds={activeIds}
            placing={placingId != null}
            onPlace={place}
            onMarkerClick={(id) => router.push(`/setups/${id}`)}
          />
          {q && activeIds.length === 0 ? <p>No placed setup matches “{query}”.</p> : null}
          {unplaced.length > 0 && (
            <p style={{ fontSize: 13, opacity: 0.8 }}>Not on the map: {unplaced.map((s) => s.name).join(", ")}</p>
          )}
        </div>
      )}
    </main>
  );
}
