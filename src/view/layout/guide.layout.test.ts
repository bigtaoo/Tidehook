// The tutorial's screens at every swept size in every language (layout.test.ts covers the rest):
// each step's words and the skip button in the bubble, the Top pick tag on each card, the first
// game over's lesson; and the hand's arrow never leaves the screen, whatever it points at.
import './measure';
import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { Guide, type Cue, type CueTarget } from '../../game/guide/guide';
import { Session } from '../../game/session';
import { LOCALES, loadLocale, setLocale, t, type TextKey } from '../../i18n';
import { SafeStore } from '../../platform/types';
import { toFp } from '../../sim/math/fixed';
import { startGame, step } from '../../sim/step';
import type { World } from '../../sim/world';
import { frameFor, type Frame } from '../hud/frame';
import { Overlay } from '../hud/overlay';
import { Pointer } from '../hud/pointer';
import { ShopPanel, type ShopActions } from '../hud/shop';
import { Button } from '../kit/button';
import { fitDesign } from '../viewport';
import { overflows } from './check';
import { unknownChars } from './measure';

const SIZES: [number, number][] = [
  [390, 844],
  [844, 390],
  [768, 1024],
  [1280, 720],
  [800, 450],
];
const STEPS = ['cast', 'crab', 'throw', 'junk'] as const;
const LESSONS = ['junk', 'cards', 'fish', 'near'] as const;
const noop: ShopActions = { buy() {}, repair() {}, mine() {}, reroll() {}, next() {} };

/** A session in its first wave with the tutorial on; `cue` is set by hand. */
function session(): Session {
  const s = new Session({ seed: 5, speed: 1, autoplay: null }, new Guide(new SafeStore(null)));
  s.start();
  return s;
}

/** A world in its first shop (wave 1 played out with no one fishing, the dock patched up). */
function shopWorld(): World {
  const w = startGame(11);
  while (w.phase === 'wave') {
    step(w);
    w.hp = w.maxHp;
  }
  w.coins = 500;
  return w;
}

function bubble(fr: Frame, text: TextKey, armed: boolean): Container {
  const s = session();
  const p = new Pointer(fr, new ShopPanel(fr, noop), () => {});
  s.guide!.cue = { step: 'cast', text, target: null, hand: false, want: null };
  if (armed) s.guide!.skip();
  p.update(s, 16);
  return p;
}

describe('the tutorial fits its boxes in every language', () => {
  for (const l of LOCALES) {
    it(l, async () => {
      expect(await loadLocale(l)).toBe(true);
      setLocale(l);
      const found: string[] = [];
      for (const [sw, sh] of SIZES) {
        const fr = frameFor(fitDesign(sw, sh));
        const screens: [string, () => Container][] = [];
        for (const st of STEPS) for (const armed of [false, true]) screens.push([`bubble/${st}${armed ? ' armed' : ''}`, () => bubble(fr, `guide.${st}`, armed)]);
        for (const i of [0, 1, 2]) {
          screens.push([
            `shop/tag ${i}`,
            () => {
              const p = new ShopPanel(fr, noop);
              p.update(shopWorld(), true, true, i);
              return p;
            },
          ]);
        }
        for (const ls of LESSONS) {
          screens.push([
            `over/${ls}`,
            () => {
              const o = new Overlay(fr);
              o.update('over', false, false, 188, [], 16, false, t(`guide.lesson.${ls}`));
              return o;
            },
          ]);
        }
        for (const [name, build] of screens) {
          const root = build();
          for (const o of overflows(root, { x: 0, y: 0, width: fr.fit.w, height: fr.fit.h }, [Button])) {
            found.push(`${sw}x${sh} ${name}: ${JSON.stringify(o.text)} ${o.side === 'button' ? 'runs into a button by' : `sticks out ${o.side} by`} ${o.by}px`);
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

describe('the hand stays on screen', () => {
  it('for lane targets at the lane corners and every shop button', () => {
    const off: string[] = [];
    for (const [sw, sh] of SIZES) {
      const fr = frameFor(fitDesign(sw, sh));
      const shop = new ShopPanel(fr, noop);
      const p = new Pointer(fr, shop, () => {});
      const s = session();
      const it0 = s.world.items[0];
      const targets: [string, CueTarget, () => void][] = [];
      for (const [d, w] of [
        [90, 0],
        [90, 480],
        [790, 0],
        [790, 480],
        [400, 240],
      ]) {
        targets.push([`item ${d},${w}`, { t: 'item', id: it0.id }, () => ((it0.d = toFp(d)), (it0.w = toFp(w)))]);
      }
      for (const pick of [{ t: 'card', i: 0 }, { t: 'card', i: 1 }, { t: 'card', i: 2 }, { t: 'repair' }, { t: 'next' }] as const) {
        targets.push([`shop ${JSON.stringify(pick)}`, { t: 'shop', pick }, () => shop.update(shopWorld(), true, true)]);
      }
      for (const [name, target, set] of targets) {
        set();
        s.prev.clear();
        const cue: Cue = { step: 'cast', text: null, target, hand: true, want: null };
        s.guide!.cue = cue;
        p.update(s, 16);
        const tip = p.tip;
        const on = (x: number, y: number) => x >= 0 && x <= fr.fit.w && y >= 0 && y <= fr.fit.h;
        if (!tip || !on(tip.x, tip.y) || !on(tip.x, tip.tail)) off.push(`${sw}x${sh} ${name}: ${JSON.stringify(tip)}`);
      }
      p.destroy({ children: true });
      shop.destroy({ children: true });
    }
    expect(off).toEqual([]);
  });
});
