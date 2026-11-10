// The game's sound, minus the speakers: which cue to play for what happened, which variant, how
// often, and whether anything may be heard at all (the player's toggle, the host's mute, a pause,
// a hidden tab). It drives an AudioOut (engine.ts in the browser, a fake in tests) and never
// touches the simulation: it only listens to its events.

import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import type { KeyValueStore } from '../platform/types';
import { cueFor, cueRate, DEFAULT_GAP_MS, MIN_GAP_MS, seaMusic, VARIANTS, VOLUME, type Cue, type Music } from './cues';
import { ReelClock } from './reel';

/** The player's sound toggle, in the platform's storage: 'off' or absent. */
export const SOUND_KEY = 'tidehook.sound';

/** The speakers: engine.ts. */
export interface AudioOut {
  /** Plays variant `i` of `cue` at playback `rate` (pitch and speed) and `gain` (0-1). */
  play(cue: Cue, i: number, rate: number, gain: number): void;
  /** Whether anything may be heard now; false silences everything, the music included. */
  setAudible(on: boolean): void;
  /** The music track to play, faded over from the one playing. */
  setMusic(track: Music): void;
}

/** A small random detune, so a cue played often does not sound like a machine. */
const DETUNE = 0.06;

export class Sound {
  /** The player's toggle. */
  on: boolean;
  private hostMuted = false;
  private paused = false;
  private hidden = false;
  private audible: boolean | null = null;
  private readonly lastAt = new Map<Cue, number>();
  private readonly lastVariant = new Map<Cue, number>();
  private readonly reelClock = new ReelClock();
  private track: Music | null = null;

  constructor(
    private readonly out: AudioOut,
    private readonly store: KeyValueStore,
    private readonly rand: () => number = Math.random,
  ) {
    this.on = store.getItem(SOUND_KEY) !== 'off';
    this.sync();
  }

  /** Flips the player's toggle and remembers it; returns the new state. */
  toggle(): boolean {
    this.on = !this.on;
    this.store.setItem(SOUND_KEY, this.on ? 'on' : 'off');
    this.sync();
    return this.on;
  }

  hostMute(muted: boolean): void {
    this.hostMuted = muted;
    this.sync();
  }

  /** The game is paused (by the player, the host or an ad): hush. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.sync();
  }

  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.sync();
  }

  get isAudible(): boolean {
    return this.on && !this.hostMuted && !this.paused && !this.hidden;
  }

  /** Called every frame: the harbour's tune between games, the sea's own on a voyage. */
  music(inHarbour: boolean, sea: string): Music {
    const track = inHarbour ? 'harbour' : seaMusic(sea);
    if (track !== this.track) {
      this.track = track;
      this.out.setMusic(track);
    }
    return track;
  }

  /** Plays what a frame's events sound like. `now` is in ms. */
  events(evs: readonly SimEvent[], now: number): void {
    for (const ev of evs) {
      const cue = cueFor(ev);
      if (cue) this.cue(cue, now, cueRate(ev));
    }
  }

  /** Called every frame: clicks the winch while the hook is reeled in. */
  reel(w: World, running: boolean, now: number): void {
    const rate = this.reelClock.update(w, running);
    if (rate > 0) this.cue('reel', now, rate);
  }

  /** Plays `cue` unless it played too recently; `rate` before the random detune. */
  cue(cue: Cue, now: number, rate = 1): boolean {
    if (!this.isAudible) return false;
    const gap = MIN_GAP_MS[cue] ?? DEFAULT_GAP_MS;
    const last = this.lastAt.get(cue);
    if (last !== undefined && now - last < gap) return false;
    this.lastAt.set(cue, now);
    const i = this.variant(cue);
    this.out.play(cue, i, rate * (1 + (this.rand() * 2 - 1) * DETUNE), VOLUME[cue] ?? 1);
    return true;
  }

  /** A variant of `cue` at random, never the same one twice running when there is a choice. */
  private variant(cue: Cue): number {
    const n = VARIANTS[cue];
    if (n <= 1) return 0;
    const prev = this.lastVariant.get(cue) ?? -1;
    let i = Math.floor(this.rand() * (prev >= 0 ? n - 1 : n));
    if (prev >= 0 && i >= prev) i++;
    this.lastVariant.set(cue, i);
    return i;
  }

  private sync(): void {
    const now = this.isAudible;
    if (now === this.audible) return;
    this.audible = now;
    this.out.setAudible(now);
  }
}
