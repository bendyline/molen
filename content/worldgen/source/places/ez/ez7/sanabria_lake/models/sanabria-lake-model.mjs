import { createRequire } from 'node:module';
import { pointInRing } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import relief from './lake-terrain.json' with { type: 'json' };

const terrainRequire = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
);
const { difference } = terrainRequire('polygon-clipping');
const { ShapeUtils, Vector2 } = terrainRequire('three');

export const stageMeters = 1000;
export const surfaces = {
  slopes: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  rock: { slot: 'wall', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  lake: {
    slot: 'trim',
    localRef: 'palette:#426e7d',
    name: 'Sanabria Lake water',
    roughness: 0.48,
    metallic: 0,
  },
};

const { origin, stepMeters, size, elevationScaleMeters, elevationsCentimeters } = relief;
const extent = size.map((count, axis) => origin[axis] + (count - 1) * stepMeters);
const [shoreline] = relief.lake.rings;
const bankWidth = 2 * stepMeters;

const edgesOf = (ring) => ring.slice(0, -1).map((point, index) => [point, ring[index + 1]]);
const gridLine = (axis, stride) => {
  const line = [];
  for (let value = origin[axis]; value < extent[axis]; value += stride * stepMeters)
    line.push(value);
  line.push(extent[axis]);
  return line;
};

function squaredDistanceToSegment([x, z], [[ax, az], [bx, bz]]) {
  const dx = bx - ax;
  const dz = bz - az;
  const along = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return (x - ax - dx * along) ** 2 + (z - az - dz * along) ** 2;
}

function simplifyLine(line, toleranceSquared) {
  const edge = [line[0], line.at(-1)];
  let split = 0;
  let distance = toleranceSquared;
  for (let i = 1; i < line.length - 1; i++) {
    const next = squaredDistanceToSegment(line[i], edge);
    if (next <= distance) continue;
    distance = next;
    split = i;
  }
  if (!split) return edge;
  return [
    ...simplifyLine(line.slice(0, split + 1), toleranceSquared).slice(0, -1),
    ...simplifyLine(line.slice(split), toleranceSquared),
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

function elevation([x, z]) {
  const u = (x - origin[0]) / stepMeters;
  const v = (z - origin[1]) / stepMeters;
  const column = Math.min(Math.floor(u), size[0] - 2);
  const row = Math.min(Math.floor(v), size[1] - 2);
  const fractionX = u - column;
  const fractionZ = v - row;
  const index = row * size[0] + column;
  const [nw, ne] = elevationsCentimeters.slice(index, index + 2);
  const [sw, se] = elevationsCentimeters.slice(index + size[0], index + size[0] + 2);
  const top = nw + (ne - nw) * fractionX;
  const bottom = sw + (se - sw) * fractionX;
  return (top + (bottom - top) * fractionZ) * elevationScaleMeters - stageMeters;
}

function triangulate([outer, ...holes], addTriangle) {
  // ShapeUtils expects open rings and returns indices into their concatenation.
  const [boundary, ...islands] = [outer, ...holes].map((ring) =>
    ring.slice(0, -1).map(([x, z]) => new Vector2(x, z)),
  );
  const points = [boundary, ...islands].flat().map(({ x, y }) => [x, y]);
  for (const triangle of ShapeUtils.triangulateShape(boundary, islands))
    addTriangle(triangle.map((index) => points[index]));
}

function emit(builder, component, points, color, normal) {
  builder.addTriangle(
    component,
    'metric:uv',
    points,
    normal,
    points.map(([x, , z]) => [x, -z]),
    color,
  );
}

function landTriangle(builder, triangle, bankEdges) {
  const points = triangle.map((point) => {
    const distanceSquared = bankEdges.reduce(
      (distance, edge) => Math.min(distance, squaredDistanceToSegment(point, edge)),
      bankWidth ** 2,
    );
    // Smooth the join over two DEM samples, where land and water pixels mix at the shore.
    const blend = Math.sqrt(distanceSquared) / bankWidth;
    const height = elevation(point) * blend * blend * (3 - 2 * blend);
    return [Math.fround(point[0]), Math.fround(height), Math.fround(point[1])];
  });
  const [a, b, c] = points;
  const [ux, uy, uz] = b.map((value, axis) => value - a[axis]);
  const [vx, vy, vz] = c.map((value, axis) => value - a[axis]);
  const area = uz * vx - ux * vz;
  if (Math.abs(area) < 1e-6) return;
  const normal = [(uy * vz - uz * vy) / area, 1, (ux * vy - uy * vx) / area];
  const length = Math.hypot(...normal);
  const rock = normal[1] / length < 0.84;
  const altitude = (a[1] + b[1] + c[1]) / 3;
  const color = rock ? [0.33, 0.32, 0.24] : [0.22 + altitude / 5500, 0.27, 0.13];
  emit(
    builder,
    rock ? 'rock' : 'slopes',
    points,
    color,
    normal.map((value) => value / length),
  );
}

function buildRelief(builder, stride, tolerance) {
  // Preserve the holes at every tier. Adjacent map tiles were unioned before this input was
  // sampled, so neither the land nor the water inherits PMTiles clipping seams.
  const water = shoreline.map((ring, index) => simplifyRing(ring, index === 0 ? tolerance : 0));
  const [outer, ...islands] = water;
  const segments = water.flatMap(edgesOf);
  const xs = gridLine(0, stride);
  const zs = gridLine(1, stride);
  for (let row = 1; row < zs.length; row++) {
    const north = zs[row - 1];
    const south = zs[row];
    const band = segments.filter(
      ([a, b]) =>
        Math.min(a[1], b[1]) <= south + bankWidth && Math.max(a[1], b[1]) >= north - bankWidth,
    );
    for (let col = 1; col < xs.length; col++) {
      const west = xs[col - 1];
      const east = xs[col];
      const bank = band.filter(
        ([a, b]) =>
          Math.min(a[0], b[0]) <= east + bankWidth && Math.max(a[0], b[0]) >= west - bankWidth,
      );
      const crossesShore = bank.some(
        ([a, b]) =>
          Math.min(a[0], b[0]) <= east &&
          Math.max(a[0], b[0]) >= west &&
          Math.min(a[1], b[1]) <= south &&
          Math.max(a[1], b[1]) >= north,
      );
      const nw = [west, north];
      const ne = [east, north];
      const se = [east, south];
      const sw = [west, south];
      if (crossesShore) {
        const dry = difference([[nw, ne, se, sw, nw]], water);
        for (const polygon of dry)
          triangulate(polygon, (triangle) => landTriangle(builder, triangle, bank));
      } else {
        const center = [(west + east) / 2, (north + south) / 2];
        if (pointInRing(center, outer) && !islands.some((ring) => pointInRing(center, ring)))
          continue;
        landTriangle(builder, [nw, ne, se], bank);
        landTriangle(builder, [nw, se, sw], bank);
      }
    }
  }
  triangulate(water, (triangle) =>
    emit(
      builder,
      'lake',
      triangle.map(([x, z]) => [x, 0, z]),
      [0.082, 0.208, 0.276],
      [0, 1, 0],
    ),
  );
}

export const buildMaster = (builder) => buildRelief(builder, 1, 0);
export const buildSkyline = (builder) => buildRelief(builder, 32, 14);
export const buildDistrict = (builder) => buildRelief(builder, 12, 4);
export const buildStreet = (builder) => buildRelief(builder, 4, 1);
export const buildCloseup = (builder) => buildRelief(builder, 2, 0.35);
