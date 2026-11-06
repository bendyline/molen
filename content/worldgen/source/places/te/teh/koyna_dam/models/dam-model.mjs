import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [73.75160513853048, 17.402178525332058],
  heading: -0.5361871156773563,
  datum: 642.0446583749999,
  crest: 664.45,
  foundation: 561.43,
  bed: 579.81,
  fullPool: 659.43,
  length: 807.72,
  spillway: {
    center: 11.38531,
    length: 88.71,
    bays: 6,
    gateWidth: 12.5,
    gateHeight: 9.14,
    sill: 650.291,
  },
  bridge: [
    [-61.82559, 299.37427],
    [28.7522, 302.88528],
    [120.10698, 295.99172],
  ],
  basinApron: [
    [-32.96969, 61, 55.74031, 579.8],
    [-16, 82, 56.5, 578.3],
    [-16, 111, 57.5, 576.4],
  ],
  basinWalls: [
    [
      [-38, 57],
      [-20, 122],
      [-20, 221],
      [-30, 255],
    ],
    [
      [60.7, 57],
      [57, 108],
      [62.5, 204],
      [65.5, 255],
    ],
  ],
  powerhouse: [
    [-127.05639, 68.02352],
    [-69.24751, 67.14427],
    [-67.65957, 96.02913],
    [-127.23619, 98.95312],
  ],
};

const materials = {
  masonry: { slot: 'wall', graph: 'concrete_boardformed', color: [0.155, 0.159, 0.153] },
  stain: { slot: 'wall', graph: 'concrete_boardformed', color: [0.109, 0.128, 0.115] },
  rib: { slot: 'wall', graph: 'concrete_boardformed', color: [0.235, 0.239, 0.23] },
  deck: { slot: 'foundation', graph: 'concrete_plain', color: [0.32, 0.319, 0.297] },
  gate: { slot: 'door', graph: 'metal_painted', color: [0.16, 0.2, 0.197] },
  gold: { slot: 'door', graph: 'metal_painted', color: [0.64, 0.4, 0.078] },
  coral: { slot: 'door', graph: 'metal_painted', color: [0.53, 0.24, 0.19] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', color: [0.17, 0.34, 0.35] },
  window: { slot: 'window', graph: 'window_grid', color: [0.15, 0.194, 0.202] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(materials).map(([key, { slot, graph }]) => [key, { slot, graph }]),
);
const { datum, crest, foundation, length, spillway, powerhouse } = controls;
const left = spillway.center - spillway.length / 2,
  right = spillway.center + spillway.length / 2;
const y = (height) => height - datum;
const point = (x, height, z) => [x, y(height), z];
function face(out, material, points, expected) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  const add = points.length === 3 ? out.addTriangle : out.addQuad;
  add.call(out, material, 'palette:#ffffff', points, normal, undefined, materials[material].color);
}
const quad = (out, m, a, b, c, d, n) => face(out, m, [a, b, c, d], n);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, materials[m].color);
function box(out, m, x0, x1, h0, h1, z0, z1) {
  const [a, b, c, d, e, f, g, h] = [
    [x0, h0, z0],
    [x1, h0, z0],
    [x1, h0, z1],
    [x0, h0, z1],
    [x0, h1, z0],
    [x1, h1, z0],
    [x1, h1, z1],
    [x0, h1, z1],
  ].map((p) => point(...p));
  quad(out, m, a, b, f, e, [0, 0, -1]);
  quad(out, m, c, d, h, g, [0, 0, 1]);
  quad(out, m, b, c, g, f, [1, 0, 0]);
  quad(out, m, d, a, e, h, [-1, 0, 0]);
  quad(out, m, e, f, g, h, [0, 1, 0]);
  quad(out, m, d, c, b, a, [0, -1, 0]);
}
function wing(out, a, b, detail) {
  const stations = [a, ...abutments.filter(([x]) => x > a && x < b).map(([x]) => x), b];
  const profile = (x) => {
    const base = baseAt(x),
      h = crest - base;
    const full = [
      [base, -13, 38],
      [base + h * 0.36, -10, 23],
      [base + h * 0.78, -7, 12],
      [crest, -4, 7],
    ];
    return detail.coarse ? [full[0], full[2], full[3]] : full;
  };
  for (let j = 1; j < stations.length; j++) {
    const l = stations[j - 1],
      r = stations[j],
      p = profile(l),
      q = profile(r);
    for (let i = 1; i < p.length; i++) {
      const [h, u, v] = p[i - 1],
        [k, w, z] = p[i],
        [H, U, V] = q[i - 1],
        [K, W, Z] = q[i];
      quad(
        out,
        'masonry',
        point(l, h, u),
        point(r, H, U),
        point(r, K, W),
        point(l, k, w),
        [0, 0, -1],
      );
      quad(out, 'stain', point(l, h, v), point(r, H, V), point(r, K, Z), point(l, k, z), [0, 0, 1]);
    }
    quad(
      out,
      'deck',
      point(l, crest, -4),
      point(r, crest, -4),
      point(r, crest, 7),
      point(l, crest, 7),
      [0, 1, 0],
    );
    quad(
      out,
      'masonry',
      point(l, p[0][0], -13),
      point(r, q[0][0], -13),
      point(r, q[0][0], 38),
      point(l, p[0][0], 38),
      [0, -1, 0],
    );
  }
  for (const [x, dir] of [
    [a, -1],
    [b, 1],
  ]) {
    const rows = profile(x);
    for (let i = 1; i < rows.length; i++) {
      const [h, u, v] = rows[i - 1],
        [k, w, z] = rows[i];
      quad(out, 'masonry', point(x, h, u), point(x, h, v), point(x, k, z), point(x, k, w), [
        dir,
        0,
        0,
      ]);
    }
  }
}
function buttress(out, x, base, width, detail) {
  const sections = [
    [base, 32, 57, width * 0.61],
    [655.5, 8, 10.8, width * 0.5],
  ];
  if (!detail.coarse) sections.splice(1, 0, [base + (655.5 - base) * 0.28, 25, 47, width * 0.59]);
  const faceAt = (p, edge, back) => point(x + edge * p[3], p[0], p[back ? 1 : 2]);
  for (let i = 1; i < sections.length; i++) {
    const p = sections[i - 1],
      q = sections[i];
    quad(
      out,
      'rib',
      faceAt(p, -1, false),
      faceAt(p, 1, false),
      faceAt(q, 1, false),
      faceAt(q, -1, false),
      [0, 0, 1],
    );
    for (const edge of [-1, 1])
      quad(
        out,
        'masonry',
        faceAt(p, edge, false),
        faceAt(p, edge, true),
        faceAt(q, edge, true),
        faceAt(q, edge, false),
        [edge, 0, 0],
      );
    if (detail.joints) {
      for (let j = 1; j < 4; j++) {
        const t = j / 4,
          row = q.map((v, k) => p[k] + (v - p[k]) * t);
        const a = faceAt(row, -1, false),
          b = faceAt(row, 1, false);
        a[2] += 0.042;
        b[2] += 0.042;
        rod(out, 'stain', a, b, 0.07, 0.025);
      }
    }
  }
}
const chuteProfile = [
  [650.291, 2],
  [647.4, 8],
  [640, 14],
  [625, 23],
  [604, 33],
  [584, 49],
  [579.8, 61],
];
function spill(out, detail) {
  const step = spillway.length / spillway.bays;
  box(out, 'deck', left, right, crest - 1.4, crest, -5, 8.7);
  box(out, 'masonry', left, right, foundation, spillway.sill, -13, 2);
  for (const [x, dir] of [
    [left, -1],
    [right, 1],
  ])
    for (let i = 1; i < chuteProfile.length; i++) {
      const [h, z] = chuteProfile[i - 1],
        [k, w] = chuteProfile[i];
      const side = [point(x, h, z), point(x, k, w), point(x, k, 2)];
      if (z !== 2) side.push(point(x, h, 2));
      face(out, 'masonry', side, [dir, 0, 0]);
    }
  for (let i = 0; i < spillway.bays; i++) {
    const a = left + i * step,
      b = a + step,
      inner = (step - spillway.gateWidth) / 2,
      l = a + inner,
      r = b - inner;
    for (let k = 1; k < chuteProfile.length; k++) {
      const [h, z] = chuteProfile[k - 1],
        [j, w] = chuteProfile[k];
      quad(out, 'rib', point(a, h, z), point(b, h, z), point(b, j, w), point(a, j, w), [0, 1, 1]);
    }
    const pivotZ = 5.3,
      top = spillway.sill + spillway.gateHeight;
    const rows = [
      [spillway.sill, 2.08],
      [spillway.sill + 3.7, 3.68],
      [top, 2.8],
    ];
    for (let j = 1; j < rows.length; j++) {
      const [h, z] = rows[j - 1],
        [k, w] = rows[j];
      quad(out, 'gate', point(l, h, z), point(r, h, z), point(r, k, w), point(l, k, w), [0, 0, 1]);
      quad(
        out,
        'gate',
        point(r, h, z - 0.22),
        point(l, h, z - 0.22),
        point(l, k, w - 0.22),
        point(r, k, w - 0.22),
        [0, 0, -1],
      );
    }
    box(out, 'masonry', a, l, 650.291, crest, -0.7, 11.6);
    box(out, 'masonry', r, b, 650.291, crest, -0.7, 11.6);
    quad(
      out,
      'masonry',
      point(a, 650.291, 11.6),
      point(l, 650.291, 11.6),
      point(l, 636, 18),
      point(a, 636, 18),
      [0, 0, 1],
    );
    if (detail.rails)
      for (const x of [l + 0.38, r - 0.38]) {
        rod(out, 'gate', point(x, top - 1.1, 3.05), point(x, 654.5, pivotZ + 4.6), 0.22, 0.3);
        rod(out, 'gate', point(x, 651.4, 2.8), point(x, 654.5, pivotZ + 4.6), 0.22, 0.3);
      }
  }
  for (const [a, b] of [
    [left - 5, left],
    [right, right + 5],
  ])
    box(out, 'masonry', a, b, 635, 668.2, -4.5, 12.3);
}
function retainingWalls(out, detail) {
  for (const [i, route] of controls.basinWalls.entries()) {
    const side = i === 0 ? -1 : 1,
      top = (z) => 601.3 - (z - 57) * 0.026,
      foot = 570,
      w = 4.2;
    for (let j = 1; j < route.length; j++) {
      const [a, z] = route[j - 1],
        [b, u] = route[j],
        h = top(z),
        k = top(u);
      quad(out, 'masonry', point(a, foot, z), point(b, foot, u), point(b, k, u), point(a, h, z), [
        -side,
        0,
        0,
      ]);
      quad(
        out,
        'masonry',
        point(a + side * w, foot, z),
        point(b + side * w, foot, u),
        point(b + side * w, k, u),
        point(a + side * w, h, z),
        [side, 0, 0],
      );
      quad(
        out,
        'deck',
        point(a, h, z),
        point(b, k, u),
        point(b + side * w, k, u),
        point(a + side * w, h, z),
        [0, 1, 0],
      );
      if (detail.rails)
        rod(
          out,
          'gate',
          point(a + side * 0.6, h + 0.9, z),
          point(b + side * 0.6, k + 0.9, u),
          0.12,
          0.12,
        );
    }
    for (const [[x, z], dir] of [
      [route[0], -1],
      [route.at(-1), 1],
    ]) {
      quad(
        out,
        'masonry',
        point(x, foot, z),
        point(x + side * w, foot, z),
        point(x + side * w, top(z), z),
        point(x, top(z), z),
        [0, 0, dir],
      );
    }
  }
  const apron = controls.basinApron;
  for (let i = 1; i < apron.length; i++) {
    const [a, z, b, h] = apron[i - 1],
      [c, w, e, k] = apron[i];
    quad(out, 'rib', point(a, h, z), point(b, h, z), point(e, k, w), point(c, k, w), [0, 1, 0]);
    quad(
      out,
      'masonry',
      point(a, 568, z),
      point(c, 568, w),
      point(c, k, w),
      point(a, h, z),
      [-1, 0, 0],
    );
    quad(
      out,
      'masonry',
      point(b, 568, z),
      point(e, 568, w),
      point(e, k, w),
      point(b, h, z),
      [1, 0, 0],
    );
  }
  const [a, z, b, h] = apron.at(-1);
  quad(
    out,
    'masonry',
    point(a, 568, z),
    point(b, 568, z),
    point(b, h, z),
    point(a, h, z),
    [0, 0, 1],
  );
  box(out, 'rib', -20, 62.5, 574.5, 582.5, 202, 207);
}
function powerStation(out, detail) {
  const ground = 596,
    wall = 608,
    peak = 612;
  const [a, b, c, d] = powerhouse;
  const local = (v, h) => point(v[0], h, v[1]);
  for (let i = 0; i < 4; i++) {
    const u = powerhouse[i],
      v = powerhouse[(i + 1) % 4],
      dx = v[0] - u[0],
      dz = v[1] - u[1];
    quad(out, 'deck', local(u, 574), local(v, 574), local(v, ground), local(u, ground), [
      dz,
      0,
      -dx,
    ]);
    quad(out, 'masonry', local(u, ground), local(v, ground), local(v, wall), local(u, wall), [
      dz,
      0,
      -dx,
    ]);
  }
  const mid = (u, v) => u.map((q, i) => (q + v[i]) / 2),
    e = mid(a, d),
    f = mid(b, c);
  for (const [u, v] of [
    [a, b],
    [d, c],
  ])
    quad(out, 'roof', local(u, wall), local(v, wall), local(f, peak), local(e, peak), [0, 1, 0]);
  face(out, 'masonry', [local(a, wall), local(d, wall), local(e, peak)], [-1, 0, 0]);
  face(out, 'masonry', [local(b, wall), local(c, wall), local(f, peak)], [1, 0, 0]);
  if (detail.rails) {
    for (let i = 0; i < 10; i++) {
      const x = d[0] + 4 + 5.4 * i,
        z = d[1] + ((c[1] - d[1]) * (i + 0.7)) / 10;
      box(out, 'window', x, x + 3.8, 601.2, 605.6, z, z + 0.16);
    }
  }
}
function crestFeatures(out, detail) {
  const x = left - 4.2,
    z = 8.1,
    sides = detail.rails ? 12 : 8;
  const tower = [
    [654.8, 1.35],
    [658.2, 2.55],
    [661.4, 3.38],
    [664.5, 3.78],
    [667.4, 3.69],
    [670.55, 3.35],
    [671.4, 3.16],
  ];
  for (let j = 1; j < tower.length; j++)
    for (let i = 0; i < sides; i++) {
      const ring = ([h, r], k) => {
        const a = (k * Math.PI * 2) / sides;
        return point(x + r * Math.cos(a), h, z + r * Math.sin(a));
      };
      const a = ring(tower[j - 1], i),
        b = ring(tower[j - 1], i + 1),
        c = ring(tower[j], i + 1),
        d = ring(tower[j], i);
      quad(out, j === tower.length - 1 ? 'masonry' : j % 2 ? 'gold' : 'coral', a, b, c, d, [
        a[0] + b[0] - 2 * x,
        0,
        a[2] + b[2] - 2 * z,
      ]);
      if (j === tower.length - 1) face(out, 'deck', [c, d, point(x, 671.4, z)], [0, 1, 0]);
    }
  box(out, 'masonry', left - 23, left - 8, crest, 668.2, -3, 5.8);
  box(out, 'masonry', right + 5, right + 19, crest, 667.2, -2.6, 5.6);
  if (detail.rails)
    for (const z of [-3.6, 6.6]) {
      rod(
        out,
        'gate',
        point(-length / 2, crest + 1, z),
        point(length / 2, crest + 1, z),
        0.17,
        0.15,
      );
      if (detail.joints)
        for (let i = -396; i < length / 2; i += detail.inspection ? 3 : 6)
          rod(out, 'gate', point(i, crest, z), point(i, crest + 1, z), 0.115, 0.115);
    }
}
const levels = {
  skyline: { coarse: true },
  district: {},
  street: { rails: true },
  closeup: { rails: true, joints: true },
  master: { rails: true, joints: true, inspection: true },
};
const abutments = [
  [-403.86, 635],
  [-320, 618],
  [-250, 593],
  [-170, 574],
  [180, 574],
  [260, 596],
  [340, 617],
  [403.86, 633],
];
function baseAt(x) {
  const i = abutments.findIndex(([station]) => station > x);
  if (i < 1) return abutments[i < 0 ? abutments.length - 1 : 0][1];
  const [a, h] = abutments[i - 1],
    [b, k] = abutments[i];
  return h + ((k - h) * (x - a)) / (b - a);
}
export function buildDamLevel(out, level) {
  const detail = levels[level];
  if (!detail) throw Error('Unknown Koyna Dam detail level: ' + level);
  for (const [a, b] of [
    [-length / 2, left],
    [right, length / 2],
  ]) {
    wing(out, a, b, detail);
    const count = Math.ceil((b - a) / 21);
    for (let i = 0; i < count; i++) {
      const l = a + ((b - a) * i) / count,
        r = a + ((b - a) * (i + 1)) / count,
        x = (l + r) / 2,
        base = baseAt(x);
      buttress(out, x, base, 9.3, detail);
    }
  }
  spill(out, detail);
  retainingWalls(out, detail);
  powerStation(out, detail);
  crestFeatures(out, detail);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
