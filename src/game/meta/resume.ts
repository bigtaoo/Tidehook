// The voyage left in progress, kept in the platform's storage so that closing the page does not
// throw the game away. A deep game runs for an hour and more (docs/04-content.md section 3.13),
// and until now only the pearls already banked survived a closed tab: the world itself lived in
// memory alone. It is plain data by design (sim/world.ts), so the whole of it goes into storage
// as it stands, each random stream as its raw cursor (math/prng.ts peek/resume), and comes back
// tick for tick - the same seeds, the same monsters, the same coins.
//
// The game comes back paused, so nothing happens while the player is still looking at the screen.
// A voyage that ended is not kept: the save is cleared the moment the game leaves the water.

import type { KeyValueStore } from '../../platform/types';
import { Prng } from '../../sim/math/prng';
import type { World } from '../../sim/world';
import type { Session } from '../session';
import { today } from './daily';

export const RUN_KEY = 'tidehook.voyage';

/** The save's shape. Bump it by hand whenever the World gains or loses a field that an old save
 *  could not fill in sensibly: a save from another shape is dropped rather than half restored. */
const V = 1;

/** Milliseconds between saves while a wave runs. A wave is about a minute, and the shop and every
 *  pause save on their own, so this is only there for the tab that is closed mid-wave in a way the
 *  page never hears about. */
const EVERY = 10_000;

type Stream = 'spawn' | 'catch' | 'shop' | 'luck';
const STREAMS: Stream[] = ['spawn', 'catch', 'shop', 'luck'];

/** The world as it is stored: its streams are raw cursors and its events (this tick's, already
 *  drained) are left behind. */
type StoredWorld = Omit<World, 'rng' | 'events'> & { rng: Record<Stream, number> };

interface RunSave {
  v: number;
  w: StoredWorld;
  /** The session's own state, which is not in the world: how many games have started, the daily
   *  voyage's day (null for a plain one), the one-a-game ad rewards used, and whether the captain
   *  was being asked at the voyage's end. */
  games: number;
  daily: string | null;
  revived: boolean;
  freeRerolled: boolean;
  finish: boolean;
}

/** Keeps the voyage in progress in storage, and puts it back on the water on the next boot. */
export class Resume {
  private at = 0;
  private mark = '';
  private held = false;

  constructor(
    private readonly store: KeyValueStore | null,
    private readonly day: () => string = today,
  ) {}

  /** Called every frame with the clock in ms: saves when a wave turns over, when the game pauses
   *  and now and then while it runs; clears the save once the game is no longer afloat. */
  frame(s: Session, ms: number): void {
    if (s.mode !== 'play' || s.world.phase === 'over') {
      this.clear();
      return;
    }
    const mark = `${s.world.wave}:${s.world.phase}:${s.paused}:${s.finish}`;
    if (mark === this.mark && ms - this.at < EVERY) return;
    this.mark = mark;
    this.at = ms;
    this.save(s);
  }

  /** Writes the voyage now (the page is going away, or the player paused). */
  save(s: Session): void {
    if (!this.store || s.opts.autoplay || s.mode !== 'play' || s.world.phase === 'over') return;
    const w = s.world;
    const rng = {} as Record<Stream, number>;
    for (const k of STREAMS) rng[k] = w.rng[k].peek();
    const save: RunSave = {
      v: V,
      w: { ...w, rng, events: undefined } as unknown as StoredWorld,
      games: s.games,
      daily: s.daily,
      revived: s.revived,
      freeRerolled: s.freeRerolled,
      finish: s.finish,
    };
    this.store.setItem(RUN_KEY, JSON.stringify(save));
    this.held = true;
  }

  /** Drops the saved voyage, once there is one to drop. */
  clear(): void {
    if (!this.held || !this.store) return;
    this.held = false;
    this.mark = '';
    this.store.setItem(RUN_KEY, '');
  }

  /** Puts a saved voyage back on the water, paused; false when there is none to put back (or it is
   *  a bot's run, or last night's daily voyage), and the caller opens the harbour as usual. */
  restore(s: Session): boolean {
    if (!this.store || s.opts.autoplay) return false;
    const raw = this.store.getItem(RUN_KEY);
    const save = read(raw);
    if (!save) {
      // something is written there that no game can be made of: an older shape, or a value that
      // has been got at. Drop it, or it is read and thrown away afresh on every boot from here on.
      if (raw) {
        this.held = true;
        this.clear();
      }
      return false;
    }
    // a daily voyage belongs to its day: yesterday's cannot be sailed on today (meta/daily.ts)
    if (save.daily && save.daily !== this.day()) {
      this.held = true;
      this.clear();
      return false;
    }
    const rng = {} as World['rng'];
    for (const k of STREAMS) rng[k] = Prng.resume(save.w.rng[k]);
    s.world = { ...save.w, rng, events: [] } as World;
    s.games = save.games;
    s.daily = save.daily;
    s.revived = save.revived;
    s.freeRerolled = save.freeRerolled;
    s.finish = save.finish;
    s.mode = 'play';
    s.paused = true;
    s.pending = s.doubled = false;
    // this game began in an earlier sitting, so the tutorial never saw it begin (guide.ts)
    s.guide?.resume(!s.daily);
    s.snapshot();
    this.held = true;
    return true;
  }
}

/** A stored voyage, or null if there is none, it is from another shape, or it is not a world that
 *  can be sailed on. A save is player data that anything may have happened to, so nothing in it is
 *  taken on trust. */
function read(raw: string | null): RunSave | null {
  if (!raw) return null;
  let save: unknown;
  try {
    save = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj(save) || save.v !== V) return null;
  const w = save.w;
  if (!obj(w) || !afloat(w)) return null;
  for (const k of STREAMS) if (!Number.isSafeInteger(obj(w.rng) ? w.rng[k] : NaN)) return null;
  if (typeof save.games !== 'number' || (save.daily !== null && typeof save.daily !== 'string')) return null;
  return save as unknown as RunSave;
}

/** Whether a stored world is one a game can go on from: the fields the sim and the view read every
 *  tick are all there, and the dock is still standing. */
function afloat(w: Record<string, unknown>): boolean {
  if (w.phase !== 'wave' && w.phase !== 'shop') return false;
  for (const k of ['seed', 'tick', 'wave', 'coins', 'hp', 'maxHp', 'mines', 'sea', 'nextId']) if (!Number.isSafeInteger(w[k])) return false;
  for (const k of ['items', 'mons', 'shots', 'cards', 'queue', 'seen', 'plans']) if (!Array.isArray(w[k])) return false;
  for (const k of ['hook', 'up', 'lv', 'st', 'sunk']) if (!obj(w[k])) return false;
  return (w.hp as number) > 0 && Array.isArray((w.hook as Record<string, unknown>).grabs);
}

function obj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
