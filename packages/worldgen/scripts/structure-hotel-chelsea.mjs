/** Hotel Chelsea: individually inspected local Qualla facade and ironwork photographs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/dr/dr5/hotel_chelsea/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  brick = rgb('9c4d43'),
  cream = rgb('d7c9ad'),
  iron = rgb('333b3e'),
  metal = rgb('8d999d'),
  roof = rgb('606c70'),
  glass = rgb('536b79'),
  wood = rgb('b18157'),
  red = rgb('a53636'),
  concrete = brick;
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
function prism(o, loops, low, high, color = concrete, slot = 'wall') {
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
function line(o, slot, a, b, w, color) {
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
    color,
  );
}
function upNormal(p) {
  const n = normalFor(...p);
  return n[1] < 0 ? n.map((v) => -v) : n;
}
function roofQuad(o, p) {
  quad(o, 'roof', p, upNormal(p), roof);
}
function strip(o, a, b, w, color = iron) {
  line(o, 'metal', a, b, w, color);
  const t = facing(o, Math.PI);
  line(
    t,
    'metal',
    a.map((v, i) => (i === 1 ? v : -v)),
    b.map((v, i) => (i === 1 ? v : -v)),
    w,
    color,
  );
}
function window(o, x, y, z, w, h, d, { pale = false, transom = false } = {}) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 2) return;
  const col = pale ? cream : wood;
  for (const xx of [-w / 2, w / 2]) face(o, 'metal', x + xx, y, z + 0.025, 0.095, h, col);
  for (const yy of [y, y + h, y + h * 0.5]) face(o, 'metal', x, yy, z + 0.03, w, 0.08, col);
  face(o, 'metal', x, y, z + 0.035, 0.065, h, col);
  if (d > 2 && transom) {
    face(o, 'metal', x, y + h * 0.82, z + 0.045, w, 0.07, col);
    for (let i = 1; i < 4; i++)
      face(o, 'metal', x - w / 2 + (i * w) / 4, y + h * 0.82, z + 0.05, 0.035, h * 0.18, col);
  }
  if (d > 2) B(o, 'stone', x, y + h, z - 0.01, w + 0.35, 0.25, 0.22, cream);
  else face(o, 'stone', x, y + h, z + 0.07, w + 0.35, 0.25, cream);
}
function pointed(o, x, y, z, w, h, d) {
  const shoulder = y + h - w * 0.8,
    rr = w / 2,
    pts = [
      [x - rr, y, z],
      [x + rr, y, z],
      [x + rr, shoulder, z],
    ];
  // Two curved Gothic shoulders meet at the peak, rather than a round-headed substitute.
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    pts.push([x + rr * (1 - t), shoulder + (h - (shoulder - y)) * Math.sin((t * Math.PI) / 2), z]);
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    pts.push([x - rr * t, shoulder + (h - (shoulder - y)) * Math.cos((t * Math.PI) / 2), z]);
  }
  o.addConvexPolygon('glass', ref, pts, [0, 0, 1], (p) => [p[0], p[1]], glass);
  if (d > 0) {
    for (let i = 2; i < pts.length - 1; i++) beam(o, 'stone', pts[i], pts[i + 1], 0.28, 0.2, cream);
    for (const xx of [-rr, rr]) B(o, 'stone', x + xx, y, z, w * 0.055, shoulder - y, 0.2, cream);
  }
  if (d > 1) {
    face(o, 'metal', x, y, z + 0.12, 0.13, h, wood);
    for (const yy of [y + h * 0.35, y + h * 0.67]) face(o, 'metal', x, yy, z + 0.13, w, 0.12, wood);
  }
}
function gable(o, x, z, w, depth, y, rise, d, { central = false } = {}) {
  B(o, 'brick', x, 34.25, z - depth / 2, w, y - 34.25, depth, brick);
  for (const zz of [z, z - depth])
    o.addConvexPolygon(
      'brick',
      ref,
      [
        [x - w / 2, y, zz],
        [x + w / 2, y, zz],
        [x, y + rise, zz],
      ],
      [0, 0, zz === z ? 1 : -1],
      (p) => [p[0], p[1]],
      brick,
    );
  for (const sg of [-1, 1])
    roofQuad(o, [
      [x + (sg * w) / 2, y, z + 0.15],
      [x + (sg * w) / 2, y, z - depth],
      [x, y + rise, z - depth],
      [x, y + rise, z + 0.15],
    ]);
  if (d > 0) {
    for (const sg of [-1, 1])
      beam(
        o,
        'metal',
        [x + sg * (w / 2 + 0.1), y, z + 0.3],
        [x, y + rise + 0.08, z + 0.3],
        0.3,
        0.3,
        metal,
      );
  }
  if (!central) {
    if (d > 0) pointed(o, x, 39, z + 0.04, 3.6, 7.2, d);
    if (d > 1) {
      for (const xx of [-1.35, 1.35])
        window(o, x + xx, 35.2, z + 0.05, 1.8, 2.7, d, { transom: true });
      balcony(o, x, 34.7, z, 4.9, 1.15, d);
    }
  } else if (d > 0) {
    for (const xx of [-2, 0, 2]) pointed(o, x + xx, 44.4, z + 0.04, 1.25, 3.3, d);
    for (const xx of [-2.2, 0, 2.2]) {
      window(o, x + xx, 35.1, z + 0.04, 1.35, 2.65, d);
      window(o, x + xx, 39.1, z + 0.04, 1.35, 3.4, d);
    }
    cornice(o, x, z, 8, 43.0, d);
  }
}
function balcony(o, x, y, z, w, depth, d) {
  B(o, 'metal', x, y, z + depth / 2, w, 0.18, depth, iron);
  if (d < 1) return;
  B(o, 'metal', x, y + 1.05, z + depth, w, 0.07, 0.07, iron);
  if (d < 2) return;
  B(o, 'metal', x, y + 0.22, z + depth, w, 0.055, 0.06, iron);
  const n = Math.max(1, Math.round(w / 1.3)),
    step = w / n;
  for (let i = 0; i <= n; i++) {
    const xx = x - w / 2 + i * step;
    if (d > 2) B(o, 'metal', xx, y + 0.2, z + depth, 0.055, 0.88, 0.06, iron);
    else strip(o, [xx, y + 0.2, z + depth], [xx, y + 1.08, z + depth], 0.055);
    if (i < n && d > 2) {
      const cx = xx + step / 2,
        zz = z + depth + 0.015;
      // Open flower-and-leaf silhouette, authored from the individually inspected local close-up.
      strip(o, [cx, y + 0.23, zz], [cx, y + 0.96, zz], 0.035);
      for (const sg of [-1, 1])
        for (let k = 0; k < 2; k++) {
          const yy = y + 0.4 + k * 0.22,
            ex = cx + sg * step * 0.27;
          strip(o, [cx, yy - 0.08, zz], [ex, yy + 0.15, zz], 0.025);
          strip(o, [ex, yy + 0.15, zz], [cx + sg * 0.11, yy + 0.18, zz], 0.025);
        }
      const rr = 0.12;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4,
          b = ((k + 1) * Math.PI) / 4;
        strip(
          o,
          [cx + Math.cos(a) * rr, y + 0.83 + Math.sin(a) * rr, zz],
          [cx + Math.cos(b) * rr, y + 0.83 + Math.sin(b) * rr, zz],
          0.025,
        );
      }
    }
    if (d > 2 && i % 2 === 0)
      beam(
        o,
        'metal',
        [xx, y - 0.03, z + depth * 0.86],
        [xx, y - 0.6, z + 0.06],
        0.055,
        0.08,
        iron,
      );
  }
  for (const xx of [x - w / 2, x + w / 2]) {
    B(o, 'metal', xx, y + 1.05, z + depth / 2, 0.07, 0.07, depth, iron);
    for (let k = 1; k < (d > 2 ? 4 : 2); k++)
      B(o, 'metal', xx, y + 0.2, z + (depth * k) / 4, 0.04, 0.88, 0.04, iron);
  }
}
function cornice(o, x, z, w, y, d) {
  B(o, 'metal', x, y, z, w, 0.3, 0.75, metal);
  B(o, 'metal', x, y + 0.3, z + 0.09, w + 0.3, 0.16, 0.95, metal);
  if (d > 2)
    for (let xx = x - w / 2 + 0.5; xx < x + w / 2; xx += 1.1)
      B(o, 'metal', xx, y - 0.52, z - 0.04, 0.22, 0.52, 0.6, metal);
}
function dormer(o, x, d) {
  B(o, 'metal', x, 38.45, 9, 3.7, 3.55, 3, metal);
  o.addConvexPolygon(
    'metal',
    ref,
    [
      [x - 1.85, 42, 10.5],
      [x + 1.85, 42, 10.5],
      [x, 43.8, 10.5],
    ],
    [0, 0, 1],
    (p) => [p[0], p[1]],
    metal,
  );
  for (const sg of [-1, 1])
    roofQuad(o, [
      [x + sg * 1.95, 42, 10.6],
      [x + sg * 1.95, 42, 6.8],
      [x, 43.9, 6.8],
      [x, 43.9, 10.6],
    ]);
  if (d > 0) window(o, x, 38.85, 10.54, 2.7, 3.25, d);
  if (d > 1)
    for (const sg of [-1, 1])
      beam(o, 'metal', [x + sg * 1.85, 42, 10.68], [x, 43.8, 10.68], 0.22, 0.2, metal);
}
const font = {
  H: [
    [0, 0, 0, 1],
    [1, 0, 1, 1],
    [0, 0.5, 1, 0.5],
  ],
  O: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  T: [
    [0, 1, 1, 1],
    [0.5, 1, 0.5, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0.5, 0.8, 0.5],
    [0, 0, 1, 0],
  ],
  L: [
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  C: [
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  S: [
    [1, 1, 0, 1],
    [0, 1, 0, 0.5],
    [0, 0.5, 1, 0.5],
    [1, 0.5, 1, 0],
    [1, 0, 0, 0],
  ],
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.25, 0.5, 0.75, 0.5],
  ],
};
function letters(o, word, x, y, z, w, h, color) {
  const cw = w / word.length;
  for (let i = 0; i < word.length; i++)
    for (const [a, b, c, d] of font[word[i]] ?? [])
      line(
        o,
        'metal',
        [x + i * cw + a * cw * 0.75, y + b * h, z],
        [x + i * cw + c * cw * 0.75, y + d * h, z],
        0.065,
        color,
      );
}
function sign(o, d) {
  const t = facing(o, Math.PI / 2, 0, 17.05);
  B(t, 'metal', 1.1, 14, 0, 2.35, 12, 0.16, iron);
  B(t, 'metal', 1.1, 12.3, 0, 3, 1.7, 0.17, iron);
  if (d > 1) {
    for (let i = 0; i < 5; i++)
      letters(t, 'HOTEL'[i], 0.27, 23.5 - i * 2.25, 0.1, 1.65, 1.85, cream);
    letters(t, 'CHELSEA', -0.28, 12.68, 0.1, 2.95, 0.8, red);
    const b = facing(t, Math.PI);
    for (let i = 0; i < 5; i++)
      letters(b, 'HOTEL'[i], -1.95, 23.5 - i * 2.25, 0.1, 1.65, 1.85, cream);
    letters(b, 'CHELSEA', -2.5, 12.68, 0.1, 2.95, 0.8, red);
  }
  if (d > 0) for (const y of [14.4, 25.5]) B(t, 'metal', 0.8, y, 0, 4.2, 0.07, 0.1, iron);
}
function chelsea(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  // Mapped shell retains the three street projections and the separate rear projection.
  prism(o, [frame.geometry.outline], -0.65, 34.3, brick, 'brick');
  B(o, 'brick', 0, 34.3, -0.7, 53.3, 4.1, 24.6, brick);
  B(o, 'roof', 0, 38.4, -4, 53.3, 0.18, 18.5, roof);
  // Steep front roof plane behind four dormers; hidden rear roof is deliberately simple.
  roofQuad(o, [
    [-26.7, 38.5, 11.7],
    [26.7, 38.5, 11.7],
    [24.8, 44.3, 4.2],
    [-24.8, 44.3, 4.2],
  ]);
  roofQuad(o, [
    [-26.7, 38.5, -13],
    [26.7, 38.5, -13],
    [24.8, 44.3, -7],
    [-24.8, 44.3, -7],
  ]);
  roofQuad(o, [
    [-24.8, 44.3, -7],
    [24.8, 44.3, -7],
    [24.8, 44.3, 4.2],
    [-24.8, 44.3, 4.2],
  ]);
  for (const sg of [-1, 1])
    roofQuad(o, [
      [sg * 26.7, 38.5, -13],
      [sg * 26.7, 38.5, 11.7],
      [sg * 24.8, 44.3, 4.2],
      [sg * 24.8, 44.3, -7],
    ]);
  // Distinct tall center roof and pointed end gables, independently visible in both references.
  for (const x of [-23.1, 23.1]) gable(o, x, 13.18, 7.1, 7.4, 43.5, 4.6, d);
  gable(o, 0, 13.17, 7.8, 7.3, 44.3, 4.4, d, { central: true });
  const p = [
      [-4.1, 44.4, 12.6],
      [4.1, 44.4, 12.6],
      [4.1, 44.4, -1.5],
      [-4.1, 44.4, -1.5],
    ],
    ap = [0, 52.5, 5.5];
  for (let i = 0; i < 4; i++) {
    const q = [p[i], p[(i + 1) % 4], ap];
    o.addTriangle(
      'roof',
      ref,
      q,
      upNormal(q),
      q.map((p) => [p[0], p[1]]),
      roof,
    );
  }
  // Four massive chimney shafts, not thin generic domestic stacks.
  for (const x of [-19.7, -5.5, 5.5, 19.7]) {
    const h = Math.abs(x) < 10 ? 51.1 : 47.5;
    B(o, 'brick', x, 34.2, 8.6, 2.2, h - 34.2, 2.6, brick);
    B(o, 'brick', x, h - 0.7, 8.6, 2.65, 0.7, 3.0, brick);
    if (d > 1) {
      for (const xx of [-0.65, 0, 0.65])
        face(o, 'brick', x + xx, 36, 9.92, 0.12, h - 37.5, rgb('783d36'));
      B(o, 'brick', x, h - 0.9, 8.6, 2.4, 0.18, 2.8, brick);
    }
  }
  for (const x of [-15, -8.5, 8.5, 15]) dormer(o, x, d);
  // Faceted central bay, visible between the second and seventh balcony levels.
  prism(
    o,
    [
      [
        [-3.9, 11.5],
        [3.9, 11.5],
        [3.9, 13.1],
        [2.6, 14.1],
        [-2.6, 14.1],
        [-3.9, 13.1],
      ],
    ],
    8.65,
    30.55,
    brick,
    'brick',
  );
  // Eight balcony tiers above the commercial ground floor.
  for (let level = 0; level < 8; level++) {
    const y = 5 + level * 3.65;
    for (const x of [-11.75, 11.75]) {
      balcony(o, x, y, 11.7, 15.6, 1.25, d);
      if (d > 0)
        for (let i = 0; i < 5; i++)
          window(o, x - 6.15 + i * 3.075, y + 0.28, 11.75, 1.7, 2.75, d, { transom: true });
    }
    for (const x of [-23.1, 23.1]) {
      const full = [0, 1, 2, 5, 7].includes(level);
      balcony(o, x, y, 13.2, full ? 7.1 : 4.2, 1.2, d);
      if (d > 0)
        for (const dx of [-1.25, 1.25])
          window(o, x + dx, y + 0.28, 13.27, 1.6, 2.75, d, { transom: true });
    }
    if ([1, 6].includes(level)) balcony(o, 0, y, 14.15, 7.8, 1.4, d);
    if (d > 0) {
      if (level >= 1 && level <= 6) {
        window(o, 0, y + 0.28, 14.14, 1.55, 2.75, d);
        B(o, 'stone', 0, y + 0.06, 14.13, 5.2, 0.18, 0.22, cream);
        for (const sg of [-1, 1]) {
          const t = facing(o, sg * Math.atan2(1, 1.3), sg * 3.25, 13.6);
          window(t, 0, y + 0.28, 0.04, 1.15, 2.75, d);
          B(t, 'stone', 0, y + 0.06, 0.03, 1.64, 0.18, 0.22, cream);
        }
      } else {
        for (const x of [-2.35, 0, 2.35]) window(o, x, y + 0.28, 13.2, 1.25, 2.75, d);
        B(o, 'stone', 0, y + 0.06, 13.23, 7.85, 0.18, 0.22, cream);
      }
    }
  }
  for (const [x, z, w] of [
    [-23.1, 13.2, 7.3],
    [-11.75, 11.7, 15.8],
    [0, 13.2, 8],
    [11.75, 11.7, 15.8],
    [23.1, 13.2, 7.3],
  ])
    cornice(o, x, z, w, 34.1, d);
  if (d > 0) {
    // Upper paired windows and shallow curved pediments under the roof dormers.
    for (const x of [-11.75, 11.75])
      for (let i = 0; i < 5; i++) {
        const xx = x - 6.15 + i * 3.075;
        window(o, xx, 34.85, 11.72, 1.8, 2.65, d);
        if (d > 1) {
          for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 8,
              b = ((k + 1) * Math.PI) / 8;
            beam(
              o,
              'metal',
              [xx + Math.cos(a) * 1.2, 34.65 + Math.sin(a) * 0.55, 11.87],
              [xx + Math.cos(b) * 1.2, 34.65 + Math.sin(b) * 0.55, 11.87],
              0.13,
              0.14,
              metal,
            );
          }
        }
      }
    for (const x of [-11.75, 11.75]) cornice(o, x, 11.8, 15.8, 38.1, d);
    // Modern restored wood-framed shop fronts, dark iron columns and central entry canopy.
    for (const x of [-23.1, -17, -11, -5.6, 5.6, 11, 17, 23.1])
      window(o, x, 0.5, x === -23.1 || x === 23.1 ? 13.25 : 11.75, 4.1, 3.8, d);
    B(o, 'metal', 0, 4.9, 14.4, 8.1, 0.28, 4.6, iron);
    B(o, 'metal', 0, 8.55, 14.1, 8.1, 0.3, 3.6, iron);
    for (const x of [-3.2, 3.2]) {
      B(o, 'metal', x, 0, 15.8, 0.36, 8.55, 0.36, iron);
      for (const y of [3.8, 7.6]) B(o, 'metal', x, y, 15.8, 0.65, 0.38, 0.65, iron);
    }
    window(o, 0, 0.2, 13.25, 3.2, 4.4, d, { pale: false });
    // Red/cream barrel awning over El Quijote, left of center in the front-facing view.
    for (let i = 0; i < 14; i++) {
      const x = -8.6 + (i + 0.5) * 0.42;
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 12,
          b = ((j + 1) * Math.PI) / 12;
        quad(
          o,
          'metal',
          [
            [x - 0.21, 2.7 + Math.cos(a) * 1.3, 11.8 + Math.sin(a) * 1.8],
            [x + 0.21, 2.7 + Math.cos(a) * 1.3, 11.8 + Math.sin(a) * 1.8],
            [x + 0.21, 2.7 + Math.cos(b) * 1.3, 11.8 + Math.sin(b) * 1.8],
            [x - 0.21, 2.7 + Math.cos(b) * 1.3, 11.8 + Math.sin(b) * 1.8],
          ],
          [0, Math.cos((a + b) / 2), Math.sin((a + b) / 2)],
          i % 2 ? cream : red,
        );
      }
    }
    sign(o, d);
    // Rear windows and service projection are conservative, with no invented front ornament.
    const back = facing(o, Math.PI, 0, -13.32);
    for (let level = 0; level < 10; level++)
      for (let i = 0; i < 14; i++) {
        const xx = -24 + i * 3.7;
        if (xx > -20 && xx < -2) continue;
        window(back, xx, 1.1 + level * 3.7, 0.04, 1.45, 2.35, d, { pale: true });
      }
    const rear = facing(o, Math.PI, 10.6, -16.56);
    for (let level = 0; level < 9; level++)
      for (const x of [-6, -2, 2, 6])
        window(rear, x, 1.1 + level * 3.7, 0.04, 1.45, 2.35, d, { pale: true });
    // Party walls remain plain where adjacent buildings meet the hotel; only upper exposed windows.
    for (const sg of [-1, 1]) {
      const t = facing(o, (sg * Math.PI) / 2, sg * 26.85, -3);
      for (let level = 0; level < 3; level++)
        for (const x of [-6, 0, 6]) window(t, x, 26 + level * 3.7, 0, 1.4, 2.2, d, { pale: true });
    }
  }
  if (d > 1) {
    for (const x of [-23.1, 23.1]) {
      B(o, 'stone', x, 25.6, 13.25, 7, 0.24, 0.22, cream);
      for (const sg of [-1, 1])
        beam(o, 'stone', [x + sg * 2.9, 25.85, 13.3], [x, 26.45, 13.3], 0.25, 0.2, cream);
    }
    // Inset rooftop service enclosure; equipment and garden furnishing not reconstructed.
    B(o, 'brick', 12, 44.4, -3, 8, 1.3, 5, brick);
    B(o, 'roof', 12, 45.7, -3, 8.2, 0.15, 5.2, roof);
  }
}
export function chelseaSkyline(o) {
  chelsea(o, undefined, 0);
}
export function chelseaDistrict(o) {
  chelsea(o, undefined, 1);
}
export function chelseaStreet(o) {
  chelsea(o, undefined, 2);
}
const surfaces = {
  brick: { ...landmarkSurfaces.brick },
  stone: { ...landmarkSurfaces.stone },
  metal: { ...landmarkSurfaces.metal },
  roof: { ...landmarkSurfaces.roof },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const chelseaModel = {
  id: 'hotel_chelsea',
  recipe: 'structure-hotel-chelsea.mjs',
  key: 'hotel_chelsea',
  cell: 'dr/dr5',
  title: 'Hotel Chelsea',
  brief:
    'Restored red-brick West 23rd Street exterior with eight varied iron balcony tiers, three projecting sections, pointed end gables, four dormers, four massive chimneys and tall central roof.',
  camera: [72, 61, 106],
  lookAt: [0, 24, 0],
  qaCameras: [
    { name: 'front', position: [0, 30, 120], lookAt: [0, 25, 2] },
    { name: 'back', position: [-72, 64, -105], lookAt: [0, 25, -2] },
  ],
  build: chelsea,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Sidewalk [0,15] immediately in front of central West 23rd Street entrance, using independent terrain unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hotel-chelsea.mjs',
    level: 'skyline',
    export: 'chelseaSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'chelseaDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'chelseaStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior from individually inspected Qualla 2025 and 2010 facade photographs, 2011 ironwork detail and the official NYC landmark report. Not a survey or photogrammetric reconstruction.',
    'Mapped height 52.5 m provides a coarse upper roof control. Intermediate levels, roof slopes, rear/service openings and exact balcony panel spacing remain photographic approximations.',
    '2025 restored finishes take precedence over older white windows, air conditioners and shop signage. Flower-and-leaf ironwork is original simplified geometry; no photo pixels are embedded.',
    'The hotel parcel only; adjacent buildings, interiors and precise rooftop spa/garden fit-out are excluded. Hidden roof service enclosure and side/rear openings are conservative interpretations.',
    'Independent terrain is preserved unchanged, with foundation below the central sidewalk datum. Exact contact with another host DEM remains uncertain.',
  ],
};
