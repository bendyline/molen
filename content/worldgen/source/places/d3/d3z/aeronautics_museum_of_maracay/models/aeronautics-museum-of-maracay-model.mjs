/** Public aviation museum at Maracay, as documented in September 2021. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const { museumBuildings, estimatedEntranceGate, estimatedFrontPavilion } = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.83, metallic: 0.07 },
};
const tone = Object.fromEntries(
  Object.entries({
    wall: 'ded0a5',
    trim: 'e4e0d3',
    foundation: '999784',
    oldWall: 'd8ccad',
    floor: 'aaa395',
    ochre: 'ac6e36',
    plinth: 'ad7447',
    doors: '3b4441',
    glass: '4a555b',
    redTile: 'bc745f',
    soffit: '925b4e',
    zinc: 'a7aa97',
    zincDark: '8b9584',
    steel: '42584a',
    black: '353a3c',
    paving: 'ac9d8a',
    pathStripe: 'ab7566',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = field.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function panel(out, slot, x0, x1, y0, y1, z, c) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    c,
  );
}

function perimeter(out, points, floor, eaves, open, lod) {
  const ccw =
    points.reduce((area, a, i) => {
      const b = points[(i + 1) % points.length];
      return area + a[0] * b[1] - a[1] * b[0];
    }, 0) > 0;
  const ring = ccw ? points.toReversed() : points;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i],
      [x1, z1] = ring[(i + 1) % ring.length];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const wall = transform(out, -Math.atan2(z1 - z0, x1 - x0), [x0, 0, z0]);
    const base = (x, z) => Math.min(floor - 0.21, ground(x, z) - 0.52);
    face(
      wall,
      'concrete',
      [
        [0, base(x0, z0), 0],
        [length, base(x1, z1), 0],
        [length, floor, 0],
        [0, floor, 0],
      ],
      tone.foundation,
    );
    if (length < 2) continue;
    if (!open) {
      panel(wall, 'wall', 0, length, floor, eaves, 0, tone.oldWall);
      panel(wall, 'wall', 0, length, floor + 0.02, floor + 0.7, 0.025, tone.plinth);
      if (lod > 0)
        for (let x = 2.7; x < length - 2.2; x += 5.3) {
          panel(wall, 'wall', x - 1.03, x + 1.03, floor + 1.05, floor + 2.96, 0.028, tone.trim);
          panel(wall, 'roof', x - 0.84, x + 0.84, floor + 1.2, floor + 2.8, 0.039, tone.glass);
        }
      continue;
    }
    panel(wall, 'roof', 0, length, eaves - 0.33, eaves + 0.05, 0.045, tone.steel);
    const n = Math.max(1, Math.round(length / (lod === 0 ? 14 : 5.6)));
    for (let j = 0; j <= n; j++) {
      const x = mix(0.24, length - 0.24, j / n);
      const post = lod === 0 ? 0.23 : 0.105;
      if (lod < 2) panel(wall, 'roof', x - post, x + post, floor, eaves, 0.076, tone.steel);
      else box(wall, 'roof', [x - post, floor, 0.025], [x + post, eaves, 0.27], tone.steel);
    }
  }
}

function slope(out, x0, x1, z0, z1, eaves, ridge, slot, color, lod, hipped = false) {
  const x = (x0 + x1) / 2;
  const inset = hipped ? Math.min((z1 - z0) * 0.24, (x1 - x0) * 0.31) : 0;
  const a = [x0, eaves, z0],
    b = [x0, eaves, z1],
    c = [x1, eaves, z1],
    d = [x1, eaves, z0];
  const p = [x, ridge, z0 + inset],
    q = [x, ridge, z1 - inset];
  face(out, slot, [a, b, q, p], color);
  face(out, slot, [p, q, c, d], color);
  if (hipped) {
    triangle(out, slot, [b, c, q], color);
    triangle(out, slot, [d, a, p], color);
  } else {
    triangle(out, 'wall', [b, c, q], tone.oldWall);
    triangle(out, 'wall', [d, a, p], tone.oldWall);
  }
  if (lod > 0) {
    box(
      out,
      slot,
      [x - 0.11, ridge - 0.07, p[2]],
      [x + 0.11, ridge + 0.13, q[2]],
      slot === 'tile' ? tone.soffit : tone.zincDark,
    );
  }
  if (lod > 1 && slot === 'roof')
    for (let z = z0 + 0.68; z < z1 - 0.12; z += 2.35) {
      for (const edge of [x0, x1]) {
        const far = Math.min(z + 0.095, z1);
        const y = eaves + 0.026;
        const strip = [
          [edge, y, z],
          [edge, y, far],
          [x, ridge + 0.032, far],
          [x, ridge + 0.032, z],
        ];
        face(out, 'roof', edge === x0 ? strip : strip.toReversed(), tone.zincDark);
      }
    }
}

function pitchedAcross(out, x0, x1, z0, z1, eaves, ridge, slot, color, lod, hipped = false) {
  slope(transform(out, -Math.PI / 2), z0, z1, -x1, -x0, eaves, ridge, slot, color, lod, hipped);
}

function openTrusses(out, x0, x1, z0, z1, eaves, ridge, lod) {
  if (lod === 0) return;
  const x = (x0 + x1) / 2;
  for (let z = z0 + 1.5; z < z1; z += lod === 1 ? 16 : 7.4) {
    const ends = [
      [x0, eaves, z],
      [x, ridge - 0.2, z],
      [x1, eaves, z],
    ];
    const steel = (a, b) => beam(out, 'roof', a, b, 0.12, 0.096, tone.steel);
    steel(ends[0], ends[2]);
    steel(ends[0], ends[1]);
    steel(ends[1], ends[2]);
    if (lod > 1) {
      for (const sign of [-1, 1]) {
        const dx = sign * (x1 - x0) * 0.25;
        steel([x + dx, eaves, z], ends[1]);
        steel([x + dx, eaves, z], [x + dx * 1.5, eaves + (ridge - eaves) * 0.24, z]);
      }
    }
  }
}

function museumHangars(out, lod) {
  const [gallery, hangar, annex, stores] = museumBuildings.map((row) => row.points);
  const galleryFloor = 6.9;
  const galleryEaves = galleryFloor + 6.35;
  perimeter(out, gallery, galleryFloor, galleryEaves, true, lod);
  // The north roof joins the two museum arms around the open central court.
  slope(out, -65.2, -41.8, -60.2, 52.3, galleryEaves, galleryEaves + 3.85, 'roof', tone.zinc, lod);
  pitchedAcross(
    out,
    -46.3,
    45.35,
    26.95,
    52.31,
    galleryEaves,
    galleryEaves + 4.05,
    'roof',
    tone.zinc,
    lod,
  );
  pitchedAcross(
    out,
    -46.72,
    35.87,
    -60.37,
    -34.89,
    galleryEaves,
    galleryEaves + 3.96,
    'roof',
    tone.zinc,
    lod,
  );
  const hangarFloor = ground(64, 0) + 0.35;
  const hangarEaves = hangarFloor + 5.33;
  perimeter(out, hangar, hangarFloor, hangarEaves, true, lod);
  slope(out, 51.76, 75.48, -39.5, 37.26, hangarEaves, hangarEaves + 3.53, 'roof', tone.zinc, lod);
  openTrusses(out, 52.2, 75.02, -38.92, 36.9, hangarEaves, hangarEaves + 3.53, lod);
  for (const [ring, bounds] of [
    [annex, [52.6, 74.57, -76.42, -44.57]],
    [stores, [87.0, 104.91, -16.2, 30.95]],
  ]) {
    const [x0, x1, z0, z1] = bounds;
    const y = ground((x0 + x1) / 2, (z0 + z1) / 2) + 0.31;
    perimeter(out, ring, y, y + 3.55, false, lod);
    slope(out, x0, x1, z0, z1, y + 3.53, y + 5.7, 'roof', tone.zinc, lod);
  }
}

function pavilion(out, lod) {
  const {
    centerXZ: [x, z],
    width,
    depth,
    eavesYAboveFloor: eaves,
    ridgeYAboveFloor: ridge,
  } = estimatedFrontPavilion;
  const model = transform(out, 0, [x, ground(x, z) + 0.28, z]);
  const front = depth / 2,
    half = width / 2;
  box(
    model,
    'concrete',
    [-half - 0.23, -0.65, -front - 0.2],
    [half + 0.23, 0.24, front + 0.43],
    tone.foundation,
  );
  box(model, 'wall', [-half, 0, -front], [half, eaves, front], tone.wall);
  pitchedAcross(
    model,
    -half - 0.38,
    half + 0.38,
    -front - 0.45,
    front + 0.29,
    eaves - 0.06,
    ridge,
    'tile',
    tone.redTile,
    lod,
    true,
  );
  panel(model, 'wall', -half, half, 0.29, 1.04, front + 0.025, tone.plinth);
  panel(model, 'wall', -half, half, 1.04, 1.24, front + 0.03, tone.trim);
  panel(model, 'wall', -half, half, eaves - 0.45, eaves - 0.12, front + 0.03, tone.trim);
  for (const x0 of [-10.92, -7.3, -2.63, 2.63, 7.3, 10.92]) {
    box(
      model,
      'wall',
      [x0 - 0.17, 0.17, front - 0.043],
      [x0 + 0.17, eaves - 0.17, front + 0.145],
      tone.trim,
    );
    if (lod > 0)
      box(
        model,
        'wall',
        [x0 - 0.26, eaves - 0.59, front - 0.03],
        [x0 + 0.26, eaves - 0.21, front + 0.23],
        tone.trim,
      );
  }
  for (const x0 of [-5.62, 0, 5.62]) {
    const w = 2.24,
      y = eaves - 0.16,
      h = 0.96,
      f = front + 0.19;
    triangle(
      model,
      'wall',
      [
        [x0 - w, y, f],
        [x0 + w, y, f],
        [x0, y + h, f],
      ],
      tone.trim,
    );
    if (lod > 0) {
      beam(model, 'wall', [x0 - w, y, f + 0.038], [x0, y + h, f + 0.038], 0.12, 0.085, tone.trim);
      beam(model, 'wall', [x0, y + h, f + 0.038], [x0 + w, y, f + 0.038], 0.12, 0.085, tone.trim);
    }
  }
  for (const [x0, w, y0, y1] of [
    [-9.04, 2.18, 1.28, 3.11],
    [-5.55, 2.22, 2.35, 3.72],
    [0, 2.12, 0.2, 3.28],
    [5.55, 2.22, 2.35, 3.72],
    [9.04, 2.18, 1.28, 3.11],
  ]) {
    const z0 = front + 0.06;
    panel(model, 'wall', x0 - w / 2 - 0.17, x0 + w / 2 + 0.17, y0 - 0.11, y1 + 0.17, z0, tone.trim);
    panel(model, 'roof', x0 - w / 2, x0 + w / 2, y0, y1, z0 + 0.022, tone.glass);
    if (lod > 0) {
      panel(model, 'wall', x0 - w / 2, x0 + w / 2, y1 - 0.55, y1 - 0.43, z0 + 0.033, tone.trim);
      if (lod > 1)
        for (let j = 1; j < 7; j++) {
          const a = x0 - w / 2 + (j * w) / 7;
          panel(model, 'roof', a - 0.03, a + 0.03, y0 + 0.025, y1 - 0.57, z0 + 0.046, tone.doors);
        }
    }
  }
  box(model, 'concrete', [-1.36, -0.32, front - 0.12], [1.36, 0.19, front + 0.81], tone.foundation);
}

function gateName(out, y) {
  const text = 'MUSEO AERONAUTICO';
  const width = 6.62;
  const height = 0.23;
  const z = 0.367;
  const stroke = 0.047;
  lettering(out, text, { width, height, y, z, stroke, slot: 'roof', color: tone.black });
  // Complete the two rounded glyphs that the shared lettering alphabet does not carry.
  const glyphs = {
    O: [
      [0, 0.22],
      [0, 0.78],
      [0.19, 1],
      [0.81, 1],
      [1, 0.78],
      [1, 0.22],
      [0.81, 0],
      [0.19, 0],
      [0, 0.22],
    ],
    U: [
      [0, 1],
      [0, 0.21],
      [0.19, 0],
      [0.81, 0],
      [1, 0.21],
      [1, 1],
    ],
  };
  const advance = width / text.length;
  for (let i = 0; i < text.length; i++) {
    const outline = glyphs[text[i]];
    if (!outline) continue;
    const points = outline.map(([a, b]) => [
      (i - text.length / 2 + a * 0.75) * advance,
      y + b * height,
      z,
    ]);
    for (let j = 1; j < points.length; j++)
      beam(out, 'roof', points[j - 1], points[j], stroke, stroke, tone.black);
  }
}

function gates(out, lod) {
  const {
    centerXZ: [x, z],
    clearWidth,
    height,
  } = estimatedEntranceGate;
  const model = transform(out, 0, [x, ground(x, z) + 0.11, z]);
  const span = clearWidth / 2 + 0.35;
  for (const sign of [-1, 1]) {
    const a = sign * span;
    box(model, 'wall', [a - 0.25, -0.32, -0.27], [a + 0.25, height - 0.68, 0.27], tone.ochre);
    const ring = (y, r) => [
      [a - r, y, -r],
      [a - r, y, r],
      [a + r, y, r],
      [a + r, y, -r],
    ];
    loft(
      model,
      'wall',
      [ring(height - 0.99, 0.25), ring(height - 0.61, 0.46), ring(height - 0.4, 0.46)],
      tone.ochre,
    );
    const doorX = a - sign * 0.63;
    const gate = transform(model, sign * 0.36, [doorX, 0, -0.14]);
    const length = -2.5;
    for (const y of [0.32, 2.1])
      box(gate, 'roof', [-0.025, y, length], [0.036, y + 0.07, 0], tone.black);
    if (lod > 0) {
      const number = lod === 1 ? 4 : 10;
      for (let i = 0; i <= number; i++) {
        const zz = (length * i) / number;
        box(gate, 'roof', [-0.028, 0.27, zz - 0.021], [0.034, 2.18, zz + 0.023], tone.black);
      }
    }
  }
  box(
    model,
    'concrete',
    [-span - 0.62, height - 0.45, -0.34],
    [span + 0.62, height + 0.03, 0.35],
    tone.trim,
  );
  if (lod > 1) gateName(model, height - 0.33);
}

function approach(out, lod) {
  const terrace = estimatedFrontPavilion.centerXZ;
  const gate = estimatedEntranceGate.centerXZ;
  const n = [5, 12, 20, 32][lod];
  for (let i = 0; i < n; i++) {
    const u0 = i / n,
      u1 = (i + 1) / n;
    const [x0, z0] = [mix(terrace[0], gate[0], u0), mix(terrace[1] + 6.9, gate[1] - 0.8, u0)];
    const [x1, z1] = [mix(terrace[0], gate[0], u1), mix(terrace[1] + 6.9, gate[1] - 0.8, u1)];
    const y0 = ground(x0, z0) + 0.037,
      y1 = ground(x1, z1) + 0.037;
    const band = (a, b, c, offset = 0) =>
      face(
        out,
        'concrete',
        [
          [x0 + a, y0 + offset, z0],
          [x1 + a, y1 + offset, z1],
          [x1 + b, y1 + offset, z1],
          [x0 + b, y0 + offset, z0],
        ],
        c,
      );
    band(-2.3, 2.3, tone.paving);
    if (lod > 1) for (const a of [-1.65, 1.46]) band(a, a + 0.19, tone.pathStripe, 0.012);
  }
}

function build(out, lod) {
  museumHangars(out, lod);
  pavilion(out, lod);
  gates(out, lod);
  approach(out, lod);
}
export const maracaySkyline = (out) => build(out, 0);
export const maracayDistrict = (out) => build(out, 1);
export const maracayStreet = (out) => build(out, 2);
export const maracayCloseup = (out) => build(out, 3);
const recipe = 'aeronautics-museum-of-maracay-model.mjs';
const camera = [173, 90, 215],
  lookAt = [20, 7, 11];
export const maracayModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'stadium-lettering.mjs'],
  surfaces,
  category: 'landmark',
  build: maracayCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former airfield museum at Maracay, with a low red-roofed entrance pavilion, ochre public gate, U-shaped gallery and broad steel hangars.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [30, 58, 75],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'tile_ceramic', 'metal_painted'],
  qaCameras: [
    { name: 'museum-site-from-the-west', position: [164, 54, 182], lookAt: [21, 7, 15] },
    { name: 'public-gate-and-raised-name', position: [61, 5.3, 116.4], lookAt: [60.7, 2.8, 102.3] },
    {
      name: 'west-pavilion-pediments-and-red-roof',
      position: [54, 11, 78],
      lookAt: [63.55, 6.6, 40],
    },
    { name: 'open-steel-bays-and-courtyard', position: [126, 28, 56], lookAt: [38, 9, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'maracay-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'maracaySkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'maracayDistrict', 0.33],
        ['street', 'maracayStreet', 0.092],
        ['closeup', 'maracayCloseup', 0.034],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Reference photographs are CC0. Native OpenStreetMap polygons are ODbL 1.0.',
};
