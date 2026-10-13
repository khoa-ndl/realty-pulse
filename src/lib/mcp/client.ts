import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { SubscriberRecord } from "./subscriber-store";

export interface OutboundMcpClient {
  addSubscriber(email: string, source?: string): Promise<void>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  removeSubscriber(email: string): Promise<void>;
  sendEmail(to: string, subject: string, html: string): Promise<void>;
  addPendingSubscriber(email: string, token: string, source?: string): Promise<"created" | "already-active">;
  confirmSubscriber(token: string): Promise<string | null>;
}

function assertNotError(result: {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}): void {
  if (result.isError) {
    const message = result.content.find((c) => c.type === "text")?.text ?? "Unknown MCP tool error";
    throw new Error(message);
  }
}

export async function connectOutboundMcpClient(baseUrl: string, token: string): Promise<OutboundMcpClient> {
  const client = new Client({ name: "realty-pulse-app", version: "0.1.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl), { authProvider: { token: async () => token } })
  );

  return {
    async addSubscriber(email, source) {
      assertNotError(await client.callTool({ name: "add_subscriber", arguments: { email, source } }));
    },
    async listSubscribers() {
      const result = await client.callTool({ name: "list_subscribers", arguments: {} });
      assertNotError(result);
      return (result.structuredContent as { subscribers: SubscriberRecord[] }).subscribers;
    },
    async removeSubscriber(email) {
      assertNotError(await client.callTool({ name: "remove_subscriber", arguments: { email } }));
    },
    async sendEmail(to, subject, html) {
      assertNotError(await client.callTool({ name: "send_email", arguments: { to, subject, html } }));
    },
    async addPendingSubscriber(email, token, source) {
      const result = await client.callTool({ name: "add_pending_subscriber", arguments: { email, token, source } });
      assertNotError(result);
      return (result.structuredContent as { status: "created" | "already-active" }).status;
    },
    async confirmSubscriber(token) {
      const result = await client.callTool({ name: "confirm_subscriber", arguments: { token } });
      assertNotError(result);
      return (result.structuredContent as { email: string | null }).email;
    },
  };
}
