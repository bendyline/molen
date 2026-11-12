/** The original Cloncurry timber post office around 1910. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const s = plan.section;
const surfaces = {
  timber: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.79, metallic: 0.12 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.05 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54, metallic: 0.05 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'b2a08a',
    trim: 'dfd2b9',
    shadow: '927d66',
    base: '837666',
    roof: '8b918a',
    glass: '4e615c',
    shutter: 'cabfa9',
    door: '5e6458',
    dark: '51564e',
  }).map(([name, value]) => [name, rgb(value)]),
);
const white = 'palette:#ffffff';

function face(out, slot, points, facing, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, value, i) => dot + value * facing[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

const ring = ([x0, x1, z0, z1]) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const at = ([x, z], y) => [x, y, z];
function sides(outline) {
  return outline.map(([x, z], i) => {
    const q = outline[(i + 1) % outline.length];
    const length = Math.hypot(q[0] - x, q[1] - z);
    const dx = (q[0] - x) / length,
      dz = (q[1] - z) / length;
    return {
      length,
      normal: [dz, 0, -dx],
      point: (u, y, p = 0) => [x + u * dx + p * dz, y, z + u * dz - p * dx],
    };
  });
}

function panel(out, slot, edge, a, b, y0, y1, p, tint) {
  face(
    out,
    slot,
    [edge.point(a, y0, p), edge.point(b, y0, p), edge.point(b, y1, p), edge.point(a, y1, p)],
    edge.normal,
    tint,
  );
}

function cap(out, slot, outline, y, tint) {
  face(
    out,
    slot,
    outline.map((p) => at(p, y)),
    [0, 1, 0],
    tint,
  );
}

function wallBox(out, bounds, bottom, top, tint = colors.wall) {
  const outline = ring(bounds);
  for (const e of sides(outline)) panel(out, 'timber', e, 0, e.length, bottom, top, 0, tint);
  cap(out, 'timber', outline, top, tint);
}

function frameWindow(out, e, u, y, width, height, lod, door = false) {
  const half = width / 2;
  panel(
    out,
    'glass',
    e,
    u - half,
    u + half,
    y,
    y + height,
    0.026,
    door ? colors.door : colors.glass,
  );
  if (!lod) return;
  for (const x of [u - half - 0.045, u + half + 0.045]) {
    beam(
      out,
      'trim',
      e.point(x, y - 0.04, 0.04),
      e.point(x, y + height + 0.05, 0.04),
      0.09,
      0.1,
      colors.trim,
    );
  }
  for (const h of [y - 0.03, y + height + 0.04]) {
    beam(
      out,
      'trim',
      e.point(u - half - 0.09, h, 0.04),
      e.point(u + half + 0.09, h, 0.04),
      0.1,
      0.12,
      colors.trim,
    );
  }
  if (lod >= 2 && !door) {
    panel(
      out,
      'trim',
      e,
      u - half,
      u + half,
      y + height * 0.49,
      y + height * 0.51,
      0.046,
      colors.trim,
    );
    panel(out, 'trim', e, u - 0.025, u + 0.025, y, y + height, 0.046, colors.trim);
  }
}

function clipRoof(points, distance) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const da = distance(a),
      db = distance(b);
    if (da >= 0) result.push(a);
    if (da >= 0 === db >= 0) continue;
    const fraction = da / (da - db);
    result.push(a.map((value, axis) => value + fraction * (b[axis] - value)));
  }
  return result;
}

function hipFace(out, points) {
  const front = clipRoof(points, (p) => p[2] - 0.3);
  const half = s.gableHalfWidth + 0.23,
    peak = s.ridge + 0.08;
  const slope = (peak - s.gableEaves + 0.08) / half;
  const pieces = [clipRoof(points, (p) => 0.3 - p[2])];
  for (const sign of [-1, 1]) {
    const side = clipRoof(front, (p) => p[0] * sign);
    pieces.push(clipRoof(side, (p) => p[0] * sign - half));
    const inner = clipRoof(side, (p) => half - p[0] * sign);
    pieces.push(clipRoof(inner, (p) => p[1] - peak + p[0] * sign * slope));
  }
  for (const piece of pieces) {
    for (let i = 1; i < piece.length - 1; i++) {
      face(out, 'roof', [piece[0], piece[i], piece[i + 1]], [0, 1, 0], colors.roof);
    }
  }
}

function hipRoof(out, bounds, eave, ridge) {
  const [x0, x1, z0, z1] = bounds;
  const ridgeX = (x0 + x1) / 2;
  const end = Math.min((x1 - x0) * 0.41, (z1 - z0) * 0.32);
  const p = [ridgeX, ridge, z0 + end],
    q = [ridgeX, ridge, z1 - end];
  for (const x of [x0, x1]) {
    hipFace(out, [[x, eave, z0], [x, eave, z1], q, p]);
  }
  hipFace(out, [[x0, eave, z0], p, [x1, eave, z0]]);
  hipFace(out, [[x0, eave, z1], q, [x1, eave, z1]]);
}

function core(out, lod) {
  const bounds = [s.left, s.right, s.back, s.porchBack];
  const outline = ring(bounds);
  wallBox(out, bounds, s.floor, s.eaves);
  for (const [i, e] of sides(outline).entries()) {
    if (i === 2) continue;
    const count = i % 2 ? 4 : 3;
    for (let j = 0; j < count; j++) {
      frameWindow(out, e, (e.length * (j + 0.5)) / count, 2.04, 0.93, 1.61, lod);
    }
    if (lod)
      for (const u of [0.07, e.length - 0.07]) {
        beam(out, 'trim', e.point(u, s.floor), e.point(u, s.eaves), 0.1, 0.1, colors.trim);
      }
  }
  for (const x of [s.left + 0.1, -3.0, 2.86, s.right - 0.1]) {
    for (const z of [s.back + 0.1, -2, s.porchBack - 0.1]) {
      box(out, 'timber', x, s.bottom, z, 0.23, s.floor - s.bottom, 0.23, colors.base);
    }
  }
  box(
    out,
    'timber',
    (s.left + s.right) / 2,
    s.floor - 0.22,
    (s.back + s.porchBack) / 2,
    s.right - s.left,
    0.22,
    s.porchBack - s.back,
    colors.shadow,
  );
  hipRoof(out, [s.left - 0.25, s.right + 0.25, s.back - 0.25, s.front + 0.23], s.eaves, s.ridge);
}

function gable(out, lod) {
  const half = s.gableHalfWidth,
    z = s.front;
  wallBox(out, [-half, half, 0.3, z], s.floor, s.gableEaves);
  for (const [depth, facing] of [
    [z, [0, 0, 1]],
    [0.3, [0, 0, -1]],
  ]) {
    face(
      out,
      'timber',
      [
        [-half, s.gableEaves, depth],
        [half, s.gableEaves, depth],
        [0, s.ridge, depth],
      ],
      facing,
      colors.wall,
    );
  }
  const hang = 0.23;
  for (const x of [-half - hang, half + hang]) {
    face(
      out,
      'roof',
      [
        [x, s.gableEaves - 0.08, z + hang],
        [x, s.gableEaves - 0.08, 0.3],
        [0, s.ridge + 0.08, 0.3],
        [0, s.ridge + 0.08, z + hang],
      ],
      [0, 1, 0],
      colors.roof,
    );
  }
  const front = sides(ring([-half, half, 0.3, z]))[2];
  const center = front.length / 2;
  panel(out, 'trim', front, center - 1.18, center + 1.18, 2.24, 3.83, 0.055, colors.shutter);
  if (lod) {
    for (const offset of [-1.13, -0.56, 0, 0.56, 1.13]) {
      panel(
        out,
        'trim',
        front,
        center + offset - 0.035,
        center + offset + 0.035,
        2.24,
        3.83,
        0.069,
        colors.trim,
      );
    }
    for (const y of [2.24, 3.83]) {
      panel(
        out,
        'trim',
        front,
        center - 1.22,
        center + 1.22,
        y - 0.04,
        y + 0.04,
        0.07,
        colors.trim,
      );
    }
  }
  face(
    out,
    'roof',
    [
      [-1.39, 3.83, z + 0.71],
      [1.39, 3.83, z + 0.71],
      [1.39, 4.16, z + 0.02],
      [-1.39, 4.16, z + 0.02],
    ],
    [0, 1, 0],
    colors.roof,
  );
  if (lod) {
    beam(out, 'trim', [-1.16, 3.39, z + 0.05], [-1.16, 3.82, z + 0.64], 0.07, 0.07, colors.trim);
    beam(out, 'trim', [1.16, 3.39, z + 0.05], [1.16, 3.82, z + 0.64], 0.07, 0.07, colors.trim);
  }
  for (const end of [-half - 0.17, half + 0.17]) {
    beam(
      out,
      'trim',
      [end, s.gableEaves, z + 0.26],
      [0, s.ridge + 0.08, z + 0.26],
      lod ? 0.15 : 0.11,
      0.16,
      colors.trim,
    );
  }
  if (lod) {
    const count = lod >= 2 ? 17 : 9;
    for (let i = 1; i < count; i++) {
      const x = -half + (2 * half * i) / count;
      const top = s.ridge - (Math.abs(x) / half) * (s.ridge - s.gableEaves);
      beam(
        out,
        'trim',
        [x, 5.35, z + 0.048],
        [x, top - 0.12, z + 0.048],
        0.065,
        0.055,
        colors.trim,
      );
    }
    box(out, 'trim', 0, 4.69, z + 0.033, 3.66, 0.34, 0.054, colors.trim);
    if (lod >= 2) nameboard(out, z + 0.1);
  }
  for (const x of [-half + 0.09, 0, half - 0.09]) {
    box(out, 'timber', x, s.bottom, z - 0.1, 0.22, s.floor - s.bottom, 0.22, colors.base);
  }
  if (lod)
    for (let y = 0.04; y < s.floor - 0.13; y += 0.21) {
      box(out, 'timber', 0, y, z - 0.07, half * 2 - 0.4, 0.1, 0.08, colors.shadow);
    }
}

function nameboard(out, z) {
  const text = 'CLONCURRY POST OFFICE';
  const width = 3.35,
    height = 0.18,
    y = 4.76,
    advance = width / text.length;
  const stroke = 0.014;
  lettering(out, text, { width, height, y, z, stroke, slot: 'metal', color: colors.dark });
  const additionalPaths = {
    O: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ],
    U: [
      [
        [0, 1],
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ],
    Y: [
      [
        [0, 1],
        [0.5, 0.5],
        [1, 1],
      ],
      [
        [0.5, 0.5],
        [0.5, 0],
      ],
    ],
  };
  for (let i = 0; i < text.length; i++) {
    for (const path of additionalPaths[text[i]] ?? []) {
      const point = ([x, h]) => [
        (i - text.length / 2) * advance + x * advance * 0.75,
        y + h * height,
        z,
      ];
      for (let j = 1; j < path.length; j++) {
        beam(out, 'metal', point(path[j - 1]), point(path[j]), stroke, stroke, colors.dark);
      }
    }
  }
}

function rail(out, x0, x1, z, lod) {
  for (const y of [s.floor + 0.16, s.floor + 0.88]) {
    beam(out, 'trim', [x0, y, z], [x1, y, z], 0.09, 0.09, colors.trim);
  }
  if (!lod) return;
  const count = Math.ceil((x1 - x0) / (lod >= 2 ? 0.25 : 0.58));
  for (let i = 1; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    beam(out, 'trim', [x, s.floor + 0.19, z], [x, s.floor + 0.85, z], 0.043, 0.05, colors.trim);
  }
}

function porch(out, x0, x1, lod) {
  const z0 = s.porchBack,
    z1 = s.front;
  box(
    out,
    'timber',
    (x0 + x1) / 2,
    s.floor - 0.2,
    (z0 + z1) / 2,
    x1 - x0,
    0.2,
    z1 - z0,
    colors.shadow,
  );
  for (const x of [x0 + 0.12, x1 - 0.12]) {
    for (const z of [z0 + 0.1, z1 - 0.1]) {
      box(out, 'timber', x, s.bottom, z, 0.2, s.floor - s.bottom, 0.2, colors.base);
      box(out, 'trim', x, s.floor, z, 0.12, s.eaves - s.floor, 0.12, colors.trim);
      if (lod >= 2) {
        beam(
          out,
          'trim',
          [x, s.eaves - 0.54, z],
          [x + (x < (x0 + x1) / 2 ? 0.37 : -0.37), s.eaves, z],
          0.07,
          0.06,
          colors.trim,
        );
      }
    }
  }
  const [e] = sides(ring([x0, x1, z0 - 0.08, z0]));
  const u = e.length / 2;
  frameWindow(
    out,
    { ...e, point: (x, y, d = 0) => [x1 - x, y, z0 + d], normal: [0, 0, 1] },
    u,
    s.floor + 0.03,
    0.95,
    2.24,
    lod,
    true,
  );
  const opening = 1.95,
    mid = (x0 + x1) / 2;
  rail(out, x0 + 0.17, mid - opening / 2, z1 - 0.09, lod);
  rail(out, mid + opening / 2, x1 - 0.17, z1 - 0.09, lod);
  const stairWidth = 1.95,
    rise = s.floor / 4;
  for (let i = 0; i < 4; i++) {
    const y = rise * i;
    box(out, 'timber', mid, y - 0.03, z1 + (4 - i) * 0.29, stairWidth, 0.12, 0.34, colors.trim);
  }
  if (lod) {
    for (const x of [mid - stairWidth / 2, mid + stairWidth / 2]) {
      beam(
        out,
        'timber',
        [x, 0.01, z1 + 1.38],
        [x, s.floor - 0.07, z1 + 0.12],
        0.14,
        0.17,
        colors.shadow,
      );
      beam(
        out,
        'trim',
        [x, 0.86, z1 + 1.32],
        [x, s.floor + 0.86, z1 - 0.04],
        0.075,
        0.075,
        colors.trim,
      );
      box(out, 'trim', x, -0.15, z1 + 1.32, 0.1, 1.03, 0.1, colors.trim);
    }
    for (const z of [z0, z1])
      beam(out, 'trim', [x0, s.eaves, z], [x1, s.eaves, z], 0.15, 0.13, colors.trim);
  }
}

function build(out, lod) {
  core(out, lod);
  porch(out, s.left, -s.gableHalfWidth, lod);
  porch(out, s.gableHalfWidth, s.right, lod);
  gable(out, lod);
  if (lod === 3) {
    for (const x of [s.left, s.right]) {
      beam(
        out,
        'metal',
        [x, s.eaves + 0.02, s.back],
        [x, s.eaves + 0.02, s.front],
        0.12,
        0.13,
        colors.trim,
      );
      beam(
        out,
        'metal',
        [x, 0.22, s.porchBack - 0.2],
        [x, s.eaves, s.porchBack - 0.2],
        0.075,
        0.075,
        colors.trim,
      );
    }
  }
}

export const officeSkyline = (out) => build(out, 0);
export const officeDistrict = (out) => build(out, 1);
export const officeStreet = (out) => build(out, 2);
export const officeCloseup = (out) => build(out, 3);
const recipe = 'cloncurry-office-model.mjs',
  camera = [30, 17.5, 40],
  lookAt = [0, 3.7, 1.2];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'officeDistrict', 0.16],
    ['street', 'officeStreet', 0.07],
    ['closeup', 'officeCloseup', 0.025],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const cloncurryModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  surfaces,
  build: officeCloseup,
  recipeDependencies: ['stadium-lettering.mjs'],
  category: 'civic',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The raised timber Cloncurry Post Office around 1910, with a central slatted gable, twin public porches, paired steps and corrugated hip roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  mediumFiContext: {
    scale: 0.74,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['wood_weatherboard', 'metal_corrugated', 'metal_painted'],
  qaCameras: [
    { name: 'twin-porches-and-central-gable', position: [1.4, 4.9, 33], lookAt: [0, 3.8, 8] },
    { name: 'raised-timber-frame-and-steps', position: [20, 4.8, 22], lookAt: [4, 2.7, 8] },
    { name: 'corrugated-roofs-and-rear', position: [-23, 14, -22], lookAt: [0, 3.9, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-cloncurry-post-office-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'officeSkyline',
    errorMeters: 0.37,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap ODbL 1.0 and the published public-domain State Library of Queensland ca.1910 exterior.',
};
