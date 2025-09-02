import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120000,
    silent: false,
    hookTimeout: 60000,
    teardownTimeout: 30000,
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
      verbose: './test-output.log'
    }
  }
})