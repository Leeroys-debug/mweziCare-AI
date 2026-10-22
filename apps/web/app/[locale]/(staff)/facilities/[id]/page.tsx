import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getFacilityForStaffReview } from "@mwezicare/facilities";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { FacilityVerificationForm } from "@/components/staff/facilities/facility-verification-form";

export default async function StaffFacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["verifier", "programme_admin", "system_admin"]);
  const t = await getTranslations("StaffFacilities");

  const { id } = await params;
  const facility = await getFacilityForStaffReview(db, id);
  if (!facility) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/facilities"
        className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        {t("backToList")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{facility.name}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {facility.county} · {t(`statusLabel.${facility.status}`)}
        </p>
        {facility.phone && (
          <p className="text-sm">
            {t("phone")}: {facility.phone}
          </p>
        )}
      </div>
      <FacilityVerificationForm
        facilityId={facility.id}
        existingNotes={facility.notes}
        existingCallScript={facility.callScript}
      />
    </div>
  );
}
