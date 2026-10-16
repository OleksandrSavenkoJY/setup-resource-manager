import { requireAdmin } from "@/lib/server-api";

export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
