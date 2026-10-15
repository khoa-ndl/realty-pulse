import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

function versionRank(version: string): number {
  const [major, minor, patch] = version.split(".").map(Number);
  return major * 1e6 + minor * 1e3 + patch;
}

describe("repo config consistency", () => {
  // .nvmrc pins the version local dev actually runs; engines.node is the floor
  // Vercel's build image must support. These can diverge when local Node is
  // newer than what Vercel has rolled out yet — engines.node just needs to be
  // a floor the .nvmrc version actually clears.
  it("package.json engines.node floor is satisfied by the pinned .nvmrc version", () => {
    const nvmrc = readFileSync(path.join(process.cwd(), ".nvmrc"), "utf-8").trim();
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));

    const floor = pkg.engines.node.match(/^>=(\d+\.\d+\.\d+)$/)?.[1];
    expect(floor, `engines.node should be a ">=X.Y.Z" floor, got "${pkg.engines.node}"`).toBeDefined();
    expect(versionRank(nvmrc)).toBeGreaterThanOrEqual(versionRank(floor!));
  });
});
