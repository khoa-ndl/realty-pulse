import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardHomePage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
        Generate &amp; Send
      </h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">Coming next — this screen isn&apos;t built yet.</p>
    </div>
  );
}
