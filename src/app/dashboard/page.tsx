import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { GenerateAndSend } from "@/components/dashboard/generate-and-send";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";
import { generateIssueAction, sendIssueAction } from "./generate-actions";

export default async function DashboardHomePage() {
  await requireUser();
  const env = getEnv();
  const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
  const subscribers = await client.listSubscribers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
        Generate &amp; Send
      </h1>
      <GenerateAndSend
        subscriberCount={subscribers.length}
        onGenerate={generateIssueAction}
        onSend={sendIssueAction}
      />
    </div>
  );
}
