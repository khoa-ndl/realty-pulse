import { createClient } from "@supabase/supabase-js";
import { createSupabaseIssuesTable, SupabaseIssueStore } from "@/lib/content/issue-store";
import { nextScheduledRun } from "@/lib/dashboard/next-scheduled-run";
import { ScheduleStatus } from "@/components/dashboard/schedule-status";
import { getEnv } from "@/lib/env";

export default async function SchedulePage() {
  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const store = new SupabaseIssueStore(createSupabaseIssuesTable(supabase));
  const issues = await store.listIssues();
  const scheduledIssues = issues.filter((issue) => issue.triggerType === "scheduled");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
        Schedule Status
      </h1>
      <ScheduleStatus scheduledIssues={scheduledIssues} nextRun={nextScheduledRun(new Date())} />
    </div>
  );
}
