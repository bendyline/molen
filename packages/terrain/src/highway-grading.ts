/** The original name of connected bridge grading, kept for callers that import it. */
import { gradeTransportSeparations } from './grade-separation';
import type { TerrainTransportationFeature } from './semantic-types';

/**
 * Grade every inferred bridge and the roads that climb to it; see
 * {@link gradeTransportSeparations}, which this forwards to. It once graded motorways only, at a
 * fixed 6 m a layer, so decks that crossed each other shared a height.
 */
export function gradeHighwayBridges(
  features: readonly TerrainTransportationFeature[],
  tileSize: number,
  groundAt: (x: number, z: number) => number,
): readonly TerrainTransportationFeature[] {
  return gradeTransportSeparations(features, tileSize, groundAt);
}
