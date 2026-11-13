/** The order an Earth view's earthworks apply in: roads, then airfields. */
import type {
  TerrainPyramidStreamOptions,
  TerrainRoadGrading,
} from '@bendyline/molen-terrain/client';

type Grading = NonNullable<TerrainPyramidStreamOptions['transformHeightfield']>;

/**
 * One `transformHeightfield` from a road grading and an airport grading, either of which may be
 * absent. Roads are leveled first and the airfield after them, so a runway stays level where a
 * service road crosses the field; undefined when there is neither.
 */
export function composeEarthGroundGrading(
  roads: TerrainRoadGrading | undefined,
  airports: Grading | undefined,
): Grading | undefined {
  if (!roads) return airports;
  return async (context, source) => {
    const leveled = await roads.transformHeightfield(context, source);
    return airports ? airports({ ...context, heightfield: leveled }, source) : leveled;
  };
}
