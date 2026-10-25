/** Independent mapped Khotyn derivative; original detailed recipe remains unchanged. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

export const khotynPalette = {
  stone: '#bbb7a2',
  brick: '#ab5944',
  roof: '#626d7f',
  wood: '#a08459',
  cream: '#ded9bd',
  recess: '#424c54',
  paving: '#aaa894',
};
const colors = Object.fromEntries(
  Object.entries(khotynPalette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const rect = (o, slot, x, y, z, w, h, d, color = 'stone') =>
  box(o, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[color]);
function face(o, slot, p, color) {
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      colors[color],
    );
  }
}
function local(o, x, z, a = 0) {
  const cs = Math.cos(a),
    sn = Math.sin(a);
  const rotate = ([u, y, v]) => [u * cs + v * sn, y, -u * sn + v * cs];
  const point = (p) => {
    const r = rotate(p);
    return [r[0] + x, r[1], r[2] + z];
  };
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) => o[k](s, r, p.map(point), rotate(n), uv, c),
    ]),
  );
}
function hip(o, x, z, w, d, eave, peak) {
  const p = [
      [x - w / 2, eave, z - d / 2],
      [x - w / 2, eave, z + d / 2],
      [x + w / 2, eave, z + d / 2],
      [x + w / 2, eave, z - d / 2],
    ],
    long = w > d,
    r = Math.abs(d - w) * 0.28,
    a = [x - (long ? r : 0), peak, z - (long ? 0 : r)],
    b = [x + (long ? r : 0), peak, z + (long ? 0 : r)];
  if (r < 0.000001) {
    for (let i = 0; i < 4; i++) face(o, 'shingle', [p[i], p[(i + 1) % 4], a], 'roof');
    face(o, 'shingle', [...p].reverse(), 'roof');
    return;
  }
  if (long) {
    face(o, 'shingle', [p[0], p[1], a], 'roof');
    face(o, 'shingle', [p[1], p[2], b, a], 'roof');
    face(o, 'shingle', [p[2], p[3], b], 'roof');
    face(o, 'shingle', [p[3], p[0], a, b], 'roof');
  } else {
    face(o, 'shingle', [p[0], p[1], b, a], 'roof');
    face(o, 'shingle', [p[1], p[2], b], 'roof');
    face(o, 'shingle', [p[2], p[3], a, b], 'roof');
    face(o, 'shingle', [p[3], p[0], a], 'roof');
  }
  face(o, 'shingle', [...p].reverse(), 'roof');
}
function cone(o, x, z, r, eave, peak, n) {
  const ring = radialRing(eave, r, r, n, [x, z]);
  for (let i = 0; i < n; i++)
    face(o, 'shingle', [ring[i], ring[(i + 1) % n], [x, peak, z]], 'roof');
  face(o, 'shingle', [...ring].reverse(), 'roof');
}
function aperture(o, x, y, z, w, h, detail, color = 'cream', arched = false) {
  rect(o, 'recess', x, y, z, w, h, 0.08, 'recess');
  if (detail < 2) return;
  for (const s of [-1, 1])
    rect(o, 'limestone', x + s * (w / 2 + 0.13), y - 0.1, z + 0.055, 0.26, h + 0.3, 0.2, color);
  if (!arched) rect(o, 'limestone', x, y + h, z + 0.07, w + 0.52, 0.28, 0.22, color);
  if (detail === 3) rect(o, 'limestone', x, y - 0.18, z + 0.12, w + 0.65, 0.24, 0.38, color);
}
function archedWindow(o, x, y, z, w, h, detail) {
  aperture(o, x, y, z, w, h - w / 2, detail, 'cream', true);
  const n = detail === 3 ? 6 : 4,
    r = w / 2,
    sy = y + h - r;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      'recess',
      [
        [x, sy, z + 0.065],
        [x + r * Math.cos(a), sy + r * Math.sin(a), z + 0.065],
        [x + r * Math.cos(b), sy + r * Math.sin(b), z + 0.065],
      ],
      'recess',
    );
    if (detail >= 2)
      face(
        o,
        'limestone',
        [
          [x + r * Math.cos(a), sy + r * Math.sin(a), z + 0.14],
          [x + (r + 0.26) * Math.cos(a), sy + (r + 0.26) * Math.sin(a), z + 0.14],
          [x + (r + 0.26) * Math.cos(b), sy + (r + 0.26) * Math.sin(b), z + 0.14],
          [x + r * Math.cos(b), sy + r * Math.sin(b), z + 0.14],
        ],
        'cream',
      );
  }
}
function roundTower(o, x, z, r, top, peak, detail) {
  const n = [8, 12, 20, 28][detail];
  loft(
    o,
    'limestone',
    [
      radialRing(0, r + 0.8, r + 0.8, n, [x, z]),
      radialRing(6, r, r, n, [x, z]),
      radialRing(top, r, r, n, [x, z]),
    ],
    colors.stone,
  );
  cone(o, x, z, r + 1, top, peak, n);
  if (!detail) return;
  const count = detail === 1 ? 6 : 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = local(o, x, z, a);
    aperture(g, 0, top - 2.7, r + 0.05, 0.75, 1.65, 1);
    if (detail >= 2) aperture(g, 0, top - 8, r + 0.05, 0.65, 1.4, 1);
  }
}
function squareTower(o, x, z, w, d, top, peak, detail) {
  rect(o, 'limestone', x, 0, z, w, top, d);
  hip(o, x, z, w + 1.6, d + 1.6, top, peak);
  if (!detail) return;
  for (let side = 0; side < 4; side++) {
    const g = local(o, x, z, (side * Math.PI) / 2),
      width = side % 2 ? d : w,
      depth = side % 2 ? w : d;
    const count = Math.max(2, Math.floor(width / 3.2));
    for (let i = 0; i < count; i++)
      aperture(
        g,
        (i - (count - 1) / 2) * (width / (count + 1)),
        top - 2.8,
        depth / 2 + 0.05,
        0.8,
        1.8,
        1,
      );
    if (detail >= 2)
      for (let i = 0; i < 2; i++)
        aperture(g, (i - 0.5) * width * 0.45, top - 8, depth / 2 + 0.05, 0.75, 1.5, 1);
  }
}
function gate(o, detail) {
  const g = local(o, -2.4563, 62.4938),
    w = 12.8,
    d = 12.8,
    top = 35,
    spring = 27.5,
    r = 1.6;
  const center = 2.4563,
    left = center - w / 2,
    right = center + w / 2;
  rect(g, 'limestone', center, 0, 0, w, 24, d);
  rect(g, 'limestone', (left - r) / 2, 24, 0, -r - left, top - 24, d);
  rect(g, 'limestone', (right + r) / 2, 24, 0, right - r, top - 24, d);
  const n = [4, 6, 8, 10][detail];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      x0 = r * Math.cos(a),
      y0 = spring + r * Math.sin(a),
      x1 = r * Math.cos(b),
      y1 = spring + r * Math.sin(b);
    face(
      g,
      'limestone',
      [
        [x1, y1, d / 2],
        [x0, y0, d / 2],
        [x0, top, d / 2],
        [x1, top, d / 2],
      ],
      'stone',
    );
    face(
      g,
      'limestone',
      [
        [x0, y0, -d / 2],
        [x1, y1, -d / 2],
        [x1, top, -d / 2],
        [x0, top, -d / 2],
      ],
      'stone',
    );
    face(
      g,
      'limestone',
      [
        [x0, y0, d / 2],
        [x1, y1, d / 2],
        [x1, y1, -d / 2],
        [x0, y0, -d / 2],
      ],
      'stone',
    );
  }
  hip(g, center, 0, w + 1.7, d + 1.7, top, 40);
  if (detail) {
    for (const a of [0, Math.PI]) {
      const f = local(g, 0, 0, a);
      for (const x of [-1, 2.4563, 5.5]) aperture(f, x, 32.1, d / 2 + 0.06, 0.75, 1.5, detail);
      for (const x of [-3.35, 5.5]) aperture(f, x, 25.3, d / 2 + 0.06, 0.7, 1.65, detail);
    }
  }
}
const base = '../../../content/worldgen/source/places/u8/u8d/khotyn_fortress/';
const plan = JSON.parse(readFileSync(new URL(`${base}map-parts-reviewed.json`, import.meta.url))),
  grade = JSON.parse(readFileSync(new URL(`${base}site-grade.json`, import.meta.url))),
  by = Object.fromEntries(plan.features.map((f) => [f.key, f]));
export function khotynGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function ring(p) {
  return p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1] ? p.slice(0, -1) : p;
}
function cap(o, p, y, col = 'paving') {
  const q = ring(p),
    ids = earcut(q.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const t = ids.slice(i, i + 3).map((k) => [q[k][0], y, q[k][1]]);
    if (normalFor(...t)[1] < 0) t.reverse();
    face(o, 'limestone', t, col);
  }
}
function prism(o, p, bottom, top, col = 'stone') {
  const q = ring(p),
    sign =
      q.reduce((n, a, i) => {
        const b = q[(i + 1) % q.length];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0) < 0
        ? -1
        : 1;
  cap(o, q, top, col);
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      v = [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ];
    if (sign > 0) v.reverse();
    face(o, 'limestone', v, col);
  }
}
function _offset(o, old, target, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, r, p, _n, uv, col) => {
        const q = p.map((v) => {
          const x = v[0] - old[0],
            z = v[2] - old[1];
          return [x * c + z * s + target[0], v[1], -x * s + z * c + target[1]];
        });
        o[k](slot, r, q, normalFor(...q), uv, col);
      },
    ]),
  );
}
function mappedWalls(o, detail) {
  for (const key of ['southwest-wall', 'northwest-wall', 'west-wall']) {
    const f = by[key],
      q = ring(f.points);
    prism(o, q, 0, 36);
    const sign =
      q.reduce((n, a, i) => {
        const b = q[(i + 1) % q.length];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0) < 0
        ? -1
        : 1;
    for (let i = 0; i < q.length; i++) {
      const a = q[i],
        b = q[(i + 1) % q.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        nx = (sign * dz) / len,
        nz = (-sign * dx) / len,
        g = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
      if ((nx * (a[0] + b[0])) / 2 + nz * ((a[1] + b[1]) / 2 + 10) <= 0) continue;
      for (const y of [29, 34]) {
        const p = [
          [a[0] + nx * 0.025, y, a[1] + nz * 0.025],
          [b[0] + nx * 0.025, y, b[1] + nz * 0.025],
          [b[0] + nx * 0.025, y + 0.35, b[1] + nz * 0.025],
          [a[0] + nx * 0.025, y + 0.35, a[1] + nz * 0.025],
        ];
        if (sign > 0) p.reverse();
        face(o, 'brick', p, 'brick');
      }
      if (detail)
        for (let x = -len / 2 + 1; x < len / 2; x += 3)
          rect(g, 'limestone', x, 36, 0, 1.6, 1.5, 1.2);
    }
  }
  // The east curtain lacks a single mapped closed footprint. These connections use named
  // north/east towers and mapped southeast curtain endpoints; profiles remain reconstructed.
  for (const [a, b] of [
    [
      [10, -58],
      [20, -25],
    ],
    [
      [20, -25],
      [22, 6],
    ],
    [
      [22, 6],
      [26, 58],
    ],
    [
      [26, 58],
      [6.2, 58],
    ],
  ]) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      g = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
    rect(g, 'limestone', 0, 0, 0, len + 0.2, 36, 6);
    for (const y of [10, 23, 29])
      face(
        g,
        'brick',
        [
          [-len / 2, y, -3.025],
          [-len / 2, y + 0.4, -3.025],
          [len / 2, y + 0.4, -3.025],
          [len / 2, y, -3.025],
        ],
        'brick',
      );
    if (detail) {
      for (let x = -len / 2 + 1; x < len / 2; x += 3) {
        rect(g, 'limestone', x, 36, 0, 1.6, 1.5, 6);
        if (detail >= 2)
          for (const y of [16, 26])
            for (const sign of [-1, 1])
              beam(
                g,
                'brick',
                [x - 0.75, y - sign * 1.1, -3.065],
                [x + 0.75, y + sign * 1.1, -3.065],
                0.2,
                0.1,
                colors.brick,
              );
      }
    }
  }
}
function palace(o, detail) {
  const [x, z] = by.palace.center,
    g = local(o, x, z);
  rect(g, 'brick', 0, 24, 0, 20, 14.25, 10.5, 'brick');
  hip(g, 0, 0, 21.3, 11.8, 38.25, 43.5);
  if (detail) {
    for (const xx of [-7, -3.5, 0, 3.5, 7]) aperture(g, xx, 26, 5.3, 1.15, 2, detail);
    for (const xx of [-5, 0, 5]) archedWindow(g, xx, 32, 5.3, 1.35, 2.4, detail);
    if (detail >= 2)
      for (const y of [29.6, 36.4])
        for (let xx = -8; xx <= 8; xx += 1.5)
          rect(g, 'limestone', xx, y, 5.36, 0.78, 0.65, 0.14, 'cream');
  }
  // Open veranda with independent stone piers; no opaque block plugging the bays.
  const v = local(o, x + 10, z + 8);
  rect(v, 'limestone', 0, 28, 0, 8, 0.4, 9);
  hip(v, 0, 0, 9, 10, 34.25, 38.2);
  for (const xx of [-3.1, 3.1])
    for (const zz of [-3.5, 0, 3.5]) rect(v, 'wood', xx, 24, zz, 0.45, 10.25, 0.45, 'wood');
  if (detail) for (const xx of [-3.1, 3.1]) rect(v, 'wood', xx, 28.4, 0, 0.18, 0.75, 8, 'wood');
}
function ranges(o, detail) {
  const [x, z] = by.barracks.center;
  rect(o, 'limestone', x, 24, z, 15, 10.3, 29, 'cream');
  hip(o, x, z, 16.5, 30.3, 34.3, 41);
  if (detail) {
    const g = local(o, x - 7.56, z, -Math.PI / 2);
    for (const y of [26, 30.8])
      for (const xx of [-10, -5, 0, 5, 10]) aperture(g, xx, y, 0, 1.25, 1.7, detail);
  }
  const [px, pz] = by.chapel.center;
  rect(o, 'limestone', px, 24, pz, 20, 13.8, 10, 'cream');
  hip(o, px, pz, 21.5, 11.5, 37.8, 43.8);
  if (detail) {
    const f = local(o, px - 10.05, pz, -Math.PI / 2);
    for (const xx of [-2.2, 2.2]) {
      archedWindow(f, xx, 32.8, 0, 1.5, 2.8, detail);
      archedWindow(f, xx, 25.5, 0, 0.85, 1.8, detail);
    }
    const s = local(o, px, pz + 5.08);
    aperture(s, 0, 26, 0, 1.8, 3.4, detail);
  }
  if (detail >= 2) {
    const gx = px - 8,
      gz = pz + 8,
      n = detail === 3 ? 12 : 4;
    for (let i = 0; i < n; i++)
      rect(o, 'wood', gx, 24, gz - (i * 5) / n, 2.8, ((i + 1) * 5) / n, 5 / n, 'wood');
    rect(o, 'wood', gx, 29, pz + 4, 2.8, 0.35, 3, 'wood');
  }
}
function well(o, detail) {
  const [x, z] = by.well.center;
  hip(o, x, z, 7, 7, 29.5, 32.5);
  for (const xx of [-2.45, 2.45])
    for (const zz of [-2.45, 2.45]) rect(o, 'limestone', x + xx, 24, z + zz, 0.9, 5.5, 0.9);
  rect(o, 'limestone', x, 24, z, 2, 1, 2);
  if (detail) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const g = local(o, x, z, a),
        n = detail >= 2 ? 6 : 3,
        r = 2,
        sy = 26.8;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n,
          x0 = r * Math.cos(a),
          x1 = r * Math.cos(b),
          y0 = sy + r * Math.sin(a),
          y1 = sy + r * Math.sin(b);
        face(
          g,
          'limestone',
          [
            [x1, y1, 2.9],
            [x0, y0, 2.9],
            [x0, 29.5, 2.9],
            [x1, 29.5, 2.9],
          ],
          'stone',
        );
        face(
          g,
          'limestone',
          [
            [x0, y0, 2.1],
            [x1, y1, 2.1],
            [x1, 29.5, 2.1],
            [x0, 29.5, 2.1],
          ],
          'stone',
        );
        face(
          g,
          'limestone',
          [
            [x0, y0, 2.9],
            [x1, y1, 2.9],
            [x1, y1, 2.1],
            [x0, y0, 2.1],
          ],
          'stone',
        );
      }
    }
  }
}
function bridge(o, detail) {
  const p = plan.bridges[0].points,
    a = p[0],
    b = p.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    g = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(dx, dz));
  rect(g, 'wood', 0, 23.55, 0, 3.2, 0.45, len, 'wood');
  rect(g, 'limestone', 0, 0, 0, 4.5, 23.55, 3.8);
  if (detail) {
    for (const side of [-1, 1]) {
      for (const y of [24.55, 25.15]) rect(g, 'wood', side * 1.6, y, 0, 0.2, 0.2, len, 'wood');
      for (let zz = -len / 2; zz <= len / 2; zz += detail === 1 ? 6 : 3)
        rect(g, 'wood', side * 1.6, 23.8, zz, 0.24, 1.65, 0.24, 'wood');
    }
  }
  rect(o, 'wood', -2.4563, 23.55, 52.7, 3.2, 0.45, 7.6, 'wood');
  // The present-day bridge’s outer end meets retained numeric grade through a short apron.
  const endY =
      khotynGround(b[0] + (dx * 5) / len, b[1] + (dz * 5) / len) - grade.architectureShift + 0.05,
    front = len / 2;
  for (const side of [-1, 1])
    face(
      g,
      'wood',
      [
        [side * 1.6, 24, front],
        [side * 1.6, endY, front + 5],
        [side * 1.6, endY - 0.4, front + 5],
        [side * 1.6, 23.55, front],
      ],
      'wood',
    );
  face(
    g,
    'wood',
    [
      [-1.6, 24, front],
      [1.6, 24, front],
      [1.6, endY, front + 5],
      [-1.6, endY, front + 5],
    ],
    'wood',
  );
}
const means = {
  limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
  shingle: [0.6505758810377034, 0.6003915913257906, 0.4807971262820383],
  wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
};
function output(out, level) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, _n, u, c) => {
        const q = p.map((v) => [
          v[0],
          (Math.abs(v[1]) < 0.00001 ? grade.foundationFloor - grade.architectureShift : v[1]) +
            grade.architectureShift,
          v[2],
        ]);
        out[k](
          s,
          r,
          q,
          normalFor(...q),
          u,
          level === 'skyline' ? c.map((v, i) => v * (means[s]?.[i] ?? 1)) : c,
        );
      },
    ]),
  );
}
export function buildKhotynReviewed(o, level) {
  const detail = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3,
    out = output(o, level);
  prism(out, plan.courtOutline, 0, 24, 'paving');
  mappedWalls(out, detail);
  palace(out, detail);
  ranges(out, detail);
  well(out, detail);
  const sw = by.southwest.center,
    w = by.west.center,
    n = by.north.center,
    e = by.east.center;
  roundTower(out, ...sw, 7, 38.25, 47.25, detail);
  roundTower(out, ...w, 5.7, 41, 50, detail);
  squareTower(out, ...n, 20, 22, 39.75, 46.5, detail);
  squareTower(out, ...e, 7.5, 7.5, 41.5, 49.5, detail);
  gate(out, detail);
  bridge(out, detail);
}
export const buildKhotynReviewedMaster = (o) => buildKhotynReviewed(o, 'closeup');
export const buildKhotynReviewedSkyline = (o) => buildKhotynReviewed(o, 'skyline');
export const buildKhotynReviewedDistrict = (o) => buildKhotynReviewed(o, 'district');
export const buildKhotynReviewedStreet = (o) => buildKhotynReviewed(o, 'street');
export const buildKhotynReviewedCloseup = (o) => buildKhotynReviewed(o, 'closeup');
