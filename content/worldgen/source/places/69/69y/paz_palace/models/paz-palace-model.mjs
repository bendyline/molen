import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/paz-palace-shape-controls');
const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.92 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.72 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};
const cream = rgb('d0c7af');
const pale = rgb('ddd0b6');
const shade = rgb('b5aa94');
const baseStone = rgb('a69e89');
const dark = rgb('4c514b');
const iron = rgb('42453e');
const bronze = rgb('8d7553');
const roof = rgb('5c6261');
const grayRoof = rgb('686b65');
const eave = shape.pavilionCorniceEstimate;
const outer = outwardRing(shape.outer);
const court = outwardRing(shape.innerCourt).reverse();
const [a, b] = shape.mainFrontEndpoints;
const avenue = wallFace(a, b);
const [c, d] = shape.maipuFrontEndpoints;
const side = wallFace(c, d);
const [[cornerX, cornerZ], [otherX, otherZ]] = [shape.outer[22], shape.outer[21]];

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function cap(out, slot, ring, holes, y, color) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(ring),
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Palace roof cap could not be triangulated');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const group = [m.indices[i], m.indices[i + 1], m.indices[i + 2]].map((v) =>
      Array.from(m.positions.slice(v * 3, v * 3 + 3)),
    );
    tri(out, slot, ...group, color);
  }
}

function course(out, f, y, depth, height, color = pale, start = 0, end = f.length) {
  fbox(out, 'ashlar', f, start, end, y, y + height, -0.1, depth, color, { bottom: true });
}

function mansard(out, f, u0, u1, d0, d1, baseY, shoulderY, topY, inset) {
  const ring = (x0, x1, z0, z1, y) => [
    f.P(x0, y, z1),
    f.P(x1, y, z1),
    f.P(x1, y, z0),
    f.P(x0, y, z0),
  ];
  const low = ring(u0, u1, d0, d1, baseY);
  const high = ring(u0 + inset, u1 - inset, d0 + inset, d1 - inset, shoulderY);
  const crown = ring(
    u0 + inset * 1.57,
    u1 - inset * 1.57,
    d0 + inset * 1.54,
    d1 - inset * 1.54,
    topY,
  );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, 'slate', low[i], low[j], high[j], high[i], roof);
    quad4(out, 'slate', high[i], high[j], crown[j], crown[i], grayRoof);
  }
  quad4(out, 'slate', ...crown, grayRoof);
}

function pilaster(out, f, u, width, height, level) {
  const half = width * 0.5;
  fbox(out, 'limestone', f, u - half, u + half, 3.55, height, -0.08, 0.29, cream);
  for (const [y, w, h] of [
    [3.65, half * 1.4, 0.26],
    [height - 0.22, half * 1.38, 0.2],
  ])
    fbox(out, 'ashlar', f, u - w, u + w, y, y + h, -0.05, 0.41, pale);
  if (level >= 3)
    for (const x of [u - half * 0.42, u + half * 0.42])
      fbox(out, 'ashlar', f, x - 0.027, x + 0.027, 4.1, height - 0.3, 0.285, 0.315, shade);
}

function palaceWindow(out, f, u, y, width, height, level, arch = false) {
  if (level === 1) {
    const a = u - width * 0.5,
      b = u + width * 0.5;
    quad4(
      out,
      'glass',
      f.P(a, y, 0.025),
      f.P(b, y, 0.025),
      f.P(b, y + height, 0.025),
      f.P(a, y + height, 0.025),
      dark,
    );
    if (arch) course(out, f, y + height, 0.16, 0.12, pale, a - 0.12, b + 0.12);
    return;
  }
  opening(out, f, u, y, width, height, {
    head: arch ? 'round' : 'flat',
    glassSlot: 'glass',
    frameSlot: 'ashlar',
    glass: dark,
    frame: pale,
    frameWidth: arch ? 0.18 : 0.15,
    frameDepth: 0.14,
    mullions: level === 3 ? 2 : 1,
    transoms: arch ? 1 : 0,
  });
}

function rail(out, f, u, base, width, level) {
  const half = width * 0.5;
  fbox(out, 'ashlar', f, u - half, u + half, base - 0.14, base + 0.02, -0.16, 0.51, pale);
  fbox(out, 'iron', f, u - half, u + half, base + 0.68, base + 0.74, 0.4, 0.49, iron);
  if (level < 2) return;
  const n = Math.ceil(width / (level === 3 ? 0.25 : 0.43));
  for (let i = 0; i <= n; i++) {
    const at = u - half + (width * i) / n;
    fbox(out, 'iron', f, at - 0.03, at + 0.03, base, base + 0.7, 0.418, 0.463, iron);
  }
}

function elevation(out, f, level, { bay = 4.6, principal = false, lateral = false } = {}) {
  if (f.length < 3.7) return;
  if (level > 0) {
    course(out, f, 1.06, 0.22, 0.26, baseStone);
    course(out, f, 3.61, 0.25, 0.46, shade);
  }
  course(out, f, 10.13, 0.4, 0.48);
  course(out, f, eave - 0.69, 0.63, 0.29);
  course(out, f, eave - 0.26, 0.79, 0.21);
  if (level === 0) return;
  if (level >= 2) {
    for (const y of [1.91, 2.59, 5.17, 6.21, 7.25, 8.31, 11.3, 12.37, 13.45, 14.55, 15.61])
      course(out, f, y, 0.019, 0.03, shade);
  }
  const n = Math.max(1, Math.round(f.length / bay));
  const pitch = f.length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * pitch;
    if (principal && u > f.length - 12.2) continue;
    const central = principal && Math.abs(u - f.length * 0.49) < 10;
    palaceWindow(out, f, u, 5.1, Math.min(2.27, pitch * 0.49), 4.42, level, central || i % 3 === 0);
    palaceWindow(out, f, u, 11.22, Math.min(2.03, pitch * 0.44), 4.81, level);
    if (level >= 2) {
      if (central || i % 4 === 1) rail(out, f, u, 11.12, Math.min(2.78, pitch * 0.72), level);
      palaceWindow(out, f, u, 1.59, Math.min(0.99, pitch * 0.27), 1.31, level);
      if (lateral) pilaster(out, f, u + pitch * 0.41, 0.52, 16.72, level);
    }
  }
}

function dormer(out, f, u, y, d, span, level) {
  fbox(out, 'ashlar', f, u - span * 0.54, u + span * 0.54, y, y + 1.9, d - 0.76, d + 0.17, pale);
  if (level >= 2) {
    opening(out, f, u, y + 0.17, span * 0.73, 1.47, {
      head: 'round',
      glassSlot: 'glass',
      frameSlot: 'ashlar',
      glass: dark,
      frame: cream,
      frameWidth: 0.115,
      d: d + 0.195,
      mullions: level === 3 ? 1 : 0,
    });
    tri(
      out,
      'ashlar',
      f.P(u - span * 0.63, y + 1.7, d + 0.2),
      f.P(u + span * 0.63, y + 1.7, d + 0.2),
      f.P(u, y + 2.22, d + 0.2),
      pale,
    );
  }
}

function bowWindow(out, x, z, r, level, corner = false) {
  const ceiling = corner ? eave : 10.88;
  lathe(
    out,
    'limestone',
    [x, z],
    [
      [-0.92, r, r],
      [ceiling, r, r],
    ],
    level === 0 ? 8 : 12,
    cream,
    { capTop: true, rotation: Math.PI / 8 },
  );
  lathe(
    out,
    'ashlar',
    [x, z],
    [
      [ceiling - 0.62, r * 1.065, r * 1.065],
      [ceiling - 0.27, r * 1.09, r * 1.09],
    ],
    level === 0 ? 8 : 12,
    pale,
    { capTop: false, rotation: Math.PI / 8 },
  );
  if (!corner && level > 0) {
    const side = wallFace([x + r * 0.45, z - r - 0.02], [x - r * 0.45, z - r - 0.02]);
    palaceWindow(out, side, side.length * 0.49, 4.12, 1.53, 4.51, level, true);
  }
}

function cornerDome(out, level) {
  const x = (cornerX + otherX) * 0.5 + 2.1,
    z = (cornerZ + otherZ) * 0.5 - 1.0;
  const r = 3.88;
  bowWindow(out, x, z, r, level, true);
  lathe(
    out,
    'slate',
    [x, z],
    [
      [eave - 0.08, r * 1.03, r * 1.03],
      [19.52, r, r],
      [24.3, r * 0.72, r * 0.72],
      [25.95, r * 0.34, r * 0.34],
      [26.62, 0.48, 0.48],
    ],
    level === 0 ? 8 : 12,
    roof,
    { capTop: true, rotation: Math.PI / 8 },
  );
  lathe(
    out,
    'iron',
    [x, z],
    [
      [26.59, 0.48, 0.48],
      [27.18, 0.56, 0.56],
      [28.24, 0.37, 0.37],
      [29.29, 0.23, 0.23],
      [30.1, 0, 0],
    ],
    8,
    iron,
    { capTop: false },
  );
}

function mainRoof(out, level) {
  mansard(out, avenue, 0.24, avenue.length - 8.55, -14.37, 0.27, eave - 0.03, 21.31, 22.1, 1.12);
  mansard(out, side, 0.35, side.length - 4.22, -10.7, 0.2, eave - 0.07, 21.08, 21.64, 1.08);
  const center = avenue.length * 0.515;
  mansard(
    out,
    avenue,
    center - 13.4,
    center + 12.6,
    -15.1,
    -0.25,
    eave - 0.03,
    27.19,
    shape.principalMansardEstimate,
    2.12,
  );
  for (const u of [center - 12.05, center + 12.05]) {
    fbox(out, 'limestone', avenue, u - 0.89, u + 0.89, 18.12, 26.4, -2.96, -1.52, cream);
    fbox(out, 'ashlar', avenue, u - 1.04, u + 1.04, 26.2, 26.49, -3.05, -1.4, pale);
    const [x, , z] = avenue.P(u, 0, -2.22);
    lathe(
      out,
      'iron',
      [x, z],
      [
        [26.48, 0.47, 0.47],
        [27.67, 0.31, 0.31],
        [29.53, 0, 0],
      ],
      6,
      iron,
      { capTop: false },
    );
  }
  if (level >= 1) {
    for (const f of [avenue, side]) {
      const n = f === avenue ? 12 : 6;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.55) * f.length) / (n + 0.55);
        if (f === avenue && (Math.abs(u - center) < 11.1 || u > f.length - 9.7)) continue;
        dormer(out, f, u, eave + 0.08, -0.38, 1.77, level);
      }
    }
  }
  if (level >= 2) {
    for (const u of [center - 7.22, center, center + 7.22]) {
      const w = u === center ? 4.2 : 2.75;
      const y = 18.02;
      fbox(out, 'ashlar', avenue, u - w * 0.51, u + w * 0.51, y - 0.18, y + 0.19, -0.6, 0.56, pale);
      tri(
        out,
        'ashlar',
        avenue.P(u - w * 0.56, y + 0.14, 0.49),
        avenue.P(u + w * 0.56, y + 0.14, 0.49),
        avenue.P(u, y + 0.14 + w * 0.31, 0.49),
        cream,
      );
      if (u === center) {
        const [x, , z] = avenue.P(u, 0, 0.48);
        for (let i = -2; i <= 2; i++)
          lathe(
            out,
            'ashlar',
            [x + i * 0.55, z],
            [
              [y + 0.26, 0.18, 0.12],
              [y + 0.52 + (0.26 - 0.08 * Math.abs(i)), 0.1, 0.095],
              [y + 0.91 - 0.1 * Math.abs(i), 0, 0],
            ],
            5,
            pale,
            { capTop: false },
          );
      }
    }
  }
}

function gate(out, level) {
  const ring = outwardRing(shape.rightEntry);
  const minX = Math.min(...ring.map(([x]) => x)),
    maxX = Math.max(...ring.map(([x]) => x));
  const minZ = Math.min(...ring.map(([, z]) => z)),
    maxZ = Math.max(...ring.map(([, z]) => z));
  const f = wallFace([minX, maxZ], [maxX, maxZ]);
  const mid = f.length * 0.5,
    eaveY = 8.26;
  box(out, 'limestone', minX, maxX, minZ, maxZ, -1.4, eaveY, cream);
  course(out, f, 7.86, 0.47, 0.43, pale);
  course(out, f, 1.04, 0.22, 0.18, shade);
  if (level === 0) return;
  opening(out, f, mid, 1.04, 4.15, 6.18, {
    head: 'round',
    glassSlot: 'iron',
    frameSlot: 'ashlar',
    glass: iron,
    frame: pale,
    frameWidth: 0.33,
    frameDepth: 0.24,
    d: 0.044,
    sill: false,
  });
  for (const u of [mid - 2.74, mid + 2.74]) buttressGate(out, f, u, eaveY);
  if (level >= 2) {
    const arc = roundArch(2.06, 8);
    for (let i = 0; i < 15; i++) {
      const u = (i - 7) * 0.253,
        y = 5.15 + Math.sqrt(Math.max(0, 2.06 ** 2 - u ** 2));
      fbox(out, 'bronze', f, mid + u - 0.019, mid + u + 0.019, 1.13, y, 0.08, 0.118, bronze);
    }
    for (const y of [2.73, 4.45, 5.13])
      fbox(out, 'bronze', f, mid - 2, mid + 2, y, y + 0.047, 0.08, 0.12, bronze);
    for (let i = 1; i < arc.length; i++) {
      const [l, h] = arc[i - 1],
        [r, k] = arc[i];
      quad4(
        out,
        'bronze',
        f.P(mid + l, 5.16 + h, 0.124),
        f.P(mid + r, 5.16 + k, 0.124),
        f.P(mid + r, 5.195 + k, 0.124),
        f.P(mid + l, 5.195 + h, 0.124),
        bronze,
      );
    }
  }
}

function buttressGate(out, f, u, height) {
  fbox(out, 'ashlar', f, u - 0.28, u + 0.28, 1.08, height - 0.88, -0.08, 0.25, shade);
  fbox(out, 'ashlar', f, u - 0.41, u + 0.41, height - 0.98, height - 0.7, -0.09, 0.36, pale);
}
function build(out, level) {
  extrude(out, 'limestone', outer, -1.6, eave, cream, { holes: [court], top: false });
  cap(out, 'slate', outer, [court], eave + 0.015, grayRoof);
  for (let i = 0; i < outer.length; i++) {
    const f = wallFace(outer[i], outer[(i + 1) % outer.length]);
    if (f.length < 4) continue;
    const principal =
      Math.abs(f.origin[1] - a[1]) < 0.05 && Math.abs(f.length - avenue.length) < 0.35;
    const sideWall = Math.abs(f.length - side.length) < 0.21;
    elevation(out, f, level, {
      principal,
      lateral: sideWall,
      bay: principal ? 4.27 : sideWall ? 4.6 : 5.2,
    });
  }
  if (level >= 2) {
    for (let i = 0; i < court.length; i++) {
      const f = wallFace(court[i], court[(i + 1) % court.length]);
      palaceWindow(out, f, f.length * 0.5, 7.72, 1.17, 2.39, level);
      palaceWindow(out, f, f.length * 0.5, 11.58, 1.17, 2.66, level);
    }
  }
  mainRoof(out, level);
  cornerDome(out, level);
  bowWindow(out, 15.09, -25.33, 3.38, level);
  gate(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'paz-palace-model.mjs';
const camera = [-57, 43, 96],
  lookAt = [6, 12.1, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Beaux-Arts Buenos Aires residence with an open light court, chamfered mansard corner, sculpted main range, semicircular Maipú bay, and lower Santa Fe gate.',
  camera,
  lookAt,
  sunDirection: [-39, 47, 33],
  mediumFiContext: {
    scale: 1.11,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outer,
    outlines: [outer, shape.rightEntry],
    holes: [court],
    minimumCoverage: 0.86,
    basis:
      'Suppress the mapped original palace and the attached low entry while keeping the unrelated nearby hotel and sports pavilion.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plaza-san-martin-main-and-corner', position: [-44, 16, 67], lookAt: [8, 13, 21.5] },
    { name: 'metalwork-and-avenue-gate', position: [56, 7.6, 41], lookAt: [51, 6, 22.8] },
    { name: 'side-bow-and-garden-facing-ranges', position: [-33, 37, -59], lookAt: [3, 11, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'paz-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.63,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.7, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.095, surfaces },
    },
  },
};
