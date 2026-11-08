// Colours by role (docs/00-art-direction.md section 3). Warm is the player's side and the money;
// cold is the sea and the monsters. A monster never carries a warm colour (red eyes aside).

/** The dock, the crane and the UI: walnut, brass, rope and cream paper (Potion Siege's woods). */
export const P = {
  line: 0x24140a,
  wood: 0x5b3a22,
  woodDark: 0x3d2615,
  woodLight: 0x7a5233,
  brass: 0xd9a441,
  brassLight: 0xf7d77e,
  brassDark: 0x8f5c1d,
  rope: 0xc9a46b,
  paper: 0xf3e2bd,
  paperDark: 0xdcc08a,
  ink: 0x4a2c16,
  cream: 0xfff1d6,
  red: 0xe5484d,
  green: 0x4cc35a,
} as const;

/** The water, by distance from the dock: lighter near shore, deep indigo far out. The bands
 *  double as the value scale (farther = worth more), so they stay cool and desaturated. */
export const SEA = {
  shallow: 0x58aea6,
  mid: 0x2f7aa0,
  far: 0x22467a,
  /** Past the lane's sides and ends: the screen's fill. */
  deep: 0x123a52,
  /** The thin lines between bands. */
  seam: 0x0d2a3d,
} as const;

/** The words' outline on the field: dark enough to read over every band. */
export const TEXT_STROKE = 0x0d1b26;

/** The monsters, cold and readable over every band; never a warm colour. */
export const MON = {
  grunt: 0x8fe0b0,
  darter: 0xc9b6ff,
  brute: 0x6c7fd8,
  glutton: 0x9fe6f0,
} as const;

/** The catch: fish and chests are the money (warm), junk is grey. */
export const CATCH = {
  fish: 0xf2c14e,
  chest: 0xe08a2e,
  junk: 0x9aa3a8,
} as const;
