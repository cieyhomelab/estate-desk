import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve("./src") },
  },
  test: {
    environment: "node",
    include: ["src/integration/**/*.test.ts"],
    testTimeout: 10_000,
  },
});
