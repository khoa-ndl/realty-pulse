import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { createSupabaseIssuesTable, SupabaseIssueStore } from "@/lib/content/issue-store";
import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";
import { formatPacificDateTime } from "@/lib/dashboard/format-pacific-date";
import { SendIssueButton } from "@/components/dashboard/send-issue-button";
import { sendIssueAction } from "@/app/dashboard/generate-actions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  // Avoid a wasted round-trip (and the Postgres "invalid input syntax for
  // type uuid" error that'd otherwise surface as a 500) for an obviously
  // malformed id — this is "not found", not a server error.
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const store = new SupabaseIssueStore(createSupabaseIssuesTable(supabase));
  const issue = await store.getIssue(id);

  if (!issue) {
    notFound();
  }

  let subscriberCount = 0;
  if (!issue.sentAt) {
    const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
    subscriberCount = (await client.listSubscribers()).length;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
          Issue — {formatPacificDateTime(issue.createdAt)}
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
      {!issue.sentAt && (
        <SendIssueButton issueId={issue.id} subscriberCount={subscriberCount} onSend={sendIssueAction} />
      )}
    </div>
  );
}
