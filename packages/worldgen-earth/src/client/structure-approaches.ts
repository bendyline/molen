/** Carry authored bridge grades through short, genuinely connected map fragments. */
import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import {
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  transportKind,
  transportSurfaceLift,
} from '@bendyline/molen-terrain/kernel';

type Node = { key: string; point: TerrainSemanticPoint; edges: Edge[] };
type Edge = { a: Node; b: Node; length: number; feature: TerrainTransportationFeature };
type Seed = { node: Node; elevation: number; radius: number; kind: string; layer: number };

const eligible = (f: TerrainTransportationFeature) =>
  !f.bridge &&
  !f.tunnel &&
  f.deckElevation === undefined &&
  !/ferry|rail|tram|runway|taxiway|steps/.test(`${f.class} ${f.subclass ?? ''}`);
const kind = (f: TerrainTransportationFeature) => (transportKind(f) === 'path' ? 'path' : 'road');
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Retains map polylines and raw terrain. Only profile metadata is added, within 200m
 * of an authored join along connected roads on the same layer and of the same path kind.
 * Sampling metadata avoids creating artificial road ends/junctions every few metres. */
export function gradeStructureApproaches(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
): TerrainSemanticTile {
  const features = tile.transportation.filter(eligible);
  if (!features.some((f) => f.bridgeConnections?.length)) return tile;
  const size = context.tileSize,
    origin = context.origin;
  const key = (p: TerrainSemanticPoint) =>
    `${Math.round((origin[0] + p[0] * size) * 10)}/${Math.round((origin[1] + p[1] * size) * 10)}`;
  const ground = (p: TerrainSemanticPoint) =>
    context.heightfield.sampleHeight(origin[0] + p[0] * size, origin[1] + p[1] * size);
  const nodes = new Map<string, Node>();
  const node = (point: TerrainSemanticPoint): Node => {
    const id = key(point);
    let n = nodes.get(id);
    if (!n) {
      n = { key: id, point, edges: [] };
      nodes.set(id, n);
    }
    return n;
  };
  const paths = new Map<TerrainTransportationFeature, Node[][]>();
  for (const feature of features) {
    paths.set(
      feature,
      feature.lines.map((line) => {
        const points: Node[] = [];
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1] as TerrainSemanticPoint,
            b = line[i] as TerrainSemanticPoint;
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]) * size;
          const count = Math.max(1, Math.ceil(length / 4));
          for (let j = 0; j <= count; j++) {
            const n = node(
              j === 0
                ? a
                : j === count
                  ? b
                  : [a[0] + ((b[0] - a[0]) * j) / count, a[1] + ((b[1] - a[1]) * j) / count],
            );
            const previous = points.at(-1);
            if (previous === n) continue;
            if (previous) {
              const edge = {
                a: previous,
                b: n,
                feature,
                length:
                  Math.hypot(n.point[0] - previous.point[0], n.point[1] - previous.point[1]) * size,
              };
              previous.edges.push(edge);
              n.edges.push(edge);
            }
            points.push(n);
          }
        }
        return points;
      }),
    );
  }
  const seeds = new Map<string, Seed>();
  for (const feature of features) {
    const lift = transportSurfaceLift(transportKind(feature));
    for (const hint of feature.bridgeConnections ?? []) {
      const n = nodes.get(key(hint.point));
      if (!n?.edges.some((e) => e.feature === feature)) continue;
      const id = `${n.key}|${kind(feature)}|${feature.layer ?? 0}`;
      const seed = {
        node: n,
        elevation: hint.elevation,
        kind: kind(feature),
        layer: feature.layer ?? 0,
        radius: Math.min(
          200,
          Math.max(24, hint.radius, Math.abs(hint.elevation - ground(n.point) - lift) * 12.5),
        ),
      };
      if (!seeds.has(id) || hint.elevation > (seeds.get(id) as Seed).elevation) seeds.set(id, seed);
    }
  }
  const values = new Map<string, { seed: Seed; distance: number }[]>();
  for (const seed of seeds.values()) {
    const distances = new Map([[seed.node.key, 0]]),
      queue = [{ node: seed.node, distance: 0 }];
    while (queue.length) {
      queue.sort((a, b) => b.distance - a.distance);
      const item = queue.pop() as { node: Node; distance: number };
      if (item.distance !== distances.get(item.node.key)) continue;
      const contributions = values.get(item.node.key) ?? [];
      contributions.push({ seed, distance: item.distance });
      values.set(item.node.key, contributions);
      for (const edge of item.node.edges) {
        if (kind(edge.feature) !== seed.kind || (edge.feature.layer ?? 0) !== seed.layer) continue;
        const next = edge.a === item.node ? edge.b : edge.a,
          distance = item.distance + edge.length;
        // Include one final sample past the fade boundary, retaining the native far end.
        if (item.distance >= seed.radius || distance >= (distances.get(next.key) ?? Infinity))
          continue;
        distances.set(next.key, distance);
        queue.push({ node: next, distance });
      }
    }
  }
  let changed = false;
  const transportation = tile.transportation.flatMap((feature) => {
    const lines = paths.get(feature);
    if (!lines) return [feature];
    const lift = transportSurfaceLift(transportKind(feature));
    const profiles = lines.map((points) =>
      !points.some((n) => values.has(n.key))
        ? []
        : points.map((n) => {
            const base = ground(n.point) + lift;
            const contributions = (values.get(n.key) ?? []).filter(
              (c) => c.seed.kind === kind(feature) && c.seed.layer === (feature.layer ?? 0),
            );
            const exact = contributions.find((c) => c.distance < 0.05);
            if (exact) return { point: n.point, elevation: exact.seed.elevation, flatness: 1 };
            let weight = 0,
              elevation = 0,
              flatness = 0;
            for (const c of contributions) {
              const w = 1 / Math.max(0.1, c.distance) ** 2;
              const fade = 1 - smooth((c.distance - c.seed.radius / 2) / (c.seed.radius / 2));
              // Coarse riverbank DEMs often recover in the next map fragment. Hold the deck
              // grade until that recovery, rather than fading the original endpoint delta
              // independently on every short way (which makes a deep dip at every joint).
              const delta = c.seed.elevation - base;
              const raising = c.seed.elevation >= ground(c.seed.node.point) + lift;
              elevation += (base + (raising ? Math.max(0, delta) : delta) * fade) * w;
              flatness += (raising && delta < 0 ? 0 : fade) * w;
              weight += w;
            }
            return {
              point: n.point,
              elevation: weight ? elevation / weight : base,
              flatness: weight ? flatness / weight : 0,
            };
          }),
    );
    if (
      !profiles.some((p) =>
        p.some(
          (v) => v.flatness > 0.0001 || Math.abs(v.elevation - ground(v.point) - lift) > 0.001,
        ),
      )
    )
      return [feature];
    changed = true;
    return feature.lines.length === 1
      ? [{ ...feature, bridgeApproachProfile: profiles[0] }]
      : feature.lines.map((line, i) => ({
          ...feature,
          lines: [line],
          bridgeApproachProfile: profiles[i],
        }));
  });
  return changed ? { ...tile, transportation } : tile;
}
