"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm"
      >
        <h1 className="mb-1 font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
          RealtyPulse
        </h1>
        <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">Sign in to the operator dashboard.</p>

        <label className="mb-1 block text-xs font-mono uppercase tracking-wide text-[var(--color-muted-foreground)]" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-xs font-mono uppercase tracking-wide text-[var(--color-muted-foreground)]" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm"
        />

        {error && <p className="mb-4 text-sm text-[var(--color-destructive)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full rounded-lg bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
