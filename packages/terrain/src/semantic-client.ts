import type { WaterWave } from '@bendyline/molen-schema';
/** Format-neutral semantic-tile loading and default three.js mesh adapters. */

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MeshPhysicalNodeMaterial, Node } from 'three/webgpu';
import { appendAgricultureAttributes } from './agriculture-surface';
import {
  sampleTerrainBuildingCoverage,
  type TerrainBuildingCoverage,
  terrainBuildingCoverage,
} from './building-coverage';
import {
  markTerrainGroundSurface,
  markTerrainWaterSurface,
  setTerrainShorelineCutouts,
  type TerrainGroundOutline,
} from './ground-cutout';
import { createTerrainGroundMaterial } from './ground-material';
import { landcoverAppearance, orderLandcover } from './landcover-appearance';
import { applyLandcoverBlend, type LandcoverBlendRange } from './landcover-blend';
import { visibleLandcoverPolygons } from './landcover-surface';
import { appendTerrainSurfaceArea, TerrainSurfaceMeshBuilder } from './linear-features';
import {
  clampBounds,
  convexTrianglePieces,
  isDegenerateRing,
  pointInPolygon,
  polygonArea,
  polygonBounds,
} from './polygon';
import type { TerrainPyramidTileLayer, TerrainPyramidTileLayerContext } from './pyramid-stream';
import {
  assertTerrainSemanticTile,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from './semantic-types';
import { waterwayWidth } from './semantic-widths';
import type { TerrainTileLayerCategory } from './stream';
import {
  createTerrainSurfaceObject,
  disposeTerrainSurfaceObject,
  type TerrainSurfaceRenderer,
} from './surface-client';
import type { TerrainSurfaceOptions } from './surface-styles';
import { tagTerrainObject } from './tagged-objects';
import { WATER_RIPPLE_LAYERS, WATER_RIPPLES_GLSL, waterRippleTexture } from './water-ripples';
import { buildTerrainWaterBanks } from './water-shoreline';

export interface TerrainSemanticTileSource {
  load(
    address: TerrainPyramidTileLayerContext['address'],
    signal: AbortSignal,
  ): Promise<TerrainSemanticTile | undefined>;
  dispose?(): void;
}

export interface TerrainSemanticTileRenderer {
  createTile(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): THREE.Object3D | undefined | Promise<THREE.Object3D | undefined>;
  disposeTile?(object: THREE.Object3D): void;
}

export interface TerrainSemanticPyramidLayerOptions {
  id: string;
  category: TerrainTileLayerCategory;
  source: TerrainSemanticTileSource;
  renderer: TerrainSemanticTileRenderer;
  visible?: boolean;
  minLevel?: number;
  maxLevel?: number;
}

export interface TerrainWaterMaterialOptions {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  opacity?: number;
  /** World-space ripple frequency. Smaller values make broader ripples. Default 0.035. */
  waveScale?: number;
  /** Analytic swell slopes matching kernel sampleWaves. Polygon shorelines remain at their datum. */
  swells?: WaterWave[];
  /** Ripple slope and surface variation. Zero leaves only authored swells. Default 0.035. */
  waveStrength?: number;
  /** Speed of the independently drifting ripple layers. Zero freezes ripples, not swells. */
  waveSpeed?: number;
}

/** Physical water for either the legacy WebGL renderer or the WebGPU node renderer. */
export type TerrainWaterMaterial = THREE.MeshPhysicalMaterial | MeshPhysicalNodeMaterial;

interface TerrainWaterShaderState {
  time: THREE.IUniform<number>;
  worldOrigin: THREE.IUniform<THREE.Vector2>;
  waveScale: THREE.IUniform<number>;
  waveStrength: THREE.IUniform<number>;
  waveSpeed: THREE.IUniform<number>;
}

const terrainWaterShaderStates = new WeakMap<THREE.Material, TerrainWaterShaderState>();

function terrainWaterParameters(
  options: TerrainWaterMaterialOptions,
): THREE.MeshPhysicalMaterialParameters {
  const opacity = options.opacity ?? 1;
  return {
    color: options.color ?? '#356b78',
    roughness: options.roughness ?? 0.42,
    metalness: 0,
    // Water reflects less head-on than the default glass IOR. Keep the extra clearcoat
    // lobe weak and broad so sun-facing ponds retain their color instead of turning white.
    ior: 1.333,
    clearcoat: options.clearcoat ?? 0.08,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.34,
    transparent: opacity < 1,
    opacity,
    depthWrite: true,
    // Geometry already includes the water height offset. A slope-based depth bias can
    // pull distant water in front of bridge decks several meters above its surface.
  };
}

/**
 * Create opaque physical water with irregular, animated ripple normals and sky reflections.
 *
 * Opaque water is intentional: tiled/LOD water polygons can overlap while coverage refines, and
 * alpha blending would reveal those overlaps as dark crosses or tile seams.
 */
export function createTerrainWaterMaterial(
  options: TerrainWaterMaterialOptions = {},
): THREE.MeshPhysicalMaterial {
  const state: TerrainWaterShaderState = {
    time: { value: 0 },
    worldOrigin: { value: new THREE.Vector2() },
    waveScale: { value: options.waveScale ?? 0.035 },
    waveStrength: { value: options.waveStrength ?? 0.035 },
    waveSpeed: { value: options.waveSpeed ?? 0.55 },
  };
  const swells = options.swells ?? [];
  const literal = (n: number): string => Number(n).toFixed(9);
  const slopes = swells
    .map((w, index) => {
      const k = (2 * Math.PI) / w.wavelength;
      return `float swellPhase${index} = ${literal(k)} * (dot(vTerrainWaterWorldPosition, vec2(${literal(Math.sin(w.direction))}, ${literal(Math.cos(w.direction))})) - ${literal(w.speed)} * terrainWaterTime);
        slope += vec2(${literal(Math.sin(w.direction))}, ${literal(Math.cos(w.direction))}) * ${literal(w.amplitude * k)} * cos(swellPhase${index}) * (1.0 - smoothstep(0.5, 2.5, fwidth(swellPhase${index})));`;
    })
    .join('\n');
  const material = new THREE.MeshPhysicalMaterial(terrainWaterParameters(options));
  material.name = 'terrain-water';
  material.userData.terrainWaterMaterial = true;
  material.onBeforeCompile = (shader): void => {
    Object.assign(shader.uniforms, {
      terrainWaterTime: state.time,
      terrainWaterWorldOrigin: state.worldOrigin,
      terrainWaterWaveScale: state.waveScale,
      terrainWaterWaveStrength: state.waveStrength,
      terrainWaterWaveSpeed: state.waveSpeed,
      terrainWaterRipples: { value: waterRippleTexture() },
    });
    shader.vertexShader = `
      varying vec2 vTerrainWaterWorldPosition;
      uniform vec2 terrainWaterWorldOrigin;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTerrainWaterWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xz + terrainWaterWorldOrigin;`,
    );
    // Evaluate distance per fragment: a large water polygon can pass under the camera
    // even when all its corners are beyond the ripple fade distance.
    shader.fragmentShader = `
      varying vec2 vTerrainWaterWorldPosition;
      uniform float terrainWaterTime;
      uniform float terrainWaterWaveScale;
      uniform float terrainWaterWaveStrength;
      uniform float terrainWaterWaveSpeed;

      ${WATER_RIPPLES_GLSL}
    ${shader.fragmentShader}`
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         vec2 slope = terrainWaterSurface.xy;
         ${slopes}
         slope *= terrainWaterDistanceFade;
         normal = normalize(mat3(viewMatrix) * vec3(-slope.x, 1.0, -slope.y));`,
      )
      .replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>
         #ifdef USE_CLEARCOAT
           clearcoatNormal = normal;
         #endif`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 terrainWaterSurface = terrainWaterDetail(vTerrainWaterWorldPosition,
           terrainWaterTime * terrainWaterWaveSpeed);
         float terrainWaterFootprint = length(fwidth(vTerrainWaterWorldPosition)) * terrainWaterWaveScale;
         float terrainWaterDistanceFade = 1.0 - smoothstep(120.0, 1600.0, length(vViewPosition));
         terrainWaterSurface *= terrainWaterDistanceFade *
           (1.0 - smoothstep(0.5, 2.0, terrainWaterFootprint));
         diffuseColor.rgb *= 1.0 + terrainWaterSurface.z * 0.35;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(
           roughnessFactor + terrainWaterSurface.z * 1.5,
           0.08,
           1.0
         );`,
      );
  };
  material.customProgramCacheKey = (): string => `terrain-water@3:${JSON.stringify(swells)}`;
  terrainWaterShaderStates.set(material, state);
  return material;
}

/**
 * Create water for an initialized renderer's selected backend. The WebGPU path uses TSL,
 * since WebGPURenderer does not execute the legacy material's onBeforeCompile shader hooks.
 * Node materials are loaded only when selected; existing WebGL callers retain their shaders.
 */
export async function createTerrainWaterMaterialAsync(
  options: TerrainWaterMaterialOptions = {},
  backend: 'webgl' | 'webgpu' = 'webgl',
): Promise<TerrainWaterMaterial> {
  if (backend === 'webgl') return createTerrainWaterMaterial(options);
  const [
    { MeshPhysicalNodeMaterial },
    {
      materialColor,
      materialRoughness,
      positionWorld,
      positionView,
      uniform,
      texture,
      vec2,
      vec4,
      vec3,
      float,
      fwidth,
      smoothstep,
      cameraViewMatrix,
    },
  ] = await Promise.all([import('three/webgpu'), import('three/tsl')]);
  const time = uniform(0).setName('terrainWaterTime');
  const worldOrigin = uniform(new THREE.Vector2()).setName('terrainWaterWorldOrigin');
  const waveScale = uniform(options.waveScale ?? 0.035).setName('terrainWaterWaveScale');
  const waveStrength = uniform(options.waveStrength ?? 0.035).setName('terrainWaterWaveStrength');
  const waveSpeed = uniform(options.waveSpeed ?? 0.55).setName('terrainWaterWaveSpeed');
  const worldPosition = positionWorld.xz.add(worldOrigin).toVar();
  const phase = time.mul(waveSpeed).toVar();
  const p = worldPosition.mul(waveScale).toVar();
  const ripples = waterRippleTexture();
  const patch = texture(ripples, p.mul(0.009).add(vec2(phase.mul(0.001), 0)))
    .rgb.mul(2)
    .sub(1)
    .toVar();
  const warp = patch.rg.mul(0.025).toVar();
  let detail: Node<'vec2'> = vec2(0);
  for (const {
    scale,
    direction: [x, y],
    drift,
    weight,
  } of WATER_RIPPLE_LAYERS) {
    const uv = vec2(p.dot(vec2(x, y)), p.dot(vec2(-y, x)))
      .mul(vec2(1, 0.65))
      .mul(scale)
      .add(warp)
      .add(vec2(...drift).mul(phase));
    const n = texture(ripples, uv).rg.mul(2).sub(1).toVar();
    detail = detail.add(vec2(x, y).mul(n.x).add(vec2(-y, x).mul(n.y).mul(0.65)).mul(weight));
  }
  const footprint = fwidth(worldPosition).length().mul(waveScale);
  const fade = smoothstep(120, 1600, positionView.length())
    .oneMinus()
    .mul(smoothstep(0.5, 2, footprint).oneMinus());
  const rippleSlope = detail
    .mul(patch.b.mul(0.7).add(1))
    .mul(waveStrength)
    .mul(14)
    .mul(fade)
    .toVar();
  const variation = patch.b.mul(waveStrength).mul(fade).toVar();
  const material = new MeshPhysicalNodeMaterial(terrainWaterParameters(options));
  material.name = 'terrain-water';
  material.userData.terrainWaterMaterial = true;
  // r184 declares these TSL accessors as bare MaterialNodes rather than their shader value
  // types. Their implementations are already proxied nodes; this adds only the missing types.
  const baseColor = materialColor as unknown as Node<'vec4'>;
  const baseRoughness = materialRoughness as unknown as Node<'float'>;
  // Affect only RGB, preserving authored opacity and any subsequently attached color map alpha.
  material.colorNode = vec4(baseColor.rgb.mul(variation.mul(0.35).add(1)), baseColor.a);
  let slopeX: Node<'float'> = float(rippleSlope.x),
    slopeZ: Node<'float'> = float(rippleSlope.y);
  for (const wave of options.swells ?? []) {
    const k = (2 * Math.PI) / wave.wavelength;
    const dx = Math.sin(wave.direction),
      dz = Math.cos(wave.direction);
    const phase = worldPosition.x
      .mul(dx)
      .add(worldPosition.y.mul(dz))
      .sub(time.mul(wave.speed))
      .mul(k);
    const slope = phase
      .cos()
      .mul(wave.amplitude * k)
      .mul(smoothstep(120, 1600, positionView.length()).oneMinus())
      .mul(smoothstep(0.5, 2.5, fwidth(phase)).oneMinus());
    slopeX = slopeX.add(slope.mul(dx));
    slopeZ = slopeZ.add(slope.mul(dz));
  }
  material.normalNode = cameraViewMatrix
    .mul(vec4(vec3(slopeX.negate(), 1, slopeZ.negate()).normalize(), 0))
    .xyz.normalize();
  material.clearcoatNormalNode = material.normalNode;
  material.roughnessNode = baseRoughness.add(variation.mul(1.5)).clamp(0.08, 1);
  terrainWaterShaderStates.set(material, { time, worldOrigin, waveScale, waveStrength, waveSpeed });
  return material;
}

/** Advance a terrain water material and preserve wave continuity across floating-origin shifts. */
export function setTerrainWaterTime(
  material: THREE.Material,
  seconds: number,
  worldOrigin: readonly [number, number] = [0, 0],
): void {
  const state = terrainWaterShaderStates.get(material);
  if (state === undefined)
    throw new Error('material was not created by a terrain water material factory');
  state.time.value = seconds;
  state.worldOrigin.value.set(worldOrigin[0], worldOrigin[1]);
}

/** Connect any normalized semantic source/renderer pair to adaptive terrain residency. */
export function createTerrainSemanticPyramidLayer(
  options: TerrainSemanticPyramidLayerOptions,
): TerrainPyramidTileLayer {
  return {
    id: options.id,
    category: options.category,
    ...(options.visible !== undefined ? { visible: options.visible } : {}),
    ...(options.minLevel !== undefined ? { minLevel: options.minLevel } : {}),
    ...(options.maxLevel !== undefined ? { maxLevel: options.maxLevel } : {}),
    async createTile(context): Promise<THREE.Object3D | undefined> {
      const tile = await options.source.load(context.address, context.signal);
      if (tile === undefined || context.signal.aborted) return undefined;
      assertTerrainSemanticTile(tile);
      return options.renderer.createTile(tile, context);
    },
    ...(options.renderer.disposeTile !== undefined
      ? { disposeTile: (object: THREE.Object3D): void => options.renderer.disposeTile?.(object) }
      : {}),
  };
}

const DEFAULT_TREE_TRUNK_GEOMETRY = new THREE.CylinderGeometry(0.04, 0.07, 0.45, 6);
const DEFAULT_TREE_CANOPY_GEOMETRY = new THREE.ConeGeometry(0.32, 0.75, 7);
const DEFAULT_TREE_TRUNK_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#604832',
  roughness: 1,
});
const DEFAULT_TREE_CANOPY_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#2f633d',
  roughness: 0.96,
});
const DEFAULT_LANDCOVER_MATERIAL = createTerrainGroundMaterial({ agriculture: true, strength: 0 });
const DEFAULT_BUILDING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#b9ab96',
  roughness: 0.84,
});
/** Plain extrusions painted per building (see `buildingColors`). */
const PAINTED_BUILDING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.84,
  vertexColors: true,
});
const DEFAULT_WATER_MATERIAL = createTerrainWaterMaterial();
const DEFAULT_WATER_BANK_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#77725b',
  roughness: 1,
  side: THREE.DoubleSide,
});
const DEFAULT_FOREST_CLASSES = ['forest', 'wood', 'trees'];
const DEFAULT_LANDCOVER_COLORS: Readonly<Record<string, string>> = {
  forest: '#42684a',
  wood: '#3d6245',
  grassland: '#7d9562',
  grass: '#79915e',
  farmland: '#999866',
  crop: '#9d9b64',
  scrub: '#6e8060',
  barren: '#8a806c',
  sand: '#b6a777',
  beach: '#c0ae7d',
  glacier: '#d7e3e5',
  snow: '#e4eaeb',
  park: '#64845c',
  garden: '#6b8059',
  residential: '#929985',
  commercial: '#aaa59a',
  retail: '#aaa59a',
  gravel: '#b6b0a2',
  pedestrian: '#aaa79e',
  pavement: '#aaa79e',
  parking: '#747575',
  urban_area: '#85857d',
  industrial: '#827c72',
};

export interface TerrainSemanticMeshMaterials {
  landcover?: THREE.Material;
  treeTrunk?: THREE.Material;
  treeCanopy?: THREE.Material;
  road?: THREE.Material;
  building?: THREE.Material;
  water?: THREE.Material;
}

export interface TerrainUrbanGround {
  color?: string;
  /** Land-cover appearances that pave over; default unmapped ground and broad urban uses. */
  classes?: readonly string[];
  from?: number;
  full?: number;
  /** Precomputed coverage, for a tile whose buildings are not at hand (a landcover worker). */
  coverage?: TerrainBuildingCoverage;
}

const URBAN_GROUND_CLASSES: readonly string[] = [
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
];

export interface TerrainSemanticMeshOptions {
  /** Shared controller for live style changes across resident tiles. */
  surfaceRenderer?: TerrainSurfaceRenderer;
  /** Static styles when no shared controller is supplied. */
  surfaces?: TerrainSurfaceOptions;
  materials?: TerrainSemanticMeshMaterials;
  treeTrunkGeometry?: THREE.BufferGeometry;
  treeCanopyGeometry?: THREE.BufferGeometry;
  forestClasses?: readonly string[];
  landcoverColors?: Readonly<Record<string, string>>;
  /** Optional world-space palettes, sampled per vertex. Half-open bounds meet across tiles. */
  landcoverPaletteAreas?: ReadonlyArray<{
    bounds: readonly [number, number, number, number];
    colors: Readonly<Record<string, string>>;
    /** This area's own ground detail, in place of `landcoverDetail`. */
    detail?: Readonly<Record<string, readonly [number, number]>>;
  }>;
  /**
   * Exact land-cover appearance to [brush, bare] ground detail, each 0..1, carried per vertex
   * as `landcoverDetail` for the ground material: dark shrub speckle, and lighter bare-soil
   * patches. Paved urban ground (see `urbanGround`) shows neither.
   */
  landcoverDetail?: Readonly<Record<string, readonly [number, number]>>;
  landcoverOffset?: number;
  /**
   * Built-up ground. Unmapped ground and broad land-use classes blend toward `color` (default:
   * the `urban_ground` land-cover color, else `pavement`) as the share of nearby ground under
   * building footprints rises from `from` to `full` (defaults 0.15 and 0.45), so a downtown
   * block between its buildings reads as paving while suburban lawns stay green.
   */
  urbanGround?: TerrainUrbanGround;
  treesPerSquareKilometer?: number;
  maxTreesPerTile?: number;
  maxTreeSlope?: number;
  treeHeight?: number;
  defaultBuildingHeight?: number;
  defaultLevelHeight?: number;
  /**
   * Weighted roof and wall colors for plain building extrusions, chosen per building from a
   * stable hash of its id or outline, so a distant city is not one color. Without it every
   * building takes the building material's own color.
   */
  buildingColors?: {
    roofs: ReadonlyArray<readonly [string, number]>;
    walls: ReadonlyArray<readonly [string, number]>;
  };
  waterOffset?: number;
  /** Bank upper-edge lift; defaults to landcoverOffset or 0.18m, even in a separate water layer.
   * Set 0 for bare elevation without a raised landcover surface. */
  shorelineGroundOffset?: number;
  /**
   * Height of the sea, for projected-Earth terrain. Water whose floor reaches within 2 m of it is
   * the sea (or a tidal river or harbor): it draws as one flat surface 1.5 m above sea level in
   * every tile, over shoreline and shallow-water noise in the elevation, instead of a level
   * sampled from the bathymetry (which differs tile to tile and lets noisy ground poke through).
   * Omit for invented worlds without a sea.
   */
  seaLevel?: number;
  renderLandcover?: boolean;
  renderLandcoverSurface?: boolean;
  renderWater?: boolean;
  renderTransportation?: boolean;
  renderBuildings?: boolean;
}

function hash01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

function weightedColor(entries: ReadonlyArray<readonly [string, number]>, t: number): THREE.Color {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = t * total;
  for (const [color, weight] of entries) {
    pick -= weight;
    if (pick < 0) return new THREE.Color(color);
  }
  return new THREE.Color(entries.at(-1)?.[0] ?? '#ffffff');
}

/** Stable per-building seed: its id when the source has one, else its outline's world position. */
function buildingSeed(
  id: string | number | undefined,
  polygon: TerrainSemanticPolygon,
  context: TerrainPyramidTileLayerContext,
): number {
  if (typeof id === 'number' && Number.isFinite(id))
    return Math.floor(id) ^ Math.floor(id / 2 ** 32);
  let seed = 0;
  if (typeof id === 'string')
    for (let i = 0; i < id.length; i++) seed = Math.imul(seed, 31) + id.charCodeAt(i);
  else {
    const [u, v] = polygon.outer[0] ?? [0, 0];
    seed = Math.imul(Math.round(context.origin[0] + u * context.tileSize), 73856093);
    seed ^= Math.imul(Math.round(context.origin[1] + v * context.tileSize), 19349663);
  }
  return seed;
}

function normalizedClass(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', ' ');
}

function landcoverColor(value: string, options: TerrainSemanticMeshOptions): THREE.Color {
  const colors = options.landcoverColors ?? DEFAULT_LANDCOVER_COLORS;
  const normalized = normalizedClass(value);
  const exact =
    colors[value] ?? colors[value.toLowerCase()] ?? colors[normalized.replaceAll(' ', '_')];
  if (exact !== undefined) return new THREE.Color(exact);
  for (const [candidate, color] of Object.entries(colors)) {
    if (normalized.includes(normalizedClass(candidate))) return new THREE.Color(color);
  }
  return new THREE.Color('#78836b');
}

function classMatches(value: string, candidates: readonly string[]): boolean {
  const normalized = normalizedClass(value);
  return candidates.some((candidate) => normalized.includes(normalizedClass(candidate)));
}

interface TreePlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  color: THREE.Color;
}

function collectTrees(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
): TreePlacement[] {
  const classes = options.forestClasses ?? DEFAULT_FOREST_CLASSES;
  const density = options.treesPerSquareKilometer ?? 70;
  const maximum = options.maxTreesPerTile ?? 320;
  const maximumSlope = options.maxTreeSlope ?? 0.42;
  const placements: TreePlacement[] = [];
  for (let featureIndex = 0; featureIndex < tile.landcover.length; featureIndex++) {
    const feature = tile.landcover[featureIndex];
    if (feature === undefined || !classMatches(feature.class, classes)) continue;
    for (let polygonIndex = 0; polygonIndex < feature.polygons.length; polygonIndex++) {
      const polygon = feature.polygons[polygonIndex];
      if (polygon === undefined || placements.length >= maximum) break;
      const target = Math.min(
        maximum - placements.length,
        Math.round(
          (polygonArea(polygon) *
            context.tileSize *
            context.tileSize *
            density *
            (feature.density ?? 1)) /
            1_000_000,
        ),
      );
      const [minU, minV, maxU, maxV] = clampBounds(polygonBounds(polygon));
      if (minU >= maxU || minV >= maxV || target <= 0) continue;
      const maximumAttempts = Math.max(target * 8, 24);
      let accepted = 0;
      for (let attempt = 0; attempt < maximumAttempts && accepted < target; attempt++) {
        const seed =
          (context.address.level * 73_856_093) ^
          (context.address.x * 19_349_663) ^
          (context.address.z * 83_492_791) ^
          (featureIndex * 91_273) ^
          (polygonIndex * 130_363) ^
          (attempt * 17_389);
        const u = minU + hash01(seed) * (maxU - minU);
        const v = minV + hash01(seed ^ 0x9e3779b9) * (maxV - minV);
        if (!pointInPolygon([u, v], polygon)) continue;
        const x = u * context.tileSize;
        const z = v * context.tileSize;
        const worldX = context.origin[0] + x;
        const worldZ = context.origin[1] + z;
        if (context.heightfield.slopeAt(worldX, worldZ) > maximumSlope) continue;
        const scale = 0.72 + hash01(seed ^ 0x632be59b) * 0.62;
        placements.push({
          x,
          y: context.heightfield.sampleHeight(worldX, worldZ),
          z,
          scale,
          color: new THREE.Color().setHSL(
            0.31 + hash01(seed ^ 0xc2b2ae35) * 0.055,
            0.38,
            0.25 + scale * 0.035,
          ),
        });
        accepted++;
      }
    }
  }
  return placements;
}

function addTrees(
  group: THREE.Group,
  placements: TreePlacement[],
  options: TerrainSemanticMeshOptions,
): void {
  if (placements.length === 0) return;
  const trunk = new THREE.InstancedMesh(
    options.treeTrunkGeometry ?? DEFAULT_TREE_TRUNK_GEOMETRY,
    options.materials?.treeTrunk ?? DEFAULT_TREE_TRUNK_MATERIAL,
    placements.length,
  );
  const canopy = new THREE.InstancedMesh(
    options.treeCanopyGeometry ?? DEFAULT_TREE_CANOPY_GEOMETRY,
    options.materials?.treeCanopy ?? DEFAULT_TREE_CANOPY_MATERIAL,
    placements.length,
  );
  const matrix = new THREE.Matrix4();
  const treeHeight = options.treeHeight ?? 24;
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index] as TreePlacement;
    const scale = treeHeight * placement.scale;
    matrix.compose(
      new THREE.Vector3(placement.x, placement.y + scale * 0.225, placement.z),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale),
    );
    trunk.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(placement.x, placement.y + scale * 0.625, placement.z),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale),
    );
    canopy.setMatrixAt(index, matrix);
    canopy.setColorAt(index, placement.color);
  }
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  if (canopy.instanceColor !== null) canopy.instanceColor.needsUpdate = true;
  group.add(trunk, canopy);
}

function appendRibbonLine(
  line: TerrainSemanticLine,
  width: number,
  verticalOffset: number,
  context: TerrainPyramidTileLayerContext,
  positions: number[],
  indices: number[],
  normals: number[],
): void {
  if (line.length < 2) return;
  const sampled: TerrainSemanticPoint[] = [line[0] as TerrainSemanticPoint];
  // No finer than the ground's own grid, which a ribbon cannot follow more closely: a coarse
  // tile's rivers were sampled every 24 m, many times its grid, at 10-15 ms a tile.
  const spacing =
    context.tileSize / Math.max(1, (context.surfaceResolution ?? context.heightfield.cols) - 1);
  const maxSegmentLength = Math.max(24, width * 2.5, spacing);
  for (let index = 1; index < line.length; index++) {
    const from = line[index - 1] as TerrainSemanticPoint;
    const to = line[index] as TerrainSemanticPoint;
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]) * context.tileSize;
    const steps = Math.min(48, Math.max(1, Math.ceil(distance / maxSegmentLength)));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      sampled.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
    }
  }
  const firstVertex = positions.length / 3;
  for (let index = 0; index < sampled.length; index++) {
    const previous = sampled[Math.max(0, index - 1)] as TerrainSemanticPoint;
    const next = sampled[Math.min(sampled.length - 1, index + 1)] as TerrainSemanticPoint;
    const point = sampled[index] as TerrainSemanticPoint;
    const dx = (next[0] - previous[0]) * context.tileSize;
    const dz = (next[1] - previous[1]) * context.tileSize;
    const length = Math.hypot(dx, dz) || 1;
    const sideX = (-dz / length) * (width / 2);
    const sideZ = (dx / length) * (width / 2);
    const x = point[0] * context.tileSize;
    const z = point[1] * context.tileSize;
    const leftX = x + sideX;
    const leftZ = z + sideZ;
    const rightX = x - sideX;
    const rightZ = z - sideZ;
    const leftY =
      context.heightfield.sampleHeight(context.origin[0] + leftX, context.origin[1] + leftZ) +
      verticalOffset;
    const rightY =
      context.heightfield.sampleHeight(context.origin[0] + rightX, context.origin[1] + rightZ) +
      verticalOffset;
    positions.push(leftX, leftY, leftZ, rightX, rightY, rightZ);
    // The surface normal from the ribbon's own frame: across (right to left, with its bank-to-bank
    // tilt) crossed with along. computeVertexNormals over a city's canals took 10-20 ms a tile.
    const acrossX = leftX - rightX,
      acrossY = leftY - rightY,
      acrossZ = leftZ - rightZ;
    let nx = acrossY * dz,
      ny = acrossZ * dx - acrossX * dz,
      nz = -acrossY * dx;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const n = Math.hypot(nx, ny, nz) || 1;
    normals.push(nx / n, ny / n, nz / n, nx / n, ny / n, nz / n);
    if (index < sampled.length - 1) {
      const left = firstVertex + index * 2;
      indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3);
    }
  }
}

function createWaterwayMesh(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
): THREE.Mesh | undefined {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  for (const feature of tile.water) {
    for (const line of feature.lines ?? []) {
      appendRibbonLine(
        line,
        waterwayWidth(feature.class, feature.width),
        options.waterOffset ?? 0.35,
        context,
        positions,
        indices,
        normals,
      );
    }
  }
  if (indices.length === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, options.materials?.water ?? DEFAULT_WATER_MATERIAL);
  mesh.name = 'semantic:waterways';
  markTerrainWaterSurface(mesh);
  mesh.userData.shadowCaster = false;
  mesh.userData.shadowReceiver = false;
  mesh.renderOrder = 1;
  mesh.userData.terrainOwnedGeometry = true;
  return mesh;
}

/**
 * Undefined when the outer ring bounds nothing; degenerate holes are dropped. Validated sources
 * never reach either branch, but earcut faults instead of ignoring a zero-area ring, so the mesh
 * adapters stay defensive against decoders that skip assertTerrainSemanticTile.
 */
function shapeFromPolygon(
  polygon: TerrainSemanticPolygon,
  tileSize: number,
): THREE.Shape | undefined {
  if (isDegenerateRing(polygon.outer)) return undefined;
  const shape = new THREE.Shape(
    polygon.outer.map((point) => new THREE.Vector2(point[0] * tileSize, -point[1] * tileSize)),
  );
  for (const hole of polygon.holes ?? []) {
    if (isDegenerateRing(hole)) continue;
    shape.holes.push(
      new THREE.Path(
        hole.map((point) => new THREE.Vector2(point[0] * tileSize, -point[1] * tileSize)),
      ),
    );
  }
  return shape;
}

export function createLandcoverMesh(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
): THREE.Mesh | undefined {
  const builder = new TerrainSurfaceMeshBuilder(context);
  tile = { ...tile, landcover: orderLandcover(tile.landcover) };
  const visible = visibleLandcoverPolygons(tile.landcover);
  const ranges: LandcoverBlendRange[] = [];
  const colorsAt: ((x: number, z: number) => THREE.Color)[] = [];
  const urban = options.urbanGround;
  const coverage = urban ? (urban.coverage ?? terrainBuildingCoverage(tile)) : undefined;
  const urbanClasses = new Set(urban?.classes ?? URBAN_GROUND_CLASSES);
  const urbanColor = new THREE.Color(
    urban?.color ??
      options.landcoverColors?.urban_ground ??
      options.landcoverColors?.pavement ??
      DEFAULT_LANDCOVER_COLORS.pavement,
  );
  const urbanFrom = urban?.from ?? 0.15;
  const urbanFull = Math.max(urbanFrom + 0.01, urban?.full ?? 0.45);
  for (let featureIndex = 0; featureIndex < tile.landcover.length; featureIndex++) {
    const feature = tile.landcover[featureIndex];
    if (feature === undefined) continue;
    const color = feature.cultivation
      ? new THREE.Color(feature.cultivation.color)
      : landcoverColor(landcoverAppearance(feature), options);
    const appearance = landcoverAppearance(feature);
    const palettes = options.landcoverPaletteAreas?.map((area) => ({
      bounds: area.bounds,
      color: landcoverColor(appearance, {
        landcoverColors: { ...options.landcoverColors, ...area.colors },
      }),
      detail: feature.cultivation
        ? undefined
        : (area.detail ?? options.landcoverDetail)?.[appearance],
    }));
    const ownDetail = feature.cultivation ? undefined : options.landcoverDetail?.[appearance];
    const natural =
      palettes === undefined || feature.cultivation !== undefined
        ? color
        : (x: number, z: number): THREE.Color => {
            const worldX = context.origin[0] + x,
              worldZ = context.origin[1] + z;
            return (
              palettes.find(
                ({ bounds: b }) =>
                  worldX >= b[0] && worldX < b[2] && worldZ >= b[1] && worldZ < b[3],
              )?.color ?? color
            );
          };
    // Each feature paints into its own scratch color: both consumers copy it before the next
    // call for this feature, and the boundary blend reads two different features' colors.
    const paved = new THREE.Color();
    const pavedAt =
      coverage === undefined || feature.cultivation !== undefined || !urbanClasses.has(appearance)
        ? undefined
        : (x: number, z: number): number =>
            THREE.MathUtils.smoothstep(
              sampleTerrainBuildingCoverage(coverage, x / context.tileSize, z / context.tileSize),
              urbanFrom,
              urbanFull,
            );
    const colorAt =
      pavedAt === undefined
        ? natural
        : (x: number, z: number): THREE.Color => {
            const base = typeof natural === 'function' ? natural(x, z) : natural;
            const t = pavedAt(x, z);
            return t > 0 ? paved.copy(base).lerp(urbanColor, t) : base;
          };
    // One height for every class: covered faces were removed above, so neighbors meet edge to
    // edge. Staggered layers left a sliver at each boundary that a grazing view saw through
    // once the covered terrain beneath stopped drawing.
    const offset = options.landcoverOffset ?? 0.18;
    const start = builder.vertexCount;
    for (const polygon of visible[featureIndex] ?? [])
      appendTerrainSurfaceArea(builder, polygon, colorAt, offset);
    appendAgricultureAttributes(builder, start, feature);
    builder.attributeSince('landcoverDetail', 2, start, (x, z) => {
      const worldX = context.origin[0] + x,
        worldZ = context.origin[1] + z;
      const detail =
        palettes?.find(
          ({ bounds: b }) => worldX >= b[0] && worldX < b[2] && worldZ >= b[1] && worldZ < b[3],
        )?.detail ?? ownDetail;
      if (detail === undefined) return [0, 0];
      const open = 1 - (pavedAt?.(x, z) ?? 0);
      return [detail[0] * open, detail[1] * open];
    });
    colorsAt[featureIndex] = typeof colorAt === 'function' ? colorAt : () => colorAt;
    if (builder.vertexCount > start)
      ranges.push({ start, end: builder.vertexCount, feature: featureIndex });
  }
  const mesh = builder.mesh(
    'semantic:landcover',
    options.materials?.landcover ?? DEFAULT_LANDCOVER_MATERIAL,
    true,
    true,
  );
  if (mesh) {
    applyLandcoverBlend(
      mesh.geometry,
      tile.landcover,
      ranges,
      context.tileSize,
      (feature, x, z) => (colorsAt[feature] as (x: number, z: number) => THREE.Color)(x, z),
      (array, size) => new THREE.BufferAttribute(array, size),
    );
    mesh.userData.shadowCaster = false;
    // Grid interiors share vertices; retain indexed buffers for broad land-cover footprints.
    const geometry = mesh.geometry;
    mesh.geometry = mergeVertices(geometry, 0.00001);
    geometry.dispose();
    mesh.renderOrder = 1;
  }
  return mesh;
}

function averageGroundHeight(
  polygon: TerrainSemanticPolygon,
  context: TerrainPyramidTileLayerContext,
): number {
  let sum = 0;
  for (const point of polygon.outer) {
    sum += context.heightfield.sampleHeight(
      context.origin[0] + point[0] * context.tileSize,
      context.origin[1] + point[1] * context.tileSize,
    );
  }
  return sum / polygon.outer.length;
}

/** Shared rendered water datum for water-bound ambient objects and the surface mesh. */
export function terrainWaterSurfaceHeight(
  polygon: TerrainSemanticPolygon,
  context: TerrainPyramidTileLayerContext,
  offset: number,
  seaLevel?: number,
): number {
  // Shoreline vertices often sample the bank, especially on coarse DEM tiles. Taking
  // their median can lift a whole lake above its bridges. Prefer interior water samples;
  // a lower quartile rejects bridge/shore contamination without trusting one low outlier.
  const height = (u: number, v: number): number =>
    context.heightfield.sampleHeight(
      context.origin[0] + u * context.tileSize,
      context.origin[1] + v * context.tileSize,
    );
  const bounds = clampBounds(polygonBounds(polygon), 0, 1);
  const samples: number[] = [];
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const p: TerrainSemanticPoint = [
        bounds[0] + ((bounds[2] - bounds[0]) * (x + 0.5)) / 9,
        bounds[1] + ((bounds[3] - bounds[1]) * (y + 0.5)) / 9,
      ];
      if (pointInPolygon(p, polygon)) samples.push(height(...p));
    }
  if (!samples.length) for (const p of polygon.outer) samples.push(height(...p));
  samples.sort((left, right) => left - right);
  const low = samples[Math.floor((samples.length - 1) * 0.25)] ?? 0;
  // At or below sea level it is the sea: one flat surface in every tile, clear of shoreline and
  // shallow-water noise, rather than a level sampled from bathymetry that differs tile to tile.
  if (seaLevel !== undefined && low < seaLevel + SEA_BAND) return seaLevel + SEA_MARGIN + offset;
  return low + offset;
}

/** Water whose lower quartile is within this of sea level is the sea. */
const SEA_BAND = 2;
/** The sea's surface above the datum, clearing coastal elevation noise. */
const SEA_MARGIN = 1.5;

/**
 * Every footprint as a flat-roofed prism written straight into one buffer: roof (earcut), walls,
 * and a floor only under a raised part (`minHeight`), where it can be seen. A THREE.ExtrudeGeometry
 * per building, its normals recomputed and all of them merged, held a streaming frame 10-30 ms
 * for a dense town's distant tile. Positions match the extrusion's: x = u, z = v tile metres.
 */
/** A slice of main-thread work: when it began, and how long it may run before yielding. */
interface SliceClock {
  start: number;
  readonly ms: number;
}

/** Yield (and start a new slice) once the current slice has run its time. */
function* pauseWhenDue(clock: SliceClock): Generator<void, void> {
  if (performance.now() - clock.start <= clock.ms) return;
  yield;
  clock.start = performance.now();
}

/** Run steps to completion with no pauses. */
function finish<T>(steps: Generator<void, T>): T {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/**
 * The tile's buildings as one mesh, a slice at a time: pauses between footprints (see
 * SliceClock), and returns the mesh when every footprint is built.
 */
function* buildingMeshSteps(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
  clock: SliceClock,
): Generator<void, THREE.Mesh | undefined> {
  const palette = options.buildingColors;
  const size = context.tileSize;
  // Written straight into typed arrays, grown by doubling: number arrays, and their copies into
  // attributes, were most of the garbage a coarse tile's shells made.
  let capacity = 1024;
  let count = 0;
  let colored = 0;
  let positions = new Float32Array(capacity * 3);
  let normals = new Float32Array(capacity * 3);
  let uvs = new Float32Array(capacity * 2);
  let colors = new Float32Array(palette ? capacity * 3 : 0);
  const grown = (array: Float32Array, itemSize: number): Float32Array<ArrayBuffer> => {
    const next = new Float32Array(capacity * itemSize);
    next.set(array);
    return next;
  };
  const vertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    color: THREE.Color | undefined,
  ): void => {
    if (count === capacity || (color && colored === capacity)) {
      capacity *= 2;
      positions = grown(positions, 3);
      normals = grown(normals, 3);
      uvs = grown(uvs, 2);
      colors = grown(colors, 3);
    }
    positions[count * 3] = x;
    positions[count * 3 + 1] = y;
    positions[count * 3 + 2] = z;
    normals[count * 3] = nx;
    normals[count * 3 + 1] = ny;
    normals[count * 3 + 2] = nz;
    uvs[count * 2] = u;
    uvs[count * 2 + 1] = v;
    count++;
    if (color) {
      colors[colored * 3] = color.r;
      colors[colored * 3 + 1] = color.g;
      colors[colored * 3 + 2] = color.b;
      colored++;
    }
  };
  for (const feature of tile.buildings) {
    yield* pauseWhenDue(clock);
    const height = Math.max(
      0.5,
      feature.height ??
        (feature.levels !== undefined
          ? feature.levels * (options.defaultLevelHeight ?? 3.1)
          : (options.defaultBuildingHeight ?? 9)),
    );
    for (const polygon of feature.polygons) {
      if (isDegenerateRing(polygon.outer)) continue;
      const rings = [polygon.outer, ...(polygon.holes ?? []).filter((h) => !isDegenerateRing(h))];
      const plan = rings.map((ring) => {
        const points = ring.map((p) => new THREE.Vector2(p[0] * size, p[1] * size));
        const last = points[points.length - 1] as THREE.Vector2;
        // A closed ring repeats its first point; the cap and walls want it once.
        if (points.length > 3 && last.equals(points[0] as THREE.Vector2)) points.pop();
        return points;
      });
      const outer = plan[0] as THREE.Vector2[];
      const holes = plan.slice(1);
      const floor = averageGroundHeight(polygon, context) + (feature.minHeight ?? 0);
      const top = floor + height;
      let roof: THREE.Color | undefined;
      let wall: THREE.Color | undefined;
      if (palette) {
        const seed = buildingSeed(feature.id, polygon, context);
        roof = weightedColor(palette.roofs, hash01(seed));
        wall = weightedColor(palette.walls, hash01(seed ^ 0x5bd1e995));
      }
      // triangulateShape drops a repeated end point in place: index the rings after it.
      const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);
      const all = plan.flat();
      const caps = (feature.minHeight ?? 0) > 0 ? [top, floor] : [top];
      for (const y of caps) {
        const up = y === top;
        for (const [a = 0, b = 0, c = 0] of triangles) {
          const pa = all[a] as THREE.Vector2;
          let pb = all[b] as THREE.Vector2;
          let pc = all[c] as THREE.Vector2;
          // Wound to face up (the roof) or down (a raised part's floor).
          const facing = (pb.y - pa.y) * (pc.x - pa.x) - (pb.x - pa.x) * (pc.y - pa.y);
          if (facing < 0 === up) [pb, pc] = [pc, pb];
          for (const q of [pa, pb, pc]) vertex(q.x, y, q.y, 0, up ? 1 : -1, 0, q.x, -q.y, roof);
        }
      }
      for (const [index, ring] of plan.entries()) {
        let area = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i] as THREE.Vector2;
          const b = ring[(i + 1) % ring.length] as THREE.Vector2;
          area += a.x * b.y - b.x * a.y;
        }
        // Outward from the solid: away from the outer ring's inside, into each hole.
        const sign = (index === 0 ? 1 : -1) * (area > 0 ? 1 : -1);
        let along = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i] as THREE.Vector2;
          const b = ring[(i + 1) % ring.length] as THREE.Vector2;
          const dx = b.x - a.x;
          const dz = b.y - a.y;
          const length = Math.hypot(dx, dz);
          if (length === 0) continue;
          const nx = (sign * dz) / length;
          const nz = (sign * -dx) / length;
          const corners: [THREE.Vector2, number, number][] = [
            [a, floor, along],
            [b, floor, along + length],
            [b, top, along + length],
            [a, top, along],
          ];
          // (a, b, b-top) faces -(dz, -dx): reverse it when the wall faces +(dz, -dx).
          const order = sign > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
          for (const k of order) {
            const [q, y, u] = corners[k] as [THREE.Vector2, number, number];
            vertex(q.x, y, q.y, nx, 0, nz, u, y - floor, wall);
          }
          along += length;
        }
      }
    }
  }
  if (count === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals.slice(0, count * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs.slice(0, count * 2), 2));
  if (palette)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, colored * 3), 3));
  const mesh = new THREE.Mesh(
    geometry,
    options.materials?.building ??
      (palette ? PAINTED_BUILDING_MATERIAL : DEFAULT_BUILDING_MATERIAL),
  );
  mesh.name = 'semantic:buildings';
  mesh.userData.terrainOwnedGeometry = true;
  return mesh;
}

/**
 * The tile's water as one mesh with its banks, a slice at a time: pauses between polygons and
 * before the merge and the banks (see SliceClock). A harbor's polygons, triangulated in one go,
 * held a frame 11 ms.
 */
function* waterMeshSteps(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
  clock: SliceClock,
): Generator<void, THREE.Mesh | undefined> {
  const geometries: THREE.BufferGeometry[] = [];
  const shoreline: TerrainGroundOutline[] = [];
  const shorelineLevels: number[] = [];
  const waters: { polygon: TerrainSemanticPolygon; height: number }[] = [];
  for (const feature of tile.water) {
    for (const polygon of feature.polygons ?? []) {
      yield* pauseWhenDue(clock);
      const shape = shapeFromPolygon(polygon, context.tileSize);
      if (shape === undefined) continue;
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute('position');
      const height = terrainWaterSurfaceHeight(
        polygon,
        context,
        options.waterOffset ?? 0.65,
        options.seaLevel,
      );
      for (let index = 0; index < positions.count; index++) {
        positions.setY(index, height);
      }
      positions.needsUpdate = true;
      waters.push({ polygon, height });
      // Flat: ShapeGeometry's normals, turned up with the shape, are already exact.
      geometries.push(geometry);
      yield* pauseWhenDue(clock);
      // The water's ground openings, as its triangles merged into convex pieces: ground is cut
      // one convex opening at a time, and a river's 1,400 triangles held a tile's cut for 180 ms
      // of main thread. A river's merge is a slice of its own, after its triangulation.
      const indices = geometry.index;
      const corners: [number, number][] = [];
      for (let v = 0; v < positions.count; v++)
        corners.push([positions.getX(v), positions.getZ(v)]);
      const triangles: [number, number, number][] = [];
      for (let i = 0; i + 2 < (indices?.count ?? positions.count); i += 3)
        triangles.push([
          indices?.getX(i) ?? i,
          indices?.getX(i + 1) ?? i + 1,
          indices?.getX(i + 2) ?? i + 2,
        ]);
      for (const piece of convexTrianglePieces(corners, triangles)) {
        shorelineLevels.push(height);
        shoreline.push(piece.map((v) => corners[v] as [number, number]));
      }
    }
  }
  if (geometries.length === 0) return undefined;
  yield* pauseWhenDue(clock);
  const geometry = mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (geometry === null) return undefined;
  const mesh = new THREE.Mesh(geometry, options.materials?.water ?? DEFAULT_WATER_MATERIAL);
  mesh.name = 'semantic:water';
  markTerrainWaterSurface(mesh);
  mesh.userData.shadowCaster = false;
  mesh.userData.shadowReceiver = false;
  mesh.renderOrder = 2;
  mesh.userData.terrainOwnedGeometry = true;
  mesh.userData.terrainWaterSurface = true;
  tagTerrainObject('water', mesh);
  setTerrainShorelineCutouts(mesh, shoreline, shorelineLevels);
  yield* pauseWhenDue(clock);
  const bankGeometry = buildTerrainWaterBanks(
    waters,
    context,
    options.shorelineGroundOffset ?? options.landcoverOffset ?? 0.18,
  );
  if (bankGeometry) {
    const bank = new THREE.Mesh(bankGeometry, DEFAULT_WATER_BANK_MATERIAL);
    bank.name = 'semantic:water-banks';
    bank.userData.terrainOwnedGeometry = true;
    bank.userData.shadowCaster = false;
    bank.receiveShadow = true;
    // An authored bridge/landing may open the coarse bank without removing native water.
    // Ignore the water's own shoreline cutout so the bank still closes ordinary shores.
    markTerrainGroundSurface(bank, false);
    mesh.add(bank);
  }
  return mesh;
}

/** Dispose only tile-owned generated geometry; shared style assets remain reusable. */
export function disposeTerrainSemanticObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const dispose = object.userData.disposeTerrainSurfaces as (() => void) | undefined;
    dispose?.();
  });
  disposeTerrainSurfaceObject(root);
}

/**
 * Default scalable semantic mesh adapter: instanced forest decorators, one combined road ribbon,
 * combined building extrusions, and a draped water mesh. Custom games can replace this renderer.
 */
export function createTerrainSemanticObject(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions = {},
): THREE.Group {
  assertTerrainSemanticTile(tile);
  const group = semanticGroup(context);
  finish(
    semanticObjectSteps(tile, context, options, group, {
      start: 0,
      ms: Number.POSITIVE_INFINITY,
    }),
  );
  return group;
}

function semanticGroup(context: TerrainPyramidTileLayerContext): THREE.Group {
  const group = new THREE.Group();
  group.name = `terrain-semantics:${context.address.level}/${context.address.x}/${context.address.z}`;
  return group;
}

/** createTerrainSemanticObject's parts, added to `group` in order, pausing between slices. */
function* semanticObjectSteps(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
  group: THREE.Group,
  clock: SliceClock,
): Generator<void, void> {
  if ((options.renderLandcover ?? true) && (options.renderLandcoverSurface ?? true)) {
    const landcover = createLandcoverMesh(tile, context, options);
    if (landcover !== undefined) group.add(landcover);
    yield* pauseWhenDue(clock);
  }
  if (options.renderLandcover ?? true) {
    addTrees(group, collectTrees(tile, context, options), options);
    yield* pauseWhenDue(clock);
  }
  if (options.renderWater ?? true) {
    const water = yield* waterMeshSteps(tile, context, options, clock);
    if (water !== undefined) group.add(water);
    const waterways = createWaterwayMesh(tile, context, options);
    if (waterways !== undefined) group.add(waterways);
    yield* pauseWhenDue(clock);
  }
  if (options.renderTransportation ?? true) {
    group.add(
      options.surfaceRenderer?.createTile(tile, context) ??
        createTerrainSurfaceObject(tile, context, options.surfaces, options.materials?.road),
    );
    yield* pauseWhenDue(clock);
  }
  if (options.renderBuildings ?? true) {
    const buildings = yield* buildingMeshSteps(tile, context, options, clock);
    if (buildings !== undefined) group.add(buildings);
  }
}

/**
 * createTerrainSemanticObject a few milliseconds at a time: each slice runs through `run` (a
 * frame's admission, say), pausing between water polygons, footprints and the object's parts. A
 * harbor's water or a coarse tile's thousands of footprints, built in one go, held a frame
 * 11-19 ms. The same group as createTerrainSemanticObject's, or undefined once `context.signal`
 * aborts (with anything built so far disposed).
 */
export async function createTerrainSemanticObjectSliced(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
  run: <T>(slice: () => T) => Promise<T>,
  sliceMs = 2,
): Promise<THREE.Group | undefined> {
  assertTerrainSemanticTile(tile);
  const group = semanticGroup(context);
  const clock: SliceClock = { start: 0, ms: sliceMs };
  const steps = semanticObjectSteps(tile, context, options, group, clock);
  try {
    for (;;) {
      if (context.signal.aborted) {
        steps.return();
        disposeTerrainSemanticObject(group);
        return undefined;
      }
      const step = await run(() => {
        clock.start = performance.now();
        return steps.next();
      });
      if (step.done) return group;
    }
  } catch (error) {
    disposeTerrainSemanticObject(group);
    throw error;
  }
}

export interface DefaultTerrainSemanticRendererOptions extends TerrainSemanticMeshOptions {}

/** Reusable default renderer for createTerrainSemanticPyramidLayer. */
export function createDefaultTerrainSemanticRenderer(
  options: DefaultTerrainSemanticRendererOptions = {},
): TerrainSemanticTileRenderer {
  // With an admission queue, the object is built a slice per admitted job (see
  // createTerrainSemanticObjectSliced); without one, in one go.
  const build = (
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    meshOptions: TerrainSemanticMeshOptions,
  ): Promise<THREE.Group | undefined> => {
    const admission = context.admission;
    if (admission === undefined)
      return Promise.resolve(createTerrainSemanticObject(tile, context, meshOptions));
    return createTerrainSemanticObjectSliced(tile, context, meshOptions, (slice) =>
      admission.run(slice, { signal: context.signal, label: 'semantic-object' }),
    );
  };
  return {
    async createTile(tile, context): Promise<THREE.Group | undefined> {
      if (!options.surfaceRenderer || options.renderTransportation === false)
        return build(tile, context, options);
      // Await surfaces before publishing the tile, preserving streaming backpressure and idle
      // semantics. Cancellation cannot leave an untracked placeholder in the scene.
      const surfaces = await options.surfaceRenderer.createTileAsync(tile, context);
      if (!surfaces) return undefined;
      try {
        const group = await build(tile, context, { ...options, renderTransportation: false });
        if (group === undefined) {
          options.surfaceRenderer.disposeTile(surfaces);
          return undefined;
        }
        group.add(surfaces);
        return group;
      } catch (error) {
        options.surfaceRenderer.disposeTile(surfaces);
        throw error;
      }
    },
    disposeTile: disposeTerrainSemanticObject,
  };
}
