import { describe, expect, it } from 'vitest';
import credits from '../../art/audio/credits.json';
import { StubPlatform } from '../platform/stub';
import { B } from '../sim/balance';
import type { SimEvent } from '../sim/events';
import { Session } from '../game/session';
import { startGame } from '../sim/step';
import { CUES, cueFile, cueFor, MUSIC, musicFile, musicRate, seaMusic, VARIANTS, type Cue, type Music } from './cues';
import { CLICK_LEN, ReelClock, reelRate } from './reel';
import { Sound, SOUND_KEY, type AudioOut } from './sound';

// file names only: the build writes them, the game fetches them
const built = Object.keys(import.meta.glob('../../public/audio/*.mp3')).map((p) => p.replace('../../public/', ''));

class FakeOut implements AudioOut {
  played: { cue: Cue; i: number; rate: number }[] = [];
  audible: boolean[] = [];
  tracks: Music[] = [];
  play(cue: Cue, i: number, rate: number): void {
    this.played.push({ cue, i, rate });
  }
  setAudible(on: boolean): void {
    this.audible.push(on);
  }
  setMusic(track: Music): void {
    this.tracks.push(track);
  }
  musicOn: boolean[] = [];
  setMusicOn(on: boolean): void {
    this.musicOn.push(on);
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
    // a track that shares another's file (the storm plays the bay's) names no file of its own
    const want = [...new Set([...CUES.flatMap((c) => Array.from({ length: VARIANTS[c] }, (_, i) => cueFile(c, i))), ...MUSIC.map(musicFile)])];
    expect(built.sort()).toEqual(want.sort());
  });

  it('credits every file with its source and a CC0 pack', () => {
    const files = [...credits.cues.flatMap((c) => c.files.map((f) => ({ file: f.file, source: f.source }))), ...credits.music];
    expect([...new Set(files.map((f) => f.file))].sort()).toEqual([...built].sort());
    const packs = credits.packs as Record<string, { license: string }>;
    for (const f of files) expect(packs[f.source.split('/')[0]]?.license).toBe('CC0-1.0');
  });
});

describe('the music', () => {
  it('plays the storm as the bay sped up, from the one file', () => {
    expect(musicFile('storm')).toBe(musicFile('bay'));
    expect(musicRate('storm')).toBeGreaterThan(1);
    for (const m of MUSIC) if (m !== 'storm') expect(musicRate(m)).toBe(1);
  });

  it('has a track for the harbour and every sea, a bay one for any other', () => {
    for (const sea of B.seas) expect(seaMusic(sea.id)).toBe(sea.id);
    expect(seaMusic('harbour')).toBe('bay');
    expect(seaMusic('kraken')).toBe('bay');
  });

  it('tells the speakers only when the track changes', () => {
    const { out, sound } = setup();
    expect(sound.music(true, 'bay')).toBe('harbour');
    sound.music(true, 'fog');
    expect(sound.music(false, 'fog')).toBe('fog');
    sound.music(false, 'fog');
    sound.music(false, 'storm');
    sound.music(true, 'storm');
    expect(out.tracks).toEqual(['harbour', 'fog', 'storm', 'harbour']);
  });
});

describe('the mix', () => {
  it('silences the effects with their setting and passes the music one to the speakers', () => {
    const { out, sound } = setup();
    sound.setMix(false, false);
    expect(out.musicOn).toEqual([false]);
    expect(sound.cue('buy', 0)).toBe(false);
    sound.setMix(false, true);
    expect(sound.cue('buy', 1000)).toBe(true);
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
    const item = { id: 99, kind: 'junk' as const, chest: false, d: 0, w: 0, r: 10, val: 0, wt: 6, dropped: false, gold: false };
    w.hook.grabs = [{ t: 'item', item }];
    const heavy = reelRate(w);
    expect(heavy).toBeLessThan(1);
    expect(heavy).toBeGreaterThanOrEqual(0.62);
  });
});
