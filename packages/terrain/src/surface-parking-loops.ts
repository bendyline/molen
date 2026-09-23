/** Bounded faces of service-road networks, used as evidence for missing parking footprints. */
import { pointInPolygon, polygonBounds, ringArea, ringSignedArea } from './polygon';
import type {
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from './semantic-types';
import type { SurfaceNetwork, SurfaceRoad } from './surface-network';

export function parkingRoad(road: SurfaceRoad): boolean {
  const f = road.feature;
  return (
    road.kind === 'service' &&
    !f.bridge &&
    !f.tunnel &&
    (f.layer ?? 0) === 0 &&
    !/driveway|alley/.test(`${f.class} ${f.subclass ?? ''} ${f.service ?? ''}`) &&
    !/dirt|ground|gravel|sand|unpaved|earth/.test(f.surface ?? '')
  );
}

export function taggedParkingRoad(road: SurfaceRoad): boolean {
  return /parking_aisle/.test(
    `${road.feature.class} ${road.feature.subclass ?? ''} ${road.feature.service ?? ''}`,
  );
}

/** Large buildings support parking inference outside mapped residential land use. */
export function parkingBuildings(
  tile: TerrainSemanticTile,
  size: number,
): TerrainSemanticPolygon[] {
  const residential = tile.landcover
    .filter((f) => /residential/.test(`${f.class} ${f.subclass ?? ''}`))
    .flatMap((f) => f.polygons);
  return tile.buildings
    .filter(
      (f) =>
        !/(?:^| )(?:house|detached|residential|apartments|garage|garages|shed)(?: |$)/.test(
          `${f.class ?? ''} ${f.subclass ?? ''}`,
        ),
    )
    .flatMap((f) => f.polygons)
    .filter((p) => {
      const b = polygonBounds(p);
      const center: TerrainSemanticPoint = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      return (
        (ringArea(p.outer) - (p.holes ?? []).reduce((a, h) => a + ringArea(h), 0)) * size * size >=
          240 && !residential.some((r) => pointInPolygon(center, r))
      );
    });
}

export function nearParkingPolygon(
  point: TerrainSemanticPoint,
  polygon: TerrainSemanticPolygon,
  distance: number,
): boolean {
  if (pointInPolygon(point, polygon)) return true;
  return polygon.outer.some((a, i) => {
    const b = polygon.outer[(i + 1) % polygon.outer.length] as TerrainSemanticPoint;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
    return Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dz * t) <= distance;
  });
}

interface Edge {
  a: TerrainSemanticPoint;
  b: TerrainSemanticPoint;
  cuts: number[];
  tagged: boolean;
}
interface Node {
  point: TerrainSemanticPoint;
  neighbors: Set<number>;
  component: number;
  tagged: boolean;
}

/** Walk planar faces, never closing an open access road or a clipped tile boundary. */
export function parkingLoops(
  tile: TerrainSemanticTile,
  network: SurfaceNetwork,
  size: number,
  buildings: TerrainSemanticPolygon[],
): TerrainSemanticPolygon[] {
  const edges: Edge[] = [];
  for (const road of network.roads) {
    if (!parkingRoad(road)) continue;
    for (let i = 1; i < road.path.points.length; i++) {
      const a = road.path.points[i - 1] as TerrainSemanticPoint,
        b = road.path.points[i] as TerrainSemanticPoint;
      // A bounded parking face cannot need a very long edge. Bound work at coarse zooms too.
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 240) continue;
      edges.push({ a, b, cuts: [0, 1], tagged: taggedParkingRoad(road) });
    }
  }
  if (edges.length > 4096) return [];
  const cells = new Map<string, number[]>();
  const compared = new Set<string>();
  // Simplified MVT lines can miss a shared junction by a fraction of a metre.
  const snap = 0.6;
  const cross = (x: number, z: number, u: number, v: number): number => x * v - z * u;
  for (const [i, a] of edges.entries()) {
    for (
      let x = Math.floor((Math.min(a.a[0], a.b[0]) - snap) / 32);
      x <= Math.floor((Math.max(a.a[0], a.b[0]) + snap) / 32);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(a.a[1], a.b[1]) - snap) / 32);
        z <= Math.floor((Math.max(a.a[1], a.b[1]) + snap) / 32);
        z++
      ) {
        const key = `${x}/${z}`,
          cell = cells.get(key) ?? [];
        for (const j of cell) {
          const pair = `${j}/${i}`;
          if (compared.has(pair)) continue;
          if (compared.size >= 50_000) return [];
          compared.add(pair);
          const b = edges[j] as Edge;
          const dx = a.b[0] - a.a[0],
            dz = a.b[1] - a.a[1];
          const ex = b.b[0] - b.a[0],
            ez = b.b[1] - b.a[1];
          const qx = b.a[0] - a.a[0],
            qz = b.a[1] - a.a[1];
          const denominator = cross(dx, dz, ex, ez);
          if (Math.abs(denominator) > 1e-8) {
            const t = cross(qx, qz, ex, ez) / denominator,
              u = cross(qx, qz, dx, dz) / denominator;
            if (t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8) {
              a.cuts.push(Math.max(0, Math.min(1, t)));
              b.cuts.push(Math.max(0, Math.min(1, u)));
            }
          }
          // Split near T junctions as well as overlapping collinear source fragments.
          for (const [from, to] of [
            [a, b],
            [b, a],
          ] as const) {
            const vx = to.b[0] - to.a[0],
              vz = to.b[1] - to.a[1];
            for (const p of [from.a, from.b]) {
              const t = ((p[0] - to.a[0]) * vx + (p[1] - to.a[1]) * vz) / (vx * vx + vz * vz || 1);
              if (
                t > 0 &&
                t < 1 &&
                Math.hypot(p[0] - to.a[0] - vx * t, p[1] - to.a[1] - vz * t) <= snap
              )
                to.cuts.push(t);
            }
          }
        }
        cell.push(i);
        cells.set(key, cell);
      }
    }
  }
  const nodes: Node[] = [],
    ids = new Map<string, number[]>();
  const node = (p: TerrainSemanticPoint, tagged: boolean): number => {
    const x = Math.floor(p[0] / snap),
      z = Math.floor(p[1] / snap);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        for (const id of ids.get(`${x + dx}/${z + dz}`) ?? []) {
          const n = nodes[id] as Node;
          if (Math.hypot(n.point[0] - p[0], n.point[1] - p[1]) <= snap) {
            n.tagged ||= tagged;
            return id;
          }
        }
      }
    const key = `${x}/${z}`,
      id = nodes.length;
    const cell = ids.get(key) ?? [];
    cell.push(id);
    ids.set(key, cell);
    nodes.push({ point: p, neighbors: new Set(), component: -1, tagged });
    return id;
  };
  for (const e of edges) {
    const cuts = [...new Set(e.cuts)].sort((a, b) => a - b);
    let previous: number | undefined;
    for (const t of cuts) {
      const id = node([e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t], e.tagged);
      if (previous !== undefined && previous !== id) {
        (nodes[previous] as Node).neighbors.add(id);
        (nodes[id] as Node).neighbors.add(previous);
      }
      previous = id;
    }
  }
  // Remove dangling spurs before walking, so a driveway cannot add a self-touching ring.
  const leaves = nodes.flatMap((n, i) => (n.neighbors.size < 2 ? [i] : []));
  for (let i = 0; i < leaves.length; i++) {
    const id = leaves[i] as number,
      n = nodes[id] as Node;
    for (const next of n.neighbors) {
      const neighbor = nodes[next] as Node;
      neighbor.neighbors.delete(id);
      if (neighbor.neighbors.size === 1) leaves.push(next);
    }
    n.neighbors.clear();
  }
  const supported = new Set<number>();
  for (const [id, n] of nodes.entries()) {
    if (n.component !== -1 || n.neighbors.size === 0) continue;
    n.component = id;
    const queue = [id];
    for (let i = 0; i < queue.length; i++) {
      const current = nodes[queue[i] as number] as Node;
      if (current.tagged) supported.add(id);
      for (const next of current.neighbors) {
        const neighbor = nodes[next] as Node;
        if (neighbor.component !== -1) continue;
        neighbor.component = id;
        queue.push(next);
      }
    }
  }
  const ordered = nodes.map((n) =>
    [...n.neighbors].sort((a, b) => {
      const p = (nodes[a] as Node).point,
        q = (nodes[b] as Node).point;
      return (
        Math.atan2(p[1] - n.point[1], p[0] - n.point[0]) -
        Math.atan2(q[1] - n.point[1], q[0] - n.point[0])
      );
    }),
  );
  const visited = new Set<string>(),
    faces: { polygon: TerrainSemanticPolygon; component: number }[] = [];
  for (const [start, neighbors] of ordered.entries())
    for (const next of neighbors) {
      if (visited.has(`${start}/${next}`)) continue;
      let a = start,
        b = next;
      const ring: TerrainSemanticPoint[] = [];
      do {
        const key = `${a}/${b}`;
        if (visited.has(key)) break;
        visited.add(key);
        ring.push((nodes[a] as Node).point);
        const neighbors = ordered[b] as number[];
        const c = neighbors[
          (neighbors.indexOf(a) + neighbors.length - 1) % neighbors.length
        ] as number;
        a = b;
        b = c;
      } while (a !== start || b !== next);
      const area = ringSignedArea(ring);
      if (a !== start || b !== next || area < 80 || area > 12_000) continue;
      const polygon = { outer: ring.map(([x, z]): TerrainSemanticPoint => [x / size, z / size]) };
      const bounds = polygonBounds(polygon);
      if (Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) * size > 240) continue;
      faces.push({ polygon, component: (nodes[start] as Node).component });
    }
  const sites = tile.landcover
    .filter((f) => /^(commercial|retail)$/.test(f.subclass ?? f.class))
    .flatMap((f) => f.polygons);
  for (const { polygon, component } of faces) {
    if (
      sites.some((s) => polygon.outer.some((p) => pointInPolygon(p, s))) ||
      buildings.some((building) => {
        const b = polygonBounds(building);
        return nearParkingPolygon([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], polygon, 20 / size);
      })
    )
      supported.add(component);
  }
  return faces.filter((f) => supported.has(f.component)).map((f) => f.polygon);
}
