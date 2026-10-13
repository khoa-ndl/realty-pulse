import { describe, it, expect, vi } from "vitest";
import { SupabaseSubscriberStore, type SubscribersTable } from "./subscriber-store";

function makeFakeTable(): SubscribersTable {
  return {
    upsertActive: vi.fn().mockResolvedValue(undefined),
    selectActive: vi.fn().mockResolvedValue([]),
    markUnsubscribed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SupabaseSubscriberStore", () => {
  it("addSubscriber delegates to table.upsertActive with email and source", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await store.addSubscriber("a@example.com", "web");
    expect(table.upsertActive).toHaveBeenCalledWith("a@example.com", "web");
  });

  it("addSubscriber defaults source to null when omitted", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await store.addSubscriber("a@example.com");
    expect(table.upsertActive).toHaveBeenCalledWith("a@example.com", null);
  });

  it("listSubscribers delegates to table.selectActive", async () => {
    const table = makeFakeTable();
    vi.mocked(table.selectActive).mockResolvedValue([
      { email: "a@example.com", source: null, subscribedAt: "2026-01-01T00:00:00Z" },
    ]);
    const store = new SupabaseSubscriberStore(table);
    await expect(store.listSubscribers()).resolves.toEqual([
      { email: "a@example.com", source: null, subscribedAt: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("removeSubscriber delegates to table.markUnsubscribed", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await store.removeSubscriber("a@example.com");
    expect(table.markUnsubscribed).toHaveBeenCalledWith("a@example.com");
  });
});
