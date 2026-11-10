// The population's report: one row per player, each number the median over that player's careers
// (life.ts), plus each career game by game for a closer look.

import { B } from '../../src/sim/balance';
import { FLAT_QUIT, type Life } from './life';
import type { Player } from './roster';

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** The median of the values reached, "-" if fewer than half the careers reached it. */
function reached(xs: (number | null)[], digits = 0): string {
  const got = xs.filter((x): x is number => x !== null);
  if (got.length * 2 < xs.length) return '-';
  const m = median(got)!;
  return got.length < xs.length ? `${m.toFixed(digits)}*` : m.toFixed(digits);
}

const COLS = ['player', 'g1 wave', 'g1 min', 'buy#', 'boss#', ...B.seas.slice(1).map((s) => `${s.id}#`), 'done h', 'games', 'med min', 'max min', 'quit%', 'quit#', 'flat'];

/** One row per player. "*": not every career got there (the median is of those that did). */
export function summary(players: Player[], lives: Life[][]): string[] {
  const rows = players.map((pl, k) => {
    const L = lives[k];
    const all = L.flatMap((l) => l.games);
    return [
      pl.id,
      reached(L.map((l) => l.games[0].wave)),
      reached(L.map((l) => l.games[0].mins), 1),
      reached(L.map((l) => l.firstBuy)),
      reached(L.map((l) => l.firstBoss)),
      ...B.seas.slice(1).map((_, i) => reached(L.map((l) => l.charts[i + 1]))),
      reached(L.map((l) => (l.done === null ? null : l.done / 60)), 1),
      reached(L.map((l) => l.games.length)),
      (median(all.map((g) => g.mins)) ?? 0).toFixed(1),
      Math.max(...all.map((g) => g.mins)).toFixed(1),
      `${Math.round((100 * L.filter((l) => l.quit !== null).length) / L.length)}`,
      reached(L.map((l) => l.quit)),
      `${median(L.map((l) => l.flatRun))}`,
    ];
  });
  const width = COLS.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((x, i) => (i === 0 ? x.padEnd(width[i]) : x.padStart(width[i]))).join('  ');
  return [
    line(COLS),
    ...rows.map(line),
    '',
    `#: the game number (1 the first). done h: hours of play until everything was bought. quit%: careers with ${FLAT_QUIT} flat games in a row`,
    '(no new record, no log entry, nothing bought); quit#: the game that made it; flat: the longest such run. *: not every career got there.',
  ];
}

/** Each career game by game. */
export function detail(players: Player[], lives: Life[][]): string[] {
  const out: string[] = [];
  players.forEach((pl, k) => {
    out.push(`== ${pl.id}: ${pl.note}`);
    for (const l of lives[k]) {
      out.push(`  base ${l.base}: ${l.done === null ? 'not done' : `done at ${(l.done / 60).toFixed(2)} h`}, ${l.games.length} games, quit ${l.quit ?? '-'}`);
      for (const g of l.games) {
        const tags = [g.record ? 'rec' : '', g.revived ? 'rev' : '', g.bosses ? `boss${g.bosses}` : '', g.goals ? `log${g.goals}` : ''].filter(Boolean).join(',');
        out.push(`    #${String(g.n + 1).padStart(2)} ${B.seas[g.sea].id.padEnd(5)} w${String(g.wave).padStart(3)} ${g.mins.toFixed(1).padStart(5)}m  +${String(g.pearls).padStart(4)}  ${tags.padEnd(18)} ${g.bought.join(' ')}`);
      }
    }
  });
  return out;
}
