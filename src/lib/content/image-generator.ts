import type { SyntheticListing } from "./listing-generator";

export interface ImageGenerator {
  generatePropertyPhotos(listing: SyntheticListing): Promise<string[]>;
}

export interface KieAiImageGeneratorOptions {
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  maxPolls?: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createKieAiImageGenerator(
  apiKey: string,
  options: KieAiImageGeneratorOptions = {}
): ImageGenerator {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  const maxPolls = options.maxPolls ?? 30;

  return {
    async generatePropertyPhotos(listing: SyntheticListing): Promise<string[]> {
      const prompt = `A professional real estate photo of a ${listing.beds}-bedroom, ${listing.baths}-bathroom home, ${listing.sqft} square feet, in the ${listing.neighborhood} neighborhood of Seattle.`;

      const createResponse = await fetchImpl("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/nano-banana",
          input: { prompt, output_format: "png" },
        }),
      });
      const createBody = await createResponse.json();
      const taskId = createBody?.data?.taskId;
      if (!taskId) {
        throw new Error("kie.ai createTask response had no taskId");
      }

      for (let attempt = 0; attempt < maxPolls; attempt++) {
        const pollResponse = await fetchImpl(
          `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        const pollBody = await pollResponse.json();
        const state = pollBody?.data?.state;

        if (state === "success") {
          const resultJson = JSON.parse(pollBody.data.resultJson);
          return resultJson.resultUrls;
        }
        if (state === "fail") {
          throw new Error(`kie.ai task failed: ${pollBody?.data?.failMsg ?? "unknown reason"}`);
        }

        await sleepImpl(2000);
      }

      throw new Error(`kie.ai task timed out after ${maxPolls} polls`);
    },
  };
}
