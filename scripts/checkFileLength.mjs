// Fails if any file under src/ or scripts/ is over MAX_LINES, test files included (CLAUDE.md
// "File size"). Split long files by what they do instead of raising the limit. From Potion
// Siege's scripts/checkFileLength.mjs; the baseline can hold a file over the limit at its count
// while it waits to be split: it may shrink but never grow, and leaves the list at MAX_LINES.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countLines, lengthErrors, MAX_LINES } from './fileLength.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'scripts'];
const EXTS = ['.ts', '.mts', '.mjs', '.js', '.py', '.sh', '.css', '.html'];

/** @type {Record<string, number>} */
const BASELINE = {};

/** @param {string} dir @returns {Generator<string>} */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXTS.some((e) => name.endsWith(e))) yield p;
  }
}

/** @returns {Generator<[string, number]>} */
function* counts() {
  for (const d of DIRS) {
    for (const file of walk(join(ROOT, d))) yield [relative(ROOT, file).split(sep).join('/'), countLines(readFileSync(file, 'utf8'))];
  }
}

const errors = lengthErrors(counts(), BASELINE);
if (errors.length) {
  console.error(`File length (max ${MAX_LINES} lines, CLAUDE.md "File size"):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
const left = Object.keys(BASELINE).length;
console.log(`file length ok (<= ${MAX_LINES} lines${left ? `; ${left} older files held at their baseline` : ''})`);
