import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { Session } from '../session';
import { Guide, NUDGE_MS, STEP_IDS } from './guide';

const FRAME = 1000 / 60;

/** A guide whose steps are all done, `games` games in. */
function past(games: number): Guide {
  const g = new Guide(new SafeStore(null));
  for (const id of STEP_IDS) g.done.add(id);
  g.games = games;
  return g;
}

/** Plays frames until a monster is on the lane, then `ms` more, no taps. */
function idle(s: Session, ms: number): void {
  for (let i = 0; i < 60 * 60 && !s.world.mons.length; i++) s.update(FRAME);
  for (let t = 0; t < ms; t += FRAME) s.update(FRAME);
}

describe('Guide nudge', () => {
  it('points an idle new player at a monster with the goal, and a tap puts it away', () => {
    const g = past(0);
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    idle(s, 1000);
    expect(g.cue).toBeNull();
    idle(s, NUDGE_MS);
    expect(g.cue?.step).toBe('nudge');
    expect(g.cue?.text).toBe('guide.nudge');
    expect(g.cue?.target?.t).toBe('mon');
    g.tap();
    s.update(FRAME);
    expect(g.cue).toBeNull();
  });

  it('leaves a player alone once they have played a few games', () => {
    const g = past(5);
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    idle(s, NUDGE_MS + 1000);
    expect(g.cue).toBeNull();
  });

  it('leaves a player who skipped the tutorial alone', () => {
    const g = new Guide(new SafeStore(null));
    g.skip();
    expect(g.skip()).toBe(true);
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    idle(s, NUDGE_MS + 1000);
    expect(g.cue).toBeNull();
  });

  it('does not count a reel as idle', () => {
    const g = past(0);
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    idle(s, 1000);
    for (let t = 0; t < NUDGE_MS + 1000; t += FRAME) {
      s.world.hook.st = 'back';
      g.update(s.world, true, FRAME);
    }
    expect(g.cue).toBeNull();
  });

  it('points only at a monster the hook can lift', () => {
    const g = past(0);
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    idle(s, 1000);
    for (let t = 0; t < NUDGE_MS + 1000; t += FRAME) {
      for (const m of s.world.mons) m.shell = 1;
      s.update(FRAME);
    }
    expect(g.cue).toBeNull();
  });
});
