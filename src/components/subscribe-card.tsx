"use client";

import { useState, type FormEvent } from "react";

type SubscribeResult = { success: true } | { error: string };

export function SubscribeCard({ onSubscribe }: { onSubscribe: (email: string) => Promise<SubscribeResult> }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await onSubscribe(email);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
          Check your email
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          If this is a new address, we&apos;ve sent a confirmation link to <span className="font-semibold">{email}</span>.
          Click it to start receiving RealtyPulse&apos;s weekly updates.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="mb-1 font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
          Subscribe to RealtyPulse
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Weekly market updates and spotlight listings, straight to your inbox.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="text-xs font-[family-name:var(--font-data)] uppercase tracking-wide text-[var(--color-muted-foreground)]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm transition-colors duration-150 focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary)]/15"
        />
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full cursor-pointer rounded-lg bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Subscribing…" : "Subscribe"}
      </button>
    </form>
  );
}
