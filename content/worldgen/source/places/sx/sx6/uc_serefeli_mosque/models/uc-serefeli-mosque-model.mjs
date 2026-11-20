import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
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
const c = palette({
  stone: 'c6b69b',
  base: 'ab9e84',
  pale: 'd6c7ad',
  shade: 'b7a58c',
  red: 'a87864',
  lead: '737b78',
  leadTrim: '88908a',
  dark: '4f5653',
  bronze: '8e7b4d',
  water: '768d89',
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.95),
  red: surface('trim', 'brick_longformat', 0.93),
  slate: surface('roof', 'metal_standing_seam', 0.85, 0.13),
  bronze: surface('trim', 'metal_bronze_cast', 0.76, 0.25),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};
const floor = 1.9;
const gradeBase = (p) => Math.min(floor - 0.17, grade(p) - 0.4);
const hallEave = 13.25;
const courtEave = 9.62;
const masonry = (out, outline, bottom, y, color = c.stone) =>
  shell(out, outline, typeof bottom === 'number' ? () => bottom : bottom, y, {
    wall: 'stone',
    color,
    roof: 'slate',
    roofColor: c.lead,
  });

function lathe(out, center, profile, n, slot, color, cap = false) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, center, Math.PI / n)),
    color,
    { cap },
  );
}

function dome(out, center, y, r, h, level, major = false, courtyard = false) {
  const n = courtyard ? [6, 6, 14, 22][level] : [7, 12, 24, 36][level];
  if (courtyard && level === 0) {
    const floor = radialRing(y, r, r, n, center, Math.PI / n);
    for (const [a, b] of pairs(closed(floor)))
      face(out, 'slate', [a, b, at(center, y + h * 0.9)], up, c.lead);
    return;
  }
  const drum = major ? 3.14 : courtyard ? 0.58 : 1.22;
  lathe(
    out,
    center,
    [
      [y - 0.1, r * 0.97],
      [y + drum, r * 0.97],
    ],
    major && level >= 2 ? 24 : n,
    'stone',
    c.stone,
  );
  if (major && level > 0) {
    const angles = Array.from({ length: 8 }, (_, i) => (Math.PI * 2 * i) / 8 + Math.PI / 8);
    for (const a of angles) {
      const point = (r, y) => [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
      beam(out, 'stone', point(r + 1.53, y - 0.06), point(r - 0.07, y + 2.4), 0.86, 0.72, c.pale);
    }
  }
  const rows = courtyard ? [1, 2, 4, 8][level] : [2, 4, 8, 11][level];
  lathe(
    out,
    center,
    Array.from({ length: rows + 1 }, (_, i) => {
      const a = (Math.PI * i) / (rows * 2);
      return [y + drum + Math.sin(a) * h, Math.max(0.06, r * Math.cos(a))];
    }),
    n,
    'slate',
    c.lead,
  );
  if (level > 0 && !courtyard)
    lathe(
      out,
      center,
      [
        [y + drum + h - 0.07, 0.12],
        [y + drum + h + 0.88, 0.09],
        [y + drum + h + 1.04, 0.06],
      ],
      8,
      'bronze',
      c.bronze,
    );
}

function window(out, wall, x, y, w, level) {
  arch(
    out,
    wall,
    x,
    y,
    y + w * 1.48,
    w,
    w * 0.62,
    0.036,
    level < 2 ? 0 : 1,
    { inner: c.dark, trim: c.pale, width: 0.12 },
    { inner: 'glass', trim: 'stone' },
  );
  if (level >= 2) panel(out, 'bronze', wall, x - 0.027, x + 0.027, y, y + w * 1.73, 0.072, c.shade);
}

function hall(out, level) {
  const [left, front, right, back] = d.hall;
  const footprint = rect(...d.hall);
  masonry(out, footprint, gradeBase, hallEave);
  dome(out, [-1.05, 13.1], hallEave, d.mainDomeRadius, 10.25, level, true);
  for (const x of [-20.95, 19.45]) {
    for (const z of [4.2, 20.65]) dome(out, [x, z], hallEave, d.sideDomeRadius, 4.24, level);
  }
  if (level > 0) {
    for (const x of [-11.64, 9.56])
      for (const z of [2.88, 23.57]) dome(out, [x, z], hallEave, 1.86, 1.37, level, false, true);
    for (const [a, b] of pairs(closed(footprint))) {
      const wall = edge(a, b);
      const count = wall.length > 50 ? 9 : 4;
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * wall.length) / count;
        if (a[1] === front && i === Math.floor(count / 2)) continue;
        window(out, wall, x, floor + 1.33, 0.84, level);
        if (level >= 2) window(out, wall, x, 8.28, 0.54, level);
      }
      trimBlock(
        out,
        'stone',
        wall,
        0,
        wall.length,
        hallEave - 0.36,
        hallEave + 0.028,
        0.009,
        0.21,
        c.pale,
      );
    }
  }
  const frontWall = edge([left, front], [right, front]);
  portal(out, frontWall, frontWall.length / 2, floor, 9.8, 2.72, level);
}

function portal(out, w, u, y, top, half, level) {
  trimBlock(out, 'stone', w, u - half - 0.6, u + half + 0.6, y, top, 0.015, 0.59, c.pale);
  arch(
    out,
    w,
    u,
    y + 0.04,
    top - 3.22,
    half * 0.75,
    2.08,
    0.61,
    level < 2 ? 0 : 1,
    { inner: c.dark, trim: c.red, width: 0.23 },
    { inner: 'glass', trim: 'red' },
  );
  if (level >= 2) {
    trimBlock(
      out,
      'stone',
      w,
      u - half - 0.56,
      u + half + 0.56,
      top - 0.46,
      top - 0.23,
      0.59,
      0.67,
      c.shade,
    );
    panel(out, 'red', w, u - half * 0.53, u + half * 0.53, top - 1.04, top - 0.64, 0.62, c.red);
  }
}

function arcadeArch(out, wall, u, pitch, level) {
  const spring = 5.85,
    half = pitch * 0.5 - 0.22,
    n = [2, 4, 9, 14][level];
  const point = (t, outer, depth) => {
    const angle = (t * Math.PI) / n;
    const r = half - (outer ? 0 : 0.24);
    const pointed = Math.sin(angle) * (1.0 + 0.11 * Math.sin(angle));
    return wall.p(u + r * Math.cos(angle), spring + r * pointed * 0.73, depth);
  };
  for (let i = 0; i < n; i++) {
    const a = point(i, false, 0.02),
      b = point(i + 1, false, 0.02);
    const A = point(i, true, 0.02),
      B = point(i + 1, true, 0.02);
    if (level > 0)
      face(
        out,
        i % 2 === 0 ? 'red' : 'stone',
        [a, b, B, A],
        wall.normal,
        i % 2 === 0 ? c.red : c.pale,
      );
    face(
      out,
      'stone',
      [A, B, [B[0], courtEave, B[2]], [A[0], courtEave, A[2]]],
      wall.normal,
      c.stone,
    );
    if (level >= 2)
      face(
        out,
        'stone',
        [a, b, point(i + 1, false, -0.68), point(i, false, -0.68)],
        [0, -1, 0],
        c.shade,
      );
  }
}

function courtyard(out, level) {
  const [left, front, right, rear] = d.court;
  const [vl, vf, vr, vb] = d.void;
  const galleries = [
    [left, front, right, vf],
    [vr, vf, right, vb],
    [left, vb, right, rear],
    [left, vf, vl, vb],
  ];
  const outer = rect(...d.court);
  shell(out, outer, gradeBase, floor, {
    wall: 'stone',
    roof: 'stone',
    color: c.base,
    roofColor: c.pale,
  });
  for (const [i, b] of galleries.entries()) {
    const deck = rect(...b);
    const facing = edge(rect(vl, vf, vr, vb)[i], rect(vl, vf, vr, vb)[(i + 1) % 4], -1);
    const pitch = facing.length / d.arcadeBays[i];
    const depth = i % 2 === 0 ? b[3] - b[1] : b[2] - b[0];
    masonry(out, deck, courtEave - 0.29, courtEave);
    for (let j = 0; j < d.arcadeBays[i]; j++) {
      const u = (j + 0.5) * pitch;
      arcadeArch(out, facing, u, pitch, level);
      const [x, , z] = facing.p(u, 0, -depth * 0.57);
      const r = Math.min(pitch * 0.47, depth * 0.41);
      if (i === 2 && j === 0) {
        block(out, 'slate', x - r, courtEave, z - r, r * 2, 0.9, r * 2, c.lead);
      } else {
        dome(out, [x, z], courtEave, r, r * 0.55, level, false, true);
      }
    }
    for (let j = 0; j <= d.arcadeBays[i]; j++) {
      const u = j * pitch;
      const [x, , z] = facing.p(u, 0, -0.18);
      if (level === 0) {
        panel(out, 'stone', facing, u - 0.31, u + 0.31, floor, 6.01, 0.08, c.pale);
      } else if (level === 1) {
        lathe(
          out,
          [x, z],
          [
            [floor, 0.34],
            [5.61, 0.26],
            [5.9, 0.39],
          ],
          5,
          'stone',
          c.pale,
        );
      } else {
        lathe(
          out,
          [x, z],
          [
            [floor, 0.34],
            [floor + 0.21, 0.33],
            [floor + 0.3, 0.26],
            [5.61, 0.26],
            [5.9, 0.39],
          ],
          10,
          'stone',
          c.pale,
        );
      }
    }
  }
  for (const i of [0, 1, 3]) {
    const wall = edge(outer[i], outer[(i + 1) % 4]);
    face(
      out,
      'stone',
      [
        wall.p(0, floor),
        wall.p(wall.length, floor),
        wall.p(wall.length, courtEave),
        wall.p(0, courtEave),
      ],
      wall.normal,
      c.stone,
    );
    portal(out, wall, wall.length * 0.5, floor, i === 3 ? 9.24 : 7.98, i === 3 ? 2.7 : 2.0, level);
    if (level > 0) {
      for (const f of [0.17, 0.28, 0.71, 0.84]) {
        window(out, wall, wall.length * f, floor + 0.94, 0.57, level);
        if (level >= 2) window(out, wall, wall.length * f, 6.45, 0.39, level);
      }
    }
  }
  const [xf, zf] = [-0.65, -20.45];
  lathe(
    out,
    [xf, zf],
    [
      [floor - 0.01, 3.25],
      [floor + 0.57, 3.25],
      [floor + 0.72, 2.97],
    ],
    8,
    'stone',
    c.pale,
    true,
  );
  if (level >= 1) {
    lathe(
      out,
      [xf, zf],
      [
        [floor + 0.713, 2.65],
        [floor + 0.735, 2.65],
      ],
      8,
      'glass',
      c.water,
      true,
    );
    const canopyY = floor + 4.05;
    for (const [x, , z] of radialRing(0, 2.86, 2.86, 8, [xf, zf]))
      lathe(
        out,
        [x, z],
        [
          [floor + 0.57, 0.15],
          [canopyY, 0.16],
        ],
        6,
        'stone',
        c.pale,
      );
    lathe(
      out,
      [xf, zf],
      [
        [canopyY, 3.26],
        [canopyY + 0.23, 3.32],
        [canopyY + 1.45, 0.1],
      ],
      8,
      'slate',
      c.lead,
      true,
    );
  }
}

function towerPattern(out, center, y, r, start, end, shaftHeight, style, level) {
  if (level < 2) return;
  const points = level === 2 ? 24 : 48;
  const xy = (a, y, r) => [center[0] + r * Math.cos(a), y, center[1] + r * Math.sin(a)];
  const collarR = (n) => r * mix(1.016, 0.755, (n - start) / (shaftHeight - start));
  if (style === 'spiral') {
    for (let i = 0; i < points; i++) {
      const a = i / points,
        b = (i + 1) / points;
      const lo = mix(start + 0.3, end - 0.8, a),
        hi = mix(start + 0.3, end - 0.8, b);
      beam(
        out,
        'red',
        xy(a * 5.1 * Math.PI, y + lo, collarR(lo)),
        xy(b * 5.1 * Math.PI, y + hi, collarR(hi)),
        0.42,
        0.095,
        c.red,
      );
    }
  } else if (style === 'flutes') {
    for (const i of Array.from({ length: 12 }, (_, k) => k)) {
      const a = (i * Math.PI) / 6;
      beam(
        out,
        'stone',
        xy(a, y + start, collarR(start)),
        xy(a, y + end, collarR(end)),
        0.18,
        0.15,
        c.pale,
      );
    }
  } else {
    const phases = style === 'zigzag' ? [1] : [1, -1];
    for (const f of [0.28, 0.54, 0.77]) {
      const mid = mix(start, end, f),
        swing = style === 'zigzag' ? 0.69 : 0.83;
      for (let j = 0; j < 12; j++) {
        const a = (j * Math.PI) / 6,
          b = ((j + 1) * Math.PI) / 6;
        for (const phase of phases) {
          const lo = mid + phase * (j % 2 === 0 ? swing : -swing);
          const hi = 2 * mid - lo;
          beam(
            out,
            'red',
            xy(a, y + lo, collarR(lo)),
            xy(b, y + hi, collarR(hi)),
            0.35,
            0.16,
            c.red,
          );
        }
      }
    }
  }
}

function minaret(out, type, level) {
  const { center, height, shaftHeight, balconies, style, radius } = type;
  const y = grade(center);
  const segments = [5, 8, 18, 24][level];
  const start = 8.5;
  const baseR = radius * 1.33;
  lathe(
    out,
    center,
    [
      [y - 0.8, baseR],
      [y + 6.25, baseR],
      [y + start, radius],
    ],
    style === 'diamond' ? 4 : segments,
    'stone',
    c.stone,
  );
  lathe(
    out,
    center,
    [
      [y + start - 0.07, radius],
      [y + shaftHeight, radius * 0.74],
    ],
    segments,
    'stone',
    c.pale,
  );
  for (const b of balconies) {
    const r = radius * mix(1, 0.74, (b - start) / (shaftHeight - start));
    const profile =
      level < 2
        ? [
            [y + b - 0.74, r],
            [y + b, r + 0.67],
            [y + b + 0.86, r + 0.69],
          ]
        : [
            [y + b - 1.16, r],
            [y + b - 0.88, r + 0.18],
            [y + b - 0.37, r + 0.54],
            [y + b + 0.16, r + 0.76],
            [y + b + 0.8, r + 0.78],
            [y + b + 0.91, r + 0.7],
          ];
    lathe(out, center, profile, segments, 'stone', c.stone);
  }
  if (level > 0)
    towerPattern(
      out,
      center,
      y,
      radius,
      start,
      Math.min(shaftHeight - 1, balconies.at(-1) - 1),
      shaftHeight,
      style,
      level,
    );
  const capRadius = radius * 0.77;
  lathe(
    out,
    center,
    [
      [y + shaftHeight - 0.14, capRadius],
      [y + shaftHeight + 0.3, capRadius * 1.05],
      [y + height - 0.58, 0.065],
    ],
    segments,
    'slate',
    c.lead,
  );
  if (level > 0)
    lathe(
      out,
      center,
      [
        [y + height - 0.63, 0.1],
        [y + height, 0.05],
      ],
      6,
      'bronze',
      c.bronze,
    );
}

function build(out, level) {
  hall(out, level);
  courtyard(out, level);
  d.towers.forEach((tower) => minaret(out, tower, level));
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'uc-serefeli-mosque-model.mjs';
const camera = [-126, 101, -121];
const lookAt = [0, 14, -4];
const errors = { district: 0.67, street: 0.29, closeup: 0.115 };
export const ucSerefeliMosqueAsset = {
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
  groundContactBasis: 'Unmodified Edirne elevation at the outer approach to the courtyard.',
  brief:
    'Üç Şerefeli Mosque with its 24-metre dome, arcaded courtyard, fountain and four distinct minarets.',
  camera,
  lookAt,
  sunDirection: [-70, 113, -86],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.91,
    basis: 'Named existing mosque and courtyard arcade polygons.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'central-lead-dome-and-side-domes', position: [59, 59, 63], lookAt: [0, 14, 8] },
    { name: 'courtyard-portico-and-fountain', position: [5, 15, -34.8], lookAt: [-3, 6, -10] },
    {
      name: 'three-balconies-and-decorated-stone-shaft',
      position: [-66, 58, -16],
      lookAt: [-33, 43, -3],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'uc-serefeli-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.42,
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
