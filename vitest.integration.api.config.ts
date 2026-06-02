import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(() => {
  const env = loadEnv("test", process.cwd(), "");
  return {
    resolve: {
      alias: { "@": path.resolve("./src") },
    },
    test: {
      environment: "node",
      globalSetup: ["src/integration/helpers/server.ts"],
      include: ["src/integration/api/**/*.test.ts"],
      fileParallelism: false,
      testTimeout: 30_000,
      env,
    },
  };
});
