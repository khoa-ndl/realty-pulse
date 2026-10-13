import { describe, it, expect } from "vitest";
import { renderIssueHtml } from "./issue-template";
import type { StoredListing } from "./issue-store";

const listing: StoredListing = {
  address: "123 Fremont Ave N, Fremont, Seattle, WA",
  neighborhood: "Fremont",
  price: 950_000,
  beds: 3,
  baths: 2,
  sqft: 1800,
  blurb: "A charming Fremont craftsman.",
  photoUrls: ["https://img.example.com/1.png", "https://img.example.com/2.png"],
};

describe("renderIssueHtml", () => {
  it("includes the market commentary and brand name", () => {
    const html = renderIssueHtml({
      marketCommentary: "Seattle's market is steady.",
      listings: [listing],
      baseUrl: "https://realtypulse.example.com",
    });
    expect(html).toContain("RealtyPulse");
    expect(html).toContain("Seattle's market is steady.");
  });

  it("renders each listing's blurb, address, and photos as <img> tags", () => {
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain(listing.blurb);
    expect(html).toContain(listing.address);
    for (const url of listing.photoUrls) {
      expect(html).toContain(`<img src="${url}"`);
    }
  });

  it("renders price, beds, baths, and sqft as plain text outside any img tag", () => {
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain("$950,000");
    expect(html).toContain("3 bd");
    expect(html).toContain("2 ba");
    expect(html).toContain("1,800 sqft");
    const imgTags = html.match(/<img[^>]*>/g) ?? [];
    for (const tag of imgTags) {
      expect(tag).not.toContain("950,000");
      expect(tag).not.toContain("1,800");
    }
  });

  it("includes an intact {{SUBSCRIBER_EMAIL}} placeholder in an absolute unsubscribe link", () => {
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain("https://realtypulse.example.com/unsubscribe?email={{SUBSCRIBER_EMAIL}}");
  });

  it("renders multiple listings in the order given", () => {
    const second: StoredListing = { ...listing, address: "2 Other St", blurb: "Second blurb." };
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing, second], baseUrl: "https://realtypulse.example.com" });
    expect(html.indexOf(listing.address)).toBeLessThan(html.indexOf(second.address));
  });

  it("escapes HTML-special characters in AI-generated commentary and blurbs instead of breaking the markup", () => {
    const injected: StoredListing = {
      ...listing,
      blurb: "Great <b>deal</b> & cozy home",
    };
    const html = renderIssueHtml({
      marketCommentary: "Rates & inventory <are> tightening",
      listings: [injected],
      baseUrl: "https://realtypulse.example.com",
    });
    expect(html).not.toContain("<b>deal</b>");
    expect(html).not.toContain("<are>");
    expect(html).toContain("Rates &amp; inventory &lt;are&gt; tightening");
    expect(html).toContain("Great &lt;b&gt;deal&lt;/b&gt; &amp; cozy home");
  });

  it("escapes a double quote in a photo URL so it can't break out of the src attribute", () => {
    const injected: StoredListing = { ...listing, photoUrls: ['https://img.example.com/1.png"onerror="alert(1)'] };
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [injected], baseUrl: "https://realtypulse.example.com" });
    expect(html).not.toContain('src="https://img.example.com/1.png"onerror="alert(1)"');
    expect(html).toContain("&quot;onerror=&quot;alert(1)");
  });
});
