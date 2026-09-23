export type {
  TerrainDescriptor,
  TerrainLayer,
  TerrainStreamingOptions,
} from './descriptor-types';
export { generateHeightmap, generateHeightmapPng, type HeightmapGenOptions } from './gen';
export {
  projectedToWorld,
  WEB_MERCATOR_EARTH_RADIUS_METERS,
  WEB_MERCATOR_HALF_WORLD_METERS,
  WEB_MERCATOR_MAX_LATITUDE,
  type WebMercatorTileAddress,
  webMercatorScaleAtLatitude,
  webMercatorTileBounds,
  webMercatorToWgs84,
  wgs84ToWebMercator,
  wgs84ToWebMercatorTile,
  worldToProjected,
} from './geospatial';
export { Heightfield, type HeightfieldCollider, type HeightfieldOptions } from './heightfield';
export {
  createProtomapsTerrainMvtDecoder,
  createTerrainMvtSemanticDecoder,
  type TerrainMvtSemanticDecoderLimits,
  type TerrainMvtSemanticDecoderOptions,
  type TerrainMvtSemanticLayerNames,
  type TerrainMvtSemanticPropertyNames,
} from './mvt-semantic-decoder';
export type {
  TerrainArchiveHeader,
  TerrainArchiveTile,
  TerrainPackageSemanticContent,
  TerrainSemanticTileDecodeContext,
  TerrainSemanticTileDecoder,
  TerrainTileArchive,
} from './package-client';
export type {
  TerrainPackageArchiveSource,
  TerrainPackageAttribution,
  TerrainPackageCoordinateSpace,
  TerrainPackageDescriptor,
  TerrainPackageFileRecord,
  TerrainPackageSemanticProfile,
  TerrainPackageSourceRecord,
} from './package-types';
export { decodePng16, encodePng16, type Gray16 } from './png16';
export {
  clampBounds,
  DEGENERATE_RING_AREA,
  isDegenerateRing,
  normalizeRing,
  pointInPolygon,
  pointInRing,
  polygonArea,
  polygonBounds,
  ringArea,
  ringSignedArea,
  type TerrainSemanticBounds,
} from './polygon';
export {
  assertTerrainPyramidAddress,
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidAddressAt,
  terrainPyramidAncestor,
  terrainPyramidParent,
  terrainPyramidTileCount,
  terrainPyramidTileKey,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from './pyramid-types';
export { registerTerrainSchemas } from './schema';
export {
  assertTerrainSemanticTile,
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainLandcoverFeature,
  type TerrainPoiFeature,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticRing,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  type TerrainWaterFeature,
} from './semantic-types';
export { roadWidth, waterwayWidth } from './semantic-widths';
export {
  heightfieldSubtileFromPng,
  heightfieldTileFromPng,
  type TerrainTileAddress,
  terrainTileKey,
  terrainTileOrigin,
} from './tile';

import type { TerrainDescriptor } from './descriptor-types';
import { Heightfield } from './heightfield';
import { decodePng16 } from './png16';
import { registerTerrainSchemas } from './schema';

// Register the terrain schema on import so tooling can validate descriptors.
registerTerrainSchemas();

/** Build a Heightfield covering the whole terrain from a single decoded heightmap PNG. */
export function heightfieldFromPng(descriptor: TerrainDescriptor, png: Uint8Array): Heightfield {
  const grid = decodePng16(png);
  const worldW = descriptor.chunkSize * descriptor.gridSize[0];
  const worldH = descriptor.chunkSize * descriptor.gridSize[1];
  return new Heightfield(grid.data, grid.width, grid.height, {
    origin: descriptor.origin,
    worldSize: [worldW, worldH],
    height: descriptor.height,
  });
}
