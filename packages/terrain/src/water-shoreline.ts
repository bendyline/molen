/** Close the gap between mapped water and the coarse, rendered elevation triangles. */
import * as THREE from 'three';
import { ringSignedArea } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import { renderedGroundSampler } from './rendered-ground';
import type { TerrainSemanticPoint, TerrainSemanticPolygon } from './semantic-types';

type Water = { polygon: TerrainSemanticPolygon; height: number; fixedStage?: boolean };

const edgeKey = (a: readonly [number, number], b: readonly [number, number]): string =>
  `${a[0]},${a[1]}|${b[0]},${b[1]}`;

/** Interior joins between co-level map polygons, such as a canal meeting a river. */
function coLevelEdges(waters: readonly Water[]): Map<number, Set<string>> {
  const counts = new Map<number, number>();
  for (const { height } of waters) counts.set(height, (counts.get(height) ?? 0) + 1);
  const levels = new Map<number, Set<string>>();
  for (const { polygon, height } of waters) {
    if ((counts.get(height) ?? 0) < 2) continue;
    let edges = levels.get(height);
    if (!edges) {
      edges = new Set();
      levels.set(height, edges);
    }
    for (const [ringIndex, ring] of [polygon.outer, ...(polygon.holes ?? [])].entries()) {
      const waterOnLeft = ringSignedArea(ring) > 0 === (ringIndex === 0);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i] as TerrainSemanticPoint;
        const b = ring[(i + 1) % ring.length] as TerrainSemanticPoint;
        edges.add(waterOnLeft ? edgeKey(a, b) : edgeKey(b, a));
      }
    }
  }
  return levels;
}

export function buildTerrainWaterBanks(
  waters: readonly Water[],
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
  // The current segment's parameter range over the tile (see tileSpan).
  const span = new Float64Array(2);
  const addCuts = (u: number, v: number): void => {
    if (Math.abs(v - u) < 1e-10) return;
    for (let k = Math.floor(Math.min(u, v) / spacing) + 1; k * spacing < Math.max(u, v); k++) {
      const t = (k * spacing - u) / (v - u);
      if (t > (span[0] as number) && t < (span[1] as number)) cuts.push(t);
    }
  };
  const edge = (value: number): number =>
    Math.abs(value) < 1e-7 ? 0 : Math.abs(value - size) < 1e-7 ? 1 : -1;
  const joined = coLevelEdges(waters);
  for (const { polygon, height, fixedStage } of waters) {
    const bottom = height - 0.05;
    const sameStage = joined.get(height);
    for (const [ringIndex, ring] of [polygon.outer, ...(polygon.holes ?? [])].entries()) {
      const waterOnLeft = sameStage && ringSignedArea(ring) > 0 === (ringIndex === 0);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i] as readonly [number, number];
        const b = ring[(i + 1) % ring.length] as readonly [number, number];
        // Matching direction alone can come from duplicate geometry. The reversed edge,
        // oriented with water on its left, proves that both sides are wet at this elevation.
        if (sameStage?.has(waterOnLeft ? edgeKey(b, a) : edgeKey(a, b))) continue;
        const ax = a[0] * size,
          az = a[1] * size,
          bx = b[0] * size,
          bz = b[1] * size;
        // Only the part over this tile's ground. Decoded and overzoomed areas reach a buffer past
        // the tile, where the sampler clamps to the edge cells: banks there stood in open water,
        // as tall as the edge ground (hundreds of metres on a coarse tile). Shore in the buffer
        // is the neighbour's, built from its own polygon over its own ground.
        if (!tileSpan(ax, az, bx, bz, size, span)) continue;
        const t0 = span[0] as number,
          t1 = span[1] as number;
        // Tile clipping is not a physical bank. Adjacent water tiles meet without curtains.
        const sx = ax + (bx - ax) * t0,
          sz = az + (bz - az) * t0,
          tx = ax + (bx - ax) * t1,
          tz = az + (bz - az) * t1;
        const ex = edge(sx),
          ez = edge(sz);
        if ((ex >= 0 && ex === edge(tx)) || (ez >= 0 && ez === edge(tz))) continue;
        // Split at every grid edge and cell diagonal so the upper edge follows actual triangles.
        cuts.length = 0;
        cuts.push(t0, t1);
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
          if (fixedStage || py > height || qy > height) {
            const pTop = Math.max(py, height),
              qTop = Math.max(qy, height);
            // Fixed inland stages can be higher than the DEM on the dry side of the shore.
            // Extend the bank to the original ground so the flat water has a closed edge.
            const pBottom = fixedStage ? Math.min(bottom, py - groundOffset - 0.05) : bottom;
            const qBottom = fixedStage ? Math.min(bottom, qy - groundOffset - 0.05) : bottom;
            push(px, pTop, pz);
            push(px, pBottom, pz);
            push(qx, qTop, qz);
            push(qx, qTop, qz);
            push(px, pBottom, pz);
            push(qx, qBottom, qz);
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

/**
 * Liang–Barsky: the parameter range of segment a→b inside the tile square [0, size]², written to
 * `span`. False when the segment misses the tile or only touches it.
 */
function tileSpan(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  size: number,
  span: Float64Array,
): boolean {
  span[0] = 0;
  span[1] = 1;
  return (
    clipSide(ax - bx, ax, span) &&
    clipSide(bx - ax, size - ax, span) &&
    clipSide(az - bz, az, span) &&
    clipSide(bz - az, size - az, span) &&
    (span[1] as number) > (span[0] as number)
  );
}

/** Narrow `span` to the t where p·t ≤ q; false when no t qualifies. */
function clipSide(p: number, q: number, span: Float64Array): boolean {
  if (p === 0) return q >= 0;
  const r = q / p;
  if (p < 0) span[0] = Math.max(span[0] as number, r);
  else span[1] = Math.min(span[1] as number, r);
  return true;
}
