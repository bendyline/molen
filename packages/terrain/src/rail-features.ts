/**
 * Three-free railway semantics for the surface painter: what kind of track a mapped line is, and
 * where its level crossings, turnouts, signals and lineside signs stand. Everything here is a
 * pure function of tile-local geometry (meters) and points of interest, so placements are
 * deterministic and identical in the direct and worker surface builders.
 */
import { sampleTerrainLine, type TerrainLinePath } from './line-path';
import type {
  TerrainPoiFeature,
  TerrainSemanticPoint,
  TerrainTransportationFeature,
} from './semantic-types';

/**
 * Which tracks carry overhead catenary: `light` (default) electrifies light rail, trams and
 * subways that run in the open; `all` also heavy rail, as in Japan, India or a European region;
 * `none` draws no wires at all.
 */
export type TerrainRailElectrification = 'none' | 'light' | 'all';

/** Broad railway mode, from the source's kind detail. */
export type TerrainRailMode = 'heavy' | 'light' | 'tram' | 'subway' | 'monorail' | 'funicular';
/** How a track is used: main line, or a siding, yard, spur or crossover track off it. */
export type TerrainRailService = 'main' | 'siding' | 'yard' | 'spur' | 'crossover';

export interface TerrainRailTrack {
  mode: TerrainRailMode;
  service: TerrainRailService;
  /** Out of use: rusted rails, weeds in the ballast, no signals or crossing equipment. */
  disused: boolean;
  /** Track gauge between the rails' running edges, meters. */
  gauge: number;
  /** Concrete sleepers (ties); otherwise timber. */
  concrete: boolean;
  /** Width of the ballast's top, meters: the sleepers' length and a shoulder each side. */
  bed: number;
  /** Raised on a ballast prism with sloped shoulders (main lines and sidings in the open). */
  prism: boolean;
  /** Smaller is more important: budgets furnish main lines first. */
  rank: number;
}

const STANDARD_GAUGE = 1.435;

/** Ground color of mapped railway land (yards, corridors): ballast and cinders. */
export const TERRAIN_RAILWAY_GROUND = '#7f7c74';

/** Height of a ballasted track's rail heads above the ballast top, meters. */
export const TERRAIN_RAIL_HEIGHT = 0.21;

/**
 * Classify a mapped railway line, or undefined for lines that carry no track to draw (abandoned,
 * proposed or under construction, and station or platform outlines). `heavyGauge` is the gauge
 * of the region's heavy-rail network (default standard, 1.435 m; Japan's conventional lines are
 * 1.067 m, India's 1.676 m); lines named as Shinkansen keep standard gauge, and light rail, trams
 * and subways are standard gauge everywhere.
 */
export function terrainRailTrack(
  feature: Pick<TerrainTransportationFeature, 'class' | 'subclass' | 'service' | 'name'>,
  heavyGauge: number = STANDARD_GAUGE,
): TerrainRailTrack | undefined {
  const detail = (feature.subclass ?? feature.class).toLowerCase();
  if (/abandon|razed|proposed|construction|station|platform|halt|dismantled/.test(detail))
    return undefined;
  const disused = /disused/.test(detail);
  const mode: TerrainRailMode = /light_rail|light rail/.test(detail)
    ? 'light'
    : /tram|streetcar/.test(detail)
      ? 'tram'
      : /subway|metro/.test(detail)
        ? 'subway'
        : /monorail/.test(detail)
          ? 'monorail'
          : /funicular/.test(detail)
            ? 'funicular'
            : 'heavy';
  const tag = (feature.service ?? '').toLowerCase();
  const service: TerrainRailService = /yard/.test(tag)
    ? 'yard'
    : /siding/.test(tag)
      ? 'siding'
      : /spur|industrial/.test(tag)
        ? 'spur'
        : /crossover/.test(tag)
          ? 'crossover'
          : 'main';
  let gauge = STANDARD_GAUGE;
  if (/narrow/.test(detail)) gauge = 1.0;
  else if (mode === 'heavy' && !/新幹線|shinkansen/i.test(feature.name ?? '')) gauge = heavyGauge;
  const offMain = service !== 'main';
  // Main lines and light rail on concrete sleepers; sidings, yards, spurs, heritage and disused
  // track on timber, which reads darker from the air, as it does in aerial photographs.
  const concrete =
    !disused &&
    !/preserved|narrow/.test(detail) &&
    (mode === 'light' || mode === 'subway' || mode === 'tram' || (mode === 'heavy' && !offMain));
  const sleeper = gauge + 1.17;
  const shoulder = service === 'main' ? 0.5 : service === 'siding' ? 0.35 : 0.2;
  const bed = mode === 'tram' ? sleeper + 0.3 : sleeper + 2 * shoulder;
  const prism =
    !disused &&
    (service === 'main' || service === 'siding') &&
    mode !== 'tram' &&
    mode !== 'monorail';
  const rank = disused
    ? 6
    : mode === 'heavy' && service === 'main'
      ? 0
      : service === 'main'
        ? mode === 'tram'
          ? 3
          : 1
        : service === 'siding'
          ? 2
          : 4;
  return { mode, service, disused, gauge, concrete, bed, prism, rank };
}

/** Whether a track carries overhead catenary under an electrification policy. */
export function terrainRailElectrified(
  track: TerrainRailTrack,
  policy: TerrainRailElectrification = 'light',
): boolean {
  if (policy === 'none' || track.disused) return false;
  if (track.mode === 'monorail' || track.mode === 'funicular') return false;
  if (track.mode === 'heavy') return policy === 'all';
  return true;
}

/**
 * Pack a track's gauge and sleepers for the pavement material (`TerrainLineBand.variant` on a
 * `TERRAIN_SURFACE_KIND.track` band): bits 0-1 gauge (standard, 1.067 m, 1.676 m, meter), bit 2
 * concrete sleepers, bit 3 a yard's oily ballast, bit 4 disused.
 */
export function terrainRailVariant(track: TerrainRailTrack): number {
  const gauge =
    Math.abs(track.gauge - 1.067) < 0.01
      ? 1
      : Math.abs(track.gauge - 1.676) < 0.01
        ? 2
        : Math.abs(track.gauge - 1.0) < 0.01
          ? 3
          : 0;
  const yard = track.service === 'yard' || track.service === 'spur' ? 1 : 0;
  return gauge + (track.concrete ? 4 : 0) + yard * 8 + (track.disused ? 16 : 0);
}

/** Lateral offset of each rail's centerline from the track's, meters (head 72 mm wide). */
export function terrainRailOffset(gauge: number): number {
  return gauge / 2 + 0.036;
}

/** A line the railway rules read: tile-local meters plus the source feature. */
export interface TerrainRailLine {
  feature: TerrainTransportationFeature;
  path: TerrainLinePath;
  width: number;
}

interface Segment {
  line: number;
  i: number;
  a: TerrainSemanticPoint;
  b: TerrainSemanticPoint;
  start: number;
  length: number;
}

/** A small uniform grid over line segments. */
class SegmentIndex {
  private readonly cells = new Map<string, Segment[]>();
  constructor(
    lines: readonly TerrainRailLine[],
    private readonly size: number,
    accept: (line: TerrainRailLine, index: number) => boolean = () => true,
  ) {
    lines.forEach((line, index) => {
      if (!accept(line, index)) return;
      const { points, distances } = line.path;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1] as TerrainSemanticPoint;
        const b = points[i] as TerrainSemanticPoint;
        const segment: Segment = {
          line: index,
          i: i - 1,
          a,
          b,
          start: distances[i - 1] ?? 0,
          length: (distances[i] ?? 0) - (distances[i - 1] ?? 0),
        };
        // The cells it passes through, sampled every half cell (`near` pads its search to match).
        const steps = Math.min(4096, Math.ceil(segment.length / (size / 2)));
        const keys = new Set<string>();
        for (let k = 0; k <= steps; k++) {
          const t = steps === 0 ? 0 : k / steps;
          keys.add(
            `${Math.floor((a[0] + (b[0] - a[0]) * t) / size)}/${Math.floor((a[1] + (b[1] - a[1]) * t) / size)}`,
          );
        }
        for (const key of keys) {
          const cell = this.cells.get(key);
          if (cell) cell.push(segment);
          else this.cells.set(key, [segment]);
        }
      }
    });
  }

  /** Segments whose cells lie within `reach` of a point (each at most once). */
  near(x: number, z: number, within: number): Segment[] {
    const found = new Set<Segment>();
    const reach = within + this.size / 2;
    for (
      let cx = Math.floor((x - reach) / this.size);
      cx <= Math.floor((x + reach) / this.size);
      cx++
    )
      for (
        let cz = Math.floor((z - reach) / this.size);
        cz <= Math.floor((z + reach) / this.size);
        cz++
      )
        for (const s of this.cells.get(`${cx}/${cz}`) ?? []) found.add(s);
    return [...found];
  }
}

/** The closest point of a segment, its parameter and distance. */
function project(
  x: number,
  z: number,
  s: Segment,
): { t: number; distance: number; x: number; z: number } {
  const dx = s.b[0] - s.a[0],
    dz = s.b[1] - s.a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (s.length * s.length || 1)),
  );
  const px = s.a[0] + dx * t,
    pz = s.a[1] + dz * t;
  return { t, distance: Math.hypot(x - px, z - pz), x: px, z: pz };
}

function unit(dx: number, dz: number): [number, number] {
  const length = Math.hypot(dx, dz) || 1;
  return [dx / length, dz / length];
}

/** Deterministic 0..1 from a world position (rounded to decimeters). */
export function terrainRailHash(x: number, z: number, salt = 0): number {
  let value =
    Math.imul(Math.round(x * 10) + salt * 7919, 73856093) ^ Math.imul(Math.round(z * 10), 19349663);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 13), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** A track a level crossing carries over a road. */
export interface TerrainRailCrossingTrack {
  /** Index into the rail lines. */
  line: number;
  /** Meters along the rail line, and along the road, where their centerlines cross. */
  distance: number;
  roadDistance: number;
  x: number;
  z: number;
  /** Unit tangent of the rail line there. */
  dx: number;
  dz: number;
}

/** A road crossing one or more tracks at grade. */
export interface TerrainRailCrossing {
  /** Index into the roads. */
  road: number;
  /** Center of the crossing on the road's centerline. */
  x: number;
  z: number;
  /** Meters along the road at the crossing's center, and the span its tracks cover. */
  distance: number;
  from: number;
  to: number;
  /** Unit tangent of the road at the crossing. */
  dx: number;
  dz: number;
  tracks: TerrainRailCrossingTrack[];
  /** A mapped `level_crossing` (or `railway_crossing`) point lies on it. */
  mapped: boolean;
}

/** OSM `railway=*` crossing nodes as the Protomaps POI layer names them. */
const CROSSING_POIS = /^(level_crossing|railway_crossing|tram_level_crossing|tram_crossing)$/;

/**
 * Where tracks cross roads at grade: centerline intersections of a rail and a road on the same
 * layer, neither a bridge nor a tunnel, grouped along each road (tracks within 30 m of each other
 * on one road are one crossing, as a double track is). Mapped crossing points confirm a crossing.
 */
export function findTerrainRailCrossings(
  rails: readonly TerrainRailLine[],
  roads: readonly TerrainRailLine[],
  pois: readonly TerrainPoiFeature[] = [],
  tileSize = 1,
): TerrainRailCrossing[] {
  const grade = (line: TerrainRailLine): boolean =>
    line.feature.bridge !== true && line.feature.tunnel !== true;
  const index = new SegmentIndex(roads, 32, grade);
  const hits = new Map<number, TerrainRailCrossingTrack[]>();
  rails.forEach((rail, railIndex) => {
    if (!grade(rail)) return;
    const layer = rail.feature.layer ?? 0;
    const { points, distances } = rail.path;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as TerrainSemanticPoint,
        b = points[i] as TerrainSemanticPoint;
      const ax = b[0] - a[0],
        az = b[1] - a[1];
      const reach = Math.hypot(ax, az) / 2 + 1;
      for (const s of index.near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, reach)) {
        const road = roads[s.line] as TerrainRailLine;
        if ((road.feature.layer ?? 0) !== layer) continue;
        const bx = s.b[0] - s.a[0],
          bz = s.b[1] - s.a[1];
        const cross = ax * bz - az * bx;
        if (Math.abs(cross) < 1e-9) continue;
        const qx = s.a[0] - a[0],
          qz = s.a[1] - a[1];
        const t = (qx * bz - qz * bx) / cross;
        const u = (qx * az - qz * ax) / cross;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        // Crossing at a glancing angle (under ~12°) is a track beside a road, not across it.
        if (Math.abs(cross) < Math.hypot(ax, az) * Math.hypot(bx, bz) * 0.2) continue;
        const [dx, dz] = unit(ax, az);
        const list = hits.get(s.line) ?? [];
        const roadDistance = s.start + s.length * u;
        if (list.some((h) => h.line === railIndex && Math.abs(h.roadDistance - roadDistance) < 0.5))
          continue;
        list.push({
          line: railIndex,
          distance: (distances[i - 1] ?? 0) + ((distances[i] ?? 0) - (distances[i - 1] ?? 0)) * t,
          roadDistance,
          x: a[0] + ax * t,
          z: a[1] + az * t,
          dx,
          dz,
        });
        hits.set(s.line, list);
      }
    }
  });
  const crossings: TerrainRailCrossing[] = [];
  const mappedPoints = pois
    .filter((poi) => CROSSING_POIS.test(poi.class) && poi.bridge !== true && poi.tunnel !== true)
    .map((poi) => [poi.point[0] * tileSize, poi.point[1] * tileSize] as const);
  for (const [roadIndex, list] of [...hits].sort((p, q) => p[0] - q[0])) {
    const road = roads[roadIndex] as TerrainRailLine;
    list.sort((p, q) => p.roadDistance - q.roadDistance || p.line - q.line);
    let group: TerrainRailCrossingTrack[] = [];
    const flush = (): void => {
      if (group.length === 0) return;
      const from = group[0]?.roadDistance ?? 0;
      const to = group.at(-1)?.roadDistance ?? 0;
      const distance = (from + to) / 2;
      const center = sampleTerrainLine(road.path, distance);
      crossings.push({
        road: roadIndex,
        x: center.x,
        z: center.z,
        distance,
        from,
        to,
        dx: center.dx,
        dz: center.dz,
        tracks: group,
        mapped: mappedPoints.some(([px, pz]) =>
          group.some((track) => Math.hypot(px - track.x, pz - track.z) < 8),
        ),
      });
      group = [];
    };
    for (const hit of list) {
      const last = group.at(-1);
      if (last && hit.roadDistance - last.roadDistance > 30) flush();
      group.push(hit);
    }
    flush();
  }
  return crossings;
}

/** A switch (turnout) where one track branches off another. */
export interface TerrainRailTurnout {
  /** The points: where the diverging track leaves the through track. */
  x: number;
  z: number;
  /** Unit tangent of the through track, pointing from the points toward the frog. */
  dx: number;
  dz: number;
  /** Side the diverging track leaves on: +1 to the right of (dx, dz), -1 left, 0 unknown. */
  side: -1 | 0 | 1;
  /** Through track (index into the rail lines) and meters along it. */
  line: number;
  distance: number;
  /** Diverging track, when the geometry shows it. */
  diverging?: number;
  /** A mapped `switch` point lies on it. */
  mapped: boolean;
}

/**
 * Turnouts, from the geometry and from mapped `switch` points: a track whose end lies on another
 * track's interior and leaves it at a shallow angle, and three or more track ends meeting at a
 * point (the two most nearly opposite are the through route). Mapped switches with no geometric
 * match still get a turnout on the nearest track, with the diverging side unknown.
 */
export function findTerrainRailTurnouts(
  rails: readonly TerrainRailLine[],
  pois: readonly TerrainPoiFeature[] = [],
  tileSize = 1,
): TerrainRailTurnout[] {
  const index = new SegmentIndex(rails, 16);
  const turnouts: TerrainRailTurnout[] = [];
  const known = (x: number, z: number): boolean =>
    turnouts.some((t) => Math.hypot(t.x - x, t.z - z) < 2);
  // Each line end, with the unit direction leading away from it into the line.
  interface End {
    line: number;
    start: boolean;
    x: number;
    z: number;
    dx: number;
    dz: number;
  }
  const ends: End[] = [];
  rails.forEach((rail, line) => {
    const path = rail.path;
    if (path.points.length < 2 || path.length < 1) return;
    for (const start of [true, false]) {
      const p = (start ? path.points[0] : path.points.at(-1)) as TerrainSemanticPoint;
      const q = sampleTerrainLine(
        path,
        start ? Math.min(8, path.length) : Math.max(0, path.length - 8),
      );
      const [dx, dz] = unit(q.x - p[0], q.z - p[1]);
      ends.push({ line, start, x: p[0], z: p[1], dx, dz });
    }
  });
  // A track ending on another's interior.
  for (const end of ends) {
    let best: { s: Segment; t: number; distance: number } | undefined;
    for (const s of index.near(end.x, end.z, 1)) {
      if (s.line === end.line) continue;
      const hit = project(end.x, end.z, s);
      if (hit.distance > 0.75) continue;
      const along = s.start + s.length * hit.t;
      const through = rails[s.line] as TerrainRailLine;
      if (along < 1.5 || along > through.path.length - 1.5) continue;
      if (!best || hit.distance < best.distance) best = { s, t: hit.t, distance: hit.distance };
    }
    if (!best) continue;
    const [tx, tz] = unit(best.s.b[0] - best.s.a[0], best.s.b[1] - best.s.a[1]);
    const dot = end.dx * tx + end.dz * tz;
    // Branching off at a shallow angle; a track meeting another square on is a diamond or a
    // buffer, not a turnout.
    if (Math.abs(dot) < 0.77) continue;
    const forward = dot >= 0 ? 1 : -1;
    const dx = tx * forward,
      dz = tz * forward;
    const lateral = end.dx * -dz + end.dz * dx;
    if (known(end.x, end.z)) continue;
    turnouts.push({
      x: end.x,
      z: end.z,
      dx,
      dz,
      side: lateral > 0.02 ? 1 : lateral < -0.02 ? -1 : 0,
      line: best.s.line,
      distance: best.s.start + best.s.length * best.t,
      diverging: end.line,
      mapped: false,
    });
  }
  // Three or more track ends at one point.
  const used = new Set<End>();
  for (const end of ends) {
    if (used.has(end)) continue;
    const cluster = ends.filter((other) => Math.hypot(other.x - end.x, other.z - end.z) < 0.75);
    for (const member of cluster) used.add(member);
    if (cluster.length < 3 || known(end.x, end.z)) continue;
    let pair: [End, End] | undefined;
    let straightest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cluster.length; i++)
      for (let j = i + 1; j < cluster.length; j++) {
        const a = cluster[i] as End,
          b = cluster[j] as End;
        const dot = a.dx * b.dx + a.dz * b.dz;
        if (dot < straightest) {
          straightest = dot;
          pair = [a, b];
        }
      }
    if (!pair || straightest > -0.5) continue;
    for (const leg of cluster) {
      if (leg === pair[0] || leg === pair[1]) continue;
      // The through leg the diverging one runs alongside: the points face the other leg.
      const toward =
        leg.dx * pair[0].dx + leg.dz * pair[0].dz > leg.dx * pair[1].dx + leg.dz * pair[1].dz
          ? pair[0]
          : pair[1];
      const lateral = leg.dx * -toward.dz + leg.dz * toward.dx;
      turnouts.push({
        x: end.x,
        z: end.z,
        dx: toward.dx,
        dz: toward.dz,
        side: lateral > 0.02 ? 1 : lateral < -0.02 ? -1 : 0,
        line: toward.line,
        distance: toward.start ? 0 : (rails[toward.line] as TerrainRailLine).path.length,
        diverging: leg.line,
        mapped: false,
      });
      break;
    }
  }
  // Mapped switches: confirm a geometric turnout, or stand in for one the geometry missed.
  for (const poi of pois) {
    if (poi.class !== 'switch' || poi.bridge === true || poi.tunnel === true) continue;
    const x = poi.point[0] * tileSize,
      z = poi.point[1] * tileSize;
    const match = turnouts.find((t) => Math.hypot(t.x - x, t.z - z) < 5);
    if (match) {
      match.mapped = true;
      continue;
    }
    let best: { s: Segment; t: number; distance: number } | undefined;
    for (const s of index.near(x, z, 3)) {
      const hit = project(x, z, s);
      if (hit.distance < 3 && (!best || hit.distance < best.distance))
        best = { s, t: hit.t, distance: hit.distance };
    }
    if (!best) continue;
    const [dx, dz] = unit(best.s.b[0] - best.s.a[0], best.s.b[1] - best.s.a[1]);
    const hit = project(x, z, best.s);
    turnouts.push({
      x: hit.x,
      z: hit.z,
      dx,
      dz,
      side: 0,
      line: best.s.line,
      distance: best.s.start + best.s.length * best.t,
      mapped: true,
    });
  }
  return turnouts;
}

/** The nearest point of a rail line: where, which way the line runs, and the query's offset. */
export interface TerrainRailNearest {
  line: number;
  /** Meters along the line. */
  distance: number;
  x: number;
  z: number;
  /** Unit tangent of the line there. */
  dx: number;
  dz: number;
  /** Signed distance of the query point from the line: positive to the right of travel. */
  offset: number;
}

const railIndexes = new WeakMap<readonly TerrainRailLine[], SegmentIndex>();

/** Nearest point on any accepted rail line within `reach` (indexed per rail list). */
export function nearestTerrainRail(
  rails: readonly TerrainRailLine[],
  x: number,
  z: number,
  reach: number,
  accept: (line: number) => boolean = () => true,
): TerrainRailNearest | undefined {
  let index = railIndexes.get(rails);
  if (!index) {
    index = new SegmentIndex(rails, 16);
    railIndexes.set(rails, index);
  }
  let best: TerrainRailNearest | undefined;
  for (const s of index.near(x, z, reach)) {
    if (!accept(s.line)) continue;
    const hit = project(x, z, s);
    if (hit.distance > reach || (best && hit.distance >= Math.abs(best.offset))) continue;
    const [dx, dz] = unit(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    // Positive offsets lie to the right of travel, as in sampleTerrainLine.
    const side = (x - hit.x) * -dz + (z - hit.z) * dx >= 0 ? 1 : -1;
    best = {
      line: s.line,
      distance: s.start + s.length * hit.t,
      x: hit.x,
      z: hit.z,
      dx,
      dz,
      offset: side * hit.distance,
    };
  }
  return best;
}

/** One lit aspect of a color-light signal. */
export type TerrainRailAspect = 'green' | 'yellow' | 'red';

export interface TerrainRailSignal {
  /** The track it governs (index into the rail lines) and the point on its centerline. */
  line: number;
  x: number;
  z: number;
  /** Unit direction of the trains that read it; its head faces the opposite way. */
  dx: number;
  dz: number;
  /** Mast offset from the track's centerline: positive to the right of travel. */
  offset: number;
  aspect: TerrainRailAspect;
  /** A low dwarf signal (yards, sidings, trams) rather than a mast. */
  dwarf: boolean;
  /** Several signals side by side across parallel tracks share one signal bridge. */
  bridge?: { group: number };
}

/**
 * Mapped `signal` points, as color-light signals. Protomaps keeps no direction, so a signal
 * faces trains heading toward the nearest turnout it stands short of (signals protect
 * junctions), or, beside an open track, a direction picked from its position. Its mast stands on
 * the side traffic keeps to, or the side it is mapped on when that is clear. Aspects are mostly
 * green, yellow approaching a junction, and the odd red.
 */
export function placeTerrainRailSignals(
  rails: readonly TerrainRailLine[],
  tracks: readonly (TerrainRailTrack | undefined)[],
  pois: readonly TerrainPoiFeature[],
  turnouts: readonly TerrainRailTurnout[],
  options: { tileSize: number; origin: readonly [number, number]; drivingSide?: 'left' | 'right' },
): TerrainRailSignal[] {
  const keep = options.drivingSide === 'left' ? -1 : 1;
  const signals: TerrainRailSignal[] = [];
  for (const poi of pois) {
    if (poi.class !== 'signal' || poi.tunnel === true) continue;
    const px = poi.point[0] * options.tileSize,
      pz = poi.point[1] * options.tileSize;
    const near = nearestTerrainRail(rails, px, pz, 6, (line) => {
      const track = tracks[line];
      return track !== undefined && !track.disused;
    });
    if (!near) continue;
    const track = tracks[near.line] as TerrainRailTrack;
    const ahead = (sign: number): number => {
      let nearest = Number.POSITIVE_INFINITY;
      for (const t of turnouts) {
        const along = ((t.x - near.x) * near.dx + (t.z - near.z) * near.dz) * sign;
        const lateral = Math.abs(-(t.x - near.x) * near.dz + (t.z - near.z) * near.dx);
        if (along > 5 && along < 400 && lateral < 25) nearest = Math.min(nearest, along);
      }
      return nearest;
    };
    const forward = ahead(1),
      backward = ahead(-1);
    const wx = options.origin[0] + near.x,
      wz = options.origin[1] + near.z;
    let sign: number;
    if (Math.abs(near.offset) > 1.2)
      // Mapped beside the track: it governs the trains it stands on the keeping side of.
      sign = Math.sign(near.offset) === keep ? 1 : -1;
    else if (Number.isFinite(forward) !== Number.isFinite(backward))
      sign = Number.isFinite(forward) ? 1 : -1;
    else if (Number.isFinite(forward)) sign = forward <= backward ? 1 : -1;
    else sign = terrainRailHash(wx, wz, 3) < 0.5 ? 1 : -1;
    const junction = sign > 0 ? forward : backward;
    const pick = terrainRailHash(wx, wz, 5);
    const aspect: TerrainRailAspect =
      pick < 0.08 ? 'red' : (junction < 300 && pick < 0.6) || pick > 0.9 ? 'yellow' : 'green';
    const dwarf = track.service !== 'main' || track.mode === 'tram';
    // Relative to the trains that read it: positive to the right of their travel.
    const offset =
      (Math.abs(near.offset) > 1.2 ? Math.sign(near.offset) * sign : keep) *
      Math.max(terrainRailOffset(track.gauge) + (dwarf ? 0.9 : 1.6), Math.abs(near.offset));
    if (
      signals.some(
        (s) =>
          s.line === near.line &&
          Math.hypot(s.x - near.x, s.z - near.z) < 3 &&
          (s.dx * near.dx + s.dz * near.dz) * sign > 0,
      )
    )
      continue;
    signals.push({
      line: near.line,
      x: near.x,
      z: near.z,
      dx: near.dx * sign,
      dz: near.dz * sign,
      offset,
      aspect,
      dwarf,
    });
  }
  // Three or more signals abreast over parallel tracks, facing the same way: a signal bridge.
  let group = 0;
  const assigned = new Set<TerrainRailSignal>();
  for (const signal of signals) {
    if (assigned.has(signal) || signal.dwarf) continue;
    const abreast = signals.filter(
      (other) =>
        !other.dwarf &&
        other.dx * signal.dx + other.dz * signal.dz > 0.9 &&
        Math.abs((other.x - signal.x) * signal.dx + (other.z - signal.z) * signal.dz) < 12 &&
        Math.abs(-(other.x - signal.x) * signal.dz + (other.z - signal.z) * signal.dx) < 25,
    );
    if (abreast.length < 3) continue;
    for (const member of abreast) {
      assigned.add(member);
      member.bridge = { group };
    }
    group++;
  }
  return signals;
}

/** A lineside sign: what it says and where it stands, facing the trains that read it. */
export interface TerrainRailSign {
  kind: 'whistle' | 'milepost' | 'yard-limit';
  x: number;
  z: number;
  /** Unit normal of the sign's face, toward the trains that read it. */
  dx: number;
  dz: number;
  text: string;
  source: 'mapped' | 'inferred';
}

/** One statute mile, the spacing of North American mileposts. */
const MILE = 1609.344;

/**
 * Lineside signs where the map has none, all fixed by position so a tile and its neighbors (and
 * any reload) agree:
 * - whistle posts ("W") 400 m ahead of public crossings with active warning on main lines, on
 *   the side trains keep to, unless another crossing comes first;
 * - mileposts on heavy main lines where they cross a world meridian grid a mile apart (numbered
 *   from it), plus mapped `milestone` points;
 * - "YARD LIMIT" boards on a main line about 150 m outside the stretch it runs beside yard tracks.
 */
export function placeTerrainRailSigns(
  rails: readonly TerrainRailLine[],
  tracks: readonly (TerrainRailTrack | undefined)[],
  crossings: readonly TerrainRailCrossing[],
  pois: readonly TerrainPoiFeature[],
  options: {
    tileSize: number;
    origin: readonly [number, number];
    drivingSide?: 'left' | 'right';
    /** Public roads whose crossings get warning equipment (and so whistle posts). */
    active?: (crossing: TerrainRailCrossing) => boolean;
  },
): TerrainRailSign[] {
  const keep = options.drivingSide === 'left' ? -1 : 1;
  const signs: TerrainRailSign[] = [];
  const inTile = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < options.tileSize && z < options.tileSize;
  const main = (line: number): boolean => {
    const track = tracks[line];
    return (
      track !== undefined && !track.disused && track.mode === 'heavy' && track.service === 'main'
    );
  };
  // A sign `lateral` meters to the side trains moving along `sign` keep to, facing them.
  const lineside = (
    line: number,
    distance: number,
    sign: number,
    lateral: number,
  ): { x: number; z: number; dx: number; dz: number } => {
    const path = (rails[line] as TerrainRailLine).path;
    const p = sampleTerrainLine(path, distance, keep * sign * lateral);
    return { x: p.x, z: p.z, dx: -p.dx * sign, dz: -p.dz * sign };
  };
  for (const crossing of crossings) {
    if (options.active && !options.active(crossing)) continue;
    for (const track of crossing.tracks) {
      if (!main(track.line)) continue;
      const path = (rails[track.line] as TerrainRailLine).path;
      for (const sign of [-1, 1]) {
        const at = track.distance - sign * 400;
        if (at < 0 || at > path.length) continue;
        // Another crossing on this track between the post and this one carries its own.
        const blocked = crossings.some(
          (other) =>
            other !== crossing &&
            other.tracks.some(
              (t) =>
                t.line === track.line &&
                (t.distance - at) * sign > 0 &&
                (track.distance - t.distance) * sign > 0,
            ),
        );
        if (blocked) continue;
        const p = lineside(track.line, at, sign, terrainRailOffset(1.435) + 2.1);
        if (inTile(p.x, p.z)) signs.push({ kind: 'whistle', ...p, text: 'W', source: 'inferred' });
      }
    }
  }
  const milestones = pois.filter((poi) => /^(milestone|milepost)$/.test(poi.class));
  for (const poi of milestones) {
    const x = poi.point[0] * options.tileSize,
      z = poi.point[1] * options.tileSize;
    if (!inTile(x, z)) continue;
    const near = nearestTerrainRail(rails, x, z, 10, (line) => tracks[line] !== undefined);
    if (!near) continue;
    const side = near.offset >= 0 ? 1 : -1;
    const lateral = Math.max(Math.abs(near.offset), terrainRailOffset(1.435) + 2);
    signs.push({
      kind: 'milepost',
      x: near.x - near.dz * side * lateral,
      z: near.z + near.dx * side * lateral,
      dx: near.dx,
      dz: near.dz,
      text: poi.ref ?? poi.name ?? '',
      source: 'mapped',
    });
  }
  rails.forEach((rail, line) => {
    if (!main(line)) return;
    const { points } = rail.path;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as TerrainSemanticPoint,
        b = points[i] as TerrainSemanticPoint;
      const wa = options.origin[0] + a[0],
        wb = options.origin[0] + b[0];
      const ka = Math.floor(wa / MILE),
        kb = Math.floor(wb / MILE);
      if (ka === kb) continue;
      const k = Math.max(ka, kb);
      const t = (k * MILE - wa) / (wb - wa);
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (!inTile(x, z)) continue;
      if (
        milestones.some(
          (poi) =>
            Math.hypot(poi.point[0] * options.tileSize - x, poi.point[1] * options.tileSize - z) <
            800,
        )
      )
        continue;
      const distance = (rail.path.distances[i - 1] ?? 0) + Math.hypot(x - a[0], z - a[1]);
      const sign = terrainRailHash(options.origin[0] + x, options.origin[1] + z, 11) < 0.5 ? 1 : -1;
      const p = lineside(line, distance, sign, terrainRailOffset(1.435) + 2.2);
      // Mileage counts up eastward from an arbitrary but fixed origin.
      signs.push({
        kind: 'milepost',
        ...p,
        text: String(((k % 300) + 300) % 300),
        source: 'inferred',
      });
    }
  });
  // Yard limits: stretches of main line within 30 m of yard tracks, settled at 20 m stations.
  const yards = new SegmentIndex(rails, 32, (_, line) => tracks[line]?.service === 'yard');
  rails.forEach((rail, line) => {
    if (!main(line) || rail.path.length < 300) return;
    const count = Math.floor(rail.path.length / 20) + 1;
    const flags = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const p = sampleTerrainLine(rail.path, Math.min(rail.path.length, i * 20));
      flags[i] = yards
        .near(p.x, p.z, 30)
        .some((s) => s.line !== line && project(p.x, p.z, s).distance < 30)
        ? 1
        : 0;
    }
    // Fill gaps under 200 m and drop yard stretches under 200 m.
    let i = 0;
    while (i < count) {
      const value = flags[i];
      let j = i;
      while (j < count && flags[j] === value) j++;
      if (i > 0 && j < count && j - i < 10) flags.fill(value === 1 ? 0 : 1, i, j);
      i = j;
    }
    for (let k = 1; k < count; k++) {
      if (flags[k] === flags[k - 1]) continue;
      // Entering the yard stretch going +1 at a rising edge, going -1 at a falling one.
      const sign = flags[k] === 1 ? 1 : -1;
      const at = k * 20 - sign * 150;
      if (at < 0 || at > rail.path.length) continue;
      const p = lineside(line, at, sign, terrainRailOffset(1.435) + 2.3);
      if (inTile(p.x, p.z))
        signs.push({ kind: 'yard-limit', ...p, text: 'YARD LIMIT', source: 'inferred' });
    }
  });
  return signs;
}

/** A catenary mast station along an electrified track. */
export interface TerrainRailMastStation {
  distance: number;
  x: number;
  z: number;
}

/**
 * Stations for catenary masts about every `spacing` meters along a track, fixed in the world
 * rather than to where a tile's piece of the line begins: a station falls where the track's
 * position along its dominant axis crosses a multiple of `spacing`. Neighboring tiles therefore
 * agree, and wires can run on across a tile edge to the next tile's first mast.
 */
export function terrainRailMastStations(
  path: TerrainLinePath,
  origin: readonly [number, number],
  spacing = 55,
): TerrainRailMastStation[] {
  const stations: TerrainRailMastStation[] = [];
  if (path.length <= 0) return stations;
  const step = 2;
  let previous: { q: number; axis: number } | undefined;
  for (let d = 0; d <= path.length + 1e-6; d += step) {
    const distance = Math.min(d, path.length);
    const p = sampleTerrainLine(path, distance);
    const axis = Math.abs(p.dx) >= Math.abs(p.dz) ? 0 : 1;
    const q = Math.floor((axis === 0 ? origin[0] + p.x : origin[1] + p.z) / spacing);
    if (previous && previous.axis === axis && previous.q !== q) {
      const last = stations.at(-1);
      if (!last || distance - last.distance > spacing * 0.45)
        stations.push({ distance, x: p.x, z: p.z });
    }
    previous = { q, axis };
  }
  return stations;
}
