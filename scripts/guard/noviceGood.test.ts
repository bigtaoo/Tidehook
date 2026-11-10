// Every player's game opens on the slow tide, a good player's too: that game must still end, the
// climb after the slow waves catching up with them (src/sim/tide.ts).

import { expect, test } from 'vitest';
import { B } from '../../src/sim/balance';
import { minutes } from './minutes';

test("a good player's game on the tide still ends", () => {
  expect(minutes('good', B.tide.waves).p50).toBeLessThanOrEqual(45);
});
