/** Compose the ground adjustments shared by Earth hosts. */
import type {
  TerrainPyramidStreamOptions,
  TerrainRoadGrading,
} from '@bendyline/molen-terrain/client';

type Grading = NonNullable<TerrainPyramidStreamOptions['transformHeightfield']>;

/**
 * Roads are leveled first, followed by bounded site corrections and airfields. A site keeps its
 * shared grade where ordinary roadway sampling picked up a building or other surface return.
 */
export function composeEarthGroundGrading(
  roads: TerrainRoadGrading | undefined,
  airports: Grading | undefined,
  sites?: Grading,
): Grading | undefined {
  if (!roads && !sites) return airports;
  return async (context, source) => {
    const leveled = roads ? await roads.transformHeightfield(context, source) : context.heightfield;
    const graded = sites ? await sites({ ...context, heightfield: leveled }, source) : leveled;
    return airports ? airports({ ...context, heightfield: graded }, source) : graded;
  };
}
