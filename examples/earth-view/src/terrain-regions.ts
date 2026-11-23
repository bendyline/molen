/** Seattle, Bellevue and Boeing Field: the package west of 122.15° W. */
export const SEATTLE_TERRAIN = 'seattle-bellevue-sammamish';
/** The Sammamish plateau: the package east of 122.15° W. */
export const SAMMAMISH_TERRAIN = 'sammamish';

/**
 * Every World Explorer region package the Earth view loads, from `terrain/<id>/` in the shared
 * public directory. A production build keeps only these (see vite.config.ts), so the hosted sample
 * does not publish a second copy of the explorer's other regions; a `?package=` link to one of
 * those works in development only.
 */
export const EARTH_VIEW_TERRAIN: readonly string[] = [SEATTLE_TERRAIN, SAMMAMISH_TERRAIN];
