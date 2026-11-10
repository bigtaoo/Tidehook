import '../layout/measure';
import { describe, expect, it } from 'vitest';
import { Text, type Container } from 'pixi.js';
import { t } from '../../i18n';
import { fitDesign } from '../viewport';
import { frameFor } from './frame';
import { Overlay } from './overlay';

const fr = frameFor(fitDesign(390, 844));

/** The banner's words, '' when it shows none. */
function bannerText(o: Overlay): string {
  const banner = o.children[0] as Container;
  const words = banner.children.find((c) => c instanceof Text) as Text | undefined;
  return words ? words.text.replace(/ /g, '') : '';
}

/** A one-time hint's state, as the guide keeps it. */
function hintState() {
  const s = { seen: false, spent: 0 };
  return { s, hint: { seen: () => s.seen, spend: () => void ((s.seen = true), s.spent++) } };
}

describe('the first sea event hint', () => {
  it('follows the event and is spent only when it shows', () => {
    const o = new Overlay(fr);
    const { s, hint } = hintState();
    o.eventHint = hint;
    o.update('play', false, false, 3, [{ e: 'seaEvent', id: 'gold' }], 16);
    expect(bannerText(o)).toBe(t('events.gold'));
    expect(s.spent).toBe(0);
    o.update('play', false, false, 3, [], 4_100);
    expect(bannerText(o)).toBe(t('hints.event'));
    expect(s.spent).toBe(1);
  });

  it('comes back after a reset drops it unseen', () => {
    const o = new Overlay(fr);
    const { s, hint } = hintState();
    o.eventHint = hint;
    o.update('play', false, false, 3, [{ e: 'seaEvent', id: 'gold' }], 16);
    o.reset();
    expect(s.spent).toBe(0);
    o.update('play', false, false, 3, [{ e: 'seaEvent', id: 'gold' }], 16);
    o.update('play', false, false, 3, [], 4_100);
    expect(bannerText(o)).toBe(t('hints.event'));
    o.reset();
    o.update('play', false, false, 3, [{ e: 'seaEvent', id: 'gold' }], 16);
    o.update('play', false, false, 3, [], 4_100);
    expect(bannerText(o)).not.toBe(t('hints.event'));
    expect(s.spent).toBe(1);
  });
});
