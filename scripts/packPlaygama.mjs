// Zips dist-playgama/ into tidehook-playgama.zip for Playgama's developer console.
// usage: node scripts/packPlaygama.mjs [dist dir] [zip file]
// index.html sits at the archive's root, entries are files only and paths use '/'. Playgama's
// console rejected zips made by PowerShell's Compress-Archive (backslash paths: the uploaded game
// reported "Bridge never initialized"), so the archive is written here instead (scripts/zip.mjs).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzip, zip } from './zip.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = process.argv[2] ?? 'dist-playgama';
const OUT = process.argv[3] ?? 'tidehook-playgama.zip';
const src = resolve(ROOT, SRC);

for (const need of ['index.html', 'playgama-bridge-config.json']) {
  if (!existsSync(join(src, need))) {
    console.error(`${SRC}/${need} missing: run the Playgama build first`);
    process.exit(1);
  }
}

/** Every file under `dir`, sorted, so the archive is the same each time. @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
}

const entries = files(src).map((p) => ({ name: relative(src, p).split(sep).join('/'), data: readFileSync(p) }));
const buf = zip(entries);
const back = unzip(buf).map((e) => e.name);
if (!back.includes('index.html') || back.length !== entries.length) {
  console.error('the archive did not read back whole');
  process.exit(1);
}
writeFileSync(resolve(ROOT, OUT), buf);
console.log(`${OUT}: ${entries.length} files from ${SRC}/, ${(buf.length / 2 ** 20).toFixed(1)} MB`);
