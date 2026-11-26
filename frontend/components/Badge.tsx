export const BADGE_COLORS = {
  green: "#33993b",
  blue: "#3b5eb0",
  sky: "#3d8ec2",
  grey: "#6b7280",
  amber: "#c07a3e",
  red: "#b03f3b",
} as const;

export default function Badge({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span className="badge" title={title} style={{ background: color }}>
      {label}
    </span>
  );
}
