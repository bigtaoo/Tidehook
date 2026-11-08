import { en, type Table } from './en';

// After Potion Siege's i18n: English is the source and ships in the main bundle; the other
// languages are their own chunks, fetched while the game starts when the player's language is
// one of them. A new language is a table typed as Table plus a line in MORE.

export type Locale = 'en' | 'zh';
/** Every language, in the picker's order. */
export const LOCALES: readonly Locale[] = ['en', 'zh'];

const MORE: Record<Exclude<Locale, 'en'>, () => Promise<Table>> = {
  zh: () => import('./zh').then((m) => m.zh),
};

/** The tables in hand: en always, the others once loadLocale fetched them. */
const TABLES: Partial<Record<Locale, Table>> = { en };
let current: Locale = 'en';
let table: Table = en;

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** The first supported language among the candidates ('zh-CN', 'pt_BR'); only the base
 *  subtag counts. English when nothing matches. */
export function detectLocale(candidates: readonly (string | null | undefined)[]): Locale {
  for (const c of candidates) {
    const base = c?.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** Fetches `locale`'s table if it is not in hand yet; false when the fetch failed (offline),
 *  and the caller stays in the language it had. */
export async function loadLocale(locale: Locale): Promise<boolean> {
  if (TABLES[locale]) return true;
  try {
    TABLES[locale] = await MORE[locale as Exclude<Locale, 'en'>]();
    return true;
  } catch {
    return false;
  }
}

/** Switches to `locale`, if its table is in hand (loadLocale first); English otherwise. */
export function setLocale(locale: Locale): Locale {
  current = TABLES[locale] ? locale : 'en';
  table = TABLES[current] ?? en;
  return current;
}

export function getLocale(): Locale {
  return current;
}

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type TextKey = Paths<Table>;

/**
 * The string for a dotted key, with {name} placeholders filled in; {n|one:fish|other:fish}
 * picks the word for the count `n` by the language's plural rules (a missing form reads `other`).
 */
export function t(key: TextKey, params: Record<string, string | number> = {}): string {
  let v: unknown = table;
  for (const part of key.split('.')) v = (v as Record<string, unknown>)[part];
  return String(v)
    .replace(/\{(\w+)\|([^{}]+)\}/g, (whole, name: string, forms: string) => (name in params ? pluralForm(forms, Number(params[name]), current) : whole))
    .replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

const RULES: Partial<Record<Locale, Intl.PluralRules | null>> = {};

/** `n`'s plural category in `locale`; English's rule where Intl.PluralRules is missing. */
export function pluralCategory(n: number, locale: Locale): string {
  if (RULES[locale] === undefined) {
    try {
      RULES[locale] = typeof Intl !== 'undefined' && Intl.PluralRules ? new Intl.PluralRules(locale) : null;
    } catch {
      RULES[locale] = null;
    }
  }
  return RULES[locale]?.select(n) ?? (n === 1 ? 'one' : 'other');
}

/** The form for `n` out of "one:fish|other:fish". */
function pluralForm(forms: string, n: number, locale: Locale): string {
  const found = new Map<string, string>();
  for (const part of forms.split('|')) {
    const at = part.indexOf(':');
    if (at > 0) found.set(part.slice(0, at), part.slice(at + 1));
  }
  return found.get(pluralCategory(n, locale)) ?? found.get('other') ?? '';
}
