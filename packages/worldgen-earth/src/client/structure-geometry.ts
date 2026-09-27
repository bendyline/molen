import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import type { StructurePlacement } from '../kernel/structure-index';

/** Clip static triangles in tile space while retaining UV sets, vertex colors, tangents and
 * material groups. The source geometry remains shared and untouched. */
export function clipStructureGeometry(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  size: number,
): THREE.BufferGeometry {
  const geometry = source.clone();
  // glTF quantization uses normalized integer attributes: expand before a world transform
  // so a kilometer-long bridge does not get clamped to the integer's normalized range.
  for (const name of ['position', 'normal', 'tangent']) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || (attribute.array instanceof Float32Array && !attribute.normalized)) continue;
    const data = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++)
      for (let k = 0; k < attribute.itemSize; k++)
        data[i * attribute.itemSize + k] = attribute.getComponent(i, k);
    geometry.setAttribute(name, new THREE.BufferAttribute(data, attribute.itemSize));
  }
  geometry.applyMatrix4(matrix);
  const names = [
    'position',
    ...Object.keys(geometry.attributes).filter((name) => name !== 'position'),
  ];
  const attributes = names.map((name) => geometry.getAttribute(name));
  const arrays = names.map(() => [] as number[]);
  const index = geometry.index;
  const count = index?.count ?? geometry.getAttribute('position').count;
  const mirrored = matrix.determinant() < 0;
  const result = new THREE.BufferGeometry();
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
  for (const group of groups) {
    const start = (arrays[0] as number[]).length / 3;
    const first = Math.max(group.start, geometry.drawRange.start);
    const end = Math.min(
      group.start + group.count,
      count,
      geometry.drawRange.start + geometry.drawRange.count,
    );
    for (let i = first; i + 2 < end; i += 3) {
      let polygon = (mirrored ? [0, 2, 1] : [0, 1, 2]).map((j) => {
        const v = index ? index.getX(i + j) : i + j;
        return attributes.flatMap((attribute) =>
          Array.from({ length: attribute.itemSize }, (_, k) => attribute.getComponent(v, k)),
        );
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
          let offset = 0;
          attributes.forEach((attribute, k) => {
            (arrays[k] as number[]).push(...p.slice(offset, offset + attribute.itemSize));
            offset += attribute.itemSize;
          });
        }
    }
    const emitted = (arrays[0] as number[]).length / 3 - start;
    if (emitted > 0) result.addGroup(start, emitted, group.materialIndex);
  }
  geometry.dispose();
  names.forEach((name, i) => {
    result.setAttribute(
      name,
      new THREE.Float32BufferAttribute(
        arrays[i] as number[],
        (attributes[i] as THREE.BufferAttribute).itemSize,
      ),
    );
  });
  if (result.getAttribute('normal')) result.normalizeNormals();
  const tangents = result.getAttribute('tangent');
  if (tangents) {
    const direction = new THREE.Vector3();
    for (let i = 0; i < tangents.count; i++) {
      direction.fromBufferAttribute(tangents, i).normalize();
      tangents.setXYZ(i, direction.x, direction.y, direction.z);
      if (mirrored) tangents.setW(i, -tangents.getW(i));
    }
  }
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/** Extended structures are static and clipped per mesh, preserving their original materials. */
export function clipStructureObject(source: THREE.Object3D, size: number): THREE.Group {
  const result = new THREE.Group();
  source.updateMatrixWorld(true);
  try {
    source.traverseVisible((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (
        (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
        (mesh as THREE.InstancedMesh).isInstancedMesh ||
        Object.keys(mesh.geometry.morphAttributes).length > 0
      )
        throw new Error('Extended structure models require static meshes');
      const geometry = clipStructureGeometry(mesh.geometry, mesh.matrixWorld, size);
      if (geometry.getAttribute('position').count === 0) {
        geometry.dispose();
        return;
      }
      const part = new THREE.Mesh(geometry, mesh.material);
      part.name = mesh.name;
      part.renderOrder = mesh.renderOrder;
      part.castShadow = true;
      part.receiveShadow = true;
      part.userData.worldgenOwnedGeometry = true;
      result.add(part);
    });
    return result;
  } catch (error) {
    result.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    throw error;
  }
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
