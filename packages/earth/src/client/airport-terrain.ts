/** Airport earthworks shared by terrain meshes, draped surfaces and ground physics. */
import type { TerrainPyramidStreamOptions } from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  pointInPolygon,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  terrainPyramidAddressAt,
  terrainPyramidTileKey,
  webMercatorToWgs84,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import type { EarthAirport, EarthAirports } from './airports';

type Grading = NonNullable<TerrainPyramidStreamOptions['transformHeightfield']>;
type Point = TerrainSemanticPoint;
interface AirportGround {
  strips: { a: Point; b: Point; radius: number }[];
  polygons: TerrainSemanticPolygon[];
  bounds: [number, number, number, number];
  height?: number;
}

// Fixed world-space shoulders keep the same earthworks at every detail level. They also
// cover the vertices surrounding the pavement on the coarser playable terrain grids.
const SHOULDER = 80;
const BLEND = 120;
const MAX_TILE_SIZE = 100_000;

function segmentDistance(x: number, z: number, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

function distance(ground: AirportGround, x: number, z: number): number {
  let nearest = Infinity;
  for (const strip of ground.strips)
    nearest = Math.min(nearest, segmentDistance(x, z, strip.a, strip.b) - strip.radius);
  if (nearest <= 0) return 0;
  for (const polygon of ground.polygons) {
    if (pointInPolygon([x, z], polygon)) return 0;
    for (const ring of [polygon.outer, ...(polygon.holes ?? [])])
      for (let i = 0; i < ring.length; i++)
        nearest = Math.min(
          nearest,
          segmentDistance(x, z, ring[i] as Point, ring[(i + 1) % ring.length] as Point),
        );
  }
  return Math.max(0, nearest);
}

/**
 * Level surveyed airport runways and mapped airfield grounds, blending into the surrounding
 * DEM. Each airport uses one median height from fixed level-14 runway samples (or the nearest
 * available level), independent of requested tiles, their order, and the camera's quality.
 * This is inferred earthwork, not surveyed runway elevation or slope data.
 */
export function createAirportTerrainGrading(airports: EarthAirports): Grading {
  const cache = new Map<string, AirportGround>();
  return async (context, source) => {
    const { heightfield, pyramid, origin, tileSize, signal } = context;
    if (tileSize > MAX_TILE_SIZE || signal.aborted) return heightfield;
    const scale = pyramid.metersPerUnit ?? 1;
    const margin = SHOULDER + BLEND + 75;
    const nw = webMercatorToWgs84((origin[0] - margin) / scale, (origin[1] - margin) / scale);
    const se = webMercatorToWgs84(
      (origin[0] + tileSize + margin) / scale,
      (origin[1] + tileSize + margin) / scale,
    );
    const records = (await airports.inBounds([nw[0], se[1], se[0], nw[1]])).filter(
      (a) =>
        a.runways.some(
          ({ ends: [start, end] }) =>
            Math.min(start[0], end[0]) <= se[0] &&
            Math.max(start[0], end[0]) >= nw[0] &&
            Math.min(start[1], end[1]) <= nw[1] &&
            Math.max(start[1], end[1]) >= se[1],
        ) ||
        airports.layouts.some(
          (l) =>
            l.id === a.id &&
            l.bounds[0] <= se[0] &&
            l.bounds[2] >= nw[0] &&
            l.bounds[1] <= nw[1] &&
            l.bounds[3] >= se[1],
        ),
    );
    if (signal.aborted) return heightfield;
    const project = (p: Point): Point => {
      const [x, z] = wgs84ToWebMercator(...p);
      return [x * scale, z * scale];
    };
    const groundFor = (airport: EarthAirport): AirportGround => {
      const key = `${scale}:${airport.id}:${airport.runways.map((r) => r.ends.flat().join(',')).join(';')}`;
      const found = cache.get(key);
      if (found) return found;
      const strips = airport.runways.map((r) => ({
        a: project(r.ends[0]),
        b: project(r.ends[1]),
        radius: Math.min(150, r.width) / 2 + SHOULDER,
      }));
      const polygons = airports.layouts
        .filter((l) => l.id === airport.id)
        .flatMap((l) => l.tile.landcover.filter((f) => f.class === 'aerodrome'))
        .flatMap((f) => f.polygons)
        .map((p) => ({
          outer: p.outer.map(project),
          ...(p.holes ? { holes: p.holes.map((h) => h.map(project)) } : {}),
        }));
      const points = [...strips.flatMap((s) => [s.a, s.b]), ...polygons.flatMap((p) => p.outer)];
      const ground: AirportGround = {
        strips,
        polygons,
        bounds: [
          Math.min(...points.map((p) => p[0])) - margin,
          Math.min(...points.map((p) => p[1])) - margin,
          Math.max(...points.map((p) => p[0])) + margin,
          Math.max(...points.map((p) => p[1])) + margin,
        ],
      };
      cache.set(key, ground);
      if (cache.size > 256) cache.delete(cache.keys().next().value as string);
      return ground;
    };
    const grounds = records
      .map(groundFor)
      .filter(
        ({ bounds: b }) =>
          b[0] <= origin[0] + tileSize &&
          b[2] >= origin[0] &&
          b[1] <= origin[1] + tileSize &&
          b[3] >= origin[1],
      );
    if (!grounds.length) return heightfield;
    const level = Math.max(pyramid.minLevel, Math.min(14, pyramid.maxLevel));
    // Share raw reference reads within this request only. An aborted request must never
    // poison another tile's reference heights, and missing coverage is retried next time.
    const references = new Map<string, Promise<Heightfield | undefined>>();
    for (const ground of grounds) {
      if (ground.height !== undefined) continue;
      const samples = await Promise.all(
        ground.strips.flatMap(({ a, b }) =>
          [0, 0.25, 0.5, 0.75, 1].map(async (t) => {
            const x = a[0] + (b[0] - a[0]) * t,
              z = a[1] + (b[1] - a[1]) * t;
            const address = terrainPyramidAddressAt(pyramid, level, x, z);
            if (!address || signal.aborted) return undefined;
            const key = terrainPyramidTileKey(address);
            let pending = references.get(key);
            if (!pending) {
              pending = source.load(address, signal);
              references.set(key, pending);
            }
            return (await pending)?.sampleHeight(x, z);
          }),
        ),
      );
      if (signal.aborted) return heightfield;
      // Never cache a partial airport: otherwise its elevation would depend on load order.
      if (!samples.length || samples.some((h) => h === undefined || !Number.isFinite(h))) continue;
      const heights = (samples as number[]).sort((a, b) => a - b);
      ground.height =
        ((heights[Math.floor((heights.length - 1) / 2)] as number) +
          (heights[Math.floor(heights.length / 2)] as number)) /
        2;
    }
    let grid: Float32Array | undefined;
    const { min, max } = heightfield.heightRange;
    for (let row = 0; row < heightfield.rows; row++) {
      const z = origin[1] + row * heightfield.cellSize[1];
      for (let col = 0; col < heightfield.cols; col++) {
        const x = origin[0] + col * heightfield.cellSize[0];
        let weight = 0,
          target = 0;
        for (const ground of grounds) {
          const b = ground.bounds;
          if (ground.height === undefined || x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
          const t = Math.min(1, distance(ground, x, z) / BLEND);
          const influence = 1 - t * t * (3 - 2 * t);
          if (influence > weight) {
            weight = influence;
            target = ground.height;
          }
        }
        if (weight === 0) continue;
        grid ??= heightfield.copySamples();
        const i = row * heightfield.cols + col;
        const before = min + (grid[i] as number) * (max - min);
        grid[i] = (before + weight * (target - before) - min) / (max - min);
      }
    }
    return grid
      ? new Heightfield(grid, heightfield.cols, heightfield.rows, {
          origin: heightfield.origin,
          worldSize: heightfield.worldSize,
          height: heightfield.heightRange,
          validated: true,
        })
      : heightfield;
  };
}
