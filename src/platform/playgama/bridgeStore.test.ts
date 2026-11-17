import { describe, expect, it } from 'vitest';
import { BridgeStore } from './bridgeStore';

function store(hidden = { now: false }, lands = { now: true }) {
  const saved: [string, string][][] = [];
  const queue: (() => void)[] = [];
  const bridge = { save: async (m: Map<string, string>) => (saved.push([...m]), lands.now), load: async () => new Map([['mb.save', '{"v":1}']]) };
  return { saved, queue, made: BridgeStore.create(bridge, ['mb.save'], (fn) => void queue.push(fn), () => hidden.now) };
}

describe('BridgeStore', () => {
  it('reads what Bridge had at boot and sends the writes of one tick together', async () => {
    const { saved, queue, made } = store();
    const s = await made;
    expect(s.getItem('mb.save')).toBe('{"v":1}');
    s.setItem('mb.save', '{"v":2}');
    s.setItem('mb.lang', 'de');
    expect([s.getItem('mb.lang'), saved.length, queue.length]).toEqual(['de', 0, 1]);
    queue[0]();
    expect(saved).toEqual([[['mb.save', '{"v":2}'], ['mb.lang', 'de']]]);
  });

  it('sends at once while the page is hidden, and flush sends what waits', async () => {
    const hidden = { now: false };
    const { saved, made } = store(hidden);
    const s = await made;
    s.setItem('a', '1');
    s.flush();
    expect(saved).toEqual([[['a', '1']]]);
    hidden.now = true;
    s.setItem('b', '2');
    expect(saved).toEqual([[['a', '1']], [['b', '2']]]);
    s.flush();
    expect(saved).toHaveLength(2);
  });

  it('sends what the game writes on its way out, hidden or not', async () => {
    const { saved, queue, made } = store();
    const s = await made;
    s.leaving();
    // the game's own pagehide listener runs after the platform's and writes the voyage then
    s.setItem('mb.run', '{"wave":7}');
    expect(saved).toEqual([[['mb.run', '{"wave":7}']]]);
    expect(queue).toHaveLength(0);
    // a page that came back from the back/forward cache waits for a tick again
    s.back();
    s.setItem('mb.lang', 'de');
    expect([saved.length, queue.length]).toEqual([1, 1]);
  });

  it('keeps a batch the host refused, and sends it again with the next write', async () => {
    const lands = { now: false };
    const { saved, made } = store({ now: true }, lands);
    const s = await made;
    s.setItem('mb.save', '{"v":2}');
    s.setItem('mb.lang', 'de');
    await Promise.resolve();
    await Promise.resolve();
    expect(saved).toEqual([[['mb.save', '{"v":2}']], [['mb.lang', 'de']]]);
    // the write did not land: it must not live in this visit's cache alone, where the next boot
    // would read Bridge again and find nothing
    lands.now = true;
    s.setItem('mb.pearls', '9');
    await Promise.resolve();
    await Promise.resolve();
    expect(saved[2]).toEqual([['mb.save', '{"v":2}'], ['mb.lang', 'de'], ['mb.pearls', '9']]);
  });

  it('leaves a key the game has written since alone when a refused batch comes back', async () => {
    const lands = { now: false };
    const { saved, made } = store({ now: true }, lands);
    const s = await made;
    s.setItem('mb.save', '{"v":2}');
    lands.now = true;
    s.setItem('mb.save', '{"v":3}');
    await Promise.resolve();
    await Promise.resolve();
    s.setItem('mb.lang', 'de');
    await Promise.resolve();
    await Promise.resolve();
    expect(saved.slice(1)).toEqual([[['mb.save', '{"v":3}']], [['mb.lang', 'de']]]);
  });
});
