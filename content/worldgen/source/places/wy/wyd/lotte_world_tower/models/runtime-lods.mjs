import { readFileSync } from 'node:fs';
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/signature-tower-expansion-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url), 'utf8'));
const outline = (id) => frame.localParts.find((part) => part.id === id).outline;
const sections = [
  [0.22, 914963586],
  [164, 879571752],
  [175, 888605473],
  [214, 879571750],
  [332, 888605472],
  [451, 888605471],
  [489, 879798716],
  [505, 888605470],
];
const crownHeight = 554.5;
const paint = [0.86, 0.89, 0.88];
const steel = [0.62, 0.67, 0.69];
const darkGlass = [0.23, 0.34, 0.4];
const glazing = [0.36, 0.52, 0.59];
const lobes = [635073469, 635073470];

const tiers = {
  skyline: {
    facets: 20,
    rows: 0,
    finStride: 0,
    ears: 10,
    crownBands: [554.5],
    blade: 0.48,
    bridge: 2,
  },
  district: {
    facets: 36,
    rows: 14,
    finStride: 6,
    ears: 18,
    crownBands: [531, 554.5],
    blade: 0.31,
    bridge: 6,
  },
  street: {
    facets: 64,
    rows: 32,
    finStride: 3,
    ears: 32,
    crownBands: [513, 531, 541, 554.5],
    blade: 0.22,
    bridge: 12,
  },
  closeup: {
    facets: 120,
    rows: 66,
    finStride: 2,
    ears: 62,
    crownBands: [513, 522, 531, 541, 549, 554.5],
    blade: 0.14,
    bridge: 22,
  },
};

export const surfaces = {
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.23, metallic: 0.28 },
  clear_glass: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.15,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.52],
    doubleSided: true,
  },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
  stainless: { slot: 'trim', graph: 'metal_stainless', roughness: 0.3, metallic: 1 },
};

function radiusAt(ring, [dx, dz]) {
  let distance = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const next = ring[(i + 1) % ring.length];
    const ex = next[0] - x;
    const ez = next[1] - z;
    const determinant = dx * ez - dz * ex;
    if (Math.abs(determinant) < 1e-9) continue;
    const alongEdge = (x * dz - z * dx) / determinant;
    if (alongEdge >= -1e-8 && alongEdge <= 1 + 1e-8) {
      distance = Math.max(distance, (x * ez - z * ex) / determinant);
    }
  }
  if (distance <= 0) throw new Error('Missing Lotte tower section at radial sample');
  return distance;
}

function towerBody(out, level, detail) {
  const directions = Array.from({ length: detail.facets }, (_, i) => {
    const angle = (-i * 2 * Math.PI) / detail.facets;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const sectionRings = sections.map(([y, id]) => ({
    y,
    radii: directions.map((dir) => radiusAt(outline(id), dir)),
  }));
  const pointAt = (i, y) => {
    const upper = sectionRings.findIndex((s) => s.y >= y);
    const right = sectionRings[Math.max(1, upper)];
    const left = sectionRings[Math.max(0, upper - 1)];
    const t = (y - left.y) / (right.y - left.y);
    const radius = left.radii[i] + t * (right.radii[i] - left.radii[i]);
    return [radius * directions[i][0], y, radius * directions[i][1]];
  };
  const base = directions.map((_, i) => pointAt(i, 0.22));
  const bottom = base.map(([x, , z]) => [x, 0, z]);
  const lanternFloor = directions.map((_, i) => pointAt(i, 505));
  const baseColor = [0.57, 0.6, 0.59];
  loft(out, 'foundation', [bottom, base], baseColor, { cap: false });
  // These rings are sampled from the center. A radial fan keeps the triangles
  // well conditioned where several boundary samples lie on straight edges.
  for (let i = 0; i < base.length; i++) {
    const k = (i + 1) % base.length;
    tri(out, 'foundation', [[0, 0, 0], bottom[k], bottom[i]], baseColor);
    tri(out, 'foundation', [[0, 0.22, 0], base[i], base[k]], baseColor);
    tri(out, 'concrete', [[0, 505, 0], lanternFloor[i], lanternFloor[k]], [0.46, 0.51, 0.53]);
  }
  const extraRows = Array.from(
    { length: detail.rows },
    (_, i) => 12 + ((i + 1) * 487) / (detail.rows + 1),
  );
  const rows = [...sections.map(([y]) => y), 8.43, 12, ...extraRows].sort((a, b) => a - b);
  for (let j = 1; j < rows.length; j++) {
    const y0 = rows[j - 1];
    const y1 = rows[j];
    for (let i = 0; i < detail.facets; i++) {
      const k = (i + 1) % detail.facets;
      const quad = [pointAt(i, y0), pointAt(k, y0), pointAt(k, y1), pointAt(i, y1)];
      const seam = Math.abs((quad[0][2] + quad[1][2]) / 2) < 2.6;
      const tint = seam ? darkGlass : i % 4 === 0 ? [0.4, 0.55, 0.62] : glazing;
      face(out, level !== 'skyline' && y1 <= 12 ? 'clear_glass' : 'glass', quad, tint);
    }
  }
  if (level === 'skyline') return;
  for (let i = 0; i < detail.facets; i += detail.finStride) {
    if (Math.abs(directions[i][1]) < 0.09) continue;
    const fin = (y) => {
      const p = pointAt(i, y);
      return [p[0] + 0.22 * directions[i][0], p[1], p[2] + 0.22 * directions[i][1]];
    };
    beamPath(
      out,
      'metal',
      sections.map(([y]) => fin(y)),
      level === 'district' ? 0.33 : 0.17,
      0.48,
      paint,
    );
  }
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) * 2 * Math.PI) / 8;
    const dir = [Math.cos(angle), Math.sin(angle)];
    const radius = radiusAt(outline(sections[0][1]), dir) - 7;
    const [x, z] = dir.map((d) => d * radius);
    box(out, 'concrete', [x - 1.65, 0.22, z - 1.65], [x + 1.65, 27, z + 1.65], [0.78, 0.8, 0.78]);
  }
  if (level === 'street' || level === 'closeup') {
    for (const side of [-1, 1]) {
      const x = side * 46.5;
      for (let j = -2; j <= 2; j++) {
        const z = j * 1.05;
        beam(out, 'stainless', [x, 0.22, z], [x, 4.45, z], 0.072, 0.09, steel);
      }
      beam(out, 'stainless', [x, 4.45, -2.2], [x, 4.45, 2.2], 0.15, 0.23, steel);
    }
  }
  if (level === 'closeup') {
    for (const y of [
      8.43, 12, 86, 93, 163, 172, 235, 243, 292, 300, 326, 335, 404, 414, 450, 461,
    ]) {
      beamPath(
        out,
        'metal',
        directions.map((_, i) => pointAt(i, y)),
        0.13,
        0.13,
        steel,
        true,
      );
    }
  }
}

function resampleRing(ring, count) {
  const spans = ring
    .map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
    })
    .filter((e) => e.length > 0);
  const perimeter = spans.reduce((sum, e) => sum + e.length, 0);
  let segment = 0;
  let start = 0;
  return Array.from({ length: count }, (_, i) => {
    const distance = (i * perimeter) / count;
    while (distance > start + spans[segment].length) start += spans[segment++].length;
    const { a, b, length } = spans[segment];
    const t = (distance - start) / length;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  });
}

function towerCrown(out, level, detail) {
  const at = ([x, z], y) => [
    x * (1 + (crownHeight - y) * 0.0045),
    y,
    z * (1 + (crownHeight - y) * 0.0014),
  ];
  for (const [i, id] of lobes.entries()) {
    const ring = resampleRing(outline(id), detail.ears);
    for (const p of ring)
      beam(out, 'metal', at(p, 505), at(p, crownHeight), detail.blade, 0.34, paint);
    for (const y of detail.crownBands) {
      beamPath(
        out,
        'metal',
        ring.map((p) => at(p, y)),
        0.16,
        0.23,
        paint,
        true,
      );
    }
    if (level === 'skyline') continue;
    for (let j = 0; j < ring.length; j += Math.floor(ring.length / 4)) {
      const next = (j + Math.floor(ring.length / 5)) % ring.length;
      for (const [lo, hi] of [
        [505, 522],
        [522, 541],
        [541, 554.5],
      ]) {
        const a = lo === 522 ? next : j;
        const b = lo === 522 ? j : next;
        beam(out, 'metal', at(ring[a], lo), at(ring[b], hi), 0.35, 0.38, paint);
      }
    }
    if (level !== 'closeup' && level !== 'street') continue;
    const z = i === 0 ? 5.25 : -5.25;
    const landings = [505, 512.5, 520, 527.5, 535, 542.5];
    for (const [j, y] of landings.entries()) {
      box(out, 'metal', [-2.45, y - 0.08, z - 0.6], [1.25, y + 0.08, z + 0.6], steel);
      if (level !== 'closeup' || j === landings.length - 1) continue;
      const direction = j % 2 === 0 ? 1 : -1;
      for (let step = 0; step < 40; step++) {
        const t = step / 40;
        const x = -0.6 + direction * (3.1 * t - 1.55);
        const height = y + 7.5 * t;
        box(out, 'metal', [x - 0.06, height, z - 0.34], [x + 0.06, height + 0.1, z + 0.34], steel);
      }
      for (const edge of [-0.39, 0.39]) {
        beam(
          out,
          'metal',
          [-0.6 - direction * 1.55, y + 1, z + edge],
          [-0.6 + direction * 1.55, y + 8.5, z + edge],
          0.06,
          0.07,
          steel,
        );
      }
    }
    for (const p of [ring[2], ring[Math.floor(ring.length * 0.65)]]) {
      const top = at(p, crownHeight);
      beam(out, 'stainless', top, [top[0], 555.7, top[2]], 0.11, 0.11, steel);
    }
  }
  box(out, 'metal', [-0.625, 540.9, -5.5], [0.625, 541, 5.5], steel);
  if (level === 'skyline') return;
  const spans = Array.from(
    { length: detail.bridge + 1 },
    (_, i) => -5.5 + (11 * i) / detail.bridge,
  );
  const cable = (z) => 539.25 + 1.7 * (z / 5.5) ** 2;
  for (const x of [-0.69, 0.69]) {
    beamPath(
      out,
      'stainless',
      spans.map((z) => [x, cable(z), z]),
      0.07,
      0.07,
      steel,
    );
    beam(out, 'stainless', [x, 542.25, -5.5], [x, 542.25, 5.5], 0.07, 0.07, steel);
    for (const z of spans)
      beam(out, 'stainless', [x, cable(z), z], [x, 542.25, z], 0.045, 0.045, steel);
  }
}

function build(out, level) {
  const detail = tiers[level];
  towerBody(out, level, detail);
  towerCrown(out, level, detail);
}

export const buildSkyline = (out) => build(out, 'skyline');
export const buildDistrict = (out) => build(out, 'district');
export const buildStreet = (out) => build(out, 'street');
export const buildCloseup = (out) => build(out, 'closeup');
