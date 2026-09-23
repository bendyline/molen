/** Recover parking pavement when a basemap retains aisles but omits parking polygons. */
import polygonClipping, { type Polygon } from 'polygon-clipping';
import { pointInPolygon, polygonBounds } from './polygon';
import type {
  TerrainLandcoverFeature,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from './semantic-types';
import type { SurfaceNetwork } from './surface-network';
import {
  nearParkingPolygon,
  parkingBuildings,
  parkingLoops,
  parkingRoad,
  taggedParkingRoad,
} from './surface-parking-loops';

const coordinates = (polygon: TerrainSemanticPolygon): Polygon => [
  polygon.outer,
  ...(polygon.holes ?? []),
];

interface Aisle {
  a: TerrainSemanticPoint;
  b: TerrainSemanticPoint;
  width: number;
  length: number;
  tagged: boolean;
}
interface Strip {
  a: number;
  b: number;
  polygon: Polygon;
  supported: boolean;
}

/** Collapse almost-straight source vertices into aisle runs; curves remain separate runs. */
function aisleRuns(network: SurfaceNetwork): Aisle[] {
  const runs: Aisle[] = [];
  for (const road of network.roads) {
    if (!parkingRoad(road)) continue;
    const points = road.path.points;
    let start = 0;
    const emit = (end: number): void => {
      const a = points[start],
        b = points[end];
      if (!a || !b) return;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length > 0)
        runs.push({ a, b, width: road.width, length, tagged: taggedParkingRoad(road) });
      start = end;
    };
    for (let end = 2; end < points.length; end++) {
      const a = points[start] as TerrainSemanticPoint,
        b = points[end] as TerrainSemanticPoint;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / (length || 1),
        dz = (b[1] - a[1]) / (length || 1);
      let straight = length > 0;
      for (let i = start + 1; i < end && straight; i++) {
        const p = points[i] as TerrainSemanticPoint;
        const u = (p[0] - a[0]) * dx + (p[1] - a[1]) * dz;
        const v = -(p[0] - a[0]) * dz + (p[1] - a[1]) * dx;
        straight = u > 0 && u < length && Math.abs(v) <= 0.65;
      }
      if (!straight) emit(end - 1);
    }
    emit(points.length - 1);
  }
  return runs;
}

/** Recover aisle strips and bounded service-road courts with local parking/building evidence. */
export function inferTerrainParkingAreas(
  tile: TerrainSemanticTile,
  network: SurfaceNetwork,
  tileSize: number,
): TerrainLandcoverFeature[] {
  const result: TerrainLandcoverFeature[] = [];
  const sites = tile.landcover
    .filter((f) => /^(commercial|retail)$/.test(f.subclass ?? f.class))
    .flatMap((f) => f.polygons)
    .map((polygon) => ({ polygon, mapped: true }));
  sites.push({
    polygon: {
      outer: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    mapped: false,
  });
  const exclusions = [
    ...tile.buildings.flatMap((f) => f.polygons),
    ...tile.water.flatMap((f) => f.polygons ?? []),
    ...tile.landcover
      .filter((f) =>
        /parking|car_park|grass|garden|wood|forest|park|playground|pitch|wetland|scrub|village_green|recreation_ground/.test(
          `${f.class} ${f.subclass ?? ''}`,
        ),
      )
      .flatMap((f) => f.polygons),
  ];
  const buildings = parkingBuildings(tile, tileSize);
  const streets = network.roads.filter(
    (r) =>
      (r.kind === 'street' || r.kind === 'motorway' || r.kind === 'rail') &&
      !r.feature.bridge &&
      (r.feature.layer ?? 0) === 0,
  );
  const crossesStreet = (a: TerrainSemanticPoint, b: TerrainSemanticPoint): boolean =>
    streets.some((road) =>
      road.path.points.some((q, i, points) => {
        const p = points[i - 1];
        if (!p) return false;
        const dx = (b[0] - a[0]) * tileSize,
          dz = (b[1] - a[1]) * tileSize;
        const ex = q[0] - p[0],
          ez = q[1] - p[1];
        const qx = p[0] - a[0] * tileSize,
          qz = p[1] - a[1] * tileSize;
        const denominator = dx * ez - dz * ex;
        if (Math.abs(denominator) < 1e-8) return false;
        const t = (qx * ez - qz * ex) / denominator,
          u = (qx * dz - qz * dx) / denominator;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
      }),
    );
  const append = (
    polygons: Polygon[],
    boundary: TerrainSemanticPolygon,
    extraCuts: TerrainSemanticPolygon[] = [],
  ): void => {
    if (!polygons.length) return;
    try {
      const union = polygonClipping.union(polygons[0] as Polygon, ...polygons.slice(1));
      const inside = polygonClipping.intersection(union, coordinates(boundary));
      const bounds = polygonBounds(boundary);
      const cuts = [...exclusions, ...extraCuts, ...result.flatMap((f) => f.polygons)].filter(
        (p) => {
          const b = polygonBounds(p);
          return b[0] < bounds[2] && b[2] > bounds[0] && b[1] < bounds[3] && b[3] > bounds[1];
        },
      );
      const clipped = cuts.length
        ? polygonClipping.difference(inside, ...cuts.map(coordinates))
        : inside;
      if (clipped.length)
        result.push({
          class: 'parking',
          subclass: 'inferred',
          polygons: clipped.map((p) => ({
            outer: p[0] as TerrainSemanticPoint[],
            holes: p.slice(1) as TerrainSemanticPoint[][],
          })),
        });
    } catch {
      // Malformed source topology must never invent a fallback rectangle outside the site.
    }
  };
  const allSegments = aisleRuns(network);
  let comparisons = 0;
  for (const site of sites) {
    const { polygon, mapped } = site;
    const minimumLength = 12;
    const segments = allSegments.filter(
      (s) =>
        s.length >= minimumLength &&
        (!mapped ||
          pointInPolygon(
            [(s.a[0] + s.b[0]) / (2 * tileSize), (s.a[1] + s.b[1]) / (2 * tileSize)],
            polygon,
          )),
    );
    const strips: Strip[] = [];
    const neighbors = new Map<number, Set<number>>();
    for (let i = 0; i < segments.length && strips.length < 256; i++) {
      const a = segments[i];
      if (!a) continue;
      const dx = (a.b[0] - a.a[0]) / a.length,
        dz = (a.b[1] - a.a[1]) / a.length;
      for (let j = i + 1; j < segments.length && strips.length < 256; j++) {
        if (++comparisons > 50_000) break;
        const b = segments[j];
        const alignment = b
          ? Math.abs(dx * (b.b[0] - b.a[0]) + dz * (b.b[1] - b.a[1])) / b.length
          : 0;
        if (!b || alignment < 0.5) continue;
        const along = (p: TerrainSemanticPoint): number =>
          (p[0] - a.a[0]) * dx + (p[1] - a.a[1]) * dz;
        const across = (p: TerrainSemanticPoint): number =>
          -(p[0] - a.a[0]) * dz + (p[1] - a.a[1]) * dx;
        const separation = (across(b.a) + across(b.b)) / 2;
        if (Math.abs(separation) < 9 || Math.abs(separation) > 60) continue;
        const start = Math.max(0, Math.min(along(b.a), along(b.b)));
        const end = Math.min(a.length, Math.max(along(b.a), along(b.b)));
        // Reject distant runs before searching building footprints or street barriers.
        if (end - start < 12 || end - start < Math.min(a.length, b.length) * 0.5) continue;
        const point = (u: number, v: number): TerrainSemanticPoint => [
          (a.a[0] + dx * u - dz * v) / tileSize,
          (a.a[1] + dz * u + dx * v) / tileSize,
        ];
        const supported =
          mapped ||
          a.tagged ||
          b.tagged ||
          buildings.some((p) =>
            nearParkingPolygon(point((start + end) / 2, separation / 2), p, 30 / tileSize),
          );
        if (!supported && end - start < 20) continue;
        if (
          !supported &&
          (a.length < 28 || b.length < 28 || Math.abs(separation) > 26 || alignment < 0.97)
        )
          continue;
        const margin = Math.max(a.width, b.width) / 2 + 5.2;
        // Follow both actual aisles; an average separation leaves wedges in angled lots.
        const acrossAt = (u: number): number =>
          across(b.a) +
          ((across(b.b) - across(b.a)) * (u - along(b.a))) / (along(b.b) - along(b.a));
        const v0 = acrossAt(start),
          v1 = acrossAt(end);
        if (v0 * v1 < -1e-6 || Math.max(Math.abs(v0), Math.abs(v1)) > 65) continue;
        if (crossesStreet(point((start + end) / 2, 0), point((start + end) / 2, (v0 + v1) / 2)))
          continue;
        strips.push({
          a: i,
          b: j,
          supported,
          polygon: [
            [
              point(start - 1, Math.min(0, v0) - margin),
              point(end + 1, Math.min(0, v1) - margin),
              point(end + 1, Math.max(0, v1) + margin),
              point(start - 1, Math.max(0, v0) + margin),
            ],
          ],
        });
        for (const [from, to] of [
          [i, j],
          [j, i],
        ] as const) {
          const list = neighbors.get(from) ?? new Set<number>();
          list.add(to);
          neighbors.set(from, list);
        }
      }
    }
    // A single pair of residential driveways or a U-turn must not turn into a parking lot.
    const accepted = strips.filter(
      (s) =>
        s.supported || (neighbors.get(s.a)?.size ?? 0) >= 2 || (neighbors.get(s.b)?.size ?? 0) >= 2,
    );
    append(
      accepted.map((s) => s.polygon),
      polygon,
    );
  }
  append(
    parkingLoops(tile, network, tileSize, buildings).map(coordinates),
    (sites.at(-1) as { polygon: TerrainSemanticPolygon }).polygon,
    tile.landcover
      .filter((f) => /residential/.test(`${f.class} ${f.subclass ?? ''}`))
      .flatMap((f) => f.polygons),
  );
  return result;
}
