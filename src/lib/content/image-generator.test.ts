import { describe, it, expect, vi } from "vitest";
import { createKieAiImageGenerator } from "./image-generator";
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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("createKieAiImageGenerator", () => {
  it("creates a task naming the model and a prompt built from the listing, then polls until success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-1" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { state: "waiting" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          code: 200,
          data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://img.example.com/1.png"] }) },
        })
      );
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl });

    const urls = await generator.generatePropertyPhotos(listing);

    expect(urls).toEqual(["https://img.example.com/1.png"]);
    const [createUrl, createInit] = fetchImpl.mock.calls[0];
    expect(createUrl).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(createInit.headers.Authorization).toBe("Bearer test-key");
    const createBody = JSON.parse(createInit.body);
    expect(createBody.model).toBe("google/nano-banana");
    expect(createBody.input.prompt).toContain(listing.neighborhood);
    expect(fetchImpl.mock.calls[1][0]).toContain("task-1");
    expect(sleepImpl).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when the task reaches state fail", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-2" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { state: "fail", failMsg: "content policy" } }));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/content policy|fail/);
  });

  it("gives up after maxPolls attempts stuck in waiting", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-3" } }))
      .mockImplementation(() => Promise.resolve(jsonResponse({ code: 200, data: { state: "waiting" } })));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn(), maxPolls: 3 });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/timed out|maxPolls|waiting/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1 + 3);
  });
});
