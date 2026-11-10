// Every screen at every swept size in every language: no word sticks out of the bar, panel, card
// or button it sits on, nor runs into a button beside it. Text is measured by a table of real
// Windows Chromium glyph widths (see measure.ts), so this runs in node without a browser.
import './measure';
import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { LOCALES, loadLocale, setLocale, t, type TextKey } from '../../i18n';
import { B, MONSTER_KINDS } from '../../sim/balance';
import { Pilot } from '../../sim/bot/bot';
import { startGame, step } from '../../sim/step';
import type { World } from '../../sim/world';
import { frameFor, type Frame } from '../hud/frame';
import { Hud } from '../hud/hud';
import { goalText } from '../hud/lobbyLog';
import { seaName } from '../hud/lobbySeas';
import { LOBBY_TABS, LobbyPanel } from '../hud/lobby';
import { Overlay } from '../hud/overlay';
import { Harbour } from '../../game/meta/harbour';
import { SafeStore } from '../../platform/types';
import { ShopPanel, type ShopActions } from '../hud/shop';
import { Button } from '../kit/button';
import { fitDesign } from '../viewport';
import { overflows } from './check';
import { unknownChars } from './measure';

/** The screens the sweep covers: phones both ways, a tablet, a desktop tab, a small embed. */
const SIZES: [number, number][] = [
  [390, 844],
  [844, 390],
  [768, 1024],
  [1280, 720],
  [800, 450],
];

const noop: ShopActions = { buy() {}, repair() {}, mine() {}, reroll() {}, next() {} };

/** A world in its first shop, played there by the good bot. */
function firstShop(): World {
  const w = startGame(11);
  const pilot = new Pilot(11, 'good');
  while (w.phase === 'wave') {
    pilot.tick(w);
    step(w);
  }
  expect(w.phase).toBe('shop');
  return w;
}

/** Big numbers everywhere: deep into the waves, a full purse, every count at its widest. */
function rich(w: World): World {
  w.wave = 88;
  w.coins = 98_765;
  w.maxHp = 188;
  w.hp = 187;
  w.mines = B.mine.max;
  w.rerolls = 9;
  w.held = w.items.find((it) => it.kind === 'junk') ?? null;
  return w;
}

interface Screen {
  name: string;
  build(): Container;
}

function screens(fr: Frame): Screen[] {
  const out: Screen[] = [];
  const hud = (name: string, world: () => World): Screen => ({
    name: `hud/${name}`,
    build: () => {
      const h = new Hud(fr, () => {});
      h.update(world());
      return h;
    },
  });
  out.push(hud('start', () => startGame(1)), hud('rich', () => rich(firstShop())));

  // every card in the shop, three at a time and four (the harbour's wider stall), at level 0 and
  // with big numbers; the bot's turn; a bought card
  const ids = B.upgrades.map((u) => u.id);
  for (const n of [3, 4]) for (let i = 0; i < ids.length; i += n) {
    const three = Array.from({ length: n }, (_, k) => ids[(i + k) % ids.length]);
    for (const big of [false, true]) {
      out.push({
        name: `shop/${three.join(',')}${big ? ' rich' : ''}`,
        build: () => {
          const w = firstShop();
          if (big) rich(w);
          w.cards = three.map((id) => ({ id, bought: false }));
          const p = new ShopPanel(fr, noop);
          p.update(w, true, true);
          return p;
        },
      });
    }
  }
  out.push({
    name: 'shop/bot, one bought',
    build: () => {
      const w = firstShop();
      w.cards[1].bought = true;
      const p = new ShopPanel(fr, noop);
      p.update(w, true, false);
      return p;
    },
  });

  // the covers, and every hint the banner can carry
  const cover = (name: string, mode: 'title' | 'play' | 'over', paused: boolean): Screen => ({
    name: `cover/${name}`,
    build: () => {
      const o = new Overlay(fr);
      o.update(mode, paused, false, 188, [], 16);
      return o;
    },
  });
  out.push(cover('title', 'title', false), cover('paused', 'play', true), cover('over', 'over', false));
  out.push({
    name: 'cover/over with pearls',
    build: () => {
      const o = new Overlay(fr);
      const longest = B.goals.map(goalText).sort((a, b) => b.length - a.length)[0];
      o.update('over', false, false, 188, [], 16, false, t('guide.lesson.fish'), 9_876, [t('overlay.record', { sea: seaName(1) }), t('overlay.logOne', { goal: longest })]);
      return o;
    },
  });

  // the harbour: a new one, and a rich one with every upgrade bought up to the max or near it
  for (const rich of [false, true]) for (const tab of LOBBY_TABS) {
    out.push({
      name: `lobby/${rich ? 'rich' : 'new'}/${tab}`,
      build: () => {
        const h = new Harbour(new SafeStore(null));
        if (rich) {
          h.earn(9_999_999);
          for (const u of B.meta.upgrades) for (let i = 0; i < u.max - (u.id === 'powder' ? 1 : 0); i++) h.buy(u.id);
          h.logGame({ wave: 12, kills: 9_000, mined: 99_999, crush: 3, games: 1 });
        }
        const p = new LobbyPanel(fr, { buy() {}, sail() {}, chart() {}, pick() {} });
        p.tab = tab;
        p.update(h, true, rich ? { wave: 188, pearls: 9_876 } : { wave: 0, pearls: 0 });
        return p;
      },
    });
  }
  const hints = [
    ...MONSTER_KINDS.map((k) => t('hints.debut', { name: t(`monsters.${k}.name` as TextKey), tip: t(`monsters.${k}.tip` as TextKey) })),
    t('hints.held'),
    t('hints.eat'),
  ];
  for (const [i, text] of hints.entries()) {
    out.push({
      name: `hint/${i}`,
      build: () => {
        const o = new Overlay(fr);
        o.showForCheck(text);
        return o;
      },
    });
  }
  return out;
}

describe('every language fits its boxes', () => {
  for (const l of LOCALES) {
    it(l, async () => {
      expect(await loadLocale(l)).toBe(true);
      setLocale(l);
      const found: string[] = [];
      for (const [sw, sh] of SIZES) {
        const fr = frameFor(fitDesign(sw, sh));
        for (const s of screens(fr)) {
          const root = s.build();
          for (const o of overflows(root, { x: 0, y: 0, width: fr.fit.w, height: fr.fit.h }, [Button])) {
            found.push(`${sw}x${sh} ${s.name}: ${JSON.stringify(o.text)} ${o.side === 'button' ? 'runs into a button by' : `sticks out ${o.side} by`} ${o.by}px`);
          }
          root.destroy({ children: true });
        }
      }
      setLocale('en');
      expect([...new Set(found)]).toEqual([]);
    });
  }

  it('measures every glyph it met', () => {
    expect(unknownChars()).toEqual([]);
  });
});
