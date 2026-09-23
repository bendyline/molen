import { distancePointToSegment, pointInPolygon, ringBounds } from './geometry2d';
import { resolveInteriorProfile } from './interior-catalog';
import type { BuildingOpening, InteriorSite, InteriorStorey } from './interior-types';
import type { BuildingRequest, HeightSampler, Vec2, Vec3 } from './types';

/** Structural access only. This deliberately does not run a layout algorithm. */
export function createInteriorSite(
  request: BuildingRequest,
  outline: Vec2[],
  holes: Vec2[][],
  floor: number,
  ceiling: number,
  ground: HeightSampler,
  seams?: ReadonlySet<number>,
  storeys?: InteriorStorey[],
): InteriorSite | undefined {
  // Cut pieces do not describe a complete navigable space; elevated parts need vertical access.
  if (request.clipped || (request.minHeight ?? 0) > 0 || ceiling - floor < 2.35) return undefined;
  const residential =
    resolveInteriorProfile([
      ...(request.interiorLabels ?? []),
      ...request.labels,
      request.context ?? '',
    ]).algorithm === 'residential';
  const anchor = request.storefronts?.[0]?.at;
  let best: { edge: number; length: number; score: number } | undefined;
  for (let edge = 0; edge < outline.length; edge++) {
    if (seams?.has(edge)) continue;
    const a = outline[edge] as Vec2,
      b = outline[(edge + 1) % outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 2) continue;
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const inward: Vec2 = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    if (!pointInPolygon([mid[0] + inward[0], mid[1] + inward[1]], outline, holes)) continue;
    const gap = Math.abs(
      floor - ground.sampleHeight(mid[0] - inward[0] * 2, mid[1] - inward[1] * 2),
    );
    const score = anchor
      ? distancePointToSegment(anchor, a, b) + gap * 2
      : gap * 4 - Math.min(length, 25);
    if (!best || score < best.score) best = { edge, length, score };
  }
  if (!best) return undefined;
  const a = outline[best.edge] as Vec2,
    b = outline[(best.edge + 1) % outline.length] as Vec2;
  const tangent: Vec2 = [(b[0] - a[0]) / best.length, (b[1] - a[1]) / best.length];
  const inward: Vec2 = [-tangent[1], tangent[0]];
  const width = Math.min(best.length - 0.6, residential ? 1.1 : best.length > 10 ? 2.2 : 1.4);
  const center = anchor
    ? Math.max(
        width / 2 + 0.3,
        Math.min(
          best.length - width / 2 - 0.3,
          (anchor[0] - a[0]) * tangent[0] + (anchor[1] - a[1]) * tangent[1],
        ),
      )
    : best.length / 2;
  const entrance: Vec2 = [a[0] + tangent[0] * center, a[1] + tangent[1] * center];
  const door: BuildingOpening = {
    edge: best.edge,
    start: center - width / 2,
    end: center + width / 2,
    bottom: floor - 0.06,
    top: floor + Math.min(2.65, ceiling - floor - 0.12),
    kind: 'door',
  };
  const openings: BuildingOpening[] = [door];
  // A bounded pair of genuine frontage windows; residences also open the other elevations.
  for (const [start, end] of [
    [0.6, door.start - 0.35],
    [door.end + 0.35, best.length - 0.6],
  ]) {
    if (start === undefined || end === undefined || end - start < 1) continue;
    const mid = (start + end) / 2,
      half = Math.min(residential ? 0.85 : 2.4, (end - start) / 2);
    openings.push({
      edge: best.edge,
      start: mid - half,
      end: mid + half,
      bottom: floor + 0.85,
      top: floor + Math.min(2.6, ceiling - floor - 0.15),
      kind: 'window',
    });
  }
  if (residential)
    for (let edge = 0; edge < outline.length; edge++) {
      if (edge === best.edge || openings.length >= 9) continue;
      const a = outline[edge] as Vec2,
        b = outline[(edge + 1) % outline.length] as Vec2;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 3) continue;
      for (const fraction of length >= 8 ? [0.28, 0.72] : [0.5]) {
        const mid = length * fraction;
        openings.push({
          edge,
          start: mid - 0.8,
          end: mid + 0.8,
          bottom: floor + 0.95,
          top: Math.min(floor + 2.3, ceiling - 0.15),
          kind: 'window',
        });
      }
    }
  // Stacked structural apertures reveal available upper storeys without generating their plans.
  for (const storey of residential ? (storeys?.slice(1) ?? []) : []) {
    for (const window of openings.filter((o) => o.kind === 'window' && o.bottom < ceiling)) {
      openings.push({
        ...window,
        bottom: storey.floor + 0.85,
        top: Math.min(storey.floor + 2.3, storey.ceiling - 0.15),
      });
    }
  }
  const outside = (side: number, depth: number): Vec3 => {
    const x = entrance[0] + tangent[0] * side - inward[0] * depth;
    const z = entrance[1] + tangent[1] * side - inward[1] * depth;
    return [x, depth === 0 ? floor + 0.04 : ground.sampleHeight(x, z) + 0.04, z];
  };
  const gap = Math.abs(floor - outside(0, 2)[1]);
  const depth = Math.min(16, Math.max(2, gap * 3));
  return {
    identity: request.identity,
    labels: [
      ...(request.interiorLabels ?? []),
      ...request.labels,
      ...(request.context ? [request.context] : []),
    ],
    outline,
    holes,
    bounds: ringBounds(outline),
    floor: floor + 0.04,
    ceiling,
    ...(storeys ? { storeys } : {}),
    entrance,
    inward,
    openings,
    access: [
      outside(-width / 2, 0),
      outside(width / 2, 0),
      outside(width / 2, depth),
      outside(-width / 2, depth),
    ],
  };
}

export function interiorToWorld(site: InteriorSite, p: Vec2): Vec2 {
  return [
    site.entrance[0] + site.inward[1] * p[0] + site.inward[0] * p[1],
    site.entrance[1] - site.inward[0] * p[0] + site.inward[1] * p[1],
  ];
}
export function interiorToLocal(site: InteriorSite, p: Vec2): Vec2 {
  const x = p[0] - site.entrance[0],
    z = p[1] - site.entrance[1];
  return [x * site.inward[1] - z * site.inward[0], x * site.inward[0] + z * site.inward[1]];
}
