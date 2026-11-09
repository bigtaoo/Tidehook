// The finished art in public/art/ (WebP, built from art/cut by tools/build_sprites.sh). All of it
// is under 200 kB, so the game fetches it once before the first frame; a file that fails keeps its
// grey-box shape, and so does everything in tests, where nothing is loaded.

import { Assets, Sprite, type Texture } from 'pixi.js';
import FIT from './artFit.json';

export type ArtName = keyof typeof FIT;

export const ART_NAMES = Object.keys(FIT) as ArtName[];

const textures = new Map<ArtName, Texture>();

/** Fetches every sprite. Never rejects: a missing file is logged and left to its placeholder. */
export async function loadArt(base: string = import.meta.env.BASE_URL): Promise<void> {
  await Promise.all(
    ART_NAMES.map(async (n) => {
      try {
        const t = await Assets.load<Texture>(`${base}art/${n}.webp`);
        // held for the whole session: no GPU re-upload mid-wave after a minute unseen
        t.source.autoGarbageCollect = false;
        textures.set(n, t);
      } catch (err) {
        console.warn(`art: ${n} failed to load, keeping the placeholder`, err);
      }
    }),
  );
}

export function tex(n: ArtName): Texture | undefined {
  return textures.get(n);
}

/** The scale that gives sprite `n` the opaque area of a circle of `radius` (design units). */
export function areaScale(n: ArtName, radius: number): number {
  return radius / FIT[n].r;
}

/** Sprite `n` scaled to `height` design units with its anchor at (ax, ay); null when it is not
 *  loaded, and the caller leaves the space empty. For the HUD's pictures (the captain). */
export function artSprite(n: ArtName, height: number, ax = 0.5, ay = 0.5): Sprite | null {
  const t = textures.get(n);
  if (!t) return null;
  const s = new Sprite(t);
  s.anchor.set(ax, ay);
  s.scale.set(height / FIT[n].h);
  return s;
}

/** Width over height of sprite `n`. */
export function aspect(n: ArtName): number {
  return FIT[n].w / FIT[n].h;
}

/** For tests: pretend `n` is loaded with texture `t`. */
export function setTextureForTest(n: ArtName, t: Texture): void {
  textures.set(n, t);
}
