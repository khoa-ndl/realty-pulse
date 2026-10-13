import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("repo config consistency", () => {
  it("package.json engines.node matches .nvmrc", () => {
    const nvmrc = readFileSync(path.join(process.cwd(), ".nvmrc"), "utf-8").trim();
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
    expect(pkg.engines.node).toBe(`>=${nvmrc}`);
  });
});
