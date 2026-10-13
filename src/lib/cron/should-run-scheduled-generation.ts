import { mostRecentScheduledRun } from "@/lib/dashboard/next-scheduled-run";

export function shouldRunScheduledGeneration(now: Date, lastScheduledIssueCreatedAt: Date | null): boolean {
  if (!lastScheduledIssueCreatedAt) return true;
  const boundary = mostRecentScheduledRun(now);
  return lastScheduledIssueCreatedAt.getTime() < boundary.getTime();
}
