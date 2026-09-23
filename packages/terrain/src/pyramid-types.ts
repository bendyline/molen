import type { TerrainLayer } from './descriptor-types';

/** Address of one square tile in a root-quad terrain pyramid. */
export interface TerrainPyramidTileAddress {
  level: number;
  x: number;
  z: number;
}

/**
 * Coordinate-independent contract for a square planar terrain pyramid.
 *
 * Earth packages, invented worlds, and generated game maps all adapt to this shape. Geographic
 * projection and archive addressing deliberately stay outside this type.
 */
export interface TerrainPyramidDescriptor {
  name: string;
  /** World X/Z of the north-west/root minimum corner. */
  origin: [number, number];
  /** Width and depth of the level-zero square, in world units. */
  rootSize: number;
  minLevel: number;
  maxLevel: number;
  tileResolution: number;
  height: { min: number; max: number };
  layers: TerrainLayer[];
  skirts: boolean;
  /** Optional data coverage inside the root square: [minX,minZ,maxX,maxZ]. */
  coverage?: [number, number, number, number];
  /**
   * World meters per unit of the source's projected space (see TerrainDescriptor). Origin,
   * rootSize, and coverage are already multiplied by it; absent = 1.
   */
  metersPerUnit?: number;
}

export function terrainPyramidTileKey(address: TerrainPyramidTileAddress): string {
  return `${address.level}/${address.x}/${address.z}`;
}

export function terrainPyramidTileCount(level: number): number {
  if (!Number.isSafeInteger(level) || level < 0 || level > 30) {
    throw new Error('terrain pyramid level must be a safe integer from 0 through 30');
  }
  return 2 ** level;
}

export function terrainPyramidTileSize(
  descriptor: TerrainPyramidDescriptor,
  level: number,
): number {
  return descriptor.rootSize / terrainPyramidTileCount(level);
}

export function assertTerrainPyramidAddress(
  descriptor: TerrainPyramidDescriptor,
  address: TerrainPyramidTileAddress,
): void {
  const count = terrainPyramidTileCount(address.level);
  if (
    address.level < 0 ||
    address.level > descriptor.maxLevel ||
    !Number.isSafeInteger(address.x) ||
    !Number.isSafeInteger(address.z) ||
    address.x < 0 ||
    address.z < 0 ||
    address.x >= count ||
    address.z >= count
  ) {
    throw new Error(
      `terrain pyramid tile ${terrainPyramidTileKey(address)} is outside levels 0-${descriptor.maxLevel}`,
    );
  }
}

export function terrainPyramidTileOrigin(
  descriptor: TerrainPyramidDescriptor,
  address: TerrainPyramidTileAddress,
): [number, number] {
  assertTerrainPyramidAddress(descriptor, address);
  const size = terrainPyramidTileSize(descriptor, address.level);
  return [descriptor.origin[0] + address.x * size, descriptor.origin[1] + address.z * size];
}

export function terrainPyramidParent(
  address: TerrainPyramidTileAddress,
): TerrainPyramidTileAddress | undefined {
  if (address.level === 0) return undefined;
  return {
    level: address.level - 1,
    x: Math.floor(address.x / 2),
    z: Math.floor(address.z / 2),
  };
}

export function terrainPyramidAncestor(
  address: TerrainPyramidTileAddress,
  level: number,
): TerrainPyramidTileAddress {
  if (!Number.isSafeInteger(level) || level < 0 || level > address.level) {
    throw new Error(`terrain pyramid ancestor level must be between 0 and ${address.level}`);
  }
  const scale = 2 ** (address.level - level);
  return {
    level,
    x: Math.floor(address.x / scale),
    z: Math.floor(address.z / scale),
  };
}

export function terrainPyramidAddressAt(
  descriptor: TerrainPyramidDescriptor,
  level: number,
  x: number,
  z: number,
): TerrainPyramidTileAddress | undefined {
  const count = terrainPyramidTileCount(level);
  const size = descriptor.rootSize / count;
  const tileX = Math.floor((x - descriptor.origin[0]) / size);
  const tileZ = Math.floor((z - descriptor.origin[1]) / size);
  if (tileX < 0 || tileZ < 0 || tileX >= count || tileZ >= count) return undefined;
  return { level, x: tileX, z: tileZ };
}
