import { defineConfig } from 'vite';

// The balance guard: scripts/guard/*.test.ts play the scripted personas (src/sim/bot) on fixed
// seeds and pin the median wave each reaches, so a change to balance.json or src/sim that moves
// the difficulty curve fails `npm run check`. Kept out of the unit tests' include on purpose.
export default defineConfig({ test: { include: ['scripts/guard/*.test.ts'], disableConsoleIntercept: true, testTimeout: 300_000 } });
