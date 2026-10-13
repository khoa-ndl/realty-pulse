import type { IssueRecord, IssueStore } from "./issue-store";
import type { OutboundMcpClient } from "@/lib/mcp/client";
import { personalizeIssueHtml } from "./personalize-issue";

export interface SendIssueDeps {
  store: Pick<IssueStore, "getIssue" | "markSent">;
  client: Pick<OutboundMcpClient, "listSubscribers" | "sendEmail">;
  subject: string;
}

export async function sendIssue(
  deps: SendIssueDeps,
  issueId: string
): Promise<{ sent: number } | { error: string }> {
  const issue: IssueRecord | null = await deps.store.getIssue(issueId);
  if (!issue) {
    return { error: "Issue not found." };
  }
  if (issue.sentAt) {
    return { error: "This issue has already been sent." };
  }

  const subscribers = await deps.client.listSubscribers();
  let sent = 0;
  for (const subscriber of subscribers) {
    try {
      await deps.client.sendEmail(subscriber.email, deps.subject, personalizeIssueHtml(issue.html, subscriber.email));
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return {
        error: `Sent to ${sent} of ${subscribers.length} subscribers before a failure (${message}). The issue was not marked sent — check logs before retrying to avoid duplicate sends.`,
      };
    }
  }

  await deps.store.markSent(issueId);
  return { sent };
}
