// Every key the game keeps in the platform's storage, in one list.
//
// On the web the store is the browser's own and a key that nobody asked for is still there when
// it is read. The portal's is not: Bridge storage is asynchronous, so BridgeStore reads the keys
// it is given once at boot and answers from that cache (platform/playgama/bridgeStore.ts). A key
// left out of the list is written and never read back - it looks like it works in dev and quietly
// loses the player's data on the only target that ships. So the list lives here, beside the two
// entry points that use it, and saveKeys.test.ts fails if a module holds a key that is not in it.

import { LANG_KEY } from './app';
import { SOUND_KEY } from './audio/sound';
import { GUIDE_KEY } from './game/guide/store';
import { HARBOUR_KEY } from './game/meta/harbour';
import { RUN_KEY } from './game/meta/resume';
import { SETTINGS_KEY } from './game/settings';

export const SAVE_KEYS: readonly string[] = [LANG_KEY, SOUND_KEY, GUIDE_KEY, HARBOUR_KEY, SETTINGS_KEY, RUN_KEY];
