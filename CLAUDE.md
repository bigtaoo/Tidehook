# Tidehook (拉钩港)

Design docs live in `docs/` (Chinese); code, comments, commits and the README are in English.
The gameplay reference is `prototype/v2.html` with its balance sim `prototype/tools/sim2.js`
(reference only, not shipped). The engineering template is Potion Siege (`D:\fang`).

## Layers

- `src/sim/`: deterministic simulation. Integers only (FP = 1000 per world unit, 30 Hz ticks),
  seeded `Prng`, table trig. No Pixi, DOM, clocks or `Math.random`;
  `src/sim/determinismLint.test.ts` enforces it. World units are the prototype's (a lane 800 long,
  480 wide), so its numbers carry over unchanged.
- `src/view/`: Pixi rendering. `orient.ts` is the only place that maps lane (d, w) to the screen
  (portrait: dock at the bottom; landscape: dock on the left). HUD and shop are never rotated.
- `src/platform/`: one `Platform` per target: `web.ts` (dev and plain web) and `playgama/` (the only
  portal, Bridge v2); `stub.ts` for tests. Ads live in `src/game/ads.ts`, telemetry in `src/game/telemetry.ts`.
- `src/i18n/`: `t()` with `en.ts` as the source; other tables are typed `Table`, so a missing key
  is a compile error. No literal player-facing strings in code.

## File size

- No file under `src/` or `scripts/` goes over **500 lines**, test files included.
- New code goes into a new module, split by what it does.
- Enforced by `npm run check:filelength`.

## Checks

`npm run check` = typecheck + file length + tests + balance guard + build + bundle size (≤ 5 MB).
Run it before every commit. It ends with `npm run build:playgama` (dist-playgama/ plus
`tidehook-playgama.zip`; `npm run dev:playgama` serves it on port 5191, launch.json "playgama").
Never upload to Playgama or publish a sandbox without an explicit yes. The balance guard (`npm run check:balance`, scripts/guard/) plays the
bot personas in `src/sim/bot/` on fixed seeds and pins their median waves. `npm run sim:players`
(scripts/players/, a report, not in check) plays a population of skills and habits through whole
careers; findings in docs/04-content.md section 4. Dev server: `npm run dev` (port 5190; `.claude/launch.json` "web").

URL switches (dev builds only, `src/game/switches.ts`): `?lang`, `?ads=fake`, `?seed`, `?speed`,
`?autoplay`, `?lag` (ms a tap looks back, default 0; see docs/01-tech-plan.md section 5),
`?ease=N` (N waves of slow tide per game instead of 30, sim/tide.ts; 0 a bare game), `?rec=0` (turns off the tap recorder, on by default in dev: it writes recordings/*.ndjson, read with
`node scripts/rec/analyze.mjs`).
