import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyzer } from "vite-bundle-analyzer";

// React Compiler performs automatic memoization at the JSX/Hook level so we no
// longer need to manually wrap every component in `React.memo` or annotate
// every callback with `useCallback`. The plugin is wired into the babel
// pipeline that `@vitejs/plugin-react` already uses; `react-compiler-runtime`
// provides the `$dispatch`/`useMemoCache` helpers the compiled output relies on.
//
// The plugin runs on `.ts`/`.tsx` source. Files under `tests/` only run in
// node and don't need compilation, so we filter them out via `sourceMaps`/`exclude`
// is unnecessary — `@vitejs/plugin-react` only processes the app graph.
const ReactCompilerConfig = {
  target: "19",
};

export default defineConfig(({ mode }) => ({
  base: process.env.BASE_URL || "/",
  server: {
    allowedHosts: ["uno.mystack.dev"],
  },
  plugins: [
    react({
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", ReactCompilerConfig],
        ],
      },
    }),
    mode === "analyze" &&
      analyzer({
        analyzerMode: "server",
        openAnalyzer: false,
        reportTitle: "bundle-stats",
      }),
  ],
  build: {
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          "colyseus-vendor": ["@colyseus/sdk", "@colyseus/react"],
        },
      },
    },
  },
}));
