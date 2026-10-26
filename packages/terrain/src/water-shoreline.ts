/** Close the gap between mapped water and the coarse, rendered elevation triangles. */
import * as THREE from 'three';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import { renderedGroundSampler } from './rendered-ground';
import type { TerrainSemanticPolygon } from './semantic-types';

export function buildTerrainWaterBanks(
  waters: readonly { polygon: TerrainSemanticPolygon; height: number }[],
  context: TerrainPyramidTileLayerContext,
  groundOffset: number,
): THREE.BufferGeometry | undefined {
  const size = context.tileSize;
  const spacing = size / Math.max(1, (context.surfaceResolution ?? context.heightfield.cols) - 1);
  const sample = renderedGroundSampler(
    context.heightfield,
    context.origin,
    size,
    context.surfaceResolution,
  );
  const positions: number[] = [];
  for (const { polygon, height } of waters) {
    for (const ring of [polygon.outer, ...(polygon.holes ?? [])]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]?.map((v) => v * size) as [number, number];
        const b = ring[(i + 1) % ring.length]?.map((v) => v * size) as [number, number];
        // Tile clipping is not a physical bank. Adjacent water tiles meet without curtains.
        if (
          [0, 1].some(
            (axis) =>
              (Math.abs(a[axis] as number) < 1e-7 && Math.abs(b[axis] as number) < 1e-7) ||
              (Math.abs((a[axis] as number) - size) < 1e-7 &&
                Math.abs((b[axis] as number) - size) < 1e-7),
          )
        )
          continue;
        const cuts = new Set([0, 1]);
        // Split at every grid edge and cell diagonal so the upper edge follows actual triangles.
        for (const [u, v] of [
          [a[0], b[0]],
          [a[1], b[1]],
          [a[0] + a[1], b[0] + b[1]],
        ]) {
          if (u === undefined || v === undefined || Math.abs(v - u) < 1e-10) continue;
          for (
            let k = Math.floor(Math.min(u, v) / spacing) + 1;
            k * spacing < Math.max(u, v);
            k++
          ) {
            const t = (k * spacing - u) / (v - u);
            if (t > 0 && t < 1) cuts.add(t);
          }
        }
        const ordered = [...cuts].sort((a, b) => a - b);
        for (let j = 1; j < ordered.length; j++) {
          const points = [ordered[j - 1], ordered[j]].map((t) => {
            const x = a[0] + (b[0] - a[0]) * (t as number);
            const z = a[1] + (b[1] - a[1]) * (t as number);
            return [x, sample(context.origin[0] + x, context.origin[1] + z) + groundOffset, z];
          }) as [number[], number[]];
          if (points.every((p) => (p[1] as number) <= height)) continue;
          const [p, q] = points;
          const vertices = [
            [p[0], Math.max(p[1] as number, height), p[2]],
            [p[0], height - 0.05, p[2]],
            [q[0], Math.max(q[1] as number, height), q[2]],
            [q[0], height - 0.05, q[2]],
          ];
          for (const k of [0, 1, 2, 2, 1, 3]) positions.push(...(vertices[k] as number[]));
        }
      }
    }
  }
  if (!positions.length) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
