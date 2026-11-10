import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { hitAt } from './collide';
import { divingAt, isBoss } from './kinds';
import { toFp } from './math/fixed';
import { liftable, spawn } from './monsters';
import { fire, startGame, step } from './step';
import { bossOf } from './waves';
import type { World } from './world';

function emptyLane(): World {
  const w = startGame(1);
  w.items = [];
  w.queue = [];
  w.mons = [];
  w.mines = 0;
  return w;
}

function castStraight(w: World): void {
  w.hook.ph = 0;
  w.hook.ang = 0;
  expect(fire(w)).toBe(true);
  for (let i = 0; i < 300 && (w.hook.st !== 'swing' || w.shots.length); i++) step(w);
}

describe('hermit', () => {
  it('loses its shell to the first cast, which leaves it as junk, then is lifted', () => {
    const w = emptyLane();
    w.mines = 1;
    const m = spawn(w, 'hermit');
    m.d = toFp(300);
    m.w = B.crane.w;
    m.speed = 0;
    expect(liftable(w, m)).toBe(false);
    castStraight(w);
    expect(m.shell).toBe(0);
    expect(m.hp).toBe(B.monsters.hermit.hp);
    expect(w.mines).toBe(1);
    expect(w.st.shells).toBe(1);
    expect(w.items.filter((i) => i.kind === 'junk')).toHaveLength(1);
    expect(liftable(w, m)).toBe(true);
  });

  it('takes a thrown piece of junk on its shell without harm', () => {
    const w = emptyLane();
    const m = spawn(w, 'hermit');
    m.d = toFp(400);
    m.w = B.crane.w;
    w.held = { id: w.nextId++, kind: 'junk', chest: false, d: 0, w: 0, r: B.catch.junkRadius, val: 0, wt: 2, dropped: false };
    castStraight(w);
    expect(w.mons).toHaveLength(1);
    expect(m.shell).toBe(0);
    expect(m.hp).toBe(B.monsters.hermit.hp);
  });
});

describe('ray', () => {
  it('dives on its own beat, out of the hook and the junk, but stays up near the dock', () => {
    const far = toFp(500);
    const beat = Array.from({ length: B.dive.every }, (_, t) => divingAt(t, 'ray', far, 0));
    expect(beat.filter(Boolean)).toHaveLength(B.dive.under);
    expect(divingAt(0, 'ray', B.dock.edge + B.dive.near, 0)).toBe(false);
    expect(divingAt(0, 'grunt', far, 0)).toBe(false);
    const w = emptyLane();
    const m = spawn(w, 'ray');
    m.d = far;
    m.w = B.crane.w;
    m.ph = 0;
    w.tick = 0;
    expect(hitAt(w, m.d, m.w, toFp(5), true)).toBeNull();
    w.tick = B.dive.under;
    expect(hitAt(w, m.d, m.w, toFp(5), true)?.t).toBe('mon');
  });

  it('pays no heed to fish', () => {
    const w = emptyLane();
    const m = spawn(w, 'ray');
    m.d = toFp(400);
    m.w = B.crane.w;
    w.items.push({ id: w.nextId++, kind: 'fish', chest: false, d: toFp(380), w: B.crane.w + toFp(60), r: B.catch.fishRadius, val: 5, wt: 1, dropped: false });
    for (let i = 0; i < 60; i++) step(w);
    expect(w.items).toHaveLength(1);
    expect(m.eat).toBe(0);
  });
});

describe('kraken', () => {
  it('is the boss of every tenth wave from the twentieth, the turtle of the other fifth ones', () => {
    expect(bossOf(4)).toBeNull();
    expect(bossOf(5)).toBe('boss');
    expect(bossOf(10)).toBe('boss');
    expect(bossOf(20)).toBe('kraken');
    expect(bossOf(30)).toBe('kraken');
    expect(bossOf(15)).toBe('boss');
    expect(isBoss('kraken')).toBe(true);
    expect(isBoss('hermit')).toBe(false);
  });

  it('calls up crabs beside it, up to its brood, and is never lifted', () => {
    const w = emptyLane();
    const k = spawn(w, 'kraken');
    k.d = toFp(600);
    w.up.grip = 99;
    expect(liftable(w, k)).toBe(false);
    for (let i = 0; i < B.kraken.summon * 10 && w.phase === 'wave'; i++) {
      k.d = toFp(600);
      step(w);
      for (const m of w.mons) if (m.kind === 'grunt') m.speed = 0;
    }
    const crabs = w.mons.filter((m) => m.kind === 'grunt');
    expect(crabs.length).toBe(B.kraken.max);
    expect(k.brood).toBe(B.kraken.max);
  });

  it('counts as a boss and a kraken when sunk', () => {
    const w = emptyLane();
    const k = spawn(w, 'kraken');
    k.hp = 1;
    k.d = toFp(500);
    k.w = B.crane.w;
    w.held = { id: w.nextId++, kind: 'junk', chest: false, d: 0, w: 0, r: B.catch.junkRadius, val: 0, wt: 2, dropped: false };
    castStraight(w);
    expect(w.st.bosses).toBe(1);
    expect(w.st.krakens).toBe(1);
    expect(w.items.some((i) => i.kind === 'fish' && i.chest)).toBe(true);
  });
});
