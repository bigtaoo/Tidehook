import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { detectLocale, getLocale, LOCALES, loadLocale, pluralCategory, setLocale, t } from './index';
import { pt } from './pt';
import { ru } from './ru';
import { tr } from './tr';
import { zh } from './zh';
import balance from '../sim/balance.json';

const OTHERS = { zh, ru, es, pt, tr, de, fr };

afterEach(() => void setLocale('en'));

/** Every dotted key path of a table. */
function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v as object, `${prefix}${k}.`)));
}

/** The {placeholders} a string uses, sorted. */
const holes = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  it('detects the base language and falls back to English', () => {
    expect(detectLocale(['zh-CN'])).toBe('zh');
    expect(detectLocale([null, 'it-IT', 'zh_TW'])).toBe('zh');
    expect(detectLocale(['pt-BR'])).toBe('pt');
    expect(detectLocale(['it', undefined])).toBe('en');
  });

  it('fills placeholders and leaves a missing one visible', () => {
    expect(t('hud.wave', { n: 3 })).toBe('Wave 3');
    expect(t('hud.mines')).toBe('Mines {n}');
  });

  it('switches to Chinese once its table is loaded', async () => {
    expect(await loadLocale('zh')).toBe(true);
    expect(setLocale('zh')).toBe('zh');
    expect(getLocale()).toBe('zh');
    expect(t('hud.wave', { n: 3 })).toBe('第 3 波');
  });

  it('gives every table the same keys and placeholders as English', () => {
    const enKeys = keys(en);
    const get = (o: object, k: string) => k.split('.').reduce<unknown>((v, p) => (v as Record<string, unknown>)[p], o) as string;
    expect(Object.keys(OTHERS).sort()).toEqual(LOCALES.filter((l) => l !== 'en').sort());
    for (const [code, table] of Object.entries(OTHERS)) {
      expect(keys(table), code).toEqual(enKeys);
      for (const k of enKeys) expect(holes(get(table, k)), `${code} ${k}`).toEqual(holes(get(en, k)));
    }
    // The ad buttons' play mark is drawn (Button's icon), never a glyph: ▶ may show as an emoji.
    for (const [code, table] of Object.entries({ en, ...OTHERS })) for (const k of enKeys) expect(get(table, k), `${code} ${k}`).not.toMatch(/[▶►⏵]/);
  });

  it('names every language in itself and loads each table', async () => {
    const names = new Set<string>();
    for (const l of LOCALES) {
      expect(await loadLocale(l)).toBe(true);
      setLocale(l);
      names.add(t('lang.name'));
    }
    expect(names.size).toBe(LOCALES.length);
  });

  it('knows plural categories', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
    expect(pluralCategory(3, 'ru')).toBe('few');
    expect(pluralCategory(5, 'ru')).toBe('many');
  });

  it('quotes the balance numbers the cards name, in every language', () => {
    // a card that says a number must say the one the sim plays (balance.json); these drifted once
    const n = (x: number) => new RegExp(`(?<![0-9.,])${String(x).replace('.', '[.,]')}(?![0-9])`);
    for (const tab of [en, de, es, fr, pt, ru, tr, zh]) {
      expect(tab.cards.keg.desc).toMatch(n(balance.keg.every));
      expect(tab.cards.barnacle.desc).toMatch(n(balance.barnacle.every));
      expect(tab.cards.golden.desc).toMatch(n(balance.gold.goldenMult));
    }
  });
});
