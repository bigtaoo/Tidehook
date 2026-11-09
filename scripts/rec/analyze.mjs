// Reads the tap recorder's records (recordings/*.ndjson, from a dev build; src/game/rec/) and says, tap by
// tap, what the player most likely aimed at, how far off the hook went, which way and why.
//
//   node scripts/rec/analyze.mjs                 the newest recording
//   node scripts/rec/analyze.mjs <file> [--all]  that one; --all lists every tap, not just the misses
//
// Angles are degrees from the crane, 0 straight out. "Ahead" means further along the way the hook
// was swinging: a target ahead of the aim means the tap came early (or the hook was shown late),
// one behind means it came late.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** How far, in degrees past touching, a target may be from the aim and still count as the intent. */
export const INTENT_SLACK = 12;

/** The angular half-width of a target as seen from the crane, catching radius included. */
export function halfWidth(t, reach) {
  return (Math.atan2(t.r + reach, Math.max(t.dist, 1)) * 180) / Math.PI;
}

/** What a hook catches; thrown junk passes them by. */
export const CATCH_KINDS = ['fish', 'chest', 'junk'];

/** The target a tap most likely meant: the one the shown aim passed closest to, in degrees beyond
 *  touching it; a near-tie goes to the nearer one (the rope meets it first). Null when nothing
 *  was within INTENT_SLACK. */
export function intent(tap) {
  let best = null;
  for (const t of tap.seen) {
    // thrown junk only hits monsters
    if (tap.threw && CATCH_KINDS.includes(t.what)) continue;
    const miss = Math.max(0, Math.abs(t.ang - tap.shown) - halfWidth(t, tap.reach));
    const score = miss + t.dist / 400;
    if (miss <= INTENT_SLACK && (!best || score < best.score)) best = { t, miss, score };
  }
  return best ? best.t : null;
}

/** One fired tap judged against its likely target. */
export function judge(tap) {
  const t = intent(tap);
  const out = { grabs: [], got: [], bounce: false, hits: [], turn: 0, near: [], ...tap.out };
  const near = t ? out.near.find((n) => n.id === t.id) : null;
  const caught = t ? (tap.threw ? out.hits : out.got).includes(t.id) : false;
  const r = (x) => Math.round(x * 10) / 10;
  return {
    n: tap.n,
    s: tap.s,
    threw: tap.threw,
    target: t ? `${t.what}#${t.id}` : null,
    caught,
    grabs: out.grabs,
    bounce: out.bounce,
    // the target's bearing minus the aim, times the swing's way: + ahead (early), - behind (late)
    seenErr: t ? r((t.ang - tap.shown) * tap.dir) : null,
    castErr: t ? r((t.ang - tap.cast) * tap.dir) : null,
    // how much the target moved round the crane while the hook flew (closest approach vs the tap)
    drift: t && near && !caught ? r(near.off - (t.ang - tap.cast) * tap.dir) : null,
    gap: near ? near.gap : null,
    halfW: t ? r(halfWidth(t, tap.reach)) : null,
    back: tap.back,
    turn: out.turn,
  };
}

const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Every record in a file to a report: per tap verdicts and the totals across them. */
export function analyze(records) {
  const taps = records.filter((r) => r.k === 'tap');
  const fired = taps.filter((t) => t.fired);
  const ignored = taps.filter((t) => !t.fired);
  const judged = fired.map(judge);
  const meant = judged.filter((j) => j.target);
  const missed = meant.filter((j) => !j.caught);
  const byState = {};
  for (const t of ignored) byState[t.st] = (byState[t.st] ?? 0) + 1;
  return {
    starts: records.filter((r) => r.k === 'start'),
    judged,
    totals: {
      taps: taps.length,
      fired: fired.length,
      ignored: ignored.length,
      ignoredBy: byState,
      meant: meant.length,
      caught: meant.filter((j) => j.caught).length,
      unclear: judged.length - meant.length,
      // over the misses: where the aim the player saw was, where the cast went, how far targets drifted
      missSeenErr: mean(missed.map((j) => j.seenErr)),
      missCastErr: mean(missed.map((j) => j.castErr)),
      missDrift: mean(missed.filter((j) => j.drift !== null).map((j) => j.drift)),
      early: missed.filter((j) => j.castErr > 0).length,
      late: missed.filter((j) => j.castErr < 0).length,
      lookBack: mean(fired.map((t) => t.back)),
    },
  };
}

/** The report as text. */
export function format(rep, all = false) {
  const L = [];
  for (const s of rep.starts) L.push(`start ${s.at}  ${s.w}x${s.h}${s.wide ? ' landscape' : ' portrait'}  lag ${s.lag}ms  ${s.build}`);
  const T = rep.totals;
  L.push(`taps ${T.taps}: ${T.fired} cast or threw, ${T.ignored} did nothing ${JSON.stringify(T.ignoredBy)}`);
  L.push(`aimed at something ${T.meant} (caught ${T.caught}), aim unclear ${T.unclear}`);
  L.push(`misses: target vs the aim shown ${T.missSeenErr}°, vs the cast ${T.missCastErr}°, target drift in flight ${T.missDrift}°`);
  L.push(`        early ${T.early}, late ${T.late}   (look-back mean ${T.lookBack}°)`);
  L.push('');
  L.push('  #     s  kind   target          result    seen°  cast°  drift°  gap  half°');
  for (const j of rep.judged) {
    if (!all && (j.caught || !j.target)) continue;
    const res = j.caught ? 'caught' : j.grabs.length ? `got ${j.grabs[0]}` : j.bounce ? 'bounced' : 'missed';
    const cells = [
      String(j.n).padStart(3),
      String(j.s).padStart(6),
      (j.threw ? 'throw' : 'cast').padEnd(6),
      String(j.target ?? '-').padEnd(15),
      res.padEnd(9),
      String(j.seenErr ?? '-').padStart(5),
      String(j.castErr ?? '-').padStart(6),
      String(j.drift ?? '-').padStart(7),
      String(j.gap ?? '-').padStart(5),
      String(j.halfW ?? '-').padStart(6),
    ];
    L.push(cells.join(' '));
  }
  return L.join('\n');
}

/** The lines of an NDJSON file, bad ones skipped. */
export function parse(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a torn last line */
    }
  }
  return out;
}

function newest(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.ndjson')).sort();
  if (!files.length) throw new Error(`no recordings in ${dir}; play a dev build first`);
  return join(dir, files[files.length - 1]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) ?? newest('recordings');
  console.log(file);
  console.log(format(analyze(parse(readFileSync(file, 'utf8'))), args.includes('--all')));
}
