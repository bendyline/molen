/** Hotel des Indes: individually researched Qualla exterior and AHN4 roof profile. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/u1/u17/hotel_des_indes/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  ochre = rgb('e6c16b'),
  stone = rgb('999d93'),
  pale = rgb('c4c3ae'),
  roof = rgb('697575'),
  iron = rgb('35413a'),
  glass = rgb('4a6268'),
  gold = rgb('c4a24c'),
  burgundy = rgb('792d33');
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
  return facing(o, Math.atan2(a[1] - b[1], b[0] - a[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}
function rail(o, x, y, z, w, d) {
  B(o, 'stone', x, y, z, w, 0.12, 0.3, stone);
  B(o, 'stone', x, y + 0.75, z, w, 0.13, 0.32, stone);
  if (d < 2) return;
  for (let u = -w / 2 + 0.2; u < w / 2; u += 0.44) {
    if (d === 2) face(o, 'stone', x + u, y + 0.1, z, 0.14, 0.65, stone);
    else
      loft(
        o,
        'stone',
        [
          [y + 0.12, 0.08],
          [y + 0.3, 0.12],
          [y + 0.53, 0.06],
          [y + 0.7, 0.08],
        ].map(([h, r]) => radialRing(h, r, r, 6, [x + u, z])),
        stone,
      );
  }
}
function arch(o, x, y, z, w, h, d, col = glass) {
  const stem = h - 0.26,
    p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + stem, z],
    ],
    n = d > 1 ? 10 : 4;
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + (Math.cos(a) * w) / 2, y + stem + Math.sin(a) * 0.26, z]);
  }
  o.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], col);
}
function window(
  o,
  x,
  y,
  z,
  w,
  h,
  d,
  { arched = true, ornament = 0, bal = false, light = false } = {},
) {
  if (!d) return;
  if (arched) arch(o, x, y, z, w, h, d);
  else face(o, 'glass', x, y, z, w, h, glass);
  if (d === 1) return;
  const col = light ? pale : stone;
  if (d === 2) {
    for (const u of [-w / 2 - 0.08, w / 2 + 0.08])
      face(o, 'stone', x + u, y - 0.07, z + 0.035, 0.16, h + 0.17, col);
    for (const yy of [y - 0.15, y + h]) face(o, 'stone', x, yy, z + 0.06, w + 0.4, 0.16, col);
    face(o, 'iron', x, y, z + 0.11, 0.075, h, iron);
    face(o, 'iron', x, y + h * 0.77, z + 0.12, w, 0.07, iron);
    return;
  }
  for (const u of [-w / 2 - 0.08, w / 2 + 0.08])
    B(o, 'stone', x + u, y - 0.07, z + 0.035, 0.16, h + 0.17, 0.16, col);
  B(o, 'stone', x, y - 0.15, z + 0.06, w + 0.45, 0.16, 0.35, col);
  if (arched) {
    const n = d > 2 ? 10 : 6;
    for (let j = 0; j < n; j++) {
      const a = (j * Math.PI) / n,
        b = ((j + 1) * Math.PI) / n;
      beam(
        o,
        'stone',
        [x + (Math.cos(a) * (w + 0.17)) / 2, y + h - 0.26 + Math.sin(a) * 0.32, z + 0.08],
        [x + (Math.cos(b) * (w + 0.17)) / 2, y + h - 0.26 + Math.sin(b) * 0.32, z + 0.08],
        0.17,
        0.18,
        col,
      );
    }
  } else B(o, 'stone', x, y + h, z + 0.06, w + 0.32, 0.14, 0.2, col);
  face(o, 'iron', x, y, z + 0.11, 0.075, h, iron);
  face(o, 'iron', x, y + h * 0.77, z + 0.12, w, 0.07, iron);
  if (d > 2) {
    for (const sign of [-1, 1])
      face(o, 'glass', x + sign * w * 0.35, y + 0.18, z + 0.025, w * 0.22, h * 0.68, rgb('b0b4a5'));
    face(o, 'iron', x, y + h - 0.17, z + 0.14, w, 0.16, iron);
    if (ornament === 1) {
      B(o, 'stone', x, y + h + 0.12, z + 0.13, 0.35, 0.45, 0.26, col);
      B(o, 'stone', x, y + h + 0.53, z + 0.15, 0.55, 0.13, 0.31, col);
    }
    if (ornament === 2) {
      for (const sign of [-1, 1])
        for (let j = 0; j < 6; j++) {
          const a = (j * Math.PI) / 6,
            b = ((j + 1) * Math.PI) / 6;
          beam(
            o,
            'stone',
            [x + sign * 0.16 + Math.cos(a) * 0.22, y + h + 0.13 + Math.sin(a) * 0.2, z + 0.12],
            [x + sign * 0.16 + Math.cos(b) * 0.22, y + h + 0.13 + Math.sin(b) * 0.2, z + 0.12],
            0.09,
            0.12,
            col,
          );
        }
    }
  }
  if (bal) {
    face(o, 'iron', x, y + 0.12, z + 0.18, w, 0.045, iron);
    face(o, 'iron', x, y + 0.48, z + 0.18, w, 0.045, iron);
    for (let u = -w / 2 + 0.13; u < w / 2; u += 0.28)
      face(o, 'iron', x + u, y + 0.13, z + 0.18, 0.03, 0.34, iron);
  }
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
    p.map((p) => [p[0], p[1]]),
    stone,
  );
  for (const [a, b] of [
    [p[0], p[2]],
    [p[2], p[1]],
    [p[0], p[1]],
  ])
    beam(o, 'wall', a, b, 0.3, 0.45, ochre);
  if (d > 1) {
    // Original abstract relief, not a copied hotel crest.
    for (let i = -3; i <= 3; i++) {
      const xx = x + i * w * 0.09,
        yy = y + 0.4 + (1 - Math.abs(i) / 4) * h * 0.32;
      B(o, 'stone', xx, yy, z + 0.08, 0.25, 0.36, 0.16, pale);
    }
    const n = 16,
      p = [];
    for (let j = 0; j < n; j++) {
      const a = (j * Math.PI * 2) / n;
      p.push([x + Math.cos(a) * 0.5, y + 0.85 + Math.sin(a) * 0.67, z + 0.12]);
    }
    o.addConvexPolygon('metal', ref, p, [0, 0, 1], (p) => [p[0], p[1]], burgundy);
  }
}
function semicircle(o, slot, x, z, r, y0, y1, col, d = 3) {
  const n = d > 1 ? 24 : 8;
  for (let j = 0; j < n; j++) {
    const a = (j * Math.PI) / n,
      b = ((j + 1) * Math.PI) / n;
    const p = [
      [x + Math.cos(a) * r, y0, z + Math.sin(a) * r],
      [x + Math.cos(b) * r, y0, z + Math.sin(b) * r],
      [x + Math.cos(b) * r, y1, z + Math.sin(b) * r],
      [x + Math.cos(a) * r, y1, z + Math.sin(a) * r],
    ];
    quad(o, slot, p, [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)], col);
  }
}
function entrance(o, d) {
  const x = -1.5,
    z = 9.32,
    r = 2.35;
  semicircle(o, 'metal', x, z, r, 3.05, 3.72, burgundy, d);
  for (const y of [3.04, 3.69]) semicircle(o, 'metal', x, z, r + 0.025, y, y + 0.055, gold, d);
  semicircle(o, 'glass', x, z, 1.37, 0.1, 2.9, glass, d);
  for (const y of [0.1, 2.83]) semicircle(o, 'metal', x, z, 1.39, y, y + 0.13, gold, d);
  if (d) {
    for (let j = 0; j <= 8; j++) {
      const a = (j * Math.PI) / 8;
      B(o, 'metal', x + Math.cos(a) * 1.39, 0.1, z + Math.sin(a) * 1.39, 0.055, 2.75, 0.055, gold);
    }
    const n = d > 1 ? 24 : 8;
    for (let j = 0; j < n; j++)
      for (let k = 0; k < 4; k++) {
        const pt = (i, l) => {
          const a = (i * Math.PI) / n,
            t = (l * Math.PI) / 10,
            rr = r * Math.cos(t);
          return [x + Math.cos(a) * rr, 3.75 + Math.sin(t) * 1.15, z + Math.sin(a) * rr];
        };
        const p = [pt(j, k), pt(j + 1, k), pt(j + 1, k + 1), pt(j, k + 1)];
        for (const tri of [
          [p[0], p[1], p[2]],
          [p[0], p[2], p[3]],
        ])
          o.addTriangle(
            'glass',
            ref,
            tri,
            upNormal(tri),
            tri.map((p) => [p[0], p[2]]),
            rgb('b4b2a0'),
          );
        if (d > 1 && j % 2 === 0) beam(o, 'metal', p[0], p[3], 0.035, 0.035, gold);
      }
    B(o, 'metal', x, 4.84, z + 0.2, 0.75, 0.1, 0.35, burgundy);
  }
  if (d > 1) {
    for (const sign of [-1, 1]) {
      B(o, 'metal', x + sign * 2.5, 0, z + 1.1, 0.14, 4.1, 0.14, iron);
      B(o, 'glass', x + sign * 2.5, 4.1, z + 1.1, 0.27, 0.38, 0.27, pale);
    }
  }
}
function dormer(o, x, y, z, d) {
  if (d === 0) return;
  B(o, 'stone', x, y - 0.12, z - 0.38, 1.75, 1.9, 1.15, stone);
  window(o, x, y, z + 0.21, 1.3, 1.58, d, { arched: false, light: true });
  B(o, 'stone', x, y + 1.82, z - 0.12, 2, 0.15, 1.6, pale);
}
function indes(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  const r = cleanRing(frame.features[0].rings[0]).filter(([_x, z]) => z < 10),
    court = [
      [-8, -18],
      [0, -18],
      [0, -10],
      [-8, -10],
    ];
  // The mapped entrance projection is a canopy, not part of the tall wall.
  prism(o, [r], -1.8, 5.25, stone, 'stone');
  prism(o, [r, court], 5.25, 20.5, ochre, 'wall');
  prism(o, [court], 5.25, 12.3, rgb('898d83'), 'membrane');
  const outer = [
      [-18.7, 9.3],
      [10.55, 9.1],
      [11.9, 8.48],
      [13.64, 6.34],
      [16.7, -8.05],
      [20.925, -27.895],
      [18.064, -30.836],
      [-17.319, -29.249],
      [-15.83, -8.58],
      [-19.818, -8.045],
    ],
    inner = [
      [-15, 3.5],
      [8, 3.5],
      [9, 3],
      [10, 1],
      [12, -10],
      [16, -25],
      [15, -26],
      [-12, -25],
      [-11, -10],
      [-15, -7],
    ];
  // AHN4 roof returns are around 28.55 m NAP, approximately 26 m above the street.
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      lo = (p) => (p[1] < -8 ? 22.1 : 20.5);
    const p = [[...outer[i]], [...outer[j]]],
      a = [p[0][0], lo(p[0]), p[0][1]],
      b = [p[1][0], lo(p[1]), p[1][1]],
      c = [inner[j][0], 26, inner[j][1]],
      e = [inner[i][0], 26, inner[i][1]];
    for (const tri of [
      [a, b, c],
      [a, c, e],
    ])
      o.addTriangle(
        'roof',
        ref,
        tri,
        upNormal(tri),
        tri.map((p) => [p[0], p[2]]),
        roof,
      );
  }
  prism(o, [inner, court], 20.5, 26.02, roof, 'roof');
  const rearUpper = [
    [15.95, -8],
    [20.925, -27.895],
    [18.064, -30.836],
    [-17.319, -29.249],
    [-16.2, -18],
    [-8, -18],
    [0, -18],
    [0, -10],
  ];
  prism(o, [rearUpper], 20.5, 22.1, ochre, 'wall');
  // Continuous facade cornices; each frontage keeps its mapped orientation.
  const front = facing(o, 0, 0, 9.42),
    xs = [-16.5, -12.6, -8.7, -5.4, -1.5, 2.4, 7.3];
  for (const y of [5.18, 10.9, 19.7, 20.06])
    B(front, 'stone', -3.6, y, 0, 31.2, 0.18, y < 6 ? 0.65 : 0.4, y > 19 ? ochre : stone);
  for (const x of xs) {
    window(front, x, 0.75, 0.035, 2.05, 3.5, d, { arched: true });
    window(front, x, 6.12, 0.035, 2.07, 3.9, d, { ornament: 1 });
    window(front, x, 11.82, 0.035, 2.06, 3.3, d, { ornament: 2, bal: true });
    window(front, x, 16.45, 0.035, 2.02, 2.55, d, { arched: false, bal: true });
    if (d > 0) rail(front, x, 5.43, 0.38, 3.75, d);
    if (d > 1) {
      B(front, 'stone', x, 4.82, 0.24, 2.7, 0.18, 0.8, stone);
      for (const u of [-1.35, 1.35]) {
        B(front, 'stone', x + u, 4.15, 0.2, 0.27, 0.63, 0.4, stone);
        B(front, 'stone', x + u, 3.98, 0.08, 0.22, 0.18, 0.25, stone);
      }
    }
  }
  for (const x of [-7.35, 4.35])
    if (d > 1)
      for (let y = 5.4; y < 19.8; y += 0.58) B(front, 'wall', x, y, 0.05, 0.66, 0.54, 0.17, ochre);
  pediment(front, -1.5, 20.15, 0.13, 13.3, 2.55, d);
  if (d > 0)
    for (const x of [-17.9, -10.7, 10]) {
      B(front, 'stone', x, 20.3, -0.15, 0.55, 0.75, 0.55, stone);
      loft(
        front,
        'metal',
        [
          [21.05, 0.17],
          [21.25, 0.34],
          [21.65, 0.29],
        ].map(([y, r]) => radialRing(y, r, r, d > 1 ? 10 : 6, [x, -0.15])),
        burgundy,
      );
    }
  if (d > 0) {
    rail(front, -13.2, 20.3, -0.15, 10, d);
    rail(front, 8.05, 20.3, -0.15, 6.4, d);
  }
  if (d > 1) {
    for (let y = 0.45; y < 5; y += 0.48) {
      let last = -18.65;
      for (const x of xs) {
        const end = x - 1.2;
        if (end > last)
          face(front, 'stone', (last + end) / 2, y, 0.018, end - last, 0.025, rgb('787f78'));
        last = x + 1.2;
      }
      if (last < 10.5)
        face(front, 'stone', (last + 10.5) / 2, y, 0.018, 10.5 - last, 0.025, rgb('787f78'));
    }
  }
  entrance(o, d);
  // Rounded corner: one window axis tangent to the curve.
  const corner = edgeFrame(o, [10.9, 9.49], [13.99, 6.74]);
  for (const [y, h, ornament] of [
    [0.75, 3.5, 0],
    [6.12, 3.9, 1],
    [11.82, 3.3, 2],
    [16.45, 2.55, 0],
  ])
    window(corner, 0, y, 0.07, 2.05, h, d, { arched: y < 16, ornament, bal: y > 10 });
  if (d > 0) rail(corner, 0, 5.43, 0.37, 3.8, d);
  // Long street side: a fourth upper row near the rear, beneath a dormered mansard.
  const side = edgeFrame(o, [13.6392, 6.3442], [20.9251, -27.8956]),
    L = Math.hypot(7.286, -34.24);
  for (const y of [5.18, 10.9, 19.7])
    B(side, 'stone', 0, y, 0, L, 0.16, 0.4, y > 19 ? ochre : stone);
  for (let x = -L / 2 + 2; x < L / 2; x += 3.9) {
    for (const [y, h] of [
      [0.75, 3.5],
      [6.12, 3.9],
      [11.82, 3.3],
      [16.45, 2.55],
    ])
      window(side, x, y, 0.055, 1.85, h, d, {
        arched: y < 16,
        ornament: y === 6.12 ? 1 : 0,
        bal: y > 10,
      });
    if (x > 0) window(side, x, 20.3, 0.055, 1.85, 1.55, d, { arched: false });
    if (d > 0 && x < 0) rail(side, x, 5.43, 0.3, 3.7, d);
    if (x > 0) dormer(side, x, 23.05, -1.1, d);
  }
  if (d > 1)
    for (let y = 0.45; y < 5; y += 0.48)
      for (let x = -L / 2 + 2; x < L / 2 - 3; x += 3.9)
        face(side, 'stone', x + 1.95, y, 0.02, 1.65, 0.025, rgb('787f78'));
  const cornerBack = edgeFrame(o, [20.9251, -27.8956], [18.0644, -30.8365]);
  for (const [y, h] of [
    [0.75, 3.5],
    [6.12, 3.9],
    [11.82, 3.3],
    [16.45, 2.55],
    [20.3, 1.55],
  ])
    window(cornerBack, 0, y, 0.06, 1.85, h, d, { arched: y < 16, bal: y > 10 });
  if (d > 0) rail(cornerBack, 0, 5.43, 0.4, 3.6, d);
  if (d > 1) {
    const p = [];
    for (let j = 0; j < 20; j++) {
      const a = (j * Math.PI * 2) / 20;
      p.push([Math.cos(a) * 0.5, 24.1 + Math.sin(a) * 0.65, -0.7]);
    }
    cornerBack.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
    for (let j = 0; j < 20; j++) {
      const a = p[j],
        b = p[(j + 1) % 20];
      beam(cornerBack, 'stone', a, b, 0.12, 0.18, pale);
    }
  }
  const back = edgeFrame(o, [18.0644, -30.8365], [-17.3194, -29.2486]);
  for (let x = -15; x < 16; x += 3.7) {
    for (const y of [1, 6.12, 11.82, 16.45, 20.3])
      window(back, x, y, 0.055, 1.8, y === 20.3 ? 1.5 : 3, d, { arched: false, light: true });
    dormer(back, x, 23.05, -1.1, d);
  }
  // Hidden courtyard and party-wall faces are intentionally restrained estimates.
  if (d > 0) {
    const cfront = facing(o, Math.PI, -4, -10.04),
      cback = facing(o, 0, -4, -17.96);
    for (const c of [cfront, cback])
      for (const x of [-2.5, 2.5])
        for (const y of [14, 18, 22]) window(c, x, y, 0, 1.2, 2, d, { arched: false, light: true });
    for (const [x, z] of [
      [3, -12],
      [5, -20],
      [-10, -3],
    ])
      B(o, 'membrane', x, 26.03, z, 2.3, 0.55, 2.2, roof);
  }
}
export function indesSkyline(o) {
  indes(o, undefined, 0);
}
export function indesDistrict(o) {
  indes(o, undefined, 1);
}
export function indesStreet(o) {
  indes(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.9, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  roof: { ...landmarkSurfaces.roof },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.9, metallic: 0 },
  iron: { ...landmarkSurfaces.metal },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.55, metallic: 0.5 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const indesModel = {
  id: 'hotel_des_indes',
  recipe: 'structure-hotel-des-indes.mjs',
  key: 'hotel_des_indes',
  cell: 'u1/u17',
  title: 'Hotel des Indes (The Hague)',
  brief:
    'Ochre historic hotel with gray rusticated base, seven-axis main front, rounded corner, central pediment, glazed semicircular entrance and taller dormered rear mansard.',
  camera: [57, 39, 68],
  lookAt: [0, 11, -7],
  qaCameras: [
    { name: 'front', position: [-4, 18, 94], lookAt: [-3, 12, 1] },
    { name: 'back', position: [60, 40, -75], lookAt: [1, 12, -11] },
  ],
  build: indes,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: 'Lange Voorhout public sidewalk [0,14]; independent terrain evidence.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hotel-des-indes.mjs',
    level: 'skyline',
    export: 'indesSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'indesDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'indesStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior based on individually inspected local front, entrance and rear-corner photographs; interiors excluded.',
    'Mapped footprint and AHN4 surface heights control overall geometry; window/storey dimensions, upper court, roof joins and hidden elevations are estimates.',
    'Simplified original relief and ornament; no copied photo textures, exact crest or lettering. Temporary flags, holiday decorations and crowds excluded.',
    'AHN4 roof evidence dates to 2020–2022. Terrain ground beneath the building requires explicit gap interpolation; another host DEM can differ.',
  ],
};
