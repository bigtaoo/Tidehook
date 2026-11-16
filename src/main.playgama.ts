import { LANG_KEY } from './app';
import { run } from './boot/run';
import { SOUND_KEY } from './audio/sound';
import { GUIDE_KEY } from './game/guide/store';
import { HARBOUR_KEY } from './game/meta/harbour';
import { PlaygamaPlatform } from './platform/playgama/PlaygamaPlatform';

const KEYS = [LANG_KEY, SOUND_KEY, GUIDE_KEY, HARBOUR_KEY];

// PlaygamaPlatform.create never rejects: a Bridge that is blocked or broken leaves the game
// playable, with the save in memory for this visit (src/platform/playgama/PlaygamaPlatform.ts).
void PlaygamaPlatform.create(KEYS).then((platform) => run(platform));
