import Link from "next/link";
import type { IssueRecord } from "@/lib/content/issue-store";
import { formatPacificDateTime } from "@/lib/dashboard/format-pacific-date";

export function IssueList({ issues }: { issues: IssueRecord[] }) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No issues yet — generate your first one from Generate &amp; Send.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Generated
            </th>
            <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Trigger
            </th>
            <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Listings
            </th>
            <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Research summary
            </th>
            <th className="border-b border-[var(--color-border)] px-4 py-3 text-left font-[family-name:var(--font-data)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Status
            </th>
            <th className="border-b border-[var(--color-border)] px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td className="border-b border-[var(--color-border)] px-4 py-4 text-sm">
                {formatPacificDateTime(issue.createdAt)}
              </td>
              <td className="border-b border-[var(--color-border)] px-4 py-4 text-sm">
                <span
                  className={`rounded-full px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold ${
                    issue.triggerType === "scheduled"
                      ? "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                      : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                  }`}
                >
                  {issue.triggerType}
                </span>
              </td>
              <td className="border-b border-[var(--color-border)] px-4 py-4 text-sm">{issue.listings.length}</td>
              <td className="max-w-[360px] truncate border-b border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-muted-foreground)]">
                {issue.marketSummary}
              </td>
              <td className="border-b border-[var(--color-border)] px-4 py-4 text-sm">
                <span
                  className={`rounded-full px-2.5 py-1 font-[family-name:var(--font-data)] text-xs font-semibold ${
                    issue.sentAt
                      ? "bg-[var(--color-success-subtle)] text-[var(--color-success)]"
                      : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                  }`}
                >
                  {issue.sentAt ? "Sent" : "Not sent"}
                </span>
              </td>
              <td className="border-b border-[var(--color-border)] px-4 py-4 text-sm">
                <Link
                  href={`/dashboard/archive/${issue.id}`}
                  className="rounded font-semibold text-[var(--color-primary)] transition-colors duration-150 hover:text-[var(--color-primary-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
