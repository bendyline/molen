/** The standing Cathedral of the Divine Savior facing Plaza Gerardo Barrios. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const [axis, threshold] = plan.dimensions.frontThreshold;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  trim: { slot: 'trim', graph: 'plaster_tadelakt', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.84 },
  dome: { slot: 'roof', graph: 'metal_painted', roughness: 0.72, metallic: 0.14 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
};
const c = Object.fromEntries(
  Object.entries({
    white: 'e4dfd0',
    cream: 'dfd5bc',
    trim: 'eee6d1',
    shade: 'b7a991',
    stone: 'b9b1a1',
    base: 'aea699',
    pane: '4a5047',
    dark: '44443b',
    paneBlue: '657579',
    paneWine: '8a7361',
    leaf: '695348',
    beam: '818178',
    cap: '9e8f67',
    seam: 'c4af79',
    sheet: '918b7d',
    deck: 'b5afa1',
    bronze: '827256',
    statue: 'd8cbbc',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const sideWallTop = 23.95;
const entranceZ = threshold - 0.53;
const towerOffsets = [plan.dimensions.towerRanges.west, plan.dimensions.towerRanges.east];

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = mix(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = mix(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return mix(a, b, v - j) - terrain.modelDatumElevationMeters;
}

function plank(out, slot, x, y, z, width, height, depth, tint) {
  box(out, slot, [x - width / 2, y, z - depth], [x + width / 2, y + height, z], tint);
}

function rect(out, slot, x, y, z, r, h, tint) {
  face(
    out,
    slot,
    [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, y + h, z],
      [x - r, y + h, z],
    ],
    tint,
  );
}

function arc(x, y, z, w, rise, t) {
  const a = t * Math.PI;
  return [x + w * Math.cos(a), y + rise * Math.sin(a), z];
}

function roundWindow(out, x, y, z, radius, lod, stained = false) {
  const n = [6, 8, 12, 18][lod];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    const at = (t, r, d) => [x + r * Math.cos(t), y + r * Math.sin(t), z + d];
    triangle(
      out,
      'detail',
      [[x, y, z], at(a, radius, 0), at(b, radius, 0)],
      stained && i % 3 !== 0 ? c.paneBlue : c.pane,
    );
    const r = radius + 0.15 + radius * 0.078;
    face(
      out,
      'trim',
      [at(a, r, 0.072), at(b, r, 0.072), at(b, radius, 0.041), at(a, radius, 0.041)],
      c.trim,
    );
  }
  if (lod === 3 || (lod === 2 && stained)) {
    const spokes = stained ? 8 : 6;
    for (let i = 0; i < spokes; i++) {
      const a = (i * 2 * Math.PI) / spokes;
      beam(
        out,
        'detail',
        [x, y, z + 0.065],
        [x + radius * Math.cos(a), y + radius * Math.sin(a), z + 0.065],
        0.055,
        0.065,
        c.beam,
      );
    }
  }
}

function archedWindow(out, x, y, z, r, spring, rise, lod, tint = c.pane) {
  const n = [4, 6, 9, 14][lod];
  rect(out, 'detail', x, y, z, r, spring - y, tint);
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    triangle(
      out,
      'detail',
      [[x, spring, z], arc(x, spring, z, r, rise, a), arc(x, spring, z, r, rise, b)],
      tint,
    );
    const width = Math.min(0.31, r * 0.18);
    face(
      out,
      'trim',
      [
        arc(x, spring, z + 0.08, r + width, rise + width, a),
        arc(x, spring, z + 0.08, r + width, rise + width, b),
        arc(x, spring, z + 0.04, r, rise, b),
        arc(x, spring, z + 0.04, r, rise, a),
      ],
      c.cream,
    );
  }
  if (lod >= 1) {
    for (const s of [-1, 1])
      plank(out, 'trim', x + s * (r + 0.075), y, z + 0.1, 0.17, spring - y, 0.18, c.cream);
    plank(out, 'trim', x, y - 0.15, z + 0.21, 2 * r + 0.52, 0.17, 0.24, c.trim);
  }
  if (lod >= 3) {
    plank(out, 'detail', x, y, z + 0.075, 0.09, spring - y, 0.06, c.beam);
    for (const t of [0.27, 0.58, 0.88])
      plank(out, 'detail', x, mix(y, spring, t), z + 0.082, 2 * r, 0.07, 0.075, c.beam);
  }
}

function archCeiling(out, x, spring, front, back, width, inner, rise, innerRise, lod) {
  const n = [5, 8, 12, 18][lod];
  // Make both the return and the interior springing visible with shared materials.
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    face(
      out,
      'trim',
      [
        arc(x, spring, front, width, rise, a),
        arc(x, spring, front, width, rise, b),
        arc(x, spring, back, inner, innerRise, b),
        arc(x, spring, back, inner, innerRise, a),
      ],
      c.cream,
    );
  }
}

function plazaEntrance(out, lod) {
  const faceZ = entranceZ;
  const spring = 17.55,
    radius = 6.57,
    rise = 6.45;
  const top = 34.25,
    back = faceZ - 3.63;
  const n = [6, 10, 14, 22][lod];
  for (let i = 0; i < n; i++) {
    const a = arc(axis, spring, faceZ, radius, rise, (i + 1) / n);
    const b = arc(axis, spring, faceZ, radius, rise, i / n);
    face(out, 'wall', [a, b, [b[0], top, faceZ], [a[0], top, faceZ]], c.white);
  }
  for (const s of [-1, 1]) {
    const x = axis + s * (radius + 0.78);
    plank(out, 'wall', x, -2.5, faceZ, 1.6, top + 2.5, 4.42, c.white);
    const f = axis + s * radius,
      b = axis + s * 5.06;
    const points = [
      [f, -0.4, faceZ],
      [b, -0.4, back],
      [b, spring, back],
      [f, spring, faceZ],
    ];
    face(out, 'trim', s === 1 ? points.slice().reverse() : points, c.cream);
  }
  archCeiling(out, axis, spring, faceZ, back, radius, 5.06, rise, 4.98, lod);
  const bands = lod < 2 ? [0, 1] : [0, 0.25, 0.51, 0.74, 1];
  for (const t of bands) {
    const z = mix(faceZ, back, t) + 0.11;
    const r = mix(radius, 5.06, t),
      h = mix(rise, 4.98, t);
    for (let i = 0; i < n; i++) {
      const a = arc(axis, spring, z, r, h, i / n),
        b = arc(axis, spring, z, r, h, (i + 1) / n);
      face(
        out,
        'trim',
        [
          arc(axis, spring, z, r + 0.26, h + 0.26, i / n),
          arc(axis, spring, z, r + 0.26, h + 0.26, (i + 1) / n),
          b,
          a,
        ],
        c.trim,
      );
    }
    for (const s of [-1, 1])
      plank(out, 'trim', axis + s * (r + 0.1), 0.27, z + 0.09, 0.26, spring - 0.27, 0.22, c.trim);
  }
  plank(out, 'wall', axis, -2.6, back - 0.055, 10.18, 33.6, 1.7, c.shade);
  archedWindow(out, axis, 0.73, back + 0.012, 2.77, 6.24, 2.03, lod, c.leaf);
  roundWindow(out, axis, 16.9, back + 0.071, 1.82, lod, true);
  plank(out, 'trim', axis, 8.58, back + 0.65, 5.98, 0.42, 0.71, c.trim);
  plank(out, 'trim', axis, 9.04, back + 0.33, 0.94, 1.07, 0.34, c.cream);
  if (lod >= 1) {
    const z = back + 0.34,
      y = 10.14;
    const poly = radialRing(y, 0.36, 0.24, lod === 3 ? 9 : 6, [axis, z]);
    loft(
      out,
      'detail',
      [
        poly,
        radialRing(y + 1.51, 0.32, 0.23, poly.length, [axis, z]),
        radialRing(y + 2.08, 0.266, 0.165, poly.length, [axis, z]),
      ],
      c.statue,
    );
    sphere(out, 'detail', [axis, y + 2.23, z], [0.18, 0.22, 0.145], c.statue, poly.length, 4);
    beam(
      out,
      'detail',
      [axis - 0.65, y + 1.39, z],
      [axis + 0.65, y + 1.39, z],
      0.23,
      0.15,
      c.statue,
    );
  }
  for (const [y, h, d, tint] of [
    [31.95, 0.56, 0.39, c.cream],
    [33.76, 0.63, 0.55, c.trim],
  ])
    plank(out, 'trim', axis, y, faceZ + 0.26, 15.85, h, d, tint);
  crest(out, axis, 34.24, faceZ + 0.05, 3.95, 2.28, lod);
  if (lod > 0) {
    rail(out, axis - 7.2, axis - 4.04, 34.38, faceZ, lod);
    rail(out, axis + 4.04, axis + 7.2, 34.38, faceZ, lod);
  }
  if (lod > 0) plank(out, 'wall', axis, 23.13, back, 15.82, 11.18, 0.55, c.white);
  const treads = [1, 2, 4, 4][lod];
  for (let i = 0; i < treads; i++) {
    const top = 0.77 - (0.76 * i) / treads;
    plank(
      out,
      'stone',
      axis,
      -1.3,
      faceZ + 0.38 + 0.31 * i,
      13.24 + i * 0.46,
      top + 1.3,
      4.24 + 0.31 * i,
      c.base,
    );
  }
}

function crest(out, x, y, z, riseX, riseY, lod) {
  const n = [5, 8, 12, 16][lod];
  for (let i = 0; i < n; i++) {
    const a = arc(x, y, z, riseX, riseY, i / n),
      b = arc(x, y, z, riseX, riseY, (i + 1) / n);
    const a0 = [a[0], y, z],
      b0 = [b[0], y, z];
    if (i === 0) triangle(out, 'wall', [b0, a0, b], c.white);
    else if (i === n - 1) triangle(out, 'wall', [b0, a0, a], c.white);
    else face(out, 'wall', [b0, a0, a, b], c.white);
    face(out, 'trim', [a, b, [b[0], b[1] - 0.22, z + 0.16], [a[0], a[1] - 0.22, z + 0.16]], c.trim);
  }
  if (lod >= 1) plank(out, 'detail', x, y + 0.11, z + 0.12, 0.82, 1.08, 0.16, c.pane);
}

function rail(out, a, b, y, z, lod) {
  const x = (a + b) / 2,
    w = b - a;
  if (lod <= 1) {
    plank(out, 'trim', x, y, z, w, 0.69, 0.36, c.trim);
    return;
  }
  for (const [h, r] of [
    [0, 0.19],
    [0.63, 0.16],
  ])
    plank(out, 'trim', x, y + h, z, w, r, 0.35, c.trim);
  const count = Math.ceil(w / (lod === 2 ? 0.62 : 0.38));
  for (let i = 0; i < count; i++) {
    const p = mix(a, b, (i + 0.5) / count);
    plank(out, 'trim', p, y + 0.2, z - 0.1, 0.14, 0.44, 0.15, c.cream);
  }
}

function cross(out, x, y, z, height, slot = 'detail') {
  beam(out, slot, [x, y, z], [x, y + height, z], 0.14 * height, 0.16 * height, c.bronze);
  beam(
    out,
    slot,
    [x - 0.24 * height, y + 0.64 * height, z],
    [x + 0.24 * height, y + 0.64 * height, z],
    0.13 * height,
    0.14 * height,
    c.bronze,
  );
}

function domeShell(out, x, z, y, radius, height, lod) {
  const smallLowDome = radius < 3 && lod === 0;
  const n = smallLowDome ? 6 : [10, 16, 24, 40][lod];
  const k = smallLowDome ? 2 : [3, 4, 7, 11][lod];
  const rings = Array.from({ length: k + 1 }, (_, i) => {
    const a = (i / k) * Math.PI * 0.49;
    const r = radius * Math.cos(a);
    return radialRing(y + height * Math.sin(a), r, r, n, [x, z]);
  });
  loft(out, 'dome', rings, c.cap);
  if (lod < 2) return;
  const count = lod === 3 ? 16 : 8;
  for (let i = 0; i < count; i++) {
    const th = (i * 2 * Math.PI) / count;
    for (let j = 0; j < k; j++) {
      const at = (t) => [
        x + radius * Math.cos(t) * Math.cos(th),
        y + height * Math.sin(t),
        z + radius * Math.cos(t) * Math.sin(th),
      ];
      const a = at((j * Math.PI * 0.49) / k),
        b = at(((j + 1) * Math.PI * 0.49) / k);
      beam(out, 'detail', a, b, 0.026 * radius, 0.013 * radius, c.seam);
    }
  }
}

/** The soffits, return piers and interior faces keep actual daylight through the belfry. */
function bellArcade(out, half, height, lod) {
  const base = 34.14,
    spring = base + height * 0.54,
    top = base + height,
    depth = 0.72;
  const radius = half * 0.32,
    n = [4, 7, 10, 14][lod];
  const centers = [-half * 0.455, half * 0.455];
  const limits = [-half, ...centers.flatMap((v) => [v - radius, v + radius]), half];
  for (const [a, b] of [
    [limits[0], limits[1]],
    [limits[2], limits[3]],
    [limits[4], limits[5]],
  ]) {
    plank(out, 'wall', (a + b) / 2, base, half, b - a, height, depth, c.cream);
    if (lod >= 2)
      plank(
        out,
        'trim',
        (a + b) / 2,
        spring - 0.14,
        half + 0.13,
        b - a + 0.21,
        0.23,
        depth + 0.2,
        c.trim,
      );
  }
  for (const x of centers) {
    const h = height * 0.285;
    for (let i = 0; i < n; i++) {
      const a = arc(x, spring, half, radius, h, (i + 1) / n),
        b = arc(x, spring, half, radius, h, i / n);
      const capA = [a[0], top, half],
        capB = [b[0], top, half];
      face(out, 'wall', [a, b, capB, capA], c.cream);
      face(
        out,
        'wall',
        [capA, capB, b, a].map(([u, y, z]) => [u, y, z - depth]),
        c.shade,
      );
    }
    archCeiling(out, x, spring, half, half - depth, radius, radius, h, h, lod);
    if (lod >= 2)
      for (let i = 0; i < n; i++) {
        const a = i / n,
          b = (i + 1) / n;
        face(
          out,
          'trim',
          [
            arc(x, spring, half + 0.075, radius + 0.12, h + 0.12, a),
            arc(x, spring, half + 0.075, radius + 0.12, h + 0.12, b),
            arc(x, spring, half + 0.07, radius, h, b),
            arc(x, spring, half + 0.07, radius, h, a),
          ],
          c.trim,
        );
      }
  }
}

function lowTower(out, range) {
  const [a, b, , front] = range;
  const back = 39.84,
    x = (a + b) / 2,
    z = (back + front) / 2,
    r = (b - a) / 2;
  plank(out, 'wall', x, -2.35, front, 2 * r, 35.73, front - back, c.cream);
  plank(out, 'trim', x, 33.38, front + 0.22, 2 * r + 0.44, 0.64, front - back + 0.44, c.trim);
  const h = r - 0.37,
    bottom = 34.02,
    spring = 39.33,
    top = 42.78;
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const local = transform(out, angle, [x, 0, z]);
    for (const [lo, hi] of [
      [-h, -h * 0.74],
      [-h * 0.18, h * 0.18],
      [h * 0.74, h],
    ])
      rect(local, 'wall', (lo + hi) / 2, bottom, h, (hi - lo) / 2, top - bottom, c.cream);
    for (const cx of [-h * 0.46, h * 0.46]) {
      const width = h * 0.28;
      for (let j = 0; j < 3; j++) {
        const a = arc(cx, spring, h, width, 2.46, (j + 1) / 3),
          b = arc(cx, spring, h, width, 2.46, j / 3);
        face(local, 'wall', [a, b, [b[0], top, h], [a[0], top, h]], c.cream);
      }
    }
    rect(local, 'trim', 0, top, h + 0.11, h + 0.14, 0.94, c.trim);
  }
  plank(out, 'trim', x, 43.68, z + r, 2 * r, 0.88, 2 * r, c.cream);
  domeShell(out, x, z, 44.5, 2.4, 2.86, 0);
  cross(out, x, 47.36, z, plan.dimensions.bellTowers - 47.36);
}

function tower(out, range, lod) {
  if (lod === 0) {
    lowTower(out, range);
    return;
  }
  const [left, right, , front] = range;
  const x = (left + right) / 2,
    back = 39.84;
  const z = (back + front) / 2,
    w = right - left,
    d = front - back;
  const half = (w - 0.67) / 2;
  plank(out, 'stone', x, -2.35, front, w, 6.92, d, c.base);
  plank(out, 'wall', x, 4.55, front, w, 28.85, d, c.cream);
  if (lod >= 2) {
    // Tall plain shafts, with shallow surface panels and the small service openings on the side.
    for (const angle of [-Math.PI / 2, Math.PI / 2]) {
      const local = transform(out, angle, [x, 0, z]);
      for (const y of [8.8, 13.48, 18.17, 22.86, 27.55])
        rect(local, 'detail', 0.51, y, w / 2 + 0.018, 0.085, 0.19, c.shade);
    }
    for (const s of [-1, 1])
      plank(out, 'trim', x + s * (w / 2 - 0.31), 4.53, front + 0.08, 0.44, 28.35, 0.29, c.white);
  }
  for (const [y, h, b, t] of [
    [32.96, 0.58, 1.01, c.shade],
    [33.54, 0.65, 1.34, c.trim],
    [42.65, 0.58, 0.91, c.cream],
    [43.26, 0.52, 1.04, c.trim],
  ]) {
    plank(out, 'trim', x, y, z + (d + b) / 2, w + b, h, d + b, t);
  }
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    bellArcade(transform(out, angle, [x, 0, z]), half, 8.65, lod);
  if (lod >= 2) {
    for (const offset of [-1.58, 1.58]) {
      const rings = [
        [37.44, 0.92],
        [37.63, 0.71],
        [38.04, 0.58],
        [39.07, 0.42],
        [39.25, 0.27],
      ];
      loft(
        out,
        'detail',
        rings.map(([y, r]) => radialRing(y, r, r, 12, [x + offset, z])),
        c.bronze,
      );
      beam(out, 'detail', [x + offset, 39.23, z], [x + offset, 42.69, z], 0.13, 0.13, c.beam);
    }
  }
  const k = half + 0.25;
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    rail(transform(out, angle, [x, 0, z]), -k, k, 43.76, k, lod);
  for (const dx of [-k, k])
    for (const dz of [-k, k]) {
      plank(out, 'trim', x + dx, 43.64, z + dz + 0.31, 0.52, 1.22, 0.56, c.trim);
      loft(
        out,
        'trim',
        [
          radialRing(44.82, 0.26, 0.26, 5, [x + dx, z + dz]),
          radialRing(45.25, 0.048, 0.048, 5, [x + dx, z + dz]),
        ],
        c.cream,
      );
    }
  const drum = [
    [43.75, 2.75],
    [44.32, 2.75],
    [44.91, 2.49],
  ];
  loft(
    out,
    'trim',
    drum.map(([y, r]) => radialRing(y, r, r, 12, [x, z])),
    c.white,
  );
  domeShell(out, x, z, 44.87, 2.52, 2.65, lod >= 2 ? 1 : 0);
  plank(out, 'trim', x, 47.5, z + 0.22, 0.49, 0.64, 0.44, c.trim);
  cross(out, x, 48.15, z, plan.dimensions.bellTowers - 48.15);
}

function roofPolygon(out, points, y, slot, tint) {
  const idx = earcut(points.flat());
  for (let i = 0; i < idx.length; i += 3) {
    triangle(
      out,
      slot,
      [idx[i + 2], idx[i + 1], idx[i]].map((j) => [points[j][0], y, points[j][1]]),
      tint,
    );
  }
}

const simplifiedPlan = [
  0, 21, 22, 31, 33, 34, 48, 49, 51, 53, 54, 56, 57, 59, 61, 62, 76, 78, 79, 88, 89, 90, 110,
];
function naveBound(out, lod) {
  const pointIds = lod >= 2 ? outline.map((_, i) => i) : simplifiedPlan;
  const end = 39.84;
  const cover = [];
  for (let slot = 0; slot < pointIds.length; slot++) {
    const i = pointIds[slot];
    const a = outline[i],
      b = outline[pointIds[(slot + 1) % pointIds.length]];
    if (a[1] < end) cover.push(a);
    if (a[1] < end !== b[1] < end) cover.push([mix(a[0], b[0], (end - a[1]) / (b[1] - a[1])), end]);
    if (i >= 48 && i <= 61) continue;
    const [x, z] = a,
      [u, v] = b;
    const ga = ground(x, z),
      gb = ground(u, v);
    face(
      out,
      'stone',
      [
        [u, gb - 0.64, v],
        [x, ga - 0.64, z],
        [x, ga + 1.23, z],
        [u, gb + 1.23, v],
      ],
      c.base,
    );
    face(
      out,
      'wall',
      [
        [u, gb + 1.23, v],
        [x, ga + 1.23, z],
        [x, sideWallTop, z],
        [u, sideWallTop, v],
      ],
      c.white,
    );
    const length = Math.hypot(x - u, z - v);
    if (lod > 1 && length > 2.6) {
      const frame = transform(out, Math.atan2(v - z, x - u), [u, 0, v]);
      plank(frame, 'trim', length / 2, 22.93, 0.26, length + 0.015, 0.43, 0.43, c.trim);
      plank(frame, 'trim', length / 2, 23.6, 0.36, length + 0.025, 0.51, 0.48, c.cream);
    }
  }
  roofPolygon(out, cover, 24.03, 'wall', c.deck);
}

function sideBays(out, lod) {
  const lengths = [-27.45, -21.14, -14.98, -8.94, -2.5, 17.7, 23.99, 30.36, 36.7];
  for (const s of [-1, 1]) {
    for (const z of lengths) {
      const x = axis + s * (z < 0 ? 17.86 : 14.25);
      const wrap = transform(out, (s * Math.PI) / 2, [x, 0, z]);
      const lower = Math.max(4.85, ground(x, z) + 2.6);
      if (lod === 1) {
        rect(wrap, 'detail', 0, lower, 0.061, 1.03, 11.6, c.pane);
        const z = 0.061;
        triangle(
          wrap,
          'detail',
          [
            [-1.03, lower + 11.6, z],
            [1.03, lower + 11.6, z],
            [0, lower + 12.35, z],
          ],
          c.pane,
        );
      } else {
        archedWindow(wrap, 0, lower, 0.066, 1.22, 16.7, 1.55, lod, z < 0 ? c.paneBlue : c.pane);
      }
      if (lod >= 2) roundWindow(wrap, 0, 20.57, 0.029, 0.47, lod);
    }
    const x = axis + s * 30.83;
    const crossWing = transform(out, (s * Math.PI) / 2, [x, 0, 7.63]);
    plank(
      crossWing,
      'wall',
      0,
      Math.max(-2, ground(x, 7.63) - 0.6),
      0.42,
      6.82,
      22.7,
      0.77,
      c.cream,
    );
    archedWindow(crossWing, 0, 7.73, 0.45, 1.7, 16.42, 1.82, lod);
    plank(
      crossWing,
      'detail',
      0,
      Math.max(1.24, ground(x, 7.63) + 0.21),
      0.49,
      2.51,
      4.15,
      0.15,
      c.leaf,
    );
    plank(crossWing, 'trim', 0, 6.43, 0.79, 3.47, 0.36, 0.48, c.trim);
    crest(crossWing, 0, 23.92, 0.127, 3, 1.12, lod);
    if (lod >= 2)
      for (const z of [-23.99, -17.77, -11.58, -5.43, 20.91, 27.24, 33.54]) {
        const p = transform(out, (s * Math.PI) / 2, [axis + s * (z < 0 ? 18.65 : 14.97), 0, z]);
        plank(p, 'trim', 0, 20.3, 0.21, 0.57, 3.8, 0.46, c.cream);
      }
  }
  const back = transform(out, Math.PI, [axis, 0, -31.8]);
  for (const x of [-10.1, 0, 10.1]) archedWindow(back, x, 8.1, 0.045, 1.38, 16.42, 1.62, lod);
}

function longRoof(out, lod) {
  // Metal-clad nave ridge is above the shallow concrete transept and apse roofs.
  const x = axis,
    w = 8.8,
    y = 24.05,
    top = 29.12,
    a = -26.5,
    b = 39.72;
  const p = [x, top, a],
    q = [x, top, b];
  face(out, 'roof', [[x - w, y, a], [x - w, y, b], q, p], c.sheet);
  face(out, 'roof', [[x + w, y, b], [x + w, y, a], p, q], c.sheet);
  triangle(out, 'wall', [[x + w, y, a], [x - w, y, a], p], c.white);
  triangle(out, 'wall', [[x - w, y, b], [x + w, y, b], q], c.white);
  if (lod >= 1) beam(out, 'dome', p, q, 0.26, 0.21, c.beam);
  if (lod >= 2) {
    for (const z of [18.4, 24.45, 30.74, 37.09]) {
      for (const s of [-1, 1]) {
        const wall = transform(out, (s * Math.PI) / 2, [axis + s * 14.24, 0, z]);
        rail(wall, -2.32, 2.32, 24.02, 0.24, lod);
      }
    }
  }
}

function crossingDome(out, lod) {
  const z = 3.95,
    r = 11.56,
    n = [10, 16, 24, 40][lod];
  const levels = [
    [23.95, r + 0.34],
    [25.42, r + 0.38],
    [26.04, r - 0.15],
    [32.0, r - 0.15],
    [32.53, r + 0.05],
    [32.94, r + 0.05],
  ];
  loft(
    out,
    'wall',
    levels.map(([y, radius]) => radialRing(y, radius, radius, n, [axis, z])),
    c.cream,
  );
  const pairs = lod === 0 ? 6 : lod === 1 ? 8 : 12;
  for (let i = 0; i < pairs; i++) {
    const a = (i * 2 * Math.PI) / pairs;
    const facing = transform(out, a, [axis, 0, z]);
    for (const x of [-0.7, 0.7])
      if (lod < 2) rect(facing, 'detail', x, 27.36, r - 0.079, 0.45, 3.18, c.paneBlue);
      else archedWindow(facing, x, 27.36, r - 0.079, 0.45, 30.12, 0.58, lod, c.paneBlue);
    if (lod >= 2) plank(facing, 'trim', 0, 26.25, r + 0.11, 0.2, 5.72, 0.3, c.trim);
  }
  domeShell(out, axis, z, 32.87, r + 0.08, 9.94, lod);
  loft(
    out,
    'trim',
    [
      [42.26, 1.03],
      [42.83, 0.81],
      [43.52, 0.75],
      [43.84, 0.54],
    ].map(([y, r]) => radialRing(y, r, r, 12, [axis, z])),
    c.cream,
  );
  cross(out, axis, 43.82, z, plan.dimensions.cupola - 43.82);
}

function build(out, lod) {
  naveBound(out, lod);
  longRoof(out, lod);
  if (lod > 0) sideBays(out, lod);
  crossingDome(out, lod);
  plazaEntrance(out, lod);
  for (const span of towerOffsets) tower(out, span, lod);
}

export const sanSalvadorSkyline = (out) => build(out, 0);
export const sanSalvadorDistrict = (out) => build(out, 1);
export const sanSalvadorStreet = (out) => build(out, 2);
export const sanSalvadorCloseup = (out) => build(out, 3);

const recipe = 'san-salvador-cathedral-model.mjs';
const camera = [78, 53, 125],
  lookAt = [0, 22, 10];
const plaza = { position: [0.6, 5.5, 97], lookAt: [axis, 22.8, 43.1] };
export const sanSalvadorModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: sanSalvadorCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Native cathedral polygon includes front tower feet, buttresses and transverse wings.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The cathedral above Plaza Gerardo Barrios with a deeply recessed portal, two open belfries, and a large ribbed crossing dome.',
  camera,
  lookAt,
  sunDirection: [-28, 43, 56],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.62,
    cameraYaw: 0.09,
    focus: { center: [axis, 12, 7] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'portal-and-twin-belfries-from-plaza', ...plaza },
    {
      name: 'recessed-portal-rose-window-and-doors',
      position: [-12, 4.35, 67],
      lookAt: [axis, 13.4, 41.2],
    },
    { name: 'paired-open-bell-arcades', position: [40, 42, 78], lookAt: [1, 39, 39.4] },
    { name: 'crossing-dome-and-transept-roofs', position: [-67, 60, -47], lookAt: [axis, 24, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'sanSalvadorSkyline',
    errorMeters: 2.23,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'sanSalvadorDistrict', 0.86],
        ['street', 'sanSalvadorStreet', 0.27],
        ['closeup', 'sanSalvadorCloseup', 0.075],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original model with OpenStreetMap ODbL 1.0 data and verified CC0 reference photographs by the Presidency of El Salvador.',
  limitations: plan.limitations,
};
