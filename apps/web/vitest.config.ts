import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["e2e/**/*", "node_modules/**/*"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
