/** Penglai Pavilion on Danya Hill, from the 1925 plate and the documented galleries. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const dim = plan.dimensions;
const surfaces = {
  masonry: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
};
const t = Object.fromEntries(
  Object.entries({
    stone: 'a9a29a',
    foundation: '81776c',
    slate: '626569',
    seam: '737576',
    ridge: '53565c',
    red: '984e40',
    darkRed: '703b32',
    screen: '654842',
    shadow: '51423c',
    wood: '927168',
    window: '534340',
    cream: 'c5b59e',
    edge: 'd2c8b5',
    gold: 'ba9564',
  }).map(([key, color]) => [key, rgb(color)]),
);
const mix = (a, b, u) => a + (b - a) * u;
const limits = (points) => {
  const x = points.map((p) => p[0]),
    z = points.map((p) => p[1]);
  return [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)];
};
const panels = (out, slot, x0, x1, y0, y1, z, tint) =>
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );

function roofCorner({ x, z, y, lift }, side, u) {
  const p = mix(-1, 1, u);
  const height = y + lift * Math.pow(Math.abs(p), 4);
  const corners = [
    [p * x, height, z],
    [x, height, -p * z],
    [-p * x, height, -z],
    [-x, height, p * z],
  ];
  return corners[side];
}

function tileRoof(out, levels, lod, gabled) {
  const n = [2, 4, 8, 12][lod];
  for (let layer = 0; layer < levels.length - 1; layer++) {
    const a = levels[layer],
      b = levels[layer + 1];
    for (let side = 0; side < 4; side++) {
      if (gabled && b.z === 0 && side % 2 === 1) {
        const i = side === 1 ? 1 : -1;
        const tip = [b.x * i, b.y + b.lift, 0];
        for (let j = 0; j < n; j++)
          triangle(
            out,
            'timber',
            [roofCorner(a, side, j / n), roofCorner(a, side, (j + 1) / n), tip],
            t.darkRed,
          );
        continue;
      }
      const at = (level, u) => roofCorner(level, side, u);
      for (let i = 0; i < n; i++) {
        const u = i / n,
          v = (i + 1) / n;
        const p = [at(a, u), at(a, v), at(b, v), at(b, u)];
        face(out, 'roof', p, t.slate);
      }
    }
  }
  const base = levels[0];
  for (let side = 0; side < 4; side++) {
    const n = lod > 1 ? 7 : 2;
    let edge = [];
    for (let i = 0; i <= n; i++) edge.push(roofCorner(base, side, i / n));
    for (let i = 0; i < n; i++) {
      const a = edge[i],
        b = edge[i + 1];
      face(
        out,
        'timber',
        [a.map((v, j) => (j === 1 ? v - 0.2 : v)), b.map((v, j) => (j === 1 ? v - 0.2 : v)), b, a],
        t.darkRed,
      );
    }
    if (lod > 1) beamPath(out, 'roof', edge, 0.105, 0.13, t.ridge);
  }
  const peak = levels.at(-1);
  if (gabled) {
    beamPath(
      out,
      'roof',
      [
        [-peak.x - 0.29, peak.y + 0.37, 0],
        [-peak.x + 0.84, peak.y + 0.11, 0],
        [peak.x - 0.84, peak.y + 0.11, 0],
        [peak.x + 0.29, peak.y + 0.37, 0],
      ],
      0.25,
      0.24,
      t.ridge,
    );
  }
  if (lod > 1)
    for (const side of [0, 2]) {
      for (let i = 1; i < (lod === 2 ? 11 : 19); i++) {
        const fraction = i / (lod === 2 ? 11 : 19);
        const path = levels.map((level) => {
          const p = roofCorner(level, side, fraction);
          return [p[0], p[1] + 0.022, p[2]];
        });
        beamPath(out, 'roof', path, 0.046, lod === 2 ? 0.054 : 0.072, t.seam);
      }
    }
}

function gridPositions(w, d) {
  const along = Array.from({ length: 5 }, (_, i) => mix(-w / 2, w / 2, i / 4));
  const sides = Array.from({ length: 3 }, (_, i) => mix(-d / 2, d / 2, (i + 1) / 4));
  return [
    ...along.flatMap((x) => [
      [x, -d / 2],
      [x, d / 2],
    ]),
    ...sides.flatMap((z) => [
      [-w / 2, z],
      [w / 2, z],
    ]),
  ];
}

function columns(out, w, d, base, eave, lod) {
  const size = lod ? 0.22 : 0.27;
  for (const [x, z] of gridPositions(w, d)) {
    const n = [4, 6, 8, 12][lod];
    loft(
      out,
      'timber',
      [
        radialRing(base, size, size, n, [x, z]),
        radialRing(eave - 0.23, size * 0.9, size * 0.9, n, [x, z]),
      ],
      t.red,
      { cap: false },
    );
    if (!lod) continue;
    box(
      out,
      'stone',
      [x - 0.26, base - 0.03, z - 0.26],
      [x + 0.26, base + 0.21, z + 0.26],
      t.stone,
    );
    box(
      out,
      'timber',
      [x - 0.32, eave - 0.52, z - 0.31],
      [x + 0.32, eave - 0.28, z + 0.31],
      t.darkRed,
    );
    if (lod > 1)
      box(
        out,
        'timber',
        [x - 0.46, eave - 0.3, z - 0.39],
        [x + 0.46, eave - 0.15, z + 0.39],
        t.red,
      );
  }
  for (const z of [-d / 2, d / 2])
    box(
      out,
      'timber',
      [-w / 2 - 0.12, eave - 0.29, z - 0.2],
      [w / 2 + 0.12, eave + 0.12, z + 0.2],
      t.darkRed,
    );
  for (const x of [-w / 2, w / 2])
    box(
      out,
      'timber',
      [x - 0.2, eave - 0.29, -d / 2 + 0.2],
      [x + 0.2, eave + 0.12, d / 2 - 0.2],
      t.darkRed,
    );
}

function handrail(out, a, b, y, lod, stone = false) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
  const slot = stone ? 'stone' : 'timber',
    tint = stone ? t.edge : t.darkRed;
  box(m, slot, [0, y + 0.86, -0.1], [d, y + 0.99, 0.1], tint);
  if (!lod) return;
  box(m, slot, [0, y + 0.2, -0.07], [d, y + 0.31, 0.07], tint);
  const n = Math.max(1, Math.floor(d / (stone ? (lod > 1 ? 2.3 : 3.6) : lod > 1 ? 1.1 : 2.6)));
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * d;
    box(m, slot, [x - 0.069, y + 0.15, -0.076], [x + 0.069, y + 1.08, 0.076], tint);
    if (lod > 1 && !stone && i < n) {
      const k = ((i + 0.5) * d) / n;
      box(m, slot, [k - 0.028, y + 0.31, -0.043], [k + 0.028, y + 0.86, 0.043], t.red);
    }
  }
}

function room(out, w, d, base, eave, lod, upper) {
  const innerX = w / 2 - (upper ? 1.37 : 1.35),
    innerZ = d / 2 - (upper ? 1.22 : 1.42);
  box(
    out,
    'timber',
    [-innerX, base, -innerZ],
    [innerX, eave - 0.16, innerZ],
    upper ? t.screen : t.darkRed,
  );
  if (!lod) return;
  const openings = upper ? 4 : 3;
  for (const at of [0, 1, 2, 3]) {
    const angle = (-Math.PI * at) / 2;
    const half = at % 2 === 0 ? innerX : innerZ,
      offset = at % 2 === 0 ? innerZ : innerX;
    const m = transform(out, angle, [-Math.sin(-angle) * offset, 0, Math.cos(angle) * offset]);
    const n = at % 2 === 0 ? openings : 2;
    const step = (2 * half) / n;
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * step;
      const y = base + (upper ? 0.92 : 0.25),
        h = upper ? 2.35 : 3.07;
      panels(m, 'timber', x - step * 0.36, x + step * 0.36, y, y + h, 0.024, t.window);
      if (lod > 1) {
        for (const b of [-0.27, 0, 0.27])
          box(
            m,
            'timber',
            [x + step * b - 0.044, y, 0.02],
            [x + step * b + 0.044, y + h, 0.1],
            t.red,
          );
        for (const h0 of [0.21, 0.5, 0.79])
          box(
            m,
            'timber',
            [x - step * 0.36, y + h * h0, 0.02],
            [x + step * 0.36, y + h * h0 + 0.06, 0.103],
            t.darkRed,
          );
      }
    }
  }
}

function pavilion(out, lod) {
  const {
    lowerWidth: w,
    lowerDepth: d,
    lowerFloor,
    lowerEave,
    upperWidth: uw,
    upperDepth: ud,
    upperFloor,
    upperEave,
  } = dim;
  box(
    out,
    'stone',
    [-w / 2 - 0.43, dim.terrace, -d / 2 - 0.35],
    [w / 2 + 0.43, lowerFloor, d / 2 + 0.35],
    t.edge,
  );
  columns(out, w, d, lowerFloor, lowerEave, lod);
  room(out, w, d, lowerFloor, lowerEave, lod, false);
  tileRoof(
    out,
    [
      { x: 8.45, z: 5.94, y: lowerEave + 0.13, lift: 0.46 },
      { x: 7.9, z: 5.2, y: lowerEave + 0.54, lift: 0.2 },
      { x: 6.43, z: 3.64, y: upperFloor + 0.09, lift: 0.02 },
    ],
    lod,
    false,
  );
  box(
    out,
    'timber',
    [-uw / 2 - 0.11, upperFloor - 0.23, -ud / 2 - 0.11],
    [uw / 2 + 0.11, upperFloor, ud / 2 + 0.11],
    t.darkRed,
  );
  columns(out, uw, ud, upperFloor, upperEave, lod);
  room(out, uw, ud, upperFloor, upperEave, lod, true);
  const wx = uw / 2 - 0.12,
    wz = ud / 2 - 0.07;
  for (const [a, b] of [
    [
      [-wx, wz],
      [wx, wz],
    ],
    [
      [wx, wz],
      [wx, -wz],
    ],
    [
      [wx, -wz],
      [-wx, -wz],
    ],
    [
      [-wx, -wz],
      [-wx, wz],
    ],
  ])
    handrail(out, a, b, upperFloor, lod);
  tileRoof(
    out,
    [
      { x: 8.03, z: 5.48, y: upperEave + 0.11, lift: 0.55 },
      { x: 7.54, z: 4.11, y: upperEave + 0.59, lift: 0.36 },
      { x: 6.35, z: 2.4, y: upperEave + 1.68, lift: 0.13 },
      { x: 6.33, z: 0, y: lowerFloor + dim.pavilionHeight - 0.42, lift: 0.09 },
    ],
    lod,
    true,
  );
  if (lod > 1) {
    box(
      out,
      'timber',
      [-1.46, upperEave - 1.18, ud / 2 + 0.16],
      [1.46, upperEave - 0.48, ud / 2 + 0.29],
      t.shadow,
    );
    for (const x of [-1.12, 1.12])
      box(
        out,
        'timber',
        [x - 0.24, upperEave - 1.21, ud / 2 + 0.27],
        [x + 0.24, upperEave - 1.14, ud / 2 + 0.33],
        t.gold,
      );
  }
}

function stairs(out, x0, x1, z0, z1, y0, y1, count) {
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count;
    box(
      out,
      'stone',
      [x0, Math.min(y0, y1) - 0.29, mix(z0, z1, a)],
      [x1, mix(y0, y1, y0 < y1 ? b : a), mix(z0, z1, b)],
      t.edge,
    );
  }
}

function annex(out, feature, lod) {
  const [x0, z0, x1, z1] = limits(feature.points);
  const a = (x0 + x1) / 2,
    b = (z0 + z1) / 2,
    halfX = (x1 - x0) / 2,
    halfZ = (z1 - z0) / 2;
  const m = transform(out, -Math.sign(a) * (Math.PI / 2), [a, 0, b]);
  box(m, 'wall', [-halfZ, dim.terrace, -halfX], [halfZ, 4.41, halfX], t.cream);
  if (lod)
    for (const x of [-halfZ + 1, 0, halfZ - 1])
      box(
        m,
        'timber',
        [x - 0.64, dim.terrace + 0.81, halfX - 0.05],
        [x + 0.64, 3.68, halfX + 0.02],
        t.screen,
      );
  tileRoof(
    m,
    [
      { x: halfZ + 0.65, z: halfX + 0.57, y: 4.38, lift: 0.24 },
      { x: halfZ + 0.34, z: halfX * 0.6, y: 4.96, lift: 0.14 },
      { x: halfZ - 0.15, z: 0, y: 5.85, lift: 0.07 },
    ],
    Math.min(lod, 2),
    true,
  );
}

function approach(out, lod) {
  const y = dim.terrace;
  box(out, 'masonry', [-12.95, -2.7, -8.94], [12.95, y, 13.55], t.foundation);
  box(out, 'stone', [-13.02, y - 0.16, -9.0], [13.02, y + 0.026, 13.59], t.stone);
  box(out, 'masonry', [-12.36, -2.18, 13.55], [12.36, 0.56, 19.7], t.foundation);
  box(out, 'stone', [-12.48, 0.48, 13.56], [12.48, 0.59, 19.76], t.edge);
  stairs(out, -3.25, 3.25, 13.59, 16.08, y, 0.59, [1, 3, 5, 6][lod]);
  for (const side of [-1, 1]) {
    const x0 = side === 1 ? 8.57 : -9.66;
    const x1 = side === 1 ? 9.66 : -8.57;
    stairs(out, x0, x1, 4.22, 12.76, dim.upperFloor, y + 0.08, [2, 8, 13, 18][lod]);
    const landing = side === 1 ? [6.87, x1] : [x0, -6.87];
    box(
      out,
      'stone',
      [landing[0], dim.upperFloor - 0.24, 3.47],
      [landing[1], dim.upperFloor, 4.22],
      t.edge,
    );
    if (lod) {
      handrail(out, [side * 12.86, -8.91], [side * 12.86, 13.49], y, lod, true);
      handrail(out, [side * 12.86, 13.5], [side * 3.84, 13.5], y, lod, true);
    }
  }
  if (lod) handrail(out, [-12.85, -8.91], [12.85, -8.91], y, lod, true);
  for (const feature of frame.features.filter((f) => f.role.endsWith('side-room')))
    annex(out, feature, lod);
}

function build(out, lod) {
  approach(out, lod);
  pavilion(out, lod);
}

export const pavilionSkyline = (out) => build(out, 0);
export const pavilionDistrict = (out) => build(out, 1);
export const pavilionStreet = (out) => build(out, 2);
export const pavilionCloseup = (out) => build(out, 3);

const recipe = 'penglai-pavilion-model.mjs';
const camera = [-31, 22, 41],
  lookAt = [0, 7.6, 4.5];
export const pavilionModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: pavilionCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The central two-storey Penglai Pavilion on Danya Hill, with gray upturned eaves, timber balconies, flanking rooms and a stone terrace, circa 1925.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-34, 44, 33],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_granite',
    'tile_ceramic',
    'wood_plain',
    'plaster_lime',
  ],
  qaCameras: [
    { name: 'pavilion-double-eaves', position: [-11, 10, 30], lookAt: [0, 9, 2] },
    { name: 'upper-gallery-and-eave', position: [17, 13, 17], lookAt: [3.2, 10, 0] },
    { name: 'terrace-and-flanking-stairs', position: [25, 20, 30], lookAt: [2, 4, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'danya-hill-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'pavilionSkyline',
    errorMeters: 0.47,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'pavilionDistrict', 0.22],
        ['street', 'pavilionStreet', 0.084],
        ['closeup', 'pavilionCloseup', 0.039],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Exact public-domain 1925 National Library of China edition. OpenStreetMap data under ODbL 1.0.',
};
