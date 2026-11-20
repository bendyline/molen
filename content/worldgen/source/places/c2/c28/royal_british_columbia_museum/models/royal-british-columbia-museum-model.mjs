import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
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
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  concrete: 'b3b1a1',
  cement: 'a6a79e',
  light: 'c1c0af',
  foundation: '8e8d83',
  gray: '8f9188',
  stone: 'a09f90',
  shadow: '6f746e',
  wall: 'acaaa0',
  frames: '454d4b',
  glass: '587071',
  glassBlue: '63797a',
  lobbyShadow: '566364',
  darkGlass: '4b5c5c',
  roof: '777e78',
  roofLight: '8b8f84',
  rails: '474e4b',
});
const surfaces = {
  concrete: surface('wall', 'concrete_plain', 0.92),
  limestone: surface('wall', 'stone_limestone', 0.93),
  foundation: surface('foundation', 'concrete_plain', 0.95),
  roof: surface('roof', 'metal_standing_seam', 0.89, 0.1),
  frame: surface('trim', 'metal_painted', 0.81, 0.14),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.06 },
};
const base = (p) => Math.min(grade(p) - 0.29, d.entryLevel - 0.28);
const walls = (poly) => pairs(closed(poly)).map(([a, b]) => edge(a, b, areaSign(poly)));
const mass = (out, poly, bottom, top, slot, color, roof = c.roof) =>
  shell(out, poly, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: slot,
    roof: 'roof',
    color,
    roofColor: roof,
  });
function glassWall(
  out,
  w,
  low,
  high,
  level,
  spacing = 2.0,
  margin = 0.15,
  depth = 0.075,
  horizontal = 2,
  band = false,
) {
  const length = w.length - margin * 2;
  if (length < 0.19) return;
  const n =
    level === 0 ? 1 : Math.max(1, Math.round(length / (level === 1 ? spacing * 2 : spacing)));
  let tone = c.glass;
  for (let k = 0; k < n; k++) {
    const a = margin + (length * k) / n,
      b = margin + (length * (k + 1)) / n;
    const gap = level >= 1 ? Math.min(0.034, (length / n) * 0.08) : 0;
    tone = [c.glass, c.glassBlue, c.glass, c.darkGlass, c.glassBlue][k % 5];
    panel(out, 'glass', w, a + gap, b - gap, low, high, depth, tone);
    if (level < 2) continue;
    panel(out, 'frame', w, a - gap, a + gap, low, high, depth + 0.026, c.frames);
    if (band && level === 3)
      panel(out, 'frame', w, a + gap, b - gap, low + 0.18, low + 0.27, depth + 0.024, c.shadow);
  }
  if (level < 2) return;
  for (let j = 1; j <= horizontal; j++) {
    const y = mix(low, high, j / (horizontal + 1));
    panel(
      out,
      'frame',
      w,
      margin,
      w.length - margin,
      y - 0.046,
      y + 0.046,
      depth + 0.045,
      c.frames,
    );
  }
  for (const y of [low - 0.04, high]) {
    panel(out, 'frame', w, margin, w.length - margin, y, y + 0.095, depth + 0.043, c.frames);
  }
}
function band(out, w, y, thickness, color = c.light) {
  trimBlock(out, 'concrete', w, 0, w.length, y, y + thickness, 0.018, 0.15, color);
}
function fannin(out, level) {
  const podium = rect(-55.3, 13.2, -25.23, 38.3);
  mass(out, podium, base, 5.32, 'concrete', c.gray);
  const top = d.fanninRoof;
  mass(out, d.fannin, () => 4.94, top, 'limestone', c.stone);
  const tw = walls(d.fannin);
  const glazed = [tw[7], edge([-31.2, 38.35], [-52.5, 38.35])];
  for (const [i, w] of glazed.entries()) {
    const floorCount = level === 0 ? 5 : 6;
    const bottom = 5.29,
      end = top - 1.18,
      step = (end - bottom) / floorCount;
    for (let j = 0; j < floorCount; j++) {
      const lo = bottom + j * step,
        hi = lo + step * 0.69;
      glassWall(out, w, lo, hi, level, 1.53, i === 0 ? 0.09 : 3.22, 0.079, 1, j < floorCount - 1);
      if (level > 0)
        panel(out, 'concrete', w, 0.12, w.length - 0.1, hi + 0.03, hi + 0.43, 0.041, c.gray);
    }
  }
  for (const w of tw) {
    band(out, w, top - 0.4, 0.36);
    if (level > 0) panel(out, 'concrete', w, 0, w.length, 5.33, 5.65, 0.073, c.light);
  }
  const ph = rect(-38.31, 20.94, -27.88, 32.11);
  mass(out, ph, top - 0.14, d.penthouseRoof, 'concrete', c.gray, c.roofLight);
  for (const w of walls(ph)) {
    band(out, w, d.penthouseRoof - 0.24, 0.26);
    if (level >= 2)
      panel(
        out,
        'frame',
        w,
        w.length * 0.21,
        w.length * 0.61,
        top + 0.93,
        top + 2.26,
        0.043,
        c.frames,
      );
  }
}
function exhibition(out, level) {
  const y = d.galleryRoof;
  mass(out, d.exhibition, base, y, 'concrete', c.concrete, c.roof);
  const perimeter = walls(d.exhibition);
  for (const [i, w] of perimeter.entries()) {
    band(out, w, y - 0.31, 0.26, c.light);
    if (w.length < 5) continue;
    if (i === 0 || i === 1 || i === 2 || i === 3 || i === 9) {
      const glassLow = Math.max(
        1.38,
        grade([w.p(w.length / 2, 0)[0], w.p(w.length / 2, 0)[2]]) + 0.56,
      );
      const zones = w.length > 28 ? Math.round(w.length / 11) : 2;
      for (let j = 0; j < zones; j++) {
        const u = (w.length * (j + 0.5)) / zones;
        const half = Math.min(3.4, (w.length / zones) * 0.32);
        if (level > 0)
          panel(
            out,
            'glass',
            w,
            u - half,
            u + half,
            glassLow,
            5.9,
            0.065,
            [c.darkGlass, c.glass, c.lobbyShadow][j % 3],
          );
        if (level >= 2)
          for (const v of [u - half * 0.38, u + half * 0.31]) {
            panel(out, 'frame', w, v - 0.041, v + 0.041, glassLow, 5.91, 0.094, c.frames);
          }
      }
    }
    if (level >= 1) {
      const n = Math.max(2, Math.round(w.length / 3.95));
      for (let j = 1; j < n; j++) {
        const u = (w.length * j) / n;
        panel(out, 'concrete', w, u - 0.054, u + 0.054, 6.78, y - 0.42, 0.037, c.gray);
        if (level >= 2 && j % 3 === 0)
          trimBlock(out, 'concrete', w, u - 0.23, u + 0.23, 6.59, y - 0.41, 0.046, 0.145, c.cement);
      }
      for (const top of [6.48, 13.25, 18.67])
        if (top < y - 0.37)
          panel(out, 'concrete', w, 0, w.length, top, top + 0.122, 0.062, c.cement);
    }
  }
  const top = d.clerestoryRoof;
  mass(out, d.clerestory, y - 0.1, top, 'concrete', c.cement, c.roofLight);
  for (const w of walls(d.clerestory)) {
    band(out, w, top - 0.2, 0.28);
    if (level >= 1) {
      const a = w.length * 0.045;
      glassWall(out, w, y + 0.34, top - 0.31, level, 2.45, a, 0.051, 0);
    }
  }
  if (level >= 2) {
    for (const [x, z, w, h] of [
      [25, 3, 7.5, 1.93],
      [22, 10, 4.6, 1.05],
      [22.8, 51, 6.2, 0.92],
      [32, -11, 3.7, 0.58],
      [17, 30, 3.4, 0.6],
    ])
      block(out, 'roof', x - w / 2, top - 0.07, z - 1.1, w, h, 2.2, c.roof);
  }
}
function glazedMass(out, poly, low, hi, level, style, tall) {
  mass(out, poly, low, hi, style, style === 'glass' ? c.lobbyShadow : c.concrete, c.roofLight);
  for (const w of walls(poly)) {
    if (level > 0) band(out, w, hi - 0.28, 0.28);
    if (w.length < 0.3) continue;
    glassWall(
      out,
      w,
      0.67,
      hi - 0.37,
      level,
      1.39,
      Math.min(0.23, w.length * 0.075),
      0.06,
      tall ? 4 : 2,
    );
    if (level >= 1 && w.length > 4.2) {
      const n = Math.round(w.length / 3.84);
      for (let i = 0; i <= n; i++) {
        const u = (w.length * i) / n;
        const width = level === 3 ? 0.106 : 0.085;
        panel(
          out,
          'frame',
          w,
          Math.max(0, u - width),
          Math.min(w.length, u + width),
          0.47,
          hi - 0.11,
          0.122,
          c.frames,
        );
      }
    }
  }
}
function lobby(out, level) {
  const heights = [d.lobbyRoof, d.vestibuleRoof];
  const walls = [
    [
      [-27.9, 13.25],
      [-17.5, 10.03],
      [-13.75, 11.15],
      [-8.55, 11.2],
      [-8.92, 3.1],
      [3.52, 1.2],
      [8.67, -15.15],
      [9.6, 21.92],
      [-25.18, 21.49],
      [-27.96, 17.55],
    ],
    d.vestibule,
  ];
  glazedMass(out, walls[0], base, heights[0], level, 'concrete', true);
  glazedMass(out, walls[1], base, heights[1], level, 'glass', true);
  const curtain = edge([-10.78, -4.07], [3.37, -4.025]);
  if (level > 0) {
    glassWall(out, curtain, 0.55, 4.62, level, 1.46, 0.22, 0.15, 1);
    for (const u of [3.08, 6.92, 11.37]) {
      panel(out, 'frame', curtain, u - 0.48, u + 0.49, 0.55, 3.2, 0.19, c.frames);
      panel(out, 'glass', curtain, u - 0.41, u + 0.43, 0.65, 3.03, 0.221, c.glassBlue);
    }
  }
  const [left, right] = [-12.35, 5.52];
  const porchFront = -8.66,
    porchBack = -3.88,
    top = 4.85;
  const porch = rect(left, porchFront, right, porchBack);
  shell(out, porch, () => top - 0.53, top, {
    wall: 'concrete',
    roof: 'roof',
    color: c.light,
    roofColor: c.roof,
  });
  for (const x of [left + 0.88, right - 0.9]) {
    const z = porchFront + 0.51,
      ground = grade([x, z]) + 0.43;
    const profiles = [
      [ground - 0.29, 0.41],
      [top - 1.36, 0.46],
      [top - 0.84, 0.62],
      [top - 0.42, 0.98],
    ];
    loft(
      out,
      'concrete',
      profiles.map(([y, r]) => radialRing(y, r, r, level >= 2 ? 10 : 5, [x, z])),
      c.light,
    );
  }
  stairs(
    out,
    grade,
    'foundation',
    left + 0.13,
    right - 0.17,
    -14.43,
    porchFront + 0.5,
    d.entryLevel + 0.12,
    level > 0 ? 5 : 2,
    c.foundation,
  );
  if (level >= 1) {
    for (const x of [left + 0.43, -4.39, right - 0.61]) {
      const y = grade([x, -14.3]) + 0.86;
      beam(out, 'frame', [x, y, -14.26], [x, d.entryLevel + 1.23, -8.28], 0.062, 0.065, c.rails);
      for (const z of [-14.26, -11.62, -8.28]) {
        const t = (z + 14.26) / 5.98,
          h = mix(y, d.entryLevel + 1.23, t);
        beam(out, 'frame', [x, h - 0.88, z], [x, h, z], 0.051, 0.051, c.rails);
      }
    }
  }
}
function archives(out, level) {
  const top = d.archivesRoof,
    low = d.entryLevel + 0.22;
  const w = walls(d.archives);
  for (const [i, v] of w.entries()) {
    const isPublic = i >= 4;
    face(
      out,
      isPublic ? 'glass' : 'concrete',
      [v.p(0, low), v.p(v.length, low), v.p(v.length, top - 0.53), v.p(0, top - 0.53)],
      v.normal,
      isPublic ? c.darkGlass : c.concrete,
    );
    if (isPublic) glassWall(out, v, low + 0.12, top - 0.82, level, 2.19, 0.17, 0.065, 1);
    if (level > 0) band(out, v, low - 0.14, 0.18, c.cement);
  }
  const eastNorth = d.archives[8],
    westNorth = d.archives[5];
  const front = edge(westNorth, eastNorth);
  const foldZ = -12.0;
  const rear = edge([-53.58, 3.34], [-15.97, 2.95]);
  const n = level === 0 ? 10 : 17,
    width = front.length / n;
  for (let i = 0; i < n; i++) {
    const a = i * width,
      b = (i + 0.5) * width,
      q = (i + 1) * width;
    const near = (u, y) => front.p(u, y, 0.31);
    const far = (u, y) => rear.p((rear.length * u) / front.length, y);
    const y = top - 0.1,
      high = top + 0.22,
      shore = top - 0.58;
    const ridge = near(b, high);
    for (const [u, v, uy, vy] of [
      [a, b, y, high],
      [b, q, high, y],
    ]) {
      const p1 = near(u, uy),
        p2 = near(v, vy);
      const side1 = [p1[0], uy, foldZ],
        side2 = [p2[0], vy, foldZ];
      face(out, 'roof', [p1, p2, side2, side1], up, c.roofLight);
      face(out, 'roof', [side1, side2, far(v, top - 0.015), far(u, top - 0.015)], up, c.roofLight);
    }
    const topEdge = [near(a, y), ridge, near(q, y), near(b, shore)];
    face(out, 'concrete', topEdge, [0, 0, -1], c.light);
    if (level >= 2) {
      face(
        out,
        'frame',
        [near(a + 0.18, y), near(b, high - 0.11), near(q - 0.19, y), near(b, shore + 0.13)].map(
          ([x, h, z]) => [x, h, z - 0.023],
        ),
        [0, 0, -1],
        c.shadow,
      );
      const p = near(b, 0);
      const floor = grade([p[0], p[2]]) - 0.16;
      beam(out, 'concrete', [p[0], floor, p[2]], [p[0], shore, p[2]], 0.105, 0.17, c.light);
    }
  }
}
function imax(out, level) {
  const top = d.imaxRoof;
  mass(out, d.theatre, base, top, 'concrete', c.concrete, c.roof);
  for (const [i, w] of walls(d.theatre).entries()) {
    band(out, w, top - 0.35, 0.32, c.light);
    if (level < 1 || w.length < 5.5) continue;
    if (i >= 5) {
      const n = Math.max(2, Math.round(w.length / 4.15));
      for (let k = 1; k < n; k++) {
        const u = (w.length * k) / n;
        panel(out, 'concrete', w, u - 0.059, u + 0.059, 5.54, top - 0.24, 0.057, c.cement);
        if (level >= 2 && k % 3 === 0)
          panel(out, 'glass', w, u + 0.2, u + 1.29, 3.35, 5.12, 0.075, c.darkGlass);
      }
    }
  }
  if (level >= 1) {
    for (const [x, z, wide, deep, h] of [
      [-14.3, 40.7, 5.55, 5.1, 0.62],
      [-5.2, 44.2, 4.5, 2.2, 0.6],
      [-0.4, 38.0, 2.25, 3.3, 0.51],
    ])
      block(out, 'roof', x - wide / 2, top - 0.07, z - deep / 2, wide, h, deep, c.roofLight);
  }
}
function linkAndPodium(out, level) {
  const podium = [
    [-55.3, 13.23],
    [-27.94, 13.22],
    [-25.18, 21.48],
    [-25.17, 31.31],
    [-31.2, 31.35],
    [-31.21, 38.29],
    [-55.99, 38.3],
    [-56.02, 21.84],
    [-55.3, 21.84],
  ];
  mass(out, podium, base, 4.82, 'concrete', c.cement);
  const bridge = rect(-49.45, 3.05, -44.7, 13.27);
  mass(out, bridge, base, 3.74, 'concrete', c.gray, c.roof);
  if (level >= 2) {
    const w = edge([-44.7, 3.05], [-44.7, 13.27]);
    glassWall(out, w, 1.89, 3.12, level, 1.83, 0.32, 0.063, 0);
  }
}
function build(out, level) {
  linkAndPodium(out, level);
  archives(out, level);
  fannin(out, level);
  exhibition(out, level);
  imax(out, level);
  lobby(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'royal-british-columbia-museum-model.mjs';
const camera = [-135, 83, -148],
  lookAt = [-5, 16, 13];
const errors = { district: 0.78, street: 0.32, closeup: 0.096 };
export const royalBritishColumbiaMuseumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum-library',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Native Natural Resources Canada bare-earth terrain beside the Belleville Street entrance.',
  brief:
    'The standing Royal BC Museum with its limestone Fannin tower, folded-roof archives, tall glazed entry, IMAX and broad exhibition roof.',
  camera,
  lookAt,
  sunDirection: [-54, 96, -74],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.archives],
    minimumCoverage: 0.92,
    basis: 'Named mapped museum mass and separate original BC Archives outline.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'belleville-entrance-tower-and-archive', position: [6, 12, -81], lookAt: [-20, 14, 4] },
    { name: 'long-gallery-clerestory', position: [94, 54, 68], lookAt: [14, 16, 14] },
    { name: 'folded-roof-and-tower-piers', position: [-68, 16, -44], lookAt: [-32, 12, 9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'royal-british-columbia-museum-' + reviewLod,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Natural Resources Canada open elevation data.',
};
