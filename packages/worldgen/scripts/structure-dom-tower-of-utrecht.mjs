/** Utrecht Dom Tower: two square stages, open octagonal lantern and deep pointed ground passage. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, c) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, c);
}
function transform(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'gold') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function rod(o, d, slot, a, b, w, col, n) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else strip(o, slot, a, b, w, col, n);
}
function flat(o, slot, ps, col, n = [0, 0, 1], holes = []) {
  const p = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    idx = earcut(
      p.flatMap((v) => [v[0], v[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => p[j]);
    if (normalFor(...q).reduce((s, v, k) => s + v * n[k], 0) < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      n,
      q.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
function panel(o, slot, ps, z0, z1, col) {
  flat(
    o,
    slot,
    ps.map((p) => [...p, z1]),
    col,
  );
  flat(
    o,
    slot,
    ps.map((p) => [...p, z0]),
    col,
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      q = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, slot, q, normalFor(...q), col);
  }
}
function line(o, d, ps, z, col = pale, w = 0.06, slot = 'metal', closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length];
    rod(
      o,
      ['trim', 'wall'].includes(slot) ? 0 : d === 3 ? 3 : 0,
      slot,
      [...a, z],
      [...b, z],
      w,
      col,
    );
  }
}
const root = new URL(
    '../../../content/worldgen/source/places/u1/u17/dom_tower_of_utrecht/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  stone = rgb('b7b3a2'),
  pale = rgb('d4cdbc'),
  shade = rgb('9d998d'),
  brick = rgb('917d66'),
  brickshade = rgb('796e5d'),
  dark = rgb('2c3431'),
  glass = rgb('47534d'),
  slate = rgb('777f7c'),
  iron = rgb('414d45'),
  green = rgb('648a70'),
  gold = rgb('c3a95e'),
  lead = rgb('a5aaa0');
const W = 19.5,
  D = 19.5,
  MW = 16.8,
  MD = 16.6;
function sample(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    terrain.modelDatumElevationMeters
  );
}
if (
  frame.features.flatMap((f) => f.rings.flat()).some((p) => sample(...p) > 1 || sample(...p) < -4)
)
  throw Error('Native terrain exceeds tower footing');
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function ellipse(x, y, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * Math.PI * 2) / n),
    y + ry * Math.sin((i * Math.PI * 2) / n),
  ]);
}
function pointed(x, y, w, h, n = 6) {
  const r = w / 2,
    spring = y + h - w * 0.85;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [x + r * (1 - t), spring + (h + y - spring) * Math.sin((t * Math.PI) / 2)];
    }),
    ...Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n;
      return [x - r * t, y + h - (h + y - spring) * (1 - Math.cos((t * Math.PI) / 2))];
    }),
  ];
}
function surface(o, slot, p, z, col) {
  flat(
    o,
    slot,
    p.map((v) => [...v, z]),
    col,
  );
}
function wall(o, p, z, holes, depth = 0.6, col = stone) {
  for (const [zz, n] of [
    [z, [0, 0, 1]],
    [z - depth, [0, 0, -1]],
  ])
    flat(
      o,
      'wall',
      p.map((v) => [...v, zz]),
      col,
      n,
      holes.map((h) => h.map((v) => [...v, zz])),
    );
  for (const h of holes)
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length],
        p = [
          [...a, z],
          [...b, z],
          [...b, z - depth],
          [...a, z - depth],
        ];
      quad(o, 'trim', p, normalFor(...p), shade);
    }
}
function ring(
  o,
  d,
  x,
  y,
  z,
  r,
  w,
  col = pale,
  slot = 'trim',
  n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : 32,
) {
  line(o, slot === 'gold' ? d : 0, ellipse(x, y, r, r, n), z, col, w, slot, true);
}
function round(o, x, z, ys, n = 8, col = pale, slot = 'trim') {
  loft(
    o,
    slot,
    ys.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8)),
    col,
  );
}
function pinnacle(o, d, x, y, z, h = 3) {
  if (d < 3) {
    loft(
      o,
      'trim',
      [
        [
          [x - h * 0.12, y, z - h * 0.12],
          [x - h * 0.12, y, z + h * 0.12],
          [x + h * 0.12, y, z + h * 0.12],
          [x + h * 0.12, y, z - h * 0.12],
        ],
        [
          [x - h * 0.015, y + h, z - h * 0.015],
          [x - h * 0.015, y + h, z + h * 0.015],
          [x + h * 0.015, y + h, z + h * 0.015],
          [x + h * 0.015, y + h, z - h * 0.015],
        ],
      ],
      pale,
    );
    return;
  }
  round(
    o,
    x,
    z,
    [
      [y, 0.25],
      [y + 0.2, 0.34],
      [y + 0.4, 0.24],
      [y + h * 0.7, 0.08],
      [y + h * 0.78, 0.14],
      [y + h, 0.04],
    ],
    4,
    pale,
  );
  for (let j = 1; j < (d > 2 ? 5 : 3); j++)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const yy = y + h * (0.15 + j * 0.14),
        r = 0.24 - j * 0.025;
      rod(
        o,
        0,
        'trim',
        [x + Math.sin(a) * r, yy, z + Math.cos(a) * r],
        [x + Math.sin(a) * (r + 0.13), yy + 0.1, z + Math.cos(a) * (r + 0.13)],
        0.09,
        pale,
      );
    }
}
function tracery(o, d, x, y, z, w, h, { blind = false, col = pale } = {}) {
  if (d === 0) return;
  const p = pointed(x, y, w, h, d > 2 ? 9 : d > 1 ? 5 : 2);
  line(o, 0, p, z + 0.03, col, d === 1 ? 0.13 : 0.12, 'trim', true);
  if (d === 1) return;
  if (d > 2)
    line(
      o,
      0,
      pointed(x, y - 0.05, w + 0.25, h + 0.25, d > 2 ? 9 : 4),
      z + 0.05,
      col,
      0.08,
      'trim',
      true,
    );
  for (const sign of [-1, 1]) {
    const xx = x + (sign * w) / 6;
    B(o, 'trim', xx, y, z - 0.12, 0.1, h - w * 0.7, 0.3, col);
  }
  const yy = y + h - w * 0.72;
  if (d > 2)
    for (const sign of [-1, 1])
      line(
        o,
        0,
        pointed(x + sign * w * 0.25, y, w * 0.47, h - w * 0.45, d > 2 ? 7 : 3),
        z - 0.09,
        col,
        0.075,
        'trim',
      );
  if (d > 2) {
    ring(o, 0, x, yy, z - 0.04, w * 0.16, 0.065, col, 'trim', 20);
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3])
      ring(
        o,
        0,
        x + Math.sin(a) * w * 0.1,
        yy + Math.cos(a) * w * 0.1,
        z - 0.02,
        w * 0.105,
        0.055,
        col,
        'trim',
        16,
      );
  }
  if (blind && d > 2) {
    for (let j = 0; j < 4; j++)
      B(o, 'trim', x, y + 1 + (j * (h - w * 1.2)) / 4, z - 0.1, w * 0.85, 0.055, 0.08, shade);
  }
}
function niche(o, d, x, y, z, w, h, { col = brickshade, glazed = false } = {}) {
  const p = pointed(x, y, w, h, d > 2 ? 8 : d > 1 ? 4 : 2);
  surface(o, glazed ? 'glass' : 'masonry', p, z - (d > 1 ? 0.48 : -0.015), glazed ? glass : col);
  if (!(d === 1 && !glazed)) tracery(o, d, x, y, z, w, h, { blind: !glazed });
  if (glazed && d > 1) {
    for (const sign of [-1, 1])
      B(o, 'wood', x + sign * w * 0.17, y, z - 0.23, 0.08, h - w * 0.75, 0.12, shade);
    for (let j = 1; j < 4; j++)
      B(o, 'wood', x, y + (j * (h - w * 0.7)) / 4, z - 0.23, w * 0.92, 0.08, 0.12, shade);
  }
}
function floor(o, d) {
  const nx = d === 0 ? 2 : d === 1 ? 5 : 10,
    nz = d < 2 ? 1 : 3;
  for (let ix = 0; ix < nx; ix++)
    for (let iz = 0; iz < nz; iz++) {
      const x0 = -10.1 + (ix * 20.2) / nx,
        x1 = -10.1 + ((ix + 1) * 20.2) / nx,
        z0 = -3.02 + (iz * 6.04) / nz,
        z1 = -3.02 + ((iz + 1) * 6.04) / nz,
        p = [
          [x0, sample(x0, z0) + 0.06, z0],
          [x1, sample(x1, z0) + 0.06, z0],
          [x1, sample(x1, z1) + 0.06, z1],
          [x0, sample(x0, z1) + 0.06, z1],
        ];
      quad(o, 'trim', p, [0, 1, 0], stone);
    }
}
function portalVault(o, d) {
  const n = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 8 : 16,
    stations =
      d === 0
        ? [
            [-9.75, 7.2, 11.8],
            [-8.5, 6, 10.6],
            [8.5, 6, 10.6],
            [9.75, 7.2, 11.8],
          ]
        : d === 1
          ? [
              [-9.75, 7.2, 11.8],
              [-9.15, 6.7, 11.3],
              [-8.5, 6, 10.6],
              [8.5, 6, 10.6],
              [9.15, 6.7, 11.3],
              [9.75, 7.2, 11.8],
            ]
          : [
              [-9.75, 7.2, 11.8],
              [-9.4, 6.95, 11.55],
              [-8.95, 6.55, 11.05],
              [-8.5, 6, 10.6],
              [8.5, 6, 10.6],
              [8.95, 6.55, 11.05],
              [9.4, 6.95, 11.55],
              [9.75, 7.2, 11.8],
            ],
    profiles = stations.map(([x, w, top]) => ({ x, p: pointed(0, -3.4, w, top + 3.4, n) }));
  for (let k = 1; k < profiles.length; k++) {
    const a = profiles[k - 1],
      b = profiles[k];
    for (let j = 1; j < a.p.length; j++) {
      const l = (j + 1) % a.p.length,
        aa = a.p[j],
        ab = a.p[l],
        ba = b.p[j],
        bb = b.p[l],
        q = [
          [a.x, aa[1], aa[0]],
          [b.x, ba[1], ba[0]],
          [b.x, bb[1], bb[0]],
          [a.x, ab[1], ab[0]],
        ],
        cy = (aa[1] + ab[1] + ba[1] + bb[1]) / 4,
        cz = (aa[0] + ab[0] + ba[0] + bb[0]) / 4;
      quad(o, 'wall', q, [0, 3 - cy, -cz], shade);
    }
  }
  if (d > 1)
    for (const xx of d === 2 ? [-9.25, 0, 9.25] : [-9.55, -9.2, -8.8, 0, 8.8, 9.2, 9.55]) {
      const t = Math.max(0, (Math.abs(xx) - 8.5) / 1.25),
        w = 6 + t * 1.2,
        top = 10.6 + t * 1.2,
        q = transform(o, Math.PI / 2, xx, 0),
        p = pointed(0, -3.1, w - 0.22, top + 3.1 - 0.16, d > 2 ? 16 : 4);
      for (let j = 1; j < p.length; j++) {
        const a = p[j],
          b = p[(j + 1) % p.length];
        beam(q, 'trim', [...a, 0.02], [...b, 0.02], xx === 0 ? 0.16 : 0.13, 0.15, pale);
      }
    }
  floor(o, d);
}
function lower(o, d) {
  const portal = pointed(0, -3.4, 7.2, 15.2, d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 8 : 16);
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2,
      q = transform(o, a),
      w = f % 2 ? D : W,
      z = f % 2 ? W / 2 : D / 2,
      upper = [
        [-7.8, 1.6],
        [-4.9, 2.6],
        [0, 4.0],
        [4.9, 2.6],
        [7.8, 1.6],
      ],
      bottom = [
        [-7.8, 1.5],
        [-4.9, 2.4],
        [0, 3.9],
        [4.9, 2.4],
        [7.8, 1.5],
      ],
      holes = f % 2 ? [portal] : [];
    if (d > 1) {
      for (const [x, ww] of upper) holes.push(pointed(x, 22.5, ww, 14.3, d > 2 ? 8 : 4));
      for (const [x, ww] of bottom)
        if (!(f % 2 && x === 0)) holes.push(pointed(x, 1.5, ww, 16.8, d > 2 ? 8 : 4));
    }
    wall(q, rect(0, -4, w, 42.6), z, holes, d === 0 ? 0.6 : 0.75, stone);
    if (d > 0) {
      for (const [x, ww] of upper) niche(q, d, x, 22.5, z, ww, 14.3, { glazed: x === 0 });
      for (const [x, ww] of bottom) if (!(f % 2 && x === 0)) niche(q, d, x, 1.5, z, ww, 16.8);
      for (const yy of [1.2, 20, 21.2, 37.6, 38.35]) {
        if (f % 2 && yy < 12) {
          for (const sign of [-1, 1])
            B(q, 'trim', (sign * (w + 7.4)) / 4, yy, z + 0.055, (w - 7.4) / 2, 0.15, 0.25, pale);
        } else B(q, 'trim', 0, yy, z + 0.055, w + 0.1, 0.15, 0.25, pale);
      }
      if (f % 2) {
        for (let k = 0; k < (d > 2 ? 4 : d > 1 ? 2 : 1); k++)
          line(
            q,
            0,
            pointed(0, -3.4, 7.3 + k * 0.15, 15.35 + k * 0.14, d > 2 ? 16 : 7),
            z + 0.055 + k * 0.05,
            pale,
            0.13,
            'trim',
            true,
          );
      }
    }
    if (d > 1) {
      for (const x of [-w / 2 + 0.17, w / 2 - 0.17])
        for (let j = 0; j < 26; j++)
          d === 2
            ? surface(q, 'trim', rect(x, -2 + j * 1.5, j % 2 ? 0.48 : 0.28, 0.5), z + 0.03, pale)
            : B(q, 'trim', x, -2 + j * 1.5, z + 0.03, j % 2 ? 0.48 : 0.28, 0.5, 0.2, pale);
      for (let row = 0; row < (d > 2 ? 28 : 8); row++) {
        const y = 1.5 + (row * 36) / (d > 2 ? 28 : 8);
        for (const x of [-w * 0.35, 0, w * 0.35]) {
          if (f % 2 && y < 11 && Math.abs(x) < 3.3) continue;
          surface(q, 'wall', rect(x + (row % 2 ? 0.15 : -0.15), y, 0.9, 0.025), z + 0.005, shade);
        }
      }
    }
  }
  // The upper slab closes the square stage; the low passage is a true continuous vault.
  B(o, 'wall', 0, 37.8, 0, W, 0.8, D, stone);
  portalVault(o, d);
}
function clock(o, d, z) {
  const y = 50.1,
    r = 1.95;
  line(o, 0, rect(0, y - 2.35, 4.7, 4.7), z, green, 0.1, 'metal', true);
  ring(o, 0, 0, y, z + 0.03, r, 0.09, gold, 'gold', d === 0 ? 8 : d === 1 ? 16 : d === 2 ? 16 : 48);
  if (d > 1) {
    for (const x of [-1.9, 1.9])
      for (const yy of [y - 1.9, y + 1.9])
        ring(o, 0, x, yy, z + 0.035, 0.34, 0.06, green, 'metal', d > 2 ? 16 : 8);
    ring(o, 0, 0, y, z + 0.04, 1.52, 0.055, gold, 'gold', d > 2 ? 32 : 16);
  }
  const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    if (d === 0 || (d === 1 && i % 2)) continue;
    const a = (i * Math.PI) / 6,
      sa = Math.sin(a),
      ca = Math.cos(a),
      t = (p) => [sa * r * 0.88 + ca * p[0] + sa * p[1], y + ca * r * 0.88 - sa * p[0] + ca * p[1]],
      stroke = (a, b) => line(o, d > 2 ? 3 : 0, [t(a), t(b)], z + 0.07, gold, 0.04, 'gold');
    if (d < 2) {
      stroke([0, -0.14], [0, 0.14]);
      continue;
    }
    const str = romans[i];
    for (let j = 0; j < str.length; j++) {
      const x = (j - (str.length - 1) / 2) * 0.14,
        hh = 0.16;
      if (str[j] === 'I') stroke([x, -hh], [x, hh]);
      else if (str[j] === 'V') {
        stroke([x - 0.06, hh], [x, -hh]);
        stroke([x, -hh], [x + 0.06, hh]);
      } else {
        stroke([x - 0.065, -hh], [x + 0.065, hh]);
        stroke([x + 0.065, -hh], [x - 0.065, hh]);
      }
    }
  }
  for (const [a, l, w] of [
    [0.2 * Math.PI, 1.72, 0.1],
    [-0.34 * Math.PI, 1.33, 0.13],
  ]) {
    const p = [Math.sin(a) * l, y + Math.cos(a) * l];
    line(o, d > 2 ? 3 : 0, [[0, y], p], z + 0.11, gold, w, 'gold');
    if (d > 1) {
      ring(o, 0, p[0], p[1], z + 0.12, 0.1, 0.04, gold, 'gold', 8);
      line(
        o,
        0,
        [
          [-Math.sin(a) * 0.35, y - Math.cos(a) * 0.35],
          [0, y],
        ],
        z + 0.11,
        gold,
        0.14,
        'gold',
      );
    }
  }
}
function second(o, d) {
  for (let f = 0; f < 4; f++) {
    const q = transform(o, (f * Math.PI) / 2),
      w = f % 2 ? MD : MW,
      z = f % 2 ? MW / 2 : MD / 2,
      opening = pointed(0, 39.1, 4.45, 26.8, d === 0 ? 1 : d === 1 ? 3 : d === 2 ? 3 : 12),
      holes = [opening];
    if (d > 1) for (const x of [-5.1, 5.1]) holes.push(pointed(x, 39.5, 3.1, 26.1, d > 2 ? 8 : 3));
    wall(q, rect(0, 38.6, w, 29.48), z, holes, d === 0 ? 0.55 : 0.7, brick);
    if (d > 0) {
      tracery(q, d, 0, 39.1, z, 4.45, 26.8);
      for (const x of [-5.1, 5.1]) niche(q, d, x, 39.5, z, 3.1, 26.1, { col: brickshade });
      for (const x of [-0.74, 0.74]) B(q, 'trim', x, 39.1, z - 0.12, 0.12, 23.5, 0.55, pale);
      const rows = d === 1 ? 4 : d === 2 ? 7 : 11;
      for (let j = 0; j < rows; j++) {
        const y = 39.7 + (j * 8.2) / rows,
          p = [
            [-2.08, y + 0.45, z + 0.01],
            [2.08, y + 0.45, z + 0.01],
            [2.08, y - 0.06, z - 0.62],
            [-2.08, y - 0.06, z - 0.62],
          ];
        quad(q, 'wood', p, [0, 1, 1], shade);
      }
      for (let j = 0; j < (d === 1 ? 5 : 12); j++)
        d === 2
          ? surface(q, 'metal', rect(0, 49 + j * 1.3, 4.2, 0.035), z - 0.28, iron)
          : B(q, 'metal', 0, 49 + j * 1.3, z - 0.28, 4.2, 0.035, 0.04, iron);
      if (d > 1)
        for (const x of [-5.1, 5.1]) surface(q, 'glass', rect(x, 50.0, 2.3, 1.2), z - 0.44, dark);
    }
    clock(q, d, z + 0.33);
    if (d > 0) {
      for (const x of [-w / 2 + 0.17, w / 2 - 0.17])
        B(q, 'trim', x, 38.6, z + 0.04, 0.22, 29.2, 0.19, pale);
      if (d > 1)
        for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
          for (let j = 0; j < 23; j++)
            d === 2
              ? surface(
                  q,
                  'trim',
                  rect(x, 39 + j * 1.25, j % 2 ? 0.48 : 0.28, 0.48),
                  z + 0.075,
                  pale,
                )
              : B(q, 'trim', x, 39 + j * 1.25, z + 0.075, j % 2 ? 0.48 : 0.28, 0.48, 0.2, pale);
    }
  }
  B(o, 'wall', 0, 67.5, 0, MW, 0.58, MD, stone);
}
function railFace(o, d, w, z, y, n) {
  if (d === 0) {
    surface(o, 'trim', rect(0, y, w, 0.2), z, pale);
    surface(o, 'trim', rect(0, y + 2.6, w, 0.18), z, pale);
  } else {
    B(o, 'trim', 0, y, z, w, 0.2, 0.35, pale);
    B(o, 'trim', 0, y + 2.6, z, w, 0.18, 0.32, pale);
  }
  if (d === 0) {
    for (let j = 0; j <= n; j++) {
      const x = -w / 2 + (j * w) / n;
      surface(o, 'trim', rect(x, y + 0.2, 0.12, 2.4), z + 0.01, pale);
    }
    return;
  }
  for (let j = 0; j <= n; j++) {
    const x = -w / 2 + (j * w) / n;
    if (d === 1) surface(o, 'trim', rect(x, y + 0.2, 0.14, 2.4), z + 0.01, pale);
    else B(o, 'trim', x, y + 0.2, z, 0.14, 2.4, 0.32, pale);
  }
  if (d > 1)
    for (let j = 0; j < n; j++) {
      const x = -w / 2 + ((j + 0.5) * w) / n,
        bw = w / n - 0.14;
      line(o, 0, pointed(x, y + 0.2, bw, 2.3, d > 2 ? 7 : 3), z + 0.04, pale, 0.085, 'trim');
      if (d > 2) {
        ring(o, 0, x, y + 2.1, z + 0.055, 0.2, 0.06, pale, 'trim', 16);
        for (const sign of [-1, 1])
          line(
            o,
            0,
            [
              [x + sign * bw * 0.3, y + 2.4],
              [x, y + 2.65],
            ],
            z + 0.05,
            pale,
            0.06,
            'trim',
          );
      }
    }
}
function galleries(o, d) {
  for (const [y, w, dep] of [
    [38.6, 20.3, 20.3],
    [68.08, 17.5, 17.3],
  ]) {
    B(o, 'trim', 0, y - 0.36, 0, w, 0.2, dep, pale);
    B(o, 'trim', 0, y - 0.16, 0, w + 0.2, 0.16, dep + 0.2, pale);
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        ww = f % 2 ? dep : w,
        zz = f % 2 ? w / 2 : dep / 2;
      railFace(q, d, ww, zz, y, d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 12);
      if (d > 0) {
        for (const x of [-ww / 2, 0, ww / 2]) pinnacle(q, d, x, y + 2.6, zz, d === 1 ? 1.8 : 2.5);
        if (d > 1)
          for (let j = 0; j < 5; j++) {
            const x = (j - 2) * ww * 0.18;
            rod(q, 0, 'trim', [x, y - 0.25, zz - 0.1], [x, y - 0.5, zz + 0.65], 0.13, shade);
          }
      }
    }
  }
}
function lanternFaces() {
  const r = frame.authoredComponents.lantern;
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      w = Math.hypot(dx, dz),
      nx = dz / w,
      nz = -dx / w;
    return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, w, a: Math.atan2(nx, nz) };
  });
}
function lantern(o, d) {
  for (const f of lanternFaces()) {
    const q = transform(o, f.a, f.x, f.z),
      w = f.w,
      ww = w - 1.25,
      win = pointed(0, 70.6, ww, 22.7, d === 0 ? 1 : d === 1 ? 3 : d === 2 ? 3 : 12);
    wall(q, rect(0, 68.08, w, 26), 0, [win], d === 0 ? 0.5 : 0.65, stone);
    const gable = [
      [-w / 2 + 0.15, 92.5],
      [0, 97.6],
      [w / 2 - 0.15, 92.5],
    ];
    if (d === 0) {
      surface(q, 'trim', gable, 0.05, stone);
    } else {
      wall(q, gable, 0.05, d > 1 ? [ellipse(0, 94.2, 0.4, 0.43, d > 2 ? 16 : 8)] : [], 0.32, stone);
      line(
        q,
        0,
        [
          [-w / 2 + 0.15, 92.5],
          [0, 97.6],
          [w / 2 - 0.15, 92.5],
        ],
        0.14,
        pale,
        0.18,
        'trim',
      );
      tracery(q, d, 0, 70.6, 0, ww, 22.7);
      for (const x of [-ww / 6, ww / 6]) B(q, 'trim', x, 70.6, -0.13, 0.11, 20.0, 0.45, pale);
      B(q, 'trim', 0, 81.4, -0.05, w, 0.3, 0.7, pale);
      if (d > 1) {
        for (let j = 0; j < 11; j++)
          d === 2
            ? surface(q, 'metal', rect(0, 71.5 + j * 1.8, ww * 0.95, 0.035), -0.3, iron)
            : B(q, 'metal', 0, 71.5 + j * 1.8, -0.3, ww * 0.95, 0.035, 0.04, iron);
        for (const x of [-ww / 3, 0, ww / 3])
          line(q, 0, pointed(x, 80.2, ww / 3 - 0.05, 1.2, 5), 0.035, pale, 0.07, 'trim');
      }
      for (const x of [-w / 2 + 0.11, w / 2 - 0.11]) {
        B(q, 'trim', x, 68.1, 0.1, 0.18, 26.8, 0.3, pale);
        if (d > 2)
          for (let j = 0; j < 15; j++)
            d === 2
              ? surface(q, 'trim', rect(x, 69 + j * 1.65, 0.38, 0.13), 0.14, shade)
              : B(q, 'trim', x, 69 + j * 1.65, 0.14, 0.38, 0.13, 0.4, shade);
      }
      pinnacle(q, d, 0, 97.3, 0.13, 1.45);
      if (d > 2) {
        for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) pinnacle(q, d, x, 94.1, 0.1, 3.0);
        for (let j = 0; j < 4; j++)
          for (const sign of [-1, 1]) {
            const xx = sign * (w / 2 - 0.25) * (1 - j / 5),
              yy = 92.9 + j * 0.95;
            rod(q, 0, 'trim', [xx, yy, 0.16], [xx + sign * 0.15, yy + 0.12, 0.16], 0.1, pale);
          }
      }
    }
  }
}
function roof(o, d) {
  const r = frame.authoredComponents.lantern,
    ringAt = (y, scale) => [...r].reverse().map(([x, z]) => [x * scale, y, z * scale]);
  loft(o, 'roof', [ringAt(94.08, 1.02), ringAt(106.5, 0.05), ringAt(106.75, 0.035)], slate);
  if (d > 0) {
    for (const f of lanternFaces()) {
      const q = transform(o, f.a, f.x, f.z);
      if (d === 1) {
        surface(q, 'metal', rect(0, 94.1, f.w, 0.1), 0.12, green);
        surface(q, 'metal', rect(0, 95.0, f.w, 0.1), 0.12, green);
        for (let j = 0; j < 3; j++)
          surface(q, 'metal', rect(((j - 1) * f.w) / 3, 94.2, 0.06, 0.8), 0.12, green);
      } else {
        B(q, 'metal', 0, 94.1, 0.06, f.w, 0.1, 0.12, green);
        B(q, 'metal', 0, 95.0, 0.06, f.w, 0.1, 0.12, green);
      }
      if (d > 1)
        for (let j = 0; j < 4; j++)
          B(q, 'metal', ((j - 1.5) * f.w) / 4, 94.2, 0.16, 0.07, 0.85, 0.1, green);
    }
    if (d > 1) {
      for (const [x, z] of r)
        rod(o, 0, 'metal', [x * 1.025, 94.2, z * 1.025], [x * 0.05, 106.5, z * 0.05], 0.065, lead);
      for (const yy of [96.5, 99, 101.5, 104]) {
        const sc = (106.75 - yy) / 12.67;
        for (let j = 0; j < r.length; j++) {
          const a = r[j],
            b = r[(j + 1) % r.length];
          rod(o, 0, 'metal', [a[0] * sc, yy, a[1] * sc], [b[0] * sc, yy, b[1] * sc], 0.035, lead);
        }
      }
    }
  }
  // Cross and original small Saint Martin horse-and-rider silhouette on the wind vane.
  rod(o, d, 'metal', [0, 106.6, 0], [0, 111.6, 0], d === 0 ? 0.1 : 0.08, iron);
  rod(o, d, 'metal', [-1.15, 109.1, 0], [1.15, 109.1, 0], 0.075, iron);
  if (d > 1) {
    for (const x of [-1.15, 1.15]) ring(o, 0, x, 109.1, 0.015, 0.14, 0.045, iron, 'metal', 12);
    for (const yy of [108, 110.3]) ring(o, 0, 0, yy, 0.015, 0.2, 0.045, iron, 'metal', 12);
  }
  const horse = [
    [-0.8, 111.6],
    [-0.62, 111.74],
    [-0.2, 111.78],
    [0.25, 111.72],
    [0.43, 111.92],
    [0.38, 112.07],
    [0.57, 112.15],
    [0.75, 112.03],
    [0.8, 111.85],
    [0.58, 111.76],
    [0.4, 111.56],
    [0.25, 111.52],
    [0.16, 111.34],
    [0.03, 111.34],
    [0.08, 111.58],
    [-0.28, 111.55],
    [-0.48, 111.32],
    [-0.6, 111.35],
    [-0.43, 111.64],
  ];
  panel(o, 'gold', horse, -0.1, 0.1, gold);
  if (d > 0) {
    panel(
      o,
      'gold',
      [
        [-0.25, 111.7],
        [-0.32, 112.07],
        [-0.12, 112.32],
        [0.05, 112.26],
        [0.1, 111.97],
        [0.25, 111.83],
        [0.42, 111.8],
        [0.3, 111.68],
        [-0.02, 111.85],
      ],
      -0.12,
      0.12,
      gold,
    );
    line(
      o,
      0,
      [
        [-0.17, 112.03],
        [-0.52, 111.89],
      ],
      0.15,
      gold,
      0.08,
      'gold',
    );
  }
}
function build(o, d) {
  lower(o, d);
  second(o, d);
  galleries(o, d);
  lantern(o, d);
  roof(o, d);
}
export const domTowerOfUtrecht = (o) => build(o, 3),
  domTowerOfUtrechtStreet = (o) => build(o, 2),
  domTowerOfUtrechtDistrict = (o) => build(o, 1),
  domTowerOfUtrechtSkyline = (o) => build(o, 0);
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  masonry: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', localRef: ref, roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.52, metallic: 0.04 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0.1 },
  wood: { slot: 'door', localRef: ref, roughness: 0.84, metallic: 0 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.69,
    metallic: 0.2,
    doubleSided: true,
  },
  gold: { slot: 'trim', localRef: ref, roughness: 0.4, metallic: 0.68, doubleSided: true },
};
export const domTowerOfUtrechtModel = {
  id: 'dom_tower_of_utrecht',
  key: 'dom_tower_of_utrecht',
  recipe: 'structure-dom-tower-of-utrecht.mjs',
  cell: 'u1/u17',
  title: 'Dom Tower of Utrecht',
  brief:
    'Detached Utrecht DomTower: native two square stages and open octagonal lantern. Deep continuous pointed ground passage with layered portal moldings/ribbed soffit and own ground-following paving. Warm brick blind Gothic niches/pale stone quoins, glazed lower lights/physical galleries with pierced pointed/trefoil tracery and crocketed pinnacles. Four green skeletal square clocks/gold Roman rings/hands, real second-stage pointed openings/physical mullions/louvers/iron ties. Giant two-light lantern sections/stone tracery band/deep molded arches/corner buttresses/gables/upper green railing. Short slate/lead octagonal cap/cross and original gilded SaintMartin horseman vane. No cathedral nave/choir/visitorreception/neighbors/scaffold/interior bell machinery.',
  camera: [99, 82, 114],
  lookAt: [0, 48, 0],
  qaCameras: [
    { name: 'front', position: [-95, 43, 0], lookAt: [0, 45, 0] },
    { name: 'portal-detail', position: [-27, 5, 5], lookAt: [0, 5, 0] },
    { name: 'lower-detail', position: [-27, 26, 24], lookAt: [0, 23, 0] },
    { name: 'clock-detail', position: [-25, 53, 23], lookAt: [0, 51, 0] },
    { name: 'gallery-detail', position: [-27, 42, 18], lookAt: [0, 40, 0] },
    { name: 'lantern-detail', position: [22, 85, 24], lookAt: [0, 82, 0] },
    { name: 'roof-detail', position: [21, 110, 24], lookAt: [0, 100, 0] },
    { name: 'back', position: [51, 49, -61], lookAt: [0, 45, 0] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -4 },
  build: domTowerOfUtrecht,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'One unchanged independentTerrariumtile/2mgrid, dryDomplein east passage approach[13,0]datum13.5078m. Own passage paving samples unchanged terrain+.06m; buried-4mfootings. No flattening/datum fitting; urban DEM/threshold engineering remain uncertain.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-dom-tower-of-utrecht.mjs',
    level: 'skyline',
    export: 'domTowerOfUtrechtSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'domTowerOfUtrechtDistrict', errorMeters: 1, surfaces },
      street: { export: 'domTowerOfUtrechtStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: frame.limitations,
};
export { galleries, lantern, lower, roof, second };
