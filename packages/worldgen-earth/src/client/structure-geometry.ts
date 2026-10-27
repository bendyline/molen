import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  pointInPolygon,
  pointInRing,
  polygonBounds,
  transportKind,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import polygonClipping from 'polygon-clipping';
import * as THREE from 'three';
import type { StructurePlacement } from '../kernel/structure-index';
import { gradeStructureApproaches } from './structure-approaches';

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

/** Ground openings follow only the resident piece of an extended model. */
export function clipStructureGroundOutlines(
  outlines: readonly (readonly [number, number][])[],
  matrix: THREE.Matrix4,
  size: number,
): [number, number][][] {
  const tile: [number, number][] = [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ];
  return outlines.flatMap((outline) => {
    const points: [number, number][] = outline.map(([x, z]) => {
      const p = new THREE.Vector3(x, 0, z).applyMatrix4(matrix);
      return [p.x, p.z];
    });
    return polygonClipping.intersection([points], [tile]).flatMap((polygon) => {
      const ring = (polygon[0] ?? []).slice(0, -1);
      if (ring.length < 3) return [];
      if (ring.length <= 512) return [ring];
      // Clipping can add boundary vertices to a ring already at the registration limit.
      return THREE.ShapeUtils.triangulateShape(
        ring.map((p) => new THREE.Vector2(...p)),
        [],
      ).map((triangle) => triangle.map((i) => ring[i] as [number, number]));
    });
  });
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
    const deckProfile = entry.replaceRoads.deckProfile?.map(
      ([x, y, z]): [number, number, number] => [
        x * (entry.scale?.[0] ?? 1),
        y * (entry.scale?.[1] ?? 1),
        z * (entry.scale?.[2] ?? 1),
      ],
    );
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
        : centerlineEnds.map((endX, index) => {
            const explicit = entry.replaceRoads?.deckEndpoints?.[index];
            const x = explicit ? explicit[0] * (entry.scale?.[0] ?? 1) : endX;
            const z = explicit ? explicit[1] * (entry.scale?.[2] ?? 1) : 0;
            return {
              point: [
                (cx + c * x + s * z - context.origin[0]) / context.tileSize,
                (cz - s * x + c * z - context.origin[1]) / context.tileSize,
              ] as TerrainSemanticPoint,
              elevation:
                (placedHeight ??
                  (entry.datum === 'sea-level' ? 0 : context.heightfield.sampleHeight(cx, cz)) +
                    (entry.elevation ?? 0)) +
                (deckHeights[index] as number) * (entry.scale?.[1] ?? 1),
              radius: 100,
            };
          });
    const localPoint = ([u, v]: TerrainSemanticPoint): TerrainSemanticPoint => {
      const x = context.origin[0] + u * context.tileSize - cx,
        z = context.origin[1] + v * context.tileSize - cz;
      return [c * x - s * z, s * x + c * z];
    };
    const nodeKey = ([u, v]: TerrainSemanticPoint) =>
      `${Math.round((context.origin[0] + u * context.tileSize) * 10)}/${Math.round((context.origin[1] + v * context.tileSize) * 10)}`;
    const bankJoins = new Map<string, (typeof connections)[number]>();
    const coveredBridgeRoadEnds = new Set<string>();
    const roadNode = (point: TerrainSemanticPoint, kind: string, layer = 0) =>
      `${nodeKey(point)}/${kind}/${layer}`;
    const coveredBridgeEnds = new Set<string>();
    const coveredBridgePathEnds = new Set<string>();
    const pathEndPoints: { point: TerrainSemanticPoint; layer: number }[] = [];
    const pathNode = (point: TerrainSemanticPoint, layer = 0) => `${nodeKey(point)}/${layer}`;
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
          ) {
            coveredBridgeEnds.add(roadNode(point, transportKind(feature), feature.layer));
            if (
              transportKind(feature) === 'path' &&
              connections.some(
                (hint) =>
                  Math.abs(localPoint(hint.point)[0] - x) <= 4.01 &&
                  Math.hypot(point[0] - hint.point[0], point[1] - hint.point[1]) *
                    context.tileSize <=
                    hz + 4,
              )
            ) {
              coveredBridgePathEnds.add(pathNode(point, feature.layer));
              pathEndPoints.push({ point, layer: feature.layer ?? 0 });
            }
          }
          if (!connections.length) continue;
          const end = entry.replaceRoads.deckEndpoints?.[x < 0 ? 0 : 1];
          if (end) {
            if (
              Math.hypot(
                x - end[0] * (entry.scale?.[0] ?? 1),
                z - end[1] * (entry.scale?.[2] ?? 1),
              ) >
              hz + 1
            )
              continue;
          } else if (Math.abs(Math.abs(x) - hx) > hz + 1 || Math.abs(z) > hz) continue;
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
          if (hint) {
            bankJoins.set(roadNode(point, transportKind(feature), feature.layer), {
              ...hint,
              point,
              radius: 20,
            });
            if (transportKind(feature) !== 'path')
              coveredBridgeRoadEnds.add(roadNode(point, transportKind(feature), feature.layer));
          }
        }
      }
    }
    // Generalized tiles may omit a T-junction vertex where a bridge walk meets the
    // interior of a bank walk. Restore only that authored end, within 10cm and on
    // the same layer. Keep the source tile immutable and retain every other vertex.
    if (pathEndPoints.length) {
      transportation = transportation.flatMap((feature) => {
        if (
          feature.bridge ||
          feature.tunnel ||
          transportKind(feature) !== 'path' ||
          /steps/.test(`${feature.class} ${feature.subclass ?? ''}`)
        )
          return [feature];
        const lines: TerrainSemanticLine[] = [];
        let changed = false;
        for (const line of feature.lines) {
          let current: TerrainSemanticLine = line.length ? [line[0] as TerrainSemanticPoint] : [];
          for (let i = 1; i < line.length; i++) {
            const a = line[i - 1] as TerrainSemanticPoint,
              b = line[i] as TerrainSemanticPoint;
            const dx = b[0] - a[0],
              dz = b[1] - a[1],
              length2 = dx * dx + dz * dz;
            const cuts = pathEndPoints
              .flatMap((end) => {
                if (end.layer !== (feature.layer ?? 0) || !length2) return [];
                const t = ((end.point[0] - a[0]) * dx + (end.point[1] - a[1]) * dz) / length2;
                return t > 0.0001 &&
                  t < 0.9999 &&
                  Math.hypot(end.point[0] - a[0] - t * dx, end.point[1] - a[1] - t * dz) *
                    context.tileSize <=
                    0.1
                  ? [{ t, point: end.point }]
                  : [];
              })
              .sort((a, b) => a.t - b.t);
            for (const cut of cuts) {
              if (nodeKey(current.at(-1) as TerrainSemanticPoint) === nodeKey(cut.point)) continue;
              current.push(cut.point);
              lines.push(current);
              current = [cut.point];
              changed = true;
            }
            current.push(b);
            if (i < line.length - 1 && coveredBridgePathEnds.has(pathNode(b, feature.layer))) {
              lines.push(current);
              current = [b];
              changed = true;
            }
          }
          if (current.length > 1) lines.push(current);
        }
        return changed ? lines.map((line) => ({ ...feature, lines: [line] })) : [feature];
      });
      // A short covered crossing can link a bridge walk to its bank sidewalk. Relay
      // ownership through that covered geometry, never through a remote path or stair.
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const feature of transportation) {
          if (
            feature.bridge ||
            feature.tunnel ||
            transportKind(feature) !== 'path' ||
            /steps/.test(`${feature.class} ${feature.subclass ?? ''}`)
          )
            continue;
          for (const line of feature.lines) {
            if (
              line.length < 2 ||
              !line.every((point) => {
                const [x, z] = localPoint(point);
                return outline
                  ? coveredPoint([x, z], outline)
                  : Math.abs(x) <= hx && Math.abs(z) <= hz;
              })
            )
              continue;
            const ends = [line[0], line.at(-1)] as TerrainSemanticPoint[];
            if (!ends.some((p) => coveredBridgePathEnds.has(pathNode(p, feature.layer)))) continue;
            for (const p of ends) {
              const key = pathNode(p, feature.layer);
              if (!coveredBridgePathEnds.has(key)) {
                coveredBridgePathEnds.add(key);
                expanded = true;
              }
            }
          }
        }
      }
    }
    // A carriageway may be a long loop whose bridge junction is an existing interior
    // vertex. Expose that shared node to the same landing/grade logic used for road
    // endpoints. Never infer a junction from a nearby line or cross another layer.
    if (entry.replaceRoads.includeConnectedApproaches && coveredBridgeRoadEnds.size) {
      transportation = transportation.flatMap((feature) => {
        const kind = transportKind(feature);
        if (feature.bridge || feature.tunnel || kind === 'path') return [feature];
        const lines: TerrainSemanticLine[] = [];
        let changed = false;
        for (const line of feature.lines) {
          let current: TerrainSemanticLine = line.length ? [line[0] as TerrainSemanticPoint] : [];
          for (let i = 1; i < line.length; i++) {
            const point = line[i] as TerrainSemanticPoint;
            current.push(point);
            if (
              i === line.length - 1 ||
              !coveredBridgeRoadEnds.has(roadNode(point, kind, feature.layer))
            )
              continue;
            const p = localPoint(point);
            const outward = [line[i - 1], line[i + 1]].some((neighbor) => {
              if (!neighbor) return false;
              const q = localPoint(neighbor);
              return (
                Math.abs(q[0]) > Math.abs(p[0]) && Math.abs(q[1] - p[1]) <= Math.abs(q[0] - p[0])
              );
            });
            if (!outward) continue;
            lines.push(current);
            current = [point];
            changed = true;
          }
          if (current.length > 1) lines.push(current);
        }
        return changed ? lines.map((line) => ({ ...feature, lines: [line] })) : [feature];
      });
    }
    const input = entry.replaceRoads.includeConnectedApproaches
      ? transportation.flatMap((feature) =>
          feature.lines.map((line) =>
            feature.lines.length === 1 ? feature : { ...feature, lines: [line] },
          ),
        )
      : transportation;
    const clippedBridges: typeof transportation = [];
    transportation = input.flatMap((feature) => {
      if (feature.tunnel) return [feature];
      if (!feature.bridge && /steps/.test(`${feature.class} ${feature.subclass ?? ''}`))
        return [feature];
      // A bridge sidewalk can turn along its bank immediately at the landing. Only a
      // shared endpoint of a covered bridge path authorizes that turn; nearby quay
      // walks, steps, road crossings and other layers are not proximity matches.
      const coveredFootway =
        !feature.bridge &&
        transportKind(feature) === 'path' &&
        !/steps/.test(`${feature.class} ${feature.subclass ?? ''}`) &&
        feature.lines.some((line) =>
          [line[0], line.at(-1)].some(
            (point) => point && coveredBridgePathEnds.has(pathNode(point, feature.layer)),
          ),
        );
      const coveredApproach =
        coveredFootway ||
        (!feature.bridge &&
          feature.lines.some((line) =>
            [0, line.length - 1].some((index) => {
              if (line.length < 2) return false;
              const point = line[index] as TerrainSemanticPoint;
              if (!coveredBridgeEnds.has(roadNode(point, transportKind(feature), feature.layer)))
                return false;
              const p = localPoint(point),
                q = localPoint(line[index === 0 ? 1 : index - 1] as TerrainSemanticPoint);
              return (
                Math.abs(q[0]) > Math.abs(p[0]) && Math.abs(q[1] - p[1]) <= Math.abs(q[0] - p[0])
              );
            }),
          ));
      const withBankJoins = () =>
        feature.lines.map((line) => {
          if (line.length < 2) return { ...feature, lines: [line] };
          const hints = [];
          for (const index of [0, line.length - 1]) {
            const point = line[index] as TerrainSemanticPoint,
              next = line[index === 0 ? 1 : index - 1] as TerrainSemanticPoint;
            const hint = bankJoins.get(roadNode(point, transportKind(feature), feature.layer));
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
      if (!feature.bridge && !coveredApproach) return withBankJoins();
      const lines: TerrainSemanticLine[] = [];
      let replaced = false;
      for (const line of feature.lines) {
        const roadOutline = outline ?? [
          [-hx, -hz],
          [hx, -hz],
          [hx, hz],
          [-hx, hz],
        ];
        const ownsLine = line.slice(1).some((b, i) => {
          const p = localPoint(line[i] as TerrainSemanticPoint),
            q = localPoint(b);
          if (!coveredFootway && Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0])) return false;
          const cuts = polygonCuts(p, q, roadOutline);
          return cuts.slice(1).some((end, j) => {
            const t = ((cuts[j] as number) + end) / 2;
            return coveredPoint([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], roadOutline);
          });
        });
        const ownsTransverse =
          feature.bridge &&
          entry.replaceRoads?.includeTransverseBridges &&
          [line[0], line.at(-1)].some(
            (point) => point && coveredPoint(localPoint(point), roadOutline),
          );
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
          if (!ownsLine && !ownsTransverse && Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0])) {
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
      if (!replaced) return feature.bridge ? [feature] : withBankJoins();
      if (!lines.length) return [];
      let clippedConnections = connections;
      // A selected ground approach can start just inside the mapped bridge outline.
      // Its clipped lane/footway endpoint needs the same exact join as a bridge tail.
      if (deckProfile && outline) {
        clippedConnections = lines
          .flatMap((line) => [line[0], line.at(-1)] as TerrainSemanticPoint[])
          .flatMap((point) => {
            const [x, z] = localPoint(point);
            const boundaryDistance = Math.min(
              ...outline.map((a, i) => {
                const b = outline[(i + 1) % outline.length] as TerrainSemanticPoint,
                  dx = b[0] - a[0],
                  dz = b[1] - a[1],
                  length2 = dx * dx + dz * dz;
                const t = length2
                  ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2))
                  : 0;
                return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
              }),
            );
            if (boundaryDistance > 0.05) return [];
            let best = Infinity,
              height = 0;
            for (let i = 1; i < deckProfile.length; i++) {
              const a = deckProfile[i - 1] as [number, number, number],
                b = deckProfile[i] as [number, number, number];
              const dx = b[0] - a[0],
                dz = b[2] - a[2],
                length2 = dx * dx + dz * dz;
              const t = length2
                ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / length2))
                : 0;
              const distance = Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz);
              if (distance < best) {
                best = distance;
                height = a[1] + t * (b[1] - a[1]);
              }
            }
            return [
              {
                point,
                elevation:
                  (placedHeight ??
                    (entry.datum === 'sea-level' ? 0 : context.heightfield.sampleHeight(cx, cz)) +
                      (entry.elevation ?? 0)) + height,
                radius: 100,
              },
            ];
          });
      }
      const clipped = {
        ...feature,
        lines,
        ...(clippedConnections.length
          ? {
              bridgeConnections: [
                ...(feature.bridgeConnections ?? []),
                ...clippedConnections.map((connection) =>
                  feature.bridge ? connection : { ...connection, radius: 20 },
                ),
              ],
            }
          : {}),
      };
      if (feature.bridge) clippedBridges.push(clipped);
      return [clipped];
    });
    if (!entry.replaceRoads.includeConnectedApproaches || !connections.length) continue;
    // A mapped bridge can include a short bent tail beyond the authored bearings.
    // Carry its bank height through that tail before blending into the shared grade road.
    const joins = new Map<string, (typeof connections)[number]>();
    const lineLength = (line: TerrainSemanticLine) =>
      line.slice(1).reduce((sum, p, i) => {
        const a = line[i] as TerrainSemanticPoint;
        return sum + Math.hypot(p[0] - a[0], p[1] - a[1]) * context.tileSize;
      }, 0);
    const inside = (point: TerrainSemanticPoint, margin = 0) => {
      const [x, z] = localPoint(point);
      return outline
        ? coveredPoint([x, z], outline)
        : Math.abs(x) <= hx + margin && Math.abs(z) <= hz + margin;
    };
    for (const feature of clippedBridges)
      for (const line of feature.lines) {
        if (lineLength(line) > 32 || !line.some((point) => inside(point, 0.05))) continue;
        for (const point of [line[0], line.at(-1)] as TerrainSemanticPoint[]) {
          if (inside(point, 0.05)) continue;
          const candidates = deckProfile ? (feature.bridgeConnections ?? []) : connections;
          if (!candidates.length) continue;
          const hint = candidates.reduce((best, item) =>
            Math.hypot(point[0] - item.point[0], point[1] - item.point[1]) <
            Math.hypot(point[0] - best.point[0], point[1] - best.point[1])
              ? item
              : best,
          );
          if (
            Math.hypot(point[0] - hint.point[0], point[1] - hint.point[1]) * context.tileSize >
            32
          )
            continue;
          const ground = context.heightfield.sampleHeight(
            context.origin[0] + point[0] * context.tileSize,
            context.origin[1] + point[1] * context.tileSize,
          );
          joins.set(nodeKey(point), {
            ...hint,
            point,
            radius: Math.min(200, Math.max(20, Math.abs(hint.elevation - ground) * 12.5)),
          });
        }
      }
    // Covered gateways are often short tunnel ways between a bridge and its street.
    // Leave that way untouched, transferring only the height at its far shared node.
    const bridgeJoins = new Map(joins);
    for (const feature of transportation.filter((feature) => feature.tunnel))
      for (const line of feature.lines) {
        if (line.length < 2) continue;
        const length = lineLength(line);
        if (length > 8) continue;
        const ends = [line[0], line.at(-1)] as TerrainSemanticPoint[];
        for (const [i, point] of ends.entries()) {
          const hint = bridgeJoins.get(nodeKey(point));
          if (hint && !joins.has(nodeKey(ends[1 - i] as TerrainSemanticPoint)))
            joins.set(nodeKey(ends[1 - i] as TerrainSemanticPoint), {
              ...hint,
              point: ends[1 - i] as TerrainSemanticPoint,
            });
        }
      }
    if (!joins.size) continue;
    transportation = transportation.map((feature) => {
      if (feature.tunnel || (feature.bridge && !clippedBridges.includes(feature))) return feature;
      const hints = [];
      for (const line of feature.lines) {
        if (line.length < 2) continue;
        const length = lineLength(line);
        for (const index of [0, line.length - 1]) {
          const point = line[index] as TerrainSemanticPoint,
            hint = joins.get(nodeKey(point));
          if (!hint) continue;
          if (!feature.bridge) {
            const p = localPoint(point),
              q = localPoint(line[index === 0 ? 1 : index - 1] as TerrainSemanticPoint);
            if (Math.abs(q[0]) <= Math.abs(p[0]) || Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]))
              continue;
          }
          hints.push({ ...hint, radius: feature.bridge ? 100 : Math.min(hint.radius, length) });
        }
      }
      return hints.length
        ? { ...feature, bridgeConnections: [...(feature.bridgeConnections ?? []), ...hints] }
        : feature;
    });
  }
  const result = transportation === tile.transportation ? tile : { ...tile, transportation };
  return structures.some((entry) => entry.replaceRoads?.includeConnectedApproaches)
    ? gradeStructureApproaches(result, context)
    : result;
}

/**
 * Where a placed model stands, in world X/Z: its triangles' X/Z bounds stamped on a coarse grid
 * over the model. A stadium bowl or a tower on legs covers far less ground than its bounding
 * box, and a model near a tile edge covers its neighbours' ground too.
 */
export interface StructureFootprint {
  readonly minX: number;
  readonly minZ: number;
  readonly cell: number;
  readonly size: number;
  readonly cells: Uint8Array;
}

const FOOTPRINT_GRID = 64;
// Enough triangles to cover a 64-cell grid; denser resident levels are sampled at a stride.
const FOOTPRINT_TRIANGLES = 50_000;

/**
 * `object`'s ground coverage, or undefined when it holds no geometry. `frame` holds tile-local
 * meters (a tile's structure group) whose origin is the world X/Z `origin`.
 */
export function structureFootprint(
  object: THREE.Object3D,
  frame: THREE.Object3D,
  origin: readonly [number, number],
): StructureFootprint | undefined {
  frame.updateWorldMatrix(true, false);
  object.updateWorldMatrix(true, true);
  const toFrame = frame.matrixWorld.clone().invert();
  const meshes: Array<{ geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }> = [];
  const bounds = new THREE.Box3();
  object.traverse((part) => {
    const mesh = part as THREE.Mesh;
    if (!mesh.isMesh || mesh.geometry.getAttribute('position') === undefined) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(toFrame, mesh.matrixWorld);
    if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
    bounds.union((mesh.geometry.boundingBox as THREE.Box3).clone().applyMatrix4(matrix));
    meshes.push({ geometry: mesh.geometry, matrix });
  });
  if (meshes.length === 0 || bounds.isEmpty()) return undefined;
  const cell =
    Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, 1) / FOOTPRINT_GRID;
  const footprint = {
    minX: bounds.min.x + origin[0],
    minZ: bounds.min.z + origin[1],
    cell,
    size: FOOTPRINT_GRID,
    cells: new Uint8Array(FOOTPRINT_GRID * FOOTPRINT_GRID),
  };
  const column = (value: number, min: number): number =>
    Math.max(0, Math.min(FOOTPRINT_GRID - 1, Math.floor((value - min) / cell)));
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const;
  // Reuse the separating-axis workspace across triangles. Most triangles project onto cells
  // already claimed by earlier faces, so prepare axes only when an empty cell needs testing.
  const axes = new Float64Array(18);
  for (const { geometry, matrix } of meshes) {
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    const triangles = Math.floor((index?.count ?? position.count) / 3);
    const stride = Math.max(1, Math.ceil(triangles / FOOTPRINT_TRIANGLES));
    for (let t = 0; t < triangles; t += stride) {
      corners.forEach((corner, k) => {
        corner.fromBufferAttribute(position, index?.getX(t * 3 + k) ?? t * 3 + k);
        corner.applyMatrix4(matrix);
      });
      const [a, b, c] = corners;
      // Test projected triangles against each cell, rather than painting their entire AABBs.
      // Long roofs and rotated walls otherwise claim empty ground beside the landmark.
      // Separating axes also retain vertical faces, whose ground projection is a line.
      let axisCount = -1;
      const x1 = column(Math.max(a.x, b.x, c.x), bounds.min.x);
      const z1 = column(Math.max(a.z, b.z, c.z), bounds.min.z);
      for (let z = column(Math.min(a.z, b.z, c.z), bounds.min.z); z <= z1; z++)
        for (let x = column(Math.min(a.x, b.x, c.x), bounds.min.x); x <= x1; x++) {
          const index = z * FOOTPRINT_GRID + x;
          if (footprint.cells[index]) continue;
          if (axisCount === -1) {
            axisCount = 0;
            for (let i = 0; i < 3; i++) {
              const p = corners[i] as THREE.Vector3,
                q = corners[(i + 1) % 3] as THREE.Vector3,
                nx = p.z - q.z,
                nz = q.x - p.x;
              if (Math.abs(nx) + Math.abs(nz) < 1e-10) continue;
              const pa = a.x * nx + a.z * nz,
                pb = b.x * nx + b.z * nz,
                pc = c.x * nx + c.z * nz,
                radius = ((Math.abs(nx) + Math.abs(nz)) * cell) / 2,
                k = axisCount++ * 6;
              axes[k] = nx;
              axes[k + 1] = nz;
              axes[k + 2] = Math.min(pa, pb, pc);
              axes[k + 3] = Math.max(pa, pb, pc);
              axes[k + 4] = radius;
              axes[k + 5] = radius * 2e-7;
            }
          }
          const cx = bounds.min.x + (x + 0.5) * cell,
            cz = bounds.min.z + (z + 0.5) * cell;
          let covered = true;
          for (let i = 0; i < axisCount; i++) {
            const k = i * 6,
              center = cx * (axes[k] as number) + cz * (axes[k + 1] as number),
              radius = axes[k + 4] as number,
              epsilon = axes[k + 5] as number;
            if (
              center + radius < (axes[k + 2] as number) - epsilon ||
              center - radius > (axes[k + 3] as number) + epsilon
            ) {
              covered = false;
              break;
            }
          }
          if (covered) footprint.cells[index] = 1;
        }
    }
  }
  return footprint;
}

/** Whether `footprint` reaches into the tile at `context`. */
export function footprintOverlapsTile(
  footprint: StructureFootprint,
  context: Pick<TerrainPyramidTileLayerContext, 'origin' | 'tileSize'>,
): boolean {
  const extent = footprint.cell * footprint.size;
  return (
    footprint.minX < context.origin[0] + context.tileSize &&
    footprint.minX + extent > context.origin[0] &&
    footprint.minZ < context.origin[1] + context.tileSize &&
    footprint.minZ + extent > context.origin[1]
  );
}

/**
 * Whether at least half of `polygon` (normalized to the tile at `context`, like every semantic
 * polygon) lies on `footprint`, sampled on an 8 by 8 grid over the polygon's bounds.
 */
export function footprintCovers(
  footprint: StructureFootprint,
  polygon: TerrainSemanticPolygon,
  context: Pick<TerrainPyramidTileLayerContext, 'origin' | 'tileSize'>,
): boolean {
  const occupied = (u: number, v: number): boolean => {
    const x = Math.floor(
      (context.origin[0] + u * context.tileSize - footprint.minX) / footprint.cell,
    );
    const z = Math.floor(
      (context.origin[1] + v * context.tileSize - footprint.minZ) / footprint.cell,
    );
    return (
      x >= 0 &&
      z >= 0 &&
      x < footprint.size &&
      z < footprint.size &&
      footprint.cells[z * footprint.size + x] === 1
    );
  };
  const [minU, minV, maxU, maxV] = polygonBounds(polygon);
  let inside = 0;
  let hits = 0;
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const point: TerrainSemanticPoint = [
        minU + ((maxU - minU) * (i + 0.5)) / 8,
        minV + ((maxV - minV) * (j + 0.5)) / 8,
      ];
      if (!pointInPolygon(point, polygon)) continue;
      inside++;
      if (occupied(point[0], point[1])) hits++;
    }
  // A sliver no sample lands in is judged by its centre.
  if (inside === 0) return occupied((minU + maxU) / 2, (minV + maxV) / 2);
  return hits * 2 >= inside;
}
