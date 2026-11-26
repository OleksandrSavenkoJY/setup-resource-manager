import Badge from "@/components/Badge";

export const CRITICALITY = [
  { level: 2, label: "Minor", color: "#3b7a99" },
  { level: 3, label: "Medium", color: "#a8661f" },
  { level: 4, label: "High", color: "#9b3b3b" },
];

export function criticalityInfo(level: number | null | undefined) {
  return CRITICALITY.find((c) => c.level === level) ?? CRITICALITY[1];
}

export default function CriticalityBadge({ level }: { level: number | null | undefined }) {
  const c = criticalityInfo(level);
  return <Badge label={c.level + " · " + c.label} color={c.color} title={c.label} />;
}
