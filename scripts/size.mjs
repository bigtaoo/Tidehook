// The rule behind scripts/checkSize.mjs, apart from the walk over dist/ so a test can run it.

export const MAX_BYTES = 5_000_000;

/** The complaint for a build of `bytes`, or '' when it fits.
 *  @param {number} bytes @param {number} max */
export function overBudget(bytes, max = MAX_BYTES) {
  return bytes > max ? `bundle is ${(bytes / 1e6).toFixed(2)} MB, over the ${max / 1e6} MB budget` : '';
}
