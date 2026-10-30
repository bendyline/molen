/** Three-free, connected motorway grading shared by pavement and traffic. */
import { sampleTerrainLine, terrainLinePath } from './line-path';
import type { TerrainSemanticPoint, TerrainTransportationFeature } from './semantic-types';
import { ROAD_SURFACE_LIFT, transportKind } from './transport-features';

type Node = {
  point: TerrainSemanticPoint;
  edges: { node: Node; length: number; bridge: boolean }[];
  deck?: number;
};
type End = { node: Node; dx: number; dz: number; endpoint: boolean };

/**
 * A bridge flag describes the structural span, not the length of its vertical approach.
 * Keep inferred motorway decks raised through their ends, then ease back to native terrain
 * along connected roads. Only mapped vertices connect: a crossing in plan is not a junction.
 * Authored/surveyed heights take precedence. Coordinates and profiles remain tile-normalized.
 */
export function gradeHighwayBridges(
  features: readonly TerrainTransportationFeature[],
  tileSize: number,
  groundAt: (x: number, z: number) => number,
): readonly TerrainTransportationFeature[] {
  const eligible = (f: TerrainTransportationFeature) =>
    transportKind(f) === 'motorway' &&
    !f.tunnel &&
    f.deckElevation === undefined &&
    !f.bridgeConnections?.length &&
    !f.bridgeApproachProfile?.length;
  if (!features.some((f) => eligible(f) && f.bridge)) return features;
  const ground = (p: TerrainSemanticPoint) => groundAt(p[0] * tileSize, p[1] * tileSize);
  const key = (p: TerrainSemanticPoint) =>
    `${Math.round(p[0] * tileSize * 10)}/${Math.round(p[1] * tileSize * 10)}`;
  const nodes = new Map<string, Node>();
  const ends = new Map<string, End[]>();
  const paths = new Map<TerrainTransportationFeature, Node[][]>();
  for (const f of features) {
    if (!eligible(f)) continue;
    const layer = f.bridge ? Math.max(1, f.layer ?? 1) : (f.layer ?? 0);
    paths.set(
      f,
      f.lines.map((line) => {
        const path: Node[] = [];
        for (let i = 0; i < line.length; i++) {
          const point = line[i] as TerrainSemanticPoint;
          const id = `${key(point)}/${layer}/${!!f.bridge}`;
          let node = nodes.get(id);
          if (!node) {
            node = { point, edges: [] };
            nodes.set(id, node);
          }
          const previous = path.at(-1);
          if (previous && previous !== node) {
            const length =
              Math.hypot(point[0] - previous.point[0], point[1] - previous.point[1]) * tileSize;
            previous.edges.push({ node, length, bridge: !!f.bridge });
            node.edges.push({ node: previous, length, bridge: !!f.bridge });
          }
          if (previous !== node) path.push(node);
          if (f.bridge) node.deck = Math.max(node.deck ?? -Infinity, ground(point) + 6 * layer);
          // Grade transitions occur at way ends, including an end meeting a mapped interior node.
          const neighbor = line[i === line.length - 1 ? i - 1 : i + 1];
          if (neighbor) {
            const length = Math.hypot(neighbor[0] - point[0], neighbor[1] - point[1]) || 1;
            const list = ends.get(key(point)) ?? [];
            list.push({
              node,
              dx: (neighbor[0] - point[0]) / length,
              dz: (neighbor[1] - point[1]) / length,
              endpoint: i === 0 || i === line.length - 1,
            });
            ends.set(key(point), list);
          }
        }
        return path;
      }),
    );
  }
  // Only aligned continuations can cross a bridge/layer boundary. Perpendicular roads below
  // an overpass must retain their ground height, even if both maps include the crossing vertex.
  for (const list of ends.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i] as End,
          b = list[j] as End;
        if (
          a.node === b.node ||
          (!a.endpoint && !b.endpoint) ||
          Math.abs(a.dx * b.dx + a.dz * b.dz) < 0.5
        )
          continue;
        a.node.edges.push({ node: b.node, length: 0, bridge: false });
        b.node.edges.push({ node: a.node, length: 0, bridge: false });
        const deck = Math.max(a.node.deck ?? -Infinity, b.node.deck ?? -Infinity);
        if (a.node.deck !== undefined) a.node.deck = deck;
        if (b.node.deck !== undefined) b.node.deck = deck;
      }
  }
  // Preserve a bank-to-bank span above valleys, including polylines with intermediate vertices.
  for (const [feature, lines] of paths) {
    if (!feature.bridge) continue;
    for (const line of lines) {
      const path = terrainLinePath(
        line.map((n) => n.point),
        tileSize,
      );
      const start = line[0]?.deck,
        end = line.at(-1)?.deck;
      if (start === undefined || end === undefined) continue;
      for (const [i, n] of line.entries()) {
        const t = (path.distances[i] ?? 0) / (path.length || 1);
        n.deck = Math.max(n.deck ?? -Infinity, start + (end - start) * t);
      }
    }
  }
  type Influence = { distance: number; lift: number; radius: number };
  const influences = new Map<Node, Influence[]>();
  for (const seed of nodes.values()) {
    if (seed.deck === undefined || !seed.edges.some((e) => !e.bridge)) continue;
    const lift = Math.max(0, seed.deck - ground(seed.point) - ROAD_SURFACE_LIFT);
    // Cubic easing has a peak slope of 1.5; 25 metres per metre of lift gives 6% on flat ground.
    const radius = Math.max(80, lift * 25);
    const distances = new Map<Node, number>([[seed, 0]]);
    const queue = [{ node: seed, distance: 0 }];
    while (queue.length) {
      queue.sort((a, b) => b.distance - a.distance);
      const item = queue.pop() as { node: Node; distance: number };
      if (item.distance !== distances.get(item.node)) continue;
      const list = influences.get(item.node) ?? [];
      list.push({ distance: item.distance, lift, radius });
      influences.set(item.node, list);
      for (const edge of item.node.edges) {
        const distance = item.distance + edge.length;
        if (
          edge.bridge ||
          item.distance >= radius ||
          distance >= (distances.get(edge.node) ?? Infinity)
        )
          continue;
        distances.set(edge.node, distance);
        queue.push({ node: edge.node, distance });
      }
    }
  }
  return features.flatMap((f) => {
    const lines = paths.get(f);
    if (!lines) return [f];
    return f.lines.map((line, index) => {
      const nodes = lines[index] as Node[];
      if (!f.bridge && !nodes.some((n) => influences.has(n))) return { ...f, lines: [line] };
      const path = terrainLinePath(
        nodes.map((n) => n.point),
        tileSize,
      );
      const samples: NonNullable<TerrainTransportationFeature['bridgeApproachProfile']> = [];
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1] as Node,
          b = nodes[i] as Node;
        const start = path.distances[i - 1] ?? 0,
          length = (path.distances[i] ?? start) - start;
        const count = Math.max(1, Math.ceil(length / 4));
        for (let j = i === 1 ? 0 : 1; j <= count; j++) {
          const t = j / count;
          const p = sampleTerrainLine(path, start + length * t);
          const point: TerrainSemanticPoint = [p.x / tileSize, p.z / tileSize];
          const base = ground(point) + ROAD_SURFACE_LIFT;
          let elevation = base,
            flatness = 0;
          if (f.bridge) {
            elevation = Math.max(
              (a.deck as number) + ((b.deck as number) - (a.deck as number)) * t,
              ground(point) + 6 * Math.max(1, f.layer ?? 1),
            );
            flatness = 1;
          } else {
            for (const [node, distance] of [
              [a, length * t],
              [b, length * (1 - t)],
            ] as const) {
              for (const influence of influences.get(node) ?? []) {
                const u = Math.min(1, (influence.distance + distance) / influence.radius);
                const fade = 1 - u * u * (3 - 2 * u);
                elevation = Math.max(elevation, base + influence.lift * fade);
                flatness = Math.max(flatness, fade);
              }
            }
          }
          samples.push({ point, elevation, flatness });
        }
      }
      return { ...f, lines: [line], bridgeApproachProfile: samples };
    });
  });
}
