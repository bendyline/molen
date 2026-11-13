/** The Lviv Armenian Cathedral, with its eastern apses and south courtyard arcade. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { mainRange, crossing, gallery, nativeRing, foundationBottom } = plan;
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85, metallic: 0.05 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.1 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const colors = {
  wall: rgb('d4c6a5'),
  stone: rgb('b5a588'),
  roof: rgb('657574'),
  iron: rgb('4a4940'),
  dark: rgb('4b4a43'),
};
const pale = rgb('c8b899'),
  darkerStone = rgb('a6997e'),
  lightRoof = rgb('788581');
const facade = rgb('d8c4a0'),
  glass = rgb('52626b');
const block = (out, slot, x0, y0, z0, x1, y1, z1, color = colors[slot]) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], color);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
function face(out, slot, points, outward, color = colors[slot]) {
  let normal = normalFor(...points);
  if (dot(normal, outward) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, ([x, y]) => [x, y], color);
}
function gable(out, range, axis, wall, wallColor = colors[wall], roofColor = colors.roof) {
  const [u0, u1] = axis === 'x' ? range.x : range.z;
  const [v0, v1] = axis === 'x' ? range.z : range.x;
  const mid = (v0 + v1) / 2;
  const p = (u, y, v) => (axis === 'x' ? [u, y, v] : [v, y, u]);
  const y = range.eave,
    top = range.ridge;
  face(out, wall, [p(u0, y, v0), p(u0, y, v1), p(u0, top, mid)], p(-1, 0, 0), wallColor);
  face(out, wall, [p(u1, y, v0), p(u1, y, v1), p(u1, top, mid)], p(1, 0, 0), wallColor);
  for (const v of [v0 - 0.21, v1 + 0.21]) {
    const a = p(u0 - 0.18, y - 0.06, v),
      b = p(u1 + 0.18, y - 0.06, v);
    const c = p(u1 + 0.18, top + 0.075, mid),
      d = p(u0 - 0.18, top + 0.075, mid);
    face(out, 'roof', [a, b, c, d], [0, 1, 0], roofColor);
    face(
      out,
      'roof',
      [a, b, [b[0], b[1] + 0.16, b[2]], [a[0], a[1] + 0.16, a[2]]],
      p(0, 0, Math.sign(v - mid)),
      roofColor,
    );
  }
}
function archedPanel(out, at, normal, w, y, h, lod, color = colors.dark, surround = colors.stone) {
  const steps = lod > 1 ? 9 : 5;
  const draw = (slot, width, base, height, offset, tint) => {
    const r = width / 2,
      spring = base + height - r;
    const points = [at(-r, base, offset), at(r, base, offset)];
    for (let i = 0; i <= steps; i++) {
      const theta = (Math.PI * i) / steps;
      points.push(at(r * Math.cos(theta), spring + r * Math.sin(theta), offset));
    }
    face(out, slot, points, normal, tint);
  };
  draw('stone', w + 0.23, y - 0.11, h + 0.24, 0.04, surround);
  draw('dark', w, y, h, 0.064, color);
}
function curveBand(out, slot, cx, cz, rx, rz, y0, y1, steps, color = colors[slot]) {
  const point = (t, y) => [cx + rx * Math.cos(t), y, cz + rz * Math.sin(t)];
  for (let i = 0; i < steps; i++) {
    const a = Math.PI * (i / steps - 0.5),
      b = Math.PI * ((i + 1) / steps - 0.5);
    face(
      out,
      slot,
      [point(a, y0), point(b, y0), point(b, y1), point(a, y1)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      color,
    );
  }
}
function apse(out, cx, cz, rx, rz, eave, lod, primary) {
  const steps = [8, 12, 16, 20][lod];
  curveBand(
    out,
    'stone',
    cx,
    cz,
    rx,
    rz,
    foundationBottom,
    eave,
    steps,
    primary ? colors.stone : darkerStone,
  );
  if (lod)
    curveBand(
      out,
      'stone',
      cx,
      cz,
      rx + 0.13,
      rz + 0.11,
      foundationBottom,
      0.44,
      steps,
      darkerStone,
    );
  curveBand(out, 'stone', cx, cz, rx + 0.16, rz + 0.15, eave - 0.24, eave + 0.06, steps, pale);
  for (let i = 0; i < steps; i++) {
    const at = (t) => [
      cx + (rx + 0.21) * Math.cos(t),
      eave + 0.045,
      cz + (rz + 0.18) * Math.sin(t),
    ];
    const a = Math.PI * (i / steps - 0.5),
      b = Math.PI * ((i + 1) / steps - 0.5);
    face(out, 'roof', [at(a), at(b), [cx, eave + (primary ? 1.73 : 1.13), cz]], [0, 1, 0]);
  }
  if (!lod) return;
  const angles = primary ? [-0.81, 0, 0.81] : [0];
  for (const angle of angles) {
    const outward = [Math.cos(angle), 0, Math.sin(angle)];
    const at = (u, y, d) => [
      cx + (rx + 0.017 + d) * outward[0] - u * outward[2],
      y,
      cz + (rz + 0.017 + d) * outward[2] + u * outward[0],
    ];
    archedPanel(
      out,
      at,
      outward,
      primary ? 0.72 : 0.55,
      eave - 3.75,
      primary ? 2.8 : 2.2,
      lod,
      colors.dark,
      pale,
    );
  }
  if (lod < 2) return;
  for (const angle of primary ? [-1.18, -0.41, 0.41, 1.18] : [-0.86, 0.86]) {
    const n = [Math.cos(angle), 0, Math.sin(angle)];
    const x = cx + (rx + 0.025) * n[0],
      z = cz + (rz + 0.025) * n[2];
    const rect = (y, w, d) =>
      [
        [-w, -d],
        [-w, d],
        [w, d],
        [w, -d],
      ].map(([u, v]) => [x + u * n[0] + v * n[2], y, z + u * n[2] - v * n[0]]);
    loft(out, 'stone', [rect(0.47, 0.115, 0.19), rect(eave - 0.44, 0.115, 0.19)], pale);
  }
}
function arcade(out, lod) {
  const [x0, x1] = gallery.x,
    { back, front, bays } = gallery;
  const low = 0.22,
    columnTop = 2.68,
    top = 4.67;
  const spacing = (x1 - x0) / bays,
    radius = spacing / 2 - 0.11,
    steps = [5, 7, 9, 12][lod];
  block(out, 'stone', x0, foundationBottom, back, x1, low, front + 0.23, darkerStone);
  block(out, 'wall', x0, low, back - 0.24, x1, top, back + 0.02, facade);
  block(out, 'stone', x0, top - 0.13, front - 0.25, x1, top + 0.07, front + 0.15, pale);
  face(
    out,
    'roof',
    [
      [x0 - 0.12, top + 1.27, back - 0.14],
      [x1 + 0.12, top + 1.27, back - 0.14],
      [x1 + 0.12, top + 0.03, front + 0.22],
      [x0 - 0.12, top + 0.03, front + 0.22],
    ],
    [0, 1, 0],
    lightRoof,
  );
  for (let i = 0; i <= bays; i++) {
    const x = x0 + spacing * i;
    const profile = lod
      ? [
          [low, 0.34],
          [low + 0.19, 0.34],
          [low + 0.28, 0.23],
          [columnTop - 0.23, 0.21],
          [columnTop - 0.12, 0.26],
          [columnTop, 0.3],
        ]
      : [
          [low, 0.31],
          [low + 0.22, 0.24],
          [columnTop, 0.29],
        ];
    const rings = profile.map(([y, r]) => radialRing(y, r, r, lod > 1 ? 10 : 6, [x, front - 0.11]));
    loft(out, 'stone', rings, i % 2 ? pale : colors.stone);
  }
  for (let i = 0; i < bays; i++) {
    const x = x0 + spacing * (i + 0.5);
    const arc = (n, r, z) => [
      x + r * Math.cos((Math.PI * n) / steps),
      columnTop + r * Math.sin((Math.PI * n) / steps),
      z,
    ];
    for (let j = 0; j < steps; j++) {
      const a = arc(j, radius, front + 0.04),
        b = arc(j + 1, radius, front + 0.04);
      const c = arc(j, radius, front - 0.37),
        d = arc(j + 1, radius, front - 0.37);
      face(out, 'stone', [a, b, d, c], [x - (a[0] + b[0]) / 2, -1, 0], pale);
      const exterior = lod ? 'stone' : 'wall';
      const outerA = arc(j, radius + 0.14, front + 0.04),
        outerB = arc(j + 1, radius + 0.14, front + 0.04);
      face(out, exterior, [a, b, outerB, outerA], [0, 0, 1], pale);
      face(
        out,
        'wall',
        [outerA, outerB, [outerB[0], top, front + 0.04], [outerA[0], top, front + 0.04]],
        [0, 0, 1],
        facade,
      );
    }
    if (lod > 1 && i % 2 === 1) {
      const at = (u, y, d) => [x + u, y, back + 0.025 + d];
      archedPanel(out, at, [0, 0, 1], 0.84, 1.1, 2.15, lod, glass);
    }
  }
}
function dome(out, lod) {
  const center = crossing.drumCenter,
    r = crossing.drumRadius,
    top = crossing.drumTop;
  const sides = 12,
    phase = Math.PI / 12;
  const rings = (layers) =>
    layers.map(([y, radius]) => radialRing(y, radius, radius, sides, center, phase));
  loft(
    out,
    'stone',
    rings([
      [12.75, r + 0.22],
      [14.45, r + 0.22],
      [14.73, r],
      [top - 0.37, r],
      [top - 0.16, r + 0.18],
      [top, r + 0.18],
    ]),
    colors.stone,
  );
  loft(
    out,
    'roof',
    rings([
      [top, r + 0.23],
      [top + 0.29, r - 0.19],
      [top + 1.37, 0.16],
    ]),
    colors.roof,
  );
  const [x, z] = center;
  if (lod) {
    const edges = rings([[top - 0.52, r]])[0];
    for (let i = 0; i < sides; i++) {
      const a = edges[i],
        b = edges[(i + 1) % sides];
      const middle = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2];
      const n = [
        (middle[0] - x) / (r * Math.cos(Math.PI / sides)),
        0,
        (middle[1] - z) / (r * Math.cos(Math.PI / sides)),
      ];
      const at = (u, y, d) => [middle[0] - u * n[2] + d * n[0], y, middle[1] + u * n[0] + d * n[2]];
      if (i % 2 === 0) archedPanel(out, at, n, 0.71, 15.23, 2.65, lod, glass, pale);
      else if (lod > 1) {
        const pts = Array.from({ length: 10 }, (_, j) =>
          at(
            0.255 * Math.cos((j * Math.PI) / 5),
            17.41 + 0.255 * Math.sin((j * Math.PI) / 5),
            0.045,
          ),
        );
        face(out, 'dark', pts, n, glass);
      }
      if (lod > 1) {
        const u = -0.72;
        face(
          out,
          'stone',
          [
            at(u - 0.068, 14.67, 0.018),
            at(u + 0.068, 14.67, 0.018),
            at(u + 0.068, top - 0.39, 0.018),
            at(u - 0.068, top - 0.39, 0.018),
          ],
          n,
          pale,
        );
      }
    }
    sphere(out, 'iron', [x, top + 1.49, z], [0.19, 0.21, 0.19], colors.iron, 8, 6);
  }
  block(out, 'iron', x - 0.042, top + 1.45, z - 0.055, x + 0.042, top + 2.66, z + 0.055);
  block(out, 'iron', x - 0.047, top + 2.22, z - 0.35, x + 0.047, top + 2.31, z + 0.35);
}
function eastChapel(out, lod) {
  const range = { x: [6.7, 11.65], z: [4.85, 9.47], eave: 5.55, ridge: 7.95 };
  block(
    out,
    'wall',
    range.x[0],
    foundationBottom,
    range.z[0],
    range.x[1],
    range.eave,
    range.z[1],
    facade,
  );
  gable(out, range, 'z', 'wall', facade);
  const x = (range.x[0] + range.x[1]) / 2,
    z = range.z[1];
  block(out, 'stone', range.x[0] + 0.21, 4.92, z, range.x[1] - 0.21, 5.25, z + 0.16, pale);
  archedPanel(out, (u, y, d) => [x + u, y, z + d], [0, 0, 1], 1.55, 0.56, 3.56, lod, colors.dark);
  if (lod > 1)
    for (const u of [-0.56, -0.37, -0.18, 0, 0.18, 0.37, 0.56]) {
      const h = 3.08 + 0.77 * Math.cos(u * 1.75);
      block(out, 'iron', x + u - 0.019, 0.67, z + 0.08, x + u + 0.019, h, z + 0.126);
    }
  block(out, 'iron', x - 0.043, 7.91, z - 0.04, x + 0.043, 8.82, z + 0.04);
  block(out, 'iron', x - 0.28, 8.47, z - 0.042, x + 0.28, 8.55, z + 0.042);
}

export function buildCathedral(out, _frame, lod = 3) {
  const [x0, x1] = mainRange.x,
    [z0, z1] = mainRange.z;
  const annex = nativeRing.slice(4);
  const annexBuilder = new MeshBufferBuilder();
  poly(annexBuilder, 'stone', annex, foundationBottom, 0.5, darkerStone);
  poly(annexBuilder, 'wall', annex, 0.5, 6.52, facade);
  const mesh = annexBuilder.finalize();
  for (const group of mesh.groups) {
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const points = Array.from(mesh.indices.slice(i, i + 3), (index) =>
        Array.from(mesh.positions.slice(index * 3, index * 3 + 3)),
      );
      face(
        out,
        group.slot,
        points,
        normalFor(...points),
        group.slot === 'stone' ? darkerStone : facade,
      );
    }
  }
  gable(
    out,
    { x: [-21.25, -10.72], z: [-0.54, 7.34], eave: 6.52, ridge: 8.89 },
    'x',
    'wall',
    facade,
  );
  block(out, 'stone', x0, foundationBottom, z0, x1, 0.51, z1, darkerStone);
  block(out, 'wall', x0, 0.51, z0, x1, mainRange.eave, z1);
  gable(out, mainRange, 'x', 'wall');
  const [tx0, tx1] = crossing.x,
    [tz0, tz1] = crossing.z;
  block(out, 'stone', tx0, foundationBottom, tz0, tx1, crossing.eave, tz1);
  gable(out, crossing, 'z', 'stone');
  const eastRange = { x: [11.35, 15.55], z: [-6.36, 3.97], eave: 9.94, ridge: 13.47 };
  gable(out, eastRange, 'x', 'stone');
  apse(out, 15.46, -1.19, 4.0, 3.36, 8.46, lod, true);
  apse(out, 15.24, -6.58, 2.46, 1.85, 7.43, lod, false);
  apse(out, 15.24, 3.94, 2.34, 1.72, 7.18, lod, false);
  arcade(out, lod);
  eastChapel(out, lod);
  dome(out, lod);
  if (lod) {
    for (const x of [-7.8, -3.06, 1.38, 7.75, 12.1])
      archedPanel(
        out,
        (u, y, d) => [x + u, y, (x < 4.7 ? z0 : tz0) - d],
        [0, 0, -1],
        0.88,
        4.66,
        3.07,
        lod,
        glass,
        pale,
      );
    for (const x of [-18.65, -15.06, -12.52])
      archedPanel(
        out,
        (u, y, d) => [x + u, y, 7.333 + d],
        [0, 0, 1],
        0.79,
        3.38,
        2.24,
        lod,
        glass,
        pale,
      );
    archedPanel(
      out,
      (u, y, d) => [10.14 + u, y, tz1 + d],
      [0, 0, 1],
      1.21,
      9.0,
      3.21,
      lod,
      glass,
      pale,
    );
  }
}
export const cathedralSkyline = (out, frame) => buildCathedral(out, frame, 0);
export const cathedralDistrict = (out, frame) => buildCathedral(out, frame, 1);
export const cathedralStreet = (out, frame) => buildCathedral(out, frame, 2);
export const cathedralCloseup = (out, frame) => buildCathedral(out, frame, 3);

const camera = [53, 33, 47],
  lookAt = [-1, 8, 0];
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'cathedral-model.mjs',
  surfaces,
  build: buildCathedral,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Low polygonal metal cupola, dressed stone apses and open southern courtyard arcade of Lviv’s Armenian Cathedral.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_sandstone',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'eastern-apses-and-drum', position: [38, 13, 19], lookAt: [10, 9, -1] },
    { name: 'courtyard-gallery-and-chapel', position: [17, 7, 28], lookAt: [-1, 5, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/u8/u8c/armenian_cathedral_of_lviv/models/cathedral-model.mjs',
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.24,
    surfaces,
    authoredLevels: {
      district: { export: 'cathedralDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'cathedralStreet', errorMeters: 0.061, surfaces },
      closeup: { export: 'cathedralCloseup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The three published exterior photographs are by Aschroet under CC0. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
