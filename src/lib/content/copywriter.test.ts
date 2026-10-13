import { describe, it, expect, vi } from "vitest";
import { createClaudeCopywriter, type AnthropicMessageClient } from "./copywriter";
import type { SyntheticListing } from "./listing-generator";

const listing: SyntheticListing = {
  address: "123 Fremont Ave N, Fremont, Seattle, WA",
  neighborhood: "Fremont",
  price: 950_000,
  beds: 3,
  baths: 2,
  sqft: 1800,
  blurbSeed: "3BR craftsman near Fremont",
};

describe("createClaudeCopywriter", () => {
  it("writeMarketCommentary sends the research summary and metro to the client", async () => {
    const client: AnthropicMessageClient = { createMessage: vi.fn().mockResolvedValue("Seattle's market is steady.") };
    const copywriter = createClaudeCopywriter(client);
    const result = await copywriter.writeMarketCommentary(
      { summary: "cooling slightly", citations: [] },
      "Seattle"
    );
    expect(result).toBe("Seattle's market is steady.");
    const prompt = vi.mocked(client.createMessage).mock.calls[0][0];
    expect(prompt).toContain("cooling slightly");
    expect(prompt).toContain("Seattle");
  });

  it("writeListingBlurb sends the listing's blurbSeed and data to the client", async () => {
    const client: AnthropicMessageClient = { createMessage: vi.fn().mockResolvedValue("A charming Fremont craftsman.") };
    const copywriter = createClaudeCopywriter(client);
    const result = await copywriter.writeListingBlurb(listing);
    expect(result).toBe("A charming Fremont craftsman.");
    const prompt = vi.mocked(client.createMessage).mock.calls[0][0];
    expect(prompt).toContain(listing.blurbSeed);
    expect(prompt).toContain(String(listing.price));
  });

  it("propagates a client error instead of swallowing it", async () => {
    const client: AnthropicMessageClient = {
      createMessage: vi.fn().mockRejectedValue(new Error("Anthropic API unavailable")),
    };
    const copywriter = createClaudeCopywriter(client);
    await expect(copywriter.writeListingBlurb(listing)).rejects.toThrow("Anthropic API unavailable");
  });
});
