import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, type FetchLikeMcpHandler } from "@modelcontextprotocol/node";
import { createOutboundServer, requireBearerToken } from "./server";
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
  const rows = new Map<string, SubscriberRecord & { unsubscribedAt: string | null }>();
  const store: SubscriberStore = {
    async addSubscriber(email, source) {
      rows.set(email, {
        email,
        source: source ?? null,
        subscribedAt: new Date().toISOString(),
        unsubscribedAt: null,
      });
    },
    async listSubscribers() {
      return [...rows.values()]
        .filter((r) => r.unsubscribedAt === null)
        .map(({ email, source, subscribedAt }) => ({ email, source, subscribedAt }));
    },
    async removeSubscriber(email) {
      const row = rows.get(email);
      if (row) row.unsubscribedAt = new Date().toISOString();
    },
    async addPendingSubscriber() {
      return "created";
    },
    async confirmSubscriber() {
      return null;
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

const TOKEN = "test-shared-secret";

describe("requireBearerToken", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const inner = async () => new Response("ok", { status: 200 });
    const wrapped = requireBearerToken(inner, TOKEN);
    const response = await wrapped(new Request("http://localhost/"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the Authorization header has the wrong token", async () => {
    const inner = async () => new Response("ok", { status: 200 });
    const wrapped = requireBearerToken(inner, TOKEN);
    const response = await wrapped(
      new Request("http://localhost/", { headers: { authorization: "Bearer wrong" } })
    );
    expect(response.status).toBe(401);
  });

  it("calls through when the Authorization header has the correct token", async () => {
    const inner = async () => new Response("ok", { status: 200 });
    const wrapped = requireBearerToken(inner, TOKEN);
    const response = await wrapped(
      new Request("http://localhost/", { headers: { authorization: `Bearer ${TOKEN}` } })
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});

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
    const authedFetch = requireBearerToken(handler.fetch, TOKEN);
    const started = await startTestServer({ ...handler, fetch: authedFetch });
    baseUrl = started.baseUrl;
    close = started.close;
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(baseUrl), { authProvider: { token: async () => TOKEN } })
    );
    wrapper = await connectOutboundMcpClient(baseUrl, TOKEN);
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

  it("rejects a request to the real HTTP route with no bearer token", async () => {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(response.status).toBe(401);
  });

  it("re-subscribing after a prior unsubscribe reactivates the same address", async () => {
    await client.callTool({ name: "add_subscriber", arguments: { email: "e@example.com" } });
    await client.callTool({ name: "remove_subscriber", arguments: { email: "e@example.com" } });
    const whileRemoved = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect(subscribersOf(whileRemoved).some((s) => s.email === "e@example.com")).toBe(false);

    await client.callTool({ name: "add_subscriber", arguments: { email: "e@example.com" } });
    const afterReSubscribe = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect(subscribersOf(afterReSubscribe).filter((s) => s.email === "e@example.com")).toHaveLength(1);
    await client.callTool({ name: "remove_subscriber", arguments: { email: "e@example.com" } });
  });

  it("treats differently-cased addresses as the same subscriber", async () => {
    await client.callTool({ name: "add_subscriber", arguments: { email: "F@Example.com" } });
    await client.callTool({ name: "remove_subscriber", arguments: { email: "f@example.com" } });
    const listed = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect(subscribersOf(listed).some((s) => s.email.toLowerCase() === "f@example.com")).toBe(false);
  });
});
