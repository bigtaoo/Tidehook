// The Playgama entry (vite.playgama.config.js): the game on Playgama's Bridge, its saves kept by
// Bridge under these keys, read once at boot (platform/playgama/bridgeStore.ts).

import { boot, LANG_KEY } from './app';
import { SOUND_KEY } from './audio/sound';
import { GUIDE_KEY } from './game/guide/store';
import { HARBOUR_KEY } from './game/meta/harbour';
import { t } from './i18n';
import { PlaygamaPlatform } from './platform/playgama/PlaygamaPlatform';

const KEYS = [LANG_KEY, SOUND_KEY, GUIDE_KEY, HARBOUR_KEY];

PlaygamaPlatform.create(KEYS)
  .then(boot)
  .catch((err) => {
    console.error(err);
    document.body.style.color = '#fff1d6';
    document.body.textContent = t('boot.failed', { error: String(err) });
  });
