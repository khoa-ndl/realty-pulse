"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { generateIssue } from "@/lib/content/generate-issue";
import { createGenerateIssueDeps } from "@/lib/content/pipeline-deps";
import { createSupabaseIssuesTable, SupabaseIssueStore } from "@/lib/content/issue-store";
import { personalizeIssueHtml } from "@/lib/content/personalize-issue";
import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";

const ISSUE_EMAIL_SUBJECT = "RealtyPulse — Weekly Market Update";

function issueStore() {
  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return new SupabaseIssueStore(createSupabaseIssuesTable(supabase));
}

async function mcpClient() {
  const env = getEnv();
  return connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
}

export async function generateIssueAction(): Promise<{ issueId: string; html: string } | { error: string }> {
  await requireUser();

  try {
    const deps = createGenerateIssueDeps(getEnv());
    const { issueId, html } = await generateIssue(deps, { triggerType: "manual" });
    revalidatePath("/dashboard/archive");
    return { issueId, html };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed." };
  }
}

export async function sendIssueAction(issueId: string): Promise<{ sent: number } | { error: string }> {
  await requireUser();

  const store = issueStore();
  const issue = await store.getIssue(issueId);
  if (!issue) {
    return { error: "Issue not found." };
  }

  const client = await mcpClient();
  const subscribers = await client.listSubscribers();
  await Promise.all(
    subscribers.map((subscriber) =>
      client.sendEmail(subscriber.email, ISSUE_EMAIL_SUBJECT, personalizeIssueHtml(issue.html, subscriber.email))
    )
  );
  await store.markSent(issueId);
  revalidatePath("/dashboard/archive");
  revalidatePath("/dashboard/schedule");
  return { sent: subscribers.length };
}
