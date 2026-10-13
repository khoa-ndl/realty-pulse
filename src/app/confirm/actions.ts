"use server";

import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { getEnv } from "@/lib/env";

export async function confirmAction(token: string): Promise<{ email: string } | { error: string }> {
  try {
    const env = getEnv();
    const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
    const email = await client.confirmSubscriber(token);
    if (!email) {
      return { error: "This confirmation link is invalid or has already been used." };
    }
    return { email };
  } catch (error) {
    console.error("[confirmAction]", error);
    return { error: "Something went wrong. Please try again." };
  }
}
