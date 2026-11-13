/**
 * Land cover as a texture, for tiles far enough away that nothing finer than a few meters shows.
 *
 * The draped land cover mesh clips every polygon to the terrain grid and carries seven attributes
 * a vertex (88 bytes) for crop rows, class blends and ground detail. On a distant tile none of
 * that can be seen, yet it was the largest share of a view's triangles and geometry memory and its
 * slowest layer to build. Here the same classes are painted into a small texture, with the tile's
 * mapped roads and building footprints over them, and drawn on one copy of the terrain grid.
 */
import * as THREE from 'three';
import { cloneTerrainGroundMaterial } from './ground-material';
import type { Heightfield } from './heightfield';
import { rasterizeLandcoverFeatures } from './landcover-blend';
import { chunkNormalAt, terrainTopology } from './mesh';
import type {
  TerrainBuildingFeature,
  TerrainLandcoverFeature,
  TerrainSemanticPolygon,
  TerrainTransportationFeature,
} from './semantic-types';
import { transportKind, transportWidth } from './transport-features';

export interface TerrainLandcoverRasterOptions {
  /**
   * Tiles at least this many levels coarser than the pyramid's finest level draw the texture
   * (default 2). Nearer tiles keep the draped mesh, with its crop rows and soft class edges.
   */
  minDepth?: number;
  /** Texels across a tile (default 256, a power of two from 32 to 1024). */
  size?: number;
  /**
   * Paint the tile's mapped roads and building footprints over the land cover (default true), so
   * a town past the range of road and building geometry still reads as one.
   */
  features?: boolean;
  /** Road and roof colors for `features` (defaults: asphalt gray and a neutral roof). */
  roadColor?: string;
  roofColor?: string;
  /**
   * Tint wooded classes toward `color` (default a dark canopy green) by `cover` (default 0.6),
   * varied texel by texel, on tiles at least `minDepth` levels coarser than the finest. For the
   * tiles past the range a host places trees in: a wood otherwise changed there from dark crowns
   * to its pale ground color, along the straight edge of a tile. Omitted, woods keep their color.
   */
  canopy?: { minDepth: number; color?: string; cover?: number };
}

/** What a worker returns for a raster tile: every array is transferable. */
export interface TerrainLandcoverRasterData {
  size: number;
  /** sRGB RGBA rows from the tile's z = 0 edge; alpha 0 where no land cover lies. */
  pixels: Uint8Array;
  /** Every texel is covered, so the tile draws without an alpha test. */
  opaque: boolean;
  /** Grid vertices per edge, then the grid itself in tile-local X/Z and world Y. */
  verts: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  height: [min: number, max: number];
}

const DEFAULT_SIZE = 256;
const DEFAULT_ROAD = '#74767a';
const DEFAULT_ROOF = '#8f8c86';
const DEFAULT_CANOPY = '#27452f';
const DEFAULT_CANOPY_COVER = 0.6;

/**
 * The canopy tint for a tile `depth` levels coarser than the finest: a function blending a wooded
 * class's color toward the canopy at a world position, or undefined where woods keep their color.
 * Changes and returns the color it is given.
 */
export function landcoverCanopyTint(
  raster: TerrainLandcoverRasterOptions | undefined,
  depth: number,
): ((color: THREE.Color, worldX: number, worldZ: number) => THREE.Color) | undefined {
  const canopy = raster?.canopy;
  if (canopy === undefined || depth < canopy.minDepth) return undefined;
  const crown = new THREE.Color(canopy.color ?? DEFAULT_CANOPY);
  const cover = Math.min(1, Math.max(0, canopy.cover ?? DEFAULT_CANOPY_COVER));
  return (color, worldX, worldZ) => {
    // Clumps of crowns and gaps: 0.7 to 1.3 of the cover, from a hash of the position.
    const hash = Math.sin(worldX * 12.9898 + worldZ * 78.233) * 43758.5453;
    return color.lerp(crown, Math.min(1, cover * (0.7 + 0.6 * (hash - Math.floor(hash)))));
  };
}
/** Share of a fully covered texel a road or roof takes: some ground shows between at this scale. */
const ROAD_SHARE = 0.9;
const ROOF_SHARE = 0.8;

/** The texture size for `context`'s tile, or undefined where the draped mesh is drawn. */
export function landcoverRasterSize(
  raster: TerrainLandcoverRasterOptions | undefined,
  level: number,
  maxLevel: number,
): number | undefined {
  if (raster === undefined || maxLevel - level < (raster.minDepth ?? 2)) return undefined;
  const size = raster.size ?? DEFAULT_SIZE;
  if (!Number.isInteger(size) || size < 32 || size > 1024 || (size & (size - 1)) !== 0)
    throw new RangeError('Land cover raster size must be a power of two from 32 to 1024');
  return size;
}

const srgb = (linear: number): number => {
  const c = Math.min(1, Math.max(0, linear));
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
};

/**
 * Paint ordered land cover features (later ones over earlier, as the draped mesh resolves them).
 * `colors[i]` is feature i's linear color, or a function of normalized tile coordinates.
 */
export function paintLandcoverRaster(
  features: readonly TerrainLandcoverFeature[],
  size: number,
  colors: ReadonlyArray<THREE.Color | ((u: number, v: number) => THREE.Color)>,
): { pixels: Uint8Array; opaque: boolean } {
  const cells = rasterizeLandcoverFeatures(features, size, 0);
  const pixels = new Uint8Array(size * size * 4);
  const fixed = colors.map((color) =>
    typeof color === 'function' ? undefined : [srgb(color.r), srgb(color.g), srgb(color.b)],
  );
  let opaque = true;
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const index = row * size + col;
      const feature = cells[index] as number;
      if (feature < 0) {
        opaque = false;
        continue;
      }
      const at = index * 4;
      const constant = fixed[feature];
      if (constant !== undefined) {
        pixels[at] = constant[0] as number;
        pixels[at + 1] = constant[1] as number;
        pixels[at + 2] = constant[2] as number;
      } else {
        const color = (colors[feature] as (u: number, v: number) => THREE.Color)(
          (col + 0.5) / size,
          (row + 0.5) / size,
        );
        pixels[at] = srgb(color.r);
        pixels[at + 1] = srgb(color.g);
        pixels[at + 2] = srgb(color.b);
      }
      pixels[at + 3] = 255;
    }
  if (!opaque) bleed(pixels, size);
  return { pixels, opaque };
}

/**
 * Give each uncovered texel beside a covered one its neighbor's color (alpha stays 0): bilinear
 * filtering reads across the edge, and black there drew a dark fringe round every gap.
 */
function bleed(pixels: Uint8Array, size: number): void {
  const source = pixels.slice();
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const at = (row * size + col) * 4;
      if (source[at + 3] !== 0) continue;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const c = col + dc,
          r = row + dr;
        if (c < 0 || r < 0 || c >= size || r >= size) continue;
        const from = (r * size + c) * 4;
        if (source[from + 3] === 0) continue;
        pixels[at] = source[from] as number;
        pixels[at + 1] = source[from + 1] as number;
        pixels[at + 2] = source[from + 2] as number;
        break;
      }
    }
}

/** Blend `color` over the covered texels by `cover` (0..255 a texel) times `share`. */
function composite(pixels: Uint8Array, cover: Uint8Array, color: THREE.Color, share: number): void {
  const r = srgb(color.r),
    g = srgb(color.g),
    b = srgb(color.b);
  for (let i = 0; i < cover.length; i++) {
    const amount = ((cover[i] as number) / 255) * share;
    if (amount <= 0 || pixels[i * 4 + 3] === 0) continue;
    const at = i * 4;
    pixels[at] = Math.round((pixels[at] as number) * (1 - amount) + r * amount);
    pixels[at + 1] = Math.round((pixels[at + 1] as number) * (1 - amount) + g * amount);
    pixels[at + 2] = Math.round((pixels[at + 2] as number) * (1 - amount) + b * amount);
  }
}

/**
 * Roads as lines of their mapped width, each texel taking the share of it the road covers: a
 * street narrower than a texel tints it rather than filling it, so a street grid reads as a
 * texture and not as a net of thick lines. Paths, railways and tunnels are left out.
 */
function roadCover(
  roads: readonly TerrainTransportationFeature[],
  size: number,
  tileSize: number,
): Uint8Array | undefined {
  const cover = new Uint8Array(size * size);
  const texel = tileSize / size;
  let any = false;
  for (const road of roads) {
    if (road.tunnel === true || (road.layer ?? 0) < 0) continue;
    const kind = transportKind(road);
    if (kind === 'path' || kind === 'rail') continue;
    const width = transportWidth(road, kind) / texel;
    const half = width / 2;
    const most = Math.min(1, width);
    for (const line of road.lines)
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i] as readonly [number, number],
          b = line[i + 1] as readonly [number, number];
        const ax = a[0] * size - 0.5,
          ay = a[1] * size - 0.5,
          bx = b[0] * size - 0.5,
          by = b[1] * size - 0.5;
        const reach = half + 1;
        const col0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach)),
          col1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx) + reach)),
          row0 = Math.max(0, Math.floor(Math.min(ay, by) - reach)),
          row1 = Math.min(size - 1, Math.ceil(Math.max(ay, by) + reach));
        const dx = bx - ax,
          dy = by - ay,
          length = dx * dx + dy * dy;
        for (let row = row0; row <= row1; row++)
          for (let col = col0; col <= col1; col++) {
            const t =
              length > 0
                ? Math.max(0, Math.min(1, ((col - ax) * dx + (row - ay) * dy) / length))
                : 0;
            const distance = Math.hypot(col - ax - t * dx, row - ay - t * dy);
            const amount = Math.min(most, Math.max(0, half + 0.5 - distance));
            if (amount <= 0) continue;
            const index = row * size + col;
            const value = Math.round(amount * 255);
            if (value > (cover[index] as number)) {
              cover[index] = value;
              any = true;
            }
          }
      }
  }
  return any ? cover : undefined;
}

/** Footprints sampled twice a texel each way, so a house smaller than a texel still tints it. */
function roofCover(
  buildings: readonly TerrainBuildingFeature[],
  size: number,
): Uint8Array | undefined {
  const polygons: TerrainSemanticPolygon[] = [];
  for (const building of buildings) {
    if ((building.layer ?? 0) < 0) continue;
    polygons.push(...building.polygons);
  }
  if (polygons.length === 0) return undefined;
  const fine = size * 2;
  const cells = rasterizeLandcoverFeatures([{ polygons }], fine, 0);
  const cover = new Uint8Array(size * size);
  let any = false;
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const at = row * 2 * fine + col * 2;
      const hits =
        ((cells[at] as number) >= 0 ? 1 : 0) +
        ((cells[at + 1] as number) >= 0 ? 1 : 0) +
        ((cells[at + fine] as number) >= 0 ? 1 : 0) +
        ((cells[at + fine + 1] as number) >= 0 ? 1 : 0);
      if (hits === 0) continue;
      cover[row * size + col] = Math.round((hits / 4) * 255);
      any = true;
    }
  return any ? cover : undefined;
}

/** Paint a tile's roads, then its roofs, over `pixels` (see `TerrainLandcoverRasterOptions`). */
export function paintLandcoverFeatures(
  pixels: Uint8Array,
  size: number,
  tileSize: number,
  roads: readonly TerrainTransportationFeature[],
  buildings: readonly TerrainBuildingFeature[],
  options: Pick<TerrainLandcoverRasterOptions, 'roadColor' | 'roofColor'> = {},
): void {
  const road = roadCover(roads, size, tileSize);
  if (road !== undefined)
    composite(pixels, road, new THREE.Color(options.roadColor ?? DEFAULT_ROAD), ROAD_SHARE);
  const roof = roofCover(buildings, size);
  if (roof !== undefined)
    composite(pixels, roof, new THREE.Color(options.roofColor ?? DEFAULT_ROOF), ROOF_SHARE);
}

/**
 * The terrain grid a raster tile is drawn on: the vertices of the tile's rendered surface, lifted
 * by `offset` like draped land cover, with texture coordinates across the tile.
 */
export function landcoverRasterGrid(
  heightfield: Heightfield,
  origin: readonly [number, number],
  tileSize: number,
  verts: number,
  offset: number,
): Pick<TerrainLandcoverRasterData, 'verts' | 'positions' | 'normals' | 'uvs' | 'height'> {
  const positions = new Float32Array(verts * verts * 3);
  const normals = new Float32Array(verts * verts * 3);
  const uvs = new Float32Array(verts * verts * 2);
  const cell = tileSize / (verts - 1);
  let min = Number.POSITIVE_INFINITY,
    max = Number.NEGATIVE_INFINITY;
  for (let row = 0; row < verts; row++)
    for (let col = 0; col < verts; col++) {
      const index = row * verts + col;
      const x = col * cell,
        z = row * cell;
      const y = heightfield.sampleHeight(origin[0] + x, origin[1] + z) + offset;
      positions.set([x, y, z], index * 3);
      normals.set(chunkNormalAt(heightfield, origin[0] + x, origin[1] + z), index * 3);
      uvs.set([col / (verts - 1), row / (verts - 1)], index * 2);
      if (y < min) min = y;
      if (y > max) max = y;
    }
  return { verts, positions, normals, uvs, height: [min, max] };
}

/**
 * The mesh for one raster tile. `material` is the host's shared ground texture material
 * (`createTerrainGroundTextureMaterial`); the tile draws with a copy carrying its own texture,
 * which the mesh owns together with its geometry.
 */
export function createLandcoverRasterMesh(
  data: TerrainLandcoverRasterData,
  tileSize: number,
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(terrainTopology(data.verts, false), 1));
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(0, data.height[0], 0),
    new THREE.Vector3(tileSize, data.height[1], tileSize),
  );
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const texture = new THREE.DataTexture(data.pixels, data.size, data.size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  const own = cloneTerrainGroundMaterial(material) as THREE.MeshStandardMaterial;
  own.map = texture;
  own.alphaTest = data.opaque ? 0 : 0.5;
  const mesh = new THREE.Mesh(geometry, own);
  mesh.name = 'semantic:landcover';
  mesh.receiveShadow = true;
  mesh.userData.shadowCaster = false;
  mesh.renderOrder = 1;
  mesh.userData.terrainOwnedGeometry = true;
  mesh.userData.terrainOwnedMaterial = true;
  mesh.userData.terrainOwnedTexture = true;
  mesh.userData.terrainLandcoverRaster = true;
  return mesh;
}
