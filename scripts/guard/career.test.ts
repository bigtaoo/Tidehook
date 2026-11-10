// How long the harbour's content lasts a new player (docs/04-content.md section 1): the novice
// persona's career, game after game, until everything is bought.

import { expect, test } from 'vitest';
import { career, formatCareer } from '../career/career';

test('the content lasts a new player three hours', () => {
  const c = career('novice');
  console.log(formatCareer('novice', c).join('\n'));
  expect(c.done ?? Infinity).toBeGreaterThanOrEqual(180);
});
