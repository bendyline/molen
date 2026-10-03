import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { pointInRing, wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
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

/** Parametric crossings of a segment with a simple polygon, including collinear edges. */
function polygonCuts(
  p: TerrainSemanticPoint,
  q: TerrainSemanticPoint,
  ring: TerrainSemanticPoint[],
) {
  const dx = q[0] - p[0],
    dz = q[1] - p[1],
    length2 = dx * dx + dz * dz;
  const cuts = [0, 1];
  if (length2 < 1e-18) return cuts;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as TerrainSemanticPoint,
      b = ring[(i + 1) % ring.length] as TerrainSemanticPoint;
    const ex = b[0] - a[0],
      ez = b[1] - a[1],
      ax = a[0] - p[0],
      az = a[1] - p[1];
    const cross = dx * ez - dz * ex;
    if (Math.abs(cross) > 1e-12) {
      const t = (ax * ez - az * ex) / cross,
        u = (ax * dz - az * dx) / cross;
      if (t > 0 && t < 1 && u >= -1e-10 && u <= 1 + 1e-10) cuts.push(t);
    } else if (Math.abs(ax * dz - az * dx) < 1e-8) {
      for (const point of [a, b]) {
        const t = ((point[0] - p[0]) * dx + (point[1] - p[1]) * dz) / length2;
        if (t > 0 && t < 1) cuts.push(t);
      }
    }
  }
  return cuts
    .sort((a, b) => a - b)
    .filter((t, i, all) => i === 0 || t - (all[i - 1] as number) > 1e-10);
}

function coveredPoint(p: TerrainSemanticPoint, ring: TerrainSemanticPoint[]): boolean {
  if (pointInRing(p, ring)) return true;
  // Treat a road exactly on the authored edge consistently for either polygon winding.
  return ring.some((a, i) => {
    const b = ring[(i + 1) % ring.length] as TerrainSemanticPoint;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    return (
      Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) < 1e-8 &&
      (p[0] - a[0]) * (p[0] - b[0]) + (p[1] - a[1]) * (p[1] - b[1]) <= 1e-8
    );
  });
}

/** Exact segment/footprint subtraction: keep approach fragments, including lines whose
 * endpoints are both outside a long bridge. Grade approaches require an explicit opt-in
 * and a shared covered bridge endpoint; unrelated grade roads are never replaced. */
export function withoutStructureRoads(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  structures: readonly StructurePlacement[],
  metersPerUnit: number,
  resolvedElevation?: (entry: StructurePlacement) => number | undefined,
): TerrainSemanticTile {
  let transportation = tile.transportation;
  for (const entry of structures) {
    if (!entry.replaceRoads) continue;
    const [cx, cz] = wgs84ToWorld(metersPerUnit, ...entry.anchor);
    const c = Math.cos(entry.heading ?? 0),
      s = Math.sin(entry.heading ?? 0);
    const hx = (entry.replaceRoads.length * (entry.scale?.[0] ?? 1)) / 2;
    const hz = (entry.replaceRoads.width * (entry.scale?.[2] ?? 1)) / 2;
    const outline = entry.replaceRoads.outline?.map(
      ([x, z]): TerrainSemanticPoint => [x * (entry.scale?.[0] ?? 1), z * (entry.scale?.[2] ?? 1)],
    );
    const deckHeights =
      entry.replaceRoads.deckHeights ??
      (entry.replaceRoads.deckHeight === undefined
        ? undefined
        : [entry.replaceRoads.deckHeight, entry.replaceRoads.deckHeight]);
    const placedHeight = resolvedElevation?.(entry);
    // Skewed/asymmetric outlines need their actual centerline intersections, not +/-
    // half the bounding length. Deck heights correspond to negative/positive X ends.
    const centerlineEnds = [-hx, hx];
    if (outline) {
      const crossings = outline.flatMap((a, i) => {
        const b = outline[(i + 1) % outline.length] as TerrainSemanticPoint;
        if (a[1] === b[1]) return a[1] === 0 ? [a[0], b[0]] : [];
        const t = -a[1] / (b[1] - a[1]);
        return t >= 0 && t <= 1 ? [a[0] + (b[0] - a[0]) * t] : [];
      });
      if (crossings.length >= 2) {
        centerlineEnds[0] = Math.min(...crossings);
        centerlineEnds[1] = Math.max(...crossings);
      }
    }
    const connections =
      deckHeights === undefined
        ? []
        : centerlineEnds.map((endX, index) => ({
            point: [
              (cx + c * endX - context.origin[0]) / context.tileSize,
              (cz - s * endX - context.origin[1]) / context.tileSize,
            ] as TerrainSemanticPoint,
            elevation:
              (placedHeight ??
                (entry.datum === 'sea-level' ? 0 : context.heightfield.sampleHeight(cx, cz)) +
                  (entry.elevation ?? 0)) +
              (deckHeights[index] as number) * (entry.scale?.[1] ?? 1),
            radius: 100,
          }));
    const localPoint = ([u, v]: TerrainSemanticPoint): TerrainSemanticPoint => {
      const x = context.origin[0] + u * context.tileSize - cx,
        z = context.origin[1] + v * context.tileSize - cz;
      return [c * x - s * z, s * x + c * z];
    };
    const nodeKey = ([u, v]: TerrainSemanticPoint) =>
      `${Math.round((context.origin[0] + u * context.tileSize) * 10)}/${Math.round((context.origin[1] + v * context.tileSize) * 10)}`;
    const bankJoins = new Map<string, (typeof connections)[number]>();
    const coveredBridgeEnds = new Set<string>();
    // A removed bridge may end exactly where an untagged approach begins. Transfer
    // the height only through that shared endpoint and the outward aligned road;
    // nearby riverbank roads and perpendicular crossings retain their own elevation.
    for (const feature of transportation) {
      if (!feature.bridge || feature.tunnel) continue;
      for (const line of feature.lines) {
        if (line.length < 2) continue;
        for (const point of [line[0], line.at(-1)] as TerrainSemanticPoint[]) {
          const [x, z] = localPoint(point);
          if (
            entry.replaceRoads.includeConnectedApproaches &&
            (outline ? coveredPoint([x, z], outline) : Math.abs(x) <= hx && Math.abs(z) <= hz)
          )
            coveredBridgeEnds.add(nodeKey(point));
          if (!connections.length) continue;
          if (Math.abs(Math.abs(x) - hx) > hz + 1 || Math.abs(z) > hz) continue;
          let edgeDistance = Math.abs(Math.abs(x) - hx);
          if (outline)
            edgeDistance = Math.min(
              ...outline.map((a, i) => {
                const b = outline[(i + 1) % outline.length] as TerrainSemanticPoint;
                const dx = b[0] - a[0],
                  dz = b[1] - a[1],
                  length2 = dx * dx + dz * dz;
                const t = length2
                  ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2))
                  : 0;
                return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
              }),
            );
          if (edgeDistance > 0.5) continue;
          const hint = connections[x < 0 ? 0 : 1];
          if (hint) bankJoins.set(nodeKey(point), { ...hint, point, radius: 20 });
        }
      }
    }
    const input = entry.replaceRoads.includeConnectedApproaches
      ? transportation.flatMap((feature) =>
          feature.lines.map((line) =>
            feature.lines.length === 1 ? feature : { ...feature, lines: [line] },
          ),
        )
      : transportation;
    transportation = input.flatMap((feature) => {
      if (feature.tunnel) return [feature];
      const coveredApproach =
        !feature.bridge &&
        feature.lines.some((line) =>
          [0, line.length - 1].some((index) => {
            if (line.length < 2) return false;
            const point = line[index] as TerrainSemanticPoint;
            if (!coveredBridgeEnds.has(nodeKey(point))) return false;
            const p = localPoint(point),
              q = localPoint(line[index === 0 ? 1 : index - 1] as TerrainSemanticPoint);
            return (
              Math.abs(q[0]) > Math.abs(p[0]) && Math.abs(q[1] - p[1]) <= Math.abs(q[0] - p[0])
            );
          }),
        );
      if (!feature.bridge && !coveredApproach) {
        return feature.lines.map((line) => {
          if (line.length < 2) return { ...feature, lines: [line] };
          const hints = [];
          for (const index of [0, line.length - 1]) {
            const point = line[index] as TerrainSemanticPoint,
              next = line[index === 0 ? 1 : index - 1] as TerrainSemanticPoint;
            const hint = bankJoins.get(nodeKey(point));
            if (!hint) continue;
            const p = localPoint(point),
              q = localPoint(next);
            if (Math.abs(q[0]) <= Math.abs(p[0]) || Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]))
              continue;
            const length = line.slice(1).reduce((sum, p, i) => {
              const a = line[i] as TerrainSemanticPoint;
              return sum + Math.hypot(p[0] - a[0], p[1] - a[1]) * context.tileSize;
            }, 0);
            if (length > 0) hints.push({ ...hint, radius: Math.min(hint.radius, length) });
          }
          return hints.length
            ? {
                ...feature,
                lines: [line],
                bridgeConnections: [...(feature.bridgeConnections ?? []), ...hints],
              }
            : feature.lines.length === 1
              ? feature
              : { ...feature, lines: [line] };
        });
      }
      const lines: TerrainSemanticLine[] = [];
      let replaced = false;
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
          if (outline) {
            const cuts = polygonCuts(p, q, outline);
            for (let j = 1; j < cuts.length; j++) {
              const start = cuts[j - 1] as number,
                end = cuts[j] as number,
                mid = (start + end) / 2;
              if (coveredPoint([p[0] + (q[0] - p[0]) * mid, p[1] + (q[1] - p[1]) * mid], outline)) {
                replaced = true;
                if (current.length > 1) lines.push(current);
                current = [];
              } else {
                if (!current.length)
                  current.push([a[0] + (b[0] - a[0]) * start, a[1] + (b[1] - a[1]) * start]);
                current.push([a[0] + (b[0] - a[0]) * end, a[1] + (b[1] - a[1]) * end]);
              }
            }
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
          replaced = true;
          if (enter > 0) {
            if (!current.length) current.push(a);
            current.push(at(enter));
          }
          if (current.length > 1) lines.push(current);
          current = leave < 1 ? [at(leave), b] : [];
        }
        if (current.length > 1) lines.push(current);
      }
      if (!replaced) return [feature];
      return lines.length
        ? [
            {
              ...feature,
              lines,
              ...(connections.length
                ? {
                    bridgeConnections: [
                      ...(feature.bridgeConnections ?? []),
                      ...connections.map((connection) =>
                        feature.bridge ? connection : { ...connection, radius: 20 },
                      ),
                    ],
                  }
                : {}),
            },
          ]
        : [];
    });
  }
  return transportation === tile.transportation ? tile : { ...tile, transportation };
}
