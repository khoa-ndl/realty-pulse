"use client";

import { useState } from "react";

type ConfirmResult = { email: string } | { error: string };

export function ConfirmCard({
  token,
  onConfirm,
}: {
  token: string | null;
  onConfirm: (token: string) => Promise<ConfirmResult>;
}) {
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return <p className="text-sm text-[var(--color-destructive)]">This confirmation link is invalid.</p>;
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const result = await onConfirm(token as string);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setConfirmedEmail(result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed.");
    } finally {
      setPending(false);
    }
  }

  if (confirmedEmail) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
          You&apos;re confirmed!
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          You&apos;ll receive RealtyPulse&apos;s weekly updates at <span className="font-semibold">{confirmedEmail}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="mb-1 font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
          Confirm your subscription
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Click below to start receiving RealtyPulse&apos;s weekly market updates.
        </p>
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        className="min-h-11 cursor-pointer self-start rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Confirming…" : "Confirm subscription"}
      </button>
    </div>
  );
}
