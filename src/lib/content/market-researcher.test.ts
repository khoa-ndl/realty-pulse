import { describe, it, expect, vi } from "vitest";
import { createPerplexityResearcher } from "./market-researcher";

function fakeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("createPerplexityResearcher", () => {
  it("posts a sonar chat-completions request naming the metro", async () => {
    const fetchImpl = fakeFetch({
      choices: [{ message: { content: "Seattle's market is cooling slightly." } }],
      citations: ["https://example.com/seattle-market"],
    });
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    await researcher.research("Seattle");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.perplexity.ai/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("sonar");
    expect(body.messages[0].content).toContain("Seattle");
  });

  it("returns the summary and citations from a successful response", async () => {
    const fetchImpl = fakeFetch({
      choices: [{ message: { content: "Seattle's market is cooling slightly." } }],
      citations: ["https://example.com/seattle-market"],
    });
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    const result = await researcher.research("Seattle");
    expect(result).toEqual({
      summary: "Seattle's market is cooling slightly.",
      citations: ["https://example.com/seattle-market"],
    });
  });

  it("throws a clear error on a non-2xx response", async () => {
    const fetchImpl = fakeFetch({ error: "rate limited" }, 429);
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    await expect(researcher.research("Seattle")).rejects.toThrow(/429|Perplexity/);
  });

  it("throws a clear error when the response has no choices", async () => {
    const fetchImpl = fakeFetch({ choices: [] });
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    await expect(researcher.research("Seattle")).rejects.toThrow();
  });
});
