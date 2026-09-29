import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import type { StructurePlacement } from '../kernel/structure-index';

/** Heights use the same metres and vertical reference as the host's terrain geometry. */
export type StructureTerrainSampler = (
  coordinate: readonly [longitude: number, latitude: number],
  request: Readonly<{ entry: StructurePlacement; signal: AbortSignal }>,
) => number | undefined | Promise<number | undefined>;

/** Resolve one origin before loading its model. Never clamp a remote reference to a tile edge. */
export async function resolveStructureElevation(
  entry: StructurePlacement,
  context: TerrainPyramidTileLayerContext,
  metersPerUnit: number,
  sample?: StructureTerrainSampler,
): Promise<number | undefined> {
  if (context.signal.aborted) return undefined;
  if (entry.datum === 'sea-level') return entry.elevation ?? 0;
  // An extended mesh is clipped independently in multiple tiles. A reference may
  // lie outside any of them; do not publish only the tile that happens to own it.
  if (entry.bounds && !sample) return undefined;
  const coordinate = entry.terrainReference?.anchor ?? entry.anchor;
  let height: number | undefined;
  if (sample) {
    height = await sample(coordinate, { entry, signal: context.signal });
    if (context.signal.aborted || height === undefined) return undefined;
  } else {
    const [x, z] = wgs84ToWorld(metersPerUnit, ...coordinate);
    const [ox, oz] = context.origin;
    if (x < ox || z < oz || x > ox + context.tileSize || z > oz + context.tileSize)
      return undefined;
    height = context.heightfield.sampleHeight(x, z);
  }
  if (!Number.isFinite(height)) throw new Error(`Invalid terrain elevation for ${entry.id}`);
  return (
    height -
    (entry.terrainReference?.modelHeight ?? 0) * (entry.scale?.[1] ?? 1) +
    (entry.elevation ?? 0)
  );
}
