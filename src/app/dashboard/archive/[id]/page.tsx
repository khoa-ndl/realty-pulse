import { createClient } from "@supabase/supabase-js";
import { createSupabaseIssuesTable, SupabaseIssueStore } from "@/lib/content/issue-store";
import { getEnv } from "@/lib/env";

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const store = new SupabaseIssueStore(createSupabaseIssuesTable(supabase));
  const issue = await store.getIssue(id);

  if (!issue) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Issue not found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
          Issue — {new Date(issue.createdAt).toLocaleString()}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {issue.triggerType} · {issue.listings.length} listings
        </p>
        <p className="mt-2 text-sm text-[var(--color-foreground)]">{issue.marketSummary}</p>
      </div>
      <iframe
        srcDoc={issue.html}
        sandbox=""
        title="Issue preview"
        className="h-[800px] w-full rounded-xl border border-[var(--color-border)] bg-white"
      />
    </div>
  );
}
