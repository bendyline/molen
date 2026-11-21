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
  opening,
  pairs,
  palette,
  panel,
  rect,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const color = palette({
  marble: 'adaaa4',
  stone: 'b9b6ad',
  darkStone: '9c9891',
  lintel: 'cbc3b1',
  base: '8b9290',
  roof: '656967',
  lead: '667272',
  rib: '536362',
  steel: '777365',
  timber: '716052',
  glass: '515c58',
  glassLit: '66746b',
  cream: 'd0c3aa',
  brown: '8a6959',
  shadow: 'a49f97',
});
const neutral = (slot, roughness, metallic = 0) => ({
  slot,
  localRef: 'palette:#ffffff',
  roughness,
  metallic,
});
const surfaces = {
  marble: surface('wall', 'stone_marble', 0.78),
  base: surface('foundation', 'stone_granite', 0.93),
  stone: neutral('trim', 0.9),
  lead: neutral('roof', 0.86, 0.12),
  glass: neutral('window', 0.49),
  wall: neutral('wall', 0.91),
};
const podium = 0.33;
const faceNormal = [0, 1, 0];
const sign = areaSign(d.outline);
const sideFaces = pairs(closed(d.outline));
const course = (out, w, low, high, tint, offset = 0.13) =>
  panel(out, 'stone', w, 0, w.length, low, high, offset, tint);

function exterior(out, level) {
  shell(out, d.outline, (p) => Math.min(grade(p) - 0.5, -0.3), 1.04, {
    wall: 'base',
    color: color.base,
    roof: 'base',
    roofColor: color.shadow,
  });
  shell(out, d.outline, () => 1.04, d.lowerEave, {
    wall: 'marble',
    color: color.marble,
    roof: 'lead',
    roofColor: color.roof,
  });
  const topShape = d.outline.map(([x, z]) => [mix(x, 3, 0.1), mix(z, -9, 0.08)]);
  shell(out, topShape, () => d.lowerEave - 0.07, d.mainEave, {
    wall: 'wall',
    roof: 'lead',
    color: color.darkStone,
    roofColor: color.roof,
  });
  if (level === 0) return;
  for (const [i, [a, b]] of sideFaces.entries()) {
    const w = edge(a, b, sign);
    if (w.length < 2.2) continue;
    course(out, w, 0.98, 1.22, color.shadow);
    course(out, w, 4.78, 5.03, color.lintel);
    course(out, w, 11.85, 12.34, color.lintel, 0.23);
    if (level >= 2 && i !== 4) course(out, w, 12.34, 12.56, color.stone, 0.28);
    if (i === 4 || w.length < 4.2) continue;
    const street = [0, 8].includes(i);
    const count = Math.max(1, Math.round(w.length / (street ? 4.2 : 6.2)));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * w.length) / count;
      const radius = Math.min(0.91, (w.length / count) * 0.22);
      if (street) {
        arch(
          out,
          w,
          u,
          1.3,
          3.13,
          radius,
          0.58,
          0.042,
          level - 1,
          { inner: color.glass, trim: color.lintel, width: 0.135 },
          { inner: 'glass', trim: 'stone' },
        );
        opening(
          out,
          w,
          u - radius,
          u + radius,
          6.17,
          9.96,
          'stone',
          j % 3 ? color.glass : color.glassLit,
          'glass',
          color.lintel,
          level - 1,
          0.055,
        );
        column(out, w.p((w.length * j) / count + 0.38, 0, 0.43), 5.28, 6.19, 0.38, level);
      } else {
        arch(
          out,
          w,
          u,
          7.29,
          9.11,
          radius * 0.72,
          0.41,
          0.042,
          Math.max(0, level - 2),
          { inner: color.glass, trim: color.stone, width: 0.095 },
          { inner: 'glass', trim: 'stone' },
        );
      }
      if (level >= 2 && street)
        panel(out, 'stone', w, u - 0.1, u + 0.1, 6.98, 9.94, 0.098, color.cream);
    }
    if (level >= 2)
      for (const y of [1.59, 2.05, 2.68, 3.27, 4.11])
        course(out, w, y, y + 0.026, color.shadow, 0.016);
  }
}

function column(out, [x, , z], base, height, radius, level) {
  const sides = [5, 7, 10, 14][level];
  const shape =
    level < 2
      ? [
          [0, 1.22],
          [0.28, 1.0],
          [height - 0.3, 0.84],
          [height, 1.24],
        ]
      : [
          [0, 1.41],
          [0.19, 1.41],
          [0.24, 1.25],
          [0.47, 1.02],
          [height * 0.71, 0.91],
          [height - 0.42, 0.84],
          [height - 0.35, 1.12],
          [height - 0.11, 1.32],
          [height, 1.32],
        ];
  const rings = shape.map(([y, r]) => radialRing(base + y, r * radius, r * radius, sides, [x, z]));
  loft(out, 'stone', rings, color.lintel, { cap: false });
}

function domedRoof(out, center, radius, ground, rise, level, major) {
  const sides = major ? [9, 14, 22, 30][level] : [8, 12, 18, 24][level];
  const bands = [2, 3, 5, 7][level];
  const points = Array.from({ length: bands + 1 }, (_, i) => {
    const a = (Math.PI * i) / (2 * bands);
    const r = radius * Math.max(0.017, Math.cos(a));
    return radialRing(ground + Math.sin(a) * rise, r, r, sides, center);
  });
  loft(out, 'lead', points, color.lead, { cap: false });
  if (level >= 2) {
    for (let j = 0; j < sides; j += level === 2 ? 3 : 2) {
      for (let i = 0; i < bands; i++) {
        const v = points[i][j],
          w = points[i + 1][j];
        const a = [v[0], v[1] + 0.048, v[2]],
          b = [w[0], w[1] + 0.048, w[2]];
        beam(out, 'lead', a, b, 0.075, 0.075, color.rib);
      }
    }
  }
}

function flyTower(out, level) {
  const poly = [
    [5.9, -36.0],
    [15.6, -36.0],
    [20.0, -31.0],
    [19.5, -21.8],
    [4.5, -22.7],
  ];
  shell(out, poly, () => d.mainEave - 0.6, d.stageBoxRoof, {
    wall: 'wall',
    roof: 'lead',
    color: color.darkStone,
    roofColor: color.roof,
  });
  if (level === 0) return;
  for (const [a, b] of pairs(closed(poly))) {
    const w = edge(a, b, areaSign(poly));
    course(out, w, d.stageBoxRoof - 0.29, d.stageBoxRoof + 0.09, color.lintel, 0.15);
    for (const u of [0.31, 0.57, 0.76])
      opening(
        out,
        w,
        w.length * u - 0.34,
        w.length * u + 0.34,
        15.78,
        17.13,
        'stone',
        color.glass,
        'glass',
        color.stone,
        level - 1,
        0.04,
      );
  }
}

function entrance(out, level) {
  const w = edge(...sideFaces[4], sign);
  const cx = d.entrance[0];
  const front = d.entrance[1];
  const hub = [cx, front - 3.4];
  const entryShape = rect(cx - 4.39, front - 4.95, cx + 4.39, front + 0.32);
  shell(out, entryShape, () => podium, 12.92, {
    wall: 'marble',
    roof: 'lead',
    color: color.stone,
    roofColor: color.roof,
  });
  stairs(
    out,
    grade,
    'base',
    cx - 3.98,
    cx + 3.98,
    front + 2.13,
    front + 0.06,
    podium + 0.17,
    level >= 2 ? 5 : 3,
    color.base,
  );
  const entry = edge([cx - 4.33, front + 0.33], [cx + 4.33, front + 0.33], -1);
  for (const dx of [-3.85, -1.35, 1.35, 3.85])
    column(out, [cx + dx, 0, front + 0.69], 0.58, 5.19, 0.34, level);
  for (const [l, r] of [
    [5.66, 6.28],
    [11.95, 12.42],
    [12.48, 13.15],
  ])
    course(out, entry, l, r, color.lintel, 0.28);
  if (level >= 1) {
    for (const u of [1.73, 4.33, 6.93])
      arch(
        out,
        entry,
        u,
        podium + 0.12,
        3.52,
        0.89,
        0.83,
        0.029,
        level - 1,
        { inner: color.glass, trim: color.lintel, width: 0.2 },
        { inner: 'glass', trim: 'stone' },
      );
    arch(
      out,
      entry,
      4.33,
      7.18,
      9.62,
      1.13,
      1.06,
      0.037,
      level - 1,
      { inner: color.glass, trim: color.lintel, width: 0.23 },
      { inner: 'glass', trim: 'stone' },
    );
    for (const u of [1.5, 7.16])
      opening(
        out,
        entry,
        u - 0.52,
        u + 0.52,
        7.35,
        10.14,
        'stone',
        color.glass,
        'glass',
        color.lintel,
        level - 1,
        0.061,
      );
  }
  const r = 3.23;
  const tower = radialRing(0, r, r, 8, hub, Math.PI / 8).map(([x, , z]) => [x, z]);
  shell(out, tower, () => 12.88, d.towerDrumEave, {
    wall: 'marble',
    roof: 'lead',
    color: color.stone,
    roofColor: color.lead,
  });
  for (const [i, [a, b]] of pairs(closed(tower)).entries()) {
    const wall = edge(a, b, areaSign(tower));
    course(out, wall, 17.38, 17.81, color.lintel, 0.15);
    if (level >= 1 && (level >= 2 || i % 2 === 0))
      arch(
        out,
        wall,
        wall.length / 2,
        14.31,
        16.05,
        0.51,
        0.55,
        0.045,
        level - 1,
        { inner: color.glass, trim: color.cream, width: 0.09 },
        { inner: 'glass', trim: 'stone' },
      );
  }
  domedRoof(out, hub, 3.38, d.towerDrumEave - 0.21, d.smallDomeRise + 0.21, level, false);
  if (level >= 1)
    beam(out, 'stone', [hub[0], 20.68, hub[1]], [hub[0], 21.34, hub[1]], 0.16, 0.17, color.steel);
  if (level >= 2) {
    const [a, b] = sideFaces[4];
    face(
      out,
      'base',
      [[a[0], podium, a[1]], [b[0], podium, b[1]], w.p(w.length, podium, 0.9), w.p(0, podium, 0.9)],
      faceNormal,
      color.base,
    );
  }
}

function build(out, level) {
  exterior(out, level);
  domedRoof(
    out,
    [1.1, -10.2],
    d.reportedAuditoriumDiameterMeters / 2,
    d.mainEave - 0.05,
    3.46,
    level,
    true,
  );
  flyTower(out, level);
  entrance(out, level);
  if (level >= 2) {
    block(out, 'wall', -5.15, 14.64, -20.4, 3.2, 1.77, 2.78, color.shadow);
    block(out, 'wall', 7.2, 14.64, -0.2, 3.2, 1.21, 2.78, color.shadow);
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'lee-theatre-model.mjs';
const camera = [63, 49, 97],
  lookAt = [2, 9, -7];
export const leeTheatreAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'performance-sport',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original Hong Kong Lands Department grade at the historic corner threshold.',
  brief:
    'Hong Kong’s former Lee Theatre with a domed corner tower, marble-clad street elevations and a broad auditorium roof, on its original 1975 surveyed footprint.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-31, 79, 107],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_marble', 'stone_granite'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'chamfered-beaux-arts-entrance',
      position: [-2.2, 9.2, 47.5],
      lookAt: [-1.4, 9.5, 17.1],
    },
    { name: 'percival-street-and-auditorium-roof', position: [65, 42, 10], lookAt: [1, 11, -8] },
    { name: 'sharp-street-wing-and-hall', position: [-41, 30, 50], lookAt: [-7, 10, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lee-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries({ district: 0.52, street: 0.19, closeup: 0.057 }).map(
        ([name, errorMeters]) => [name, { export: name, errorMeters, surfaces }],
      ),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Survey and Mapping Office, Hong Kong Lands Department.',
};
