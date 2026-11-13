/** Old Parliament House in Athens, with twin Ionic porticos and recessed courts. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { exteriorWallRing, porticos, foundationBottom, entryFloor, wallTop, upperTop } = plan;
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9, metallic: 0.06 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
const colors = {
  wall: rgb('c8aa80'),
  base: rgb('a59278'),
  trim: rgb('e1d8c4'),
  roof: rgb('767771'),
  dark: rgb('48483c'),
};
const rustication = rgb('9d8872'),
  plaster = rgb('ccb38c'),
  red = rgb('874839'),
  glass = rgb('48504c'),
  step = rgb('b9b7ab');
const stone = rgb('c9bfaa'),
  gutter = rgb('a49b87'),
  flagBlue = rgb('41678b');
const block = (out, slot, x0, y0, z0, x1, y1, z1, color = colors[slot]) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], color);
function face(out, slot, p, expected, color = colors[slot]) {
  let n = normalFor(...p);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, slot, p, n, color);
  else out.addConvexPolygon(slot, 'palette:#ffffff', p, n, ([x, y]) => [x, y], color);
}
function shell(out, slot, ring, y0, y1, color) {
  const b = new MeshBufferBuilder();
  poly(b, slot, ring, y0, y1, color);
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (index) =>
      Array.from(mesh.positions.slice(index * 3, index * 3 + 3)),
    );
    face(out, slot, points, normalFor(...points), color);
  }
}
function wallSide(a, b, sign) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    normal = [(sign * dz) / len, 0, (-sign * dx) / len];
  return {
    len,
    normal,
    at: (u, y, d = 0) => [
      a[0] + (dx * u) / len + normal[0] * d,
      y,
      a[1] + (dz * u) / len + normal[2] * d,
    ],
  };
}
function panel(out, slot, side, x0, y0, x1, y1, d, color = colors[slot]) {
  const p = side.at;
  face(out, slot, [p(x0, y0, d), p(x1, y0, d), p(x1, y1, d), p(x0, y1, d)], side.normal, color);
}
function window(out, side, x, y, w, h, lod) {
  panel(
    out,
    'trim',
    side,
    x - w / 2 - 0.12,
    y - 0.15,
    x + w / 2 + 0.12,
    y + h + 0.13,
    0.071,
    stone,
  );
  panel(out, 'dark', side, x - w / 2, y, x + w / 2, y + h, 0.095, glass);
  if (lod > 1) {
    panel(out, 'trim', side, x - 0.022, y, x + 0.022, y + h, 0.107, gutter);
    for (const t of [0.37, 0.69])
      panel(
        out,
        'trim',
        side,
        x - w / 2,
        y + h * t - 0.028,
        x + w / 2,
        y + h * t + 0.028,
        0.109,
        gutter,
      );
  }
}
function lowerRanges(out, lod) {
  shell(out, 'base', exteriorWallRing, foundationBottom, 0.31, stone);
  shell(out, 'base', exteriorWallRing, 0.31, wallTop - 1.2, rustication);
  shell(out, 'wall', exteriorWallRing, wallTop - 1.2, wallTop, plaster);
  shell(
    out,
    'trim',
    exteriorWallRing.map(([x, z]) => [x * 1.012, z * 1.008]),
    wallTop - 0.2,
    wallTop + 0.08,
    stone,
  );
  const sign = Math.sign(
    exteriorWallRing.reduce((sum, [x, z], i) => {
      const [u, v] = exteriorWallRing[(i + 1) % exteriorWallRing.length];
      return sum + x * v - z * u;
    }, 0),
  );
  for (let i = 0; i < exteriorWallRing.length; i++) {
    const side = wallSide(
      exteriorWallRing[i],
      exteriorWallRing[(i + 1) % exteriorWallRing.length],
      sign,
    );
    if (side.len < 3.4) continue;
    panel(out, 'trim', side, 0, 5.93, side.len, 6.15, 0.075, gutter);
    if (!lod) continue;
    for (const y of [1.02, 1.75, 2.48, 3.21, 3.94, 4.67, 5.4])
      panel(out, 'base', side, 0, y, side.len, y + 0.047, 0.013, rgb('8e7861'));
    const n = Math.max(1, Math.round(side.len / 4.4));
    for (let j = 0; j < n; j++) {
      const x = (side.len * (j + 0.5)) / n;
      const pos = side.at(x, 0);
      if (Math.abs(pos[0]) < 6.3 && Math.abs(pos[2]) > 15) continue;
      window(out, side, x, 2.32, 1.16, 2.47, lod);
      if (lod > 1) window(out, side, x, -1.1, 0.92, 0.99, lod);
    }
  }
}
function roofTier(out, x0, x1, z0, z1, bottom, top, lod, windowCount) {
  block(out, 'wall', x0, bottom, z0, x1, top, z1, plaster);
  block(out, 'trim', x0 - 0.19, top - 0.48, z0 - 0.19, x1 + 0.19, top - 0.24, z1 + 0.19, stone);
  block(out, 'trim', x0 - 0.26, top - 0.22, z0 - 0.26, x1 + 0.26, top + 0.16, z1 + 0.26);
  block(out, 'roof', x0, top + 0.16, z0, x1, top + 0.23, z1);
  if (!lod) return;
  const sides = [
    wallSide([x1, z1], [x0, z1], 1),
    wallSide([x0, z0], [x1, z0], 1),
    wallSide([x0, z1], [x0, z0], 1),
    wallSide([x1, z0], [x1, z1], 1),
  ];
  for (const side of sides) {
    if (windowCount)
      for (let i = 0; i < windowCount; i++) {
        const x = (side.len * (i + 0.5)) / windowCount;
        window(out, side, x, bottom + 0.45, 1.15, Math.min(1.5, top - bottom - 0.94), lod);
      }
    if (lod > 1) {
      if (lod === 3) {
        const span = Math.floor(side.len / 0.78) * 0.78;
        const margin = (side.len - span) / 2 + 0.39;
        for (let x = margin; x < side.len - margin + 0.01; x += 0.78) {
          const point = side.at;
          panel(
            out,
            'dark',
            side,
            x - 0.34,
            top - 0.67,
            x + 0.34,
            top - 0.44,
            0.017,
            rgb('79715e'),
          );
          for (const sign of [-1, 1]) {
            face(
              out,
              'trim',
              [
                point(x - 0.31, top - 0.58 - sign * 0.11, 0.026),
                point(x + 0.31, top - 0.58 + sign * 0.11, 0.026),
                point(x + 0.31, top - 0.52 + sign * 0.11, 0.026),
                point(x - 0.31, top - 0.52 - sign * 0.11, 0.026),
              ],
              side.normal,
              stone,
            );
          }
        }
      }
      const n = Math.max(2, Math.floor(side.len / 3.2));
      for (let i = 0; i <= n; i++) {
        const x = Math.min(side.len - 0.12, Math.max(0.12, (side.len * i) / n));
        panel(out, 'trim', side, x - 0.1, top + 0.06, x + 0.1, top + 0.42, 0.052, stone);
      }
    }
  }
}
function ionicColumn(out, x, z, lod) {
  const base = entryFloor,
    cap = 7.84,
    lower = base + 0.57,
    upper = cap - 0.49;
  if (!lod) {
    const shaft = [radialRing(base, 0.31, 0.31, 6, [x, z]), radialRing(cap, 0.26, 0.26, 6, [x, z])];
    loft(out, 'trim', shaft, colors.trim);
    return;
  }
  block(out, 'trim', x - 0.39, base, z - 0.39, x + 0.39, base + 0.26, z + 0.39);
  const sides = [6, 8, 12, 24][lod];
  const section = (y, r, flute = false) =>
    radialRing(y, r, r, sides, [x, z]).map(([px, py, pz], i) => {
      const f = flute && i % 2 ? 0.91 : 1;
      return [x + (px - x) * f, py, z + (pz - z) * f];
    });
  const shape = lod
    ? [
        section(base + 0.26, 0.33),
        section(lower, 0.275),
        section(lower + 0.1, 0.26, true),
        section(upper, 0.207, true),
        section(upper + 0.17, 0.27),
        section(cap - 0.17, 0.315),
      ]
    : [section(base + 0.26, 0.29), section(upper, 0.23), section(cap - 0.17, 0.315)];
  loft(out, 'trim', shape, colors.trim);
  block(out, 'trim', x - 0.34, cap - 0.18, z - 0.32, x + 0.34, cap, z + 0.32, stone);
  if (lod > 1)
    for (const u of [-0.25, 0.25]) {
      tube(
        out,
        'trim',
        [x + u, cap - 0.31, z - 0.28],
        [x + u, cap - 0.31, z + 0.28],
        0.102,
        stone,
        8,
      );
    }
}
function portico(out, p, lod) {
  const [x0, x1] = p.x,
    middle = (x0 + x1) / 2,
    half = (x1 - x0) / 2,
    s = p.direction;
  const { faceZ: z, backZ } = p;
  const zo = (distance) => z + s * distance;
  const zmin = (a, b) => Math.min(a, b),
    zmax = (a, b) => Math.max(a, b);
  const back = backZ + s * 0.08,
    outer = zo(0.44);
  const zRange = (a, b) => [zmin(a, b), zmax(a, b)];
  const podium = zRange(backZ, zo(0.32));
  block(out, 'base', x0 - 0.1, foundationBottom, podium[0], x1 + 0.1, entryFloor, podium[1], stone);
  const stairCount = lod === 3 ? Math.ceil((entryFloor - p.approachGrade) / 0.17) : [3, 8, 12][lod];
  const stairLength = s === 1 ? 3.55 : 5.35;
  for (let i = 0; i < stairCount; i++) {
    const a = zo(0.28 + (stairLength * i) / stairCount),
      b = zo(0.28 + (stairLength * (i + 1)) / stairCount);
    const y = entryFloor - ((entryFloor - p.approachGrade) * i) / stairCount;
    block(out, 'trim', x0 + 0.19, foundationBottom, zmin(a, b), x1 - 0.19, y, zmax(a, b), step);
  }
  for (const x of [x0 + 0.08, x1 - 0.08]) {
    beam(
      out,
      'trim',
      [x, entryFloor + 0.28, zo(0.23)],
      [x, p.approachGrade + 0.23, zo(stairLength + 0.35)],
      0.29,
      0.39,
      stone,
    );
  }
  const n = [0, 0, s],
    wall = (x, y, d = 0) => [x, y, back + d * s],
    side = { at: wall, normal: n };
  panel(out, 'wall', side, x0 + 0.14, entryFloor, x1 - 0.14, 7.83, 0.022, red);
  panel(out, 'trim', side, middle - 1.18, entryFloor, middle + 1.18, 5.68, 0.045, stone);
  panel(out, 'dark', side, middle - 0.9, entryFloor, middle + 0.9, 5.43, 0.071, colors.dark);
  if (lod)
    for (const dx of [-0.48, 0.48])
      panel(
        out,
        'trim',
        side,
        middle + dx - 0.24,
        3.62,
        middle + dx + 0.24,
        4.82,
        0.093,
        rgb('ae975a'),
      );
  for (const dx of [-0.79, -0.26, 0.26, 0.79]) ionicColumn(out, middle + dx * half, z, lod);
  const roofDepth = zRange(backZ, outer);
  for (const [y, h, extra] of [
    [7.83, 0.3, 0.15],
    [8.13, 0.53, 0.22],
    [8.66, 0.19, 0.31],
  ])
    block(out, 'trim', x0 - extra, y, roofDepth[0], x1 + extra, y + h, roofDepth[1], stone);
  const eave = 8.85,
    ridge = 10.53,
    left = [x0 - 0.32, eave, outer],
    right = [x1 + 0.32, eave, outer],
    top = [middle, ridge, outer];
  face(out, 'wall', [left, right, top], n, red);
  for (const [a, b] of [
    [left, top],
    [top, right],
  ]) {
    face(out, 'roof', [a, b, [b[0], b[1], backZ], [a[0], a[1], backZ]], [0, 1, 0]);
    beam(out, 'trim', a, b, 0.22, 0.23, stone);
  }
}
function buildParliament(out, _frame, lod = 3) {
  lowerRanges(out, lod);
  roofTier(out, -16.64, 16.64, -15.1, 15.01, wallTop - 0.1, 10.56, lod, 6);
  roofTier(out, -12.46, 12.46, -12.7, 12.42, 10.56, 12.3, lod, 5);
  roofTier(out, -8.37, 8.37, -9.81, 9.42, 12.3, upperTop, lod, 0);
  for (const p of porticos) portico(out, p, lod);
  if (lod) {
    block(out, 'trim', -0.048, upperTop, 0.03, 0.048, upperTop + 3.32, 0.126, stone);
    face(
      out,
      'wall',
      [
        [0, upperTop + 2.0, 0.14],
        [0.97, upperTop + 2.06, 0.14],
        [0.97, upperTop + 2.98, 0.14],
        [0, upperTop + 3.04, 0.14],
      ],
      [0, 0, 1],
      flagBlue,
    );
  }
}
export const parliamentSkyline = (out, frame) => buildParliament(out, frame, 0);
export const parliamentDistrict = (out, frame) => buildParliament(out, frame, 1);
export const parliamentStreet = (out, frame) => buildParliament(out, frame, 2);
export const parliamentCloseup = (out, frame) => buildParliament(out, frame, 3);
const camera = [59, 36, 68],
  lookAt = [0, 6, 0];
export const parliamentModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'parliament-model.mjs',
  surfaces,
  build: buildParliament,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Neoclassical Athens Old Parliament with two porticos, pale Ionic columns, rusticated ranges and layered roof parapets.',
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
    'stone_limestone',
    'metal_standing_seam',
  ],
  qaCameras: [
    { name: 'north-ionic-portico-and-courtyard', position: [-10, 7, 49], lookAt: [0, 6, 18] },
    { name: 'south-portico-and-roof-tiers', position: [33, 22, -46], lookAt: [0, 6, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-parliament-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/sw/swb/old_parliament_house_athens/models/parliament-model.mjs',
    level: 'skyline',
    export: 'parliamentSkyline',
    errorMeters: 0.26,
    surfaces,
    authoredLevels: {
      district: { export: 'parliamentDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'parliamentStreet', errorMeters: 0.067, surfaces },
      closeup: { export: 'parliamentCloseup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The two published exterior photographs are by athenswalk under CC0. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
