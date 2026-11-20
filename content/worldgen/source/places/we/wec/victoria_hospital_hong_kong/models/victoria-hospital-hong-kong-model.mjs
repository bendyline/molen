import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  at,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  pairs,
  panel,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  brick: 'a67059',
  warmBrick: 'af785e',
  shadowBrick: '9c6755',
  render: 'd9d6ca',
  cornice: 'e3ded0',
  window: '566468',
  darkWindow: '49575f',
  darkMetal: '424e50',
  basement: 'a7a8a0',
  quoins: 'b4b4aa',
  joint: '858881',
  stone: 'aeaa9b',
  corridor: '858779',
  aft: 'b3a590',
  slate: '646961',
  roofTrim: '777e76',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.93),
  foundation: surface('foundation', 'stone_ashlar', 0.94),
  slate: surface('roof', 'slate', 0.86),
  render: surface('wall', 'plaster_lime', 0.91),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metallic: 0.03 },
  trim: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.74 },
};
const [frontRight, frontLeft, rearLeft, rearRight] = d.outline;
const front = edge(frontRight, frontLeft);
const sideRight = edge(rearRight, frontRight);
const sideLeft = edge(frontLeft, rearLeft);
const rear = edge(rearLeft, rearRight);
const mid = front.length * 0.5;
const span = front.length - 1.25;
const left = mid - span / 2;
const right = mid + span / 2;
const facadeBase = (p) => Math.min(-0.55, grade(p) - 0.28);
const archBays = [-16.4, -11.9, -7.55, -3.08, 1.42, 5.92, 10.4, 14.84, 19.0].map((x) => mid + x);
const windowBays = [-18.85, -15.3, -11.75, -8.21, -4.91, 0, 4.91, 8.21, 11.75, 15.3, 18.85].map(
  (x) => mid + x,
);

function moulding(out, w, left, right, y, thickness, depth, cx = c.cornice) {
  trimBlock(out, 'trim', w, left, right, y - thickness / 2, y + thickness / 2, 0.003, depth, cx);
}
function glassBay(out, w, u, left, right, bottom, top, level, depth = 0.075) {
  panel(out, 'glass', w, u - left, u + right, bottom, top, depth, c.window);
  if (level === 0) return;
  const offset = depth + 0.025;
  const wide = 0.06;
  for (const x of [u - left, u + right])
    panel(out, 'trim', w, x - wide, x + wide, bottom - 0.055, top + 0.065, offset, c.darkMetal);
  for (const y of [bottom, top])
    panel(out, 'trim', w, u - left, u + right, y - 0.058, y + 0.058, offset, c.darkMetal);
  panel(out, 'trim', w, u - 0.041, u + 0.041, bottom, top, offset, c.darkMetal);
  for (let i = 1; i < 4; i++) {
    const y = mix(bottom, top, i / 4);
    panel(out, 'trim', w, u - left, u + right, y - 0.032, y + 0.032, offset, c.darkMetal);
  }
  if (level >= 2) {
    const n = level === 2 ? 3 : 4;
    for (let i = 1; i < n; i++) {
      const x = mix(u - left, u + right, i / n);
      panel(out, 'trim', w, x - 0.023, x + 0.023, bottom, top, offset + 0.01, c.darkMetal);
    }
    trimBlock(
      out,
      'trim',
      w,
      u - left - 0.13,
      u + right + 0.13,
      bottom - 0.09,
      bottom + 0.012,
      0.02,
      depth + 0.12,
      c.cornice,
    );
  }
}
function arcade(out, level) {
  const floor = d.arcadeFloor;
  const spring = 2.41;
  const top = d.arcadeTop;
  const r = 1.18,
    rise = 1.18,
    depth = -1.69;
  const n = [6, 10, 14, 18][level];
  let progress = 0;
  panel(
    out,
    'foundation',
    front,
    0,
    front.length,
    facadeBase([0, d.front]),
    floor,
    0.006,
    c.basement,
  );
  for (const [index, u] of archBays.entries()) {
    const leftArch = u - r,
      rightArch = u + r;
    panel(out, 'foundation', front, progress, leftArch, floor, top, 0.008, c.basement);
    progress = rightArch;
    const open = index > 0 && index < 7;
    if (!open) {
      panel(out, 'foundation', front, leftArch, rightArch, floor, spring, -0.105, c.quoins);
    }
    const point = (t, profile, offset) =>
      front.p(u + Math.cos(t) * (r + profile), spring + Math.sin(t) * (rise + profile), offset);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n;
      const l = point(b, 0, 0.008),
        rr = point(a, 0, 0.008);
      face(
        out,
        'foundation',
        [l, rr, front.p(u + Math.cos(a) * r, top, 0.008), front.p(u + Math.cos(b) * r, top, 0.008)],
        front.normal,
        c.basement,
      );
      if (open)
        face(
          out,
          'foundation',
          [l, point(b, 0, depth), point(a, 0, depth), rr],
          [0, -1, 0],
          c.quoins,
        );
      if (!open) {
        face(
          out,
          'foundation',
          [point(b, 0, -0.105), point(a, 0, -0.105), front.p(u, spring, -0.105)],
          front.normal,
          c.quoins,
        );
      }
      if (level >= 1) {
        const shrink = (b - a) * 0.048;
        face(
          out,
          'trim',
          [
            point(a + shrink, 0, 0.027),
            point(b - shrink, 0, 0.027),
            point(b - shrink, 0.15, 0.055),
            point(a + shrink, 0.15, 0.055),
          ],
          front.normal,
          i === Math.floor(n / 2) ? c.cornice : c.quoins,
        );
      }
    }
    if (open) {
      for (const [x, side] of [
        [leftArch, -1],
        [rightArch, 1],
      ]) {
        face(
          out,
          'foundation',
          [
            front.p(x, floor, 0.008),
            front.p(x, floor, depth),
            front.p(x, spring, depth),
            front.p(x, spring, 0.008),
          ],
          [side, 0, 0],
          c.quoins,
        );
      }
      panel(out, 'foundation', front, leftArch, rightArch, floor, top, depth - 0.37, c.corridor);
    } else if (level >= 2) {
      glassBay(out, front, u, 0.24, 0.24, 1.14, 2.03, 1, 0.039);
    }
  }
  panel(out, 'foundation', front, progress, front.length, floor, top, 0.008, c.basement);
  face(
    out,
    'foundation',
    [
      front.p(0, floor, 0.008),
      front.p(front.length, floor, 0.008),
      front.p(front.length, floor, -2.04),
      front.p(0, floor, -2.04),
    ],
    up,
    c.stone,
  );
  if (level >= 1) {
    for (const y of [0.58, 1.1, 1.62, 2.14, 2.64, 3.13, 3.68]) {
      panel(out, 'trim', front, 0.07, archBays[0] - 1.3, y, y + 0.017, 0.019, c.joint);
      panel(
        out,
        'trim',
        front,
        archBays.at(-1) + 1.34,
        front.length - 0.06,
        y,
        y + 0.017,
        0.019,
        c.joint,
      );
    }
  }
  moulding(out, front, 0, front.length, top, 0.24, 0.2, c.quoins);
}
function upperFront(out, level) {
  for (const [i, u] of windowBays.entries()) {
    const center = i === 5;
    const half = center ? 2.11 : 1.2;
    const width = center ? 2.46 : 1.51;
    const depth = center ? 0.143 : 0.061;
    panel(out, 'render', front, u - width, u + width, 4.37, 11.5, depth - 0.018, c.render);
    glassBay(out, front, u, half, half, ...d.secondWindows, level, depth);
    if (center) {
      const spring = 10.97;
      arch(
        out,
        front,
        u,
        8.26,
        spring,
        1.07,
        1.04,
        depth,
        level,
        { inner: c.darkWindow, trim: c.cornice, width: 0.14 },
        { inner: 'glass', trim: 'trim' },
      );
      for (const dir of [-1, 1]) {
        const x = u + 1.66 * dir;
        glassBay(out, front, x, 0.42, 0.42, 8.26, 10.8, level, depth);
      }
      if (level >= 1) {
        panel(
          out,
          'trim',
          front,
          u - 1.07,
          u + 1.07,
          spring - 0.06,
          spring + 0.06,
          depth + 0.044,
          c.darkMetal,
        );
        panel(
          out,
          'trim',
          front,
          u - 0.034,
          u + 0.034,
          8.26,
          spring + 1,
          depth + 0.053,
          c.darkMetal,
        );
        for (const y of [8.91, 9.57, 10.24, 10.76])
          panel(
            out,
            'trim',
            front,
            u - 1.07,
            u + 1.07,
            y - 0.034,
            y + 0.034,
            depth + 0.044,
            c.darkMetal,
          );
      }
    } else glassBay(out, front, u, half, half, ...d.thirdWindows, level, depth);
  }
  if (level >= 1) {
    for (const u of [mid - d.centralFrontWidth / 2, mid + d.centralFrontWidth / 2]) {
      trimBlock(out, 'brick', front, u - 0.48, u + 0.48, 4.34, 11.67, 0.002, 0.14, c.warmBrick);
    }
  }
  const bind = mid - d.centralFrontWidth / 2,
    end = mid + d.centralFrontWidth / 2;
  moulding(out, front, 0, bind, 11.56, 0.26, 0.3);
  moulding(out, front, end, front.length, 11.56, 0.26, 0.3);
  for (const y of [7.77, 11.73]) {
    if (level >= 2) moulding(out, front, 0, front.length, y, 0.081, 0.098, c.render);
  }
  const z = d.front + 0.115;
  const frontTri = [
    [-d.centralFrontWidth / 2, 11.62, z],
    [0, d.pediment, z],
    [d.centralFrontWidth / 2, 11.62, z],
  ];
  face(out, 'brick', frontTri, [0, 0, 1], c.warmBrick);
  for (const [a, b] of pairs(frontTri)) {
    beam(out, 'trim', a, b, 0.21, 0.3, c.cornice);
    if (level >= 2)
      beam(
        out,
        'slate',
        [a[0], a[1] + 0.099, a[2] + 0.03],
        [b[0], b[1] + 0.099, b[2] + 0.03],
        0.095,
        0.35,
        c.slate,
      );
  }
}
function sideAndRear(out, level) {
  for (const w of [sideLeft, sideRight, rear]) {
    const a = w.p(0, 0),
      b = w.p(w.length, 0);
    const bottom = [facadeBase([a[0], a[2]]), facadeBase([b[0], b[2]])];
    face(
      out,
      'foundation',
      [
        w.p(0, bottom[0]),
        w.p(w.length, bottom[1]),
        w.p(w.length, d.arcadeTop),
        w.p(0, d.arcadeTop),
      ],
      w.normal,
      c.basement,
    );
    moulding(out, w, 0, w.length, d.eaves - 0.06, 0.21, 0.2, c.cornice);
    if (w !== rear) {
      moulding(out, w, 0, w.length, d.arcadeTop, 0.17, 0.13, c.quoins);
      for (const t of [0.24, 0.5, 0.76]) {
        const x = t * w.length;
        panel(out, 'render', w, x - 1.2, x + 1.2, 4.42, 11.17, 0.029, c.render);
        for (const [lo, hi] of [d.secondWindows, d.thirdWindows])
          glassBay(out, w, x, 0.96, 0.96, lo, hi, level);
      }
    } else {
      panel(out, 'render', w, 0, w.length, d.arcadeTop, d.eaves - 0.12, 0.012, c.aft);
      for (let i = 1; i <= 10; i++) {
        const x = (w.length * i) / 11;
        for (const [lo, hi] of [d.secondWindows, d.thirdWindows])
          glassBay(out, w, x, 0.78, 0.78, lo + 0.18, hi - 0.1, level, 0.042);
      }
    }
    if (level >= 2 && w !== rear) {
      for (const y of [0.54, 1.13, 1.72, 2.31, 2.9, 3.49, 4.08]) {
        panel(out, 'trim', w, 0.01, w.length - 0.02, y, y + 0.016, 0.013, c.joint);
      }
    }
  }
}
function roofs(out, level) {
  const z0 = (rearLeft[1] + rearRight[1]) / 2;
  const dz = (z0 + d.front) / 2;
  const upY = d.eaves + 0.04;
  const edges = [
    [-22.89, upY, d.front + 0.23],
    [22.15, upY, d.front + 0.23],
    [-22.5, upY, z0 - 0.29],
    [23.32, upY, z0 - 0.29],
  ];
  const [fl, fr, rl, rr] = edges;
  const l = [-22.71, d.ridge, dz],
    r = [22.78, d.ridge, dz];
  face(out, 'slate', [fl, fr, r, l], up, c.slate);
  face(out, 'slate', [rl, l, r, rr], up, c.slate);
  face(out, 'brick', [fl, l, rl], [-1, 0, 0], c.shadowBrick);
  face(out, 'brick', [fr, rr, r], [1, 0, 0], c.shadowBrick);
  const t = [0, d.pediment + 0.13, d.front + 0.27];
  const join = [0, d.ridge, dz];
  face(out, 'slate', [[-d.centralFrontWidth / 2, upY, d.front + 0.27], t, join], up, c.slate);
  face(out, 'slate', [[d.centralFrontWidth / 2, upY, d.front + 0.27], join, t], up, c.slate);
  if (level >= 1) beam(out, 'slate', l, r, 0.09, 0.13, c.roofTrim);
  if (level >= 2)
    for (const [x, z] of [
      [-17, -3.6],
      [-6.9, -3.6],
      [8.5, -3.6],
      [17, -3.6],
    ]) {
      const y = mix(d.ridge, upY, Math.abs(z - dz) / Math.abs(z0 - dz));
      beam(out, 'brick', [x, y - 0.22, z], [x, y + 0.86, z], 0.43, 0.68, c.shadowBrick);
    }
}
function build(out, level) {
  shell(out, d.outline, () => d.arcadeTop, d.eaves, {
    wall: 'brick',
    roof: 'slate',
    color: c.brick,
    roofColor: c.slate,
  });
  arcade(out, level);
  upperFront(out, level);
  sideAndRear(out, level);
  roofs(out, level);
  if (level >= 1) {
    for (const x of [left, right]) {
      panel(out, 'trim', front, x - 0.075, x + 0.075, 0.36, 11.43, 0.243, c.roofTrim);
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'victoria-hospital-hong-kong-model.mjs';
const camera = [49, 23, 65],
  lookAt = [0, 6.4, 0];
const errors = { district: 0.49, street: 0.16, closeup: 0.053 };
export const victoriaHospitalAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Named former maternity block outline and the original Lands Department reading below the Barker Road approach.',
  brief:
    'The surviving 1921 Victoria Hospital Maternity Block, with grey lower arcade, red brick framing, tall windows and a pronounced central pediment.',
  camera,
  lookAt,
  sunDirection: [74, 91, 102],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named native Victoria Flats footprint at 17 Barker Road.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_ashlar', 'slate', 'plaster_lime'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'arcaded-entrance-and-brick-front', position: [25, 10.6, 40.5], lookAt: [0, 5.8, 7.8] },
    { name: 'venetian-window-and-gabled-pediment', position: [-8, 14, 32], lookAt: [0, 9.1, 7.8] },
    { name: 'plain-uphill-rear-and-roofs', position: [34, 40, -38], lookAt: [0, 9, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'victoria-hospital-hong-kong-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Terrain courtesy of the Hong Kong Lands Department under DATA.GOV.HK terms.',
};
