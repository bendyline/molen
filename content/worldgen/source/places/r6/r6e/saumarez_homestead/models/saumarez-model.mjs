/** Principal Saumarez Homestead house, October 2014. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  outline = read('map-frame').geometry.polygons[0];
const { foundationBottom, threshold, upperFloor, eaves, ridge } = plan.section;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.08 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.53, metallic: 0.035 },
};
const t = Object.fromEntries(
  Object.entries({
    brick: '785b54',
    darkBrick: '674c44',
    roof: '769485',
    fascia: '648371',
    trim: 'e4ddd0',
    post: 'a3aaa7',
    base: '9a8f7d',
    stone: 'b2a28b',
    pane: '525b53',
    door: '6e6a52',
  }).map(([key, value]) => [key, rgb(value)]),
);
const B = (out, slot, x, y, z, w, h, d, tone = t[slot]) => box(out, slot, x, y, z, w, h, d, tone);
function slab(out, slot, x0, x1, z0, z1, y0, y1, tone = t[slot]) {
  B(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, tone);
}
function face(out, slot, points, orientation, tone = t[slot]) {
  let n = normalFor(...points);
  if (n.reduce((dot, value, i) => dot + value * orientation[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tone);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tone,
    );
}
function footing(out) {
  const mesh = new MeshBufferBuilder();
  poly(mesh, 'stone', outline, foundationBottom, threshold, t.base);
  const { indices, positions, normals } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(
      out,
      'stone',
      points,
      Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3)),
      t.base,
    );
  }
}
function elevation(axis, coordinate, sign = 1) {
  return axis === 'x'
    ? { at: (u, y, d = 0) => [coordinate + sign * d, y, u], normal: [sign, 0, 0] }
    : { at: (u, y, d = 0) => [u, y, coordinate + sign * d], normal: [0, 0, sign] };
}
function panel(out, slot, s, u0, u1, y0, y1, d, tone = t[slot]) {
  face(
    out,
    slot,
    [s.at(u0, y0, d), s.at(u1, y0, d), s.at(u1, y1, d), s.at(u0, y1, d)],
    s.normal,
    tone,
  );
}
function opening(out, s, u, y, w, h, lod, { arched = false, door = false } = {}) {
  const r = w / 2,
    shell = r + 0.12,
    top = y + h;
  const pane = door ? t.door : t.pane;
  panel(out, 'stone', s, u - shell, u + shell, y - 0.09, top + 0.06, 0.051, t.stone);
  if (!arched || lod === 0) panel(out, 'pane', s, u - r, u + r, y, top, 0.073, pane);
  else {
    const spring = top - 0.31;
    panel(out, 'pane', s, u - r, u + r, y, spring, 0.073, pane);
    const q = (i) => {
      const a = (i * Math.PI) / 8;
      return s.at(u + Math.cos(a) * r, spring + Math.sin(a) * 0.31, 0.073);
    };
    for (let i = 0; i < 8; i++)
      face(out, 'pane', [s.at(u, spring, 0.073), q(i), q(i + 1)], s.normal, pane);
  }
  if (lod >= 2) {
    panel(out, 'trim', s, u - 0.025, u + 0.025, y, top - (arched ? 0.15 : 0), 0.09, t.trim);
    panel(out, 'trim', s, u - r, u + r, y + h * 0.54, y + h * 0.54 + 0.036, 0.091, t.trim);
  }
}
function gable(out, [x0, x1, z0, z1], low, high, axis, lod, painted = false) {
  const e = 0.27;
  const p = axis === 'z' ? (u, y, d) => [u, y, d] : (u, y, d) => [d, y, u];
  const [u0, u1, d0, d1] = axis === 'z' ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const mid = (u0 + u1) / 2;
  for (const u of [u0 - e, u1 + e])
    face(
      out,
      'roof',
      [p(u, low, d0 - e), p(u, low, d1 + e), p(mid, high, d1 + e), p(mid, high, d0 - e)],
      [0, 1, 0],
    );
  for (const [d, sign] of [
    [d0, -1],
    [d1, 1],
  ]) {
    const side = axis === 'z' ? [0, 0, sign] : [sign, 0, 0];
    face(out, 'brick', [p(u0, low, d), p(u1, low, d), p(mid, high, d)], side, t.brick);
    if (!painted || lod === 0) continue;
    const outer = d + sign * (e + 0.022);
    for (const u of [u0 - e, u1 + e])
      beam(out, 'trim', p(u, low - 0.025, outer), p(mid, high - 0.025, outer), 0.17, 0.13, t.trim);
    beam(out, 'trim', p(u0, low + 0.1, outer), p(u1, low + 0.1, outer), 0.14, 0.11, t.trim);
    if (lod >= 2)
      for (let i = 1; i < 13; i++) {
        const u = u0 + ((u1 - u0) * i) / 13;
        const h = low + (high - low) * (1 - Math.abs(u - mid) / ((u1 - u0) / 2));
        if (h - low > 0.36)
          beam(
            out,
            'trim',
            p(u, low + 0.12, outer - 0.05),
            p(u, h - 0.08, outer - 0.05),
            0.087,
            0.08,
            t.trim,
          );
      }
  }
}
function pairedPediments(out, z, x, lod) {
  const s = elevation('z', z);
  for (const dx of [-1.2, 1.2]) {
    const u = x + dx;
    opening(out, s, u, threshold + 0.57, 1.28, 2.19, lod, { arched: true });
    opening(out, s, u, upperFloor + 0.54, 1.38, 2.22, lod);
    if (lod === 0) continue;
    const lip = z + 0.34,
      base = upperFloor + 2.81,
      peak = base + 0.78;
    const pts = [
      [u - 0.96, base, lip],
      [u + 0.96, base, lip],
      [u, peak, lip],
    ];
    face(out, 'trim', pts, [0, 0, 1]);
    for (const x of [u - 0.96, u + 0.96]) {
      face(
        out,
        'roof',
        [
          [x, base, lip],
          [x, base, z + 0.015],
          [u, peak, z + 0.015],
          [u, peak, lip],
        ],
        [0, 1, 0],
        t.fascia,
      );
      beam(out, 'trim', [x, base - 0.03, lip + 0.03], [u, peak, lip + 0.03], 0.13, 0.13, t.trim);
      if (lod >= 2)
        beam(
          out,
          'trim',
          [x + Math.sign(u - x) * 0.13, base - 0.06, lip - 0.03],
          [x + Math.sign(u - x) * 0.23, base - 0.54, z + 0.1],
          0.13,
          0.11,
          t.trim,
        );
    }
  }
  if (lod) B(out, 'stone', x, upperFloor + 0.29, z + 0.13, 4.35, 0.27, 0.43, t.stone);
}
function brickBlock(out, rect, height, roofHeight, axis, lod, main = false) {
  const [x0, x1, z0, z1] = rect;
  slab(out, 'brick', x0, x1, z0, z1, threshold, height);
  slab(
    out,
    'stone',
    x0 - 0.012,
    x1 + 0.012,
    z0 - 0.012,
    z1 + 0.012,
    height - 0.58,
    height - 0.41,
    t.base,
  );
  gable(out, rect, height, roofHeight, axis, lod, main);
}
function chimney(out, x, z, base, h, lod) {
  B(out, 'brick', x, base, z, 0.96, h, 0.9, t.darkBrick);
  B(out, 'brick', x, base + h - 0.19, z, 1.11, 0.18, 1.04, t.darkBrick);
  if (lod >= 2) B(out, 'stone', x, base + h - 0.032, z, 1.08, 0.08, 1.01, t.base);
}

function veranda(out, x0, x1, z0, z1, bays, lod, glazed = false) {
  const floor = threshold,
    upper = upperFloor,
    high = eaves - 0.66;
  slab(out, 'trim', x0, x1, z0, z1, upper - 0.24, upper, t.stone);
  slab(out, 'trim', x0, x1, z0, z1, floor - 0.12, floor, t.base);
  face(
    out,
    'roof',
    [
      [x0 - 0.12, high, z1 + 0.22],
      [x1 + 0.12, high, z1 + 0.22],
      [x1 + 0.12, high + 0.62, z0 - 0.12],
      [x0 - 0.12, high + 0.62, z0 - 0.12],
    ],
    [0, 1, 0],
  );
  const front = elevation('z', z1);
  const pitch = (x1 - x0) / bays;
  for (let bay = 0; bay <= bays; bay++) {
    const x = x0 + bay * pitch;
    B(out, 'trim', x, floor, z1 - 0.08, 0.16, high - floor, 0.16, t.post);
    if (lod >= 2) B(out, 'trim', x, upper, z1 - 0.08, 0.27, 0.18, 0.27, t.trim);
  }
  for (const y of [upper - 0.63, high - 0.24])
    B(out, 'trim', (x0 + x1) / 2, y, z1 - 0.08, x1 - x0, 0.28, 0.21, t.trim);

  for (let bay = 0; bay < bays; bay++) {
    const left = x0 + bay * pitch,
      right = left + pitch;
    if (glazed && bay === bays - 1) {
      panel(out, 'trim', front, left + 0.03, right - 0.03, upper, high - 0.12, 0.022);
      panel(out, 'pane', front, left + 0.21, right - 0.21, upper + 1.1, high - 0.35, 0.052);
      if (lod)
        for (let i = 1; i < 4; i++) {
          const u = left + (pitch * i) / 4;
          panel(out, 'trim', front, u - 0.038, u + 0.038, upper + 1.11, high - 0.33, 0.065);
        }
    } else {
      for (const [y0, y1] of [
        [upper + 0.13, upper + 0.22],
        [upper + 0.89, upper + 0.99],
      ])
        panel(out, 'trim', front, left, right, y0, y1, 0.036);
      const rails = [3, 5, 7, 9][lod];
      for (let i = 1; i < rails; i++) {
        const u = left + (pitch * i) / rails;
        panel(out, 'trim', front, u - 0.032, u + 0.032, upper + 0.21, upper + 0.9, 0.041);
        if (lod >= 2) {
          const cy = upper + 0.53,
            r = Math.min(0.13, (pitch / rails) * 0.46);
          for (const sign of [-1, 1])
            face(
              out,
              'trim',
              [
                front.at(u, cy - r, 0.058),
                front.at(u + sign * r, cy, 0.058),
                front.at(u + sign * r * 0.67, cy, 0.058),
                front.at(u, cy - r * 0.67, 0.058),
              ],
              front.normal,
            );
        }
      }
    }
    if (lod)
      for (const y of [upper - 0.49, high - 0.14]) {
        const n = lod >= 3 ? 10 : 5;
        const point = (i) => {
          const v = i / n;
          return [left + pitch * v, y - 0.52 + 0.46 * Math.sin(v * Math.PI)];
        };
        for (let i = 1; i <= n; i++) {
          const [[a, b], [c, d]] = [point(i - 1), point(i)];
          face(
            out,
            'trim',
            [
              front.at(a, b, 0.031),
              front.at(c, d, 0.031),
              front.at(c, y + 0.03, 0.031),
              front.at(a, y + 0.03, 0.031),
            ],
            front.normal,
          );
        }
      }
  }
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ]) {
    const s = elevation('x', x, sign);
    panel(out, 'trim', s, z0, z1, upper + 0.87, upper + 0.98, 0.015);
    B(out, 'trim', x, upper, z0 + 0.1, 0.16, high + 0.55 - upper, 0.16, t.post);
    if (lod)
      for (let i = 1; i < 7; i++) {
        const u = z0 + ((z1 - z0) * i) / 7;
        panel(out, 'trim', s, u - 0.032, u + 0.032, upper + 0.15, upper + 0.91, 0.019);
      }
  }
}
function build(out, _frame, lod = 3) {
  footing(out);
  brickBlock(out, [-22.32, -15.92, -11.6, 6.28], eaves - 0.12, ridge - 0.2, 'z', lod, true);
  brickBlock(out, [-15.92, -7.28, -11.6, 3.22], eaves - 0.24, ridge - 0.72, 'x', lod);
  brickBlock(out, [-7.28, -0.98, -13.37, 9.23], eaves, ridge, 'z', lod, true);
  brickBlock(out, [-0.98, 7.27, -6.42, 3.48], eaves - 0.31, ridge - 0.72, 'x', lod);
  brickBlock(out, [7.22, 17.96, -6.44, 6.62], eaves - 1.24, ridge - 2.43, 'x', lod);
  brickBlock(out, [17.96, 25.67, -4.24, 7.18], eaves - 1.39, ridge - 2.51, 'z', lod, true);
  slab(out, 'brick', -24.23, -22.28, -9.64, -3.13, threshold, eaves - 2.72);
  gable(out, [-24.23, -22.28, -9.64, -3.13], eaves - 2.72, eaves - 1.82, 'z', lod);
  slab(out, 'brick', -6.98, -0.72, -14.31, -12.92, threshold, eaves - 2.77);
  slab(out, 'brick', -0.76, 5.93, -11.94, -8.57, threshold, eaves - 2.67);
  gable(out, [-0.76, 5.93, -11.94, -8.57], eaves - 2.67, eaves - 1.41, 'x', lod);

  pairedPediments(out, 6.28, -19.1, lod);
  pairedPediments(out, 9.23, -4.13, lod);
  veranda(out, -15.85, -7.36, 3.14, 6.31, 3, lod, true);
  veranda(out, -0.86, 6.25, 3.35, 6.67, 3, lod);
  for (const [x, z, base, h] of [
    [-17.66, -1.72, 8.16, 2.76],
    [-4.47, 1.32, 9.42, 2.61],
    [10.8, -3.18, 7.24, 2.32],
    [20.85, 0.18, 7.09, 1.94],
  ])
    chimney(out, x, z, base, h, lod);
  for (const [axis, c, sign, positions] of [
    ['x', -22.32, -1, [-0.08, 3.28]],
    ['x', 25.67, 1, [-2.15, 1.01, 4.12]],
    ['z', 6.62, 1, [9.1, 12.75, 16.07]],
    ['z', 7.18, 1, [19.93, 23.72]],
    ['z', -11.6, -1, [-20.32, -17.48, -13.83, -10.19]],
  ]) {
    const s = elevation(axis, c, sign);
    for (const u of positions) {
      opening(out, s, u, threshold + 0.64, 0.94, 1.81, lod, { arched: true });
      if (lod) opening(out, s, u, upperFloor + 0.28, 0.87, 1.48, lod);
    }
  }
  for (let i = 0; i < (lod === 0 ? 1 : 3); i++)
    slab(out, 'stone', 1.38, 4.0, 6.55, 7.34 - i * 0.2, -0.48, threshold - (2 - i) * 0.13, t.stone);
}
export const saumarezSkyline = (out) => build(out, undefined, 0);
export const saumarezDistrict = (out) => build(out, undefined, 1);
export const saumarezStreet = (out) => build(out, undefined, 2);
export const saumarezCloseup = (out) => build(out, undefined, 3);

const recipe = 'saumarez-model.mjs',
  camera = [43, 18, 48],
  lookAt = [0, 5.5, 0];
export const saumarezModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Saumarez brick homestead with green corrugated gables, paired bracketed windows, tall chimneys and two tiers of light verandas.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'The named mapped principal house is separate from the site’s farm buildings.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'metal_corrugated',
    'wood_plain',
    'stone_sandstone_raw',
  ],
  qaCameras: [
    { name: 'brick-gables-and-northwest-verandas', position: [-38, 10, 36], lookAt: [-7, 5, 3] },
    { name: 'veranda-ironwork-and-glazed-bay', position: [-13, 9, 22], lookAt: [-9, 5, 6.2] },
    { name: 'rear-service-roofs-and-chimneys', position: [24, 19, -43], lookAt: [0, 6, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-saumarez-homestead-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'saumarezSkyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'saumarezDistrict', 0.15],
        ['street', 'saumarezStreet', 0.061],
        ['closeup', 'saumarezCloseup', 0.021],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Damien Linnane dedicated the exact October 2014 reference under CC0. OpenStreetMap contributors supply the mapped envelope under ODbL.',
};
