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
  const [ox, oz] = context.origin;
  const sample = renderedGroundSampler(
    context.heightfield,
    context.origin,
    size,
    context.surfaceResolution,
  );
  // Written straight into one growing buffer, each cut point's height reused by the next
  // segment: arrays per edge and segment cost a river tile's banks 60 ms on the main thread.
  let positions = new Float32Array(3 * 1024);
  let written = 0;
  const push = (x: number, y: number, z: number): void => {
    if (written + 3 > positions.length) {
      const grown = new Float32Array(positions.length * 2);
      grown.set(positions);
      positions = grown;
    }
    positions[written++] = x;
    positions[written++] = y;
    positions[written++] = z;
  };
  const cuts: number[] = [];
  const addCuts = (u: number, v: number): void => {
    if (Math.abs(v - u) < 1e-10) return;
    for (let k = Math.floor(Math.min(u, v) / spacing) + 1; k * spacing < Math.max(u, v); k++) {
      const t = (k * spacing - u) / (v - u);
      if (t > 0 && t < 1) cuts.push(t);
    }
  };
  const edge = (value: number): number =>
    Math.abs(value) < 1e-7 ? 0 : Math.abs(value - size) < 1e-7 ? 1 : -1;
  for (const { polygon, height } of waters) {
    const bottom = height - 0.05;
    for (const ring of [polygon.outer, ...(polygon.holes ?? [])]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i] as readonly [number, number];
        const b = ring[(i + 1) % ring.length] as readonly [number, number];
        const ax = a[0] * size,
          az = a[1] * size,
          bx = b[0] * size,
          bz = b[1] * size;
        // Tile clipping is not a physical bank. Adjacent water tiles meet without curtains.
        const ex = edge(ax),
          ez = edge(az);
        if ((ex >= 0 && ex === edge(bx)) || (ez >= 0 && ez === edge(bz))) continue;
        // Split at every grid edge and cell diagonal so the upper edge follows actual triangles.
        cuts.length = 0;
        cuts.push(0, 1);
        addCuts(ax, bx);
        addCuts(az, bz);
        addCuts(ax + az, bx + bz);
        cuts.sort((left, right) => left - right);
        let pt = cuts[0] as number;
        let px = ax + (bx - ax) * pt,
          pz = az + (bz - az) * pt;
        let py = sample(ox + px, oz + pz) + groundOffset;
        for (let j = 1; j < cuts.length; j++) {
          const t = cuts[j] as number;
          if (t === pt) continue;
          const qx = ax + (bx - ax) * t,
            qz = az + (bz - az) * t;
          const qy = sample(ox + qx, oz + qz) + groundOffset;
          if (py > height || qy > height) {
            const pTop = Math.max(py, height),
              qTop = Math.max(qy, height);
            push(px, pTop, pz);
            push(px, bottom, pz);
            push(qx, qTop, qz);
            push(qx, qTop, qz);
            push(px, bottom, pz);
            push(qx, bottom, qz);
          }
          pt = t;
          px = qx;
          pz = qz;
          py = qy;
        }
      }
    }
  }
  if (written === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, written), 3));
  geometry.computeVertexNormals();
  return geometry;
}
