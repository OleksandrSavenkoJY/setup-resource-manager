export const BADGE_COLORS = {
  green: "#3f7a4f",
  blue: "#3b7a99",
  grey: "#6b7280",
  amber: "#a8661f",
  purple: "#6d5a99",
  red: "#9b3b3b",
} as const;

export default function Badge({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span className="badge" title={title} style={{ background: color }}>
      {label}
    </span>
  );
}
