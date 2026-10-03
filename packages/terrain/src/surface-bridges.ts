/** Lightweight inferred bridge decks. Source bridge flags, never water overlap, select spans. */
import * as THREE from 'three';
import { bridgeDeckHeightFn } from './bridge-profile';
import { sampleTerrainLine, type TerrainSurfaceMeshBuilder } from './linear-features';
import type { TerrainSemanticPoint } from './semantic-types';
import type { SurfaceRoad } from './surface-network';

/** A tile fragment cannot establish the elevation of an entire bridge. Use a bank-to-bank
 * profile for complete spans and deterministic terrain clearance at clipped ends. Hosts
 * with surveyed heights can supply deckElevation (absolute world Y). */
export function bridgeDeckProfile(
  road: SurfaceRoad,
  builder: TerrainSurfaceMeshBuilder,
  groundEnds: ReadonlySet<string> = new Set(),
): (x: number, z: number) => number {
  const { context } = builder;
  const connects = ([x, z]: TerrainSemanticPoint): boolean =>
    groundEnds.has(`${Math.round(x * 10)}/${Math.round(z * 10)}`);
  const a = road.path.points[0] as TerrainSemanticPoint,
    b = road.path.points.at(-1) as TerrainSemanticPoint;
  return bridgeDeckHeightFn(
    road.path,
    (x, z) => context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z),
    {
      ...(road.feature.deckElevation !== undefined
        ? { deckElevation: road.feature.deckElevation }
        : {}),
      clearance: road.kind === 'path' ? 3 : 6,
      approachLift: road.feature.bridge ? road.elevation - 4 : road.elevation,
      groundApproach: !road.feature.bridge,
      connects: [connects(a), connects(b)],
      connections: (road.feature.bridgeConnections ?? []).map((connection) => ({
        point: [
          connection.point[0] * context.tileSize,
          connection.point[1] * context.tileSize,
        ] as TerrainSemanticPoint,
        elevation: connection.elevation,
        radius: connection.radius,
      })),
    },
  );
}

export function appendBridgeStructure(
  builder: TerrainSurfaceMeshBuilder,
  road: SurfaceRoad,
  heightAt: (x: number, z: number) => number,
  sampleSpacing = 6,
): void {
  // A sub-metre map/model endpoint discrepancy leaves a connector strip, not an
  // independent bridge. Its road surface still joins the authored deck, but a
  // full-width inferred pier or tall parapet would protrude into the landmark.
  if (road.path.length < 2 && road.feature.bridgeConnections?.length) return;
  const concrete = new THREE.Color('#9b9c94');
  const rail = new THREE.Color('#bfc1b8');
  const thickness = road.kind === 'path' ? 0.45 : 1.1;
  const width = road.width + 0.8;
  const point = (d: number, offset: number, y: number): [number, number, number] => {
    const p = sampleTerrainLine(road.path, d, offset);
    return [p.x, heightAt(p.x, p.z) + y, p.z];
  };
  const prism = (
    d0: number,
    d1: number,
    offset: number,
    w: number,
    bottom: number,
    top: number,
    color: THREE.Color,
    cover = true,
  ): void => {
    const a = point(d0, offset - w / 2, bottom),
      b = point(d1, offset - w / 2, bottom);
    const c = point(d1, offset + w / 2, bottom),
      d = point(d0, offset + w / 2, bottom);
    const e = point(d0, offset - w / 2, top),
      f = point(d1, offset - w / 2, top);
    const g = point(d1, offset + w / 2, top),
      h = point(d0, offset + w / 2, top);
    const faces = [
      [a, b, c, d],
      [a, e, f, b],
      [d, c, g, h],
      [a, d, h, e],
      [b, f, g, c],
    ];
    if (cover) faces.push([e, h, g, f]);
    for (const face of faces) builder.face(face, color);
  };
  // Preserve mapped bends and sample vertical approaches at the road mesh resolution.
  for (let i = 1; i < road.path.distances.length; i++) {
    const start = road.path.distances[i - 1] as number,
      end = road.path.distances[i] as number;
    for (let d = start; d < end; d += sampleSpacing) {
      const next = Math.min(end, d + sampleSpacing);
      // Asphalt and shoulders are the slab's top. A second interpolated top face
      // can poke through the road where an approach profile curves vertically.
      prism(d, next, 0, width, -thickness, -0.06, concrete, false);
      for (const sign of [-1, 1])
        prism(d, next, sign * (width / 2 - 0.2), 0.3, 0, road.kind === 'rail' ? 0.55 : 1.1, rail);
    }
  }
  // Anchor piers to a world-coordinate grid, keeping their phase through clipped tiles.
  const spacing = road.kind === 'path' ? 32 : 64;
  for (let i = 1; i < road.path.points.length; i++) {
    const a = road.path.points[i - 1] as TerrainSemanticPoint,
      b = road.path.points[i] as TerrainSemanticPoint;
    const axis = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
    const origin = builder.context.origin[axis];
    const lo = Math.min(a[axis], b[axis]) + origin,
      hi = Math.max(a[axis], b[axis]) + origin;
    for (let v = Math.ceil(lo / spacing) * spacing; v < hi; v += spacing) {
      const t = (v - origin - a[axis]) / (b[axis] - a[axis]);
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      const y =
        builder.context.heightfield.sampleHeight(
          builder.context.origin[0] + x,
          builder.context.origin[1] + z,
        ) - 1;
      const top = heightAt(x, z) - thickness;
      if (top <= y) continue;
      const half = road.kind === 'path' ? 0.65 : 1.25;
      const base: [number, number, number][] = [
        [x - half, y, z - half],
        [x + half, y, z - half],
        [x + half, y, z + half],
        [x - half, y, z + half],
      ];
      for (let j = 0; j < 4; j++) {
        const p = base[j] as [number, number, number],
          q = base[(j + 1) % 4] as [number, number, number];
        builder.face([p, q, [q[0], top, q[2]], [p[0], top, p[2]]], concrete);
      }
    }
  }
}
