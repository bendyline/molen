/** The former barrack at 1990 East Potter Street as used by the museum in 2022. */
import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { outline, west, east, ground, floor, eave, porch, front, back } = plan.dimensions;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  painted: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.93, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  inset: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.68, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    stone: 'ca9678',
    base: 'aa7d60',
    wood: '82694f',
    painted: 'e8e8e0',
    roof: '55585c',
    roofShade: '4d5055',
    well: '535351',
    glazing: '696b5e',
    concrete: 'b8b7a9',
    sign: '725336',
    text: 'e0c486',
  }).map(([name, color]) => [name, rgb(color)]),
);

function facade(out, width, openings, lod) {
  const cut = (x0, y0, x1, y1) => {
    if (x1 - x0 > 0.002 && y1 - y0 > 0.002)
      box(out, 'stone', [x0, y0, -0.45], [x1, y1, 0], tone.stone);
  };
  box(out, 'foundation', [0, ground, -0.48], [width, floor - 0.01, 0.025], tone.base);
  if (!lod || !openings.length) {
    cut(0, floor, width, eave);
    return;
  }
  let at = 0;
  for (const { x, door = false } of openings) {
    const w = door ? 0.61 : 0.56;
    const left = x - w;
    const right = x + w;
    const lower = floor + (door ? 0.01 : 0.92);
    const upper = floor + (door ? 2.42 : 2.55);
    cut(at, floor, left, eave);
    cut(left, floor, right, lower);
    cut(left, upper, right, eave);
    box(out, 'inset', [left, lower, -0.33], [right, upper, -0.273], door ? tone.wood : tone.well);
    if (lod > 1) {
      const frame = 0.073;
      for (const edge of [left, right]) {
        box(
          out,
          'painted',
          [edge - frame, lower, -0.252],
          [edge + frame, upper, -0.178],
          tone.painted,
        );
      }
      for (const y of [lower, upper]) {
        box(
          out,
          'painted',
          [left - frame, y - frame, -0.252],
          [right + frame, y + frame, -0.178],
          tone.painted,
        );
      }
      if (!door) {
        box(
          out,
          'concrete',
          [left - 0.1, lower - 0.11, -0.29],
          [right + 0.1, lower + 0.015, 0.13],
          tone.concrete,
        );
        box(
          out,
          'inset',
          [left + 0.12, upper - 0.69, -0.26],
          [right - 0.12, upper - 0.104, -0.247],
          tone.glazing,
        );
        box(
          out,
          'painted',
          [left + frame, lower + 0.73, -0.232],
          [right - frame, lower + 0.77, -0.173],
          tone.painted,
        );
      }
    }
    at = right;
  }
  cut(at, floor, width, eave);
}

function stoneWalls(out, lod) {
  for (let index = 0; index < outline.length; index++) {
    const [x0, z0] = outline[index],
      [x1, z1] = outline[(index + 1) % outline.length];
    const span = Math.hypot(x1 - x0, z1 - z0);
    const angle = -Math.atan2(z1 - z0, x1 - x0);
    const face = transform(out, angle, [x0, 0, z0]);
    const isFront = z0 === front && z1 === front;
    const bays = isFront ? 7 : Math.max(0, Math.floor(span / 3.7));
    const openings = Array.from({ length: bays }, (_, i) => ({
      x: ((i + 0.52) * span) / bays,
      door: isFront && i === 5,
    }));
    facade(face, span, openings, lod);
  }
}

function halfGable(out, { left, right, near, far, height, rise }, lod) {
  const ridge = (far + near) / 2;
  const a = [left, height, near];
  const b = [right, height, near];
  const c = [right, height, far];
  const d = [left, height, far];
  const e = [left, height + rise, ridge];
  const f = [right, height + rise, ridge];
  face(out, 'roof', [b, a, e, f], tone.roof);
  face(out, 'roof', [d, c, f, e], tone.roofShade);
  triangle(
    out,
    'stone',
    [
      [left + 0.19, height, near + 0.19],
      [left + 0.19, height, far - 0.19],
      [left + 0.19, height + rise - 0.23, ridge],
    ],
    tone.stone,
  );
  triangle(
    out,
    'stone',
    [
      [right - 0.19, height, far - 0.19],
      [right - 0.19, height, near + 0.19],
      [right - 0.19, height + rise - 0.23, ridge],
    ],
    tone.stone,
  );
  if (lod === 0) return;
  for (const line of [
    [a, e, d],
    [b, f, c],
  ])
    beamPath(out, 'painted', line, 0.124, 0.18, tone.painted);
  if (lod > 1) {
    beamPath(out, 'roof', [e, f], 0.13, 0.13, tone.roofShade);
    for (const [x, angle] of [
      [left + 0.16, -Math.PI / 2],
      [right - 0.16, Math.PI / 2],
    ]) {
      const bay = transform(out, angle, [x, height + 0.68, ridge]);
      for (const offset of [-1.42, 1.42]) {
        const arc = Array.from({ length: 11 }, (_, i) => {
          const theta = (Math.PI * i) / 10;
          return [offset + 0.38 * Math.cos(theta), Math.sin(theta) * 0.34, 0];
        });
        bay.addConvexPolygon(
          'inset',
          'palette:#ffffff',
          arc,
          [0, 0, 1],
          (p) => [p[0], p[1]],
          tone.well,
        );
        beamPath(
          bay,
          'concrete',
          [
            [offset - 0.45, -0.055, 0.04],
            [offset + 0.45, -0.055, 0.04],
          ],
          0.085,
          0.085,
          tone.concrete,
        );
      }
    }
  }
}

function roofs(out, lod) {
  halfGable(
    out,
    {
      left: west - 0.22,
      right: east + 0.22,
      near: front - 0.22,
      far: 1.7,
      height: eave,
      rise: 4.08,
    },
    lod,
  );
  for (const [min, max, end] of [
    [west, -6.035, back - 1.085],
    [-0.784, east, back],
  ]) {
    const roof = transform(out, -Math.PI / 2, [(min + max) / 2, 0, 0]);
    halfGable(
      roof,
      {
        left: -2,
        right: end + 0.22,
        near: -(max - min) / 2 - 0.18,
        far: (max - min) / 2 + 0.18,
        height: eave,
        rise: (max - min) * 0.212,
      },
      lod,
    );
  }
  const porchEave = eave - 0.35;
  const panel = [
    [east + 0.21, porchEave, porch - 0.13],
    [west - 0.24, porchEave, porch - 0.13],
    [west - 0.24, eave + 0.55, front + 0.61],
    [east + 0.21, eave + 0.55, front + 0.61],
  ];
  face(out, 'roof', panel, tone.roofShade);
  box(
    out,
    'painted',
    [west - 0.24, porchEave - 0.13, porch - 0.12],
    [east + 0.21, porchEave, porch + 0.042],
    tone.painted,
  );
}

function railing(out, x0, x1, z, base, lod) {
  const h = 0.88;
  for (const y of [base + 0.12, base + h])
    box(out, 'painted', [x0, y - 0.042, z - 0.059], [x1, y + 0.042, z + 0.059], tone.painted);
  if (lod < 2) return;
  const n = Math.max(1, Math.round((x1 - x0) / 1.25));
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n + 0.037;
    const b = x0 + ((x1 - x0) * (i + 1)) / n - 0.037;
    beamPath(
      out,
      'painted',
      [
        [a, base + 0.13, z + 0.014],
        [b, base + h, z + 0.014],
      ],
      0.043,
      0.055,
      tone.painted,
    );
    beamPath(
      out,
      'painted',
      [
        [b, base + 0.13, z - 0.014],
        [a, base + h, z - 0.014],
      ],
      0.043,
      0.055,
      tone.painted,
    );
    if (i < n - 1)
      box(
        out,
        'painted',
        [b - 0.008, base + 0.11, z - 0.046],
        [b + 0.06, base + h, z + 0.046],
        tone.painted,
      );
  }
}

function stair(out, cx, z, lod) {
  const width = 1.51;
  const run = 2.35;
  const steps = lod === 0 ? 3 : 7;
  const length = run / steps;
  const bottom = -0.32;
  for (let i = 0; i < steps; i++) {
    const top = floor - ((floor - bottom) * i) / steps;
    box(
      out,
      'concrete',
      [cx - width / 2, bottom - 0.19, z - length * (i + 1)],
      [cx + width / 2, top, z - length * i],
      tone.concrete,
    );
  }
  if (!lod) return;
  for (const dx of [-width / 2, width / 2]) {
    const x = cx + dx;
    beamPath(
      out,
      'painted',
      [
        [x, bottom + 0.86, z - run],
        [x, floor + 0.87, z],
      ],
      0.086,
      0.086,
      tone.painted,
    );
    box(
      out,
      'painted',
      [x - 0.057, bottom, z - run - 0.057],
      [x + 0.057, bottom + 0.98, z - run + 0.057],
      tone.painted,
    );
  }
}

function veranda(out, lod) {
  const thickness = 0.155;
  box(out, 'stone', [west, ground, porch + 0.02], [east, floor - 0.14, front + 0.1], tone.base);
  box(
    out,
    'concrete',
    [west - 0.08, floor - 0.14, porch - 0.03],
    [east + 0.08, floor, front + 0.11],
    tone.concrete,
  );
  const upper = eave - 0.46;
  const z = porch + 0.11;
  const posts = Array.from({ length: 10 }, (_, i) => west + 0.15 + ((east - west - 0.3) * i) / 9);
  const cx = west + 6.65;
  for (const x of posts) {
    const size = thickness / 2;
    box(out, 'painted', [x - size, floor, z - size], [x + size, upper, z + size], tone.painted);
    if (lod > 1) {
      for (const sign of [-1, 1]) {
        if (x + sign * 0.67 < west || x + sign * 0.67 > east) continue;
        beamPath(
          out,
          'painted',
          [
            [x, upper - 0.79, z],
            [x + sign * 0.17, upper - 0.43, z],
            [x + sign * 0.66, upper - 0.024, z],
          ],
          0.113,
          0.102,
          tone.painted,
        );
      }
    }
  }
  if (lod) {
    railing(out, west + 0.13, cx - 0.83, z, floor, lod);
    railing(out, cx + 0.83, east - 0.13, z, floor, lod);
    for (const [x, angle] of [
      [west + 0.1, -Math.PI / 2],
      [east - 0.1, Math.PI / 2],
    ]) {
      const local = transform(out, angle, [x, 0, z]);
      const span = front - z;
      railing(local, angle < 0 ? 0 : -span, angle < 0 ? span : 0, 0, floor, lod);
    }
  }
  stair(out, cx, z, lod);
}

const glyphs = {
  A: ['0110', '1001', '1111', '1001', '1001'],
  D: ['1110', '1001', '1001', '1001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  G: ['0111', '1000', '1011', '1001', '0111'],
  L: ['1000', '1000', '1000', '1000', '1111'],
  M: ['1001', '1111', '1111', '1001', '1001'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  T: ['1111', '0110', '0110', '0110', '0110'],
  U: ['1001', '1001', '1001', '1001', '0110'],
};
function sign(out, lod) {
  if (!lod) return;
  const x = west + 8.11,
    z = porch - 0.81;
  const local = transform(out, Math.PI, [x, 0, z]);
  box(local, 'painted', [-0.95, 0.1, -0.04], [-0.854, 2.88, 0.055], tone.painted);
  box(local, 'painted', [-0.97, 2.58, -0.04], [0.91, 2.67, 0.054], tone.painted);
  box(local, 'painted', [0.58, 2.47, -0.022], [0.615, 2.61, 0.012], tone.painted);
  box(local, 'painted', [-0.61, 2.47, -0.022], [-0.576, 2.61, 0.012], tone.painted);
  box(local, 'painted', [-0.82, 1.45, -0.044], [0.82, 2.48, 0.049], tone.sign);
  if (lod !== 3) return;
  const step = 0.033;
  for (const [i, row] of ['FORT', 'DOUGLAS', 'MUSEUM'].entries()) {
    const baseline = 2.295 - i * 0.26;
    const left = (-(row.length * 5 - 1) * step) / 2;
    for (const [letter, char] of [...row].entries()) {
      for (const [v, line] of glyphs[char].entries()) {
        const pieces = line.matchAll(/1+/g);
        for (const piece of pieces) {
          const x0 = left + (letter * 5 + piece.index) * step;
          const y = baseline - v * step;
          const x1 = x0 + piece[0].length * step - 0.007;
          face(
            local,
            'inset',
            [
              [x0, y - step, 0.052],
              [x1, y - step, 0.052],
              [x1, y, 0.052],
              [x0, y, 0.052],
            ],
            tone.text,
          );
        }
      }
    }
  }
}

function build(out, lod) {
  stoneWalls(out, lod);
  roofs(out, lod);
  veranda(out, lod);
  sign(out, lod);
}
export const barrackSkyline = (out) => build(out, 0);
export const barrackDistrict = (out) => build(out, 1);
export const barrackStreet = (out) => build(out, 2);
export const barrackCloseup = (out) => build(out, 3);

const recipe = 'fort-douglas-museum-model.mjs';
const camera = [36, 21, -50];
const lookAt = [2, 3.1, -8];
export const barrackModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: null,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: barrackCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Fort Douglas Military Museum’s main 1870s barrack on Potter Street, with red sandstone, dark gable roofs and a white timber veranda in May 2022.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-26, 37, -34],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_sandstone_raw',
    'wood_plain',
    'shingle_asphalt',
    'concrete_plain',
  ],
  qaCameras: [
    { name: 'potter-street-porch-and-sign', position: [-19, 4.7, -43], lookAt: [1.5, 3.2, -17.5] },
    { name: 'sandstone-gable-and-cross-bracing', position: [32, 10.7, -31], lookAt: [8, 4.3, -12] },
    { name: 'rear-wings-and-open-court', position: [25, 14, 29], lookAt: [3, 3.1, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'potter-street-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'barrackSkyline',
    errorMeters: 0.46,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'barrackDistrict', 0.22],
        ['street', 'barrackStreet', 0.085],
        ['closeup', 'barrackCloseup', 0.04],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Exact Qualla photograph released under CC0 by its author. Native OpenStreetMap data under ODbL 1.0.',
};
