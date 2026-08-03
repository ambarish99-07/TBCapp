import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Integration test files each spin up their own MongoMemoryServer. Running
    // them concurrently causes multiple processes to race over the same cached
    // mongod binary on disk (observed as spurious re-downloads on Windows) —
    // one file at a time avoids that entirely.
    fileParallelism: false,
  },
});
