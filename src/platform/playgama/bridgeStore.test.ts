import { describe, expect, it } from 'vitest';
import { BridgeStore } from './bridgeStore';

function store(hidden = { now: false }) {
  const saved: [string, string][][] = [];
  const queue: (() => void)[] = [];
  const bridge = { save: (m: Map<string, string>) => void saved.push([...m]), load: async () => new Map([['mb.save', '{"v":1}']]) };
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
});
