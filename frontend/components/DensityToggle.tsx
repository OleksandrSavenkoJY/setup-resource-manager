"use client";

import { useEffect, useState } from "react";

export default function DensityToggle() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setCompact(document.documentElement.dataset.density === "compact");
  }, []);

  function toggle() {
    const next = compact ? "normal" : "compact";
    document.documentElement.dataset.density = next;
    window.localStorage.setItem("density", next);
    setCompact(!compact);
  }

  return (
    <button type="button" className="secondary" onClick={toggle} aria-pressed={compact} title="Table density">
      {compact ? "☰ Compact" : "☷ Normal"}
    </button>
  );
}
