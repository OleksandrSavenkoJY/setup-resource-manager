"use client";

export type MapMarker = { id: number; name: string; x: number; y: number };

type Props = {
  imageUrl: string;
  markers: MapMarker[];
  activeIds?: number[];
  placing?: boolean;
  onPlace?: (x: number, y: number) => void;
  onMarkerClick?: (id: number) => void;
};

export default function OfficeMapView({ imageUrl, markers, activeIds = [], placing, onPlace, onMarkerClick }: Props) {
  const highlighting = activeIds.length > 0;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placing || !onPlace) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPlace(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  }

  return (
    <div className={`map-wrap${placing ? " placing" : ""}`} onClick={handleClick}>
      <img src={imageUrl} alt="Office map" draggable={false} />
      {markers.map((m) => {
        const active = activeIds.includes(m.id);
        return (
          <div key={m.id}>
            <button
              type="button"
              title={m.name}
              aria-label={m.name}
              className={`map-marker${active ? " active" : highlighting ? " dim" : ""}`}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
              onClick={(e) => {
                if (placing) return;
                e.stopPropagation();
                onMarkerClick?.(m.id);
              }}
            />
            {(active || !highlighting) && (
              <span className="map-label" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>{m.name}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
