/** Thean Hou Temple's hilltop podium, double-roof gate and upper prayer court. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const court = plan.courtLevel;
const surfaces = {
  stucco: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.76, metallic: 0.02 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.035 },
  pavement: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    plaster: 'c5b9a0',
    pale: 'ded9c9',
    base: 'a89e8b',
    pavement: 'b4b0a4',
    shade: '595c55',
    red: 'a84130',
    deepRed: '81372c',
    green: '456257',
    greenLight: '698477',
    gold: 'ba8c48',
    tile: 'ae783a',
    tileLower: '9a6634',
    ridge: 'ba833d',
    eave: '875333',
    under: '51483b',
    panel: '344a45',
    beam: '493c34',
    bronze: '846946',
    blue: '5c777a',
  }).map(([k, v]) => [k, rgb(v)]),
);

const up = [0, 1, 0];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const crossArea = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
function directed(out, slot, p, normal, tint) {
  const sign = normalFor(...p).reduce((sum, v, i) => sum + v * normal[i], 0);
  const vertices = sign >= 0 ? p : p.toReversed();
  if (vertices.length === 3) triangle(out, slot, vertices, tint);
  else face(out, slot, vertices, tint);
}
function slab(out, ring, y, slot, tint) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3)
    directed(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      up,
      tint,
    );
}
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    r = terrain.heightsMeters[j],
    n = terrain.heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * r[i] + a * r[i + 1]) +
    b * ((1 - a) * n[i] + a * n[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}
function block(out, slot, x, z, w, d, low, high, tint) {
  box(out, slot, [x - w / 2, low, z - d / 2], [x + w / 2, high, z + d / 2], tint);
}
function column(out, x, z, low, high, radius, lod, tint = c.red) {
  const sides = [4, 6, 9, 12][lod];
  if (lod <= 1) {
    block(out, 'trim', x, z, radius * 1.68, radius * 1.68, low, high, tint);
    return;
  }
  const profile = [
    [low, 1.36],
    [low + 0.24, 1.36],
    [low + 0.33, 1.0],
    [high - 0.24, 0.91],
    [high, 1.23],
  ];
  loft(
    out,
    'trim',
    profile.map(([y, r]) => radialRing(y, r * radius, r * radius, sides, [x, z])),
    tint,
  );
}
function panel(out, a, b, low, high, normal, slot, tint) {
  directed(
    out,
    slot,
    [
      [a[0], low, a[1]],
      [b[0], low, b[1]],
      [b[0], high, b[1]],
      [a[0], high, a[1]],
    ],
    normal,
    tint,
  );
}

const podiumOutline = outline.filter((_, i) => i !== 6 && i !== 7);
function podium(out, lod) {
  slab(out, podiumOutline, court, 'pavement', c.pavement);
  const orientation = Math.sign(crossArea(podiumOutline));
  for (const [i, a] of podiumOutline.entries()) {
    const b = podiumOutline[(i + 1) % podiumOutline.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    const normal = [(orientation * dz) / L, 0, (-orientation * dx) / L];
    const p = (t, y, shift = 0) => [
      a[0] + t * dx + shift * normal[0],
      y,
      a[1] + t * dz + shift * normal[2],
    ];
    const count = lod ? Math.max(1, Math.ceil(L / 5.8)) : 1;
    for (let j = 0; j < count; j++) {
      const u = j / count,
        v = (j + 1) / count;
      const foot = (t) => {
        const [x, , z] = p(t, 0);
        return p(t, Math.min(court - 0.24, grade(x, z) - 0.3));
      };
      directed(
        out,
        'stucco',
        [foot(u), foot(v), p(v, court), p(u, court)],
        normal,
        i < 8 ? c.plaster : c.base,
      );
    }
    if (!lod || L < 3.4) continue;
    for (const y of [-10.0, -5.2, -0.36, 4.46]) {
      for (let j = 0; j < count; j++) {
        const u = j / count,
          v = (j + 1) / count;
        const [x, , z] = p((u + v) / 2, 0);
        if (grade(x, z) > y - 0.55) continue;
        directed(
          out,
          'stone',
          [p(u, y - 0.22, 0.13), p(v, y - 0.22, 0.13), p(v, y, 0.13), p(u, y, 0.13)],
          normal,
          c.pale,
        );
        if (lod >= 2 && L / count > 3.6 && y !== 4.46) {
          for (const k of [0.31, 0.69]) {
            const mid = u + (v - u) * k,
              half = Math.min(0.74 / L, (v - u) * 0.2);
            directed(
              out,
              'dark',
              [
                p(mid - half, y + 0.32, 0.019),
                p(mid + half, y + 0.32, 0.019),
                p(mid + half, y + 2.06, 0.019),
                p(mid - half, y + 2.06, 0.019),
              ],
              normal,
              c.shade,
            );
          }
        }
      }
    }
  }
}

function stairs(out, x, z0, z1, w, base, top, steps, lod) {
  const n = lod >= 2 ? steps : lod === 1 ? Math.ceil(steps / 2) : 3;
  const dz = (z1 - z0) / n,
    dy = (top - base) / n;
  for (let i = 0; i < n; i++) {
    const a = z0 + i * dz,
      b = z0 + (i + 1) * dz,
      y = base + (i + 1) * dy;
    const p = [x - w / 2, y, a],
      q = [x + w / 2, y, a],
      r = [x + w / 2, y, b],
      s = [x - w / 2, y, b];
    directed(out, 'stone', [p, q, r, s], up, c.pale);
    directed(
      out,
      'stone',
      [[p[0], y - dy, a], [q[0], y - dy, a], q, p],
      [0, 0, Math.sign(z0 - z1)],
      c.base,
    );
    for (const [front, back, side] of [
      [p, s, -1],
      [q, r, 1],
    ]) {
      const foot = ([x, , z]) => [x, Math.min(base - 0.23, grade(x, z) - 0.22), z];
      directed(out, 'stone', [foot(front), foot(back), back, front], [side, 0, 0], c.base);
    }
  }
}
function rail(out, a, b, low, lod) {
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const pt = ([x, z], y) => [x, y, z];
  const n = lod >= 2 ? Math.max(2, Math.round(length / 1.0)) : Math.max(1, Math.round(length / 4));
  for (const y of [low + 0.16, low + 0.99]) {
    if (!lod && y < low + 0.8) continue;
    beam(out, 'stone', pt(a, y), pt(b, y), 0.23, 0.19, c.pale);
  }
  for (let i = 0; i <= n; i++) {
    const [x, z] = mix(a, b, i / n),
      width = lod >= 2 && i % 4 !== 0 ? 0.105 : 0.27;
    block(out, 'stone', x, z, width, width, low + 0.12, low + 1.035, c.pale);
  }
}
function approach(out, lod) {
  const { base, front, back, width } = plan.approach;
  stairs(out, 0, front, back, width, base, court, 42, lod);
  for (const side of [-1, 1]) {
    const a = [(side * width) / 2, front],
      b = [(side * width) / 2, back];
    const d = [side * 11.44, front],
      e = [side * 11.53, back];
    const platform = ([x, z], y) => [x, y, z];
    directed(
      out,
      'pavement',
      [platform(a, base), platform(d, base), platform(e, court), platform(b, court)],
      up,
      c.pavement,
    );
    for (const [p, q, n] of [
      [a, b, -side],
      [d, e, side],
    ]) {
      const foot = ([x, z]) => [x, Math.min(base - 0.22, grade(x, z) - 0.24), z];
      directed(
        out,
        'stucco',
        [foot(p), foot(q), platform(q, court), platform(p, base)],
        [n, 0, 0],
        c.base,
      );
    }
    const foot = ([x, z]) => [x, Math.min(base - 0.22, grade(x, z) - 0.24), z];
    directed(
      out,
      'stucco',
      [foot(a), foot(d), platform(d, base), platform(a, base)],
      [0, 0, 1],
      c.base,
    );
    if (lod) {
      const p = platform(d, base + 0.8),
        q = platform(e, court + 0.8);
      beam(out, 'stone', p, q, 0.26, 0.26, c.pale);
      for (let i = 0; i <= 7; i++) {
        const t = i / 7,
          [x, y, z] = mix(p, q, t);
        block(out, 'stone', x, z, 0.22, 0.22, y - 0.82, y + 0.06, c.pale);
      }
    }
  }
}

function roof(out, { x, z, w, d, low, rise, angle = 0 }, lod, tint = c.tile) {
  const n = [2, 2, 5, 6][lod];
  const points = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const profile =
    lod === 0
      ? [
          [0, 1, 1, 0.21],
          [1, 0.63, 0.013, 0.08],
        ]
      : lod === 1
        ? [
            [0, 1, 1, 0.25],
            [0.46, 0.84, 0.64, 0.16],
            [1, 0.63, 0.013, 0.08],
          ]
        : [
            [0, 1, 1, 0.25],
            [0.2, 0.94, 0.86, 0.22],
            [0.49, 0.82, 0.62, 0.15],
            [0.76, 0.72, 0.34, 0.11],
            [1, 0.63, 0.013, 0.08],
          ];
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const p = (u, y, v) => [x + u * cos - v * sin, y, z + u * sin + v * cos];
  const rings = profile.map(([height, width, depth, sweep]) =>
    points.flatMap((a, i) =>
      Array.from({ length: n }, (_, j) => {
        const t = j / n,
          [u, v] = mix(a, points[(i + 1) % 4], t);
        const curl = Math.pow(Math.abs(1 - 2 * t), 3) * rise * sweep;
        return p((u * w * width) / 2, low + rise * height + curl, (v * d * depth) / 2);
      }),
    ),
  );
  for (let k = 1; k < rings.length; k++) {
    for (let i = 0; i < rings[k].length; i++) {
      const j = (i + 1) % rings[k].length;
      directed(
        out,
        'tile',
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        up,
        k === 1 ? tint : c.tile,
      );
    }
  }
  const start = rings[0];
  for (let i = 0; i < start.length; i++) {
    const a = start[i],
      b = start[(i + 1) % start.length];
    directed(out, 'trim', [p(0, low - 0.16, 0), b, a], [0, -1, 0], c.under);
    if (lod >= 2) beam(out, 'tile', a, b, 0.2, 0.15, c.eave);
  }
  const ridgeH = low + rise + 0.105,
    half = w * 0.318;
  beam(out, 'tile', p(-half, ridgeH, 0), p(half, ridgeH, 0), 0.25, 0.27, c.ridge);
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      const a = p(side * (half - 0.27), ridgeH, 0),
        b = p(side * (half + 0.26), ridgeH + rise * 0.11, 0);
      beam(out, 'tile', a, b, 0.22, 0.25, c.ridge);
      const t = p(side * (half + 0.42), ridgeH + rise * 0.22, 0);
      beam(out, 'tile', b, t, 0.145, 0.18, c.gold);
    }
    for (const corner of [0, n, 2 * n, 3 * n]) {
      const q = start[corner];
      const lift = [q[0], q[1] + rise * 0.18, q[2]];
      beam(out, 'tile', q, lift, 0.13, 0.16, c.ridge);
    }
  }
}
function lintel(out, x, z, w, d, top, lod) {
  block(out, 'trim', x, z, w, d, top - 0.83, top, c.green);
  if (!lod) return;
  for (const y of [top - 0.68, top - 0.23])
    block(out, 'trim', x, z, w + 0.14, d + 0.07, y - 0.062, y, c.gold);
  if (lod >= 2) {
    for (let i = 0; i < Math.round(w / 1.1); i++) {
      const q = x - w / 2 + 0.55 + i * 1.1;
      block(out, 'trim', q, z + d / 2 + 0.018, 0.17, 0.092, top - 0.6, top - 0.26, c.greenLight);
    }
  }
}

function gate(out, lod) {
  const g = plan.gate;
  for (const dx of [-8.08, -4.31, 4.31, 8.08]) {
    column(out, g.x + dx, g.z - 1.51, court, g.eave - 0.7, 0.38, lod);
    if (lod) column(out, g.x + dx, g.z + 1.53, court, g.eave - 0.7, 0.34, lod);
  }
  lintel(out, g.x, g.z, 18.8, 3.9, g.eave, lod);
  if (lod) block(out, 'trim', g.x, g.z + 1.98, 5.55, 0.095, g.eave - 0.76, g.eave - 0.26, c.panel);
  roof(out, { x: g.x, z: g.z, w: g.width, d: g.depth, low: g.eave, rise: g.rise }, lod);
  block(
    out,
    'trim',
    g.x,
    g.z,
    g.upperWidth * 0.7,
    g.upperDepth * 0.61,
    g.eave + 1.47,
    g.upperEave + 0.1,
    c.deepRed,
  );
  roof(
    out,
    { x: g.x, z: g.z, w: g.upperWidth, d: g.upperDepth, low: g.upperEave, rise: g.upperRise },
    lod,
  );
}
function gallery(out, x, z, w, d, lod, angle = 0) {
  const roofY = court + 3.75;
  const long = angle === 0 ? w : d;
  const offsets = lod >= 2 ? [-0.43, -0.24, 0, 0.24, 0.43] : [-0.41, 0.41];
  for (const t of offsets) {
    const px = angle === 0 ? x + w * t : x,
      pz = angle === 0 ? z : z + d * t;
    column(out, px, pz, court, roofY - 0.24, 0.22, lod);
  }
  block(out, 'trim', x, z, w * 0.94, d * 0.89, roofY - 0.37, roofY, c.green);
  roof(
    out,
    { x, z, w: long, d: angle === 0 ? d : w, low: roofY, rise: 1.52, angle },
    lod,
    c.tileLower,
  );
}
function tower(out, x, z, lod) {
  const tiers = lod === 0 ? [0, 2] : [0, 1, 2];
  for (const i of tiers) {
    const y = court + i * 3.0,
      w = 7.3 - i * 1.15;
    block(
      out,
      'stucco',
      x,
      z,
      w * 0.67,
      w * 0.66,
      !lod && i === 2 ? y - 3 : y,
      y + 2.72,
      i === 0 ? c.plaster : c.deepRed,
    );
    if (lod)
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          column(out, x + a * w * 0.35, z + b * w * 0.34, y, y + 2.79, 0.16, lod);
    roof(out, { x, z, w, d: w * 0.91, low: y + 2.72, rise: 1.38 - i * 0.1 }, lod, c.tileLower);
  }
}
function hall(out, lod) {
  const h = plan.hall,
    y = court + 1.04,
    front = h.z + h.depth * 0.48,
    back = h.z - h.depth * 0.41;
  block(out, 'stone', h.x, h.z, h.width * 0.88, h.depth * 0.87, court, y, c.pale);
  stairs(out, h.x, front + 2.1, front - 0.6, 9.75, court, y, 6, lod);
  block(out, 'stucco', h.x, back + 4.33, 24.3, 10.2, y, h.eave - 0.4, c.plaster);
  const xs = lod >= 1 ? [-10.35, -6.9, -3.45, 0, 3.45, 6.9, 10.35] : [-9.9, -3.3, 3.3, 9.9];
  for (const dx of xs) column(out, h.x + dx, front - 0.99, y, h.eave - 0.8, 0.42, lod, c.pale);
  for (const dx of [-9.75, -4.84, 0, 4.84, 9.75]) {
    const x = h.x + dx,
      z = back + 9.47;
    panel(out, [x - 1.56, z], [x + 1.56, z], y + 0.25, h.eave - 1.04, [0, 0, 1], 'dark', c.panel);
    if (lod) {
      for (const d of [-1.49, 1.49])
        beam(
          out,
          'trim',
          [x + d, y + 0.28, z + 0.04],
          [x + d, h.eave - 1.05, z + 0.04],
          0.1,
          0.1,
          c.gold,
        );
    }
  }
  lintel(out, h.x, front - 0.95, 25.1, 1.74, h.eave, lod);
  roof(out, { x: h.x, z: h.z, w: h.width, d: h.depth, low: h.eave, rise: h.rise }, lod);
  block(
    out,
    'stone',
    h.x,
    h.z + h.upperDepth * 0.42,
    h.upperWidth * 0.94,
    h.upperDepth * 0.26,
    h.eave + 1.93,
    h.eave + 2.11,
    c.pale,
  );
  block(
    out,
    'stucco',
    h.x,
    h.z,
    h.upperWidth * 0.86,
    h.upperDepth * 0.8,
    h.eave + 1.9,
    h.upperEave + 0.06,
    c.pale,
  );
  roof(
    out,
    { x: h.x, z: h.z, w: h.upperWidth, d: h.upperDepth, low: h.upperEave, rise: h.upperRise },
    lod,
  );
  if (lod) {
    for (const side of [-1, 1]) {
      rail(out, [h.x + side * 6.12, front + 0.61], [h.x + side * 11.88, front + 0.61], y, lod);
      rail(
        out,
        [h.x + side * 7.1, h.z + h.upperDepth * 0.53],
        [h.x + side * 11.3, h.z + h.upperDepth * 0.53],
        h.eave + 2.1,
        lod,
      );
    }
  }
}

function build(out, lod) {
  podium(out, lod);
  approach(out, lod);
  gate(out, lod);
  hall(out, lod);
  for (const side of [-1, 1]) {
    gallery(out, side * 16.83, 16.0, 10.2, 5.6, lod);
    gallery(out, side * 21.75, 5.3, 4.45, 17.0, lod, Math.PI / 2);
    tower(out, side * 17.6, -5.47, lod);
    if (lod) {
      rail(out, [side * 10.7, 18.95], [side * 22.25, 18.95], court, lod);
      rail(out, [side * 23.4, 16.6], [side * 23.4, 1.0], court, lod);
    }
  }
}
export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);

const recipe = 'thean-hou-temple-model.mjs',
  camera = [53, 38, 72],
  lookAt = [0, 6.9, -1.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'templeDistrict', 0.63],
    ['street', 'templeStreet', 0.22],
    ['closeup', 'templeCloseup', 0.06],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: templeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Raised white hilltop temple court with red columns, swept amber roofs, a double-tier gate and flanking galleries.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [22, 28, 31],
  mediumFiContext: {
    scale: 2.12,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'The named aggregate Thean Hou Temple footprint in OpenStreetMap way 453802547.',
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'stone_limestone_raw',
    'tile_glazed',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    { name: 'gate-and-stepped-hill-approach', position: [-9, 18, 72], lookAt: [0, 7.1, 18.5] },
    {
      name: 'upper-court-and-prayer-hall',
      position: [4.1, 12.0, 11.4],
      lookAt: [-0.5, 12.6, -13.5],
    },
    { name: 'west-podium-and-swept-roof-ranges', position: [-72, 31, 13], lookAt: [0, 4.5, -2.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-thean-hou-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped building outline is ODbL. The three exact Qualla photographs were released to the public domain by their photographer.',
};
