// The lane the whole game happens in, in world units (math/fixed.ts): distance `d` out from the
// dock, 0 at the crane, and width `w` across it. The view turns it to fit the screen
// (view/orient.ts): the dock at the bottom in portrait, on the left in landscape.

import { toFp } from './math/fixed';

/** How far the lane reaches from the dock, in world units (prototype/v2.html's height). */
export const LANE_LEN = 800;
/** How wide the lane is, in world units (prototype/v2.html's width). */
export const LANE_WIDTH = 480;

export const LANE_LEN_FP = toFp(LANE_LEN);
export const LANE_WIDTH_FP = toFp(LANE_WIDTH);
