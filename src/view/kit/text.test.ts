import { describe, expect, test } from 'vitest';
import { cjkBreaks } from './text';

const H = ' ';

describe('cjkBreaks', () => {
  test('lets CJK part between characters, never before a closing mark', () => {
    expect(cjkBreaks('破烂一分为三：两侧')).toBe(['破', '烂', '一', '分', '为', '三：', '两', '侧'].join(H));
  });
  test('never after an opening mark, and leaves spaces and Latin alone', () => {
    expect(cjkBreaks('第 30 波（快）')).toBe(`第 30 波${H}（快）`);
    expect(cjkBreaks('Wave 30')).toBe('Wave 30');
  });
});
