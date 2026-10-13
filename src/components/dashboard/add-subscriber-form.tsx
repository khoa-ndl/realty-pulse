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
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
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
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add subscriber"}
      </button>
      {state.error && <p className="w-full text-sm text-[var(--color-destructive)]">{state.error}</p>}
    </form>
  );
}
