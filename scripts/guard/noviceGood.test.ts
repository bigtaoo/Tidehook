// Every player's game opens on the slow tide, a good player's too: that game must still end, the
// climb after the slow waves catching up with them (src/sim/tide.ts). The ceiling was 45 minutes
// and the fun layer's content drifted the median to 43.3; the tide's surge stage pulled it back to
// 38.9, so the ceiling is 42 now and a drift like that fails here instead of passing unnoticed.

import { expect, test } from 'vitest';
import { B } from '../../src/sim/balance';
import { minutes } from './minutes';

test("a good player's game on the tide still ends", () => {
  expect(minutes('good', B.tide.waves).p50).toBeLessThanOrEqual(42);
});
