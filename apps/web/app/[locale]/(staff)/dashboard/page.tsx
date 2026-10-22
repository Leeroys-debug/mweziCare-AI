import { requireRole } from "@/lib/rbac";
import { DashboardView } from "@/components/staff/dashboard/dashboard-view";

export default async function StaffDashboardPage() {
  await requireRole(["programme_admin"]);
  return <DashboardView />;
}
