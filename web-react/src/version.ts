import pkg from "../package.json" with { type: "json" };

/** Application version, sourced from package.json (single source of truth). */
export const VERSION: string = pkg.version;
