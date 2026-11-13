/** The Palacio de Biblioteca y Museos Nacionales, with its Serrano and Recoletos façades. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.88 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.83 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.87 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.75 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.67, metallic: 0.38 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.09 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36 },
};
const palette = {
  brick: 'bcac8f',
  brickDark: 'ab9d82',
  pier: 'c5bbab',
  light: 'd3cabb',
  recess: 'b1a795',
  granite: 'a19d94',
  graniteShade: '8f8f89',
  court: 'a5a69d',
  trim: 'c9c2b3',
  ornament: 'cdc2b0',
  dark: '444f54',
  glass: '66787c',
  glassLight: '8d9a99',
  iron: '464849',
  letter: '4b4840',
  slate: '6e7679',
  slateDark: '535c62',
  slateLight: '868c8b',
  bronze: '4e5b53',
  patina: '647066',
  bronzeDark: '414a46',
  clothRed: 'b24b4b',
  clothYellow: 'dab768',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((h) => {
      const x = parseInt(h, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  TAU = Math.PI * 2;
const sill = 6.1,
  split = 11.66,
  roofY = 18.05;
const mix = (a, b, t) => a + (b - a) * t;
const atHeight = ([x, z], y) => [x, y, z];
function tri(out, slot, tint, points, want) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((sum, v, i) => sum + v * want[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, color[tint]);
}
function face(out, slot, tint, [a, b, c, d], want) {
  tri(out, slot, tint, [a, b, c], want);
  tri(out, slot, tint, [a, c, d], want);
}
function block(out, slot, tint, min, max) {
  box(out, slot, min, max, color[tint]);
}
function plane(out, slot, tint, rings, height) {
  const points = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(offset);
    offset += h.length;
  }
  const indices = earcut(points.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => atHeight(points[k], height)),
      up,
    );
}
function grade(x, z) {
  const { origin, step, size, heights } = layout.grade;
  const [u, v] = [x, z].map((n, i) =>
    Math.max(0, Math.min(size[i] - 1.001, (n - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * size[0] + i;
  return mix(
    mix(heights[k], heights[k + 1], a),
    mix(heights[k + size[0]], heights[k + size[0] + 1], a),
    b,
  );
}
function edge(ring, index, inward = false) {
  const a = ring[index],
    b = ring[(index + 1) % ring.length];
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const sign =
    Math.sign(
      ring.reduce((sum, [x, z], i) => {
        const [u, v] = ring[(i + 1) % ring.length];
        return sum + x * v - u * z;
      }, 0),
    ) * (inward ? -1 : 1);
  const normal = [sign * uz, 0, -sign * ux],
    along = [ux, 0, uz];
  return {
    a,
    b,
    length,
    normal,
    along,
    at: (u, y, o = 0) => [a[0] + ux * u + normal[0] * o, y, a[1] + uz * u + normal[2] * o],
  };
}
function panel(out, e, slot, tint, a, b, y, h, depth = 0) {
  if (b - a < 0.001 || h - y < 0.001) return;
  const { at, normal } = e;
  face(
    out,
    slot,
    tint,
    [at(a, y, depth), at(b, y, depth), at(b, h, depth), at(a, h, depth)],
    normal,
  );
}
function ledge(out, e, slot, tint, a, b, y, h, o, d) {
  const { at, along } = e;
  panel(out, e, slot, tint, a, b, y, h, o + d);
  face(out, slot, tint, [at(a, h, o), at(b, h, o), at(b, h, o + d), at(a, h, o + d)], up);
  face(out, slot, tint, [at(a, y, o), at(b, y, o), at(b, y, o + d), at(a, y, o + d)], [0, -1, 0]);
  for (const [u, dir] of [
    [a, -1],
    [b, 1],
  ])
    face(
      out,
      slot,
      tint,
      [at(u, y, o), at(u, h, o), at(u, h, o + d), at(u, y, o + d)],
      along.map((v) => dir * v),
    );
}
function footing(out, e, height, d) {
  const n = d === 0 ? 1 : Math.ceil(e.length / 7.5),
    { at, normal } = e;
  for (let i = 0; i < n; i++) {
    const a = (e.length * i) / n,
      b = (e.length * (i + 1)) / n;
    const under = (u) => {
      const [x, , z] = at(u, 0);
      return at(u, d === 0 ? -10 : Math.min(grade(x, z) - 0.35, height - 0.08));
    };
    face(
      out,
      'granite',
      i % 6 === 3 ? 'graniteShade' : 'granite',
      [under(a), under(b), at(b, height), at(a, height)],
      normal,
    );
  }
}
function opening(out, e, a, b, bottom, top, depth, d, door = false) {
  const { at, along } = e,
    back = depth - (d >= 2 ? 0.34 : 0.07);
  panel(out, e, 'glass', door ? 'dark' : 'glass', a, b, bottom, top, back);
  if (d === 1) {
    panel(out, e, 'stone', 'light', a - 0.23, b + 0.23, top, top + 0.2, depth + 0.025);
    return;
  }
  for (const [u, s] of [
    [a, 1],
    [b, -1],
  ])
    face(
      out,
      'stone',
      'recess',
      [at(u, bottom, depth), at(u, bottom, back), at(u, top, back), at(u, top, depth)],
      along.map((v) => v * s),
    );
  for (const [y, s] of [
    [bottom, 1],
    [top, -1],
  ])
    face(
      out,
      'stone',
      'recess',
      [at(a, y, depth), at(b, y, depth), at(b, y, back), at(a, y, back)],
      [0, s, 0],
    );
  panel(
    out,
    e,
    'metal',
    'iron',
    (a + b) * 0.5 - 0.035,
    (a + b) * 0.5 + 0.035,
    bottom,
    top,
    back + 0.028,
  );
  panel(
    out,
    e,
    'metal',
    'iron',
    a,
    b,
    mix(bottom, top, 0.56) - 0.025,
    mix(bottom, top, 0.56) + 0.025,
    back + 0.025,
  );
  panel(
    out,
    e,
    'glass',
    'glassLight',
    a + 0.13,
    mix(a, b, 0.38),
    top - 0.48,
    top - 0.09,
    back + 0.016,
  );
  if (door) {
    const n = d >= 3 ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const u = mix(a, b, (i + 0.5) / n);
      panel(out, e, 'metal', 'iron', u - 0.024, u + 0.024, bottom, top, back + 0.043);
    }
    if (d >= 3) {
      const h = mix(bottom, top, 0.64),
        r = (b - a) * 0.21,
        u = (a + b) * 0.5;
      const ring = Array.from({ length: 13 }, (_, i) =>
        at(u + Math.cos((TAU * i) / 12) * r, h + Math.sin((TAU * i) / 12) * r, back + 0.075),
      );
      beamPath(out, 'metal', ring, 0.028, 0.022, color.iron);
      for (let i = 0; i < 8; i++) {
        const a = (TAU * i) / 8;
        beam(
          out,
          'metal',
          at(u, h, back + 0.071),
          at(u + Math.cos(a) * r, h + Math.sin(a) * r, back + 0.071),
          0.023,
          0.023,
          color.iron,
        );
      }
    }
  }
}
function surround(out, e, a, b, y, h, o, d, cap) {
  if (d < 2) return;
  const { at, normal } = e;
  for (const x of [a - 0.2, b + 0.015])
    panel(out, e, 'stone', 'pier', x, x + 0.19, y - 0.08, h + 0.16, o + 0.046);
  panel(out, e, 'stone', 'light', a - 0.27, b + 0.27, y - 0.19, y - 0.015, o + 0.073);
  panel(out, e, 'stone', 'light', a - 0.25, b + 0.25, h + 0.06, h + 0.26, o + 0.075);
  if (d >= 3)
    ledge(out, e, 'stone', 'light', a - 0.31, b + 0.31, y - 0.2, y - 0.075, o + 0.018, 0.17);
  if (cap && d >= 2) {
    tri(
      out,
      'stone',
      'pier',
      [
        at(a - 0.3, h + 0.26, o + 0.05),
        at(b + 0.3, h + 0.26, o + 0.05),
        at((a + b) * 0.5, h + 0.67, o + 0.075),
      ],
      normal,
    );
    if (d >= 3) {
      const p = [
        at(a - 0.34, h + 0.28, o + 0.13),
        at((a + b) * 0.5, h + 0.72, o + 0.13),
        at(b + 0.34, h + 0.28, o + 0.13),
      ];
      beamPath(out, 'stone', p, 0.11, 0.15, color.light);
    }
  }
}
function windowCourse(
  out,
  e,
  d,
  start,
  end,
  y,
  top,
  bottom,
  h,
  n,
  width,
  depth = 0,
  slot = 'brick',
  tint = 'brick',
  door = false,
) {
  if (d === 0 || n < 1) {
    panel(out, e, slot, tint, start, end, y, top, depth);
    return;
  }
  for (let i = 0; i < n; i++) {
    const a = mix(start, end, i / n),
      b = mix(start, end, (i + 1) / n),
      u = (a + b) * 0.5;
    const w = Math.min(width, (b - a) * 0.57),
      l = u - w / 2,
      r = u + w / 2;
    if (d === 1) {
      panel(out, e, slot, tint, a, b, y, top, depth);
      panel(out, e, 'glass', door ? 'dark' : 'glass', l, r, bottom, h, depth + 0.015);
      panel(out, e, 'stone', 'light', l - 0.19, r + 0.19, h, h + 0.17, depth + 0.028);
    } else {
      panel(out, e, slot, tint, a, l, y, top, depth);
      panel(out, e, slot, tint, r, b, y, top, depth);
      panel(out, e, slot, tint, l, r, y, bottom, depth);
      panel(out, e, slot, tint, l, r, h, top, depth);
      opening(out, e, l, r, bottom, h, depth, d, door);
      surround(out, e, l, r, bottom, h, depth, d, bottom > split);
    }
  }
}
function buildingWall(out, e, d, portico) {
  footing(out, e, sill, d);
  if (portico) return;
  const n = e.length > 5 ? Math.max(1, Math.round(e.length / 5.8)) : 0,
    side = e.length > 20;
  const tint = side ? 'brick' : 'brickDark';
  if (d === 0) {
    panel(out, e, 'brick', tint, 0, e.length, sill, roofY);
    return;
  }
  windowCourse(out, e, d, 0, e.length, sill, split, 6.92, 10.6, n, 1.72, 0, 'brick', tint);
  windowCourse(out, e, d, 0, e.length, split, roofY, 12.45, 16.1, n, 1.69, 0, 'brick', tint);
  for (const [y, h, o] of [
    [sill - 0.17, sill + 0.09, 0.14],
    [split - 0.2, split + 0.11, 0.22],
    [roofY - 0.64, roofY - 0.26, 0.32],
    [roofY - 0.23, roofY + 0.08, 0.46],
  ]) {
    if (d === 1) panel(out, e, 'stone', 'trim', 0, e.length, y, h, o);
    else ledge(out, e, 'stone', 'trim', -0.02, e.length + 0.02, y, h, 0, o);
  }
  if (d >= 2 && e.length > 9) {
    const [x, , z] = e.at(e.length * 0.5, 0);
    if (grade(x, z) < 1.8) {
      const n = Math.max(1, Math.round(e.length / 8));
      for (let i = 0; i < n; i++) {
        const u = (e.length * (i + 0.5)) / n,
          [x, , z] = e.at(u, 0);
        if (grade(x, z) < 1.2) {
          panel(out, e, 'glass', 'dark', u - 0.63, u + 0.63, 3.44, 5.14, 0.014);
          panel(out, e, 'stone', 'light', u - 0.76, u + 0.76, 5.14, 5.32, 0.05);
        }
      }
    }
    if (d >= 3)
      for (let i = 0; i < e.length - 0.6; i += 0.73)
        panel(out, e, 'stone', 'recess', i + 0.05, i + 0.34, roofY - 0.61, roofY - 0.43, 0.345);
  }
}
function innerCourt(out, ring, d) {
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring, i, true),
      n = Math.max(1, Math.round(e.length / 5.3));
    footing(out, e, 6.1, d);
    windowCourse(
      out,
      e,
      d === 0 ? 0 : Math.max(1, d - 1),
      0,
      e.length,
      6.1,
      12.0,
      7.2,
      10.6,
      n,
      1.55,
      0,
      'brick',
      'brickDark',
    );
    windowCourse(
      out,
      e,
      d === 0 ? 0 : Math.max(1, d - 1),
      0,
      e.length,
      12.0,
      roofY,
      12.9,
      16.05,
      n,
      1.45,
      0,
      'brick',
      'brick',
    );
  }
}
function roofPitch(out, e, d) {
  if (e.length < (d === 0 ? 17 : 6.5)) return;
  const { at } = e,
    a = 0.15,
    b = e.length - 0.15;
  const base = roofY + 0.12,
    rise = e.length > 30 ? 2.08 : 1.55;
  face(
    out,
    'roof',
    'slate',
    [at(a, base, -0.18), at(b, base, -0.18), at(b, base + rise, -3.25), at(a, base + rise, -3.25)],
    up,
  );
  face(
    out,
    'roof',
    'slateDark',
    [at(a, base + rise, -3.25), at(b, base + rise, -3.25), at(b, base, -6.0), at(a, base, -6.0)],
    up,
  );
  for (const u of [a, b])
    tri(
      out,
      'roof',
      'slateDark',
      [at(u, base, -0.18), at(u, base + rise, -3.25), at(u, base, -6)],
      e.along.map((v) => (u === a ? -v : v)),
    );
  if (d >= 2)
    for (let u = a + 0.25; u < b; u += d >= 3 ? 0.66 : 1.55) {
      face(
        out,
        'roof',
        'slateLight',
        [
          at(u, base + 0.015, -0.18),
          at(u + 0.034, base + 0.015, -0.18),
          at(u + 0.034, base + rise + 0.019, -3.25),
          at(u, base + rise + 0.019, -3.25),
        ],
        up,
      );
    }
}
function rectangularProfile(out, slot, tint, x, z, width, depth, profile, chamfer) {
  loft(
    out,
    slot,
    profile.map(([y, k]) =>
      chamferedRectangle(x, y, z, width * k, depth * k, Math.min(chamfer * k, width * k * 0.35)),
    ),
    color[tint],
  );
}
function roofPavilion(out, tower, d) {
  const [x, z] = tower.center;
  const profile =
    d === 0
      ? [
          [roofY, 1],
          [21.49, 0.8],
          [23.25, 0.29],
        ]
      : d === 1
        ? [
            [roofY, 1],
            [19.22, 1],
            [21.69, 0.82],
            [23.21, 0.14],
          ]
        : [
            [roofY, 1],
            [18.5, 1.02],
            [19.22, 1],
            [20.4, 0.95],
            [21.69, 0.82],
            [22.62, 0.59],
            [23.04, 0.33],
            [23.21, 0.14],
          ];
  rectangularProfile(out, 'roof', 'slateDark', x, z, 11.35, 11.95, profile, 1.65);
  if (d === 0) return;
  for (const sign of [-1, 1]) {
    const o = [x, 19.1, z + sign * 5.95],
      q = [x, 21.35, z + sign * 4.65];
    const p = (dx, y, depth = 0) => [
      o[0] + dx,
      y,
      mix(o[2], q[2], (y - o[1]) / (q[1] - o[1])) + depth * sign,
    ];
    const n = [0, 0.25, sign],
      a = p(-0.87, 19.15, 0.11),
      b = p(0.87, 19.15, 0.11),
      c = p(0.87, 20.57, 0.17),
      e = p(-0.87, 20.57, 0.17);
    face(out, 'stone', 'pier', [a, b, c, e], n);
    tri(out, 'stone', 'light', [e, c, p(0, 21.18, 0.18)], n);
    face(
      out,
      'glass',
      'dark',
      [p(-0.5, 19.42, 0.19), p(0.5, 19.42, 0.19), p(0.5, 20.48, 0.21), p(-0.5, 20.48, 0.21)],
      n,
    );
    if (d >= 3) {
      beamPath(
        out,
        'stone',
        [p(-0.98, 20.62, 0.19), p(0, 21.27, 0.2), p(0.98, 20.62, 0.19)],
        0.12,
        0.12,
        color.light,
      );
      beam(out, 'metal', p(0, 19.45, 0.25), p(0, 20.53, 0.25), 0.06, 0.05, color.iron);
    }
  }
  if (d >= 3) {
    const rows = profile.slice(2);
    for (const axis of [0, 2])
      for (const sign of [-1, 1])
        for (const j of [-2, -1, 1, 2]) {
          const points = rows.map(([y, k]) => [
            x + (axis === 0 ? sign * (5.68 * k + 0.022) : j * 1.82 * k),
            y,
            z + (axis === 2 ? sign * (5.98 * k + 0.022) : j * 1.75 * k),
          ]);
          beamPath(out, 'roof', points, 0.055, 0.045, color.slateLight);
        }
  }
}
function innerRoofs(out, d) {
  if (d === 0) return;
  for (const [x0, x1, z0, z1, y] of [
    [-60, -25, 14, 40, 20.16],
    [9, 42, 14, 41, 20.1],
  ]) {
    const x = (x0 + x1) * 0.5,
      w = (x1 - x0) * 0.5,
      base = roofY + 0.33;
    block(out, 'roof', 'slateDark', [x0, roofY, z0], [x1, base, z1]);
    const p = (u, v) => [u, mix(base, y, 1 - Math.abs(u - x) / w), v];
    for (const [a, b] of [
      [x0, x],
      [x, x1],
    ]) {
      face(out, 'glass', 'glassLight', [p(a, z0), p(b, z0), p(b, z1), p(a, z1)], up);
      for (const [zz, sign] of [
        [z0, -1],
        [z1, 1],
      ])
        tri(out, 'roof', 'slateLight', [p(a, zz), p(b, zz), [x, base, zz]], [0, 0, sign]);
      if (d < 2) continue;
      for (let j = 1; j < 10; j++) {
        const zz = mix(z0, z1, j / 10),
          r = p(a, zz),
          s = p(b, zz);
        face(
          out,
          'roof',
          'slateDark',
          [r, s, [s[0], s[1] + 0.045, s[2] + 0.08], [r[0], r[1] + 0.045, r[2] + 0.08]],
          up,
        );
      }
    }
    if (d >= 3) beam(out, 'roof', p(x, z0), p(x, z1), 0.13, 0.12, color.slateDark);
  }
  for (const [x, z, w, l] of [
    [-17, 7, 13, 27],
    [-61, -12, 17, 13],
    [22, -2, 22, 12],
  ]) {
    const a = x - w * 0.5,
      b = x + w * 0.5,
      m = z + l * 0.5,
      y = roofY + 0.08,
      r = 2.02;
    face(
      out,
      'roof',
      'slate',
      [
        [a, y, z],
        [b, y, z],
        [b, y + r, m],
        [a, y + r, m],
      ],
      up,
    );
    face(
      out,
      'roof',
      'slateDark',
      [
        [a, y + r, m],
        [b, y + r, m],
        [b, y, z + l],
        [a, y, z + l],
      ],
      up,
    );
    tri(
      out,
      'brick',
      'brickDark',
      [
        [a, y, z],
        [a, y + r, m],
        [a, y, z + l],
      ],
      [-1, 0, 0],
    );
    tri(
      out,
      'brick',
      'brickDark',
      [
        [b, y, z],
        [b, y + r, m],
        [b, y, z + l],
      ],
      [1, 0, 0],
    );
  }
}
function stair(out, e, config, d) {
  const { at, normal, along } = e,
    { width, landingY, landingOut, far, n } = config;
  const middle = e.length * 0.5,
    a = middle - width * 0.5,
    b = middle + width * 0.5;
  const steps = d === 0 ? 1 : d === 1 ? Math.ceil(n / 3) : n;
  const first = (u) => {
    const [x, , z] = at(u, 0, far);
    return grade(x, z) + 0.24;
  };
  const p = (u, t, o) => at(u, mix(first(u), landingY, t), o);
  for (let i = 0; i < steps; i++) {
    const a0 = mix(far, landingOut, i / steps),
      a1 = mix(far, landingOut, (i + 1) / steps);
    const t = i / steps,
      k = (i + 1) / steps;
    face(
      out,
      'granite',
      i % 4 === 0 ? 'trim' : 'granite',
      [p(a, k, a0), p(b, k, a0), p(b, k, a1), p(a, k, a1)],
      up,
    );
    const base = (u) => {
      const p0 = p(u, t, a0);
      if (i === 0) p0[1] -= 0.4;
      return p0;
    };
    face(out, 'granite', 'graniteShade', [base(a), base(b), p(b, k, a0), p(a, k, a0)], normal);
    for (const [u, sign] of [
      [a, -1],
      [b, 1],
    ]) {
      const bottom = (o) => {
        const [x, , z] = at(u, 0, o);
        return at(u, grade(x, z) - 0.22, o);
      };
      face(
        out,
        'granite',
        'graniteShade',
        [p(u, k, a0), p(u, k, a1), bottom(a1), bottom(a0)],
        along.map((v) => v * sign),
      );
    }
  }
  const bridge = [
    at(a, landingY, -1.25),
    at(b, landingY, -1.25),
    at(b, landingY, landingOut),
    at(a, landingY, landingOut),
  ];
  face(out, 'granite', 'trim', bridge, up);
  for (const [i, sign] of [
    [0, -1],
    [1, 1],
  ]) {
    const a = bridge[i],
      b = bridge[3 - i],
      p = ([x, , z]) => [x, grade(x, z) - 0.3, z];
    face(
      out,
      'granite',
      'granite',
      [a, b, p(b), p(a)],
      along.map((v) => v * sign),
    );
  }
}
function column(out, e, u, o, bottom, top, radius, d, capital) {
  const [x, , z] = e.at(u, bottom, o);
  const h = top - bottom,
    sides = d === 0 ? 5 : d === 1 ? 6 : d === 2 ? 10 : 32;
  const ring = (y, r, flute = false) =>
    radialRing(y, r, r, sides, [x, z]).map((p, i) => {
      if (!flute || d < 2 || i % 2 === 0) return p;
      return [mix(x, p[0], 0.94), p[1], mix(z, p[2], 0.94)];
    });
  const profile =
    d === 0
      ? [
          [bottom, radius],
          [top, radius * 0.84],
        ]
      : d === 1
        ? [
            [bottom, radius * 1.08],
            [top - 0.28, radius * 0.86],
            [top, radius * 1.16],
          ]
        : d === 2
          ? [
              [bottom, radius * 1.21],
              [bottom + 0.29, radius],
              [top - 0.3, radius * 0.84],
              [top, radius * 1.18],
            ]
          : [
              [bottom, radius * 1.28],
              [bottom + 0.14, radius * 1.28],
              [bottom + 0.24, radius * 1.13],
              [bottom + 0.42, radius],
              [bottom + h * 0.42, radius * 0.996],
              [top - 0.42, radius * 0.83],
              [top - 0.28, radius * 0.92],
              [top - 0.13, radius * 1.1],
              [top, radius * 1.2],
            ];
  loft(
    out,
    'stone',
    profile.map(([y, r], i) => ring(y, r, i >= 3 && i <= 5)),
    color.light,
  );
  if (d < 2) return;
  const w = radius * (capital === 'ionic' ? 1.33 : 1.19);
  block(out, 'stone', 'trim', [x - w, top - 0.06, z - w], [x + w, top + 0.14, z + w]);
  block(
    out,
    'stone',
    'pier',
    [x - radius * 1.22, bottom - 0.14, z - radius * 1.22],
    [x + radius * 1.22, bottom, z + radius * 1.22],
  );
  if (capital === 'ionic' && d >= 3)
    for (const s of [-1, 1]) {
      const q = e.at(u + s * radius * 0.79, top - 0.14, o + radius * 0.8);
      const dims = [radius * 0.37, radius * 0.28, radius * 0.2];
      sphere(out, 'stone', q, dims, color.ornament, d >= 3 ? 10 : 6, d >= 3 ? 5 : 3);
    }
}
function pilaster(out, e, u, o, bottom, top, d) {
  const r = 0.49;
  if (d === 1) panel(out, e, 'stone', 'pier', u - r, u + r, bottom, top, o + 0.24);
  else ledge(out, e, 'stone', 'pier', u - r, u + r, bottom, top, o, 0.29);
  if (d >= 2)
    for (const y of [bottom, top - 0.31])
      ledge(out, e, 'stone', 'light', u - r - 0.11, u + r + 0.11, y, y + 0.27, o, 0.38);
}
function balustrade(out, e, a, b, y, o, d) {
  if (d === 0) return;
  if (d === 1) {
    panel(out, e, 'stone', 'pier', a, b, y, y + 0.44, o);
    return;
  }
  ledge(out, e, 'stone', 'trim', a, b, y, y + 0.11, o - 0.12, 0.32);
  ledge(out, e, 'stone', 'light', a, b, y + 0.49, y + 0.62, o - 0.12, 0.35);
  const n = Math.max(1, Math.round((b - a) / (d >= 3 ? 0.3 : 0.53)));
  for (let i = 0; i < n; i++) {
    const u = mix(a, b, (i + 0.5) / n);
    if (d === 2) {
      panel(out, e, 'stone', 'pier', u - 0.066, u + 0.066, y + 0.1, y + 0.51, o + 0.065);
      continue;
    }
    const [x, , z] = e.at(u, 0, o);
    const rows = [
      [0.1, 0.081],
      [0.18, 0.077],
      [0.32, 0.044],
      [0.43, 0.064],
      [0.5, 0.072],
    ];
    loft(
      out,
      'stone',
      rows.map(([h, r]) => radialRing(y + h, r, r, 5, [x, z])),
      color.light,
    );
  }
}
function archOpening(out, e, u, y, w, h, o, d) {
  const a = u - w / 2,
    b = u + w / 2,
    r = w / 2,
    head = y + h - r;
  const N = d <= 1 ? 6 : d === 2 ? 9 : 14,
    back = o - (d <= 1 ? 0.025 : 0.51);
  const curve = (i, pad = 0, depth = back) => {
    const t = (Math.PI * i) / N;
    return e.at(u + (r + pad) * Math.cos(t), head + (r + pad) * Math.sin(t), depth);
  };
  panel(out, e, 'glass', 'dark', a, b, y, head, back);
  for (let i = 0; i < N; i++) {
    tri(out, 'glass', 'dark', [e.at(u, head, back), curve(i), curve(i + 1)], e.normal);
    if (d >= 2) {
      face(
        out,
        'stone',
        'recess',
        [curve(i, 0, o), curve(i + 1, 0, o), curve(i + 1), curve(i)],
        [0, -1, 0],
      );
      face(
        out,
        'stone',
        i % 2 === 0 ? 'pier' : 'trim',
        [
          curve(i, 0, o + 0.018),
          curve(i + 1, 0, o + 0.018),
          curve(i + 1, 0.27, o + 0.058),
          curve(i, 0.27, o + 0.058),
        ],
        e.normal,
      );
      const p = curve(i, 0, o),
        q = curve(i + 1, 0, o);
      face(
        out,
        'stone',
        'pier',
        [p, q, [q[0], y + h + 0.46, q[2]], [p[0], y + h + 0.46, p[2]]],
        e.normal,
      );
    }
  }
  if (d >= 2) {
    for (const [u, dir] of [
      [a, 1],
      [b, -1],
    ]) {
      const want = e.along.map((v) => v * dir);
      face(
        out,
        'stone',
        'recess',
        [e.at(u, y, o), e.at(u, y, back), e.at(u, head, back), e.at(u, head, o)],
        want,
      );
    }
    for (let i = 1; i < 5; i++) {
      const x = mix(a, b, i / 5);
      panel(out, e, 'metal', 'iron', x - 0.028, x + 0.028, y, head + r * 0.39, back + 0.032);
    }
  }
}
const glyph = {
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.22, 0.41],
      [0.78, 0.41],
    ],
  ],
  C: [
    [
      [1, 0.88],
      [0.71, 1],
      [0.24, 0.9],
      [0, 0.55],
      [0.16, 0.15],
      [0.6, 0],
      [1, 0.16],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.53],
      [0.78, 0.53],
    ],
  ],
  G: [
    [
      [1, 0.83],
      [0.69, 1],
      [0.21, 0.89],
      [0, 0.51],
      [0.14, 0.17],
      [0.53, 0],
      [0.99, 0.12],
      [1, 0.49],
      [0.62, 0.49],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0.22, 1],
      [0.78, 1],
    ],
    [
      [0.22, 0],
      [0.78, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.27],
      [1, 1],
      [1, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  O: [
    [
      [0.27, 0.04],
      [0.05, 0.26],
      [0, 0.65],
      [0.28, 0.95],
      [0.71, 1],
      [0.95, 0.76],
      [1, 0.39],
      [0.75, 0.06],
      [0.27, 0.04],
    ],
  ],
  Q: [
    [
      [0.27, 0.04],
      [0.05, 0.26],
      [0, 0.65],
      [0.28, 0.95],
      [0.71, 1],
      [0.95, 0.76],
      [1, 0.39],
      [0.75, 0.06],
      [0.27, 0.04],
    ],
    [
      [0.55, 0.31],
      [1.06, -0.14],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.69, 1],
      [0.94, 0.85],
      [0.91, 0.65],
      [0.7, 0.54],
      [0, 0.54],
    ],
    [
      [0.48, 0.54],
      [1, 0],
    ],
  ],
  S: [
    [
      [1, 0.86],
      [0.73, 1],
      [0.24, 0.96],
      [0.03, 0.77],
      [0.18, 0.58],
      [0.79, 0.47],
      [0.98, 0.25],
      [0.8, 0.06],
      [0.35, 0],
      [0.01, 0.16],
    ],
  ],
  V: [
    [
      [0, 1],
      [0.48, 0],
      [1, 1],
    ],
  ],
};
function inscription(out, e, text, y, depth) {
  const h = 0.46,
    w = 0.35,
    spacing = 0.49,
    m = e.length * 0.5;
  const s = e.normal[2] > 0 ? -1 : 1;
  for (const [i, ch] of [...text].entries()) {
    if (ch === ' ') continue;
    const u = m + s * (i - (text.length - 1) * 0.5) * spacing;
    for (const path of glyph[ch]) {
      for (let j = 1; j < path.length; j++) {
        const [a, b] = path[j - 1],
          [c, d] = path[j],
          du = s * (c - a) * w,
          dv = (d - b) * h,
          L = Math.hypot(du, dv),
          r = 0.015;
        const p = (x, z, k) =>
          e.at(u + s * x * w - (k * r * dv) / L, y + z * h + (k * r * du) / L, depth);
        face(out, 'metal', 'letter', [p(a, b, -1), p(c, d, -1), p(c, d, 1), p(a, b, 1)], e.normal);
      }
    }
  }
}
function sphinx(out, x, y, z, d) {
  const tint = 'bronze',
    n = d === 1 ? 5 : d === 2 ? 7 : 15,
    h = d === 1 ? 3 : d === 2 ? 4 : 8;
  const round = (a, b, c, rx, ry, rz, t = tint) =>
    sphere(out, 'bronze', [x + a, y + b, z + c], [rx, ry, rz], color[t], n, h);
  round(0, 0.48, -0.3, 0.56, 0.46, 1.12);
  round(0, 0.73, 0.47, 0.48, 0.54, 0.42);
  round(0, 1.26, 0.59, 0.23, 0.52, 0.29);
  round(0, 1.62, 0.63, 0.25, 0.32, 0.28, 'patina');
  for (const s of [-1, 1]) {
    round(s * 0.33, 0.19, 0.98, 0.19, 0.17, 0.76);
    round(s * 0.4, 0.32, -0.77, 0.28, 0.29, 0.59);
    const root = [x + s * 0.34, y + 0.75, z + 0.43],
      top = [x + s * 0.78, y + 1.62, z - 0.99];
    const p = (xx, yy, zz) => [x + s * xx, y + yy, z + zz],
      want = [s, 0.3, 0.17];
    const outline = [
      root,
      p(0.51, 1.22, 0.43),
      p(0.63, 1.38, 0.15),
      top,
      p(0.79, 1.46, -0.94),
      p(0.69, 1.07, -0.68),
      p(0.6, 0.67, -0.19),
    ];
    for (let j = 1; j < outline.length - 1; j++) {
      tri(out, 'bronze', j < 3 ? 'patina' : 'bronze', [root, outline[j], outline[j + 1]], want);
      tri(
        out,
        'bronze',
        'bronzeDark',
        [root, outline[j + 1], outline[j]],
        want.map((v) => -v),
      );
    }
    if (d >= 2) {
      const feathers = d >= 3 ? 10 : 5;
      for (let i = 0; i < feathers; i++) {
        const t = i / (feathers - 1),
          tip = p(0.77 - 0.15 * t, 1.59 - 0.82 * t, -1.0 + 0.52 * t),
          r = p(0.53 + 0.05 * t, 1.22 - 0.56 * t, 0.32 - 0.05 * t);
        face(
          out,
          'bronze',
          i % 3 === 0 ? 'patina' : 'bronze',
          [
            r,
            p(0.66, 1.29 - 0.54 * t, -0.25),
            tip,
            p(0.75 - 0.14 * t, 1.51 - 0.82 * t, -0.91 + 0.49 * t),
          ],
          want,
        );
        if (d >= 3) beam(out, 'bronze', r, tip, 0.019, 0.026, color.patina);
      }
      round(s * 0.188, 1.57, 0.6, 0.091, 0.14, 0.1);
      for (let j = 0; j < 3; j++)
        beam(
          out,
          'bronze',
          [x + s * 0.33 + (j - 1) * 0.057, y + 0.3, z + 1.49],
          [x + s * 0.33 + (j - 1) * 0.06, y + 0.23, z + 1.67],
          0.025,
          0.023,
          color.bronzeDark,
        );
    }
  }
  if (d >= 2) {
    round(0, 1.83, 0.54, 0.273, 0.2, 0.29, 'bronzeDark');
    round(0, 1.63, 0.898, 0.057, 0.085, 0.09, 'patina');
    beamPath(
      out,
      'bronze',
      [
        [x - 0.107, y + 1.51, z + 0.849],
        [x, y + 1.48, z + 0.89],
        [x + 0.107, y + 1.51, z + 0.849],
      ],
      0.021,
      0.019,
      color.bronzeDark,
    );
    const tail = [
      [x + 0.36, y + 0.18, z - 1.31],
      [x + 0.53, y + 0.25, z - 1.2],
      [x + 0.56, y + 0.29, z - 0.83],
      [x + 0.48, y + 0.31, z - 0.58],
    ];
    beamPath(out, 'bronze', tail, 0.071, 0.065, color.bronze);
  }
}
function carvedFigure(out, origin, h, d, gesture = 0) {
  const [x, y, z] = origin,
    r = d <= 2 ? 5 : 8,
    n = d <= 2 ? 3 : 5;
  const round = (a, b, c, rx, ry, rz) =>
    sphere(
      out,
      'stone',
      [x + a * h, y + b * h, z + c * h],
      [rx * h, ry * h, rz * h],
      color.ornament,
      r,
      n,
    );
  const rows = [
    [0.025, 0.205, 0.145],
    [0.34, 0.16, 0.134],
    [0.63, 0.205, 0.125],
    [0.79, 0.13, 0.105],
  ];
  loft(
    out,
    'stone',
    rows.map(([v, w, t]) => radialRing(y + v * h, w * h, t * h, r, [x, z])),
    color.pier,
  );
  round(0.015, 0.89, 0.032, 0.115, 0.131, 0.1);
  if (d >= 2) {
    const target = [x + h * (gesture ? 0.42 : 0.21), y + h * (gesture ? 1.04 : 0.45), z + h * 0.12];
    beam(out, 'stone', [x + 0.145 * h, y + 0.68 * h, z], target, 0.15 * h, 0.14 * h, color.light);
    beam(
      out,
      'stone',
      [x - 0.143 * h, y + 0.68 * h, z],
      [x - 0.225 * h, y + 0.35 * h, z + 0.08 * h],
      0.13 * h,
      0.13 * h,
      color.ornament,
    );
    if (d >= 3) {
      for (let j = 0; j < 4; j++)
        beamPath(
          out,
          'stone',
          [
            [x + (j - 1.5) * 0.076 * h, y + 0.64 * h, z + 0.116 * h],
            [x + (j - 1.65) * 0.092 * h, y + 0.36 * h, z + 0.133 * h],
            [x + (j - 1.8) * 0.097 * h, y + 0.043 * h, z + 0.147 * h],
          ],
          0.018 * h,
          0.019 * h,
          color.light,
        );
    }
  }
}
function porticoReturns(out, e, bottom, depth) {
  const { at, along, length } = e;
  for (const [u, sign] of [
    [0, 1],
    [length, -1],
  ]) {
    face(
      out,
      'stone',
      'pier',
      [at(u, bottom, 0), at(u, bottom, depth), at(u, roofY, depth), at(u, roofY, 0)],
      along.map((v) => v * sign),
    );
  }
}
function serrano(out, e, d) {
  const m = e.length * 0.5,
    depth = -1.06,
    landingY = 6.24;
  porticoReturns(out, e, sill, depth);
  if (d === 0) {
    panel(out, e, 'stone', 'pier', 0, e.length, sill, roofY, depth);
    for (const y of [11.39, 17.51]) panel(out, e, 'stone', 'light', 0, e.length, y, y + 0.57, 0.61);
  } else {
    windowCourse(
      out,
      e,
      d,
      0,
      e.length,
      sill,
      split,
      6.3,
      10.96,
      5,
      3.02,
      depth,
      'stone',
      'pier',
      true,
    );
    windowCourse(
      out,
      e,
      d,
      0,
      e.length,
      split,
      roofY,
      12.61,
      16.45,
      5,
      2.87,
      depth,
      'stone',
      'pier',
    );
    if (d >= 2) inscription(out, e, 'MVSEO ARQVEOLOGICO NACIONAL', 11.27, 0.725);
  }
  for (const u of [-10.2, -6.12, -2.04, 2.04, 6.12, 10.2]) {
    column(out, e, m + u, 0.22, 6.39, 11.01, 0.49, d, 'tuscan');
    column(out, e, m + u, 0.19, 12.16, 17.56, 0.47, d, 'ionic');
  }
  if (d >= 1) {
    for (const s of [-1, 1])
      for (const [lo, hi] of [
        [6.28, 11.05],
        [12.12, 17.56],
      ])
        pilaster(out, e, m + s * 13.02, -0.51, lo, hi, d);
    for (const [y, h, o] of [
      [11.1, 11.34, 0.62],
      [11.34, 11.82, 0.71],
      [11.86, 12.13, 0.55],
      [17.57, 17.82, 0.71],
      [17.89, 18.11, 0.86],
    ]) {
      if (d === 1) panel(out, e, 'stone', 'light', m - 13.5, m + 13.5, y, h, o);
      else ledge(out, e, 'stone', 'light', m - 13.52, m + 13.52, y, h, depth, o - depth);
    }
    for (let i = 0; i < 5; i++)
      balustrade(out, e, m - 10.0 + i * 4.08, m - 6.32 + i * 4.08, 11.83, 0.49, d);
    for (const sign of [-1, 1]) {
      const u = m + sign * 10.94;
      const [x, , z] = e.at(u, 0, 3.75),
        support = 6.17;
      block(
        out,
        'granite',
        'granite',
        [x - 0.94, Math.min(grade(x, z) - 0.24, support - 0.37), z - 1.89],
        [x + 0.94, support, z + 1.89],
      );
      block(
        out,
        'bronze',
        'bronzeDark',
        [x - 0.73, support, z - 1.61],
        [x + 0.73, support + 0.18, z + 1.61],
      );
      sphinx(out, x, support + 0.18, z, d);
      if (d >= 2) {
        const [x, , z] = e.at(m + sign * 14.16, 0, 1.4),
          b = Math.min(grade(x, z) - 0.2, sill - 0.25);
        block(out, 'granite', 'granite', [x - 0.65, b, z - 0.59], [x + 0.65, 6.92, z + 0.59]);
        carvedFigure(out, [x, 6.92, z], 2.22, d, sign === 1 ? 1 : 0);
      }
    }
  }
  stair(out, e, { width: 18.3, landingY, landingOut: 2.57, far: 9.53, n: 9 }, d);
  if (d >= 2) {
    const base = e.at(m, 13.3, 0.85),
      end = e.at(m, 15.88, 3.75);
    beam(out, 'metal', base, end, 0.058, 0.058, color.iron);
    for (const [i, tint] of ['clothRed', 'clothYellow', 'clothRed'].entries()) {
      const y = end[1] - i * 0.35;
      const p = [
        [end[0], y, end[2]],
        [end[0] + 1.48, y - 0.33, end[2] + 0.15],
        [end[0] + 1.45, y - 0.68, end[2] + 0.13],
        [end[0], y - 0.35, end[2]],
      ];
      face(out, 'metal', tint, p, e.normal);
      face(
        out,
        'metal',
        tint,
        p,
        e.normal.map((v) => -v),
      );
    }
  }
}
function recoletos(out, e, d) {
  const m = e.length * 0.5,
    o = -1.08,
    y = 1.87;
  porticoReturns(out, e, y, o);
  // The Recoletos base is lower than Serrano because of the grade across the city block.
  const { at, normal } = e;
  panel(out, e, 'stone', 'pier', 0, e.length, 11.04, roofY, o);
  for (const a of [-6.35, 0, 6.35]) {
    const u = m + a,
      w = 3.06,
      h = 7.25,
      lo = u - w * 0.5,
      hi = u + w * 0.5;
    if (d >= 2) {
      panel(out, e, 'stone', 'pier', u - 3.175, lo, y, 11.04, o);
      panel(out, e, 'stone', 'pier', hi, u + 3.175, y, 11.04, o);
      panel(out, e, 'stone', 'pier', lo, hi, y + h + 0.46, 11.04, o);
    } else {
      panel(out, e, 'stone', 'pier', u - 3.175, u + 3.175, y, 11.04, o - 0.065);
    }
    archOpening(out, e, u, y, w, h, o, d);
  }
  for (const [a, b] of [
    [0, m - 9.525],
    [m + 9.525, e.length],
  ])
    panel(out, e, 'stone', 'pier', a, b, y, 11.04, o);
  for (const u of [-8.34, -5.0, -1.67, 1.67, 5.0, 8.34])
    column(out, e, m + u, 0.47, 10.69, 17.84, 0.53, d, 'ionic');
  if (d >= 1) {
    for (const u of [-9.56, 9.56]) pilaster(out, e, m + u, -0.4, 10.65, 17.8, d);
    for (let i = 0; i < 5; i++) {
      const u = m + (i - 2) * 3.34;
      panel(out, e, 'glass', 'glass', u - 0.96, u + 0.96, 12.11, 16.17, o + 0.021);
      balustrade(out, e, u - 1.48, u + 1.48, 10.91, 0.63, d);
    }
  }
  const a = m - 10.33,
    b = m + 10.33,
    base = 18.55,
    peak = 21.86,
    front = 0.78;
  panel(out, e, 'stone', 'light', a, b, 17.89, base, front);
  tri(out, 'stone', 'recess', [at(a, base, front), at(b, base, front), at(m, peak, front)], normal);
  if (d >= 1)
    beamPath(
      out,
      'stone',
      [at(a, base, 0.9), at(m, peak, 0.9), at(b, base, 0.9)],
      0.32,
      0.31,
      color.light,
    );
  if (d >= 2) {
    ledge(out, e, 'stone', 'trim', a, b, 18.28, 18.49, -0.12, 1.13);
    for (let i = -4; i <= 4; i++) {
      const h = 2.13 * (1 - Math.abs(i) * 0.143),
        [x, , z] = at(m + i * 1.65, 0, 0.86);
      carvedFigure(out, [x, 18.58, z], h, d, i === 0 ? 1 : 0);
    }
    for (const [u, h, large] of [
      [a, base, false],
      [m, peak, true],
      [b, base, false],
    ]) {
      const [x, , z] = at(u, 0, 0.57);
      block(out, 'stone', 'pier', [x - 0.6, h, z - 0.6], [x + 0.6, h + 0.36, z + 0.6]);
      carvedFigure(out, [x, h + 0.36, z], large ? 1.56 : 1.13, d, large ? 1 : 0);
    }
  }
  stair(out, e, { width: 21.5, landingY: y, landingOut: 3.3, far: 18.3, n: 23 }, d);
  if (d >= 2)
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const u = m + sign * (11.85 + i * 0.52),
          o = 5.9 + i * 3.49;
        const [x, , z] = at(u, 0, o),
          b = grade(x, z) - 0.12,
          h = 1.07 + (2 - i) * 0.17;
        block(out, 'granite', 'granite', [x - 0.65, b, z - 0.65], [x + 0.65, b + h, z + 0.65]);
        carvedFigure(out, [x, b + h, z], 1.74, d, (i + 1) % 2);
      }
    }
}
export function buildMuseumLevel(out, level) {
  const d = tiers[level];
  for (const r of layout.top) plane(out, 'roof', 'slate', r, roofY);
  for (const { outline } of layout.lower) {
    plane(out, 'roof', 'slateLight', [outline], 15.05);
    for (let j = 0; j < outline.length; j++) {
      const e = edge(outline, j, true);
      panel(out, e, 'brick', 'brickDark', 0, e.length, 15.05, roofY);
    }
  }
  for (let i = 0; i < layout.outline.length; i++) {
    const e = edge(layout.outline, i);
    const east = i === layout.mainEdges.serrano,
      west = i === layout.mainEdges.recoletos;
    if (west) {
      footing(out, e, 1.87, d);
      recoletos(out, e, d);
    } else {
      buildingWall(out, e, d, east);
      if (east) serrano(out, e, d);
    }
    if (!east && !west) roofPitch(out, e, d);
  }
  for (const ring of layout.courts) innerCourt(out, ring, d);
  for (const t of layout.towers) roofPavilion(out, t, d);
  innerRoofs(out, d);
}
export const buildSkyline = (out) => buildMuseumLevel(out, 'skyline');
export const buildDistrict = (out) => buildMuseumLevel(out, 'district');
export const buildStreet = (out) => buildMuseumLevel(out, 'street');
export const buildCloseup = (out) => buildMuseumLevel(out, 'closeup');
export const buildMaster = (out) => buildMuseumLevel(out, 'master');
