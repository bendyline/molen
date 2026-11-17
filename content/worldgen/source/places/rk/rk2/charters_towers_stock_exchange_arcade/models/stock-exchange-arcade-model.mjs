/** Royal Arcade in Charters Towers. The central passage is open below both vaults. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const { left, right, front, rear, insideHalfWidth: passage, shopEave, vaultRise } = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.86 },
  roof: {
    slot: 'roof',
    graph: 'metal_corrugated',
    roughness: 0.69,
    metallic: 0.13,
    doubleSided: true,
  },
  floor: { slot: 'foundation', graph: 'stone_checker_fine', roughness: 0.76 },
  painted: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.71 },
  canopy: {
    slot: 'window',
    localRef: 'palette:#abc5cd',
    roughness: 0.39,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.4],
    doubleSided: true,
  },
};
const color = Object.fromEntries(
  Object.entries({
    wall: 'dcc9a3',
    pale: 'e5d4b0',
    trim: 'c9b593',
    brick: 'ad8b6e',
    plinth: '77766e',
    zinc: 'aeb0a7',
    darkZinc: '7e8681',
    timber: '485346',
    painted: '435c4c',
    inset: '344646',
    teal: '5b8c80',
    rose: 'ac745b',
    amber: 'c3a275',
    floor: 'aa937d',
    darkTile: '786760',
    path: 'c3b39b',
    glass: 'e3f0ef',
  }).map(([k, v]) => [k, rgb(v)]),
);
const base = -1.78;
const ground = 0.18;
const lerp = (a, b, t) => a + (b - a) * t;
const solid = (out, mat, x0, x1, y0, y1, z0, z1, c) =>
  box(out, mat, [x0, y0, z0], [x1, y1, z1], color[c]);

function cornice(out, x0, x1, y, z, tone = 'trim') {
  solid(out, 'trim', x0, x1, y, y + 0.16, z - 0.16, z + 0.29, tone);
}

function bowPoint(x, span, level, rise, u, z) {
  const a = Math.PI * u;
  return [x + span * Math.cos(a), level + rise * Math.sin(a), z];
}

function vault(out, { x = 0, span, level, rise, near, far, segments, mat, tone }) {
  for (let ring = 0; ring < segments; ring++) {
    const a = ring / segments,
      b = (ring + 1) / segments;
    const p = (u, z) => bowPoint(x, span, level, rise, u, z);
    face(out, mat, [p(b, far), p(b, near), p(a, near), p(a, far)], color[tone]);
  }
}

function trimArc(out, z, width, spring, rise, segments, weight, tone) {
  const p = (u, s = 0) => bowPoint(0, width + s, spring, rise + s, u, z);
  for (let i = 0; i < segments; i++) {
    const a = i / segments,
      b = (i + 1) / segments;
    face(out, 'painted', [p(a), p(a, weight), p(b, weight), p(b)], color[tone]);
  }
}

function glazedFan(out, z, span, y, rise, lod) {
  const sections = lod >= 2 ? 12 : 6;
  for (let i = 0; i < sections; i++) {
    const a = i / sections,
      b = (i + 1) / sections;
    const p = (u) => bowPoint(0, span, y, rise, u, z);
    const tint = ['teal', 'amber', 'teal', 'rose'][i % 4];
    triangle(out, 'painted', [[0, y, z], p(a), p(b)], color[tint]);
    if (lod >= 2) beam(out, 'painted', [0, y, z + 0.02], p(a), 0.039, 0.055, color.painted);
  }
  trimArc(out, z + 0.075, span, y, rise, sections, 0.145, 'painted');
  if (lod >= 2) {
    for (const scale of [0.36, 0.68])
      trimArc(out, z + 0.056, span * scale, y, rise * scale, sections, 0.025, 'trim');
    if (lod === 3) solid(out, 'painted', -0.36, 0.36, y - 0.22, y + 0.13, z, z + 0.12, 'painted');
  }
}

function displayWindow(out, x, bottom, top, z, width, lod) {
  const h = width / 2;
  solid(out, 'painted', x - h, x + h, bottom, top, z, z + 0.056, 'timber');
  solid(
    out,
    'painted',
    x - h + 0.106,
    x + h - 0.106,
    bottom + 0.09,
    top - 0.105,
    z + 0.055,
    z + 0.087,
    'inset',
  );
  if (lod > 0) {
    const transom = top - 0.35;
    solid(
      out,
      'painted',
      x - h + 0.115,
      x + h - 0.115,
      transom,
      top - 0.112,
      z + 0.085,
      z + 0.12,
      'teal',
    );
    solid(
      out,
      'trim',
      x - h - 0.085,
      x + h + 0.085,
      bottom - 0.114,
      bottom + 0.04,
      z - 0.02,
      z + 0.176,
      'trim',
    );
    if (lod >= 2) {
      solid(
        out,
        'painted',
        x - 0.044,
        x + 0.044,
        bottom + 0.07,
        top - 0.091,
        z + 0.089,
        z + 0.13,
        'timber',
      );
      solid(
        out,
        'painted',
        x - h + 0.075,
        x + h - 0.075,
        transom - 0.038,
        transom + 0.04,
        z + 0.108,
        z + 0.143,
        'painted',
      );
      if (lod === 3) {
        for (const side of [-1, 1]) {
          const t = x + side * (h * 0.68);
          solid(
            out,
            'painted',
            t - 0.062,
            t + 0.062,
            transom + 0.052,
            top - 0.123,
            z + 0.121,
            z + 0.142,
            'amber',
          );
        }
      }
    }
  }
}

function pilaster(out, x, z, y0, y1, width) {
  const w = width / 2;
  solid(out, 'trim', x - w, x + w, y0, y1, z - 0.07, z + 0.24, 'trim');
  solid(out, 'trim', x - w - 0.095, x + w + 0.095, y0, y0 + 0.46, z - 0.08, z + 0.31, 'pale');
  solid(out, 'trim', x - w - 0.08, x + w + 0.08, y1 - 0.36, y1, z - 0.073, z + 0.31, 'pale');
}

function parapet(out, x0, x1, h, lod) {
  solid(out, 'trim', x0, x1, h, h + 0.21, front - 0.31, front + 0.14, 'trim');
  if (lod === 0) {
    solid(out, 'wall', x0, x1, h + 0.16, h + 0.61, front - 0.23, front + 0.04, 'pale');
    return;
  }
  solid(out, 'trim', x0, x1, h + 0.63, h + 0.78, front - 0.28, front + 0.11, 'pale');
  const n = Math.ceil((x1 - x0) / 0.55);
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0 + 0.16, x1 - 0.16, i / n);
    solid(out, 'trim', x - 0.077, x + 0.077, h + 0.2, h + 0.66, front - 0.18, front + 0.09, 'trim');
  }
}

function frontFacade(out, lod) {
  const yRoof = 8.2;
  const canopyEnd = front + 3.16;
  const half = 3.17,
    hoodY = 4.69,
    hoodRise = 2.88;
  solid(out, 'wall', -passage, passage, 3.97, hoodY + hoodRise + 0.24, front - 4.5, front, 'pale');
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? left : passage,
      x1 = side < 0 ? -passage : right;
    solid(out, 'wall', x0, x1, base, yRoof, front - 4.1, front, 'wall');
    solid(out, 'trim', x0, x1, base, 0.38, front - 0.2, front + 0.09, 'plinth');
    cornice(out, x0, x1, 3.77, front);
    cornice(out, x0, x1, 7.82, front, 'pale');
    parapet(out, x0, x1, 8.2, lod);
    if (lod > 0) {
      const middle = (x0 + x1) / 2;
      for (const x of [middle - 1.55, middle + 1.52])
        displayWindow(out, x, 4.86, 7.12, front, 1.08, lod);
      for (const x of [middle - 1.53, middle + 1.53])
        displayWindow(out, x, 0.58, 3.55, front, 2.72, lod);
      for (const x of [x0 + 0.28, x1 - 0.27]) pilaster(out, x, front, 3.94, 7.79, 0.42);
    }
    const a = side < 0 ? left - 0.12 : half,
      b = side < 0 ? -half : right + 0.12;
    face(
      out,
      'roof',
      [
        [a, 4.02, canopyEnd],
        [b, 4.02, canopyEnd],
        [b, 4.57, front],
        [a, 4.57, front],
      ],
      color.zinc,
    );
    solid(out, 'painted', a, b, 3.92, 4.04, canopyEnd - 0.062, canopyEnd + 0.055, 'painted');
  }
  solid(out, 'wall', -3.32, 3.32, 7.56, 8.18, front - 0.23, front + 0.13, 'pale');
  parapet(out, -3.27, 3.27, 8.38, lod);
  for (const x of [left + 0.32, -passage, passage, right - 0.31]) {
    solid(
      out,
      'painted',
      x - 0.105,
      x + 0.105,
      base,
      Math.abs(x) === passage ? hoodY + 0.035 : 4.035,
      canopyEnd - 0.18,
      canopyEnd + 0.03,
      lod ? 'timber' : 'trim',
    );
    if (lod >= 2) {
      solid(
        out,
        'painted',
        x - 0.17,
        x + 0.17,
        0.15,
        0.38,
        canopyEnd - 0.231,
        canopyEnd + 0.075,
        'painted',
      );
      solid(
        out,
        'painted',
        x - 0.18,
        x + 0.18,
        3.35,
        3.57,
        canopyEnd - 0.235,
        canopyEnd + 0.086,
        'painted',
      );
    }
  }
  vault(out, {
    span: half,
    level: hoodY,
    rise: hoodRise,
    near: canopyEnd,
    far: front - 0.08,
    segments: lod >= 2 ? 16 : 8,
    mat: 'roof',
    tone: 'zinc',
  });
  solid(out, 'wall', -half, half, 3.59, hoodY, canopyEnd - 0.22, canopyEnd + 0.02, 'trim');
  glazedFan(out, canopyEnd + 0.04, half - 0.16, hoodY, hoodRise - 0.12, lod);
  if (lod >= 2) {
    for (const x of [left + 0.4, -passage + 0.08, passage - 0.08, right - 0.32]) {
      beam(
        out,
        'painted',
        [x, 3.05, canopyEnd - 0.085],
        [x + (x < 0 ? 0.54 : -0.54), 3.92, canopyEnd - 0.085],
        0.085,
        0.11,
        color.painted,
      );
    }
  }
}

function shops(out, lod) {
  const z0 = rear,
    z1 = front - 2.6;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? left : passage,
      x1 = side < 0 ? -passage : right;
    solid(out, 'wall', x0, x1, base, shopEave, z0, z1, 'wall');
    solid(out, 'trim', x0, x1, base, 0.34, z0 - 0.037, z1, 'plinth');
    const mid = (x0 + x1) / 2;
    const e = shopEave,
      r = shopEave + 1.28;
    face(
      out,
      'roof',
      [
        [x0 - 0.12, e, z1],
        [mid, r, z1],
        [mid, r, z0 - 0.14],
        [x0 - 0.12, e, z0 - 0.14],
      ],
      color.darkZinc,
    );
    face(
      out,
      'roof',
      [
        [mid, r, z1],
        [x1 + 0.11, e, z1],
        [x1 + 0.11, e, z0 - 0.14],
        [mid, r, z0 - 0.14],
      ],
      color.zinc,
    );
    triangle(
      out,
      'wall',
      [
        [x1, e, z0],
        [x0, e, z0],
        [mid, r, z0],
      ],
      color.wall,
    );
    if (lod > 0) {
      const facing = transform(out, side < 0 ? Math.PI / 2 : -Math.PI / 2, [side * passage, 0, 0]);
      const n = 6;
      const length = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const z = z0 + (i + 0.57) * length;
        const horizontal = side * z;
        displayWindow(facing, horizontal, 0.52, 3.69, 0, Math.min(3.6, length - 0.99), lod);
        if (lod >= 2) {
          displayWindow(facing, horizontal, 4.83, 6.96, 0, 1.62, lod);
          pilaster(facing, side * (z0 + i * length), 0, ground, 7.54, 0.26);
        }
      }
    }
  }
  if (lod > 0) {
    solid(
      out,
      'roof',
      left + 0.3,
      -passage - 0.36,
      shopEave - 0.6,
      shopEave + 0.02,
      rear - 0.12,
      front - 3.9,
      'darkZinc',
    );
    solid(
      out,
      'roof',
      passage + 0.36,
      right - 0.3,
      shopEave - 0.6,
      shopEave + 0.02,
      rear - 0.12,
      front - 3.9,
      'darkZinc',
    );
  }
}

function passageFloor(out, lod) {
  solid(out, 'trim', -passage, passage, base, ground, rear, front + 1.03, 'path');
  solid(
    out,
    'floor',
    -passage + 0.18,
    passage - 0.18,
    ground,
    ground + 0.042,
    rear + 0.075,
    front + 0.7,
    'floor',
  );
  if (lod < 2) return;
  const z0 = rear + 0.27,
    z1 = front + 0.56;
  for (const side of [-1, 1]) {
    const x = side * (passage - 0.44);
    solid(out, 'trim', x - 0.095, x + 0.095, ground + 0.038, ground + 0.062, z0, z1, 'brick');
  }
  if (lod === 3) {
    for (let j = 0; j < 30; j++) {
      const z = lerp(z0 + 0.48, z1 - 0.3, j / 29);
      for (const x of [-1.54, 0, 1.54]) {
        face(
          out,
          'painted',
          [
            [x - 0.155, ground + 0.06, z],
            [x, ground + 0.06, z + 0.155],
            [x + 0.155, ground + 0.06, z],
            [x, ground + 0.06, z - 0.155],
          ],
          color.darkTile,
        );
      }
    }
  }
}

function mainVault(out, lod) {
  const start = rear + 0.12,
    end = front - 2.62;
  const segments = lod >= 2 ? 16 : 8;
  const spring = 7.28;
  vault(out, {
    span: passage,
    level: spring,
    rise: vaultRise,
    near: end,
    far: start,
    segments,
    mat: 'canopy',
    tone: 'glass',
  });
  for (const x of [-passage, passage])
    solid(out, 'painted', x - 0.1, x + 0.1, spring - 0.15, spring + 0.05, start, end, 'painted');
  const frameCount = lod === 0 ? 5 : lod === 1 ? 7 : 9;
  for (let i = 0; i < frameCount; i++) {
    const z = lerp(start, end, i / (frameCount - 1));
    const chord = (p, s = 0) => bowPoint(0, passage - s, spring - 0.03, vaultRise - s, p, z);
    for (let j = 0; j < segments; j++) {
      const a = j / segments,
        b = (j + 1) / segments;
      if (lod < 2) {
        const aa = chord(a),
          bb = chord(b);
        face(
          out,
          'painted',
          [
            [aa[0], aa[1], z - 0.043],
            [bb[0], bb[1], z - 0.043],
            [bb[0], bb[1], z + 0.043],
            [aa[0], aa[1], z + 0.043],
          ],
          color.painted,
        );
      } else {
        beam(out, 'painted', chord(a), chord(b), 0.075, 0.083, color.painted);
        beam(out, 'painted', chord(a, 0.32), chord(b, 0.32), 0.054, 0.068, color.painted);
        if (lod === 3) beam(out, 'painted', chord(a, 0.32), chord(b), 0.039, 0.046, color.painted);
      }
    }
  }
  if (lod >= 2) {
    for (const u of [0.13, 0.25, 0.375, 0.5, 0.625, 0.75, 0.87]) {
      const [x, y] = bowPoint(0, passage, spring, vaultRise, u, 0);
      solid(out, 'painted', x - 0.024, x + 0.024, y - 0.037, y + 0.028, start, end, 'painted');
    }
  }
}

function timberBridge(out, lod) {
  if (lod === 0) return;
  const z = front - 5.45;
  solid(out, 'painted', -passage, passage, 3.64, 3.84, z - 0.62, z + 0.62, 'timber');
  for (const side of [-1, 1]) {
    const edge = z + side * 0.58;
    solid(out, 'painted', -passage, passage, 4.79, 4.89, edge - 0.048, edge + 0.048, 'painted');
    const count = lod === 1 ? 6 : 15;
    for (let i = 0; i <= count; i++) {
      const x = lerp(-passage + 0.17, passage - 0.17, i / count);
      solid(
        out,
        'painted',
        x - 0.025,
        x + 0.025,
        3.83,
        4.82,
        edge - 0.038,
        edge + 0.038,
        'painted',
      );
    }
  }
}

function build(out, lod) {
  shops(out, lod);
  passageFloor(out, lod);
  frontFacade(out, lod);
  mainVault(out, lod);
  timberBridge(out, lod);
}
export const stockExchangeArcadeSkyline = (out) => build(out, 0);
export const stockExchangeArcadeDistrict = (out) => build(out, 1);
export const stockExchangeArcadeStreet = (out) => build(out, 2);
export const stockExchangeArcadeCloseup = (out) => build(out, 3);
const recipe = 'stock-exchange-arcade-model.mjs';
const camera = [31, 19, 51],
  lookAt = [0, 4, 1];
export const stockExchangeArcadeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'commercial',
  build: stockExchangeArcadeCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    minimumCoverage: 0.86,
    basis: 'Exact mapped Stock Exchange Arcade shell only.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Charters Towers’ Royal Arcade with twin veranda wings, colored semicircular fanlight, tall glazed interior barrel vault and heritage shop fronts.',
  camera,
  lookAt,
  sunDirection: [81, 116, 125],
  portableGroundY: 0,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.78,
    cameraYaw: 0.3,
    focus: { center: [0, 4.2, 1] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'mosman-street-canopy-and-vault', position: camera, lookAt },
    { name: 'street-fanlight-and-parapet', position: [12, 4.3, 40], lookAt: [0, 4.4, 18] },
    {
      name: 'open-tiled-arcade-and-iron-trusses',
      position: [0.72, 2.32, 9.75],
      lookAt: [0, 4.9, -11],
    },
    { name: 'glass-vault-and-rear-opening', position: [14, 12, -35], lookAt: [0, 4.8, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'arcade-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'stockExchangeArcadeSkyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'stockExchangeArcadeDistrict', 0.58],
        ['street', 'stockExchangeArcadeStreet', 0.22],
        ['closeup', 'stockExchangeArcadeCloseup', 0.065],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by the public-domain John Oxley Library streetscape. OpenStreetMap geometry ODbL 1.0.',
  limitations: plan.limitations,
};
