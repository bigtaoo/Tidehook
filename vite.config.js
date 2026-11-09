import { defineConfig } from 'vite';
import { buildDefine } from './scripts/buildId.mjs';
import { recSink } from './scripts/rec/sink.mjs';

export default defineConfig({
  // relative asset paths: portals serve the build from a sub-path
  base: './',
  define: buildDefine(),
  // ?rec's tap records (src/game/rec/) land in recordings/; the watcher leaves them alone
  plugins: [recSink('recordings')],
  server: { port: 5190, host: true, watch: { ignored: ['**/recordings/**'] } },
  build: { target: 'es2020', outDir: 'dist' },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'] },
});
