import { confirmAction } from "./actions";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? await confirmAction(token) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
        {!token ? (
          <p className="text-sm text-[var(--color-destructive)]">This confirmation link is invalid.</p>
        ) : email ? (
          <div className="flex flex-col gap-2">
            <h1 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
              You&apos;re confirmed!
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              You&apos;ll receive RealtyPulse&apos;s weekly updates at <span className="font-semibold">{email}</span>.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-destructive)]">
            This confirmation link is invalid or has already been used.
          </p>
        )}
      </div>
    </div>
  );
}
