"use client";

import { useEffect, useRef, useState } from "react";
import type { Diagram } from "@/lib/api";

type Pos = Record<string, [number, number]>;

type Props = {
  diagram: Diagram;
  busy: boolean;
  onSave: (changed: Pos) => void;
  onReset: () => void;
  onCancel: () => void;
};

const STEP = 10;

export default function DiagramEditor({ diagram, busy, onSave, onReset, onCancel }: Props) {
  const layout = diagram.layout!;
  const [pos, setPos] = useState<Pos>(layout.nodes);
  const [history, setHistory] = useState<Pos[]>([]);
  const [snap, setSnap] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ name: string; dx: number; dy: number; before: Pos } | null>(null);

  const changed = Object.keys(pos).filter((n) => pos[n][0] !== layout.nodes[n]?.[0] || pos[n][1] !== layout.nodes[n]?.[1]);

  function toSvg(e: React.PointerEvent): [number, number] {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  const place = (v: number) => Math.max(0, snap ? Math.round(v / STEP) * STEP : v);

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setPos(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(name: string, e: React.PointerEvent<SVGGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toSvg(e);
    drag.current = { name, dx: x - pos[name][0], dy: y - pos[name][1], before: pos };
    setActive(name);
  }

  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    const d = drag.current;
    if (!d) return;
    const [x, y] = toSvg(e);
    setPos((p) => ({ ...p, [d.name]: [place(x - d.dx), place(y - d.dy)] }));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setPos((now) => {
      const moved = now[d.name][0] !== d.before[d.name][0] || now[d.name][1] !== d.before[d.name][1];
      if (moved) setHistory((h) => [...h, d.before]);
      return now;
    });
  }

  function onKeyDown(name: string, e: React.KeyboardEvent<SVGGElement>) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    setHistory((h) => [...h, pos]);
    setPos((p) => ({ ...p, [name]: [Math.max(0, p[name][0] + d[0]), Math.max(0, p[name][1] + d[1])] }));
  }

  const dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(diagram.svg);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <button type="button" disabled={busy || changed.length === 0} onClick={() => onSave(Object.fromEntries(changed.map((n) => [n, pos[n]])))}>
          {busy ? "Saving..." : "Save layout" + (changed.length ? " (" + changed.length + ")" : "")}
        </button>
        <button type="button" className="secondary" disabled={busy || history.length === 0} onClick={undo}>↶ Undo</button>
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="secondary" disabled={busy} onClick={onReset} title="Forget hand-placed devices and lay everything out automatically">
          Reset to auto layout
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
          Snap to grid
        </label>
      </div>
      <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0 }}>
        Drag the dashed boxes (or select one and use the arrow keys). The lines are redrawn when you save.
      </p>
      <div style={{ position: "relative", overflow: "auto", maxHeight: "75vh", background: "#fff", borderRadius: 8 }}>
        <img src={dataUri} alt="Setup schema" draggable={false} style={{ display: "block", width: "100%", height: "auto" }} />
        <svg
          ref={svgRef}
          viewBox={"0 0 " + layout.width + " " + layout.height}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        >
          {Object.entries(pos).map(([name, [x, y]]) => {
            const moved = changed.includes(name);
            return (
              <g
                key={name}
                tabIndex={0}
                role="button"
                aria-label={"Move " + name}
                style={{ cursor: "grab", touchAction: "none", outline: "none" }}
                onPointerDown={(e) => onPointerDown(name, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onFocus={() => setActive(name)}
                onKeyDown={(e) => onKeyDown(name, e)}
              >
                <rect
                  x={x} y={y} width={layout.box_w} height={layout.box_h} rx={8}
                  fill={moved ? "rgba(245,158,11,0.25)" : "rgba(37,99,235,0.07)"}
                  stroke={active === name ? "#f59e0b" : "#2563eb"} strokeWidth={2} strokeDasharray="6 4"
                />
                {moved && (
                  <text x={x + layout.box_w / 2} y={y + layout.box_h / 2} textAnchor="middle" fontSize={14} fontWeight={700} fill="#111">
                    {name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
