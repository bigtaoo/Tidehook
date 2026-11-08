import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { playGame } from './bot/bot';
import { hashWorld } from './hash';
import { toFp } from './math/fixed';
import { spawn } from './monsters';
import { price, buyCard } from './shop';
import { fire, startGame, step } from './step';
import { waveMix } from './waves';
import type { Item, World } from './world';

/** A wave-1 world with nothing in the water and no monsters coming, the hook at rest pointing
 *  straight out. */
function emptyLane(): World {
  const w = startGame(1);
  w.items = [];
  w.queue = [];
  w.mons = [];
  w.hook.ph = 0;
  w.hook.ang = 0;
  return w;
}

function put(w: World, kind: Item['kind'], d: number, val = 7): Item {
  const it: Item = { id: w.nextId++, kind, chest: false, d: toFp(d), w: B.crane.w, r: B.catch.fishRadius, val, wt: 1 };
  w.items.push(it);
  return it;
}

/** Casts (or throws) straight out and steps until the hook is home and any shot is gone. */
function castStraight(w: World): void {
  w.hook.ph = 0;
  w.hook.ang = 0;
  expect(fire(w)).toBe(true);
  for (let i = 0; i < 300 && (w.hook.st !== 'swing' || w.shots.length); i++) {
    step(w);
  }
}

describe('determinism', () => {
  function run(seed: number): number[] {
    const w = startGame(seed);
    const hashes: number[] = [];
    for (let t = 0; t < 3000 && w.phase === 'wave'; t++) {
      if (t % 17 === 0) fire(w);
      step(w);
      if (t % 100 === 0) hashes.push(hashWorld(w));
    }
    return hashes;
  }

  it('plays a seed the same way every time, with integer-only state', () => {
    expect(run(7)).toEqual(run(7));
  });

  it('plays different seeds differently', () => {
    expect(run(7)).not.toEqual(run(8));
  });

  it('a bot game is reproducible', () => {
    expect(playGame(3, 'casual', 6)).toEqual(playGame(3, 'casual', 6));
  });
});

describe('waves', () => {
  it('brings in new kinds as the prototype did', () => {
    expect(waveMix(1)).toEqual({ grunt: 4, darter: 0, brute: 0, glutton: 0 });
    expect(waveMix(4)).toEqual({ grunt: 7, darter: 2, brute: 1, glutton: 1 });
  });

  it('starts with the opening catch in the water and wave 1 queued', () => {
    const w = startGame(1);
    expect(w.phase).toBe('wave');
    expect(w.wave).toBe(1);
    expect(w.items.filter((o) => o.kind === 'fish')).toHaveLength(B.catch.startFish);
    expect(w.items.filter((o) => o.kind === 'junk')).toHaveLength(B.catch.startJunk);
    expect(w.queue).toHaveLength(4);
  });
});

describe('hook', () => {
  it('reels a fish in for its coins', () => {
    const w = emptyLane();
    put(w, 'fish', 300, 7);
    castStraight(w);
    expect(w.coins).toBe(7);
    expect(w.items).toHaveLength(0);
  });

  it('puts junk in the crane hand, and the next tap throws it to kill a light monster', () => {
    const w = emptyLane();
    put(w, 'junk', 300);
    castStraight(w);
    expect(w.held?.kind).toBe('junk');
    const m = spawn(w, 'grunt');
    m.d = toFp(400);
    m.w = B.crane.w;
    castStraight(w);
    expect(w.held).toBeNull();
    expect(w.mons).toHaveLength(0);
    expect(w.st.junkKills).toBe(1);
  });

  it('lifts a light monster and crushes it on the dock', () => {
    const w = emptyLane();
    const m = spawn(w, 'grunt');
    m.d = toFp(300);
    m.w = B.crane.w;
    castStraight(w);
    expect(w.mons).toHaveLength(0);
    expect(w.st.crush).toBe(1);
  });

  it('bounces off a monster too heavy to lift, hurting it by the barb', () => {
    const w = emptyLane();
    const m = spawn(w, 'brute');
    m.d = toFp(300);
    m.w = B.crane.w;
    castStraight(w);
    expect(w.st.bounce).toBe(1);
    expect(m.hp).toBe(B.monsters.brute.hp - w.up.barb);
  });

  it('sets off a mine on a heavy monster instead', () => {
    const w = emptyLane();
    w.mines = 1;
    const m = spawn(w, 'grunt');
    m.d = toFp(300);
    m.w = B.crane.w;
    w.up.grip = 1;
    castStraight(w);
    expect(w.mines).toBe(0);
    expect(w.st.mines).toBe(1);
    expect(w.mons).toHaveLength(0);
  });
});

describe('shop', () => {
  it('prices grow with each level owned', () => {
    const w = startGame(1);
    expect(price(w, 'grip')).toBe(20);
    w.lv.grip = 1;
    expect(price(w, 'grip')).toBe(34);
  });

  it('buying a card applies its effect and charges for it', () => {
    const w = startGame(1);
    w.phase = 'shop';
    w.coins = 100;
    w.cards = [{ id: 'grip', bought: false }];
    expect(buyCard(w, 0)).toBe(true);
    expect(w.up.grip).toBe(B.start.grip + 1);
    expect(w.coins).toBe(80);
    expect(buyCard(w, 0)).toBe(false);
  });
});
