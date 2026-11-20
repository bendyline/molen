import { readFileSync } from 'node:fs';
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
  palette,
  panel,
  pairs,
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
const colors = palette({
  stone: '82786c',
  base: '656760',
  trim: 'a29888',
  cap: '9c8d7d',
  scar: '9a7259',
  ochre: '9b6247',
  ochreLight: 'a87858',
  weatheredRoof: '96654e',
  fadedRoof: '9c6b52',
  smoke: '775646',
  moss: '666d50',
  dark: '363733',
  shy: '625647',
  metal: '585d58',
  mortar: 'aaa093',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone_weathered', 0.97),
  rough: surface('foundation', 'stone_ashlar', 0.98),
  roof: surface('roof', 'concrete_plain', 0.97),
  brick: surface('trim', 'brick_longformat', 0.91),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96 },
  metal: surface('trim', 'metal_bronze_cast', 0.78, 0.19),
};
const floor = 0.86;
const base = (point) => Math.min(floor - 0.15, grade(point) - 0.4);
const outlineEdges = (outline) =>
  pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
const stoneBody = (out, outline, bottom, top, c, roof = c) =>
  shell(out, outline, bottom, top, { wall: 'stone', color: c, roof: 'roof', roofColor: roof });

function recess(out, wall, axis, low, height, half, level, trim = colors.scar) {
  arch(
    out,
    wall,
    axis,
    low,
    low + height - half,
    half,
    half,
    0.037,
    level,
    { inner: colors.dark, trim, width: 0.14 },
    { inner: 'dark', trim: 'brick' },
  );
  if (level > 0)
    trimBlock(
      out,
      'stone',
      wall,
      axis - half - 0.15,
      axis + half + 0.15,
      low - 0.12,
      low - 0.018,
      0.015,
      0.21,
      colors.trim,
    );
}

function roofPoint([a, b, north, south], x, t, lift = 0) {
  const a1 = Math.PI * t;
  const z = mix(north, south, (1 - Math.cos(a1)) / 2);
  return [mix(a, b, x), d.naveEave + d.roofRise * Math.sin(a1) + lift, z];
}

function chapelRoof(out, level) {
  const rows = [7, 12, 20, 30][level];
  const cols = [2, 5, 9, 13][level];
  const bounds = d.roof;
  const v = (x, t, dy) => roofPoint(bounds, x, t, dy);
  const tones = [colors.weatheredRoof, colors.ochre, colors.fadedRoof, colors.weatheredRoof];
  for (let j = 0; j < rows; j++) {
    const t = j / rows,
      u = (j + 1) / rows;
    for (let i = 0; i < cols; i++) {
      const x = i / cols,
        y = (i + 1) / cols;
      const tone = tones[(i * 17 + j * 11 + ((i * j) % 3)) % tones.length];
      face(
        out,
        'roof',
        [v(x, t), v(y, t), v(y, u), v(x, u)],
        up,
        level === 0 ? colors.ochre : tone,
      );
    }
    for (const x of [0, 1]) {
      const a = v(x, t),
        b = v(x, u);
      const y = d.naveEave - 0.09;
      face(
        out,
        'stone',
        [[a[0], y, a[2]], [b[0], y, b[2]], b, a],
        [x === 0 ? -1 : 1, 0, 0],
        colors.stone,
      );
    }
  }
  if (level > 0) {
    for (const z of [bounds[2], bounds[3]])
      block(
        out,
        'stone',
        bounds[0] - 0.05,
        d.naveEave - 0.14,
        z - 0.13,
        bounds[1] - bounds[0] + 0.13,
        0.17,
        0.27,
        colors.cap,
      );
  }
  if (level > 1) {
    for (let i = 0; i < (level === 3 ? 105 : 43); i++) {
      const x = ((i * 59) % 143) / 150 + 0.02;
      const t = ((i * 31 + 11) % 113) / 119 + 0.02;
      const row = Math.min(rows - 1, Math.floor(t * rows));
      const t0 = row / rows,
        t1 = (row + 1) / rows;
      const p = (x, a) => {
        const start = v(x, t0, 0.016),
          end = v(x, t1, 0.016);
        return start.map((v, i) => mix(v, end[i], a));
      };
      const dx = 0.019 + (i % 5) * 0.004;
      const a = 0.13 + ((i * 13) % 9) * 0.057;
      face(
        out,
        'roof',
        [p(x, a), p(Math.min(0.996, x + dx), a + 0.07), p(x + dx * 0.26, a + 0.27)],
        up,
        i % 5 === 0 ? colors.moss : i % 3 === 0 ? colors.smoke : colors.mortar,
      );
    }
  }
}

function weatherMarks(out, wall, start, end, low, high, level, seed) {
  if (level < 2) return;
  const count = level === 2 ? 14 : 42;
  for (let i = 0; i < count; i++) {
    const u = mix(start, end, ((31 * i + seed * 11) % 89) / 92);
    const y = mix(low, high, ((19 * i + seed * 13) % 71) / 75);
    const w = 0.11 + ((i * 19 + 5) % 21) * 0.024;
    const h = 0.13 + ((i * 7 + 2) % 16) * 0.034;
    const points = [
      wall.p(u, y, 0.024),
      wall.p(u + w, y + h * 0.19, 0.024),
      wall.p(u + w * 0.83, y + h, 0.024),
      wall.p(u + w * 0.13, y + h * 0.79, 0.024),
    ];
    face(
      out,
      i % 4 === 0 ? 'stone' : 'brick',
      points,
      wall.normal,
      i % 4 === 0 ? colors.moss : i % 3 === 0 ? colors.ochreLight : colors.scar,
    );
  }
}

function chapel(out, level) {
  stoneBody(out, d.nave, base, floor + 0.24, colors.base);
  stoneBody(out, d.nave, () => floor + 0.22, d.naveEave, colors.stone);
  chapelRoof(out, level);
  for (const [i, wall] of outlineEdges(d.nave).entries()) {
    if (wall.length < 12) continue;
    const side = wall.length > 16;
    if (side) {
      const count = i === 1 ? 6 : 8;
      const step = (wall.length - 0.3) / count;
      for (let n = 0; n < count; n++) {
        const u = 0.15 + (n + 0.5) * step;
        arch(
          out,
          wall,
          u,
          5.35,
          5.48,
          step * 0.43,
          0.67,
          0.018,
          level < 2 ? 0 : 2,
          { inner: colors.stone, trim: colors.scar, width: 0.11 },
          { inner: 'stone', trim: 'brick' },
        );
        if (n % 2 === 1 || (i === 4 && n === 0))
          recess(out, wall, u, 1.68, 2.37, 0.51, level < 2 ? 0 : 1);
      }
    }
    if (level > 0)
      trimBlock(
        out,
        'stone',
        wall,
        0.08,
        wall.length - 0.08,
        d.naveEave - 0.28,
        d.naveEave - 0.02,
        0.01,
        0.13,
        colors.cap,
      );
    weatherMarks(out, wall, 0.16, wall.length - 0.75, 1.26, 5.09, level, i + 2);
  }
}

function towerRoof(out, level) {
  const edgeY = d.towerEave;
  const base = rect(6.03, -4.73, 10.82, 1.79);
  const peak = [8.45, d.spireTop - 0.75, -1.46];
  for (const [i, [a, b]] of pairs(closed(base)).entries())
    face(
      out,
      'roof',
      [at(a, edgeY), at(b, edgeY), peak],
      up,
      i % 2 === 0 ? colors.ochre : colors.smoke,
    );
  const [x, , z] = peak;
  block(out, 'metal', x - 0.055, peak[1] - 0.021, z - 0.063, 0.11, 1.34, 0.126, colors.metal);
  block(out, 'metal', x - 0.047, peak[1] + 0.75, z - 0.42, 0.094, 0.105, 0.84, colors.metal);
  if (level > 0) stoneBody(out, base, () => edgeY - 0.25, edgeY, colors.cap);
}

function tower(out, level) {
  const upperTower = rect(6.08, -4.52, 10.67, 1.48);
  stoneBody(out, d.tower, base, floor + 0.25, colors.base);
  stoneBody(out, upperTower, base, d.towerEave - 0.04, colors.stone);
  towerRoof(out, level);
  for (const [i, wall] of outlineEdges(upperTower).entries()) {
    if (wall.length < 2.55) continue;
    if (level > 0) {
      trimBlock(out, 'stone', wall, 0, wall.length, 4.62, 4.8, 0.016, 0.12, colors.cap);
      trimBlock(
        out,
        'stone',
        wall,
        0,
        wall.length,
        d.towerEave - 0.48,
        d.towerEave - 0.19,
        0.015,
        0.17,
        colors.cap,
      );
    }
    if (i === 1 || i === 2) {
      const u = wall.length * 0.53,
        low = 7.93,
        r = 0.25;
      arch(
        out,
        wall,
        u,
        low,
        low + r,
        r,
        r,
        0.04,
        level < 2 ? 0 : 1,
        { inner: colors.shy, trim: colors.cap, width: 0.084 },
        { inner: 'dark', trim: 'stone' },
      );
    }
    if (i === 2) recess(out, wall, wall.length * 0.56, floor, 2.58, 0.72, Math.min(level, 2));
    if (i === 1) {
      const u = wall.length * 0.51;
      panel(out, 'metal', wall, u - 0.058, u + 0.058, 1.68, 3.15, 0.047, colors.shy);
      panel(out, 'metal', wall, u - 0.34, u + 0.34, 2.41, 2.53, 0.051, colors.shy);
    }
    weatherMarks(out, wall, 0.09, wall.length - 0.55, 1.27, 8.75, level, i + 17);
  }
  const treadCount = level === 0 ? 2 : 4;
  for (const [bounds, alongX] of [
    [[10.61, -3.16, 11.71, 0.96], true],
    [[7.56, 1.3, 10.61, 2.75], false],
  ]) {
    for (let i = 0; i < treadCount; i++) {
      const [xa, za, xb, zb] = bounds;
      const r = (i + 1) / treadCount;
      const points = alongX
        ? rect(xa, za, mix(xb, xa, (i / treadCount) * 0.87), zb)
        : rect(xa, za, xb, mix(zb, za, (i / treadCount) * 0.87));
      const y = mix(0.11, floor, r);
      stoneBody(
        out,
        points,
        (p) => Math.min(y - 0.15, grade(p) - 0.2),
        y,
        colors.base,
        colors.trim,
      );
    }
  }
}

function attachedRuin(out, level) {
  const [a, b, c, d0] = d.annex;
  const wallPlans = [
    [a, d0, 3.0, 2.35],
    [d0, [-10.36, 7.36], 2.35, 2.23],
    [[-9.2, 7.38], [-3.71, 7.41], 1.46, 2.72],
    [[-3.71, 7.41], c, 2.72, 2.17],
    [c, b, 2.17, 2.81],
  ];
  stoneBody(out, d.annex, base, floor + 0.02, colors.base);
  for (const [p, q, h1, h2] of wallPlans) {
    const w = edge(p, q);
    const steps = level > 1 ? Math.max(3, Math.ceil(w.length * 1.7)) : 1;
    for (let i = 0; i < steps; i++) {
      const t = i / steps,
        u = (i + 1) / steps;
      const a = t * w.length,
        b = u * w.length;
      const [ax, , az] = w.p(a, 0);
      const [bx, , bz] = w.p(b, 0);
      const gradeA = grade([ax, az]);
      const gradeB = grade([bx, bz]);
      const height = mix(h1, h2, (t + u) / 2) - floor;
      const nib = i === 0 || i === steps - 1 ? 0 : ((i % 3) - 1) * 0.14;
      trimBlock(
        out,
        'rough',
        w,
        a,
        b,
        floor - 0.08,
        Math.max(floor, (gradeA + gradeB) / 2) + height + nib,
        -0.29,
        0.26,
        colors.trim,
      );
    }
  }
  if (level >= 2) {
    const [x, z] = [-9.69, 6.93];
    block(out, 'rough', x, floor, z, 0.36, 0.39, 0.52, colors.base);
    block(out, 'stone', x + 0.48, floor, z - 0.33, 0.47, 0.22, 0.4, colors.scar);
  }
}

function build(out, level) {
  chapel(out, level);
  tower(out, level);
  attachedRuin(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'church-of-mount-bokor-model.mjs';
const camera = [37, 22, 36];
const lookAt = [-1, 5, 0];
const errors = { district: 0.43, street: 0.14, closeup: 0.05 };
export const churchOfMountBokorAsset = {
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
  groundContactBasis: 'Original Bokor plateau elevation at the church tower approach.',
  brief:
    'The weathered Bokor plateau church with its curved concrete roof, square bell tower, stone steps, cross and roofless side ruin.',
  camera,
  lookAt,
  sunDirection: [-27, 83, 62],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named existing chapel and annex footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'tower-cross-side-door-and-steps', position: [21, 9, 16], lookAt: [6.5, 6, 0.5] },
    { name: 'barrel-roof-and-arched-side-bays', position: [-22, 20, 25], lookAt: [-4, 6, 0] },
    { name: 'roofless-annex-and-west-wall', position: [-19.5, 8, 14], lookAt: [-8, 3, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'church-of-mount-bokor-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.77,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
