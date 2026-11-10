// The URL switches (CLAUDE.md): ?lang, ?ads=fake, ?seed, ?speed, ?autoplay, ?lag, ?ease, ?rec and
// ?board=fake (a made-up daily board, platform/fakeBoard.ts), ?pay=fake (the remove-ads product on
// sale in memory, platform/fakePayments.ts). A release build reads only ?lang, which
// changes nothing but the words: the others would let anyone on the live page farm pearls at ?speed,
// get free rewarded ads or run the bot into their save.

/** Switches a release build still reads. */
const RELEASE: readonly string[] = ['lang'];

/** The page's switches: all of them in a dev build, only RELEASE's in a release. */
export function urlSwitches(search: string, dev: boolean = import.meta.env.DEV): URLSearchParams {
  const all = new URLSearchParams(search);
  if (dev) return all;
  const kept = new URLSearchParams();
  for (const [k, v] of all) if (RELEASE.includes(k)) kept.append(k, v);
  return kept;
}
