export {
  applyAgricultureGrid,
  decodeAgricultureGrid,
  type TerrainAgricultureGrid,
  type TerrainAgricultureSource,
} from './agriculture-grid';
export {
  createTerrainArchiveSetRouter,
  encodeTerrainArchiveSetCells,
  encodeTerrainArchiveSetPartitions,
  parseTerrainArchiveSetPartitions,
  type TerrainArchiveSetBase,
  type TerrainArchiveSetDescriptor,
  type TerrainArchiveSetEntry,
  type TerrainArchiveSetGeohashTier,
  type TerrainArchiveSetRoute,
  type TerrainArchiveSetRouter,
  type TerrainArchiveSetTileType,
  terrainArchiveSetTierCells,
} from './archive-set';
export {
  TERRAIN_BRIDGE_OUTLINE_MARGIN,
  TERRAIN_BRIDGE_OUTLINE_SHARE,
  terrainBridgeDeckShares,
  withoutTerrainBridgeOutlines,
} from './bridge-outlines';
export { type BridgeDeckOptions, bridgeDeckHeightFn } from './bridge-profile';
export {
  blurTerrainBuildingCoverage,
  sampleTerrainBuildingCoverage,
  TERRAIN_BUILDING_COVERAGE_SIZE,
  TERRAIN_URBAN_GROUND_CLASSES,
  TERRAIN_URBAN_GROUND_COVERAGE,
  type TerrainBuildingCoverage,
  terrainBuildingCoverage,
  terrainUrbanGroundPaved,
} from './building-coverage';
export {
  decodeBuiltUpGrid,
  emptyTerrainBuiltUpCoverage,
  sampleTerrainBuiltUp,
  type TerrainBuiltUpCoverage,
  type TerrainBuiltUpGrid,
  type TerrainBuiltUpSource,
  terrainBuiltUpCoverage,
  terrainBuiltUpCovers,
  withTerrainBuiltUp,
} from './built-up-grid';
export type {
  TerrainDescriptor,
  TerrainLayer,
  TerrainStreamingOptions,
} from './descriptor-types';
export { generateHeightmap, generateHeightmapPng, type HeightmapGenOptions } from './gen';
export {
  encodeGeohash,
  GEOHASH_MAX_PRECISION,
  geohashBounds,
  geohashFromIndex,
  geohashIndex,
  terrainTileGeohash,
} from './geohash';
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
  wgs84ToWorld,
  worldToProjected,
  worldToWgs84,
} from './geospatial';
export {
  type GradeSeparationOptions,
  gradeTransportSeparationSteps,
  gradeTransportSeparations,
  TERRAIN_GRADE_SEPARATION,
  type TerrainGradeFamily,
} from './grade-separation';
export {
  TERRAIN_GROUND_CROWN_FULL,
  TERRAIN_GROUND_CROWNS,
  TERRAIN_GROUND_LATTICE_SIZE,
  type TerrainGroundCrown,
  terrainGroundCell,
  terrainGroundCrown,
  terrainGroundLattice,
} from './ground-crowns';
export { Heightfield, type HeightfieldCollider, type HeightfieldOptions } from './heightfield';
export { gradeHighwayBridges } from './highway-grading';
export { landcoverAppearance, orderLandcover } from './landcover-appearance';
export {
  joinTerrainLines,
  lineSegmentIndex,
  pathBounds,
  sampleTerrainLine,
  type TerrainLinePath,
  type TerrainLineSample,
  terrainLinePath,
} from './line-path';
export {
  createProtomapsTerrainMvtDecoder,
  createTerrainMvtSemanticDecoder,
  type TerrainMvtSemanticDecoderLimits,
  type TerrainMvtSemanticDecoderOptions,
  type TerrainMvtSemanticLayerNames,
  type TerrainMvtSemanticPropertyNames,
} from './mvt-semantic-decoder';
export { terrainPackageFrameLatitude, terrainPackageMetersPerUnit } from './package-frame';
export type {
  TerrainArchiveHeader,
  TerrainArchiveTile,
  TerrainPackageArchiveSource,
  TerrainPackageAttribution,
  TerrainPackageCoordinateSpace,
  TerrainPackageDescriptor,
  TerrainPackageFileRecord,
  TerrainPackageFrame,
  TerrainPackageSemanticContent,
  TerrainPackageSemanticProfile,
  TerrainPackageSourceRecord,
  TerrainSemanticTileDecodeContext,
  TerrainSemanticTileDecoder,
  TerrainTileArchive,
} from './package-types';
export {
  buildPmtilesDirectories,
  createPmtilesPrefix,
  PMTILES_HEADER_BYTES,
  type PmtilesArchiveOptions,
  type PmtilesDirectories,
  type PmtilesDirectoryEntry,
  type PmtilesPrefixOptions,
  type PmtilesTileCompression,
  type PmtilesTileRecord,
  type PmtilesTileType,
  type PmtilesWriterTile,
  pmtilesTileId,
  serializePmtilesDirectory,
  writePmtilesArchive,
} from './pmtiles-writer';
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
export { placeTerrainYardCars, type TerrainYardCarInput } from './rail-cars';
export {
  TERRAIN_RAIL_HEIGHT,
  type TerrainRailElectrification,
  type TerrainRailMode,
  type TerrainRailService,
  type TerrainRailTrack,
  terrainRailElectrified,
  terrainRailOffset,
  terrainRailTrack,
} from './rail-features';
export { type RenderedGroundSource, renderedGroundSampler } from './rendered-ground';
export {
  beginRoadEarthworks,
  clipRoadLine,
  gradeRoadEarthworks,
  isRoadEarthworkGraded,
  ROAD_PROFILE_WINDOW,
  type RoadEarthworkLine,
  type RoadEarthworkOptions,
  type RoadEarthworkPass,
  roadEarthworkLines,
  roadProfileHeight,
} from './road-earthworks';
export { registerTerrainSchemas } from './schema';
export {
  composeTerrainBuildingDetail,
  createBuildingDetailTerrainSemanticSource,
  type TerrainBuildingDetailChild,
  type TerrainBuildingDetailOptions,
} from './semantic-building-detail';
export {
  createOverzoomTerrainSemanticSource,
  overzoomTerrainSemanticTile,
  type TerrainSemanticOverzoomOptions,
  type TerrainSemanticTileLoader,
} from './semantic-overzoom';
export {
  createRoadDetailTerrainSemanticSource,
  type TerrainRoadDetailOptions,
} from './semantic-road-detail';
export {
  assertTerrainSemanticTile,
  createEmptyTerrainSemanticTile,
  type TerrainAgricultureObservation,
  type TerrainBridgeProfileSample,
  type TerrainBuildingFeature,
  type TerrainCultivation,
  type TerrainLandcoverFeature,
  type TerrainPlaceFeature,
  type TerrainPoiFeature,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticRing,
  type TerrainSemanticTile,
  type TerrainStructureIdentity,
  type TerrainTransportationFeature,
  type TerrainWaterFeature,
} from './semantic-types';
export { carriagewayWidth, roadWidth, waterwayWidth } from './semantic-widths';
export {
  heightfieldSubtileFromPng,
  heightfieldTileFromPng,
  type TerrainTileAddress,
  terrainTileKey,
  terrainTileOrigin,
} from './tile';
export {
  BRIDGE_SURFACE_LIFT,
  groupTransportationFeatures,
  inferLaneCount,
  isAeroway,
  isArterialRoad,
  isPaintedTransport,
  isTransportLink,
  PATH_SURFACE_LIFT,
  ROAD_SURFACE_LIFT,
  type TransportKind,
  transportKind,
  transportSurfaceLift,
  transportWidth,
} from './transport-features';
export {
  findTerrainTunnelPortals,
  isInferredTerrainTunnel,
  TERRAIN_TUNNEL_COVER,
  TERRAIN_TUNNEL_CUTTING_REACH,
  TERRAIN_TUNNEL_GRADE,
  TERRAIN_TUNNEL_INWARD_REACH,
  TERRAIN_TUNNEL_PORTAL_ZONE,
  type TerrainTunnelBoreProfile,
  type TerrainTunnelCutting,
  type TerrainTunnelFamily,
  type TerrainTunnelPortalSeed,
  type TerrainTunnelPortalSource,
  type TerrainTunnelWay,
  terrainTunnelBoreProfile,
  terrainTunnelClearance,
  terrainTunnelCutting,
  terrainTunnelCuttingDepths,
  terrainTunnelCuttingLines,
  terrainTunnelFamily,
  terrainTunnelWays,
} from './tunnel-portals';
export { TERRAIN_UNDERPASS_REACH, withTerrainUnderpasses } from './underpasses';

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

export {
  DEFAULT_ROAD_SIGN_PROFILE,
  type TerrainRoadSignCatalog,
  type TerrainRoadSignProfile,
  terrainRoadSignCatalogSchema,
  terrainRoadSignProfileSchema,
  terrainRoadSignProfilesSchema,
} from './road-sign-styles';
export {
  resolveTerrainRouteMarker,
  type TerrainRouteMarker,
  type TerrainRouteShieldLibrary,
  terrainRouteShieldLibrarySchema,
} from './route-shields';
export {
  deriveOverzoomTerrainSemanticTilePacket,
  deriveTerrainSemanticTileContentHash,
  deriveTerrainSemanticTilePacket,
  keepTerrainSemanticTile,
  packTerrainSemanticTile,
  type TerrainSemanticTileEdit,
  type TerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
  unpackTerrainSemanticTile,
} from './semantic-packet';
