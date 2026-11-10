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
  /** The go buttons (next wave, sail) and a healthy dock: chart teal, not a glossy green. */
  go: 0x2f7f78,
} as const;

/** The water, by distance from the dock: teal near shore, steel blue, then deep indigo far out,
 *  picked from the style frame (art/style/style_frame_r2.png). The bands double as the value
 *  scale (farther = worth more), so they stay cool: every warm colour on the field is catch. */
export const SEA = {
  shallow: 0x26b2b0,
  mid: 0x186e8c,
  far: 0x16284a,
  /** Past the lane's sides and ends: the screen's fill, the chart backdrop's far water. */
  deep: 0x082040,
  /** The thin lines between bands. */
  seam: 0x0d2a3d,
  /** The other seas' weather over the water (field.ts drawWeather): the Fog Bank's mist, the
   *  Storm Reach's dark sky. */
  fog: 0xdfe8ec,
  storm: 0x0b1626,
} as const;

/** The words' outline on the field: dark enough to read over every band. */
export const TEXT_STROKE = 0x0d1b26;

/** The monsters, cold and readable over every band; never a warm colour. */
export const MON = {
  grunt: 0x8fe0b0,
  darter: 0xc9b6ff,
  brute: 0x6c7fd8,
  glutton: 0x9fe6f0,
  boss: 0x4a5cb0,
  hermit: 0x7fc9c0,
  ray: 0x6f78c8,
  kraken: 0x8a5ca8,
} as const;

/** The catch: fish and chests are the money (warm), junk is grey. */
export const CATCH = {
  fish: 0xf2c14e,
  chest: 0xe08a2e,
  junk: 0x9aa3a8,
} as const;

/** A hit point the hook's grip cannot lift: cold steel, drawn square (art direction section 3:
 *  colour is never the only cue). */
export const HEAVY = 0x8a9bb0;
