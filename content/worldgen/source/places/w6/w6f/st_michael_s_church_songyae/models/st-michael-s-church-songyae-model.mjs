import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const colors = Object.fromEntries(
  Object.entries({
    siding: '533c30',
    timber: '6b4637',
    underside: '4b3830',
    roof: '463731',
    roofEdge: '6a5344',
    footing: 'a49a83',
    yellow: 'c49b34',
    gold: 'c79b3f',
    carvedShadow: '704a28',
    zinc: '939788',
    white: 'b9beb2',
    glass: '536168',
    dark: '2d302b',
    brass: '8b754b',
  }).map(([name, value]) => [name, rgb(value)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_plain', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'wood_plain', roughness: 0.91 },
  footing: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.83 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
};
const porchFront = 29.52;
const porchHalfWidth = 6.92;
const porchEave = 6.27;
const porchRidge = plan.dimensions.porchRidgeM;
const naveRidge = plan.dimensions.naveRidgeM;

function box(out, slot, minimum, maximum, color, bottom = false) {
  abox(out, slot, minimum, maximum, color, { bottom });
}

function roofPanel(out, slot, vertices, color, thickness) {
  const below = vertices.map(([x, y, z]) => [x, y - thickness, z]);
  const emit = (points, tint) => {
    if (points.length === 3) tri(out, slot, ...points, tint);
    else quad4(out, slot, ...points, tint);
  };
  emit(vertices, color);
  emit([...below].reverse(), colors.underside);
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    quad4(out, slot, vertices[i], below[i], below[next], vertices[next], colors.roofEdge);
  }
}

function roof(
  out,
  { x = 0, half, eave, ridge, front, back, hip = 0, slot = 'roof', tint = colors.roof },
  level,
) {
  const leftBack = [x - half, eave, back],
    leftFront = [x - half, eave, front];
  const rightBack = [x + half, eave, back],
    rightFront = [x + half, eave, front];
  const ridgeBack = [x, ridge, back + hip],
    ridgeFront = [x, ridge, front];
  roofPanel(out, slot, [leftBack, leftFront, ridgeFront, ridgeBack], tint, 0.15);
  roofPanel(out, slot, [rightFront, rightBack, ridgeBack, ridgeFront], tint, 0.15);
  if (hip > 0) roofPanel(out, slot, [rightBack, leftBack, ridgeBack], tint, 0.15);
  beam(out, slot, ridgeBack, ridgeFront, 0.2, 0.15, tint);
  if (level < 2) return;
  const rowCount = level === 3 ? 11 : 6;
  for (let i = 1; i < rowCount; i++) {
    const t = i / rowCount,
      y = eave + (ridge - eave) * t + 0.02;
    for (const side of [-1, 1]) {
      const u = x + side * half * (1 - t);
      beam(out, slot, [u, y, back + hip * t + 0.05], [u, y, front - 0.06], 0.028, 0.027, tint);
    }
  }
}

function cross(out, x, y, z, size, tint) {
  box(
    out,
    'trim',
    [x - size * 0.054, y, z - size * 0.045],
    [x + size * 0.054, y + size, z + size * 0.045],
    tint,
    true,
  );
  box(
    out,
    'trim',
    [x - size * 0.42, y + size * 0.65, z - size * 0.044],
    [x + size * 0.42, y + size * 0.75, z + size * 0.046],
    tint,
    true,
  );
}

function gable(out, x, z, half, eave, ridge, color, edge, edgeSlot = 'trim') {
  const left = [x - half, eave, z],
    right = [x + half, eave, z],
    top = [x, ridge, z];
  tri(out, 'wall', left, right, top, color);
  for (const end of [left, right]) {
    beam(out, edgeSlot, [end[0], end[1], z + 0.045], [top[0], top[1], z + 0.045], 0.16, 0.16, edge);
  }
}

function aisleRoof(out, side, level) {
  const inner = side * 5.18,
    outer = side * 8.12;
  const highRear = [inner, 6.24, -29.4],
    highFront = [inner, 6.24, 25.7];
  const lowRear = [outer, 3.68, -27.1],
    lowFront = [side * 7.22, 3.68, 27.2];
  const first = [lowRear, lowFront, highFront, highRear];
  roofPanel(out, 'roof', side < 0 ? first : first.reverse(), colors.roof, 0.15);
  beam(out, 'trim', lowRear, lowFront, 0.17, 0.22, colors.zinc);
  if (level === 3) {
    for (let t = 0.16; t < 0.95; t += 0.16) {
      const xRear = lowRear[0] + t * (highRear[0] - lowRear[0]);
      const xFront = lowFront[0] + t * (highFront[0] - lowFront[0]);
      const y = lowRear[1] + t * (highRear[1] - lowRear[1]) + 0.02;
      beam(
        out,
        'roof',
        [xRear, y, -27.04 - t * 2.3],
        [xFront, y, 27.12 - t * 1.5],
        0.026,
        0.026,
        colors.roof,
      );
    }
  }
}

function sanctuary(out, level) {
  const foundationZ = [-27.3, 22.4];
  box(out, 'wall', [-7.04, 0.63, foundationZ[0]], [7.04, 3.51, foundationZ[1]], colors.siding);
  box(out, 'wall', [-5.22, 3.48, -28.2], [5.22, 7.58, 23.7], colors.siding);
  box(out, 'wall', [-7.12, 0.55, -27.4], [7.12, 0.83, 27.9], colors.timber, true);
  const centers =
    level === 0
      ? [-26, -10, 6, 22]
      : Array.from({ length: 12 }, (_, index) => -26.4 + 4.62 * index);
  for (const z of centers) {
    for (const x of level === 0 ? [-6.84, 6.84] : [-6.84, 0, 6.84]) {
      box(out, 'footing', [x - 0.2, -2.15, z - 0.21], [x + 0.2, 0.3, z + 0.21], colors.footing);
      box(out, 'wall', [x - 0.15, 0.18, z - 0.15], [x + 0.15, 0.68, z + 0.15], colors.timber);
    }
  }
  roof(
    out,
    { half: 5.73, eave: 7.62, ridge: naveRidge, front: 24.22, back: -34.25, hip: 6.3 },
    level,
  );
  gable(out, 0, 23.95, 5.45, 7.53, naveRidge - 0.2, colors.yellow, colors.zinc, 'metal');
  cross(out, 0, naveRidge - 0.03, 24.04, 0.59, colors.white);
  const fanCenter = [0, 8.9, 23.99];
  const divisions = level === 0 ? 5 : 9;
  for (let j = 0; j < divisions; j++) {
    const edge = (angle) => [Math.cos(angle) * 0.81, 8.9 + Math.sin(angle) * 0.81, 23.99];
    tri(
      out,
      'metal',
      fanCenter,
      edge((Math.PI * j) / divisions + 0.036),
      edge((Math.PI * (j + 1)) / divisions - 0.036),
      colors.white,
    );
  }
  for (const side of [-1, 1]) {
    aisleRoof(out, side, level);
    const f = facade([side * 7.04, 0], [0, -side]);
    const clerestory = facade([side * 5.22, 0], [0, -side]);
    const indices =
      level === 0 ? [-20, -9, 2, 13] : [-22, -17.3, -12.6, -7.9, -3.2, 1.5, 6.2, 10.9, 15.6, 20.3];
    for (const u of indices) {
      if (level < 2) {
        quad4(
          out,
          'glass',
          f.P(u - 0.77, 1.3, 0.025),
          f.P(u + 0.77, 1.3, 0.025),
          f.P(u + 0.77, 3.03, 0.025),
          f.P(u - 0.77, 3.03, 0.025),
          colors.glass,
        );
        if (level === 1) {
          quad4(
            out,
            'glass',
            clerestory.P(u - 0.53, 5.48, 0.025),
            clerestory.P(u + 0.53, 5.48, 0.025),
            clerestory.P(u + 0.53, 6.9, 0.025),
            clerestory.P(u - 0.53, 6.9, 0.025),
            colors.dark,
          );
        }
        continue;
      }
      opening(out, f, u, 1.3, 1.54, 1.73, {
        glassSlot: 'glass',
        frameSlot: 'trim',
        frame: colors.timber,
        glass: colors.glass,
        frameWidth: 0.14,
        mullions: 2,
      });
      opening(out, clerestory, u, 5.48, 1.05, 1.42, {
        glassSlot: 'glass',
        frameSlot: 'trim',
        frame: colors.zinc,
        glass: colors.dark,
        frameWidth: 0.1,
        mullions: 1,
      });
      fbox(out, 'trim', f, u + 1.33, u + 1.48, 0.78, 3.53, -0.02, 0.1, colors.timber);
    }
  }
}

function frontScreen(out, side, level) {
  const f = facade([0, 23.87], [1, 0]);
  const inner = 2.75,
    outer = 6.71;
  const [left, right] = side < 0 ? [-outer, -inner] : [inner, outer];
  const envelope = (x) => 6.87 - Math.abs(x) * 0.46;
  const low = 0.89;
  quad4(
    out,
    'glass',
    f.P(left, low),
    f.P(right, low),
    f.P(right, envelope(right)),
    f.P(left, envelope(left)),
    colors.glass,
  );
  for (const x of [left, right]) {
    beam(out, 'trim', f.P(x, low, 0.06), f.P(x, envelope(x), 0.06), 0.15, 0.1, colors.white);
  }
  beam(
    out,
    'trim',
    f.P(left, envelope(left), 0.06),
    f.P(right, envelope(right), 0.06),
    0.13,
    0.11,
    colors.white,
  );
  if (level === 0) return;
  const step = [0, 0.73, 0.43, 0.33][level];
  for (let u = left + step; u < right - 0.14; u += step) {
    beam(out, 'metal', f.P(u, low, 0.06), f.P(u, envelope(u), 0.06), 0.039, 0.046, colors.white);
  }
  for (let y = low; y < Math.max(envelope(left), envelope(right)); y += step) {
    const u = Math.min(outer, (6.87 - y) / 0.46);
    if (u - inner < 0.12) continue;
    beam(
      out,
      'metal',
      f.P(side * inner, y, 0.058),
      f.P(side * u, y, 0.058),
      0.042,
      0.045,
      colors.white,
    );
  }
  if (level < 2) return;
  for (const [u, y] of [
    [3.48, 2.31],
    [4.68, 1.62],
    [4.65, 3.08],
    [5.84, 2.3],
  ]) {
    const points = [
      [u - 0.16, y],
      [u, y - 0.17],
      [u + 0.16, y],
      [u, y + 0.17],
    ];
    for (let j = 0; j < points.length; j++) {
      const [a, b] = points[j],
        [c, d] = points[(j + 1) % points.length];
      beam(
        out,
        'metal',
        f.P(side * a, b, 0.087),
        f.P(side * c, d, 0.087),
        0.044,
        0.041,
        colors.white,
      );
    }
  }
}

function carving(out, level) {
  const z = porchFront - 0.18;
  const width = 6.13;
  gable(out, 0, z, width, porchEave, porchRidge - 0.12, colors.carvedShadow, colors.gold);
  const base = porchEave + 0.07;
  beam(out, 'trim', [-width, base, z + 0.06], [width, base, z + 0.06], 0.15, 0.12, colors.gold);
  const crest = (x) => base + (porchRidge - base - 0.36) * (1 - Math.abs(x) / width);
  if (level < 2) {
    tri(
      out,
      'trim',
      [-5.57, base + 0.1, z + 0.015],
      [5.57, base + 0.1, z + 0.015],
      [0, porchRidge - 0.55, z + 0.015],
      colors.gold,
    );
    return;
  }
  const scrolls = [
    [-4.35, 0.6, 0.44],
    [-3.13, 0.85, 0.69],
    [-1.49, 0.88, 0.72],
    [0, 0.63, 0.51],
    [1.49, 0.88, 0.72],
    [3.13, 0.85, 0.69],
    [4.35, 0.6, 0.44],
    [-1.05, 2.03, 0.42],
    [1.05, 2.03, 0.42],
    [0, 3.03, 0.27],
  ];
  const segments = [0, 11, 18, 24][level];
  for (const [x, h, radius] of scrolls) {
    const hand = x < 0 ? -1 : 1;
    const point = (t) => {
      const r = radius * (0.16 + 0.84 * t),
        angle = hand * Math.PI * 3.45 * t;
      const u = x + r * Math.cos(angle);
      return [u, Math.min(crest(u), base + h + r * Math.sin(angle)), z + 0.052];
    };
    for (let i = 1; i <= segments; i++) {
      beam(out, 'trim', point((i - 1) / segments), point(i / segments), 0.065, 0.06, colors.gold);
    }
  }
}

function porch(out, level) {
  frontScreen(out, -1, level);
  frontScreen(out, 1, level);
  const front = facade([0, 23.92], [1, 0]);
  panelEntrance(out, front, level);
  roof(
    out,
    { half: porchHalfWidth, eave: porchEave, ridge: porchRidge, front: porchFront, back: 22.9 },
    level,
  );
  carving(out, level);
  cross(out, 0, porchRidge - 0.03, porchFront - 0.1, 1.52, colors.timber);
  for (const x of [-3.38, 3.38]) {
    box(out, 'wall', [x - 0.18, -0.5, 28.8], [x + 0.18, porchEave, 29.15], colors.timber);
    if (level > 1) {
      beam(out, 'trim', [x, 4.83, 28.97], [x * 0.73, 6.08, 28.97], 0.14, 0.15, colors.timber);
    }
  }
  for (let j = 0; j < 5; j++) {
    const y = 0.14 + j * 0.15;
    box(out, 'wall', [-2.72, -0.29, 27.77], [2.72, y, 30.51 - 0.44 * j], colors.timber);
  }
  if (level > 1) {
    for (let j = 0; j < 5; j++) {
      const x = 1.09 * j;
      const y = porchRidge - ((porchRidge - porchEave) * x) / porchHalfWidth - 0.22;
      for (const side of j === 0 ? [1] : [-1, 1]) {
        beam(out, 'trim', [side * x, y, 23.55], [side * x, y, 29.43], 0.084, 0.115, colors.timber);
      }
    }
  }
}

function panelEntrance(out, front, level) {
  fbox(out, 'glass', front, -2.63, 2.63, 0.83, 5.72, -0.28, -0.055, colors.dark);
  for (const h of [3.83, 5.39]) {
    fbox(out, 'trim', front, -2.73, 2.73, h, h + 0.15, -0.07, 0.09, colors.white);
  }
  if (level > 1) {
    for (const u of [-2.6, -1.38, 1.38, 2.6]) {
      fbox(out, 'trim', front, u - 0.065, u + 0.065, 0.82, 5.41, -0.1, 0.1, colors.timber);
    }
  }
}

function bellTower(out, level) {
  const [x, z] = plan.dimensions.bellTowerLocalCenter;
  const half = 1.67;
  const roofY = 7.3,
    ridge = plan.dimensions.bellTowerRidgeM;
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const u = x + side * half,
        v = z + end * half;
      box(out, 'wall', [u - 0.14, -0.52, v - 0.14], [u + 0.14, roofY, v + 0.14], colors.timber);
    }
  }
  for (const y of [0.48, 2.54, 4.72, 6.82]) {
    box(out, 'wall', [x - 1.95, y - 0.18, z - 1.95], [x + 1.95, y, z + 1.95], colors.timber, true);
    if (y >= 6) continue;
    for (const edge of [-1, 1]) {
      const v = z + edge * 1.82,
        u = x + edge * 1.82;
      beam(out, 'trim', [x - 1.82, y + 0.72, v], [x + 1.82, y + 0.72, v], 0.1, 0.11, colors.white);
      beam(out, 'trim', [u, y + 0.72, z - 1.82], [u, y + 0.72, z + 1.82], 0.1, 0.11, colors.white);
      const count = [1, 6, 9, 12][level];
      for (let j = 1; j < count; j++) {
        const d = -1.64 + (3.28 * j) / count;
        beam(out, 'trim', [x + d, y, v], [x + d, y + 0.69, v], 0.055, 0.06, colors.white);
        beam(out, 'trim', [u, y, z + d], [u, y + 0.69, z + d], 0.055, 0.06, colors.white);
      }
    }
  }
  box(out, 'metal', [x - 0.29, 6.38, z - 0.24], [x + 0.29, 6.74, z + 0.24], colors.brass);
  roof(
    out,
    {
      x,
      half: 2.3,
      eave: roofY,
      ridge,
      front: z + 2.13,
      back: z - 2.13,
      slot: 'metal',
      tint: colors.zinc,
    },
    level,
  );
  gable(out, x, z + 1.75, 1.78, roofY - 0.02, ridge - 0.42, colors.timber, colors.zinc, 'metal');
}

function build(out, level) {
  sanctuary(out, level);
  porch(out, level);
  bellTower(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'st-michael-s-church-songyae-model.mjs';
const camera = [-47, 28, 57];
const lookAt = [-2.2, 5.0, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: "St Michael's Church, Songyae",
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Long Thai timber church with a gold-carved porch, tiered shingle roof and a detached bell tower.',
  camera,
  lookAt,
  sunDirection: [-44, 57, 64],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.83,
    basis:
      'The named timber church roof envelope. The detached bell tower is retained outside the cutout.',
  },
  embeddedCanonicalGraphs: ['wood_plain', 'concrete_panel', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'gold-gable-and-open-bell-tower', position: [-12, 4.2, 58], lookAt: [-4.7, 6.4, 24] },
    {
      name: 'church-shingle-roof-and-timber-footings',
      position: [36, 16, -30],
      lookAt: [0, 5.0, -7],
    },
    { name: 'porch-stairs-and-leaded-glass', position: [10, 3.0, 46], lookAt: [0, 4.2, 27] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'st-michael-s-church-songyae-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.3, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.046, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and Mapzen elevation under source attribution terms.',
};
