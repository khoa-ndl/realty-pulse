import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, type FetchLikeMcpHandler } from "@modelcontextprotocol/node";
import { createOutboundServer } from "./server";
import { connectOutboundMcpClient, type OutboundMcpClient } from "./client";
import type { SubscriberStore, SubscriberRecord } from "./subscriber-store";
import type { EmailSender } from "./email-sender";

async function startTestServer(handler: FetchLikeMcpHandler) {
  const server = createServer(toNodeHandler(handler));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://localhost:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function makeFakeStore() {
  const rows = new Map<string, SubscriberRecord>();
  const store: SubscriberStore = {
    async addSubscriber(email, source) {
      rows.set(email, { email, source: source ?? null, subscribedAt: new Date().toISOString() });
    },
    async listSubscribers() {
      return [...rows.values()];
    },
    async removeSubscriber(email) {
      rows.delete(email);
    },
  };
  return store;
}

function subscribersOf(result: { structuredContent?: unknown }): SubscriberRecord[] {
  return (result.structuredContent as { subscribers: SubscriberRecord[] }).subscribers;
}

function makeFakeSender() {
  let shouldFailNext = false;
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const sender: EmailSender = {
    async sendEmail(to, subject, html) {
      if (shouldFailNext) {
        shouldFailNext = false;
        throw new Error("Gmail API unavailable");
      }
      sent.push({ to, subject, html });
    },
  };
  return { sender, sent, failNext: () => (shouldFailNext = true) };
}

describe("outbound MCP server", () => {
  let baseUrl: string;
  let close: () => Promise<void>;
  let client: Client;
  let wrapper: OutboundMcpClient;
  let fakeSenderCtl: ReturnType<typeof makeFakeSender>;

  beforeAll(async () => {
    const store = makeFakeStore();
    fakeSenderCtl = makeFakeSender();
    const handler = createMcpHandler(() => createOutboundServer(store, fakeSenderCtl.sender));
    const started = await startTestServer(handler);
    baseUrl = started.baseUrl;
    close = started.close;
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl)));
    wrapper = await connectOutboundMcpClient(baseUrl);
  });

  afterAll(async () => {
    await client.close();
    await close();
  });

  it("adds, lists, and removes a subscriber end to end", async () => {
    await client.callTool({ name: "add_subscriber", arguments: { email: "a@example.com", source: "web" } });
    const listed = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect(subscribersOf(listed)).toEqual([
      expect.objectContaining({ email: "a@example.com", source: "web" }),
    ]);
    await client.callTool({ name: "remove_subscriber", arguments: { email: "a@example.com" } });
    const after = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect(subscribersOf(after)).toEqual([]);
  });

  it("re-subscribing an already-active email does not duplicate it", async () => {
    await client.callTool({ name: "add_subscriber", arguments: { email: "b@example.com" } });
    await client.callTool({ name: "add_subscriber", arguments: { email: "b@example.com" } });
    const listed = await client.callTool({ name: "list_subscribers", arguments: {} });
    const matches = subscribersOf(listed).filter((s) => s.email === "b@example.com");
    expect(matches).toHaveLength(1);
    await client.callTool({ name: "remove_subscriber", arguments: { email: "b@example.com" } });
  });

  it("removing a subscriber that was never added is a no-op", async () => {
    const result = await client.callTool({ name: "remove_subscriber", arguments: { email: "never@example.com" } });
    expect(result.isError).toBeFalsy();
  });

  it("rejects a malformed email with a validation error, not a crash", async () => {
    const result = await client.callTool({ name: "add_subscriber", arguments: { email: "not-an-email" } });
    expect(result.isError).toBe(true);
  });

  it("surfaces a Gmail failure as isError instead of throwing", async () => {
    fakeSenderCtl.failNext();
    const result = await client.callTool({
      name: "send_email",
      arguments: { to: "c@example.com", subject: "Hi", html: "<p>hi</p>" },
    });
    expect(result.isError).toBe(true);
  });

  it("connectOutboundMcpClient throws a readable error when a tool reports isError", async () => {
    await expect(wrapper.addSubscriber("not-an-email")).rejects.toThrow();
  });

  it("connectOutboundMcpClient's listSubscribers returns plain SubscriberRecord objects", async () => {
    await wrapper.addSubscriber("d@example.com", "api");
    await expect(wrapper.listSubscribers()).resolves.toEqual([
      expect.objectContaining({ email: "d@example.com", source: "api" }),
    ]);
    await wrapper.removeSubscriber("d@example.com");
  });
});
