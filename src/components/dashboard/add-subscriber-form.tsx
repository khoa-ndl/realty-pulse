"use client";

import { useActionState } from "react";
import { addSubscriberAction } from "@/app/dashboard/subscribers/actions";

export function AddSubscriberForm() {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    async (_prev, formData) => addSubscriberAction(formData),
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-[family-name:var(--font-data)] uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition-colors duration-150 focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary)]/15"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="source" className="text-xs font-[family-name:var(--font-data)] uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Source (optional)
        </label>
        <input
          id="source"
          name="source"
          type="text"
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition-colors duration-150 focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary)]/15"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add subscriber"}
      </button>
      {state.error && <p className="w-full text-sm text-[var(--color-destructive)]">{state.error}</p>}
    </form>
  );
}
