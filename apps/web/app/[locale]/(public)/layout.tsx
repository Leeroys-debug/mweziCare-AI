export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-8">{children}</main>
  );
}
