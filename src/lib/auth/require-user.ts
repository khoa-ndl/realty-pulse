import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Defense-in-depth: the proxy (src/proxy.ts) is the primary gate on
 * /dashboard/*, but every Server Action and data page re-verifies the
 * session itself rather than trusting the proxy alone, per Next.js's own
 * guidance that a Server Function is a reachable POST endpoint in its own
 * right. Also has the side effect of making each page dynamic on its own
 * terms (a cookies() read), independent of whatever the layout happens to do.
 */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
