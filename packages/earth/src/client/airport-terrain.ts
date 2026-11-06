/** Airport earthworks shared by terrain meshes, draped surfaces and ground physics. */
import type { TerrainPyramidStreamOptions } from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  type TerrainSemanticPoint,
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
  /** Every ground ring's edges, polygon by polygon and outer ring first: ax, az, bx, bz each. */
  edges: Float64Array;
  /** Each edge's ring, numbered in the same order. */
  edgeRings: Uint32Array;
  /** How many rings (the outer one, then its holes) each ground polygon has. */
  polygonRings: number[];
  bounds: [number, number, number, number];
  height?: number;
}

// Fixed world-space shoulders keep the same earthworks at every detail level. They also
// cover the vertices surrounding the pavement on the coarser playable terrain grids.
const SHOULDER = 80;
const BLEND = 120;
const MAX_TILE_SIZE = 100_000;

function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax,
    dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2)) : 0;
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

/**
 * Distance from each sample of the row at `z`, visited west to east, to an airport's runway
 * strips and mapped grounds: zero inside them, and exact up to BLEND, beyond which a sample keeps
 * its height whatever the distance. A ground edge farther than that across the row or along it
 * cannot be the nearest one that matters, and containment is the even-odd test of
 * `pointInPolygon` with each ring's crossings found once per row. Testing every edge of Boeing
 * Field's grounds for every sample took a tenth of a second for each tile meshed near it, on the
 * main thread.
 */
function rowDistance(ground: AirportGround, z: number): (x: number) => number {
  const { strips, edges, edgeRings, polygonRings } = ground;
  const rings = polygonRings.reduce((sum, count) => sum + count, 0);
  const crossings: number[][] = Array.from({ length: rings }, () => []);
  const near: number[] = [];
  for (let e = 0, k = 0; k < edges.length; e++, k += 4) {
    const ax = edges[k] as number,
      az = edges[k + 1] as number,
      bx = edges[k + 2] as number,
      bz = edges[k + 3] as number;
    if (Math.min(az, bz) - BLEND <= z && z <= Math.max(az, bz) + BLEND) near.push(k);
    // pointInRing's crossing, the edge's far end as its current point and its near end as the
    // previous one, so every sample's test agrees with it to the bit.
    if (bz > z !== az > z)
      (crossings[edgeRings[e] as number] as number[]).push(((ax - bx) * (z - bz)) / (az - bz) + bx);
  }
  for (const list of crossings) list.sort((a, b) => a - b);
  // Crossings at or west of the current sample, per ring; samples only move east.
  const passed = new Uint32Array(rings);
  const inRing = (ring: number, x: number): boolean => {
    const list = crossings[ring] as number[];
    let count = passed[ring] as number;
    while (count < list.length && (list[count] as number) <= x) count++;
    passed[ring] = count;
    return (list.length - count) % 2 === 1;
  };
  return (x) => {
    let nearest = Infinity;
    for (const { a, b, radius } of strips)
      nearest = Math.min(nearest, segmentDistance(x, z, a[0], a[1], b[0], b[1]) - radius);
    if (nearest <= 0) return 0;
    for (let polygon = 0, ring = 0; polygon < polygonRings.length; polygon++) {
      const end = ring + (polygonRings[polygon] as number);
      let inside = inRing(ring, x);
      for (let hole = ring + 1; inside && hole < end; hole++) if (inRing(hole, x)) inside = false;
      if (inside) return 0;
      ring = end;
    }
    for (const k of near) {
      const ax = edges[k] as number,
        bx = edges[k + 2] as number;
      if (x < Math.min(ax, bx) - BLEND || x > Math.max(ax, bx) + BLEND) continue;
      nearest = Math.min(
        nearest,
        segmentDistance(x, z, ax, edges[k + 1] as number, bx, edges[k + 3] as number),
      );
    }
    return Math.max(0, nearest);
  };
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
        .map((p) => [p.outer, ...(p.holes ?? [])].map((ring) => ring.map(project)));
      const rings = polygons.flat();
      const edges = new Float64Array(rings.reduce((sum, ring) => sum + ring.length, 0) * 4);
      const edgeRings = new Uint32Array(edges.length / 4);
      for (let r = 0, e = 0; r < rings.length; r++) {
        const ring = rings[r] as Point[];
        for (let i = 0; i < ring.length; i++, e++) {
          const a = ring[i] as Point,
            b = ring[(i + 1) % ring.length] as Point;
          edges.set([a[0], a[1], b[0], b[1]], e * 4);
          edgeRings[e] = r;
        }
      }
      const points = [...strips.flatMap((s) => [s.a, s.b]), ...polygons.flatMap((p) => p[0] ?? [])];
      const ground: AirportGround = {
        strips,
        edges,
        edgeRings,
        polygonRings: polygons.map((p) => p.length),
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
      const distances = grounds.map((ground) =>
        ground.height === undefined || z < ground.bounds[1] || z > ground.bounds[3]
          ? undefined
          : rowDistance(ground, z),
      );
      if (distances.every((distance) => distance === undefined)) continue;
      for (let col = 0; col < heightfield.cols; col++) {
        const x = origin[0] + col * heightfield.cellSize[0];
        let weight = 0,
          target = 0;
        for (let g = 0; g < grounds.length; g++) {
          const ground = grounds[g] as AirportGround,
            distance = distances[g];
          if (distance === undefined || x < ground.bounds[0] || x > ground.bounds[2]) continue;
          const t = Math.min(1, distance(x) / BLEND);
          const influence = 1 - t * t * (3 - 2 * t);
          if (influence > weight) {
            weight = influence;
            target = ground.height as number;
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
