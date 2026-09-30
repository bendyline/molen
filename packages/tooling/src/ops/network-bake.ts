/**
 * Bake the roads, railways and paths of a local terrain package into a
 * `molen/transport-network@1` document, so a scene without streamed map tiles can run ambient
 * traffic on real streets. Tiles load at the features sidecar's finest level, stitch across their
 * borders, and are recentred on the baked area (its geographic centre is recorded as `origin`).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  networkToDocument,
  TransportNetwork,
  type TransportNetworkDocument,
} from '@bendyline/molen-ambient/kernel';
import { validateByKind } from '@bendyline/molen-schema';
import {
  type TerrainPackageArchiveSource,
  type TerrainPackageDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
  wgs84ToWebMercatorTile,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { parseJson } from './build';
import { guardOp } from './errors';
import { openNodePmtiles } from './pmtiles-node';

export interface NetworkBakeInput {
  /** terrain-package.json path (local PMTiles archives). */
  packagePath: string;
  /** Centre tile "z/x/y" (at the features sidecar's finest level). */
  tile?: string;
  /** Tiles around the centre tile to include (default 0: just the tile). */
  radius?: number;
  /** Area [west, south, east, north] in degrees, instead of `tile`. */
  bbox?: [number, number, number, number];
  /** Classes to keep (default road, rail and path). */
  classes?: ('road' | 'rail' | 'path')[];
  /** Write the document here. */
  outPath: string;
  /** Include surface heights from the package elevation (default false: flat ground). */
  heights?: boolean;
}

export interface NetworkBakeOutput {
  ok: boolean;
  path?: string;
  tiles?: number;
  ways?: number;
  classes?: Record<string, number>;
  origin?: { latitude: number; longitude: number };
  warnings?: string[];
  error?: string;
}

const MAX_TILES = 64;

type TerrainClientModule = typeof import('@bendyline/molen-terrain/client');

function archivePath(source: TerrainPackageArchiveSource): string {
  if (source.kind === 'pmtiles-set' || !('path' in source))
    throw new Error('network bake reads single local PMTiles archives only');
  return source.path;
}

function parseTile(text: string): TerrainPyramidTileAddress {
  const parts = text.split('/').map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isSafeInteger(value) || value < 0))
    throw new Error(`tile must be "z/x/y", got "${text}"`);
  return { level: parts[0] as number, x: parts[1] as number, z: parts[2] as number };
}

/** Bake a terrain package's transport features into a transport-network document. */
export function bakeNetwork(input: NetworkBakeInput): Promise<NetworkBakeOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => bakeNetworkImpl(input),
  );
}

async function bakeNetworkImpl(input: NetworkBakeInput): Promise<NetworkBakeOutput> {
  const packagePath = resolve(input.packagePath);
  const parsed = validateByKind('terrain-package', parseJson(await readFile(packagePath, 'utf8')));
  if (!parsed.ok) return { ok: false, error: parsed.formatted };
  const pkg = parsed.value as TerrainPackageDescriptor;
  if (pkg.features === undefined)
    return { ok: false, error: 'the package has no features sidecar' };
  if (input.tile === undefined && input.bbox === undefined)
    return { ok: false, error: 'pass tile (z/x/y) or bbox (west,south,east,north)' };
  const dir = dirname(packagePath);
  const terrain: TerrainClientModule = await import('@bendyline/molen-terrain/client');
  const elevation = openNodePmtiles(resolve(dir, archivePath(pkg.elevation.source)));
  const featuresPath = resolve(dir, archivePath(pkg.features.source));
  const features = openNodePmtiles(featuresPath);
  const landcoverPath =
    pkg.landcover !== undefined ? resolve(dir, archivePath(pkg.landcover.source)) : undefined;
  const landcover =
    landcoverPath === undefined
      ? undefined
      : landcoverPath === featuresPath
        ? features
        : openNodePmtiles(landcoverPath);
  const warnings: string[] = [];
  try {
    const pyramid = await terrain.openTerrainPackagePyramid(pkg, { archive: elevation.archive });
    const semantics = await terrain.openTerrainPackageSemantics(pkg, {
      decoder: terrain.createProtomapsTerrainMvtDecoder(),
      featuresArchive: features.archive,
      ...(landcover !== undefined ? { landcoverArchive: landcover.archive } : {}),
    });
    const sidecar = semantics.features;
    if (sidecar === undefined) return { ok: false, error: 'the features sidecar did not open' };
    const level = sidecar.maxLevel;
    const addresses: TerrainPyramidTileAddress[] = [];
    if (input.tile !== undefined) {
      const centre = parseTile(input.tile);
      if (centre.level !== level)
        warnings.push(`tile level ${centre.level} is not the finest features level ${level}`);
      const r = Math.max(0, Math.floor(input.radius ?? 0));
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          addresses.push({ level: centre.level, x: centre.x + dx, z: centre.z + dz });
    } else {
      const [west, south, east, north] = input.bbox as [number, number, number, number];
      const a = wgs84ToWebMercatorTile(west, north, level);
      const b = wgs84ToWebMercatorTile(east, south, level);
      for (let z = Math.min(a.y, b.y); z <= Math.max(a.y, b.y); z++)
        for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
          addresses.push({ level, x, z });
    }
    if (addresses.length > MAX_TILES)
      return { ok: false, error: `${addresses.length} tiles requested; at most ${MAX_TILES}` };
    const descriptor = pyramid.descriptor;
    const origins = addresses.map((address) => terrainPyramidTileOrigin(descriptor, address));
    const sizes = addresses.map((address) => terrainPyramidTileSize(descriptor, address.level));
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    origins.forEach((o, i) => {
      minX = Math.min(minX, o[0]);
      minZ = Math.min(minZ, o[1]);
      maxX = Math.max(maxX, o[0] + (sizes[i] as number));
      maxZ = Math.max(maxZ, o[1] + (sizes[i] as number));
    });
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const classes = new Set(input.classes ?? ['road', 'rail', 'path']);
    const network = new TransportNetwork({
      classes: [
        ...(classes.has('road') ? (['road'] as const) : []),
        ...(classes.has('rail') ? (['rail'] as const) : []),
        ...(classes.has('path') ? (['walk'] as const) : []),
      ],
    });
    let loaded = 0;
    for (const [i, address] of addresses.entries()) {
      const signal = new AbortController().signal;
      const tile = await sidecar.source.load(address, signal);
      if (tile === undefined) {
        warnings.push(`no features at ${address.level}/${address.x}/${address.z}`);
        continue;
      }
      const origin = origins[i] as [number, number];
      const heightfield =
        input.heights === true ? await pyramid.source.load(address, signal) : undefined;
      network.registerTile({
        key: `${address.level}/${address.x}/${address.z}`,
        origin: [origin[0] - cx, origin[1] - cz],
        tileSize: sizes[i] as number,
        features: tile.transportation,
        ...(tile.pois !== undefined ? { pois: tile.pois } : {}),
        sidewalks: false,
        ...(heightfield !== undefined
          ? { heightAt: (x: number, z: number) => heightfield.sampleHeight(x + cx, z + cz) }
          : {}),
      });
      loaded++;
    }
    const [longitude, latitude] = worldToWgs84(descriptor.metersPerUnit ?? 1, cx, cz);
    const round = (v: number): number => Math.round(v * 1e6) / 1e6;
    const origin = { latitude: round(latitude), longitude: round(longitude) };
    const doc: TransportNetworkDocument = networkToDocument(
      network,
      { name: `${pkg.name} transport network`, origin },
      { heights: input.heights === true },
    );
    const counts: Record<string, number> = {};
    for (const way of doc.ways) counts[way.class] = (counts[way.class] ?? 0) + 1;
    const outPath = resolve(input.outPath);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(doc)}\n`);
    return {
      ok: true,
      path: outPath,
      tiles: loaded,
      ways: doc.ways.length,
      classes: counts,
      origin,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } finally {
    await elevation.close();
    await features.close();
    if (landcover !== undefined && landcover !== features) await landcover.close();
  }
}
