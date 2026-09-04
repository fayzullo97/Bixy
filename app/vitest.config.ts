import { defineConfig } from 'vitest/config';

// Pure-logic tests only (validation, pacing, scene reducer). These modules import
// no React Native, so a plain node environment is enough — component rendering is
// verified visually via screenshots, not here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
