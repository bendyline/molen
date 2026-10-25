/** Source controls override the conservative, decorative junction fallback. */
import { sampleTerrainLine } from './line-path';
import type { TerrainPoiFeature, TerrainSemanticTile } from './semantic-types';
import type { SurfaceJunction } from './surface-network';
import { isArterialRoad } from './transport-features';

export interface SurfaceControl {
  signal: boolean;
  stops: Set<SurfaceJunction['arms'][number]>;
  yields: Set<SurfaceJunction['arms'][number]>;
  allWay: boolean;
  source: 'mapped' | 'inferred';
}

/** Reject outgoing one-way arms; signs face the approaching driver. */
export function incomingArm(arm: SurfaceJunction['arms'][number]): boolean {
  if (!arm.road.feature.oneway) return true;
  const tangent = sampleTerrainLine(arm.road.path, arm.distance);
  return tangent.dx * arm.dx + tangent.dz * arm.dz < 0;
}

export function surfaceJunctionControls(
  tile: TerrainSemanticTile,
  junctions: readonly SurfaceJunction[],
  tileSize: number,
  inferStops: boolean,
): Map<SurfaceJunction, SurfaceControl> {
  const mapped = new Map<SurfaceJunction, TerrainPoiFeature[]>();
  for (const poi of tile.pois ?? []) {
    const kind = poi.subclass ?? poi.class;
    if (
      !['traffic_signals', 'stop', 'give_way', 'priority'].includes(kind) ||
      poi.bridge ||
      poi.tunnel
    )
      continue;
    let best: SurfaceJunction | undefined;
    let distance = Number.POSITIVE_INFINITY;
    for (const node of junctions) {
      if (node.layer !== (poi.layer ?? 0)) continue;
      const d = Math.hypot(poi.point[0] * tileSize - node.x, poi.point[1] * tileSize - node.z);
      if (d < node.radius + 18 && d < distance) {
        best = node;
        distance = d;
      }
    }
    if (best) {
      const list = mapped.get(best) ?? [];
      list.push(poi);
      mapped.set(best, list);
    }
  }
  const result = new Map<SurfaceJunction, SurfaceControl>();
  for (const node of junctions) {
    const pois = mapped.get(node) ?? [];
    const incoming = node.arms.filter(incomingArm);
    const major = node.arms.filter((a) =>
      isArterialRoad(a.road.feature.subclass ?? a.road.feature.class, a.width),
    );
    const control: SurfaceControl = {
      signal: false,
      stops: new Set(),
      yields: new Set(),
      allWay: false,
      source: pois.length ? 'mapped' : 'inferred',
    };
    if (pois.length) {
      control.signal = pois.some((p) => (p.subclass ?? p.class) === 'traffic_signals');
      if (!control.signal)
        for (const poi of pois) {
          const kind = poi.subclass ?? poi.class;
          if (kind !== 'stop' && kind !== 'give_way') continue;
          const targets = kind === 'stop' ? control.stops : control.yields;
          const sx = poi.point[0] * tileSize - node.x,
            sz = poi.point[1] * tileSize - node.z;
          if (poi.stop === 'all' && Math.hypot(sx, sz) <= 4) {
            for (const arm of incoming) targets.add(arm);
            continue;
          }
          // Match the approach carrying the node, not every road in the junction.
          let best: (typeof incoming)[number] | undefined;
          let bestDistance = Number.POSITIVE_INFINITY;
          for (const arm of incoming) {
            const along = sx * arm.dx + sz * arm.dz;
            const across = Math.abs(sx * arm.dz - sz * arm.dx);
            if (along <= 1 || across > arm.width / 2 + 3) continue;
            if (across < bestDistance) {
              best = arm;
              bestDistance = across;
            }
          }
          if (best) targets.add(best);
        }
    } else {
      // One arterial meeting a residential street is not sufficient evidence for lights.
      control.signal = node.arms.length >= 4 && major.length >= 4;
      if (!control.signal && inferStops) {
        for (const arm of incoming)
          if (!major.length || !major.includes(arm)) control.stops.add(arm);
      }
    }
    control.allWay = incoming.length >= 3 && control.stops.size === incoming.length;
    result.set(node, control);
  }
  return result;
}
