// Vitest config: offline tests, "@" alias for src.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
});
