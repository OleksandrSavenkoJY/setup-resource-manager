export default function TopNav({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="top-nav"
      style={{ position: "fixed", top: 12, left: 12, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}
    >
      {children}
    </div>
  );
}
