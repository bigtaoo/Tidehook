// The player's settings beyond the HUD's speaker (audio/sound.ts keeps that one, the master
// switch): the music and the effects apart, the phone's buzz (game/haptics.ts) and calm motion,
// which turns off the shake and the hit-stop (view/scene/feel.ts). Kept in the platform's storage;
// bad or missing data reads as everything on but calm motion, unless the system asks for less of it.

import type { KeyValueStore } from '../platform/types';

export const SETTINGS_KEY = 'tidehook.settings';

export type SettingId = 'music' | 'sfx' | 'buzz' | 'calm';
export const SETTING_IDS: readonly SettingId[] = ['music', 'sfx', 'buzz', 'calm'];

const DEFAULTS: Record<SettingId, boolean> = { music: true, sfx: true, buzz: true, calm: false };

/** Whether the system asks for less motion. A player who has set that in their OS gets calm motion
 *  from the first frame, shake and hit-stop included, instead of having to find the switch after
 *  the first boss. Read once at boot: it is a default, and the player's own flip outlives it. */
export function wantsCalm(win: Partial<Pick<Window, 'matchMedia'>> | undefined): boolean {
  try {
    return win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    /* a host frame that will not answer a media query */
    return false;
  }
}

export class Settings {
  private readonly on: Record<SettingId, boolean> = { ...DEFAULTS };
  /** Called after every change, with the setting changed. */
  onChange: (id: SettingId) => void = () => {};

  /** `calm` starts on where the system asks for less motion; a stored choice still wins. */
  constructor(
    private readonly store: KeyValueStore | null,
    calm = false,
  ) {
    this.on.calm = calm;
    try {
      const v = JSON.parse(store?.getItem(SETTINGS_KEY) ?? '{}') as Partial<Record<SettingId, unknown>>;
      for (const id of SETTING_IDS) if (typeof v[id] === 'boolean') this.on[id] = v[id] as boolean;
    } catch {
      /* bad data: the defaults */
    }
  }

  get(id: SettingId): boolean {
    return this.on[id];
  }

  /** Flips `id` and remembers it; returns the new state. */
  toggle(id: SettingId): boolean {
    this.on[id] = !this.on[id];
    this.store?.setItem(SETTINGS_KEY, JSON.stringify(this.on));
    this.onChange(id);
    return this.on[id];
  }

  /** A short key of every setting, for a view's change check. */
  get key(): string {
    return SETTING_IDS.map((id) => (this.on[id] ? 1 : 0)).join('');
  }
}
