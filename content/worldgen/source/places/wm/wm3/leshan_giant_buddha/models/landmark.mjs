import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };
import { buildStatue } from './statue.mjs';

export const surfaces = {
  statue: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.98 },
  cliff: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.99 },
  terrace: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.88 },
};

const angle = (site.planAngleDegrees * Math.PI) / 180;
const c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [
  Math.fround(c * x - s * z),
  Math.fround(y),
  Math.fround(s * x + c * z),
];
const terracotta = [
  'a6705e',
  '956958',
  'a37f66',
  '93624f',
  'a67058',
  '9d7258',
  '88654e',
  '7a614b',
  '92785a',
].map(rgb);
const shale = rgb('896e5f'),
  rockGreen = rgb('69664c'),
  path = rgb('ad9e83');
const stone = rgb('a37965'),
  fence = rgb('694d3b');
const quadUv = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function polygon(out, slot, raw, tint, pointsOut) {
  const points = raw.map(world);
  const expected = world(pointsOut);
  for (let i = 1; i < points.length - 1; i++) {
    let p = [points[0], points[i], points[i + 1]];
    let n = normalFor(...p);
    if (Math.hypot(...n) < 0.98) continue;
    if (n.reduce((dot, v, k) => dot + v * expected[k], 0) < 0) {
      p = [p[0], p[2], p[1]];
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, '', p, n, quadUv, tint);
  }
}

function cliff(out, detail) {
  const stations = site.sections.filter((_, i) => detail || i % 2 === 0);
  const heights =
    detail === 0 ? [0, 0.25, 0.56, 0.81, 1] : [0, 0.09, 0.23, 0.37, 0.54, 0.68, 0.84, 0.93, 1];
  const strips = stations.map((p, i) =>
    heights.map((h, j) => {
      const front =
        h <= 0.46
          ? p.bank + ((p.mid - p.bank) * h) / 0.46
          : p.mid + ((p.crest - p.mid) * (h - 0.46)) / 0.54;
      const recess = Math.max(0, Math.min(1, (19 - Math.abs(p.z)) / 6));
      const ledge = Math.max(0, Math.min(1, (h - 0.08) / 0.15));
      const carved = front + Math.max(0, p.mid + 0.35 - front) * recess * ledge;
      const facet =
        j === 0 || j === heights.length - 1
          ? 0
          : Math.sin(i * 1.72 + j * 1.4) * Math.min(0.86, h * 4);
      return [carved + facet, h * (p.height + 1.9) - 1.9, p.z];
    }),
  );
  for (let i = 0; i < stations.length - 1; i++) {
    const a = strips[i],
      b = strips[i + 1],
      p = stations[i],
      q = stations[i + 1];
    for (let j = 1; j < heights.length; j++) {
      const tint = terracotta[(j - 1) % terracotta.length].map(
        (v) => v * (0.93 + 0.07 * Math.cos(i * 0.9 + j * 0.36)),
      );
      const moss = j === heights.length - 1 && Math.abs(p.z) > 18 && Math.abs(q.z) > 18;
      polygon(out, 'cliff', [a[j - 1], a[j], b[j], b[j - 1]], moss ? rockGreen : tint, [-1, 0, 0]);
    }
    const near = [p.rear, p.grade, p.z],
      far = [q.rear, q.grade, q.z];
    polygon(out, 'cliff', [a.at(-1), near, far, b.at(-1)], i % 3 ? rockGreen : shale, [0, 1, 0]);
    polygon(out, 'cliff', [near, [p.rear, -1.9, p.z], [q.rear, -1.9, q.z], far], shale, [1, 0, 0]);
  }
  for (const [i, sign] of [
    [0, -1],
    [stations.length - 1, 1],
  ]) {
    const p = stations[i],
      side = [...strips[i], [p.rear, p.grade, p.z], [p.rear, -1.9, p.z]];
    polygon(out, 'cliff', side, shale, [0, 0, sign]);
  }
}

function platform(out, detail) {
  const ring = site.platform.slice(0, -1);
  const elevation = site.platformElevation;
  const to = (point, y) => world([point[0], y, point[1]]);
  const floor = new MeshBufferBuilder();
  if (
    !floor.addCap(
      'terrace',
      '',
      ring,
      [],
      () => elevation,
      [0, 1, 0],
      (p) => p,
      path,
    )
  )
    throw Error('Invalid Leshan visitor terrace');
  const { positions, indices } = floor.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = [0, 1, 2].map((j) =>
      positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3),
    );
    polygon(out, 'terrace', points, path, [0, 1, 0]);
  }
  // The lower sill extends down to the riverbank beneath the visitors' railing.
  for (const [a, b] of site.platformRail.slice(0, -1).map((a, i) => [a, site.platformRail[i + 1]]))
    polygon(
      out,
      'terrace',
      [
        [a[0], -0.86, a[1]],
        [b[0], -0.86, b[1]],
        [b[0], elevation, b[1]],
        [a[0], elevation, a[1]],
      ],
      stone,
      [-1, 0, 0],
    );
  if (!detail) return;
  const railingY = elevation + 1.08;
  for (const [a, b] of site.platformRail
    .slice(0, -1)
    .map((a, i) => [a, site.platformRail[i + 1]])) {
    beam(out, 'rail', to(a, railingY), to(b, railingY), 0.092, 0.095, fence);
    const count = Math.max(
      2,
      Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (detail === 1 ? 3.4 : 1.15)),
    );
    for (let j = 0; j < count; j++) {
      const t = j / count,
        p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      beam(out, 'rail', to(p, elevation), to(p, railingY), 0.079, 0.079, fence);
    }
  }
}

function approach(out, detail) {
  if (!detail) return;
  const route = site.switchbacks;
  const grades = [68.9, 60.9, 52.1, 43.8, 33.9, 22.6, site.platformElevation];
  for (let i = 1; i < route.length; i++) {
    const [x, z] = route[i - 1],
      [X, Z] = route[i];
    const dx = X - x,
      dz = Z - z,
      length = Math.hypot(dx, dz);
    const wx = (-dz / length) * 0.72,
      wz = (dx / length) * 0.72;
    const y = grades[i - 1],
      dy = grades[i] - y;
    const steps = detail === 1 ? 2 : Math.ceil(Math.abs(dy) / 0.28);
    const pt = (t, e, h) => [x + t * dx + e * wx, h, z + t * dz + e * wz];
    for (let j = 0; j < steps; j++) {
      const a = j / steps,
        b = (j + 1) / steps,
        A = y + dy * a,
        B = y + dy * b;
      polygon(
        out,
        'terrace',
        [pt(a, -1, A), pt(b, -1, A), pt(b, 1, A), pt(a, 1, A)],
        path,
        [0, 1, 0],
      );
      polygon(out, 'terrace', [pt(b, -1, A), pt(b, 1, A), pt(b, 1, B), pt(b, -1, B)], stone, [
        dx,
        0,
        dz,
      ]);
    }
    for (const side of [-1, 1]) {
      beam(
        out,
        'rail',
        world(pt(0, side, y + 0.88)),
        world(pt(1, side, y + dy + 0.88)),
        0.074,
        0.077,
        fence,
      );
      if (detail >= 2)
        for (const t of [0.12, 0.34, 0.56, 0.78, 0.97]) {
          const h = y + dy * t;
          beam(out, 'rail', world(pt(t, side, h)), world(pt(t, side, h + 0.88)), 0.07, 0.07, fence);
        }
    }
  }
}

function build(out, detail) {
  cliff(out, detail);
  platform(out, detail);
  approach(out, detail);
  buildStatue(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
