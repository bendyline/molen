import { createRequire } from 'node:module';
import { ShapeUtils, Vector2 } from 'three';
import { pointInRing } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import data from './landscape.json' with { type: 'json' };

const terrainRequire = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
);
const { difference } = terrainRequire('polygon-clipping');

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  scree: { slot: 'foundation', graph: 'gravel', roughness: 0.99, metallic: 0 },
  ice: {
    slot: 'roof',
    localRef: 'palette:#c3c9cc',
    name: 'Mapped Pamir glaciers',
    roughness: 0.96,
  },
  sarez: { slot: 'trim', localRef: 'palette:#255777', name: 'Lake Sarez water', roughness: 0.39 },
  shadau: { slot: 'trim', localRef: 'palette:#398f8e', name: 'Lake Shadau water', roughness: 0.44 },
};

const { origin, stepMeters, size, elevationScaleMeters, elevationsCentimeters } = data;
const extent = size.map((count, axis) => origin[axis] + (count - 1) * stepMeters);
export const datum = data.lakes[0].stageMeters;
const bankWidth = 1.6 * stepMeters;
const palette = 'palette:#ffffff';
const inside = (point, polygons) =>
  polygons.some(
    ([outer, ...holes]) =>
      pointInRing(point, outer) && !holes.some((ring) => pointInRing(point, ring)),
  );
const gridLine = (axis, stride) => {
  const line = [];
  for (let value = origin[axis]; value < extent[axis]; value += stride * stepMeters)
    line.push(value);
  line.push(extent[axis]);
  return line;
};

function squaredDistance([x, z], [a, b]) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const along = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return (x - a[0] - dx * along) ** 2 + (z - a[1] - dz * along) ** 2;
}

function simplifyLine(points, toleranceSquared) {
  const edge = [points[0], points.at(-1)];
  let split = 0;
  let distance = toleranceSquared;
  for (let index = 1; index < points.length - 1; index++) {
    const d = squaredDistance(points[index], edge);
    if (d > distance) {
      split = index;
      distance = d;
    }
  }
  if (!split) return edge;
  return [
    ...simplifyLine(points.slice(0, split + 1), toleranceSquared).slice(0, -1),
    ...simplifyLine(points.slice(split), toleranceSquared),
  ];
}

function simplifyRing(ring, tolerance) {
  if (!tolerance) return ring;
  const middle = Math.floor(ring.length / 2);
  const a = simplifyLine(ring.slice(0, middle + 1), tolerance ** 2);
  const b = simplifyLine(ring.slice(middle), tolerance ** 2);
  const simple = [...a.slice(0, -1), ...b];
  return simple.length >= 4 ? simple : ring;
}

function terrainHeight([x, z]) {
  const u = (x - origin[0]) / stepMeters;
  const v = (z - origin[1]) / stepMeters;
  const col = Math.min(Math.floor(u), size[0] - 2);
  const row = Math.min(Math.floor(v), size[1] - 2);
  const index = row * size[0] + col;
  const nw = elevationsCentimeters[index];
  const ne = elevationsCentimeters[index + 1];
  const sw = elevationsCentimeters[index + size[0]];
  const se = elevationsCentimeters[index + size[0] + 1];
  const top = nw + (ne - nw) * (u - col);
  const bottom = sw + (se - sw) * (u - col);
  return (top + (bottom - top) * (v - row)) * elevationScaleMeters - datum;
}

function triangulate([outer, ...holes], emit) {
  const [boundary, ...islands] = [outer, ...holes].map((ring) =>
    ring.slice(0, -1).map(([x, z]) => new Vector2(x, z)),
  );
  const vertices = [boundary, ...islands].flat().map(({ x, y }) => [x, y]);
  for (const triangle of ShapeUtils.triangulateShape(boundary, islands))
    emit(triangle.map((i) => vertices[i]));
}

function snappedHeight(point, nearby) {
  const raw = terrainHeight(point);
  let distance = bankWidth ** 2;
  let stage = raw;
  for (const edge of nearby) {
    const squared = squaredDistance(point, edge.points);
    if (squared < distance) {
      distance = squared;
      stage = edge.stage;
    }
  }
  const blend = Math.sqrt(distance) / bankWidth;
  return stage + (raw - stage) * blend * blend * (3 - 2 * blend);
}

function landTriangle(out, triangle, edges) {
  const positions = triangle.map((p) => [
    Math.fround(p[0]),
    Math.fround(snappedHeight(p, edges)),
    Math.fround(p[1]),
  ]);
  const [a, b, c] = positions;
  const [ux, uy, uz] = b.map((n, axis) => n - a[axis]);
  const [vx, vy, vz] = c.map((n, axis) => n - a[axis]);
  const area = uz * vx - ux * vz;
  if (Math.abs(area) < 1e-6) return;
  const normal = [(uy * vz - uz * vy) / area, 1, (ux * vy - uy * vx) / area];
  const length = Math.hypot(...normal);
  const center = [0, 2].map((axis) => (a[axis] + b[axis] + c[axis]) / 3);
  const altitude = (a[1] + b[1] + c[1]) / 3;
  const glacier = inside(center, data.glaciers.rings);
  const slide = inside(center, data.rockslide.rings);
  const surface = glacier ? 'ice' : slide || 1 / length > 0.89 ? 'scree' : 'rock';
  const color = glacier
    ? [0.61, 0.72, 0.77]
    : slide
      ? [0.49, 0.45, 0.38]
      : altitude < 210
        ? [0.36, 0.32, 0.24]
        : [0.39, 0.37, 0.34];
  out.addTriangle(
    surface,
    palette,
    positions,
    normal.map((n) => n / length),
    [],
    color,
  );
}

function waterLevels(tolerance) {
  return data.lakes.map((lake) => ({
    ...lake,
    material: lake.title.toLowerCase(),
    polygons: lake.rings.map((polygon) =>
      polygon.map((ring, index) => simplifyRing(ring, index === 0 ? tolerance : 0)),
    ),
  }));
}

function segments(lakes) {
  return lakes.flatMap((lake) =>
    lake.polygons.flatMap((polygon) =>
      polygon.flatMap((ring) =>
        ring.slice(0, -1).map((a, i) => {
          const b = ring[i + 1];
          return {
            points: [a, b],
            stage: lake.stageMeters - datum,
            bounds: [
              Math.min(a[0], b[0]),
              Math.min(a[1], b[1]),
              Math.max(a[0], b[0]),
              Math.max(a[1], b[1]),
            ],
          };
        }),
      ),
    ),
  );
}

function build(out, stride, tolerance) {
  const lakes = waterLevels(tolerance);
  const shores = segments(lakes);
  const water = lakes.flatMap((lake) => lake.polygons);
  const xs = gridLine(0, stride),
    zs = gridLine(1, stride);
  for (let row = 1; row < zs.length; row++) {
    const north = zs[row - 1],
      south = zs[row];
    const band = shores.filter(
      ({ bounds: [, z0, , z1] }) => z0 <= south + bankWidth && z1 >= north - bankWidth,
    );
    for (let col = 1; col < xs.length; col++) {
      const west = xs[col - 1],
        east = xs[col];
      const edges = band.filter(
        ({ bounds: [x0, , x1] }) => x0 <= east + bankWidth && x1 >= west - bankWidth,
      );
      const intersects = edges.some(
        ({ bounds: [x0, z0, x1, z1] }) => x0 <= east && x1 >= west && z0 <= south && z1 >= north,
      );
      const nw = [west, north],
        ne = [east, north],
        se = [east, south],
        sw = [west, south];
      if (intersects) {
        for (const polygon of difference([[nw, ne, se, sw, nw]], water))
          triangulate(polygon, (triangle) => landTriangle(out, triangle, edges));
      } else if (!inside([(west + east) / 2, (north + south) / 2], water)) {
        landTriangle(out, [nw, ne, se], edges);
        landTriangle(out, [nw, se, sw], edges);
      }
    }
  }
  for (const lake of lakes) {
    const color = lake.material === 'sarez' ? [0.052, 0.171, 0.28] : [0.085, 0.284, 0.322];
    for (const polygon of lake.polygons)
      triangulate(polygon, (points) => {
        const [a, b, c] = points.map(([x, z]) => [
          Math.fround(x),
          lake.stageMeters - datum,
          Math.fround(z),
        ]);
        if (Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) < 1e-6) return;
        out.addTriangle(lake.material, palette, [a, b, c], [0, 1, 0], [], color);
      });
  }
}

export const buildMaster = (out) => build(out, 1, 0);
export const buildSkyline = (out) => build(out, 28, 60);
export const buildDistrict = (out) => build(out, 10, 24);
export const buildStreet = (out) => build(out, 4, 7);
export const buildCloseup = (out) => build(out, 2, 2.5);
