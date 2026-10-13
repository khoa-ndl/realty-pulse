import type { IssueRecord } from "@/lib/content/issue-store";
import { formatPacificDateTime } from "@/lib/dashboard/format-pacific-date";

export function ScheduleStatus({
  scheduledIssues,
  nextRun,
}: {
  scheduledIssues: IssueRecord[];
  nextRun: Date;
}) {
  const lastRun = scheduledIssues[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="mb-2.5 font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Last run
          </p>
          {lastRun ? (
            <>
              <div className="mb-1 flex items-center gap-2.5">
                <span className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
                  {formatPacificDateTime(lastRun.createdAt)}
                </span>
                <span className="rounded-full bg-[var(--color-muted)] px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold text-[var(--color-muted-foreground)]">
                  Generated
                </span>
              </div>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {lastRun.listings.length} listing{lastRun.listings.length === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">No scheduled runs yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="mb-2.5 font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Next scheduled run
          </p>
          <span className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-foreground)]">
            {formatPacificDateTime(nextRun)}
          </span>
        </div>
      </div>
      {scheduledIssues.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Run
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Status
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Listings
                </th>
              </tr>
            </thead>
            <tbody>
              {scheduledIssues.slice(0, 5).map((issue) => (
                <tr key={issue.id}>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">
                    {formatPacificDateTime(issue.createdAt)}
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">
                    <span className="rounded-full bg-[var(--color-muted)] px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold text-[var(--color-muted-foreground)]">
                      Generated
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">{issue.listings.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
