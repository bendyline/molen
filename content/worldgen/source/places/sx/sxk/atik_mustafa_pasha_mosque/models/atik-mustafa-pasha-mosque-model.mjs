import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  stone: 'ae9e88',
  ashlar: 'c3b7a0',
  pale: 'cbbfa7',
  rubble: 'a29683',
  brick: '9d7462',
  arch: 'ab7c65',
  mortar: 'afa594',
  dark: '4f5856',
  roof: '7d8482',
  roofSeam: '909795',
  wood: '897967',
  woodFrame: '6d5e4f',
  woodPale: 'a39178',
  trim: '827259',
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.95),
  rubble: surface('foundation', 'stone_limestone_weathered', 0.97),
  brick: surface('wall', 'brick_longformat', 0.94),
  lead: surface('roof', 'metal_standing_seam', 0.85, 0.13),
  tile: surface('roof', 'tile_ceramic', 0.9),
  wood: surface('trim', 'wood_plain', 0.93),
  metal: surface('trim', 'metal_bronze_cast', 0.83, 0.12),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};
const floor = 0.45;
const base = (p) => Math.min(floor - 0.17, grade(p) - 0.34);
const eave = 7.04;
const sides = (poly) => pairs(closed(poly)).map(([a, b]) => edge(a, b, areaSign(poly)));
const mass = (out, poly, bottom, top, slot, color, roof = 'lead', roofColor = c.roof) =>
  shell(out, poly, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: slot,
    roof,
    color,
    roofColor,
  });
const ring = (p, r, n) => radialRing(0, r, r, n, p, Math.PI / n).map(([x, , z]) => [x, z]);
const bands = (out, p, profile, n, slot, color, cap = true) =>
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, p, Math.PI / n)),
    color,
    { cap },
  );

function opening(out, w, u, low, high, width, level, brick = false) {
  const y = high - 0.25;
  arch(
    out,
    w,
    u,
    low,
    y,
    width * 0.5,
    0.25,
    0.081,
    Math.max(0, level - 1),
    { inner: c.dark, trim: brick ? c.arch : c.pale, width: 0.103 },
    { inner: 'glass', trim: brick ? 'brick' : 'stone' },
  );
  if (level >= 2) {
    panel(out, 'metal', w, u - 0.028, u + 0.028, low, y + 0.06, 0.119, c.mortar);
    panel(
      out,
      'metal',
      w,
      u - width * 0.48,
      u + width * 0.48,
      mix(low, y, 0.66) - 0.024,
      mix(low, y, 0.66) + 0.024,
      0.118,
      c.mortar,
    );
    trimBlock(
      out,
      'stone',
      w,
      u - width * 0.55 - 0.055,
      u + width * 0.55 + 0.055,
      low - 0.11,
      low - 0.02,
      0.099,
      0.146,
      c.pale,
    );
  }
}
function historicWalls(out, level) {
  const body = rect(...d.hall);
  mass(out, body, base, floor + 0.32, 'rubble', c.rubble);
  mass(out, body, floor + 0.28, eave, 'stone', c.stone);
  for (const [i, w] of sides(body).entries()) {
    trimBlock(out, 'stone', w, 0, w.length, eave - 0.21, eave + 0.067, 0.018, 0.149, c.pale);
    if (i !== 0 && i !== 2) continue;
    const axis = w.length * 0.5;
    for (const j of [-1, 0, 1]) {
      const u = axis + j * 3.53;
      if (level > 0)
        arch(
          out,
          w,
          u,
          1.13,
          3.2,
          1.47,
          1.02,
          0.031,
          level === 1 ? 0 : 1,
          { inner: c.mortar, trim: c.arch, width: 0.12 },
          { inner: 'stone', trim: 'brick' },
        );
      opening(out, w, u, 1.64, 3.52, 1.03, level, true);
      if (level >= 1) opening(out, w, u, 4.43, 6.25, 0.82, level, true);
    }
    const bandYs = level > 1 ? [1.06, 1.94, 2.91, 3.96, 4.54, 5.44, 6.31] : [2.84, 3.98, 6.31];
    for (const y of bandYs) panel(out, 'brick', w, 0, w.length, y, y + 0.105, 0.016, c.brick);
    if (level >= 2) {
      for (const u of [axis - 5.78, axis - 1.77, axis + 1.77, axis + 5.78])
        trimBlock(out, 'stone', w, u - 0.129, u + 0.129, 0.86, eave - 0.34, 0.016, 0.083, c.ashlar);
    }
  }
}
function roofVault(out, left, right, front, back, spring, rise, level, axial, kind) {
  const cuts = [4, 6, 10, 14][level];
  const shape = (end, i) => {
    const t = (i * Math.PI) / cuts,
      h = spring + rise * Math.sin(t);
    return axial
      ? [end, h, mix(front, back, (1 + Math.cos(t)) * 0.5)]
      : [mix(left, right, (1 + Math.cos(t)) * 0.5), h, end];
  };
  const a = axial ? left : front,
    b = axial ? right : back;
  for (let i = 0; i < cuts; i++) {
    const t = ((i + 0.5) * Math.PI) / cuts;
    face(
      out,
      kind,
      [shape(a, i), shape(a, i + 1), shape(b, i + 1), shape(b, i)],
      axial ? [0, Math.sin(t), Math.cos(t)] : [Math.cos(t), Math.sin(t), 0],
      c.roof,
    );
  }
  const rim = Array.from({ length: cuts + 1 }, (_, i) => shape(b, i));
  const start = Array.from({ length: cuts + 1 }, (_, i) => shape(a, i));
  face(out, 'stone', rim, axial ? [1, 0, 0] : [0, 0, 1], c.stone);
  face(out, 'stone', start, axial ? [-1, 0, 0] : [0, 0, -1], c.stone);
}
function crossRoof(out, level) {
  const lo = 7.0,
    spring = 8.97;
  const xRun = rect(-6.61, -2.71, 6.68, 2.87);
  const zRun = rect(-2.92, -7.66, 2.96, 7.68);
  mass(out, xRun, lo, spring, 'stone', c.stone);
  mass(out, zRun, lo, spring, 'stone', c.stone);
  roofVault(out, -6.68, 6.75, -2.76, 2.92, spring, 1.63, level, true, 'lead');
  roofVault(out, -2.98, 3.02, -7.71, 7.74, spring, 1.54, level, false, 'lead');
  if (level >= 1) {
    for (const sign of [-1, 1]) {
      const w =
        sign === 1 ? edge([2.94, 7.75], [-2.94, 7.75]) : edge([-2.94, -7.72], [2.94, -7.72]);
      const mid = w.length * 0.5;
      for (const u of [mid - 1.09, mid, mid + 1.09])
        opening(out, w, u, 7.72, 9.2, u === mid ? 0.63 : 0.49, level, true);
      panel(out, 'brick', w, 0, w.length, 7.35, 7.52, 0.027, c.brick);
    }
  }
  const d0 = d.centerDome,
    n = [12, 16, 24, 32][level],
    low = 10.2,
    top = 14.14;
  const riser = ring(d0, 4.15, 12);
  mass(out, riser, 9.57, low + 0.09, 'stone', c.ashlar);
  const profile =
    level === 0
      ? [
          [0, 1],
          [0.65, 0.765],
          [1, 0.033],
        ]
      : [
          [0, 1],
          [0.3, 0.966],
          [0.57, 0.84],
          [0.78, 0.643],
          [0.93, 0.36],
          [1, 0.032],
        ];
  const p = profile.map(([t, r]) =>
    radialRing(mix(low, top, t), d.domeRadius * r, d.domeRadius * r, n, d0, Math.PI / n),
  );
  loft(out, 'lead', p, c.roof);
  if (level >= 2) {
    for (let i = 0; i < n; i += 2) {
      const a = ((2 * i + 1) * Math.PI) / n;
      const pt = (t, r, o) => [
        d0[0] + (d.domeRadius * r + 0.029) * Math.cos(a + o),
        mix(low, top, t) + 0.025,
        d0[1] + (d.domeRadius * r + 0.029) * Math.sin(a + o),
      ];
      for (const [[t, r], [u, v]] of pairs(profile))
        face(
          out,
          'lead',
          [pt(t, r, -0.006), pt(t, r, 0.006), pt(u, v, 0.006), pt(u, v, -0.006)],
          [Math.cos(a), 1, Math.sin(a)],
          c.roofSeam,
        );
    }
  }
  bands(
    out,
    d0,
    [
      [top - 0.08, 0.095],
      [top + 0.17, 0.136],
      [top + 0.34, 0.08],
      [top + 0.59, 0.021],
    ],
    level > 1 ? 8 : 4,
    'metal',
    c.trim,
  );
}
function apses(out, level) {
  for (const [i, [p, wide, extent, top]] of [
    [-5.23, 1.93, 2.23, 5.28],
    [0.09, 2.68, 2.98, 7.21],
    [5.25, 1.85, 2.22, 5.28],
  ].entries()) {
    const a = 6.37,
      b = a + extent,
      m = wide;
    const poly = [
      [a, p - m],
      [a + extent * 0.49, p - m],
      [b, p - m * 0.55],
      [b, p + m * 0.55],
      [a + extent * 0.49, p + m],
      [a, p + m],
    ];
    mass(out, poly, base, top, 'stone', c.stone);
    const w = sides(poly);
    for (const [j, v] of w.entries()) {
      if (j === 5) continue;
      trimBlock(out, 'stone', v, 0, v.length, top - 0.19, top + 0.025, 0.008, 0.103, c.pale);
      if (level >= 1) {
        for (const y of [1.26, 2.18, 3.44, 4.37].filter((x) => x < top - 0.23))
          panel(out, 'brick', v, 0, v.length, y, y + 0.1, 0.024, c.brick);
        if (j === 2 || i === 1)
          opening(
            out,
            v,
            v.length * 0.5,
            1.84,
            Math.min(top - 0.69, 4.3),
            Math.min(0.67, v.length * 0.45),
            level,
            true,
          );
      }
    }
    const ridge = [a + 0.22, top + (i === 1 ? 1.47 : 1.08), p];
    for (const [[x, z], [u, v]] of pairs(poly))
      face(out, 'lead', [[x, top, z], [u, top, v], ridge], up, c.roof);
  }
}
function entrance(out, level) {
  const [left, front, right, back] = d.porch;
  const porch = rect(left, front, right, back);
  const hi = 3.87,
    roof = 4.53;
  mass(out, porch, base, floor + 0.12, 'rubble', c.rubble, 'rubble', c.rubble);
  mass(out, porch, floor + 0.09, hi, 'wood', c.wood, 'lead', c.roof);
  const w = edge([left, back], [left, front]);
  const mid = w.length * 0.5;
  for (const [i, u] of [1.25, 3.24, 5.21, mid, 9.84, 11.79, 13.6].entries()) {
    if (i === 3) {
      panel(out, 'wood', w, u - 0.71, u + 0.71, floor + 0.22, 2.85, 0.072, c.woodFrame);
      panel(out, 'glass', w, u - 0.53, u + 0.53, floor + 0.29, 2.77, 0.1, c.dark);
      panel(out, 'wood', w, u - 0.031, u + 0.031, floor + 0.32, 2.73, 0.119, c.woodPale);
      continue;
    }
    panel(out, 'glass', w, u - 0.57, u + 0.57, 1.62, 3.17, 0.051, i % 2 === 0 ? c.dark : c.mortar);
    trimBlock(out, 'wood', w, u - 0.69, u - 0.563, 1.52, 3.28, 0.016, 0.09, c.woodFrame);
    trimBlock(out, 'wood', w, u + 0.563, u + 0.69, 1.52, 3.28, 0.016, 0.09, c.woodFrame);
    if (level > 0) panel(out, 'wood', w, u - 0.031, u + 0.031, 1.62, 3.17, 0.076, c.woodPale);
  }
  for (const y of [1.48, 3.23, 3.57])
    trimBlock(out, 'wood', w, 0, w.length, y, y + 0.13, 0.018, 0.13, c.woodPale);
  if (level >= 2) {
    for (let i = 1; i < 31; i++) {
      const u = (w.length * i) / 31;
      panel(out, 'wood', w, u - 0.021, u + 0.021, floor + 0.19, 1.46, 0.043, c.woodFrame);
    }
  }
  const z0 = front - 0.19,
    z1 = back + 0.19;
  face(
    out,
    'tile',
    [
      [left - 0.26, hi - 0.025, z0],
      [left - 0.26, hi - 0.025, z1],
      [right + 0.26, roof, z1],
      [right + 0.26, roof, z0],
    ],
    up,
    c.roof,
  );
  beam(
    out,
    'wood',
    [left - 0.24, hi - 0.11, z0],
    [left - 0.24, hi - 0.11, z1],
    0.12,
    0.14,
    c.woodFrame,
  );
  const stepCount = level > 0 ? 4 : 2;
  const openingZ = (z0 + z1) * 0.5;
  for (let i = 0; i < stepCount; i++) {
    const x0 = left - 1.48 + (i * 1.48) / stepCount,
      x1 = left - 1.48 + ((i + 1) * 1.48) / stepCount;
    const p = (openingZ, x) => grade([x, openingZ]);
    const h = mix(p(openingZ, left - 1.55) + 0.07, floor + 0.1, (i + 1) / stepCount);
    const y = Math.min(h - 0.11, p(openingZ, x0) - 0.2);
    block(out, 'rubble', x0, y, openingZ - 1.09, x1 - x0 + 0.008, h - y, 2.18, c.rubble);
  }
}
function tower(out, level) {
  const p = d.minaret,
    f = grade(p) + 0.19;
  const y = (h) => h + f;
  const n = [6, 8, 12, 18][level];
  const pedestal = ring(p, 1.17, 8);
  mass(out, pedestal, base, y(4.11), 'stone', c.ashlar, 'stone', c.ashlar);
  bands(
    out,
    p,
    [
      [y(3.78), 1.16],
      [y(4.32), 1.12],
      [y(5.34), 0.67],
      [y(5.58), 0.53],
      [y(17.02), 0.49],
    ],
    n,
    'stone',
    c.ashlar,
    false,
  );
  if (level >= 2) {
    for (const w of sides(pedestal)) {
      if (w.normal[0] > 0.7) continue;
      trimBlock(out, 'stone', w, 0.05, w.length - 0.04, 1.18 + f, 1.29 + f, 0.023, 0.1, c.pale);
    }
  }
  const balcony =
    level === 0
      ? [
          [16.98, 0.49],
          [17.76, 0.98],
          [18.22, 0.96],
        ]
      : [
          [16.98, 0.5],
          [17.11, 0.65],
          [17.34, 0.79],
          [17.48, 0.92],
          [17.69, 0.98],
          [17.8, 1.03],
          [18.19, 1.015],
          [18.24, 1.04],
        ];
  bands(
    out,
    p,
    balcony.map(([h, r]) => [y(h), r]),
    n,
    'stone',
    c.pale,
  );
  bands(
    out,
    p,
    [
      [y(17.64), 0.445],
      [y(20.11), 0.414],
      [y(20.25), 0.469],
    ],
    n,
    'stone',
    c.ashlar,
  );
  if (level >= 2) {
    for (const w of sides(ring(p, 0.43, n))
      .filter((w) => w.normal[0] < -0.82)
      .slice(0, 1))
      opening(out, w, w.length * 0.5, y(17.87), y(18.87), 0.23, level);
  }
  bands(
    out,
    p,
    [
      [y(20.22), 0.48],
      [y(20.43), 0.455],
      [y(22.69), 0.049],
    ],
    n,
    'stone',
    c.pale,
  );
  bands(
    out,
    p,
    [
      [y(22.67), 0.072],
      [y(22.92), 0.103],
      [y(d.minaretHeight), 0.026],
    ],
    level >= 2 ? 8 : 4,
    'metal',
    c.trim,
  );
}
function build(out, level) {
  historicWalls(out, level);
  crossRoof(out, level);
  apses(out, level);
  entrance(out, level);
  tower(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'atik-mustafa-pasha-mosque-model.mjs';
const camera = [-46, 31, 42],
  lookAt = [0.1, 8, 0.4];
const errors = { district: 0.47, street: 0.17, closeup: 0.071 };
export const atikMustafaPashaMosqueAsset = {
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
  groundContactBasis:
    'Original regional elevation immediately outside the western timber entrance.',
  brief:
    'Atik Mustafa Pasha Mosque with a low lead dome, cross-shaped upper roof, brick-striped faceted apses, timber vestibule and one stone minaret.',
  camera,
  lookAt,
  sunDirection: [-48, 103, -69],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named current four-sided footprint covering the standing mosque and its porch.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'timber-porch-and-stone-minaret', position: [-28, 9, 12], lookAt: [-1, 6, 1] },
    { name: 'three-polygonal-apses', position: [29, 11, 17], lookAt: [3, 6, 0] },
    { name: 'windowless-dome-and-cross-roof', position: [20, 29, -28], lookAt: [-0.4, 8, 0.4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'atik-mustafa-pasha-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.95,
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
