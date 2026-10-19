"use client";

import { useRef, useState } from "react";

type Props = { src: string; alt: string };

export default function ZoomableImage({ src, alt }: Props) {
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const clamp = (z: number) => Math.min(6, Math.max(0.5, z));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        <button type="button" className="secondary" onClick={() => setZoom((z) => clamp(z / 1.25))}>−</button>
        <button type="button" className="secondary" onClick={() => setZoom((z) => clamp(z * 1.25))}>+</button>
        <button type="button" className="secondary" onClick={() => setZoom(1)}>Fit</button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{Math.round(zoom * 100)}% · Ctrl+wheel to zoom, drag to pan</span>
      </div>
      <div
        ref={box}
        style={{ overflow: "auto", maxHeight: "75vh", background: "#fff", borderRadius: 8, cursor: zoom > 1 ? "grab" : "default" }}
        onWheel={(e) => {
          if (e.ctrlKey) setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        }}
        onMouseDown={(e) => {
          const b = box.current;
          if (b) drag.current = { x: e.clientX, y: e.clientY, sl: b.scrollLeft, st: b.scrollTop };
        }}
        onMouseMove={(e) => {
          const b = box.current;
          const d = drag.current;
          if (b && d) {
            b.scrollLeft = d.sl - (e.clientX - d.x);
            b.scrollTop = d.st - (e.clientY - d.y);
          }
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        {/* <img> with a data URI keeps the SVG inert. */}
        <img alt={alt} src={src} draggable={false} style={{ width: `${zoom * 100}%`, maxWidth: "none", height: "auto", display: "block" }} />
      </div>
    </div>
  );
}
