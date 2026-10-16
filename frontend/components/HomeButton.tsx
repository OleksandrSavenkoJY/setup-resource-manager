"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HomeButton() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login" || pathname === "/setup-admin") return null;

  return (
    <Link href="/" aria-label="Back to home page">
      <button type="button" className="secondary">← Home</button>
    </Link>
  );
}
