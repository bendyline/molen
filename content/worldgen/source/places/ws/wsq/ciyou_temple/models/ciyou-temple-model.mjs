import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor } = plan.dimensions;
const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.93 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  glaze: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.81 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.86 },
  dark: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const rock = rgb('858880');
const pale = rgb('afa89a');
const plaster = rgb('bf876a');
const red = rgb('ad463d');
const darkRed = rgb('794038');
const orange = rgb('cd8341');
const underside = rgb('8d5030');
const gold = rgb('e1ba6c');
const cyan = rgb('60a39a');
const green = rgb('587863');
const white = rgb('c6cfab');
const doorColor = rgb('392b29');
const fascia = [cyan, gold, green, white];
const lerp = (a, b, t) => a + (b - a) * t;

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function post(out, x, z, base, top, radius, lod) {
  const sides = lod < 2 ? 6 : 10;
  const ring = (y, r) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i * 2 * Math.PI) / sides;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    });
  loft(out, 'timber', [ring(base, radius), ring(top, radius * 0.88)], red);
  if (lod > 0) {
    loft(out, 'stone', [ring(base, radius * 1.25), ring(base + 0.34, radius * 1.14)], rock);
    box(
      out,
      'glaze',
      x - radius - 0.13,
      x + radius + 0.13,
      z - radius - 0.15,
      z + radius + 0.15,
      top - 0.26,
      top + 0.13,
      gold,
    );
  }
}

function hallWall(out, { x, z, width, depth, y0, eave }, lod) {
  const half = width / 2;
  const back = z - depth / 2,
    face = z + depth / 2;
  box(out, 'wall', x - half, x + half, back, face - 0.53, y0, eave, plaster);
  box(out, 'timber', x - half, x + half, face - 0.4, face + 0.06, eave - 0.58, eave, darkRed);
  const count = lod === 0 ? 0 : width > 18 ? 7 : width > 9 ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const column = x - half + ((i + 0.5) * width) / count;
    box(
      out,
      'dark',
      column - (width / count) * 0.33,
      column + (width / count) * 0.33,
      face - 0.51,
      face - 0.34,
      y0 + 0.64,
      eave - 1.15,
      doorColor,
    );
    if (lod > 1) {
      box(
        out,
        'timber',
        column - 0.062,
        column + 0.062,
        face - 0.39,
        face - 0.26,
        y0 + 0.64,
        eave - 1.22,
        red,
      );
      box(
        out,
        'glaze',
        column - (width / count) * 0.22,
        column + (width / count) * 0.22,
        face - 0.4,
        face - 0.25,
        eave - 1.01,
        eave - 0.77,
        cyan,
      );
    }
  }
}

function ridgeFigures(out, x, z, half, peak, scale, lod, spectacular) {
  if (lod === 0 || (lod === 1 && !spectacular)) return;
  const stem = 0.105 * scale;
  const figures = spectacular ? [-0.33, 0, 0.33] : [0];
  for (const factor of figures) {
    const u = x + factor * half;
    box(
      out,
      'glaze',
      u - stem,
      u + stem,
      z - stem,
      z + stem,
      peak - 0.08,
      peak + scale * (factor === 0 ? 0.9 : 0.66),
      gold,
    );
    if (lod > 1) {
      const top = peak + scale * (factor === 0 ? 0.9 : 0.66);
      box(
        out,
        'glaze',
        u - stem * 0.76,
        u + stem * 0.76,
        z - stem * 0.65,
        z + stem * 0.65,
        top - 0.09,
        top + scale * 0.16,
        white,
      );
    }
  }
  for (const s of [-1, 1]) {
    const shape = [
      [0.92, 0.48],
      [0.82, 0.98],
      [0.72, 0.79],
      [0.66, 0.34],
      [0.54, 0.49],
      [0.46, 0.93],
      [0.36, 0.72],
    ];
    const at = ([u, y]) => [
      x + s * u * half,
      peak + y * scale,
      z + 0.15 + (u - 0.5) * 0.45 * scale,
    ];
    for (let i = 0; i < shape.length - 1; i++) {
      if (lod === 0 && i > 1) break;
      beam(
        out,
        'glaze',
        at(shape[i]),
        at(shape[i + 1]),
        scale * (0.14 + i * 0.013),
        scale * 0.14,
        fascia[(i + 2) % 4],
      );
    }
    const a = at(shape.at(-1));
    if (lod > 1) {
      beam(
        out,
        'glaze',
        a,
        [a[0] - s * scale * 0.24, a[1] + 0.17 * scale, a[2]],
        scale * 0.18,
        scale * 0.16,
        gold,
      );
      beam(
        out,
        'glaze',
        [a[0], a[1] - 0.06, a[2]],
        [a[0] + s * 0.32 * scale, a[1] - scale * 0.37, a[2] + 0.1],
        scale * 0.08,
        scale * 0.09,
        cyan,
      );
    }
  }
}

function sweptRoof(out, { x, z, width, depth, eave, rise, lift, ornaments = false }, lod) {
  const count = [2, 4, 10, 14][lod],
    half = width / 2,
    sideDepth = depth / 2;
  const point = (s, j, t) => {
    const u = (j / count) * 2 - 1,
      tip = Math.pow(Math.abs(u), 4);
    return [
      x + u * half * lerp(1, 0.82, t),
      eave + rise * Math.pow(t, 1.36) + lift * tip * lerp(1, 0.72, t),
      z + s * sideDepth * (1 - t),
    ];
  };
  for (const s of [-1, 1]) {
    for (let j = 0; j < count; j++) {
      const a = point(s, j, 0),
        b = point(s, j + 1, 0);
      const steps = lod === 0 ? [0, 1] : [0, 0.47, 1];
      for (let k = 0; k < steps.length - 1; k++) {
        const t = steps[k],
          u = steps[k + 1];
        const p = point(s, j, t),
          q = point(s, j + 1, t),
          r = point(s, j + 1, u),
          w = point(s, j, u);
        if (s > 0) quad4(out, 'roof', p, q, r, w, orange);
        else quad4(out, 'roof', q, p, w, r, orange);
      }
      if (lod > 1) {
        beam(out, 'roof', a, b, 0.14, 0.18, underside);
        if (lod > 1 && j % 2 === 0) {
          const t = point(s, j, 0.56),
            r = point(s, j, 0.98);
          beam(out, 'roof', a, t, 0.086, 0.077, gold);
          beam(out, 'roof', t, r, 0.086, 0.077, gold);
        }
      }
    }
  }
  const sections = lod === 0 ? [0, 1] : [0, 0.47, 1];
  for (const j of [0, count])
    for (const direction of [-1, 1]) {
      for (let k = 0; k < sections.length - 1; k++) {
        const p = point(direction, j, sections[k]),
          q = point(direction, j, sections[k + 1]);
        const bottom = ([x, , z]) => [x, eave - 0.21, z];
        if ((j === 0) === (direction === 1))
          quad4(out, 'timber', p, q, bottom(q), bottom(p), darkRed);
        else quad4(out, 'timber', q, p, bottom(p), bottom(q), darkRed);
      }
    }
  if (lod > 1)
    for (let j = 0; j < count; j++) {
      const a = point(1, j, 1),
        b = point(1, j + 1, 1);
      beam(out, 'glaze', a, b, 0.19, 0.24, cyan);
      if (lod > 1 && j % 2 === 0)
        box(
          out,
          'glaze',
          a[0] - 0.081,
          a[0] + 0.081,
          z - 0.09,
          z + 0.09,
          a[1] + 0.09,
          a[1] + 0.34,
          fascia[j % 4],
        );
    }
  const scale = Math.min(1.1, width / 11);
  if (ornaments) ridgeFigures(out, x, z, half * 0.82, eave + rise, scale, lod, width > 13);
}

function paintedBand(out, x, z, span, y, lod) {
  if (lod === 0) return;
  const F = facade([x, z], [1, 0]);
  fbox(out, 'timber', F, -span / 2, span / 2, y - 0.45, y, -0.16, 0.12, red);
  const n = Math.round(span / (lod === 1 ? 2.6 : 1.12));
  for (let i = 0; i < n; i++) {
    const u = span * ((i + 0.5) / n - 0.5);
    fbox(out, 'glaze', F, u - 0.23, u + 0.23, y - 0.32, y - 0.07, 0.12, 0.16, fascia[i % 4]);
    if (lod === 3) fbox(out, 'glaze', F, u - 0.07, u + 0.07, y - 0.31, y - 0.06, 0.15, 0.185, gold);
  }
}
function stack(out, x, z, tiers, lod) {
  for (const [width, depth, y0, eave, rise, lift] of tiers) {
    hallWall(out, { x, z, width: width - 1.22, depth: depth - 1.1, y0, eave }, lod);
    paintedBand(out, x, z + depth * 0.5 - 0.53, width - 1.05, eave - 0.12, lod);
    sweptRoof(out, { x, z, width, depth, eave, rise, lift, ornaments: true }, lod);
  }
}

function approach(out, lod) {
  const start = 20.89,
    back = 16.26,
    front = 23.53;
  box(out, 'stone', -14.83, 14.38, 16.21, front, -0.75, 1.63, rock);
  for (let i = 0; i < 4; i++)
    box(out, 'stone', -8.16, 8.17, start, 25.58 - i * 0.48, -0.52, 0.27 + i * 0.4, pale);
  box(out, 'dark', -10.75, 10.59, back, 18.36, 1.63, 6.35, doorColor);
  box(out, 'wall', -14.95, -10.67, back, 23.29, 1.63, 6.35, plaster);
  box(out, 'wall', 10.59, 14.38, back, 23.27, 1.63, 6.35, plaster);
  box(out, 'timber', -10.75, 10.55, 22.52, 23.15, 5.72, 6.53, red);
  for (const x of [-10.52, -6.3, -2.11, 2.03, 6.2, 10.42])
    post(out, x, 22.76, 1.62, 6.13, 0.29, lod);
  for (const u of [-8.53, -4.22, 0, 4.19, 8.44])
    box(out, 'timber', u - 0.67, u + 0.67, 21.07, 21.26, 4.31, 5.53, darkRed);
  paintedBand(out, -0.1, 23.09, 20.9, 6.43, lod);
  sweptRoof(
    out,
    {
      x: -0.1,
      z: 20.35,
      width: 23.56,
      depth: 8.28,
      eave: 6.63,
      rise: 2.14,
      lift: 1.05,
      ornaments: true,
    },
    lod,
  );
  const sign = facade([-0.09, 22.91], [1, 0]);
  fbox(out, 'timber', sign, -2.06, 2.06, 5.24, 6.23, 0.19, 0.26, darkRed);
}

function build(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor + 0.01, rock, { top: false });
  approach(out, lod);
  stack(
    out,
    -11.03,
    15.53,
    [
      [8.29, 11.2, 1.63, 8.41, 2.0, 1.12],
      [6.87, 7.46, 9.48, 12.95, 1.98, 1.16],
    ],
    lod,
  );
  stack(
    out,
    10.52,
    15.51,
    [
      [8.19, 11.3, 1.63, 8.41, 2.0, 1.12],
      [6.72, 7.23, 9.48, 12.95, 1.98, 1.13],
    ],
    lod,
  );
  stack(
    out,
    -0.33,
    5.13,
    [
      [28.83, 19.2, floor, 11.64, 2.78, 1.46],
      [23.65, 12.7, 12.8, 16.32, 2.65, 1.3],
      [18.11, 7.62, 17.42, 20.3, 2.55, 1.07],
    ],
    lod,
  );
  stack(
    out,
    -0.41,
    -21.94,
    [
      [29.43, 26.89, floor, 13.84, 2.55, 1.19],
      [24.1, 18.41, 15.17, 19.83, 2.74, 1.34],
      [18.55, 12.22, 21.09, 24.76, 2.46, 1.11],
    ],
    lod,
  );
  box(out, 'wall', -13.99, -10.62, -12.21, -4.38, floor, 9.57, plaster);
  box(out, 'wall', 10.27, 13.84, -12.21, -4.38, floor, 9.57, plaster);
  box(out, 'roof', -13.99, -10.59, -12.28, -4.27, 9.51, 9.72, orange);
  box(out, 'roof', 10.23, 13.85, -12.28, -4.27, 9.51, 9.72, orange);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ciyou-temple-model.mjs';
const camera = [-57, 24, 76];
const lookAt = [0, 10, 4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Songshan Ciyou Temple with five gates, stacked swept roofs, bell and drum pavilions, red columns and ceramic ridge ornaments.',
  camera,
  lookAt,
  sunDirection: [-28, 48, 28],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The mapped perimeter of the connected temple building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'bade-road-gates-and-roof-tiers', position: camera, lookAt },
    { name: 'five-gates-and-ceramic-ridges', position: [-26, 10.5, 57], lookAt: [0, 9, 18] },
    { name: 'successive-halls-and-rear-roof', position: [52, 35, -62], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ciyou-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
