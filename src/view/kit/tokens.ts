// The numbers every panel shares: corner radii, edge widths, the type scale and the room between
// things. A screen that picks its own number drifts from the rest, so new work takes them from
// here and spells out only what is truly its own.

/** Rounded corners, by how big the thing is. */
export const RADIUS = {
  /** A pane inside a tile: the cabin's water. */
  pane: 12,
  /** A tile in a grid: a codex kind, a log goal, a paint. */
  tile: 18,
  /** A card the captain reads and buys from. */
  card: 24,
  /** A panel over the lane: the shop, the harbour. */
  panel: 32,
} as const;

/** Edges, by weight. Colour is never the only cue, so a card that is marked (the sea the captain
 *  is in, the paint worn) takes the heavier edge as well as the brass. */
export const STROKE = {
  /** A line inside a card: an empty bar. */
  hair: 2,
  /** A glyph's own edge: the coin, the pearl. */
  glyph: 3,
  /** A tile's edge. */
  tile: 4,
  /** A card's edge. */
  card: 5,
  /** A panel's edge, and a marked tile's. */
  panel: 6,
  /** A marked card's edge. */
  mark: 7,
} as const;

/** The type scale, design units, before the small-embed boost (viewport.ts textBoost). Everything
 *  the player reads takes one of these; `fitIn` and `fitWrap` shrink from them to fit a box. */
export const TYPE = {
  /** A cover's headline: the title, game over. */
  display: 96,
  /** The line under it, and the big buttons. */
  title: 60,
  /** A card's name, a price. */
  head: 40,
  /** A section's head over a list or a grid, and a card's action button. */
  lead: 34,
  /** A button's words, a cover's line. */
  body: 30,
  /** A card's description, a level, a record. */
  small: 28,
  /** A count beside a bar, the least a phone can still read. */
  meta: 24,
} as const;

/** Room between and inside things. */
export const SPACE = {
  /** Between tiles in a grid. */
  tight: 14,
  /** Inside a card, from its edge to its words. */
  snug: 16,
  /** Between cards in a row. */
  row: 20,
  /** A panel's own padding. */
  wide: 28,
  /** Between the big buttons on a cover. */
  loose: 32,
} as const;
