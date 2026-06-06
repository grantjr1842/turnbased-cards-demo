import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Workspace packages (@repo/shared, @repo/server-game) are linked into
// node_modules by pnpm, but they expose raw `.ts` source files via their
// `exports` map. Vitest's dev-mode resolver applies strict `node`/`import`
// conditions that won't accept `.ts` paths on its own, so we point it
// directly at the workspace source directories. This mirrors the same alias
// web-react's Vite build relies on for the same workspace packages.
const sharedDir = resolve(repoRoot, "shared");
const serverGameDir = resolve(repoRoot, "server-game");

export default defineConfig({
  resolve: {
    alias: {
      "@repo/shared": sharedDir,
      "@repo/shared/avatar": resolve(sharedDir, "avatar.ts"),
      "@repo/shared/constants": resolve(sharedDir, "constants.ts"),
      "@repo/shared/gameLogic": resolve(sharedDir, "gameLogic.ts"),
      "@repo/shared/types": resolve(sharedDir, "types.ts"),
      "@repo/server-game": resolve(serverGameDir, "uno.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
