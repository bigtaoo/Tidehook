// Runs the player population through whole careers and prints the summary: npm run sim:players.
// Env (vitest hands it over as import.meta.env): GROUP (all, the spread of skill levels in
// roster.ts, the default; or newcomers, the twenty new players in newcomers.ts), PLAYERS
// (comma-separated ids, default all of the group), CAREERS (per player, default 5), DETAIL=1
// (every career game by game too), PUTIN=0 (the old game, with no way to put in early: a sitting
// that runs out mid-wave loses the whole game).
//
// A whole population is minutes of work with nothing to show, so each player's careers print a
// line as they land (how long they took, their median last game): the run can be watched, and a
// run cut short still said something.

import { test } from 'vitest';
import { live, type Life } from './life';
import { NEWCOMERS } from './newcomers';
import { detail, summary } from './report';
import { ROSTER, type Player } from './roster';

/** The median of `ns`, 0 for none. */
function mid(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** The line printed as a player's careers land. */
function tick(pl: Player, lives: Life[], secs: number): string {
  const games = mid(lives.map((l) => l.games.length));
  const mins = mid(lives.map((l) => l.games[l.games.length - 1]?.total ?? 0));
  const wave = mid(lives.map((l) => mid(l.games.map((g) => g.wave))));
  return `  ${pl.id.padEnd(14)} ${String(games).padStart(3)} games  ${mins.toFixed(0).padStart(4)} min  wave ${String(wave).padStart(3)}  (${secs.toFixed(0)}s)`;
}

test('the player population', () => {
  const env = import.meta.env as Record<string, string | undefined>;
  const want = env.PLAYERS?.split(',');
  const group = env.GROUP === 'newcomers' ? NEWCOMERS : ROSTER;
  const players = want ? group.filter((p) => want.includes(p.id)) : group;
  const careers = Number(env.CAREERS ?? 5);
  const opts = { putIn: env.PUTIN !== '0' };
  const lives = players.map((pl) => {
    const t0 = Date.now();
    const out = Array.from({ length: careers }, (_, b) => live(pl, b + 1, opts));
    console.log(tick(pl, out, (Date.now() - t0) / 1000));
    return out;
  });
  console.log(summary(players, lives).join('\n'));
  if (env.DETAIL) console.log(detail(players, lives).join('\n'));
});
