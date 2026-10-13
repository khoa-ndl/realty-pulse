"use server";

import { randomUUID } from "node:crypto";
import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { renderConfirmationEmailHtml } from "@/lib/content/confirmation-email";
import { getEnv } from "@/lib/env";

export async function subscribeAction(email: string): Promise<{ success: true } | { error: string }> {
  try {
    const env = getEnv();
    const token = randomUUID();
    const client = await connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);

    const status = await client.addPendingSubscriber(email, token, "public-signup");
    if (status === "created") {
      const confirmUrl = `${env.NEXT_PUBLIC_APP_URL}/confirm?token=${token}`;
      await client.sendEmail(email, "Confirm your RealtyPulse subscription", renderConfirmationEmailHtml(confirmUrl));
    }

    return { success: true };
  } catch (error) {
    // Generic message for this anonymous, public action -- the real
    // error (which could be internal Supabase/MCP detail) goes to the
    // server log only, not to whoever is on the other end of the form.
    console.error("[subscribeAction]", error);
    return { error: "Something went wrong. Please try again." };
  }
}
