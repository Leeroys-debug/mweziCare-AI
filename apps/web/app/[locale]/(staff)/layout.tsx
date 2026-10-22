import { StaffNav } from "@/components/staff/staff-nav";
import { requireRole } from "@/lib/rbac";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fine-grained gate inside the handler, in addition to proxy.ts's
  // coarse redirect (CLAUDE.md). Also writes an audit.access_log row.
  await requireRole([
    "clinician",
    "verifier",
    "programme_admin",
    "system_admin",
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <StaffNav />
      {children}
    </main>
  );
}
