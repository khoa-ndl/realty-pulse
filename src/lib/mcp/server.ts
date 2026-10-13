import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SubscriberStore } from "./subscriber-store";
import type { EmailSender } from "./email-sender";

type ToolResult = { content: Array<{ type: "text"; text: string }>; structuredContent?: unknown };

const normalizedEmail = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .pipe(z.email());

export function requireBearerToken(
  handler: (req: Request) => Promise<Response>,
  token: string
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.headers.get("authorization") !== `Bearer ${token}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    return handler(req);
  };
}

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
      inputSchema: z.object({ email: normalizedEmail, source: z.string().optional() }),
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
      inputSchema: z.object({ email: normalizedEmail }),
    },
    wrapToolHandler(async ({ email }) => {
      await store.removeSubscriber(email);
      return { content: [{ type: "text", text: `Unsubscribed ${email}` }] };
    })
  );

  server.registerTool(
    "add_pending_subscriber",
    {
      description: "Register a pending subscriber who must confirm via email before receiving sends",
      inputSchema: z.object({ email: normalizedEmail, source: z.string().optional(), token: z.string().min(1) }),
      outputSchema: z.object({ status: z.enum(["created", "skipped"]) }),
    },
    wrapToolHandler(async ({ email, source, token }) => {
      const status = await store.addPendingSubscriber(email, token, source);
      return { content: [{ type: "text", text: status }], structuredContent: { status } };
    })
  );

  server.registerTool(
    "confirm_subscriber",
    {
      description: "Confirm a pending subscriber using their confirmation token",
      inputSchema: z.object({ token: z.string().min(1) }),
      outputSchema: z.object({ email: z.string().nullable() }),
    },
    wrapToolHandler(async ({ token }) => {
      const email = await store.confirmSubscriber(token);
      return {
        content: [{ type: "text", text: email ? `Confirmed ${email}` : "Invalid or expired token" }],
        structuredContent: { email },
      };
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
