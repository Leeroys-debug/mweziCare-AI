import { AppBottomNav } from "@/components/app-bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { QueryProvider } from "@/components/query-provider";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { requireUser } from "@/lib/rbac";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <QueryProvider>
      <div className="min-h-dvh pb-20">
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
          <InstallPrompt />
          {children}
        </main>
        <SyncStatusIndicator />
        <AppBottomNav />
      </div>
    </QueryProvider>
  );
}
