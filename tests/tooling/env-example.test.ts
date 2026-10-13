import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ENV_KEYS } from "@/lib/env";

describe(".env.example", () => {
  it("declares every key ENV_KEYS requires", () => {
    const content = readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
    const declared = content
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => line.split("=")[0].trim());
    for (const key of ENV_KEYS) {
      expect(declared).toContain(key);
    }
  });
});
