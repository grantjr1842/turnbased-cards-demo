import assert from "node:assert/strict";
import test from "node:test";
import { normalizeActiveColor } from "../src/gameHelpers.ts";

test("normalizeActiveColor falls back to red for invalid values", () => {
  assert.equal(normalizeActiveColor(undefined), "red");
  assert.equal(normalizeActiveColor("purple"), "red");
  assert.equal(normalizeActiveColor("blue"), "blue");
  assert.equal(normalizeActiveColor("wild"), "red");
});
