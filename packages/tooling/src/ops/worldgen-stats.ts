/**
 * Generate one real terrain-package tile in Node and report what worldgen made of it: counts,
 * footprint and roof histograms, styles, placements, buffer sizes, timings, and a determinism
 * check (the tile is generated twice). `dumpPath` writes the adapted `molen/worldgen-batch@1`
 * so a real tile can feed `worldgen preview` and `worldgen bake`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { formatIssues, validateByKind } from '@bendyline/molen-schema';
import type {
  TerrainPackageArchiveSource,
  TerrainPackageDescriptor,
  TerrainPyramidTileAddress,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
  wgs84ToWebMercatorTile,
} from '@bendyline/molen-terrain/kernel';
import {
  generateWorldgenBatch,
  type Vec2,
  type WorldgenBatchDoc,
  type WorldgenBatchOutput,
  type WorldgenStats,
} from '@bendyline/molen-worldgen/kernel';
import {
  createRegionResolver,
  type RegionAtlasDoc,
  semanticTileToBatch,
  type TileGeometry,
  tileGroundSampler,
  type WorldgenQualityPreset,
  worldgenTileBudgetForQuality,
} from '@bendyline/molen-worldgen-earth/kernel';
import { parseJson } from './build';
import { guardOp } from './errors';
import { openNodePmtiles } from './pmtiles-node';
import { loadRegionAtlasFromDisk, loadStylePackFromDisk } from './worldgen-pack';

export interface WorldgenStatsInput {
  /** terrain-package.json path. */
  packagePath: string;
  /** "z/x/y" tile address; omit to use the tile at the package center (`auto` searches around it). */
  tile?: string;
  /** Search the 9x9 tiles around the center for the one with the most buildings. */
  auto?: boolean;
  packPath?: string;
  atlasPath?: string;
  /** Force every building onto this style id. */
  styleId?: string;
  quality?: WorldgenQualityPreset;
  /** Write the adapted batch document here. */
  dumpPath?: string;
}

export interface WorldgenStatsOutput {
  ok: boolean;
  tile?: { level: number; x: number; y: number };
  region?: string;
  scatter?: string;
  source?: { buildings: number; landcover: number; roads: number; water: number };
  stats?: WorldgenStats;
  skippedByOwnership?: number;
  clippedPieces?: number;
  /** Buildings whose identity came from a quantized centroid (no feature id in the source). */
  buildingsWithoutIds?: number;
  placements?: { modelRef: string; count: number }[];
  generateMs?: { first: number; second: number };
  hash?: string;
  deterministic?: boolean;
  dumpPath?: string;
  warnings?: string[];
  error?: string;
}

type TerrainClientModule = typeof import('@bendyline/molen-terrain/client');

/** Local archive path of a package source; remote archives are not read by this Node op. */
function archivePath(source: TerrainPackageArchiveSource): string {
  if ('path' in source) return source.path;
  throw new Error(`archive ${source.url} is remote; worldgen stats reads local packages only`);
}

function parseTile(text: string): TerrainPyramidTileAddress {
  const parts = text.split('/').map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`tile must be "z/x/y", got "${text}"`);
  }
  return { level: parts[0] as number, x: parts[1] as number, z: parts[2] as number };
}

export function worldgenStats(input: WorldgenStatsInput): Promise<WorldgenStatsOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => worldgenStatsImpl(input),
  );
}

async function worldgenStatsImpl(input: WorldgenStatsInput): Promise<WorldgenStatsOutput> {
  const packagePath = resolve(input.packagePath);
  const parsed = validateByKind('terrain-package', parseJson(await readFile(packagePath, 'utf8')));
  if (!parsed.ok) return { ok: false, error: parsed.formatted };
  const pkg = parsed.value as TerrainPackageDescriptor;
  if (pkg.landcover === undefined && pkg.features === undefined) {
    return { ok: false, error: 'the package declares no landcover or features sidecar' };
  }
  const dir = dirname(packagePath);
  const terrain: TerrainClientModule = await import('@bendyline/molen-terrain/client');
  const warnings: string[] = [];

  const archives = new Map<string, ReturnType<typeof openNodePmtiles>>();
  const archiveFor = (path: string): ReturnType<typeof openNodePmtiles> => {
    let opened = archives.get(path);
    if (opened === undefined) {
      opened = openNodePmtiles(resolve(dir, path));
      archives.set(path, opened);
    }
    return opened;
  };
  try {
    const pyramid = await terrain.openTerrainPackagePyramid(pkg, {
      archive: archiveFor(archivePath(pkg.elevation.source)).archive,
    });
    const decoder = terrain.createProtomapsTerrainMvtDecoder();
    const semantics = await terrain.openTerrainPackageSemantics(pkg, {
      decoder,
      ...(pkg.landcover !== undefined
        ? { landcoverArchive: archiveFor(archivePath(pkg.landcover.source)).archive }
        : {}),
      ...(pkg.features !== undefined
        ? { featuresArchive: archiveFor(archivePath(pkg.features.source)).archive }
        : {}),
    });
    const sidecars = [semantics.landcover, semantics.features].filter(
      (sidecar) => sidecar !== undefined,
    );
    const maxLevel = Math.min(pyramid.descriptor.maxLevel, ...sidecars.map((s) => s.maxLevel));
    const minLevel = Math.max(pyramid.descriptor.minLevel, ...sidecars.map((s) => s.minLevel));
    const combined =
      semantics.landcover !== undefined &&
      semantics.features !== undefined &&
      semantics.landcover.archive === semantics.features.archive
        ? terrain.createTerrainPackageCombinedSemanticSource(
            pkg,
            semantics.landcover.archive,
            decoder,
            { minLevel, maxLevel },
          )
        : undefined;
    const loadTile = async (
      address: TerrainPyramidTileAddress,
    ): Promise<TerrainSemanticTile | undefined> => {
      const signal = new AbortController().signal;
      if (combined !== undefined) return combined.load(address, signal);
      const parts = await Promise.all(sidecars.map((s) => s.source.load(address, signal)));
      const merged = parts.find((part) => part !== undefined);
      if (merged === undefined) return undefined;
      for (const part of parts) {
        if (part === undefined || part === merged) continue;
        merged.landcover.push(...part.landcover);
        merged.buildings.push(...part.buildings);
        merged.transportation.push(...part.transportation);
        merged.water.push(...part.water);
      }
      return merged;
    };

    let address: TerrainPyramidTileAddress;
    let tile: TerrainSemanticTile | undefined;
    if (input.tile !== undefined) {
      address = parseTile(input.tile);
      tile = await loadTile(address);
      if (tile === undefined) return { ok: false, error: `no semantic data at ${input.tile}` };
    } else {
      if (pkg.coordinateSpace.kind !== 'geospatial') {
        return { ok: false, error: 'pass --tile for local (non-geospatial) packages' };
      }
      const [west, south, east, north] = pkg.coordinateSpace.bounds;
      const centre = wgs84ToWebMercatorTile((west + east) / 2, (south + north) / 2, maxLevel);
      let best: { address: TerrainPyramidTileAddress; tile: TerrainSemanticTile } | undefined;
      const radius = input.auto === true ? 4 : 0;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const candidate = { level: maxLevel, x: centre.x + dx, z: centre.y + dz };
          const loaded = await loadTile(candidate);
          if (loaded === undefined) continue;
          if (best === undefined || loaded.buildings.length > best.tile.buildings.length) {
            best = { address: candidate, tile: loaded };
          }
        }
      }
      if (best === undefined) return { ok: false, error: 'no semantic tiles near the center' };
      address = best.address;
      tile = best.tile;
    }

    const heightfield = await pyramid.source.load(address, new AbortController().signal);
    if (heightfield === undefined) {
      return {
        ok: false,
        error: `no elevation tile at ${address.level}/${address.x}/${address.z}`,
      };
    }
    const descriptor = pyramid.descriptor;
    const origin = terrainPyramidTileOrigin(descriptor, address);
    const geom: TileGeometry = {
      level: address.level,
      x: address.x,
      z: address.z,
      originX: origin[0],
      originZ: origin[1],
      size: terrainPyramidTileSize(descriptor, address.level),
      metersPerUnit: descriptor.metersPerUnit ?? 1,
      levelBelowMax: Math.max(0, maxLevel - address.level),
    };
    const { pack } = await loadStylePackFromDisk(input.packPath);
    if (input.styleId !== undefined && pack.archstyles[input.styleId] === undefined) {
      return { ok: false, error: `style "${input.styleId}" is not in the pack` };
    }
    const atlas: RegionAtlasDoc = await loadRegionAtlasFromDisk(input.atlasPath);
    const regions = createRegionResolver(atlas, { metersPerUnit: geom.metersPerUnit });
    const quality = input.quality ?? 'balanced';
    const batch = semanticTileToBatch(tile, geom, {
      pack,
      atlas,
      regions,
      budgets: worldgenTileBudgetForQuality(quality, geom.levelBelowMax),
      tierOffset: quality === 'economy' ? 1 : 0,
    });
    if (input.styleId !== undefined) {
      for (const building of batch.buildings) building.style = input.styleId;
    }
    const ground = tileGroundSampler(heightfield, geom);
    const generate = (): { output: WorldgenBatchOutput; ms: number } => {
      const started = performance.now();
      const output = generateWorldgenBatch({ ...batch, ground });
      return { output, ms: performance.now() - started };
    };
    const first = generate();
    const second = generate();
    const withoutIds = batch.buildings.filter((building) =>
      building.identity.startsWith('c:'),
    ).length;
    if (withoutIds > 0) {
      warnings.push(
        `${withoutIds} of ${batch.buildings.length} buildings carry no source id; identities fall back to quantized centroids`,
      );
    }
    if (first.output.stats.buildingsDropped > 0) {
      warnings.push(`${first.output.stats.buildingsDropped} buildings dropped by the tile budget`);
    }
    let dumpPath: string | undefined;
    if (input.dumpPath !== undefined) {
      const centreHeight = heightfield.sampleHeight(
        geom.originX + geom.size / 2,
        geom.originZ + geom.size / 2,
      );
      // Clipped pieces of one feature share an identity on purpose (same look across the seam);
      // a batch document needs unique identities, so pieces get a suffix in the dump.
      const seen = new Map<string, number>();
      const round = (point: Vec2): Vec2 => [
        Math.round(point[0] * 100) / 100,
        Math.round(point[1] * 100) / 100,
      ];
      const buildings = batch.buildings.map((building) => {
        const count = seen.get(building.identity) ?? 0;
        seen.set(building.identity, count + 1);
        return {
          ...building,
          identity: count === 0 ? building.identity : `${building.identity}|piece:${count}`,
          outline: building.outline.map(round),
          ...(building.holes !== undefined
            ? { holes: building.holes.map((hole) => hole.map(round)) }
            : {}),
        };
      });
      const doc: WorldgenBatchDoc = {
        format: 'molen/worldgen-batch@1',
        name: `${pkg.name} ${address.level}/${address.x}/${address.z}`,
        ground: { kind: 'flat', height: Math.round(centreHeight * 100) / 100, dx: 0, dz: 0 },
        buildings,
        ...(batch.scatter !== undefined ? { scatter: batch.scatter } : {}),
        ...(batch.props !== undefined ? { props: batch.props } : {}),
        ...(batch.rules !== undefined && batch.rules.length > 0 ? { rules: batch.rules } : {}),
        ...(batch.fallbackStyle !== undefined ? { fallbackStyle: batch.fallbackStyle } : {}),
        ...(batch.scatterId !== undefined ? { scatterId: batch.scatterId } : {}),
        tier: batch.tier ?? 0,
      };
      const check = validateByKind('worldgen-batch' as never, doc);
      if (!check.ok) return { ok: false, error: formatIssues('dumped batch', check.issues) };
      dumpPath = resolve(input.dumpPath);
      await mkdir(dirname(dumpPath), { recursive: true });
      await writeFile(dumpPath, `${JSON.stringify(doc, null, 2)}\n`);
    }
    return {
      ok: true,
      tile: { level: address.level, x: address.x, y: address.z },
      ...(batch.regionId !== undefined ? { region: batch.regionId } : {}),
      ...(batch.scatterId !== undefined ? { scatter: batch.scatterId } : {}),
      source: {
        buildings: tile.buildings.length,
        landcover: tile.landcover.length,
        roads: tile.transportation.length,
        water: tile.water.length,
      },
      stats: first.output.stats,
      skippedByOwnership: batch.skippedByOwnership,
      clippedPieces: batch.clippedPieces,
      buildingsWithoutIds: withoutIds,
      placements: first.output.placements.map((set) => ({
        modelRef: set.modelRef,
        count: set.count,
      })),
      generateMs: { first: first.ms, second: second.ms },
      hash: first.output.hash,
      deterministic: first.output.hash === second.output.hash,
      ...(dumpPath !== undefined ? { dumpPath } : {}),
      warnings,
    };
  } finally {
    await Promise.allSettled([...archives.values()].map((opened) => opened.close()));
  }
}

/** Human-readable summary for the CLI. */
export function formatWorldgenStats(result: WorldgenStatsOutput): string {
  if (!result.ok || result.stats === undefined || result.tile === undefined) {
    return result.error ?? 'worldgen stats failed';
  }
  const s = result.stats;
  const histogram = (record: Record<string, number>): string =>
    Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `${key} ${count}`)
      .join(', ');
  const lines = [
    `tile ${result.tile.level}/${result.tile.x}/${result.tile.y}${result.region !== undefined ? ` · region ${result.region}` : ''}${result.scatter !== undefined ? ` · scatter ${result.scatter}` : ''}`,
    `source: ${result.source?.buildings ?? 0} buildings, ${result.source?.landcover ?? 0} landcover, ${result.source?.roads ?? 0} roads, ${result.source?.water ?? 0} water`,
    `buildings: ${s.buildingsIn} in · ${s.buildingsRendered} rendered · ${s.buildingsBoxed} boxed · ${s.buildingsSkipped} skipped · ${s.buildingsDropped} dropped · ${result.skippedByOwnership ?? 0} owned elsewhere · ${result.clippedPieces ?? 0} clipped · ${result.buildingsWithoutIds ?? 0} without ids`,
    `footprints: ${histogram(s.footprintKinds)}`,
    `roofs: ${histogram(s.roofs)}`,
    `styles: ${histogram(s.styles)}`,
    `geometry: ${s.vertices} vertices · ${s.triangles} triangles · ${(s.meshBytes / 1_048_576).toFixed(2)} MiB mesh · ${(s.instanceBytes / 1024).toFixed(1)} KiB instances · ${s.materialsCollapsed} collapsed`,
    `placements: ${(result.placements ?? []).map((set) => `${set.modelRef} ${set.count}`).join(', ') || 'none'}`,
    `generate: ${(result.generateMs?.first ?? 0).toFixed(1)} ms, again ${(result.generateMs?.second ?? 0).toFixed(1)} ms · ${result.deterministic === true ? 'deterministic' : 'NOT deterministic'} · ${result.hash ?? ''}`,
  ];
  for (const warning of result.warnings ?? []) lines.push(`! ${warning}`);
  if (result.dumpPath !== undefined) lines.push(`dumped batch -> ${result.dumpPath}`);
  return lines.join('\n');
}
