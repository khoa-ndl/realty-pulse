import { UnsubscribeCard } from "@/components/unsubscribe-card";
import { unsubscribeAction } from "./actions";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
        <UnsubscribeCard email={email ?? null} onUnsubscribe={unsubscribeAction} />
      </div>
    </div>
  );
}
