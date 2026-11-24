export const CRITICALITY = [
  { level: 1, label: "Low", color: "#16a34a" },
  { level: 2, label: "Minor", color: "#65a30d" },
  { level: 3, label: "Medium", color: "#d97706" },
  { level: 4, label: "High", color: "#ea580c" },
  { level: 5, label: "Critical", color: "#dc2626" },
];

export function criticalityInfo(level: number | null | undefined) {
  return CRITICALITY.find((c) => c.level === level) ?? CRITICALITY[2];
}

export default function CriticalityBadge({ level }: { level: number | null | undefined }) {
  const c = criticalityInfo(level);
  return (
    <span
      title={`Criticality ${c.level}/5 - ${c.label}`}
      style={{ background: c.color, color: "#fff", borderRadius: 999, padding: "2px 10px", fontWeight: 700, whiteSpace: "nowrap" }}
    >
      {c.level} · {c.label}
    </span>
  );
}
