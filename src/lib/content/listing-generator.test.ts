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
