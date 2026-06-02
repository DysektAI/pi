import { defineConfig } from 'vitest/config';
import { boundedForkPool } from '../../scripts/vitest-pool.mjs';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for API calls
    reporters: process.env.GITHUB_ACTIONS ? ['dot', 'github-actions'] : ['dot'],
    silent: 'passed-only',
    ...boundedForkPool(),
  }
});