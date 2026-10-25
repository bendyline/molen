/** Winchester mansion core: local dated Qualla exteriors and museum roof/site evidence.
 * Explicit masses and roof intersections are photographic estimates, not an interior survey.
 */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/9q/9q9/winchester_mystery_house/',
  import.meta.url,
);
const yellow = rgb('d7c69a'),
  olive = rgb('69674f'),
  pale = rgb('eee4c7'),
  roofRed = rgb('9d5552'),
  glass = rgb('4e6465'),
  shadow = rgb('313b37'),
  sandstone = rgb('b5aa89');
const ref = 'palette:#ffffff';
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
function prism(o, loops, low, high, color = yellow, slot = 'wall') {
  const rings = loops.map((r, i) => {
    r = r.slice();
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
function facadeWindow(o, x, y, z, w, h, d, arched = false) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 2) return;
  for (const xx of [-w / 2 - 0.06, w / 2 + 0.06])
    face(o, 'wall', x + xx, y - 0.08, z + 0.015, 0.12, h + 0.16, pale);
  for (const yy of [y - 0.08, y + h]) face(o, 'wall', x, yy, z + 0.02, w + 0.24, 0.12, pale);
  face(o, 'wall', x, y + h * 0.46, z + 0.03, w, 0.065, pale);
  if (w > 1.8) face(o, 'wall', x, y, z + 0.04, 0.07, h, pale);
  if (d > 2) {
    B(o, 'wall', x, y - 0.18, z + 0.05, w + 0.4, 0.13, 0.25, olive);
    if (arched) {
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 12,
          b = ((i + 1) * Math.PI) / 12;
        beam(
          o,
          'wall',
          [x + (Math.cos(a) * w) / 2, y + h - w * 0.34 + Math.sin(a) * w * 0.34, z + 0.08],
          [x + (Math.cos(b) * w) / 2, y + h - w * 0.34 + Math.sin(b) * w * 0.34, z + 0.08],
          0.07,
          0.07,
          pale,
        );
      }
    }
  }
}
function finial(o, x, y, z, d) {
  if (d < 2) return;
  const n = d > 2 ? 8 : 4;
  loft(
    o,
    'wall',
    [
      [0, 0.12],
      [0.25, 0.13],
      [0.37, 0.22],
      [0.55, 0.1],
      [0.8, 0.13],
      [1.05, 0.035],
      [1.2, 0.01],
    ].map(([h, r]) => radialRing(y + h, r, r, n, [x, z])),
    pale,
  );
}
function gable(o, x, z, w, depth, y, rise, d, col = roofRed) {
  // Ridge runs along local Z; the positive-Z triangle is the front elevation.
  for (const sign of [-1, 1]) {
    const p = [
      [x + (sign * w) / 2, y, z - depth / 2],
      [x + (sign * w) / 2, y, z + depth / 2],
      [x, y + rise, z + depth / 2],
      [x, y + rise, z - depth / 2],
    ];
    quad(o, 'roof', p, [sign * rise, w / 2, 0], col);
  }
  for (const sign of [-1, 1]) {
    const p = [
      [x - w / 2, y, z + (sign * depth) / 2],
      [x + w / 2, y, z + (sign * depth) / 2],
      [x, y + rise, z + (sign * depth) / 2],
    ];
    o.addTriangle(
      'shingle',
      ref,
      p,
      [0, 0, sign],
      p.map((v) => [v[0], v[1]]),
      yellow,
    );
    if (d > 0) {
      for (const side of [-1, 1])
        beam(
          o,
          'wall',
          [x + (side * w) / 2, y, z + sign * (depth / 2 + 0.04)],
          [x, y + rise, z + sign * (depth / 2 + 0.04)],
          0.15,
          0.18,
          pale,
        );
    }
  }
  if (d > 1) {
    B(o, 'wall', x, y + rise - 0.02, z, 0.12, 0.13, depth + 0.1, pale);
    for (const sign of [-1, 1])
      B(o, 'wall', x + (sign * w) / 2, y - 0.12, z, 0.18, 0.18, depth, olive);
    finial(o, x, y + rise, z + depth / 2, d);
  }
  if (d > 2) {
    for (let t = 0.4; t < rise; t += 0.42) {
      const sidew = (w / 2) * (1 - t / rise);
      for (const sign of [-1, 1]) {
        const p = [
          [x + sign * sidew, y + t + 0.014, z - depth / 2],
          [x + sign * sidew, y + t + 0.014, z + depth / 2],
          [x + sign * (sidew - 0.025), y + t + 0.04, z + depth / 2],
          [x + sign * (sidew - 0.025), y + t + 0.04, z - depth / 2],
        ];
        quad(o, 'roof', p, [sign * rise, w / 2, 0], rgb('8b4b48'));
      }
    }
  }
}
function hip(o, x, z, w, dep, y, rise, d, col = roofRed) {
  const rx = Math.max(0.08, (w - dep) * 0.38),
    rz = Math.max(0.08, (dep - w) * 0.38);
  const low = [
      [-w / 2, -dep / 2],
      [w / 2, -dep / 2],
      [w / 2, dep / 2],
      [-w / 2, dep / 2],
    ],
    high = [
      [-rx, -rz],
      [rx, -rz],
      [rx, rz],
      [-rx, rz],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      p = [
        [x + low[i][0], y, z + low[i][1]],
        [x + low[j][0], y, z + low[j][1]],
        [x + high[j][0], y + rise, z + high[j][1]],
        [x + high[i][0], y + rise, z + high[i][1]],
      ];
    quad(o, 'roof', p, normalFor(...[p[3], p[2], p[1]]), col);
  }
  if (d > 1)
    for (const sign of [-1, 1]) {
      B(o, 'wall', x + (sign * w) / 2, y - 0.13, z, 0.16, 0.16, dep, pale);
      B(o, 'wall', x, y - 0.13, z + (sign * dep) / 2, w, 0.16, 0.16, pale);
    }
  if (d > 1) finial(o, x, y + rise, z, d);
}
function band(o, x, y, z, w, h, d, scallops = false) {
  face(o, 'shingle', x, y, z, w, h, yellow);
  if (!scallops || d < 3) return;
  // Original stylized cut-shingle outlines; no photograph is used as a texture.
  const pitch = 0.32;
  for (let row = 0; row < Math.floor(h / 0.23); row++)
    for (let xx = -w / 2 + pitch / 2; xx < w / 2; xx += pitch) {
      const cx = x + xx + ((row % 2) * pitch) / 2;
      if (cx > x + w / 2 - pitch / 2) continue;
      const cy = y + row * 0.23,
        p = [
          [cx - pitch * 0.45, cy + 0.23, z + 0.014],
          [cx + pitch * 0.45, cy + 0.23, z + 0.014],
          [cx + pitch * 0.45, cy + 0.1, z + 0.014],
          [cx + pitch * 0.28, cy + 0.015, z + 0.014],
          [cx, cy - 0.015, z + 0.014],
          [cx - pitch * 0.28, cy + 0.015, z + 0.014],
          [cx - pitch * 0.45, cy + 0.1, z + 0.014],
        ];
      o.addConvexPolygon(
        'shingle',
        ref,
        p,
        [0, 0, 1],
        (v) => [v[0], v[1]],
        row % 3 === 0 ? rgb('c8ae68') : rgb('d3bc75'),
      );
    }
}
function balustrade(o, w, y, z, d, col = olive) {
  B(o, 'wall', 0, y, z, w, 0.12, 0.15, col);
  B(o, 'wall', 0, y + 0.82, z, w, 0.14, 0.17, col);
  if (d < 2) return;
  for (let x = -w / 2 + 0.22; x < w / 2; x += d > 2 ? 0.32 : 0.75) {
    B(o, 'wall', x, y, z, 0.075, 0.84, 0.075, pale);
    if (d > 2) B(o, 'wall', x, y + 0.35, z, 0.14, 0.16, 0.14, pale);
  }
}
function block(o, x, z, w, dep, h, d, type = 'flat', rise = 0, customFront = false) {
  B(o, 'wall', x, -0.65, z, w, h + 0.65, dep, d === 0 ? yellow : olive);
  if (d > 0) {
    for (const [a, cx, cz, len] of [
      [0, x, z + dep / 2, w],
      [Math.PI, x, z - dep / 2, w],
      [Math.PI / 2, x + w / 2, z, dep],
      [-Math.PI / 2, x - w / 2, z, dep],
    ]) {
      const q = facing(o, a, cx, cz);
      face(q, 'wall', 0, 0.55, 0.015, len, h - 0.7, yellow);
      for (const y of [0.65, 3.9, h - 0.25])
        if (y < h) face(q, 'wall', 0, y, 0.035, len, 0.16, olive);
      const n = Math.max(1, Math.floor(len / 2.6));
      for (let i = 0; i < n; i++)
        for (const y of [1.2, 4.5, 7.7])
          if (y + 1.5 < h - 0.2 && !(customFront && a === 0))
            facadeWindow(
              q,
              -len / 2 + ((i + 0.5) * len) / n,
              y,
              0.055,
              Math.min(1.15, (len / n) * 0.6),
              1.6,
              d,
            );
    }
  }
  if (type === 'gable') gable(o, x, z, w + 0.4, dep + 0.4, h, rise, d);
  else if (type === 'cross')
    gable(facing(o, Math.PI / 2, x, z), 0, 0, dep + 0.4, w + 0.4, h, rise, d);
  else if (type === 'hip') hip(o, x, z, w + 0.4, dep + 0.4, h, rise, d);
  else {
    B(o, 'stone', x, h, z, w + 0.15, 0.08, dep + 0.15, rgb('b7ad98'));
    if (d > 0)
      for (const sign of [-1, 1]) {
        B(o, 'shingle', x + (sign * w) / 2, h, z, 0.17, 0.55, dep, yellow);
        B(o, 'shingle', x, h, z + (sign * dep) / 2, w, 0.55, 0.17, yellow);
      }
  }
}
function tower(o, x, z, r, y, d) {
  const n = d > 2 ? 32 : d > 1 ? 24 : d > 0 ? 12 : 8;
  loft(o, 'wall', [radialRing(-0.65, r, r, n, [x, z]), radialRing(y, r, r, n, [x, z])], yellow);
  loft(
    o,
    'roof',
    [
      radialRing(y + 0.08, r + 0.38, r + 0.38, n, [x, z]),
      radialRing(y + 0.4, r + 0.24, r + 0.24, n, [x, z]),
      radialRing(y + 4.2, 0.12, 0.12, n, [x, z]),
    ],
    roofRed,
  );
  if (d > 0) {
    for (const yy of [0.7, 3.8, y - 2.5, y - 0.12])
      loft(
        o,
        'wall',
        [
          radialRing(yy, r + 0.04, r + 0.04, n, [x, z]),
          radialRing(yy + 0.14, r + 0.04, r + 0.04, n, [x, z]),
        ],
        olive,
      );
    const bays = d > 1 ? 12 : 6;
    for (let i = 0; i < bays; i++) {
      const a = (i * 2 * Math.PI) / bays,
        q = facing(o, a, x + Math.sin(a) * (r + 0.025), z + Math.cos(a) * (r + 0.025));
      if (i % 3 === 0) facadeWindow(q, 0, 1.2, 0.015, r * 0.38, 2, d);
      else {
        face(q, 'wall', 0, 1.2, 0.015, r * 0.4, 2, olive);
        if (d > 2)
          for (let y = 1.3; y < 3.2; y += 0.15)
            face(q, 'wall', 0, y, 0.04, r * 0.4, 0.035, rgb('7c785c'));
      }
      // Upper round gallery remains visibly open behind its lattice.
      face(q, 'glass', 0, y - 2.15, 0.015, r * 0.55, 1.6, shadow);
      if (d > 1) {
        for (const xx of [-r * 0.3, 0, r * 0.3])
          face(q, 'wall', xx, y - 2.2, 0.035, 0.08, 1.75, olive);
        for (const yy of [y - 1.8, y - 1.35, y - 0.9])
          face(q, 'wall', 0, yy, 0.045, r * 0.62, 0.07, olive);
      }
    }
  }
  finial(o, x, y + 4.25, z, d);
}
function cupola(o, x, z, y, w, dep, h, d) {
  B(o, 'wall', x, y, z, w, h, dep, olive);
  if (d > 0)
    for (const [a, xx, zz, len] of [
      [0, x, z + dep / 2, w],
      [Math.PI, x, z - dep / 2, w],
      [Math.PI / 2, x + w / 2, z, dep],
      [-Math.PI / 2, x - w / 2, z, dep],
    ]) {
      const q = facing(o, a, xx, zz);
      face(q, 'shingle', 0, y + 0.1, 0.015, len, h - 0.15, yellow);
      facadeWindow(q, 0, y + 0.35, 0.04, len * 0.65, h * 0.48, d);
    }
  hip(o, x, z, w + 0.3, dep + 0.3, y + h, w * 0.57, d);
}
function mansion(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  if (d > 1) prism(o, frame.features[0].rings, -0.8, 0.35, sandstone, 'stone');
  // Rear mansion wings; narrow connections to other estate buildings are deliberately omitted.
  block(o, -6, -28.1, 18, 10.2, 4.7, d);
  block(o, 9, -8.5, 12, 13, 7.4, d, 'gable', 3.4);
  block(o, -3.5, -15.2, 15, 12.8, 6.1, d);
  block(o, -15.1, -15.5, 2.2, 13, 6.1, d);
  block(o, -12.7, -12, 2.6, 6, 6.1, d);
  block(o, -12.7, -21.1, 2.6, 1.8, 6.1, d);
  block(o, 9, 4.5, 12, 13.5, 8.1, d, 'gable', 3.7);
  block(o, -15.8, 3.2, 10.3, 24, 6.5, d);
  block(o, -4, 3, 12.8, 23.7, 8.5, d, 'hip', 2.9);
  block(o, -5, 15, 23, 7.2, 7.35, d, 'cross', 3.5);
  // Familiar east-front two-story body and long open veranda.
  block(o, -6.9, 24.1, 19.1, 14.8, 7.8, d, 'cross', 3.8, true);
  // Cross gables project from the longer north-south main roof.
  gable(o, -8.8, 28, 10.4, 11, 8, 5.45, d);
  gable(o, -0.6, 28.4, 6.3, 11.5, 8, 4.3, d);
  if (d > 0) {
    // Recessed attic loggia under the large central gable and projecting northern oriel.
    const arch = [
      [-9.85, 8.1, 33.56],
      [-7.75, 8.1, 33.56],
      [-7.75, 10.5, 33.56],
    ];
    for (let i = 1; i <= 12; i++) {
      const a = (i * Math.PI) / 12;
      arch.push([-8.8 + Math.cos(a) * 1.05, 10.5 + Math.sin(a) * 1.05, 33.56]);
    }
    o.addConvexPolygon('glass', ref, arch, [0, 0, 1], (p) => [p[0], p[1]], shadow);
    if (d > 1)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 12,
          b = ((i + 1) * Math.PI) / 12;
        beam(
          o,
          'wall',
          [-8.8 + Math.cos(a) * 1.1, 10.5 + Math.sin(a) * 1.1, 33.6],
          [-8.8 + Math.cos(b) * 1.1, 10.5 + Math.sin(b) * 1.1, 33.6],
          0.12,
          0.12,
          pale,
        );
      }
    for (const x of [-9.95, -7.65]) B(o, 'wall', x, 8.1, 33.6, 0.2, 3.3, 0.2, olive);
    balustrade(facing(o, 0, -8.8, 33.72), 2.35, 8.1, 0, d);
    for (const x of [-11.7, -5.9]) {
      const n = d > 2 ? 16 : 8,
        points = [];
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n;
        points.push([x + Math.cos(a) * 0.32, 9.95 + Math.sin(a) * 0.55, 33.57]);
      }
      o.addConvexPolygon('glass', ref, points, [0, 0, 1], (p) => [p[0], p[1]], glass);
      if (d > 1)
        for (let i = 0; i < n; i++) {
          const a = (i * 2 * Math.PI) / n,
            b = ((i + 1) * 2 * Math.PI) / n;
          quad(
            o,
            'wall',
            [
              [x + Math.cos(a) * 0.32, 9.95 + Math.sin(a) * 0.55, 33.58],
              [x + Math.cos(b) * 0.32, 9.95 + Math.sin(b) * 0.55, 33.58],
              [x + Math.cos(b) * 0.41, 9.95 + Math.sin(b) * 0.64, 33.58],
              [x + Math.cos(a) * 0.41, 9.95 + Math.sin(a) * 0.64, 33.58],
            ],
            [0, 0, 1],
            pale,
          );
        }
    }
    B(o, 'shingle', -0.6, 7.7, 34.1, 2.1, 2.3, 1.1, yellow);
    facadeWindow(o, -0.6, 8.1, 34.67, 1.25, 1.5, d, true);
    gable(o, -0.6, 34.15, 2.7, 1.5, 10.1, 1.2, d);
    for (const x of [-12.2, -10.1, -4.7, -2.3]) facadeWindow(o, x, 4.8, 31.57, 1.7, 2.1, d);
    // Projecting second-floor corner bays and the characteristic ornamented center panel.
    for (const [x, w] of [
      [-15.1, 3.2],
      [1, 3.4],
    ]) {
      B(o, 'shingle', x, 4.05, 32.4, w, 3.45, 2.0, yellow);
      for (const xx of [-0.65, 0.65]) facadeWindow(o, x + xx, 5, 33.43, 1.05, 1.8, d, x < 0);
      band(o, x, 4.05, 33.45, w, 0.7, d, true);
      for (const xx of [-w / 2, w / 2]) B(o, 'wall', x + xx, 4.1, 33.48, 0.13, 3.45, 0.13, olive);
      hip(o, x, 32.4, w + 0.5, 2.6, 7.55, 1.0, d);
    }
    face(o, 'wall', -7.65, 4.75, 31.59, 2.5, 2.3, olive);
    if (d > 1)
      for (const x of [-8.3, -7]) {
        face(o, 'shingle', x, 6.1, 31.62, 0.9, 0.8, yellow);
        for (const [dx, dy, w, h] of [
          [-0.3, 0, 0.16, 0.5],
          [0.3, 0, 0.16, 0.5],
          [0, 0.5, 0.75, 0.15],
          [0, 0.08, 0.4, 0.12],
        ])
          face(o, 'wall', x + dx, 5 + dy, 31.63, w, h, pale);
      }
    band(o, -6.9, 4.05, 31.6, 19.2, 0.65, d, true);
    for (const x of [-13.3, -9, -6.2, -3.5]) B(o, 'wall', x, 4.65, 31.65, 0.16, 3.05, 0.12, olive);
    for (const x of [-14, -10.8, -2.7, 0.7]) facadeWindow(o, x, 1.05, 31.61, 1.9, 2.15, d);
    face(o, 'glass', -6.9, 0.6, 31.63, 2.2, 2.9, shadow);
    if (d > 1) {
      for (const x of [-8.1, -5.7]) B(o, 'wall', x, 0.6, 31.7, 0.16, 3.05, 0.16, pale);
      B(o, 'wall', -6.9, 0.6, 31.7, 0.08, 2.9, 0.1, olive);
    }
    // The long veranda is open at ground level; behind it the facade stays recessed.
    B(o, 'stone', -6.9, 0.1, 33.6, 19.5, 0.5, 4.0, sandstone);
    for (const x of [-15.9, -13.4, -10.9, -8.4, -5.9, -3.4, -0.9, 1.6, 2.6]) {
      const n = d > 2 ? 8 : 4;
      loft(
        o,
        'wall',
        [
          radialRing(0.6, 0.13, 0.13, n, [x, 35.25]),
          radialRing(0.85, 0.2, 0.2, n, [x, 35.25]),
          radialRing(1.2, 0.12, 0.12, n, [x, 35.25]),
          radialRing(3.6, 0.11, 0.11, n, [x, 35.25]),
        ],
        olive,
      );
    }
    const p = [
      [-16.8, 3.65, 35.65],
      [3, 3.65, 35.65],
      [3, 4.35, 31.55],
      [-16.8, 4.35, 31.55],
    ];
    quad(o, 'roof', p, [0, 1, 0.17], roofRed);
    B(o, 'wall', -6.9, 3.5, 35.7, 19.8, 0.2, 0.2, pale);
    gable(o, -6.9, 34.5, 3.5, 2.5, 3.7, 0.9, d);
    for (let i = 0; i < 4; i++)
      B(o, 'stone', -6.9, i * 0.15, 36.5 - i * 0.25, 3.3, 0.16, 0.5, sandstone);
  }
  if (d === 0) {
    B(o, 'stone', -6.9, 0.1, 33.6, 19.5, 0.5, 4, sandstone);
    const p = [
      [-16.8, 3.65, 35.65],
      [3, 3.65, 35.65],
      [3, 4.35, 31.55],
      [-16.8, 4.35, 31.55],
    ];
    quad(o, 'roof', p, [0, 1, 0.17], roofRed);
    for (const x of [-15.9, -8.4, -3.4, 2.6]) B(o, 'wall', x, 0.6, 35.25, 0.18, 3.05, 0.18, olive);
  }
  // Southern upper corner, its small round loggia and the suspended door.
  block(o, -18.6, 22.9, 6.5, 10.3, 9.65, d, 'hip', 3.3);
  if (d > 0) {
    B(o, 'shingle', -18.2, 4.2, 28.7, 5.8, 3.6, 1.15, yellow);
    facadeWindow(o, -18.8, 5, 29.3, 1.2, 1.9, d, true);
    face(o, 'glass', -16.2, 4.2, 29.31, 1, 3.1, shadow);
    for (const x of [-16.76, -15.64]) B(o, 'wall', x, 4.15, 29.35, 0.11, 3.25, 0.12, pale);
    B(o, 'wall', -16.2, 4.1, 29.4, 1.3, 0.12, 0.3, olive);
    const n = d > 2 ? 20 : 8;
    loft(
      o,
      'shingle',
      [radialRing(4.4, 1.05, 1.05, n, [-19.4, 29]), radialRing(7.8, 1.05, 1.05, n, [-19.4, 29])],
      yellow,
    );
    loft(
      o,
      'roof',
      [radialRing(11.4, 1.5, 1.5, n, [-19.4, 29]), radialRing(13.7, 0.06, 0.06, n, [-19.4, 29])],
      roofRed,
    );
    if (d > 1)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          x = -19.4 + Math.sin(a) * 1.1,
          z = 29 + Math.cos(a) * 1.1;
        B(o, 'wall', x, 9.45, z, 0.1, 1.95, 0.1, olive);
      }
    loft(
      o,
      'shingle',
      [radialRing(9.25, 1.2, 1.2, n, [-19.4, 29]), radialRing(9.7, 1.2, 1.2, n, [-19.4, 29])],
      yellow,
    );
    finial(o, -19.4, 13.7, 29, d);
  }
  tower(o, -24.2, 25.9, 3.55, 7.7, d);
  const north = facing(o, Math.PI / 4, 7.6, 17.8);
  block(north, 0, 0, 8.1, 11.4, 7.7, d, 'gable', 3.6);
  tower(o, 9.2, 24.6, 2.75, 7.65, d);
  // Distinct roof towers and the small braced bell frame visible in the local roof photos.
  cupola(o, -15.7, 13, 7.0, 4.0, 3.6, 3.4, d);
  cupola(o, 7.5, -2.5, 10.3, 3.9, 3.5, 2.25, d);
  if (d > 0) {
    cupola(o, -6.1, 7.5, 11.2, 2.4, 2.4, 1.0, d);
    cupola(o, -20.3, 11, 6.7, 2.7, 3.0, 2.2, d);
    cupola(o, 4, 12.5, 9.6, 2.6, 2.4, 1.0, d);
  }
  if (d > 1) {
    const x = 1.4,
      z = -1.3,
      y = 9.4;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) B(o, 'wall', x + sx * 0.7, y, z + sz * 0.7, 0.13, 4.4, 0.13, olive);
    for (const sx of [-1, 1]) {
      beam(
        o,
        'wall',
        [x + sx * 0.7, y, z - 0.7],
        [x + sx * 0.7, y + 3.1, z + 0.7],
        0.12,
        0.12,
        olive,
      );
      beam(
        o,
        'wall',
        [x + sx * 0.7, y, z + 0.7],
        [x + sx * 0.7, y + 3.1, z - 0.7],
        0.12,
        0.12,
        olive,
      );
    }
    B(o, 'wall', x, y + 3.1, z, 1.6, 0.18, 1.6, olive);
    hip(o, x, z, 2.2, 2.2, y + 4.4, 1.3, d);
    loft(
      o,
      'metal',
      [radialRing(y + 3.3, 0.38, 0.38, 12, [x, z]), radialRing(y + 3.8, 0.18, 0.18, 12, [x, z])],
      rgb('6c654d'),
    );
    for (const [xx, zz, yy] of [
      [-5, 7, 10.9],
      [-2, 10, 10.4],
      [-10, 8, 10.2],
      [2, 2, 10.7],
      [-11, -7, 6.7],
    ]) {
      B(o, 'wall', xx, yy, zz, 2.0, 0.4, 2.8, pale);
      const p = [
        [xx - 1, yy + 0.4, zz - 1.4],
        [xx + 1, yy + 0.4, zz - 1.4],
        [xx + 1, yy + 1.2, zz],
        [xx - 1, yy + 1.2, zz],
      ];
      quad(o, 'glass', p, [0, 1, -0.6], glass);
      const pp = [
        [xx - 1, yy + 0.4, zz + 1.4],
        [xx + 1, yy + 0.4, zz + 1.4],
        [xx + 1, yy + 1.2, zz],
        [xx - 1, yy + 1.2, zz],
      ];
      quad(o, 'glass', pp, [0, 1, 0.6], glass);
    }
    for (const [x, z, y] of [
      [-5, 18, 11.5],
      [2, 21, 10.1],
      [10, 4, 10.8],
      [-3, -12, 6.3],
      [-18, 5, 6.7],
    ]) {
      B(o, 'stone', x, y, z, 0.65, 1.7, 0.65, yellow);
      B(o, 'stone', x, y + 1.65, z, 0.85, 0.14, 0.85, pale);
    }
    for (const [x, z, y, w] of [
      [-7, -28, 4.8, 17],
      [-15, 1, 6.6, 8],
      [-4, -15, 6.2, 12],
    ])
      balustrade(facing(o, 0, x, z + 4.7), w, y, 0, d);
  }
}
export function winchesterSkyline(o) {
  mansion(o, undefined, 0);
}
export function winchesterDistrict(o) {
  mansion(o, undefined, 1);
}
export function winchesterStreet(o) {
  mansion(o, undefined, 2);
}
const surfaces = {
  wall: { ...landmarkSurfaces.stone, graph: 'wood_painted_lap', slot: 'wall' },
  shingle: { ...landmarkSurfaces.stone, graph: 'wood_painted_shingle', slot: 'wall' },
  roof: { ...landmarkSurfaces.roof, graph: 'shingle_cedar' },
  stone: { ...landmarkSurfaces.stone },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const winchesterModel = {
  id: 'winchester_mystery_house',
  recipe: 'structure-winchester-mystery-house.mjs',
  key: 'winchester_mystery_house',
  cell: '9q/9q9',
  title: 'Winchester Mystery House',
  brief:
    'Surviving mansion core with irregular red roofs, east cross-gables, open veranda, two round turrets, suspended door, roof towers, skylights and braced bell frame.',
  camera: [80, 70, 110],
  lookAt: [-3, 4, 2],
  qaCameras: [
    { name: 'front', position: [-7, 8, 85], lookAt: [-7, 6, 24] },
    { name: 'back', position: [-65, 50, -75], lookAt: [-3, 5, 2] },
  ],
  build: mansion,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Front garden contact [-8,38] outside the veranda; independent terrain remains unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-winchester-mystery-house.mjs',
    level: 'skyline',
    export: 'winchesterSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'winchesterDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'winchesterStreet', errorMeters: 0.13, surfaces },
    },
  },
  limitations: [
    'Surviving mansion-core exterior reviewed with the original public-domain1908Charltonpostcard, primaryHABS1981architectural facts and operator alteration history. Earlier attribution-only private images are excluded; this is not a measured survey.',
    'Map data combines the mansion with connected estate buildings. Recorded editorial north/south cuts exclude stables, greenhouses, visitor buildings and their connecting wings; the full original footprint is preserved as evidence.',
    'Main gables, turrets, veranda, suspended door and roof features follow inspected references. Individual hidden roof intersections, upper-floor positions, window spacing and ornament are approximate; no interior layout is reconstructed.',
    'Scalloped shingles, stained glass and turned woodwork are original simplified cues. No reference-image pixels are embedded. Demolished seven-story tower, furnishings, gardens and vegetation are excluded.',
    'Independent coarse terrain is preserved, with foundation extending below the reviewed contact datum. Another host DEM may produce different exact ground contact.',
  ],
};
