"use client";

import { useState } from "react";

type UnsubscribeResult = { success: true } | { error: string };

export function UnsubscribeCard({
  email,
  onUnsubscribe,
}: {
  email: string | null;
  onUnsubscribe: (email: string) => Promise<UnsubscribeResult>;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!email) {
    return (
      <p className="text-sm text-[var(--color-destructive)]">
        This unsubscribe link is missing an email address. Please use the link from a RealtyPulse email directly.
      </p>
    );
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const result = await onUnsubscribe(email as string);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unsubscribe failed.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
          You&apos;ve been unsubscribed
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <span className="font-semibold">{email}</span> will no longer receive RealtyPulse emails.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="mb-1 font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
          Unsubscribe from RealtyPulse
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Stop sending weekly market updates to <span className="font-semibold">{email}</span>?
        </p>
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        className="min-h-11 cursor-pointer self-start rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </button>
    </div>
  );
}
