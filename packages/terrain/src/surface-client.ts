/** Styled roads and paved areas, built on the reusable line-feature renderer. */
import { createParkedVehicleBatch } from '@bendyline/molen-client/vehicles';
import type { VehiclePlacement } from '@bendyline/molen-schema';
import * as THREE from 'three';
import {
  appendTerrainLineBand,
  appendTerrainSurfaceArea,
  createTerrainBoxInstances,
  type TerrainBoxPlacement,
  type TerrainLineBand,
  TerrainSurfaceMeshBuilder,
  terrainLinePath,
} from './linear-features';
import { normalizeRing, pointInPolygon, polygonBounds } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type {
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from './semantic-types';
import { isSurfaceLink, SurfaceNetwork, type SurfaceRoad } from './surface-network';
import { inferTerrainParkingAreas } from './surface-parking';
import {
  resolveTerrainSurfaceStyle,
  type TerrainParkedVehicle,
  type TerrainSurfaceOptions,
} from './surface-styles';

export interface TerrainSurfaceStats {
  roads: number;
  parkingAreas: number;
  junctions: number;
  streetlights: number;
  trafficSignals: number;
  parkingBays: number;
  parkedCars: number;
  detailLimited: boolean;
}

/** Dispose tile-owned buffers and GPU instance attributes, retaining shared materials. */
export function disposeTerrainSurfaceObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.terrainOwnedGeometry) {
      mesh.geometry.dispose();
      mesh.userData.terrainOwnedGeometry = false;
    }
    if (mesh.userData.terrainOwnedInstances) {
      (mesh as THREE.InstancedMesh).dispose();
      mesh.userData.terrainOwnedInstances = false;
    }
  });
}

function areaKind(className: string, subclass = ''): 'parking' | 'plaza' | 'path' | undefined {
  const tag = `${className} ${subclass}`.toLowerCase();
  if (/parking|car_park/.test(tag) && !/garage|underground|multi.storey/.test(tag))
    return 'parking';
  if (/pedestrian|plaza|square|platform/.test(tag)) return 'plaza';
  if (/pavement|footway|sidewalk/.test(tag)) return 'path';
  return undefined;
}

function midpoint(a: TerrainSemanticPoint, b: TerrainSemanticPoint): TerrainSemanticPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function hash(x: number, z: number): number {
  let value = Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Surface meshes are tile-local, clipped, batched and deterministic. */
export function createTerrainSurfaceObject(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSurfaceOptions = {},
  roadMaterial?: THREE.Material,
  renderVehicles = true,
): THREE.Group {
  const style = resolveTerrainSurfaceStyle(options.style, options.details);
  const details = options.details ?? {};
  const parkedVehicles = details.parkedVehicles ?? [];
  const detailed =
    context.pyramid.maxLevel - context.address.level <= (details.detailLevelsBelowMax ?? 0);
  const group = new THREE.Group();
  group.name = 'semantic:surfaces';
  group.userData.surfaceStyle = style.id;
  const stats: TerrainSurfaceStats = {
    roads: 0,
    parkingAreas: 0,
    junctions: 0,
    streetlights: 0,
    trafficSignals: 0,
    parkingBays: 0,
    parkedCars: 0,
    detailLimited: false,
  };
  group.userData.surfaceStats = stats;
  const network = new SurfaceNetwork(tile, context.tileSize, style);
  if (detailed) network.findJunctions();
  const pavement = new TerrainSurfaceMeshBuilder(context);
  const roads = new TerrainSurfaceMeshBuilder(context);
  const edges = new TerrainSurfaceMeshBuilder(context);
  const marks = new TerrainSurfaceMeshBuilder(context);
  const fixtures: TerrainBoxPlacement[] = [];
  const vehicles: VehiclePlacement[] = [];
  group.userData.vehicles = vehicles;
  let fixtureCount = 0;
  let remaining = details.maxDetailElements ?? 16_000;
  const parkingReserve = Math.floor(remaining * 0.35);
  const maxFixtures = details.maxFixturesPerTile ?? 160;
  const exclusions = [
    ...tile.buildings.flatMap((b) => b.polygons),
    ...tile.water.flatMap((w) => w.polygons ?? []),
  ];
  const exclusionCells = new Map<string, TerrainSemanticPolygon[]>();
  const exclusionCellSize = Math.max(24, context.tileSize / 64);
  for (const polygon of exclusions) {
    const bounds = polygonBounds(polygon);
    const minX = Math.floor(Math.max(-1, bounds[0] * context.tileSize) / exclusionCellSize);
    const minZ = Math.floor(Math.max(-1, bounds[1] * context.tileSize) / exclusionCellSize);
    const maxX = Math.floor(
      Math.min(context.tileSize + 1, bounds[2] * context.tileSize) / exclusionCellSize,
    );
    const maxZ = Math.floor(
      Math.min(context.tileSize + 1, bounds[3] * context.tileSize) / exclusionCellSize,
    );
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const key = `${x}/${z}`;
        const cell = exclusionCells.get(key) ?? [];
        cell.push(polygon);
        exclusionCells.set(key, cell);
      }
  }
  const blocked = (x: number, z: number): boolean =>
    (
      exclusionCells.get(
        `${Math.floor(x / exclusionCellSize)}/${Math.floor(z / exclusionCellSize)}`,
      ) ?? []
    ).some((p) => pointInPolygon([x / context.tileSize, z / context.tileSize], p));
  const inTile = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < context.tileSize && z < context.tileSize;
  const band = (
    builder: TerrainSurfaceMeshBuilder,
    road: SurfaceRoad,
    spec: TerrainLineBand,
    filter?: (points: readonly TerrainSemanticPoint[], distance: number) => boolean,
  ): void => {
    if (remaining <= parkingReserve) return;
    remaining -= appendTerrainLineBand(builder, road.path, spec, {
      maxElements: Math.max(0, remaining - parkingReserve),
      spacing: 3,
      filter,
    });
  };
  for (const road of network.roads) {
    stats.roads++;
    const elevation = road.elevation;
    const clipPath =
      road.kind === 'path'
        ? {
            clip: (points: readonly TerrainSemanticPoint[]): TerrainSemanticPoint[][] =>
              network.clipPath(points, road),
          }
        : {};
    const color =
      road.kind === 'rail'
        ? '#807b70'
        : road.kind === 'path'
          ? style.path
          : road.unpaved
            ? style.dirt
            : style.road;
    appendTerrainLineBand(
      roads,
      road.path,
      { width: road.width, color, elevation },
      { spacing: detailed ? 6 : 16, ...clipPath },
    );
    // Draw only the exposed shoulder edges, avoiding a second sheet beneath the asphalt.
    const shoulderWidth = road.unpaved ? 0.7 : 0.3;
    for (const sign of [-1, 1])
      appendTerrainLineBand(
        edges,
        road.path,
        {
          width: shoulderWidth,
          offset: sign * (road.width / 2 + shoulderWidth / 2),
          color: style.shoulder,
          elevation: elevation - 0.04,
        },
        { spacing: detailed ? 6 : 16, ...clipPath },
      );
    if (!detailed) continue;
    if (road.kind === 'rail') {
      for (const offset of [-0.72, 0.72])
        band(marks, road, { width: 0.09, offset, color: '#b5b5ae', elevation: elevation + 0.14 });
      band(marks, road, {
        width: 2.4,
        color: '#74634f',
        elevation: elevation + 0.06,
        dash: [0.2, 0.65],
      });
      continue;
    }
    if (style.sidewalks && road.kind === 'street' && !road.feature.bridge && !road.unpaved) {
      const clear = (points: readonly TerrainSemanticPoint[]): boolean =>
        points.every((p) => !network.occupied(p[0], p[1], 0.25, road) && !blocked(p[0], p[1]));
      for (const sign of [-1, 1]) {
        band(
          edges,
          road,
          {
            width: style.sidewalkWidth,
            offset: sign * (road.width / 2 + style.sidewalkWidth / 2 + 0.18),
            color: style.sidewalk,
            elevation: elevation + 0.13,
          },
          clear,
        );
        band(
          edges,
          road,
          {
            width: 0.22,
            offset: sign * (road.width / 2 + 0.11),
            color: style.curb,
            elevation: elevation + 0.15,
          },
          clear,
        );
      }
    }
    if (road.unpaved && style.id !== 'minimal' && road.kind !== 'path') {
      for (const offset of [-road.width * 0.24, road.width * 0.24]) {
        band(marks, road, { width: 0.48, offset, color: '#8c795b', elevation: elevation + 0.025 });
      }
      continue;
    }
    if (
      !style.markings ||
      road.kind === 'path' ||
      road.kind === 'service' ||
      isSurfaceLink(road) ||
      road.width < 5.5
    )
      continue;
    const clearJunction = (points: readonly TerrainSemanticPoint[]): boolean =>
      !network.junctions.some(
        (node) =>
          node.layer === (road.feature.layer ?? 0) &&
          !road.feature.bridge &&
          node.cores.some((core) =>
            points.some(
              (p) =>
                Math.hypot(p[0] - core.x, p[1] - core.z) < core.radius + (style.crossings ? 8 : 2),
            ),
          ),
      );
    if (!road.feature.oneway) {
      for (const offset of road.width >= 9 ? [-0.15, 0.15] : [0])
        band(
          marks,
          road,
          {
            width: 0.13,
            offset,
            color: style.center,
            elevation: elevation + 0.045,
            ...(road.width < 9 ? { dash: [3, 5] as const } : {}),
          },
          clearJunction,
        );
    }
    const lanes = road.feature.lanes ?? Math.max(2, Math.round(road.width / 3.3));
    for (let lane = 1; lane < Math.min(12, lanes); lane++) {
      const offset = -road.width / 2 + (road.width * lane) / lanes;
      if (!road.feature.oneway && Math.abs(offset) < 0.3) continue;
      band(
        marks,
        road,
        { width: 0.12, offset, color: style.white, elevation: elevation + 0.045, dash: [3, 6] },
        clearJunction,
      );
    }
    if (road.width >= 8)
      for (const sign of [-1, 1])
        band(
          marks,
          road,
          {
            width: 0.13,
            offset: sign * (road.width / 2 - 0.3),
            color: style.white,
            elevation: elevation + 0.045,
          },
          clearJunction,
        );
  }

  const rectangle = (
    x: number,
    z: number,
    dx: number,
    dz: number,
    width: number,
    length: number,
  ): TerrainSemanticPoint[] => [
    [x - (dx * length) / 2 - (dz * width) / 2, z - (dz * length) / 2 + (dx * width) / 2],
    [x + (dx * length) / 2 - (dz * width) / 2, z + (dz * length) / 2 + (dx * width) / 2],
    [x + (dx * length) / 2 + (dz * width) / 2, z + (dz * length) / 2 - (dx * width) / 2],
    [x - (dx * length) / 2 + (dz * width) / 2, z - (dz * length) / 2 - (dx * width) / 2],
  ];

  const white = new THREE.Color(style.white);
  for (const node of network.junctions) {
    if (!inTile(node.x, node.z)) continue;
    stats.junctions++;
    if (style.crossings)
      for (const arm of node.arms) {
        const x = arm.x,
          z = arm.z;
        for (
          let offset = -arm.width / 2 + 0.65;
          offset < arm.width / 2 - 0.3 && remaining > 0;
          offset += 1.1
        ) {
          remaining--;
          marks.polygon(
            rectangle(x - arm.dz * offset, z + arm.dx * offset, arm.dx, arm.dz, 0.5, 2.6),
            white,
            arm.road.elevation + 0.055,
          );
        }
        if (style.markings && remaining-- > 0)
          marks.polygon(
            rectangle(x + arm.dx * 2.3, z + arm.dz * 2.3, arm.dx, arm.dz, arm.width - 0.7, 0.35),
            white,
            arm.road.elevation + 0.055,
          );
      }
    if (!style.streetlights && !style.trafficSignals) continue;
    const arms = [...node.arms].sort((a, b) => Math.atan2(a.dz, a.dx) - Math.atan2(b.dz, b.dx));
    for (let i = 0; i < arms.length && fixtureCount < maxFixtures; i++) {
      const a = arms[i],
        b = arms[(i + 1) % arms.length];
      if (!a || !b) continue;
      const angle = (Math.atan2(b.dz, b.dx) - Math.atan2(a.dz, a.dx) + Math.PI * 2) % (Math.PI * 2);
      if (angle > Math.PI + 0.1 || angle < 0.3) continue;
      const direction = Math.atan2(a.dz, a.dx) + angle / 2;
      // Intersect the two outer sidewalk edges, including divided carriageway widths.
      const ax = a.x - a.dz * (a.width / 2 + 1.5);
      const az = a.z + a.dx * (a.width / 2 + 1.5);
      const bx = b.x + b.dz * (b.width / 2 + 1.5);
      const bz = b.z - b.dx * (b.width / 2 + 1.5);
      const cross = a.dx * b.dz - a.dz * b.dx;
      let x: number, z: number;
      if (Math.abs(cross) < 0.15) {
        // The uninterrupted side of a T-junction has a straight curb, not a corner.
        if (angle < 3) continue;
        const distance = Math.max(a.width, b.width) / 2 + 1.5;
        x = node.x + Math.cos(direction) * distance;
        z = node.z + Math.sin(direction) * distance;
      } else {
        const along = ((bx - ax) * b.dz - (bz - az) * b.dx) / cross;
        x = ax + a.dx * along;
        z = az + a.dz * along;
      }
      if (Math.hypot(x - node.x, z - node.z) > node.radius + 15) continue;
      if (!inTile(x, z) || blocked(x, z) || network.occupied(x, z, 0.4)) continue;
      const y =
        context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z) + 0.45;
      const dx = -Math.cos(direction),
        dz = -Math.sin(direction),
        yaw = Math.atan2(dx, dz);
      fixtureCount++;
      const mappedLampNearby =
        details.preferMappedProps === true &&
        (tile.pois ?? []).some(
          (p) =>
            p.class === 'street_lamp' &&
            Math.hypot(p.point[0] * context.tileSize - x, p.point[1] * context.tileSize - z) < 18,
        );
      if (style.streetlights && !mappedLampNearby) {
        stats.streetlights++;
        fixtures.push(
          { x, z, y: y + 3.7, yaw, size: [0.16, 7.4, 0.16], color: '#667078' },
          { x, z, y: y + 0.15, yaw, size: [0.45, 0.3, 0.45], color: '#888d8b' },
          {
            x: x + dx * 0.9,
            z: z + dz * 0.9,
            y: y + 7.35,
            yaw,
            size: [0.12, 0.12, 1.9],
            color: '#667078',
          },
          {
            x: x + dx * 1.8,
            z: z + dz * 1.8,
            y: y + 7.3,
            yaw,
            size: [0.48, 0.18, 0.85],
            color: '#efe8ba',
          },
        );
      }
      // Signals are an illustrative treatment for major four-way junctions only.
      if (
        style.trafficSignals &&
        arms.length >= 4 &&
        arms.some((arm) => arm.road.width >= 10 || arm.road.feature.class === 'major_road')
      ) {
        stats.trafficSignals++;
        const sx = x + dx * 0.35,
          sz = z + dz * 0.35;
        fixtures.push(
          { x: sx, z: sz, y: y + 1.8, yaw, size: [0.1, 3.6, 0.1], color: '#586269' },
          { x: sx, z: sz, y: y + 3.55, yaw, size: [0.32, 0.95, 0.24], color: '#242c30' },
        );
        for (let light = 0; light < 3; light++)
          fixtures.push({
            x: sx + dx * 0.14,
            z: sz + dz * 0.14,
            y: y + 3.85 - light * 0.29,
            yaw,
            size: [0.18, 0.18, 0.035],
            color: ['#e65d48', '#806b31', '#284c43'][light] as string,
          });
      }
    }
  }

  const inferredParking =
    details.inferParking === false ? [] : inferTerrainParkingAreas(tile, network, context.tileSize);
  group.userData.inferredParkingAreas = inferredParking.reduce(
    (sum, f) => sum + f.polygons.length,
    0,
  );
  for (const feature of [...tile.landcover, ...inferredParking]) {
    const kind = areaKind(feature.class, feature.subclass);
    if (!kind) continue;
    for (const polygon of feature.polygons) {
      const color =
        kind === 'parking' ? style.parking : kind === 'plaza' ? style.plaza : style.path;
      // Pedestrian areas can overlap mapped or inferred parking. Distinct heights
      // keep those different-colored fills from competing in the depth buffer.
      const elevation = kind === 'parking' ? 0.3 : kind === 'plaza' ? 0.38 : 0.4;
      appendTerrainSurfaceArea(pavement, polygon, new THREE.Color(color), elevation);
      if (kind !== 'parking') continue;
      stats.parkingAreas++;
      if (!detailed || (!style.parkingStalls && !style.parkedCars) || remaining <= 0) continue;
      // Align stalls to the longest mapped boundary, and anchor the lattice in world space.
      let angle = 0,
        longest = 0;
      const ring = normalizeRing(polygon.outer);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (!a || !b) continue;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length > longest) {
          longest = length;
          angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
      }
      // Canonical orientation avoids reversing the lattice when a decoder reverses ring winding.
      angle = ((angle % Math.PI) + Math.PI) % Math.PI;
      const dx = Math.cos(angle),
        dz = Math.sin(angle);
      const projected = ring.map((p) => {
        const x = p[0] * context.tileSize + context.origin[0];
        const z = p[1] * context.tileSize + context.origin[1];
        return [x * dx + z * dz, -x * dz + z * dx];
      });
      const [minU, minV, maxU, maxV] = polygonBounds({
        outer: projected as TerrainSemanticPoint[],
      });
      const toLocal = (u: number, v: number): TerrainSemanticPoint => [
        u * dx - v * dz - context.origin[0],
        u * dz + v * dx - context.origin[1],
      ];
      const valid = (p: TerrainSemanticPoint): boolean =>
        inTile(p[0], p[1]) &&
        pointInPolygon([p[0] / context.tileSize, p[1] / context.tileSize], polygon) &&
        !network.occupied(p[0], p[1], 0.5) &&
        !blocked(p[0], p[1]);
      const rows: { v: number; side: number }[] = [];
      // Use mapped service aisles as row anchors when available. The fallback lattice is
      // for parking polygons without internal aisle geometry.
      for (const road of network.roads) {
        if (road.kind !== 'service') continue;
        for (let i = 1; i < road.path.points.length && rows.length < 256; i++) {
          const a = road.path.points[i - 1] as TerrainSemanticPoint;
          const b = road.path.points[i] as TerrainSemanticPoint;
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 10 || Math.abs((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / length < 0.97)
            continue;
          if (
            !pointInPolygon(
              [(a[0] + b[0]) / (2 * context.tileSize), (a[1] + b[1]) / (2 * context.tileSize)],
              polygon,
            )
          )
            continue;
          const across = -(a[0] + context.origin[0]) * dz + (a[1] + context.origin[1]) * dx;
          for (const sign of [-1, 1]) {
            const v = across + sign * (road.width / 2 + 0.55 + 5.2);
            const side = -sign;
            if (!rows.some((row) => Math.abs(row.v + row.side * 2.6 - v - side * 2.6) < 5.15))
              rows.push({ v, side });
          }
        }
      }
      if (!rows.length)
        for (let v = Math.ceil(minV / 16.8) * 16.8; v < maxV && rows.length < 256; v += 16.8) {
          rows.push({ v, side: -1 }, { v, side: 1 });
        }
      for (const row of rows) {
        const { v } = row;
        for (let u = Math.ceil(minU / 2.65) * 2.65; u < maxU && remaining > 0; u += 2.65) {
          for (const side of [row.side]) {
            if (remaining-- <= 0) break;
            const center = toLocal(u + 1.325, v + side * 2.6);
            const corners = [
              toLocal(u, v),
              toLocal(u + 2.65, v),
              toLocal(u + 2.65, v + side * 5.2),
              toLocal(u, v + side * 5.2),
            ];
            const samples = [
              ...corners,
              center,
              ...corners.map((p, i) => midpoint(p, corners[(i + 1) % 4] as TerrainSemanticPoint)),
            ];
            if (!samples.every(valid)) continue;
            // Check complete bays at sub-meter spacing so narrow holes/obstacles don't get cars.
            let fits = true;
            for (let a = 0.4; a < 2.65 && fits; a += 0.6)
              for (let b = 0.4; b < 5.2; b += 0.6) {
                if (!valid(toLocal(u + a, v + side * b))) {
                  fits = false;
                  break;
                }
              }
            if (!fits) continue;
            stats.parkingBays++;
            if (style.parkingStalls) {
              for (const [a, b] of [
                [corners[3], corners[0]],
                [corners[0], corners[1]],
                [corners[1], corners[2]],
              ]) {
                if (!a || !b) continue;
                const line = terrainLinePath(
                  [
                    a.map((n) => n / context.tileSize),
                    b.map((n) => n / context.tileSize),
                  ] as TerrainSemanticPoint[],
                  context.tileSize,
                );
                appendTerrainLineBand(marks, line, {
                  width: 0.1,
                  color: style.white,
                  elevation: 0.345,
                });
              }
            }
            const seed = hash(center[0] + context.origin[0], center[1] + context.origin[1]);
            if (
              style.parkedCars &&
              parkedVehicles.length > 0 &&
              fixtureCount < maxFixtures &&
              seed < (details.parkingOccupancy ?? 0.7)
            ) {
              fixtureCount++;
              stats.parkedCars++;
              const x = center[0],
                z = center[1];
              const yaw = -angle + (side < 0 ? Math.PI : 0);
              const color = ['#b7c0c5', '#566d82', '#914c40', '#e0dccc', '#3e4b50', '#8d989b'][
                Math.floor(seed * 79) % 6
              ] as string;
              const wx = context.origin[0] + x,
                wz = context.origin[1] + z;
              const vehicle = parkedVehicles[
                Math.floor(hash(wx + 19.7, wz - 37.1) * parkedVehicles.length)
              ] as TerrainParkedVehicle;
              const kind = vehicle.id;
              const spec = vehicle.spec;
              const heights = [spec.wheelbase / 2, -spec.wheelbase / 2].flatMap((wheelZ) =>
                [-spec.width * 0.42, spec.width * 0.42].map(
                  (wheelX) =>
                    context.heightfield.sampleHeight(
                      wx + Math.cos(yaw) * wheelX + Math.sin(yaw) * wheelZ,
                      wz - Math.sin(yaw) * wheelX + Math.cos(yaw) * wheelZ,
                    ) + 0.3,
                ),
              );
              const [fl, fr, rl, rr] = heights as [number, number, number, number];
              vehicles.push({
                id: `parked-car:${Math.round(wx * 10)}:${Math.round(wz * 10)}`,
                kind,
                color,
                spec,
                position: [wx, (fl + fr + rl + rr) / 4, wz],
                yaw,
                pitch: Math.atan2((rl + rr - fl - fr) / 2, spec.wheelbase),
                roll: Math.atan2((fr + rr - fl - rl) / 2, spec.width * 0.84),
              });
            }
          }
        }
      }
    }
  }
  for (const mesh of [
    pavement.mesh('surface:areas'),
    edges.mesh('surface:edges'),
    roads.mesh('semantic:transportation', roadMaterial),
    marks.mesh('surface:markings'),
    createTerrainBoxInstances(fixtures, 'surface:street-fixtures'),
  ]) {
    if (mesh) group.add(mesh);
  }
  if (renderVehicles && vehicles.length)
    group.add(createParkedVehicleBatch(vehicles, context.origin));
  stats.detailLimited = remaining <= 0 || fixtureCount >= maxFixtures;
  return group;
}

export interface TerrainSurfaceGenerator {
  generate(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    options: TerrainSurfaceOptions,
  ): Promise<THREE.Group | undefined>;
  dispose(): void;
}

export interface TerrainSurfaceRenderer {
  /** Synchronous construction for direct/static consumers. Streamed renderers use createTileAsync. */
  createTile(tile: TerrainSemanticTile, context: TerrainPyramidTileLayerContext): THREE.Group;
  /** Resolves only when the newest requested style is ready, or undefined after cancellation. */
  createTileAsync(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): Promise<THREE.Group | undefined>;
  disposeTile(object: THREE.Object3D): void;
  /** Refresh resident tiles cooperatively, without refetching map data or rebuilding buildings. */
  setOptions(options: TerrainSurfaceOptions): Promise<void>;
  stats(): TerrainSurfaceStats & {
    tiles: number;
    loading: number;
    style: string;
    /** Changes only when rendered geometry is installed, replaced or removed. */
    geometryRevision: number;
  };
  dispose(): void;
}

/** One controller can be shared by all semantic renderers in a viewer. */
export function createTerrainSurfaceRenderer(
  initial: TerrainSurfaceOptions = {},
  generator?: TerrainSurfaceGenerator,
): TerrainSurfaceRenderer {
  let options = initial;
  resolveTerrainSurfaceStyle(options.style, options.details);
  interface Entry {
    tile: TerrainSemanticTile;
    context: TerrainPyramidTileLayerContext;
    controller?: AbortController;
    pending?: Promise<void>;
    cleanup: () => void;
  }
  const tiles = new Map<THREE.Object3D, Entry>();
  let revision = 0;
  let geometryRevision = 0;
  let disposed = false;
  const register = (
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): THREE.Group => {
    if (disposed) throw new Error('Surface renderer is disposed');
    const root = new THREE.Group();
    root.name = 'semantic:surface-layer';
    const abort = (): void => renderer.disposeTile(root);
    context.signal.addEventListener('abort', abort, { once: true });
    tiles.set(root, {
      tile,
      context,
      cleanup: () => context.signal.removeEventListener('abort', abort),
    });
    root.userData.disposeTerrainSurfaces = () => renderer.disposeTile(root);
    return root;
  };
  const rebuild = (root: THREE.Object3D, entry: Entry): Promise<void> => {
    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    const requested = options;
    const build = async (): Promise<void> => {
      const object = generator
        ? await generator.generate(
            entry.tile,
            { ...entry.context, signal: controller.signal },
            requested,
          )
        : createTerrainSurfaceObject(entry.tile, entry.context, requested);
      if (!object) return;
      if (disposed || controller.signal.aborted || !tiles.has(root)) {
        disposeTerrainSurfaceObject(object);
        return;
      }
      disposeTerrainSurfaceObject(root);
      root.clear();
      root.add(object);
      geometryRevision++;
    };
    const pending = build().finally(() => {
      if (entry.pending === pending) entry.pending = undefined;
    });
    entry.pending = pending;
    return pending;
  };
  const renderer: TerrainSurfaceRenderer = {
    createTile(tile, context) {
      const root = register(tile, context);
      try {
        root.add(createTerrainSurfaceObject(tile, context, options));
        geometryRevision++;
      } catch (error) {
        renderer.disposeTile(root);
        throw error;
      }
      return root;
    },
    async createTileAsync(tile, context) {
      if (context.signal.aborted) return undefined;
      const root = register(tile, context);
      const entry = tiles.get(root) as Entry;
      rebuild(root, entry);
      try {
        // Live options can replace a queued job while its caller awaits the older revision.
        while (entry.pending) await entry.pending;
        return tiles.has(root) && !disposed ? root : undefined;
      } catch (error) {
        renderer.disposeTile(root);
        throw error;
      }
    },
    disposeTile(root) {
      const entry = tiles.get(root);
      if (entry && root.children.length > 0) geometryRevision++;
      tiles.delete(root);
      entry?.controller?.abort();
      entry?.cleanup();
      delete root.userData.disposeTerrainSurfaces;
      disposeTerrainSurfaceObject(root);
    },
    async setOptions(next) {
      if (disposed) throw new Error('Surface renderer is disposed');
      resolveTerrainSurfaceStyle(next.style, next.details);
      options = next;
      const current = ++revision;
      if (generator) {
        // Dispatch is bounded by the bridge. Enqueue replacements together so initial tile
        // callers remain attached to their newest revision throughout an options change.
        await Promise.all([...tiles].map(([root, entry]) => rebuild(root, entry)));
        return;
      }
      for (const [root, entry] of [...tiles]) {
        if (current !== revision) return;
        if (!tiles.has(root)) continue;
        await rebuild(root, entry);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    },
    stats() {
      const sum = {
        roads: 0,
        parkingAreas: 0,
        junctions: 0,
        streetlights: 0,
        trafficSignals: 0,
        parkingBays: 0,
        parkedCars: 0,
        detailLimited: false,
        tiles: tiles.size,
        loading: 0,
        geometryRevision,
        style: resolveTerrainSurfaceStyle(options.style, options.details).id,
      };
      for (const [root, entry] of tiles) {
        if (entry.pending) sum.loading++;
        const stats = root.children[0]?.userData.surfaceStats as TerrainSurfaceStats | undefined;
        if (!stats) continue;
        for (const key of [
          'roads',
          'parkingAreas',
          'junctions',
          'streetlights',
          'trafficSignals',
          'parkingBays',
          'parkedCars',
        ] as const)
          sum[key] += stats[key];
        sum.detailLimited ||= stats.detailLimited;
      }
      return sum;
    },
    dispose() {
      disposed = true;
      revision++;
      for (const root of tiles.keys()) renderer.disposeTile(root);
      generator?.dispose();
    },
  };
  return renderer;
}
