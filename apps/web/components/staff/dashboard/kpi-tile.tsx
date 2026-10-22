export function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}
