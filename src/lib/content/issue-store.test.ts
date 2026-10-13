import { describe, it, expect, vi } from "vitest";
import { SupabaseIssueStore, type IssuesTable, type IssueRecord, type NewIssue } from "./issue-store";

const sampleIssue: NewIssue = {
  html: "<html>...</html>",
  triggerType: "manual",
  marketSummary: "Seattle's market is steady.",
  listings: [
    {
      address: "1 Main St",
      neighborhood: "Fremont",
      price: 900_000,
      beds: 3,
      baths: 2,
      sqft: 1700,
      blurb: "Nice place.",
      photoUrls: ["https://img.example.com/1.png"],
    },
  ],
};

function makeFakeTable(): IssuesTable {
  return {
    insert: vi.fn().mockResolvedValue("issue-1"),
    selectAll: vi.fn().mockResolvedValue([]),
    selectById: vi.fn().mockResolvedValue(null),
    markSent: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SupabaseIssueStore", () => {
  it("saveIssue delegates to table.insert and returns its id", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await expect(store.saveIssue(sampleIssue)).resolves.toBe("issue-1");
    expect(table.insert).toHaveBeenCalledWith(sampleIssue);
  });

  it("listIssues delegates to table.selectAll", async () => {
    const table = makeFakeTable();
    const record: IssueRecord = { ...sampleIssue, id: "issue-1", createdAt: "2026-01-01T00:00:00Z", sentAt: null };
    vi.mocked(table.selectAll).mockResolvedValue([record]);
    const store = new SupabaseIssueStore(table);
    await expect(store.listIssues()).resolves.toEqual([record]);
  });

  it("listIssues returns an empty array when none are saved", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await expect(store.listIssues()).resolves.toEqual([]);
  });

  it("getIssue delegates to table.selectById", async () => {
    const table = makeFakeTable();
    const record: IssueRecord = { ...sampleIssue, id: "issue-1", createdAt: "2026-01-01T00:00:00Z", sentAt: null };
    vi.mocked(table.selectById).mockResolvedValue(record);
    const store = new SupabaseIssueStore(table);
    await expect(store.getIssue("issue-1")).resolves.toEqual(record);
  });

  it("getIssue returns null for an unknown id", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await expect(store.getIssue("nope")).resolves.toBeNull();
  });

  it("saveIssue leaves a newly-created record with sentAt null", async () => {
    const table = makeFakeTable();
    vi.mocked(table.selectById).mockResolvedValue({
      ...sampleIssue,
      id: "issue-1",
      createdAt: "2026-01-01T00:00:00Z",
      sentAt: null,
    });
    const store = new SupabaseIssueStore(table);
    const record = await store.getIssue("issue-1");
    expect(record?.sentAt).toBeNull();
  });

  it("markSent delegates to table.markSent", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await store.markSent("issue-1");
    expect(table.markSent).toHaveBeenCalledWith("issue-1");
  });
});
