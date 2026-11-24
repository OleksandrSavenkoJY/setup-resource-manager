export default function TopNav({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div
      className="top-nav"
      style={{ position: "fixed", top: 12, ...(right ? { right: 12 } : { left: 12 }), zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}
    >
      {children}
    </div>
  );
}
