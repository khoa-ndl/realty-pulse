import { describe, it, expect, vi } from "vitest";
import { generateIssue, type GenerateIssueDeps } from "./generate-issue";
import type { MarketResearcher } from "./market-researcher";
import type { Copywriter } from "./copywriter";
import type { ImageGenerator } from "./image-generator";
import type { IssueStore } from "./issue-store";

function makeDeps(overrides: Partial<GenerateIssueDeps> = {}): GenerateIssueDeps {
  const researcher: MarketResearcher = {
    research: vi.fn().mockResolvedValue({ summary: "steady market", citations: [] }),
  };
  const copywriter: Copywriter = {
    writeMarketCommentary: vi.fn().mockResolvedValue("Seattle's market is steady."),
    writeListingBlurb: vi.fn().mockResolvedValue("A lovely home."),
  };
  const imageGenerator: ImageGenerator = {
    generatePropertyPhotos: vi.fn().mockResolvedValue(["https://img.example.com/1.png"]),
  };
  const issueStore: IssueStore = {
    saveIssue: vi.fn().mockResolvedValue("issue-1"),
    listIssues: vi.fn().mockResolvedValue([]),
    getIssue: vi.fn().mockResolvedValue(null),
  };
  return { researcher, copywriter, imageGenerator, issueStore, baseUrl: "https://realtypulse.example.com", ...overrides };
}

describe("generateIssue", () => {
  it("calls research, commentary, and per-listing copy/photos for the default listing count, then saves and returns the issue", async () => {
    const deps = makeDeps();
    const result = await generateIssue(deps, { triggerType: "manual" });

    expect(deps.researcher.research).toHaveBeenCalledWith("Seattle");
    expect(deps.copywriter.writeMarketCommentary).toHaveBeenCalledTimes(1);
    expect(deps.copywriter.writeListingBlurb).toHaveBeenCalledTimes(4);
    expect(deps.imageGenerator.generatePropertyPhotos).toHaveBeenCalledTimes(4);
    expect(deps.issueStore.saveIssue).toHaveBeenCalledTimes(1);
    const savedIssue = vi.mocked(deps.issueStore.saveIssue).mock.calls[0][0];
    expect(savedIssue.listings).toHaveLength(4);
    expect(savedIssue.triggerType).toBe("manual");
    expect(savedIssue.marketSummary).toBe("steady market");
    expect(result).toEqual({ issueId: "issue-1", html: savedIssue.html });
  });

  it("respects a custom metro and listingCount", async () => {
    const deps = makeDeps();
    await generateIssue(deps, { triggerType: "scheduled", metro: "Portland", listingCount: 2 });
    expect(deps.researcher.research).toHaveBeenCalledWith("Portland");
    expect(deps.copywriter.writeListingBlurb).toHaveBeenCalledTimes(2);
  });

  it("rejects the whole call when one listing's blurb generation fails, without saving anything", async () => {
    const deps = makeDeps();
    vi.mocked(deps.copywriter.writeListingBlurb)
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("Anthropic API unavailable"));
    await expect(generateIssue(deps, { triggerType: "manual" })).rejects.toThrow("Anthropic API unavailable");
    expect(deps.issueStore.saveIssue).not.toHaveBeenCalled();
  });

  it("rejects the whole call when one listing's photo generation fails, without saving anything", async () => {
    const deps = makeDeps();
    vi.mocked(deps.imageGenerator.generatePropertyPhotos)
      .mockResolvedValueOnce(["https://img.example.com/1.png"])
      .mockRejectedValueOnce(new Error("kie.ai task timed out"));
    await expect(generateIssue(deps, { triggerType: "manual" })).rejects.toThrow("kie.ai task timed out");
    expect(deps.issueStore.saveIssue).not.toHaveBeenCalled();
  });
});
