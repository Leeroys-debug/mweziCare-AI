import { requireRole } from "@/lib/rbac";
import { UserLookupForm } from "@/components/staff/users/user-lookup-form";

export default async function StaffUsersPage() {
  await requireRole(["system_admin"]);
  return <UserLookupForm />;
}
