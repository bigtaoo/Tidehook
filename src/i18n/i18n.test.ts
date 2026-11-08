import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { detectLocale, getLocale, loadLocale, pluralCategory, setLocale, t } from './index';
import { zh } from './zh';

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
    expect(detectLocale([null, 'fr-FR', 'zh_TW'])).toBe('zh');
    expect(detectLocale(['fr', undefined])).toBe('en');
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
    expect(keys(zh)).toEqual(enKeys);
    const get = (o: object, k: string) => k.split('.').reduce<unknown>((v, p) => (v as Record<string, unknown>)[p], o) as string;
    for (const k of enKeys) expect(holes(get(zh, k)), k).toEqual(holes(get(en, k)));
  });

  it('knows plural categories', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
  });
});
