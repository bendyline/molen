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
  corridor,
  InfillBins,
  lineNearPolygon,
  polygonsNear,
  segmentDistance,
} from './infill-geometry';
import { contextLabelAt, landcoverLabel } from './labels';
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
  };
}
export type InfillStyleAt = (
  point: Vec2,
  use: 'house' | 'commercial',
  identity: string,
) => ArchStyleDoc | undefined;
type Segment = { a: Vec2; b: Vec2; width: number; street: boolean; walkable: boolean; key: string };
type Obstacle = { polygon: TerrainSemanticPolygon; use?: 'house' | 'commercial' };
type Lot = {
  id: string;
  rank: number;
  parcel: TerrainSemanticPolygon;
  features: InferredBuildingFeature[];
};
const PITCH = 16; // Projected-meter frontage, anchored to the global line rather than tile endpoints.
const RADIUS = 240;
const MAX_LOTS = 3072;
const HALO = 64;
const STREETS = new Set([
  'minor_road',
  'residential',
  'unclassified',
  'living_street',
  'tertiary',
  'secondary',
]);
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
    size = geom.size;
  if (
    !settings ||
    density === 0 ||
    tile.buildingsGeneralized ||
    geom.levelBelowMax > 1 ||
    !(scale > 0) ||
    !(size > 0) ||
    size / (PITCH * scale) > 300
  )
    return [];
  const metric = (p: Vec2): Vec2 => [p[0] * size, p[1] * size];
  const polygon = (p: TerrainSemanticPolygon): TerrainSemanticPolygon => ({
    outer: p.outer.map(metric),
    holes: p.holes?.map((r) => r.map(metric)),
  });
  const segments = new InfillBins<Segment>(size),
    all = new Map<string, Segment>();
  const addLine = (line: Vec2[], width: number, street: boolean, walkable = false): void => {
    for (let i = 1; i < line.length; i++) {
      let a = metric(line[i - 1] as Vec2),
        b = metric(line[i] as Vec2);
      if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) [a, b] = [b, a];
      if (dmath.hypot(b[0] - a[0], b[1] - a[1]) < 0.1) continue;
      const coord = (p: Vec2): string =>
        `${Math.round(((p[0] + geom.originX) / scale) * 1000)},${Math.round(((p[1] + geom.originZ) / scale) * 1000)}`;
      const key = `${coord(a)}|${coord(b)}|${width}|${street}`;
      if (all.has(key)) continue;
      const s = { a, b, width, street, walkable, key };
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
    for (const line of r.lines) addLine(line, roadWidth(r.class, r.width), street, walkable);
  }
  for (const w of tile.water)
    for (const line of w.lines ?? []) addLine(line, waterwayWidth(w.class, w.width) + 8, false);
  const obstacles = new InfillBins<Obstacle>(size);
  const addObstacle = (p: TerrainSemanticPolygon, use?: Obstacle['use']): void => {
    const poly = polygon(p);
    obstacles.add({ polygon: poly, ...(use ? { use } : {}) }, polygonBounds(poly));
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
      !landcoverLabel(cover)
        .split(/\s+/)
        .every((l) => OPEN.has(l))
    )
      for (const p of cover.polygons) addObstacle(p);
  const lots = new Map<string, Lot>();
  for (const road of [...all.values()]
    .filter((r) => r.street)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
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
        const blockHash = hashString(blockId);
        const districtStyle = styleAt?.(anchor, 'house', blockId);
        const compact = districtStyle?.id.includes('.east_asian.') === true;
        if (lots.has(id)) continue;
        // Derive metric offsets from the geographic location, not the camera's latitude scale.
        const northing = (anchor[1] + geom.originZ) / scale / WEB_MERCATOR_EARTH_RADIUS_METERS;
        const metricScale = (scale * (dmath.exp(northing) + dmath.exp(-northing))) / 2;
        let front =
          (road.width / 2 +
            (compact ? 1.5 : 2.5 + unit01(blockHash, 1) * 2) +
            unit01(hash, 1) * 1.1) *
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
        const context = contextLabelAt([center[0] / size, center[1] / size], tile.landcover);
        const known = obstacles.query(around(...center, 100)).filter((o) => {
          const b = polygonBounds(o.polygon);
          return (
            o.use &&
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
        const neighborhood = segments
          .query(around(...center, RADIUS))
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        const observed =
          ((Math.min(RADIUS, center[0]) + Math.min(RADIUS, size - center[0])) *
            (Math.min(RADIUS, center[1]) + Math.min(RADIUS, size - center[1]))) /
          (4 * RADIUS * RADIUS);
        const streetLength = neighborhood.reduce(
          (n, r) => n + (r.street ? lengthInside(r, center) : 0),
          0,
        );
        const mapped =
          context === 'residential' || context === 'commercial' || context === 'retail';
        if (
          mapped
            ? streetLength < 300 * observed
            : streetLength < 650 * observed || !hasNetwork(neighborhood, center)
        )
          continue;
        const style = styleAt?.(center, use, blockId);
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
            .some((o) => polygonsNear(parcel, o.polygon, 0.6))
        )
          continue;
        const envelope = rect(-width / 2, 0, width / 2, depth);
        const localRoads = segments.query([
          bounds[0] - 20,
          bounds[1] - 20,
          bounds[2] + 20,
          bounds[3] + 20,
        ]);
        if (localRoads.some((r) => lineNearPolygon(r.a, r.b, envelope, r.width / 2 + 0.7)))
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
          approaches.some((a) =>
            localRoads.some(
              (r) =>
                !r.walkable &&
                r.key !== road.key &&
                lineNearPolygon(r.a, r.b, corridor(a.from, a.to, a.width), r.width / 2),
            ),
          )
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
                    segmentDistance(a, b, r.a, r.b) < r.width / 2 + padding,
                ) &&
                !obstacles.query(bounds).some((o) => lineNearPolygon(a, b, o.polygon, padding)),
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
  for (const lot of [...lots.values()].sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1))) {
    if (occupied.query(polygonBounds(lot.parcel)).some((p) => polygonsNear(p, lot.parcel, 0.15)))
      continue;
    occupied.add(lot.parcel, polygonBounds(lot.parcel));
    if (
      lot.parcel.outer.every(([x, z]) => x >= 0.5 && z >= 0.5 && x <= size - 0.5 && z <= size - 0.5)
    )
      accepted.push(lot);
    if (accepted.length === MAX_LOTS) break;
  }
  return accepted.filter((l) => unit01(l.rank, 0) < density).flatMap((l) => l.features);
}
