/**
 * Three-free road earthworks: the ground a road is built on, as a heightfield transform.
 *
 * A digital elevation model is sampled every ten meters or so and knows nothing of roads, so a
 * street draped on it tilts with every hillside it runs along and rides over every bump in the
 * samples. Real roads are graded: level from curb to curb, on a profile that changes slowly, the
 * ground beside them cut or filled to meet them. This grades a tile's heightfield the same way,
 * so the terrain mesh, everything draped on it and everything that drives on it agree.
 */
import { Heightfield } from './heightfield';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainTransportationFeature,
} from './semantic-types';
import { isAeroway, transportKind, transportWidth } from './transport-features';

/** Meters either way along a road over which its profile is averaged. */
export const ROAD_PROFILE_WINDOW = 30;
/** Meters between the stations a graded line is read at. */
const STATION = 5;

/** A way to grade, in world meters: stations along its centerline and the bench it wants. */
export interface RoadEarthworkLine {
  /** World X/Z of each station: x0, z0, x1, z1, and so on, a few meters apart. */
  points: Float64Array;
  /** Half the width leveled: the carriageway with its shoulders or sidewalks. */
  halfWidth: number;
  /** `[minX, minZ, maxX, maxZ]` of the stations. */
  bounds: [number, number, number, number];
  /**
   * Profile height at each station, read on first use and kept (NaN until then): the lines of
   * one tile are graded into that tile and each of its neighbors.
   */
  heights: Float32Array;
}

export interface RoadEarthworkOptions {
  /**
   * Vertices along a side of the rendered ground grid, which roads are draped on (the stream's
   * `surfaceResolution`). The bench reaches a grid cell past the road's edge, since a draped
   * road is only as level as the vertices of the cells it touches. Default: the field's columns.
   */
  surfaceResolution?: number;
  /**
   * Coarsest rendered grid (meters between vertices) still graded. A coarser grid cannot hold a
   * bench narrower than a city block, and is seen from too far to tell. Default 28.
   */
  maxSpacing?: number;
  /** Where the map has water: left as it is, except under a road's own footprint. */
  water?: (x: number, z: number) => boolean;
  /** Greatest cut or fill at one point, meters (default 12). */
  maxChange?: number;
}

/**
 * Height of a road's graded profile at a point on its centerline: the reference ground averaged
 * along the road's own direction (`dx`, `dz`, a unit vector), weighted toward the point. It
 * depends on nothing but the point, the direction and the reference ground, so every tile and
 * every level of detail that grades the same road agrees, wherever the road was cut by a tile.
 */
export function roadProfileHeight(
  reference: (x: number, z: number) => number,
  x: number,
  z: number,
  dx: number,
  dz: number,
  window: number = ROAD_PROFILE_WINDOW,
): number {
  const step = window / 4;
  let total = 5 * reference(x, z);
  for (let k = 1; k <= 4; k++) {
    const reach = k * step;
    total +=
      (5 - k) *
      (reference(x + dx * reach, z + dz * reach) + reference(x - dx * reach, z - dz * reach));
  }
  return total / 25;
}

/** Whether a way is one the ground is graded for: roads and railways on the ground. */
function graded(feature: TerrainTransportationFeature): boolean {
  if (feature.bridge || feature.tunnel || isAeroway(feature)) return false;
  if (feature.class === 'ferry' || feature.subclass === 'ferry') return false;
  // Footpaths take the ground as they find it: steps and trails climb where streets cannot.
  return transportKind(feature) !== 'path';
}

/** Half the width graded for a way: its carriageway and what lines it. */
function gradedHalfWidth(feature: TerrainTransportationFeature): number {
  const kind = transportKind(feature);
  const half = transportWidth(feature, kind) / 2;
  // A street's curbs and sidewalks, a freeway's shoulders, a track's ballast.
  return half + (kind === 'service' ? 0.6 : kind === 'rail' ? 1.2 : 2.6);
}

/**
 * The ways of one tile to grade, as world-space lines. `clip` (tile-normalized, default the tile
 * itself) drops the tile's buffer, so lines gathered from neighboring tiles do not overlap: the
 * same world geometry then reaches every tile that grades it, whichever tile it came from.
 */
export function roadEarthworkLines(
  features: readonly TerrainTransportationFeature[],
  origin: readonly [number, number],
  tileSize: number,
  clip: readonly [number, number, number, number] = [0, 0, 1, 1],
): RoadEarthworkLine[] {
  const lines: RoadEarthworkLine[] = [];
  for (const feature of features) {
    if (!graded(feature)) continue;
    const halfWidth = gradedHalfWidth(feature);
    for (const line of feature.lines)
      for (const piece of clipRoadLine(line, clip)) {
        const stations: number[] = [];
        const bounds: [number, number, number, number] = [
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ];
        const add = (x: number, z: number): void => {
          stations.push(x, z);
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], z);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], z);
        };
        for (let i = 0; i + 1 < piece.length; i++) {
          const a = piece[i] as TerrainSemanticPoint,
            b = piece[i + 1] as TerrainSemanticPoint;
          const ax = origin[0] + a[0] * tileSize,
            az = origin[1] + a[1] * tileSize,
            bx = origin[0] + b[0] * tileSize,
            bz = origin[1] + b[1] * tileSize;
          const length = Math.hypot(bx - ax, bz - az);
          if (length < 1e-4) continue;
          const steps = Math.max(1, Math.ceil(length / STATION));
          for (let j = stations.length === 0 ? 0 : 1; j <= steps; j++)
            add(ax + ((bx - ax) * j) / steps, az + ((bz - az) * j) / steps);
        }
        if (stations.length < 4) continue;
        lines.push({
          points: Float64Array.from(stations),
          halfWidth,
          bounds,
          heights: new Float32Array(stations.length / 2).fill(Number.NaN),
        });
      }
  }
  return lines;
}

/**
 * The parts of a line inside a box, or with `outside` the parts beyond it (Liang-Barsky per
 * segment, rejoined where they continue). Splitting lines by the same box from either side
 * leaves no overlap: what one tile keeps, its neighbor drops.
 */
export function clipRoadLine(
  line: TerrainSemanticLine,
  box: readonly [number, number, number, number],
  outside = false,
): TerrainSemanticLine[] {
  const pieces: TerrainSemanticLine[] = [];
  let current: TerrainSemanticLine | undefined;
  const keep = (a: TerrainSemanticPoint, b: TerrainSemanticPoint, from: number, to: number) => {
    if (to - from <= 1e-12) return;
    const at = (t: number): TerrainSemanticPoint =>
      t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (!current || from > 0) {
      current = [at(from)];
      pieces.push(current);
    }
    current.push(at(to));
    if (to < 1) current = undefined;
  };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as TerrainSemanticPoint,
      b = line[i + 1] as TerrainSemanticPoint;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    let t0 = 0,
      t1 = 1,
      inside = true;
    for (const [p, q] of [
      [-dx, a[0] - box[0]],
      [dx, box[2] - a[0]],
      [-dz, a[1] - box[1]],
      [dz, box[3] - a[1]],
    ] as const) {
      if (p === 0) {
        if (q < 0) inside = false;
      } else if (p < 0) t0 = Math.max(t0, q / p);
      else t1 = Math.min(t1, q / p);
    }
    if (!inside || t0 > t1) {
      if (outside) keep(a, b, 0, 1);
      else current = undefined;
      continue;
    }
    if (!outside) {
      keep(a, b, t0, t1);
      continue;
    }
    // Beyond the box: up to where the segment enters it, and on from where it leaves.
    keep(a, b, 0, t0);
    current = undefined;
    keep(a, b, t1, 1);
  }
  return pieces;
}

/**
 * Grade a tile's ground for the roads on it. Each road's cross-section is leveled at the height
 * of its profile (`roadProfileHeight` of `reference`, read along its centerline), out to a grid
 * cell past its edge; beyond that the ground blends back to what it was. Where roads are close
 * the nearest one decides, so two streets at different heights each keep their own bench and the
 * block between them takes up the difference, as a graded city block does.
 *
 * `reference` is the natural ground as a function of world X/Z alone (the same elevation level
 * for every tile, reaching past this tile's edges), so adjacent tiles grade their shared edge
 * alike; lines keep the profile read from it. Returns the field itself when nothing changes.
 */
export function gradeRoadEarthworks(
  heightfield: Heightfield,
  lines: readonly RoadEarthworkLine[],
  reference: (x: number, z: number) => number,
  options: RoadEarthworkOptions = {},
): Heightfield {
  const pass = beginRoadEarthworks(heightfield, reference, options);
  if (!pass) return heightfield;
  for (const line of lines) pass.add(line);
  return pass.finish();
}

/** One tile's grading in steps, so a host can let a frame through between them. */
export interface RoadEarthworkPass {
  /** Weigh one way into the ground around it. */
  add(line: RoadEarthworkLine): void;
  /** The graded field, or the field given when nothing moved. */
  finish(): Heightfield;
}

/**
 * `gradeRoadEarthworks` a line at a time. Undefined when the tile's rendered grid is too coarse
 * to grade (`maxSpacing`).
 */
export function beginRoadEarthworks(
  heightfield: Heightfield,
  reference: (x: number, z: number) => number,
  options: RoadEarthworkOptions = {},
): RoadEarthworkPass | undefined {
  const side = Math.max(2, Math.floor(options.surfaceResolution ?? heightfield.cols));
  const [originX, originZ] = heightfield.origin;
  const [sizeX, sizeZ] = heightfield.worldSize;
  const spacingX = sizeX / (side - 1),
    spacingZ = sizeZ / (side - 1);
  const spacing = Math.max(spacingX, spacingZ);
  if (spacing > (options.maxSpacing ?? 28)) return undefined;
  // A vertex belongs to the bench if a cell it corners can reach under the road.
  const margin = spacing * 1.25;
  const blend = Math.max(8, spacing * 1.6);
  const maxChange = options.maxChange ?? 12;
  const count = side * side;
  const weighted = new Float64Array(count),
    weights = new Float64Array(count),
    influence = new Float32Array(count),
    nearest = new Float32Array(count).fill(Number.POSITIVE_INFINITY);
  const touched: number[] = [];
  // One road's nearest point to each vertex, gathered before the road is weighed in.
  const stamp = new Int32Array(count).fill(-1);
  const distance = new Float32Array(count),
    profile = new Float32Array(count);
  let id = -1;
  const add = (line: RoadEarthworkLine): void => {
    id++;
    const reach = line.halfWidth + margin + blend;
    const { points, bounds, heights } = line;
    if (
      bounds[2] < originX - reach ||
      bounds[0] > originX + sizeX + reach ||
      bounds[3] < originZ - reach ||
      bounds[1] > originZ + sizeZ + reach
    )
      return;
    const stations = points.length >> 1;
    const near = (i: number): boolean => {
      const x = points[i * 2] as number,
        z = points[i * 2 + 1] as number;
      return (
        x >= originX - reach - STATION &&
        x <= originX + sizeX + reach + STATION &&
        z >= originZ - reach - STATION &&
        z <= originZ + sizeZ + reach + STATION
      );
    };
    const heightAt = (i: number): number => {
      let height = heights[i] as number;
      if (Number.isNaN(height)) {
        // Along the chord through the stations either side: the line's direction here.
        const before = Math.max(0, i - 1),
          after = Math.min(stations - 1, i + 1);
        const dx = (points[after * 2] as number) - (points[before * 2] as number),
          dz = (points[after * 2 + 1] as number) - (points[before * 2 + 1] as number);
        const length = Math.hypot(dx, dz) || 1;
        height = roadProfileHeight(
          reference,
          points[i * 2] as number,
          points[i * 2 + 1] as number,
          dx / length,
          dz / length,
        );
        heights[i] = height;
      }
      return height;
    };
    const own: number[] = [];
    for (let i = 0; i + 1 < stations; i++) {
      if (!near(i) || !near(i + 1)) continue;
      const ax = points[i * 2] as number,
        az = points[i * 2 + 1] as number,
        bx = points[i * 2 + 2] as number,
        bz = points[i * 2 + 3] as number;
      // Vertices of the rendered grid within reach of this stretch.
      const lowX = Math.max(0, Math.ceil((Math.min(ax, bx) - reach - originX) / spacingX)),
        highX = Math.min(side - 1, Math.floor((Math.max(ax, bx) + reach - originX) / spacingX)),
        lowZ = Math.max(0, Math.ceil((Math.min(az, bz) - reach - originZ) / spacingZ)),
        highZ = Math.min(side - 1, Math.floor((Math.max(az, bz) + reach - originZ) / spacingZ));
      if (lowX > highX || lowZ > highZ) continue;
      const from = heightAt(i),
        to = heightAt(i + 1);
      const sx = bx - ax,
        sz = bz - az;
      const span2 = sx * sx + sz * sz || 1;
      for (let row = lowZ; row <= highZ; row++) {
        const vz = originZ + row * spacingZ;
        for (let column = lowX; column <= highX; column++) {
          const vx = originX + column * spacingX;
          const along = Math.max(0, Math.min(1, ((vx - ax) * sx + (vz - az) * sz) / span2));
          const away = Math.hypot(vx - ax - sx * along, vz - az - sz * along);
          if (away >= reach) continue;
          const vertex = row * side + column;
          if (stamp[vertex] !== id) {
            stamp[vertex] = id;
            own.push(vertex);
          } else if (away >= (distance[vertex] as number)) continue;
          distance[vertex] = away;
          profile[vertex] = from + (to - from) * along;
        }
      }
    }
    for (const vertex of own) {
      const beyond = Math.max(0, (distance[vertex] as number) - line.halfWidth);
      const fade = Math.max(0, Math.min(1, (beyond - margin) / blend));
      const share = 1 - fade * fade * (3 - 2 * fade);
      if (share <= 0) continue;
      // The nearest road decides: a road's own footprint is all but its own.
      const weight = share / ((beyond + 0.75) * (beyond + 0.75));
      if ((weights[vertex] as number) === 0) touched.push(vertex);
      weighted[vertex] = (weighted[vertex] as number) + weight * (profile[vertex] as number);
      weights[vertex] = (weights[vertex] as number) + weight;
      influence[vertex] = Math.max(influence[vertex] as number, share);
      nearest[vertex] = Math.min(nearest[vertex] as number, beyond);
    }
  };
  const finish = (): Heightfield => {
    if (touched.length === 0) return heightfield;
    // How far each rendered vertex moves.
    const change = new Float32Array(count);
    let any = false;
    for (const vertex of touched) {
      const vx = originX + (vertex % side) * spacingX,
        vz = originZ + Math.floor(vertex / side) * spacingZ;
      if ((nearest[vertex] as number) > 1 && options.water?.(vx, vz)) continue;
      const target = (weighted[vertex] as number) / (weights[vertex] as number);
      const delta = (influence[vertex] as number) * (target - heightfield.sampleHeight(vx, vz));
      if (Math.abs(delta) < 0.01) continue;
      change[vertex] = Math.max(-maxChange, Math.min(maxChange, delta));
      any = true;
    }
    if (!any) return heightfield;
    // Every sample of the field takes the change of the rendered grid around it, so the field
    // read at full resolution and the ground drawn from it stay one surface.
    const { cols, rows } = heightfield;
    const grid = heightfield.copySamples();
    const { min, max } = heightfield.heightRange;
    const range = max - min;
    const scaleX = (side - 1) / (cols - 1),
      scaleZ = (side - 1) / (rows - 1);
    for (let row = 0; row < rows; row++) {
      const gz = row * scaleZ;
      const z0 = Math.min(side - 2, Math.floor(gz));
      const fz = gz - z0;
      for (let column = 0; column < cols; column++) {
        const gx = column * scaleX;
        const x0 = Math.min(side - 2, Math.floor(gx));
        const fx = gx - x0;
        const base = z0 * side + x0;
        const a = change[base] as number,
          b = change[base + 1] as number,
          c = change[base + side] as number,
          d = change[base + side + 1] as number;
        if (a === 0 && b === 0 && c === 0 && d === 0) continue;
        const delta = (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
        const index = row * cols + column;
        grid[index] = (grid[index] as number) + delta / range;
      }
    }
    return new Heightfield(grid, cols, rows, {
      origin: heightfield.origin,
      worldSize: heightfield.worldSize,
      height: heightfield.heightRange,
      validated: true,
    });
  };
  return { add, finish };
}
