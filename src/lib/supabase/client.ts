import { createBrowserClient } from "@supabase/ssr";

// Deliberate exception to "always read via getEnv()": this file is bundled
// into the browser, where only NEXT_PUBLIC_* vars are inlined at build time.
// Calling getEnv() here would fail validation against server-only vars
// (SUPABASE_SERVICE_ROLE_KEY, GMAIL_*, etc.) that are never present client-side.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
