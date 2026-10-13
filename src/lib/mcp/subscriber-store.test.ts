import { describe, it, expect, vi } from "vitest";
import { SupabaseSubscriberStore, type SubscribersTable } from "./subscriber-store";

function makeFakeTable(): SubscribersTable {
  return {
    upsertActive: vi.fn().mockResolvedValue(undefined),
    selectActive: vi.fn().mockResolvedValue([]),
    markUnsubscribed: vi.fn().mockResolvedValue(undefined),
    selectByEmail: vi.fn().mockResolvedValue(null),
    insertPending: vi.fn().mockResolvedValue(undefined),
    confirmByToken: vi.fn().mockResolvedValue(null),
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

  it('addPendingSubscriber inserts a pending row and returns "created" for a brand-new email', async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await expect(store.addPendingSubscriber("new@example.com", "tok-1")).resolves.toBe("created");
    expect(table.insertPending).toHaveBeenCalledWith("new@example.com", "tok-1", null);
  });

  it('addPendingSubscriber returns "already-active" and does not insert when the email is already an active subscriber', async () => {
    const table = makeFakeTable();
    table.selectByEmail = vi.fn().mockResolvedValue({ confirmedAt: "2026-01-01T00:00:00Z", unsubscribedAt: null });
    const store = new SupabaseSubscriberStore(table);
    await expect(store.addPendingSubscriber("active@example.com", "tok-2")).resolves.toBe("already-active");
    expect(table.insertPending).not.toHaveBeenCalled();
  });

  it("addPendingSubscriber treats a previously-unsubscribed email as a fresh pending signup", async () => {
    const table = makeFakeTable();
    table.selectByEmail = vi
      .fn()
      .mockResolvedValue({ confirmedAt: "2026-01-01T00:00:00Z", unsubscribedAt: "2026-02-01T00:00:00Z" });
    const store = new SupabaseSubscriberStore(table);
    await expect(store.addPendingSubscriber("backagain@example.com", "tok-3")).resolves.toBe("created");
    expect(table.insertPending).toHaveBeenCalledWith("backagain@example.com", "tok-3", null);
  });

  it("confirmSubscriber delegates to table.confirmByToken", async () => {
    const table = makeFakeTable();
    vi.mocked(table.confirmByToken).mockResolvedValue("confirmed@example.com");
    const store = new SupabaseSubscriberStore(table);
    await expect(store.confirmSubscriber("tok-4")).resolves.toBe("confirmed@example.com");
  });

  it("confirmSubscriber returns null for an invalid or already-used token", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await expect(store.confirmSubscriber("bad-token")).resolves.toBeNull();
  });
});
