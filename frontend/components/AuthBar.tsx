"use client";

import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function AuthBar() {
  const pathname = usePathname();
  const user = useCurrentUser();

  if (pathname === "/login" || pathname === "/setup-admin" || !user) return null;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center", padding: 12 }}>
      <span>
        Signed in as <b>{user.username}</b> ({user.role})
      </span>
      <button type="button" className="secondary" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
