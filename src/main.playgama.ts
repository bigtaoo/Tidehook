import { run } from './boot/run';
import { PlaygamaPlatform } from './platform/playgama/PlaygamaPlatform';
import { SAVE_KEYS } from './saveKeys';

// PlaygamaPlatform.create never rejects: a Bridge that is blocked or broken leaves the game
// playable, with the save in memory for this visit (src/platform/playgama/PlaygamaPlatform.ts).
void PlaygamaPlatform.create([...SAVE_KEYS]).then((platform) => run(platform));
