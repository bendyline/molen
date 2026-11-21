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
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  stucco: 'e1ccaa',
  stone: 'c0ab90',
  trim: 'ead6b9',
  underside: 'c9ae88',
  terracotta: '875649',
  terracottaDark: '744e46',
  glass: '4c5751',
  door: '786652',
  iron: '49423a',
  clock: '3e3932',
  dial: 'e8d2ac',
  finial: '695a4c',
});
const surfaces = {
  stucco: surface('wall', 'stucco', 0.94),
  stone: surface('foundation', 'stone_ashlar', 0.94),
  roof: surface('roof', 'tile_flat', 0.9),
  metal: surface('trim', 'metal_painted', 0.77, 0.16),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.41, metallic: 0.05 },
  solid: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87 },
};
const floor = 0.32;
const lower = (p) => Math.min(floor - 0.38, grade(p) - 0.27);

function mass(out, ring, bottom, top, wall = colors.stucco) {
  shell(out, ring, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: 'stucco',
    roof: 'stucco',
    color: wall,
  });
}

function gabledRoof(out, { bounds: [x0, z0, x1, z1], inset, eave, ridge, lengthAxis }) {
  const trans = (a, y, b) => (lengthAxis === 'z' ? [a, y, b] : [b, y, a]);
  const [low, front, high, back] = lengthAxis === 'z' ? [x0, z0, x1, z1] : [z0, x0, z1, x1];
  const mid = (low + high) / 2;
  const p = trans(low, eave, front);
  const q = trans(high, eave, front);
  const r = trans(high, eave, back);
  const s = trans(low, eave, back);
  const a = trans(mid, ridge, front + inset);
  const b = trans(mid, ridge, back - inset);
  face(out, 'roof', [p, a, b, s], [0, 1, 0], colors.terracottaDark);
  face(out, 'roof', [q, r, b, a], [0, 1, 0], colors.terracotta);
  const slot = inset > 0 ? 'roof' : 'stucco';
  const tint = inset > 0 ? colors.terracotta : colors.stucco;
  const direction = inset > 0 ? [0, 1, 0] : lengthAxis === 'z' ? [0, 0, -1] : [-1, 0, 0];
  face(out, slot, [p, q, a], direction, tint);
  face(out, slot, [s, r, b], inset > 0 ? direction : direction.map((n) => -n), tint);
}

function archedWindow(out, level, w, u, low, spring, width, rise, detail = 'sash') {
  const trim = detail === 'sash' ? 0.15 : 0.19;
  arch(
    out,
    w,
    u,
    low,
    spring,
    width,
    rise,
    0.04,
    level,
    {
      inner: detail === 'door' ? colors.door : colors.glass,
      trim: colors.trim,
      width: trim,
    },
    { inner: 'glass', trim: 'solid' },
  );
  if (level >= 2) {
    const n = detail === 'louver' ? 5 : 3;
    for (let i = 1; i <= n; i++) {
      const y = mix(low, spring, i / (n + 1));
      panel(
        out,
        'metal',
        w,
        u - width + 0.03,
        u + width - 0.03,
        y - 0.038,
        y + 0.038,
        0.095,
        colors.iron,
      );
    }
    if (detail === 'sash')
      panel(out, 'solid', w, u - 0.034, u + 0.034, low, spring + rise - 0.07, 0.1, colors.trim);
    if (detail === 'door')
      panel(out, 'metal', w, u - 0.027, u + 0.027, low, spring, 0.11, colors.iron);
  }
}

function dial(out, level, w, center, height, radius, clock = false, offset = 0.095) {
  const n = [10, 14, 22, 32][level];
  const shape = (r, depth) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return w.p(center + r * Math.cos(a), height + r * Math.sin(a), depth);
    });
  face(out, 'solid', shape(radius + 0.14, offset - 0.018), w.normal, colors.trim);
  face(out, 'glass', shape(radius, offset), w.normal, clock ? colors.clock : colors.glass);
  if (level < 1) return;
  if (clock) {
    const spot = (a, r, y = height) =>
      w.p(center + r * Math.cos(a), y + r * Math.sin(a), offset + 0.052);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(out, 'solid', spot(a, radius * 0.73), spot(a, radius * 0.91), 0.07, 0.052, colors.dial);
    }
    beam(out, 'solid', spot(0, 0), spot(0.63, radius * 0.57), 0.075, 0.044, colors.dial);
    beam(out, 'solid', spot(0, 0), spot(2.13, radius * 0.77), 0.065, 0.044, colors.dial);
  } else if (level >= 2) {
    for (const f of [-0.47, 0, 0.47]) {
      const reach = radius * Math.sqrt(1 - f * f);
      const delta = radius * f;
      panel(
        out,
        'metal',
        w,
        center - reach,
        center + reach,
        height + delta - 0.03,
        height + delta + 0.03,
        offset + 0.054,
        colors.iron,
      );
      panel(
        out,
        'metal',
        w,
        center + delta - 0.03,
        center + delta + 0.03,
        height - reach,
        height + reach,
        offset + 0.057,
        colors.iron,
      );
    }
  }
}

function nave(out, level) {
  const x0 = d.nave[0][0];
  const x1 = d.nave[1][0];
  mass(out, d.outline, lower, d.eave);
  gabledRoof(out, {
    bounds: [x0 - 0.25, -6.0, x1 + 0.25, 23.84],
    inset: 0,
    eave: d.eave,
    ridge: d.ridge,
    lengthAxis: 'z',
  });
  gabledRoof(out, {
    bounds: [-20.05, -5.83, 20.08, 10.05],
    inset: 4.96,
    eave: d.eave + 0.035,
    ridge: d.wingRidge,
    lengthAxis: 'x',
  });
  gabledRoof(out, {
    bounds: [-4.69, -22.53, 4.23, -5.37],
    inset: 0,
    eave: d.eave - 0.14,
    ridge: 12.26,
    lengthAxis: 'z',
  });
  const walls = pairs(closed(d.outline));
  const sign = areaSign(d.outline);
  for (const [a, b] of walls) {
    const w = edge(a, b, sign);
    const n = Math.max(1, Math.round(w.length / 6.4));
    if (w.length < 4) continue;
    panel(out, 'stone', w, 0, w.length, floor - 0.2, floor + 0.46, 0.08, colors.stone);
    panel(out, 'solid', w, 0, w.length, d.eave - 0.36, d.eave - 0.08, 0.14, colors.trim);
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * w.length) / n;
      if (w.normal[2] > 0.7 && w.p(u, 0)[2] > 20 && Math.abs(w.p(u, 0)[0]) < 4) continue;
      if (level === 0 && i % 2) continue;
      const [x, , z] = w.p(u, 0, 0.16);
      const sill = Math.min(2.78, Math.max(1.62, grade([x, z]) + 0.24));
      archedWindow(out, level, w, u, sill, 5.31, Math.min(0.91, w.length / 5), 0.98);
      if (w.length > 6.5 && w.normal[2] > 0.4) dial(out, level, w, u, 7.27, 0.77);
      if (level >= 1) {
        const left = Math.max(0.11, u - w.length / (2 * n) + 0.25);
        panel(out, 'solid', w, left, left + 0.24, 0.36, d.eave - 0.36, 0.15, colors.trim);
      }
    }
  }
  const front = edge([x1 + 0.42, 23.84], [x0 - 0.42, 23.84]);
  for (const side of [-1, 1]) {
    const mid = front.length / 2;
    const outline = [
      [mid + side * 3, 9.0],
      [mid + side * 8, 9.0],
      [mid + side * 8, 9.43],
      [mid + side * 7.38, 9.93],
      [mid + side * 7.19, 10.49],
      [mid + side * 6.48, 10.86],
      [mid + side * 5.64, 11.79],
      [mid + side * 3, 13.86],
    ];
    face(
      out,
      'stucco',
      outline.map(([u, y]) => front.p(u, y, 0.14)),
      front.normal,
      colors.stucco,
    );
    if (level >= 1) {
      for (const [[u, y], [v, h]] of pairs(outline.slice(2)))
        beam(
          out,
          'solid',
          front.p(u, y + 0.03, 0.25),
          front.p(v, h + 0.03, 0.25),
          0.16,
          0.16,
          colors.trim,
        );
    }
  }
}

function clockTower(out, level) {
  const [x, z] = d.spireCenter;
  const yFinial = d.tip;
  const clockY = yFinial * 0.478;
  const belfryLow = yFinial * 0.55;
  const belfryTop = yFinial * 0.675;
  const spireStart = yFinial * 0.732;
  mass(out, d.tower, lower, clockY - 2, colors.stucco);
  const w = edge(d.tower[2], d.tower[3]);
  const u = w.length / 2;
  archedWindow(out, level, w, u, floor, 2.42, 1.08, 1.02, 'door');
  archedWindow(out, level, w, u, 6.48, 10.39, 0.78, 0.83);
  if (level >= 1) {
    for (const p of [u - 0.97, u + 0.97]) archedWindow(out, level, w, p, 3.94, 5.06, 0.31, 0.32);
    for (const a of [0.42, w.length - 0.88])
      panel(out, 'solid', w, a, a + 0.43, floor, clockY - 2.1, 0.28, colors.trim);
  }
  for (const y of [6.06, clockY - 3.09, clockY - 2.17]) {
    block(out, 'solid', x - 4.25, y, 19.51, 8.5, 0.22, 8.43, colors.trim);
  }

  const shoulders = [
    [clockY - 2, 3.85],
    [clockY - 1.3, 3.84],
    [clockY - 0.63, 3.42],
    [clockY + 1.45, 2.5],
    [belfryLow, 2.15],
  ];
  loft(
    out,
    'stucco',
    shoulders.map(([y, r]) => radialRing(y, r, r, 8, [x, z], Math.PI / 8)),
    colors.stucco,
  );
  const clockFace = edge([x + 2.29, z + 3.28], [x - 2.29, z + 3.28]);
  face(
    out,
    'stucco',
    [
      [0, clockY - 1.8],
      [4.58, clockY - 1.8],
      [4.19, clockY],
      [3.62, clockY + 1.22],
      [2.29, clockY + 1.83],
      [1.02, clockY + 1.24],
      [0.38, clockY],
    ].map(([a, y]) => clockFace.p(a, y, 0.015)),
    clockFace.normal,
    colors.stucco,
  );
  dial(out, level, clockFace, 2.29, clockY + 0.05, 1.3, true, 0.092);

  const sides = 8;
  const rings = [
    [belfryLow, 2.07],
    [belfryLow + 0.16, 2.44],
    [belfryTop - 0.3, 2.45],
    [belfryTop - 0.17, 2.76],
    [belfryTop + 0.15, 2.54],
  ];
  loft(
    out,
    'stucco',
    rings.map(([y, r]) => radialRing(y, r, r, sides, [x, z], Math.PI / 8)),
    colors.stucco,
  );
  const lantern = radialRing(belfryLow, 2.45, 2.45, sides, [x, z], Math.PI / 8).map(
    ([xx, , zz]) => [xx, zz],
  );
  for (const [a, b] of pairs(closed(lantern))) {
    const w = edge(a, b, areaSign(lantern));
    archedWindow(
      out,
      level,
      w,
      w.length / 2,
      belfryLow + 0.54,
      belfryTop - 1.11,
      0.42,
      0.54,
      'louver',
    );
    if (level >= 2) {
      panel(out, 'solid', w, 0.045, 0.18, belfryLow + 0.23, belfryTop - 0.19, 0.103, colors.trim);
      panel(
        out,
        'solid',
        w,
        w.length - 0.18,
        w.length - 0.045,
        belfryLow + 0.23,
        belfryTop - 0.19,
        0.103,
        colors.trim,
      );
    }
  }
  const needles = [
    [belfryTop + 0.12, 2.15],
    [spireStart - 0.36, 1.89],
    [spireStart - 0.17, 2.13],
    [spireStart + 0.14, 1.85],
    [spireStart + 0.87, 1.57],
    [yFinial - 1.97, 0.26],
    [yFinial - 1.65, 0.27],
    [yFinial - 1.39, 0.14],
  ];
  loft(
    out,
    'stucco',
    needles.map(([y, r]) => radialRing(y, r, r, sides, [x, z], Math.PI / 8)),
    colors.trim,
  );
  beam(out, 'metal', [x, yFinial - 1.5, z], [x, yFinial, z], 0.11, 0.11, colors.finial);
  if (level >= 1) {
    beam(
      out,
      'metal',
      [x - 0.29, yFinial - 0.51, z],
      [x + 0.29, yFinial - 0.51, z],
      0.078,
      0.062,
      colors.finial,
    );
    for (const dx of [-1, 1]) {
      for (const dz of [-1, 1]) {
        for (const [bottom, y, distance, radius] of [
          [clockY - 1.56, clockY + 0.65, 2.36, 0.37],
          [belfryTop - 0.18, belfryTop + 0.18, 1.66, 0.24],
        ]) {
          const p = [x + dx * distance, z + dz * distance];
          loft(
            out,
            'solid',
            [
              [bottom, radius * 1.17],
              [y, radius],
              [y + 0.57, radius * 0.61],
              [y + 0.95, radius * 0.14],
            ].map(([h, r]) => radialRing(h, r, r, level === 3 ? 10 : 6, p)),
            colors.trim,
          );
        }
      }
    }
  }
}

function frontEnclosure(out, level) {
  const z = d.forecourt[0][1],
    [mx, mz] = d.memorial;
  const deep = grade([mx, mz]);
  block(out, 'stone', mx - 1.03, deep - 0.21, mz - 0.92, 2.06, 0.46, 1.84, colors.stone);
  block(out, 'stone', mx - 0.72, deep + 0.25, mz - 0.66, 1.44, 1.28, 1.32, colors.stone);
  block(out, 'solid', mx - 0.86, deep + 1.52, mz - 0.79, 1.72, 0.24, 1.58, colors.trim);
  const runs = [
    [-27, -14],
    [-14, -5.3],
    [-5.3, 4.6],
    [4.6, 12.3],
    [12.3, 27.5],
  ];
  for (const [a, b] of runs) {
    const w = edge([b, z], [a, z]);
    const l = w.length;
    const y = [a, b].map((x) => grade([x, z]));
    const bottom = Math.min(...y) - 0.26;
    const top = Math.max(...y) + (b - a >= 12 ? 1.02 : 0.34);
    block(out, 'stone', a, bottom, z - 0.24, b - a, top - bottom, 0.48, colors.stone);
    block(out, 'stucco', a, top - 0.028, z - 0.29, b - a, 0.14, 0.58, colors.trim);
    const wide = b - a >= 12;
    if (wide || level === 0) continue;
    for (const v of [0, l]) {
      const [x, , zz] = w.p(v, 0);
      block(
        out,
        'stucco',
        x - 0.32,
        bottom,
        zz - 0.33,
        0.64,
        top - bottom + 1.28,
        0.67,
        colors.stucco,
      );
      block(out, 'solid', x - 0.39, top + 1.23, zz - 0.4, 0.78, 0.12, 0.8, colors.trim);
    }
    const bars = level === 1 ? 8 : level === 2 ? 14 : 20;
    for (let i = 1; i < bars; i++) {
      const u = (l * i) / bars;
      const h = top + 1.02 + 0.16 * Math.sin((i / bars) * Math.PI);
      beam(out, 'metal', w.p(u, top, 0.02), w.p(u, h, 0.02), 0.05, 0.05, colors.iron);
    }
    for (const h of [top + 0.15, top + 0.9])
      beam(out, 'metal', w.p(0.33, h, 0.023), w.p(l - 0.33, h, 0.023), 0.053, 0.055, colors.iron);
  }
}

function build(out, level) {
  nave(out, level);
  clockTower(out, level);
  frontEnclosure(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'dutch-reformed-church-wellington-model.mjs';
const camera = [60, 35, 93];
const lookAt = [0, 13.4, 7];
const errors = { district: 0.51, street: 0.17, closeup: 0.064 };
export const wellingtonChurchAsset = {
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
    'The mapped NG Moederkerk walls tie the nave to the original Wellington terrain, and the NGI spire point constrains the tower top.',
  brief:
    'Wellington’s Dutch Reformed Mother Church with a ring-wall entrance, pale clock tower and needle spire, ruddy cross roofs and long arched windows.',
  camera,
  lookAt,
  sunDirection: [55, 96, 74],
  mediumFiContext: {
    scale: 1,
    groundY: -0.25,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.94,
    basis: 'Exact named native church outline, including the rounded projections of the nave arms.',
  },
  embeddedCanonicalGraphs: ['stucco', 'tile_flat', 'stone_ashlar', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'clock-tower-from-church-street', position: [1, 11, 81], lookAt: [-1, 15, 17] },
    { name: 'cross-roofs-and-vestry', position: [-64, 36, -56], lookAt: [0, 11, 2] },
    { name: 'ring-wall-and-main-portal', position: [17, 5.25, 50], lookAt: [0, 5.75, 25.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'wellington-church-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.08,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
};
