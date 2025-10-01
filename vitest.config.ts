import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120_000,
    silent: false,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    globals: true,
    environment: "node",
    // setupFiles: ['./tests/setup.ts'],
    // reporters: ['verbose', 'json'],
  },
});
