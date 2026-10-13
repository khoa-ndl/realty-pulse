import { describe, it, expect } from "vitest";
import { generateListings } from "./listing-generator";

describe("generateListings", () => {
  it("generates exactly `count` listings", () => {
    expect(generateListings(4, () => 0.5)).toHaveLength(4);
  });

  it("keeps every field within its documented range at the rng=0 boundary", () => {
    const [listing] = generateListings(1, () => 0);
    expect(listing.price).toBeGreaterThanOrEqual(650_000);
    expect(listing.beds).toBeGreaterThanOrEqual(1);
    expect(listing.baths).toBeGreaterThanOrEqual(1);
    expect(listing.sqft).toBeGreaterThanOrEqual(600);
  });

  it("keeps every field within its documented range at the rng=0.999 boundary", () => {
    const [listing] = generateListings(1, () => 0.999);
    expect(listing.price).toBeLessThanOrEqual(2_100_000);
    expect(listing.beds).toBeLessThanOrEqual(5);
    expect(listing.baths).toBeLessThanOrEqual(4);
    expect(listing.sqft).toBeLessThanOrEqual(4200);
  });

  it("keeps sqft, baths, and price plausible relative to beds across many varied samples", () => {
    // A small deterministic PRNG (not a constant) so beds/sqft/baths/price are each
    // rolled from genuinely different values across listings and calls, the same way
    // Math.random would behave — this is what actually exercises whether the fields
    // are derived from each other or rolled fully independently.
    let state = 42;
    const seededRng = () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
    const listings = generateListings(50, seededRng);
    for (const listing of listings) {
      expect(Math.abs(listing.baths - listing.beds)).toBeLessThanOrEqual(2);
      expect(listing.sqft / listing.beds).toBeGreaterThanOrEqual(400);
      expect(listing.sqft / listing.beds).toBeLessThanOrEqual(900);
      expect(listing.price / listing.sqft).toBeGreaterThanOrEqual(300);
      expect(listing.price / listing.sqft).toBeLessThanOrEqual(1500);
    }
  });

  it("includes a neighborhood from the fixed list and a non-empty blurbSeed", () => {
    const [listing] = generateListings(1, () => 0.3);
    expect([
      "Ballard", "Fremont", "Capitol Hill", "Queen Anne", "Green Lake",
      "Wallingford", "West Seattle", "Beacon Hill", "Columbia City", "Magnolia",
    ]).toContain(listing.neighborhood);
    expect(listing.blurbSeed.length).toBeGreaterThan(0);
    expect(listing.address).toContain(listing.neighborhood);
  });
});
