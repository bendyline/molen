/** Present Kangra Fort ruins, including the surviving west ridge and the gate ascent. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const outline = frame.geometry.outline;
const access = frame.geometry.observedAccess[0].controls;
const stone = ['887b68', '938773', 'a3947f', '7d7568', '9a8b71', '918575'].map(rgb);
const top = rgb('aaa08d');
const dark = rgb('756e63');
const block = rgb('a69780');
const paving = rgb('9f9888');
const relief = rgb('938c80');
const recess = rgb('494640');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96 },
  dressed: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.97 },
  fine: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.96 },
};
const white = 'palette:#ffffff';

function ground([x, z]) {
  const [ox, oz] = terrain.origin;
  const u = (x - ox) / terrain.stepMeters;
  const v = (z - oz) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const heights = terrain.heightsMeters;
  const a = u - i;
  const b = v - j;
  const left = (1 - b) * heights[j][i] + b * heights[j + 1][i];
  const right = (1 - b) * heights[j][i + 1] + b * heights[j + 1][i + 1];
  return (1 - a) * left + a * right - terrain.modelDatumElevationMeters;
}

const interpolate = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const offset = (p, n, s) => [p[0] + n[0] * s, p[1] + n[1] * s];
const xyz = ([x, z], y) => [x, y, z];
const area = outline.reduce((sum, p, i) => {
  const q = outline[(i + 1) % outline.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0);
const winding = Math.sign(area);
function facing(a, b) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [((b[1] - a[1]) / l) * winding, ((a[0] - b[0]) / l) * winding];
}

function face(out, slot, points, desired, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, c, i) => sum + c * desired[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function ribbon(out, a, b, n, width, yA, yB, tint, ledge = false, capEnds = true) {
  const half = width / 2;
  const nearA = offset(a, n, half);
  const nearB = offset(b, n, half);
  const farA = offset(a, n, -half);
  const farB = offset(b, n, -half);
  const foot = [nearA, nearB, farB, farA].map((p) => xyz(p, ground(p) - 1.85));
  const crown = [xyz(nearA, yA), xyz(nearB, yB), xyz(farB, yB), xyz(farA, yA)];
  face(out, 'wall', [foot[0], foot[1], crown[1], crown[0]], [n[0], 0, n[1]], tint);
  face(out, 'wall', [foot[3], foot[2], crown[2], crown[3]], [-n[0], 0, -n[1]], tint);
  if (capEnds) {
    face(out, 'wall', [foot[0], foot[3], crown[3], crown[0]], [a[0] - b[0], 0, a[1] - b[1]], tint);
    face(out, 'wall', [foot[2], foot[1], crown[1], crown[2]], [b[0] - a[0], 0, b[1] - a[1]], tint);
  }
  face(out, 'dressed', crown, [0, 1, 0], top);
  if (ledge)
    beam(
      out,
      'dressed',
      xyz(offset(a, n, half - 0.06), yA - 0.21),
      xyz(offset(b, n, half - 0.06), yB - 0.21),
      0.31,
      0.26,
      block,
    );
}

function wallHeight(point, normal, index) {
  const outer = ground(offset(point, normal, 1.25));
  const inner = ground(offset(point, normal, -3.2));
  const crest = Math.max(outer, Math.min(inner, outer + 8.2));
  const baseHeight = index >= 22 && index <= 41 ? 4.1 : index < 16 || index >= 48 ? 3.05 : 5.6;
  return crest + baseHeight + 0.62 * Math.sin(point[0] * 0.09 + point[1] * 0.13);
}

function ramparts(out, detail) {
  for (let i = 0; i < outline.length; i++) {
    // The mapped pedestrian approach crosses the masonry at these breaks.
    if (i === 42 || i === 44 || i === 27) continue;
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const n = facing(a, b);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const step = [28, 11, 6.2, 3.3][detail];
    const count = Math.max(1, Math.ceil(length / step));
    const width = plan.dimensions.typicalWallWidth + (i > 47 ? 1.04 : 0);
    for (let k = 0; k < count; k++) {
      const p = interpolate(a, b, k / count);
      const q = interpolate(a, b, (k + 1) / count);
      const y = wallHeight(p, n, i);
      const y2 = wallHeight(q, n, i);
      ribbon(
        out,
        p,
        q,
        n,
        width,
        y,
        y2,
        stone[(i + k) % stone.length],
        detail >= 2 && i % 3 === 0,
        detail >= 1,
      );
    }
  }
}

function tower(out, center, radius, height, detail) {
  const datum = ground(center);
  const floor = Math.min(
    ...[
      [0, 0],
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
    ].map((p) => ground([center[0] + p[0], center[1] + p[1]])),
  );
  const y = datum + height;
  const sides = [6, 10, 16, 22][detail];
  profile(
    out,
    [
      [floor - 2, radius * 1.09, radius * 1.09],
      [y - 0.67, radius, radius, 'wall', stone[3]],
      [y - 0.4, radius + 0.12, radius + 0.12, 'dressed', block],
      [y, radius + 0.12, radius + 0.12, 'dressed', top],
    ],
    sides,
    center,
  );
  if (detail >= 2) {
    const teeth = detail === 2 ? 8 : 13;
    for (let k = 0; k < teeth; k++) {
      if ((k + teeth) % 5 === 0) continue;
      const theta = (k * 2 * Math.PI) / teeth;
      const p = [center[0] + radius * Math.cos(theta), center[1] + radius * Math.sin(theta)];
      beam(
        out,
        'wall',
        xyz(p, y - 0.16),
        xyz(p, y + 0.84),
        0.91,
        0.76,
        stone[(k + 2) % stone.length],
      );
    }
  }
}

function localFrame(center, along) {
  const d = Math.hypot(...along);
  const n = [along[0] / d, along[1] / d];
  return {
    n,
    pt: (x, y, z) => [center[0] + n[1] * x + n[0] * z, y, center[1] - n[0] * x + n[1] * z],
  };
}

function pointedArch(half, spring, rise, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = (2 * i) / steps - 1;
    const sweep = Math.sqrt(Math.max(0, 1.65 * 1.65 - (Math.abs(u) + 0.65) ** 2)) / Math.sqrt(2.3);
    return [u * half, spring + rise * sweep];
  });
}

function gate(out, g, detail) {
  const { center, along, width, height, depth, opening, special } = g;
  const f = localFrame(center, along);
  const n = [f.n[0], 0, f.n[1]];
  const walk = ground(center) + 0.22;
  const jamb = opening / 2;
  const w = width / 2;
  const invert = Math.min(
    walk - 2.3,
    ...[-w, -jamb, jamb, w].flatMap((x) =>
      [-depth / 2, depth / 2].map((z) => {
        const p = f.pt(x, 0, z);
        return ground([p[0], p[2]]) - 1.05;
      }),
    ),
  );
  const crown = walk + height;
  const spring = walk + 2.75;
  const openingTop = height * 0.51;
  const arch = pointedArch(jamb, spring, openingTop - 2.75, [4, 6, 10, 14][detail]);
  const pt = f.pt;
  for (const side of [-1, 1]) {
    const z = (side * depth) / 2;
    const normal = n.map((c) => c * side);
    for (const [a, b] of [
      [-w, -jamb],
      [jamb, w],
    ])
      face(
        out,
        'wall',
        [pt(a, invert, z), pt(b, invert, z), pt(b, crown, z), pt(a, crown, z)],
        normal,
        stone[2],
      );
    for (let i = 1; i < arch.length; i++) {
      const [a, ya] = arch[i - 1];
      const [b, yb] = arch[i];
      face(
        out,
        'wall',
        [pt(a, ya, z), pt(b, yb, z), pt(b, crown, z), pt(a, crown, z)],
        normal,
        stone[2],
      );
    }
    if (detail >= 1) {
      const trim = z + 0.073 * side;
      for (let i = 1; i < arch.length; i++) {
        const [a, ya] = arch[i - 1];
        const [b, yb] = arch[i];
        face(
          out,
          'dressed',
          [
            pt(a, ya, trim),
            pt(b, yb, trim),
            pt(b * 1.19, yb + 0.34, trim),
            pt(a * 1.19, ya + 0.34, trim),
          ],
          normal,
          i % 2 ? block : top,
        );
      }
    }
  }
  for (const x of [-w, -jamb, jamb, w]) {
    const y = Math.abs(x) === w ? crown : spring;
    face(
      out,
      'wall',
      [
        pt(x, invert, -depth / 2),
        pt(x, invert, depth / 2),
        pt(x, y, depth / 2),
        pt(x, y, -depth / 2),
      ],
      [Math.sign(x) * n[2], 0, -Math.sign(x) * n[0]],
      stone[1],
    );
  }
  for (let i = 1; i < arch.length; i++) {
    const [a, ya] = arch[i - 1];
    const [b, yb] = arch[i];
    face(
      out,
      'dressed',
      [pt(a, ya, -depth / 2), pt(b, yb, -depth / 2), pt(b, yb, depth / 2), pt(a, ya, depth / 2)],
      [0, -1, 0],
      dark,
    );
  }
  face(
    out,
    'dressed',
    [
      pt(-w, crown, -depth / 2),
      pt(w, crown, -depth / 2),
      pt(w, crown, depth / 2),
      pt(-w, crown, depth / 2),
    ],
    [0, 1, 0],
    top,
  );
  const groundPoints = (values) =>
    values.map(([x, z]) => {
      const [a, , b] = pt(x, 0, z);
      return [a, b];
    });
  const stairs = [
    [-depth / 2 - 3, -depth / 2],
    [-depth / 2, depth / 2],
    [depth / 2, depth / 2 + 3],
  ];
  for (const [a, b] of detail >= 1 ? stairs : []) {
    const corners = groundPoints([
      [-jamb, a],
      [jamb, a],
      [jamb, b],
      [-jamb, b],
    ]);
    face(
      out,
      'base',
      corners.map((p) => xyz(p, ground(p) + 0.2)),
      [0, 1, 0],
      paving,
    );
  }
  if (special || g.center === access[3] || g.center === access[8]) {
    for (const side of [-1, 1]) {
      const [from, to] = groundPoints([
        [side * (w - 0.1), -0.25],
        [side * (w + 5.5), -0.95],
      ]);
      const outward = facing(from, to);
      ribbon(
        out,
        from,
        to,
        outward,
        2.35,
        walk + height * 0.63,
        ground(to) + 2.15,
        stone[1],
        detail >= 2,
        detail >= 1,
      );
    }
  }
  if (detail >= 1)
    beam(
      out,
      'dressed',
      pt(-w - 0.12, crown - 0.11, depth / 2),
      pt(w + 0.12, crown - 0.11, depth / 2),
      0.38,
      0.32,
      block,
    );
  if (!special || detail === 0) return;
  const upper = pointedArch(w - 0.47, walk + height * 0.69, height * 0.24, [0, 8, 12, 16][detail]);
  for (let i = 1; i < upper.length; i++) {
    const [a, ya] = upper[i - 1];
    const [b, yb] = upper[i];
    face(
      out,
      'dressed',
      [
        pt(a, ya, depth / 2 + 0.14),
        pt(b, yb, depth / 2 + 0.14),
        pt(b * 1.07, yb + 0.23, depth / 2 + 0.14),
        pt(a * 1.07, ya + 0.23, depth / 2 + 0.14),
      ],
      n,
      block,
    );
  }
  for (const u of [-1, 1]) {
    const x = u * width * 0.13;
    const y = walk + height * 0.76;
    face(
      out,
      'fine',
      [
        pt(x - 0.31, y, depth / 2 + 0.038),
        pt(x + 0.31, y, depth / 2 + 0.038),
        pt(x + 0.28, y + 0.42, depth / 2 + 0.038),
        pt(x, y + 0.75, depth / 2 + 0.038),
      ],
      n,
      recess,
    );
    face(
      out,
      'fine',
      [
        pt(x - 0.31, y, depth / 2 + 0.039),
        pt(x, y + 0.75, depth / 2 + 0.039),
        pt(x - 0.28, y + 0.42, depth / 2 + 0.039),
      ],
      n,
      recess,
    );
  }
  for (const x of [-width * 0.27, 0, width * 0.27]) {
    const y = walk + height * 0.58;
    const z = depth / 2 + 0.052;
    face(
      out,
      'fine',
      [
        pt(x - 0.43, y - 0.43, z),
        pt(x + 0.43, y - 0.43, z),
        pt(x + 0.43, y + 0.51, z),
        pt(x - 0.43, y + 0.51, z),
      ],
      n,
      recess,
    );
    if (detail >= 2) {
      sphere(out, 'dressed', pt(x, y - 0.17, z + 0.05), [0.22, 0.23, 0.21], relief, 8, 5);
      sphere(out, 'dressed', pt(x, y + 0.27, z + 0.05), [0.14, 0.15, 0.14], relief, 8, 5);
    }
  }
}

const gatePlacements = [
  { center: access[3], along: [26, -31], width: 9.0, height: 7.9, depth: 3.8, opening: 3.3 },
  {
    center: [43.2, -44.8],
    along: [6, 50],
    width: 7.6,
    height: 9.2,
    depth: 4.6,
    opening: 2.35,
    special: true,
  },
  { center: access[8], along: [18, 20], width: 6.8, height: 7.5, depth: 3.2, opening: 2.9 },
  { center: [-27.3, -58], along: [12, -21], width: 7.3, height: 8.3, depth: 3.75, opening: 2.9 },
  { center: [-47, -21], along: [0, -19], width: 6.0, height: 7.3, depth: 3.4, opening: 2.6 },
];

function approach(out, detail) {
  for (let i = 3; i < 16; i++) {
    if (i === 4 || i === 5) continue;
    const a = access[i];
    const b = access[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const side = facing(a, b);
    const count = Math.max(1, Math.ceil(l / [27, 16, 8, 4.6][detail]));
    for (let j = 0; j < count; j++) {
      const p = interpolate(a, b, j / count);
      const q = interpolate(a, b, (j + 1) / count);
      const corners = [
        offset(p, side, 1.45),
        offset(q, side, 1.45),
        offset(q, side, -1.45),
        offset(p, side, -1.45),
      ];
      face(
        out,
        'base',
        corners.map((p2) => xyz(p2, ground(p2) + 0.18)),
        [0, 1, 0],
        paving,
      );
      if (i >= 7 && i <= 12) {
        const lp = offset(p, side, 2.65);
        const lq = offset(q, side, 2.65);
        ribbon(
          out,
          lp,
          lq,
          side,
          1.64,
          ground(lp) + 1.28,
          ground(lq) + 1.28,
          stone[i % stone.length],
        );
      }
    }
  }
}

function templeCourts(out, detail) {
  const precincts = [
    { center: [-41, -43], size: [7.6, 6.85], heights: [0.62, 1.38, 4.25] },
    { center: [-44, -54], size: [6.12, 5.15], heights: [0.54, 1.15, 1.98] },
    { center: [-33, -27], size: [5.1, 4.8], heights: [0.62, 1.15, 2.48] },
  ];
  for (const { center, size, heights } of precincts) {
    const [a, b] = size;
    const base = ground(center);
    const levels = [
      [base - 1, a * 0.62, b * 0.62],
      [base + heights[0], a * 0.62, b * 0.62, 'base', stone[2]],
      [base + heights[1], a * 0.56, b * 0.56, 'dressed', top],
    ];
    profile(out, levels, 4, center);
    const points = [
      [center[0] - a / 2, center[1] - b / 2],
      [center[0] + a / 2, center[1] - b / 2],
      [center[0] + a / 2, center[1] + b / 2],
      [center[0] - a / 2, center[1] + b / 2],
    ];
    for (let i = 0; i < 3; i++)
      ribbon(
        out,
        points[i],
        points[i + 1],
        facing(points[i], points[i + 1]),
        0.75,
        base + heights[2],
        base + heights[2] - (i === 1 ? 0.3 : 0),
        stone[(i + 2) % stone.length],
        detail >= 2,
      );
  }
}

function draw(out, detail) {
  ramparts(out, detail);
  for (const [index, radius, height] of [
    [1, 4.7, 6.2],
    [14, 4.1, 5.4],
    [24, 5.9, 7.3],
    [45, 4.8, 7.1],
    [56, 4.8, 5.3],
  ])
    tower(out, outline[index], radius, height, detail);
  for (const g of gatePlacements) gate(out, g, detail);
  if (detail >= 1) approach(out, detail);
  templeCourts(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [238, 154, -182];
const lookAt = [-17, 13, -4];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q6362859',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Kangra Fort is a ruined hill fortress with gray stone ramparts, round bastions, successive gates and temple remains above the river confluence.',
  camera,
  lookAt,
  sunDirection: [85, 70, -89],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stone_sandstone_raw', 'stone_sandstone'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.55,
    groundY: -40,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'ramparts-on-the-ridge', position: [-43, 112, 206], lookAt: [-58, 12, 18] },
    { name: 'carved-pointed-gate', position: [52, 11, -20], lookAt: [47, 5, -47] },
    { name: 'upper-court-and-ramparts', position: [-117, 69, -125], lookAt: [-34, 23, -32] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.9, surfaces },
      street: { export: 'street', errorMeters: 0.34, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry from the native map and public terrain, two exact CC0 gate photos, and public archaeological descriptions.',
};
