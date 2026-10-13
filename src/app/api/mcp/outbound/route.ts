import { createMcpHandler } from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";
import { createOutboundServer } from "@/lib/mcp/server";
import { createSupabaseSubscribersTable, SupabaseSubscriberStore } from "@/lib/mcp/subscriber-store";
import { createGmailClient, GmailEmailSender } from "@/lib/mcp/email-sender";
import { getEnv } from "@/lib/env";

const { fetch } = createMcpHandler(() => {
  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const store = new SupabaseSubscriberStore(createSupabaseSubscribersTable(supabase));
  const sender = new GmailEmailSender(createGmailClient(env));
  return createOutboundServer(store, sender);
});

export async function GET(request: Request): Promise<Response> {
  return fetch(request);
}

export const POST = GET;
