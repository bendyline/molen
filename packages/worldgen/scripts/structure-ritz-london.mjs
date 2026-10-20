/** Ritz London: historic main hotel; new arcade joints follow cleared1907elevations. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/gc/gcp/ritz_london/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  stone = rgb('d1c9b5'),
  pale = rgb('e0d8c6'),
  granite = rgb('b6b4a8'),
  roof = rgb('626e67'),
  copper = rgb('6da28a'),
  iron = rgb('34434a'),
  glass = rgb('687d7b'),
  white = rgb('dedfd1'),
  gold = rgb('b69b56'),
  navy = rgb('263d59');
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
function prism(o, loops, low, high, color = stone, slot = 'stone') {
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
  return facing(o, Math.atan2(b[1] - a[1], a[0] - b[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}
function ringRail(o, x, y, z, w, d, stoneRail = false) {
  const slot = stoneRail ? 'stone' : 'iron',
    col = stoneRail ? pale : iron;
  for (const yy of [y, y + 0.72]) {
    if (d < 3) face(o, slot, x, yy, z, w, 0.065, col);
    else B(o, slot, x, yy, z, w, 0.065, 0.1, col);
  }
  const step = stoneRail ? 0.42 : d > 2 ? 0.27 : 0.6;
  for (let u = -w / 2 + 0.12; u < w / 2; u += step) {
    if (stoneRail && d > 2)
      loft(
        o,
        slot,
        [
          [y + 0.07, 0.09],
          [y + 0.23, 0.13],
          [y + 0.48, 0.065],
          [y + 0.68, 0.09],
        ].map(([h, r]) => radialRing(h, r, r, 6, [x + u, z])),
        col,
      );
    else if (d < 3 || !stoneRail)
      face(o, slot, x + u, y + 0.05, z, stoneRail ? 0.14 : 0.035, 0.66, col);
    else
      B(o, slot, x + u, y + 0.05, z, stoneRail ? 0.14 : 0.035, 0.66, stoneRail ? 0.16 : 0.035, col);
  }
}
function stroke(o, slot, a, b, w, col) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    ox = ((-dy / len) * w) / 2,
    oy = ((dx / len) * w) / 2;
  quad(
    o,
    slot,
    [
      [a[0] + ox, a[1] + oy, a[2]],
      [b[0] + ox, b[1] + oy, b[2]],
      [b[0] - ox, b[1] - oy, b[2]],
      [a[0] - ox, a[1] - oy, a[2]],
    ],
    [0, 0, 1],
    col,
  );
}
function scroll(o, x, y, z, r, d) {
  if (d < 3) return;
  let last;
  for (let j = 0; j <= 8; j++) {
    const a = (j * Math.PI * 1.6) / 8,
      rr = r * (1 - j * 0.045),
      p = [x + Math.cos(a) * rr, y + Math.sin(a) * rr, z];
    if (last) stroke(o, 'iron', last, p, 0.032, iron);
    last = p;
  }
}
function balcony(o, x, y, z, w, d, deep = false) {
  if (d < 1) return;
  B(o, 'stone', x, y - 0.13, z + 0.13, w + 0.4, 0.15, deep ? 1.1 : 0.44, pale);
  if (d < 2) {
    face(o, 'iron', x, y + 0.15, z + 0.39, w, 0.32, iron);
    return;
  }
  ringRail(o, x, y + 0.04, z + (deep ? 0.65 : 0.38), w + 0.16, d);
  if (d > 2) {
    for (const u of [-0.34, 0.34]) scroll(o, x + u * w, y + 0.4, z + (deep ? 0.68 : 0.41), 0.21, d);
    scroll(o, x, y + 0.4, z + (deep ? 0.68 : 0.41), 0.25, d);
  }
}
function window(o, x, y, z, w, h, d, { bal = false, head = false, wide = false } = {}) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (!d) return;
  if (d === 1) return;
  if (d === 2) {
    for (const u of [-w / 2, w / 2])
      face(o, 'stone', x + u, y - 0.05, z + 0.025, 0.12, h + 0.1, pale);
    for (const v of [y - 0.05, y + h]) face(o, 'stone', x, v, z + 0.025, w + 0.16, 0.1, pale);
    face(o, 'stone', x, y, z + 0.04, 0.07, h, white);
    face(o, 'stone', x, y + h * 0.7, z + 0.045, w, 0.06, white);
    if (bal) balcony(o, x, y, z, w, d);
    return;
  }
  for (const u of [-w / 2, w / 2])
    B(o, 'stone', x + u, y - 0.06, z + 0.03, 0.14, h + 0.12, 0.16, pale);
  for (const v of [y - 0.08, y + h]) B(o, 'stone', x, v, z + 0.04, w + 0.27, 0.12, 0.2, pale);
  if (d > 1) {
    for (const u of [-(wide ? 0.29 : 0.25) * w, (wide ? 0.29 : 0.25) * w])
      face(o, 'stone', x + u, y, z + 0.09, 0.055, h, white);
    face(o, 'stone', x, y, z + 0.095, 0.075, h, white);
    face(o, 'stone', x, y + h * 0.7, z + 0.1, w, 0.065, white);
    if (head) {
      for (let j = 0; j < 12; j++) {
        const a = (j * Math.PI) / 12,
          b = ((j + 1) * Math.PI) / 12;
        beam(
          o,
          'stone',
          [x + (Math.cos(a) * (w + 0.3)) / 2, y + h + 0.06 + Math.sin(a) * 0.3, z + 0.1],
          [x + (Math.cos(b) * (w + 0.3)) / 2, y + h + 0.06 + Math.sin(b) * 0.3, z + 0.1],
          0.1,
          0.15,
          pale,
        );
      }
    }
  }
  if (bal) balcony(o, x, y, z, w, d);
}
function pediment(o, x, y, z, w, h, d) {
  const p = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
    [x, y + h, z],
  ];
  o.addTriangle(
    'stone',
    ref,
    p,
    [0, 0, 1],
    p.map((v) => [v[0], v[1]]),
    stone,
  );
  if (d > 0) {
    for (const [a, b] of [
      [p[0], p[2]],
      [p[2], p[1]],
    ])
      beam(o, 'stone', a, b, 0.2, 0.35, pale);
    B(o, 'stone', x, y - 0.14, z, w + 0.45, 0.2, 0.4, pale);
  }
}
function archPanel(o, x, y, z, w, stem, rise, d, col = glass) {
  const p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + stem, z],
    ],
    n = d > 2 ? 16 : d > 1 ? 12 : 8;
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + (Math.cos(a) * w) / 2, y + stem + Math.sin(a) * rise, z]);
  }
  o.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], col);
  if (d > 1) {
    for (const u of [-w / 2, 0, w / 2]) B(o, 'stone', x + u, y, z + 0.035, 0.08, stem, 0.1, white);
    face(o, 'stone', x, y + stem, z + 0.04, w, 0.09, white);
  }
}
// One closed concave extrusion per pier: real recessed joints, no stacked boxes
// or painted shadow strips. Depths are authoring estimates from the old plate.
function channelledPier(o, left, right, z, depth) {
  const profile = [[-2.4, z]];
  for (let k = 0; k < 7; k++) {
    const y = 0.5 + k * 0.48;
    profile.push([y, z], [y, z - 0.025], [y + 0.018, z - 0.025], [y + 0.018, z]);
  }
  profile.push([6.5, z], [6.5, z - depth], [-2.4, z - depth]);
  const indices = earcut(profile.flat());
  for (const [x, normal] of [
    [left, [-1, 0, 0]],
    [right, [1, 0, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [x, ...profile[j]]);
      o.addTriangle(
        'granite',
        ref,
        p,
        normal,
        p.map((v) => [v[2], v[1]]),
        granite,
      );
    }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      p = [
        [left, ...a],
        [right, ...a],
        [right, ...b],
        [left, ...b],
      ],
      normal = normalFor(p[0], p[1], p[2]),
      uv = p.map((v) => (Math.abs(normal[1]) > 0.5 ? [v[0], v[2]] : [v[0], v[1]]));
    o.addQuad('granite', ref, p, normal, uv, granite);
  }
}
function arcade(o, centers, z, depth, d) {
  const left = -35.13,
    right = 36.568,
    top = 6.5,
    stem = 3.65,
    r = 1.78;
  let last = left;
  for (const x of centers) {
    const start = x - r,
      end = x + r;
    if (d > 2) channelledPier(o, last, start, z, depth);
    else
      B(
        o,
        'granite',
        (last + start) / 2,
        -2.4,
        z - depth / 2,
        start - last,
        top + 2.4,
        depth,
        granite,
      );
    const n = d > 2 ? 16 : d > 1 ? 12 : 4;
    for (let j = 0; j < n; j++) {
      const a = (j * Math.PI) / n,
        b = ((j + 1) * Math.PI) / n;
      const pa = [x + Math.cos(a) * r, stem + Math.sin(a) * r, z],
        pb = [x + Math.cos(b) * r, stem + Math.sin(b) * r, z];
      quad(o, 'granite', [pa, pb, [pb[0], top, z], [pa[0], top, z]], [0, 0, 1], granite);
      const back = [
        pa.map((v, i) => (i === 2 ? v - depth : v)),
        pb.map((v, i) => (i === 2 ? v - depth : v)),
      ];
      quad(
        o,
        'granite',
        [pa, back[0], back[1], pb],
        [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
        granite,
      );
      if (d > 1) {
        const aa = a + 0.025,
          bb = b - 0.025;
        quad(
          o,
          'stone',
          [
            [x + Math.cos(aa) * r, stem + Math.sin(aa) * r, z + 0.02],
            [x + Math.cos(bb) * r, stem + Math.sin(bb) * r, z + 0.02],
            [x + Math.cos(bb) * (r + 0.3), stem + Math.sin(bb) * (r + 0.3), z + 0.02],
            [x + Math.cos(aa) * (r + 0.3), stem + Math.sin(aa) * (r + 0.3), z + 0.02],
          ],
          [0, 0, 1],
          pale,
        );
      }
    }
    if (d > 0) {
      B(o, 'stone', x, 5.45, z + 0.08, 0.35, 0.57, 0.22, pale);
      archPanel(o, x, 0.3, z - depth + 0.02, 3.6, 3.6, 1.4, d);
    }
    if (d === 2)
      for (let y = 0.5; y < 3.5; y += 0.48) {
        const w = start - last;
        if (w > 0.1) face(o, 'iron', (last + start) / 2, y, z + 0.01, w, 0.018, rgb('858b83'));
      }
    if (d > 2) {
      B(o, 'iron', x, 5.52, z - 1.6, 0.3, 0.32, 0.3, iron);
      B(o, 'glass', x, 5.56, z - 1.6, 0.23, 0.22, 0.23, rgb('d9c38c'));
    }
    last = end;
  }
  if (d > 2) channelledPier(o, last, right, z, depth);
  else
    B(
      o,
      'granite',
      (last + right) / 2,
      -2.4,
      z - depth / 2,
      right - last,
      top + 2.4,
      depth,
      granite,
    );
  B(o, 'stone', (left + right) / 2, 6.38, z - 0.2, right - left + 0.4, 0.25, 0.85, pale);
}
function facade(o, positions, z, d, { high = true, end = false } = {}) {
  const xmin = Math.min(...positions) - 2.5,
    xmax = Math.max(...positions) + 2.5;
  for (const y of [6.55, 17.15, ...(high ? [21.3, 24.65] : [18.9])])
    B(
      o,
      'stone',
      (xmin + xmax) / 2,
      y,
      z + 0.06,
      xmax - xmin,
      0.18,
      y === 17.15 ? 0.64 : 0.33,
      pale,
    );
  if (!d) return;
  for (let i = 0; i < positions.length; i++) {
    const x = positions[i],
      w =
        (end && i > 0 && i < 4) || (!end && positions.length === 15 && [1, 7, 13].includes(i))
          ? 2.65
          : 1.86;
    for (const [y, h] of [
      [7.0, 2.62],
      [10.35, 2.86],
      [13.85, 2.7],
    ])
      window(o, x, y, z + 0.04, w, h, d, { bal: y > 7, head: y > 13 });
    if (high) window(o, x, 18.02, z + 0.04, w, 2.48, d, { bal: true });
    if (high) window(o, x, 22.05, z - 0.28, w, 1.9, d);
    if (d > 2) {
      // Through-storey pilaster surrounds unify the first and second floors.
      for (const u of [-w / 2 - 0.28, w / 2 + 0.28])
        B(o, 'stone', x + u, 6.98, z + 0.08, 0.17, 9.8, 0.18, pale);
      B(o, 'stone', x, 9.72, z + 0.06, w + 0.1, 0.48, 0.12, stone);
      if (i % 3 === 1) B(o, 'stone', x, 13.25, z + 0.16, w + 0.6, 0.2, 0.52, pale);
    }
  }
  if (d > 1) {
    for (let x = xmin + 0.5; x < xmax; x += 2.1)
      B(o, 'stone', x, 16.88, z + 0.2, 0.22, 0.38, 0.4, pale);
    if (high) ringRail(o, (xmin + xmax) / 2, 21.52, z + 0.25, xmax - xmin, d, true);
  }
}
function mansard(o, x, z, w, depth, d, { tall = true } = {}) {
  const y = 24.9,
    top = tall ? 33.0 : 31.25,
    shrink = 2.35;
  const low = [
      [-w / 2, -depth / 2],
      [w / 2, -depth / 2],
      [w / 2, depth / 2],
      [-w / 2, depth / 2],
    ].map(([a, b]) => [x + a, y, z + b]),
    hi = [
      [-w / 2 + shrink, -depth / 2 + shrink],
      [w / 2 - shrink, -depth / 2 + shrink],
      [w / 2 - shrink, depth / 2 - shrink],
      [-w / 2 + shrink, depth / 2 - shrink],
    ].map(([a, b]) => [x + a, top, z + b]);
  loft(o, 'roof', [[...low].reverse(), [...hi].reverse()], roof);
  const p = [
    [x - w / 2 + shrink, top, z - depth / 2 + shrink],
    [x + w / 2 - shrink, top, z - depth / 2 + shrink],
    [x + w / 2 - shrink, top, z + depth / 2 - shrink],
    [x - w / 2 + shrink, top, z + depth / 2 - shrink],
  ];
  const apex = [x, top + 1.2, z];
  for (let i = 0; i < 4; i++)
    o.addTriangle(
      'roof',
      ref,
      [p[i], p[(i + 1) % 4], apex],
      upNormal([p[i], p[(i + 1) % 4], apex]),
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      roof,
    );
  if (d > 1) {
    for (let i = 0; i < 4; i++) beam(o, 'copper', low[i], hi[i], 0.3, 0.3, copper);
    for (let i = 0; i < 4; i++) beam(o, 'copper', hi[i], hi[(i + 1) % 4], 0.14, 0.18, copper);
  }
}
function dormer(o, x, y, z, w, d, { ped = false } = {}) {
  if (ped) {
    B(o, 'stone', x, y - 0.1, z - 0.35, w + 0.55, 6.4, 0.95, stone);
    window(o, x, y, z + 0.15, w, 1.9, d);
    window(o, x, y + 3.25, z + 0.15, w, 2.5, d, { bal: true });
    pediment(o, x, y + 6.3, z + 0.2, w + 1.25, 0.85, d);
    if (d > 1) {
      for (const u of [-w / 2 - 0.3, w / 2 + 0.3])
        B(o, 'stone', x + u, y - 0.12, z + 0.28, 0.25, 6.6, 0.24, pale);
      B(o, 'stone', x, y + 2.3, z + 0.2, w + 0.7, 0.24, 0.3, pale);
    }
    return;
  }
  if (d === 1) {
    face(o, 'glass', x, y, z + 0.15, w, 1.6, glass);
    return;
  }
  B(o, 'stone', x, y - 0.1, z - 0.35, w + 0.4, 2.1, 0.95, stone);
  window(o, x, y, z + 0.15, w, 1.6, d);
  B(o, 'iron', x, y + 1.65, z + 0.05, w + 0.35, 0.1, 0.7, iron);
}
function chimney(o, x, z, y, w = 1.2, d = 3) {
  B(o, 'stone', x, 24.7, z, w, y - 24.6, 1.05, stone);
  if (d > 0) B(o, 'stone', x, y - 0.3, z, w + 0.45, 0.35, 1.4, pale);
  if (d > 0) {
    pediment(facing(o, 0, x, z + 0.56), 0, y + 0.03, 0, w + 0.5, 0.35, d);
    for (const xx of [-0.3, 0, 0.3]) B(o, 'iron', x + xx, y + 0.4, z, 0.055, 0.4, 0.055, iron);
  }
}
function canopy(o, x, z, d) {
  const w = 8.5,
    depth = 2.4;
  for (let i = 0; i < 12; i++) {
    const a = -w / 2 + (i * w) / 12,
      b = -w / 2 + ((i + 1) * w) / 12;
    const pts = [
      [x + a, 5.4, z],
      [x + b, 5.4, z],
      [x + b, 5.25 + 0.45 * Math.sin(((i + 1) * Math.PI) / 12), z + depth],
      [x + a, 5.25 + 0.45 * Math.sin((i * Math.PI) / 12), z + depth],
    ];
    for (const tri of [
      [pts[0], pts[1], pts[2]],
      [pts[0], pts[2], pts[3]],
    ])
      o.addTriangle(
        'glass',
        ref,
        tri,
        upNormal(tri),
        tri.map((p) => [p[0], p[2]]),
        rgb('9bada6'),
      );
    if (d > 1) beam(o, 'iron', pts[0], pts[3], 0.075, 0.09, iron);
  }
  for (const side of [-1, 1]) {
    beam(
      o,
      'iron',
      [x + (side * w) / 2, 3.6, z],
      [x + (side * w) / 2, 5.4, z + depth],
      0.1,
      0.1,
      iron,
    );
    B(o, 'iron', x + side * 2.7, 3.45, z + 1.7, 0.34, 0.65, 0.34, iron);
    B(o, 'glass', x + side * 2.7, 3.54, z + 1.72, 0.28, 0.46, 0.28, rgb('d7c391'));
  }
  for (let i = 0; i < 8; i++)
    B(o, 'stone', x, i * 0.12, z + 0.1 + (8 - i) * 0.19, 4.1, 0.12, 0.4, pale);
  archPanel(o, x, 0.95, z + 0.04, 2.6, 2.5, 1.3, d, rgb('7b7256'));
  // Original blue entrance hood: half barrel, no copied heraldic mark.
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 12,
      b = ((i + 1) * Math.PI) / 12,
      p = [
        [x + Math.cos(a) * 1.75, 3.2 + Math.sin(a) * 1.25, z + 0.1],
        [x + Math.cos(b) * 1.75, 3.2 + Math.sin(b) * 1.25, z + 0.1],
        [x + Math.cos(b) * 1.75, 3.2 + Math.sin(b) * 1.25, z + 1.1],
        [x + Math.cos(a) * 1.75, 3.2 + Math.sin(a) * 1.25, z + 1.1],
      ];
    quad(o, 'iron', p, [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0], navy);
  }
  B(o, 'iron', x, 3.15, z + 1.1, 3.5, 0.12, 0.1, gold);
}
export function ritz(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  const r = cleanRing(frame.features[0].rings[0]);
  const full = [
    [36.568, 24.128],
    [-35.13, 24.128],
    [-30.7, -18.735],
    [-5.086, -16.061],
    [-5.706, -8.404],
    [40.054, -5.055],
  ];
  const ground = [];
  for (let i = 0; i < full.length; i++) {
    const a = full[i],
      b = full[(i + 1) % full.length],
      inside = a[1] <= 20.95,
      next = b[1] <= 20.95;
    if (inside) ground.push(a);
    if (inside !== next) {
      const t = (20.95 - a[1]) / (b[1] - a[1]);
      ground.push([a[0] + t * (b[0] - a[0]), 20.95]);
    }
  }
  const upper = [
    [36.568, 24.128],
    [-35.13, 24.128],
    [-30.7, -18.735],
    [-18, -17.41],
    [-19.4, 3.4],
    [23.8, 6.6],
    [25, -6.157],
    [40.054, -5.055],
  ];
  const tall = [
    [36.568, 24.128],
    [-35.13, 24.128],
    [-33.51, 8.5],
    [-19.2, 9.9],
    [-19.4, 3.4],
    [23.8, 6.6],
    [25, -6.157],
    [40.054, -5.055],
  ];
  prism(o, [r], -2.4, 0, granite, 'granite');
  prism(o, [ground], 0, 6.4, stone);
  prism(o, [r], 6.4, 6.55, pale);
  prism(o, [upper], 6.55, 19.0, stone);
  prism(o, [upper], 19.0, 19.12, roof, 'membrane');
  prism(o, [tall], 19.12, 21.3, stone);
  // Setback attic follows the main bar and Green Park end; the Arlington entrance wing remains lower.
  const attic = [
    [-34.15, 23.45],
    [35.85, 23.45],
    [39.05, -4.2],
    [25.7, -5.15],
    [24.7, 7.3],
    [-18.6, 4.3],
    [-18.5, 10.7],
    [-32.6, 9.3],
  ];
  prism(o, [attic], 21.3, 24.85, stone);
  prism(o, [attic], 24.85, 24.96, roof, 'membrane');
  const centers = [
    310, 384, 457, 544, 617, 690, 788, 874, 966, 1064, 1137, 1210, 1296, 1370, 1442,
  ].map((v) => -35.13 + ((v - 250) / 1255) * 71.698);
  arcade(o, centers, 24.13, 3.15, d);
  facade(o, centers, 24.16, d);
  // Subtle channelled piers at each projecting pavilion edge.
  if (d > 2)
    for (const x of [-34.55, -21.2, -7.9, 8.75, 22.0, 35.85])
      for (let y = 6.75; y < 21.2; y += 0.47) B(o, 'stone', x, y, 24.21, 0.82, 0.43, 0.17, pale);
  const pavilion = [
    [centers[1], 16.2],
    [centers[7], 17.7],
    [centers[13], 15.6],
  ];
  mansard(o, 0.7, 16.2, 71.6, 14.2, d, { tall: false });
  mansard(o, centers[1], 16.3, 16.2, 14.4, d);
  mansard(o, centers[7], 16.3, 17.7, 14.4, d);
  mansard(edgeFrame(o, [40.054, -5.055], [36.568, 24.128]), 0, -7.2, 29.4, 14.4, d);
  if (d > 0) {
    for (const x of centers) {
      const pav = pavilion.find(([c, w]) => Math.abs(x - c) < w / 2),
        top = pav ? 33 : 31.25;
      const lowerZ = 23.5 - ((26.0 - 24.9) * 2.35) / (top - 24.9);
      if (!pavilion.some(([c]) => Math.abs(x - c) < 1.0)) dormer(o, x, 25.65, lowerZ, 1.55, d);
      dormer(o, x, 28.8, 23.5 - ((28.8 - 24.9) * 2.35) / (top - 24.9), 1.35, d);
    }
    for (const [x] of pavilion) dormer(o, x, 22.0, 24.08, 2.05, d, { ped: true });
    if (d > 1) ringRail(o, 0.72, 24.97, 23.63, 70.3, d);
  }
  for (const [x, y] of [
    [-25.7, 36.8],
    [-16.6, 34.6],
    [-7.7, 34.6],
    [2.8, 36.9],
    [8.1, 34.6],
    [16.8, 34.6],
    [25.8, 36.8],
  ])
    chimney(o, x, 19.8, y, 1.15, d);
  // Green Park end uses its actual canted mapped edge and five axes.
  const westA = [40.054, -5.055],
    westB = [36.568, 24.128],
    west = edgeFrame(o, westA, westB),
    wl = Math.hypot(westB[0] - westA[0], westB[1] - westA[1]);
  const wx = [-11.2, -5.65, 0, 5.65, 11.2];
  if (d > 0) {
    for (const x of wx) archPanel(west, x, 0.12, 0.05, 3.75, 3.7, 1.8, d);
    facade(west, wx, 0.06, d, { end: true });
    for (const x of wx) {
      if (x !== 0) dormer(west, x, 25.7, -0.18, 1.7, d);
      dormer(west, x, 29.0, -1.05, 1.5, d);
    }
    dormer(west, 0, 22.0, 0.15, 2.7, d, { ped: true });
    if (d > 1) {
      ringRail(west, 0, 6.65, 0.37, wl - 1, d, true);
      ringRail(west, 0, 24.98, -0.35, wl - 1.6, d);
    }
    // Restaurant terrace and basement opening, following the visible Green Park level change.
    B(west, 'stone', 1.9, -1.5, 1.5, 22, 0.55, 3.0, granite);
    B(west, 'stone', 1.9, -0.95, 1.5, 22, 0.15, 3.0, pale);
    if (d > 1) {
      ringRail(west, 1.9, -0.75, 2.9, 22, d);
      for (let i = 0; i < 6; i++)
        B(west, 'stone', -9.5, -0.9 - i * 0.18, 3.0 + i * 0.25, 2.7, 0.18, 0.45, pale);
    }
    for (let i = 0; i < 48; i++) {
      const x = -9.1 + i * 0.45,
        pts = [
          [x, 5.5, 0.2],
          [x + 0.45, 5.5, 0.2],
          [x + 0.45, 4.0, 2.6],
          [x, 4.0, 2.6],
        ];
      quad(west, 'iron', pts, upNormal(pts), i % 2 ? white : rgb('4e6c5e'));
    }
  }
  chimney(west, -5.5, -4.2, 36.9, 1.1, d);
  chimney(west, 5.6, -4.2, 36.9, 1.1, d);
  chimney(west, 13.35, -0.4, 36.7, 1.05, d);
  // Arlington exterior: two high front axes and five lower entrance-wing axes.
  const arA = [-35.13, 24.128],
    arB = [-30.7, -18.735],
    ar = edgeFrame(o, arA, arB);
  const ax = [-16.6, -11.8, -6.8, -1.8, 3.2, 8.5, 14.9, 19];
  if (d > 0) {
    for (const x of ax) archPanel(ar, x, 0.25, 0.03, 3.7, 3.7, 1.6, d);
    facade(ar, ax.slice(0, 5), 0.05, d, { high: false });
    facade(ar, ax.slice(5), 0.05, d);
    canopy(ar, -1.8, 0.1, d);
    if (d > 1)
      for (const x of [-20, -10, 6, 21])
        for (let y = 0.4; y < 17.9; y += 0.5) B(ar, 'stone', x, y, 0.07, 0.7, 0.46, 0.15, pale);
  }
  // Rear public-room roofs are lower than the guest wings; no opaque full-height infill of the court.
  if (d > 0) {
    B(o, 'membrane', 3.4, 6.58, -0.9, 41.8, 0.13, 12.9, roof);
    B(o, 'glass', 0, 6.76, -1.2, 17, 0.14, 7, glass);
    if (d > 1) for (let x = -8; x < 9; x += 1.4) B(o, 'iron', x, 6.91, -1.2, 0.06, 0.06, 7, iron);
    for (const [x, z, w, dd, y] of [
      [-25, -8, 6, 5, 19.12],
      [30, 5, 4, 4, 25],
      [2, 15, 4, 3, 25],
    ])
      B(o, 'membrane', x, y, z, w, 0.65, dd, roof);
    const rear = edgeFrame(o, [-19.4, 3.4], [23.8, 6.6]);
    for (let x = -19; x < 21; x += 4)
      for (const y of [8, 11.4, 14.8, 18.1]) window(rear, x, y, 0.04, 1.3, 2, d);
  }
}
export function ritzSkyline(o) {
  ritz(o, undefined, 0);
}
export function ritzDistrict(o) {
  ritz(o, undefined, 1);
}
export function ritzStreet(o) {
  ritz(o, undefined, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.8, metallic: 0 },
  roof: { ...landmarkSurfaces.roof },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.9, metallic: 0 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.65, metallic: 0.45 },
  iron: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const ritzModel = {
  id: 'ritz_london',
  recipe: 'structure-ritz-london.mjs',
  key: 'ritz_london',
  cell: 'gc/gcp',
  title: 'The Ritz Hotel, London',
  brief:
    'Historic main hotel: open fifteen-axis Piccadilly arcade, stone facades, three mansard pavilions, copper roof ribs, five-bay Green Park end and lower Arlington entrance with canopy.',
  camera: [94, 57, 112],
  lookAt: [0, 15, 5],
  qaCameras: [
    { name: 'front', position: [0, 26, 140], lookAt: [0, 17, 8] },
    { name: 'back', position: [-83, 65, -102], lookAt: [0, 14, 3] },
    { name: 'arcade-joints', position: [-27, 2.2, 29], lookAt: [-29, 2, 24.13] },
    { name: 'arcade-depth', position: [-29, 3, 27.8], lookAt: [-26, 2.8, 22.4] },
  ],
  build: ritz,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: 'Piccadilly sidewalk [0,24.8], independent terrain unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ritz-london.mjs',
    level: 'skyline',
    export: 'ritzSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'ritzDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'ritzStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    'Historic main Ritz hotel. New close-range arcade rustication follows the cleared Qualla1907Piccadilly/GreenPark elevations; seven recessed joints on all16piers. Later22Arlington extension and William Kent House remain excluded.',
    'Earlier massing, canopy and roof details inherited from prior work. Modern attribution photographs and private2021survey imagery are excluded as current controls. Full historic-main-hotel fidelity remains pending adequate public-domain review of all retained details.',
    'Joint spacing follows the existing course rhythm;18mm height and25mm depth are authoring estimates. The1907plate does not establish current condition or exact profiles. Close-only construction keeps the three lower geometry levels unchanged.',
    'Dated model scope does not claim to reproduce all current roof/construction changes. No temporary scaffolding, crowds, Christmas decorations or interiors.',
    'Footprint is mapped; vertical dimensions, upper court geometry, rear windows, equipment and fine sculptural profiles are approximations. Main arcade remains open and rear court is not filled to full height.',
    'Original simplified ironwork, stone balustrades and roof ornament; no copied photograph textures, hotel crest or exact lettering.',
    'Independent terrain is unchanged. Deep foundation accommodates the rearward slope; exact contact can differ on another host DEM.',
  ],
};
