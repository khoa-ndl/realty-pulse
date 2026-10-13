"use server";

import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { parseUnsubscribeEmail } from "@/lib/unsubscribe-email";
import { getEnv } from "@/lib/env";

export async function unsubscribeAction(email: string): Promise<{ success: true } | { error: string }> {
  const parsed = parseUnsubscribeEmail(email);
  if ("error" in parsed) {
    return parsed;
  }

  try {
    const env = getEnv();
    const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
    await client.removeSubscriber(parsed.email);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unsubscribe failed." };
  }
}
