// One boot, with the loading page and the boot report around it (index.html, boot/screen.ts,
// game/bootTrack.ts). Both entries (src/main.ts, src/main.playgama.ts) go through here, so a
// failure ends the same way on either: the loading page keeps the screen, dims its hook and
// offers the retry button, and one `boot_error` goes out with the stage and a fixed word for the
// kind. The player is never left looking at a line of English on a blue wall.

import { boot } from '../app';
import { bootScreen } from './screen';
import { BootTrack } from '../game/bootTrack';
import type { Platform } from '../platform/types';

export async function run(platform: Platform, build: string = __TH_BUILD__): Promise<void> {
  const screen = bootScreen(globalThis);
  screen.started();
  const track = new BootTrack(platform, screen, build, window, document);
  try {
    await boot(platform, screen, track);
  } catch (err) {
    console.error(err);
    track.failed(err);
  }
}
