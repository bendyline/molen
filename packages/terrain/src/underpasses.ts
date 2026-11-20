/**
 * Ways mapped as tunnels only where they pass beneath bridges: underpasses.
 *
 * Mappers tag the stretch of a street under a railway's bridges `tunnel=yes` (a footway under a
 * viaduct too), though it runs in the open beneath decks the map draws itself. Built as a bore,
 * such a way stood as a 6.5 m concrete box on the ground with the bridges running through it: an
 * elevation model has no dip for a street under a railway, so nothing covers the bore. A street
 * in Hurstville, Sydney, went into the box's open end and a car stopped dead in it.
 *
 * Such a way is the street beneath the bridges: drawn, graded and driven as any other, and grade
 * separation lifts the bridges over it. A way stays a tunnel unless bridges cross over it along
 * all of it, which a bored tunnel never is. Authored tunnel floors are kept, and so is any line
 * the tile does not see whole: a long tunnel's last stretch past a tile edge, under one bridge,
 * is not an underpass, and opening it would cut the bore's route short.
 */
import { terrainLinePath } from './line-path';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticTile,
  TerrainTransportationFeature,
} from './semantic-types';

/**
 * World units of a tunnel way on either side of a bridge crossing over it that the bridge
 * accounts for: its deck's half width and the stretch a mapper carries the tag past it.
 */
export const TERRAIN_UNDERPASS_REACH = 15;
/** World units from a bridge's own end within which it lands on a way rather than crossing it. */
const LANDING = 1;

/** A way the map calls a tunnel, with no surveyed floor to keep it one. */
function inferredTunnel(feature: TerrainTransportationFeature): boolean {
  return feature.tunnel === true && feature.tunnelFloorElevation === undefined;
}

/** Inside the tile's own square, not in the buffer around it where a clipped line ends. */
function within([u, v]: TerrainSemanticPoint): boolean {
  return u > 0 && u < 1 && v > 0 && v < 1;
}

/** One key per end point, shared by ends that touch. */
const endKey = ([u, v]: TerrainSemanticPoint): string =>
  `${Math.round(u * 1e7)}/${Math.round(v * 1e7)}`;

interface Deck {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Distance from the deck line's first point to `a`, and from `b` to its last point. */
  from: number;
  to: number;
}

/** Distances along `line` (world units) at which a bridge passes over it. */
function crossings(line: TerrainSemanticLine, decks: readonly Deck[], tileSize: number): number[] {
  const path = terrainLinePath(line, tileSize);
  const found: number[] = [];
  for (let i = 1; i < path.points.length; i++) {
    const [px, pz] = path.points[i - 1] as TerrainSemanticPoint,
      [qx, qz] = path.points[i] as TerrainSemanticPoint;
    const rx = qx - px,
      rz = qz - pz;
    const d0 = path.distances[i - 1] as number,
      d1 = path.distances[i] as number;
    for (const deck of decks) {
      const sx = deck.bx - deck.ax,
        sz = deck.bz - deck.az;
      const denominator = rx * sz - rz * sx;
      if (Math.abs(denominator) < 1e-9) continue;
      const wx = deck.ax - px,
        wz = deck.az - pz;
      const t = (wx * sz - wz * sx) / denominator,
        u = (wx * rz - wz * rx) / denominator;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      // A deck that ends on the way (a bridge joined to it) does not pass over it.
      const length = Math.hypot(sx, sz);
      if (deck.from + u * length < LANDING || deck.to + (1 - u) * length < LANDING) continue;
      found.push(d0 + t * (d1 - d0));
    }
  }
  return found.sort((a, b) => a - b);
}

/** Whether bridges crossing at `at` (sorted) account for all of a way `length` long. */
function covered(at: readonly number[], length: number): boolean {
  const reach = TERRAIN_UNDERPASS_REACH;
  if (!at.length || (at[0] as number) > reach || (at.at(-1) as number) < length - reach)
    return false;
  for (let i = 1; i < at.length; i++)
    if ((at[i] as number) - (at[i - 1] as number) > 2 * reach) return false;
  return true;
}

/**
 * The tile with each way it calls a tunnel, but which lies beneath bridges crossing over it along
 * all its length, made an ordinary way (a feature whose lines are only partly such is split in
 * two). `tileSize` is the tile's edge in world units. Returns the tile itself when nothing changes.
 */
export function withTerrainUnderpasses(
  tile: TerrainSemanticTile,
  tileSize: number,
): TerrainSemanticTile {
  if (!tile.transportation.some(inferredTunnel)) return tile;
  const decks: Deck[] = [];
  for (const feature of tile.transportation) {
    if (feature.bridge !== true || feature.tunnel === true) continue;
    for (const line of feature.lines) {
      const path = terrainLinePath(line, tileSize);
      for (let i = 1; i < path.points.length; i++) {
        const [ax, az] = path.points[i - 1] as TerrainSemanticPoint,
          [bx, bz] = path.points[i] as TerrainSemanticPoint;
        decks.push({
          ax,
          az,
          bx,
          bz,
          from: path.distances[i - 1] as number,
          to: path.length - (path.distances[i] as number),
        });
      }
    }
  }
  if (!decks.length) return tile;
  // Every tunnel line, and those bridges pass over along all of it.
  const tunnels: TerrainSemanticLine[] = [];
  const open = new Set<TerrainSemanticLine>();
  for (const feature of tile.transportation) {
    if (feature.tunnel !== true) continue;
    for (const line of feature.lines) {
      if (!line.length) continue;
      tunnels.push(line);
      if (!inferredTunnel(feature) || line.length < 2) continue;
      if (!within(line[0] as TerrainSemanticPoint) || !within(line.at(-1) as TerrainSemanticPoint))
        continue;
      if (covered(crossings(line, decks, tileSize), terrainLinePath(line, tileSize).length))
        open.add(line);
    }
  }
  if (!open.size) return tile;
  // A line that goes on as a tunnel at either end is part of a longer bore, unless the way it
  // goes on as is open too (an underpass mapped as two ways).
  for (let changed = true; changed; ) {
    changed = false;
    const buried = new Set<string>();
    for (const line of tunnels)
      if (!open.has(line))
        for (const end of [line[0], line.at(-1)] as TerrainSemanticPoint[]) buried.add(endKey(end));
    for (const line of open)
      if (
        buried.has(endKey(line[0] as TerrainSemanticPoint)) ||
        buried.has(endKey(line.at(-1) as TerrainSemanticPoint))
      ) {
        open.delete(line);
        changed = true;
      }
  }
  if (!open.size) return tile;
  const transportation = tile.transportation.flatMap((feature) => {
    if (!feature.lines.some((line) => open.has(line))) return [feature];
    const { tunnel: _tunnel, tunnelClearance: _clearance, ...street } = feature;
    const opened: TerrainTransportationFeature = {
      ...street,
      lines: feature.lines.filter((line) => open.has(line)),
    };
    const bored = feature.lines.filter((line) => !open.has(line));
    return bored.length ? [{ ...feature, lines: bored }, opened] : [opened];
  });
  return { ...tile, transportation };
}
