"use client";

import { useState } from "react";
import type { SubscriberRecord } from "@/lib/mcp/subscriber-store";
import { formatPacificDate } from "@/lib/dashboard/format-pacific-date";

export function SubscriberList({
  subscribers,
  onRemove,
}: {
  subscribers: SubscriberRecord[];
  onRemove: (emails: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function handleRemoveSelected() {
    await onRemove([...selected]);
    setSelected(new Set());
  }

  if (subscribers.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">No subscribers yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-foreground)]">
          <span>{selected.size} selected</span>
          <button
            type="button"
            onClick={handleRemoveSelected}
            className="min-h-11 cursor-pointer rounded-lg bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-[var(--color-on-destructive)] transition-colors duration-150 hover:bg-[var(--color-destructive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
          >
            Remove selected
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr>
              <th className="w-10 border-b border-[var(--color-border)] px-4 py-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Email
              </th>
              <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Source
              </th>
              <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Signed up
              </th>
              <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.email}>
                <td className="border-b border-[var(--color-border)] px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${subscriber.email}`}
                    checked={selected.has(subscriber.email)}
                    onChange={() => toggle(subscriber.email)}
                    className="h-[18px] w-[18px] accent-[var(--color-primary)]"
                  />
                </td>
                <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">{subscriber.email}</td>
                <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
                  {subscriber.source ?? "—"}
                </td>
                <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">
                  {formatPacificDate(subscriber.subscribedAt)}
                </td>
                <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">
                  <span className="rounded-full bg-[var(--color-success-subtle)] px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold text-[var(--color-success)]">
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
