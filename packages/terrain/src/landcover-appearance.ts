import { polygonArea } from './polygon';
import type { TerrainLandcoverFeature } from './semantic-types';

const USES = new Set([
  'open_ground',
  'urban_area',
  'residential',
  'commercial',
  'retail',
  'industrial',
  'civic',
  'school',
  'hospital',
  'university',
]);
const ALIASES: Readonly<Record<string, string>> = {
  recreation_ground: 'park',
  village_green: 'grass',
  golf_course: 'grass',
  allotments: 'farmland',
  plant_nursery: 'farmland',
  farm: 'farmland',
  courtyard: 'gravel',
  bare_rock: 'barren',
  construction: 'barren',
  square: 'pedestrian',
  paved: 'pavement',
};

/** Physical subclasses (garden, gravel, wood) outrank broad land-use classes. */
export function landcoverAppearance(feature: TerrainLandcoverFeature): string {
  const raw = feature.subclass || feature.class;
  return ALIASES[raw] ?? raw;
}

/** Broad uses under smaller physical cover, independent of vector source order. */
export function orderLandcover(
  features: readonly TerrainLandcoverFeature[],
): TerrainLandcoverFeature[] {
  return features
    .map((feature, index) => ({
      feature,
      index,
      use: feature.class === 'open_ground' ? 0 : USES.has(landcoverAppearance(feature)) ? 1 : 2,
      area: feature.polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0),
    }))
    .sort((a, b) => a.use - b.use || b.area - a.area || a.index - b.index)
    .map(({ feature }) => feature);
}

export function crispLandcover(feature: TerrainLandcoverFeature): boolean {
  return (
    feature.cultivation !== undefined ||
    USES.has(landcoverAppearance(feature)) ||
    [
      'farmland',
      'crop',
      'orchard',
      'vineyard',
      'gravel',
      'pedestrian',
      'pavement',
      'parking',
    ].includes(landcoverAppearance(feature))
  );
}
