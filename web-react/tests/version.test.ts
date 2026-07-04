import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { VERSION } from "../src/version.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));

test("VERSION is a semver-shaped string sourced from package.json", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+/);
  assert.equal(VERSION, pkg.version);
});
