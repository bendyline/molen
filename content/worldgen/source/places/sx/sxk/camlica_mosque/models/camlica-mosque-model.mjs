import { readFileSync } from 'node:fs';
import {
  beam,
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
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const terrain = floorSampler(read('terrain-grid.json'));
const terrace = 23.9;
const color = palette({
  ashlar: 'd8cdb4',
  pale: 'e6d8bc',
  base: 'bab4a2',
  shadow: 'a9a294',
  joints: 'bdb39e',
  lead: '6f7b7e',
  leadDark: '59666a',
  leadLight: '788386',
  glass: '59645d',
  metal: 'ac9259',
  roofStone: 'c8bda4',
  court: 'c9c2ae',
  courtBand: 'a89b83',
});
const neutral = (slot, roughness, metallic = 0) => ({
  slot,
  localRef: 'palette:#ffffff',
  roughness,
  metallic,
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.94),
  paving: surface('foundation', 'stone_limestone', 0.94),
  lead: neutral('roof', 0.88, 0.12),
  trim: neutral('trim', 0.84),
  glass: neutral('window', 0.48),
  gold: { ...neutral('trim', 0.63, 0.55), localRef: 'palette:#fffefb' },
};
const upward = [0, 1, 0];

function turn(out, slot, center, radii, profile, sides, tint, start = 0, sweep = 2 * Math.PI) {
  const p = ([y, scale], a) => [
    center[0] + Math.cos(a) * radii[0] * scale,
    terrace + y,
    center[1] + Math.sin(a) * radii[1] * scale,
  ];
  for (const [low, high] of pairs(profile)) {
    for (let i = 0; i < sides; i++) {
      const a = start + (sweep * i) / sides;
      const b = start + (sweep * (i + 1)) / sides;
      const angle = (a + b) / 2;
      face(
        out,
        slot,
        [p(low, a), p(low, b), p(high, b), p(high, a)],
        [Math.cos(angle), 0.18, Math.sin(angle)],
        tint,
      );
    }
  }
}

function dome(
  out,
  center,
  rx,
  rz,
  base,
  height,
  sides,
  count,
  start = 0,
  sweep = 2 * Math.PI,
  tint = color.lead,
) {
  const profile = Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / (2 * count);
    return [base + height * Math.sin(t), Math.max(Math.cos(t), 0.009)];
  });
  turn(out, 'lead', center, [rx, rz], profile, sides, tint, start, sweep);
}

function podium(out, level) {
  shell(out, d.outline, (p) => Math.min(terrain(p) - 1.3, terrace - 0.65), terrace, {
    wall: 'paving',
    roof: 'paving',
    color: color.base,
    roofColor: color.court,
  });
  if (level === 0) return;
  const order = areaSign(d.outline);
  for (const [a, b] of pairs(closed(d.outline))) {
    const w = edge(a, b, order);
    panel(out, 'trim', w, 0, w.length, terrace - 1.1, terrace + 0.04, 0.11, color.pale);
    if (level >= 2)
      panel(out, 'trim', w, 0, w.length, terrace - 2.45, terrace - 2.12, 0.089, color.shadow);
  }
  // Side facilities use a low elevation cut into the retaining walls.
  const walls = pairs(closed(d.outline));
  for (const i of [0, 1, 5]) {
    const w = edge(...walls[i], order);
    const count = Math.floor(w.length / 7.6);
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * w.length) / count;
      const [x, , z] = w.p(u, terrace);
      if (terrain([x, z]) > terrace - 4.7) continue;
      panel(
        out,
        'glass',
        w,
        u - 1.21,
        u + 1.21,
        terrace - 6.05,
        terrace - 3.75,
        0.071,
        color.glass,
      );
      if (level > 1)
        panel(out, 'trim', w, u - 1.45, u + 1.45, terrace - 3.83, terrace - 3.56, 0.13, color.pale);
    }
  }
}

function stoneBox(out, x, z, w, depth, y, h, tint = color.ashlar) {
  block(out, 'stone', x - w / 2, terrace + y, z - depth / 2, w, h, depth, tint);
}

function windows(out, w, rows, level) {
  for (const { base, height, pitch = 5.8, size = 1.3 } of rows) {
    const count = Math.floor(w.length / (level === 1 ? pitch * 1.6 : pitch));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * w.length) / count;
      if (level === 1) {
        panel(
          out,
          'glass',
          w,
          x - size,
          x + size,
          terrace + base,
          terrace + base + 0.82 * height,
          0.039,
          color.glass,
        );
        continue;
      }
      arch(
        out,
        w,
        x,
        terrace + base,
        terrace + base + height * 0.74,
        size,
        height * 0.26,
        0.039,
        level - 2,
        { inner: color.glass, trim: color.pale, width: 0.15 },
        { inner: 'glass', trim: 'trim' },
      );
      if (level >= 2)
        panel(
          out,
          'trim',
          w,
          x - 0.073,
          x + 0.073,
          terrace + base,
          terrace + base + height - 0.14,
          0.104,
          color.joints,
        );
    }
  }
}

function walls(out, polygon, bottom, top, level, rows = []) {
  shell(out, polygon, () => terrace + bottom, terrace + top, {
    wall: 'stone',
    roof: 'trim',
    color: color.ashlar,
    roofColor: color.roofStone,
  });
  if (level === 0) return;
  for (const [a, b] of pairs(closed(polygon))) {
    const w = edge(a, b, areaSign(polygon));
    panel(
      out,
      'trim',
      w,
      0,
      w.length,
      terrace + top - 0.72,
      terrace + top - 0.11,
      0.16,
      color.pale,
    );
    windows(out, w, rows, level);
  }
}

function prayerHall(out, level) {
  const [cx, cz] = d.domeCenter;
  walls(out, rect(-43.2, -27.5, 44.2, 64.7), 0, 24.4, level, [
    { base: 4.5, height: 4.7, pitch: 7.6 },
    { base: 12.0, height: 3.9, pitch: 7.6 },
    { base: 18.4, height: 4.1, pitch: 7.6 },
  ]);
  walls(out, rect(cx - 30.5, cz - 34, cx + 30.5, cz + 33.8), 23.9, 34.4, level, [
    { base: 26.0, height: 4.1, pitch: 8.4 },
  ]);
  stoneBox(out, cx, cz, 39.2, 42.5, 34.0, 14.0);
  stoneBox(out, cx, cz, 44, 14, 28, 11.8);
  stoneBox(out, cx, cz, 15, 53, 28, 11.8);
  for (const [dx, dz, angle] of [
    [-19, 0, Math.PI / 2],
    [19, 0, -Math.PI / 2],
    [0, -22, Math.PI],
    [0, 22, 0],
  ]) {
    const center = [cx + dx, cz + dz];
    const radii = dx ? [16.2, 13.6] : [13.6, 16.2];
    dome(
      out,
      center,
      ...radii,
      34.55,
      12.7,
      [5, 10, 15, 19][level],
      [2, 3, 5, 6][level],
      angle,
      Math.PI,
    );
    if (level >= 1)
      turn(
        out,
        'trim',
        center,
        radii,
        [
          [34.07, 1.015],
          [34.63, 1.015],
        ],
        [5, 10, 15, 19][level],
        color.pale,
        angle,
        Math.PI,
      );
  }
  const small = [
    [-33, -24],
    [-33, 25],
    [33, -24],
    [33, 25],
    [-34, 0],
    [34, 0],
    [-13, -31],
    [13, 31],
  ];
  for (const [dx, dz] of small) {
    if (level === 0) continue;
    dome(
      out,
      [cx + dx, cz + dz],
      6.1,
      6.1,
      24.48,
      5.25,
      [5, 9, 12, 16][level],
      [2, 2, 3, 4][level],
    );
  }
  const drumSides = [7, 16, 24, 32][level],
    radius = 17.0;
  const drum = radialRing(0, radius, radius, drumSides, [cx, cz]).map(([x, , z]) => [x, z]);
  walls(out, drum, 46.95, 53.08, level);
  if (level > 0) {
    const order = areaSign(drum);
    for (const [i, [a, b]] of pairs(closed(drum)).entries()) {
      if (level !== 2 && i % 2 === 1) continue;
      windows(
        out,
        edge(a, b, order),
        [{ base: 48.2, height: 3.64, pitch: 2.4, size: 0.68 }],
        level,
      );
    }
  }
  turn(
    out,
    'trim',
    [cx, cz],
    [radius, radius],
    [
      [52.55, 1.018],
      [53.1, 1.018],
    ],
    drumSides,
    color.pale,
  );
  dome(
    out,
    [cx, cz],
    d.prayerDomeDiameter / 2,
    d.prayerDomeDiameter / 2,
    53.06,
    d.prayerDomeHeight - 53.06,
    [7, 18, 26, 36][level],
    [2, 4, 6, 8][level],
  );
  if (level >= 2) {
    const ribs = level === 2 ? 12 : 24;
    for (let j = 0; j < ribs; j++) {
      const a = (j * 2 * Math.PI) / ribs;
      const point = (i) => {
        const b = (i * Math.PI) / 22,
          r = 17.014 * Math.cos(b);
        return [cx + r * Math.cos(a), terrace + 53.08 + 18.95 * Math.sin(b), cz + r * Math.sin(a)];
      };
      const facets = level === 2 ? 3 : 8;
      for (let i = 0; i < facets; i++)
        beam(
          out,
          'lead',
          point((8 * i) / facets),
          point((8 * (i + 1)) / facets),
          0.061,
          0.076,
          color.leadDark,
        );
    }
  }
  finial(out, [cx, cz], 72, 7.77, level);
}

function finial(out, center, base, height, level) {
  const [x, z] = center;
  const side = [5, 7, 10, 12][level];
  turn(
    out,
    'gold',
    center,
    [height * 0.2, height * 0.2],
    [
      [base - 0.16, 0.56],
      [base + height * 0.2, 0.42],
      [base + height * 0.3, 0.77],
      [base + height * 0.48, 0.26],
      [base + height * 0.7, 0.14],
    ],
    side,
    color.metal,
  );
  const r = height * 0.24,
    top = terrace + base + height - r;
  const arc = Array.from({ length: [3, 5, 7, 10][level] + 1 }, (_, i) => {
    const angle = Math.PI * (1.0 + (1.17 * i) / [3, 5, 7, 10][level]);
    return [x + r * Math.cos(angle), top + r * Math.sin(angle), z];
  });
  for (const [a, b] of pairs(arc))
    beam(out, 'gold', a, b, Math.max(0.18, r * 0.29), Math.max(0.1, r * 0.14), color.metal);
}

function arcade(out, from, to, bays, depth, level) {
  const w = edge(from, to, 1),
    n = [0, 3, 6, 8][level];
  const pitch = w.length / bays;
  const high = 10.2;
  const stone = color.pale;
  const walk = [w.p(0, 0), w.p(w.length, 0), w.p(w.length, 0, -depth), w.p(0, 0, -depth)].map(
    ([x, , z]) => [x, z],
  );
  shell(out, walk, () => terrace + high - 1.62, terrace + high, {
    wall: 'stone',
    roof: 'trim',
    color: stone,
    roofColor: color.roofStone,
  });
  if (level === 0) {
    for (let i = 1; i < bays; i += 3) {
      const [x, , z] = w.p(pitch * (i + 0.5), terrace, -0.5 * depth);
      dome(out, [x, z], pitch * 0.45, depth * 0.47, high, 2.5, 4, 1);
    }
  }
  const colCount = level === 0 ? Math.ceil(bays / 2) : bays;
  for (let i = 0; i <= colCount; i++) {
    const u = Math.min(w.length - 0.62, Math.max(0.62, (w.length * i) / colCount));
    const [x, , z] = w.p(u, terrace, -1.0);
    stoneBox(out, x, z, level === 0 ? 1.3 : 1.02, level === 0 ? 1.3 : 1.05, 0, 5.82);
    if (level >= 2) stoneBox(out, x, z, 1.24, 1.24, 5.61, 0.49, stone);
  }
  if (level === 0) return;
  for (let i = 0; i < bays; i++) {
    const x = pitch * (i + 0.5),
      rx = pitch * 0.5 - 0.57;
    const spring = terrace + 5.76,
      rise = 2.07;
    for (let k = 0; k < n; k++) {
      const u = (j) => {
        const t = (j * Math.PI) / n;
        return [x + rx * Math.cos(t), spring + rise * Math.sin(t)];
      };
      const [a, y] = u(k),
        [b, v] = u(k + 1);
      const top = terrace + high - 1.31;
      for (const [offset, normal] of level === 1
        ? [[0, w.normal]]
        : [
            [0, w.normal],
            [-1.98, w.normal.map((n) => -n)],
          ])
        face(
          out,
          'stone',
          [w.p(a, y, offset), w.p(b, v, offset), w.p(b, top, offset), w.p(a, top, offset)],
          normal,
          stone,
        );
      if (level >= 2)
        face(
          out,
          'paving',
          [w.p(a, y), w.p(b, v), w.p(b, v, -1.98), w.p(a, y, -1.98)],
          [0, -1, 0],
          color.shadow,
        );
      if (level >= 2)
        face(
          out,
          'trim',
          [w.p(a, y, 0.058), w.p(b, v, 0.058), w.p(b, v + 0.23, 0.058), w.p(a, y + 0.23, 0.058)],
          w.normal,
          k % 2 ? color.ashlar : color.pale,
        );
    }
    const [px, , pz] = w.p(x, terrace, -depth / 2);
    dome(
      out,
      [px, pz],
      pitch * 0.45,
      depth * 0.43,
      high,
      2.8,
      [0, 5, 8, 14][level],
      [0, 1, 2, 4][level],
    );
  }
}

function courtyard(out, level) {
  const [nw, sw, se, ne] = d.court;
  arcade(out, nw, sw, 7, 9.0, level);
  arcade(out, sw, se, 4, 11.8, level);
  arcade(out, se, ne, 7, 9.0, level);
  arcade(out, ne, nw, 8, 10.85, level);
  stoneBox(out, 0.9, -94.7, 11.3, 12.3, 0, 15.4);
  const gate = edge([-4.75, -100.85], [6.55, -100.85], 1);
  if (level >= 1)
    arch(
      out,
      gate,
      5.65,
      terrace + 0.23,
      terrace + 9.5,
      2.54,
      2.23,
      0.15,
      level - 1,
      { inner: color.glass, trim: color.pale, width: 0.39 },
      { inner: 'glass', trim: 'trim' },
    );
  const [fx, fz] = d.fountainCenter;
  turn(
    out,
    'paving',
    d.fountainCenter,
    [6.65, 6.65],
    [
      [0, 1],
      [0.7, 1],
    ],
    [6, 10, 14, 20][level],
    color.base,
  );
  const posts = level === 0 ? 4 : 8;
  for (let i = 0; i < posts; i++) {
    const a = (i * 2 * Math.PI) / posts;
    stoneBox(out, fx + 5.42 * Math.cos(a), fz + 5.42 * Math.sin(a), 0.52, 0.53, 0.4, 5.1);
  }
  dome(out, d.fountainCenter, 7.06, 7.06, 5.49, 4.73, [6, 12, 18, 24][level], [2, 3, 4, 6][level]);
  if (level >= 1) {
    finial(out, d.fountainCenter, 10.15, 1.1, level);
    const courtFrame = rect(-28.97, -81.38, 30.86, -30.69);
    for (const [a, b] of pairs(closed(courtFrame))) {
      const w = edge(a, b, areaSign(courtFrame));
      const [x, , z] = w.p(0, terrace + 0.03, 0.2);
      const [aX, , aZ] = w.p(w.length, terrace + 0.03, 0.2);
      face(
        out,
        'trim',
        [
          [x, terrace + 0.03, z],
          [aX, terrace + 0.03, aZ],
          w.p(w.length, terrace + 0.03, 0.66),
          w.p(0, terrace + 0.03, 0.66),
        ],
        upward,
        color.courtBand,
      );
    }
  }
}

function minaret(out, m, level) {
  const k = m.height;
  const stem =
    level === 0
      ? [
          [0, 1.55],
          [8.3, 1.55],
          [10.0, 0.91],
          [k - 21, 0.69],
        ]
      : [
          [0, 1.65],
          [0.42, 1.65],
          [0.55, 1.51],
          [8.4, 1.51],
          [10.7, 0.91],
          [k - 21, 0.69],
        ];
  const sides = [4, 5, 10, 18][level];
  turn(out, 'stone', m.center, [2.77, 2.77], stem, sides, color.ashlar);
  if (level >= 1) {
    const bands = m.balconies === 3 ? [43.8, 59.4, 72.6] : [39.4, 55.4];
    for (const y of bands) {
      turn(
        out,
        'trim',
        m.center,
        [2.77, 2.77],
        [
          [y - 2.65, 0.83],
          [y - 2.1, 0.96],
          [y - 1.1, 1.13],
          [y - 0.35, 1.35],
          [y + 0.55, 1.35],
          [y + 1.02, 1.27],
        ],
        sides,
        color.pale,
      );
      if (level >= 2) {
        const bayCount = level === 2 ? 6 : 20;
        for (let i = 0; i < bayCount; i++) {
          const a = (i * 2 * Math.PI) / bayCount;
          const center = [m.center[0] + 3.68 * Math.cos(a), m.center[1] + 3.68 * Math.sin(a)];
          stoneBox(out, ...center, 0.26, 0.26, y + 0.02, 0.64, color.shadow);
        }
      }
    }
  }
  turn(
    out,
    'stone',
    m.center,
    [2.77, 2.77],
    [
      [k - 21.02, 0.69],
      [k - 18, 0.73],
      [k - 16.9, 0.77],
    ],
    sides,
    color.pale,
  );
  const capProfile =
    level === 0
      ? [
          [k - 17, 0.76],
          [k - 0.42, 0.017],
        ]
      : [
          [k - 17.02, 0.77],
          [k - 16.0, 0.7],
          [k - 11.1, 0.39],
          [k - 4.6, 0.17],
          [k - 0.7, 0.017],
        ];
  turn(out, 'lead', m.center, [2.77, 2.77], capProfile, sides, color.leadDark);
  if (level >= 2)
    turn(
      out,
      'gold',
      m.center,
      [0.15, 0.15],
      [
        [k - 1.13, 1],
        [k - 0.36, 0.66],
        [k, 0.22],
      ],
      sides,
      color.metal,
    );
}

function build(out, level) {
  podium(out, level);
  prayerHall(out, level);
  courtyard(out, level);
  for (const m of d.minarets) minaret(out, m, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'camlica-mosque-model.mjs';
const camera = [-221, 144, -235],
  lookAt = [-1, 56, -15];
export const camlicaMosqueAsset = {
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
    'Mapped continuous podium and minaret bases follow the original Büyük Çamlıca hill profile.',
  brief:
    'The standing Grand Çamlıca Mosque with its raised hilltop terrace, six minarets, cascaded lead roofs and domed colonnades around the court.',
  camera,
  lookAt,
  sunDirection: [-132, 159, -135],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.91,
    basis: 'Native outer ring of the named mosque relation.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'courtyard-fountain-and-arcades', position: [-13, 81, -126], lookAt: [1, 40, -27] },
    { name: 'hilltop-dome-and-qibla-elevation', position: [82, 75, 135], lookAt: [-2, 65, 23] },
    { name: 'minaret-balconies-and-cascaded-roofs', position: [-124, 84, 17], lookAt: [-3, 68, 9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'camlica-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.85,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries({ district: 0.76, street: 0.27, closeup: 0.095 }).map(
        ([name, errorMeters]) => [name, { export: name, errorMeters, surfaces }],
      ),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors, ODbL 1.0. Open elevation tiles.',
};
