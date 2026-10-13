import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SubscriberStore } from "./subscriber-store";
import type { EmailSender } from "./email-sender";

type ToolResult = { content: Array<{ type: "text"; text: string }>; structuredContent?: unknown };

function wrapToolHandler<Args>(fn: (args: Args) => Promise<ToolResult>) {
  return async (args: Args) => {
    try {
      return await fn(args);
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
      };
    }
  };
}

export function createOutboundServer(store: SubscriberStore, sender: EmailSender): McpServer {
  const server = new McpServer({ name: "realty-pulse-outbound", version: "0.1.0" });

  server.registerTool(
    "add_subscriber",
    {
      description: "Add an email to the active subscriber list",
      inputSchema: z.object({ email: z.string().email(), source: z.string().optional() }),
    },
    wrapToolHandler(async ({ email, source }) => {
      await store.addSubscriber(email, source);
      return { content: [{ type: "text", text: `Subscribed ${email}` }] };
    })
  );

  server.registerTool(
    "list_subscribers",
    {
      description: "List all active subscribers",
      inputSchema: z.object({}),
      outputSchema: z.object({
        subscribers: z.array(
          z.object({ email: z.string(), source: z.string().nullable(), subscribedAt: z.string() })
        ),
      }),
    },
    wrapToolHandler(async () => {
      const subscribers = await store.listSubscribers();
      return {
        content: [{ type: "text", text: `${subscribers.length} active subscriber(s)` }],
        structuredContent: { subscribers },
      };
    })
  );

  server.registerTool(
    "remove_subscriber",
    {
      description: "Unsubscribe an email from the active subscriber list",
      inputSchema: z.object({ email: z.string().email() }),
    },
    wrapToolHandler(async ({ email }) => {
      await store.removeSubscriber(email);
      return { content: [{ type: "text", text: `Unsubscribed ${email}` }] };
    })
  );

  server.registerTool(
    "send_email",
    {
      description: "Send an HTML email",
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        html: z.string().min(1),
      }),
    },
    wrapToolHandler(async ({ to, subject, html }) => {
      await sender.sendEmail(to, subject, html);
      return { content: [{ type: "text", text: `Sent to ${to}` }] };
    })
  );

  return server;
}
