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

export function generateListings(count: number, rng: () => number = Math.random): SyntheticListing[] {
  const listings: SyntheticListing[] = [];
  for (let i = 0; i < count; i++) {
    const neighborhood = pick(NEIGHBORHOODS, rng);
    const streetName = pick(STREET_NAMES, rng);
    const streetNumber = scale(rng, 100, 9999);
    const price = scale(rng, 650_000, 2_100_000);
    const beds = scale(rng, 1, 5);
    const baths = scale(rng, 1, 4);
    const sqft = scale(rng, 600, 4200);
    const homeType = pick(HOME_TYPES, rng);

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
