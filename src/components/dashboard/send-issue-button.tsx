"use client";

import { useState } from "react";

type SendResult = { sent: number } | { error: string };

export function SendIssueButton({
  issueId,
  subscriberCount,
  onSend,
}: {
  issueId: string;
  subscriberCount: number;
  onSend: (issueId: string) => Promise<SendResult>;
}) {
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSend() {
    setPending(true);
    setError(null);
    try {
      const result = await onSend(issueId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSentCount(result.sent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setPending(false);
    }
  }

  if (sentCount !== null) {
    return (
      <p className="text-sm font-semibold text-[var(--color-success)]">Sent to {sentCount} subscribers</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <button
        type="button"
        onClick={handleSend}
        disabled={pending}
        className="min-h-11 self-start rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
      >
        {pending ? "Sending…" : `Send to ${subscriberCount} subscribers`}
      </button>
    </div>
  );
}
