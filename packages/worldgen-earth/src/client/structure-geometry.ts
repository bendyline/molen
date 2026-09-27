import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import type { StructurePlacement } from '../kernel/structure-index';

/** Clip transformed prepared-model triangles, including their colors and normals. Ownership
 * follows terrain coverage, so a bridge end survives even when its anchor tile is absent. */
export function clipStructureGeometry(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  size: number,
): THREE.BufferGeometry {
  const geometry = source.clone().applyMatrix4(matrix);
  const names = ['position', 'normal', 'color'] as const;
  const attributes = names.map((name) => geometry.getAttribute(name));
  const arrays = names.map(() => [] as number[]);
  const index = geometry.index;
  const count = index?.count ?? geometry.getAttribute('position').count;
  for (let i = 0; i < count; i += 3) {
    let polygon = [0, 1, 2].map((j) => {
      const v = index ? index.getX(i + j) : i + j;
      return attributes.flatMap((a) => (a ? [a.getX(v), a.getY(v), a.getZ(v)] : [1, 1, 1]));
    });
    for (const [axis, edge, sign] of [
      [0, 0, 1],
      [0, size, -1],
      [2, 0, 1],
      [2, size, -1],
    ] as const) {
      const input = polygon;
      polygon = [];
      for (let j = 0; j < input.length; j++) {
        const a = input[j] as number[],
          b = input[(j + 1) % input.length] as number[];
        const da = ((a[axis] as number) - edge) * sign,
          db = ((b[axis] as number) - edge) * sign;
        if (da >= 0) polygon.push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db);
          const cut = a.map((v, k) => v + ((b[k] as number) - v) * t);
          cut[axis] = edge;
          polygon.push(cut);
        }
      }
    }
    for (let j = 1; j + 1 < polygon.length; j++)
      for (const p of [polygon[0], polygon[j], polygon[j + 1]] as number[][]) {
        names.forEach((_, k) => {
          (arrays[k] as number[]).push(...p.slice(k * 3, k * 3 + 3));
        });
      }
  }
  geometry.dispose();
  const result = new THREE.BufferGeometry();
  names.forEach((name, i) => {
    result.setAttribute(name, new THREE.Float32BufferAttribute(arrays[i] as number[], 3));
  });
  result.normalizeNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/** Exact segment/rectangle subtraction: keep approach fragments, including lines whose
 * endpoints are both outside a long bridge. Only bridge-tagged map features are replaced. */
export function withoutStructureRoads(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  structures: readonly StructurePlacement[],
  metersPerUnit: number,
): TerrainSemanticTile {
  let transportation = tile.transportation;
  for (const entry of structures) {
    if (!entry.replaceRoads) continue;
    const [cx, cz] = wgs84ToWorld(metersPerUnit, ...entry.anchor);
    const c = Math.cos(entry.heading ?? 0),
      s = Math.sin(entry.heading ?? 0);
    const hx = (entry.replaceRoads.length * (entry.scale?.[0] ?? 1)) / 2;
    const hz = (entry.replaceRoads.width * (entry.scale?.[2] ?? 1)) / 2;
    const deckHeight = entry.replaceRoads.deckHeight;
    const connections =
      deckHeight === undefined
        ? []
        : [-1, 1].map((sign) => ({
            point: [
              (cx + c * sign * hx - context.origin[0]) / context.tileSize,
              (cz - s * sign * hx - context.origin[1]) / context.tileSize,
            ] as TerrainSemanticPoint,
            elevation:
              (entry.datum === 'sea-level' ? 0 : context.heightfield.sampleHeight(cx, cz)) +
              (entry.elevation ?? 0) +
              deckHeight * (entry.scale?.[1] ?? 1),
            radius: 100,
          }));
    transportation = transportation.flatMap((feature) => {
      if (!feature.bridge || feature.tunnel) return [feature];
      const lines: TerrainSemanticLine[] = [];
      for (const line of feature.lines) {
        let current: TerrainSemanticLine = [];
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1] as TerrainSemanticPoint,
            b = line[i] as TerrainSemanticPoint;
          const local = ([u, v]: TerrainSemanticPoint): [number, number] => {
            const x = context.origin[0] + u * context.tileSize - cx,
              z = context.origin[1] + v * context.tileSize - cz;
            return [c * x - s * z, s * x + c * z];
          };
          const p = local(a),
            q = local(b);
          // A separately elevated crossing must not disappear beneath this bridge.
          if (Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0])) {
            if (!current.length) current.push(a);
            current.push(b);
            continue;
          }
          let enter = 0,
            leave = 1;
          for (const [axis, half] of [
            [0, hx],
            [1, hz],
          ] as const) {
            const d = q[axis] - p[axis];
            if (Math.abs(d) < 1e-12) {
              if (Math.abs(p[axis]) > half) enter = Infinity;
            } else {
              const t0 = (-half - p[axis]) / d,
                t1 = (half - p[axis]) / d;
              enter = Math.max(enter, Math.min(t0, t1));
              leave = Math.min(leave, Math.max(t0, t1));
            }
          }
          const at = (t: number): [number, number] => [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
          ];
          if (enter >= leave) {
            if (!current.length) current.push(a);
            current.push(b);
            continue;
          }
          if (enter > 0) {
            if (!current.length) current.push(a);
            current.push(at(enter));
          }
          if (current.length > 1) lines.push(current);
          current = leave < 1 ? [at(leave), b] : [];
        }
        if (current.length > 1) lines.push(current);
      }
      return lines.length
        ? [
            {
              ...feature,
              lines,
              ...(connections.length
                ? { bridgeConnections: [...(feature.bridgeConnections ?? []), ...connections] }
                : {}),
            },
          ]
        : [];
    });
  }
  return transportation === tile.transportation ? tile : { ...tile, transportation };
}
