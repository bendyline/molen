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

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  iron: 'b5bcb0',
  cream: 'd4d8cd',
  relief: 'c2c9ba',
  shade: 'a0a99c',
  stone: 'a79c89',
  plinth: 'b7aca0',
  zinc: '777f7b',
  zincEdge: '919894',
  glass: '445154',
  colouredGlass: '586963',
  stainedGlass: '6b7765',
  dark: '3f4443',
  door: '51473c',
  cross: '8f8060',
});
const surfaces = {
  iron: surface('wall', 'metal_painted', 0.68, 0.13),
  stone: surface('foundation', 'stone_ashlar', 0.93),
  roof: surface('roof', 'metal_standing_seam', 0.58, 0.22),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.03 },
  trim: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.68, metallic: 0.1 },
  door: { slot: 'door', localRef: 'palette:#fffffd', roughness: 0.85 },
};
const base = (p) => Math.min(grade(p) - 0.23, d.baseY - 0.34);
const [x0, x1] = [d.wallLeft, d.wallRight];
const eaves = d.mainCorniceY;
const entry = d.wallFront;
const [towerX, towerZ] = d.bellTowerCenter;
const towerFront = entry + 0.09;
const frontage = edge([x1, entry], [x0, entry]);
const circular = (w, x, y, r, sides, offset) =>
  Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides;
    return w.p(x + r * Math.cos(angle), y + r * Math.sin(angle), offset);
  });
const sectionOutline = (width, zFront, zRear) =>
  rect(towerX - width / 2, zFront, towerX + width / 2, zRear);
const walls = (points) => pairs(closed(points)).map(([a, b]) => edge(a, b, areaSign(points)));
function mass(out, poly, from, to, color = c.iron) {
  shell(out, poly, typeof from === 'number' ? () => from : from, to, {
    wall: 'iron',
    roof: 'roof',
    color,
    roofColor: c.zinc,
  });
}
function band(out, w, y, width, projection = 0.14, color = c.cream) {
  trimBlock(
    out,
    'trim',
    w,
    0.015,
    w.length - 0.015,
    y - width / 2,
    y + width / 2,
    0.005,
    projection,
    color,
  );
}
function pilaster(out, w, u, low, top, scale, level) {
  trimBlock(out, 'trim', w, u - 0.16 * scale, u + 0.16 * scale, low, top, 0.006, 0.145, c.relief);
  if (level < 2) return;
  for (const y of [low + 0.17 * scale, top - 0.18 * scale]) {
    trimBlock(
      out,
      'trim',
      w,
      u - 0.25 * scale,
      u + 0.25 * scale,
      y - 0.14 * scale,
      y + 0.14 * scale,
      0.04,
      0.208,
      c.cream,
    );
  }
  if (level === 3) {
    for (const dx of [-0.083, 0.0, 0.083]) {
      panel(out, 'trim', w, u + dx - 0.012, u + dx + 0.012, low + 0.41, top - 0.4, 0.149, c.shade);
    }
  }
}
function rose(out, w, u, y, r, level, depth, opaque = false) {
  const count = [8, 10, 15, 18][level];
  const inner = circular(w, u, y, r, count, depth);
  face(out, opaque ? 'trim' : 'glass', inner, w.normal, opaque ? c.cream : c.colouredGlass);
  if (level === 0) return;
  const rim = circular(w, u, y, r * 1.13, count, depth + 0.023);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    face(out, 'trim', [inner[i], inner[j], rim[j], rim[i]], w.normal, c.cream);
  }
  if (level < 2 || opaque) return;
  const spokes = level === 2 ? 5 : 7;
  for (let i = 0; i < spokes; i++) {
    const a = (i * 2 * Math.PI) / spokes;
    const x = u + Math.cos(a) * r * 0.51;
    const yy = y + Math.sin(a) * r * 0.51;
    const petal = circular(w, x, yy, r * 0.21, 6, depth + 0.026);
    face(out, 'glass', petal, w.normal, i % 2 ? c.stainedGlass : c.glass);
    if (level === 3)
      beam(
        out,
        'trim',
        w.p(u, y, depth + 0.032),
        w.p(x, yy, depth + 0.032),
        0.038,
        0.027,
        c.relief,
      );
  }
}
function ornateOpening(out, w, u, bottom, spring, r, level, kind = 'window', depth = 0.04) {
  const inner = kind === 'bell' ? c.dark : c.glass;
  arch(
    out,
    w,
    u,
    bottom,
    spring,
    r,
    r * 1.12,
    depth,
    level,
    { inner, trim: c.relief, width: 0.13 + 0.03 * r },
    { inner: 'glass', trim: 'trim' },
  );
  if (level === 0) return;
  const center = spring - 0.06 * r;
  rose(out, w, u, center, r * 0.67, level, depth + 0.031);
  const top = center - r * 0.83;
  const frameDepth = depth + 0.104;
  if (kind === 'door') {
    panel(
      out,
      'door',
      w,
      u - r * 0.67,
      u + r * 0.67,
      bottom,
      Math.min(top - 0.15, bottom + 3.05),
      frameDepth,
      c.door,
    );
    panel(
      out,
      'trim',
      w,
      u - r * 0.81,
      u + r * 0.81,
      Math.min(top - 0.15, bottom + 3.05),
      Math.min(top + 0.02, bottom + 3.26),
      frameDepth + 0.048,
      c.cream,
    );
  } else {
    panel(out, 'trim', w, u - 0.065, u + 0.065, bottom, top, frameDepth, c.cream);
    panel(out, 'trim', w, u - r, u + r, top, top + 0.11, frameDepth, c.relief);
    if (level >= 2) {
      for (const t of [0.3, 0.66]) {
        const y = mix(bottom, top, t);
        panel(out, 'trim', w, u - r, u + r, y, y + 0.045, frameDepth + 0.025, c.shade);
      }
    }
  }
  if (level >= 2) {
    trimBlock(
      out,
      'trim',
      w,
      u - r - 0.13,
      u + r + 0.13,
      bottom - 0.1,
      bottom,
      0.01,
      depth + 0.18,
      c.cream,
    );
  }
}
function zincGable(out, xLeft, xRight, zNorth, zSouth, y, ridge, level, alongX = false) {
  const local = alongX ? (x, Y, z) => [z, Y, x] : (x, Y, z) => [x, Y, z];
  const center = (xLeft + xRight) / 2;
  const a = local(xLeft, y, zNorth),
    b = local(center, ridge, zNorth),
    c1 = local(xRight, y, zNorth);
  const d1 = local(xLeft, y, zSouth),
    e = local(center, ridge, zSouth),
    f = local(xRight, y, zSouth);
  face(out, 'roof', [a, b, e, d1], up, c.zinc);
  face(out, 'roof', [b, c1, f, e], up, c.zinc);
  face(out, 'iron', [a, b, c1], alongX ? [-1, 0, 0] : [0, 0, -1], c.iron);
  face(out, 'iron', [d1, e, f], alongX ? [1, 0, 0] : [0, 0, 1], c.iron);
  if (level >= 1) {
    beam(out, 'roof', b, e, 0.1, 0.15, c.zincEdge);
    for (const [p, q] of [
      [a, b],
      [b, c1],
      [d1, e],
      [e, f],
    ])
      beam(out, 'trim', p, q, 0.1, 0.12, c.cream);
  }
  if (level >= 2) {
    const count = Math.ceil((zSouth - zNorth) / (level === 2 ? 3.35 : 1.75));
    for (let i = 1; i < count; i++) {
      const z = mix(zNorth, zSouth, i / count);
      const p = local(center, ridge + 0.04, z);
      for (const x of [xLeft, xRight])
        beam(out, 'roof', p, local(x, y + 0.04, z), 0.034, 0.032, c.zincEdge);
    }
  }
}
function spire(out, center, profile, level) {
  const n = [8, 10, 14, 20][level];
  loft(
    out,
    'roof',
    profile.map(([y, r]) => radialRing(y, r, r, n, center)),
    c.zinc,
  );
  if (level < 2) return;
  const ribs = level === 3 ? n : 7;
  for (let j = 0; j < ribs; j++) {
    const angle = (j * 2 * Math.PI) / ribs;
    const offset = (y, r) => [
      center[0] + Math.cos(angle) * (r + 0.012),
      y,
      center[1] + Math.sin(angle) * (r + 0.012),
    ];
    for (const [[y, a], [top, b]] of pairs(profile.slice(0, -1))) {
      beam(out, 'roof', offset(y, a), offset(top, b), 0.034, 0.033, c.zincEdge);
    }
  }
}
function cross(out, x, z, center, peak, width, scale) {
  beam(
    out,
    'trim',
    [x, center - scale * 0.65, z],
    [x, peak, z],
    scale * 0.087,
    scale * 0.087,
    c.cross,
  );
  beam(
    out,
    'trim',
    [x - width / 2, center, z],
    [x + width / 2, center, z],
    scale * 0.075,
    scale * 0.075,
    c.cross,
  );
}
function finial(out, w, u, floor, level, size = 1) {
  const [x, , z] = w.p(u, floor, 0.09);
  const wide = size * 0.29;
  block(out, 'iron', x - wide, floor, z - wide, 2 * wide, size * 0.62, 2 * wide, c.iron);
  loft(
    out,
    'roof',
    [
      radialRing(floor + size * 0.57, wide, wide, 4, [x, z], Math.PI / 4),
      radialRing(floor + size * 0.97, wide * 0.63, wide * 0.63, 4, [x, z], Math.PI / 4),
      radialRing(floor + size * 1.19, wide * 0.09, wide * 0.09, 4, [x, z], Math.PI / 4),
    ],
    c.zinc,
  );
  if (level >= 2)
    cross(out, x, z, floor + 1.21 * size, floor + 1.4 * size, 0.31 * size, size * 0.49);
}
function decoratedCrown(out, w, level, height, count) {
  band(out, w, height - 0.46, 0.22, 0.22, c.cream);
  band(out, w, height - 0.16, 0.18, 0.27, c.relief);
  if (level === 0) return;
  panel(out, 'trim', w, 0.04, w.length - 0.04, height - 0.13, height + 0.45, 0.18, c.shade);
  band(out, w, height + 0.47, 0.12, 0.24, c.cream);
  for (let i = 0; i < count; i++) {
    const u = (w.length * (i + 0.5)) / count;
    panel(out, 'trim', w, u - 0.045, u + 0.045, height - 0.13, height + 0.45, 0.198, c.cream);
    if (level >= 2)
      rose(out, w, u + (w.length / count) * 0.22, height + 0.14, 0.125, level, 0.206, true);
  }
}
function baseAndNaves(out, level) {
  shell(out, d.outline, base, d.baseY, {
    wall: 'stone',
    roof: 'stone',
    color: c.stone,
    roofColor: c.plinth,
  });
  mass(out, d.outline, d.baseY, eaves);
  const straight = [edge(d.outline[2], d.outline[3], -1), edge(d.outline[6], d.outline[0], -1)];
  for (const [side, w] of straight.entries()) {
    const cantedTransept = w.length * (side === 0 ? 0.84 : 0.16);
    for (let i = 0; i < 5; i++) {
      const u = side === 0 ? 4.0 + i * 3.02 : w.length - 4.0 - i * 3.02;
      ornateOpening(
        out,
        w,
        u,
        i === 2 ? d.baseY : 3.08,
        7.12,
        0.93,
        level,
        i === 2 ? 'door' : 'window',
      );
      if (level >= 1) pilaster(out, w, u - 1.34, d.baseY + 0.42, 9.72, 0.7, level);
    }
    ornateOpening(out, w, cantedTransept, 2.72, 8.09, 1.26, level, 'window', 0.1);
    band(out, w, 2.98, 0.13, 0.14, c.cream);
    decoratedCrown(out, w, level, eaves, level === 3 ? 20 : 11);
    if (level >= 1) {
      for (const frac of [0.05, 0.19, 0.34, 0.49, 0.66, 0.83, 0.97]) {
        finial(
          out,
          w,
          w.length * frac,
          eaves + 0.39,
          level,
          frac === 0.05 || frac === 0.97 ? 0.9 : 0.58,
        );
      }
    }
  }
  zincGable(out, x0 - 0.07, x1 + 0.07, -11.8, entry - 0.21, eaves, d.naveRidgeY, level);
  zincGable(
    out,
    d.transeptCenterZ - 2.31,
    d.transeptCenterZ + 2.31,
    x0 - 0.16,
    x1 + 0.16,
    eaves,
    14.59,
    level,
    true,
  );
  for (const x of [x0 - 0.14, x1 + 0.14])
    cross(out, x, d.transeptCenterZ, 14.89, 15.41, 0.57, 0.72);

  const apse = [d.outline[3], d.outline[4], d.outline[5], d.outline[6]];
  const roofCenter = [-0.23, 14.02, -11.68];
  for (const [index, w] of walls(d.outline).slice(3, 6).entries()) {
    const a = apse[index],
      b = apse[index + 1];
    face(out, 'roof', [at(a, eaves), at(b, eaves), roofCenter], up, c.zinc);
    ornateOpening(out, w, w.length / 2, 3.24, 7.22, Math.min(1.03, w.length * 0.24), level);
    band(out, w, 2.98, 0.13, 0.14, c.cream);
    decoratedCrown(out, w, level, eaves, level === 3 ? 8 : 4);
    if (level >= 1) {
      pilaster(out, w, 0.32, 1.4, 9.93, 0.82, level);
      finial(out, w, 0.43, eaves + 0.4, level, 0.88);
    }
  }

  for (const sign of [-1, 1]) {
    const u = frontage.length / 2 + sign * 5.54;
    ornateOpening(out, frontage, u, 3.15, 7.59, 0.93, level);
    if (level >= 1) {
      pilaster(out, frontage, u + sign * 1.28, 1.38, 9.8, 0.9, level);
      finial(out, frontage, u + sign * 1.53, eaves + 0.41, level, 0.84);
    }
  }
  decoratedCrown(out, frontage, level, eaves, level === 3 ? 16 : 8);
}
function tower(out, level) {
  const basePoly = sectionOutline(6.75, towerFront, towerZ - 2.81);
  const platform = sectionOutline(6.06, towerFront - 0.22, towerZ - 2.62);
  const belfry = sectionOutline(4.85, towerFront - 0.88, towerZ - 2.39);
  mass(out, basePoly, d.baseY, 12.95);
  mass(out, platform, 12.86, 16.9, c.relief);
  mass(out, belfry, 16.73, 23.1);
  const w = walls(basePoly)[0];
  ornateOpening(out, w, w.length / 2, d.baseY, 8.88, 1.59, level, 'door', 0.085);
  const r = 1.99;
  const center = w.length / 2;
  const portal = [
    w.p(center - r, 8.21, 0.15),
    w.p(center, 12.72, 0.15),
    w.p(center + r, 8.21, 0.15),
  ];
  for (const [a, b] of pairs(portal)) beam(out, 'trim', a, b, 0.14, 0.16, c.cream);
  if (level >= 1)
    for (const u of [0.49, w.length - 0.49]) pilaster(out, w, u, 1.36, 10.92, 1.36, level);
  for (const a of walls(platform)) {
    band(out, a, 16.51, 0.24, 0.22, c.cream);
    decoratedCrown(out, a, level, 16.89, 6);
    if (level >= 1) {
      for (const t of [0.043, 0.5, 0.957])
        finial(out, a, t * a.length, 17.23, level, t === 0.5 ? 0.68 : 0.92);
    }
  }
  for (const f of walls(belfry)) {
    ornateOpening(out, f, f.length / 2, 17.75, 21.18, 1.05, level, 'bell');
    band(out, f, 22.91, 0.31, 0.22, c.cream);
    if (level >= 1) {
      for (const u of [0.32, f.length - 0.32]) pilaster(out, f, u, 17.41, 22.63, 0.92, level);
    }
    const center = f.length / 2;
    face(
      out,
      'iron',
      [f.p(center - 1.15, 23.0, 0.075), f.p(center + 1.15, 23, 0.075), f.p(center, 24.66, 0.075)],
      f.normal,
      c.relief,
    );
    rose(out, f, center, 23.62, 0.4, level, 0.103, true);
    if (level >= 1) finial(out, f, 0.34, 23.09, level, 0.82);
  }
  spire(
    out,
    [towerX, towerZ - 0.1],
    [
      [23.02, 2.0],
      [24.67, 1.91],
      [25.63, 1.61],
      [26.4, 1.17],
      [27.49, 0.53],
      [28.17, 0.2],
      [28.35, 0.11],
    ],
    level,
  );
  cross(out, towerX, towerZ - 0.1, 29.31, d.bellTowerPeak, 0.91, 1.35);
  if (level >= 1)
    beam(
      out,
      'trim',
      [towerX, 28.22, towerZ - 0.1],
      [towerX, 28.82, towerZ - 0.1],
      0.12,
      0.12,
      c.cross,
    );
}
function entranceSteps(out, level) {
  const steps = [3, 4, 5, 6][level];
  for (let i = 0; i < steps; i++) {
    const fraction = i / steps;
    const z = entry + 2.15 - ((i + 1) * 2.15) / steps;
    const width = 5.1 - 0.61 * fraction;
    const bottom = Math.min(grade([0, z]) - 0.16, -0.2);
    block(
      out,
      'stone',
      -width / 2,
      bottom,
      z,
      width,
      (d.baseY * (i + 1)) / steps - bottom,
      2.15 / steps + 0.017,
      c.plinth,
    );
  }
}
function build(out, level) {
  baseAndNaves(out, level);
  tower(out, level);
  entranceSteps(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'bulgarian-st-stephen-church-model.mjs';
const camera = [43, 25, 61],
  lookAt = [0, 12.4, 0];
const errors = { district: 0.35, street: 0.13, closeup: 0.045 };
export const ironChurchAsset = {
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
    'Original Istanbul relief at the cast-iron church steps and native polygon along the Golden Horn.',
  brief:
    'Istanbul’s Bulgarian Iron Church, with a 30 m domed bell tower, arcaded cast-iron walls, an apsidal east end and a zinc roof.',
  camera,
  lookAt,
  sunDirection: [54, 86, 83],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'The standing cast-iron church’s named native outline.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'stone_ashlar', 'metal_standing_seam'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'golden-horn-apse-and-transept', position: [27, 18, -38], lookAt: [0, 10, -6] },
    { name: 'cast-iron-opening-and-portal', position: [7.5, 7.4, 26], lookAt: [0, 7.3, 10] },
    { name: 'belfry-and-zinc-spire', position: [19, 31, 35], lookAt: [0, 22, 9.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bulgarian-st-stephen-church-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.83,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Historic plate in the public domain.',
};
