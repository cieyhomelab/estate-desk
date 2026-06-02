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
      include: ["src/integration/**/*.test.ts"],
      fileParallelism: false,
      testTimeout: 10_000,
      env,
    },
  };
});
