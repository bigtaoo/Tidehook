// Fails when the web build in dist/ is over the first-download budget (docs/01-tech-plan.md
// section 6: the first package at most 5 MB). Run after `vite build`.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overBudget, MAX_BYTES } from './size.mjs';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

/** @param {string} dir @returns {Generator<number>} */
function* sizes(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* sizes(p);
    else yield s.size;
  }
}

let total = 0;
try {
  for (const n of sizes(DIST)) total += n;
} catch {
  console.error('dist/ is missing: run `npm run build` first');
  process.exit(1);
}
const error = overBudget(total);
if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`bundle size ok (${(total / 1e6).toFixed(2)} MB of ${MAX_BYTES / 1e6} MB)`);
