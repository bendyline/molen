import type {
  TerrainSemanticMeshOptions,
  TerrainWaterFeatureStyle,
} from '@bendyline/molen-terrain/client';
import { type TerrainPackageDescriptor, wgs84ToWorld } from '@bendyline/molen-terrain/kernel';

interface WaterStageSplit {
  anchor: [number, number];
  heading: number;
  negativeZ: number;
  positiveZ: number;
}

type EarthWaterFeature = TerrainWaterFeatureStyle & { split?: WaterStageSplit };
export type EarthWaterFeatures = ReadonlyMap<string, EarthWaterFeature>;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function readStageSplit(value: unknown): WaterStageSplit {
  if (!value || typeof value !== 'object') throw new Error('Invalid water stage split');
  const { anchor, heading, negativeZ, positiveZ } = value as Record<string, unknown>;
  if (
    !Array.isArray(anchor) ||
    anchor.length !== 2 ||
    !finite(anchor[0]) ||
    !finite(anchor[1]) ||
    Math.abs(anchor[0]) > 180 ||
    Math.abs(anchor[1]) > 85 ||
    !finite(heading) ||
    !finite(negativeZ) ||
    !finite(positiveZ)
  )
    throw new Error('Invalid water stage split');
  return { anchor: [anchor[0], anchor[1]], heading, negativeZ, positiveZ };
}

/** Read feature-level water settings from the Earth pack. The keys are Protomaps feature IDs. */
export function readEarthWaterFeatures(value: unknown): EarthWaterFeatures {
  const document = value as { format?: unknown; features?: unknown } | null;
  if (document?.format !== 'molen/earth-water-features@1' || !Array.isArray(document.features))
    throw new Error('Invalid Earth water features document');
  const styles = new Map<string, EarthWaterFeature>();
  for (const item of document.features as unknown[]) {
    if (item === null || typeof item !== 'object') throw new Error('Invalid Earth water feature');
    const { id, elevation, hideLines, hidePolygons, split } = item as Record<string, unknown>;
    if (typeof id !== 'number' || !Number.isSafeInteger(id))
      throw new Error('An Earth water feature requires a Protomaps feature ID');
    if (
      (elevation === undefined &&
        hideLines !== true &&
        hidePolygons !== true &&
        split === undefined) ||
      (elevation !== undefined && (!finite(elevation) || split !== undefined)) ||
      (hideLines !== undefined && hideLines !== true) ||
      (hidePolygons !== undefined && hidePolygons !== true) ||
      styles.has(String(id))
    )
      throw new Error(`Invalid or duplicate Earth water feature ${id}`);
    styles.set(String(id), {
      ...(elevation === undefined ? {} : { elevation }),
      ...(hideLines === true ? { hideLines } : {}),
      ...(hidePolygons === true ? { hidePolygons } : {}),
      ...(split === undefined ? {} : { split: readStageSplit(split) }),
    });
  }
  return styles;
}

/** A non-Protomaps host can supply its own settings to the terrain renderer. */
export function earthWaterMeshOptions(
  waterFeatures: EarthWaterFeatures | undefined,
  terrain: TerrainPackageDescriptor,
): Pick<TerrainSemanticMeshOptions, 'waterFeatureStyle'> {
  if (
    terrain.coordinateSpace.kind !== 'geospatial' ||
    terrain.features?.profile !== 'protomaps-basemap@1' ||
    !waterFeatures?.size
  )
    return {};
  return {
    waterFeatureStyle: (feature, surface) => {
      const style = feature.id === undefined ? undefined : waterFeatures.get(String(feature.id));
      if (!style?.split || !surface) return style;

      // A single map relation can contain separate bodies on both sides of a dam. Its
      // mapped polygons already follow the shore, so classify each piece in world space.
      const { polygon, context } = surface;
      const { anchor, heading, negativeZ, positiveZ } = style.split;
      const [x, z] = wgs84ToWorld(context.pyramid.metersPerUnit ?? 1, ...anchor);
      const [ox, oz] = context.origin;
      const sine = Math.sin(heading);
      const cosine = Math.cos(heading);
      let localZ = 0;
      for (const [u, v] of polygon.outer) {
        localZ += sine * (ox + u * context.tileSize - x) + cosine * (oz + v * context.tileSize - z);
      }
      return { ...style, elevation: localZ < 0 ? negativeZ : positiveZ };
    },
  };
}
