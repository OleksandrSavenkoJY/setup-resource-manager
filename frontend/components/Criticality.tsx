import Badge from "@/components/Badge";

export const CRITICALITY = [
  { level: 2, label: "Minor", color: "#65a30d" },
  { level: 3, label: "Medium", color: "#d97706" },
  { level: 4, label: "High", color: "#ea580c" },
];

export function criticalityInfo(level: number | null | undefined) {
  return CRITICALITY.find((c) => c.level === level) ?? CRITICALITY[1];
}

export default function CriticalityBadge({ level }: { level: number | null | undefined }) {
  const c = criticalityInfo(level);
  return <Badge label={c.level + " · " + c.label} color={c.color} title={c.label} />;
}
