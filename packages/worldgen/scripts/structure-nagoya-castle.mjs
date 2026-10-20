/** Present 1959 keeps; native stone caps and tier plans, curved copper/gray roofs, real entries. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const ref = 'palette:#ffffff';
const defaultFrame = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/xn/xn3/nagoya_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const white = rgb('deded3'),
  stone = rgb('898b80'),
  mortar = rgb('5d625c');
const green = rgb('789e8c'),
  greenTrim = rgb('476d5e'),
  gray = rgb('777e7a');
const dark = rgb('343e37'),
  glass = rgb('43514d'),
  gold = rgb('c8a351');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const tint = (c, v) => c.map((x) => Math.min(1, x * v));
function triangle(o, s, p, c, n) {
  p = p.map((q) => q.map(Math.fround));
  let normal = normalFor(...p);
  if (Math.hypot(...normal) < 0.5) return;
  if (n && normal.reduce((v, x, i) => v + x * n[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    normal = normal.map((x) => -x);
  }
  o.addTriangle(
    s,
    ref,
    p,
    normal,
    p.map((q) => [q[0] + q[2], q[1]]),
    c,
  );
}
function quad(o, s, p, c, n) {
  triangle(o, s, [p[0], p[1], p[2]], c, n);
  triangle(o, s, [p[0], p[2], p[3]], c, n);
}
function polygon(o, s, points, c, n) {
  const k = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[2]) > 0.7 ? 2 : 0;
  const axes = k === 1 ? [0, 2] : k === 2 ? [0, 1] : [2, 1];
  const ids = earcut(points.flatMap((p) => axes.map((i) => p[i])));
  for (let i = 0; i < ids.length; i += 3)
    triangle(
      o,
      s,
      ids.slice(i, i + 3).map((j) => points[j]),
      c,
      n,
    );
}
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
const bounds = (r) => ({
  min: [Math.min(...r.map((p) => p[0])), Math.min(...r.map((p) => p[1]))],
  max: [Math.max(...r.map((p) => p[0])), Math.max(...r.map((p) => p[1]))],
});
function cap(o, s, r, y, c) {
  polygon(
    o,
    s,
    r.map((p) => [p[0], y, p[1]]),
    c,
    [0, 1, 0],
  );
}
function expanded(r, amount) {
  const b = bounds(r),
    c = b.min.map((v, i) => (v + b.max[i]) / 2),
    size = b.max.map((v, i) => v - b.min[i]);
  return r.map((p) => p.map((v, i) => c[i] + (v - c[i]) * (1 + (2 * amount) / size[i])));
}
function faceAt(r, i, u) {
  return mix(r[i], r[(i + 1) % r.length], u);
}
function outward(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len];
}
/** A real rectangular negative volume, with four returns and a recessed closed door/window. */
function opening(o, point, normal, w, y, h, d, { door = false, bars = true } = {}) {
  const a = Math.atan2(normal[0], normal[2]),
    q = facing(o, a, ...point),
    depth = door ? 1.6 : 0.24;
  for (const x of [-w / 2, w / 2])
    quad(
      q,
      door ? 'stone' : 'plaster',
      [
        [x, y, 0],
        [x, y + h, 0],
        [x, y + h, -depth],
        [x, y, -depth],
      ],
      door ? stone : white,
      [x < 0 ? 1 : -1, 0, 0],
    );
  for (const yy of [y, y + h])
    quad(
      q,
      door ? 'stone' : 'plaster',
      [
        [-w / 2, yy, 0],
        [w / 2, yy, 0],
        [w / 2, yy, -depth],
        [-w / 2, yy, -depth],
      ],
      door ? stone : white,
      [0, yy === y ? 1 : -1, 0],
    );
  quad(
    q,
    door ? 'wood' : 'glass',
    [
      [-w / 2, y, -depth],
      [w / 2, y, -depth],
      [w / 2, y + h, -depth],
      [-w / 2, y + h, -depth],
    ],
    door ? dark : glass,
    [0, 0, 1],
  );
  if (d > 1 && !door) {
    const plate = (slot, x, yy, w, h, z, c) =>
      quad(
        q,
        slot,
        [
          [x - w / 2, yy, z],
          [x + w / 2, yy, z],
          [x + w / 2, yy + h, z],
          [x - w / 2, yy + h, z],
        ],
        c,
        [0, 0, 1],
      );
    for (const x of [-w / 2 - 0.045, w / 2 + 0.045])
      plate('plaster', x, y - 0.06, 0.09, h + 0.12, 0.055, white);
    for (const yy of [y - 0.06, y + h]) plate('plaster', 0, yy, w + 0.18, 0.08, 0.055, white);
    if (bars)
      for (let x = -w / 2 + 0.18; x < w / 2; x += d === 3 ? 0.24 : 0.48) {
        plate('metal', x, y + 0.04, 0.045, h - 0.08, -0.045, tint(white, 0.82));
        if (d === 3)
          quad(
            q,
            'metal',
            [
              [x + 0.0225, y + 0.04, -0.045],
              [x + 0.0225, y + 0.04, -0.11],
              [x + 0.0225, y + h - 0.04, -0.11],
              [x + 0.0225, y + h - 0.04, -0.045],
            ],
            tint(white, 0.7),
            [1, 0, 0],
          );
      }
  }
  if (d === 3 && door) {
    for (const x of [-w / 2 + 0.18, w / 2 - 0.18])
      B(q, 'wood', x, y + 0.08, -depth + 0.03, 0.12, h - 0.16, 0.08, tint(dark, 1.2));
    B(q, 'metal', w * 0.28, y + h * 0.42, -depth + 0.08, 0.06, 0.3, 0.06, gray);
  }
}
/** Slice a facade at hole boundaries; no opaque plane is retained across a recess. */
function wall(o, r, lo, hi, holes, d, s = 'plaster', colour = white) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(r, i),
      hs = holes.filter((h) => h.side === i);
    const us = [
      ...new Set([0, 1, ...hs.flatMap((h) => [h.u - h.w / 2 / len, h.u + h.w / 2 / len])]),
    ].sort((a, b) => a - b);
    const ys = [...new Set([lo, hi, ...hs.flatMap((h) => [h.y, h.y + h.h])])].sort((a, b) => a - b);
    for (let k = 1; k < us.length; k++)
      for (let j = 1; j < ys.length; j++) {
        const u = (us[k - 1] + us[k]) / 2,
          y = (ys[j - 1] + ys[j]) / 2;
        if (
          y < lo ||
          y > hi ||
          hs.some((h) => Math.abs(u - h.u) < h.w / 2 / len && y > h.y && y < h.y + h.h)
        )
          continue;
        const p = faceAt(r, i, us[k - 1]),
          q = faceAt(r, i, us[k]);
        quad(
          o,
          s,
          [
            [...p.slice(0, 1), ys[j - 1], p[1]],
            [q[0], ys[j - 1], q[1]],
            [q[0], ys[j], q[1]],
            [p[0], ys[j], p[1]],
          ],
          colour,
          n,
        );
      }
    for (const h of hs) opening(o, faceAt(r, i, h.u), n, h.w, h.y, h.h, d, h);
  }
  cap(o, s, r, hi, colour);
}
function stoneBase(o, r, top, d, { small = false, portal } = {}) {
  const levels = small
    ? [
        [-2.5, 2.4],
        [1, 1.5],
        [4, 0.6],
        [top, 0],
      ]
    : [
        [-9.5, 5],
        [-4, 3.2],
        [4, 1.1],
        [top, 0],
      ];
  const at = (y) => {
    for (let j = 1; j < levels.length; j++)
      if (y <= levels[j][0] + 1e-7) {
        const a = levels[j - 1],
          b = levels[j];
        return expanded(r, a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]));
      }
    return r;
  };
  const rows = d === 3 ? (small ? 10 : 22) : d === 2 ? (small ? 5 : 10) : 3;
  const cuts = [
    ...new Set([
      ...levels.map((p) => p[0]),
      ...Array.from(
        { length: rows + 1 },
        (_, j) => levels[0][0] + ((top - levels[0][0]) * j) / rows,
      ),
      ...(portal ? [portal.y, portal.y + portal.h] : []),
    ]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < cuts.length; j++) {
    const y0 = cuts[j - 1],
      y1 = cuts[j],
      lower = at(y0),
      upper = at(y1);
    for (let i = 0; i < r.length; i++) {
      const n = outward(r, i),
        a = lower[i],
        b = lower[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        h = portal?.side === i ? portal : null;
      const cols = d > 1 ? Math.ceil(len / (d === 3 ? 1.8 : 5.2)) : 1;
      const us = [
        ...new Set([
          0,
          1,
          ...Array.from({ length: cols - 1 }, (_, k) => (k + 1 + (j % 2 ? 0.23 : -0.23)) / cols),
          ...(h ? [h.u - h.w / 2 / len, h.u + h.w / 2 / len] : []),
        ]),
      ].sort((a, b) => a - b);
      for (let k = 1; k < us.length; k++) {
        const u0 = us[k - 1],
          u1 = us[k],
          u = (u0 + u1) / 2,
          y = (y0 + y1) / 2;
        if (h && Math.abs(u - h.u) < h.w / 2 / len && y > h.y && y < h.y + h.h) continue;
        const p0 = faceAt(lower, i, u0),
          p1 = faceAt(lower, i, u1),
          p2 = faceAt(upper, i, u1),
          p3 = faceAt(upper, i, u0);
        const pts = [
          [p0[0], y0, p0[1]],
          [p1[0], y0, p1[1]],
          [p2[0], y1, p2[1]],
          [p3[0], y1, p3[1]],
        ];
        if (d === 3) {
          quad(o, 'stone', pts, mortar, n);
          const cc = pts.reduce((a, p) => a.map((v, k) => v + p[k] / 4), [0, 0, 0]),
            inset = pts.map((p) => p.map((v, k) => cc[k] + (v - cc[k]) * 0.965 + n[k] * 0.022));
          const variation = 0.83 + ((j * 47 + k * 29 + i * 71) % 37) / 100;
          const dh = (y1 - y0) * 0.1;
          for (let v = 0; v < 4; v++)
            inset[v][1] += (v < 2 ? 1 : -1) * dh * (0.2 + ((j * 19 + k * 13 + v * 7) % 11) / 11);
          const bevel = 0.08 + ((j * 17 + k * 11 + i * 3) % 13) / 100;
          polygon(
            o,
            'stone',
            [
              inset[0],
              inset[1],
              mix(inset[1], inset[2], 1 - bevel),
              mix(inset[2], inset[3], bevel),
              inset[3],
            ],
            tint(stone, variation),
            n,
          );
        } else quad(o, 'stone', pts, stone, n);
      }
    }
  }
  if (portal) {
    const mid = at(portal.y + portal.h / 2);
    opening(
      o,
      faceAt(mid, portal.side, portal.u),
      outward(r, portal.side),
      portal.w,
      portal.y,
      portal.h,
      d,
      { door: true },
    );
  }
  cap(o, 'stone', r, top, stone);
}
/** Curved hip eaves; each concentric ring raises its corners and thins toward the upturned lip. */
function roof(
  o,
  cx,
  cz,
  hx,
  hz,
  eave,
  rise,
  d,
  { colour = green, topX = 0.3, topZ = 3, gabled = false } = {},
) {
  const rings = [],
    steps = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 10,
    sideSteps = d === 0 ? 1 : d === 1 ? 1 : d === 2 ? 2 : 6;
  const plan = (t) => {
    const x = hx + (topX - hx) * t,
      z = hz + (topZ - hz) * t;
    const corners = [
        [-x, -z],
        [x, -z],
        [x, z],
        [-x, z],
      ],
      points = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < sideSteps; j++) {
        const u = j / sideSteps,
          p = mix(corners[i], corners[(i + 1) % 4], u),
          corner = Math.pow(Math.abs(u * 2 - 1), 4),
          curl = (1 - t) * (1 - t) * (0.2 + 0.85 * corner),
          y = eave + rise * Math.pow(t, 1.65) + curl;
        points.push([cx + p[0], y, cz + p[1]]);
      }
    return points;
  };
  for (let j = 0; j <= steps; j++) rings.push(plan(j / steps));
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      quad(
        o,
        'roof',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        colour,
        [0, 1, 0],
      );
    }
  polygon(o, 'roof', rings.at(-1), colour, [0, 1, 0]);
  const lip = rings[0];
  for (let i = 0; i < lip.length; i++) {
    const j = (i + 1) % lip.length,
      p = lip[i],
      q = lip[j];
    quad(o, 'plaster', [p, q, [q[0], q[1] - 0.2, q[2]], [p[0], p[1] - 0.2, p[2]]], white);
    if (d > 1)
      beam(
        o,
        'roof',
        p.map((v, k) => v + (k === 1 ? 0.035 : 0)),
        q.map((v, k) => v + (k === 1 ? 0.035 : 0)),
        0.14,
        0.16,
        colour === gray ? gray : greenTrim,
      );
  }
  // Closed shaded soffit extends from the outer lip to the inset supporting wall.
  const inset = Math.min(1.7, hx * 0.5, hz * 0.5),
    inner = [
      [-hx + inset, -hz + inset],
      [hx - inset, -hz + inset],
      [hx - inset, hz - inset],
      [-hx + inset, hz - inset],
    ];
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4,
      a = lip[i * sideSteps],
      b = lip[k * sideSteps];
    quad(
      o,
      'plaster',
      [
        [a[0], a[1] - 0.2, a[2]],
        [b[0], b[1] - 0.2, b[2]],
        [cx + inner[k][0], eave - 0.45, cz + inner[k][1]],
        [cx + inner[i][0], eave - 0.45, cz + inner[i][1]],
      ],
      white,
      [0, -1, 0],
    );
  }
  if (d > 1) {
    const spacing = d === 3 ? 1.0 : 6.0;
    for (let i = 0; i < 4; i++) {
      const a = lip[i * sideSteps],
        b = lip[((i + 1) % 4) * sideSteps],
        len = Math.hypot(b[0] - a[0], b[2] - a[2]),
        count = Math.floor(len / spacing),
        n = outward(
          [
            [-hx, -hz],
            [hx, -hz],
            [hx, hz],
            [-hx, hz],
          ],
          i,
        );
      for (let k = 1; k < count; k++) {
        const p = mix(a, b, k / count);
        beam(
          o,
          'plaster',
          [p[0] - n[0] * 1.55, eave - 0.32, p[2] - n[2] * 1.55],
          [p[0] - 0.12 * n[0], eave - 0.17, p[2] - 0.12 * n[2]],
          d === 3 ? 0.105 : 0.17,
          0.17,
          white,
        );
      }
    }
  }
  if (d === 3) {
    const edgePoint = (ring, side, u) => {
      const v = u * sideSteps,
        k = Math.min(sideSteps - 1, Math.floor(v));
      return mix(ring[side * sideSteps + k], ring[(side * sideSteps + k + 1) % ring.length], v - k);
    };
    for (let side = 0; side < 4; side++) {
      const a = lip[side * sideSteps],
        b = lip[((side + 1) % 4) * sideSteps],
        count = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.25);
      for (let k = 1; k < count; k++) {
        const u = k / count;
        let prev;
        for (let j = 0; j <= 6; j++) {
          const v = (j / 6) * steps,
            ri = Math.min(steps - 1, Math.floor(v)),
            p = mix(edgePoint(rings[ri], side, u), edgePoint(rings[ri + 1], side, u), v - ri);
          p[1] += 0.035;
          if (prev) {
            const dx = p[0] - prev[0],
              dz = p[2] - prev[2],
              len = Math.hypot(dx, dz);
            if (len > 0.01) {
              const nx = (-dz / len) * 0.035,
                nz = (dx / len) * 0.035;
              quad(
                o,
                'roof',
                [
                  [prev[0] - nx, prev[1], prev[2] - nz],
                  [p[0] - nx, p[1], p[2] - nz],
                  [p[0] + nx, p[1], p[2] + nz],
                  [prev[0] + nx, prev[1], prev[2] + nz],
                ],
                tint(colour, 0.94),
                [0, 1, 0],
              );
            }
          }
          prev = p;
        }
      }
    }
  }
  if (gabled) {
    for (const sign of [-1, 1]) {
      const q = facing(o, sign < 0 ? Math.PI : 0, cx, cz + sign * (hz * 0.78));
      gable(q, 0, 0, hx * 0.91, eave + 0.35, rise - 0.35, d, {
        colour,
        whiteFace: true,
        depth: 2.0,
      });
    }
  }
}
function gable(
  o,
  cx,
  z,
  half,
  y,
  h,
  d,
  { curved = false, colour = green, whiteFace = false, depth = 2.8 } = {},
) {
  const steps = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 8 : 18,
    profile = [];
  for (let j = 0; j <= steps; j++) {
    const x = -half + (2 * half * j) / steps,
      u = Math.min(1, Math.abs(x / half)),
      yy = curved
        ? h * Math.exp(-5 * u * u) + 0.23 * u * u
        : h * Math.pow(1 - u, 1.65) + 0.35 * u * u;
    profile.push([cx + x, y + yy, z]);
  }
  const poly = [[cx - half, y, z], ...profile, [cx + half, y, z]];
  polygon(o, whiteFace ? 'plaster' : 'wood', poly, whiteFace ? white : dark, [0, 0, 1]);
  for (let j = 1; j < profile.length; j++) {
    const a = profile[j - 1],
      b = profile[j];
    quad(
      o,
      'roof',
      [a, b, [b[0], y + 0.12, z - depth], [a[0], y + 0.12, z - depth]],
      colour,
      [0, 1, 0],
    );
    if (d > 0) {
      const strip = (slot, offset, width, c) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          dx = ((-(b[1] - a[1]) / len) * width) / 2,
          dy = (((b[0] - a[0]) / len) * width) / 2;
        quad(
          o,
          slot,
          [
            [a[0] - dx, a[1] - dy + offset, z + 0.1],
            [b[0] - dx, b[1] - dy + offset, z + 0.1],
            [b[0] + dx, b[1] + dy + offset, z + 0.1],
            [a[0] + dx, a[1] + dy + offset, z + 0.1],
          ],
          c,
          [0, 0, 1],
        );
      };
      strip('plaster', 0, 0.22, white);
      strip('roof', 0.15, 0.2, colour === gray ? gray : greenTrim);
    }
  }
  if (d > 1) {
    if (!whiteFace) {
      for (const x of [-0.19, 0, 0.19])
        B(o, 'plaster', cx + x, y + h * 0.58, z + 0.06, 0.07, Math.min(0.6, h * 0.2), 0.07, white);
      if (d === 3)
        for (const x of [-half * 0.42, half * 0.42])
          B(o, 'wood', cx + x, y + 0.25, z + 0.035, 0.08, h * 0.22, 0.07, tint(dark, 1.16));
    } else if (d === 3) {
      for (const x of [-0.28, 0.28])
        B(o, 'plaster', cx + x, y + h * 0.43, z + 0.08, 0.14, 0.5, 0.1, tint(white, 0.9));
      B(o, 'plaster', cx, y + h * 0.5, z + 0.12, 0.75, 0.12, 0.1, tint(white, 1.04));
    }
  }
}
function body(o, r, lo, hi, d, { small = false, top = false, portal } = {}) {
  const holes = [];
  if (d > 0)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = d === 1 ? Math.min(3, Math.floor(len / 4)) : Math.floor(len / (top ? 2.3 : 4.2));
      for (let j = 0; j < count; j++) {
        const u = (j + 0.5) / count,
          h = top ? 1.3 : Math.min(1.6, (hi - lo) * 0.42),
          y = top ? lo + 0.45 : lo + (hi - lo) * 0.38;
        if (portal && portal.side === i && Math.abs(u - portal.u) * len < portal.w / 2 + 1)
          continue;
        holes.push({ side: i, u, w: top ? 1.55 : small ? 1.25 : 1.45, y, h, bars: !top });
      }
    }
  if (portal) holes.push({ ...portal, door: true });
  wall(o, r, lo, hi, holes, d);
  if (d === 3)
    for (let i = 0; i < r.length; i++) {
      const n = outward(r, i),
        a = r[i],
        b = r[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        q = facing(o, Math.atan2(n[0], n[2]), ...a);
      for (let k = 0; k <= Math.floor(len / 4); k++) {
        const p = faceAt(r, i, k / Math.floor(len / 4));
        B(o, 'plaster', p[0] + n[0] * 0.09, lo - 0.1, p[1] + n[2] * 0.09, 0.22, 0.23, 0.22, white);
      }
      if (d === 3) {
        B(q, 'metal', 0, lo, 0.03, 0.1, hi - lo, 0.1, greenTrim);
      }
    }
}
function shachi(o, z, height, sign, d) {
  const q = facing(o, sign > 0 ? 0 : Math.PI, 0, z),
    h = height / 2.621;
  const shape =
    d === 0
      ? [
          [-0.9, 0],
          [-1.15, 0.4],
          [-0.3, 0.75],
          [0.25, 1.5],
          [0.05, 2.621],
          [0.65, 2.18],
          [0.8, 0.85],
          [0.35, 0.15],
        ]
      : [
          [-0.9, 0],
          [-1.2, 0.25],
          [-1.18, 0.55],
          [-0.72, 0.75],
          [-0.3, 0.63],
          [0.05, 1.15],
          [0.16, 1.8],
          [-0.04, 2.3],
          [0.15, 2.621],
          [0.48, 2.4],
          [0.78, 2.05],
          [0.58, 1.55],
          [0.9, 1.03],
          [0.69, 0.55],
          [0.2, 0.12],
        ];
  const pts = shape.map(([zz, y]) => [zz * sign, y * h + 45.3, 0]);
  // Sculpture profile lies in its own ridge plane; scaled height remains operator controlled.
  const r = facing(q, Math.PI / 2);
  for (const x of [-0.2, 0.2])
    polygon(
      r,
      'gold',
      pts.map((p) => [p[0], p[1], x]),
      gold,
      [0, 0, x > 0 ? 1 : -1],
    );
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    quad(
      r,
      'gold',
      [
        [a[0], a[1], -0.2],
        [b[0], b[1], -0.2],
        [b[0], b[1], 0.2],
        [a[0], a[1], 0.2],
      ],
      gold,
    );
  }
  if (d > 1) {
    for (let j = 0; j < 7; j++)
      B(r, 'gold', 0.2, 45.8 + j * 0.18, 0.24, 0.22, 0.055, 0.07, tint(gold, 0.85));
  }
}
function bridge(o, d) {
  B(o, 'stone', 8, -3, 30, 8.5, 10.54, 20.7, stone);
  for (const x of [3.75, 12.25]) {
    B(o, 'plaster', x, 7.54, 30, 0.52, 2.35, 20.7, white);
    if (d === 0) B(o, 'roof', x, 9.89, 30, 0.8, 0.22, 20.8, gray);
    else
      roof(facing(o, 0, x, 30), 0, 0, 0.57, 10.5, 9.89, 0.27, d, {
        colour: gray,
        topX: 0.08,
        topZ: 10.1,
      });
  }
  B(o, 'stone', 8, 7.51, 30, 7.98, 0.09, 20.7, tint(stone, 1.13));
  B(o, 'stone', 8.3, 7.45, 41, 3.2, 0.25, 3, stone);
}
function stairs(o, d) {
  // Two narrow dogleg flights outside the north end of the small keep's east wall.
  const flights = [
    { x: 30.5, z: 40, sign: 1, lo: 1.65, hi: 3.1 },
    { x: 32.15, z: 46, sign: -1, lo: 0.16, hi: 1.65 },
  ];
  B(o, 'metal', 30.65, 2.98, 46.15, 2, 0.12, 1.8, gray);
  B(o, 'metal', 31.3, 1.52, 39.5, 3.15, 0.12, 1.35, gray);
  for (const f of flights) {
    const n = d === 0 ? 3 : d === 1 ? 6 : 10;
    for (let j = 0; j < n; j++) {
      const y = f.lo + ((f.hi - f.lo) * (j + 1)) / n,
        z = f.z + (f.sign * (j + 0.5) * 6) / n;
      B(o, 'metal', f.x, y - 0.1, z, 1.35, 0.1, 6 / n, white);
    }
    for (const side of [-1, 1]) {
      const x = f.x + side * 0.68,
        a = [x, f.lo + 1.03, f.z],
        b = [x, f.hi + 1.03, f.z + f.sign * 6];
      beam(o, 'metal', a, b, d > 1 ? 0.05 : 0.1, 0.06, white);
      if (d > 1)
        for (let k = 0; k <= 6; k++) {
          const z = f.z + f.sign * k,
            y = f.lo + ((f.hi - f.lo) * k) / 6;
          B(o, 'metal', x, y, z, 0.045, 1.03, 0.045, white);
        }
    }
  }
}
function modernAccess(o, frame, d) {
  const r = frame.features.find((f) => f.index === 26).rings[0];
  const holes = d > 0 ? [{ side: 1, u: 0.5, w: 2.4, y: 13.3, h: 2.5, bars: false }] : [];
  wall(o, r, -0.65, 16.7, holes, d, 'plaster', tint(white, 1.025));
  B(o, 'metal', 18.2, 12.85, -10, 5, 0.34, 2, gray);
  for (const z of [-11.1, -8.9]) B(o, 'plaster', 18.2, 13.15, z, 5, 1.1, 0.2, white);
  if (d > 1) {
    const n = outward(r, 2);
    for (const u of [0.18, 0.5, 0.82]) {
      const p = faceAt(r, 2, u);
      B(o, 'metal', p[0] + n[0] * 0.05, 0, p[1] + n[2] * 0.05, 0.025, 16.4, 0.025, tint(gray, 1.4));
    }
  }
}
export function nagoyaCastle(o, frame = defaultFrame, d = 3) {
  const part = (i) => frame.features.find((f) => f.index === i).rings[0],
    base = part(2);
  stoneBase(o, base, 12.48, d, { portal: { side: 3, u: 0.28, w: 3.6, y: 7.54, h: 3.1 } });
  const main = [
    { i: 4, lo: 12.48, hi: 16.71 },
    { i: 3, lo: 18.1, hi: 23.57 },
    { i: 5, lo: 27.25, hi: 31.07 },
    { i: 7, lo: 34.4, hi: 37.96 },
    { i: 8, lo: 39.65, hi: 41.9 },
  ];
  for (let j = 0; j < main.length; j++) {
    const t = main[j],
      r = j === 1 ? expanded(part(t.i), -0.45) : part(t.i);
    body(o, r, t.lo, t.hi, d, { top: j === 4 });
    const bb = bounds(r),
      hx = (bb.max[0] - bb.min[0]) / 2 + 1.9,
      hz = (bb.max[1] - bb.min[1]) / 2 + 1.9,
      cx = (bb.max[0] + bb.min[0]) / 2,
      cz = (bb.max[1] + bb.min[1]) / 2;
    const next = j < 4 ? bounds(part(main[j + 1].i)) : null;
    roof(o, cx, cz, hx, hz, t.hi, j === 0 ? 1.42 : j === 3 ? 1.69 : j === 4 ? 3.4 : 3.65, d, {
      colour: j === 0 ? gray : green,
      topX: j === 4 ? 0.24 : (next.max[0] - next.min[0]) / 2 - 0.3,
      topZ: j === 4 ? hz * 0.75 : (next.max[1] - next.min[1]) / 2 - 0.3,
      gabled: j === 4,
    });
    if (j > 0 && j < 4) {
      for (const side of [-1, 1]) {
        const east = facing(o, (side * Math.PI) / 2, cx + side * (hx - 0.25), cz);
        if (j === 1)
          for (const x of [-hz * 0.55, hz * 0.55]) gable(east, x, 0, 4.65, t.hi + 0.5, 3.8, d);
        else
          gable(east, 0, 0, j === 2 ? hz * 0.78 : hz * 0.62, t.hi + 0.55, j === 2 ? 5.3 : 1.9, d, {
            curved: j === 3,
          });
        const end = facing(o, side > 0 ? 0 : Math.PI, cx, cz + side * (hz - 0.22));
        gable(
          end,
          0,
          0,
          j === 1 ? hx * 0.7 : j === 2 ? hx * 0.65 : hx * 0.7,
          t.hi + 0.5,
          j === 1 ? 2.4 : j === 2 ? 4.2 : 2.1,
          d,
          { curved: j !== 2 },
        );
      }
    }
  }
  shachi(o, -7.45, 2.621, -1, d);
  shachi(o, 7.45, 2.579, 1, d);
  const sr = part(24);
  stoneBase(o, sr, 7.7, d, { small: true, portal: { side: 1, u: 0.2, w: 2.65, y: 3.1, h: 3.6 } });
  const lower = expanded(sr, -1.6);
  body(o, lower, 7.7, 12.8, d, {
    small: true,
    portal: { side: 0, u: 0.3, w: 3.2, y: 7.7, h: 2.8 },
  });
  const small = facing(o, -0.057, 13.46, 51.3);
  roof(small, 0, 0, 15, 10.6, 12.8, 4.2, d, { colour: gray, topX: 7.6, topZ: 4.8 });
  const upper = [
    [-8, -5.6],
    [8, -5.6],
    [8, 5.6],
    [-8, 5.6],
  ];
  body(small, upper, 16.7, 20.15, d, { small: true });
  roof(facing(small, Math.PI / 2), 0, 0, 7.4, 10, 20.15, 3.85, d, {
    colour: gray,
    topX: 0.16,
    topZ: 7.5,
    gabled: true,
  });
  for (const side of [-1, 1])
    gable(facing(small, (side * Math.PI) / 2, side * 14.4, 0), 0, 0, 4.8, 13.4, 2.5, d, {
      curved: true,
      colour: gray,
      whiteFace: true,
    });
  bridge(o, d);
  stairs(o, d);
  modernAccess(o, frame, d);
}
export const nagoyaCastleSkyline = (o, f) => nagoyaCastle(o, f, 0);
export const nagoyaCastleDistrict = (o, f) => nagoyaCastle(o, f, 1);
export const nagoyaCastleStreet = (o, f) => nagoyaCastle(o, f, 2);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.85, metallic: 0.08 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.2 },
  wood: { slot: 'door', localRef: 'palette:#fefefe', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.06 },
  gold: { slot: 'trim', localRef: 'palette:#fffefe', roughness: 0.42, metallic: 0.72 },
};
export const nagoyaCastleModel = {
  id: 'nagoya_castle',
  key: 'nagoya_castle',
  recipe: 'structure-nagoya-castle.mjs',
  cell: 'xn/xn3',
  title: 'Nagoya Castle',
  brief:
    'Present main and offset small keeps with curved fan stone bases, five white main tiers, green copper roofs with curved eaves and varied dark gables, paired gold north/south shachi, two gray tiled small-keep roofs, raised stone connection with white parapets, recessed entrances, narrow exterior dogleg stairs and attached modern east access tower. Separate Honmaru Palace and castle enclosure excluded.',
  camera: [105, 62, 128],
  lookAt: [4, 21, 20],
  mediumFiContext: { scale: 1.5 },
  qaCameras: [
    { name: 'front', position: [110, 44, 110], lookAt: [6, 21, 22] },
    { name: 'main-east-detail', position: [62, 28, 12], lookAt: [0, 26, 0] },
    { name: 'back', position: [-87, 40, -106], lookAt: [0, 21, 7] },
    { name: 'small-keep-entry', position: [52, 15, 68], lookAt: [22, 11, 48] },
    { name: 'connection', position: [48, 19, 30], lookAt: [8, 9, 29] },
    { name: 'roof-and-gold', position: [32, 49, 30], lookAt: [0, 40, 0] },
    { name: 'stone-moat', position: [-36, -1, -48], lookAt: [-6, 10, -6] },
    { name: 'overhead', position: [60, 112, 105], lookAt: [4, 7, 23] },
  ],
  build: nagoyaCastle,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent original GSI5A/10m fallback frozen before geometry,25921 valid samples; dry east court[34,10] datum14.825m. Native stone caps and inferred lower batter remain distinct from ground. Own bridge floor7.6m and bottom exterior stair approach.16m clear the held-fixed field after bounded geometric correction; these thresholds and inferred foundation toes are engineering approximations. Default Earth terrain is not certified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-nagoya-castle.mjs',
    level: 'skyline',
    export: 'nagoyaCastleSkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'nagoyaCastleDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'nagoyaCastleStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    'Nine actually inspected dated local originals2011–2025 control the present1959 concrete keeps, not the proposed future wooden rebuild. Source photographs/owner illustrations are not redistributed. Palace, detached turrets, gardens, temporary stalls/trees/signs and interiors are excluded.',
    'Native main stone-cap and five tier polygons guide plan and12.48/16.71/23.57/31.07/37.96/41.9m vertical sequence. Approximate48m main/24m small operator visitor figures and2.621m north/2.579m south gold ornaments constrain silhouette.55.6m including stone wall has unspecified endpoints; it is not a terrain-fitting instruction. Lower stone toe, wall/floor offsets, gables, bay counts, stair engineering and unseen details remain authored estimates.',
    'Original GSI elevation PNGs retained unchanged;25663 fine-layer and258 coarse-fallback samples.1m review grid oversamples approximately3.9m/7.8m native pixels. Foundation/hidden-ground classification and epoch are unspecified; no survey accuracy or geodetic transformation claimed. Compatible host terrain is required; default coarse Earth terrain not certified. Footprint replacement disabled.',
  ],
};
