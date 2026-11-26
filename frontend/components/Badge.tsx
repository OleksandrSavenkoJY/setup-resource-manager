export const BADGE_COLORS = {
  green: "#15803d",
  blue: "#2563eb",
  grey: "#6b7280",
  amber: "#b45309",
  purple: "#6d28d9",
  red: "#dc2626",
} as const;

export default function Badge({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span className="badge" title={title} style={{ background: color }}>
      {label}
    </span>
  );
}
