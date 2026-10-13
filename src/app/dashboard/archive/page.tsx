import { createClient } from "@supabase/supabase-js";
import { createSupabaseIssuesTable, SupabaseIssueStore } from "@/lib/content/issue-store";
import { IssueList } from "@/components/dashboard/issue-list";
import { getEnv } from "@/lib/env";

export default async function ArchivePage() {
  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const store = new SupabaseIssueStore(createSupabaseIssuesTable(supabase));
  const issues = await store.listIssues();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
        Issue Archive
      </h1>
      <IssueList issues={issues} />
    </div>
  );
}
