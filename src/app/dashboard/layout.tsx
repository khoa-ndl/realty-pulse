import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Nav } from "@/components/dashboard/nav";
import { signOutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)] lg:flex-row">
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col gap-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-3 text-sm text-[var(--color-muted-foreground)]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-muted)] font-[family-name:var(--font-data)] text-xs font-semibold text-[var(--color-primary)]">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            {user?.email}
            <form action={signOutAction}>
              <button
                type="submit"
                className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
