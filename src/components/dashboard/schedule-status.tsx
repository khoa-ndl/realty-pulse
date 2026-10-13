import type { IssueRecord } from "@/lib/content/issue-store";

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
                  {new Date(lastRun.createdAt).toLocaleString()}
                </span>
                <span className="rounded-full bg-[#E6EFE6] px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold text-[var(--color-success)]">
                  Sent
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
            {nextRun.toLocaleString()}
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
                  Outcome
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
                    {new Date(issue.createdAt).toLocaleString()}
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-sm">
                    <span className="rounded-full bg-[#E6EFE6] px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold text-[var(--color-success)]">
                      Sent
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
