import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { SubscriberList } from "@/components/dashboard/subscriber-list";
import { AddSubscriberForm } from "@/components/dashboard/add-subscriber-form";
import { getEnv } from "@/lib/env";
import { removeSubscribersAction } from "./actions";

export default async function SubscribersPage() {
  const env = getEnv();
  const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
  const subscribers = await client.listSubscribers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-foreground)]">
          Subscribers
        </h1>
        <span className="text-sm text-[var(--color-muted-foreground)]">{subscribers.length} active subscribers</span>
      </div>
      <AddSubscriberForm />
      <SubscriberList subscribers={subscribers} onRemove={removeSubscribersAction} />
    </div>
  );
}
