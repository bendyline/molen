/** Standing Rococo church of São Francisco de Assis above Largo do Coimbra. */
import { readFileSync } from 'node:fs';
import {
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

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const [outline] = frame.geometry.polygons;
const { floorY, eavesY, towerCenters, drumTopY, towerTipY } = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  carved: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.82, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    lime: 'e4d9bf',
    warm: 'dacdb4',
    ochre: 'b18d66',
    stone: 'a99a7e',
    edge: 'c1a57e',
    cream: 'd8bf98',
    deep: '736758',
    crown: '766f61',
    tile: 'b67653',
    agedTile: '955c42',
    green: '56604e',
    pane: '444a43',
    black: '433b30',
    bronze: '6b624b',
  }).map(([name, value]) => [name, rgb(value)]),
);
const tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;
const shade = (c, t) => c.map((n) => Math.min(1, n * t));

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function masonry(out) {
  const outer = [...outline].reverse();
  const total = outer.reduce((sum, a, i) => {
    const b = outer[(i + 1) % outer.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
  const ring = total > 0 ? outer : outer.reverse();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [u, v] = ring[(i + 1) % ring.length];
    const bottom = Math.min(floorY - 0.71, ground(x, z) - 0.92);
    const end = Math.min(floorY - 0.71, ground(u, v) - 0.92);
    face(
      out,
      'stone',
      [
        [u, end, v],
        [x, bottom, z],
        [x, floorY + 0.01, z],
        [u, floorY + 0.01, v],
      ],
      tint.stone,
    );
    face(
      out,
      'plaster',
      [
        [u, floorY, v],
        [x, floorY, z],
        [x, eavesY, z],
        [u, eavesY, v],
      ],
      shade(tint.lime, 0.95 + 0.04 * Math.cos(i * 1.29)),
    );
    const ox = (0.16 * (v - z)) / Math.hypot(u - x, v - z);
    const oz = (-0.16 * (u - x)) / Math.hypot(u - x, v - z);
    face(
      out,
      'carved',
      [
        [u + ox, eavesY - 0.21, v + oz],
        [x + ox, eavesY - 0.21, z + oz],
        [x + ox, eavesY + 0.17, z + oz],
        [u + ox, eavesY + 0.17, v + oz],
      ],
      tint.edge,
    );
  }
}

function hip(out, x0, x1, z0, z1, y, cap, dark = false) {
  const mid = (x0 + x1) * 0.5;
  const shift = Math.min(4.72, (z1 - z0) * 0.37);
  const ridgeA = [mid, cap, z0 + shift];
  const ridgeB = [mid, cap, z1 - shift];
  const a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  face(out, 'tile', [d, ridgeB, ridgeA, a], dark ? tint.agedTile : tint.tile);
  face(out, 'tile', [b, ridgeA, ridgeB, c], tint.tile);
  triangle(out, 'tile', [a, ridgeA, b], tint.agedTile);
  triangle(out, 'tile', [c, ridgeB, d], tint.tile);
}

function panel(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

function fan(out, slot, x, y, rx, ry, z, color, segments = 12) {
  const center = [x, y, z];
  for (let i = 0; i < segments; i++) {
    const a = (tau * i) / segments,
      b = (tau * (i + 1)) / segments;
    triangle(
      out,
      slot,
      [
        center,
        [x + rx * Math.cos(a), y + ry * Math.sin(a), z],
        [x + rx * Math.cos(b), y + ry * Math.sin(b), z],
      ],
      shade(color, 0.96 + 0.056 * Math.cos(i * 2.05)),
    );
  }
}

function opening(out, x, y, w, h, z, lod, door = false) {
  const r = w / 2;
  const spring = y + h - 0.23 * w;
  panel(out, 'carved', x - r - 0.17, x + r + 0.17, y - 0.13, spring + 0.07, z, tint.ochre);
  fan(out, 'carved', x, spring, r + 0.17, 0.28 * w + 0.1, z + 0.001, tint.edge, lod === 0 ? 6 : 12);
  panel(out, 'wood', x - r, x + r, y, spring, z + 0.024, tint.green);
  fan(out, 'wood', x, spring, r, 0.23 * w, z + 0.025, tint.green, lod === 0 ? 6 : 12);
  if (lod < 2) return;
  panel(out, 'carved', x - r - 0.2, x + r + 0.2, y - 0.12, y - 0.06, z + 0.078, tint.cream);
  panel(out, 'dark', x - 0.033, x + 0.033, y, spring, z + 0.06, tint.pane);
  if (!door) {
    for (const cx of [x - r * 0.39, x + r * 0.39]) {
      panel(out, 'dark', cx - 0.14, cx + 0.14, y + h * 0.26, y + h * 0.64, z + 0.052, tint.pane);
      for (let j = 0; j < 4; j++) {
        const b = y + h * (0.29 + j * 0.11);
        panel(out, 'wood', cx - 0.14, cx + 0.14, b, b + 0.035, z + 0.066, tint.cream);
      }
    }
  }
}

function frontispiece(out, lod) {
  const z = 21.82;
  const crest = [
    [0, 15.42],
    [0.48, 14.94],
    [0.87, 14.18],
    [1.4, 13.46],
    [2.05, 12.99],
    [2.76, 12.63],
    [3.47, 11.95],
    [4.04, 11.33],
  ];
  const outline = [
    ...crest
      .slice(1)
      .toReversed()
      .map(([x, y]) => [-x, y]),
    ...crest,
  ];
  for (let i = 1; i < outline.length; i++) {
    const [a, lo] = outline[i - 1],
      [b, hi] = outline[i];
    face(
      out,
      'plaster',
      [
        [a, 9.99, z],
        [b, 9.99, z],
        [b, hi, z],
        [a, lo, z],
      ],
      tint.lime,
    );
    face(
      out,
      'carved',
      [
        [a, lo - 0.42, z + 0.14],
        [b, hi - 0.42, z + 0.14],
        [b, hi + 0.12, z + 0.17],
        [a, lo + 0.12, z + 0.17],
      ],
      tint.edge,
    );
    face(
      out,
      'carved',
      [
        [b, hi + 0.12, z + 0.17],
        [a, lo + 0.12, z + 0.17],
        [a, lo + 0.12, z - 1.72],
        [b, hi + 0.12, z - 1.72],
      ],
      tint.ochre,
    );
  }
  for (const x of [-4.12, 4.12]) {
    box(out, 'carved', [x - 0.42, floorY, 21.14], [x + 0.42, 11.4, 22.09], tint.ochre);
    for (const y of lod === 0 ? [1.19, 11.26] : [1.19, 2.05, 10.67, 11.26])
      box(out, 'carved', [x - 0.54, y, 21.02], [x + 0.54, y + 0.21, 22.23], tint.edge);
  }
  box(out, 'carved', [-3.77, 10.46, 21.63], [3.77, 10.77, 22.02], tint.edge);
  box(out, 'carved', [-1.07, 15.15, 21.69], [1.07, 15.52, 22.13], tint.crown);
  box(out, 'carved', [-0.1, 15.46, 21.83], [0.1, 19.32, 22.02], tint.crown);
  for (const [width, y] of [
    [1.68, 17.68],
    [1.3, 18.5],
  ])
    box(out, 'carved', [-width / 2, y, 21.82], [width / 2, y + 0.15, 22.04], tint.crown);
  opening(out, 0, floorY, 2.36, 3.98, 22.11, lod, true);
  for (const x of [-2.26, 2.26]) opening(out, x, 5.99, 1.06, 2.83, 21.87, lod);
  const disc = [0, 11.79];
  fan(out, 'carved', ...disc, 1.17, 1.19, 22.08, tint.ochre, 18);
  fan(out, 'carved', ...disc, 0.91, 1.01, 22.11, tint.cream, 18);
  if (lod > 0) {
    fan(out, 'carved', 0, 6.38, 0.53, 0.84, 22.24, tint.cream, 14);
    fan(out, 'carved', 0, 7.27, 0.27, 0.32, 22.27, tint.edge, 12);
    for (const side of [-1, 1]) {
      for (let i = 0; i < (lod > 1 ? 6 : 3); i++) {
        const t = i / 5;
        const x = side * (0.51 + 0.71 * Math.sin(t * 2.78));
        const y = 7.22 - 2.68 * t;
        fan(
          out,
          'carved',
          x,
          y,
          0.22 + 0.05 * t,
          0.39,
          22.22 + i * 0.006,
          tint.edge,
          lod > 1 ? 9 : 6,
        );
      }
      if (lod > 1) {
        for (let i = 0; i < 5; i++) {
          const a = 0.58 * i + 0.2;
          fan(
            out,
            'carved',
            side * (0.19 + 0.41 * Math.sin(a)),
            11.53 + 0.53 * Math.cos(a),
            0.15,
            0.22,
            22.126 + i * 0.005,
            tint.edge,
            8,
          );
        }
      }
    }
  }
  const stair = lod > 1 ? 5 : 2;
  const groundY = ground(0, 23.35) - 0.07;
  for (let i = 0; i < stair; i++) {
    const y = mix(floorY, groundY, i / stair);
    box(
      out,
      'stone',
      [-1.71, groundY - 0.44, 21.97 + i * 0.37],
      [1.71, y, 22.34 + i * 0.37],
      tint.stone,
    );
  }
}

function bellTower(out, cx, cz, lod) {
  const r = 2.62;
  const sides = [8, 20, 36, 56][lod];
  const drumBottom = eavesY - 0.23;
  const bodyRings = [
    [drumBottom, r],
    [11.35, r + 0.18],
    [11.9, r + 0.18],
    [12.03, r - 0.07],
  ];
  loft(
    out,
    'carved',
    bodyRings.map(([y, d]) => radialRing(y, d, d, sides, [cx, cz])),
    tint.ochre,
    { cap: false },
  );
  const toPoint = (a, y, d = r) => [cx + d * Math.cos(a), y, cz + d * Math.sin(a)];
  const slit = Math.PI / 2;
  const openingBottom = 12.34,
    openingSpring = 15.73;
  const topFor = (a) => {
    const fractional = ((a + slit * 0.5) % slit) - slit * 0.5;
    const width = 0.347;
    const relative = fractional / width;
    return Math.abs(relative) < 1
      ? openingSpring + 0.82 * Math.sqrt(1 - relative * relative)
      : openingBottom;
  };
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides;
    const b = (tau * (i + 1)) / sides;
    const topA = topFor(a),
      topB = topFor(b);
    const points = (ay, by, upperA, upperB) => [
      toPoint(b, by),
      toPoint(a, ay),
      toPoint(a, upperA),
      toPoint(b, upperB),
    ];
    face(out, 'plaster', points(12.02, 12.02, openingBottom, openingBottom), tint.lime);
    face(out, 'plaster', points(topA, topB, drumTopY, drumTopY), tint.lime);
    if (topA > openingBottom || topB > openingBottom) {
      const inset = [toPoint(b, openingBottom, r - 0.53), toPoint(a, openingBottom, r - 0.53)];
      if (topA > openingBottom) inset.push(toPoint(a, topA, r - 0.53));
      if (topB > openingBottom) inset.push(toPoint(b, topB, r - 0.53));
      if (inset.length === 3) triangle(out, 'dark', inset, tint.black);
      else face(out, 'dark', inset, tint.black);
      if (lod > 0)
        face(
          out,
          'carved',
          [
            toPoint(b, topB),
            toPoint(a, topA),
            toPoint(a, topA, r - 0.53),
            toPoint(b, topB, r - 0.53),
          ],
          tint.edge,
        );
    }
    if (lod > 0 && i % Math.max(1, Math.round(sides / 12)) === 0) {
      const angle = (a + b) / 2;
      const local = transform(out, Math.PI / 2 - angle, toPoint(angle, 0, r - 0.1));
      if (topFor(angle) === openingBottom)
        box(local, 'carved', [-0.19, 12.02, -0.082], [0.19, drumTopY + 0.05, 0.19], tint.ochre);
    }
  }
  for (const [y, d] of [
    [drumTopY - 0.13, r + 0.09],
    [drumTopY + 0.03, r + 0.19],
  ])
    loft(
      out,
      'carved',
      [radialRing(y, d, d, sides, [cx, cz]), radialRing(y + 0.16, d, d, sides, [cx, cz])],
      tint.edge,
      { cap: false },
    );
  const dome = [
    [drumTopY + 0.13, r + 0.2],
    [18.35, r + 0.33],
    [18.68, r + 0.15],
    [19.08, r - 0.15],
    [19.86, r - 0.33],
    [20.54, r - 0.75],
    [21.05, 1.13],
    [21.4, 0.71],
    [21.68, 0.58],
    [22.01, 0.45],
    [22.27, 0.32],
    [towerTipY, 0.036],
  ];
  const cuts = [8, 12, 24, 32][lod];
  const section = lod === 0 ? [0, 2, 4, 6, 8, 11].map((i) => dome[i]) : dome;
  for (let j = 1; j < section.length; j++) {
    const [lo, d0] = section[j - 1],
      [hi, d1] = section[j];
    for (let i = 0; i < cuts; i++) {
      const a = (tau * i) / cuts,
        b = (tau * (i + 1)) / cuts;
      const color = cuts >= 24 && i % (cuts / 8) === 0 ? tint.ochre : tint.crown;
      face(
        out,
        'carved',
        [toPoint(b, lo, d0), toPoint(a, lo, d0), toPoint(a, hi, d1), toPoint(b, hi, d1)],
        shade(color, 0.96 + 0.08 * Math.sin(i * 1.49 + j * 0.8)),
      );
    }
  }
}

function sideDoors(out, lod) {
  const locations = [
    [-7.38, 12.18],
    [-7.89, -8.12],
    [7.85, 11.97],
    [8.37, -8.25],
  ];
  locations.forEach(([x, z], i) => {
    const local = transform(out, ((i < 2 ? -1 : 1) * Math.PI) / 2, [x, 0, z]);
    opening(local, 0, floorY, 1.3, 2.63, 0.06, lod, true);
  });
  if (lod > 0) {
    for (const side of [-1, 1]) {
      const w = side < 0 ? -7.91 : 8.37;
      const local = transform(out, (side * Math.PI) / 2, [w, 0, -16.3]);
      for (const x of [-7.1, -1.7, 3.7]) opening(local, x, 7.05, 0.9, 1.63, 0.13, lod);
    }
  }
}

function build(out, lod) {
  masonry(out);
  hip(out, -7.71, 8.19, -4.14, 15.12, 11.18, 15.75);
  hip(out, -8.31, 8.62, -33.12, -3.59, 11.17, 14.11, true);
  hip(out, -4.38, 4.47, 14.19, 21.67, 11.17, 13.96);
  frontispiece(out, lod);
  for (const [x, z] of towerCenters) bellTower(out, x, z, lod);
  if (lod > 0) sideDoors(out, lod);
}
export const ouroPretoSkyline = (out) => build(out, 0);
export const ouroPretoDistrict = (out) => build(out, 1);
export const ouroPretoStreet = (out) => build(out, 2);
export const ouroPretoCloseup = (out) => build(out, 3);
const recipe = 'ouro-preto-sao-francisco-model.mjs';
const camera = [44, 37, 78];
const lookAt = [0, 8.7, -4.7];
export const ouroPretoModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: ouroPretoCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'The named church way/182626848 is the physical replacement boundary.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Rococo church of São Francisco de Assis, with its warm stone frontispiece, two round recessed belfries, and terracotta nave and chancel roofs.',
  camera,
  lookAt,
  sunDirection: [-39, 65, 57],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.83,
    cameraYaw: -0.45,
    focus: { center: [0, 3, -1] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'church-from-largo-do-coimbra', position: camera, lookAt },
    { name: 'rococo-portal-and-belfries', position: [-8, 10, 56], lookAt: [0, 10.8, 17] },
    { name: 'original-slope-and-side-openings', position: [44, 12, 6], lookAt: [0, 6, -8] },
    { name: 'twin-towers-and-tiled-hip-roofs', position: [-30, 49, -52], lookAt: [0, 10, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `ouro-preto-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'ouroPretoSkyline',
    errorMeters: 1.14,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'ouroPretoDistrict', 0.52],
        ['street', 'ouroPretoStreet', 0.16],
        ['closeup', 'ouroPretoCloseup', 0.05],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Exact supplemental creator CC0 exterior. OpenStreetMap footprint is ODbL 1.0 and terrain attribution is recorded in the original grid.',
};
