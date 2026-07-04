import { describe, it, expect } from "vitest";
import { VERSION, healthResponse } from "../src/version.ts";

describe("version", () => {
  it("exports a semver-shaped version string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("healthResponse reports status ok and the current version", () => {
    expect(healthResponse()).toEqual({ status: "ok", version: VERSION });
  });
});
