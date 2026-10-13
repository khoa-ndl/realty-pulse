import { generateListings } from "./listing-generator";
import { renderIssueHtml } from "./issue-template";
import type { MarketResearcher } from "./market-researcher";
import type { Copywriter } from "./copywriter";
import type { ImageGenerator } from "./image-generator";
import type { IssueStore, StoredListing } from "./issue-store";

export interface GenerateIssueDeps {
  researcher: MarketResearcher;
  copywriter: Copywriter;
  imageGenerator: ImageGenerator;
  issueStore: IssueStore;
  baseUrl: string;
}

export interface GenerateIssueOptions {
  triggerType: "scheduled" | "manual";
  metro?: string;
  listingCount?: number;
}

export async function generateIssue(
  deps: GenerateIssueDeps,
  options: GenerateIssueOptions
): Promise<{ issueId: string; html: string }> {
  const metro = options.metro ?? "Seattle";
  const listingCount = options.listingCount ?? 4;

  const listings = generateListings(listingCount);
  const research = await deps.researcher.research(metro);
  const marketCommentary = await deps.copywriter.writeMarketCommentary(research, metro);

  const listingContents: StoredListing[] = await Promise.all(
    listings.map(async (listing) => ({
      ...listing,
      blurb: await deps.copywriter.writeListingBlurb(listing),
      photoUrls: await deps.imageGenerator.generatePropertyPhotos(listing),
    }))
  );

  const html = renderIssueHtml({ marketCommentary, listings: listingContents, baseUrl: deps.baseUrl });

  const issueId = await deps.issueStore.saveIssue({
    html,
    triggerType: options.triggerType,
    marketSummary: research.summary,
    listings: listingContents,
  });

  return { issueId, html };
}
