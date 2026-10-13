export interface SyntheticListing {
  address: string;
  neighborhood: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  blurbSeed: string;
}

const NEIGHBORHOODS = [
  "Ballard",
  "Fremont",
  "Capitol Hill",
  "Queen Anne",
  "Green Lake",
  "Wallingford",
  "West Seattle",
  "Beacon Hill",
  "Columbia City",
  "Magnolia",
];

const STREET_NAMES = [
  "NW 85th St",
  "Fremont Ave N",
  "15th Ave E",
  "California Ave SW",
  "Rainier Ave S",
  "Greenwood Ave N",
];

const HOME_TYPES = ["craftsman", "townhome", "bungalow", "contemporary", "Tudor", "rambler"];

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function scale(rng: () => number, min: number, max: number): number {
  return Math.round(min + rng() * (max - min));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function generateListings(count: number, rng: () => number = Math.random): SyntheticListing[] {
  const listings: SyntheticListing[] = [];
  for (let i = 0; i < count; i++) {
    const neighborhood = pick(NEIGHBORHOODS, rng);
    const streetName = pick(STREET_NAMES, rng);
    const streetNumber = scale(rng, 100, 9999);
    const homeType = pick(HOME_TYPES, rng);

    // beds drives sqft, baths, and price, instead of each being rolled
    // independently — otherwise a 1-bed condo at 4,000 sqft is as likely as
    // a plausible listing (see plan's Review Focus on believability).
    const beds = scale(rng, 1, 5);
    const sqftPerBed = scale(rng, 450, 850);
    const sqft = clamp(beds * sqftPerBed, 600, 4200);
    const bathsOffset = scale(rng, -1, 1);
    const baths = clamp(beds + bathsOffset, 1, 4);
    const pricePerSqft = scale(rng, 500, 750);
    const price = clamp(sqft * pricePerSqft, 650_000, 2_100_000);

    listings.push({
      address: `${streetNumber} ${streetName}, ${neighborhood}, Seattle, WA`,
      neighborhood,
      price,
      beds,
      baths,
      sqft,
      blurbSeed: `${beds}BR ${homeType} near ${neighborhood}`,
    });
  }
  return listings;
}
