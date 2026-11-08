import { defineConfig } from 'vite';
import { buildDefine } from './scripts/buildId.mjs';

export default defineConfig({
  // relative asset paths: portals serve the build from a sub-path
  base: './',
  define: buildDefine(),
  server: { port: 5190, host: true },
  build: { target: 'es2020', outDir: 'dist' },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'] },
});
