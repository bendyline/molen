import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const [lower, upper, eave] = d.hallFloors;
const colors = palette({
  stone: '948b75',
  terrace: 'b5af9e',
  white: 'd2d0bc',
  cream: 'dacbb0',
  blue: '83968f',
  trim: 'b9a06c',
  red: 'a04535',
  roof: '874034',
  roofLight: '9c4b3b',
  underside: '54362a',
  deep: '44382e',
  gold: 'b39a58',
  goldLight: 'c9ad64',
  goldDark: '8c763f',
  glass: '434446',
});
const surfaces = {
  stone: surface('foundation', 'stone_ashlar', 0.92),
  plaster: surface('wall', 'plaster_lime', 0.89),
  roof: surface('roof', 'metal_standing_seam', 0.73, 0.08),
  gold: surface('trim', 'metal_bronze_cast', 0.63, 0.35),
  wood: surface('trim', 'wood_painted_lap', 0.84),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46 },
};
const walls = (p) => pairs(closed(p)).map(([a, b]) => edge(a, b, areaSign(p)));
const box = (out, p, l, h, slot, color) =>
  shell(out, p, () => l, h, { wall: slot, roof: slot, color, roofColor: color });
const octagon = (p, rx, rz, cut) => {
  const [x, z] = p;
  return [
    [x - rx + cut, z - rz],
    [x + rx - cut, z - rz],
    [x + rx, z - rz + cut],
    [x + rx, z + rz - cut],
    [x + rx - cut, z + rz],
    [x - rx + cut, z + rz],
    [x - rx, z + rz - cut],
    [x - rx, z - rz + cut],
  ];
};
const radial = (out, p, profile, n, slot, color, cap = true) =>
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, p, Math.PI / n)),
    color,
    { cap },
  );
const point = (w, u, y, depth = 0) => w.p(u, y, depth);

function ground(out, level) {
  box(out, d.island, -1.65, d.terraceY, 'stone', colors.stone);
  for (const w of walls(d.island)) {
    if (level) panel(out, 'plaster', w, 0, w.length, 1.03, d.terraceY + 0.045, 0.023, colors.white);
  }
  const p = [-2.5, -52.4],
    steps = level === 0 ? 2 : 6;
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    const z = p[1] - 7.32 + (7.32 * i) / steps;
    const y = mix(d.waterline - 0.05, d.deck, t);
    block(out, 'stone', p[0] - 4.43, -1.78, z, 8.86, y + 1.78, 7.32 / steps, colors.stone);
    if (level >= 1)
      block(out, 'wood', p[0] - 4.41, y - 0.1, z + 0.01, 8.82, 0.095, 0.08, colors.red);
  }
}

function goldPeak(out, p, y, scale, level) {
  const h = (v) => y + scale * v,
    r = (v) => scale * v,
    n = [6, 12, 20, 28][level];
  const standard = [
    [0, 1.25],
    [0.14, 1.31],
    [0.24, 1.14],
    [0.42, 1.08],
    [0.71, 1.04],
    [0.92, 0.96],
    [1.13, 0.74],
    [1.35, 0.63],
    [1.54, 0.41],
    [1.76, 0.26],
    [2.04, 0.15],
    [2.24, 0.11],
  ];
  const far = [
    [0, 1.24],
    [0.36, 1.14],
    [0.89, 0.95],
    [1.38, 0.58],
    [1.92, 0.19],
    [2.24, 0.105],
  ];
  radial(
    out,
    p,
    (level === 0 ? far : standard).map(([a, b]) => [h(a), r(b)]),
    n,
    'gold',
    colors.gold,
  );
  if (level >= 1) {
    for (const [t, w] of [
      [0.2, 1.22],
      [0.51, 1.075],
      [0.86, 0.975],
      [1.13, 0.79],
      [1.35, 0.61],
      [1.64, 0.34],
      [1.96, 0.19],
    ]) {
      radial(
        out,
        p,
        [
          [h(t - 0.018), r(w)],
          [h(t + 0.025), r(w + 0.04)],
        ],
        n,
        'gold',
        colors.goldLight,
        false,
      );
    }
  }
  const pole = [
    [2.22, 0.09],
    [2.3, 0.162],
    [2.45, 0.19],
    [2.61, 0.14],
    [2.74, 0.078],
    [2.88, 0.025],
    [3.05, 0.012],
  ];
  const finial =
    level === 0
      ? [
          [2.23, 0.1],
          [2.57, 0.147],
          [3.05, 0.012],
        ]
      : pole;
  radial(
    out,
    p,
    finial.map(([a, b]) => [h(a), r(b)]),
    [4, 6, 8, 12][level],
    'gold',
    colors.goldLight,
  );
  if (level >= 2) {
    for (const t of [2.42, 2.55, 2.68]) {
      radial(
        out,
        p,
        [
          [h(t), r(0.185)],
          [h(t + 0.026), r(0.225)],
          [h(t + 0.043), r(0.175)],
        ],
        n,
        'gold',
        colors.goldLight,
        false,
      );
    }
    if (level === 3) {
      const t = 2.45;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * i) / 4;
        beam(
          out,
          'gold',
          [p[0], h(t + 0.1), p[1]],
          [p[0] + r(0.24) * Math.cos(a), h(t), p[1] + r(0.24) * Math.sin(a)],
          0.035,
          0.032,
          colors.goldLight,
        );
      }
    }
  }
}

function roofCell(out, p, rx, rz, y, rise, level, major = false) {
  const span = Math.min(rx, rz);
  const corner = span * 0.2;
  const fascia = octagon(p, rx, rz, corner);
  const shoulder = octagon(p, rx * 0.85, rz * 0.85, corner * 0.78);
  const upper = octagon(p, rx * 0.7, rz * 0.68, corner * 0.67);
  const tar = (w) => [w.normal[0], 0.43, w.normal[2]];
  const perim = walls(fascia);
  for (const [i, w] of perim.entries()) {
    const j = (i + 1) % fascia.length;
    const surfColor = i % 4 === 0 ? colors.roofLight : colors.roof;
    const lowEave = y + (i % 2 === 0 ? 0 : 0.11);
    const q =
      level === 0
        ? [
            at(fascia[i], lowEave),
            at(fascia[j], y + (j % 2 === 0 ? 0 : 0.11)),
            at(upper[j], y + rise),
            at(upper[i], y + rise),
          ]
        : [
            at(fascia[i], lowEave),
            at(fascia[j], y + (j % 2 === 0 ? 0 : 0.11)),
            at(shoulder[j], y + rise * 0.46),
            at(shoulder[i], y + rise * 0.46),
          ];
    // Alternate raised corners produce the slight sweep across each roof span.
    face(out, 'roof', q.slice(0, 3), tar(w), surfColor);
    face(out, 'roof', [q[0], q[2], q[3]], tar(w), surfColor);
    if (level >= 1) {
      face(
        out,
        'roof',
        [q[3], q[2], at(upper[j], y + rise), at(upper[i], y + rise)],
        tar(w),
        surfColor,
      );
    }
    panel(out, 'gold', w, 0.01, w.length - 0.01, y - 0.095, y + 0.05, 0.055, colors.goldLight);
    if (level >= 1) {
      panel(out, 'wood', w, 0.03, w.length - 0.03, y - 0.266, y - 0.128, 0.038, colors.deep);
    }
    if (level >= 2) {
      const gable = i % 2 === 0;
      const divisions = gable
        ? Math.ceil(w.length / (level === 2 ? 1.34 : 0.73))
        : Math.ceil(w.length / 1.55);
      for (let k = 0; k < divisions; k++) {
        const s = ((k + 0.5) * w.length) / divisions;
        panel(
          out,
          'gold',
          w,
          s - 0.051,
          s + 0.051,
          y + 0.028,
          y + (gable ? 0.28 : 0.21),
          0.091,
          colors.gold,
        );
      }
      if (major || i % 2 === 0) {
        for (const at of [0.065, 0.935]) {
          const u = w.length * at;
          const a = point(w, u, y + 0.035, 0.033),
            b = point(w, u + w.length * (at < 0.5 ? -0.067 : 0.067), y + 0.61, 0.15);
          beam(out, 'gold', a, b, 0.061, 0.063, colors.goldLight);
        }
      }
    }
  }
  if (level === 0) return;
  // Four gables project from the red roof planes, with gilded rake boards.
  for (const i of [0, 2, 4, 6]) {
    const w = perim[i];
    const mid = w.length * 0.5,
      span = Math.min(w.length * 0.32, rx * 0.57);
    const z = y + 0.49,
      apex = z + Math.min(1.85, rise * 0.82);
    const a = point(w, mid - span, z, -0.52),
      b = point(w, mid + span, z, -0.52),
      c = point(w, mid, apex, -0.76);
    face(out, 'wood', [a, b, c], w.normal, colors.underside);
    const end = (v) =>
      v.map((x, j) =>
        j === 0 ? mix(x, p[0], 0.21) : j === 2 ? mix(x, p[1], 0.21) : x + rise * 0.24,
      );
    face(out, 'roof', [a, c, end(c), end(a)], up, colors.roofLight);
    face(out, 'roof', [c, b, end(b), end(c)], up, colors.roofLight);
    if (level >= 2) {
      beam(out, 'gold', a, c, 0.12, 0.12, colors.goldLight);
      beam(out, 'gold', c, b, 0.12, 0.12, colors.goldLight);
      beam(out, 'gold', a, b, 0.08, 0.09, colors.gold);
      const top = point(w, mid, apex, -0.69);
      beam(out, 'gold', top, [top[0], top[1] + 0.53, top[2]], 0.07, 0.07, colors.goldLight);
      for (const u of [-0.34, 0, 0.34]) {
        const here = mid + u * span;
        panel(out, 'glass', w, here - 0.14, here + 0.14, z + 0.16, z + 0.38, -0.51, colors.glass);
      }
    }
  }
}

function shrine(out, level) {
  const p = [0, 0],
    baseRing = octagon(p, 19.08, 19.12, 3.54);
  box(out, d.outline, d.terraceY, d.deck, 'plaster', colors.white);
  box(out, baseRing, lower, upper, 'plaster', colors.white);
  const second = octagon(p, 18.68, 18.74, 3.36);
  box(out, second, upper, eave, 'plaster', colors.cream);
  const surround = walls(second);
  for (const [i, w] of surround.entries()) {
    panel(out, 'gold', w, 0, w.length, upper + 0.055, upper + 0.4, 0.1, colors.goldLight);
    panel(out, 'wood', w, 0, w.length, eave - 0.19, eave, 0.087, colors.red);
    const bays = i % 2 === 0 ? (level === 0 ? 4 : 8) : 1;
    for (let j = 0; j < bays; j++) {
      const u = ((j + 0.5) * w.length) / bays,
        half = Math.min(1.19, (w.length / bays) * 0.34);
      panel(out, 'glass', w, u - half, u + half, upper + 0.57, eave - 0.5, 0.044, colors.glass);
      if (level >= 1) {
        const r = u + w.length / (2 * bays);
        panel(out, 'gold', w, r - 0.058, r + 0.058, upper + 0.38, eave - 0.19, 0.075, colors.gold);
      }
      if (level >= 2) {
        for (const a of [-0.64, 0, 0.64])
          panel(
            out,
            'plaster',
            w,
            u + a - 0.055,
            u + a + 0.055,
            upper + 0.61,
            eave - 0.53,
            0.066,
            colors.white,
          );
        for (const a of [0.33, 0.65])
          panel(
            out,
            'plaster',
            w,
            u - half,
            u + half,
            mix(upper + 0.57, eave - 0.5, a),
            mix(upper + 0.57, eave - 0.5, a) + 0.054,
            0.071,
            colors.white,
          );
      }
    }
  }
  for (const [i, w] of walls(baseRing).entries()) {
    panel(out, 'wood', w, 0, w.length, upper - 0.18, upper + 0.04, 0.1, colors.red);
    panel(out, 'plaster', w, 0, w.length, upper - 0.74, upper - 0.24, 0.07, colors.blue);
    const count = i % 2 === 0 ? (level === 0 ? 4 : 7) : 1;
    for (let k = 0; k < count; k++) {
      const bay = w.length / count,
        u = (k + 0.5) * bay;
      const width = Math.min(1.18, bay * 0.29);
      if (level === 0)
        panel(
          out,
          'glass',
          w,
          u - width,
          u + width,
          lower + 0.41,
          upper - 0.9,
          0.039,
          colors.glass,
        );
      else
        arch(
          out,
          w,
          u,
          lower + 0.31,
          upper - 1.35,
          width,
          0.42,
          0.043,
          level - 1,
          { inner: colors.glass, trim: colors.cream, width: 0.091 },
          { inner: 'glass', trim: 'plaster' },
        );
      if (level >= 1) {
        panel(
          out,
          'wood',
          w,
          u + bay * 0.49 - 0.079,
          u + bay * 0.49 + 0.079,
          lower + 0.09,
          upper - 0.1,
          0.085,
          colors.red,
        );
      }
    }
  }
  const roofs = [
    [19.96, 9.27, 2.65],
    [17.17, 12.75, 2.48],
    [14.1, 15.96, 2.42],
    [10.82, 19.1, 2.25],
    [7.61, 22.04, 1.91],
  ];
  for (const [i, [radius, y, rise]] of roofs.entries()) {
    roofCell(out, p, radius, radius * 0.995, y, rise, level, i < 3);
    if (i < roofs.length - 1) {
      const band = octagon(p, radius * 0.67, radius * 0.65, radius * 0.15);
      const spring = y + rise - 0.08;
      const next = roofs[i + 1][1] + 0.065;
      for (const w of walls(band)) {
        panel(out, 'wood', w, 0, w.length, spring, next, 0, colors.underside);
        if (level >= 2) {
          const n = Math.ceil(w.length / 1.52);
          for (let j = 0; j < n; j++) {
            const u = ((j + 0.5) * w.length) / n;
            panel(
              out,
              'gold',
              w,
              u - 0.048,
              u + 0.048,
              spring + 0.07,
              next - 0.02,
              0.039,
              colors.gold,
            );
          }
        }
      }
    }
  }
  radial(
    out,
    p,
    [
      [23.6, 5.18],
      [24.09, 5.24],
      [24.57, 4.53],
      [24.75, 4.04],
    ],
    [8, 12, 20, 28][level],
    'gold',
    colors.goldDark,
  );
  goldPeak(out, p, 24.63, (d.spireHeight - 24.63) / 3.05, level);
}

function coveredLanding(out, level) {
  const [x0, x1, z0, z1] = [-9.92, 4.65, -51.73, -19.77];
  const p = [-2.63, -44.93],
    deck = d.deck;
  box(out, d.pier, d.terraceY - 0.055, deck, 'plaster', colors.white);
  const supportRows = [
    edge([x0 + 0.52, z0 + 0.59], [x0 + 0.52, z1 - 0.35]),
    edge([x1 - 0.46, z1 - 0.35], [x1 - 0.46, z0 + 0.59]),
    edge([x1 - 0.45, z0 + 0.64], [x0 + 0.48, z0 + 0.64]),
  ];
  for (const w of supportRows) {
    const n = Math.max(2, Math.ceil(w.length / (level === 0 ? 12.0 : 3.65)));
    for (let i = 0; i <= n; i++) {
      const [x, , z] = w.p((w.length * i) / n, 0, 0);
      block(out, 'wood', x - 0.153, deck, z - 0.15, 0.306, 3.52, 0.3, colors.red);
      if (level >= 1) {
        block(out, 'gold', x - 0.18, deck + 0.49, z - 0.17, 0.36, 2.7, 0.34, colors.gold);
        block(out, 'plaster', x - 0.3, deck - 0.05, z - 0.29, 0.6, 0.35, 0.58, colors.white);
      }
    }
  }
  const center = [-2.65, -32.6];
  roofCell(out, center, 7.54, 12.91, 4.85, 1.75, Math.min(level, 1));
  if (level >= 1) {
    box(out, rect(-7.27, -42.2, 2.35, -23.95), 5.94, 7.05, 'wood', colors.underside);
  }
  roofCell(out, [-2.65, -33.3], 5.78, 10.09, 6.94, 1.62, Math.min(level, 1));
  if (level >= 1) {
    for (const [x, normal] of [
      [-7.31, -1],
      [2.38, 1],
    ]) {
      const w = edge([x, normal > 0 ? -42.4 : -24], [x, normal > 0 ? -24 : -42.4]);
      for (let k = 0; k < 9; k++) {
        const u = ((k + 0.52) * w.length) / 9;
        panel(out, 'glass', w, u - 0.49, u + 0.49, 6.14, 6.74, 0.042, colors.glass);
      }
    }
  }
  for (const [rx, rz, y, rise] of [
    [7.32, 7.51, 5.17, 2.12],
    [5.88, 6.13, 7.1, 1.96],
    [4.26, 4.72, 8.91, 2.17],
    [2.85, 3.15, 10.9, 1.9],
  ]) {
    roofCell(out, p, rx, rz, y, rise, level);
  }
  if (level === 0) {
    radial(
      out,
      p,
      [
        [12.58, 1.06],
        [13.95, 0.76],
        [15.51, 0.22],
        [16.22, 0.025],
      ],
      6,
      'gold',
      colors.goldLight,
    );
  } else goldPeak(out, p, 12.51, 1.38, level);
}
function build(out, level) {
  ground(out, level);
  shrine(out, level);
  coveredLanding(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'phaung-daw-u-pagoda-model.mjs';
const camera = [-111, 48, -142],
  lookAt = [0, 11, -15];
const errors = { district: 0.65, street: 0.28, closeup: 0.08 };
export const phaungDawUPagodaAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original terrain reference at the mapped public landing. The terrace bounds replacement of roof returns.',
  brief:
    'Phaung Daw U Pagoda in Inle Lake, with red tiered roofs, gilded stupa and the covered waterfront arrival hall.',
  camera,
  lookAt,
  sunDirection: [-92, 126, -111],
  mediumFiContext: {
    scale: 1,
    groundY: -0.89,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: d.island,
    basis:
      'The mapped visitor terrace bounds the replacement of radar returns from the shrine and arrival roofs.',
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis:
      'Native sanctuary and attached covered dock hall, preserving adjoining independently mapped buildings.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'waterside-pagoda-and-gold-bell', position: [-52, 11, -90], lookAt: [2, 15, -6] },
    { name: 'landing-steps-and-colonnades', position: [15, 7, -77], lookAt: [-3, 8, -41] },
    { name: 'two-storey-gallery-and-gabled-eaves', position: [62, 13, 45], lookAt: [4, 12, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'phaung-daw-u-pagoda-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.45,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
