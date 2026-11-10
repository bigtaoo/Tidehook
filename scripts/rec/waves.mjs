// The wave log's records (src/game/rec/waveLog.ts) as a table, one row per wave of each game:
// how long it took, the dock's hit points, what leaked, coins caught (and of those spilled by
// gluttons, caught again), eaten and spat, kills, and what was bought before it.

/** Rows of `records`' wave records, games split where the wave number starts again. */
export function waveGames(records) {
  const games = [];
  for (const r of records) {
    if (r.k !== 'wave') continue;
    const g = games[games.length - 1];
    if (!g || r.wave <= g[g.length - 1].wave) games.push([r]);
    else g.push(r);
  }
  return games;
}

const kinds = (o) =>
  Object.entries(o ?? {})
    .map(([k, n]) => `${k[0]}${n}`)
    .join(' ');

/** One game's waves as text lines. */
export function waveTable(game) {
  const L = ['wave  secs  hp        leaks       caught  drop/got  eaten  spat  kills c/j  casts  bought'];
  let secs = 0;
  for (const r of game) {
    secs += r.secs;
    const s = r.st;
    L.push(
      [
        String(r.wave).padStart(4),
        String(r.secs).padStart(5),
        `${r.hp0}>${r.hp}/${r.maxHp}`.padEnd(9),
        (kinds(r.leaks) || '-').padEnd(11),
        String(s.mined).padStart(6),
        `${s.dropped}/${s.recaught}`.padStart(9),
        String(s.eaten).padStart(6),
        String(s.spat).padStart(5),
        `${s.kills} ${s.crush}/${s.junkKills}`.padStart(10),
        String(s.casts).padStart(6),
        ' ' + (r.bought.join(',') || '-') + (r.end === 'over' ? '   (fell)' : ''),
      ].join(' '),
    );
  }
  L.push(`${game.length} waves, ${Math.round(secs / 6) / 10} min of waves`);
  return L;
}

/** Every game's table, or nothing when the file has no wave records (an older recording). */
export function formatWaves(records) {
  return waveGames(records).flatMap((g, i) => ['', `game ${i + 1}`, ...waveTable(g)]);
}
