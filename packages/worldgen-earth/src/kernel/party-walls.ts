/**
 * Party walls: which outline edges a mapped building shares with a neighbour. A map draws a row
 * of houses or a block of an old town as footprints that touch, and nothing says so, so each edge
 * is probed: an edge whose outside is another building's inside is a wall between the two. Such a
 * wall takes no windows, and the building is one of a row rather than a house in a yard.
 */
import {
  pointInPolygon,
  polygonBounds,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
} from '@bendyline/molen-terrain/kernel';
import type { BuildingPiece } from './building-parts';
import { isMapOverrideFeature } from './map-override-tags';

export interface PartyWalls {
  /** Outer-ring edge indices: edge `i` runs from vertex `i` to vertex `i + 1`. */
  edges: number[];
  /** Their total length and the whole outline's, meters. */
  length: number;
  perimeter: number;
}

/** How far outside an edge its neighbour is looked for, meters: wider than a mapping gap. */
const PROBE = 0.6;
/** Where along an edge the probes stand; all must find a neighbour. */
const SAMPLES: readonly number[] = [0.2, 0.5, 0.8];
/** Shorter edges are corner chamfers and jogs, not walls, meters. */
const MIN_EDGE = 1.2;
/** Buckets for the neighbour lookup, meters. */
const CELL = 32;

/**
 * Share of its outline a house in a row gives to its neighbours. The end house of a terrace
 * gives a quarter to a third and a middle one more than half; a house with a garage or a lean-to
 * against one wall gives a seventh, and stays a house in a yard.
 */
const MIN_ROW_SHARE = 0.22;
/** Smaller than this, what stands against a house is its garage or shed, not a house, m². */
const MIN_ROW_AREA = 40;

/** Whether a building's party walls make it one of a row or a block. */
export function isAttached(
  walls: PartyWalls | undefined,
  areaM2: number = Number.POSITIVE_INFINITY,
): boolean {
  return (
    walls !== undefined &&
    areaM2 >= MIN_ROW_AREA &&
    walls.length >= 3 &&
    walls.length >= walls.perimeter * MIN_ROW_SHARE
  );
}

/**
 * Party walls of every ground-standing piece. Pieces of one building (its mapped parts and what
 * remains around them) are not each other's neighbours, and neither a host's building nor an
 * inferred one takes part: those were placed, not surveyed.
 */
export function associatePartyWalls(
  pieces: readonly BuildingPiece[],
  tileSize: number,
): Map<BuildingPiece, PartyWalls> {
  const found = new Map<BuildingPiece, PartyWalls>();
  const standing = pieces
    .filter(
      (piece) =>
        (piece.feature.minHeight ?? 0) < 1 &&
        piece.feature.tags?.['molen:inferred'] === undefined &&
        !isMapOverrideFeature(piece.feature) &&
        piece.polygon.outer.length >= 3,
    )
    .map((piece) => ({
      piece,
      // Parts and remainders carry the outline they were cut from: one building, one group.
      group: (piece.groundPolygon ?? piece.polygon) as TerrainSemanticPolygon,
      bounds: polygonBounds(piece.polygon),
    }));
  if (standing.length < 2) return found;
  const cell = CELL / tileSize;
  const grid = new Map<string, number[]>();
  standing.forEach(({ bounds }, index) => {
    for (let x = Math.floor(bounds[0] / cell); x <= Math.floor(bounds[2] / cell); x++)
      for (let z = Math.floor(bounds[1] / cell); z <= Math.floor(bounds[3] / cell); z++) {
        const key = `${x},${z}`;
        const list = grid.get(key);
        if (list === undefined) grid.set(key, [index]);
        else list.push(index);
      }
  });
  const probe = PROBE / tileSize;
  const occupied = (point: TerrainSemanticPoint, own: TerrainSemanticPolygon): boolean => {
    const list = grid.get(`${Math.floor(point[0] / cell)},${Math.floor(point[1] / cell)}`);
    if (list === undefined) return false;
    for (const index of list) {
      const other = standing[index] as (typeof standing)[number];
      if (other.group === own) continue;
      const b = other.bounds;
      if (point[0] < b[0] || point[0] > b[2] || point[1] < b[1] || point[1] > b[3]) continue;
      if (pointInPolygon(point, other.piece.polygon)) return true;
    }
    return false;
  };
  for (const { piece, group } of standing) {
    const ring = piece.polygon.outer;
    let doubled = 0;
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index] as TerrainSemanticPoint;
      const b = ring[(index + 1) % ring.length] as TerrainSemanticPoint;
      doubled += a[0] * b[1] - b[0] * a[1];
    }
    // Outward is to the right of travel on a ring of positive area, to the left otherwise.
    const turn = doubled >= 0 ? 1 : -1;
    const edges: number[] = [];
    let length = 0;
    let perimeter = 0;
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index] as TerrainSemanticPoint;
      const b = ring[(index + 1) % ring.length] as TerrainSemanticPoint;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const span = Math.hypot(dx, dz);
      const meters = span * tileSize;
      perimeter += meters;
      if (meters < MIN_EDGE) continue;
      const nx = ((dz / span) * turn * probe) as number;
      const nz = ((-dx / span) * turn * probe) as number;
      if (SAMPLES.every((t) => occupied([a[0] + dx * t + nx, a[1] + dz * t + nz], group))) {
        edges.push(index);
        length += meters;
      }
    }
    if (edges.length > 0) found.set(piece, { edges, length, perimeter });
  }
  return found;
}
