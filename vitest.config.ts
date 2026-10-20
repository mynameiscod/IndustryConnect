import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/**/test/**/*.test.{ts,tsx}'], testTimeout: 30000, hookTimeout: 120000, fileParallelism: false } });
