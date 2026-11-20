import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  lathe,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import {
  face,
  soccerPitch,
} from '../../../../../../../../packages/worldgen/scripts/stadium-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { warsawPlan } from '../../../../../../../../packages/worldgen/scripts/warsaw-plan.mjs';
import { warsawSections } from '../../../../../../../../packages/worldgen/scripts/warsaw-stadium-model.mjs';

const { clearR, innerR, lowerY, ringY, roofPoint, roofR, rounded, seat, skinPoint, tipY, upperY } =
  warsawSections;
const white = [0.91, 0.9, 0.86],
  steel = [0.67, 0.69, 0.67],
  red = [0.65, 0.025, 0.037];
const stone = [0.55, 0.57, 0.54],
  turf = [0.22, 0.29, 0.15],
  dark = [0.046, 0.081, 0.086];
const up = [0, 1, 0],
  down = [0, -1, 0],
  turn = 2 * Math.PI;
const radial = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];
const low = (p, y) => [p[0], y, p[2]];

export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.86, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0 },
  diamond: { slot: 'wall', graph: 'metal_expanded_diamond', roughness: 0.52, metallic: 0 },
  turf: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'field-and-grass-berm',
    roughness: 1,
    metallic: 0,
  },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'concourse-glazing',
    roughness: 0.34,
    metallic: 0.04,
  },
  clear: {
    slot: 'window',
    localRef: 'palette:#feffff',
    name: 'glazed-inner-roof',
    roughness: 0.34,
    metallic: 0.03,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.39],
    doubleSided: true,
  },
  plastic: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'seats-and-field-lines',
    roughness: 0.73,
    metallic: 0,
  },
};

function band(out, material, point, a, b, lo, hi, color, direction) {
  face(out, material, [point(a, lo), point(b, lo), point(b, hi), point(a, hi)], color, direction);
}

function shellAndRoof(out, detail) {
  const { facets, panels, radialBands } = detail;
  for (let i = 0; i < facets; i++) {
    const a = (turn * i) / facets,
      b = (turn * (i + 1)) / facets,
      direction = radial((a + b) / 2, 1);
    for (let j = 0; j < panels; j++) {
      const y0 = 21.3 + (j * 28) / panels,
        y1 = 21.3 + ((j + 1) * 28) / panels;
      const shell = (q, y) =>
        skinPoint(q, y + 1.8 * Math.sin(2 * q) ** 2, Math.round((j * 19) / panels));
      const noise = (Math.imul(i + 47, 19349663) ^ Math.imul(j + 9, 73856093)) >>> 0;
      const tint = noise % 100 < 90 - (j * 88) / panels ? red : white;
      band(out, detail.woven ? 'diamond' : 'metal', shell, a, b, y0, y1, tint, direction);
      if (detail.woven) {
        const backing = (q, y) => {
          const p = shell(q, y),
            d = radial(q, 0.58);
          return [p[0] - d[0], p[1], p[2] - d[2]];
        };
        band(
          out,
          'metal',
          backing,
          a,
          b,
          y0,
          y1,
          tint.map((x) => x * 0.63),
          direction,
        );
      }
    }
    const glazing = (q, y) => radial(q, roofR(q) - 13.4, y);
    band(out, 'glass', glazing, a, b, 18.2, 21.3, dark, direction);
    for (let j = 1; j < radialBands.length; j++) {
      const s = radialBands[j - 1],
        t = radialBands[j];
      band(out, 'membrane', roofPoint, a, b, s, t, white, up);
      band(out, 'membrane', (q, u) => roofPoint(q, u, -0.06), a, b, s, t, [0.78, 0.8, 0.76], down);
    }
    if (detail.cables) {
      const glazingRing = (q, t) =>
        radial(q, innerR(q) * (1 - t) + clearR(q) * t, 49.5 - (1 - t) * 0.3);
      band(out, 'clear', glazingRing, a, b, 0, 1, [0.8, 0.87, 0.87], up);
      for (const y of [20.8, 24.6]) {
        const ribbon = (q, h) => rounded(q, 63.5, 84.5, 19, h);
        band(out, 'glass', ribbon, a, b, y, y + 2.65, dark, radial((a + b) / 2, -1));
      }
    }
    const berm = (q, t) => radial(q, roofR(q) - 6 + t * 42, 18 * (1 - t));
    band(out, 'turf', berm, a, b, 0, 1, turf, up);
    const toe = (q, y) => radial(q, roofR(q) + 36, y);
    band(out, 'turf', toe, a, b, -4, 0, turf, direction);
    const walkway = (q, t) => radial(q, roofR(q) - 20 + t * 15.5, 18.04);
    band(out, 'concrete', walkway, a, b, 0, 1, stone, up);
  }
}

function crown(out, detail) {
  const { stride, cables } = detail,
    count = warsawPlan.columns.length;
  for (let i = 0; i < count; i += stride) {
    const p = warsawPlan.columns[i],
      q = warsawPlan.columns[(i + stride) % count];
    const a = Math.atan2(...p),
      b = Math.atan2(...q),
      r = Math.hypot(...p);
    const foot = [p[0], 18.4, p[1]],
      ring = [p[0], ringY(a), p[1]];
    const tip = radial(a, roofR(a), tipY(a));
    beam(out, 'metal', foot, ring, 1, 1, steel);
    beam(out, 'metal', ring, tip, 0.79, 0.83, steel);
    if (stride < 6) beam(out, 'metal', ring, [q[0], ringY(b), q[1]], 1.35, 1.35, steel);
    if (!cables) continue;
    beam(out, 'metal', foot, tip, 0.49, 0.48, steel);
    const hub = innerR(a),
      lower = (t) => radial(a, r * (1 - t) + hub * t, lowerY(a, t));
    const upper = (t) => radial(a, roofR(a) * (1 - t) + hub * t, upperY(a, t));
    for (const t of [0, 0.5]) {
      beam(out, 'metal', lower(t), lower(t + 0.5), 0.12, 0.12, steel);
      beam(out, 'metal', upper(t), upper(t + 0.5), 0.1, 0.1, steel);
    }
    if (detail.woven) {
      for (const t of [0.25, 0.5, 0.75])
        beam(out, 'metal', lower(t), upper(t), 0.075, 0.075, steel);
    }
    if (i % 2 === 0) beam(out, 'metal', upper(1), radial(a, 8.5, 70.8), 0.075, 0.075, steel);
  }
  const sides = stride === 6 ? 6 : 12;
  lathe(
    out,
    'metal',
    [
      [38, 0.8],
      [79, 0.82],
    ],
    white,
    sides,
  );
  lathe(
    out,
    'membrane',
    [
      [64.4, 8.8],
      [68.7, 10.4],
      [71.4, 2],
    ],
    white,
    sides,
  );
  for (let i = 0; i < 6; i++)
    lathe(
      out,
      'plastic',
      [
        [79 + (i * 29) / 6, 0.82 - i * 0.12],
        [79 + ((i + 1) * 29) / 6, 0.82 - (i + 1) * 0.12],
      ],
      i % 2 === 0 ? red : white,
      sides,
    );
  if (stride === 6) return;
  for (let i = 0; i < 4; i++) {
    const front = transformed(out, (turn * i) / 4, [0, 0, 0]);
    box(front, 'metal', [-7.1, 43, 6.48], [7.1, 51.3, 7.23], steel);
    face(
      front,
      'glass',
      [
        [-6.8, 43.25, 7.25],
        [6.8, 43.25, 7.25],
        [6.8, 51, 7.25],
        [-6.8, 51, 7.25],
      ],
      dark,
      [0, 0, 1],
    );
  }
}

function standAndField(out, detail) {
  const { facets, rows } = detail;
  for (let i = 0; i < facets; i++) {
    const a = (i * turn) / facets,
      b = ((i + 1) * turn) / facets;
    for (const tier of [0, 1]) {
      const total = tier ? 37 : 28;
      for (let j = 0; j < rows; j++) {
        const from = (j * total) / rows,
          to = ((j + 1) * total) / rows;
        const p = seat(a, tier, from),
          q = seat(b, tier, from),
          r = seat(b, tier, to),
          s = seat(a, tier, to);
        const median = radial((a + b) / 2, -1);
        const aisle = rows > 2 && i % Math.round(facets / 18) === 0;
        const noise = (Math.imul(i + 37, 19349663) ^ Math.imul(j + 17, 73856093)) >>> 0;
        const tint = aisle ? stone : noise % 100 < (tier ? 38 : 81) ? red : white;
        if (rows > 2) {
          const R = low(r, q[1]),
            S = low(s, p[1]);
          face(out, aisle ? 'concrete' : 'plastic', [p, q, R, S], tint, up);
          face(
            out,
            'concrete',
            [S, R, r, s],
            tint.map((x) => x * 0.75),
            median,
          );
        } else {
          face(out, 'plastic', [p, q, r, s], tint, up);
        }
      }
    }
  }
  if (detail.woven) {
    soccerPitch(transformed(out, 0, [0, 8.1, 0]));
    return;
  }
  box(out, 'turf', [-41, 7.94, -60], [41, 8.11, 60], [0.15, 0.31, 0.1]);
  for (let i = 0; i < 10; i++) {
    const z = -52.5 + i * 10.5,
      y = 8.116;
    face(
      out,
      'turf',
      [
        [-34, y, z],
        [34, y, z],
        [34, y, z + 10.5],
        [-34, y, z + 10.5],
      ],
      i % 2 ? [0.19, 0.335, 0.086] : [0.24, 0.39, 0.115],
      up,
    );
  }
  for (const z of [-52.5, 0, 52.5]) {
    face(
      out,
      'plastic',
      [
        [-34, 8.121, z - 0.12],
        [34, 8.121, z - 0.12],
        [34, 8.121, z + 0.12],
        [-34, 8.121, z + 0.12],
      ],
      white,
      up,
    );
  }
  for (const x of [-34, 34]) {
    face(
      out,
      'plastic',
      [
        [x - 0.12, 8.121, -52.5],
        [x + 0.12, 8.121, -52.5],
        [x + 0.12, 8.121, 52.5],
        [x - 0.12, 8.121, 52.5],
      ],
      white,
      up,
    );
  }
}

function approaches(out, detail) {
  if (!detail.steps) return;
  const run = 42;
  for (let i = 0; i < 18; i++) {
    const a = (i * turn) / 18,
      stairs = transformed(out, a, radial(a, roofR(a) - 6));
    const y = (z) => 18.18 - (18 * z) / run;
    for (let j = 0; j < detail.steps; j++) {
      const p = (j * run) / detail.steps,
        q = ((j + 1) * run) / detail.steps;
      const yy = detail.steps === 1 ? y(q) : y(p);
      face(
        stairs,
        'concrete',
        [
          [-4, y(p), p],
          [4, y(p), p],
          [4, yy, q],
          [-4, yy, q],
        ],
        stone,
        up,
      );
      if (detail.steps > 1)
        face(
          stairs,
          'concrete',
          [
            [-4, yy, q],
            [4, yy, q],
            [4, y(q), q],
            [-4, y(q), q],
          ],
          stone,
          [0, 0, 1],
        );
    }
  }
}

function build(out, detail) {
  shellAndRoof(out, detail);
  crown(out, detail);
  standAndField(out, detail);
  approaches(out, detail);
}

export const buildSkyline = (out) =>
  build(out, { facets: 18, stride: 6, radialBands: [0, 0.56, 1], panels: 3, rows: 1 });
export const buildDistrict = (out) =>
  build(out, {
    facets: 36,
    stride: 3,
    radialBands: [0, 0.41, 0.73, 1],
    panels: 6,
    rows: 2,
    steps: 1,
  });
export const buildStreet = (out) =>
  build(out, {
    facets: 72,
    stride: 2,
    radialBands: [0, 0.23, 0.44, 0.65, 0.83, 1],
    panels: 11,
    rows: 8,
    steps: 11,
    cables: true,
  });
export const buildCloseup = (out) =>
  build(out, {
    facets: 144,
    stride: 1,
    radialBands: [0, 0.18, 0.34, 0.53, 0.7, 0.85, 1],
    panels: 20,
    rows: 25,
    steps: 32,
    cables: true,
    woven: true,
  });
