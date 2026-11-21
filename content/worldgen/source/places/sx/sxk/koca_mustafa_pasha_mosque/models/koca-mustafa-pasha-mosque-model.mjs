import { readFileSync } from 'node:fs';
import {
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
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  ashlar: 'bcb3a0',
  cornice: 'd0c7ad',
  base: 'a89e89',
  drum: 'b7a68c',
  brick: 'a17665',
  lead: '777e7f',
  leadRib: '868c8b',
  recess: '515853',
  door: '695a49',
  copper: 'a29363',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.9),
  base: surface('foundation', 'stone_ashlar', 0.95),
  brick: surface('wall', 'brick_longformat', 0.91),
  lead: surface('roof', 'metal_standing_seam', 0.78, 0.14),
  wood: surface('trim', 'wood_plain', 0.83),
  metal: surface('trim', 'metal_bronze_cast', 0.75, 0.2),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
};
const floor = 0.61;
const base = (p) => Math.min(grade(p) - 0.27, floor - 0.18);
const near = (poly) => pairs(closed(poly)).map(([a, b]) => edge(a, b, areaSign(poly)));
const stone = (out, poly, low, high, color = c.ashlar) =>
  shell(out, poly, typeof low === 'number' ? () => low : low, high, {
    wall: 'stone',
    roof: 'stone',
    color,
    roofColor: color,
  });
const ring = (p, r, sides, angle = Math.PI / sides) =>
  radialRing(0, r, r, sides, p, angle).map(([x, , z]) => [x, z]);
const bands = (out, p, profile, sides, slot, color, cap = false) =>
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, p, Math.PI / sides)),
    color,
    { cap },
  );
function finial(out, p, y, size, level) {
  bands(
    out,
    p,
    [
      [y - 0.07, 0.13 * size],
      [y + 0.14 * size, 0.17 * size],
      [y + 0.31 * size, 0.11 * size],
      [y + 0.55 * size, 0.12 * size],
      [y + 0.76 * size, 0.025 * size],
    ],
    level > 1 ? 8 : 4,
    'metal',
    c.copper,
    true,
  );
}
function cupola(out, p, rx, rz, low, high, level, main = false) {
  const sides = (main ? [8, 16, 24, 32] : [5, 8, 12, 16])[level];
  const profile =
    level < 2
      ? [
          [0, 1],
          [0.57, 0.84],
          [1, 0.045],
        ]
      : [
          [0, 1],
          [0.29, 0.965],
          [0.57, 0.826],
          [0.78, 0.63],
          [0.93, 0.37],
          [1, 0.035],
        ];
  const rings = profile.map(([t, r]) =>
    radialRing(mix(low, high, t), rx * r, rz * r, sides, p, Math.PI / sides),
  );
  loft(out, 'lead', rings, c.lead, { cap: true });
  if (!main || level < 2) return;
  for (const i of Array.from({ length: sides }, (_, j) => j).filter((j) => j % 2 === 0)) {
    const a = ((2 * i + 1) * Math.PI) / sides;
    const mark = (t, r, d) => [
      p[0] + (rx * r + 0.025) * Math.cos(a + d),
      mix(low, high, t) + 0.024,
      p[1] + (rz * r + 0.025) * Math.sin(a + d),
    ];
    for (const [[t, r], [v, q]] of pairs(profile)) {
      face(
        out,
        'lead',
        [mark(t, r, -0.008), mark(t, r, 0.008), mark(v, q, 0.008), mark(v, q, -0.008)],
        [Math.cos(a), 1, Math.sin(a)],
        c.leadRib,
      );
    }
  }
}
function window(out, w, u, low, spring, radius, rise, level, door = false) {
  arch(
    out,
    w,
    u,
    low,
    spring,
    radius,
    rise,
    0.026,
    Math.max(0, level - 1),
    { inner: door ? c.door : c.recess, trim: c.cornice, width: 0.098 },
    { inner: door ? 'wood' : 'glass', trim: 'stone' },
  );
  if (level >= 2 && !door) {
    panel(
      out,
      'stone',
      w,
      u - radius - 0.1,
      u + radius + 0.1,
      low - 0.1,
      low - 0.026,
      0.108,
      c.cornice,
    );
    panel(out, 'metal', w, u - 0.022, u + 0.022, low + 0.03, spring - 0.015, 0.102, c.base);
  }
}
function hall(out, level) {
  const body = rect(...d.hall);
  const top = 7.37;
  shell(out, body, base, floor, { wall: 'base', roof: 'base', color: c.base });
  shell(out, body, () => floor, top, {
    wall: 'stone',
    roof: 'lead',
    color: c.ashlar,
    roofColor: c.lead,
  });
  const walls = near(body);
  const rows = [[], [2.98, 8.4, 13.95], [3.3, 7.66, 12.95, 18.32, 22.55], [4.25, 11.75]];
  for (const [i, w] of walls.entries()) {
    panel(out, 'stone', w, 0, w.length, top - 0.23, top - 0.005, 0.095, c.cornice);
    if (level === 0) continue;
    for (const u of rows[i]) {
      window(out, w, u, 1.81, 3.62, 0.61, 0.39, level);
      if (level >= 2) window(out, w, u, 4.72, 5.9, 0.47, 0.34, level);
    }
    if (i === 0) {
      for (const u of [2.42, 21.16]) window(out, w, u, 0.64, 3.58, 0.88, 0.62, level, true);
    }
    if (level >= 2) panel(out, 'base', w, 0, w.length, 1.08, 1.24, 0.036, c.base);
  }
  const [x, z] = d.mainDome;
  const square = rect(x - 4.15, z - 4.13, x + 4.15, z + 4.13);
  stone(out, square, top - 0.11, 10.62, c.drum);
  if (level >= 1) {
    for (const w of near(square)) {
      for (const y of [8.43, 9.2, 10.01])
        panel(out, 'brick', w, 0, w.length, y, y + 0.19, 0.025, c.brick);
      panel(out, 'stone', w, 0, w.length, 10.48, 10.67, 0.125, c.cornice);
    }
  }
  const octagon = ring(d.mainDome, d.mainDomeRadius, 8);
  stone(out, octagon, 10.59, 13.66, c.drum);
  for (const w of near(octagon)) {
    panel(out, 'stone', w, 0, w.length, 13.47, 13.72, 0.089, c.cornice);
    if (level === 0) continue;
    const opening = w.length * 0.5;
    window(out, w, opening, 11.41, 12.71, 0.36, 0.32, level);
    if (level >= 2) {
      for (const y of [10.89, 11.17, 13.23])
        panel(out, 'brick', w, 0, w.length, y, y + 0.09, 0.024, c.brick);
    }
  }
  cupola(out, d.mainDome, 3.67, 3.67, 13.67, 16.26, level, true);
  finial(out, d.mainDome, 16.25, 0.72, level);
}
function halfDome(out, sign, level) {
  const [x, z] = d.mainDome;
  const pivot = z + sign * 3.03,
    rx = 3.84,
    rz = sign === 1 ? 5.06 : 4.86;
  const sides = [6, 10, 16, 24][level];
  const arc = (r, y) =>
    Array.from({ length: sides + 1 }, (_, i) => {
      const a = (i * Math.PI) / sides;
      return [x + rx * r * Math.cos(a), y, pivot + sign * rz * r * Math.sin(a)];
    });
  const section = [
    [7.24, 1],
    [8.17, 1],
    [8.32, 1.016],
    [8.47, 1.016],
    [9.43, 0.901],
    [10.36, 0.61],
    [10.95, 0.065],
  ];
  const points = section.map(([y, r]) => arc(r, y));
  for (const [row, [lo, hi]] of pairs(points).entries()) {
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) * Math.PI) / sides;
      face(
        out,
        row < 3 ? 'stone' : 'lead',
        [lo[i], lo[i + 1], hi[i + 1], hi[i]],
        [Math.cos(a), 0.44, sign * Math.sin(a)],
        row === 0 ? c.drum : row < 3 ? c.cornice : c.lead,
      );
    }
  }
  if (level === 0) return;
  for (const angle of [Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]) {
    const p = [x + rx * 0.97 * Math.cos(angle), pivot + sign * rz * 0.97 * Math.sin(angle)];
    const t = [-Math.sin(angle), sign * Math.cos(angle)];
    const w = edge(
      [p[0] + t[0] * 0.46, p[1] + t[1] * 0.46],
      [p[0] - t[0] * 0.46, p[1] - t[1] * 0.46],
      -sign,
    );
    panel(out, 'stone', w, 0, w.length, 8.26, 9.12, 0, c.drum);
    window(out, w, w.length * 0.5, 8.39, 8.87, 0.265, 0.18, level);
    face(
      out,
      'lead',
      [w.p(0, 9.01, 0.16), w.p(w.length, 9.01, 0.16), w.p(w.length * 0.5, 9.35, -0.48)],
      up,
      c.lead,
    );
  }
}
function chancelAndVestibule(out, level) {
  const end = rect(5.12, -0.54, 12.72, 4.82);
  const w = edge([12.72, -0.54], [12.72, 4.82]);
  stone(out, end, 7.21, 8.42, c.drum);
  const cuts = [4, 6, 10, 14][level];
  const curve = (x, i) => {
    const a = (Math.PI * i) / cuts;
    return [x, 8.39 + 1.7 * Math.sin(a), 2.14 + 2.68 * Math.cos(a)];
  };
  for (let i = 0; i < cuts; i++) {
    const a = ((i + 0.5) * Math.PI) / cuts;
    face(
      out,
      'lead',
      [curve(5.12, i), curve(12.73, i), curve(12.73, i + 1), curve(5.12, i + 1)],
      [0, Math.sin(a), Math.cos(a)],
      c.lead,
    );
  }
  face(
    out,
    'stone',
    Array.from({ length: cuts + 1 }, (_, i) => curve(12.73, i)),
    [1, 0, 0],
    c.drum,
  );
  if (level >= 1) {
    window(out, w, w.length * 0.5, 7.68, 8.73, 0.42, 0.32, level);
    for (const [p, rx, rz, high] of [
      [[-10.26, -2.45], 1.81, 1.9, 8.52],
      [[-10.26, 2.12], 1.89, 1.94, 8.44],
      [[-10.26, 7.23], 1.86, 1.9, 8.49],
      [[-5.92, -2.7], 1.61, 1.77, 8.55],
    ])
      cupola(out, p, rx, rz, 7.32, high, level);
  }
}
function portico(out, level) {
  const [left, front, right, back] = d.portico;
  const width = (right - left) / d.entryBayCount;
  const columns = Array.from(
    { length: d.entryBayCount + 1 },
    (_, i) => left + 0.27 + (i * (right - left - 0.54)) / d.entryBayCount,
  );
  const porch = rect(left, front, right, back + 0.08);
  shell(out, porch, base, floor, { wall: 'base', roof: 'base', color: c.base });
  const spring = 3.59,
    roof = 5.26;
  for (const x of columns) {
    const p = [x, front + 0.28],
      sides = [4, 6, 8, 12][level];
    const profile =
      level === 0
        ? [
            [floor, 0.24],
            [spring, 0.19],
          ]
        : [
            [floor, 0.29],
            [floor + 0.19, 0.29],
            [floor + 0.32, 0.225],
            [spring - 0.43, 0.18],
            [spring - 0.16, 0.29],
            [spring, 0.29],
          ];
    bands(out, p, profile, sides, 'stone', c.cornice, true);
  }
  const facade = edge([left, front + 0.15], [right, front + 0.15]);
  const top = edge([left, front], [right, front]);
  panel(out, 'stone', top, 0, top.length, roof - 0.18, roof + 0.02, 0.065, c.cornice);
  stone(out, rect(left, front + 0.04, right, back + 0.13), roof - 0.14, roof, c.cornice);
  for (const [a, b] of pairs(columns)) {
    const middle = (a + b) * 0.5,
      mid = middle - left;
    const radius = (b - a) * 0.5 - 0.065,
      cut = [4, 6, 8, 12][level];
    const point = (i) => [
      mid - radius * Math.cos((i * Math.PI) / cut),
      spring + 1.16 * Math.sin((i * Math.PI) / cut),
    ];
    for (let j = 0; j < cut; j++) {
      const [u, y] = point(j),
        [v, h] = point(j + 1);
      const t = (x, z, depth) => facade.p(x, z, depth);
      const frontFace = [t(u, y, 0.09), t(v, h, 0.09), t(v, roof, 0.09), t(u, roof, 0.09)];
      face(out, 'stone', frontFace, facade.normal, c.ashlar);
      if (level === 0) continue;
      face(
        out,
        'stone',
        [t(u, y, -0.23), t(v, h, -0.23), t(v, roof, -0.23), t(u, roof, -0.23)],
        [0, 0, 1],
        c.ashlar,
      );
      face(
        out,
        'stone',
        [t(u, y, 0.09), t(u, y, -0.23), t(v, h, -0.23), t(v, h, 0.09)],
        [-Math.cos(((j + 0.5) * Math.PI) / cut), -1, 0],
        c.cornice,
      );
    }
    cupola(
      out,
      [middle, (front + back) * 0.5],
      width * 0.455,
      (back - front) * 0.46,
      roof - 0.015,
      6.85,
      level,
    );
  }
  if (level >= 1) {
    const first = (columns[0] + columns[1]) * 0.5,
      last = (columns.at(-2) + columns.at(-1)) * 0.5;
    for (const center of [first, last])
      stairs(
        out,
        grade,
        'base',
        center - 1.1,
        center + 1.1,
        front - 1.31,
        front + 0.075,
        floor,
        3,
        c.base,
      );
    stone(out, rect(right, front + 0.35, 12.95, back + 0.07), base, 5.28, c.ashlar);
    cupola(out, [11.84, (front + back) * 0.5], 1.16, 1.83, 5.27, 6.13, level);
  }
}
function minaret(out, level) {
  const p = d.minaret,
    sides = [6, 8, 12, 16][level];
  const foundation = ring(p, 1.57, 8, 0);
  shell(out, foundation, base, 0.89, { wall: 'base', roof: 'base', color: c.base });
  const pedestal = ring(p, 1.27, 8, 0);
  stone(out, pedestal, 0.78, 4.83);
  bands(
    out,
    p,
    [
      [4.8, 1.28],
      [4.98, 1.29],
      [5.56, 0.98],
      [6.12, 0.62],
      [6.44, 0.58],
      [19.29, 0.52],
    ],
    sides,
    'stone',
    c.ashlar,
  );
  if (level >= 2) {
    for (const w of near(pedestal)) {
      if (w.normal[0] > 0.7) continue;
      const u = w.length * 0.5;
      window(out, w, u, 1.31, 3.93, 0.23, 0.23, level, true);
      panel(out, 'stone', w, u - 0.41, u - 0.34, 1.23, 4.43, 0.041, c.cornice);
      panel(out, 'stone', w, u + 0.34, u + 0.41, 1.23, 4.43, 0.041, c.cornice);
    }
  }
  const balcony =
    level === 0
      ? [
          [19.2, 0.52],
          [19.92, 1.05],
          [20.48, 1.03],
        ]
      : [
          [19.2, 0.52],
          [19.32, 0.63],
          [19.48, 0.76],
          [19.55, 0.83],
          [19.7, 0.9],
          [19.83, 1.04],
          [19.94, 1.08],
          [20.45, 1.05],
          [20.55, 1.09],
        ];
  bands(out, p, balcony, sides, 'stone', c.cornice, true);
  bands(
    out,
    p,
    [
      [19.92, 0.49],
      [23.43, 0.46],
      [23.54, 0.5],
    ],
    sides,
    'stone',
    c.ashlar,
  );
  if (level >= 2) {
    const w = near(ring(p, 0.47, sides)).find((w) => w.normal[2] < -0.7);
    panel(out, 'wood', w, w.length * 0.16, w.length * 0.84, 20.03, 21.08, 0.035, c.door);
    for (const w of near(ring(p, 1.047, sides))) {
      panel(out, 'stone', w, w.length * 0.21, w.length * 0.79, 20.08, 20.37, 0.021, c.base);
    }
  }
  bands(
    out,
    p,
    [
      [23.5, 0.54],
      [23.68, 0.53],
      [25.93, 0.052],
    ],
    sides,
    'lead',
    c.lead,
    true,
  );
  finial(out, p, 25.93, 0.86, level);
}
function build(out, level) {
  hall(out, level);
  halfDome(out, 1, level);
  halfDome(out, -1, level);
  chancelAndVestibule(out, level);
  portico(out, level);
  minaret(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'koca-mustafa-pasha-mosque-model.mjs';
const camera = [-41, 26, -43],
  lookAt = [-1, 8, 0];
const errors = { district: 0.49, street: 0.19, closeup: 0.062 };
export const kocaMustafaPashaMosqueAsset = {
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
  groundContactBasis: 'Original elevation immediately north of the named entrance portico.',
  brief:
    'Koca Mustafa Pasha Mosque with a short five-domed portico, central octagonal drum, paired semidomes, eastern chancel roof and a single slender western minaret.',
  camera,
  lookAt,
  sunDirection: [-53, 92, -50],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis:
      'Current named OpenStreetMap outline of the main building and courtyard entrance portico.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'open-five-dome-portico', position: [-7, 7.1, -26], lookAt: [-1, 6, 0] },
    { name: 'former-east-chancel-and-south-semidome', position: [25, 10, 24], lookAt: [2, 8, 4] },
    { name: 'octagonal-tower-and-tiered-roofs', position: [-26, 16, 21], lookAt: [-4, 10, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'koca-mustafa-pasha-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
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
