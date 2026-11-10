import { playGame } from '../../src/sim/bot/bot';
import type { MetaLevels } from '../../src/sim/meta';

const GAMES = 40;

export interface Minutes {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  wave: number;
}

/** Quartiles of the minutes persona `name` lasts over GAMES fixed seeds, with `ease` waves of slow
 *  tide (sim/tide.ts) and the harbour's upgrades `meta` (sim/meta.ts), and its median wave. */
export function minutes(name: string, ease: number, meta: MetaLevels = {}, label = ''): Minutes {
  const g = Array.from({ length: GAMES }, (_, i) => playGame(1 + i, name, 200, 3600, ease, meta));
  const secs = g.map((r) => r.secs).sort((a, b) => a - b);
  const waves = g.map((r) => r.wave).sort((a, b) => a - b);
  const q = (a: number[], x: number) => a[Math.floor(x * a.length)];
  const m = (x: number) => q(secs, x) / 60;
  const r = { p10: m(0.1), p25: m(0.25), p50: m(0.5), p75: m(0.75), wave: q(waves, 0.5) };
  const f = (x: number) => x.toFixed(1);
  console.log(`${name.padEnd(7)} ease ${String(ease).padStart(2)} ${label.padEnd(8)} min p10/25/50/75 ${f(r.p10)} ${f(r.p25)} ${f(r.p50)} ${f(r.p75)}  wave ${r.wave}`);
  return r;
}
