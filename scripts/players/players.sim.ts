// Runs the player population (roster.ts) through whole careers and prints the summary:
// npm run sim:players. Env (vitest hands it over as import.meta.env): PLAYERS (comma-separated
// ids, default all), CAREERS (per player, default 5), DETAIL=1 (every career game by game too).

import { test } from 'vitest';
import { live } from './life';
import { detail, summary } from './report';
import { ROSTER } from './roster';

test('the player population', () => {
  const env = import.meta.env as Record<string, string | undefined>;
  const want = env.PLAYERS?.split(',');
  const players = want ? ROSTER.filter((p) => want.includes(p.id)) : ROSTER;
  const careers = Number(env.CAREERS ?? 5);
  const lives = players.map((pl) => Array.from({ length: careers }, (_, b) => live(pl, b + 1)));
  console.log(summary(players, lives).join('\n'));
  if (env.DETAIL) console.log(detail(players, lives).join('\n'));
});
