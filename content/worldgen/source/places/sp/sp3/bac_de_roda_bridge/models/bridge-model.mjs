import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const bridgeControls = {
  anchor: [2.192424298, 41.416205273],
  heading: -0.778285933353,
  datum: 19,
  length: 225.984,
  width: 39.46,
  ends: [-112.992, 112.992],
  deck: 27.08,
  body: [
    [-112.992, -13.978],
    [-85.763, 9.966],
    [-18.17, 11],
    [34.391, 11.768],
    [112.992, 12.563],
    [109.25, -7.024],
    [26.426, -11.675],
    [-26.038, -12.368],
  ],
  sides: [
    {
      side: 1,
      inner: [-18.17, 34.391],
      ribZ: 8,
      rise: 10,
      outer: [
        [-30.176, 19.55],
        [45.261, 19.1],
      ],
      bow: [
        [-18.17, 11],
        [-14.546, 13.32],
        [-7.114, 15.591],
        [6.251, 17.031],
        [21.058, 16.424],
        [32.165, 13.493],
        [34.391, 11.768],
      ],
    },
    {
      side: -1,
      inner: [-26.038, 26.426],
      ribZ: -9.2,
      rise: 10,
      outer: [
        [-37.158, -19.4],
        [37.239, -19.4],
      ],
      bow: [
        [-26.038, -12.368],
        [-22.818, -14.369],
        [-14.966, -16.608],
        [0.322, -17.689],
        [14.879, -16.158],
        [23.256, -13.725],
        [26.426, -11.675],
      ],
    },
  ],
  stairs: [
    {
      name: 'southwest-north',
      bottom: [-30.175756, 18.196686],
      top: [-18.578472, 12.737441],
      inner: [-13.487233, 9.29028],
      ground: 19.512751,
      lift: 0.42,
    },
    {
      name: 'southwest-south',
      bottom: [45.261, 18.192],
      top: [32.165, 13.493],
      inner: [29, 10.5],
      ground: 20.781147,
      lift: 0.04,
    },
    {
      name: 'northeast-north',
      bottom: [-37.158, -18.624],
      top: [-22.818, -14.369],
      inner: [-20, -10.8],
      ground: 19.260959,
      lift: 0.04,
    },
    {
      name: 'northeast-south',
      bottom: [37.239, -18.514],
      top: [23.256, -13.725],
      inner: [21, -10.1],
      ground: 20.221221,
      lift: 0.04,
    },
  ],
  supports: [
    {
      x: -68,
      z: 0.04800000000000004,
      ground: [20.794749, 21.28703],
    },
    {
      x: -28,
      z: -0.492,
      ground: [19.202434, 19.262956],
    },
    {
      x: 35,
      z: -1.3425,
      ground: [20.31724, 20.355699],
    },
    {
      x: 72,
      z: -1.842,
      ground: [21.733041, 21.808235],
    },
  ],
  railPaths: [
    [
      [-85.763, 9.966],
      [-18.17, 11],
    ],
    [
      [-14.546, 13.32],
      [-7.114, 15.591],
      [6.251, 17.031],
      [21.058, 16.424],
      [32.165, 13.493],
    ],
    [
      [34.391, 11.768],
      [112.992, 12.563],
    ],
    [
      [-112.992, -13.978],
      [-26.038, -12.368],
    ],
    [
      [-22.818, -14.369],
      [-14.966, -16.608],
      [0.322, -17.689],
      [14.879, -16.158],
      [23.256, -13.725],
    ],
    [
      [26.426, -11.675],
      [48.91851, -10.411928],
      [94.2, -10.435],
    ],
    [
      [98.5, -8.2],
      [109.25, -7.024],
    ],
  ],
  walkAprons: [
    [
      [-89.35799377375216, 8.601722641433675],
      [-89.25903716601684, 8.104234179359057],
      [-88.97723258929467, 7.682483825891163],
      [-88.62639057721356, 7.448058688133935],
      [-86.66497405728175, 9.172843188234816],
      [-87.06326472985161, 9.407982346190618],
      [-87.13875495820965, 9.520961456976186],
      [-87.56050531167755, 9.802766033698347],
      [-88.05799377375216, 9.901722641433675],
      [-88.55548223582677, 9.802766033698347],
      [-88.97723258929467, 9.520961456976186],
      [-89.25903716601684, 9.099211103508292],
    ],
    [
      [48.91850987007061, -10.411928143947426],
      [96.9798244881836, -10.436917694428294],
      [96.98177443645992, -10.43822060821158],
      [97.47926289853453, -10.537177215946908],
      [97.97675136060914, -10.43822060821158],
      [98.39850171407704, -10.15641603148942],
      [98.68030629079921, -9.734665678021525],
      [98.77926289853453, -9.237177215946907],
      [98.68030629079921, -8.73968875387229],
      [98.39850171407704, -8.317938400404396],
      [97.97675136060914, -8.036133823682235],
      [97.47926289853453, -7.937177215946908],
      [96.98177443645992, -8.036133823682235],
      [96.98060117212592, -8.036917773846845],
      [91.26510067462289, -8.033945991045217],
    ],
  ],
  protectedIds: [35184411007460, 35184757572810, 35185182921940, 35185182887430, 35184418889462],
};
export function centerZ(x) {
  return -0.87 - 0.0135 * x;
}
export function deckY(x) {
  if (x < -26) {
    const u = Math.max(0, Math.min(1, (x + 112.992) / 86.992));
    return 4.4 + 3.6 * u * u * (3 - 2 * u);
  }
  if (x > 34) {
    const u = Math.max(0, Math.min(1, (x - 34) / 78.992));
    return 8 - 5 * u * u * (3 - 2 * u);
  }
  return 8 + 0.08 * Math.max(0, 1 - ((x - 4) * (x - 4)) / 900);
}
const srgb = (h) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  steel: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#e1e1d7') },
  dark: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#8d9793') },
  concrete: { slot: 'wall', graph: 'concrete_plain', rgb: srgb('#d1cec1') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#747875') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#c2bdad') },
  paint: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#e6dfcc') },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  C = bridgeControls;
const rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, x, y, z, w, h, d) => rod(o, m, [x, y - h / 2, z], [x, y + h / 2, z], d, w);
function face(o, m, p, n) {
  let N = normalFor(...p);
  if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    N = normalFor(...p);
  }
  o[p.length === 3 ? 'addTriangle' : 'addQuad'](
    m,
    'palette:#ffffff',
    p,
    N,
    undefined,
    palette[m].rgb,
  );
}
function clip(p, F) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      A = F(a),
      B = F(b);
    if (A >= -1e-8) out.push(a);
    if ((A > 1e-8 && B < -1e-8) || (A < -1e-8 && B > 1e-8)) {
      const u = A / (A - B);
      out.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]);
    }
  }
  return out.filter((v, i) => !i || Math.hypot(v[0] - out[i - 1][0], v[1] - out[i - 1][1]) > 1e-7);
}
function cap(o, m, p, Y, up = 1) {
  if (p.length < 3) return;
  const area = Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  if (area < 1e-7) return;
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'wall',
      'palette:#ffffff',
      p,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      palette[m].rgb,
    )
  )
    throw Error('Invalid deck polygon');
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ps = Array.from(mesh.indices.slice(i, i + 3), (j) => {
      const x = mesh.positions[j * 3],
        z = mesh.positions[j * 3 + 2];
      return [x, Y(x, z), z];
    });
    face(o, m, ps, [0, up, 0]);
  }
}
function stations(t) {
  const n = [8, 12, 28, 44, 68][t];
  return [
    ...new Set([
      C.ends[0],
      C.ends[1],
      -26,
      34,
      ...Array.from({ length: n + 1 }, (_, i) => C.ends[0] + (i / n) * C.length),
    ]),
  ].sort((a, b) => a - b);
}
function floor(o, p, t, bow = false) {
  const xs = [...new Set([...stations(t), ...p.map((v) => v[0])])].sort((a, b) => a - b),
    lo = Math.min(...p.map((v) => v[0])),
    hi = Math.max(...p.map((v) => v[0])),
    sign = Math.sign(
      p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
    );
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    if (b <= lo || a >= hi) continue;
    const cell = clip(
      clip(p, (v) => v[0] - a),
      (v) => b - v[0],
    );
    if (cell.length < 3) continue;
    if (bow) cap(o, 'walk', cell, (x) => deckY(x) + 0.12);
    else if (t === 0) cap(o, 'road', cell, (x) => deckY(x));
    else {
      const road = clip(
        clip(cell, ([x, z]) => z - centerZ(x) + 6.2),
        ([x, z]) => centerZ(x) + 6.2 - z,
      );
      cap(o, 'road', road, (x) => deckY(x));
      for (const side of [-1, 1])
        cap(
          o,
          'walk',
          clip(cell, ([x, z]) => side * (z - centerZ(x)) - 6.2),
          (x) => deckY(x) + 0.12,
        );
    }
    if (t > 0 || Math.abs((a + b) / 2) < 45)
      cap(o, 'concrete', cell, (x) => deckY(x) - (bow ? 0.2 : 0.65), -1);
  }
  for (let i = 0; i < p.length; i++) {
    const A = p[i],
      B = p[(i + 1) % p.length],
      n = [sign * (B[1] - A[1]), 0, sign * (A[0] - B[0])],
      nseg = Math.max(1, Math.ceil(Math.abs(B[0] - A[0]) / [28, 19, 8, 5, 3.5][t])),
      cuts = Array.from({ length: nseg + 1 }, (_, j) => j / nseg);
    if (!bow)
      for (const side of [-1, 1]) {
        const a = A[1] - centerZ(A[0]) - side * 6.2,
          b = B[1] - centerZ(B[0]) - side * 6.2;
        if (a * b < 0) cuts.push(a / (a - b));
      }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const u = cuts[j - 1],
        v = cuts[j];
      if (v - u < 1e-7) continue;
      const a = [A[0] + u * (B[0] - A[0]), A[1] + u * (B[1] - A[1])],
        b = [A[0] + v * (B[0] - A[0]), A[1] + v * (B[1] - A[1])],
        h =
          t === 0 && !bow
            ? 0
            : bow || Math.abs((a[1] + b[1]) / 2 - centerZ((a[0] + b[0]) / 2)) > 6.2
              ? 0.12
              : 0;
      face(
        o,
        'concrete',
        [
          [a[0], deckY(a[0]) - (bow ? 0.2 : 0.65), a[1]],
          [b[0], deckY(b[0]) - (bow ? 0.2 : 0.65), b[1]],
          [b[0], deckY(b[0]) + h, b[1]],
          [a[0], deckY(a[0]) + h, a[1]],
        ],
        n,
      );
    }
  }
  if (t > 0 && !bow)
    for (const side of [-1, 1])
      for (let i = 1; i < xs.length; i++) {
        const a = xs[i - 1],
          b = xs[i];
        if (a < lo || b > hi) continue;
        const A = [a, centerZ(a) + side * 6.2],
          B = [b, centerZ(b) + side * 6.2];
        let low = 0,
          high = 1;
        for (let j = 0; j < p.length; j++) {
          const q = p[j],
            r = p[(j + 1) % p.length],
            F = (v) => sign * ((r[0] - q[0]) * (v[1] - q[1]) - (r[1] - q[1]) * (v[0] - q[0])),
            u = F(A),
            v = F(B);
          if (u < 0 && v < 0) {
            low = 2;
            break;
          }
          if (u < 0) low = Math.max(low, u / (u - v));
          if (v < 0) high = Math.min(high, u / (u - v));
        }
        if (low >= high) continue;
        const x = a + low * (b - a),
          X = a + high * (b - a),
          z = centerZ(x) + side * 6.2,
          Z = centerZ(X) + side * 6.2;
        face(
          o,
          'concrete',
          [
            [x, deckY(x), z],
            [X, deckY(X), Z],
            [X, deckY(X) + 0.12, Z],
            [x, deckY(x) + 0.12, z],
          ],
          [0, 0, -side],
        );
      }
}
function rail(o, p, t) {
  const dense = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / [25, 18, 7, 5, 3.5][t]));
    for (let j = 0; j < n; j++) {
      const u = j / n;
      dense.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]);
    }
  }
  dense.push(p.at(-1));
  const heights = t === 0 ? [1.1] : t === 1 ? [0.45, 1.1] : [0.3, 0.55, 0.8, 1.1];
  for (const h of heights) {
    const ps = dense.map(([x, z]) => [x, deckY(x) + 0.12 + h, z]);
    if (t < 2) {
      for (let i = 1; i < ps.length; i++) {
        const a = ps[i - 1],
          b = ps[i];
        for (const sign of [-1, 1])
          face(
            o,
            'steel',
            [
              [a[0], a[1] - 0.025, a[2]],
              [b[0], b[1] - 0.025, b[2]],
              [b[0], b[1] + 0.025, b[2]],
              [a[0], a[1] + 0.025, a[2]],
            ],
            [0, 0, sign],
          );
      }
    } else beamPath(o, 'steel', ps, 0.045, 0.045, palette.steel.rgb);
  }
  if (t === 0) return;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(L / [0, 10, 5, 3.3, 2.5][t]));
    for (let j = 0; j < n; j++) {
      const u = j / n,
        x = a[0] + u * (b[0] - a[0]),
        z = a[1] + u * (b[1] - a[1]);
      rod(o, 'steel', [x, deckY(x) + 0.12, z], [x, deckY(x) + 1.3, z], 0.055, 0.055);
    }
  }
}
export function archPoint(s, outer, u) {
  if (!outer) {
    const x = s.inner[0] + u * (s.inner[1] - s.inner[0]);
    return [x, deckY(x) + s.rise * Math.sin(Math.PI * u), s.ribZ];
  }
  const [a, b] = s.outer,
    x = a[0] + u * (b[0] - a[0]),
    j = s.side > 0 ? 0 : 2,
    low = C.stairs[j].ground - C.datum + 0.1,
    high = C.stairs[j + 1].ground - C.datum + 0.1,
    base = low + u * (high - low),
    crest = 18.08;
  return [
    x,
    base + (crest - (low + high) / 2) * 4 * u * (1 - u),
    a[1] + u * (b[1] - a[1]) + (s.ribZ + s.side * 2.2 - (a[1] + b[1]) / 2) * Math.sin(Math.PI * u),
  ];
}
function rib(o, s, outer, t) {
  const n = [6, 12, 24, 36, 52][t],
    w = outer ? 0.65 : 0.62,
    d = outer ? 0.8 : 0.9,
    th = 0.12;
  let profile =
    t < 2
      ? [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ]
      : [
          [-w / 2, d / 2],
          [w / 2, d / 2],
          [w / 2, d / 2 - th],
          [th / 2, d / 2 - th],
          [th / 2, -d / 2 + th],
          [w / 2, -d / 2 + th],
          [w / 2, -d / 2],
          [-w / 2, -d / 2],
          [-w / 2, -d / 2 + th],
          [-th / 2, -d / 2 + th],
          [-th / 2, d / 2 - th],
          [-w / 2, d / 2 - th],
        ].toReversed();
  const rings = [],
    frames = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n,
      p = archPoint(s, outer, u),
      a = archPoint(s, outer, Math.max(0, u - 0.0001)),
      b = archPoint(s, outer, Math.min(1, u + 0.0001)),
      T = normalize(b.map((v, j) => v - a[j])),
      Z = normalize(cross(T, [0, 1, 0])),
      Y = cross(T, Z);
    frames.push({ p, T, Z, Y });
    rings.push(profile.map(([z, y]) => p.map((v, j) => v + Z[j] * z + Y[j] * y)));
  }
  loft(o, 'steel', rings, palette.steel.rgb, { cap: false });
  for (const index of [0, n]) {
    const f = frames[index],
      b = new MeshBufferBuilder();
    b.addCap(
      'wall',
      'palette:#ffffff',
      profile,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      palette.steel.rgb,
    );
    const m = b.finalize();
    for (let i = 0; i < m.indices.length; i += 3) {
      const ps = Array.from(m.indices.slice(i, i + 3), (k) => {
        const z = m.positions[k * 3],
          y = m.positions[k * 3 + 2];
        return f.p.map((v, j) => v + f.Z[j] * z + f.Y[j] * y);
      });
      face(
        o,
        'steel',
        ps,
        f.T.map((v) => v * (index === 0 ? -1 : 1)),
      );
    }
  }
  if (t === 0) return;
  for (const u of [0, 1]) {
    const p = archPoint(s, outer, u);
    box(o, 'steel', p[0], p[1] + 0.02, p[2], 1.25, 0.25, 1.35);
    if (t > 1)
      for (const x of [-0.4, 0.4])
        for (const z of [-0.43, 0.43])
          box(o, 'dark', p[0] + x, p[1] + 0.18, p[2] + z, 0.11, 0.09, 0.11);
  }
}
function bowZ(s, x) {
  const p = s.bow;
  for (let i = 1; i < p.length; i++)
    if (x <= p[i][0]) {
      const a = p[i - 1],
        b = p[i],
        u = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + u * (b[1] - a[1]);
    }
  return p.at(-1)[1];
}
function cables(o, s, t) {
  if (t === 0) return;
  const n = [0, 6, 16, 24, 30][t];
  for (let i = 1; i < n; i++) {
    const u = i / n,
      x = s.inner[0] + u * (s.inner[1] - s.inner[0]),
      y = deckY(x) + 0.14,
      inner = archPoint(s, false, u),
      U = (x - s.outer[0][0]) / (s.outer[1][0] - s.outer[0][0]),
      outer = archPoint(s, true, U);
    for (const [a, b] of [
      [inner, [x, y, s.ribZ]],
      [outer, [x, y, bowZ(s, x) - s.side * 0.55]],
    ]) {
      const pair = t > 2 ? [-0.065, 0.065] : [0];
      for (const dz of pair) {
        const A = [a[0], a[1] - 0.46, a[2] + dz],
          B = [b[0], b[1], b[2] + dz];
        rod(o, 'steel', A, B, t === 1 ? 0.07 : 0.04);
        if (t > 2) for (const p of [A, B]) box(o, 'steel', p[0], p[1], p[2], 0.14, 0.23, 0.15);
      }
    }
  }
  if (t > 0)
    for (const u of [0.12, 0.28, 0.44, 0.6, 0.76, 0.88]) {
      const A = archPoint(s, false, u),
        U = (A[0] - s.outer[0][0]) / (s.outer[1][0] - s.outer[0][0]),
        B = archPoint(s, true, U);
      rod(o, 'steel', A, B, 0.13, 0.32);
      if (t > 1) {
        const a = archPoint(s, false, Math.min(0.99, u + 0.055));
        rod(o, 'steel', a, B, 0.1, 0.22);
      }
    }
  if (t > 1) {
    const a = s.inner[0],
      b = s.inner[1];
    for (const h of [0.3, 0.55, 0.8])
      rod(o, 'dark', [a, deckY(a) + h, s.ribZ], [b, deckY(b) + h, s.ribZ], 0.018, 0.018);
  }
}
function stairs(o, s, t) {
  const a = s.bottom,
    b = s.top,
    base = s.ground - C.datum + s.lift,
    top = deckY(b[0]) + 0.12,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    N = [-dz / L, dx / L],
    w = 2.65;
  const P = (u, y, side) => [
      a[0] + u * dx + (N[0] * side * w) / 2,
      y,
      a[1] + u * dz + (N[1] * side * w) / 2,
    ],
    n = t < 2 ? 1 : Math.ceil((top - base) / 0.185);
  if (t < 2)
    face(o, 'walk', [P(0, base, -1), P(1, top, -1), P(1, top, 1), P(0, base, 1)], [0, 1, 0]);
  else
    for (let i = 0; i < n; i++) {
      const u = i / n,
        v = (i + 1) / n,
        y = base + ((top - base) * (i + 1)) / n,
        low = base + ((top - base) * i) / n;
      face(o, 'walk', [P(u, y, -1), P(v, y, -1), P(v, y, 1), P(u, y, 1)], [0, 1, 0]);
      face(o, 'concrete', [P(u, low, -1), P(u, low, 1), P(u, y, 1), P(u, y, -1)], [-dx, 0, -dz]);
      for (const side of [-1, 1])
        face(
          o,
          'concrete',
          [
            P(u, low - 0.28, side),
            P(v, base + (top - base) * v - 0.28, side),
            P(v, y, side),
            P(u, y, side),
          ],
          [N[0] * side, 0, N[1] * side],
        );
    }
  face(
    o,
    'concrete',
    [P(0, base - 0.28, 1), P(1, top - 0.28, 1), P(1, top - 0.28, -1), P(0, base - 0.28, -1)],
    [0, -1, 0],
  );
  for (const side of [-1, 1]) {
    if (t < 2)
      face(
        o,
        'concrete',
        [P(0, base - 0.28, side), P(1, top - 0.28, side), P(1, top, side), P(0, base, side)],
        [N[0] * side, 0, N[1] * side],
      );
    if (t > 0) {
      for (const h of t === 1 ? [1.1] : [0.3, 0.55, 0.8, 1.1])
        rod(o, 'steel', P(0, base + h, side), P(1, top + h, side), 0.045, 0.045);
      const m = Math.ceil(L / [1, 5, 3, 2.4, 1.8][t]);
      for (let i = 0; i <= m; i++) {
        const u = i / m;
        rod(
          o,
          'steel',
          P(u, base + u * (top - base), side),
          P(u, base + u * (top - base) + 1.12, side),
          0.055,
          0.055,
        );
      }
    }
  }
  // Short top landing joins the broad existing bridge walk; bottom pad overlaps
  // native path paving at its normal surface lift without flattening the field.
  const B = s.inner,
    dX = B[0] - b[0],
    dZ = B[1] - b[1],
    ll = Math.hypot(dX, dZ),
    nx = ((-dZ / ll) * w) / 2,
    nz = ((dX / ll) * w) / 2,
    poly = [
      [b[0] + nx, b[1] + nz],
      [B[0] + nx, B[1] + nz],
      [B[0] - nx, B[1] - nz],
      [b[0] - nx, b[1] - nz],
    ];
  plate(o, poly, top, 0.22);
  const pad = [P(-0.08, base, -1), P(0.015, base, -1), P(0.015, base, 1), P(-0.08, base, 1)].map(
    (p) => [p[0], p[2]],
  );
  plate(o, pad, base, 0.28);
}
function plate(o, p, y, d) {
  cap(o, 'walk', p, () => y);
  cap(o, 'concrete', p, () => y - d, -1);
  const sign = Math.sign(
    p.reduce((v, a, i) => {
      const b = p[(i + 1) % p.length];
      return v + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      'concrete',
      [
        [a[0], y - d, a[1]],
        [b[0], y - d, b[1]],
        [b[0], y, b[1]],
        [a[0], y, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
}
function supports(o, t) {
  for (const s of C.supports) {
    const y = deckY(s.x) - 0.65;
    for (const [j, dz] of [-4.5, 4.5].entries()) {
      const low = s.ground[j] - C.datum - 0.25;
      if (y > low + 0.1)
        box(o, 'concrete', s.x, (y + low) / 2, s.z + dz, t === 0 ? 1.1 : 1.45, y - low, 1.65);
    }
    if (t > 0) box(o, 'concrete', s.x, y - 0.15, s.z, 2.1, 0.5, 15);
  }
  for (const s of C.sides)
    for (const u of [0, 1]) {
      const foot = archPoint(s, true, u),
        direction = u === 0 ? -1 : 1,
        x = foot[0] + direction * 18,
        z = s.side > 0 ? 11.1 : -11.8,
        head = [x, deckY(x) - 0.42, z];
      const T = normalize(head.map((v, i) => v - foot[i])),
        Z = normalize(cross(T, [0, 1, 0])),
        Y = cross(T, Z),
        ring = (p, w, d) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([a, b]) => p.map((v, i) => v + (Z[i] * a * w) / 2 + (Y[i] * b * d) / 2));
      loft(
        o,
        'concrete',
        [ring(foot, t === 0 ? 1.1 : 1.65, 1.45), ring(head, 1.15, 0.72)],
        palette.concrete.rgb,
      );
    }
  if (t > 0)
    for (const s of C.stairs) {
      const p = s.bottom;
      box(o, 'concrete', p[0], s.ground - C.datum + s.lift - 0.5, p[1], 3.7, 0.44, 3.4);
    }
  if (t > 1) {
    for (let x = -24; x <= 32; x += 4.0)
      rod(o, 'concrete', [x, deckY(x) - 0.42, -10.8], [x, deckY(x) - 0.42, 10.8], 0.3, 0.37);
    for (const z of [-6, 0, 6])
      rod(o, 'concrete', [-26, deckY(-26) - 0.55, z], [34, deckY(34) - 0.55, z], 0.3, 0.42);
  }
}
export function buildBridgeLevel(o, level = 'master') {
  const t = levels[level];
  if (t === undefined) throw Error(level);
  floor(o, C.body, t);
  for (const p of C.walkAprons) floor(o, p, t, true);
  for (const s of C.sides) {
    floor(o, s.bow, t, true);
    rib(o, s, false, t);
    rib(o, s, true, t);
    cables(o, s, t);
  }
  for (const p of C.railPaths) rail(o, p, t);
  for (const s of C.stairs) stairs(o, s, t);
  supports(o, t);
  if (t > 1)
    for (let x = -104; x < 106; x += 9) {
      const b = x + 4;
      for (const z of [-3.2, 3.2])
        face(
          o,
          'paint',
          [
            [x, deckY(x) + 0.008, centerZ(x) + z - 0.045],
            [b, deckY(b) + 0.008, centerZ(b) + z - 0.045],
            [b, deckY(b) + 0.008, centerZ(b) + z + 0.045],
            [x, deckY(x) + 0.008, centerZ(x) + z + 0.045],
          ],
          [0, 1, 0],
        );
    }
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
