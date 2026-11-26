"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthBar from "@/components/AuthBar";
import ThemeToggle from "@/components/ThemeToggle";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function NavBar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const loginPage = pathname === "/login" || pathname === "/setup-admin";

  const links = [
    { href: "/", label: "Setups", active: pathname === "/" || pathname.startsWith("/setups") || pathname === "/new" },
    { href: "/access-points", label: "Access points", active: pathname.startsWith("/access-points") },
    { href: "/map", label: "Office map", active: pathname.startsWith("/map") },
    ...(user?.role === "admin" ? [{ href: "/trash", label: "Trash", active: pathname.startsWith("/trash") }] : []),
  ];

  return (
    <nav className="navbar" aria-label="Main">
      <b className="navbar-title">SRM</b>
      {!loginPage && links.map((l) => (
        <Link key={l.href} href={l.href} className={"navbar-link" + (l.active ? " active" : "")} aria-current={l.active ? "page" : undefined}>{l.label}</Link>
      ))}
      <span style={{ flex: 1 }} />
      <ThemeToggle />
      <AuthBar part="status" />
      <AuthBar part="actions" />
    </nav>
  );
}
