/** Format-neutral semantic-tile loading and default three.js mesh adapters. */

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MeshPhysicalNodeMaterial, Node } from 'three/webgpu';
import { visibleLandcoverPolygons } from './landcover-surface';
import { appendTerrainSurfaceArea, TerrainSurfaceMeshBuilder } from './linear-features';
import {
  clampBounds,
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
  /** World-space wave frequency. The default produces broad, gently moving highlights. */
  waveScale?: number;
  waveStrength?: number;
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
    color: options.color ?? '#286d83',
    roughness: options.roughness ?? 0.42,
    metalness: 0,
    // Water reflects less head-on than the default glass IOR. Keep the extra clearcoat
    // lobe weak and broad so sun-facing ponds retain their color instead of turning white.
    ior: 1.333,
    clearcoat: options.clearcoat ?? 0.12,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.4,
    transparent: opacity < 1,
    opacity,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  };
}

/**
 * Create an opaque physical water material with subtle world-space animated highlights.
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
    });
    shader.vertexShader = `
      varying vec2 vTerrainWaterWorldPosition;
      uniform vec2 terrainWaterWorldOrigin;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTerrainWaterWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xz + terrainWaterWorldOrigin;`,
    );
    shader.fragmentShader = `
      varying vec2 vTerrainWaterWorldPosition;
      uniform float terrainWaterTime;
      uniform float terrainWaterWaveScale;
      uniform float terrainWaterWaveStrength;
      uniform float terrainWaterWaveSpeed;

      float terrainWaterWave() {
        float phase = terrainWaterTime * terrainWaterWaveSpeed;
        float first = sin(
          (vTerrainWaterWorldPosition.x + vTerrainWaterWorldPosition.y * 0.65) *
            terrainWaterWaveScale + phase
        );
        float second = sin(
          (vTerrainWaterWorldPosition.x * 0.38 - vTerrainWaterWorldPosition.y) *
            terrainWaterWaveScale * 1.73 - phase * 0.71
        );
        return (first + second) * 0.5;
      }
    ${shader.fragmentShader}`
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb *= 1.0 + terrainWaterWave() * terrainWaterWaveStrength;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(
           roughnessFactor - terrainWaterWave() * terrainWaterWaveStrength * 0.8,
           0.08,
           1.0
         );`,
      );
  };
  material.customProgramCacheKey = (): string => 'terrain-water@1';
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
    { materialColor, materialRoughness, positionWorld, uniform, vec4 },
  ] = await Promise.all([import('three/webgpu'), import('three/tsl')]);
  const time = uniform(0).setName('terrainWaterTime');
  const worldOrigin = uniform(new THREE.Vector2()).setName('terrainWaterWorldOrigin');
  const waveScale = uniform(options.waveScale ?? 0.035).setName('terrainWaterWaveScale');
  const waveStrength = uniform(options.waveStrength ?? 0.035).setName('terrainWaterWaveStrength');
  const waveSpeed = uniform(options.waveSpeed ?? 0.55).setName('terrainWaterWaveSpeed');
  const worldPosition = positionWorld.xz.add(worldOrigin);
  const phase = time.mul(waveSpeed);
  const first = worldPosition.x.add(worldPosition.y.mul(0.65)).mul(waveScale).add(phase).sin();
  const second = worldPosition.x
    .mul(0.38)
    .sub(worldPosition.y)
    .mul(waveScale)
    .mul(1.73)
    .sub(phase.mul(0.71))
    .sin();
  const highlight = first.add(second).mul(0.5).mul(waveStrength);
  const material = new MeshPhysicalNodeMaterial(terrainWaterParameters(options));
  material.name = 'terrain-water';
  material.userData.terrainWaterMaterial = true;
  // r184 declares these TSL accessors as bare MaterialNodes rather than their shader value
  // types. Their implementations are already proxied nodes; this adds only the missing types.
  const baseColor = materialColor as unknown as Node<'vec4'>;
  const baseRoughness = materialRoughness as unknown as Node<'float'>;
  // Affect only RGB, preserving authored opacity and any subsequently attached color map alpha.
  material.colorNode = vec4(baseColor.rgb.mul(highlight.add(1)), baseColor.a);
  material.roughnessNode = baseRoughness.sub(highlight.mul(0.8)).clamp(0.08, 1);
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
const DEFAULT_LANDCOVER_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.98,
  metalness: 0,
});
const DEFAULT_BUILDING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#b9ab96',
  roughness: 0.84,
});
const DEFAULT_WATER_MATERIAL = createTerrainWaterMaterial();
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
  landcoverOffset?: number;
  treesPerSquareKilometer?: number;
  maxTreesPerTile?: number;
  maxTreeSlope?: number;
  treeHeight?: number;
  defaultBuildingHeight?: number;
  defaultLevelHeight?: number;
  waterOffset?: number;
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
): void {
  if (line.length < 2) return;
  const sampled: TerrainSemanticPoint[] = [line[0] as TerrainSemanticPoint];
  const maxSegmentLength = Math.max(24, width * 2.5);
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
  for (const feature of tile.water) {
    for (const line of feature.lines ?? []) {
      appendRibbonLine(
        line,
        waterwayWidth(feature.class, feature.width),
        options.waterOffset ?? 0.35,
        context,
        positions,
        indices,
      );
    }
  }
  if (indices.length === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, options.materials?.water ?? DEFAULT_WATER_MATERIAL);
  mesh.name = 'semantic:waterways';
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
  const visible = visibleLandcoverPolygons(tile.landcover);
  for (let featureIndex = 0; featureIndex < tile.landcover.length; featureIndex++) {
    const feature = tile.landcover[featureIndex];
    if (feature === undefined) continue;
    const color = landcoverColor(feature.class, options);
    // Retain the authored layer heights below pavement; covered faces were removed above.
    const offset =
      (options.landcoverOffset ?? 0.18) +
      (featureIndex / Math.max(1, tile.landcover.length - 1)) * 0.064;
    for (const polygon of visible[featureIndex] ?? [])
      appendTerrainSurfaceArea(builder, polygon, color, offset);
  }
  const mesh = builder.mesh(
    'semantic:landcover',
    options.materials?.landcover ?? DEFAULT_LANDCOVER_MATERIAL,
  );
  if (mesh) {
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

function waterSurfaceHeight(
  polygon: TerrainSemanticPolygon,
  context: TerrainPyramidTileLayerContext,
  offset: number,
): number {
  const samples = polygon.outer.map((point) =>
    context.heightfield.sampleHeight(
      context.origin[0] + point[0] * context.tileSize,
      context.origin[1] + point[1] * context.tileSize,
    ),
  );
  samples.sort((left, right) => left - right);
  const middle = Math.floor(samples.length / 2);
  const median =
    samples.length % 2 === 0
      ? ((samples[middle - 1] ?? 0) + (samples[middle] ?? 0)) / 2
      : (samples[middle] ?? 0);
  return median + offset;
}

function createBuildingMesh(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
): THREE.Mesh | undefined {
  const geometries: THREE.BufferGeometry[] = [];
  for (const feature of tile.buildings) {
    const height = Math.max(
      0.5,
      feature.height ??
        (feature.levels !== undefined
          ? feature.levels * (options.defaultLevelHeight ?? 3.1)
          : (options.defaultBuildingHeight ?? 9)),
    );
    for (const polygon of feature.polygons) {
      const shape = shapeFromPolygon(polygon, context.tileSize);
      if (shape === undefined) continue;
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
        curveSegments: 1,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, averageGroundHeight(polygon, context) + (feature.minHeight ?? 0), 0);
      geometries.push(geometry);
    }
  }
  if (geometries.length === 0) return undefined;
  const geometry = mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (geometry === null) return undefined;
  const mesh = new THREE.Mesh(geometry, options.materials?.building ?? DEFAULT_BUILDING_MATERIAL);
  mesh.name = 'semantic:buildings';
  mesh.userData.terrainOwnedGeometry = true;
  return mesh;
}

function createWaterMesh(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSemanticMeshOptions,
): THREE.Mesh | undefined {
  const geometries: THREE.BufferGeometry[] = [];
  for (const feature of tile.water) {
    for (const polygon of feature.polygons ?? []) {
      const shape = shapeFromPolygon(polygon, context.tileSize);
      if (shape === undefined) continue;
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute('position');
      const height = waterSurfaceHeight(polygon, context, options.waterOffset ?? 0.65);
      for (let index = 0; index < positions.count; index++) {
        positions.setY(index, height);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometries.push(geometry);
    }
  }
  if (geometries.length === 0) return undefined;
  const geometry = mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (geometry === null) return undefined;
  const mesh = new THREE.Mesh(geometry, options.materials?.water ?? DEFAULT_WATER_MATERIAL);
  mesh.name = 'semantic:water';
  mesh.renderOrder = 2;
  mesh.userData.terrainOwnedGeometry = true;
  mesh.userData.terrainWaterSurface = true;
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
  const group = new THREE.Group();
  group.name = `terrain-semantics:${context.address.level}/${context.address.x}/${context.address.z}`;
  if ((options.renderLandcover ?? true) && (options.renderLandcoverSurface ?? true)) {
    const landcover = createLandcoverMesh(tile, context, options);
    if (landcover !== undefined) group.add(landcover);
  }
  if (options.renderLandcover ?? true)
    addTrees(group, collectTrees(tile, context, options), options);
  if (options.renderWater ?? true) {
    const water = createWaterMesh(tile, context, options);
    if (water !== undefined) group.add(water);
    const waterways = createWaterwayMesh(tile, context, options);
    if (waterways !== undefined) group.add(waterways);
  }
  if (options.renderTransportation ?? true) {
    group.add(
      options.surfaceRenderer?.createTile(tile, context) ??
        createTerrainSurfaceObject(tile, context, options.surfaces, options.materials?.road),
    );
  }
  if (options.renderBuildings ?? true) {
    const buildings = createBuildingMesh(tile, context, options);
    if (buildings !== undefined) group.add(buildings);
  }
  return group;
}

export interface DefaultTerrainSemanticRendererOptions extends TerrainSemanticMeshOptions {}

/** Reusable default renderer for createTerrainSemanticPyramidLayer. */
export function createDefaultTerrainSemanticRenderer(
  options: DefaultTerrainSemanticRendererOptions = {},
): TerrainSemanticTileRenderer {
  return {
    async createTile(tile, context): Promise<THREE.Group | undefined> {
      if (!options.surfaceRenderer || options.renderTransportation === false)
        return createTerrainSemanticObject(tile, context, options);
      // Await surfaces before publishing the tile, preserving streaming backpressure and idle
      // semantics. Cancellation cannot leave an untracked placeholder in the scene.
      const surfaces = await options.surfaceRenderer.createTileAsync(tile, context);
      if (!surfaces) return undefined;
      try {
        const group = createTerrainSemanticObject(tile, context, {
          ...options,
          renderTransportation: false,
        });
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
