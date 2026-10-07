/**
 * Terrain tile renderers that put the worldgen core behind the terrain streamer. Roads and the
 * land surface stay with the default terrain adapter; buildings, roof props, and scatter come
 * from a `WorldgenGenerator` (in-thread by default, a worker bridge when given, either one
 * optionally fronted by a tile cache).
 */

import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import {
  createTerrainSemanticObject,
  disposeTerrainSemanticObject,
  setTerrainGroundCutout,
  type TerrainLandcoverGenerator,
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticMeshOptions,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  type TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import {
  pointInPolygon,
  polygonBounds,
  wgs84ToWorld,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import {
  buffersToObject3D,
  buildingBoxGeometry,
  createBuildingCellLod,
  createBuildingDetailLod,
  createInstancedPlacementLod,
  createInstancedPlacements,
  createVertexColorMaterialSet,
  disposeWorldgenObject,
  InteriorStreamer,
  type InteriorStreamingOptions,
  type InteriorStreamingStats,
  type ModelLibrary,
  type ScreenSpaceLodPolicy,
  type StructureModelSource,
  TEXTURED_SURFACE_MEAN,
  type WorldgenMaterialSet,
} from '@bendyline/molen-worldgen/client';
import type {
  PlacementSet,
  ResolvedStylePack,
  WorldgenBudgets,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import type { PlacesContent } from '../kernel/places';
import type { RegionResolver } from '../kernel/region';
import type { RegionAtlasDoc } from '../kernel/region-atlas-types';
import type { TileGeometry } from '../kernel/semantic-adapter';
import { isStructureViewingDate } from '../kernel/structure-date';
import type { StructureIndex, StructurePlacement } from '../kernel/structure-index';
import { matchMapStructures, orientMappedStructure } from '../kernel/structure-matching';
import {
  type WorldgenQualityPreset,
  worldgenBuildingCellSize,
  worldgenTileBudgetForQuality,
} from '../kernel/tile-budgets';
import type { WorldgenTileOutput } from '../kernel/tile-generate';
import { type WorldgenTileCache, worldgenTileCacheKey } from './cache';
import { createInThreadWorldgenGenerator, withWorldgenTileCache } from './generators';
import { resolveStructureElevation, type StructureTerrainSampler } from './structure-elevation';
import {
  clipStructureObject,
  footprintCovers,
  footprintOverlapsTile,
  type StructureFootprint,
  structureFootprint,
  withoutStructureRoads,
} from './structure-geometry';
import type { WorldgenGenerator } from './worker-bridge';

/**
 * A generalized footprint under a landmark's anchor is the landmark's own when neither side
 * exceeds the landmark's placed extent by more than this ratio plus slack (world units): room
 * for a source outline a little wider than the model, never a merged city block.
 */
const FOOTPRINT_SIZE_RATIO = 1.6;
const FOOTPRINT_SLACK = 12;

export interface WorldgenRendererOptions {
  atlas?: RegionAtlasDoc;
  regions?: RegionResolver;
  /**
   * Landmarks and business identities for mapped places; without them businesses are not
   * recognized and street furniture is not placed. With a worker `generator`, pass the worker the
   * same content; tile cache keys include its hashes.
   */
  places?: PlacesContent;
  /** Authored geographic structures, indexed by geohash for tile lookup. */
  structures?: StructureIndex;
  /** Explicit YYYY-MM-DD date for archival landmarks; omitted keeps them unloaded. */
  viewingDate?: string;
  /** Fine or cross-tile ground samples; undefined coverage leaves the procedural fallback. */
  sampleStructureTerrain?: StructureTerrainSampler;
  materials?: WorldgenMaterialSet;
  /** Prepared prop models; without it the classification layer keeps the default tree cones. */
  models?: ModelLibrary;
  /** Streamed geographic models; defaults to `models` when no separate library is supplied. */
  structureModels?: ModelLibrary;
  /** Full glTF hierarchy and PBR materials for authored structures; preferred over flattened props. */
  structureObjects?: StructureModelSource;
  quality?: WorldgenQualityPreset;
  budgets?: Partial<WorldgenBudgets>;
  /** cos(center latitude) factor of the terrain package (1 for local packages). */
  metersPerUnit?: number;
  /** Shared surface styles/controller for roads, parking areas, markings and fixtures. */
  roads?: TerrainSemanticMeshOptions;
  /** Options forwarded to the default land surface (colors default to the scatter surface colors). */
  landcover?: TerrainSemanticMeshOptions;
  /** Optional worker-backed land-cover surface draping. Caller owns its lifetime. */
  landcoverGenerator?: TerrainLandcoverGenerator;
  /** Camera-distance vegetation LOD and spatial culling (default true). */
  propLod?: boolean;
  /**
   * Real openings and bounded lazy interiors, including residential upstairs (opt in). They are
   * laid out by the style pack's interior catalog; a pack without one generates no interiors.
   */
  interiors?: boolean | Omit<InteriorStreamingOptions, 'catalog'>;
  /** Shared screen-space policy for resident building and vegetation LODs. */
  lodPolicy?: ScreenSpaceLodPolicy;
  /** Buildings generated between cooperative yields (default 48, in-thread only). */
  yieldEveryBuildings?: number;
  /** Where tiles are generated (default: on this thread); e.g. `createWorldgenWorkerBridge`. */
  generator?: WorldgenGenerator;
  /** CPU-side cache of generated tiles keyed by pack, atlas, quality, and address. */
  cache?: WorldgenTileCache;
  /**
   * Prepare replacement architecture before a resident quality change becomes visible. `parent`
   * is the layer object the replacement will join.
   */
  prepareObject?: (
    object: THREE.Object3D,
    signal: AbortSignal,
    parent?: THREE.Object3D,
  ) => Promise<void>;
  onTileStats?: (output: WorldgenTileOutput, generateMs: number) => void;
}

export interface WorldgenRenderStats {
  tiles: number;
  buildings: number;
  boxes: number;
  props: number;
  skippedByOwnership: number;
  geometryBytes: number;
  generateMs: { last: number; mean: number; max: number };
  cache?: { hits: number; misses: number; size: number; bytes: number };
  interiors?: InteriorStreamingStats;
}

export interface WorldgenSemanticRenderers {
  classification: TerrainSemanticTileRenderer;
  humanFeatures: TerrainSemanticTileRenderer;
  stats(): WorldgenRenderStats;
  /** Rebuild resident architecture cooperatively, keeping the previous geometry until ready. */
  setQuality(quality: WorldgenQualityPreset): void;
  setCacheBudget(maxBytes: number): void;
  /** Call before walking collision with the camera in metric world coordinates. */
  updateInteriors(position: readonly [number, number, number]): void;
  dispose(): void;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function geometryFor(context: TerrainPyramidTileLayerContext, metersPerUnit: number): TileGeometry {
  return {
    level: context.address.level,
    x: context.address.x,
    z: context.address.z,
    originX: context.origin[0],
    originZ: context.origin[1],
    size: context.tileSize,
    metersPerUnit,
    levelBelowMax: Math.max(0, context.pyramid.maxLevel - context.address.level),
  };
}

function surfaceColors(
  pack: ResolvedStylePack,
  scatterId: string | undefined,
): Record<string, string> | undefined {
  const doc = scatterId !== undefined ? pack.scatters[scatterId] : undefined;
  return doc?.surface.colors;
}

/** Renderers for the classification and human-feature layers of a terrain package. */
export function createWorldgenSemanticRenderers(
  pack: ResolvedStylePack,
  options: WorldgenRendererOptions = {},
): WorldgenSemanticRenderers {
  const viewingDate = options.viewingDate;
  if (viewingDate !== undefined && !isStructureViewingDate(viewingDate))
    throw new Error('viewingDate must be a valid YYYY-MM-DD calendar date');
  const materials = options.materials ?? createVertexColorMaterialSet();
  const ownsMaterials = options.materials === undefined;
  const metersPerUnit = options.metersPerUnit ?? 1;
  const interiors =
    options.interiors && pack.interiors !== undefined
      ? new InteriorStreamer({
          ...(typeof options.interiors === 'object' ? options.interiors : {}),
          catalog: pack.interiors,
        })
      : undefined;
  let quality = options.quality ?? 'balanced';
  interface ResidentBuildings {
    tile: TerrainSemanticTile;
    context: TerrainPyramidTileLayerContext;
    architecture: THREE.Group;
    quality: WorldgenQualityPreset;
    /** A neighbour's landmark footprints changed since this tile's buildings were generated. */
    stale?: boolean;
    pending?: AbortController;
  }
  const residents = new Map<THREE.Object3D, ResidentBuildings>();
  // Ground footprints of the `replaceFootprint` landmarks each resident tile placed, in world
  // X/Z. A stadium anchored near a tile edge stands on its neighbours' mapped parts too.
  const sharedFootprints = new Map<THREE.Object3D, readonly StructureFootprint[]>();
  const disposedHumanTiles = new WeakSet<THREE.Object3D>();
  let rebuilding = false;
  let disposed = false;
  // Distant levels stand in for textured buildings, so they carry the textures' mean brightness.
  const flatMaterials = options.lodPolicy
    ? createVertexColorMaterialSet({ surfaceMean: TEXTURED_SURFACE_MEAN })
    : undefined;
  const models = options.models;
  const structureModels = options.structureModels ?? models;
  const structureObjects = options.structureObjects;
  const warnedModels = new Set<string>();
  const stats: WorldgenRenderStats = {
    tiles: 0,
    buildings: 0,
    boxes: 0,
    props: 0,
    skippedByOwnership: 0,
    geometryBytes: 0,
    generateMs: { last: 0, mean: 0, max: 0 },
  };
  let totalMs = 0;
  const defaultScatterId = options.atlas?.default.scatter ?? pack.root.defaults.scatter;

  const base: WorldgenGenerator =
    options.generator ??
    createInThreadWorldgenGenerator(pack, {
      ...(options.atlas !== undefined ? { atlas: options.atlas } : {}),
      ...(options.regions !== undefined ? { regions: options.regions } : {}),
      ...(options.places !== undefined ? { places: options.places } : {}),
      ...(options.yieldEveryBuildings !== undefined
        ? { yieldEveryBuildings: options.yieldEveryBuildings }
        : {}),
    });
  const ownsGenerator = options.generator === undefined;
  const places = options.places;
  const cache = options.cache;
  const atlasHash =
    options.atlas !== undefined ? hashJson(options.atlas as unknown as JsonValue) : undefined;
  const generator =
    cache !== undefined
      ? withWorldgenTileCache(base, cache, (request) =>
          worldgenTileCacheKey({
            packHash: pack.hash,
            ...(atlasHash !== undefined ? { atlasHash } : {}),
            quality,
            variant: hashJson({
              budgets: request.budgets ?? {},
              tierOffset: request.tierOffset ?? 0,
              interiors: request.features?.interiors ?? false,
              renderCellsOnly: request.renderCellsOnly ?? false,
              identities: places?.businesses.hash ?? null,
              models: places?.landmarks.hash ?? null,
              semantics: request.tile,
              geometry: request.geom,
            } as unknown as JsonValue),
            level: request.geom.level,
            x: request.geom.x,
            z: request.geom.z,
            features: {
              buildings: request.features?.buildings === true,
              scatter: request.features?.scatter === true,
            },
          }),
        )
      : base;

  async function generate(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    features: { buildings: boolean; scatter: boolean },
    preset = quality,
  ): Promise<{ output: WorldgenTileOutput; generateMs: number } | undefined> {
    const geom = geometryFor(context, metersPerUnit);
    const started = now();
    const output = await generator.generate(
      {
        tile,
        geom,
        ground: context.heightfield,
        resolution: context.pyramid.tileResolution,
        renderCellsOnly: options.lodPolicy !== undefined,
        budgets: {
          ...worldgenTileBudgetForQuality(preset, geom.levelBelowMax),
          ...options.budgets,
        },
        features: { ...features, interiors: interiors !== undefined && features.buildings },
        tierOffset: preset === 'economy' ? 1 : 0,
      },
      context.signal,
    );
    if (output === undefined || context.signal.aborted) return undefined;
    const generateMs = now() - started;
    totalMs += generateMs;
    stats.tiles++;
    stats.generateMs = {
      last: generateMs,
      mean: totalMs / stats.tiles,
      max: Math.max(stats.generateMs.max, generateMs),
    };
    options.onTileStats?.(output, generateMs);
    return { output, generateMs };
  }

  async function instancedProps(
    sets: readonly PlacementSet[],
    context: TerrainPyramidTileLayerContext,
    name: string,
  ): Promise<THREE.Object3D[]> {
    if (models === undefined) return [];
    const objects: THREE.Object3D[] = [];
    for (const set of sets) {
      if (buildingBoxGeometry(set.modelRef) !== undefined || set.count === 0) continue;
      try {
        const coarse = context.address.level < context.pyramid.maxLevel;
        const prepared = await models.prepare(set.modelRef, coarse);
        if (context.signal.aborted) return objects;
        const medium =
          options.propLod !== false ? await models.prepare(set.modelRef, true) : prepared;
        const distant =
          options.propLod !== false ? await models.prepare(set.modelRef, 'distant') : prepared;
        if (context.signal.aborted) return objects;
        objects.push(
          options.propLod !== false
            ? createInstancedPlacementLod(
                set,
                [prepared, medium, distant],
                {
                  // Coarse terrain spans much more ground. Keep a bounded number of spatial
                  // batches per tile instead of compiling thousands of tiny distant cells.
                  cellSize:
                    512 *
                    2 ** Math.min(4, Math.max(0, context.pyramid.maxLevel - context.address.level)),
                  ...(options.lodPolicy ? { screenSpace: options.lodPolicy } : {}),
                },
                `${name}:${set.setId}`,
              )
            : createInstancedPlacements(
                set,
                prepared.geometry,
                prepared.material,
                `${name}:${set.setId}`,
              ),
        );
        stats.props += set.count;
        stats.geometryBytes += set.data.byteLength;
      } catch (error) {
        if (!warnedModels.has(set.modelRef)) {
          warnedModels.add(set.modelRef);
          console.warn(`[molen] worldgen model "${set.modelRef}": ${(error as Error).message}`);
        }
      }
    }
    return objects;
  }

  async function assembleBuildings(
    output: WorldgenTileOutput,
    context: TerrainPyramidTileLayerContext,
    name: string,
  ): Promise<THREE.Group> {
    const group = new THREE.Group();
    group.name = `${name}:architecture`;
    if (output.buildingCells && options.lodPolicy && flatMaterials) {
      const policy = options.lodPolicy;
      try {
        const assembly: Promise<void>[] = [];
        for (const cell of output.buildingCells) {
          const create = (): THREE.Object3D =>
            createBuildingCellLod(
              cell,
              materials,
              flatMaterials.materialFor('wall', 'palette:#ffffff'),
              policy,
              `${name}:buildings`,
            );
          if (context.admission) {
            // Queue independent cells together. Awaiting each admission separately imposes
            // one animation frame per cell even when the frame still has ample work budget.
            assembly.push(
              context.admission.run(
                () => {
                  group.add(create());
                },
                {
                  signal: context.signal,
                  label: 'building-assembly',
                  bytes:
                    cell.positions.byteLength +
                    cell.normals.byteLength +
                    cell.colors.byteLength +
                    cell.uvs.byteLength +
                    cell.indices.byteLength +
                    cell.structuralIndices.byteLength,
                },
              ),
            );
          } else group.add(create());
        }
        // Drain cancelled/failed jobs before disposing the group so no late cell can leak.
        const results = await Promise.allSettled(assembly);
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
      } catch (error) {
        disposeWorldgenObject(group);
        throw error;
      }
    } else if (output.buildings !== undefined)
      group.add(
        options.lodPolicy && flatMaterials
          ? createBuildingDetailLod(
              output.buildings,
              materials,
              flatMaterials.materialFor('wall', 'palette:#ffffff'),
              options.lodPolicy,
              `${name}:buildings`,
              worldgenBuildingCellSize(
                Math.max(0, context.pyramid.maxLevel - context.address.level),
              ),
              output.buildingCells,
            )
          : buffersToObject3D(output.buildings, materials, `${name}:buildings`),
      );
    for (const set of output.placements) {
      const geometry = buildingBoxGeometry(set.modelRef);
      if (geometry === undefined) continue;
      group.add(
        createInstancedPlacements(
          set,
          geometry,
          (flatMaterials ?? materials).materialFor('wall', 'palette:#ffffff'),
          `${name}:${set.modelRef === 'builtin:box' ? 'boxes' : 'gable-boxes'}`,
        ),
      );
    }
    for (const object of await instancedProps(output.placements, context, name)) group.add(object);
    return group;
  }

  function structuresForTile(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): StructurePlacement[] {
    if (options.structures === undefined) return [];
    const [west, north] = worldToWgs84(metersPerUnit, context.origin[0], context.origin[1]);
    const [east, south] = worldToWgs84(
      metersPerUnit,
      context.origin[0] + context.tileSize,
      context.origin[1] + context.tileSize,
    );
    const geometry = geometryFor(context, metersPerUnit);
    const geographic = options.structures
      .query([west, south, east, north], viewingDate === undefined ? false : { viewingDate })
      .flatMap((entry) => {
        const resolved = orientMappedStructure(entry, tile, geometry);
        return resolved ? [resolved] : [];
      })
      .filter((entry) => {
        if (context.address.level < (entry.minLevel ?? 11)) return false;
        if (entry.bounds) return true;
        const [x, z] = wgs84ToWorld(metersPerUnit, entry.anchor[0], entry.anchor[1]);
        return (
          x >= context.origin[0] &&
          x < context.origin[0] + context.tileSize &&
          z >= context.origin[1] &&
          z < context.origin[1] + context.tileSize
        );
      });
    return [
      ...geographic,
      ...matchMapStructures(tile, geometry, options.structures.rules, geographic),
    ];
  }

  /**
   * The structures `group` holds a loaded model for, with each model's world X/Z extent and, for
   * a `replaceFootprint` model, its ground footprint.
   */
  function placedStructures(
    group: THREE.Object3D,
    context: TerrainPyramidTileLayerContext,
    structures: readonly StructurePlacement[],
  ) {
    return structures.flatMap((entry) => {
      const object = group.getObjectByName(`structure:${entry.id}`);
      if (object === undefined) return [];
      const extent =
        (object.userData.structureExtent as THREE.Vector3 | undefined) ??
        new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
      const footprint = entry.replaceFootprint
        ? structureFootprint(object, group, context.origin)
        : undefined;
      return [
        {
          entry,
          size: [extent.x, extent.z] as const,
          ...(footprint !== undefined ? { footprint } : {}),
        },
      ];
    });
  }

  /**
   * Drop the building footprints that loaded landmarks stand in for: those containing a
   * `replaceFootprint` anchor. Generalized sources merge neighboring footprints at low zoom, so
   * there a footprint goes only when it is about the landmark's own size (`size`, its placed
   * world-space X/Z extent); a larger one is a merged block of other buildings and stays. A
   * ring footprint (a stadium bowl, a cloister) holds the anchor in its hole; it goes under the
   * same size test, so a large courtyard block around a smaller landmark stays. In exact data a
   * landmark's own off-centre parts (an observation level, its legs, a grandstand, a parked
   * roof) contain no anchor, so a polygon lying wholly inside the placed model's extent goes
   * too, as does one at least half covered by the model's own footprint (`footprint`) or by a
   * landmark a neighbouring tile placed (`nearby`).
   */
  function withoutReplacedFootprints(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    placed: ReadonlyArray<{
      entry: StructurePlacement;
      size: readonly [number, number];
      footprint?: StructureFootprint;
    }>,
    nearby: readonly StructureFootprint[] = [],
  ): TerrainSemanticTile {
    const anchors = placed
      .filter(({ entry }) => entry.replaceFootprint)
      .map(({ entry, size, footprint }) => {
        const [x, z] = wgs84ToWorld(metersPerUnit, entry.anchor[0], entry.anchor[1]);
        const point: [number, number] = [
          (x - context.origin[0]) / context.tileSize,
          (z - context.origin[1]) / context.tileSize,
        ];
        return { point, size, footprint };
      });
    const remote = tile.buildingsGeneralized ? [] : nearby;
    if (anchors.length === 0 && remote.length === 0) return tile;
    const replaces = (polygon: TerrainSemanticPolygon): boolean =>
      remote.some((footprint) => footprintCovers(footprint, polygon, context)) ||
      anchors.some(({ point, size, footprint }) => {
        if (!tile.buildingsGeneralized) {
          if (footprint !== undefined && footprintCovers(footprint, polygon, context)) return true;
          const [minU, minV, maxU, maxV] = polygonBounds(polygon);
          const halfU = (size[0] / 2 + FOOTPRINT_SLACK / 4) / context.tileSize;
          const halfV = (size[1] / 2 + FOOTPRINT_SLACK / 4) / context.tileSize;
          if (
            minU >= point[0] - halfU &&
            maxU <= point[0] + halfU &&
            minV >= point[1] - halfV &&
            maxV <= point[1] + halfV
          )
            return true;
        }
        const inCourtyard =
          !pointInPolygon(point, polygon) &&
          polygon.holes !== undefined &&
          pointInPolygon(point, { outer: polygon.outer });
        if (!inCourtyard && !pointInPolygon(point, polygon)) return false;
        if (!tile.buildingsGeneralized && !inCourtyard) return true;
        const [minU, minV, maxU, maxV] = polygonBounds(polygon);
        return (
          (maxU - minU) * context.tileSize <= size[0] * FOOTPRINT_SIZE_RATIO + FOOTPRINT_SLACK &&
          (maxV - minV) * context.tileSize <= size[1] * FOOTPRINT_SIZE_RATIO + FOOTPRINT_SLACK
        );
      });
    const buildings = tile.buildings.filter((feature) => !feature.polygons.some(replaces));
    return buildings.length === tile.buildings.length ? tile : { ...tile, buildings };
  }

  async function placeStructures(
    group: THREE.Group,
    context: TerrainPyramidTileLayerContext,
    structures: readonly StructurePlacement[],
  ): Promise<void> {
    if (structureModels === undefined && structureObjects === undefined) return;
    for (const entry of structures) {
      if (context.signal.aborted || disposed) return;
      let held = false;
      try {
        const elevation = await resolveStructureElevation(
          entry,
          context,
          metersPerUnit,
          options.sampleStructureTerrain,
        );
        if (elevation === undefined || context.signal.aborted || disposed) continue;
        const [x, z] = wgs84ToWorld(metersPerUnit, entry.anchor[0], entry.anchor[1]);
        const position: [number, number, number] = [x, elevation, z];
        const prepare = (instance: THREE.Object3D): THREE.Object3D => {
          const mesh = new THREE.Group();
          mesh.add(instance);
          mesh.name = `structure:${entry.id}`;
          mesh.position.set(x - context.origin[0], elevation, z - context.origin[1]);
          mesh.rotation.y = entry.heading ?? 0;
          if (entry.scale !== undefined) mesh.scale.set(...entry.scale);
          const placed = entry.bounds ? clipStructureObject(mesh, context.tileSize) : mesh;
          if (entry.groundCutout) {
            if (entry.bounds) {
              mesh.updateMatrix();
              setTerrainGroundCutout(
                placed,
                entry.groundCutout.outline.map(([px, pz]) => {
                  const p = new THREE.Vector3(px, 0, pz).applyMatrix4(mesh.matrix);
                  return [p.x, p.z];
                }),
              );
            } else setTerrainGroundCutout(placed, entry.groundCutout.outline);
          }
          placed.traverse((part) => {
            part.castShadow = true;
            part.receiveShadow = true;
          });
          return placed;
        };
        let object: THREE.Object3D;
        if (structureObjects) {
          const prepared = await structureObjects.acquire(entry.asset, {
            position,
            signal: context.signal,
          });
          held = true;
          object = structureObjects.instantiate(prepared, {
            prepare,
            position,
            scale: Math.max(...(entry.scale ?? [1, 1, 1])),
          });
          const placement = new THREE.Matrix4().compose(
            new THREE.Vector3(),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.heading ?? 0),
            new THREE.Vector3(...(entry.scale ?? [1, 1, 1])),
          );
          object.userData.structureExtent = prepared.bounds
            .clone()
            .applyMatrix4(placement)
            .getSize(new THREE.Vector3());
        } else if (structureModels) {
          const prepared = await structureModels.acquire(entry.asset);
          held = true;
          object = prepare(new THREE.Mesh(prepared.geometry, prepared.material));
        } else continue;
        if (context.signal.aborted || disposed) {
          disposeTerrainSemanticObject(object);
          disposeWorldgenObject(object);
          (structureObjects ?? structureModels)?.release(entry.asset);
          return;
        }
        let hasGeometry = false;
        object.traverse((part) => {
          hasGeometry ||= (part as THREE.Mesh).isMesh === true;
        });
        if (entry.bounds && !hasGeometry) {
          disposeTerrainSemanticObject(object);
          disposeWorldgenObject(object);
          (structureObjects ?? structureModels)?.release(entry.asset);
          held = false;
          continue;
        }
        object.name = `structure:${entry.id}`;
        object.userData.structureElevation = elevation;
        object.traverse((part) => {
          part.castShadow = true;
          part.receiveShadow = true;
        });
        group.add(object);
        let refs = group.userData.structureModelRefs as string[] | undefined;
        if (refs === undefined) {
          refs = [];
          group.userData.structureModelRefs = refs;
        }
        refs.push(entry.asset);
        held = false;
      } catch (error) {
        if (held) (structureObjects ?? structureModels)?.release(entry.asset);
        if (!warnedModels.has(entry.asset)) {
          warnedModels.add(entry.asset);
          console.warn(`[molen] structure "${entry.id}": ${(error as Error).message}`);
        }
      }
    }
  }

  function releaseStructureModels(root: THREE.Object3D): void {
    root.traverse((object) => {
      const refs = object.userData.structureModelRefs as string[] | undefined;
      if (refs === undefined) return;
      for (const ref of refs) (structureObjects ?? structureModels)?.release(ref);
      delete object.userData.structureModelRefs;
    });
  }

  /** The footprints other resident tiles' landmarks extend into the tile at `context`. */
  function nearbyFootprints(
    root: THREE.Object3D,
    context: TerrainPyramidTileLayerContext,
  ): StructureFootprint[] {
    return [...sharedFootprints].flatMap(([owner, footprints]) =>
      owner === root
        ? []
        : footprints.filter((footprint) => footprintOverlapsTile(footprint, context)),
    );
  }

  /** Regenerate the resident buildings `footprints` reach, other than `owner`'s own. */
  function restaleNeighbours(
    owner: THREE.Object3D,
    footprints: readonly StructureFootprint[],
  ): void {
    if (disposed) return;
    let marked = false;
    for (const [root, resident] of residents) {
      if (root === owner || resident.tile.buildingsGeneralized) continue;
      if (!footprints.some((footprint) => footprintOverlapsTile(footprint, resident.context)))
        continue;
      resident.stale = true;
      marked = true;
    }
    if (marked) void rebuildResidents();
  }

  /**
   * Publish the footprints `root`'s landmarks cover. Extended (`bounds`) models are clipped and
   * placed in every tile they reach, so only anchored models are shared.
   */
  function shareFootprints(
    root: THREE.Object3D,
    placed: ReadonlyArray<{ entry: StructurePlacement; footprint?: StructureFootprint }>,
  ): void {
    const footprints = placed.flatMap(({ entry, footprint }) =>
      footprint !== undefined && !entry.bounds ? [footprint] : [],
    );
    const known = sharedFootprints.has(root);
    if (footprints.length === 0) {
      if (known) unshareFootprints(root);
      return;
    }
    sharedFootprints.set(root, footprints);
    // A quality rebuild of the same tile re-places the same landmarks; neighbours already know.
    if (!known) restaleNeighbours(root, footprints);
  }

  function unshareFootprints(root: THREE.Object3D): void {
    const footprints = sharedFootprints.get(root);
    if (footprints === undefined) return;
    sharedFootprints.delete(root);
    restaleNeighbours(root, footprints);
  }

  function disposeHumanTile(root: THREE.Object3D): void {
    if (disposedHumanTiles.has(root)) return;
    disposedHumanTiles.add(root);
    const resident = residents.get(root);
    if (resident) {
      resident.pending?.abort();
      interiors?.unregister(resident.architecture);
      residents.delete(root);
    }
    // Neighbours get their mapped buildings back once the landmark standing on them is gone.
    unshareFootprints(root);
    root.removeFromParent();
    releaseStructureModels(root);
    disposeTerrainSemanticObject(root);
    disposeWorldgenObject(root);
  }

  function registerInteriors(
    root: THREE.Object3D,
    output: WorldgenTileOutput,
    context: TerrainPyramidTileLayerContext,
  ): void {
    interiors?.register(
      root,
      output.records.flatMap((r) => (r.interior ? [r.interior] : [])),
      [context.origin[0], context.origin[1]],
    );
  }

  // One replacement at a time bounds extra memory and worker pressure. Quality changes and
  // tile eviction cancel pending work; the displayed architecture survives until the swap.
  async function rebuildResidents(): Promise<void> {
    if (rebuilding) return;
    rebuilding = true;
    try {
      for (;;) {
        const entry = [...residents].find(
          ([, resident]) => resident.quality !== quality || resident.stale,
        );
        if (!entry) break;
        const [root, resident] = entry;
        // Cleared first: a neighbour change during this rebuild queues another one.
        resident.stale = false;
        const preset = quality;
        const controller = new AbortController();
        resident.pending = controller;
        const context = { ...resident.context, signal: controller.signal };
        let replacement: THREE.Group | undefined;
        try {
          replacement = new THREE.Group();
          replacement.name = `${root.name}:architecture`;
          const structures = structuresForTile(resident.tile, context);
          if (structures.length) await placeStructures(replacement, context, structures);
          const placed = placedStructures(replacement, context, structures);
          const mappedTile = withoutReplacedFootprints(
            resident.tile,
            context,
            placed,
            nearbyFootprints(root, context),
          );
          const generated = await generate(
            mappedTile,
            context,
            { buildings: true, scatter: false },
            preset,
          );
          if (!generated) {
            if (!controller.signal.aborted) resident.quality = preset;
            continue;
          }
          if (controller.signal.aborted) continue;
          replacement.add(await assembleBuildings(generated.output, context, root.name));
          if (controller.signal.aborted || !residents.has(root) || preset !== quality) continue;
          await options.prepareObject?.(replacement, controller.signal, root);
          const publish = (): void => {
            if (
              controller.signal.aborted ||
              !residents.has(root) ||
              preset !== quality ||
              !replacement
            )
              return;
            interiors?.unregister(resident.architecture);
            releaseStructureModels(resident.architecture);
            disposeTerrainSemanticObject(resident.architecture);
            disposeWorldgenObject(resident.architecture);
            resident.architecture.removeFromParent();
            // Buildings are static: like the tile's first publication, stop per-frame transform
            // recomposition, which would dirty every building's world matrix each frame.
            replacement.traverse((object) => {
              if (!object.matrixAutoUpdate) return;
              object.updateMatrix();
              object.matrixAutoUpdate = false;
            });
            root.add(replacement);
            resident.architecture = replacement;
            resident.quality = preset;
            registerInteriors(replacement, generated.output, context);
            shareFootprints(root, placed);
            replacement = undefined;
          };
          if (context.admission)
            await context.admission.run(publish, {
              signal: controller.signal,
              label: 'building-quality-publication',
            });
          else publish();
        } catch (error) {
          if (!controller.signal.aborted) {
            resident.quality = preset; // retry on the next preset change, not every frame
            console.warn('[molen] building quality update failed:', error);
          }
        } finally {
          if (replacement) {
            releaseStructureModels(replacement);
            disposeTerrainSemanticObject(replacement);
            disposeWorldgenObject(replacement);
          }
          delete resident.pending;
        }
      }
    } finally {
      rebuilding = false;
    }
  }

  const humanFeatures: TerrainSemanticTileRenderer = {
    async createTile(tile: TerrainSemanticTile, context): Promise<THREE.Object3D | undefined> {
      if (context.signal.aborted || disposed) return undefined;
      const group = new THREE.Group();
      group.name = `worldgen:${context.address.level}/${context.address.x}/${context.address.z}`;
      try {
        const structures = structuresForTile(tile, context);
        const structureGroup = new THREE.Group();
        group.add(structureGroup);
        const structureTask = placeStructures(structureGroup, context, structures);
        // Roads and buildings have independent worker queues. Start both before waiting, and
        // settle both so a late road result cannot leak geometry after the building job fails.
        const preset = quality;
        let placed: ReturnType<typeof placedStructures> = [];
        let nearby: StructureFootprint[] = [];
        const buildingsTask = (async () => {
          // A failed or cancelled asset keeps its procedural fallback. Only confirmed, loaded
          // structures can remove a footprint; unrelated buildings still start immediately.
          if (structures.some((entry) => entry.replaceFootprint)) {
            await structureTask;
            placed = placedStructures(structureGroup, context, structures);
          }
          nearby = nearbyFootprints(group, context);
          const mappedTile = withoutReplacedFootprints(tile, context, placed, nearby);
          return generate(mappedTile, context, { buildings: true, scatter: false }, preset);
        })();
        const roadsTask = (async (): Promise<THREE.Object3D | undefined> => {
          let roadTile = tile;
          if (structures.some((entry) => entry.replaceRoads)) {
            await structureTask;
            roadTile = withoutStructureRoads(
              tile,
              context,
              structures.filter((entry) => structureGroup.getObjectByName(`structure:${entry.id}`)),
              metersPerUnit,
              (entry) =>
                structureGroup.getObjectByName(`structure:${entry.id}`)?.userData
                  .structureElevation as number | undefined,
            );
          }
          if (options.roads?.surfaceRenderer && options.roads.renderTransportation !== false) {
            return options.roads.surfaceRenderer.createTileAsync(roadTile, context);
          }
          return createTerrainSemanticObject(roadTile, context, {
            ...options.roads,
            renderLandcover: false,
            renderWater: false,
            renderBuildings: false,
          });
        })();
        const [roads, generated] = await Promise.allSettled([
          roadsTask,
          buildingsTask,
          structureTask,
        ]);
        if (roads.status === 'fulfilled' && roads.value) group.add(roads.value);
        if (roads.status === 'rejected') throw roads.reason;
        if (generated.status === 'rejected') throw generated.reason;
        if (context.signal.aborted || disposed || generated.value === undefined) {
          disposeHumanTile(group);
          return undefined;
        }
        const { output } = generated.value;
        const architecture = await assembleBuildings(output, context, group.name);
        await structureTask;
        if (structureGroup.children.length) architecture.add(structureGroup);
        else structureGroup.removeFromParent();
        group.add(architecture);
        if (context.signal.aborted || disposed) {
          disposeHumanTile(group);
          return undefined;
        }
        stats.buildings += output.stats.buildingsRendered;
        registerInteriors(architecture, output, context);
        // A neighbour may have placed or dropped a landmark while this tile generated.
        const current = nearbyFootprints(group, context);
        const stale =
          current.length !== nearby.length ||
          current.some((footprint) => !nearby.includes(footprint));
        residents.set(group, { tile, context, architecture, quality: preset, stale });
        shareFootprints(group, placed);
        void rebuildResidents();
        stats.boxes += output.stats.buildingsBoxed;
        stats.skippedByOwnership += output.skippedByOwnership;
        stats.geometryBytes += output.stats.meshBytes + output.stats.instanceBytes;
        return group;
      } catch (error) {
        disposeHumanTile(group);
        throw error;
      }
    },
    disposeTile(object: THREE.Object3D): void {
      disposeHumanTile(object);
    },
  };
  const classification: TerrainSemanticTileRenderer = {
    async createTile(tile: TerrainSemanticTile, context): Promise<THREE.Object3D | undefined> {
      const packColors = surfaceColors(pack, defaultScatterId);
      const hostColors = options.landcover?.landcoverColors;
      // Host colors refine the style pack's palette class by class rather than replacing it.
      const colors =
        packColors === undefined && hostColors === undefined
          ? undefined
          : { ...packColors, ...hostColors };
      const meshOptions: TerrainSemanticMeshOptions = {
        ...(models !== undefined ? { maxTreesPerTile: 0 } : {}),
        ...options.landcover,
        ...(colors !== undefined ? { landcoverColors: colors } : {}),
        renderWater: false,
        renderTransportation: false,
        renderBuildings: false,
      };
      const useSurfaceWorker =
        options.landcoverGenerator !== undefined &&
        meshOptions.renderLandcover !== false &&
        meshOptions.renderLandcoverSurface !== false;
      const surface = createTerrainSemanticObject(tile, context, {
        ...meshOptions,
        ...(useSurfaceWorker ? { renderLandcoverSurface: false } : {}),
      });
      try {
        if (useSurfaceWorker) {
          const mesh = await options.landcoverGenerator?.generate(tile, context, meshOptions);
          if (mesh) surface.add(mesh);
        }
        if (context.signal.aborted) {
          disposeTerrainSemanticObject(surface);
          return undefined;
        }
      } catch (error) {
        disposeTerrainSemanticObject(surface);
        throw error;
      }
      if (models === undefined) return surface;
      const group = new THREE.Group();
      group.name = `worldgen-scatter:${context.address.level}/${context.address.x}/${context.address.z}`;
      group.add(surface);
      try {
        const generated = await generate(tile, context, { buildings: false, scatter: true });
        if (generated !== undefined) {
          for (const object of await instancedProps(
            generated.output.placements,
            context,
            group.name,
          )) {
            group.add(object);
          }
          if (!context.signal.aborted) return group;
        }
        disposeTerrainSemanticObject(group);
        disposeWorldgenObject(group);
        return undefined;
      } catch (error) {
        disposeTerrainSemanticObject(group);
        disposeWorldgenObject(group);
        throw error;
      }
    },
    disposeTile(object: THREE.Object3D): void {
      disposeTerrainSemanticObject(object);
      disposeWorldgenObject(object);
    },
  };

  return {
    classification,
    humanFeatures,
    updateInteriors: (position): void => interiors?.update(position),
    setQuality(next): void {
      if (quality === next) return;
      quality = next;
      for (const resident of residents.values()) resident.pending?.abort();
      void rebuildResidents();
    },
    setCacheBudget(maxBytes): void {
      cache?.setLimits({ maxBytes });
    },
    stats: () => ({
      ...stats,
      ...(interiors ? { interiors: interiors.stats() } : {}),
      generateMs: { ...stats.generateMs },
      ...(cache !== undefined
        ? {
            cache: { hits: cache.hits, misses: cache.misses, size: cache.size, bytes: cache.bytes },
          }
        : {}),
    }),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const root of residents.keys()) disposeHumanTile(root);
      residents.clear();
      sharedFootprints.clear();
      interiors?.dispose();
      if (ownsMaterials) materials.dispose?.();
      flatMaterials?.dispose?.();
      if (ownsGenerator) base.dispose();
    },
  };
}
