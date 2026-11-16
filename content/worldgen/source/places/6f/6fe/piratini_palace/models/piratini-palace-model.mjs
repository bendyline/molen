/** Standing exterior of the government palace in Porto Alegre. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const {
  outline,
  holes: [yard],
} = read('map-frame').geometry;
const terrain = read('terrain-grid');
const {
  foundation,
  frontCenter,
  threshold,
  stoneBaseTop,
  balconyY,
  friezeBase,
  governmentDeck,
  governmentParapet,
  residentialDeck,
  residentialParapet,
  connectingDeck,
  ionicColumnOffsets,
  plazaBayOffsets,
} = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  base: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.84, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.94, metallic: 0.07 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.19 },
  dark: { slot: 'trim', localRef: 'palette:#fdfcff', roughness: 0.58, metallic: 0 },
};
const tones = Object.fromEntries(
  Object.entries({
    wall: 'dfd6c2',
    pale: 'e4dbc5',
    trim: 'e7dfc9',
    base: 'a8a197',
    sill: 'c1b6a1',
    roof: '938d80',
    glass: '65717a',
    shadow: '464846',
    dark: '41413d',
    iron: '56544c',
    ground: '97917f',
    muted: 'bcb2a0',
    shield: 'cfc0a6',
  }).map(([key, value]) => [key, rgb(value)]),
);

const up = [0, 1, 0];
const placement = 'palette:#ffffff';
const frontZ = outline[7][1];
const pointAtZ = (a, b, z) => [a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]), z];
const westCourtCut = pointAtZ(yard[2], yard[3], outline[4][1]);
const eastCourtCut = pointAtZ(yard[1], yard[0], outline[11][1]);
const northRange = [outline[6], outline[7], outline[8], outline[9]];
const southRange = [
  ...outline.slice(12),
  ...outline.slice(0, 5),
  westCourtCut,
  yard[3],
  yard[0],
  eastCourtCut,
  outline[11],
];
const passages = [
  [outline[5], yard[2], westCourtCut, outline[4]],
  [outline[10], outline[11], eastCourtCut, yard[1]],
];
const courtyard = [yard[0], yard[1], yard[2], yard[3]];
const at3d = ([x, z], y) => [x, y, z];

function heightAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (k) =>
    terrain.heightsMeters[k][i] +
    (terrain.heightsMeters[k][i + 1] - terrain.heightsMeters[k][i]) * (u - i);
  return row(j) + (row(j + 1) - row(j)) * (v - j) - terrain.modelDatumElevationMeters;
}

function face(out, slot, vertices, toward, color = tones[slot]) {
  let points = vertices;
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * toward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      placement,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function roofCap(out, slot, ring, y, color = tones[slot]) {
  // The runtime authoring adapter exposes triangles and quads. Both build paths share
  // the kernel's triangulation for the concave court-side residential roof.
  const cap = new MeshBufferBuilder();
  const uv = ([x, , z]) => [x, z];
  if (
    !cap.addCap(
      slot,
      placement,
      ring,
      [],
      () => y,
      up,
      ([x, z]) => [x, z],
      color,
    )
  )
    throw Error('Could not close a palace roof or terrace');
  const { indices, positions } = cap.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    out.addTriangle(slot, placement, triangle, up, triangle.map(uv), color);
  }
}

function signedArea(ring) {
  return ring.reduce((sum, [x, z], i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + x * b[1] - z * b[0];
  }, 0);
}

function edges(ring) {
  const ccw = signedArea(ring) > 0;
  return ring.map((a, i) =>
    ccw ? [a, ring[(i + 1) % ring.length]] : [ring[(i + 1) % ring.length], a],
  );
}

function frame(a, b) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / width,
    dz = (b[1] - a[1]) / width;
  return {
    width,
    tangent: [dx, 0, dz],
    forward: [dz, 0, -dx],
    at: (u, y, d = 0) => [a[0] + dx * u + dz * d, y, a[1] + dz * u - dx * d],
  };
}
const plaza = frame(outline[7], outline[8]);
const onPlaza = (offset) => plaza.width / 2 - offset;

function panel(out, slot, f, left, right, bottom, top, depth = 0, color = tones[slot]) {
  if (right - left < 0.002 || top - bottom < 0.002) return;
  face(
    out,
    slot,
    [
      f.at(left, bottom, depth),
      f.at(right, bottom, depth),
      f.at(right, top, depth),
      f.at(left, top, depth),
    ],
    f.forward,
    color,
  );
}

function trimBox(out, slot, f, left, right, low, high, back, front, color = tones[slot]) {
  if (right - left < 0.002 || high - low < 0.002) return;
  const p = (u, y, d) => f.at(u, y, d);
  panel(out, slot, f, left, right, low, high, front, color);
  face(
    out,
    slot,
    [p(left, low, back), p(left, low, front), p(left, high, front), p(left, high, back)],
    f.tangent.map((n) => -n),
    color,
  );
  face(
    out,
    slot,
    [p(right, low, back), p(right, low, front), p(right, high, front), p(right, high, back)],
    f.tangent,
    color,
  );
  face(
    out,
    slot,
    [p(left, high, back), p(right, high, back), p(right, high, front), p(left, high, front)],
    up,
    color,
  );
  face(
    out,
    slot,
    [p(left, low, back), p(right, low, back), p(right, low, front), p(left, low, front)],
    [0, -1, 0],
    color,
  );
}

function strip(out, slot, f, start, end, low, high, holes, lod) {
  let cursor = start;
  for (const { u, w, y0, y1, color = tones.glass } of holes) {
    const l = u - w / 2,
      r = u + w / 2;
    panel(out, slot, f, cursor, l, low, high);
    panel(out, slot, f, l, r, low, y0);
    panel(out, slot, f, l, r, y1, high);
    const inset = lod < 2 ? -0.14 : -0.34;
    panel(out, 'dark', f, l, r, y0, y1, inset, color);
    const leftNormal = f.tangent;
    for (const [a, b, c, d, n] of [
      [f.at(l, y0), f.at(l, y1), f.at(l, y1, inset), f.at(l, y0, inset), leftNormal],
      [f.at(r, y0), f.at(r, y1), f.at(r, y1, inset), f.at(r, y0, inset), leftNormal.map((v) => -v)],
      [f.at(l, y0), f.at(r, y0), f.at(r, y0, inset), f.at(l, y0, inset), up],
      [f.at(l, y1), f.at(r, y1), f.at(r, y1, inset), f.at(l, y1, inset), [0, -1, 0]],
    ])
      face(out, slot, [a, b, c, d], n, tones.muted);
    cursor = r;
  }
  panel(out, slot, f, cursor, end, low, high);
}

function pilaster(out, f, u, bottom, top, width) {
  trimBox(out, 'wall', f, u - width / 2, u + width / 2, bottom, top, -0.05, 0.23, tones.pale);
  trimBox(out, 'trim', f, u - width * 0.61, u + width * 0.61, top - 0.23, top - 0.06, -0.03, 0.31);
}

function stoneWindow(out, f, opening, lod, { balcony = false, grille = false } = {}) {
  const { u, w, y0, y1 } = opening;
  const l = u - w / 2,
    r = u + w / 2;
  const jamb = 0.13;
  trimBox(out, 'trim', f, l - jamb, r + jamb, y0 - 0.21, y0 + 0.02, -0.02, 0.2);
  trimBox(out, 'trim', f, l - jamb, r + jamb, y1 - 0.02, y1 + 0.19, -0.02, 0.18);
  if (lod >= 2) {
    for (const side of [l - jamb, r])
      trimBox(out, 'trim', f, side, side + jamb, y0, y1, -0.03, 0.12);
    const inset = -0.285;
    panel(out, 'iron', f, u - 0.044, u + 0.044, y0, y1, inset);
    for (const p of [0.34, 0.67]) {
      const y = y0 + (y1 - y0) * p;
      panel(out, 'iron', f, l, r, y - 0.041, y + 0.041, inset);
    }
    if (grille) {
      for (let i = 1; i < 6; i++) {
        const j = l + (w * i) / 6;
        panel(out, 'iron', f, j - 0.024, j + 0.024, y0, y1, 0.092);
      }
      const y = y0 + (y1 - y0) * 0.6;
      panel(out, 'iron', f, l, r, y - 0.048, y + 0.048, 0.105);
    }
  }
  if (balcony) {
    trimBox(out, 'trim', f, l - 0.4, r + 0.4, y0 - 0.29, y0 - 0.065, -0.03, 0.84);
    const y = y0 - 0.04;
    for (const d of [0.76]) {
      panel(out, 'iron', f, l - 0.36, r + 0.36, y + 0.63, y + 0.74, d);
      panel(out, 'iron', f, l - 0.36, r + 0.36, y + 0.09, y + 0.16, d);
      const n = lod >= 3 ? 12 : 6;
      for (let i = 0; i <= n; i++) {
        const p = l - 0.36 + ((w + 0.72) * i) / n;
        panel(out, 'iron', f, p - 0.023, p + 0.023, y + 0.13, y + 0.64, d);
      }
    }
    for (const p of [l - 0.28, r + 0.28]) {
      trimBox(out, 'wall', f, p - 0.13, p + 0.13, y0 - 0.78, y0 - 0.27, -0.02, 0.36, tones.muted);
    }
  }
}

function roundProfile(out, slot, [x, z], profile, n, color = tones[slot], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    color,
    { cap },
  );
}

function ionicShaft(out, f, u, lod) {
  const base = stoneBaseTop + 0.11;
  const high = friezeBase - 0.35;
  const [x, , z] = f.at(u, 0, -0.08);
  trimBox(out, 'trim', f, u - 0.82, u + 0.82, base - 0.14, base + 0.28, -0.3, 0.69);
  const profile = [
    [base + 0.25, 0.7],
    [base + 0.37, 0.71],
    [base + 0.54, 0.64],
    [base + 0.74, 0.63],
    [high - 0.42, 0.49],
    [high - 0.24, 0.57],
    [high - 0.13, 0.62],
  ];
  roundProfile(out, 'wall', [x, z], profile, [6, 8, 12, 16][lod], tones.pale, false);
  trimBox(out, 'trim', f, u - 0.83, u + 0.83, high - 0.16, high + 0.23, -0.18, 0.77);
  if (lod >= 2) {
    for (const s of [-1, 1]) {
      const center = u + s * 0.57;
      const round = (theta) =>
        f.at(center + 0.2 * Math.cos(theta), high + 0.03 + 0.18 * Math.sin(theta), 0.801);
      for (let i = 0; i < 9; i++) {
        face(
          out,
          'trim',
          [
            f.at(center, high + 0.03, 0.802),
            round((i * 2 * Math.PI) / 9),
            round(((i + 1) * 2 * Math.PI) / 9),
          ],
          f.forward,
          tones.shield,
        );
      }
    }
  }
}

function balustrade(out, f, start, end, y, lod) {
  const length = end - start;
  if (length < 0.4) return;
  trimBox(out, 'trim', f, start, end, y, y + 0.19, -0.38, 0.24);
  trimBox(out, 'trim', f, start, end, y + 1.06, y + 1.28, -0.37, 0.28);
  const spans = Math.max(1, Math.round(length / 4.8));
  for (let i = 0; i < spans; i++) {
    const u = start + ((i + 0.5) * length) / spans;
    trimBox(out, 'wall', f, u - 0.24, u + 0.24, y + 0.18, y + 1.08, -0.31, 0.21);
  }
  if (lod === 0) return;
  const n = Math.max(1, Math.round(length / (lod >= 2 ? 0.53 : 0.83)));
  for (let i = 0; i < n; i++) {
    const u = start + ((i + 0.5) * length) / n;
    if (lod >= 3) {
      const [x, , z] = f.at(u, 0, 0);
      roundProfile(
        out,
        'trim',
        [x, z],
        [
          [y + 0.19, 0.09],
          [y + 0.42, 0.08],
          [y + 0.57, 0.143],
          [y + 0.94, 0.068],
          [y + 1.06, 0.09],
        ],
        4,
        tones.trim,
        false,
      );
    } else {
      panel(out, 'trim', f, u - 0.087, u + 0.087, y + 0.19, y + 1.06, 0.08);
      panel(out, 'trim', f, u - 0.13, u + 0.13, y + 0.4, y + 0.72, 0.09);
    }
  }
}

function entablature(out, f, y, lod, start = 0, end = f.width) {
  trimBox(out, 'trim', f, start, end, y - 0.27, y, -0.03, 0.43);
  trimBox(out, 'wall', f, start, end, y, y + 0.59, -0.045, 0.26, tones.pale);
  trimBox(out, 'trim', f, start, end, y + 0.59, y + 0.84, -0.045, 0.62);
  if (lod >= 2) {
    const n = Math.round((end - start) / 1.47);
    for (let i = 0; i < n; i++) {
      const u = start + ((end - start) * (i + 0.5)) / n;
      panel(out, 'wall', f, u - 0.19, u + 0.19, y + 0.08, y + 0.49, 0.284, tones.shield);
      if (lod >= 3)
        for (const x of [-0.112, 0, 0.112])
          panel(out, 'trim', f, u + x - 0.026, u + x + 0.026, y + 0.14, y + 0.45, 0.307);
    }
  }
}

function figure(out, [x, z], y, h, lod, direction) {
  const waist = x + direction * 0.07 * h;
  roundProfile(
    out,
    'trim',
    [x, z],
    [
      [y, h * 0.19],
      [y + h * 0.08, h * 0.19],
      [y + h * 0.14, h * 0.16],
    ],
    lod === 3 ? 10 : 6,
    tones.trim,
  );
  const sections = [
    [y + h * 0.13, 0.15, 0.11, x],
    [y + h * 0.39, 0.13, 0.105, waist],
    [y + h * 0.61, 0.1, 0.075, waist],
    [y + h * 0.76, 0.144, 0.092, x],
    [y + h * 0.815, 0.056, 0.058, x],
  ];
  loft(
    out,
    'trim',
    sections.map(([at, wx, wz, xx]) => radialRing(at, h * wx, h * wz, lod === 3 ? 10 : 6, [xx, z])),
    tones.trim,
    { cap: true },
  );
  roundProfile(
    out,
    'trim',
    [x, z],
    [
      [y + h * 0.8, h * 0.052],
      [y + h * 0.845, h * 0.071],
      [y + h * 0.935, h * 0.085],
      [y + h, h * 0.035],
    ],
    lod === 3 ? 10 : 6,
    tones.trim,
  );
  for (const sign of [-1, 1]) {
    const shoulder = [x + sign * h * 0.123, y + h * 0.737, z];
    const elbow = [
      x + sign * h * (sign === direction ? 0.215 : 0.156),
      y + h * 0.59,
      z + h * 0.062,
    ];
    const hand = [
      x + sign * h * (sign === direction ? 0.099 : 0.245),
      y + h * (sign === direction ? 0.49 : 0.51),
      z + h * 0.117,
    ];
    beam(out, 'trim', shoulder, elbow, h * 0.071, h * 0.072, tones.trim);
    beam(out, 'trim', elbow, hand, h * 0.053, h * 0.055, tones.trim);
  }
  if (lod >= 3) {
    for (const k of [-1, 1]) {
      beam(
        out,
        'trim',
        [x + k * h * 0.055, y + h * 0.17, z + h * 0.113],
        [waist + k * h * 0.031, y + h * 0.53, z + h * 0.096],
        h * 0.024,
        h * 0.022,
        tones.pale,
      );
    }
  }
}

function escutcheon(out, f, u, y, lod) {
  const rim = [
    [0, -0.48],
    [-0.42, -0.27],
    [-0.56, 0.22],
    [-0.32, 0.59],
    [0, 0.67],
    [0.32, 0.59],
    [0.56, 0.22],
    [0.42, -0.27],
  ];
  for (let i = 0; i < rim.length; i++) {
    const [a, b] = rim[i],
      [c, d] = rim[(i + 1) % rim.length];
    face(
      out,
      'trim',
      [f.at(u, y, 0.16), f.at(u + a, y + b, 0.17), f.at(u + c, y + d, 0.17)],
      f.forward,
      tones.shield,
    );
    if (lod >= 2)
      beam(
        out,
        'trim',
        f.at(u + a, y + b, 0.21),
        f.at(u + c, y + d, 0.21),
        0.085,
        0.08,
        tones.trim,
      );
  }
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      const nodes = [
        [0.55, -0.17],
        [0.76, 0.15],
        [0.95, 0.38],
        [1.11, 0.44],
      ];
      for (let i = 1; i < nodes.length; i++) {
        const [a, b] = nodes[i - 1],
          [c, d] = nodes[i];
        beam(
          out,
          'trim',
          f.at(u + side * a, y + b, 0.19),
          f.at(u + side * c, y + d, 0.2),
          0.093,
          0.08,
          tones.trim,
        );
      }
    }
    for (const level of [-0.17, 0.09, 0.32])
      panel(out, 'trim', f, u - 0.28, u + 0.28, y + level, y + level + 0.049, 0.194);
  }
}

function plazaFront(out, lod) {
  const f = plaza,
    entrance = onPlaza(0);
  const lowerDoor = { u: entrance, w: 3.75, y0: threshold, y1: stoneBaseTop, color: tones.dark };
  const upperDoor = { u: entrance, w: 3.75, y0: stoneBaseTop, y1: 6.37, color: tones.dark };
  const bays = plazaBayOffsets
    .filter((offset) => offset !== 0)
    .map(onPlaza)
    .sort((a, b) => a - b);
  const baseWindows = lod
    ? bays.map((u) => ({ u, w: 1.82, y0: -0.8, y1: 1.1, color: tones.shadow }))
    : [];
  const sort = (a, b) => a.u - b.u;
  strip(
    out,
    'base',
    f,
    0,
    f.width,
    foundation,
    stoneBaseTop,
    [...baseWindows, lowerDoor].sort(sort),
    lod,
  );
  const lower = bays.map((u) => ({ u, w: 2.42, y0: 4.13, y1: 7.08 }));
  strip(out, 'wall', f, 0, f.width, stoneBaseTop, balconyY, [...lower, upperDoor].sort(sort), lod);
  const upper = plazaBayOffsets
    .map(onPlaza)
    .map((u) => ({ u, w: 3.06, y0: 9.17, y1: 14.34 }))
    .sort(sort);
  strip(out, 'wall', f, 0, f.width, balconyY, governmentDeck, upper, lod);
  for (const [start, end] of [
    [0, entrance - 1.92],
    [entrance + 1.92, f.width],
  ]) {
    trimBox(out, 'trim', f, start, end, stoneBaseTop - 0.16, stoneBaseTop + 0.19, -0.02, 0.35);
    if (lod) trimBox(out, 'wall', f, start, end, 8.61, 8.83, -0.03, 0.22);
  }
  for (const offset of ionicColumnOffsets) ionicShaft(out, f, onPlaza(offset), lod);
  entablature(out, f, friezeBase, lod);
  for (const [start, end] of [
    [0, 2.66],
    [f.width - 2.66, f.width],
  ]) {
    trimBox(
      out,
      'wall',
      f,
      start,
      end,
      stoneBaseTop + 0.17,
      friezeBase - 0.28,
      -0.03,
      0.26,
      tones.pale,
    );
    if (lod >= 2) {
      for (let y = 3.67; y < 15.3; y += 0.83)
        panel(out, 'trim', f, start + 0.12, end - 0.12, y, y + 0.033, 0.274, tones.muted);
    }
  }
  if (lod) {
    for (const window of lower) stoneWindow(out, f, window, lod, { grille: true });
    for (const window of upper) stoneWindow(out, f, window, lod, { balcony: true });
    for (const window of baseWindows) stoneWindow(out, f, window, lod, { grille: true });
  }
  for (const u of [entrance - 2.02, entrance + 1.88])
    trimBox(out, 'trim', f, u, u + 0.14, threshold, 6.43, -0.06, 0.27);
  trimBox(out, 'trim', f, entrance - 2.21, entrance + 2.21, 6.35, 6.71, -0.03, 0.57);
  escutcheon(out, f, entrance, 7.48, lod);
  if (lod >= 2) {
    panel(out, 'iron', f, entrance - 0.047, entrance + 0.047, threshold, 6.34, -0.284, tones.iron);
    for (const level of [1.66, 3.29, 4.92]) {
      panel(out, 'iron', f, entrance - 1.83, entrance + 1.83, level, level + 0.066, -0.279);
    }
  }
  const apron = heightAt(frontCenter, frontZ + 2.5);
  for (let i = 0; i < 5; i++) {
    const stop = threshold - ((4 - i) * (threshold - apron)) / 5;
    trimBox(
      out,
      i % 2 ? 'trim' : 'base',
      f,
      entrance - 3.06,
      entrance + 3.06,
      Math.min(-0.62, apron - 0.12),
      stop,
      -0.28,
      2.41 - i * 0.38,
      tones.sill,
    );
  }
  for (const sign of [-1, 1]) {
    const u = entrance + sign * 3.62;
    const [x, , z] = f.at(u, 0, 1.32);
    trimBox(
      out,
      'base',
      f,
      u - 0.94,
      u + 0.94,
      Math.min(-0.45, heightAt(x, z) - 0.2),
      1.09,
      -0.06,
      2.1,
    );
    trimBox(out, 'trim', f, u - 0.77, u + 0.77, 1.09, 1.31, 0.6, 1.98);
    figure(out, [x, z], 1.3, 2.42, lod, sign);
  }
  balustrade(out, f, 0, f.width, governmentParapet - 1.28, lod);
}

function baysAlong(f, limit = 5.35) {
  const n = Math.max(1, Math.round(f.width / limit));
  return Array.from({ length: n }, (_, i) => (f.width * (i + 0.5)) / n);
}

function sideElevation(
  out,
  f,
  height,
  lod,
  { recessed = false, rounded = false, government = false } = {},
) {
  const sill = government ? stoneBaseTop : 1.52;
  const middle = government ? balconyY : 5.74;
  const spacing = government ? 6.25 : 5.4;
  const places = f.width >= 3.6 || rounded ? baysAlong(f, spacing) : [];
  const w = Math.min(2.11, f.width * 0.54);
  const tiers = [
    {
      slot: 'base',
      low: foundation,
      hi: sill,
      holes: places.map((u) => ({
        u,
        w: w * 0.72,
        y0: government ? -1.0 : -3.55,
        y1: government ? 1.39 : -0.3,
        color: tones.shadow,
      })),
    },
    {
      slot: 'wall',
      low: sill,
      hi: middle,
      holes: places.map((u) => ({ u, w: w * 0.92, y0: sill + 0.6, y1: middle - 0.95 })),
    },
    {
      slot: 'wall',
      low: middle,
      hi: height,
      holes: places.map((u) => ({ u, w, y0: middle + 1.03, y1: height - 2.0 })),
    },
  ];
  for (const { slot, low, hi, holes } of tiers) {
    if (lod === 2 && !rounded && !recessed) {
      panel(out, slot, f, 0, f.width, low, hi);
      for (const { u, w, y0, y1, color } of holes) {
        panel(out, 'dark', f, u - w / 2, u + w / 2, y0, y1, 0.021, color ?? tones.glass);
        panel(out, 'trim', f, u - w / 2 - 0.1, u + w / 2 + 0.1, y0 - 0.17, y0, 0.049);
      }
    } else {
      strip(out, slot, f, 0, f.width, low, hi, holes, lod);
      for (const opening of holes) {
        stoneWindow(out, f, opening, lod, {
          balcony: rounded && low === middle,
          grille: low === foundation,
        });
      }
    }
  }
  trimBox(out, 'trim', f, 0, f.width, sill - 0.11, sill + 0.17, -0.04, 0.24);
  if (lod >= 1) trimBox(out, 'wall', f, 0, f.width, middle - 0.21, middle - 0.04, -0.04, 0.17);
  if (government) entablature(out, f, friezeBase, lod);
  else trimBox(out, 'trim', f, 0, f.width, height - 0.29, height + 0.07, -0.02, 0.28);
  if (lod >= 2 && f.width > 8 && !recessed) {
    for (const u of [0.54, f.width - 0.54]) pilaster(out, f, u, sill + 0.13, height - 0.78, 0.66);
  }
}

function mainWing(out, lod) {
  roofCap(out, 'roof', northRange, governmentDeck);
  for (const [i, [a, b]] of edges(northRange).entries()) {
    if (i === 1) continue;
    const f = frame(a, b);
    sideElevation(out, f, governmentDeck, lod, { government: true, recessed: i === 3 });
    balustrade(out, f, 0, f.width, governmentParapet - 1.28, lod === 3 ? 2 : lod);
  }
  plazaFront(out, lod);
  if (lod >= 1) {
    const f = frame(outline[9], outline[6]);
    const center = f.width / 2 + 0.18;
    pilaster(out, f, center - 3.07, 1.48, 14.42, 0.7);
    pilaster(out, f, center + 3.07, 1.48, 14.42, 0.7);
    trimBox(out, 'trim', f, center - 3.05, center + 3.05, 2.06, 2.44, -0.12, 1.28);
  }
}

function closedBalcony(out, f, y) {
  panel(out, 'wall', f, 0, f.width, y, y + 0.62, -0.03, tones.pale);
  trimBox(out, 'trim', f, 0, f.width, y + 0.55, y + 0.74, -0.04, 0.2);
}

function residentialWing(out, lod) {
  roofCap(out, 'roof', southRange, residentialDeck, tones.roof);
  for (const [i, [a, b]] of edges(southRange).entries()) {
    const f = frame(a, b),
      rounding = [3, 5, 8].includes(i);
    sideElevation(out, f, residentialDeck, lod, { recessed: i >= 15, rounded: rounding });
    closedBalcony(out, f, residentialParapet - 0.74);
    if (lod >= 2 && i === 6) {
      const u = f.width / 2;
      trimBox(out, 'wall', f, u - 0.22, u + 0.22, 12.18, 12.59, -0.22, 0.12, tones.trim);
    }
  }
}

function connections(out, lod) {
  for (const path of passages) {
    roofCap(out, 'roof', path, connectingDeck);
    for (const [a, b] of edges(path)) {
      const f = frame(a, b);
      if (f.width < 6) {
        panel(out, 'wall', f, 0, f.width, foundation, connectingDeck);
        continue;
      }
      const u = f.width / 2;
      const low = [{ u, w: 3.27, y0: -1.4, y1: 2.44, color: tones.shadow }];
      const high = baysAlong(f, 3.5).map((x) => ({ u: x, w: 1.9, y0: 4.07, y1: 8.52 }));
      strip(out, 'base', f, 0, f.width, foundation, 3.27, low, lod);
      strip(out, 'wall', f, 0, f.width, 3.27, connectingDeck, high, lod);
      trimBox(out, 'trim', f, 0, f.width, 3.12, 3.38, -0.06, 0.2);
      trimBox(
        out,
        'trim',
        f,
        0,
        f.width,
        connectingDeck - 0.24,
        connectingDeck + 0.16,
        -0.02,
        0.23,
      );
      if (lod >= 1) for (const open of [...low, ...high]) stoneWindow(out, f, open, lod);
      if (lod >= 2) {
        for (const pos of [u - 2.28, u + 2.28]) pilaster(out, f, pos, 3.43, 9.86, 0.43);
      }
    }
  }
}

function courtyardGround(out, lod) {
  const from = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const local = (u, v) =>
    from(from(courtyard[0], courtyard[3], u), from(courtyard[1], courtyard[2], u), v);
  const size = lod >= 2 ? 8 : 4;
  const y = ([x, z]) => heightAt(x, z) + 0.11;
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++) {
      const vertices = [
        local(i / size, j / size),
        local((i + 1) / size, j / size),
        local((i + 1) / size, (j + 1) / size),
        local(i / size, (j + 1) / size),
      ];
      const points = vertices.map((p) => at3d(p, y(p)));
      const color = (i + j) % 3 === 0 ? tones.ground : tones.sill;
      face(out, 'base', [points[0], points[1], points[2]], up, color);
      face(out, 'base', [points[0], points[2], points[3]], up, color);
    }
}

function springFountain(out, lod) {
  const center = [frontCenter, -5.85],
    y = heightAt(...center) + 0.36;
  const n = [8, 10, 20, 28][lod];
  const ring = (a, b, height) => radialRing(height, a, b, n, center);
  loft(
    out,
    'trim',
    [
      ring(3.86, 2.19, y - 0.37),
      ring(3.88, 2.22, y + 0.14),
      ring(3.81, 2.16, y + 0.3),
      ring(3.61, 1.96, y + 0.3),
      ring(3.53, 1.9, y + 0.07),
    ],
    tones.trim,
    { cap: false },
  );
  roofCap(
    out,
    'dark',
    ring(3.55, 1.91, y).map(([x, , z]) => [x, z]),
    y + 0.09,
    tones.glass,
  );
  roundProfile(
    out,
    'trim',
    center,
    [
      [y + 0.03, 0.86],
      [y + 0.37, 0.84],
      [y + 0.46, 0.53],
      [y + 0.85, 0.49],
    ],
    lod >= 2 ? 12 : 6,
  );
  if (lod >= 1) {
    figure(out, [center[0] - 0.59, center[1]], y + 0.55, 1.28, lod, -1);
    figure(out, [center[0] + 0.57, center[1] + 0.17], y + 0.53, 1.42, lod, 1);
  }
}

function simpleMass(out, ring, height, detailed = false) {
  roofCap(out, 'roof', ring, height);
  for (const [a, b] of edges(ring)) {
    if (detailed && a === outline[7] && b === outline[8]) continue;
    const f = frame(a, b);
    panel(out, 'base', f, 0, f.width, foundation, 2.8);
    panel(out, 'wall', f, 0, f.width, 2.8, height);
    panel(out, 'trim', f, 0, f.width, height - 0.18, height + 0.48, 0.14);
    if (detailed && f.width > 4) {
      for (const u of baysAlong(f, 6)) {
        for (const y of [3.28, Math.max(6.52, height - 5)]) {
          panel(out, 'dark', f, u - 0.93, u + 0.93, y, y + 2.8, 0.023, tones.glass);
        }
      }
    }
  }
}

function distant(out, detailed) {
  simpleMass(out, northRange, governmentDeck, detailed);
  simpleMass(out, southRange, residentialDeck, detailed);
  for (const path of passages) simpleMass(out, path, connectingDeck, detailed);
  if (detailed) {
    plazaFront(out, 1);
    courtyardGround(out, 1);
    springFountain(out, 1);
    return;
  }
  for (const offset of ionicColumnOffsets) {
    const u = onPlaza(offset);
    trimBox(out, 'trim', plaza, u - 0.36, u + 0.36, stoneBaseTop, friezeBase, -0.04, 0.54);
  }
  for (const offset of plazaBayOffsets) {
    const u = onPlaza(offset);
    panel(out, 'dark', plaza, u - 1.49, u + 1.49, balconyY + 0.86, 14.34, 0.021, tones.glass);
    panel(out, 'dark', plaza, u - 1.04, u + 1.04, offset === 0 ? threshold : 4.13, 6.78, 0.021);
  }
  entablature(out, plaza, friezeBase, 0);
  balustrade(out, plaza, 0, plaza.width, governmentParapet - 1.28, 0);
  springFountain(out, 0);
}

function build(out, lod) {
  mainWing(out, lod);
  residentialWing(out, lod);
  connections(out, lod);
  courtyardGround(out, lod);
  springFountain(out, lod);
}

export const piratiniSkyline = (out) => distant(out, false);
export const piratiniDistrict = (out) => distant(out, true);
export const piratiniStreet = (out) => build(out, 2);
export const piratiniCloseup = (out) => build(out, 3);

const recipe = 'piratini-palace-model.mjs';
const camera = [64, 34, 91],
  lookAt = [-1.94, 7.9, 4.1];
export const piratiniModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  category: 'landmark',
  build: piratiniCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis:
      'The mapped government and residential palace wings, with the open interior court preserved in the authored exterior.',
  },
  brief:
    'The government and residential wings of the Piratini Palace in Porto Alegre, with the Ionic plaza façade and Landowski sculptures, open court and rounded rear of the residence.',
  camera,
  lookAt,
  sunDirection: [18, 39, 51],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.75,
    cameraYaw: 0.47,
    groundY: 0,
    focus: { center: [-1.94, 7.9, 4.1] },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'ionic-plaza-front-and-statuary', position: [-6, 15, 91], lookAt: [-2.2, 9, 32] },
    {
      name: 'portico-shield-and-landowski-statues',
      position: [-15, 8.3, 55],
      lookAt: [-2.4, 6.0, 32],
    },
    {
      name: 'open-courtyard-and-connecting-passages',
      position: [27, 39, -1],
      lookAt: [-2, 3.6, -4],
    },
    { name: 'residential-oval-and-terraces', position: [47, 28, -83], lookAt: [-1.8, 4.8, -22] },
    {
      name: 'falling-east-terrace-and-palace-side',
      position: [-65, 22, -37],
      lookAt: [-1.8, 4.3, -4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `piratini-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'piratiniSkyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'piratiniDistrict', errorMeters: 0.41, surfaces },
      street: { export: 'piratiniStreet', errorMeters: 0.19, surfaces },
      closeup: { export: 'piratiniCloseup', errorMeters: 0.078, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on Rio Grande do Sul and federal architectural documentation, ODbL OpenStreetMap geography and openly attributed Terrarium elevation.',
};
