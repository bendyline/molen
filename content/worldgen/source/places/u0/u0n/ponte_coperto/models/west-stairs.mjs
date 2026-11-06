import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const stairControls = {
  id: 'ponte_coperto_west_stairs',
  anchor: [9.152782112359999, 45.17991462946582],
  heading: 2.796037072367975,
  length: 5.592134958980193,
  ends: [-2.7960674794900964, 2.7960674794900964],
  top: {
    geo: [9.152815639972687, 45.179906121570355],
    local: [-86.38226693217993, -5.358321081496687],
  },
  bottom: {
    geo: [9.152748584747314, 45.17992313736005],
    local: [-86.0230821059685, -10.93890883370235],
  },
  centerInBridge: [-86.20267452001741, -8.148614957508755],
  angleToBridge: 1.5065217232131247,
  modelDatum: 53,
  nativeLift: 0.43,
  source: 'https://build.protomaps.com/20261031.pmtiles',
  featureId: 35184802812094,
  scope:
    'Short mapped bank steps and landing outside the covered bridge; three return flights fit the standard terrain height difference inside this compact landing area.',
  halfWidth: 1.8,
  topHeight: 7.650562722850096,
  bottomHeight: 0.7472329357789604,
  foundationY: -0.2,
  topGradient: 0.12259194395796147,
};
const lin = (h) =>
    [1, 3, 5].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    stair_stone: { slot: 'trim', graph: 'stone_granite', rgb: lin('#c9c4ae') },
    stair_step: { slot: 'foundation', graph: 'concrete_plain', rgb: lin('#aaa89a') },
    stair_rail: { slot: 'trim', graph: 'metal_painted', rgb: lin('#74816f') },
  };
export const stairSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...m }]) => [k, m]),
);
export function buildStairLevel(o, level = 'master') {
  const C = stairControls,
    t = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 }[level],
    warp = ([x, y, z]) => {
      const u = Math.max(0, Math.min(1, (x - C.ends[0]) / C.length));
      return [
        x,
        y +
          (1 - u) *
            C.topGradient *
            (Math.cos(C.angleToBridge) * (x - C.ends[0]) + Math.sin(C.angleToBridge) * z),
        z,
      ];
    },
    emit = (m, p, n) => {
      let N = normalFor(...p);
      if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
        p = p.toReversed();
        N = normalFor(...p);
      }
      if (
        p.length === 4 &&
        Math.abs(p[3].reduce((s, v, i) => s + (v - p[0][i]) * N[i], 0)) > 1e-7
      ) {
        emit(m, [p[0], p[1], p[2]], n);
        emit(m, [p[0], p[2], p[3]], n);
        return;
      }
      o[p.length === 3 ? 'addTriangle' : 'addQuad'](
        m,
        'palette:#fff',
        p,
        N,
        undefined,
        palette[m].rgb,
      );
    },
    face = (m, p, n) => emit(m, p.map(warp), n),
    rod = (a, b, w = 0.07) => beam(o, 'stair_rail', warp(a), warp(b), w, w, palette.stair_rail.rgb),
    box = (m, x0, x1, z0, z1, y0, y1) => {
      const a = [x0, y0, z0],
        b = [x1, y0, z0],
        c = [x1, y0, z1],
        d = [x0, y0, z1],
        A = [x0, y1, z0],
        B = [x1, y1, z0],
        D = [x0, y1, z1],
        E = [x1, y1, z1];
      for (const [p, n] of [
        [
          [a, b, c, d],
          [0, -1, 0],
        ],
        [
          [A, D, E, B],
          [0, 1, 0],
        ],
        [
          [a, A, B, b],
          [0, 0, -1],
        ],
        [
          [d, c, E, D],
          [0, 0, 1],
        ],
        [
          [a, d, D, A],
          [-1, 0, 0],
        ],
        [
          [b, B, E, c],
          [1, 0, 0],
        ],
      ])
        face(m, p, n);
    };
  const L = C.length,
    top = C.topHeight,
    bottom = C.bottomHeight,
    drop = (top - bottom) / 3,
    x0 = -L / 2 + 0.65,
    x1 = L / 2 - 0.65,
    centers = [-1.2, 0, 1.2],
    n = t === 0 ? 1 : t === 1 ? Math.ceil(drop / 0.4) : Math.ceil(drop / 0.18),
    flights = [];
  for (let j = 0; j < 3; j++) {
    const a = j === 1 ? x1 : x0,
      b = j === 1 ? x0 : x1,
      z = centers[j],
      Y = top - j * drop;
    flights.push({ a, b, z, top: Y, bottom: Y - drop });
    if (t === 0) {
      const A = [a, Y, z - 0.55],
        B = [a, Y, z + 0.55],
        D = [b, Y - drop, z - 0.55],
        E = [b, Y - drop, z + 0.55];
      face('stair_step', [A, B, E, D], [0, 1, 0]);
      face(
        'stair_stone',
        [
          [a, Y - 0.18, z - 0.55],
          [b, Y - drop - 0.18, z - 0.55],
          [b, Y - drop, z - 0.55],
          [a, Y, z - 0.55],
        ],
        [0, 0, -1],
      );
      face(
        'stair_stone',
        [
          [a, Y - 0.18, z + 0.55],
          [a, Y, z + 0.55],
          [b, Y - drop, z + 0.55],
          [b, Y - drop - 0.18, z + 0.55],
        ],
        [0, 0, 1],
      );
    } else
      for (let i = 0; i < n; i++) {
        const X = a + ((b - a) * i) / n,
          Z = a + ((b - a) * (i + 1)) / n,
          H = Y - (i / n) * drop;
        box(
          'stair_step',
          Math.min(X, Z),
          Math.max(X, Z),
          z - 0.55,
          z + 0.55,
          H - drop / n - 0.16,
          H,
        );
      }
    for (const side of [-1, 1]) {
      const Z = z + side * 0.55;
      rod([a, Y + 0.95, Z], [b, Y - drop + 0.95, Z], t === 0 ? 0.11 : 0.065);
      if (t > 0) {
        rod([a, Y, Z], [a, Y + 1.0, Z]);
        rod([b, Y - drop, Z], [b, Y - drop + 1, Z]);
        if (t > 1)
          for (let i = 1; i < 4; i++) {
            const u = i / 4,
              X = a + u * (b - a),
              H = Y - u * drop;
            rod([X, H, Z], [X, H + 0.95, Z]);
          }
      }
    }
  }
  const landing = (a, b, z0, z1, y) => box('stair_step', a, b, z0, z1, y - 0.2, y);
  landing(-L / 2 - 0.35, x0, -1.8, 1.8, top);
  landing(x1, L / 2 + 0.35, -1.8, 1.8, bottom);
  landing(x1, L / 2, -1.8, 0.6, top - drop);
  landing(-L / 2, x0, -0.6, 1.8, top - 2 * drop);
  for (const [x, z, y] of [
    [x0, -1.75, top - 0.2],
    [x1, -1.75, top - drop - 0.2],
    [x0, 1.75, top - 2 * drop - 0.2],
    [x1, 1.75, bottom - 0.2],
  ])
    if (y > C.foundationY + 0.05)
      box('stair_stone', x - 0.12, x + 0.12, z - 0.12, z + 0.12, C.foundationY, y);
  if (t > 0)
    for (const [x, z, y] of [
      [-L / 2, -1.8, top],
      [-L / 2, 1.8, top],
      [L / 2, -1.8, bottom],
      [L / 2, 1.8, bottom],
    ])
      rod([x, y, z], [x, y + 1, z]);
}
export const buildStairSkyline = (o) => buildStairLevel(o, 'skyline');
export const buildStairDistrict = (o) => buildStairLevel(o, 'district');
export const buildStairStreet = (o) => buildStairLevel(o, 'street');
export const buildStairCloseup = (o) => buildStairLevel(o, 'closeup');
