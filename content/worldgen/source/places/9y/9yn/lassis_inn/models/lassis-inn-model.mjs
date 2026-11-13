/** The blue false-front Lassis Inn in Little Rock in July 2024. */
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
const { floor, eave, ridge, parapet, raisedParapet } = plan;
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.93, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.06 },
  shingles: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.92, metallic: 0 },
  canopy: { slot: 'roof', graph: 'fabric_canvas', roughness: 0.94, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61, metallic: 0.07 },
};
const c = Object.fromEntries(
  Object.entries({
    blue: '629cca',
    front: '6ba2d1',
    board: '76a8cb',
    edge: 'c4c5bb',
    cement: 'aaa9a0',
    stair: '717985',
    ramp: '7d878a',
    roof: '666562',
    canopy: 'c2c4bb',
    canopyShade: 'b1b5ae',
    sign: 'd9d3bf',
    letters: '305783',
    glass: '606a69',
    door: '60666a',
    steel: '333939',
    vent: '7b8280',
    pink: 'b56586',
    cream: 'c8adad',
  }).map(([name, value]) => [name, rgb(value)]),
);

const up = [0, 1, 0],
  rect = (a, b, y0, y1) => [
    [a, y0],
    [b, y0],
    [b, y1],
    [a, y1],
  ];
function directed(out, slot, vertices, normal, tint) {
  const sign = normalFor(...vertices).reduce((n, v, i) => n + v * normal[i], 0);
  const points = sign >= 0 ? vertices : vertices.toReversed();
  if (points.length === 3) triangle(out, slot, points, tint);
  else face(out, slot, points, tint);
}
function polygon(out, slot, outer, project, normal, tint, holes = []) {
  const points = [...outer];
  const offsets = holes.map((h) => {
    const n = points.length;
    points.push(...h);
    return n;
  });
  const ids = earcut(points.flat(), offsets);
  for (let i = 0; i < ids.length; i += 3)
    directed(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => project(...points[j])),
      normal,
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

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [-dz / length, 0, dx / length];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [
      a[0] + (u * dx) / length + normal[0] * d,
      y,
      a[1] + (u * dz) / length + normal[2] * d,
    ],
  };
}
function patch(out, s, slot, area, depth, tint) {
  directed(
    out,
    slot,
    area.map(([u, y]) => s.p(u, y, depth)),
    s.normal,
    tint,
  );
}
function windows(out, s, openings, lod) {
  const inset = lod >= 2 ? -0.12 : 0.018;
  for (const { u, w, low, high, door, grille } of openings) {
    const a = u - w / 2,
      b = u + w / 2,
      r = rect(a, b, low, high);
    patch(out, s, 'glazing', r, inset, door ? c.door : c.glass);
    if (lod >= 2) {
      const center = s.p(u, (low + high) / 2);
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length];
        const mid = s.p((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        directed(
          out,
          'trim',
          [s.p(...p), s.p(...q), s.p(...q, inset), s.p(...p, inset)],
          center.map((v, j) => v - mid[j]),
          c.edge,
        );
      }
    }
    if (!lod) continue;
    for (const x of [a, b])
      patch(out, s, 'trim', rect(x - 0.039, x + 0.039, low - 0.044, high + 0.044), 0.024, c.edge);
    for (const y of [low, high])
      patch(out, s, 'trim', rect(a - 0.038, b + 0.038, y - 0.032, y + 0.032), 0.024, c.edge);
    if (!door) patch(out, s, 'trim', rect(u - 0.029, u + 0.029, low, high), 0.025, c.edge);
    if (grille && lod >= 2) {
      const bars = lod === 3 ? 9 : 7;
      for (let i = 0; i < bars; i++) {
        const x = a + 0.06 + ((w - 0.12) * i) / (bars - 1);
        beam(
          out,
          'trim',
          s.p(x, low + 0.02, 0.073),
          s.p(x, high - 0.018, 0.073),
          0.025,
          0.025,
          c.steel,
        );
      }
      for (const t of [0.38, 0.71]) {
        const y = low + (high - low) * t;
        beam(out, 'trim', s.p(a, y, 0.077), s.p(b, y, 0.077), 0.032, 0.029, c.steel);
      }
      if (lod === 3) {
        const x = b - 0.14,
          y = low + (high - low) * 0.46;
        beam(out, 'trim', s.p(x - 0.11, y, 0.105), s.p(x, y, 0.105), 0.038, 0.034, c.steel);
      }
    }
  }
}

function wall(out, s, shape, openings, lod, isFront = false) {
  const { p, length: L, normal } = s;
  const holes =
    lod >= 2 ? openings.map(({ u, w, low, high }) => rect(u - w / 2, u + w / 2, low, high)) : [];
  polygon(out, 'siding', shape, (u, y) => p(u, y), normal, isFront ? c.front : c.blue, holes);
  const bottom = (u) => {
    const [x, , z] = p(u, 0);
    return p(u, Math.min(floor - 0.17, grade(x, z) - 0.2));
  };
  directed(out, 'concrete', [bottom(0), bottom(L), p(L, floor), p(0, floor)], normal, c.cement);
  windows(out, s, openings, lod);
  if (lod) {
    for (const u of [0.028, L - 0.028]) {
      const top = isFront ? parapet : eave;
      patch(out, s, 'trim', rect(u - 0.028, u + 0.028, floor, top), 0.028, c.edge);
    }
  }
}

const alphabet = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  A: ['01110', '11011', '11011', '11011', '11111', '11011', '11011'],
  S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  N: ['11001', '11001', '11101', '11101', '10111', '10011', '10011'],
};
function sign(out, s, lod) {
  const center = s.length / 2,
    a = center - 1.49,
    b = center + 1.49,
    lo = 3.86,
    hi = 4.54;
  const border = rect(a, b, lo, hi);
  patch(out, s, 'trim', border, 0.081, c.sign);
  const mid = s.p(center, (lo + hi) / 2);
  for (const [i, p] of border.entries()) {
    const q = border[(i + 1) % border.length],
      edge = s.p((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    directed(
      out,
      'trim',
      [s.p(...p), s.p(...q), s.p(...q, 0.081), s.p(...p, 0.081)],
      edge.map((value, k) => value - mid[k]),
      c.sign,
    );
  }
  if (!lod) return;
  const text = 'LASSIS INN',
    size = 0.054;
  const width =
    (Array.from(text, (letter) => (alphabet[letter]?.[0].length ?? 3) + 1).reduce(
      (u, v) => u + v,
      0,
    ) -
      1) *
    size;
  let cursor = center - width / 2;
  for (const letter of text) {
    const rows = alphabet[letter];
    if (rows)
      for (const [index, row] of rows.entries()) {
        for (const match of row.matchAll(/1+/g)) {
          const x = cursor + match.index * size,
            y = hi - 0.15 - index * size;
          patch(
            out,
            s,
            'trim',
            rect(x, x + match[0].length * size, y - size, y + 0.0005),
            0.086,
            c.letters,
          );
        }
      }
    cursor += ((rows?.[0].length ?? 3) + 1) * size;
  }
}
function notice(out, s, u, y, w, h, lod) {
  if (!lod) return;
  patch(out, s, 'trim', rect(u - w / 2, u + w / 2, y, y + h), 0.031, c.pink);
  if (lod >= 2) {
    patch(
      out,
      s,
      'trim',
      rect(u - w * 0.4, u + w * 0.39, y + h * 0.14, y + h * 0.34),
      0.036,
      c.cream,
    );
    patch(
      out,
      s,
      'trim',
      rect(u - w * 0.22, u + w * 0.4, y + h * 0.58, y + h * 0.78),
      0.036,
      c.cream,
    );
  }
}
function wallUnit(out, s, u, y, lod) {
  if (!lod) return;
  const [x, , z] = s.p(u, y, 0.13),
    [nx, , nz] = s.normal;
  const w = 0.33,
    h = 0.36,
    d = 0.54;
  const dx = Math.abs(nx) > 0.5 ? d / 2 : w,
    dz = Math.abs(nz) > 0.5 ? d / 2 : w;
  box(out, 'trim', [x - dx, y, z - dz], [x + dx, y + h, z + dz], c.edge);
  if (lod >= 2)
    for (let j = 0; j < 5; j++)
      patch(
        out,
        s,
        'trim',
        rect(u - 0.28, u + 0.28, y + 0.06 + j * 0.054, y + 0.08 + j * 0.054),
        0.406,
        c.vent,
      );
}

function front(out, s, lod) {
  const L = s.length,
    m = L / 2,
    a = m - 1.86,
    b = m + 1.86,
    p = s.p,
    n = s.normal;
  const shape = [
    [0, floor],
    [L, floor],
    [L, parapet],
    [b, parapet],
    [b, raisedParapet],
    [a, raisedParapet],
    [a, parapet],
    [0, parapet],
  ];
  const frontWindows = [
    { u: m - 2.34, w: 1.62, low: 2.1, high: 2.72 },
    { u: m + 2.34, w: 1.54, low: 2.09, high: 2.69 },
    { u: m, w: 1.35, low: floor + 0.055, high: 3.05, door: true, grille: true },
  ];
  wall(out, s, shape, frontWindows, lod, true);
  const backShape = shape.map(([u, y]) => [u, Math.max(eave - 0.025, y)]);
  polygon(
    out,
    'siding',
    backShape,
    (u, y) => p(u, y, -0.16),
    n.map((v) => -v),
    c.blue,
  );
  for (const [u, v, y] of [
    [0, a, parapet],
    [a, b, raisedParapet],
    [b, L, parapet],
  ])
    directed(
      out,
      'trim',
      [p(u, y, 0.014), p(v, y, 0.014), p(v, y, -0.19), p(u, y, -0.19)],
      up,
      c.edge,
    );
  for (const [u, v, lo, hi, normal] of [
    [0, 0, eave, parapet, [-1, 0, 0]],
    [L, L, eave, parapet, [1, 0, 0]],
    [a, a, parapet, raisedParapet, [-1, 0, 0]],
    [b, b, parapet, raisedParapet, [1, 0, 0]],
  ])
    directed(
      out,
      'siding',
      [p(u, lo), p(v, hi), p(v, hi, -0.16), p(u, lo, -0.16)],
      normal,
      c.front,
    );
  sign(out, s, lod);
  notice(out, s, m - 2.46, 0.98, 1.32, 1.02, lod);
  if (lod >= 2) patch(out, s, 'trim', rect(m + 2.19, m + 2.45, 1.71, 1.98), 0.04, c.letters);
}

function body(out, lod) {
  for (const [i, a] of outline.entries()) {
    const s = section(a, outline[(i + 1) % outline.length]),
      L = s.length;
    if (i === 3) {
      front(out, s, lod);
      continue;
    }
    const sash = (u, w = 1.12) => ({ u, w, low: 2.37, high: 3.13 });
    const apertures =
      i === 0
        ? [
            sash(2.46),
            sash(5.18, 0.91),
            { u: 8.6, w: 0.95, low: floor + 0.043, high: 2.81, door: true },
          ]
        : i === 2
          ? [sash(3.25), sash(6.72, 0.94), sash(9.9)]
          : [{ u: L * 0.68, w: 0.83, low: floor + 0.06, high: 2.68, door: true }];
    wall(out, s, rect(0, L, floor, eave), apertures, lod);
    if (i === 0) {
      wallUnit(out, s, 5.12, 2.39, lod);
      notice(out, s, 3.22, 1.04, 2.03, 1.1, lod);
    }
    if (i === 2) {
      wallUnit(out, s, 6.7, 2.34, lod);
      wallUnit(out, s, 3.25, 2.37, lod);
    }
  }
}

function roof(out, lod) {
  const z0 = -6.55,
    z1 = 6.26,
    x0 = -3.99,
    x1 = 4.0;
  const a = [0, ridge, z0],
    b = [0, ridge, z1];
  for (const x of [x0, x1]) {
    directed(out, 'shingles', [[x, eave, z0], [x, eave, z1], b, a], up, c.roof);
    if (lod) beam(out, 'trim', [x, eave - 0.035, z0], [x, eave - 0.035, z1], 0.1, 0.11, c.edge);
  }
  directed(out, 'siding', [[x0, eave, z0], [x1, eave, z0], a], [0, 0, -1], c.blue);
  if (lod) {
    box(out, 'trim', [-0.44, 4.18, -1.21], [0.35, 4.65, -0.71], c.vent);
    box(out, 'trim', [0.88, 3.77, -3.67], [1.42, 4.27, -3.16], c.vent);
    const n = [0, 6, 12, 18][lod];
    const rings = [
      [4.25, 0.21],
      [4.37, 0.29],
      [4.56, 0.28],
      [4.66, 0.21],
    ].map(([y, r]) => radialRing(y, r, r, n, [1.15, -3.42]));
    loft(out, 'trim', rings, c.edge);
  }
}

function entrance(out, lod) {
  const z = 6.34,
    w = 0.83,
    low = grade(0, 7.75) - 0.035,
    steps = 4;
  for (let i = 0; i < steps; i++) {
    const y = low + ((floor - low) * (i + 1)) / steps;
    box(out, 'concrete', [-w, low - 0.12, z], [w, y, z + 1.37 - i * 0.28], c.stair);
  }
  const a = [-0.94, 3.28, z + 0.015],
    b = [0.94, 3.28, z + 0.015],
    d = [-0.94, 3.04, z + 1.04],
    e = [0.94, 3.04, z + 1.04];
  directed(out, 'canopy', [a, b, e, d], up, c.canopy);
  directed(
    out,
    'canopy',
    [a, b, e, d].map(([x, y, z]) => [x, y - 0.022, z]),
    [0, -1, 0],
    c.canopyShade,
  );
  for (const x of [-0.88, 0.88]) {
    beam(out, 'trim', [x, low + 0.015, z + 1.0], [x, 3.06, z + 1.0], 0.043, 0.043, c.edge);
    if (lod) {
      const lower = [x, low + 0.82, z + 1.41],
        upper = [x, floor + 0.82, z + 0.04];
      beam(out, 'trim', lower, upper, 0.044, 0.044, c.steel);
      for (const t of [0, 0.52, 1]) {
        const y = low + (floor - low) * t,
          zz = lower[2] + (upper[2] - lower[2]) * t;
        beam(out, 'trim', [x, y, zz], [x, y + 0.82, zz], 0.035, 0.035, c.steel);
      }
    }
  }
  if (lod) {
    const n = [0, 6, 12, 14][lod];
    for (let i = 0; i < n; i++) {
      const u = -0.94 + (1.88 * i) / n,
        v = u + 1.88 / n,
        m = (u + v) / 2;
      for (const dir of [-1, 1]) {
        directed(
          out,
          'canopy',
          [
            [u, 3.045, z + 1.04],
            [m, 3.045, z + 1.04],
            [m, 2.89, z + 1.04],
            [u, 2.93, z + 1.04],
          ],
          [0, 0, dir],
          c.canopy,
        );
        directed(
          out,
          'canopy',
          [
            [m, 3.045, z + 1.04],
            [v, 3.045, z + 1.04],
            [v, 2.93, z + 1.04],
            [m, 2.89, z + 1.04],
          ],
          [0, 0, dir],
          c.canopy,
        );
      }
    }
  }
}

function sideLanding(out, lod) {
  const x0 = 3.77,
    x1 = 5.29,
    head = -3.24,
    tail = 0.13,
    rear = -6.29,
    low = grade(4.61, tail) + 0.016;
  const frontA = [x0, low, tail],
    frontB = [x1, low, tail],
    backA = [x0, floor, head],
    backB = [x1, floor, head];
  directed(out, 'concrete', [frontA, frontB, backB, backA], up, c.ramp);
  for (const [a, b, n] of [
    [frontA, backA, [-1, 0, 0]],
    [frontB, backB, [1, 0, 0]],
  ])
    directed(
      out,
      'concrete',
      [a, b, [b[0], b[1] - 0.1, b[2]], [a[0], a[1] - 0.1, a[2]]],
      n,
      c.ramp,
    );
  box(out, 'concrete', [x0, floor - 0.18, rear], [x1, floor, head], c.ramp);
  for (const z of [head - 0.21, rear + 0.12]) {
    box(
      out,
      'concrete',
      [x1 - 0.26, grade(x1, z) - 0.14, z - 0.14],
      [x1 - 0.05, floor - 0.18, z + 0.14],
      c.cement,
    );
    beam(out, 'trim', [x1 - 0.07, floor, z], [x1 - 0.07, 3.04, z], 0.105, 0.105, c.blue);
  }
  directed(
    out,
    'trim',
    [
      [x0 - 0.08, 3.21, rear - 0.1],
      [x1 + 0.14, 3.02, rear - 0.1],
      [x1 + 0.14, 3.02, head + 0.12],
      [x0 - 0.08, 3.21, head + 0.12],
    ],
    up,
    c.blue,
  );
  if (lod) {
    for (const x of [x1 - 0.08, x0 + 0.12]) {
      beam(
        out,
        'trim',
        [x, low + 0.82, tail - 0.08],
        [x, floor + 0.82, head],
        0.094,
        0.092,
        c.blue,
      );
      if (lod >= 2)
        for (let j = 0; j < 6; j++) {
          const t = (j + 0.25) / 6,
            y = low + (floor - low) * t,
            z = tail + (head - tail) * t;
          beam(out, 'trim', [x, y, z], [x, y + 0.82, z], 0.061, 0.058, c.blue);
        }
    }
    beam(
      out,
      'trim',
      [x1 - 0.08, floor + 0.82, head],
      [x1 - 0.08, floor + 0.82, rear],
      0.087,
      0.08,
      c.blue,
    );
  }
}

function build(out, lod) {
  body(out, lod);
  roof(out, lod);
  entrance(out, lod);
  sideLanding(out, lod);
}
export const innSkyline = (out) => build(out, 0);
export const innDistrict = (out) => build(out, 1);
export const innStreet = (out) => build(out, 2);
export const innCloseup = (out) => build(out, 3);

const recipe = 'lassis-inn-model.mjs',
  camera = [15, 8, 22],
  lookAt = [0, 1.85, 1.5];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'innDistrict', 0.26],
    ['street', 'innStreet', 0.083],
    ['closeup', 'innCloseup', 0.026],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const innModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: innCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Blue clapboard restaurant with a stepped false front, cream Lassis Inn sign, awning and concrete stairs.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [11, 17, 17],
  mediumFiContext: {
    scale: 2.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis:
      'The named restaurant footprint at 518 East 27th Street from OpenStreetMap way 952748548.',
  },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'concrete_plain',
    'metal_painted',
    'shingle_asphalt',
    'fabric_canvas',
  ],
  qaCameras: [
    { name: 'south-front-sign-and-stairs', position: [0.26, 3.7, 20], lookAt: [0, 2.32, 6] },
    { name: 'east-siding-and-service-ramp', position: [16, 5.0, 4.7], lookAt: [3.2, 1.87, -0.5] },
    { name: 'west-wall-and-roof-exhaust', position: [-14, 8.6, -10], lookAt: [0, 2.03, -1.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-lassis-inn-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'innSkyline',
    errorMeters: 0.51,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped outline is ODbL. The four selected Qualla photographs are CC0.',
};
