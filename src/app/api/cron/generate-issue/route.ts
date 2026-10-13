import { NextResponse } from "next/server";
import { generateIssue } from "@/lib/content/generate-issue";
import { createGenerateIssueDeps } from "@/lib/content/pipeline-deps";
import { shouldRunScheduledGeneration } from "@/lib/cron/should-run-scheduled-generation";
import { requireBearerToken } from "@/lib/mcp/server";
import { getEnv } from "@/lib/env";

async function handler(): Promise<Response> {
  const env = getEnv();
  const deps = createGenerateIssueDeps(env);
  const issues = await deps.issueStore.listIssues();
  const lastScheduled = issues.find((issue) => issue.triggerType === "scheduled");

  if (!shouldRunScheduledGeneration(new Date(), lastScheduled ? new Date(lastScheduled.createdAt) : null)) {
    return NextResponse.json({ ran: false, reason: "Not due yet this week." });
  }

  try {
    const { issueId } = await generateIssue(deps, { triggerType: "scheduled" });
    return NextResponse.json({ ran: true, issueId });
  } catch (error) {
    return NextResponse.json(
      { ran: false, error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return requireBearerToken(handler, getEnv().CRON_SECRET)(request);
}
