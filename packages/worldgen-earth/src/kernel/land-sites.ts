/**
 * Recognizable ground for mapped land uses whose layout the map does not carry. A golf course
 * arrives as one outline: its fairways, greens, tees and bunkers are laid out here from a seed on
 * a fixed world grid, so every tile, detail level and visit draws the same course. A cemetery's
 * headstones stand in rows on the same kind of grid. Both are visual estimates that read as the
 * place from the air and on foot, not the surveyed course or the real graves.
 */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  pointInPolygon,
  polygonArea,
  roadWidth,
  type TerrainLandcoverFeature,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  WEB_MERCATOR_EARTH_RADIUS_METERS,
} from '@bendyline/molen-terrain/kernel';
import {
  hashString,
  type ModelPlacementRequest,
  unit01,
  type Vec2,
  type Vec3,
} from '@bendyline/molen-worldgen/kernel';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { distance, InfillBins } from './infill-geometry';
import { isLandcoverDesignation } from './labels';
import type { TileGeometry } from './semantic-adapter';
import { SPORTS_COLORS, withPitches } from './sports-pitches';
import { PROTOMAPS_TILE_BUFFER } from './tile-edges';

export interface LandSiteOptions {
  /** Re-rolls every layout. */
  seed?: number;
  /** Source clip buffer in tile units (default: the Protomaps basemap buffer). */
  buffer?: number;
}

/**
 * Ground colors of the classes this module adds, for palettes that do not name them. Irrigated
 * turf keeps one green in every habitat: a desert course is green fairways in tan rough.
 */
export const LAND_SITE_COLORS: Readonly<Record<string, string>> = {
  golf_fairway: '#7fa258',
  golf_green: '#8fb364',
  golf_tee: '#86aa5e',
  golf_bunker: '#d6c9a6',
  ...SPORTS_COLORS,
};

type Bounds = [minU: number, minV: number, maxU: number, maxV: number];
type GolfKind = 'golf_fairway' | 'golf_green' | 'golf_tee' | 'golf_bunker';
interface Shape {
  kind: GolfKind;
  /** Tile-normalized ring. */
  ring: Vec2[];
  /** Drawn only where this point is on the course: a green, tee or bunker is whole or absent. */
  center?: Vec2;
}
interface Cover {
  polygon: TerrainSemanticPolygon;
  bounds: Bounds;
}

/** Edge of one square of parallel holes, in Mercator meters: 538 m of ground at 33°, 431 at 48°. */
const CELL = 640;
/** Least width of one hole's corridor (fairway, rough and trees to the next), ground meters. */
const CORRIDOR = 70;
/** Ground kept clear at both ends of a square, so holes of neighbouring squares never meet. */
const END = 22;
/** How far any part of a hole may sit from its corridor's center line, short of the edge. */
const EDGE = 6;
/** The shortest hole, tee to green, in ground meters. */
const SHORTEST = 125;
/** Land that is drawn under a course, or is the same turf: it does not interrupt the layout. */
const UNDER = new Set([
  'open_ground',
  'urban_area',
  'residential',
  'commercial',
  'retail',
  'industrial',
  'civic',
  'school',
  'hospital',
  'university',
  'grass',
  'grassland',
  'meadow',
  'park',
  'recreation_ground',
  'village_green',
]);
const ORDER: readonly GolfKind[] = ['golf_fairway', 'golf_green', 'golf_tee', 'golf_bunker'];

const isGolf = (feature: TerrainLandcoverFeature): boolean =>
  feature.class === 'golf_course' || feature.subclass === 'golf_course';
const isPitch = (feature: TerrainLandcoverFeature): boolean =>
  feature.class === 'pitch' || feature.subclass === 'pitch';

function ringBounds(ring: readonly Vec2[]): Bounds {
  let minU = Infinity,
    minV = Infinity,
    maxU = -Infinity,
    maxV = -Infinity;
  for (const [u, v] of ring) {
    if (u < minU) minU = u;
    if (v < minV) minV = v;
    if (u > maxU) maxU = u;
    if (v > maxV) maxV = v;
  }
  return [minU, minV, maxU, maxV];
}
const overlaps = (a: Bounds, b: Bounds): boolean =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const cover = (polygon: TerrainSemanticPolygon): Cover => ({
  polygon,
  bounds: ringBounds(polygon.outer),
});
const clipPolygon = (polygon: TerrainSemanticPolygon): Polygon => [
  polygon.outer,
  ...(polygon.holes ?? []),
];

/** A rounded, slightly lobed outline around a center: `along` is its first axis's direction. */
function blob(
  center: Vec2,
  radii: Vec2,
  along: number,
  hash: number,
  stream: number,
  points = 12,
): Vec2[] {
  const phase = unit01(hash, stream) * dmath.TAU,
    second = unit01(hash, stream + 1) * dmath.TAU;
  const cos = dmath.cos(along),
    sin = dmath.sin(along);
  const ring: Vec2[] = [];
  for (let k = 0; k < points; k++) {
    const angle = (k / points) * dmath.TAU;
    const lobe = 1 + 0.11 * dmath.sin(2 * angle + phase) + 0.05 * dmath.sin(3 * angle + second);
    const x = radii[0] * lobe * dmath.cos(angle),
      y = radii[1] * lobe * dmath.sin(angle);
    ring.push([center[0] + x * cos - y * sin, center[1] + x * sin + y * cos]);
  }
  return ring;
}

/**
 * The holes of one grid square, as outlines in tile coordinates. A square holds parallel
 * corridors, one hole each (two end to end where the square is long enough), so no two holes of
 * any squares can overlap and a tile needs only the squares it touches.
 */
function golfSquare(
  i: number,
  j: number,
  geom: TileGeometry,
  seed: number,
  detailed: boolean,
  out: Shape[],
): void {
  const scale = geom.metersPerUnit;
  const cell = CELL * scale;
  // World units per ground meter at the square, not at the latitude the frame is scaled for.
  const northing = ((j + 0.5) * CELL) / WEB_MERCATOR_EARTH_RADIUS_METERS;
  const unit = (scale * (dmath.exp(northing) + dmath.exp(-northing))) / 2;
  const ground = cell / unit;
  const reach = ground - 2 * END;
  if (reach < SHORTEST) return;
  const id = `site:golf:v1:${seed}:${i}:${j}`;
  const turned = unit01(hashString(id), 0) < 0.5;
  const x0 = i * cell - geom.originX,
    z0 = j * cell - geom.originZ;
  /** Ground meters along (a) and across (b) the square's holes, to tile coordinates. */
  const at = (a: number, b: number): Vec2 =>
    turned
      ? [(x0 + b * unit) / geom.size, (z0 + a * unit) / geom.size]
      : [(x0 + a * unit) / geom.size, (z0 + b * unit) / geom.size];
  const place = (kind: GolfKind, ring: Vec2[], center?: Vec2): void => {
    out.push({
      kind,
      ring: ring.map(([a, b]) => at(a, b)),
      ...(center ? { center: at(...center) } : {}),
    });
  };
  const corridors = Math.max(1, Math.floor(ground / CORRIDOR));
  const width = ground / corridors;
  const room = width / 2 - EDGE;
  for (let c = 0; c < corridors; c++) {
    const corridor = hashString(`${id}:${c}`);
    // Holes end to end until the corridor is used up: short, medium and long ones in the
    // proportions of a full course, the last one taking what length is left.
    const spans: Array<[start: number, length: number]> = [];
    let cursor = unit01(corridor, 4) * 30;
    for (let k = 0; k < 4 && reach - cursor >= SHORTEST; k++) {
      const pick = unit01(corridor, 10 + k),
        draw = unit01(corridor, 20 + k);
      const want =
        pick < 0.25 ? SHORTEST + draw * 60 : pick < 0.8 ? 280 + draw * 120 : 430 + draw * 90;
      const length = Math.min(want, reach - cursor);
      spans.push([cursor, length]);
      cursor += length + 40;
    }
    // Neighbouring corridors play in opposite directions, as out-and-back routing does.
    const odd = (c & 1) === 1;
    const reversed = unit01(corridor, 5) < 0.2 ? !odd : odd;
    spans.forEach(([from, length], index) => {
      const hash = hashString(`${id}:${c}:${index}`);
      const dir = reversed ? -1 : 1;
      const tee = END + from + (reversed ? length : 0);
      const middle = (c + 0.5) * width;
      const half = 15 + unit01(hash, 0) * 5;
      const greenRadii: Vec2 = [10 + unit01(hash, 1) * 4, 9 + unit01(hash, 2) * 4];
      // Sideways positions of tee, middle and green: a gentle dogleg inside the corridor.
      const sway = Math.max(0, room - half * 1.15 - 2);
      const s0 = sway * (unit01(hash, 3) * 2 - 1) * 0.6;
      const s2 = dmath.clamp(
        sway * (unit01(hash, 4) * 2 - 1) * 0.7,
        -Math.max(0, room - 30),
        Math.max(0, room - 30),
      );
      const s1 = dmath.clamp(
        (s0 + s2) / 2 + (unit01(hash, 5) * 2 - 1) * Math.min(sway, length * 0.1),
        -sway,
        sway,
      );
      const line = (t: number): Vec2 => [
        tee + dir * length * t,
        middle + s0 * (1 - t) * (1 - 2 * t) + s1 * 4 * t * (1 - t) + s2 * t * (2 * t - 1),
      ];
      const tangent = (t: number): Vec2 => {
        const a = dir * length,
          b = s0 * (4 * t - 3) + s1 * (4 - 8 * t) + s2 * (4 * t - 1),
          l = dmath.hypot(a, b);
        return [a / l, b / l];
      };
      // A short hole has only an apron before its green; a long one starts past the tees.
      const t0 = length < 200 ? 1 - 50 / length : Math.min(0.3, 70 / length);
      const t1 = 1 - 16 / length;
      const left: Vec2[] = [],
        right: Vec2[] = [];
      const steps = 10;
      const wobbleL = unit01(hash, 6),
        wobbleR = unit01(hash, 7);
      const halfAt = (q: number, wobble: number): number =>
        half *
        (0.7 + 0.3 * dmath.sin(dmath.PI * q)) *
        (1 + 0.14 * dmath.sin(dmath.TAU * (q * 1.5 + wobble)));
      for (let k = 0; k <= steps; k++) {
        const q = k / steps,
          t = t0 + (t1 - t0) * q;
        const p = line(t),
          [ta, tb] = tangent(t);
        const l = halfAt(q, wobbleL),
          r = halfAt(q, wobbleR);
        left.push([p[0] - tb * l, p[1] + ta * l]);
        right.push([p[0] + tb * r, p[1] - ta * r]);
      }
      const cap = (t: number, sign: number): Vec2 => {
        const p = line(t),
          [ta, tb] = tangent(t);
        return [p[0] + sign * ta * half * 0.5, p[1] + sign * tb * half * 0.5];
      };
      place('golf_fairway', [...left, cap(t1, 1), ...right.reverse(), cap(t0, -1)]);
      const green = line(1);
      const heading = dmath.atan2(tangent(1)[1], tangent(1)[0]);
      // The collar: fairway-height turf around the green, joining it to the fairway's end.
      place(
        'golf_fairway',
        blob(green, [greenRadii[0] + 5, greenRadii[1] + 5], heading, hash, 8),
        green,
      );
      place('golf_green', blob(green, greenRadii, heading, hash, 8), green);
      if (!detailed) return;
      const start = line(0);
      // Back and middle tees, and on most holes a forward one.
      for (const [k, offset, chance] of [
        [0, -13, 1],
        [1, 0, 1],
        [2, 14, 0.6],
      ] as const) {
        if (unit01(hash, 20 + k) >= chance) continue;
        const along = 4.5 + unit01(hash, 23 + k) * 1.5,
          across = 3 + unit01(hash, 26 + k);
        const a = start[0] + dir * offset,
          b = start[1] + (unit01(hash, 29 + k) - 0.5) * 5;
        place(
          'golf_tee',
          [
            [a - along, b - across],
            [a + along, b - across],
            [a + along, b + across],
            [a - along, b + across],
          ],
          [a, b],
        );
      }
      // Greenside bunkers at the sides, front corners or back, never across the approach.
      const slots = [100, -100, 140, -140, 0];
      const count = 1 + Math.floor(unit01(hash, 9) * 2.4);
      const first = Math.floor(unit01(hash, 10) * slots.length);
      for (let k = 0; k < count; k++) {
        const slot = slots[(first + k * 2) % slots.length] as number;
        const angle = heading + ((slot + (unit01(hash, 11 + k) - 0.5) * 24) * dmath.PI) / 180;
        const radial = 3.5 + unit01(hash, 14 + k) * 2,
          tangential = 6 + unit01(hash, 17 + k) * 3;
        const distance = Math.max(...greenRadii) + 3.5 + radial;
        const center: Vec2 = [
          green[0] + dmath.cos(angle) * distance,
          green[1] + dmath.sin(angle) * distance,
        ];
        place(
          'golf_bunker',
          blob(center, [radial, tangential], angle, hash, 60 + k * 2, 10),
          center,
        );
      }
      if (length < 250) return;
      const fairwayBunkers = Math.floor(unit01(hash, 70) * 2.6);
      for (let k = 0; k < fairwayBunkers; k++) {
        const q = 0.45 + unit01(hash, 71 + k) * 0.4,
          t = t0 + (t1 - t0) * q;
        const side = unit01(hash, 74 + k) < 0.5 ? -1 : 1;
        const radial = 4 + unit01(hash, 77 + k) * 2,
          tangential = 7 + unit01(hash, 80 + k) * 3;
        const p = line(t),
          [ta, tb] = tangent(t);
        const distance = Math.min(room - radial, half * 1.16 + 3 + radial);
        const center: Vec2 = [p[0] - side * tb * distance, p[1] + side * ta * distance];
        place(
          'golf_bunker',
          blob(center, [tangential, radial], dmath.atan2(tb, ta), hash, 90 + k * 2, 10),
          center,
        );
      }
    });
  }
}

/** Is every corner of `ring` on `polygon`, with none of its edges near the ring? */
function contains(target: Cover, ring: readonly Vec2[], bounds: Bounds): boolean {
  if (
    bounds[0] < target.bounds[0] ||
    bounds[1] < target.bounds[1] ||
    bounds[2] > target.bounds[2] ||
    bounds[3] > target.bounds[3]
  )
    return false;
  for (const edges of [target.polygon.outer, ...(target.polygon.holes ?? [])])
    for (let k = 0; k < edges.length; k++) {
      const a = edges[k] as Vec2,
        b = edges[(k + 1) % edges.length] as Vec2;
      if (
        Math.min(a[0], b[0]) <= bounds[2] &&
        Math.max(a[0], b[0]) >= bounds[0] &&
        Math.min(a[1], b[1]) <= bounds[3] &&
        Math.max(a[1], b[1]) >= bounds[1]
      )
        return false;
    }
  return pointInPolygon(ring[0] as Vec2, target.polygon);
}

const prepared = new WeakMap<TerrainSemanticTile, { key: string; tile: TerrainSemanticTile }>();

/**
 * Add the ground a mapped site implies to a tile's land cover. Pure, and the same for every tile
 * a site crosses; the surface renderer and the batch adapter call it with identical content.
 */
export function prepareLandSites(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  settings: boolean | LandSiteOptions = true,
): TerrainSemanticTile {
  if (
    !settings ||
    geom.levelBelowMax > 2 ||
    !(geom.metersPerUnit > 0) ||
    !(geom.size > 0) ||
    !tile.landcover.some((feature) => isGolf(feature) || isPitch(feature))
  )
    return tile;
  const options = typeof settings === 'object' ? settings : {};
  const seed = options.seed ?? 0;
  const buffer = options.buffer ?? PROTOMAPS_TILE_BUFFER;
  if (!Number.isFinite(seed)) throw new Error('land sites require a finite seed');
  const key = `${seed}:${buffer}:${geom.level}:${geom.x}:${geom.z}:${geom.originX}:${geom.originZ}:${geom.size}:${geom.metersPerUnit}:${geom.levelBelowMax}`;
  const known = prepared.get(tile);
  if (known?.key === key) return known.tile;
  const result = withPitches(withGolf(tile, geom, seed, buffer), geom, buffer);
  prepared.set(tile, { key, tile: result });
  // Preparing the prepared tile again changes nothing.
  prepared.set(result, { key, tile: result });
  return result;
}

function withGolf(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  seed: number,
  buffer: number,
): TerrainSemanticTile {
  const course = tile.landcover.filter(isGolf).flatMap((feature) => feature.polygons.map(cover));
  const blockers: Cover[] = [
    ...tile.landcover
      .filter(
        (feature) =>
          !isGolf(feature) &&
          !isLandcoverDesignation(feature) &&
          !UNDER.has(feature.subclass ?? feature.class) &&
          !UNDER.has(feature.class),
      )
      .flatMap((feature) => feature.polygons),
    ...tile.water.flatMap((feature) => feature.polygons ?? []),
    ...tile.buildings.flatMap((feature) => feature.polygons),
  ].map(cover);
  // The part of the course this tile can see: its own square and the source's clip buffer.
  const view: Bounds = [-buffer, -buffer, 1 + buffer, 1 + buffer];
  let seen: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { bounds } of course)
    seen = [
      Math.min(seen[0], Math.max(view[0], bounds[0])),
      Math.min(seen[1], Math.max(view[1], bounds[1])),
      Math.max(seen[2], Math.min(view[2], bounds[2])),
      Math.max(seen[3], Math.min(view[3], bounds[3])),
    ];
  if (!(seen[0] < seen[2] && seen[1] < seen[3])) return tile;
  const cell = CELL * geom.metersPerUnit;
  const shapes: Shape[] = [];
  for (
    let j = Math.floor((geom.originZ + seen[1] * geom.size) / cell);
    j <= Math.floor((geom.originZ + seen[3] * geom.size) / cell);
    j++
  )
    for (
      let i = Math.floor((geom.originX + seen[0] * geom.size) / cell);
      i <= Math.floor((geom.originX + seen[2] * geom.size) / cell);
      i++
    )
      golfSquare(i, j, geom, seed, geom.levelBelowMax <= 1, shapes);
  // A point just past the clip buffer is judged where the tile can still see the course, so the
  // sliver of a green that reaches this tile is drawn as its own tile draws the rest.
  const inner = buffer * 0.9;
  const visible = ([u, v]: Vec2): Vec2 => [
    dmath.clamp(u, -inner, 1 + inner),
    dmath.clamp(v, -inner, 1 + inner),
  ];
  const on = (list: readonly Cover[], point: Vec2): boolean =>
    list.some(
      ({ polygon, bounds }) =>
        point[0] >= bounds[0] &&
        point[0] <= bounds[2] &&
        point[1] >= bounds[1] &&
        point[1] <= bounds[3] &&
        pointInPolygon(point, polygon),
    );
  const least = 4 / (geom.size * geom.size);
  const polygons = new Map<GolfKind, TerrainSemanticPolygon[]>();
  const courseClip: MultiPolygon = course.map(({ polygon }) => clipPolygon(polygon));
  for (const shape of shapes) {
    const bounds = ringBounds(shape.ring);
    if (!overlaps(bounds, seen)) continue;
    if (shape.center) {
      const center = visible(shape.center);
      if (!on(course, center) || on(blockers, center)) continue;
    }
    const cuts = blockers.filter((blocker) => overlaps(bounds, blocker.bounds));
    let pieces: TerrainSemanticPolygon[];
    if (cuts.length === 0 && course.some((target) => contains(target, shape.ring, bounds)))
      pieces = [{ outer: shape.ring }];
    else {
      try {
        let clipped = polygonClipping.intersection([shape.ring], courseClip);
        if (cuts.length > 0 && clipped.length > 0)
          clipped = polygonClipping.difference(
            clipped,
            cuts.map(({ polygon }) => clipPolygon(polygon)),
          );
        pieces = clipped.flatMap(([outer, ...holes]) =>
          outer ? [{ outer, ...(holes.length > 0 ? { holes } : {}) }] : [],
        );
      } catch {
        // Degenerate source rings: leave this outline out rather than fail the tile.
        pieces = [];
      }
    }
    for (const piece of pieces) {
      if (polygonArea(piece) < least) continue;
      const list = polygons.get(shape.kind) ?? [];
      list.push(piece);
      polygons.set(shape.kind, list);
    }
  }
  if (polygons.size === 0) return tile;
  return {
    ...tile,
    landcover: [
      ...tile.landcover,
      ...ORDER.flatMap((kind): TerrainLandcoverFeature[] => {
        const list = polygons.get(kind);
        return list ? [{ id: `site:${kind}`, class: kind, polygons: list }] : [];
      }),
    ],
  };
}

/** Edge of one cemetery section, in Mercator meters: 54 m of ground at 33°, 43 at 48°. */
const SECTION = 64;
/** Ground meters between rows of graves, and between headstones along a row. */
const ROW = 5;
const PLOT = 2.4;
/** Half the grass lane between sections, and the least distance from a stone to the boundary. */
const LANE = 2.5;
/** Headstones a tile draws. Past it whole sections stay lawn, so the rest keep their rows. */
const MOST_STONES = 3000;
/** Granite, marble and sandstone, sRGB-encoded. */
const STONE: readonly Vec3[] = [
  [0.73, 0.71, 0.68],
  [0.61, 0.6, 0.58],
  [0.47, 0.47, 0.48],
  [0.7, 0.66, 0.58],
  [0.85, 0.84, 0.8],
];
/** Mapped cover a grave can lie under: the trees and gardens of the cemetery itself. */
const PLANTED = new Set(['wood', 'forest', 'scrub', 'garden', 'trees']);
const GRAVES = new Set(['cemetery', 'grave_yard']);
const isCemetery = (feature: TerrainLandcoverFeature): boolean =>
  GRAVES.has(feature.class) || (feature.subclass !== undefined && GRAVES.has(feature.subclass));

/**
 * Headstones for the cemeteries of a finest-level tile, as box placements for the batch. Rows
 * and sections sit on a world grid, so a cemetery cut by a tile edge keeps its rows across it,
 * and every stone belongs to the one tile its base is in.
 */
export function landSiteProps(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  settings: boolean | LandSiteOptions = true,
): ModelPlacementRequest[] {
  if (!settings || geom.levelBelowMax !== 0 || !(geom.metersPerUnit > 0) || !(geom.size > 0))
    return [];
  const grounds = tile.landcover
    .filter(isCemetery)
    .flatMap((feature) => feature.polygons.map(cover));
  if (grounds.length === 0) return [];
  const seed = typeof settings === 'object' ? (settings.seed ?? 0) : 0;
  if (!Number.isFinite(seed)) throw new Error('land sites require a finite seed');
  const { size, metersPerUnit: scale } = geom;
  const blockers: Cover[] = [
    ...tile.landcover
      .filter(
        (feature) =>
          !isCemetery(feature) &&
          !isLandcoverDesignation(feature) &&
          ![feature.class, feature.subclass ?? feature.class].some(
            (label) => UNDER.has(label) || PLANTED.has(label),
          ),
      )
      .flatMap((feature) => feature.polygons),
    ...tile.water.flatMap((feature) => feature.polygons ?? []),
    ...tile.buildings.flatMap((feature) => feature.polygons),
  ].map(cover);
  // Roads, drives and paths, in tile meters, with the width each one clears.
  const ways = new InfillBins<{ a: Vec2; b: Vec2; clear: number }>(size);
  for (const road of tile.transportation) {
    if (road.tunnel) continue;
    const clear = roadWidth(road.class, road.width) / 2 + 1.2;
    for (const line of road.lines)
      for (let k = 1; k < line.length; k++) {
        const a: Vec2 = [(line[k - 1] as Vec2)[0] * size, (line[k - 1] as Vec2)[1] * size],
          b: Vec2 = [(line[k] as Vec2)[0] * size, (line[k] as Vec2)[1] * size];
        ways.add({ a, b, clear }, [
          Math.min(a[0], b[0]) - clear,
          Math.min(a[1], b[1]) - clear,
          Math.max(a[0], b[0]) + clear,
          Math.max(a[1], b[1]) + clear,
        ]);
      }
  }
  /** How `point` lies to the nearest of `list`: inside one, within `reach` of an edge, or clear. */
  const against = (
    list: readonly Cover[],
    point: Vec2,
    reach: number,
  ): 'inside' | 'near' | 'clear' => {
    let verdict: 'inside' | 'near' | 'clear' = 'clear';
    for (const { polygon, bounds } of list) {
      if (
        point[0] < bounds[0] - reach ||
        point[0] > bounds[2] + reach ||
        point[1] < bounds[1] - reach ||
        point[1] > bounds[3] + reach
      )
        continue;
      for (const ring of [polygon.outer, ...(polygon.holes ?? [])])
        for (let k = 0; k < ring.length; k++)
          if (distance(point, ring[k] as Vec2, ring[(k + 1) % ring.length] as Vec2) < reach)
            return 'near';
      if (pointInPolygon(point, polygon)) verdict = 'inside';
    }
    return verdict;
  };
  let seen: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { bounds } of grounds)
    seen = [
      Math.min(seen[0], Math.max(0, bounds[0])),
      Math.min(seen[1], Math.max(0, bounds[1])),
      Math.max(seen[2], Math.min(1, bounds[2])),
      Math.max(seen[3], Math.min(1, bounds[3])),
    ];
  if (!(seen[0] < seen[2] && seen[1] < seen[3])) return [];
  const section = SECTION * scale;
  const stones: Array<{ rank: number; request: ModelPlacementRequest }> = [];
  for (
    let j = Math.floor((geom.originZ + seen[1] * size) / section);
    j <= Math.floor((geom.originZ + seen[3] * size) / section);
    j++
  ) {
    const northing = ((j + 0.5) * SECTION) / WEB_MERCATOR_EARTH_RADIUS_METERS;
    const unit = (scale * (dmath.exp(northing) + dmath.exp(-northing))) / 2;
    const ground = section / unit;
    const rows = Math.floor((ground - 2 * LANE) / ROW),
      plots = Math.floor((ground - 2 * LANE) / PLOT);
    const inset = (LANE * unit) / size,
      beside = (1.5 * unit) / size;
    for (
      let i = Math.floor((geom.originX + seen[0] * size) / section);
      i <= Math.floor((geom.originX + seen[2] * size) / section);
      i++
    ) {
      const hash = hashString(`site:grave:v1:${seed}:${i}:${j}`);
      // Sections share a direction in blocks of four by four; one in eight is open lawn.
      const turned = unit01(hashString(`site:graves:v1:${seed}:${i >> 2}:${j >> 2}`), 0) < 0.5;
      const fill = [0, 0.3, 0.45, 0.6, 0.6, 0.75, 0.75, 0.9][Math.floor(unit01(hash, 0) * 8)] ?? 0;
      if (fill === 0) continue;
      const x0 = i * section - geom.originX,
        z0 = j * section - geom.originZ;
      for (let r = 0; r < rows; r++)
        for (let s = 0; s < plots; s++) {
          const stone = (hash + Math.imul(r * 131 + s + 1, 0x9e3779b1)) | 0;
          if (unit01(stone, 0) >= fill) continue;
          const along = LANE + (s + 0.5) * PLOT + (unit01(stone, 1) - 0.5) * 0.3,
            across = LANE + (r + 0.5) * ROW;
          const x = x0 + (turned ? across : along) * unit,
            z = z0 + (turned ? along : across) * unit;
          const u = x / size,
            v = z / size;
          if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
          if (
            against(grounds, [u, v], inset) !== 'inside' ||
            against(blockers, [u, v], beside) !== 'clear' ||
            ways
              .query([x - 12, z - 12, x + 12, z + 12])
              .some((way) => distance([x, z], way.a, way.b) < way.clear * unit)
          )
            continue;
          // Mostly upright stones, some flat markers, the odd tall monument.
          const kind = unit01(stone, 2);
          const dimensions: Vec3 =
            kind < 0.2
              ? [0.6, 0.12, 0.4]
              : kind < 0.24
                ? [0.7, 1.5 + unit01(stone, 3) * 0.7, 0.7]
                : [
                    0.5 + unit01(stone, 3) * 0.4,
                    0.5 + unit01(stone, 4) * 0.55,
                    0.16 + unit01(stone, 5) * 0.08,
                  ];
          const shade = 0.92 + unit01(stone, 7) * 0.16;
          const tone = STONE[Math.floor(unit01(stone, 6) * STONE.length)] as Vec3;
          stones.push({
            rank: unit01(hash, 1),
            request: {
              identity: `site:grave:${i}:${j}:${r}:${s}`,
              model: 'builtin:box',
              at: [x, z],
              yaw: (turned ? dmath.PI / 2 : 0) + (unit01(stone, 8) - 0.5) * 0.12,
              scale: [dimensions[0] * unit, dimensions[1] * unit, dimensions[2] * unit],
              color: [
                Math.min(1, tone[0] * shade),
                Math.min(1, tone[1] * shade),
                Math.min(1, tone[2] * shade),
              ],
            },
          });
        }
    }
  }
  if (stones.length > MOST_STONES) {
    stones.sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.request.identity < b.request.identity ? -1 : 1,
    );
    stones.length = MOST_STONES;
  }
  return stones.map((stone) => stone.request);
}
