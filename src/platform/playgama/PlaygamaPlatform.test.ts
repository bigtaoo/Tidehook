import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PlaygamaBridge } from './bridge';
import { BOARD_ID, PlaygamaPlatform } from './PlaygamaPlatform';
import { fakeBridge, type FakeBridge } from './testBridge';

beforeAll(() => {
  (globalThis as { location?: unknown }).location ??= { search: '' };
});

/** Stand-ins for the page's document and window that keep their listeners. */
function page() {
  const on = new Map<string, () => void>();
  const doc = { visibilityState: 'visible', addEventListener: (e: string, fn: () => void) => void on.set(`doc:${e}`, fn) };
  const win = { addEventListener: (e: string, fn: () => void) => void on.set(`win:${e}`, fn) };
  return { doc, win, fire: (e: string) => on.get(e)?.() };
}

const KEYS = ['tidehook.lang', 'tidehook.harbour'];

async function platform(f: FakeBridge | null, p = page()) {
  const bridge = new PlaygamaBridge(f?.global ?? {}, () => new Promise<void>(() => {}));
  return PlaygamaPlatform.create(KEYS, bridge, p.doc as unknown as Document, p.win as unknown as Window);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('PlaygamaPlatform', () => {
  it('counts only the portal as Playgama: a preview and the QA tool stay web', async () => {
    expect((await platform(fakeBridge())).name).toBe('playgama');
    for (const id of ['mock', 'qa_tool']) expect((await platform(fakeBridge({ id }))).name).toBe('web');
    expect((await platform(null)).name).toBe('web');
  });

  it('reads every kept key through Bridge at boot and saves back through it, never the browser', async () => {
    const touched: string[] = [];
    const spy = { getItem: (k: string) => (touched.push(k), null), setItem: (k: string) => void touched.push(k) };
    vi.stubGlobal('window', { localStorage: spy });
    try {
      const f = fakeBridge({ stored: { 'tidehook.harbour': '{"pearls":3}' } });
      const p = await platform(f);
      expect(p.storage.getItem('tidehook.harbour')).toBe('{"pearls":3}');
      p.storage.setItem('tidehook.harbour', '{"pearls":4}');
      p.storage.setItem('tidehook.lang', 'zh');
      await tick();
      expect(f.saved).toEqual([[['tidehook.harbour', 'tidehook.lang'], ['{"pearls":4}', 'zh']]]);
      expect(touched).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the save in memory, not the browser's storage, when Bridge is missing", async () => {
    const touched: string[] = [];
    const spy = { getItem: (k: string) => (touched.push(k), null), setItem: (k: string) => void touched.push(k) };
    vi.stubGlobal('window', { localStorage: spy });
    try {
      const p = await platform(null);
      p.storage.setItem('tidehook.harbour', '{"pearls":4}');
      expect([p.storage.getItem('tidehook.harbour'), touched]).toEqual(['{"pearls":4}', []]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends a waiting save when the page hides or the platform pauses', async () => {
    const f = fakeBridge();
    const pg = page();
    const p = await platform(f, pg);
    p.storage.setItem('a', '1');
    pg.fire('win:pagehide');
    p.storage.setItem('b', '2');
    f.emit('pause_state_changed', true);
    expect(f.saved.map(([k]) => k)).toEqual([['a'], ['b']]);
  });

  it('sends game_ready once, and no gameplay_started before it', async () => {
    const f = fakeBridge();
    const p = await platform(f);
    p.gameplayStart();
    expect(f.messages).toEqual([]);
    p.loaded();
    p.loaded();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStop();
    expect(f.messages).toEqual(['game_ready', 'gameplay_started', 'gameplay_stopped']);
  });

  it('is silent while either the sound switch is off or the platform pauses', async () => {
    const f = fakeBridge();
    const p = await platform(f);
    const muted: boolean[] = [];
    p.onHostMute((m) => muted.push(m));
    f.emit('pause_state_changed', true);
    f.emit('audio_state_changed', false);
    f.emit('pause_state_changed', false);
    f.emit('audio_state_changed', true);
    expect(muted).toEqual([false, true, true, true, false]);
  });

  it("opens the game's pause on each platform pause, not on its end", async () => {
    const f = fakeBridge();
    const p = await platform(f);
    let opened = 0;
    p.onHostPause(() => opened++);
    f.emit('pause_state_changed', true);
    f.emit('pause_state_changed', false);
    f.emit('pause_state_changed', true);
    expect(opened).toBe(2);
  });

  it('offers no rewarded ad under an adblocker or where the platform has none', async () => {
    const p = await platform(fakeBridge({ adblock: true }));
    expect([p.rewardedAvailable(), p.adBlocked()]).toEqual([false, true]);
    expect((await platform(fakeBridge({ rewarded: false }))).rewardedAvailable()).toBe(false);
    const clean = await platform(fakeBridge());
    expect([clean.rewardedAvailable(), clean.adBlocked()]).toEqual([true, false]);
  });

  it("takes the platform's language, English otherwise, never the browser's", async () => {
    vi.stubGlobal('navigator', { languages: ['de'], language: 'de' });
    try {
      expect((await platform(fakeBridge({ language: 'zh' }))).languages()).toEqual(['zh', 'en']);
      expect((await platform(fakeBridge({ language: 'ar' }))).languages()).toEqual(['ar', 'en']);
      expect((await platform(null)).languages()).toEqual(['en']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends telemetry from the portal only', async () => {
    const f = fakeBridge();
    (await platform(f)).track('progression_started', { step_id: 'wave', step_index: 1 });
    const mock = fakeBridge({ id: 'mock' });
    (await platform(mock)).track('progression_started', { step_id: 'wave', step_index: 1 });
    expect([f.tracked, mock.tracked]).toEqual([[['progression_started', { step_id: 'wave', step_index: 1 }]], []]);
  });

  it('plays its ads through Bridge and tells the platform of an achievement', async () => {
    const f = fakeBridge();
    const p = await platform(f);
    let started = 0;
    const paid = p.rewarded(() => started++);
    for (const s of ['opened', 'rewarded', 'closed']) f.emit('rewarded_state_changed', s);
    expect(await paid).toBe(true);
    const mid = p.midgame(() => started++);
    for (const s of ['opened', 'closed']) f.emit('interstitial_state_changed', s);
    await mid;
    p.celebrate();
    expect([started, f.shown, f.messages]).toEqual([2, ['rewarded', 'interstitial'], ['player_got_achievement']]);
  });

  it("hands the daily board to the game only where Bridge can write and read it back", async () => {
    expect((await platform(fakeBridge())).board()).toBeNull();
    expect((await platform(fakeBridge({ board: { type: 'native_popup' } }))).board()).toBeNull();
    const entries = [{ id: 'p1', name: 'Ada', photo: '', score: 5017, rank: 1 }, { name: 7, score: 'x', rank: 2 }, { score: 4012, rank: 3 }];
    const f = fakeBridge({ board: { entries } });
    const board = (await platform(f)).board()!;
    await board.submit(5020);
    expect(f.scores).toEqual([[BOARD_ID, 5020]]);
    expect(await board.top()).toEqual([
      { name: 'Ada', score: 5017, rank: 1 },
      { name: '', score: 4012, rank: 3 },
    ]);
    expect(await (await platform(fakeBridge({ board: { entries: 'nope' } }))).board()!.top()).toEqual([]);
  });
});

describe('PlaygamaPlatform payments', () => {
  const catalog = [{ id: 'other', price: '9 €' }, { id: 'remove_ads', price: '1,99 €', priceValue: 1.99 }];

  it('hands payments to the game only where Bridge takes them', async () => {
    expect((await platform(fakeBridge())).payments()).toBeNull();
    expect((await platform(fakeBridge({ pay: { supported: false } }))).payments()).toBeNull();
    expect((await platform(null)).payments()).toBeNull();
  });

  it("reads what the player owns and the catalog's own price, and buys through Bridge", async () => {
    const f = fakeBridge({ pay: { owned: [{ id: 'remove_ads', token: 'x' }, { nope: 1 }, null], catalog } });
    const pay = (await platform(f)).payments()!;
    expect(await pay.owned()).toEqual(['remove_ads']);
    expect(await pay.price('remove_ads')).toBe('1,99 €');
    expect(await pay.price('missing')).toBe('');
    expect(await pay.buy('remove_ads')).toBe(true);
    expect(f.bought).toEqual(['remove_ads']);
  });

  it('answers false when the player backs out, and empty on a broken answer', async () => {
    const pay = (await platform(fakeBridge({ pay: { pays: false, owned: 'junk', catalog: { id: 'remove_ads' } } }))).payments()!;
    expect(await pay.buy('remove_ads')).toBe(false);
    expect(await pay.owned()).toEqual([]);
    expect(await pay.price('remove_ads')).toBe('');
  });
});
