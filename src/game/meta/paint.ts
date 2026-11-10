// Paint for the rope and the hook (docs/04-content.md section 3.11): a pearl sink for a captain
// with everything bought. Looks only: no paint changes how the hook fishes, so the sims and the
// balance guard never see it. The hemp rope and the steel hook are free and worn from the start;
// each paint bought costs more than the last (sim/balanceFun.ts paint), whichever it is.

import { BF } from '../../sim/balanceFun';

export type PaintKind = 'rope' | 'hook';

export interface PaintSpec {
  id: string;
  kind: PaintKind;
  /** The rope's colour, or the hook sprite's tint. */
  color: number;
}

export const PAINTS: readonly PaintSpec[] = [
  { id: 'hemp', kind: 'rope', color: 0xc9a46b },
  { id: 'tar', kind: 'rope', color: 0x2b2b30 },
  { id: 'red', kind: 'rope', color: 0xc0392b },
  { id: 'blue', kind: 'rope', color: 0x2f5fb3 },
  { id: 'kelp', kind: 'rope', color: 0x3f8f4e },
  { id: 'gold', kind: 'rope', color: 0xe0b23a },
  { id: 'steel', kind: 'hook', color: 0xffffff },
  { id: 'brass', kind: 'hook', color: 0xe8c060 },
  { id: 'copper', kind: 'hook', color: 0xd08050 },
  { id: 'jade', kind: 'hook', color: 0x6fd0a0 },
  { id: 'coral', kind: 'hook', color: 0xff8a80 },
  { id: 'midnight', kind: 'hook', color: 0x6070c0 },
];

/** What a new captain wears, free. */
export const FREE_PAINT: Record<PaintKind, string> = { rope: 'hemp', hook: 'steel' };

export function paintOf(id: string): PaintSpec | undefined {
  return PAINTS.find((p) => p.id === id);
}

/** Whether `id` is free (a default). */
export function freePaint(id: string): boolean {
  return id === FREE_PAINT.rope || id === FREE_PAINT.hook;
}

/** The rope's colour and the hook's tint for the paint worn; the free ones for none (a bot's game). */
export function wornColors(wear: Partial<Record<PaintKind, string>> | undefined): Record<PaintKind, number> {
  const of = (kind: PaintKind) => (paintOf(wear?.[kind] ?? '') ?? paintOf(FREE_PAINT[kind]))?.color ?? 0xffffff;
  return { rope: of('rope'), hook: of('hook') };
}

/** The pearls for the next paint after `bought` of them. */
export function paintPrice(bought: number): number {
  return BF.paint.base + BF.paint.step * bought;
}
