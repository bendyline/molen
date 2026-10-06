/** Mapped underground corridors, portal cuts and height-aware navigation queries. */
import * as THREE from 'three';
import { setTerrainGroundCutout } from './ground-cutout';
import type { Heightfield } from './heightfield';
import { joinTerrainLines, sampleTerrainLine, terrainLinePath } from './line-path';
import { TerrainSurfaceMeshBuilder } from './linear-features';
import type { TerrainPyramidHeightSource, TerrainPyramidTileLayerContext } from './pyramid-stream';
import { type TerrainPyramidTileAddress, terrainPyramidTileKey } from './pyramid-types';
import type { TerrainSemanticTileRenderer, TerrainSemanticTileSource } from './semantic-client';
import { clipTerrainSemanticLine } from './semantic-overzoom';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
} from './semantic-types';
import { clipTerrainSurfacePolygon } from './terrain-drape';
import { transportKind, transportSurfaceLift, transportWidth } from './transport-features';

export interface TerrainTunnelClearance {
  floor: number;
  ceiling: number;
}
interface TunnelSegment extends TerrainTunnelClearance {
  a: TerrainSemanticPoint;
  b: TerrainSemanticPoint;
  endFloor: number;
  width: number;
}
const segments = new WeakMap<THREE.Object3D, TunnelSegment[]>();
const tileSizes = new WeakMap<THREE.Object3D, number>();
const objects = new Set<WeakRef<THREE.Object3D>>();
const material = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  side: THREE.DoubleSide,
});

/** Query a visible bore in `root`'s coordinate frame. Above-ground observers retain DEM support. */
export function sampleTerrainTunnel(
  root: THREE.Object3D,
  x: number,
  y: number,
  z: number,
): TerrainTunnelClearance | undefined {
  root.updateWorldMatrix(true, false);
  const worldPoint = new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld);
  let result: TerrainTunnelClearance | undefined;
  for (const ref of objects) {
    const object = ref.deref();
    if (!object) {
      objects.delete(ref);
      continue;
    }
    let visible = false;
    for (let p: THREE.Object3D | null = object; p; p = p.parent) {
      if (!p.visible) break;
      if (p === root) {
        visible = true;
        break;
      }
    }
    if (!visible) continue;
    object.updateWorldMatrix(true, false);
    const local = object.worldToLocal(worldPoint.clone());
    const tileSize = tileSizes.get(object) ?? Infinity;
    if (
      local.x < -1e-8 ||
      local.x > tileSize + 1e-8 ||
      local.z < -1e-8 ||
      local.z > tileSize + 1e-8
    )
      continue;
    for (const s of segments.get(object) ?? []) {
      const dx = s.b[0] - s.a[0],
        dz = s.b[1] - s.a[1];
      const t = ((local.x - s.a[0]) * dx + (local.z - s.a[1]) * dz) / (dx * dx + dz * dz);
      if (t < 0 || t > 1) continue;
      const distance = Math.hypot(local.x - s.a[0] - dx * t, local.z - s.a[1] - dz * t);
      const floor = s.floor + (s.endFloor - s.floor) * t;
      const ceiling = floor + s.ceiling - s.floor;
      if (distance > s.width / 2 || local.y < floor - 1 || local.y > ceiling) continue;
      // Tile objects only translate; report heights in the root frame, including rebasing.
      const toRoot = new THREE.Matrix4()
        .copy(root.matrixWorld)
        .invert()
        .multiply(object.matrixWorld);
      const floorY = new THREE.Vector3(local.x, floor, local.z).applyMatrix4(toRoot).y;
      const ceilingY = new THREE.Vector3(local.x, ceiling, local.z).applyMatrix4(toRoot).y;
      if (!result || floorY < result.floor) result = { floor: floorY, ceiling: ceilingY };
    }
  }
  return result;
}

/** Create open-ended bores. Full route endpoints and their ground heights must be available.
 * `groundAt` uses tile-local metres and may sample neighboring heightfields for complete routes.
 * The inference is a straight grade between portal ground heights, not surveyed engineering. */
export function createTerrainTunnelObject(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  groundAt: (x: number, z: number) => number | undefined = (x, z) =>
    context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z),
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'terrain:tunnels';
  const builder = new TerrainSurfaceMeshBuilder(context);
  const records: TunnelSegment[] = [];
  const concrete = new THREE.Color('#8b8e88'),
    asphalt = new THREE.Color('#3d4448');
  for (const feature of tile.transportation) {
    if (!feature.tunnel) continue;
    const kind = transportKind(feature);
    const width = transportWidth(feature, kind);
    const height = feature.tunnelClearance ?? (kind === 'path' ? 3.5 : kind === 'rail' ? 6 : 6.5);
    for (const line of feature.lines) {
      const path = terrainLinePath(line, context.tileSize);
      if (!path.length) continue;
      const a = path.points[0] as TerrainSemanticPoint,
        b = path.points.at(-1) as TerrainSemanticPoint;
      const startGround = groundAt(...a),
        endGround = groundAt(...b);
      if (
        feature.tunnelFloorElevation === undefined &&
        (startGround === undefined || endGround === undefined)
      )
        continue;
      const startY =
        feature.tunnelFloorElevation ?? (startGround as number) + transportSurfaceLift(kind);
      const endY =
        feature.tunnelFloorElevation ?? (endGround as number) + transportSurfaceLift(kind);
      const floorAt = (d: number): number => startY + ((endY - startY) * d) / path.length;
      for (let i = 1; i < path.distances.length; i++) {
        const end = path.distances[i] as number;
        for (let d = path.distances[i - 1] as number; d < end; d += 6) {
          const next = Math.min(end, d + 6);
          const left0 = sampleTerrainLine(path, d, -width / 2),
            right0 = sampleTerrainLine(path, d, width / 2);
          const left1 = sampleTerrainLine(path, next, -width / 2),
            right1 = sampleTerrainLine(path, next, width / 2);
          if (
            Math.max(left0.x, right0.x, left1.x, right1.x) < 0 ||
            Math.min(left0.x, right0.x, left1.x, right1.x) > context.tileSize ||
            Math.max(left0.z, right0.z, left1.z, right1.z) < 0 ||
            Math.min(left0.z, right0.z, left1.z, right1.z) > context.tileSize
          )
            continue;
          const y0 = floorAt(d),
            y1 = floorAt(next);
          const l0: [number, number, number] = [left0.x, y0, left0.z],
            r0: [number, number, number] = [right0.x, y0, right0.z];
          const l1: [number, number, number] = [left1.x, y1, left1.z],
            r1: [number, number, number] = [right1.x, y1, right1.z];
          const top = (p: [number, number, number]): [number, number, number] => [
            p[0],
            p[1] + height,
            p[2],
          ];
          // Face normals point into the bore: collision raycasts cull back faces,
          // and capsule contacts must push walkers away from walls and onto the floor.
          builder.face([l0, r0, r1, l1], asphalt);
          builder.face([l0, l1, top(l1), top(l0)], concrete);
          builder.face([r0, top(r0), top(r1), r1], concrete);
          builder.face([top(l0), top(l1), top(r1), top(r0)], concrete);
          // The roof retains ground above it. Only portal/cut-and-cover terrain below it opens.
          const cutter = new THREE.Object3D();
          const outline = clipTerrainSurfacePolygon(
            [
              [l0[0], l0[2]],
              [l1[0], l1[2]],
              [r1[0], r1[2]],
              [r0[0], r0[2]],
            ],
            context.tileSize,
          );
          if (outline.length >= 3) {
            setTerrainGroundCutout(cutter, outline, Math.min(y0, y1) + height);
            group.add(cutter);
          }
          const p0 = sampleTerrainLine(path, d),
            p1 = sampleTerrainLine(path, next);
          records.push({
            a: [p0.x, p0.z],
            b: [p1.x, p1.z],
            floor: y0,
            endFloor: y1,
            ceiling: y0 + height,
            width,
          });
        }
      }
    }
  }
  const mesh = builder.mesh('semantic:tunnels', material, false);
  if (mesh) {
    // Tunnel linings are solid, but never ground overlays that their own portal cuts can remove.
    mesh.userData.terrainTunnelSurface = true;
    group.add(mesh);
    segments.set(group, records);
    tileSizes.set(group, context.tileSize);
    objects.add(new WeakRef(group));
  }
  return group;
}

/** Join clipped vector fragments before inferring a grade, so tile edges cannot become portals.
 * Only completed, unbranched routes are inferred. Bounded searches omit unresolved long routes. */
export function withTerrainTunnels(
  renderer: TerrainSemanticTileRenderer,
  source: TerrainSemanticTileSource,
  heights: TerrainPyramidHeightSource,
  minLevel: number,
): TerrainSemanticTileRenderer {
  const owned = new WeakMap<THREE.Object3D, THREE.Object3D>();
  return {
    async createTile(tile, context) {
      if (context.address.level < minLevel || !tile.transportation.some((f) => f.tunnel))
        return renderer.createTile(tile, context);
      const routes = await completeRoutes(tile, context, source);
      const fields = new Map<string, Heightfield>();
      fields.set(terrainPyramidTileKey(context.address), context.heightfield);
      const addresses = new Map<string, TerrainPyramidTileAddress>();
      for (const f of routes.transportation)
        for (const line of f.lines)
          for (const p of [line[0], line.at(-1)] as TerrainSemanticPoint[]) {
            const address = {
              level: context.address.level,
              x: context.address.x + Math.floor(p[0]),
              z: context.address.z + Math.floor(p[1]),
            };
            addresses.set(terrainPyramidTileKey(address), address);
          }
      await Promise.all(
        [...addresses].map(async ([key, address]) => {
          if (fields.has(key)) return;
          const field = await heights.load(address, context.signal);
          if (field) fields.set(key, field);
        }),
      );
      context.signal.throwIfAborted();
      const tunnels = createTerrainTunnelObject(routes, context, (x, z) => {
        const address = {
          level: context.address.level,
          x: context.address.x + Math.floor(x / context.tileSize),
          z: context.address.z + Math.floor(z / context.tileSize),
        };
        return fields
          .get(terrainPyramidTileKey(address))
          ?.sampleHeight(context.origin[0] + x, context.origin[1] + z);
      });
      try {
        const inner = await renderer.createTile(tile, context);
        const group = new THREE.Group();
        if (inner) {
          group.add(inner);
          owned.set(group, inner);
        }
        group.add(tunnels);
        return group;
      } catch (error) {
        tunnels.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        throw error;
      }
    },
    disposeTile(object) {
      if (object.getObjectByName('terrain:tunnels')) object.visible = false;
      const inner = owned.get(object);
      if (inner) {
        inner.removeFromParent();
        renderer.disposeTile?.(inner);
      } else if (!object.getObjectByName('terrain:tunnels')) {
        renderer.disposeTile?.(object);
        return;
      }
      object.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}

async function completeRoutes(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  source: TerrainSemanticTileSource,
): Promise<TerrainSemanticTile> {
  const loaded = new Map<
    string,
    { address: TerrainPyramidTileAddress; tile: TerrainSemanticTile }
  >();
  const pending = [{ address: context.address, tile }];
  const requested = new Set([terrainPyramidTileKey(context.address)]);
  const count = 2 ** context.address.level;
  while (pending.length && loaded.size < 16) {
    const current = pending.shift();
    if (!current) break;
    loaded.set(terrainPyramidTileKey(current.address), current);
    const neighbors = new Map<string, TerrainPyramidTileAddress>();
    for (const feature of current.tile.transportation)
      if (feature.tunnel)
        for (const line of feature.lines) {
          for (const p of line)
            for (const [dx, dz] of [
              [p[0] <= 0 ? -1 : p[0] >= 1 ? 1 : 0, 0],
              [0, p[1] <= 0 ? -1 : p[1] >= 1 ? 1 : 0],
            ]) {
              if (!dx && !dz) continue;
              const address = {
                level: current.address.level,
                x: current.address.x + (dx ?? 0),
                z: current.address.z + (dz ?? 0),
              };
              const key = terrainPyramidTileKey(address);
              if (
                address.x < 0 ||
                address.z < 0 ||
                address.x >= count ||
                address.z >= count ||
                requested.has(key) ||
                requested.size >= 16
              )
                continue;
              requested.add(key);
              neighbors.set(key, address);
            }
        }
    const more = await Promise.all(
      [...neighbors.values()].map(async (address) => ({
        address,
        tile: await source.load(address, context.signal),
      })),
    );
    for (const entry of more)
      if (entry.tile) pending.push({ address: entry.address, tile: entry.tile });
  }
  const groups = new Map<
    string,
    {
      feature: TerrainTransportationFeature;
      lines: TerrainSemanticLine[];
      endpoints: TerrainSemanticPoint[];
    }
  >();
  for (const { address, tile: part } of loaded.values())
    for (const f of part.transportation) {
      if (!f.tunnel) continue;
      const key = JSON.stringify([
        transportKind(f),
        f.layer ?? 0,
        f.tunnelFloorElevation,
        f.tunnelClearance,
      ]);
      let group = groups.get(key);
      if (!group) {
        group = { feature: f, lines: [], endpoints: [] };
        groups.set(key, group);
      }
      const map = (p: TerrainSemanticPoint): TerrainSemanticPoint => [
        p[0] + address.x - context.address.x,
        p[1] + address.z - context.address.z,
      ];
      for (const line of f.lines) {
        for (const p of [line[0], line.at(-1)] as TerrainSemanticPoint[])
          if (p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1) group.endpoints.push(map(p));
        group.lines.push(...clipTerrainSemanticLine(line, [0, 0, 1, 1]).map((l) => l.map(map)));
      }
    }
  const result = createEmptyTerrainSemanticTile();
  for (const { feature, lines, endpoints } of groups.values()) {
    // Adjacent MVT tiles independently quantize their buffered geometry. Snap seam endpoints
    // within one source pixel, preserving distinct parallel bores and the authored interior bends.
    const ends: TerrainSemanticPoint[] = [];
    const tolerance = 1 / 4096;
    for (const line of lines)
      for (const index of [0, line.length - 1]) {
        const p = line[index] as TerrainSemanticPoint;
        const match = ends.find((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tolerance);
        if (match) line[index] = match;
        else ends.push(p);
      }
    const complete = joinTerrainLines(lines).filter((line) => {
      const realEnd = (p: TerrainSemanticPoint) =>
        endpoints.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tolerance) &&
        lines.reduce((n, l) => n + Number(l[0] === p) + Number(l.at(-1) === p), 0) === 1;
      const intersects = clipTerrainSemanticLine(line, [0, 0, 1, 1]).length > 0;
      return (
        intersects &&
        realEnd(line[0] as TerrainSemanticPoint) &&
        realEnd(line.at(-1) as TerrainSemanticPoint)
      );
    });
    if (complete.length) result.transportation.push({ ...feature, lines: complete });
  }
  return result;
}
