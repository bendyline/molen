import * as THREE from 'three';
import type { TerrainDescriptor } from './descriptor-types';
import type { Heightfield } from './heightfield';
import { buildChunkGeometry, type ChunkMeshOptions, lodStepForDistance } from './mesh';

export {
  createTerrainArchiveSetArchive,
  type TerrainArchiveSetArchive,
  type TerrainArchiveSetArchiveOptions,
} from './archive-set-client';
export {
  createTerrainLandcoverWorkerBridge,
  installTerrainLandcoverWorker,
  type TerrainLandcoverGenerator,
  type TerrainLandcoverWorker,
} from './landcover-worker';

export {
  createTerrainLinearObject,
  joinTerrainLines,
  sampleTerrainLine,
  type TerrainLineBand,
  type TerrainLinePath,
  type TerrainLineProfile,
  type TerrainLineRepeater,
  type TerrainLineSample,
  terrainLinePath,
} from './linear-features';
export type { ChunkGeometry, ChunkMeshOptions } from './mesh';
export { buildChunkGeometry, lodStepForDistance } from './mesh';
export {
  createProtomapsTerrainMvtDecoder,
  createTerrainMvtSemanticDecoder,
  type TerrainMvtSemanticDecoder,
  type TerrainMvtSemanticDecoderLimits,
  type TerrainMvtSemanticDecoderOptions,
  type TerrainMvtSemanticLayerNames,
  type TerrainMvtSemanticPropertyNames,
} from './mvt-semantic-decoder';
export {
  createTerrainPackageCombinedSemanticSource,
  createTerrainPackageHeightSource,
  createTerrainPackagePyramidHeightSource,
  createTerrainPackagePyramidStream,
  createTerrainPackageSemanticSource,
  createTerrainPackageStream,
  type OpenTerrainPackageElevation,
  type OpenTerrainPackageOptions,
  type OpenTerrainPackagePyramid,
  type OpenTerrainPackagePyramidOptions,
  type OpenTerrainPackageSemanticSidecar,
  type OpenTerrainPackageSemantics,
  type OpenTerrainPackageSemanticsOptions,
  openTerrainPackageArchive,
  openTerrainPackageElevation,
  openTerrainPackagePyramid,
  openTerrainPackageSemantics,
  resolveTerrainPackageArchiveUrl,
  type TerrainPackageCombinedSemanticSourceOptions,
  type TerrainPackageHeightSourceOptions,
  type TerrainPackagePyramidHeightSourceOptions,
  type TerrainPackagePyramidStream,
  type TerrainPackagePyramidStreamOptions,
  type TerrainPackageSemanticSource,
  type TerrainPackageSemanticSourceOptions,
  type TerrainPackageStream,
  type TerrainPackageStreamOptions,
  type TerrainParentFallbackEvent,
  terrainDescriptorFromPackage,
  terrainPackageArchiveSourceLocation,
  terrainPyramidDescriptorFromPackage,
} from './package-client';
export {
  type CreateProfiledTerrainPackageSemanticLayersOptions,
  type CreateTerrainPackageSemanticLayersOptions,
  createProfiledTerrainPackageSemanticLayers,
  createTerrainPackageSemanticLayers,
  type TerrainPackageSemanticLayerStyle,
  type TerrainPackageSemanticLayers,
} from './package-semantic-client';
export type {
  TerrainArchiveHeader,
  TerrainArchiveTile,
  TerrainPackageSemanticContent,
  TerrainSemanticTileDecodeContext,
  TerrainSemanticTileDecoder,
  TerrainTileArchive,
} from './package-types';
export {
  createTerrainPyramidStream,
  selectTerrainPyramidTiles,
  type TerrainPyramidBudget,
  type TerrainPyramidHeightSource,
  type TerrainPyramidSelection,
  type TerrainPyramidSelectionOptions,
  type TerrainPyramidStream,
  type TerrainPyramidStreamErrorContext,
  type TerrainPyramidStreamOptions,
  type TerrainPyramidStreamPressure,
  type TerrainPyramidStreamStats,
  type TerrainPyramidTileLayer,
  type TerrainPyramidTileLayerContext,
  type TerrainPyramidView,
  terrainPyramidBudgetForQuality,
} from './pyramid-stream';
export {
  createDefaultTerrainSemanticRenderer,
  createTerrainSemanticObject,
  createTerrainSemanticPyramidLayer,
  createTerrainWaterMaterial,
  createTerrainWaterMaterialAsync,
  type DefaultTerrainSemanticRendererOptions,
  disposeTerrainSemanticObject,
  setTerrainWaterTime,
  type TerrainSemanticMeshMaterials,
  type TerrainSemanticMeshOptions,
  type TerrainSemanticPyramidLayerOptions,
  type TerrainSemanticTileRenderer,
  type TerrainSemanticTileSource,
  type TerrainWaterMaterial,
  type TerrainWaterMaterialOptions,
} from './semantic-client';
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
export { splatColor } from './splat';
export {
  createTerrainStream,
  createUrlTerrainTileSource,
  resolveTerrainTileUrl,
  type TerrainHeightTileSource,
  type TerrainQualityPreset,
  type TerrainStream,
  type TerrainStreamBudget,
  type TerrainStreamErrorContext,
  type TerrainStreamOptions,
  type TerrainStreamStats,
  type TerrainTileLayer,
  type TerrainTileLayerCategory,
  type TerrainTileLayerContext,
  terrainStreamBudgetForQuality,
  type UrlTerrainTileSourceOptions,
} from './stream';
export {
  createTerrainSurfaceObject,
  createTerrainSurfaceRenderer,
  disposeTerrainSurfaceObject,
  type TerrainSurfaceGenerator,
  type TerrainSurfaceRenderer,
  type TerrainSurfaceStats,
} from './surface-client';
export {
  resolveTerrainSurfaceStyle,
  TERRAIN_SURFACE_STYLES,
  type TerrainParkedVehicle,
  type TerrainSurfaceDetails,
  type TerrainSurfaceOptions,
  type TerrainSurfaceStyle,
  type TerrainSurfaceStyleId,
} from './surface-styles';
export {
  createTerrainSurfaceWorkerBridge,
  installTerrainSurfaceWorker,
  type TerrainSurfaceWorker,
} from './surface-worker';
export {
  isTerrainTileTimeout,
  type TerrainTileFailure,
  type TerrainTileLoadState,
  type TerrainTileRetryOptions,
} from './tile-retry';

export interface TerrainObjectOptions {
  /** If given, chunks pick LOD by distance from this world position; else all full-res. */
  cameraPos?: [number, number, number];
}

/** Build a three.js Group of chunk meshes (vertex-colored) for the whole terrain. */
export function createTerrainObject(
  hf: Heightfield,
  descriptor: TerrainDescriptor,
  opts: TerrainObjectOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  group.name = `terrain:${descriptor.name}`;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });

  const [gx, gz] = descriptor.gridSize;
  for (let cz = 0; cz < gz; cz++) {
    for (let cx = 0; cx < gx; cx++) {
      const meshOpts: ChunkMeshOptions = {};
      if (opts.cameraPos !== undefined) {
        const centerX = descriptor.origin[0] + (cx + 0.5) * descriptor.chunkSize;
        const centerZ = descriptor.origin[1] + (cz + 0.5) * descriptor.chunkSize;
        const dx = centerX - opts.cameraPos[0];
        const dz = centerZ - opts.cameraPos[2];
        meshOpts.step = lodStepForDistance(descriptor, Math.sqrt(dx * dx + dz * dz));
      }
      meshOpts.localCoordinates = true;
      const geo = buildChunkGeometry(hf, descriptor, cx, cz, meshOpts);
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
      bg.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3));
      bg.setAttribute('color', new THREE.BufferAttribute(geo.colors, 3));
      bg.setIndex(new THREE.BufferAttribute(geo.indices, 1));
      const mesh = new THREE.Mesh(bg, material);
      mesh.name = `chunk:${cx}_${cz}`;
      mesh.position.set(
        descriptor.origin[0] + cx * descriptor.chunkSize,
        0,
        descriptor.origin[1] + cz * descriptor.chunkSize,
      );
      group.add(mesh);
    }
  }
  return group;
}
export type {
  ElevationStageTiming,
  ElevationWorkerLike,
  ElevationWorkerOptions,
} from './elevation-worker';
export {
  createTerrainElevationWorkerSource,
  installTerrainElevationWorker,
} from './elevation-worker';
