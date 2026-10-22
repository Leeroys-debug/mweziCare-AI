import { requireRole } from "@/lib/rbac";
import { FacilitiesTable } from "@/components/staff/facilities/facilities-table";

export default async function StaffFacilitiesListPage() {
  await requireRole(["verifier", "programme_admin", "system_admin"]);
  return <FacilitiesTable />;
}
