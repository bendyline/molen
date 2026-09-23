import type { TerrainDescriptor } from './descriptor-types';
import { Heightfield } from './heightfield';
import { decodePng16, type Gray16 } from './png16';

/** Address of one fixed-grid terrain chunk. */
export interface TerrainTileAddress {
  x: number;
  z: number;
}

export function terrainTileKey(address: TerrainTileAddress): string {
  return `${address.x}_${address.z}`;
}

export function terrainTileOrigin(
  descriptor: TerrainDescriptor,
  address: TerrainTileAddress,
): [number, number] {
  return [
    descriptor.origin[0] + address.x * descriptor.chunkSize,
    descriptor.origin[1] + address.z * descriptor.chunkSize,
  ];
}

/** Build one tile-scoped Heightfield from a streamed height tile. */
export function heightfieldTileFromPng(
  descriptor: TerrainDescriptor,
  address: TerrainTileAddress,
  png: Uint8Array,
): Heightfield {
  if (
    !Number.isSafeInteger(address.x) ||
    !Number.isSafeInteger(address.z) ||
    address.x < 0 ||
    address.z < 0 ||
    address.x >= descriptor.gridSize[0] ||
    address.z >= descriptor.gridSize[1]
  ) {
    throw new Error(
      `terrain tile address must be inside grid ${descriptor.gridSize[0]}x${descriptor.gridSize[1]}, got ${address.x},${address.z}`,
    );
  }
  const grid = decodePng16(png);
  return new Heightfield(grid.data, grid.width, grid.height, {
    origin: terrainTileOrigin(descriptor, address),
    worldSize: [descriptor.chunkSize, descriptor.chunkSize],
    height: descriptor.height,
  });
}

/**
 * Decode one ancestor PNG16 tile and crop/resample the requested descendant into a tile-scoped
 * heightfield. Adjacent descendants share the same ancestor samples at their common border.
 */
export function heightfieldSubtileFromPng(
  descriptor: TerrainDescriptor,
  address: TerrainTileAddress,
  png: Uint8Array,
  subdivision: number,
  offset: TerrainTileAddress,
): Heightfield {
  return heightfieldSubtileFromGray16(descriptor, address, decodePng16(png), subdivision, offset);
}

/** Crop/resample a previously decoded ancestor grid into one descendant heightfield. */
export function heightfieldSubtileFromGray16(
  descriptor: TerrainDescriptor,
  address: TerrainTileAddress,
  source: Gray16,
  subdivision: number,
  offset: TerrainTileAddress,
): Heightfield {
  if (!Number.isSafeInteger(subdivision) || subdivision < 1) {
    throw new Error('terrain subtile subdivision must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(offset.x) ||
    !Number.isSafeInteger(offset.z) ||
    offset.x < 0 ||
    offset.z < 0 ||
    offset.x >= subdivision ||
    offset.z >= subdivision
  ) {
    throw new Error(`terrain subtile offset must be inside ${subdivision}x${subdivision}`);
  }
  if (
    !Number.isSafeInteger(address.x) ||
    !Number.isSafeInteger(address.z) ||
    address.x < 0 ||
    address.z < 0 ||
    address.x >= descriptor.gridSize[0] ||
    address.z >= descriptor.gridSize[1]
  ) {
    throw new Error(
      `terrain tile address must be inside grid ${descriptor.gridSize[0]}x${descriptor.gridSize[1]}, got ${address.x},${address.z}`,
    );
  }
  const resolution = descriptor.tileResolution;
  const output = new Float32Array(resolution * resolution);
  const at = (column: number, row: number): number =>
    source.data[
      Math.max(0, Math.min(source.height - 1, row)) * source.width +
        Math.max(0, Math.min(source.width - 1, column))
    ] as number;
  for (let row = 0; row < resolution; row++) {
    const localV = row / (resolution - 1);
    const sourceV = (offset.z + localV) / subdivision;
    const gy = sourceV * (source.height - 1);
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let column = 0; column < resolution; column++) {
      const localU = column / (resolution - 1);
      const sourceU = (offset.x + localU) / subdivision;
      const gx = sourceU * (source.width - 1);
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
      output[row * resolution + column] = top + (bottom - top) * fy;
    }
  }
  return new Heightfield(output, resolution, resolution, {
    origin: terrainTileOrigin(descriptor, address),
    worldSize: [descriptor.chunkSize, descriptor.chunkSize],
    height: descriptor.height,
  });
}
