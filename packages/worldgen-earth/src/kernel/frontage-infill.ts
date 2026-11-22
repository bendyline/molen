/** Stable, street-facing lots with reserved approaches and regional procedural plans. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  polygonBounds,
  roadWidth,
  type TerrainBuildingFeature,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  WEB_MERCATOR_EARTH_RADIUS_METERS,
  waterwayWidth,
} from '@bendyline/molen-terrain/kernel';
import {
  type ArchStyleDoc,
  type BuildingRequest,
  createLotBuildingPlan,
  type HeightSampler,
  hashString,
  type LotPlanChoice,
  type LotPlanKind,
  unit01,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import { createFrontageYard } from './frontage-yard';
import {
  around,
  type Bounds,
  corridor,
  InfillBins,
  lineNearPolygon,
  polygonExtent,
  polygonsNear,
  segmentsWithin,
} from './infill-geometry';
import { contextLabelAt, isPlaceOutline, landcoverLabel } from './labels';
import type { TileGeometry } from './semantic-adapter';

export interface BuildingInfillOptions {
  seed?: number;
  /** Stable keep fraction, 0..1. */
  density?: number;
}
export interface InferredBuildingFeature extends TerrainBuildingFeature {
  infill: {
    lotId: string;
    shape: LotPlanKind;
    part: 'home' | 'garage';
    /** Tile-local meters, including the reserved approach. */
    parcel: TerrainSemanticPolygon;
    groundOutline: Vec2[];
    access: NonNullable<BuildingRequest['access']>;
    yard?: BuildingRequest['yard'];
    style?: string;
    /** Outline edges built against the next building of a row. */
    partyEdges?: number[];
  };
}
/** The style of an invented lot: a house in a yard, a house in a row (`terrace`), or a shop. */
export type InfillStyleAt = (
  point: Vec2,
  use: 'house' | 'terrace' | 'commercial',
  identity: string,
) => ArchStyleDoc | undefined;
type Segment = {
  a: Vec2;
  b: Vec2;
  width: number;
  street: boolean;
  /** A street of the neighbourhood itself (LOCAL_STREETS), not a lane or a road through. */
  local: boolean;
  walkable: boolean;
  key: string;
  /** Position in key order, for sorting neighborhoods without comparing key strings. */
  rank: number;
};
type Obstacle = {
  polygon: TerrainSemanticPolygon;
  /** Outer ring bounds (what the bins index); `extent` adds any holes. */
  bounds: Bounds;
  extent: Bounds;
  use?: 'house' | 'commercial';
};
type Lot = {
  id: string;
  rank: number;
  parcel: TerrainSemanticPolygon;
  features: InferredBuildingFeature[];
};
const PITCH = 16; // Projected-meter frontage, anchored to the global line rather than tile endpoints.
const RADIUS = 240;
/** Lots one zoom-14-sized tile may hold; a larger tile may hold as many per area (see lotCap). */
const MAX_LOTS = 3072;
/** Frontage slots across a zoom-14 tile, the area MAX_LOTS is counted over. */
const LOT_CAP_SLOTS = 153;
/**
 * Frontage slots across a tile beyond which no lots are laid out in it. A zoom-15 tile is 76
 * slots wide, a zoom-14 one 153 and a zoom-13 one 306. The level below the finest is held to
 * MAX_SLOTS, so a package with zoom-14 or zoom-15 tiles invents buildings on its two finest
 * levels and not on the zoom-13 tiles behind them, whose lots are seen from too far to matter.
 * The finest level may be as coarse as MAX_FINEST_SLOTS: a package whose finest tiles are zoom
 * 13 (a planet-wide release, 3 to 5 km tiles) still fills in the streets the map has no
 * footprints for, where the camera stands. Such a tile costs what its streets do. A dense
 * zoom-13 town tile (Alicante, November 2026) lays out 6,300 buildings in about 0.65 s, and the
 * whole tile takes 1.4 s to generate instead of 0.45 s. Before the bounds tests, rank-ordered
 * street sums and the adapter's style cache, the layout alone took 2.3 to 2.7 s.
 */
const MAX_SLOTS = 300;
const MAX_FINEST_SLOTS = 320;
/** Row fronts and depths where a style names none: a plain two-up terrace. */
const ROW_UNITS = { min: 2, max: 2 };
const ROW_SETBACK = { min: 0.3, max: 1.2 };
const ROW_DEPTH = { min: 9, max: 13 };
const ROW_LEVELS = { min: 2, max: 3 };
/** A row's setback is measured from the back of the footway a street carries beside it, m. */
const ROW_WALK = 1.9;
/**
 * The shallowest a lot's building can be, m, by the depths laid out below: a house in a yard
 * (13 and up), a compact one (17 and up; a shop is 19), and how far a row house's rear may step
 * in from its block's depth (half of the 2.4 m its rear walls vary by). Whatever a slot builds,
 * its parcel reaches at least this far back, which lets an occupied slot be told early.
 */
const YARD_DEPTH = 13;
const COMPACT_DEPTH = 17;
const ROW_DEPTH_STEP = 1.2;
const HALO = 64;
const STREETS = new Set([
  'minor_road',
  'residential',
  'unclassified',
  'living_street',
  'tertiary',
  'secondary',
]);
/**
 * Streets a neighbourhood is made of. Any of STREETS can carry lots, but where no land use is
 * mapped, a metre of the others (an unclassified lane between fields, a tertiary or secondary
 * road through) counts for THROUGH_WEIGHT of a metre toward the street length that shows a
 * neighbourhood: such a network must be three times as dense as one of residential streets.
 *
 * Measured against Spain's cadastre on the zoom-13 world package (November 2026). With every
 * street counted alike, lanes through the huerta north of Alicante and the dispersed countryside
 * round Oviedo were lined with houses: a fifth of Alicante's invented buildings and a third of
 * Oviedo's stood where the cadastre has under 1% of the ground built. Outside mapped land use
 * the median such building had 1,040 m of street within RADIUS, 110 m of it local (Oviedo:
 * 1,060 m and none), while one standing on a real unmapped building in Alicante had 1,700 m,
 * 1,200 m of it local. At one third, twelve tiles round each city lay out 10% fewer buildings
 * in Alicante and 58% fewer round Oviedo. Of those drawn at High, the ones on empty ground fall
 * by 47% and 65%. Alicante keeps every invented building that stood on a real unmapped one;
 * Oviedo, where the map already holds 85% of the real buildings and only 3% of invented ones
 * stood on a real one, loses 400 of 1,060. A dense grid of collectors alone still counts.
 */
const LOCAL_STREETS = new Set(['minor_road', 'residential', 'living_street']);
const THROUGH_WEIGHT = 1 / 3;
const OPEN = new Set(['residential', 'urban_area', 'neighbourhood', 'commercial', 'retail']);
const DEFAULT_PLANS: LotPlanChoice[] = [
  { shape: 'cottage', weight: 3 },
  { shape: 'ranch', weight: 2 },
  { shape: 'compact', weight: 1 },
];
function lengthInside(s: Segment, p: Vec2): number {
  const dx = s.b[0] - s.a[0],
    dz = s.b[1] - s.a[1],
    l = dmath.hypot(dx, dz),
    ux = dx / l,
    uz = dz / l;
  const px = p[0] - s.a[0],
    pz = p[1] - s.a[1],
    along = px * ux + pz * uz,
    across = px * uz - pz * ux;
  if (Math.abs(across) >= RADIUS) return 0;
  const reach = dmath.sqrt(RADIUS * RADIUS - across * across);
  return Math.max(0, Math.min(l, along + reach) - Math.max(0, along - reach));
}
function hasNetwork(roads: Segment[], p: Vec2): boolean {
  const corridors: Segment[] = [];
  for (const r of roads) {
    if (!r.street || lengthInside(r, p) < 20) continue;
    const dx = r.b[0] - r.a[0],
      dz = r.b[1] - r.a[1],
      length = dmath.hypot(dx, dz);
    if (
      !corridors.some((o) => {
        const ox = o.b[0] - o.a[0],
          oz = o.b[1] - o.a[1],
          ol = dmath.hypot(ox, oz);
        return (
          Math.abs(dx * oz - dz * ox) / (length * ol) < 0.1 &&
          Math.abs((r.a[0] - o.a[0]) * oz - (r.a[1] - o.a[1]) * ox) / ol < 16
        );
      })
    )
      corridors.push(r);
    if (corridors.length >= 3) return true;
  }
  return false;
}
function choosePlan(choices: readonly LotPlanChoice[], hash: number): LotPlanKind {
  let value = unit01(hash, 7) * choices.reduce((n, c) => n + c.weight, 0);
  for (const c of choices) {
    value -= c.weight;
    if (value < 0) return c.shape;
  }
  return choices[0]?.shape ?? 'compact';
}

/** Entire lots, including driveways, stay clear of occupied ground and have one public frontage. */
export function inferBuildingFootprints(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  settings: boolean | BuildingInfillOptions,
  ground?: HeightSampler,
  excluded: readonly TerrainSemanticPolygon[] = [],
  styleAt?: InfillStyleAt,
): InferredBuildingFeature[] {
  const options = typeof settings === 'object' ? settings : {},
    seed = options.seed ?? 0,
    density = options.density ?? 1;
  if (!Number.isFinite(seed) || !Number.isFinite(density) || density < 0 || density > 1)
    throw new Error('buildingInfill requires a finite seed and density in 0..1');
  const scale = geom.metersPerUnit,
    size = geom.size,
    slots = size / (PITCH * scale);
  if (
    !settings ||
    density === 0 ||
    tile.buildingsGeneralized ||
    geom.levelBelowMax > 1 ||
    !(scale > 0) ||
    !(size > 0) ||
    slots > (geom.levelBelowMax === 0 ? MAX_FINEST_SLOTS : MAX_SLOTS)
  )
    return [];
  // A tile larger than a zoom-14 one may hold as many lots for its area.
  const lotCap = Math.max(
    MAX_LOTS,
    Math.floor(MAX_LOTS * (slots / LOT_CAP_SLOTS) * (slots / LOT_CAP_SLOTS)),
  );
  const metric = (p: Vec2): Vec2 => [p[0] * size, p[1] * size];
  const polygon = (p: TerrainSemanticPolygon): TerrainSemanticPolygon => ({
    outer: p.outer.map(metric),
    holes: p.holes?.map((r) => r.map(metric)),
  });
  const segments = new InfillBins<Segment>(size),
    all = new Map<string, Segment>();
  const addLine = (
    line: Vec2[],
    width: number,
    street: boolean,
    walkable = false,
    local = false,
  ): void => {
    for (let i = 1; i < line.length; i++) {
      let a = metric(line[i - 1] as Vec2),
        b = metric(line[i] as Vec2);
      if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) [a, b] = [b, a];
      if (dmath.hypot(b[0] - a[0], b[1] - a[1]) < 0.1) continue;
      const coord = (p: Vec2): string =>
        `${Math.round(((p[0] + geom.originX) / scale) * 1000)},${Math.round(((p[1] + geom.originZ) / scale) * 1000)}`;
      const key = `${coord(a)}|${coord(b)}|${width}|${street}`;
      const known = all.get(key);
      if (known) {
        // The same segment mapped twice: local if either says so, whichever came first.
        if (local) known.local = true;
        continue;
      }
      const s = { a, b, width, street, local, walkable, key, rank: 0 };
      all.set(key, s);
      segments.add(s, [
        Math.min(a[0], b[0]) - width,
        Math.min(a[1], b[1]) - width,
        Math.max(a[0], b[0]) + width,
        Math.max(a[1], b[1]) + width,
      ]);
    }
  };
  for (const r of tile.transportation) {
    if (r.tunnel) continue;
    const street =
      !r.bridge &&
      !r.link &&
      (r.layer ?? 0) === 0 &&
      !r.service &&
      STREETS.has(r.subclass ?? r.class);
    const walkable =
      r.class === 'path' &&
      ['sidewalk', 'footway', 'crossing', 'cycleway'].includes(r.subclass ?? '');
    const local = street && LOCAL_STREETS.has(r.subclass ?? r.class);
    for (const line of r.lines) addLine(line, roadWidth(r.class, r.width), street, walkable, local);
  }
  for (const w of tile.water)
    for (const line of w.lines ?? []) addLine(line, waterwayWidth(w.class, w.width) + 8, false);
  const obstacles = new InfillBins<Obstacle>(size);
  const addObstacle = (p: TerrainSemanticPolygon, use?: Obstacle['use']): void => {
    const poly = polygon(p),
      bounds = polygonBounds(poly),
      extent = poly.holes?.length ? polygonExtent(poly) : bounds;
    obstacles.add({ polygon: poly, bounds, extent, ...(use ? { use } : {}) }, bounds);
  };
  for (const f of tile.buildings) {
    const label = f.subclass ?? f.class;
    const use = ['retail', 'shop', 'commercial', 'office'].includes(label ?? '')
      ? 'commercial'
      : ['house', 'residential', 'detached', 'apartments'].includes(label ?? '')
        ? 'house'
        : undefined;
    for (const p of f.polygons) addObstacle(p, use);
  }
  for (const p of excluded) addObstacle(p);
  for (const w of tile.water) for (const p of w.polygons ?? []) addObstacle(p);
  for (const cover of tile.landcover)
    if (
      !isPlaceOutline(cover) &&
      !landcoverLabel(cover)
        .split(/\s+/)
        .every((l) => OPEN.has(l))
    )
      for (const p of cover.polygons) addObstacle(p);
  const lots = new Map<string, Lot>();
  const ordered = [...all.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (let i = 0; i < ordered.length; i++) (ordered[i] as Segment).rank = i;
  // A lot's neighborhood: the streets with some length inside RADIUS of it, in rank order, with
  // those lengths in `inside` by rank. Summed in that order, they give the street length a sum
  // over the whole rank-sorted neighborhood did (its other terms were zeros) without sorting the
  // paths, waterways and far streets of every lot's cells: that sort was a sixth of the work.
  const inside = new Float64Array(ordered.length);
  const streetsAround = (p: Vec2): Segment[] => {
    const near: Segment[] = [];
    for (const r of segments.query(around(...p, RADIUS))) {
      if (!r.street) continue;
      const length = lengthInside(r, p);
      if (!(length > 0)) continue;
      inside[r.rank] = length;
      near.push(r);
    }
    return near.sort((a, b) => a.rank - b.rank);
  };
  for (const road of ordered.filter((r) => r.street)) {
    const dx = road.b[0] - road.a[0],
      dz = road.b[1] - road.a[1],
      length = dmath.hypot(dx, dz),
      ux = dx / length,
      uz = dz / length;
    const start = ((road.a[0] + geom.originX) * ux + (road.a[1] + geom.originZ) * uz) / scale;
    for (
      let index = Math.ceil(start / PITCH - 0.5);
      (index + 0.5) * PITCH < start + length / scale;
      index++
    ) {
      const along = ((index + 0.5) * PITCH - start) * scale;
      const anchor: Vec2 = [road.a[0] + ux * along, road.a[1] + uz * along];
      for (const side of [-1, 1]) {
        const nx = -uz * side,
          nz = ux * side;
        const gx = Math.round(((anchor[0] + geom.originX) / scale) * 100),
          gz = Math.round(((anchor[1] + geom.originZ) / scale) * 100);
        const id = `infill:v3:${seed}:${gx}:${gz}:${side}`,
          hash = hashString(id);
        // A 128 m neighborhood cell shares character while individual lots retain variety.
        // World coordinates keep it stable across tile cuts and camera moves.
        const blockId = `block:${seed}:${Math.floor(gx / 12800)}:${Math.floor(gz / 12800)}`;
        if (lots.has(id)) continue;
        const blockHash = hashString(blockId);
        const districtStyle = styleAt?.(anchor, 'house', blockId);
        const pattern = districtStyle?.lots;
        const compact = pattern?.compact === true;
        // A block is rows or houses in yards as a whole: one street, one pattern.
        const row = pattern?.rows !== undefined && unit01(blockHash, 6) < pattern.rows;
        const rowBack = pattern?.setback ?? ROW_SETBACK;
        // Derive metric offsets from the geographic location, not the camera's latitude scale.
        const northing = (anchor[1] + geom.originZ) / scale / WEB_MERCATOR_EARTH_RADIUS_METERS;
        const metricScale = (scale * (dmath.exp(northing) + dmath.exp(-northing))) / 2;
        let front =
          (road.width / 2 +
            (row
              ? ROW_WALK + rowBack.min + unit01(blockHash, 1) * (rowBack.max - rowBack.min)
              : compact
                ? 1.5
                : 2.5 + unit01(blockHash, 1) * 2) +
            unit01(hash, 1) * (row ? 0.15 : 1.1)) *
          metricScale;
        let fenceFront = (road.width / 2 + 1.3) * metricScale;
        // Separately mapped sidewalks often sit beyond the road's estimated width. Move the
        // frontage behind them instead of rejecting a whole side of an otherwise suitable street.
        for (const path of segments.query(around(...anchor, 40))) {
          if (!path.walkable) continue;
          const px = path.b[0] - path.a[0],
            pz = path.b[1] - path.a[1];
          const length2 = px * px + pz * pz;
          if (Math.abs(px * uz - pz * ux) / dmath.sqrt(length2) > 0.25) continue;
          const t = ((anchor[0] - path.a[0]) * px + (anchor[1] - path.a[1]) * pz) / length2;
          if (t < 0 || t > 1) continue;
          const offset =
            (path.a[0] + px * t - anchor[0]) * nx + (path.a[1] + pz * t - anchor[1]) * nz;
          if (offset > 0 && offset < (road.width / 2 + 16) * metricScale) {
            front = Math.max(front, offset + (path.width / 2 + 1.5) * metricScale);
            fenceFront = Math.max(fenceFront, offset + (path.width / 2 + 0.5) * metricScale);
          }
        }
        const setback = front - (road.width / 2) * metricScale;
        const at = (x: number, z: number): Vec2 => [
          anchor[0] + ux * x + nx * (front + z),
          anchor[1] + uz * x + nz * (front + z),
        ];
        const center = at(0, 8 * scale);
        if (
          center[0] < -HALO ||
          center[1] < -HALO ||
          center[0] > size + HALO ||
          center[1] > size + HALO
        )
          continue;
        // Whatever is built here, its parcel holds at least this much ground: the lot's width,
        // from the approach back to the shallowest plan's rear. Where a mapped building, water or
        // closed land already stands on it there is no lot, and the street census and style
        // lookups below are skipped: in a mapped city that is nearly every slot, and they were a
        // fifth of a tile's generation.
        {
          const rowDepth = pattern?.depth ?? ROW_DEPTH;
          const least =
            (row
              ? Math.min(rowDepth.min, rowDepth.max) - ROW_DEPTH_STEP
              : compact
                ? COMPACT_DEPTH
                : YARD_DEPTH) * scale;
          const halfSlot = (PITCH * scale) / 2 - 0.5;
          const core: TerrainSemanticPolygon = {
            outer: [
              at(-halfSlot, -setback + 0.65),
              at(halfSlot, -setback + 0.65),
              at(halfSlot, least + 0.9),
              at(-halfSlot, least + 0.9),
            ],
          };
          const coreBounds = polygonBounds(core);
          if (
            obstacles
              .query([coreBounds[0] - 1, coreBounds[1] - 1, coreBounds[2] + 1, coreBounds[3] + 1])
              .some((o) => polygonsNear(core, o.polygon, 0.6, o.extent))
          )
            continue;
        }
        const context = contextLabelAt([center[0] / size, center[1] / size], tile.landcover);
        const known = obstacles.query(around(...center, 100)).filter((o) => {
          const b = o.bounds;
          return (
            o.use !== undefined &&
            dmath.hypot((b[0] + b[2]) / 2 - center[0], (b[1] + b[3]) / 2 - center[1]) <= 100
          );
        });
        const commercial =
          context === 'commercial' ||
          context === 'retail' ||
          (context !== 'residential' &&
            known.length >= 3 &&
            known.filter((o) => o.use === 'commercial').length / known.length >= 0.7);
        const use = commercial ? 'commercial' : 'house';
        const neighborhood = streetsAround(center);
        const observed =
          ((Math.min(RADIUS, center[0]) + Math.min(RADIUS, size - center[0])) *
            (Math.min(RADIUS, center[1]) + Math.min(RADIUS, size - center[1]))) /
          (4 * RADIUS * RADIUS);
        let streetLength = 0,
          localLength = 0;
        for (const r of neighborhood) {
          const length = inside[r.rank] as number;
          streetLength += length;
          if (r.local) localLength += length;
        }
        const mapped =
          context === 'residential' || context === 'commercial' || context === 'retail';
        if (
          mapped
            ? streetLength < 300 * observed
            : localLength + THROUGH_WEIGHT * (streetLength - localLength) < 650 * observed ||
              !hasNetwork(neighborhood, center)
        )
          continue;
        const style = styleAt?.(center, use, blockId);
        if (row && pattern !== undefined) {
          // A row: fronts wall to wall at the street. One 16 m frontage holds one to four
          // buildings, and a block keeps one rhythm, so a street reads as a terrace.
          if (unit01(hash, 9) < (pattern.gap ?? 0)) continue;
          const rowStyle = commercial ? style : (styleAt?.(center, 'terrace', blockId) ?? style);
          const slot = PITCH * scale;
          const fronts = pattern.units ?? ROW_UNITS;
          const count = commercial
            ? 1
            : Math.max(
                1,
                Math.min(
                  4,
                  fronts.min + Math.floor(unit01(blockHash, 7) * (fronts.max - fronts.min + 1)),
                ),
              );
          const deep = pattern.depth ?? ROW_DEPTH;
          const blockDepth = deep.min + unit01(blockHash, 3) * (deep.max - deep.min);
          const tall = pattern.levels ?? ROW_LEVELS;
          const units = Array.from({ length: count }, (_, k) => {
            const unitHash = hashString(`${id}:u${k}`);
            return {
              k,
              x0: -slot / 2 + (slot * k) / count,
              x1: -slot / 2 + (slot * (k + 1)) / count,
              // Rear walls step a little from house to house; fronts hold the street line.
              depth:
                (commercial
                  ? Math.max(blockDepth, 12)
                  : blockDepth + (unit01(unitHash, 3) - 0.5) * 2.4) * scale,
              levels: Math.max(
                1,
                Math.round(
                  tall.min +
                    (tall.max - tall.min) *
                      (0.55 * unit01(blockHash, 4) + 0.45 * unit01(unitHash, 4)),
                ),
              ),
            };
          });
          const depthMax = Math.max(...units.map((unit) => unit.depth));
          const ring = (x0: number, z0: number, x1: number, z1: number): Vec2[] =>
            [
              [x0, z0],
              [x1, z0],
              [x1, z1],
              [x0, z1],
            ].map(([x, z]) => at(x as number, z as number));
          const parcel: TerrainSemanticPolygon = {
            outer: ring(-slot / 2 + 0.5, -setback + 0.65, slot / 2 - 0.5, depthMax + 0.9),
          };
          const bounds = polygonBounds(parcel);
          if (
            obstacles
              .query([bounds[0] - 1, bounds[1] - 1, bounds[2] + 1, bounds[3] + 1])
              .some((o) => polygonsNear(parcel, o.polygon, 0.6, o.extent))
          )
            continue;
          const envelope: TerrainSemanticPolygon = {
            outer: ring(-slot / 2, 0, slot / 2, depthMax),
          };
          const envelopeExtent = polygonExtent(envelope);
          const localRoads = segments.query([
            bounds[0] - 20,
            bounds[1] - 20,
            bounds[2] + 20,
            bounds[3] + 20,
          ]);
          if (
            localRoads.some((r) =>
              lineNearPolygon(r.a, r.b, envelope, r.width / 2 + 0.7, envelopeExtent),
            )
          )
            continue;
          const doors = units.map((unit) => (unit.x0 + unit.x1) / 2);
          if (
            doors.some((x) => {
              const path = corridor(at(x, -setback + 0.65), at(x, 0), 1.2),
                pathExtent = polygonExtent(path);
              return localRoads.some(
                (r) =>
                  !r.walkable &&
                  r.key !== road.key &&
                  lineNearPolygon(r.a, r.b, path, r.width / 2, pathExtent),
              );
            })
          )
            continue;
          if (ground) {
            const samples = [...parcel.outer, ...envelope.outer];
            const heights = samples.map((p) => ground.sampleHeight(...p));
            if (
              heights.some((h) => !Number.isFinite(h)) ||
              Math.max(...heights) - Math.min(...heights) > 3 ||
              samples.some(
                (p) => !Number.isFinite(ground.slopeAt(...p)) || ground.slopeAt(...p) > 0.3,
              )
            )
              continue;
          }
          lots.set(id, {
            id,
            rank: hash,
            parcel,
            features: units.map((unit, index): InferredBuildingFeature => {
              const outline = ring(unit.x0, 0, unit.x1, unit.depth);
              const door = doors[index] as number;
              return {
                id: `${id}:u${unit.k}`,
                class: use,
                levels: unit.levels,
                tags: {
                  'molen:inferred': 'street-frontage-v3',
                  'molen:lot-plan': 'row',
                  'molen:lot': id,
                },
                polygons: [{ outer: outline.map(([x, z]): Vec2 => [x / size, z / size]) }],
                infill: {
                  lotId: id,
                  shape: 'compact',
                  part: 'home',
                  parcel,
                  groundOutline: outline,
                  access: {
                    from: at(door, -setback + 0.02),
                    to: at(door, 0),
                    width: 1.2,
                    lift: 0.25,
                  },
                  // The side walls stand against the next house of the row.
                  partyEdges: [1, 3],
                  ...(rowStyle ? { style: rowStyle.id } : {}),
                },
              };
            }),
          });
          continue;
        }
        const shape = choosePlan(
          style?.lotPlans ?? (commercial ? [{ shape: 'shopfront', weight: 1 }] : DEFAULT_PLANS),
          unit01(hash, 8) < 0.7 ? blockHash : hash,
        );
        const width =
          PITCH *
          scale *
          (compact
            ? 0.88 + unit01(hash, 2) * 0.04
            : 0.68 + unit01(blockHash, 2) * 0.13 + unit01(hash, 2) * 0.08);
        const depth =
          (commercial
            ? 19
            : compact
              ? 17 + unit01(hash, 3) * 3
              : 13 + unit01(blockHash, 3) * 4 + unit01(hash, 3) * 3) * scale;
        const plan = createLotBuildingPlan(commercial ? 'shopfront' : shape, width, depth);
        const rect = (x0: number, z0: number, x1: number, z1: number): TerrainSemanticPolygon => ({
          outer: [
            [x0, z0],
            [x1, z0],
            [x1, z1],
            [x0, z1],
          ].map(([x, z]) => at(x as number, z as number)),
        });
        const parcel = rect(
          (-PITCH * scale) / 2 + 0.5,
          -setback + 0.65,
          (PITCH * scale) / 2 - 0.5,
          depth + 0.9,
        );
        const bounds = polygonBounds(parcel);
        if (
          obstacles
            .query([bounds[0] - 1, bounds[1] - 1, bounds[2] + 1, bounds[3] + 1])
            .some((o) => polygonsNear(parcel, o.polygon, 0.6, o.extent))
        )
          continue;
        const envelope = rect(-width / 2, 0, width / 2, depth);
        const envelopeExtent = polygonExtent(envelope);
        const localRoads = segments.query([
          bounds[0] - 20,
          bounds[1] - 20,
          bounds[2] + 20,
          bounds[3] + 20,
        ]);
        if (
          localRoads.some((r) =>
            lineNearPolygon(r.a, r.b, envelope, r.width / 2 + 0.7, envelopeExtent),
          )
        )
          continue;
        const access = (
          entrance: Vec2,
          garage = false,
        ): NonNullable<BuildingRequest['access']> => ({
          from: at(entrance[0], -setback + 0.65),
          to: at(...entrance),
          width: garage ? Math.min(3.4, width * 0.3) : 1.2,
          ...(garage ? { garage: true } : {}),
        });
        const approaches = [
          access(plan.entrance),
          ...(plan.garage ? [access(plan.garage.entrance, true)] : []),
        ];
        if (
          approaches.some((a) => {
            const path = corridor(a.from, a.to, a.width),
              pathExtent = polygonExtent(path);
            return localRoads.some(
              (r) =>
                !r.walkable &&
                r.key !== road.key &&
                lineNearPolygon(r.a, r.b, path, r.width / 2, pathExtent),
            );
          })
        )
          continue;
        if (ground) {
          const samples = [
            ...parcel.outer,
            ...envelope.outer,
            ...approaches.flatMap((a) => [a.from, a.to]),
          ];
          const heights = samples.map((p) => ground.sampleHeight(...p));
          if (
            heights.some((h) => !Number.isFinite(h)) ||
            Math.max(...heights) - Math.min(...heights) > 3 ||
            samples.some(
              (p) => !Number.isFinite(ground.slopeAt(...p)) || ground.slopeAt(...p) > 0.3,
            )
          )
            continue;
        }
        const yard = commercial
          ? undefined
          : createFrontageYard({
              identity: id,
              style,
              width,
              halfLot: (PITCH * scale) / 2 - 0.7,
              front: Math.max(-setback + 0.9, fenceFront - front),
              back: depth + 0.65,
              curb: -setback + 0.02,
              hasGarage: plan.garage !== undefined,
              at,
              entrances: [
                { x: plan.entrance[0], width: 1.2 },
                ...(plan.garage
                  ? [{ x: plan.garage.entrance[0], width: Math.min(3.4, width * 0.3) }]
                  : []),
              ],
              clear: (a, b, padding, driveway) =>
                !localRoads.some(
                  (r) =>
                    !(driveway && (r.walkable || r.key === road.key)) &&
                    segmentsWithin(a, b, r.a, r.b, r.width / 2 + padding),
                ) &&
                !obstacles
                  .query(bounds)
                  .some((o) => lineNearPolygon(a, b, o.polygon, padding, o.extent)),
            });
        const feature = (
          outline: Vec2[],
          entrance: Vec2,
          garage = false,
        ): InferredBuildingFeature => ({
          id: garage ? `${id}:garage` : id,
          class: garage ? 'garage' : use,
          levels: garage
            ? 1
            : compact
              ? unit01(hash, 4) < 0.8
                ? 2
                : 3
              : unit01(hash, 4) < 0.55 + unit01(blockHash, 4) * 0.3
                ? 1
                : 2,
          tags: {
            'molen:inferred': 'street-frontage-v3',
            'molen:lot-plan': shape,
            'molen:lot': id,
          },
          polygons: [
            { outer: outline.map((p) => at(...p)).map(([x, z]): Vec2 => [x / size, z / size]) },
          ],
          infill: {
            lotId: id,
            shape,
            part: garage ? 'garage' : 'home',
            parcel,
            groundOutline: envelope.outer,
            access: {
              ...access(entrance, garage),
              from: at(entrance[0], -setback + 0.02),
              lift: garage ? 0.28 : 0.25,
            },
            ...(!garage && yard ? { yard } : {}),
            ...(style ? { style: style.id } : {}),
          },
        });
        lots.set(id, {
          id,
          rank: hash,
          parcel,
          features: [
            feature(plan.outline, plan.entrance),
            ...(plan.garage ? [feature(plan.garage.outline, plan.garage.entrance, true)] : []),
          ],
        });
      }
    }
  }
  // Resolve junction/curve conflicts including a halo before tile ownership or density thinning.
  const occupied = new InfillBins<TerrainSemanticPolygon>(size),
    accepted: Lot[] = [];
  let built = 0;
  for (const lot of [...lots.values()].sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1))) {
    const extent = polygonExtent(lot.parcel);
    if (
      occupied
        .query(polygonBounds(lot.parcel))
        .some((p) => polygonsNear(p, lot.parcel, 0.15, extent))
    )
      continue;
    occupied.add(lot.parcel, polygonBounds(lot.parcel));
    if (
      lot.parcel.outer.every(([x, z]) => x >= 0.5 && z >= 0.5 && x <= size - 0.5 && z <= size - 0.5)
    )
      accepted.push(lot);
    // A row lot is up to four buildings: count them, so a town of rows stays inside the cap.
    built += lot.features.some((feature) => feature.infill.partyEdges) ? lot.features.length : 1;
    if (built >= lotCap) break;
  }
  return accepted.filter((l) => unit01(l.rank, 0) < density).flatMap((l) => l.features);
}
