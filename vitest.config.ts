import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    isolate: true,
    setupFiles: ["./tests/setup.ts"],
    env: {
      STAJIO_DB_PATH: ":memory:",
      JWT_SECRET: "stajio-vitest-isolated-secret-only-for-tests",
    },
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/api/**/*.ts", "src/server/**/*.ts"],
    },
  },
});
