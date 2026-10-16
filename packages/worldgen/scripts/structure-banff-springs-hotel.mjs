/** Banff Springs main stone hotel: researched tower, wings, public rooms and copper roofline. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/c3/c3j/banff_springs_hotel/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  wall = rgb('6e685c'),
  trim = rgb('c9c8b6'),
  roof = rgb('74817a'),
  glass = rgb('354a50'),
  dark = rgb('383e38');
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function prism(o, loops, low, high, color = wall, slot = 'wall') {
  const rings = loops.map((r, i) => {
    r = cleanRing(r);
    if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
    const a = r.reduce(
      (s, p, j) => s + p[0] * r[(j + 1) % r.length][1] - r[(j + 1) % r.length][0] * p[1],
      0,
    );
    if (a > 0 !== (i === 0)) r.reverse();
    return r;
  });
  const pts = rings.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(count);
    count += rings[i].length;
  }
  const indices = earcut(pts.flat(), holes);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, [0, 1, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      quad(
        o,
        slot,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        color,
      );
    }
}
function upNormal(p) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  return n;
}
function edgeFrame(o, a, b) {
  return facing(o, Math.atan2(a[1] - b[1], b[0] - a[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}
function hip(o, x, z, w, l, y, rise) {
  const a = [x - w / 2, y, z - l / 2],
    b = [x + w / 2, y, z - l / 2],
    c = [x + w / 2, y, z + l / 2],
    d = [x - w / 2, y, z + l / 2];
  const along = l > w,
    ridge = along
      ? [
          [x, y + rise, z - l / 2 + w * 0.42],
          [x, y + rise, z + l / 2 - w * 0.42],
        ]
      : [
          [x - w / 2 + l * 0.42, y + rise, z],
          [x + w / 2 - l * 0.42, y + rise, z],
        ];
  const faces = along
    ? [
        [a, b, ridge[0]],
        [b, c, ridge[1], ridge[0]],
        [c, d, ridge[1]],
        [d, a, ridge[0], ridge[1]],
      ]
    : [
        [a, b, ridge[1], ridge[0]],
        [b, c, ridge[1]],
        [c, d, ridge[0], ridge[1]],
        [d, a, ridge[0]],
      ];
  for (const p of faces)
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      o.addTriangle(
        'roof',
        ref,
        t,
        upNormal(t),
        t.map((v) => [v[0], v[2]]),
        roof,
      );
    }
  beam(o, 'roof', ridge[0], ridge[1], 0.18, 0.17, roof);
}

function win(o, x, y, z, w, h, d, arched = false) {
  if (!d) return;
  const sy = y + h - (arched ? w * 0.42 : 0),
    p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, sy, z],
    ];
  if (arched) {
    const n = d > 2 ? 8 : 2;
    for (let i = 1; i <= n; i++) {
      const a = (i * Math.PI) / n;
      p.push([x + (Math.cos(a) * w) / 2, sy + Math.sin(a) * w * 0.42, z]);
    }
  } else p.push([x - w / 2, y + h, z]);
  o.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
  if (d < 2) return;
  if (d === 2) {
    face(o, 'trim', x, y - 0.08, z - 0.008, w + 0.26, h + 0.22, trim);
    face(o, 'trim', x, y + h * 0.36, z + 0.04, w, 0.095, trim);
    if (w > 1.75) face(o, 'trim', x, y, z + 0.05, 0.1, h, trim);
    return;
  }
  for (const sx of [-1, 1])
    face(o, 'trim', x + sx * (w / 2 + 0.065), y - 0.06, z + 0.03, 0.13, h + 0.12, trim);
  face(o, 'trim', x, y - 0.07, z + 0.04, w + 0.26, 0.14, trim);
  if (!arched) face(o, 'trim', x, y + h - 0.02, z + 0.04, w + 0.26, 0.16, trim);
  else {
    const n = d > 2 ? 8 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      quad(
        o,
        'trim',
        [
          [x + Math.cos(a) * (w / 2 + 0.14), sy + Math.sin(a) * (w * 0.42 + 0.14), z + 0.04],
          [x + Math.cos(b) * (w / 2 + 0.14), sy + Math.sin(b) * (w * 0.42 + 0.14), z + 0.04],
          [x + (Math.cos(b) * w) / 2, sy + Math.sin(b) * w * 0.42, z + 0.04],
          [x + (Math.cos(a) * w) / 2, sy + Math.sin(a) * w * 0.42, z + 0.04],
        ],
        [0, 0, 1],
        trim,
      );
    }
  }
  face(o, 'trim', x, y + h * 0.36, z + 0.06, w, 0.095, trim);
  if (w > 1.75) face(o, 'trim', x, y, z + 0.065, 0.1, h, trim);
  if (d > 2) {
    B(o, 'trim', x, y - 0.17, z + 0.08, w + 0.34, 0.14, 0.31, trim);
    if (w < 1.75)
      face(o, 'glass', x - w * 0.25, y + 0.1, z + 0.008, w * 0.18, h * 0.8, rgb('909790'));
  }
}
function band(o, x, y, z, w, l, d) {
  B(o, 'trim', x, y, z, w + 0.32, 0.18, l + 0.32, trim);
  if (d > 2) B(o, 'wall', x, y - 0.23, z, w + 0.17, 0.2, l + 0.17, wall);
}
function stonework(o, w, y0, h, z, holes, d, seed = 0) {
  if (d < 3) return;
  const cols = ['777062', '615e55', '827967', '6d695c', '595b52'].map(rgb),
    step = 0.46,
    width = 1.18;
  for (let row = 0, y = y0; y < y0 + h - 0.1; y += step, row++)
    for (let col = 0, x = -w / 2 - ((row % 2) * width) / 2; x < w / 2; x += width, col++) {
      const a = Math.max(-w / 2, x + 0.03),
        b = Math.min(w / 2, x + width - 0.035),
        cx = (a + b) / 2,
        cy = y + step / 2;
      if (b - a < 0.09) continue;
      if (
        holes.some(
          (q) =>
            cx > q[0] - q[2] / 2 - 0.18 &&
            cx < q[0] + q[2] / 2 + 0.18 &&
            cy > q[1] - 0.22 &&
            cy < q[1] + q[3] + 0.22,
        )
      )
        continue;
      face(
        o,
        'wall',
        cx,
        y + 0.02,
        z,
        b - a,
        step - 0.065,
        cols[(row * 7 + col * 3 + seed) % cols.length],
      );
    }
}
function wallRows(o, w, z, rows, d, { bays = 5, arched = false, stone = false } = {}) {
  const holes = [];
  for (const [y, h] of rows)
    for (let i = 0; i < bays; i++) {
      const x = ((i - (bays - 1) / 2) * (w - 4)) / bays,
        ww = w / bays > 3.5 ? 1.65 : 1.35;
      win(o, x, y, z, ww, h, d, arched);
      holes.push([x, y, ww, h]);
    }
  if (stone)
    stonework(
      o,
      w,
      Math.max(-0.5, rows[0][0] - 1),
      Math.min(rows.at(-1)[0] + rows.at(-1)[1] + 0.5, 13),
      z - 0.012,
      holes,
      d,
    );
}
function gable(o, x, y, z, w, h, d) {
  // Two broad shoulders and a rounded crown, not Gothic tracery.
  const profile = [
    [-w / 2, 0],
    [-w / 2, h * 0.18],
    [-w * 0.33, h * 0.18],
    [-w * 0.29, h * 0.42],
    [-w * 0.15, h * 0.74],
    [0, h],
    [w * 0.15, h * 0.74],
    [w * 0.29, h * 0.42],
    [w * 0.33, h * 0.18],
    [w / 2, h * 0.18],
    [w / 2, 0],
  ];
  const indices = earcut(profile.flat());
  for (const [zz, n] of [
    [z, [0, 0, 1]],
    [z - 0.65, [0, 0, -1]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [x + profile[j][0], y + profile[j][1], zz]);
      o.addTriangle(
        'wall',
        ref,
        p,
        n,
        p.map((v) => [v[0], v[1]]),
        wall,
      );
    }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      p = [
        [x + a[0], y + a[1], z],
        [x + b[0], y + b[1], z],
        [x + b[0], y + b[1], z - 0.65],
        [x + a[0], y + a[1], z - 0.65],
      ];
    quad(o, 'wall', p, normalFor(...p), wall);
  }
  if (d) {
    for (let i = 0; i < profile.length - 1; i++)
      beam(
        o,
        'trim',
        [x + profile[i][0], y + profile[i][1], z + 0.08],
        [x + profile[i + 1][0], y + profile[i + 1][1], z + 0.08],
        d > 2 ? 0.22 : 0.15,
        0.2,
        trim,
      );
    win(o, x, y + 0.45, z + 0.12, w * 0.26, h * 0.3, d);
    if (d > 1) win(o, x, y + h * 0.53, z + 0.12, w * 0.18, h * 0.19, d);
  }
}
function dormer(o, x, z, y, w, h, depth, d) {
  B(o, 'wall', x, y, z - depth / 2, w, h, depth, wall);
  win(o, x, y + 0.17, z + 0.04, w - 0.38, h - 0.34, d);
  const p = [
    [x - w / 2 - 0.18, y + h, z + 0.18],
    [x + w / 2 + 0.18, y + h, z + 0.18],
    [x + w / 2 + 0.18, y + h + 0.3, z - depth],
    [x - w / 2 - 0.18, y + h + 0.3, z - depth],
  ];
  quad(o, 'roof', p, upNormal(p), roof);
}
function roofDormers(o, x, z, w, l, y, rise, d, { count = 5, tiers = 2, allSides = false } = {}) {
  hip(o, x, z, w, l, y, rise);
  if (d < 2) return;
  const faces = allSides ? [0, Math.PI, Math.PI / 2, -Math.PI / 2] : [0, Math.PI];
  for (const a of faces) {
    const q = facing(o, a, x, z),
      side = Math.abs(a) === Math.PI / 2,
      span = side ? l : w,
      depth = side ? w : l;
    const slope = depth > span ? span * 0.42 : depth / 2;
    for (let tier = 0; tier < (d === 2 ? 1 : tiers); tier++) {
      const frac = tier ? 0.55 : 0.12,
        yy = y + rise * frac,
        zz = depth / 2 - slope * frac + 0.32,
        n = tier ? Math.max(2, count - 1) : count;
      for (let i = 0; i < n; i++) {
        const xx = ((i - (n - 1) / 2) * (span - 7) * (1 - frac * 0.55)) / n;
        // Actual hip-plane intersection controls depth; the face remains ahead of the slope.
        dormer(q, xx, zz, yy, 2.5, tier ? 1.55 : 1.9, 3.1, d);
      }
    }
  }
}
function tower(o, x, z, w, l, wallTop, rise, d, { tiers = 2, stone = false } = {}) {
  B(o, 'wall', x, -3, z, w, wallTop + 3, l, wall);
  band(o, x, 8, z, w, l, d);
  band(o, x, wallTop - 0.45, z, w, l, d);
  roofDormers(o, x, z, w + 1, l + 1, wallTop, rise, d, {
    count: Math.max(2, Math.floor(w / 5)),
    tiers,
    allSides: true,
  });
  if (!d) return;
  for (const [a, span, depth] of [
    [0, w, l],
    [Math.PI, w, l],
    [Math.PI / 2, l, w],
    [-Math.PI / 2, l, w],
  ]) {
    const q = facing(o, a, x, z),
      rows = [];
    for (let y = 1.1; y < wallTop - 2.5; y += 3.6) rows.push([y, y < 5 ? 2.65 : 1.95]);
    wallRows(q, span, depth / 2 + 0.045, rows, d, {
      bays: Math.max(2, Math.round(span / 4.4)),
      stone,
    });
    if (d > 1) {
      gable(q, 0, wallTop - 0.25, depth / 2 + 0.14, Math.min(7, span * 0.48), 5.7, d);
      for (const sx of [-1, 1]) {
        B(q, 'wall', sx * (span / 2 - 0.7), wallTop - 3, depth / 2 + 0.15, 0.9, 3.8, 0.6, wall);
        B(q, 'trim', sx * (span / 2 - 0.7), wallTop + 0.6, depth / 2 + 0.15, 1.2, 0.2, 0.85, trim);
      }
    }
  }
  if (d > 2)
    for (const sx of [-1, 1])
      B(o, 'trim', x, wallTop + rise - 0.15, z + sx * (l / 2 - w * 0.42), 0.22, 0.9, 0.22, trim);
}
function angledEnd(o, x, z, a, d, north = false) {
  const q = facing(o, a, x, z),
    w = 22,
    l = 25,
    top = north ? 29.5 : 33;
  B(q, 'wall', 0, -3, 0, w, top + 3, l, wall);
  band(q, 0, 8, 0, w, l, d);
  band(q, 0, top - 0.4, 0, w, l, d);
  if (d > 1) for (const yy of [top - 6.6, top - 2.8]) band(q, 0, yy, 0, w, l, d);
  roofDormers(q, 0, 0, w + 1.1, l + 1.1, top, north ? 13 : 15, d, {
    count: 3,
    tiers: 2,
    allSides: true,
  });
  // Faceted principal end and its projecting window bay.
  const bay = [
    [-4.7, l / 2 - 0.1],
    [-4.7, l / 2 + 1.5],
    [-3, l / 2 + 3.0],
    [3, l / 2 + 3.0],
    [4.7, l / 2 + 1.5],
    [4.7, l / 2 - 0.1],
  ];
  prism(q, [bay], -3, top - 6);
  for (const y of [8, top - 6]) prism(q, [bay], y, y + 0.25, trim, 'trim');
  if (d) {
    for (const [a, _span, depth] of [
      [0, w, l],
      [Math.PI, w, l],
      [Math.PI / 2, l, w],
      [-Math.PI / 2, l, w],
    ]) {
      const u = facing(q, a);
      for (let y = 1.05; y < top - 2; y += 3.6)
        for (const xx of [-7, 0, 7]) {
          if (a === 0 && xx === 0 && y < top - 6) continue;
          win(u, xx, y, depth / 2 + 0.045, 1.65, y < 6 ? 2.65 : 1.95, d, y < 6);
        }
    }
    for (let i = 0; i < bay.length - 1; i++) {
      const a = bay[i],
        b = bay[i + 1],
        u = edgeFrame(q, a, b),
        len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      for (let y = 1.05; y < top - 8; y += 3.6) {
        if (len > 4)
          for (const xx of [-1.25, 1.25]) win(u, xx, y, 0.035, 1.6, y < 6 ? 2.65 : 1.95, d, y < 6);
        else if (len > 2) win(u, 0, y, 0.035, 1.25, y < 6 ? 2.65 : 1.95, d, y < 6);
      }
    }
    if (d > 1)
      for (const xx of [-8, 0, 8])
        gable(q, xx, top - 0.2, l / 2 + 0.65, xx === 0 ? 7.2 : 4.1, xx === 0 ? 8 : 4.8, d);
    if (d > 1) {
      const u = facing(q, 0);
      for (let i = 0; i < 12; i++)
        B(u, 'wall', 0, i * 0.18, l / 2 + 7 - i * 0.3, 4.3, 0.2, 5 - i * 0.3, wall);
      B(u, 'trim', 0, 2.16, l / 2 + 4.0, 4.7, 0.2, 2.2, trim);
    }
  }
}
function podium(o, x, z, w, l, top, d, { round = false } = {}) {
  if (round) {
    const ring = [
      [-w / 2, -l / 2],
      [w / 2, -l / 2],
      [w / 2, l / 2 - 3],
      [w / 2 - 1, l / 2 - 1],
      [w / 2 - 3, l / 2],
      [-w / 2 + 3, l / 2],
      [-w / 2 + 1, l / 2 - 1],
      [-w / 2, l / 2 - 3],
    ].map((p) => [p[0] + x, p[1] + z]);
    prism(o, [ring], -3, top);
    prism(o, [ring], top, top + 0.22, trim, 'trim');
  } else {
    B(o, 'wall', x, -3, z, w, top + 3, l, wall);
    band(o, x, top, z, w, l, d);
  }
  B(o, 'roof', x, top + 0.22, z, w - 1, 0.12, l - 1, dark);
  for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
    const q = facing(o, a, x, z),
      span = a === 0 ? w : l,
      dep = a === 0 ? l : w;
    wallRows(
      q,
      span,
      dep / 2 + 0.04,
      [
        [0.65, 2.2],
        [4.5, 3.2],
      ],
      d,
      { bays: Math.max(3, Math.round(span / 4.4)), arched: true, stone: true },
    );
  }
  if (d > 1) {
    for (const a of [0, Math.PI]) {
      const q = facing(o, a, x, z);
      for (let i = 0; i < Math.floor(w / 2); i++)
        B(
          q,
          'wall',
          (i - (Math.floor(w / 2) - 1) / 2) * 2,
          top + 0.22,
          l / 2,
          0.25,
          0.7,
          0.25,
          wall,
        );
      B(q, 'trim', 0, top + 0.9, l / 2, w, 0.17, 0.3, trim);
    }
  }
}
export function banff(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base), 'utf8'));
  // The combined map also contains the Gatehouse; this model stops at its narrow bridge.
  const scope = frame.geometry.outline;
  prism(o, [scope], -3, 0);
  // Long guest ranges are behind the lower public-room podiums.
  for (const [x, w, count] of [
    [-44, 48, 11],
    [29, 42, 10],
  ]) {
    B(o, 'wall', x, 0, -2.8, w, 29.4, 20.2, wall);
    band(o, x, 8, -2.8, w, 20.2, d);
    band(o, x, 29.15, -2.8, w, 20.2, d);
    roofDormers(o, x, -2.8, w + 1, 21.2, 29.4, 10.5, d, { count: Math.round(w / 5), tiers: 2 });
    for (const a of [0, Math.PI]) {
      const q = facing(o, a, x, -2.8),
        rows = [];
      for (let y = 1.05; y < 28; y += 3.6) rows.push([y, 1.95]);
      wallRows(q, w, 10.15, rows, d, { bays: d === 1 ? Math.round(count * 0.75) : count });
    }
  }
  // Eleven-storey central tower and lower stepped front pavilion.
  tower(o, -6.6, 1.2, 23.2, 28, 42, 16, d, { tiers: 2 });
  tower(o, -25, 13.6, 15.8, 15.1, 33.8, 11.5, d, { tiers: 2 });
  angledEnd(o, -83, -0.5, -Math.PI / 4, d, true);
  angledEnd(o, 56.7, 8.1, Math.PI / 4, d, false);
  // Lower north ballroom extends diagonally toward Spray Avenue.
  {
    const q = facing(o, Math.PI / 4, -70, 32.5);
    podium(q, 0, 0, 20, 37, 9.1, d);
  }
  for (const [x, w] of [
    [-43.5, 33],
    [-2, 24],
    [29, 28],
  ])
    podium(o, x, 23, w, 21, 8.3, d, { round: x !== -2 });
  // Short continuous hall links between the three projecting public-room blocks.
  for (const [x, w] of [
    [-20.5, 13],
    [12.5, 5],
  ]) {
    B(o, 'wall', x, -3, 23, w, 9.8, 20, wall);
    B(o, 'roof', x, 6.8, 23, w, 0.15, 20, dark);
    if (d)
      for (let i = 0; i < Math.max(1, Math.floor(w / 3)); i++)
        win(
          o,
          x + (i - (Math.max(1, Math.floor(w / 3)) - 1) / 2) * 3,
          1.2,
          33.04,
          1.7,
          3.7,
          d,
          true,
        );
  }
  // East Rundle public-room wing, with its lower terrace end.
  B(o, 'wall', -6.6, -3, -29.7, 23, 18.5, 33, wall);
  band(o, -6.6, 8, -29.7, 23, 33, d);
  band(o, -6.6, 15.25, -29.7, 23, 33, d);
  hip(o, -6.6, -29.7, 24, 34, 15.5, 4.9);
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const q = facing(o, a, -6.6, -29.7);
    wallRows(
      q,
      33,
      11.54,
      [
        [0.7, 3.0],
        [5, 3.7],
        [10.2, 3.7],
      ],
      d,
      { bays: 7, arched: true },
    );
  }
  {
    const q = facing(o, Math.PI, -6.6, -29.7);
    wallRows(
      q,
      23,
      16.55,
      [
        [0.7, 3],
        [5, 3.7],
        [10.2, 3.7],
      ],
      d,
      { bays: 5, arched: true },
    );
  }
  if (d > 1) {
    // Raised flat-roof entry portico and two tall central chimneys.
    B(o, 'roof', -2, 4.1, 36.8, 16.4, 0.55, 4.8, roof);
    for (const x of [-9, -4, 1, 6]) B(o, 'trim', x, 0, 38.4, 0.42, 4.2, 0.42, trim);
    for (const [x, z, y] of [
      [-42, -2.8, 39.8],
      [26, -2.8, 39.8],
      [-6.6, 1.2, 58],
    ]) {
      B(o, 'wall', x, y - 1, z, 1.8, 3, 2.3, wall);
      B(o, 'trim', x, y + 2, z, 2.1, 0.28, 2.6, trim);
    }
    for (const [x, w] of [
      [-43.5, 25],
      [-2, 19],
      [29, 20],
    ]) {
      B(o, 'wall', x, 8.65, 24, w, 2.5, 7.5, wall);
      for (let i = 0; i < Math.floor(w / 2); i++)
        win(o, x + (i - (Math.floor(w / 2) - 1) / 2) * 2, 9, 27.8, 1.5, 1.8, d);
      B(o, 'roof', x, 11.15, 24, w + 0.3, 0.18, 7.8, dark);
    }
  }
}
export function banffSkyline(o) {
  banff(o, undefined, 0);
}
export function banffDistrict(o) {
  banff(o, undefined, 1);
}
export function banffStreet(o) {
  banff(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.72, metallic: 0.35 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const banffModel = {
  id: 'banff_springs_hotel',
  recipe: 'structure-banff-springs-hotel.mjs',
  key: 'banff_springs_hotel',
  cell: 'c3/c3j',
  title: 'The Fairmont Banff Springs Hotel',
  brief:
    'Dark Rundle-stone main hotel with eleven-storey central tower, steep green-gray copper roofs, stacked shed dormers, angled end pavilions and lower public-room wings.',
  camera: [158, 106, 208],
  lookAt: [-10, 19, 4],
  qaCameras: [
    { name: 'front', position: [133, 69, 191], lookAt: [-8, 22, 8] },
    { name: 'back', position: [-142, 80, -180], lookAt: [-10, 24, -9] },
  ],
  build: banff,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'South entrance road forecourt [59,33], at the actual hotel rather than the displaced Qualla story coordinate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-banff-springs-hotel.mjs',
    level: 'skyline',
    export: 'banffSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'banffDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'banffStreet', errorMeters: 0.22, surfaces },
    },
  },
  limitations: [
    'Original medium-fi main-hotel exterior based on three individually inspected local Qualla photographs, the hotel floor plan, Parks Canada description and mapped roof context.',
    'Heights, roof intersections, hidden elevations, masonry courses and detailed ornament are photographic interpretations, not measured architectural drawings.',
    'Main stone hotel and Rundle cross-wing included; later Gatehouse, conference buildings, pool/spa additions, landscape terraces and interiors excluded.',
    'Independent terrain is unflattened. Actual footprint placement supersedes the displaced story point; footprint suppression remains disabled.',
  ],
};
