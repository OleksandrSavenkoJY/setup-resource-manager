export const BADGE_COLORS = {
  green: "#16a34a",
  blue: "#2563eb",
  grey: "#6b7280",
  amber: "#f59e0b",
  red: "#dc2626",
} as const;

export default function Badge({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span className="badge" title={title} style={{ background: color }}>
      {label}
    </span>
  );
}
