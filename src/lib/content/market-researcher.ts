export interface MarketResearch {
  summary: string;
  citations: string[];
}

export interface MarketResearcher {
  research(metro: string): Promise<MarketResearch>;
}

export function createPerplexityResearcher(
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): MarketResearcher {
  return {
    async research(metro: string): Promise<MarketResearch> {
      const response = await fetchImpl("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "user",
              content: `In 2-3 sentences, summarize the current real estate market trends and news for ${metro}.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Perplexity response had no content");
      }

      return { summary: content, citations: body.citations ?? [] };
    },
  };
}
