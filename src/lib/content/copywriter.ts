import Anthropic from "@anthropic-ai/sdk";
import type { MarketResearch } from "./market-researcher";
import type { SyntheticListing } from "./listing-generator";

export interface Copywriter {
  writeMarketCommentary(research: MarketResearch, metro: string): Promise<string>;
  writeListingBlurb(listing: SyntheticListing): Promise<string>;
}

export interface AnthropicMessageClient {
  createMessage(prompt: string): Promise<string>;
}

export function createClaudeCopywriter(client: AnthropicMessageClient): Copywriter {
  return {
    writeMarketCommentary(research, metro) {
      const prompt = `Write a short (2-3 sentence), warm, professional newsletter commentary section about the ${metro} real estate market, based on this research summary: "${research.summary}"`;
      return client.createMessage(prompt);
    },
    writeListingBlurb(listing) {
      const prompt = `Write a short (2-3 sentence) real estate listing blurb for this property: ${listing.blurbSeed}, priced at $${listing.price}, with ${listing.beds} bedrooms, ${listing.baths} bathrooms, and ${listing.sqft} square feet.`;
      return client.createMessage(prompt);
    },
  };
}

export function createAnthropicMessageClient(apiKey: string): AnthropicMessageClient {
  const anthropic = new Anthropic({ apiKey });
  return {
    async createMessage(prompt: string) {
      const message = await anthropic.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      const block = message.content.find((b) => b.type === "text");
      if (!block) throw new Error("Anthropic response had no text content");
      return block.text;
    },
  };
}
