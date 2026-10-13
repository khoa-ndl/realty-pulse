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

  it("throws when a success response has no usable resultUrls", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-4" } }))
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: [] }) } }))
      );
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/resultUrls/);
  });

  it("throws a clear error when resultJson is missing or malformed on success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-5" } }))
      .mockImplementation(() => Promise.resolve(jsonResponse({ code: 200, data: { state: "success" } })));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/resultUrls|resultJson/);
  });

  it("throws naming the HTTP status when createTask returns a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ msg: "invalid key" }), { status: 401 }));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/401/);
  });

  it("throws naming the HTTP status when a poll returns a non-2xx response, instead of treating it as waiting", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-6" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ msg: "unauthorized" }), { status: 401 }));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/401/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("includes a no-text/caption/watermark instruction in the image prompt", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-7" } }))
      .mockResolvedValueOnce(
        jsonResponse({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://img.example.com/1.png"] }) } })
      );
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await generator.generatePropertyPhotos(listing);
    const createBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(createBody.input.prompt).toMatch(/no text|no captions|no signage|no watermarks/i);
  });
});
