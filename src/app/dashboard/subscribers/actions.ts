"use server";

import { revalidatePath } from "next/cache";
import { connectOutboundMcpClient } from "@/lib/mcp/client";
import { parseAddSubscriberForm } from "@/lib/dashboard/subscriber-form";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";

async function mcpClient() {
  const env = getEnv();
  return connectOutboundMcpClient(`${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound`, env.MCP_OUTBOUND_TOKEN);
}

export async function addSubscriberAction(formData: FormData) {
  await requireUser();

  const parsed = parseAddSubscriberForm(formData);
  if ("error" in parsed) return parsed;

  const client = await mcpClient();
  await client.addSubscriber(parsed.email, parsed.source);
  revalidatePath("/dashboard/subscribers");
  return {};
}

export async function removeSubscribersAction(emails: string[]): Promise<void> {
  await requireUser();

  const client = await mcpClient();
  await Promise.all(emails.map((email) => client.removeSubscriber(email)));
  revalidatePath("/dashboard/subscribers");
}
