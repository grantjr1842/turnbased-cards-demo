import pkg from "../package.json" with { type: "json" };

/** Application version, sourced from package.json (single source of truth). */
export const VERSION: string = pkg.version;

/** Health-check response payload — includes the running server version. */
export function healthResponse() {
  return { status: "ok" as const, version: VERSION };
}
