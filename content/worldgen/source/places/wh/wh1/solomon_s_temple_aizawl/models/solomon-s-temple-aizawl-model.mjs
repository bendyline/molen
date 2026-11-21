import { readFileSync } from 'node:fs';
import {
  arch,
  at,
  block,
  cap,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const f = d.platform;
const [cx, cz] = d.center;
const half = d.bodySpan / 2;
const tone = palette({
  marble: 'd7d6c8',
  cream: 'e0ded3',
  shadow: 'a7a89a',
  rim: 'c8c6b9',
  stone: 'b1aa9b',
  clay: '9c6857',
  slate: '8e9691',
  slateDark: '79827f',
  glazing: '5b6764',
  inset: '747a72',
  wood: '624c40',
  gold: 'af9355',
});
const surfaces = {
  marble: surface('wall', 'stone_marble', 0.9),
  stone: surface('foundation', 'stone_ashlar', 0.95),
  roof: surface('roof', 'metal_standing_seam', 0.83, 0.18),
  glass: surface('window', 'window_grid', 0.57),
  detail: surface('trim', 'metal_painted', 0.86, 0.11),
  wood: surface('trim', 'wood_plain', 0.89),
};

const sides = [
  { u: [1, 0], v: [0, 1] },
  { u: [0, -1], v: [1, 0] },
  { u: [-1, 0], v: [0, -1] },
  { u: [0, 1], v: [-1, 0] },
];
function axes(frame, x = cx, z = cz) {
  const { u, v } = frame;
  return {
    xyz: (a, y, b) => [x + u[0] * a + v[0] * b, y, z + u[1] * a + v[1] * b],
    plane: (front) => ({
      normal: [v[0], 0, v[1]],
      p: (a, y, b = 0) => [x + u[0] * a + v[0] * (front + b), y, z + u[1] * a + v[1] * (front + b)],
    }),
  };
}

function plateau(out, lod) {
  const platform = rect(-25.8, -28.05, 25.8, 28.05);
  shell(out, platform, (p) => Math.min(grade(p) - 0.26, f - 0.44), f, {
    wall: 'stone',
    color: tone.clay,
  });
  cap(out, 'stone', platform, f, tone.stone);
  for (const frame of sides) {
    const a = axes(frame);
    const run = frame.v[1] === 0 ? 25.8 - frame.v[0] * cx : 28.05 - frame.v[1] * cz;
    const width = 7;
    const start0 = a.xyz(0, 0, run + 5.3),
      from = grade([start0[0], start0[2]]) + 0.09;
    const levels = [1, 5, 9, 9][lod];
    for (let i = 0; i < levels; i++) {
      const front = mix(run + 5.3, run - 0.08, i / levels),
        rear = mix(run + 5.3, run - 0.08, (i + 1) / levels);
      const y = mix(Math.min(from, f - 0.1), f + 0.07, (i + 1) / levels);
      const corners = [
        [-width, rear],
        [width, rear],
        [width, front],
        [-width, front],
      ].map(([u, z]) => {
        const [x, , q] = a.xyz(u, 0, z);
        return [x, q];
      });
      shell(out, corners, (p) => Math.min(grade(p) - 0.07, y - 0.08), y, {
        wall: 'stone',
        color: tone.clay,
      });
      cap(out, 'stone', corners, y, tone.rim);
    }
  }
}

function crossedRoof(out, lod) {
  for (const a of sides.map((s) => axes(s))) {
    const y = f + 15.29,
      top = f + 22.65,
      u = 11.1,
      reach = 18.75;
    const O = a.xyz(0, top, 0),
      G = a.xyz(0, top, reach);
    face(out, 'roof', [O, G, a.xyz(-u, y, reach), a.xyz(-u, y, u)], up, tone.slate);
    face(out, 'roof', [O, a.xyz(u, y, u), a.xyz(u, y, reach), G], up, tone.slateDark);
    if (lod > 1) {
      for (let k = 2; k < 12; k++) {
        const z = k * 1.4;
        face(
          out,
          'roof',
          [
            a.xyz(-0.069, top + 0.03, z),
            a.xyz(0.068, top + 0.03, z),
            a.xyz(0.068, top + 0.03, z + 1.4),
            a.xyz(-0.069, top + 0.03, z + 1.4),
          ],
          up,
          tone.rim,
        );
      }
    }
  }
}

function marbleFacades(out, lod) {
  const base = rect(cx - half, cz - half, cx + half, cz + half);
  shell(out, base, () => f + 0.04, f + 15.28, { wall: 'marble', color: tone.marble });
  cap(out, 'roof', base, f + 15.24, tone.slate);
  crossedRoof(out, lod);
  for (const a of sides.map((s) => axes(s))) {
    const ext = 23.95,
      w = a.plane(half + 0.02),
      portico = a.plane(ext);
    const xbounds =
      lod === 0
        ? [-18, -12, -6, 0, 6, 12, 18]
        : [
            -20.8, -17.8, -14.8, -11.8, -8.85, -5.89, -2.95, 0, 2.95, 5.89, 8.85, 11.8, 14.8, 17.8,
            20.8,
          ];
    trimBlock(out, 'marble', portico, -21.5, 21.5, f + 4.12, f + 4.52, -5.38, 0.04, tone.cream);
    const canopy = [
      a.xyz(-21.5, f + 4.55, half),
      a.xyz(21.5, f + 4.55, half),
      a.xyz(21.5, f + 4.55, ext),
      a.xyz(-21.5, f + 4.55, ext),
    ];
    face(out, 'marble', canopy, up, tone.cream);
    for (const u of xbounds) {
      trimBlock(
        out,
        'marble',
        portico,
        u - 0.19,
        u + 0.19,
        f + 0.1,
        f + 4.19,
        -0.5,
        -0.03,
        tone.marble,
      );
      if (lod > 0)
        trimBlock(
          out,
          'stone',
          portico,
          u - 0.27,
          u + 0.27,
          f + 0.1,
          f + 0.46,
          -0.56,
          0.018,
          tone.stone,
        );
    }
    for (const u of [-6.2, 0, 6.2]) {
      arch(
        out,
        w,
        u,
        f + 0.18,
        f + 2.73,
        1.06,
        0.8,
        0.071,
        lod === 1 ? 0 : lod,
        { width: 0.23, trim: tone.rim, inner: tone.wood },
        { inner: 'wood', trim: 'marble' },
      );
      if (lod > 1)
        panel(out, 'detail', w, u - 0.042, u + 0.042, f + 0.24, f + 3.28, 0.104, tone.stone);
    }
    for (const u of [-12.25, -9.55, 9.55, 12.25]) {
      arch(
        out,
        w,
        u,
        f + 6.04,
        f + 8.57,
        0.69,
        0.73,
        0.056,
        lod === 1 ? 0 : lod,
        { width: 0.16, trim: tone.rim, inner: tone.glazing },
        { inner: 'glass', trim: 'marble' },
      );
      if (lod > 0)
        arch(
          out,
          w,
          u,
          f + 10.71,
          f + 13.15,
          0.68,
          0.72,
          0.059,
          lod === 1 ? 0 : lod,
          { width: 0.18, trim: tone.cream, inner: tone.glazing },
          { inner: 'glass', trim: 'marble' },
        );
    }
  }
}

function cross(out, w, y, width, height, shift = 0) {
  const line = width * 0.15;
  panel(
    out,
    'detail',
    w,
    shift - line,
    shift + line,
    y - height * 0.51,
    y + height * 0.49,
    0.026,
    tone.inset,
  );
  panel(
    out,
    'detail',
    w,
    shift - width / 2,
    shift + width / 2,
    y + height * 0.14,
    y + height * 0.14 + line * 1.36,
    0.027,
    tone.inset,
  );
}

function pointedFronts(out, lod) {
  for (const a of sides.map((s) => axes(s))) {
    const faceZ = half + 0.84,
      W = a.plane(faceZ),
      R = a.plane(faceZ - 3.25);
    const lower = f + 4.6,
      shoulder = f + 17.5,
      peak = f + 35.3;
    const l = -5.81,
      r = 5.81;
    trimBlock(out, 'marble', W, l, r, lower, shoulder, -3.24, 0.03, tone.cream);
    const g = [
      [l, shoulder],
      [0, peak],
      [r, shoulder],
    ];
    face(
      out,
      'marble',
      g.map(([x, y]) => W.p(x, y, 0.016)),
      W.normal,
      tone.marble,
    );
    for (const j of [-1, 1]) {
      const sx = j * 5.81;
      face(
        out,
        'marble',
        [W.p(sx, shoulder), W.p(0, peak), R.p(0, peak - 0.35), R.p(sx, shoulder)],
        up,
        tone.rim,
      );
      face(
        out,
        'marble',
        [
          W.p(sx, shoulder, 0.043),
          W.p(0, peak + 0.03, 0.043),
          W.p(0, peak - 0.57, 0.053),
          W.p(sx * 0.956, shoulder, 0.047),
        ],
        W.normal,
        tone.cream,
      );
    }
    cross(out, W, f + 25.45, 2.11, 3.68);
    if (lod === 0) continue;
    for (const y of [f + 7.12, f + 12.05, f + 17.34, f + 20.11]) {
      panel(out, 'detail', W, l + 0.32, r - 0.32, y, y + 0.079, 0.054, tone.shadow);
    }
    for (const x of [-5.28, -2.38, 2.38, 5.28]) {
      panel(out, 'detail', W, x - 0.035, x + 0.035, lower + 0.11, f + 17.51, 0.058, tone.shadow);
    }
    for (const x of [-3.84, 0, 3.84]) {
      arch(
        out,
        W,
        x,
        f + 7.82,
        f + 8.94,
        0.26,
        0.37,
        0.049,
        lod === 1 ? 0 : lod,
        { width: 0.08, trim: tone.cream, inner: tone.inset },
        { inner: 'glass', trim: 'marble' },
      );
    }
    if (lod > 1) {
      for (const side of [-1, 1]) {
        const v = side * 5.43;
        for (const y of [f + 19.0, f + 22.66, f + 26.06, f + 29.22, f + 32.0]) {
          const x = (v * (peak - y)) / (peak - shoulder);
          const p = W.p(x, y, 0.04);
          ring(
            out,
            'detail',
            [p[0], p[2]],
            [
              [y, 0.09],
              [y + 0.21, 0.18],
              [y + 0.36, 0.062],
            ],
            6,
            tone.gold,
          );
        }
      }
    }
  }
}

function star(out, w, y, r) {
  for (const phase of [0, Math.PI]) {
    const pts = Array.from({ length: 4 }, (_, i) => [
      r * Math.sin(phase + (i * 2 * Math.PI) / 3),
      y + r * Math.cos(phase + (i * 2 * Math.PI) / 3),
    ]);
    for (const [[x, y], [u, v]] of pairs(pts))
      face(
        out,
        'detail',
        [w.p(x, y, 0.05), w.p(u, v, 0.05), w.p(u, v + 0.059, 0.05), w.p(x, y + 0.059, 0.05)],
        w.normal,
        tone.gold,
      );
  }
}

function spire(out, center, index, lod) {
  const [x, z] = center,
    base = 4.13;
  const bounds = rect(x - base, z - base, x + base, z + base);
  const high = f + 14.72;
  shell(out, bounds, (p) => Math.min(grade(p) - 0.39, f - 0.08), high, {
    wall: 'marble',
    color: tone.marble,
  });
  cap(out, 'roof', bounds, high, tone.rim);
  for (const a of sides.map((frame) => axes(frame, x, z))) {
    const w = a.plane(base + 0.015);
    for (const u of [-1.76, 1.76]) {
      if (lod === 0) {
        panel(out, 'glass', w, u - 0.56, u + 0.56, f + 5.1, f + 8.94, 0.04, tone.glazing);
        continue;
      }
      arch(
        out,
        w,
        u,
        f + 5.1,
        f + 8.29,
        0.6,
        0.72,
        0.04,
        lod === 1 ? 0 : lod,
        { width: 0.13, trim: tone.cream, inner: tone.glazing },
        { inner: 'glass', trim: 'marble' },
      );
      if (lod > 0) {
        arch(
          out,
          w,
          u,
          f + 9.84,
          f + 12.79,
          0.61,
          0.75,
          0.036,
          lod === 1 ? 0 : lod,
          { width: 0.145, trim: tone.rim, inner: tone.glazing },
          { inner: 'glass', trim: 'marble' },
        );
      }
    }
    if (lod > 0)
      trimBlock(
        out,
        'marble',
        w,
        -base - 0.045,
        base + 0.045,
        high - 0.36,
        high - 0.08,
        -0.07,
        0.15,
        tone.cream,
      );
  }
  const apex = f + 35.72 + (index % 2) * 0.68;
  const spine = 2.29,
    top = 0.238;
  for (const a of sides.map((frame) => axes(frame, x, z))) {
    const y0 = high + 0.02;
    const w = a.plane(spine);
    const points = [
      a.xyz(-spine, y0, spine),
      a.xyz(spine, y0, spine),
      a.xyz(top, apex, top),
      a.xyz(-top, apex, top),
    ];
    face(out, 'marble', points, w.normal, tone.cream);
    if (lod > 1) {
      const count = lod === 2 ? 3 : 7;
      for (let i = 0; i < count; i++) {
        const q = (i + 1) / (count + 2),
          y = mix(y0, apex, q),
          z = mix(spine, top, q);
        star(out, a.plane(z + 0.026), y, mix(0.44, 0.22, q));
      }
    }
  }
  ring(
    out,
    'detail',
    center,
    [
      [apex - 0.1, 0.25],
      [apex + 0.13, 0.43],
      [apex + 0.29, 0.34],
    ],
    8,
    tone.gold,
  );
  const points = lod === 0 ? 4 : 5 + (index % 3);
  for (let j = 0; j < points; j++) {
    const angle = (2 * Math.PI * j) / points;
    const C = Math.cos(angle),
      S = Math.sin(angle);
    face(
      out,
      'detail',
      [
        [x + 0.36 * C - 0.066 * S, apex + 0.24, z + 0.36 * S + 0.066 * C],
        [x + 0.36 * C + 0.066 * S, apex + 0.24, z + 0.36 * S - 0.066 * C],
        [x + 0.45 * C, apex + 0.56 + (index % 2) * 0.18, z + 0.45 * S],
      ],
      [C, 0, S],
      tone.gold,
    );
  }
  if (lod > 1) {
    for (const [dx, dz] of [
      [-3.14, -3.14],
      [3.14, 3.14],
      [-3.14, 3.14],
      [3.14, -3.14],
    ]) {
      ring(
        out,
        'marble',
        [x + dx, z + dz],
        [
          [high - 0.073, 0.5],
          [high + 1.66, 0.48],
          [high + 3.02, 0.052],
        ],
        6,
        tone.marble,
      );
    }
  }
}

function build(out, lod) {
  plateau(out, lod);
  marbleFacades(out, lod);
  pointedFronts(out, lod);
  for (const [i, c] of d.towerCenters.entries()) spire(out, c, i, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'solomon-s-temple-aizawl-model.mjs';
const camera = [67, 39, 99],
  lookAt = [0, 16, 0];
export const solomonTempleModel = {
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
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The mapped temple square follows the original site. The stepped podium meets the locally sampled terrain on each side.',
  brief:
    'Aizawl’s Solomon’s Temple, a white square of arched façades, pointed gables, four crowned corner towers and a ceremonial colonnade.',
  camera,
  lookAt,
  sunDirection: [-41, 60, 55],
  mediumFiContext: {
    scale: 1,
    groundY: -3.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'The precise native outline includes the corner tower projections and main temple body.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'white-spires-and-porch', position: [62, 25, 84], lookAt: [5, 15, 4] },
    { name: 'entry-arches-and-ornament', position: [13, 13, 57], lookAt: [2, 17, 19] },
    { name: 'cross-roof-and-four-crowns', position: [-74, 62, -60], lookAt: [1, 17, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'aizawl-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.55, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Amishjnu’s reference photograph is CC0. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
