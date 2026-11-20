import controls from '../plan-controls.json' with { type: 'json' };
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.91),
  stone: surface('foundation', 'stone_limestone_weathered', 0.97),
  sill: surface('trim', 'stone_ashlar'),
  glass: surface('window', 'window_punched', 0.46, 0.15),
  timber: surface('door', 'wood_plain', 0.92),
  iron: surface('trim', 'metal_painted', 0.91, 0.17),
  roof: surface('roof', 'metal_standing_seam', 0.82, 0.18),
};
const C = palette({
  brick: 'a37564',
  brickShade: '916c5c',
  brickTrim: 'b18d73',
  stone: '98907c',
  stoneBright: 'aaa18d',
  darkStone: '817b68',
  damp: '747669',
  wood: '856b56',
  timber: 'a89376',
  glass: '697372',
  roof: '727875',
  roofTrim: '626661',
  rust: '895d46',
  darkIron: '605248',
});
const invert = (p) => p.map((k) => -k);
const down = [0, -1, 0];

function brace(out, slot, a, b, width, tone = C.wood) {
  beamPath(out, slot, [a, b], width, width, tone);
}

function opening(out, lod, w, x, low, spring, width, rise, door = false) {
  const a = x - width / 2;
  const b = x + width / 2;
  const mat = door ? 'timber' : 'glass';
  const color = door ? C.wood : C.glass;
  panel(out, mat, w, a, b, low, spring + 0.004, 0.027, color);
  if (rise) {
    const n = [3, 5, 7, 10][lod];
    const arch = Array.from({ length: n + 1 }, (_, i) => {
      const t = (i * Math.PI) / n;
      return [x + width * 0.5 * Math.cos(t), spring + rise * Math.sin(t)];
    });
    face(
      out,
      mat,
      arch.map(([u, y]) => w.p(u, y, 0.041)),
      w.normal,
      color,
    );
    if (lod > 0)
      for (const [[l, f], [r, g]] of pairs(arch)) {
        const border = (u, h) => w.p(x + (u - x) * 1.16, h + 0.095, 0.077);
        face(
          out,
          'brick',
          [w.p(l, f, 0.056), w.p(r, g, 0.056), border(r, g), border(l, f)],
          w.normal,
          C.brickTrim,
        );
      }
  }
  if (lod > 0) {
    const depth = 0.102;
    panel(out, 'sill', w, a - 0.09, b + 0.09, low - 0.09, low + 0.035, depth, C.stoneBright);
    for (const u of [a, b])
      panel(out, 'sill', w, u - 0.042, u + 0.042, low, spring + 0.068, 0.082, C.brickTrim);
    if (lod > 1) {
      panel(
        out,
        'timber',
        w,
        x - 0.035,
        x + 0.035,
        low + 0.045,
        spring + rise - 0.05,
        0.073,
        C.wood,
      );
      if (!door)
        for (const y of [mix(low, spring, 0.47), spring - 0.015])
          panel(out, 'timber', w, a + 0.03, b - 0.03, y, y + 0.055, 0.077, C.wood);
    }
  }
}

function machineShop(out, lod, d, grade) {
  const { outline, machineEaveMeters: eave, machineRoofMeters: ridge } = d;
  const sign = areaSign(outline);
  shell(out, outline, (p) => Math.min(grade(p) - 0.36, -0.47), 0.58, {
    wall: 'stone',
    color: C.stone,
    roof: 'roof',
    roofColor: C.stone,
  });
  shell(out, outline, () => 0.54, eave, {
    wall: 'brick',
    color: C.brick,
    roof: 'roof',
    roofColor: C.roof,
  });
  for (const [[a, b], i] of pairs(closed(outline)).map((pair, j) => [pair, j])) {
    const w = edge(a, b, sign);
    const long = w.length > 13;
    const creek = i === 1;
    const n = long ? 6 : 3;
    const spacing = w.length / n;
    for (let k = 0; k < n; k++) {
      const u = spacing * (k + 0.5);
      if (creek) opening(out, lod, w, u, -2.15, -0.43, 1.05, 0.18, k === 2);
      const door = long ? creek && k === 3 : k === 1;
      opening(
        out,
        lod,
        w,
        u,
        door ? 0.63 : 1.62,
        door ? 3.43 : 3.26,
        door ? 1.48 : 1.06,
        0.18,
        door,
      );
      if (lod > 0 || k % 2 === 0) opening(out, lod, w, u, 4.02, 5.24, 0.99, 0.14);
    }
    if (lod > 0) {
      trimBlock(out, 'brick', w, 0, w.length, eave - 0.26, eave - 0.08, -0.03, 0.128, C.brickTrim);
      panel(out, 'brick', w, 0, w.length, 0.58, 0.744, 0.074, C.brickShade);
    }
    if (lod === 3)
      for (const u of [0.1, w.length - 0.13])
        brace(out, 'iron', w.p(u, 0.58, 0.09), w.p(u, eave - 0.13, 0.09), 0.075, C.roofTrim);
  }
  const highEast = [
    (outline[0][0] + outline[1][0]) * 0.5,
    ridge,
    (outline[0][1] + outline[1][1]) * 0.5,
  ];
  const highWest = [
    (outline[2][0] + outline[3][0]) * 0.5,
    ridge,
    (outline[2][1] + outline[3][1]) * 0.5,
  ];
  const points = outline.map((p) => at(p, eave));
  face(out, 'roof', [points[1], points[2], highWest, highEast], up, C.roof);
  face(out, 'roof', [points[3], points[0], highEast, highWest], up, C.roof);
  for (const [i, top] of [
    [0, highEast],
    [2, highWest],
  ]) {
    const w = edge(outline[i], outline[i + 1], sign);
    face(out, 'brick', [points[i], points[i + 1], top], w.normal, C.brickShade);
    if (lod > 0) beamPath(out, 'roof', [points[i], top, points[i + 1]], 0.18, 0.16, C.roofTrim);
    if (lod > 1) {
      const x = w.length * 0.5;
      opening(out, lod, w, x, eave + 0.36, eave + 1.41, 0.77, 0.11);
    }
  }
  if (lod > 1) {
    brace(out, 'roof', highWest, highEast, 0.21, C.roofTrim);
    const n = lod === 3 ? 15 : 8;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const top = highWest.map((v, k) => mix(v, highEast[k], t));
      top[1] += 0.028;
      for (const [a, b] of [
        [points[2], points[1]],
        [points[3], points[0]],
      ])
        brace(
          out,
          'roof',
          a.map((p, k) => mix(p, b[k], t)),
          top,
          0.039,
          C.roofTrim,
        );
    }
  }
  const porch = edge(outline[2], outline[3], sign);
  const u = porch.length * 0.5;
  const outward = porch.p(u, 0, 2.15);
  const support = Math.min(-0.1, grade([outward[0], outward[2]]) - 0.12);
  const corners = [
    [u - 1.17, 0],
    [u + 1.17, 0],
    [u + 1.17, 2.02],
    [u - 1.17, 2.02],
  ];
  const landing = corners.map(([x, z]) => porch.p(x, 0.58, z));
  face(out, 'timber', landing, up, C.wood);
  for (const x of [u - 1.04, u + 1.04])
    brace(out, 'timber', porch.p(x, support, 1.95), porch.p(x, 1.36, 1.95), 0.16, C.wood);
  if (lod > 0)
    brace(
      out,
      'timber',
      porch.p(u - 1.12, 1.36, 1.95),
      porch.p(u + 1.12, 1.36, 1.95),
      0.13,
      C.timber,
    );
}

function ruinWall(out, lod, grade, points, height, width) {
  for (const [a, b] of pairs(points)) {
    const w = edge(a, b);
    const pos = (u, y, d) => w.p(u, y, d);
    const n = Math.max(2, Math.round(w.length / [3.3, 1.86, 0.95, 0.68][lod]));
    for (let i = 0; i < n; i++) {
      const f = (i * w.length) / n;
      const t = ((i + 1) * w.length) / n;
      const level = (x) => {
        const p = pos(x, 0, 0);
        return grade([p[0], p[2]]);
      };
      const g = level(f),
        h = level(t);
      const k = (j) => height * (0.78 + 0.23 * Math.sin(j * 1.27 + height));
      const top = [g + k(i), h + k(i + 1)];
      for (const d of [-width / 2, width / 2]) {
        const normal = d > 0 ? w.normal : invert(w.normal);
        face(
          out,
          'stone',
          [pos(f, g - 0.43, d), pos(t, h - 0.43, d), pos(t, top[1], d), pos(f, top[0], d)],
          normal,
          i % 3 ? C.stone : C.darkStone,
        );
        if (lod > 1) {
          const y = (top[0] + top[1]) * 0.5 - 0.22;
          panel(out, 'sill', w, f + 0.05, t - 0.03, y - 0.045, y, d * 1.04, C.stoneBright);
        }
      }
      face(
        out,
        'stone',
        [
          pos(f, top[0], -width / 2),
          pos(t, top[1], -width / 2),
          pos(t, top[1], width / 2),
          pos(f, top[0], width / 2),
        ],
        up,
        i % 2 ? C.stoneBright : C.stone,
      );
    }
    for (const [u, n] of [
      [0, [-w.normal[2], 0, w.normal[0]]],
      [w.length, [w.normal[2], 0, -w.normal[0]]],
    ]) {
      const p = pos(u, 0, 0);
      const y = grade([p[0], p[2]]) - 0.35;
      face(
        out,
        'stone',
        [
          pos(u, y, -width / 2),
          pos(u, y, width / 2),
          pos(u, y + height, width / 2),
          pos(u, y + height, -width / 2),
        ],
        n,
        C.stone,
      );
    }
  }
}

function turbine(out, lod, grade) {
  const origin = [189.05, 8.48];
  const y = grade(origin) + 1.09;
  const count = [8, 12, 16, 22][lod];
  const profile = [
    [-2.28, 0.29],
    [-2.01, 0.43],
    [-1.26, 0.55],
    [-0.71, 0.99],
    [-0.52, 1.08],
    [0.1, 1.13],
    [1.55, 1.03],
    [1.73, 0.86],
    [2.18, 0.56],
  ];
  const p = (a, x, r) => [origin[0] + x, y + Math.sin(a) * r, origin[1] + Math.cos(a) * r];
  for (const [[a, r], [b, s]] of pairs(profile)) {
    for (let j = 0; j < count; j++) {
      const f = (j * 2 * Math.PI) / count,
        g = ((j + 1) * 2 * Math.PI) / count;
      face(
        out,
        'iron',
        [p(f, a, r), p(g, a, r), p(g, b, s), p(f, b, s)],
        [0, Math.sin((f + g) / 2), Math.cos((f + g) / 2)],
        j % 3 ? C.rust : C.darkIron,
      );
    }
  }
  for (const [[x, r], normal] of [
    [profile[0], [-1, 0, 0]],
    [profile.at(-1), [1, 0, 0]],
  ])
    face(
      out,
      'iron',
      Array.from({ length: count }, (_, j) => p((j * 2 * Math.PI) / count, x, r)),
      normal,
      C.darkIron,
    );
  for (const z of [origin[1] - 0.75, origin[1] + 0.75])
    block(out, 'iron', origin[0] - 2.72, y - 1.19, z - 0.07, 5.55, 0.16, 0.14, C.darkIron);
  if (lod === 3) {
    for (const x of [-0.48, 1.56])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        brace(out, 'iron', p(a, x - 0.027, 1.035), p(a, x + 0.079, 1.035), 0.1, C.darkIron);
      }
  }
}

function remains(out, lod, d, grade) {
  const s = d.ruinScope;
  ruinWall(out, lod, grade, [s[0], s[1]], 1.2, 0.69);
  ruinWall(out, lod, grade, [s[5], s[4], s[3]], 1.35, 0.73);
  for (const [a, b, h] of [
    [[177.2, 13.8], [177.6, 8.67], 1.31],
    [[182.6, 15.3], [183.14, 10.1], 1.38],
    [[189.5, 16.1], [189.56, 10.85], 1.48],
    [[195.4, 15.4], [195.55, 11.9], 1.08],
    [[196.1, 4.3], [199.2, 6.4], 0.85],
  ])
    ruinWall(out, lod, grade, [a, b], h, 0.61);
  turbine(out, lod, grade);
  const trail = d.parts['overlook-walk'].slice(1);
  const w = edge(trail[0], trail[1]);
  const y = Math.max(grade(trail[0]), grade(trail[1])) + 1.2;
  const deck = [w.p(0, y, -0.99), w.p(w.length, y, -0.99), w.p(w.length, y, 0.99), w.p(0, y, 0.99)];
  face(out, 'timber', deck, up, C.timber);
  face(
    out,
    'timber',
    deck.map(([x, h, z]) => [x, h - 0.12, z]),
    down,
    C.wood,
  );
  const n = lod === 0 ? 4 : 9;
  for (const side of [-1, 1]) {
    const q = side * 0.96;
    brace(out, 'timber', w.p(0, y + 1.01, q), w.p(w.length, y + 1.01, q), 0.13, C.wood);
    if (lod > 0)
      brace(out, 'timber', w.p(0, y + 0.38, q), w.p(w.length, y + 0.38, q), 0.075, C.timber);
    for (let i = 0; i <= n; i++) {
      const u = (i * w.length) / n,
        [x, , z] = w.p(u, 0, q);
      brace(out, 'timber', w.p(u, grade([x, z]) - 0.12, q), w.p(u, y + 1.03, q), 0.13, C.wood);
    }
  }
}

function dam(out, lod, d, grade) {
  const height = d.damCrestMeters;
  const stoneBase = height - d.recordedDamHeightMeters;
  for (const [a, b] of pairs(d.parts['mill-dam'])) {
    const w = edge(a, b);
    const p = (u, y, z) => w.p(u, y, z);
    const foot = (u, z) => {
      const [x, , p] = w.p(u, 0, z);
      return Math.min(stoneBase, grade([x, p]) - 0.42);
    };
    const n = Math.max(2, Math.round(w.length / [4.1, 2.1, 1.5, 0.95][lod]));
    for (let i = 0; i < n; i++) {
      const f = (i * w.length) / n,
        t = ((i + 1) * w.length) / n;
      face(
        out,
        'stone',
        [p(f, height, 0.56), p(t, height, 0.56), p(t, height, -0.92), p(f, height, -0.92)],
        up,
        C.stoneBright,
      );
      for (const [offset, batter, normal] of [
        [0.56, 1.26, w.normal],
        [-0.92, -2.49, invert(w.normal)],
      ]) {
        face(
          out,
          'stone',
          [
            p(f, foot(f, batter), batter),
            p(t, foot(t, batter), batter),
            p(t, height, offset),
            p(f, height, offset),
          ],
          normal,
          i % 3 ? C.damp : C.stone,
        );
        if (lod > 1)
          for (const y of [height - 0.31, height - 1.22, height - 2.43]) {
            const z =
              mix(offset, batter, (height - y) / d.recordedDamHeightMeters) +
              Math.sign(offset) * 0.022;
            face(
              out,
              'sill',
              [p(f, y, z), p(t, y, z), p(t, y + 0.075, z), p(f, y + 0.075, z)],
              normal,
              C.stoneBright,
            );
          }
      }
    }
    for (const [u, normal] of [
      [0, [w.normal[2], 0, -w.normal[0]]],
      [w.length, [-w.normal[2], 0, w.normal[0]]],
    ])
      face(
        out,
        'stone',
        [
          p(u, foot(u, 1.26), 1.26),
          p(u, foot(u, -2.49), -2.49),
          p(u, height, -0.92),
          p(u, height, 0.56),
        ],
        normal,
        C.stone,
      );
  }
}

function build(out, lod, d, grade) {
  machineShop(out, lod, d, grade);
  remains(out, lod, d, grade);
  dam(out, lod, d, grade);
}

const mill = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The surviving Roswell Mill site on Vickery Creek, with the brick Machine Shop, stone mill ruins, exposed turbine and documented masonry dam.',
    camera: [216, 89, 268],
    lookAt: [165, 3, 12],
    yaw: 0.72,
    sun: [-270, 665, 512],
    views: [
      { name: 'vickery-creek-machine-shop-to-dam', position: [164, 80, 212], lookAt: [170, -3, 6] },
      { name: 'two-storey-machine-shop', position: [-20, 6.1, 36], lookAt: [4, 1.6, 1.3] },
      { name: 'ruined-stonework-and-iron-turbine', position: [203, 6, 28], lookAt: [187, -1, 10] },
      { name: 'stone-mill-dam', position: [306, 18, 36], lookAt: [334, 0, 15] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = mill;
model.category = 'historic-mill';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis:
    'Replace the mapped two-storey Machine Shop while preserving the terrain around the separate mill remains.',
};
