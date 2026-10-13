"use server";

import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { getEnv } from "@/lib/env";

export async function confirmAction(token: string): Promise<string | null> {
  const env = getEnv();
  const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
  return client.confirmSubscriber(token);
}
