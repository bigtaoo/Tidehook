import { describe, expect, it } from 'vitest';
import credits from '../../art/audio/credits.json';
import { StubPlatform } from '../platform/stub';
import type { SimEvent } from '../sim/events';
import { Session } from '../game/session';
import { startGame } from '../sim/step';
import { CUES, cueFile, cueFor, MUSIC_FILE, VARIANTS, type Cue } from './cues';
import { CLICK_LEN, ReelClock, reelRate } from './reel';
import { Sound, SOUND_KEY, type AudioOut } from './sound';

// file names only: the build writes them, the game fetches them
const built = Object.keys(import.meta.glob('../../public/audio/*.mp3')).map((p) => p.replace('../../public/', ''));

class FakeOut implements AudioOut {
  played: { cue: Cue; i: number; rate: number }[] = [];
  audible: boolean[] = [];
  play(cue: Cue, i: number, rate: number): void {
    this.played.push({ cue, i, rate });
  }
  setAudible(on: boolean): void {
    this.audible.push(on);
  }
}

/** A Sound on a fake output with a fixed run of random numbers. */
function setup(stored: string | null = null, rand = () => 0.5) {
  const out = new FakeOut();
  const p = new StubPlatform();
  if (stored) p.storage.setItem(SOUND_KEY, stored);
  return { out, p, sound: new Sound(out, p.storage, rand) };
}

describe('the sound files', () => {
  it('has a built file for every variant of every cue, and nothing else', () => {
    const want = [...CUES.flatMap((c) => Array.from({ length: VARIANTS[c] }, (_, i) => cueFile(c, i))), MUSIC_FILE];
    expect(built.sort()).toEqual(want.sort());
  });

  it('credits every file with its source and a CC0 pack', () => {
    const files = [...credits.cues.flatMap((c) => c.files.map((f) => ({ file: f.file, source: f.source }))), ...credits.music];
    expect(files.map((f) => f.file).sort()).toEqual([...built].sort());
    const packs = credits.packs as Record<string, { license: string }>;
    for (const f of files) expect(packs[f.source.split('/')[0]]?.license).toBe('CC0-1.0');
  });
});

describe('cueFor', () => {
  it('gives the hook a sound per kind of catch, and the coins a spit', () => {
    const grab = (what: 'fish' | 'junk' | 'monster'): SimEvent => ({ e: 'grab', what, d: 0, w: 0 });
    expect(cueFor(grab('fish'))).toBe('grabFish');
    expect(cueFor(grab('junk'))).toBe('grabJunk');
    expect(cueFor(grab('monster'))).toBe('grabMonster');
    expect(cueFor({ e: 'coins', amount: 5, spat: false })).toBe('coins');
    expect(cueFor({ e: 'coins', amount: 5, spat: true })).toBe('spat');
    expect(cueFor({ e: 'spawn', id: 1, kind: 'grunt' })).toBeNull();
  });

  it('is heard in a real game: casts, catches, coins and the wave bell', () => {
    const s = new Session({ seed: 7, speed: 1, autoplay: 'good' });
    const cues = new Set<Cue>();
    s.tap();
    for (let ms = 0; ms < 120_000 && s.world.phase === 'wave'; ms += 50) {
      s.update(50);
      for (const ev of s.drain()) {
        const c = cueFor(ev);
        if (c) cues.add(c);
      }
    }
    for (const c of ['waveStart', 'cast', 'grabFish', 'coins'] as const) expect(cues).toContain(c);
  });
});

describe('Sound', () => {
  it('plays a cue, but not the same one again within its gap', () => {
    const { out, sound } = setup();
    expect(sound.cue('hit', 0)).toBe(true);
    expect(sound.cue('hit', 20)).toBe(false);
    expect(sound.cue('hit', 100)).toBe(true);
    expect(out.played.map((p) => p.cue)).toEqual(['hit', 'hit']);
  });

  it('never repeats a variant twice running', () => {
    let r = 0;
    const seq = [0.1, 0.5, 0.1, 0.5, 0.9, 0.1, 0.5, 0.2];
    const { out, sound } = setup(null, () => seq[r++ % seq.length]);
    for (let i = 0; i < 6; i++) sound.cue('hit', i * 1000);
    const vs = out.played.map((p) => p.i);
    for (let i = 1; i < vs.length; i++) expect(vs[i]).not.toBe(vs[i - 1]);
    expect(Math.max(...vs)).toBeLessThan(VARIANTS.hit);
  });

  it('goes quiet for the toggle, the host, a pause and a hidden tab, and remembers the toggle', () => {
    const { out, p, sound } = setup();
    expect(out.audible).toEqual([true]);
    sound.toggle();
    expect(sound.cue('kill', 0)).toBe(false);
    expect(p.storage.getItem(SOUND_KEY)).toBe('off');
    expect(setup('off').sound.on).toBe(false);
    sound.toggle();
    sound.hostMute(true);
    expect(sound.isAudible).toBe(false);
    sound.hostMute(false);
    sound.setPaused(true);
    expect(sound.isAudible).toBe(false);
    sound.setPaused(false);
    sound.setHidden(true);
    expect(sound.isAudible).toBe(false);
    sound.setHidden(false);
    expect(sound.cue('kill', 0)).toBe(true);
    expect(out.audible).toEqual([true, false, true, false, true, false, true, false, true]);
  });

  it('follows the host mute the platform reports', () => {
    const { p, sound } = setup();
    p.onHostMute((m) => sound.hostMute(m));
    p.mute(true);
    expect(sound.isAudible).toBe(false);
    p.mute(false);
    expect(sound.isAudible).toBe(true);
  });
});

describe('the reel ratchet', () => {
  it('clicks once per stretch of rope wound in, and only while reeling', () => {
    const w = startGame(3);
    const clock = new ReelClock();
    expect(clock.update(w, true)).toBe(0);
    w.hook.st = 'back';
    w.hook.len = 300_000;
    let clicks = 0;
    for (let len = 300; len >= 300 - CLICK_LEN * 5; len -= 2) {
      w.hook.len = len * 1000;
      if (clock.update(w, true) > 0) clicks++;
    }
    expect(clicks).toBe(5);
    expect(clock.update(w, false)).toBe(0);
  });

  it('drops in pitch under weight', () => {
    const w = startGame(3);
    expect(reelRate(w)).toBe(1);
    const item = { id: 99, kind: 'junk' as const, chest: false, d: 0, w: 0, r: 10, val: 0, wt: 6, dropped: false };
    w.hook.grabs = [{ t: 'item', item }];
    const heavy = reelRate(w);
    expect(heavy).toBeLessThan(1);
    expect(heavy).toBeGreaterThanOrEqual(0.62);
  });
});
