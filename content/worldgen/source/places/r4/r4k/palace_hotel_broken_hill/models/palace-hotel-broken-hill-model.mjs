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
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/palace-hotel-broken-hill-shape-controls');
const outline = outwardRing(shape.outline);
const argent = wallFace(...shape.argentFacade);
const sulphide = wallFace(...shape.sulphideFacade);
const loft = shape.upperCornice;
const canopy = shape.mainVerandaHeight;
const depth = shape.mainRailOffset;
const deck = 3.89;
const surfaces = {
  masonry: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  plaster: { slot: 'trim', graph: 'concrete_plain', roughness: 0.86 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.78, metallic: 0.19 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};
const redBrick = rgb('996851');
const stone = rgb('c2ad88');
const stucco = rgb('c7b499');
const ivory = rgb('d0c4a1');
const green = rgb('66705d');
const glass = rgb('3c4441');
const wood = rgb('57473d');
const zinc = rgb('767c75');
const retaining = rgb('ada084');
const fadedGold = rgb('d8ccae');

function lip(out, f, slot, y, h, offset, color, padding = 0) {
  fbox(out, slot, f, -padding, f.length + padding, y, y + h, -0.09, offset, color);
}

function roof(out, box, upper, y, ridge) {
  const [x0, x1, z0, z1] = box;
  const [u0, u1, v0, v1] = upper;
  const base = [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
  ];
  const top = [
    [u0, ridge, v0],
    [u0, ridge, v1],
    [u1, ridge, v1],
    [u1, ridge, v0],
  ];
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    quad4(out, 'roof', base[i], base[j], top[j], top[i], zinc);
  }
  quad4(out, 'roof', ...top, zinc);
}

function topSash(out, f, u, level, gray = glass) {
  const y = loft - 3.02;
  if (level === 1) {
    quad4(
      out,
      'glass',
      f.P(u - 0.47, y, 0.028),
      f.P(u + 0.47, y, 0.028),
      f.P(u + 0.47, y + 2.04, 0.028),
      f.P(u - 0.47, y + 2.04, 0.028),
      gray,
    );
    return;
  }
  opening(out, f, u, y, 0.96, 2.12, {
    head: 'flat',
    glassSlot: 'glass',
    frameSlot: 'plaster',
    glass: gray,
    frame: stone,
    frameWidth: 0.11,
    frameDepth: 0.105,
    d: 0.03,
    sill: true,
    mullions: level === 3 ? 1 : 0,
    transoms: 1,
    mullionColor: ivory,
  });
  if (level >= 3)
    fbox(out, 'plaster', f, u - 0.68, u + 0.68, y + 2.18, y + 2.3, 0.01, 0.18, stucco);
}

function renderFacade(out, f, upperCount, verandaCount, level) {
  lip(out, f, 'plaster', loft - 0.31, 0.17, 0.24, stone, 0.05);
  lip(out, f, 'plaster', loft - 0.14, 0.14, 0.31, stucco, 0.06);
  lip(out, f, 'plaster', 7.84, 0.12, 0.15, stone, 0.02);
  if (level === 0) return;
  for (let i = 0; i < upperCount; i++) topSash(out, f, ((i + 0.5) * f.length) / upperCount, level);
  if (level >= 3) {
    for (let u = 0.3; u < f.length - 0.15; u += 0.67)
      fbox(out, 'plaster', f, u - 0.069, u + 0.069, loft - 0.43, loft - 0.3, 0.08, 0.25, ivory);
  }
  if (level < 2) return;
  for (let i = 0; i < verandaCount; i++) {
    const u = ((i + 0.5) * f.length) / verandaCount;
    const entrance = i % 4 === 1;
    opening(out, f, u, entrance ? 0.16 : 0.68, entrance ? 1.38 : 2.12, entrance ? 2.62 : 2.14, {
      head: 'flat',
      glassSlot: entrance ? 'timber' : 'glass',
      frameSlot: 'plaster',
      glass: entrance ? wood : glass,
      frame: stucco,
      frameWidth: 0.14,
      frameDepth: 0.16,
      d: 0.04,
      sill: !entrance,
      mullions: entrance ? 0 : 2,
      transoms: level === 3 ? 1 : 0,
      mullionColor: stone,
    });
    opening(out, f, u, deck + 0.12, 1.14, 2.42, {
      head: 'flat',
      glassSlot: 'glass',
      frameSlot: 'timber',
      glass,
      frame: wood,
      frameWidth: 0.095,
      frameDepth: 0.11,
      d: 0.03,
      sill: false,
      mullions: 1,
      transoms: level === 3 ? 1 : 0,
      mullionColor: stone,
    });
  }
  lip(out, f, 'plaster', 0.2, 0.32, 0.11, retaining);
  lip(out, f, 'plaster', 3.13, 0.12, 0.15, stucco);
}

function upright(out, f, u, y0, y1, level, extend) {
  const [x, , z] = f.P(u, 0, depth);
  if (level === 0) {
    abox(out, 'iron', [x - 0.079, y0, z - 0.079], [x + 0.079, y1, z + 0.079], ivory);
    return;
  }
  const profile = [
    [y0, 0.132, 0.132],
    [y0 + 0.18, 0.132, 0.132],
    [y0 + 0.29, 0.073, 0.073],
    [y1 - 0.21, 0.063, 0.063],
    [y1 - 0.08, 0.151, 0.151],
    [y1, 0.145, 0.145],
  ];
  lathe(out, 'iron', [x, z], profile, level === 3 ? 8 : 5, ivory, { capTop: false });
  if (extend)
    fbox(out, 'iron', f, u - 0.15, u + 0.15, y0, y0 + 0.18, depth - 0.151, depth + 0.151, green);
}

function diagonalPlane(out, f, u, y, v, h, d, width, color) {
  const length = Math.hypot(v - u, h - y);
  const ux = ((-(h - y) / length) * width) / 2;
  const uy = (((v - u) / length) * width) / 2;
  const points = [
    f.P(u - ux, y - uy, d),
    f.P(v - ux, h - uy, d),
    f.P(v + ux, h + uy, d),
    f.P(u + ux, y + uy, d),
  ];
  quad4(out, 'iron', ...points, color);
  if (d >= depth + 0.026) quad4(out, 'iron', ...points.slice().reverse(), color);
}

function balcony(out, f, bays, level, { start, end }) {
  const step = (end - start) / bays;
  const wallStart = Math.max(start, 0);
  const wallEnd = Math.min(end, f.length);
  const floorEnd = f === sulphide ? wallEnd : end;
  fbox(out, 'plaster', f, start, floorEnd, deck - 0.28, deck + 0.08, -0.09, depth + 0.12, stucco, {
    bottom: true,
  });
  fbox(out, 'iron', f, start, end, deck - 0.28, deck - 0.14, depth + 0.08, depth + 0.28, green);
  fbox(out, 'iron', f, start, end, deck - 0.11, deck + 0.075, depth + 0.1, depth + 0.3, ivory);
  fbox(out, 'iron', f, start, end, deck + 1.0, deck + 1.09, depth - 0.085, depth + 0.09, green);
  fbox(out, 'iron', f, start, end, deck + 0.15, deck + 0.24, depth - 0.05, depth + 0.07, ivory);
  fbox(out, 'iron', f, start, end, canopy - 0.31, canopy, depth - 0.13, depth + 0.26, ivory);
  fbox(out, 'iron', f, start, end, canopy - 0.42, canopy - 0.31, depth + 0.15, depth + 0.27, green);
  quad4(
    out,
    'roof',
    f.P(start, canopy - 0.02, depth + 0.22),
    f.P(end, canopy - 0.02, depth + 0.22),
    f.P(wallEnd, canopy + 0.51, -0.08),
    f.P(wallStart, canopy + 0.51, -0.08),
    zinc,
  );
  if (level === 0)
    fbox(out, 'iron', f, start, end, deck + 0.24, deck + 1.0, depth - 0.033, depth + 0.03, ivory);
  for (let j = 0; j <= bays; j++) {
    const u = start + j * step;
    if (!(j === 0 && start < -0.5)) {
      const ground =
        level >= 2 ? -0.18 - (f === sulphide ? Math.max(0, 1 - j / bays) * 1.19 : 0) : -1.3;
      upright(out, f, u, ground, deck - 0.28, level, true);
      upright(out, f, u, deck + 0.03, canopy - 0.31, level, false);
    }
    if (j === bays || level < 1) continue;
    const n = level === 3 ? 15 : level === 2 ? 11 : 5;
    for (let k = 0; k < n; k++) {
      const a = u + ((k + 0.5) / n) * step;
      const w = level === 1 ? 0.055 : 0.041;
      if (level === 3) {
        diagonalPlane(
          out,
          f,
          a - 0.045,
          deck + 0.225,
          a + 0.065,
          deck + 0.47,
          depth + 0.031,
          w,
          ivory,
        );
        diagonalPlane(
          out,
          f,
          a + 0.065,
          deck + 0.47,
          a - 0.05,
          deck + 0.77,
          depth + 0.031,
          w,
          ivory,
        );
        diagonalPlane(
          out,
          f,
          a - 0.05,
          deck + 0.77,
          a + 0.02,
          deck + 1.02,
          depth + 0.031,
          w,
          ivory,
        );
      } else {
        diagonalPlane(out, f, a, deck + 0.215, a, deck + 1.03, depth + 0.031, w, ivory);
      }
    }
    if (level < 2) continue;
    for (const sign of [-1, 1]) {
      const post = sign === 1 ? u : u + step;
      for (const h of [deck - 0.28, canopy - 0.42]) {
        const r = post + sign * 0.57;
        tri(
          out,
          'iron',
          f.P(post, h - 0.6, depth + 0.031),
          f.P(r, h, depth + 0.031),
          f.P(post, h, depth + 0.031),
          ivory,
        );
        diagonalPlane(out, f, post, h - 0.62, r, h - 0.03, depth + 0.034, 0.073, ivory);
        if (level === 3) {
          diagonalPlane(
            out,
            f,
            post + sign * 0.14,
            h - 0.36,
            post + sign * 0.33,
            h - 0.14,
            depth + 0.041,
            0.045,
            green,
          );
          diagonalPlane(
            out,
            f,
            post + sign * 0.28,
            h - 0.23,
            post + sign * 0.48,
            h - 0.045,
            depth + 0.041,
            0.038,
            green,
          );
        }
      }
    }
  }
}

const letters = {
  P: ['1110', '1001', '1110', '1000', '1000'],
  A: ['0110', '1001', '1111', '1001', '1001'],
  L: ['1000', '1000', '1000', '1000', '1111'],
  C: ['0111', '1000', '1000', '1000', '0111'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  H: ['1001', '1001', '1111', '1001', '1001'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  T: ['1111', '0110', '0110', '0110', '0110'],
};

function lettering(out, face, title, level) {
  const u = (face.length - title.length * 0.93) * 0.5;
  fbox(
    out,
    'iron',
    face,
    u - 0.42,
    u + title.length * 0.93 + 0.16,
    16.03,
    17.11,
    -0.16,
    0.037,
    green,
  );
  if (level < 2) return;
  for (let i = 0; i < title.length; i++) {
    const pattern = letters[title[i]];
    if (!pattern) continue;
    for (let row = 0; row < pattern.length; row++) {
      const s = pattern[row];
      for (let col = 0; col < s.length; col++) {
        if (s[col] !== '1') continue;
        const x = u + i * 0.93 + col * 0.178;
        const y = 16.875 - row * 0.184;
        quad4(
          out,
          'iron',
          face.P(x, y, 0.043),
          face.P(x + 0.181, y, 0.043),
          face.P(x + 0.181, y + 0.187, 0.043),
          face.P(x, y + 0.187, 0.043),
          fadedGold,
        );
      }
    }
  }
}

function roofCap(out, ring, height) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'roof',
      'palette:#ffffff',
      outwardRing(ring),
      [],
      () => height,
      [0, 1, 0],
      (point) => point,
      zinc,
    )
  ) {
    throw Error('Palace Hotel roof could not be triangulated');
  }
  const { indices, positions } = b.finalize();
  for (let k = 0; k < indices.length; k += 3) {
    const vertices = [indices[k], indices[k + 1], indices[k + 2]].map((index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    tri(out, 'roof', ...vertices, zinc);
  }
}
function build(out, level) {
  extrude(out, 'masonry', outline, -2.5, 4.03, redBrick, { top: false });
  roofCap(out, outline, 4.03);
  const frontBlock = [
    [-9.805, 11.93],
    [-9.81, 24.208],
    [11.216, 24.208],
    [11.225, 11.89],
  ];
  const sideBlock = [
    [-9.801, -24.879],
    [-9.806, 11.936],
    [-1.38, 11.936],
    [-1.43, -24.879],
  ];
  extrude(out, 'masonry', frontBlock, 3.97, loft, redBrick, { top: false });
  extrude(out, 'masonry', sideBlock, 3.97, loft - 0.14, redBrick, { top: false });
  roof(out, [-10.14, 11.56, 11.5, 24.58], [-8.89, 10.06, 17.96, 18.16], loft - 0.028, 16.23);
  roof(out, [-9.26, -5.74, 16.59, 19.39], [-8.07, -7.07, 17.75, 18.23], 15.2, shape.roofRidge);
  roof(out, [6.62, 10.45, 16.52, 19.36], [7.9, 9.1, 17.75, 18.23], 15.18, shape.roofRidge - 0.14);
  roof(out, [-10.13, -1.08, -25.1, 13.33], [-5.59, -5.36, -23.0, 13.85], loft - 0.16, 13.62);
  for (const [x, z0, z1] of [
    [9.19, -11.54, -1.28],
    [9.59, -24.87, -17.41],
  ]) {
    const wing = [
      [-1.47, z0],
      [-1.47, z1],
      [x, z1],
      [x, z0],
    ];
    extrude(out, 'masonry', wing, 3.96, 6.81, redBrick, { top: false });
    roof(
      out,
      [-1.64, x + 0.23, z0 - 0.28, z1 + 0.26],
      [(x - 1.5) / 2 - 0.12, (x - 1.5) / 2 + 0.1, z0 + 1.2, z1 - 1.2],
      6.79,
      8.74,
    );
    if (level >= 2) {
      const f = wallFace([x, z1], [x, z0]);
      for (let i = 0; i < 4; i++)
        opening(out, f, (f.length * (i + 0.5)) / 4, 4.73, 0.91, 1.54, {
          glassSlot: 'glass',
          frameSlot: 'plaster',
          glass,
          frame: stucco,
          frameWidth: 0.12,
          d: 0.018,
          mullions: 0,
          transoms: 1,
          mullionColor: ivory,
        });
    }
  }
  renderFacade(out, argent, 8, 7, level);
  renderFacade(out, sulphide, 17, 13, level);
  balcony(out, argent, 7, level, { start: -depth, end: argent.length });
  balcony(out, sulphide, 13, level, { start: 0, end: sulphide.length + depth });
  const ridge = wallFace([-8.5, 18.2], [9.3, 18.2]);
  lettering(out, ridge, 'PALACE HOTEL', level);
  abox(out, 'masonry', [-6.54, 14.87, 15.85], [-5.33, 17.83, 17.09], redBrick);
  abox(out, 'plaster', [-6.64, 17.69, 15.74], [-5.22, 17.96, 17.2], stone);
  if (level >= 2)
    lathe(
      out,
      'iron',
      [-7.6, 18.03],
      [
        [17.24, 0.047, 0.047],
        [19.2, 0.031, 0.031],
      ],
      5,
      green,
      { capTop: false },
    );
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'palace-hotel-broken-hill-model.mjs';
const camera = [-61, 30, 65];
const lookAt = [-1, 7, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Palace Hotel with the three-storey Victorian brick exterior, tall hipped roof and continuous two-level iron verandas on Argent and Sulphide Streets.',
  camera,
  lookAt,
  sunDirection: [-31, 45, 40],
  mediumFiContext: {
    scale: 1.07,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Mapped Palace Hotel footprint for the standing hotel at 227 Argent Street.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'argent-and-sulphide-corner', position: [-29, 7.8, 47], lookAt: [-7, 8, 22] },
    { name: 'long-iron-veranda', position: [-52, 10, -9], lookAt: [-10, 7, -1] },
    { name: 'mansard-and-courtyard-ranges', position: [36, 28, -29], lookAt: [1, 8, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-hotel-broken-hill-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.34,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.47, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
};
