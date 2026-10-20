/** Hemingway House: measured gallery proportions, flat roofs and photographed ironwork. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  cream = rgb('e5e1cb'),
  pale = rgb('eee9da'),
  iron = rgb('303c38'),
  green = rgb('455b3d'),
  yellow = rgb('b9aa58'),
  slat = rgb('c6b969'),
  glass = rgb('586660'),
  white = rgb('dddeda'),
  roof = rgb('a9a99a'),
  deck = rgb('59694c'),
  paving = rgb('b9b1a0');
function facing(o, a, x = 0, z = 0) {
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
function line(o, s, a, b, width, c) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy);
  if (l < 0.0001) return;
  const x = ((-dy / l) * width) / 2,
    y = ((dx / l) * width) / 2;
  quad(
    o,
    s,
    [
      [a[0] + x, a[1] + y, a[2]],
      [a[0] - x, a[1] - y, a[2]],
      [b[0] - x, b[1] - y, b[2]],
      [b[0] + x, b[1] + y, b[2]],
    ],
    [0, 0, 1],
    c,
  );
}
function arc(o, s, x, y, z, w, h, col, steps) {
  const r = w / 2,
    sy = y + h - r * 0.72,
    p = [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, sy, z],
    ];
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    p.push([x + r * Math.cos(a), sy + r * 0.72 * Math.sin(a), z]);
  }
  o.addConvexPolygon(s, ref, p, [0, 0, 1], (p) => [p[0], p[1]], col);
}
function archBand(o, s, x, y, z, w, h, t, col, n) {
  const r = w / 2,
    sy = y + h - r * 0.72;
  for (const sign of [-1, 1]) face(o, s, x + sign * (r + t / 2), y, z, t, sy - y, col);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI;
    quad(
      o,
      s,
      [
        [x + r * Math.cos(a), sy + r * 0.72 * Math.sin(a), z],
        [x + (r + t) * Math.cos(a), sy + (r * 0.72 + t) * Math.sin(a), z],
        [x + (r + t) * Math.cos(b), sy + (r * 0.72 + t) * Math.sin(b), z],
        [x + r * Math.cos(b), sy + r * 0.72 * Math.sin(b), z],
      ],
      [0, 0, 1],
      col,
    );
  }
}
function shutter(o, x, y, z, w, h, sign, d) {
  const outer = x + sign * w,
    inner = x,
    sy = y + h - 0.42,
    p = [
      [Math.min(outer, inner), y, z],
      [Math.max(outer, inner), y, z],
    ];
  for (let i = 0; i <= 8; i++) {
    const xx = Math.max(outer, inner) - (i / 8) * w,
      u = Math.abs(xx - outer) / w;
    p.push([xx, sy + 0.42 * Math.sqrt(Math.max(0, 1 - u * u)), z]);
  }
  o.addConvexPolygon('wood', ref, p, [0, 0, 1], (p) => [p[0], p[1]], yellow);
  if (d < 2) return;
  for (const xx of [inner + sign * 0.04, outer - sign * 0.04])
    face(o, 'wood', xx, y, z + 0.025, 0.055, h - (xx === inner + sign * 0.04 ? 0.38 : 0), slat);
  for (const yy of [y + 0.06, y + h * 0.34, y + h * 0.67])
    face(o, 'wood', (inner + outer) / 2, yy, z + 0.03, w, 0.05, slat);
  const step = d > 2 ? 0.085 : 0.2;
  for (let yy = y + 0.14; yy < y + h - 0.1; yy += step) {
    let left = Math.min(outer, inner) + 0.07,
      right = Math.max(outer, inner) - 0.07;
    if (yy > sy) {
      const length = w * Math.sqrt(Math.max(0, 1 - Math.pow((yy - sy) / 0.42, 2)));
      if (sign < 0) right = outer + length - 0.05;
      else left = outer - length + 0.05;
    }
    if (right - left < 0.05) continue;
    quad(
      o,
      'wood',
      [
        [left, yy, z + 0.045],
        [right, yy, z + 0.045],
        [right, yy + 0.043, z + 0.014],
        [left, yy + 0.043, z + 0.014],
      ],
      [0, 0.4, 1],
      slat,
    );
  }
}
function opening(
  o,
  x,
  y,
  z,
  w,
  h,
  d,
  { door = false, closed = false, shutters = true, entranceIron = false } = {},
) {
  if (!d) return;
  const n = d > 1 ? 12 : 6;
  arc(o, 'glass', x, y, z + 0.07, w, h, closed ? yellow : glass, n);
  if (d === 1) {
    if (shutters)
      for (const s of [-1, 1]) shutter(o, x + s * (w / 2 + 0.05), y, z + 0.08, w * 0.48, h, s, d);
    return;
  }
  archBand(o, 'wood', x, y, z + 0.085, w, h, 0.075, green, n);
  archBand(o, 'wood', x, y, z + 0.11, w - 0.07, h - 0.045, 0.035, white, n);
  const sy = y + h - w * 0.36;
  if (!closed) {
    face(o, 'wood', x, y, z + 0.13, 0.055, h, white);
    face(o, 'wood', x, sy - 0.03, z + 0.135, w - 0.08, 0.055, white);
    for (const yy of [0.34, 0.68])
      face(o, 'wood', x, y + (sy - y) * yy, z + 0.135, w - 0.07, 0.045, white);
    if (door)
      for (const s of [-1, 1]) {
        if (!(entranceIron && d > 2))
          face(o, 'wood', x + s * w * 0.25, y + 0.09, z + 0.14, w * 0.39, 0.4, white);
        if (d > 2) face(o, 'metal', x + s * 0.08, y + 1.15, z + 0.15, 0.025, 0.13, iron);
      }
  }
  if (shutters)
    for (const s of [-1, 1]) shutter(o, x + s * (w / 2 + 0.055), y, z + 0.09, w * 0.48, h, s, d);
  if (closed) {
    for (let yy = y + 0.1; yy < sy; yy += d > 2 ? 0.085 : 0.18)
      face(o, 'wood', x, yy, z + 0.1, w - 0.12, 0.037, slat);
    face(o, 'wood', x, y, z + 0.13, 0.05, h, yellow);
  }
  B(o, 'wall', x, y - 0.055, z + 0.1, w + 0.2, 0.08, 0.23, pale);
  B(o, 'wall', x, y + h + 0.04, z + 0.06, 0.2, 0.25, 0.1, pale);
}
/** Closed painted metal sections, with real gaps over the retained dark glazing. */
function entranceIronwork(o) {
  const c = JSON.parse(
      fs.readFileSync(
        new URL(
          '../../../content/worldgen/source/places/dh/dhm/hemingway_house/entrance-construction-controls.json',
          import.meta.url,
        ),
      ),
    ),
    spring = c.bottom + c.height - c.width * 0.36,
    z = c.wallZ + 0.19,
    uv = (p, n) => {
      const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
      return p.map((v) => v.filter((_, i) => i !== axis));
    },
    metric = {
      addQuad: (s, r, p, n, _u, color) => o.addQuad(s, r, p, n, uv(p, n), color),
      addConvexPolygon: (s, r, p, n, _u, color) => {
        const u = uv(p, n);
        return o.addConvexPolygon(s, r, p, n, (v) => u[p.indexOf(v)], color);
      },
    },
    rod = (a, b, width = c.rodWidth) =>
      beam(
        metric,
        'doorIron',
        [c.centerX + a[0], a[1], z],
        [c.centerX + b[0], b[1], z],
        c.beamDepth,
        width,
        white,
      );
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 24,
      b = ((i + 1) * Math.PI) / 24,
      at = (angle, outside, front) => [
        c.centerX + (outside ? 0.7325 : 0.6675) * Math.cos(angle),
        spring + (outside ? 0.5325 : 0.4675) * Math.sin(angle),
        z + ((front ? 1 : -1) * c.beamDepth) / 2,
      ];
    // A joined, closed annulus avoids the exposed end seams of separate bent bars.
    for (const p of [
      [at(a, false, true), at(a, true, true), at(b, true, true), at(b, false, true)],
      [at(a, true, false), at(a, false, false), at(b, false, false), at(b, true, false)],
      [at(a, true, true), at(a, true, false), at(b, true, false), at(b, true, true)],
      [at(a, false, false), at(a, false, true), at(b, false, true), at(b, false, false)],
    ])
      metric.addQuad('doorIron', ref, p, normalFor(...p), null, white);
    for (const angle of i === 0 ? [a] : i === 23 ? [b] : []) {
      const p = [
        at(angle, true, true),
        at(angle, false, true),
        at(angle, false, false),
        at(angle, true, false),
      ];
      metric.addQuad('doorIron', ref, p, [0, -1, 0], null, white);
    }
  }
  for (const x of [-0.7, 0, 0.7]) rod([x, c.bottom], [x, spring], 0.065);
  for (const y of [c.bottom, spring]) rod([-0.7, y], [0.7, y], 0.065);
  for (const a of c.fanlightAngles)
    rod([0, spring], [c.fanlightRadius * Math.cos(a), spring + c.fanlightRise * Math.sin(a)]);
  for (const x of c.panelCenters) {
    const l = x - c.panelWidth / 2,
      r = x + c.panelWidth / 2,
      lo = c.panelBottom,
      hi = c.panelTop,
      mid = (lo + hi) / 2;
    for (const xx of [l, r]) rod([xx, lo], [xx, hi], 0.045);
    for (const y of [lo, hi]) rod([l, y], [r, y], 0.045);
    const diamond = [
      [x, lo + 0.06],
      [r - 0.04, mid],
      [x, hi - 0.06],
      [l + 0.04, mid],
    ];
    for (let i = 0; i < 4; i++) rod(diamond[i], diamond[(i + 1) % 4], 0.015);
    // Original simplified scroll interpretation, rather than an exact ornamental trace.
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const points = Array.from({ length: 17 }, (_, i) => {
          const t = i / 16,
            a = t * Math.PI * 1.65,
            radius = 0.075 * (1 - t * 0.65);
          return [x + sx * (0.17 + radius * Math.cos(a)), mid + sy * (0.2 + radius * Math.sin(a))];
        });
        for (let i = 1; i < points.length; i++) rod(points[i - 1], points[i], 0.012);
      }
  }
}
function round(o, x, z, y, h, d) {
  if (d < 2) {
    B(o, 'metal', x, y, z, 0.11, h, 0.11, iron);
    return;
  }
  const n = d > 2 ? 10 : 6,
    profiles =
      d > 2
        ? [
            [0, 0.13],
            [0.08, 0.13],
            [0.16, 0.09],
            [0.25, 0.06],
            [h - 0.28, 0.058],
            [h - 0.21, 0.095],
            [h - 0.1, 0.11],
            [h, 0.13],
          ]
        : [
            [0, 0.1],
            [0.18, 0.065],
            [h - 0.15, 0.065],
            [h, 0.11],
          ],
    rings = profiles.map(([yy, r]) =>
      Array.from({ length: n }, (_, i) => [
        x + r * Math.cos((-i / n) * 2 * Math.PI),
        y + yy,
        z + r * Math.sin((-i / n) * 2 * Math.PI),
      ]),
    );
  loft(o, 'metal', rings, iron);
  if (d > 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * Math.PI;
      beam(
        o,
        'metal',
        [x + 0.066 * Math.cos(a), y + 0.32, z + 0.066 * Math.sin(a)],
        [x + 0.062 * Math.cos(a), y + h - 0.35, z + 0.062 * Math.sin(a)],
        0.012,
        0.012,
        rgb('435048'),
      );
    }
    B(o, 'metal', x, y + h - 0.04, z, 0.28, 0.14, 0.28, iron);
  }
}
function railing(o, x0, x1, y, z, d) {
  B(o, 'metal', (x0 + x1) / 2, y + 0.08, z, x1 - x0, 0.045, 0.055, iron);
  B(o, 'metal', (x0 + x1) / 2, y + 1.03, z, x1 - x0, 0.065, 0.065, iron);
  if (d === 0) return;
  const n = Math.ceil((x1 - x0) / 0.43),
    pitch = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * pitch;
    if (d === 1) {
      face(o, 'metal', x, y + 0.1, z, 0.025, 0.9, iron);
      continue;
    }
    if (d === 2) {
      line(o, 'metal', [x - pitch * 0.4, y + 0.1, z], [x + pitch * 0.4, y + 1.0, z], 0.025, iron);
      line(o, 'metal', [x + pitch * 0.4, y + 0.1, z], [x - pitch * 0.4, y + 1.0, z], 0.025, iron);
      continue;
    }
    for (const sign of [-1, 1]) {
      const points = Array.from({ length: 19 }, (_, j) => {
        const t = j / 18;
        return [
          x + sign * (0.035 + pitch * 0.38 * Math.cos(2 * Math.PI * t)),
          y + 0.12 + t * 0.87,
          z,
        ];
      });
      for (let j = 1; j < points.length; j++)
        line(o, 'metal', points[j - 1], points[j], 0.016, iron);
    }
  }
}
function canopy(o, innerA, innerB, outerA, outerB, d) {
  const n = d > 2 ? 10 : d > 1 ? 5 : 2,
    at = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
    height = (t) => 7.48 + 0.62 * Math.pow(1 - t, 2);
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n,
      A = at(innerA, outerA, a),
      B = at(innerB, outerB, a),
      C = at(innerB, outerB, b),
      D = at(innerA, outerA, b),
      p = [
        [A[0], height(a), A[1]],
        [B[0], height(a), B[1]],
        [C[0], height(b), C[1]],
        [D[0], height(b), D[1]],
      ];
    for (const t of [
      [p[0], p[1], p[2]],
      [p[0], p[2], p[3]],
    ]) {
      let normal = normalFor(...t);
      if (normal[1] < 0) normal = normal.map((v) => -v);
      o.addTriangle(
        'roof',
        ref,
        t,
        normal,
        t.map((p) => [p[0], p[2]]),
        roof,
      );
      o.addTriangle(
        'roof',
        ref,
        t.map((p) => [p[0], p[1] - 0.035, p[2]]),
        normal.map((v) => -v),
        t.map((p) => [p[0], p[2]]),
        iron,
      );
    }
  }
  beam(
    o,
    'metal',
    [...outerA.slice(0, 1), 7.45, outerA[1]],
    [outerB[0], 7.45, outerB[1]],
    0.08,
    0.08,
    iron,
  );
  if (d > 1) {
    const span = Math.hypot(innerB[0] - innerA[0], innerB[1] - innerA[1]),
      count = Math.ceil(span / (d > 2 ? 0.2 : 0.65));
    for (let j = 0; j <= count; j++) {
      const a = at(innerA, innerB, j / count),
        b = at(outerA, outerB, j / count);
      for (let i = 0; i < n; i++) {
        const t = i / n,
          u = (i + 1) / n,
          A = at(a, b, t),
          B = at(a, b, u);
        const dx = B[0] - A[0],
          dz = B[1] - A[1],
          length = Math.hypot(dx, dz),
          ox = (-dz / length) * 0.007,
          oz = (dx / length) * 0.007;
        const p = [
          [A[0] + ox, height(t) + 0.016, A[1] + oz],
          [A[0] - ox, height(t) + 0.016, A[1] - oz],
          [B[0] - ox, height(u) + 0.016, B[1] - oz],
          [B[0] + ox, height(u) + 0.016, B[1] + oz],
        ];
        let normal = normalFor(...p);
        if (normal[1] < 0) normal = normal.map((v) => -v);
        quad(o, 'roof', p, normal, rgb('929589'));
      }
    }
  }
}
function parapet(o, x, z, w, l) {
  B(o, 'flatRoof', x, 8.17, z, w, 0.12, l, rgb('9b9c91'));
  for (const zz of [z - l / 2, z + l / 2]) {
    B(o, 'wall', x, 8.2, zz, w + 0.2, 0.44, 0.18, cream);
    B(o, 'wall', x, 8.6, zz, w + 0.3, 0.12, 0.29, pale);
  }
  for (const xx of [x - w / 2, x + w / 2]) {
    B(o, 'wall', xx, 8.2, z, 0.18, 0.44, l, cream);
    B(o, 'wall', xx, 8.6, z, 0.29, 0.12, l + 0.1, pale);
  }
}
function hemingway(o, _frame, d = 3) {
  // HABS measured main facade is about 36 ft 4 in; outer galleries about 52 ft 7 in.
  B(o, 'wall', 0, -0.7, 0.625, 11.08, 8.9, 9.85, cream);
  B(o, 'wall', -3.595, -0.7, -6.3, 3.89, 8.9, 4, cream);
  // The four gallery decks remain open, with a rear ell interrupting the northeast side.
  for (const [x, z, w, l] of [
    [0, 6.775, 16, 2.45],
    [-6.77, -0.525, 2.46, 12.95],
    [6.77, -0.525, 2.46, 12.95],
    [1.945, -5.775, 7.19, 2.95],
  ]) {
    B(o, 'wall', x, -0.35, z, w, 0.8, l, paving);
    if (d > 1 && x === -6.77) {
      B(o, 'wood', -6.08, 4.25, -0.525, 1.08, 0.17, 12.95, deck);
      B(o, 'wood', -7.31, 4.25, 5.4, 1.38, 0.17, 5.2, deck);
      B(o, 'wood', -7.31, 4.25, -4.375, 1.38, 0.17, 5.25, deck);
    } else B(o, 'wood', x, 4.25, z, w, 0.17, l, deck);
  }
  parapet(o, 0, 0.625, 11.08, 9.85);
  parapet(o, -3.595, -6.3, 3.89, 4);
  // Stair access housing on the flat roof and the two-flue masonry stack.
  B(o, 'wood', -3.2, 8.25, 0.25, 1.65, 1.45, 2.0, green);
  for (const sign of [-1, 1]) {
    const p = [
      [-3.2 + sign * 0.94, 9.67, -0.88],
      [-3.2 + sign * 0.94, 9.67, 1.38],
      [-3.2, 10.07, 1.38],
      [-3.2, 10.07, -0.88],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(o, 'roof', p, n, roof);
  }
  for (const zz of [-0.75, 1.25])
    o.addConvexPolygon(
      'wood',
      ref,
      [
        [-4.025, 9.65, zz],
        [-2.375, 9.65, zz],
        [-3.2, 10.02, zz],
      ],
      [0, 0, zz < 0 ? -1 : 1],
      (p) => [p[0], p[1]],
      green,
    );
  B(o, 'wall', -1.1, 8.3, -0.15, 0.52, 1.35, 0.75, rgb('a99782'));
  B(o, 'wall', -1.1, 9.51, -0.15, 0.66, 0.13, 0.88, pale);
  if (d > 1)
    for (const z of [-0.37, 0.07])
      quad(
        o,
        'metal',
        [
          [-1.24, 9.656, z - 0.12],
          [-0.96, 9.656, z - 0.12],
          [-0.96, 9.656, z + 0.12],
          [-1.24, 9.656, z + 0.12],
        ],
        [0, 1, 0],
        iron,
      );
  if (d > 0) {
    face(o, 'glass', -3.2, 9.07, 1.27, 1.18, 0.4, glass);
    if (d > 1) {
      for (const x of [-3.6, -3.2, -2.8]) face(o, 'wood', x, 9.07, 1.29, 0.045, 0.4, white);
      for (let y = 8.4; y < 9.7; y += 0.16) {
        face(o, 'wood', -3.2, y, 1.28, 1.64, 0.02, rgb('728264'));
        face(facing(o, Math.PI, -3.2, 0.25), 'wood', 0, y, 1.02, 1.64, 0.02, rgb('728264'));
      }
    }
  }
  canopy(o, [-5.54, 5.55], [5.54, 5.55], [-8.12, 8.12], [8.12, 8.12], d);
  canopy(o, [5.54, 5.55], [5.54, -4.3], [8.12, 8.12], [8.12, -7.4], d);
  canopy(o, [5.54, -4.3], [-1.65, -4.3], [8.12, -7.4], [-1.65, -7.4], d);
  canopy(o, [-5.54, -7.4], [-5.54, 5.55], [-8.12, -7.4], [-8.12, 8.12], d);
  const columns = [
    ...[-8, -4.8, -1.6, 1.6, 4.8, 8].map((x) => [x, 8]),
    ...[-7.25, -4.2, -1.15, 1.9, 4.95].flatMap((z) => [
      [-8, z],
      [8, z],
    ]),
    ...[1.6, 4.8].map((x) => [x, -7.25]),
  ];
  for (const [x, z] of columns) {
    if (d === 0) round(o, x, z, 0.45, 7, d);
    else {
      round(o, x, z, 0.45, 3.8, d);
      round(o, x, z, 4.42, 3.03, d);
    }
  }
  for (const [a, x, z, w] of [
    [0, 0, 8, 16],
    [Math.PI / 2, 8, 0.375, 15.25],
    [-Math.PI / 2, -8, 0.375, 15.25],
    [Math.PI, 3.175, -7.25, 9.65],
  ]) {
    const q = facing(o, a, x, z);
    B(q, 'metal', 0, 4.18, 0, w, 0.21, 0.17, iron);
    B(q, 'metal', 0, 7.4, 0, w, 0.13, 0.12, iron);
    railing(q, -w / 2, w / 2, 4.42, 0.04, d);
    if (d > 2) {
      for (let u = -w / 2 + 0.5; u < w / 2; u += 0.85) {
        const r = Array.from({ length: 8 }, (_, i) => [
          u + 0.055 * Math.cos((i / 8) * 2 * Math.PI),
          4.28 + 0.055 * Math.sin((i / 8) * 2 * Math.PI),
          0.095,
        ]);
        q.addConvexPolygon('metal', ref, r, [0, 0, 1], (p) => [p[0], p[1]], rgb('526058'));
      }
    }
  }
  // Three-step southwest entry; its offset agrees with the measured four-bay facade.
  for (let i = 0; i < 3; i++)
    B(o, 'wall', -0.85, i * 0.15, 8.5 - i * 0.23, 2.1, 0.15, 0.78 - i * 0.1, paving);
  if (d > 0) {
    for (const x of [-1.9, 0.2]) {
      beam(o, 'metal', [x, 0.83, 8.95], [x, 1.4, 7.65], 0.05, 0.05, iron);
      for (const z of [8.75, 8.0])
        B(o, 'metal', x, z > 8.5 ? 0.15 : 0.45, z, 0.04, 0.85, 0.04, iron);
    }
  }
  // Openings match HABS front, southeast and northeast elevations; hidden northwest follows plan.
  const front = facing(o, 0, 0, 5.55);
  for (const x of [-3.48, -0.55, 1.67, 3.82]) {
    opening(front, x, 0.47, 0.015, x === -0.55 ? 1.48 : 1.3, x === -0.55 ? 3.05 : 2.64, d, {
      door: x === -0.55,
      entranceIron: x === -0.55,
      shutters: x !== -0.55,
    });
    opening(front, x, 4.46, 0.015, 1.3, 2.67, d);
  }
  const east = facing(o, Math.PI / 2, 5.54, 0.625);
  for (const x of [-3.35, -1.12, 1.12, 3.35])
    for (const y of [0.47, 4.46]) opening(east, x, y, 0.015, 1.28, 2.62, d);
  const west = facing(o, -Math.PI / 2, -5.54, 0.625);
  for (const x of [-3.25, 0, 3.25])
    for (const y of [0.47, 4.46]) opening(west, x, y, 0.015, 1.28, 2.62, d);
  const rear = facing(o, Math.PI, 1.945, -4.3);
  for (const x of [-2.4, 0, 2.4]) {
    opening(rear, x, 0.48, 0.02, x === 2.4 ? 0.95 : 1.22, 2.5, d, {
      door: x === 2.4,
      shutters: x !== 2.4,
      closed: x !== 2.4,
    });
    opening(rear, x, 4.46, 0.02, 1.27, 2.64, d);
  }
  const end = facing(o, Math.PI, -3.595, -8.3);
  for (const y of [1.62, 5.53]) opening(end, 0, y, 0.02, 1.35, 1.74, d);
  const ellSide = facing(o, Math.PI / 2, -1.65, -6.3);
  opening(ellSide, 0, 0.48, 0.02, 1.1, 2.35, d, { door: true, shutters: false });
  opening(ellSide, 0, 5.05, 0.02, 1.15, 2.0, d);
  const ellWest = facing(o, -Math.PI / 2, -5.54, -6.3);
  for (const y of [1.55, 5.45]) opening(ellWest, 0, y, 0.02, 1.15, 1.85, d);
  if (d > 1) {
    // The lightly scored stucco has alternating quoins and restrained horizontal courses.
    for (const [a, x, z, w] of [
      [0, 0, 5.55, 11.08],
      [Math.PI / 2, 5.54, 0.625, 9.85],
      [-Math.PI / 2, -5.54, 0.625, 9.85],
      [Math.PI, 1.945, -4.3, 7.19],
      [Math.PI, -3.595, -8.3, 3.89],
    ]) {
      const q = facing(o, a, x, z);
      for (const sign of [-1, 1])
        for (let row = 0; row < 19; row++) {
          const ww = row % 2 ? 0.4 : 0.65;
          B(q, 'wall', sign * (w / 2 - ww / 2), 0.5 + row * 0.405, 0.025, ww, 0.36, 0.085, pale);
        }
      for (const yy of [3.48, 3.87, 7.35, 7.75])
        face(q, 'wall', 0, yy, 0.052, w - 0.8, 0.014, rgb('cecbb9'));
    }
    // Visible northwest timber stair fits inside the gallery and reaches the upper deck.
    const stair = facing(o, 0, -7.3, 0.45);
    for (let i = 0; i < 22; i++)
      B(
        stair,
        'wood',
        0,
        0.45 + (i + 1) * (3.97 / 22) - 0.07,
        2.25 - i * 0.205,
        1.2,
        0.07,
        0.23,
        green,
      );
    for (const x of [-0.63, 0.63]) {
      beam(stair, 'wood', [x, 0.45, 2.4], [x, 4.42, -2.12], 0.16, 0.21, green);
      beam(stair, 'wood', [x, 1.35, 2.4], [x, 5.32, -2.12], 0.065, 0.065, green);
      for (let i = 0; i <= 11; i++)
        B(stair, 'wood', x, 0.45 + i * 0.36, 2.25 - i * 0.41, 0.04, 0.9, 0.04, green);
    }
    // Gallery joists and roof rods are exposed in the photographed underside.
    for (let x = -7.7; x < 8; x += 0.55) B(o, 'metal', x, 4.1, 6.79, 0.045, 0.12, 2.4, iron);
    for (let z = -6.9; z < 5.5; z += 0.55)
      for (const x of [-6.77, 6.77]) {
        if (x < 0 && z > -1.75 && z < 2.8) B(o, 'metal', -6.08, 4.1, z, 1.08, 0.12, 0.045, iron);
        else B(o, 'metal', x, 4.1, z, 2.42, 0.12, 0.045, iron);
      }
    for (const x of [-4.8, -1.6, 1.6, 4.8])
      beam(o, 'metal', [x, 7.32, 8], [x, 8.0, 5.63], 0.028, 0.028, iron);
    for (const x of [-5.62, 5.62]) B(o, 'metal', x, 0.5, 5.62, 0.065, 7.5, 0.065, iron);
  }
  if (d > 2) {
    // Sparse paving joints, not landscaping or a surrounding site slab.
    for (let x = -7.5; x < 8; x += 0.8)
      quad(
        o,
        'wall',
        [
          [x, 0.456, 5.6],
          [x + 0.014, 0.456, 5.6],
          [x + 0.014, 0.456, 7.98],
          [x, 0.456, 7.98],
        ],
        [0, 1, 0],
        rgb('969284'),
      );
    for (const z of [6.35, 7.16])
      quad(
        o,
        'wall',
        [
          [-8, 0.457, z],
          [8, 0.457, z],
          [8, 0.457, z + 0.014],
          [-8, 0.457, z + 0.014],
        ],
        [0, 1, 0],
        rgb('969284'),
      );
    for (const x of [-2.05, -1.5]) face(front, 'metal', x, 1.75, 0.1, 0.35, 0.45, iron);
    entranceIronwork(o);
  }
}
export function hemingwaySkyline(o) {
  hemingway(o, undefined, 0);
}
export function hemingwayDistrict(o) {
  hemingway(o, undefined, 1);
}
export function hemingwayStreet(o) {
  hemingway(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  flatRoof: { slot: 'roof', graph: 'membrane', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0, doubleSided: true },
  metal: { ...landmarkSurfaces.metal, doubleSided: true },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.82, metallic: 0.25 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  doorIron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.25 },
};
export const hemingwayModel = {
  id: 'hemingway_house',
  recipe: 'structure-hemingway-house.mjs',
  key: 'hemingway_house',
  cell: 'dh/dhm',
  title: 'Ernest Hemingway House',
  brief:
    'Two-story Key West limestone/stucco house with flat parapeted roofs, rear ell, wraparound open galleries, curved corrugated veranda canopies, slender iron columns, heart-pattern railing, arched yellow shutters and green/white casements. Small roof stair housing and two-flue chimney.',
  camera: [25, 18, 30],
  lookAt: [0, 4.3, 0],
  qaCameras: [
    { name: 'front', position: [15, 8.8, 30], lookAt: [0, 4, 2] },
    { name: 'back', position: [-22, 15, -27], lookAt: [0, 4, 0] },
    { name: 'entrance-ironwork', position: [2.5, 2.4, 11.5], lookAt: [-0.55, 2.0, 5.55] },
  ],
  build: hemingway,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Ground outside southwest entry steps at local [-.85,8.8]; preserved independent Terrarium evidence.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hemingway-house.mjs',
    level: 'skyline',
    export: 'hemingwaySkyline',
    errorMeters: 0.24,
    surfaces,
    authoredLevels: {
      district: { export: 'hemingwayDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'hemingwayStreet', errorMeters: 0.05, surfaces },
    },
  },
  limitations: [
    'New close-only front entrance frame, three fanlight spokes and paired lower scroll/diamond grilles use the exact native Highsmith photograph under an explicit photographer public-domain dedication after the cleared Qualla search. Physical rod sizes, frame depth and simplified scrolls are estimates. Earlier attribution imagery and unverified HABS originals excluded as current construction controls; full fixed exterior scope retained pending broader public-domain review.',
    'Original medium-fi exterior informed by individually inspected Qualla photographs (2006, 2009, 2019), HABS FL-179 architectural description and measured drawings. Main facade and gallery dimensions follow the measured plans; fine dimensions, parapet height and ornamental profiles remain interpreted.',
    'Surviving museum exterior only; interiors, detached studio, removed studio catwalk, pool, cats, visitors, furniture and garden structures excluded. Historic roof and rear-ell evidence guide portions obscured in local photos.',
    'Coarse mapped envelope is approximately one metre inside some measured gallery edges; it is retained as evidence without stretching the building. Placement is an approximate terrain-relative preview, with footprint replacement disabled.',
    'Independent unmodified Terrarium elevations are preserved; ground contact is host-dependent, not a site survey. Reference photographs are not embedded or redistributed.',
  ],
};
