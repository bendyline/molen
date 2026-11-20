import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import controls from '../plan-controls.json' with { type: 'json' };
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  plaster: surface('wall', 'plaster_lime'),
  stone: surface('trim', 'stone_limestone'),
  roof: surface('roof', 'concrete_plain'),
  glass: surface('window', 'window_punched', 0.61),
  iron: surface('trim', 'metal_painted', 0.73, 0.12),
  wood: surface('door', 'wood_plain'),
};
const C = palette({
  buff: 'e4cc9e',
  base: 'd4b988',
  molding: 'ead6b0',
  stone: 'dcc39a',
  rail: 'e7dcc0',
  roof: 'b5a784',
  glass: '667780',
  dark: '393635',
  shutter: 'abb4aa',
  iron: '554d40',
  threshold: 'b5a487',
});
const landing = 5.8;
const eaves = 18.4;
const center = 42.05;
const deckZ = -31.75;
const deckBack = -24.8;

function balustrade(out, a, b, lod, slender = false) {
  const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const h = slender ? 0.72 : 0.87;
  const slot = slender ? 'iron' : 'stone';
  const color = slender ? C.iron : C.rail;
  const lifted = ([x, y, z], dy) => [x, y + dy, z];
  beam(out, slot, lifted(a, h), lifted(b, h), slender ? 0.065 : 0.18, 0.14, color);
  if (lod === 0) return;
  const spacing = slender ? [0.9, 0.9, 0.47, 0.28][lod] : [1.6, 1.6, 0.58, 0.39][lod];
  const n = Math.max(2, Math.ceil(span / spacing));
  for (let i = 0; i <= n; i++) {
    const p = a.map((v, axis) => mix(v, b[axis], i / n));
    const pillar = !slender && (i === 0 || i === n || (lod > 1 && i % 8 === 0));
    const w = pillar ? 0.27 : slender ? 0.065 : 0.105;
    block(out, slot, p[0] - w / 2, p[1], p[2] - w / 2, w, h, w, color);
  }
}

function balcony(out, wall, u, y, width, lod) {
  const left = u - width / 2,
    right = u + width / 2;
  trimBlock(out, 'stone', wall, left, right, y - 0.21, y, 0.01, 0.76, C.molding);
  if (lod < 2) return;
  const a = wall.p(left + 0.1, y, 0.69),
    b = wall.p(right - 0.1, y, 0.69);
  const railDetail = lod === 2 ? 0 : lod;
  balustrade(out, a, b, railDetail, true);
  if (lod === 2) return;
  balustrade(out, wall.p(left + 0.1, y, 0.05), a, railDetail, true);
  balustrade(out, wall.p(right - 0.1, y, 0.05), b, railDetail, true);
  for (const x of [left + 0.24, right - 0.24])
    beam(out, 'stone', wall.p(x, y - 0.55, 0.015), wall.p(x, y - 0.2, 0.6), 0.14, 0.13, C.molding);
}

function frenchWindow(out, wall, u, floor, lod, withBalcony) {
  const low = floor + (withBalcony ? 0.12 : 0.46);
  const top = floor + 2.79;
  const w = withBalcony ? 0.78 : 0.68;
  opening(out, wall, u - w, u + w, low, top, 'stone', C.glass, 'glass', C.rail, lod, 0.035);
  if (lod === 3) {
    for (const x of [u - 0.12, u + 0.12])
      panel(out, 'stone', wall, x - 0.025, x + 0.025, low, top, 0.081, C.rail);
    const transom = top - 0.68;
    panel(out, 'stone', wall, u - w, u + w, transom - 0.045, transom + 0.045, 0.092, C.rail);
    if (!withBalcony) {
      panel(out, 'iron', wall, u - w - 0.29, u - w - 0.08, low, top, 0.064, C.shutter);
      panel(out, 'iron', wall, u + w + 0.08, u + w + 0.29, low, top, 0.064, C.shutter);
    }
    trimBlock(
      out,
      'stone',
      wall,
      u - w - 0.19,
      u + w + 0.19,
      top + 0.16,
      top + 0.27,
      0.01,
      0.22,
      C.molding,
    );
  }
  if (withBalcony) balcony(out, wall, u, floor + 0.06, 2.32, lod);
}

function hotelEnvelope(out, lod, outline, grade) {
  shell(out, outline, (p) => Math.min(grade(p) - 0.45, landing - 0.16), landing, {
    wall: 'plaster',
    color: C.base,
    roofColor: C.base,
  });
  shell(out, outline, () => landing, eaves, {
    wall: 'plaster',
    color: C.buff,
    roof: 'roof',
    roofColor: C.roof,
  });
  const directed = areaSign(outline);
  const corners = pairs(closed(outline));
  for (const [index, [a, b]] of corners.entries()) {
    const w = edge(a, b, directed);
    if (w.length < 1) continue;
    const river = w.normal[2] < -0.84;
    const showWindows = lod > 1 ? w.length > 3 : river ? w.length > 8 : lod === 1 && w.length > 24;
    const cornices =
      lod === 0
        ? []
        : lod === 1
          ? [[18.26, 0.26, 0.38]]
          : lod === 2
            ? [
                [landing, 0.15, 0.14],
                [10.02, 0.18, 0.16],
                [18.26, 0.26, 0.38],
              ]
            : [
                [landing - 0.04, 0.21, 0.17],
                [10.02, 0.18, 0.16],
                [14.04, 0.12, 0.105],
                [17.97, 0.25, 0.28],
                [18.26, 0.26, 0.38],
              ];
    for (const [y, height, d] of cornices)
      trimBlock(out, 'stone', w, 0, w.length, y, y + height, -0.06, d, C.molding);
    if (lod >= 2 && (river || w.length > 20)) {
      const n = Math.floor(w.length / 5);
      for (let i = 0; i <= n; i++) {
        const u = mix(0.24, w.length - 0.24, i / Math.max(1, n));
        trimBlock(
          out,
          'plaster',
          w,
          u - 0.15,
          u + 0.15,
          eaves + 0.14,
          eaves + 0.89,
          -0.44,
          -0.11,
          C.buff,
        );
      }
      if (n > 0)
        trimBlock(
          out,
          'stone',
          w,
          0.36,
          w.length - 0.36,
          eaves + 0.19,
          eaves + 0.41,
          -0.39,
          -0.15,
          C.rail,
        );
    }
    if (!showWindows) continue;
    const n = Math.max(1, Math.round(w.length / (river ? 3.65 : 4.1)));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * w.length) / n;
      const [x, , z] = w.p(u, 0);
      const atMainDoor = index === 49 && Math.abs(x - center) < 4.4;
      for (const [level, y] of [6.13, 10.37, 14.47].entries()) {
        if (atMainDoor && level === 0) continue;
        if (lod === 0) {
          panel(out, 'glass', w, u - 0.67, u + 0.67, y + 0.51, y + 2.72, 0.045, C.glass);
        } else if (lod === 1) {
          opening(
            out,
            w,
            u - 0.69,
            u + 0.69,
            y + 0.42,
            y + 2.72,
            'stone',
            C.glass,
            'glass',
            C.rail,
            0,
            0.042,
          );
          if (river && level > 0 && i % 4 !== 0 && !atMainDoor)
            balcony(out, w, u, y + 0.05, 2.22, lod);
        } else {
          frenchWindow(out, w, u, y, lod, river && level !== 0 && i % 4 !== 0 && !atMainDoor);
        }
      }
      const base = Math.max(0.05, grade([x, z]) + 0.08);
      if (lod > 1 && river && !atMainDoor && base < 3.82)
        arch(
          out,
          w,
          u,
          base,
          4.35,
          1.06,
          0.78,
          0.055,
          lod,
          { inner: C.dark, trim: C.molding, width: 0.19 },
          { inner: 'glass', trim: 'stone' },
        );
    }
  }
  for (const [x, z, w, d] of [
    [-18, -12, 18, 6.7],
    [35, -19, 15, 8.2],
    [67, -15, 12, 6.8],
    [87, -25, 7.5, 11],
  ]) {
    block(out, 'roof', x, eaves, z, w, lod === 0 ? 0.64 : 1.05, d, C.roof);
    if (lod >= 2)
      block(out, 'stone', x - 0.18, eaves + 0.97, z - 0.18, w + 0.36, 0.16, d + 0.36, C.stone);
  }
}

function stair(out, direction, lod, grade) {
  const near = center + direction * 7.8;
  const far = center + direction * 15.9;
  const innerZ = [deckZ, deckBack - 2.7];
  const apronZ = [-45.7, -41.25];
  const foot = Math.max(...apronZ.map((z) => grade([far, z]))) + 0.13;
  const n = [4, 7, 18, 24][lod];
  const x = (t) => mix(far, near, t);
  const z = (i, t) => mix(apronZ[i], innerZ[i], t);
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    const y = mix(foot, landing, b);
    const corners = [
      [x(a), z(0, a)],
      [x(b), z(0, b)],
      [x(b), z(1, b)],
      [x(a), z(1, a)],
    ];
    shell(out, corners, (p) => Math.min(y - 0.11, grade(p) - 0.13), y, {
      wall: 'stone',
      color: C.stone,
      roofColor: C.threshold,
    });
  }
  for (const i of [0, 1]) balustrade(out, [far, foot, apronZ[i]], [near, landing, innerZ[i]], lod);
}

function greatStair(out, lod, grade) {
  const left = center - 7.8,
    right = center + 7.8,
    spring = 2.47,
    radius = 2.45;
  for (const [x0, x1] of [
    [left, center - radius],
    [center + radius, right],
  ])
    shell(out, rect(x0, deckZ, x1, deckBack), (p) => grade(p) - 0.35, landing, {
      wall: 'plaster',
      color: C.base,
      roof: 'stone',
      roofColor: C.stone,
    });
  block(
    out,
    'stone',
    center - radius,
    landing - 0.45,
    deckZ,
    radius * 2,
    0.45,
    deckBack - deckZ,
    C.stone,
  );
  const n = [6, 8, 14, 20][lod];
  const springline = Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [center + radius * Math.cos(a), spring + 1.83 * Math.sin(a)];
  });
  const front = plane(deckZ, -1);
  for (const [[x, y], [a, b]] of pairs(springline)) {
    face(
      out,
      'plaster',
      [
        [x, y, deckZ],
        [a, b, deckZ],
        [a, landing - 0.45, deckZ],
        [x, landing - 0.45, deckZ],
      ],
      front.normal,
      C.buff,
    );
    face(
      out,
      'stone',
      [
        [x, y, deckZ],
        [a, b, deckZ],
        [a, b, deckBack - 1.2],
        [x, y, deckBack - 1.2],
      ],
      [0, -1, 0],
      C.stone,
    );
    if (lod > 0)
      face(
        out,
        'stone',
        [
          [x, y, deckZ - 0.12],
          [a, b, deckZ - 0.12],
          [a, b + 0.29, deckZ - 0.14],
          [x, y + 0.29, deckZ - 0.14],
        ],
        front.normal,
        C.molding,
      );
  }
  trimBlock(out, 'stone', front, left, right, landing - 0.23, landing, -0.08, 0.18, C.molding);
  balustrade(out, [left, landing, deckZ - 0.07], [right, landing, deckZ - 0.07], lod);
  stair(out, -1, lod, grade);
  stair(out, 1, lod, grade);
  if (lod >= 1) {
    for (const [x0, x1, z] of [
      [-3.6, 25.0, -23.45],
      [60.5, 82.8, -24.05],
    ]) {
      const back = z + 3.2;
      shell(out, rect(x0, z, x1, back), (p) => Math.min(grade(p) - 0.2, landing - 0.1), landing, {
        wall: 'plaster',
        color: C.base,
        roof: 'stone',
        roofColor: C.stone,
      });
      const along = plane(z - 0.03, -1);
      const n = Math.floor((x1 - x0) / 3.9);
      for (let i = 0; i < n; i++) {
        const x = mix(x0, x1, (i + 0.5) / n);
        const bottom = grade([x, z]) + 0.11;
        if (bottom < 4.64)
          arch(
            out,
            along,
            x,
            bottom,
            4.66,
            1.16,
            0.78,
            0.063,
            lod,
            { inner: C.dark, trim: C.molding, width: 0.18 },
            { inner: 'glass', trim: 'stone' },
          );
      }
      balustrade(out, [x0, landing, z], [x1, landing, z], lod);
    }
  }
}

const letters = {
  W: [
    [0, 1],
    [0.18, 0],
    [0.5, 0.62],
    [0.82, 0],
    [1, 1],
  ],
  I: [
    [0.5, 0],
    [0.5, 1],
  ],
  N: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  T: [
    [0, 1],
    [1, 1],
    [0.5, 1],
    [0.5, 0],
  ],
  E: [
    [1, 1],
    [0, 1],
    [0, 0],
    [1, 0],
    [0, 0],
    [0, 0.5],
    [0.84, 0.5],
  ],
  R: [
    [0, 0],
    [0, 1],
    [0.78, 1],
    [1, 0.8],
    [0.83, 0.55],
    [0, 0.55],
    [1, 0],
  ],
  P: [
    [0, 0],
    [0, 1],
    [0.78, 1],
    [1, 0.82],
    [0.83, 0.55],
    [0, 0.55],
  ],
  A: [
    [0, 0],
    [0.5, 1],
    [1, 0],
    [0.78, 0.4],
    [0.22, 0.4],
  ],
  L: [
    [0, 1],
    [0, 0],
    [1, 0],
  ],
  C: [
    [1, 0.9],
    [0.8, 1],
    [0.2, 1],
    [0, 0.8],
    [0, 0.2],
    [0.2, 0],
    [0.8, 0],
    [1, 0.1],
  ],
};

function mainPortico(out, lod) {
  const deckFront = -30.05;
  const left = center - 4.53,
    right = center + 4.53;
  block(out, 'stone', left, 9.85, deckFront, right - left, 0.45, 4.4, C.molding);
  for (const x of [left + 0.57, right - 0.57]) {
    block(out, 'stone', x - 0.53, landing, deckFront + 0.26, 1.06, 0.3, 0.88, C.rail);
    ring(
      out,
      'stone',
      [x, deckFront + 0.68],
      [
        [landing + 0.3, 0.32],
        [9.53, 0.27],
        [9.74, 0.42],
      ],
      [6, 8, 12, 16][lod],
      C.molding,
    );
    block(out, 'stone', x - 0.48, 9.7, deckFront + 0.26, 0.96, 0.23, 0.86, C.rail);
  }
  balustrade(out, [left + 0.2, 10.3, deckFront + 0.18], [right - 0.2, 10.3, deckFront + 0.18], lod);
  const w = plane(-25.73, -1);
  opening(
    out,
    w,
    center - 1.05,
    center + 1.05,
    landing + 0.06,
    9.36,
    'stone',
    C.dark,
    'wood',
    C.molding,
    lod,
    0.047,
  );
  const n = [5, 7, 12, 16][lod],
    top = 21.38;
  const curve = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [center + mix(-7.5, 7.5, t), 19.11 + (top - 19.11) * Math.sin(Math.PI * t)];
  });
  for (const [[x0, y0], [x1, y1]] of pairs(curve)) {
    face(
      out,
      'plaster',
      [w.p(x0, eaves, 0.17), w.p(x1, eaves, 0.17), w.p(x1, y1, 0.17), w.p(x0, y0, 0.17)],
      w.normal,
      C.buff,
    );
    face(
      out,
      'plaster',
      [w.p(x0, eaves, -0.68), w.p(x1, eaves, -0.68), w.p(x1, y1, -0.68), w.p(x0, y0, -0.68)],
      [0, 0, 1],
      C.buff,
    );
    face(
      out,
      'stone',
      [w.p(x0, y0, 0.17), w.p(x1, y1, 0.17), w.p(x1, y1, -0.68), w.p(x0, y0, -0.68)],
      up,
      C.molding,
    );
  }
  for (const [i, [x, y]] of [curve[0], curve.at(-1)].entries())
    face(
      out,
      'plaster',
      [w.p(x, eaves, 0.17), w.p(x, eaves, -0.68), w.p(x, y, -0.68), w.p(x, y, 0.17)],
      [i ? 1 : -1, 0, 0],
      C.buff,
    );
  for (const x of [center - 7.6, center - 5.6, center + 5.6, center + 7.6])
    trimBlock(out, 'stone', w, x - 0.21, x + 0.21, eaves, 20.1, -0.15, 0.28, C.molding);
  if (lod < 2) return;
  for (const [word, y] of [
    ['WINTER', 20.02],
    ['PALACE', 19.02],
  ]) {
    for (const [i, letter] of Array.from(word).entries()) {
      const pos = center + 2.5 - i * 0.86;
      for (const [a, b] of pairs(letters[letter]))
        beam(
          out,
          'iron',
          w.p(pos - a[0] * 0.64, y + a[1] * 0.76, 0.2),
          w.p(pos - b[0] * 0.64, y + b[1] * 0.76, 0.2),
          0.11,
          0.07,
          C.iron,
        );
    }
  }
}

function build(out, lod, dimensions, grade) {
  const outline =
    lod < 2
      ? [0, 1, 2, 3, 12, 20, 23, 24, 26, 29, 30, 43, 44, 45, 46, 47, 48, 49, 50, 51].map(
          (index) => dimensions.outline[index],
        )
      : dimensions.outline;
  hotelEnvelope(out, lod, outline, grade);
  greatStair(out, lod, grade);
  mainPortico(out, lod);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Old Nile-front Winter Palace Hotel with tiered French sash, warm ochre plaster, the shallow historic crown, and paired grand stairs over its arched entrance base.',
    camera: [-51, 38, -112],
    lookAt: [37, 9.8, -12.5],
    sun: [-310, 430, -520],
    yaw: -0.62,
    views: [
      { name: 'nile-front', position: [41, 19, -106], lookAt: [39, 9.9, -21] },
      { name: 'double-stair', position: [49, 10.9, -66], lookAt: [42, 8.4, -27] },
      { name: 'garden-range', position: [109, 40, 86], lookAt: [42, 9.5, -11] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'landmark';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Suppress the generic mass within the exact mapped outline of the standing historic hotel.',
};
