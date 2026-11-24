import fs from 'node:fs';
import {
  beam,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const outline = frame.geometry.outline;
const center = 3.061;
const landing = 1.42;
const portico = facade([0, plan.dimensions.frontColumnPlaneZ], [1, 0]);
const body = [
  ...outline.slice(0, 12),
  outline[14],
  outline[15],
  outline[19],
  outline[21],
  outline[24],
  outline[25],
];
const wing = [outline[11], outline[12], outline[13], outline[14]];
const endSpans = [
  [-21.21, -12.94],
  [19.07, 27.33],
];

const wall = rgb('cecec6');
const apron = rgb('b9b9b0');
const marble = rgb('deddd4');
const highlight = rgb('e5e3d9');
const shaded = rgb('aaa9a1');
const lightGray = rgb('bcbeb9');
const roof = rgb('818780');
const copper = rgb('737e7c');
const foundation = rgb('a7a39a');
const granite = rgb('898981');
const frames = rgb('8b7665');
const window = rgb('525c60');
const wood = rgb('71524a');
const clock = rgb('48525a');
const gold = rgb('b79b62');

const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.74 },
};

const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const roundProfile = (profile) => profile.map(([y, r]) => [y, r, r]);

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: true });
}

function cap(out, slot, ring, y, color) {
  const index = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < index.length; i += 3)
    tri(out, slot, p(index[i]), p(index[i + 2]), p(index[i + 1]), color);
}

function grade([x, z]) {
  const i = Math.round((x - terrain.origin[0]) / terrain.stepMeters);
  const j = Math.round((z - terrain.origin[1]) / terrain.stepMeters);
  return terrain.heightsMeters[j][i] - terrain.modelDatumElevationMeters;
}

function footing(out, ring, top) {
  const r = outwardRing(ring);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7.5);
    const p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let j = 0; j < steps; j++) {
      const lo = p(j / steps),
        hi = p((j + 1) / steps);
      quad4(
        out,
        'base',
        [lo[0], Math.min(grade(lo) - 0.67, top - 0.12), lo[1]],
        [hi[0], Math.min(grade(hi) - 0.67, top - 0.12), hi[1]],
        [hi[0], top, hi[1]],
        [lo[0], top, lo[1]],
        foundation,
      );
    }
  }
}

function mass(out, ring, baseY, top, color) {
  footing(out, ring, baseY);
  extrude(out, 'wall', ring, baseY, top, color, { top: false });
  cap(out, 'roof', ring, top, roof);
}

function hip(out, x0, x1, z0, z1, y, rise, axis, color) {
  const a = [x0, y, z1],
    b = [x1, y, z1],
    c = [x1, y, z0],
    d = [x0, y, z0];
  const w = Math.min((x1 - x0) / 2, (z1 - z0) / 2);
  if (axis === 'x') {
    const g = [x0 + w * 0.73, y + rise, (z0 + z1) / 2];
    const h = [x1 - w * 0.73, y + rise, (z0 + z1) / 2];
    quad4(out, 'roof', a, b, h, g, color);
    quad4(out, 'roof', c, d, g, h, color);
    tri(out, 'roof', d, a, g, color);
    tri(out, 'roof', b, c, h, color);
  } else {
    const g = [(x0 + x1) / 2, y + rise, z1 - w * 0.85];
    const h = [(x0 + x1) / 2, y + rise, z0 + w * 0.85];
    quad4(out, 'roof', d, a, g, h, color);
    quad4(out, 'roof', b, c, h, g, color);
    tri(out, 'roof', a, b, g, color);
    tri(out, 'roof', c, d, h, color);
  }
}

function sash(out, F, x, y, width, height, level, arched = false, color = window) {
  if (level < 2) {
    fbox(out, 'detail', F, x - width / 2, x + width / 2, y, y + height, 0.012, 0.045, color);
    if (level === 1 && !arched)
      fbox(
        out,
        'stone',
        F,
        x - width / 2 - 0.05,
        x + width / 2 + 0.05,
        y - 0.09,
        y,
        0.0,
        0.11,
        marble,
      );
    return;
  }
  opening(out, F, x, y, width, height, {
    head: arched ? 'round' : 'flat',
    frameSlot: 'stone',
    glassSlot: 'detail',
    frame: lightGray,
    glass: color,
    frameWidth: 0.095,
    frameDepth: 0.1,
    d: 0.048,
    sill: !arched,
    mullions: level > 1 ? 1 : 0,
    transoms: level > 1 ? 1 : 0,
    mullionColor: frames,
  });
}

function exterior(out, level) {
  mass(out, body, landing, 11.89, wall);
  mass(out, wing, -0.34, 8.22, apron);
  hip(out, -20.69, 26.79, -3.25, 33.44, 11.93, 2.72, 'x', roof);
  hip(out, -21.35, -12.16, -38.8, -3.22, 8.24, 1.52, 'z', copper);
  const apse = outline.slice(0, 11);
  const peak = [2.31, 13.02, -3.25];
  for (let i = 1; i < apse.length; i++)
    tri(
      out,
      'roof',
      [apse[i - 1][0], 11.91, apse[i - 1][1]],
      [apse[i][0], 11.91, apse[i][1]],
      peak,
      roof,
    );

  const edges = outwardRing(body);
  for (let i = 0; i < edges.length; i++) {
    const F = wallFace(edges[i], edges[(i + 1) % edges.length]);
    const L = F.length;
    if (F.normal[1] > 0.9 || (level === 0 && L < 12)) continue;
    fbox(out, 'stone', F, 0, L, 5.29, 5.47, 0.0, 0.13, marble);
    fbox(out, 'stone', F, 0, L, 11.51, 11.88, 0.0, 0.18, marble);
    if (L < 19 || level === 0) continue;
    const n = Math.round(L / 5.6);
    for (let k = 0; k < n; k++) {
      const u = (L * (k + 0.5)) / n;
      sash(out, F, u, 6.24, 1.4, 3.45, level, true);
      if (level > 1) sash(out, F, u, 2.05, 1.13, 2.18, level);
    }
  }
  if (level > 0) {
    const F = facade([-21.2, -38.63], [0, 1]);
    const F2 = facade([-12.27, -3.34], [0, -1]);
    for (const side of [F, F2])
      for (const u of [4.5, 9.79, 15.23, 20.93, 25.77, 31.01]) {
        sash(out, side, u, 3.14, 1.12, 2.46, level);
        if (level > 1) sash(out, side, u, 0.39, 0.94, 1.6, level);
      }
  }
}

function stair(out, level) {
  const [lo, hi] = [-12.95, 19.06];
  const n = level === 0 ? 3 : 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = -0.33 + t * (landing + 0.33);
    const z = 43.48 - t * 2.94;
    box(out, 'base', lo, hi, 38.86, z, -2.04, y, granite);
  }
  box(out, 'base', lo, hi, 34.0, 40.57, -1.88, landing, granite);
}

function endBlocks(out, level) {
  for (const [x0, x1] of endSpans) {
    const r = rect(x0, x1, 33.96, 40.31);
    mass(out, r, landing, 12.97, wall);
    const F = facade([0, 40.31], [1, 0]);
    const x = (x0 + x1) / 2;
    fbox(out, 'stone', F, x0 - 0.09, x1 + 0.09, 11.78, 12.42, -0.08, 0.27, marble);
    fbox(out, 'stone', F, x0 - 0.14, x1 + 0.14, 12.39, 12.63, -0.11, 0.44, highlight);
    fbox(out, 'stone', F, x0 + 0.25, x1 - 0.25, 12.74, 13.41, -0.05, 0.072, marble);
    for (const u of [x0 + 0.53, x1 - 0.53]) {
      fbox(out, 'stone', F, u - 0.34, u + 0.34, landing, 11.77, -0.08, 0.25, marble);
      fbox(out, 'stone', F, u - 0.46, u + 0.46, 11.28, 11.77, 0.0, 0.39, marble);
    }
    sash(out, F, x, 5.0, 2.37, 4.58, level, true, shaded);
    fbox(out, 'stone', F, x - 0.75, x + 0.75, 5.1, 5.77, 0.085, 0.39, marble);
    if (level > 0) {
      // Each niche holds a simplified exterior statue and a stone pedestal.
      const sides = level < 2 ? 7 : 10;
      lathe(
        out,
        'stone',
        [x, 40.74],
        roundProfile([
          [5.77, 0.31],
          [6.22, 0.32],
          [6.48, 0.39],
          [6.82, 0.29],
          [7.51, 0.36],
          [7.72, 0.28],
        ]),
        sides,
        marble,
      );
      sphere(out, 'stone', [x + 0.037, 7.94, 40.76], [0.23, 0.28, 0.205], highlight, 9, 5);
    }
  }
}

function columns(out, level) {
  const shafts =
    level === 0
      ? [
          [landing, 0.6],
          [10.37, 0.49],
        ]
      : level === 1
        ? [
            [landing, 0.6],
            [landing + 0.16, 0.6],
            [landing + 0.43, 0.5],
            [9.73, 0.435],
            [10.37, 0.58],
          ]
        : [
            [landing, 0.6],
            [landing + 0.17, 0.6],
            [landing + 0.25, 0.52],
            [landing + 0.43, 0.5],
            [5.5, 0.465],
            [9.71, 0.425],
            [9.78, 0.48],
            [9.97, 0.475],
            [10.15, 0.54],
            [10.37, 0.58],
          ];
  for (let j = 0; j < 12; j++) {
    const x = center - 14.5 + (29 * j) / 11;
    lathe(out, 'stone', [x, 39.65], roundProfile(shafts), [6, 8, 12, 14][level], marble, {
      capTop: false,
    });
    if (level === 0) continue;
    fbox(out, 'stone', portico, x - 0.59, x + 0.59, 10.32, 10.48, -0.58, 0.58, marble);
    if (level < 2) continue;
    const n = level === 2 ? 5 : 8;
    for (let k = 0; k < n; k++) {
      const a = (k * Math.PI * 2) / n;
      const leaf = (r, y) => [x + r * Math.cos(a), y, 39.65 + r * Math.sin(a)];
      beam(out, 'stone', leaf(0.459, 9.83), leaf(0.56, 10.2), 0.13, 0.069, highlight);
    }
  }
}

function entablature(out, level) {
  const f = facade([0, 34.03], [1, 0]);
  for (const x of [-7.9, -3.5, 0.9, 5.3, 9.7, 14.1]) {
    sash(out, f, x, landing + 0.1, 1.94, 6.04, level, false, wood);
    if (level > 0) {
      sash(out, f, x, 7.85, 1.55, 1.48, level);
      fbox(out, 'stone', f, x - 1.32, x + 1.32, 7.88, 8.1, -0.02, 0.23, marble);
    }
  }
  const bands = [
    [10.32, 10.79, 0.42, marble],
    [10.79, 11.23, 0.4, wall],
    [11.23, 11.49, 0.71, marble],
    [11.49, 11.88, 0.9, highlight],
  ];
  for (const [lo, hi, d, tint] of bands)
    fbox(out, 'stone', portico, -12.98, 19.1, lo, hi, -5.73, d, tint, { bottom: true });
  if (level > 1)
    for (let i = 0; i < 53; i++) {
      const x = -12.95 + i * 0.604;
      fbox(out, 'stone', portico, x, x + 0.2, 11.17, 11.39, 0.39, 0.69, marble);
    }
}

function panelRail(out, level) {
  for (const [lo, hi] of [
    [-12.96, center - 3.56],
    [center + 3.56, 19.08],
  ]) {
    fbox(out, 'stone', portico, lo, hi, 11.89, 12.1, 0.11, 0.53, marble);
    fbox(out, 'stone', portico, lo, hi, 12.76, 12.98, 0.08, 0.56, marble);
    const n = 5;
    const pitch = (hi - lo) / n;
    for (let i = 0; i <= n; i++) {
      const x = lo + pitch * i;
      fbox(out, 'stone', portico, x - 0.17, x + 0.17, 12.02, 12.81, 0.11, 0.53, marble);
      if (i === n || level === 0) continue;
      const a = x + 0.19,
        b = x + pitch - 0.19;
      for (const sign of [-1, 1]) {
        const p1 = portico.P(a, 12.45 - sign * 0.25, 0.38);
        const p2 = portico.P(b, 12.45 + sign * 0.25, 0.38);
        beam(out, 'stone', p1, p2, 0.052, 0.08, marble);
      }
      if (level > 1) {
        const m = (a + b) / 2;
        const diamond = [
          [a + 0.16, 12.45],
          [m, 12.69],
          [b - 0.16, 12.45],
          [m, 12.21],
        ];
        for (let j = 0; j < diamond.length; j++)
          beam(
            out,
            'stone',
            portico.P(...diamond[j], 0.41),
            portico.P(...diamond[(j + 1) % diamond.length], 0.41),
            0.049,
            0.079,
            marble,
          );
      }
    }
  }
}

function clockAttic(out, level) {
  fbox(out, 'stone', portico, center - 3.57, center + 3.57, 11.88, 13.14, -0.31, 0.63, marble);
  fbox(out, 'stone', portico, center - 1.43, center + 1.43, 12.93, 14.05, -0.18, 0.66, marble);
  const disk = (radius, d, steps, tint) => {
    const ring = Array.from({ length: steps }, (_, i) => {
      const a = (Math.PI * 2 * i) / steps;
      return portico.P(center + radius * Math.cos(a), 13.0 + radius * Math.sin(a), d);
    });
    fan(out, 'detail', ring, tint);
  };
  disk(0.865, 0.679, 14, gold);
  disk(0.757, 0.694, 14, clock);
  if (level === 0) return;
  for (const [dx, dy] of [
    [0.39, 0.31],
    [-0.105, 0.48],
  ])
    beam(
      out,
      'detail',
      portico.P(center, 13.0, 0.703),
      portico.P(center + dx, 13.0 + dy, 0.701),
      0.044,
      0.035,
      gold,
    );
  if (level > 1)
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const tick = (r) => portico.P(center + r * Math.sin(a), 13.0 + r * Math.cos(a), 0.704);
      beam(out, 'detail', tick(0.59), tick(0.68), 0.035, 0.028, gold);
    }

  for (const sign of [-1, 1]) {
    const x = center + sign * 1.87;
    sphere(out, 'stone', [x + sign * 0.47, 13.34, 39.83], [0.82, 0.37, 0.34], marble, 10, 5);
    sphere(out, 'stone', [x, 13.83, 39.86], [0.39, 0.61, 0.33], marble, 9, 5);
    sphere(out, 'stone', [x - sign * 0.08, 14.43, 39.86], [0.2, 0.25, 0.2], highlight, 8, 5);
  }
  beam(
    out,
    'detail',
    portico.P(center, 14.0, 0.02),
    portico.P(center, 17.95, 0.02),
    0.055,
    0.062,
    lightGray,
  );
  const p = (u, y) => portico.P(center + u, y, 0.058 + 0.14 * Math.sin(u * 2.6));
  for (const [lo, hi, color] of [
    [16.86, 17.24, rgb('b2a047')],
    [17.24, 17.63, rgb('4c779c')],
  ])
    for (const [a, b] of [
      [0, 0.72],
      [0.72, 1.47],
    ]) {
      const flag = [
        p(a, lo - 0.21 * a),
        p(b, lo - 0.21 * b),
        p(b, hi - 0.21 * b),
        p(a, hi - 0.21 * a),
      ];
      quad4(out, 'detail', ...flag, color);
      quad4(out, 'detail', ...flag.slice().reverse(), color);
    }
}

function build(out, level) {
  exterior(out, level);
  endBlocks(out, level);
  stair(out, level);
  columns(out, level);
  entablature(out, level);
  panelRail(out, level);
  clockAttic(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'odesa-city-hall-model.mjs';
const camera = [-78, 39, 123];
const lookAt = [2.8, 7.5, 13.0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Odesa City Hall',
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Odesa’s former Old Stock Exchange with its white Corinthian colonnade, pierced parapet, historic clock and curved rear bay.',
  camera,
  lookAt,
  sunDirection: [-42, 54, 60],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Named mapped footprint of City Hall and its attached wing.',
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'stone_limestone_raw',
    'stone_granite',
    'metal_standing_seam',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'dumska-square-clock-and-corinthian-columns',
      position: [-25, 8.1, 85],
      lookAt: [2.8, 9.05, 38.0],
    },
    { name: 'upper-parapet-and-sculpture', position: [13, 24, 70], lookAt: [3.1, 10.4, 36.8] },
    { name: 'attached-wing-and-curved-rear-bay', position: [87, 36, -87], lookAt: [2.5, 8, 6.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'odesa-city-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.071, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
