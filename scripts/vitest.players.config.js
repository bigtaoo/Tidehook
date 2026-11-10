import { defineConfig } from 'vite';

// The player population (scripts/players): a report, not a check, so it stays out of npm run check.
export default defineConfig({ test: { include: ['scripts/players/*.sim.ts'], disableConsoleIntercept: true, testTimeout: 3_600_000 } });
