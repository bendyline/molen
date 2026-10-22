/** Cardiff Bay Barrage: native waterworks, operable bridge silhouette and engineered revetments. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcj/cardiff_bay_barrage/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  G = plan.groups,
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    concrete: rgb('b6b7ae'),
    rock: rgb('a19d8e'),
    asphalt: rgb('4e5355'),
    steel: rgb('a9c7b3'),
    glass: rgb('4c626b'),
    trim: rgb('deded4'),
  },
  dark = rgb('667176'),
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
    rock: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    asphalt: { slot: 'roof', graph: 'gravel', roughness: 0.96, metallic: 0 },
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
    glass: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.3, metallic: 0.04 },
    trim: { slot: 'trim', localRef: ref, roughness: 0.78, metallic: 0.1 },
  },
  vary = (c, k) => c.map((v) => Math.min(1, Math.max(0, v * k))),
  area = (p) =>
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) / 2;
function tri(o, s, p, h, col = C[s]) {
  p = p.map((p) => p.map(Math.fround));
  const n = cross(
    p[1].map((v, i) => v - p[0][i]),
    p[2].map((v, i) => v - p[0][i]),
  );
  if (Math.hypot(...n) < 1e-8) return;
  if (h && n.reduce((a, v, i) => a + v * h[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, outer, y, holes = [], up = true, col = C[s]) {
  const p = [outer, ...holes].flat(),
    ix = earcut(
      p.flat(),
      holes.length
        ? holes.map((_, i) => outer.length + holes.slice(0, i).reduce((n, p) => n + p.length, 0))
        : undefined,
    );
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [p[j][0], typeof y === 'function' ? y(...p[j]) : y, p[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, p, y0, y1, holes = [], col = C[s]) {
  for (const [ring, inside] of [[p, false], ...holes.map((p) => [p, true])]) {
    const sign = (area(ring) > 0 ? 1 : -1) * (inside ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        ha = typeof y1 === 'function' ? y1(...a) : y1,
        hb = typeof y1 === 'function' ? y1(...b) : y1;
      Q(
        o,
        s,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], hb, b[1]],
          [a[0], ha, a[1]],
        ],
        [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        col,
      );
    }
  }
  cap(o, s, p, y0, holes, false, col);
  cap(o, s, p, y1, holes, true, col);
}
const B = (o, s, a, b, w = 0.2, h = w, col = C[s]) => beam(o, s, a, b, w, h, col);
function box(o, s, a, b, col = C[s]) {
  prism(
    o,
    s,
    [
      [a[0], a[2]],
      [b[0], a[2]],
      [b[0], b[2]],
      [a[0], b[2]],
    ],
    a[1],
    b[1],
    [],
    col,
  );
}
function cylinder(o, s, a, b, r, n = 12, col = C[s]) {
  const v = b.map((x, i) => x - a[i]),
    len = Math.hypot(...v),
    u = v.map((x) => x / len),
    side = cross(u, Math.abs(u[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    sl = Math.hypot(...side),
    w = side.map((x) => x / sl),
    v2 = cross(u, w),
    ring = (c) =>
      Array.from({ length: n }, (_, i) =>
        c.map((x, j) => x + r * (Math.cos((i * tau) / n) * w[j] + Math.sin((i * tau) / n) * v2[j])),
      ),
    ra = ring(a),
    rb = ring(b);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    Q(
      o,
      s,
      [ra[i], ra[k], rb[k], rb[i]],
      ra[i].map((x, j) => x - a[j]),
      col,
    );
    tri(
      o,
      s,
      [a, ra[k], ra[i]],
      u.map((x) => -x),
      col,
    );
    tri(o, s, [b, rb[i], rb[k]], u, col);
  }
}
function distance(p, a, b) {
  const v = b.map((x, i) => x - a[i]),
    t = Math.max(
      0,
      Math.min(
        1,
        p.reduce((s, x, i) => s + (x - a[i]) * v[i], 0) / (v[0] * v[0] + v[1] * v[1] || 1),
      ),
    );
  return Math.hypot(...p.map((x, i) => x - a[i] - t * v[i]));
}
function simplify(p, eps, closed = false) {
  if (!eps || p.length < 4) return p;
  const q = closed ? [...p, p[0]] : p,
    keep = new Set([0, q.length - 1]);
  function split(a, b) {
    let m = -1,
      max = eps;
    for (let i = a + 1; i < b; i++) {
      const d = distance(q[i], q[a], q[b]);
      if (d > max) {
        max = d;
        m = i;
      }
    }
    if (m >= 0) {
      keep.add(m);
      split(a, m);
      split(m, b);
    }
  }
  split(0, q.length - 1);
  const r = [...keep].sort((a, b) => a - b).map((i) => q[i]);
  return closed ? (r.length >= 4 ? r.slice(0, -1) : p) : r;
}
const poly = (f, d) => simplify(f.outline, d === 0 ? 3.5 : d === 1 ? 0.65 : 0, f.closed),
  bounds = (p) =>
    [0, 1].map((i) => [Math.min(...p.map((a) => a[i])), Math.max(...p.map((a) => a[i]))]),
  centroid = (p) => [0, 1].map((i) => p.reduce((s, a) => s + a[i], 0) / p.length);
function rail(o, p, y, d, col = C.trim) {
  if (d < 2) return;
  if (d === 2) p = simplify(p, 0.6);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i];
    for (const h of d === 2 ? [1.05] : [0.55, 1.05])
      B(o, 'trim', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.06, 0.06, col);
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (d === 2 ? 8 : 2.8));
    for (let j = 0; j < n; j++) {
      const t = j / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      B(o, 'trim', [x, y, z], [x, y + 1.1, z], 0.07, 0.07, col);
    }
  }
}
function strip(o, s, p, y, w, depth, col = C[s]) {
  for (let i = 1; i < p.length; i++)
    B(o, s, [p[i - 1][0], y, p[i - 1][1]], [p[i][0], y, p[i][1]], w, depth, col);
}
const crestSegments = G.crestRoad.flatMap((f) =>
    f.outline.slice(1).map((p, i) => [f.outline[i], p]),
  ),
  crestHeight = (x, z) =>
    1 -
    Math.min(
      1,
      Math.max(0, (Math.min(...crestSegments.map(([a, b]) => distance([x, z], a, b))) - 4) / 14),
    ) *
      5;
function inside(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function rockRelief(o, p, count, seed) {
  const bb = bounds(p);
  let state = seed >>> 0;
  const rnd = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0, n = 0; i < count && n < count * 20; n++) {
    const x = bb[0][0] + rnd() * (bb[0][1] - bb[0][0]),
      z = bb[1][0] + rnd() * (bb[1][1] - bb[1][0]);
    if (!inside(x, z, p)) continue;
    i++;
    const r = 0.65 + rnd() * 1.1,
      y = crestHeight(x, z),
      c = vary(C.rock, 0.88 + rnd() * 0.23),
      a = rnd() * tau;
    const base = Array.from({ length: 5 }, (_, k) => [
        x + r * Math.cos(a + (k * tau) / 5),
        y - 0.1,
        z + r * 0.7 * Math.sin(a + (k * tau) / 5),
      ]),
      top = [x + r * 0.15, y + 0.4 + rnd() * 0.5, z - r * 0.1];
    for (let k = 0; k < 5; k++) tri(o, 'rock', [base[k], base[(k + 1) % 5], top], [0, 1, 0], c);
  }
}
function embankment(o, d) {
  for (let i = 0; i < G.laidRockRevetments.length; i++) {
    const p = poly(G.laidRockRevetments[i], d);
    prism(o, 'rock', p, -7, crestHeight);
    if (d >= 2) rockRelief(o, p, d === 3 ? 250 : 60, 8123 + i * 97);
  }
  for (const f of G.crestRoad) {
    if (f.tags.bridge) continue;
    const p = poly(f, d);
    strip(o, 'asphalt', p, 0.85, 6, 0.3);
    if (d >= 2) {
      for (const s of [-1, 1]) {
        const q = p.map((a, i) => {
          const b = p[Math.min(i + 1, p.length - 1)],
            c = p[Math.max(0, i - 1)],
            v = [b[0] - c[0], b[1] - c[1]],
            n = Math.hypot(...v) || 1;
          return [a[0] + ((s * v[1]) / n) * 3.05, a[1] - ((s * v[0]) / n) * 3.05];
        });
        strip(o, 'concrete', q, 0.98, 0.22, 0.28);
        if (d === 3) strip(o, 'trim', q, 1.007, 0.09, 0.012);
      }
    }
  }
  for (const f of G.guideBreakwaters) {
    prism(o, 'rock', poly(f, d), -8, 0.65);
    if (d === 3) rail(o, simplify(f.outline, 0.8, true), 0.7, d);
  }
}
function locks(o, d) {
  const wallPaths = G.lockEdgeRails.map((f) => poly(f, d));
  for (const p of wallPaths) {
    strip(o, 'concrete', p, -5.8, 1.4, 13.6);
    if (d === 3) strip(o, 'concrete', p, 1.05, 1.8, 0.32);
    rail(o, p, 1.22, d);
  }
  for (const f of G.lockGates) {
    const p = poly(f, d);
    strip(o, 'steel', p, -6.4, 0.35, 11.8, dark);
    if (d >= 1) {
      strip(o, 'steel', p, -0.3, 0.6, 0.4);
      for (const y of [-10, -6, -2]) strip(o, 'steel', p, y, 0.44, 0.26, dark);
    }
    if (d === 3) {
      const c = centroid(p);
      for (let i = 0; i < 6; i++)
        B(
          o,
          'steel',
          [c[0] - 3 + i * 1.2, -12, c[1]],
          [c[0] - 3 + i * 1.2, -0.5, c[1]],
          0.11,
          0.12,
          dark,
        );
    }
  }
  // Fixed decks stop at the three actual leaf outlines, leaving each lock throat open below.
  for (const f of G.bridgeFrameOuters) {
    const idx = G.bridgeFrameOuters.indexOf(f),
      holes = G.bridgeFrameVoids.slice(idx * 2, idx * 2 + 2).map((f) => poly(f, d));
    prism(o, 'concrete', poly(f, d), -0.5, 0.45, holes);
  }
  for (let i = 0; i < 3; i++)
    bridge(o, G.bridges[i], G.bridgeFrameOuters[2 - i], d, i === 1 ? (35 * Math.PI) / 180 : 0);
}
function transformed(o, fn) {
  return {
    addQuad(s, r, p, _n, uv, c) {
      const q = p.map(fn);
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ])
        o.addTriangle(
          s,
          r,
          ids.map((i) => q[i]),
          normalFor(...ids.map((i) => q[i])),
          ids.map((i) => uv[i]),
          c,
        );
    },
    addConvexPolygon(s, r, p, _n, uv, c) {
      const q = p.map(fn);
      for (let i = 1; i < q.length - 1; i++) {
        const ids = [0, i, i + 1];
        o.addTriangle(
          s,
          r,
          ids.map((i) => q[i]),
          normalFor(...ids.map((i) => q[i])),
          ids.map((i) => uv(p[i])),
          c,
        );
      }
    },
    addTriangle(s, r, p, _n, uv, c) {
      const q = p.map(fn);
      o.addTriangle(s, r, q, normalFor(...q), uv, c);
    },
  };
}
function bridge(o, f, frame, d, angle) {
  const p = poly(f, d),
    bb = bounds(p),
    x0 = bb[0][0],
    x1 = bb[0][1],
    z0 = bb[1][0],
    z1 = bb[1][1],
    hinge = x0 + 3,
    tilt = transformed(o, ([x, y, z]) => [
      hinge + (x - hinge) * Math.cos(angle) - y * Math.sin(angle),
      0.85 + (x - hinge) * Math.sin(angle) + y * Math.cos(angle),
      z,
    ]);
  prism(tilt, 'asphalt', p, -0.35, 0);
  if (d >= 2) {
    rail(
      tilt,
      [
        [x0, z0],
        [x1, z0],
      ],
      0,
      d,
    );
    rail(
      tilt,
      [
        [x0, z1],
        [x1, z1],
      ],
      0,
      d,
    );
    for (let x = x0 + 1; x < x1; x += 2)
      B(tilt, 'steel', [x, -0.6, z0], [x, -0.6, z1], 0.18, 0.25, dark);
  }
  const fb = bounds(frame.outline),
    sx = fb[0][0] + 6.5;
  for (const z of [z0 - 0.35, z1 + 0.35]) {
    const pivot = [sx, 7.4, z],
      toe = [sx - 4, 0, z],
      back = [sx + 3.8, 0, z],
      tip = [sx + 12 * Math.cos(angle), 7.4 + 12 * Math.sin(angle), z],
      cw = [sx - 6.2 * Math.cos(angle), 7.4 - 6.2 * Math.sin(angle), z];
    for (const [a, b, w] of [
      [toe, pivot, 0.65],
      [back, pivot, 0.65],
      [toe, back, 0.55],
      [pivot, tip, 0.52],
      [pivot, cw, 0.85],
    ])
      B(o, 'steel', a, b, w, w * 0.7);
    if (d >= 1)
      cylinder(
        o,
        'steel',
        cw,
        [cw[0] + 1.7 * Math.cos(angle), cw[1] + 1.7 * Math.sin(angle), cw[2]],
        0.95,
        d === 1 ? 6 : 12,
      );
    else box(o, 'steel', [cw[0] - 0.8, cw[1] - 0.8, z - 0.6], [cw[0] + 0.8, cw[1] + 0.8, z + 0.6]);
    if (d >= 1) {
      const end = [
        hinge + (x1 - hinge) * Math.cos(angle),
        0.85 + (x1 - hinge) * Math.sin(angle),
        z,
      ];
      B(o, 'steel', tip, end, d === 1 ? 0.18 : 0.07, 0.07, dark);
      cylinder(o, 'steel', [sx, 7.4, z - 0.4], [sx, 7.4, z + 0.4], 0.65, d === 1 ? 6 : 16);
    }
  }
  if (d >= 1) B(o, 'steel', [sx, 7.4, z0 - 0.35], [sx, 7.4, z1 + 0.35], 0.4, 0.4);
}
function sluices(o, d) {
  const outer = poly(G.sluiceDam[0], d);
  prism(o, 'concrete', outer, 0.55, 1.05);
  const gaps = plan.sluiceFunctionalOpenings.map((f) => f.x),
    piers = [
      [76.68, 77.07],
      [85.61, 90.59],
      [99.07, 104.07],
      [112.5, 117.58],
      [126.04, 131.05],
      [139.4, 140.08],
    ];
  for (const [a, b] of piers) box(o, 'concrete', [a, -8, -15.4], [b, 0.6, 8.5]);
  for (let i = 0; i < gaps.length; i++) {
    const [a, b] = gaps[i],
      x = (a + b) / 2;
    box(o, 'steel', [a + 0.1, -4.8, -3], [b - 0.1, -0.2, -2.65], dark);
    if (d >= 1) {
      box(o, 'steel', [a + 0.1, -0.2, -3.2], [b - 0.1, 0.05, -2.45]);
      for (const xx of [a + 0.6, b - 0.6]) {
        cylinder(o, 'steel', [xx, 1, -2.8], [xx, 5.1, -2.8], 0.15, d === 1 ? 6 : 12, dark);
        cylinder(o, 'steel', [xx, 1.2, -2.8], [xx, 3.4, -2.8], 0.28, d === 1 ? 6 : 12);
      }
      B(o, 'steel', [a + 0.3, 5.1, -2.8], [b - 0.3, 5.1, -2.8], 0.25, 0.25);
    }
    if (d >= 2) {
      rail(
        o,
        [
          [a, 0.9],
          [b, 1.1],
        ],
        1.1,
        d,
      );
      for (let j = 0; j < 5; j++)
        B(
          o,
          'steel',
          [a + 0.3 + (j * (b - a - 0.6)) / 4, -4.6, -3.1],
          [a + 0.3 + (j * (b - a - 0.6)) / 4, -0.3, -3.1],
          0.08,
          0.1,
          dark,
        );
    }
    if (d === 3) for (const z of [-12, -8, 4]) B(o, 'concrete', [a, -7, z], [b, -7, z], 0.25, 0.4);
    if (d === 0) box(o, 'steel', [x - 0.15, 1, -3], [x + 0.15, 4.5, -2.7]);
  }
  // The salmon pass is a separate narrow open pool/weir channel beside the five gate bays.
  for (const xx of [143.3, 152]) box(o, 'concrete', [xx, -5, -49.8], [xx + 0.55, 0.9, 13]);
  box(o, 'concrete', [143.3, -5, 12.5], [152.55, 1, 13.1]);
  for (let z = -46; z < 10; z += d === 0 ? 18 : 6.5)
    box(o, 'concrete', [143.8, -4.8, z], [151.9, -1.8, z + 0.45]);
  if (d >= 2)
    rail(
      o,
      [
        [143.5, -49.8],
        [143.5, 13],
        [152.3, 13],
        [152.3, -49.8],
      ],
      1,
      d,
    );
}
function control(o, d) {
  const p = poly(G.controlBuilding[0], d);
  prism(o, 'concrete', p, 0, 3.8);
  const c = centroid(p),
    native = G.controlBuilding[0].outline,
    angle = Math.atan2(native[12][0] - native[11][0], native[12][1] - native[11][1]),
    a = angle || 0.42,
    tx = (u, y, v) => [
      c[0] + u * Math.cos(a) + v * Math.sin(a),
      y,
      c[1] - u * Math.sin(a) + v * Math.cos(a),
    ],
    out = transformed(o, (p) => tx(...p));
  box(out, 'concrete', [-4.8, 5.8, -19.5], [4.8, 9.5, 18]);
  box(out, 'concrete', [-5.2, 9.5, -20], [5.2, 9.9, 18.5]);
  for (const u of [-3.7, 3.7])
    for (const v of [-11, 6])
      box(out, 'concrete', [u - 0.55, 3.8, v - 0.55], [u + 0.55, 5.8, v + 0.55]);
  for (const u of [-4.82, 4.82]) {
    const sign = Math.sign(u);
    Q(
      out,
      'glass',
      [
        [u, 8.1, -18.2],
        [u, 8.1, 16.8],
        [u, 9.05, 16.8],
        [u, 9.05, -18.2],
      ],
      [sign, 0, 0],
    );
    if (d >= 1)
      for (let v = -18; v <= 17; v += d === 1 ? 5 : 1.4)
        B(out, 'trim', [u * 1.002, 8.05, v], [u * 1.002, 9.12, v], 0.06, 0.06, dark);
  }
  if (d >= 2) {
    for (const v of [-19.6, 18.1]) {
      Q(
        out,
        'glass',
        [
          [-3.8, 8.1, v],
          [3.8, 8.1, v],
          [3.8, 9.05, v],
          [-3.8, 9.05, v],
        ],
        [0, 0, Math.sign(v)],
      );
      for (let u = -3.8; u <= 3.8; u += 1.5)
        B(out, 'trim', [u, 8.1, v], [u, 9.1, v], 0.07, 0.07, dark);
    }
    box(out, 'steel', [4.8, 6.6, -17.5], [6.2, 6.8, -13]);
    rail(
      out,
      [
        [4.9, -17.5],
        [6.2, -17.5],
        [6.2, -13],
        [4.9, -13],
      ],
      6.8,
      d,
    );
  }
  // Original holed gantry plan is retained as an elevated skeletal service frame.
  const g = poly(G.controlGantryOuter[0], d),
    holes = G.controlGantryVoids.map((f) => poly(f, d));
  prism(o, 'concrete', g, 12.8, 14, holes);
  for (const [x, z] of [
    [49, -23.7],
    [60.7, -23.7],
    [49, 2.5],
    [60.7, 2.5],
  ])
    box(o, 'concrete', [x - 0.7, 0, z - 0.7], [x + 0.7, 12.8, z + 0.7]);
  for (const f of G.bridgeShelters) prism(o, 'concrete', poly(f, d), 0, 2.7);
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  if (d === 1) {
    embankment(o, 1);
    locks(o, 0);
    sluices(o, 0);
    control(o, 1);
    return;
  }
  embankment(o, d);
  locks(o, d);
  sluices(o, d);
  control(o, d);
}
export const cardiffBarrageSkyline = (o, f) => build(o, f, 0);
export const cardiffBarrageDistrict = (o, f) => build(o, f, 1);
export const cardiffBarrageStreet = (o, f) => build(o, f, 2);
export const cardiffBarrageModel = {
  id: 'cardiff_bay_barrage',
  key: 'cardiff_bay_barrage',
  recipe: 'structure-cardiff-bay-barrage.mjs',
  cell: 'gc/gcj',
  title: 'Cardiff Bay Barrage',
  category: 'tidal-barrage',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete mapped waterworks and curved engineered embankment:3open lock chambers/sector gates, pale green bascule arms/counterweights with middle bridge raised, genuine holed support frames, cantilevered glazed control room/open gantry,5sluice throats and separate fish-pass pools, bounded guide arms and angular laid-rock revetments/asphalt crest. No natural sea/landscape, neighboring dock locks, town, boats or lettering.',
  camera: [610, 500, 850],
  lookAt: [330, 0, 20],
  portableGroundY: -14,
  mediumFiContext: { scale: 1.05, groundY: -14 },
  qaCameras: [
    {
      name: 'complete-curved-barrage-and-original-engineered-embankment',
      position: [550, 650, 900],
      lookAt: [360, 0, -20],
      reviewLod: 'skyline',
    },
    {
      name: 'three-open-lock-chambers-green-bascule-arms-and-control-room',
      position: [-90, 70, 160],
      lookAt: [10, 2, 25],
    },
    {
      name: 'five-sluice-throats-open-gantry-and-separate-fish-pass',
      position: [180, 55, 105],
      lookAt: [112, 0, -10],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fixed original dry Penarth approach node10857143707before terrain acquisition; exact lock-floor/tide/host attachment and concealed structural levels are approximate. No terrain flattening/fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cardiff-bay-barrage.mjs',
    level: 'skyline',
    export: 'cardiffBarrageSkyline',
    errorMeters: 6,
    surfaces,
    authoredLevels: {
      district: { export: 'cardiffBarrageDistrict', errorMeters: 3.5, surfaces },
      street: { export: 'cardiffBarrageStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Three exact supplemental own-workPD/CC0originals actually inspected after local Qualla-first74candidate coverage check. KevinPowellnative lock-entrance photograph has original named creatorPD-user-enrelease; two AugustDominus2024CC0photos control curved asphalt crest and laid-rock revetments. All exactSHA1matched and pinned creator releases bound; unrelated/other-licensed images unused. No photographic texture or generated bitmap.',
    plan.waterAreaInterpretation,
    'Original native component plans and individual near perimeter vertices retained. Nominal40musable chambers/8/8/10.5mclear widths and5gates9x7.5mcome from official harbour text, while sector-gate centre separations, wall thicknesses, waterline/footing levels, bridge-leaf angle/hinge subdivision and hidden section heights are photographic medium-fi estimates. Three gateways genuinely open, native support/gantry inner rings retained; middle leaf shown35degreesraised as a representative operating state.',
    'Control room upper cantilever/continuous glazing and grey service podium follow inspected photograph, but exact hidden upper-floor partition/height and all fine machinery fittings are estimates. Original angular rock relief approximates engineered revetment stone scale/census. Wide park parcels, natural sea/cliff/mudflats, sailing/recreation buildings and separate AlexandraDock/PenarthMarina locks are excluded.',
    plan.terrainLimitations,
    'Dry approachY0/crestY1and lockfloorY-13are independent approximate architectural levels; flat inspection stageY-14shows the waterworks, without claiming certified tide/water/host terrain contact. FartherLODs simplify bounded native fine vertices within declared errors.',
  ],
};
function skyline(o) {
  for (const f of G.laidRockRevetments)
    prism(o, 'rock', simplify(f.outline, 6, true), -7, crestHeight);
  for (const f of G.guideBreakwaters) prism(o, 'rock', simplify(f.outline, 6, true), -8, 0.65);
  for (const f of G.crestRoad) {
    if (f.tags.bridge) continue;
    const p = simplify(f.outline, 6);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        v = [b[0] - a[0], b[1] - a[1]],
        l = Math.hypot(...v),
        n = [(v[1] / l) * 3, (-v[0] / l) * 3],
        q = [
          [a[0] + n[0], 1, a[1] + n[1]],
          [b[0] + n[0], 1, b[1] + n[1]],
          [b[0] - n[0], 1, b[1] - n[1]],
          [a[0] - n[0], 1, a[1] - n[1]],
        ];
      Q(o, 'asphalt', q, [0, 1, 0]);
      Q(o, 'asphalt', q, [0, -1, 0]);
    }
  }
  const pairs = [
    [G.lockGates[3], G.lockGates[4]],
    [G.lockGates[2], G.lockGates[1]],
    [G.lockGates[5], G.lockGates[0]],
  ];
  for (let i = 0; i < 3; i++) {
    const [a, b] = pairs[i].map((f) => centroid(f.outline)),
      x = (a[0] + b[0]) / 2,
      w = i === 0 ? 10.5 : 8;
    for (const xx of [x - w / 2 - 1, x + w / 2 + 1])
      box(
        o,
        'concrete',
        [xx - 0.6, -13, Math.min(a[1], b[1]) - 1],
        [xx + 0.6, 1, Math.max(a[1], b[1]) + 1],
      );
    for (const z of [a[1], b[1]])
      box(o, 'steel', [x - w / 2, -12, z - 0.2], [x + w / 2, -0.5, z + 0.2], dark);
    const f = G.bridges[i],
      bb = bounds(f.outline),
      x0 = bb[0][0],
      z0 = bb[1][0],
      z1 = bb[1][1],
      angle = i === 1 ? (35 * Math.PI) / 180 : 0,
      hinge = x0 + 3;
    const tilt = transformed(o, ([xx, y, z]) => [
      hinge + (xx - hinge) * Math.cos(angle) - y * Math.sin(angle),
      0.85 + (xx - hinge) * Math.sin(angle) + y * Math.cos(angle),
      z,
    ]);
    prism(tilt, 'asphalt', simplify(f.outline, 1, true), -0.35, 0);
    for (const z of [z0, z1]) {
      const pivot = [hinge - 1, 7.4, z],
        tip = [hinge - 1 + 12 * Math.cos(angle), 7.4 + 12 * Math.sin(angle), z];
      B(o, 'steel', [hinge - 1, 0, z], pivot, 0.9, 0.9);
      B(o, 'steel', pivot, tip, 0.8, 0.8);
    }
    box(o, 'steel', [hinge - 7, 6.4, (z0 + z1) / 2 - 1], [hinge - 4, 8.2, (z0 + z1) / 2 + 1]);
  }
  const gaps = plan.sluiceFunctionalOpenings.map((f) => f.x);
  for (const [a, b] of [
    [76.68, 77.07],
    [85.61, 90.59],
    [99.07, 104.07],
    [112.5, 117.58],
    [126.04, 131.05],
    [139.4, 140.08],
  ])
    box(o, 'concrete', [a, -8, -15], [b, 1, 8]);
  box(o, 'concrete', [76.7, 0.55, -15], [140, 1.05, 8]);
  for (const [a, b] of gaps) box(o, 'steel', [a, -4.8, -3], [b, -0.2, -2.6], dark);
  for (const x of [143.3, 152]) box(o, 'concrete', [x, -5, -49.8], [x + 0.55, 0.9, 13]);
  const p = G.controlBuilding[0].outline;
  prism(o, 'concrete', simplify(p, 1.5, true), 0, 3.8);
  box(o, 'concrete', [41, 5.8, 29], [54, 9.8, 66]);
  box(o, 'glass', [40.9, 8.1, 30], [41.05, 9.1, 65]);
  for (const x of [49, 60.7]) box(o, 'concrete', [x - 0.8, 0, -24], [x + 0.8, 14, -22]);
  box(o, 'concrete', [48.2, 12.8, -24.2], [61.7, 14, -22]);
}
