import { ConfirmCard } from "@/components/confirm-card";
import { confirmAction } from "./actions";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
        <ConfirmCard token={token ?? null} onConfirm={confirmAction} />
      </div>
    </div>
  );
}
