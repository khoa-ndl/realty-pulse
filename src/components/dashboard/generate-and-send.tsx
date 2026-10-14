"use client";

import { useState } from "react";

type GenerateResult = { issueId: string; html: string } | { error: string };
type SendResult = { sent: number } | { error: string };

export function GenerateAndSend({
  subscriberCount,
  onGenerate,
  onSend,
}: {
  subscriberCount: number;
  onGenerate: () => Promise<GenerateResult>;
  onSend: (issueId: string) => Promise<SendResult>;
}) {
  const [step, setStep] = useState<"idle" | "preview" | "sent">("idle");
  const [issue, setIssue] = useState<{ issueId: string; html: string } | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      const result = await onGenerate();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setIssue(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleSend() {
    if (!issue) return;
    setPending(true);
    setError(null);
    try {
      const result = await onSend(issue.issueId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSentCount(result.sent);
      setStep("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setPending(false);
    }
  }

  function handleStartOver() {
    setIssue(null);
    setSentCount(null);
    setError(null);
    setStep("idle");
  }

  if (step === "preview" && issue) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-7 shadow-sm">
        <h2 className="mb-1.5 font-[family-name:var(--font-heading)] text-lg text-[var(--color-foreground)]">
          Preview — Seattle, 4 listings
        </h2>
        <p className="mb-5 text-sm text-[var(--color-muted-foreground)]">
          Review before sending. Nothing goes out until you confirm.
        </p>
        <div className="mb-4 overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-white">
          <iframe
            srcDoc={issue.html}
            sandbox=""
            title="Issue preview"
            className="h-[480px] w-full border-0"
          />
        </div>
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-muted)] px-3.5 py-2.5 text-sm text-[var(--color-muted-foreground)]">
          This will send to all {subscriberCount} active subscribers. This action can&apos;t be undone.
        </div>
        {error && <p className="mb-4 text-sm text-[var(--color-destructive)]">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Sending…" : `Send to ${subscriberCount} subscribers`}
          </button>
        </div>
      </div>
    );
  }

  if (step === "sent") {
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-7 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-subtle)]">
          <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M4 10.5L8 14.5L16 6"
              style={{ stroke: "var(--color-success)" }}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <div>
          <h2 className="mb-1 font-[family-name:var(--font-heading)] text-lg text-[var(--color-foreground)]">
            Sent to {sentCount} subscribers
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">This issue is now in the Issue Archive.</p>
        </div>
        <button
          type="button"
          onClick={handleStartOver}
          className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
        >
          Generate another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-7 shadow-sm">
      <h2 className="mb-1.5 font-[family-name:var(--font-heading)] text-lg text-[var(--color-foreground)]">
        Trigger a new issue
      </h2>
      <p className="mb-5 text-sm text-[var(--color-muted-foreground)]">
        Generates fresh listings, research, copy, and photos — then shows you a preview before anything sends.
      </p>
      <div className="mb-5 flex flex-wrap gap-4">
        <label className="flex min-w-[160px] flex-col gap-1.5">
          <span className="font-[family-name:var(--font-data)] text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Metro
          </span>
          <select
            disabled
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-foreground)]"
          >
            <option>Seattle</option>
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1.5">
          <span className="font-[family-name:var(--font-data)] text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Listings
          </span>
          <select
            disabled
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-foreground)]"
          >
            <option>4</option>
          </select>
        </label>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--color-destructive)]">{error}</p>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate Preview"}
      </button>
    </div>
  );
}
