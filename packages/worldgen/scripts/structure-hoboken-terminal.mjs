/** Surviving joined ferry/rail terminal; western platform sheds are separate structures. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';

const towerControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dr/dr5/hoboken_terminal/tower-craft-construction-controls.json',
      import.meta.url,
    ),
  ),
);

import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  tau = 2 * Math.PI;
const copper = rgb('78a398'),
  light = rgb('9ab9aa'),
  brown = rgb('79645a'),
  dark = rgb('36443f'),
  glass = rgb('596b65'),
  red = rgb('73504a'),
  stone = rgb('c1b9a5'),
  concrete = rgb('aaa99b'),
  roof = rgb('66685e'),
  timber = rgb('796f5d'),
  white = rgb('d7dfd5'),
  gold = rgb('c8b273');
const facade = {
  center: [-92.42214, 30.543085],
  angle: -1.9875938146224437,
  length: 144.74597662435562,
};
function poly(o, s, ring, y0, y1, col) {
  const r = ring.map((p) => p.slice());
  if (
    r.reduce(
      (n, p, i) => n + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const v0 = v(p);
      return [v0[0] + x, v0[1], v0[2] + z];
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
function panel(o, s, x, y, z, w, h, c) {
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
function plate(o, s, p, z, depth, c) {
  if (
    p.reduce(
      (sum, q, i) => sum + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1],
      0,
    ) < 0
  )
    p = [...p].reverse();
  loft(o, s, [p.map(([x, y]) => [x, y, z - depth]), p.map(([x, y]) => [x, y, z])], c);
}
function bar(o, d, s, x, y, z, w, h, depth, c) {
  if (d === 3) B(o, s, x, y, z, w, h, depth, c);
  else panel(o, s, x, y, z + depth / 2, w, h, c);
}
function round(o, s, x, z, y, h, r, c, n = 8) {
  loft(o, s, [radialRing(y, r, r, n, [x, z]), radialRing(y + h, r, r, n, [x, z])], c);
}
function disc(o, s, x, y, z, r, c, n = 24) {
  o.addConvexPolygon(
    s,
    ref,
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * tau) / n),
      y + r * Math.sin((i * tau) / n),
      z,
    ]),
    [0, 0, 1],
    (p) => [p[0], p[1]],
    c,
  );
}
function rectangle(o, d, x, y, z, w, h, depth = 0.45, col = glass, arch = false) {
  if (arch) {
    archedWindow(o, d, x, y, z, w, h, depth);
    return;
  }
  panel(o, 'glass', x, y, z - depth, w, h, col);
  for (const sign of [-1, 1])
    quad(
      o,
      'copper',
      [
        [x + (sign * w) / 2, y, z],
        [x + (sign * w) / 2, y + h, z],
        [x + (sign * w) / 2, y + h, z - depth],
        [x + (sign * w) / 2, y, z - depth],
      ],
      [-sign, 0, 0],
      copper,
    );
  for (const [yy, n] of [
    [y, [0, 1, 0]],
    [y + h, [0, -1, 0]],
  ])
    quad(
      o,
      'copper',
      [
        [x - w / 2, yy, z],
        [x + w / 2, yy, z],
        [x + w / 2, yy, z - depth],
        [x - w / 2, yy, z - depth],
      ],
      n,
      copper,
    );
  if (d === 0) return;
  const pitch = d === 1 ? 2.8 : d === 2 ? 2.5 : 0.55;
  for (let xx = x - w / 2 + pitch; xx < x + w / 2 - 0.03; xx += pitch)
    bar(o, d, 'metal', xx, y, z - depth + 0.08, 0.06, h, 0.08, red);
  for (let yy = y + pitch; yy < y + h - 0.03; yy += pitch)
    bar(o, d, 'metal', x, yy, z - depth + 0.08, w, 0.06, 0.08, red);
  if (d > 1) {
    for (const sign of [-1, 1])
      B(o, 'trim', x + sign * (w / 2 + 0.12), y, z + 0.02, 0.18, h, 0.18, light);
    B(o, 'trim', x, y + h, z + 0.02, w + 0.4, 0.2, 0.2, light);
  }
}
function archedWindow(o, d, x, y, z, w, h, dep) {
  const rx = w / 2,
    ry = 3.7,
    sy = y + h - ry,
    n = d === 3 ? 24 : d === 2 ? 12 : 6,
    pts = Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI - (i * Math.PI) / n;
      return [x + rx * Math.cos(a), sy + ry * Math.sin(a)];
    }),
    ring = [[x - rx, y], [x + rx, y], ...pts.slice().reverse()];
  o.addConvexPolygon(
    'glass',
    ref,
    ring.map((p) => [...p, z - dep]),
    [0, 0, 1],
    (p) => [p[0], p[1]],
    glass,
  );
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      p = [
        [...a, z],
        [...b, z],
        [b[0], y + h, z],
        [a[0], y + h, z],
      ],
      unique = p.filter((q, i) => Math.hypot(...q.map((v, k) => v - p[(i + 3) % 4][k])) > 1e-5);
    if (unique.length === 3)
      o.addTriangle(
        'copper',
        ref,
        unique,
        [0, 0, 1],
        unique.map((p) => [p[0], p[1]]),
        copper,
      );
    else if (unique.length === 4) quad(o, 'copper', unique, [0, 0, 1], copper);
    quad(
      o,
      'copper',
      [
        [...a, z],
        [...a, z - dep],
        [...b, z - dep],
        [...b, z],
      ],
      normalFor([...a, z], [...a, z - dep], [...b, z - dep]),
      copper,
    );
    if (d === 3) beam(o, 'trim', [...a, z + 0.06], [...b, z + 0.06], 0.16, 0.18, light);
    else if (d === 2)
      quad(
        o,
        'trim',
        [
          [...a, z + 0.12],
          [...b, z + 0.12],
          [b[0], b[1] + 0.16, z + 0.12],
          [a[0], a[1] + 0.16, z + 0.12],
        ],
        [0, 0, 1],
        light,
      );
  }
  for (const sign of [-1, 1])
    quad(
      o,
      'copper',
      [
        [x + sign * rx, y, z],
        [x + sign * rx, sy, z],
        [x + sign * rx, sy, z - dep],
        [x + sign * rx, y, z - dep],
      ],
      [-sign, 0, 0],
      copper,
    );
  quad(
    o,
    'copper',
    [
      [x - rx, y, z],
      [x - rx, y, z - dep],
      [x + rx, y, z - dep],
      [x + rx, y, z],
    ],
    [0, 1, 0],
    copper,
  );
  if (d > 0) {
    const pitch = d === 1 ? 3 : d === 2 ? 2.5 : 0.55;
    for (let xx = x - rx + pitch; xx < x + rx - 0.05; xx += pitch) {
      const top = sy + ry * Math.sqrt(Math.max(0, 1 - ((xx - x) / rx) ** 2));
      bar(o, d, 'metal', xx, y, z - dep + 0.07, 0.06, top - y, 0.08, red);
    }
    for (let yy = y + pitch; yy < y + h - 0.05; yy += pitch) {
      const half = yy > sy ? rx * Math.sqrt(Math.max(0, 1 - ((yy - sy) / ry) ** 2)) : rx;
      bar(o, d, 'metal', x, yy, z - dep + 0.07, 2 * half, 0.06, 0.08, red);
    }
  }
}
function wall(o, d, w, y0, y1, holes, z = 0, s = 'copper', color = copper) {
  const xs = [-w / 2, w / 2, ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2])].sort(
    (a, b) => a - b,
  );
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    if (b - a < 1e-5) continue;
    const open = holes
      .filter((h) => (a + b) / 2 > h.x - h.w / 2 && (a + b) / 2 < h.x + h.w / 2)
      .sort((a, b) => a.y - b.y);
    let y = y0;
    for (const h of open) {
      if (h.y > y) panel(o, s, (a + b) / 2, y, z, b - a, h.y - y, color);
      y = h.y + h.h;
    }
    if (y < y1) panel(o, s, (a + b) / 2, y, z, b - a, y1 - y, color);
  }
  for (const h of holes.filter((h) => !h.open))
    rectangle(o, d, h.x, h.y, z, h.w, h.h, h.depth ?? 0.45, h.col ?? glass, h.arch);
}
function roofFace(o, s, p, c) {
  let n = normalFor(...p);
  if (n[1] < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(o, s, p, n, c);
  else
    o.addTriangle(
      s,
      ref,
      p,
      n,
      p.map((p) => [p[0], p[2]]),
      c,
    );
}
function gable(o, x, z, w, dep, y, peak, c, d) {
  for (const sign of [-1, 1])
    roofFace(
      o,
      'copper',
      [
        [x + (sign * w) / 2, y, z - dep / 2],
        [x + (sign * w) / 2, y, z + dep / 2],
        [x, peak, z + dep / 2],
        [x, peak, z - dep / 2],
      ],
      c,
    );
  if (d > 1)
    for (let zz = z - dep / 2 + 1; zz < z + dep / 2; zz += d === 2 ? 3 : 1.2)
      for (const sign of [-1, 1])
        beam(
          o,
          'trim',
          [x + (sign * w) / 2, y + 0.02, zz],
          [x, peak + 0.02, zz],
          0.035,
          0.05,
          light,
        );
}
const glyph = {
  V: [
    [
      [0, 1],
      [0.35, 0],
      [0.7, 1],
    ],
  ],
  X: [
    [
      [0, 0],
      [0.7, 1],
    ],
    [
      [0, 1],
      [0.7, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [0.7, 0],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.35, 1],
      [0.7, 0],
    ],
    [
      [0.15, 0.43],
      [0.55, 0.43],
    ],
  ],
  C: [
    [
      [0.7, 0.9],
      [0.5, 1],
      [0.15, 1],
      [0, 0.8],
      [0, 0.2],
      [0.15, 0],
      [0.5, 0],
      [0.7, 0.1],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0.7, 1],
      [0, 0.5],
      [0.7, 0],
    ],
  ],
  W: [
    [
      [0, 1],
      [0.15, 0],
      [0.35, 0.65],
      [0.55, 0],
      [0.7, 1],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [0.7, 0],
      [0.7, 1],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.5, 1],
      [0.7, 0.8],
      [0.5, 0.55],
      [0, 0.55],
    ],
    [
      [0.4, 0.55],
      [0.7, 0],
    ],
  ],
  I: [
    [
      [0.35, 0],
      [0.35, 1],
    ],
    [
      [0.1, 0],
      [0.6, 0],
    ],
    [
      [0.1, 1],
      [0.6, 1],
    ],
  ],
  T: [
    [
      [0, 1],
      [0.7, 1],
    ],
    [
      [0.35, 0],
      [0.35, 1],
    ],
  ],
  G: [
    [
      [0.7, 0.85],
      [0.5, 1],
      [0.15, 1],
      [0, 0.8],
      [0, 0.2],
      [0.15, 0],
      [0.7, 0],
      [0.7, 0.5],
      [0.4, 0.5],
    ],
  ],
  O: [
    [
      [0.15, 0],
      [0, 0.2],
      [0, 0.8],
      [0.15, 1],
      [0.55, 1],
      [0.7, 0.8],
      [0.7, 0.2],
      [0.55, 0],
      [0.15, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.35, 0.5],
      [0.7, 1],
      [0.7, 0],
    ],
  ],
  E: [
    [
      [0.7, 1],
      [0, 1],
      [0, 0],
      [0.7, 0],
    ],
    [
      [0, 0.5],
      [0.55, 0.5],
    ],
  ],
  1: [
    [
      [0.15, 0.8],
      [0.35, 1],
      [0.35, 0],
    ],
    [
      [0.05, 0],
      [0.65, 0],
    ],
  ],
  9: [
    [
      [0.65, 0],
      [0.65, 0.8],
      [0.5, 1],
      [0.15, 1],
      [0, 0.75],
      [0.15, 0.5],
      [0.65, 0.5],
    ],
  ],
  0: [
    [
      [0.15, 0],
      [0, 0.2],
      [0, 0.8],
      [0.15, 1],
      [0.55, 1],
      [0.7, 0.8],
      [0.7, 0.2],
      [0.55, 0],
      [0.15, 0],
    ],
  ],
  7: [
    [
      [0, 1],
      [0.7, 1],
      [0.2, 0],
    ],
  ],
};
function text(o, d, str, x, y, z, height, advance, col = gold) {
  if (d < 2) return;
  for (let i = 0; i < str.length; i++)
    for (const line of glyph[str[i]] ?? [])
      for (let j = 1; j < line.length; j++) {
        const a = [
            x + (i - str.length / 2) * advance + line[j - 1][0] * height,
            y + line[j - 1][1] * height,
            z,
          ],
          b = [
            x + (i - str.length / 2) * advance + line[j][0] * height,
            y + line[j][1] * height,
            z,
          ];
        if (d === 3) beam(o, 'metal', a, b, 0.055 * height, 0.055 * height, col);
        else {
          const dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy),
            xx = (-dy / len) * height * 0.025,
            yy = (dx / len) * height * 0.025;
          quad(
            o,
            'metal',
            [
              [a[0] + xx, a[1] + yy, z],
              [a[0] - xx, a[1] - yy, z],
              [b[0] - xx, b[1] - yy, z],
              [b[0] + xx, b[1] + yy, z],
            ],
            [0, 0, 1],
            col,
          );
        }
      }
}
function clock(o, d, y = 51.2, r = 1.8288, z = 3.43) {
  if (d === 3) {
    constructedTowerClock(o, y, r, z);
    return;
  }
  disc(o, 'trim', 0, y, z, r + 0.16, brown, d < 2 ? 12 : d === 2 ? 24 : 40);
  disc(o, 'dial', 0, y, z + 0.025, r, white, d < 2 ? 12 : d === 2 ? 24 : 40);
  if (d < 2) return;
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12;
    beam(
      o,
      'metal',
      [Math.sin(a) * r * 0.82, y + Math.cos(a) * r * 0.82, z + 0.06],
      [Math.sin(a) * r * 0.96, y + Math.cos(a) * r * 0.96, z + 0.06],
      0.055,
      0.045,
      dark,
    );
  }
  beam(o, 'metal', [0, y, z + 0.1], [-r * 0.4, y + r * 0.27, z + 0.1], 0.09, 0.08, dark);
  beam(o, 'metal', [0, y, z + 0.1], [r * 0.2, y + r * 0.72, z + 0.1], 0.065, 0.07, dark);
  if (d === 3)
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12,
        num = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][i];
      text(
        o,
        3,
        num,
        Math.sin(a) * r * 0.72 + 0.06,
        y + Math.cos(a) * r * 0.72 - 0.15,
        z + 0.08,
        0.28,
        0.22,
        dark,
      );
    }
  if (d === 3)
    for (let i = 0; i < 60; i++) {
      const a = (i * tau) / 60;
      beam(
        o,
        'metal',
        [Math.sin(a) * r * 0.92, y + Math.cos(a) * r * 0.92, z + 0.055],
        [Math.sin(a) * r * 0.98, y + Math.cos(a) * r * 0.98, z + 0.055],
        0.022,
        0.026,
        dark,
      );
    }
}

// Closed profiled metal stocks and original clock lettering, authored in meters.
function towerQuad(o, slot, p, color) {
  const n = normalFor(...p),
    u = p[1].map((v, i) => v - p[0][i]),
    len = Math.hypot(...u);
  for (let i = 0; i < 3; i++) u[i] /= len;
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]],
    uv = p.map((q) => {
      const d = q.map((v, i) => v - p[0][i]);
      return [d.reduce((s, x, i) => s + x * u[i], 0), d.reduce((s, x, i) => s + x * v[i], 0)];
    });
  o.addQuad(slot, ref, p, n, uv, color);
}
function towerStock(o, slot, points, back, front, color) {
  if (
    points.reduce(
      (sum, p, i) =>
        sum + p[0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * p[1],
      0,
    ) < 0
  )
    points = [...points].reverse();
  const rings = [back, front].map((z) => points.map(([x, y]) => [x, y, z]));
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    towerQuad(o, slot, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]], color);
  }
  const ids = earcut(points.flat());
  for (const [r, reverse] of [
    [rings[0], true],
    [rings[1], false],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids.slice(i, i + 3).map((j) => r[j]);
      if (normalFor(...p)[2] < 0 !== reverse) p = [...p].reverse();
      o.addTriangle(
        slot,
        ref,
        p,
        normalFor(...p),
        p.map((p) => [p[0], p[1]]),
        color,
      );
    }
}
function towerRod(o, slot, a, b, w, back, front, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    u = [(dy * w) / (2 * len), (-dx * w) / (2 * len)];
  towerStock(
    o,
    slot,
    [
      [a[0] + u[0], a[1] + u[1]],
      [b[0] + u[0], b[1] + u[1]],
      [b[0] - u[0], b[1] - u[1]],
      [a[0] - u[0], a[1] - u[1]],
    ],
    back,
    front,
    color,
  );
}
function towerRing(o, slot, y, profile, n, color) {
  const point = (a, [r, z]) => [r * Math.cos(a), y + r * Math.sin(a), z];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < profile.length; j++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        k = (j + 1) % profile.length;
      towerQuad(
        o,
        slot,
        [point(a, profile[j]), point(b, profile[j]), point(b, profile[k]), point(a, profile[k])],
        color,
      );
    }
}
function towerEllipse(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * tau) / n),
    y + r * Math.sin((i * tau) / n),
  ]);
}
function constructedTowerClock(o, y, r, z) {
  const n = towerControls.clockSegments;
  towerRing(
    o,
    'towerClockCase',
    y,
    [
      [2.04, z - 0.09],
      [2.04, z + 0.06],
      [2, z + 0.14],
      [1.87, z + 0.14],
      [1.85, z + 0.06],
      [1.85, z - 0.09],
    ],
    n,
    brown,
  );
  towerStock(o, 'towerDial', towerEllipse(0, y, r, n), z - 0.045, z + 0.03, white);
  towerRing(
    o,
    'towerClockInk',
    y,
    [
      [1.3125, z + 0.033],
      [1.3125, z + 0.058],
      [1.2875, z + 0.058],
      [1.2875, z + 0.033],
    ],
    n,
    dark,
  );
  for (let i = 0; i < 60; i++) {
    const a = Math.PI / 2 - (i * tau) / 60,
      lo = i % 5 === 0 ? 1.69 : 1.74;
    towerRod(
      o,
      'towerClockInk',
      [lo * Math.cos(a), y + lo * Math.sin(a)],
      [1.805 * Math.cos(a), y + 1.805 * Math.sin(a)],
      i % 5 === 0 ? 0.028 : 0.017,
      z + 0.035,
      z + 0.055,
      dark,
    );
  }
  const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - (i * tau) / 12,
      ca = Math.cos(a),
      sa = Math.sin(a),
      local = (u, v) => [1.5 * ca + u * sa + v * ca, y + 1.5 * sa - u * ca + v * sa];
    let cursor = -(romans[i].length - 1) * 0.066;
    for (const ch of romans[i]) {
      const segments =
        ch === 'I'
          ? [
              [
                [0, -0.18],
                [0, 0.18],
              ],
            ]
          : ch === 'V'
            ? [
                [
                  [-0.05, 0.18],
                  [0, -0.18],
                ],
                [
                  [0, -0.18],
                  [0.05, 0.18],
                ],
              ]
            : [
                [
                  [-0.05, -0.18],
                  [0.05, 0.18],
                ],
                [
                  [-0.05, 0.18],
                  [0.05, -0.18],
                ],
              ];
      for (const [p, q] of segments)
        towerRod(
          o,
          'towerClockInk',
          local(cursor + p[0], p[1]),
          local(cursor + q[0], q[1]),
          0.021,
          z + 0.035,
          z + 0.06,
          dark,
        );
      cursor += 0.132;
    }
  }
  for (const [len, a] of [
    [0.98, 2.56],
    [1.48, 1.27],
  ]) {
    const transform = ([u, v]) => [
      u * Math.sin(a) + v * Math.cos(a),
      y - u * Math.cos(a) + v * Math.sin(a),
    ];
    towerStock(
      o,
      'towerClockInk',
      [
        [0, -0.25],
        [0.075, 0.1],
        [0, len],
        [-0.075, 0.1],
      ].map(transform),
      z + 0.065,
      z + 0.115,
      dark,
    );
  }
  towerStock(o, 'towerClockInk', towerEllipse(0, y, 0.11, 12), z + 0.115, z + 0.145, dark);
}
function towerClosedLoft(o, slot, rings, color) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      towerQuad(o, slot, [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]], color);
    }
  for (const [r, reverse] of [
    [rings[0], true],
    [rings.at(-1), false],
  ]) {
    const p = reverse ? [...r].reverse() : r;
    o.addConvexPolygon(slot, ref, p, normalFor(...p), (p) => [p[0], p[2]], color);
  }
}
function constructedTowerCraft(o) {
  for (const profile of [
    [
      [55.95, 3.475],
      [56.1, 3.475],
      [56.2, 3.675],
      [56.35, 3.675],
      [56.5, 3.5],
    ],
    [
      [61.55, 3.25],
      [61.63, 3.25],
      [61.73, 3.575],
      [61.86, 3.575],
      [62, 3.35],
    ],
  ])
    towerClosedLoft(
      o,
      'towerCornice',
      profile.map(([y, w]) => [
        [-w, y, -w],
        [-w, y, w],
        [w, y, w],
        [w, y, -w],
      ]),
      brown,
    );
  for (let face = 0; face < 4; face++) {
    const q = facing(o, (face * tau) / 4),
      tri = (w, base, peak, z) => [
        [-w, base, z],
        [w, base, z],
        [0, peak, z],
      ],
      profile = [
        tri(3.8, 54.2, 56.25, 3.3),
        tri(4, 54.1, 56.4, 3.72),
        tri(4, 54.1, 56.4, 3.86),
        tri(3.1, 54.45, 55.95, 3.86),
        tri(3.1, 54.45, 55.95, 3.3),
      ];
    for (let j = 0; j < profile.length; j++)
      for (let i = 0; i < 3; i++) {
        const k = (i + 1) % 3,
          n = (j + 1) % profile.length;
        towerQuad(
          q,
          'towerHood',
          [profile[j][i], profile[j][k], profile[n][k], profile[n][i]],
          brown,
        );
      }
    towerStock(
      q,
      'towerHood',
      [
        [-3.1, 54.45],
        [3.1, 54.45],
        [0, 55.95],
      ],
      3.28,
      3.5,
      brown,
    );
    for (const sign of [-1, 1]) {
      const x = sign * 2.42,
        rings = [
          [56.6, 0.27, 0.16],
          [56.78, 0.18, 0.11],
          [61.4, 0.18, 0.11],
          [61.52, 0.27, 0.16],
        ].map(([y, w, d]) => {
          const z = 2.96,
            c = 0.025;
          return [
            [-w / 2 + c, -d / 2],
            [-w / 2, -d / 2 + c],
            [-w / 2, d / 2 - c],
            [-w / 2 + c, d / 2],
            [w / 2 - c, d / 2],
            [w / 2, d / 2 - c],
            [w / 2, -d / 2 + c],
            [w / 2 - c, -d / 2],
          ].map(([u, v]) => [x + u, y, z + v]);
        });
      towerClosedLoft(q, 'towerPilaster', rings, brown);
      towerStock(
        q,
        'towerBracket',
        [
          [-0.24, 60.85],
          [0.18, 60.85],
          [0.22, 61.08],
          [0.39, 61.4],
          [0.42, 61.55],
          [-0.29, 61.55],
          [-0.29, 61.4],
          [-0.24, 61.1],
        ].map(([u, y]) => [sign * (2.6 + u), y]),
        2.86,
        3.14,
        brown,
      );
      for (const y of [48.65, 53.45]) {
        const n = towerControls.scrollSegments,
          curve = (delta) =>
            Array.from({ length: n + 1 }, (_, i) => {
              const a = -0.35 + (i * tau * 1.1) / n,
                r = 0.3 - (0.245 * i) / n + delta;
              return [sign * (2.8 + r * Math.cos(a)), y + r * Math.sin(a)];
            });
        towerStock(
          q,
          'towerScroll',
          [...curve(0.0325), ...curve(-0.0325).reverse()],
          3.6,
          3.8,
          brown,
        );
      }
    }
  }
}

function tower(o, d) {
  B(o, 'brown', 0, 23.0, 0, 6.2, 25.0, 6.2, brown);
  B(o, 'brown', 0, 47.8, 0, 6.75, 6.55, 6.75, brown);
  for (let i = 0; i < 4; i++) {
    const q = facing(o, (i * tau) / 4);
    if (d > 0) {
      for (const x of [-2.55, 2.55]) B(q, 'trim', x, 23.5, 3.17, 0.22, 24.2, 0.18, brown);
      for (const y of [24.0, 46.9, 48.0, 54.0]) B(q, 'trim', 0, y, 3.28, 6.6, 0.28, 0.3, brown);
      for (let j = 0; j < 10; j++) {
        const y = 44.7 - j * 1.8;
        if (d > 1) text(q, d, 'LACKAWANNA'[j], 0.45, y, 3.3, 1.2192, 1.0, light);
        if (d === 3)
          for (const x of [-1.9, 1.9]) {
            panel(q, 'brown', x, y - 0.05, 3.12, 1.05, 1.35, rgb('6d584f'));
            for (const sign of [-1, 1])
              B(q, 'trim', x + sign * 0.57, y - 0.1, 3.18, 0.09, 1.5, 0.15, brown);
            B(q, 'trim', x, y - 0.1, 3.18, 1.2, 0.09, 0.15, brown);
            B(q, 'trim', x, y + 1.35, 3.18, 1.2, 0.09, 0.15, brown);
          }
      }
    }
    clock(q, d);
    if (d !== 3)
      plate(
        q,
        'brown',
        [
          [-3.8, 54.2],
          [3.8, 54.2],
          [0, 56.25],
        ],
        3.7,
        0.8,
        brown,
      );
    if (d > 1) {
      for (const sign of [-1, 1]) {
        if (d !== 3) beam(q, 'trim', [sign * 3.8, 54.25, 3.75], [0, 56.3, 3.75], 0.2, 0.2, brown);
        round(q, 'brown', sign * 2.8, 3.6, 48.6, 4.9, 0.2, brown, 8);
      }
    }
  }
  // Open bell lantern supported by four posts, with no solid wall across the openings.
  if (d !== 3) B(o, 'brown', 0, 55.95, 0, 7.35, 0.55, 7.35, brown);
  for (const x of [-2.6, 2.6])
    for (const z of [-2.6, 2.6]) B(o, 'brown', x, 56.5, z, 0.62, 5.2, 0.62, brown);
  if (d !== 3) B(o, 'brown', 0, 61.55, 0, 7.15, 0.45, 7.15, brown);
  if (d > 0) {
    round(o, 'metal', 0, 0, 57.4, 1.6, 0.68, dark, 8);
    for (let i = 0; i < 4; i++)
      beam(
        o,
        'brown',
        [0, 61.6, 0],
        [i % 2 ? 2.5 : -2.5, 61.6, i < 2 ? 2.5 : -2.5],
        0.2,
        0.22,
        brown,
      );
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * tau) / 4,
      q = facing(o, a);
    roofFace(
      q,
      'brown',
      [
        [-3.8, 62, 3.8],
        [3.8, 62, 3.8],
        [0, 67.2, 0],
      ],
      brown,
    );
  }
  round(o, 'metal', 0, 0, 67.2, 1.38, 0.06, brown, 6);
  if (d === 3)
    for (let y = 62.3; y < 66.9; y += 0.45) {
      const r = (3.8 * (67.2 - y)) / 5.2;
      for (let i = 0; i < 4; i++) {
        const q = facing(o, (i * tau) / 4);
        beam(q, 'trim', [-r, y, r + 0.018], [r, y, r + 0.018], 0.04, 0.045, brown);
      }
    }
  if (d === 3) constructedTowerCraft(o);
}
function rail(o, d) {
  const front = facing(o, 0, 0, 28.7),
    holes = [
      ...[-8, 0, 8].map((x) => ({ x, y: 6, w: 5.0, h: 8.2 })),
      { x: 0, y: 0.2, w: 3.5, h: 3.5 },
    ];
  wall(front, d, 29.4, -0.8, 18.4, holes);
  for (const sign of [-1, 1]) B(front, 'stone', sign * 8, -0.8, 0.01, 12.0, 5.8, 0.12, stone);
  for (const x of [-14.2, -4.3, 4.3, 14.2]) {
    B(front, 'trim', x, 5.0, 0.25, 1.05, 10.1, 0.65, copper);
    if (d === 3)
      for (const xx of [-0.32, 0.32]) B(front, 'trim', x + xx, 5.4, 0.6, 0.07, 9.3, 0.07, light);
  }
  for (const y of [4.75, 14.4, 15.9, 17.5, 18.3])
    B(front, 'trim', 0, y, 0.27, 30.1, 0.25, 0.6, copper);
  B(front, 'brown', 0, 4.45, 3.0, 30.8, 0.23, 6.4, brown);
  for (const x of [-13, 13]) beam(front, 'brown', [x, 3.4, 0.3], [x, 4.42, 6], 0.16, 0.2, brown);
  B(front, 'brown', 0, 4.65, 3.07, 16.7, 1.15, 0.22, brown);
  text(front, d, 'WAITING ROOM', 0, 4.75, 3.23, 0.9, 1.3);
  text(front, d, 'LACKAWANNA R R', 0, 16.45, 0.61, 1.05, 1.95);
  const arch = Array.from({ length: d === 3 ? 20 : 8 }, (_, i) => {
    const a = Math.PI - (i * Math.PI) / ((d === 3 ? 20 : 8) - 1);
    return [6.0 * Math.cos(a), 18.0 + 2.8 * Math.sin(a)];
  });
  plate(front, 'copper', [[-6, 18], [6, 18], ...arch.slice(1, -1).reverse()], 0.4, 0.6, copper);
  if (d > 0)
    for (let i = 1; i < arch.length; i++)
      beam(front, 'trim', [...arch[i - 1], 0.65], [...arch[i], 0.65], 0.18, 0.2, light);
  text(front, d, '1907', 0.5, 18.5, 0.74, 1.0, 1.35, light);
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign * 14.7, 0);
    wall(
      q,
      d,
      32,
      -0.8,
      18.5,
      [-9, 0, 9].map((x) => ({ x, y: 7.0, w: 6.0, h: 7.5 })),
    );
    B(q, 'trim', 0, 15.1, 0.15, 32.3, 0.3, 0.5, copper);
    if (sign === 1) {
      disc(q, 'dial', 0, 16.75, 0.25, 0.9, white, d < 2 ? 12 : 32);
      if (d > 1) {
        beam(q, 'metal', [0, 16.75, 0.3], [-0.5, 16.95, 0.3], 0.06, 0.06, dark);
        beam(q, 'metal', [0, 16.75, 0.3], [0.2, 17.35, 0.3], 0.045, 0.045, dark);
      }
    }
  }
  const south = facing(o, Math.PI, 0, -16);
  wall(south, d, 29.4, -0.8, 18.4, []);
  gable(o, 0, 0, 30.2, 33, 18.5, 23.5, copper, d);
  if (d > 0) {
    B(o, 'glass', 0, 23.4, -10.7, 3.8, 0.2, 6.0, glass);
    B(o, 'glass', 0, 23.4, 10.7, 3.8, 0.2, 6.0, glass);
  }
  // The mapped29x32m room is the inner hall roof; offices/vestibule extend to the street wall.
  for (const sign of [-1, 1])
    wall(
      facing(o, (sign * Math.PI) / 2, sign * 14.7, 22.35),
      d,
      12.7,
      -0.8,
      18.4,
      [-3, 3].map((x) => ({ x, y: 7, w: 2.6, h: 7.0 })),
    );
  B(o, 'roof', 0, 18.05, 22.35, 29.4, 0.35, 12.7, roof);
  poly(
    o,
    'copper',
    [
      [-20, -16],
      [-30, -16],
      [-46, -36],
      [-33, -50],
      [-20, -50],
    ],
    -0.8,
    10.9,
    copper,
  );
  // Low southern rail rooms and open west train concourse, ending before platforms.

  B(o, 'roof', 1.5, 10.0, -35, 43.7, 0.4, 38.7, roof);
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign === 1 ? 23 : -20, -35);
    wall(
      q,
      d,
      38,
      -0.8,
      10.0,
      [-13, -5, 3, 11].map((x) => ({ x, y: 3, w: 4, h: 5.4 })),
    );
  }
  for (const sign of [-1, 1])
    wall(facing(o, sign === 1 ? 0 : Math.PI, 1.5, -35 + sign * 19), d, 43, -0.8, 10, []);
  B(o, 'brown', 24.0, 5.7, -10.5, 13.4, 0.32, 89.0, brown);
  for (let z = -52; z < 32; z += d === 0 ? 21 : 10.5)
    for (const x of [18.4, 29.6]) B(o, 'metal', x, -0.5, z, 0.25, 6.2, 0.25, dark);
}
function arcBay(o, d, w, rx = 10.7, ry = 4.8) {
  const n = d === 3 ? 24 : d === 2 ? 12 : d === 1 ? 8 : 4,
    top = 16.8,
    spring = 9.2,
    depth = 1.6;
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i * Math.PI) / n,
      b = Math.PI - ((i + 1) * Math.PI) / n,
      x0 = rx * Math.cos(a),
      x1 = rx * Math.cos(b),
      y0 = spring + ry * Math.sin(a),
      y1 = spring + ry * Math.sin(b);
    quad(
      o,
      'brown',
      [
        [x0, y0, 0],
        [x1, y1, 0],
        [x1, top, 0],
        [x0, top, 0],
      ],
      [0, 0, 1],
      brown,
    );
    quad(
      o,
      'brown',
      [
        [x0, y0, 0],
        [x0, y0, -depth],
        [x1, y1, -depth],
        [x1, y1, 0],
      ],
      normalFor([x0, y0, 0], [x0, y0, -depth], [x1, y1, -depth]),
      brown,
    );
    if (d > 0) {
      quad(
        o,
        'trim',
        [
          [x0, y0, 0.08],
          [x1, y1, 0.08],
          [(rx + 0.35) * Math.cos(b), spring + (ry + 0.35) * Math.sin(b), 0.08],
          [(rx + 0.35) * Math.cos(a), spring + (ry + 0.35) * Math.sin(a), 0.08],
        ],
        [0, 0, 1],
        copper,
      );
      if (d > 1) {
        const t = (a + b) / 2,
          x = (rx + 0.78) * Math.cos(t),
          y = spring + (ry + 0.78) * Math.sin(t);
        if (d === 2) {
          quad(
            o,
            'trim',
            [
              [x - 0.32, y, 0.17],
              [x, y - 0.44, 0.17],
              [x + 0.32, y, 0.17],
              [x, y + 0.44, 0.17],
            ],
            [0, 0, 1],
            light,
          );
        } else
          plate(
            o,
            'trim',
            [
              [x - 0.32, y],
              [x, y + 0.44],
              [x + 0.32, y],
              [x, y - 0.44],
            ],
            0.17,
            0.09,
            light,
          );
      }
    }
  }
  for (const sign of [-1, 1])
    B(o, 'brown', sign * (rx + (w / 2 - rx) / 2), 0.8, -0.6, w / 2 - rx, 16.0, 2.0, brown);
}
function smallCupola(o, d, x, y, z, h = 4.9) {
  const q = facing(o, 0, x, z);
  B(q, 'brown', 0, y, 0, 4.4, 0.4, 4.4, brown);
  for (const xx of [-1.5, 1.5])
    for (const zz of [-1.5, 1.5]) B(q, 'brown', xx, y + 0.4, zz, 0.42, h * 0.52, 0.42, brown);
  B(q, 'copper', 0, y + h * 0.58, 0, 3.9, 0.35, 3.9, copper);
  loft(
    q,
    'copper',
    [
      radialRing(y + h * 0.61, 1.95, 1.95, d < 2 ? 6 : 12),
      radialRing(y + h * 0.92, 0.95, 0.95, d < 2 ? 6 : 12),
      radialRing(y + h, 1.2, 1.2, d < 2 ? 6 : 12),
    ],
    copper,
  );
  round(q, 'metal', 0, 0, y + h, 7.1, 0.035, dark, 6);
}
function ferry(o, d, frame) {
  const q = facing(o, facade.angle, ...facade.center),
    c = Math.cos(facade.angle),
    s = Math.sin(facade.angle),
    inverse = (p) => {
      const x = p[0] - facade.center[0],
        z = p[1] - facade.center[1];
      return [c * x - s * z, s * x + c * z];
    },
    ring = frame.authoredComponents.ferryRootEnvelope.map(inverse),
    bay = facade.length / 6;
  // One thin roof spans the open slips; it must never become a solid down-to-ground block.
  poly(q, 'roof', ring, 17.0, 17.5, roof);
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * bay,
      z = 3.7 * (1 - (x / (facade.length / 2)) ** 2),
      a = Math.atan((2 * 3.7 * x) / (facade.length / 2) ** 2),
      v = facing(q, a, x, z);
    arcBay(v, d, bay);
    for (const y of [16.1, 16.8, 17.6])
      B(v, 'trim', 0, y, 0.08, bay + 0.15, 0.3, 0.5, y === 16.8 ? copper : brown);
    if (d > 1)
      for (let xx = -bay / 2 + 0.6; xx < bay / 2; xx += d === 3 ? 0.65 : 2.2) {
        B(v, 'trim', xx, 16.75, 0.3, 0.17, 0.34, 0.35, light);
        if (d === 3) B(v, 'trim', xx, 15.65, 0.15, 0.09, 0.2, 0.09, copper);
      }
    for (const xx of i === 0 ? [-bay / 2, bay / 2] : [bay / 2]) {
      B(v, 'concrete', xx, -1.0, -18, 2.7, 1.8, 37, concrete);
      if (d === 3) {
        panel(v, 'glass', xx, 6.0, 0.43, 1.1, 3.0, glass);
        for (const sign of [-1, 1])
          B(v, 'trim', xx + sign * 0.68, 5.8, 0.51, 0.16, 3.5, 0.2, light);
        plate(
          v,
          'trim',
          [
            [xx - 0.9, 9.4],
            [xx + 0.9, 9.4],
            [xx, 10.1],
          ],
          0.57,
          0.12,
          copper,
        );
        disc(v, 'trim', xx, 14.8, 0.5, 0.67, light, 20);
        disc(v, 'brown', xx, 14.8, 0.53, 0.49, brown, 20);
      }
      for (const zz of [-33, -18, -2]) {
        round(v, 'timber', xx, zz, -6, 5.2, 0.28, timber, d < 2 ? 4 : 8);
        B(v, 'metal', xx, 0.8, zz, 0.4, 15.9, 0.4, dark);
      }
      if (d > 1)
        for (const zz of [-29, -15])
          beam(v, 'metal', [xx, 1, zz], [xx, 8, zz + 10], 0.18, 0.2, dark);
    }
    if (d > 0) {
      B(v, 'concrete', 0, 6.8, -32, bay - 2.7, 0.3, 6.0, concrete);
      for (const zz of [-29, -35]) {
        B(v, 'metal', 0, 7.9, zz, bay - 3, 0.08, 0.08, dark);
        if (d > 1)
          for (let xx = -bay / 2 + 2; xx < bay / 2 - 1; xx += 1.8)
            B(v, 'metal', xx, 7.1, zz, 0.055, 0.85, 0.055, dark);
      }
    }
  }
  // Rear ferry-concourse walls follow the angled plaza side independently of the slip front.
  const rear = (x) => -69.0 + 0.123 * (x + 34);
  for (let i = 0; i < 5; i++) {
    const x = -24 + i * 20,
      z = rear(x),
      a = Math.atan(-0.123),
      back = facing(q, Math.PI + a, x, z);
    wall(
      back,
      d,
      20,
      0.8,
      16.8,
      [
        { x: 0, y: 6.9, w: 14.8, h: 6.8, arch: true },
        { x: 0, y: 0.8, w: 17.1, h: 4.65, open: true },
      ],
      0,
      'copper',
      copper,
    );
    B(back, 'brown', 0, 5.45, 3.2, 20.2, 0.3, 6.5, brown);
    for (const sign of [-1, 1]) {
      B(back, 'copper', sign * 9.5, 5.7, 0.4, 1.0, 11.0, 0.8, copper);
      beam(back, 'trim', [sign * 9.5, 14, 0.7], [0, 19.7, 0.7], 0.35, 0.35, copper);
    }
    plate(
      back,
      'copper',
      [
        [-10, 14],
        [10, 14],
        [0, 19.7],
      ],
      0.28,
      0.45,
      copper,
    );
    if (d > 0) {
      disc(back, 'trim', 0, 16.0, 0.6, 0.8, light, d === 1 ? 8 : 20);
      for (const sign of [-1, 1]) B(back, 'metal', sign * 8, 0.8, 2.4, 0.27, 4.6, 0.27, dark);
    }
    if (d > 1) {
      for (let j = d === 2 ? -2 : -3; j <= (d === 2 ? 2 : 3); j++) {
        const xx = j * 1.7,
          yy = 14.5 + 3.2 * (1 - Math.abs(xx) / 7);
        sphere(
          back,
          'trim',
          [xx, yy, 0.64],
          [0.7, 0.24, 0.15],
          light,
          d === 2 ? 4 : 10,
          d === 2 ? 3 : 4,
        );
      }
      sphere(
        back,
        'trim',
        [0, 19.85, 0.5],
        [0.7, 0.5, 0.3],
        light,
        d === 2 ? 6 : 8,
        d === 2 ? 3 : 4,
      );
    }
    gable(back, 0, -3.3, 20.0, 6.5, 14.0, 19.7, copper, 0);
  }
  // Own lower/upper concourse decks stop behind open water slips.
  poly(
    q,
    'concrete',
    [
      [-34, -71],
      [67, -58.6],
      [67, -36],
      [-34, -36],
    ],
    0.3,
    0.8,
    concrete,
  );
  poly(
    q,
    'concrete',
    [
      [-34, -71],
      [67, -58.6],
      [67, -36],
      [-34, -36],
    ],
    6.65,
    7.0,
    concrete,
  );
  const rearInner = facing(q, 0, 16.5, -36);
  wall(
    rearInner,
    d,
    101,
    0.8,
    17,
    [
      ...[-40, -20, 0, 20, 40].map((x) => ({ x, y: 8.0, w: 9.0, h: 6.0 })),
      ...[-40, -20, 0, 20, 40].map((x) => ({ x, y: 1, w: 6, h: 4.5 })),
    ],
    0,
    'stone',
    stone,
  );
  // Plain north end retains its small windows instead of repeating ornate river arches.
  const north = facing(q, Math.PI / 2, 69.9, -30);
  wall(
    north,
    d,
    60,
    0.1,
    17.1,
    [-22, -15, -8, -1, 6, 13, 20].flatMap((x) => [
      { x, y: 1.8, w: 2.5, h: 3.4 },
      { x, y: 8.8, w: 2.6, h: 2.4 },
    ]),
    0,
    'concrete',
    concrete,
  );
  // Eight small raised roof monitors along the main concourse.
  if (d > 0)
    for (let i = 0; i < 8; i++) {
      const x = -28 + i * 12.7,
        z = rear(x) + 17;
      B(q, 'copper', x, 17.5, z, 5.5, 0.45, 4.4, copper);
      gable(q, x, z, 5.9, 4.8, 17.95, 18.9, glass, 0);
    }
  // River parapet rail and belvederes are part of the terminal, independent of tower.
  if (d > 0) {
    B(q, 'brown', 0, 18.0, 1.1, facade.length, 0.25, 0.9, brown);
    for (const y of [18.65, 20.0]) B(q, 'metal', 0, y, 1.15, facade.length, 0.08, 0.08, dark);
    if (d > 1)
      for (let x = -71; x < 72; x += 2.0) {
        B(q, 'metal', x, 18.7, 1.15, 0.055, 1.3, 0.055, dark);
        if (d === 3)
          for (let k = 0; k < 12; k++) {
            const a = (k * tau) / 12,
              b = ((k + 1) * tau) / 12;
            quad(
              q,
              'metal',
              [
                [x + 0.9 + 0.5 * Math.cos(a), 19.35 + 0.5 * Math.sin(a), 1.2],
                [x + 0.9 + 0.5 * Math.cos(b), 19.35 + 0.5 * Math.sin(b), 1.2],
                [x + 0.9 + 0.45 * Math.cos(b), 19.35 + 0.45 * Math.sin(b), 1.2],
                [x + 0.9 + 0.45 * Math.cos(a), 19.35 + 0.45 * Math.sin(a), 1.2],
              ],
              [0, 0, 1],
              dark,
            );
          }
      }
  }
  smallCupola(q, d, -11, 18.0, 0.2, 5.8);
  smallCupola(q, d, 33, 18.0, 0.2, 5.8);
  if (d > 0) {
    B(q, 'brown', 11, 19.6, 0.35, 39, 0.6, 0.65, brown);
    text(q, d, 'LACKAWANNA', 11, 20.3, 0.6, 1.8288, 2.7, white);
  }
  // Southern former restaurant is distinct from the open-slip arcade.
  const dining = facing(q, 0, -87, -17);

  for (const sign of [-1, 1]) {
    const v = facing(dining, (sign * Math.PI) / 2, sign * 14, 0);
    wall(
      v,
      d,
      18,
      0.8,
      15.7,
      [-6, -3, 0, 3, 6].map((x) => ({ x, y: 7.4, w: 1.7, h: 5.6 })),
    );
  }
  wall(
    facing(dining, 0, 0, 9),
    d,
    28,
    0.8,
    15.7,
    [-10, -5, 0, 5, 10].map((x) => ({ x, y: 7.2, w: 2.4, h: 5.7 })),
  );
  wall(
    facing(dining, Math.PI, 0, -9),
    d,
    28,
    0.8,
    15.7,
    [-11, -7.3, -3.6, 0, 3.6, 7.3, 11].map((x) => ({ x, y: 7.2, w: 2.0, h: 5.7 })),
  );
  roofFace(
    dining,
    'copper',
    [
      [-14.4, 15.9, -9.4],
      [14.4, 15.9, -9.4],
      [11, 18.0, 0],
      [-11, 18.0, 0],
    ],
    copper,
  );
  roofFace(
    dining,
    'copper',
    [
      [14.4, 15.9, 9.4],
      [-14.4, 15.9, 9.4],
      [-11, 18.0, 0],
      [11, 18.0, 0],
    ],
    copper,
  );
  for (const sign of [-1, 1])
    roofFace(
      dining,
      'copper',
      [
        [sign * 14.4, 15.9, -9.4],
        [sign * 14.4, 15.9, 9.4],
        [sign * 11, 18, 0],
      ],
      copper,
    );
  // Fixed representative poses of five modern ferry gangways; boats are excluded.
  for (let i = 0; i < 5; i++) {
    const x = (i - 2.5) * bay,
      z = 3.7 * (1 - (x / (facade.length / 2)) ** 2),
      bridge = facing(q, 0, x, z);
    B(bridge, 'metal', 0, 1.2, 11, 4.5, 0.25, 22, dark);
    for (const sign of [-1, 1]) {
      for (const y of [1.55, 2.65]) B(bridge, 'metal', sign * 2.18, y, 11, 0.06, 0.06, 22, white);
      if (d > 1)
        for (let zz = 1; zz < 23; zz += d === 2 ? 11 : 4.4) {
          B(bridge, 'metal', sign * 2.18, 1.5, zz, 0.07, 2.8, 0.07, white);
          if (d === 3)
            beam(
              bridge,
              'metal',
              [sign * 2.18, 1.5, zz],
              [sign * 2.18, 2.6, zz + 3.7],
              0.07,
              0.08,
              white,
            );
        }
    }
    const n = d === 3 ? 12 : d === 2 ? 6 : 4;
    for (let j = 0; j < n; j++) {
      const a = Math.PI - (j * Math.PI) / n,
        b = Math.PI - ((j + 1) * Math.PI) / n;
      roofFace(
        bridge,
        'canopy',
        [
          [2.3 * Math.cos(a), 4.3 + 1.3 * Math.sin(a), 0],
          [2.3 * Math.cos(a), 4.3 + 1.3 * Math.sin(a), 22],
          [2.3 * Math.cos(b), 4.3 + 1.3 * Math.sin(b), 22],
          [2.3 * Math.cos(b), 4.3 + 1.3 * Math.sin(b), 0],
        ],
        white,
      );
    }
    if (d > 1)
      for (const zz of d === 2 ? [0, 22] : [0, 7.3, 14.6, 22])
        for (let j = 0; j < n; j++) {
          const a = Math.PI - (j * Math.PI) / n,
            b = Math.PI - ((j + 1) * Math.PI) / n;
          if (d === 3)
            beam(
              bridge,
              'metal',
              [2.34 * Math.cos(a), 4.3 + 1.33 * Math.sin(a), zz],
              [2.34 * Math.cos(b), 4.3 + 1.33 * Math.sin(b), zz],
              0.055,
              0.07,
              white,
            );
        }
  }
}
export function hobokenTerminal(o, frame, d = 3) {
  rail(o, d);
  ferry(o, d, frame);
  tower(o, d);
}
export function hobokenTerminalDistrict(o) {
  rail(o, 1);
  coarseFerry(o, 1);
  tower(o, 1);
}
export function hobokenTerminalStreet(o) {
  hobokenTerminal(o, modelFrame, 2);
}
// Stable original local controls; build does not read articles/images or live maps.
const modelFrame = {
  authoredComponents: {
    ferryRootEnvelope: [
      [-11.76487, 29.07277],
      [-62.67058, 114.14104],
      [-94.79774, 105.54376],
      [-121.7212, 96.72023],
      [-105.88387, 51.47116],
      [-86.87907, 9.16304],
      [-63.12308, -35.63406],
      [-55.65691, -31.10909],
      [-42.3083, -56.44897],
      [-33.25839, -50.79274],
      [-33.71089, -45.13651],
      [-22.17226, -44.91026],
      [-22.17226, -54.41273],
    ],
  },
};
function coarseFerry(o, d) {
  const q = facing(o, facade.angle, ...facade.center),
    c = Math.cos(facade.angle),
    s = Math.sin(facade.angle),
    r = modelFrame.authoredComponents.ferryRootEnvelope.map((p) => {
      const x = p[0] - facade.center[0],
        z = p[1] - facade.center[1];
      return [c * x - s * z, s * x + c * z];
    });
  poly(q, 'roof', r, 17.0, 17.5, roof);
  const bay = facade.length / 6;
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * bay,
      z = 3.7 * (1 - (x / (facade.length / 2)) ** 2),
      v = facing(q, Math.atan((2 * 3.7 * x) / (facade.length / 2) ** 2), x, z);
    arcBay(v, 0, bay);
    if (d) B(v, 'trim', 0, 17.25, 0, bay, 0.55, 0.7, copper);
  }
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * bay,
      z = 3.7 * (1 - (x / (facade.length / 2)) ** 2);
    if (d) {
      B(q, 'concrete', x, -1, z - 18, 2.7, 1.8, 37, concrete);
      B(q, 'metal', x, 0.8, z - 18, 0.45, 16.2, 0.45, dark);
    } else {
      quad(
        q,
        'brown',
        [
          [x - 1.35, -2, z],
          [x + 1.35, -2, z],
          [x + 1.35, 16.8, z],
          [x - 1.35, 16.8, z],
        ],
        [0, 0, 1],
        brown,
      );
    }
  }
  const back = facing(q, Math.PI - 0.1224, 16.5, -62.8);
  B(back, 'brown', 0, 5.45, 3.2, 101, 0.3, 6.5, brown);
  if (d)
    wall(
      back,
      1,
      101,
      6.0,
      17.0,
      [-40, -20, 0, 20, 40].map((x) => ({ x, y: 7.0, w: 14, h: 6.5, arch: true })),
    );
  else panel(back, 'copper', 0, 6.0, 0, 101, 11, copper);
  for (let i = 0; i < 5; i++) {
    const x = -24 + i * 20,
      z = -69 + 0.123 * (x + 34),
      v = facing(q, Math.PI - 0.1224, x, z);
    plate(
      v,
      'copper',
      [
        [-10, 14],
        [10, 14],
        [0, 19.7],
      ],
      0.3,
      0.35,
      copper,
    );
    if (d) {
      for (const sign of [-1, 1]) B(v, 'metal', sign * 8, 0.8, 1.0, 0.4, 5.1, 0.4, dark);
      gable(v, 0, -3, 20, 6, 14, 19.7, copper, 0);
    }
  }
  B(q, 'concrete', 16.5, 0.3, -52, 101, 0.5, 28, concrete);
  wall(facing(q, Math.PI / 2, 69.9, -30), 0, 60, 0.1, 17, [], 0, 'concrete', concrete);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2.5) * bay,
      z = 3.7 * (1 - (x / (facade.length / 2)) ** 2),
      v = facing(q, 0, x, z);
    B(v, 'metal', 0, 1.2, 11, 4.5, 0.25, 22, dark);
    for (let j = 0; j < 4; j++) {
      const a = Math.PI - (j * Math.PI) / 4,
        b = Math.PI - ((j + 1) * Math.PI) / 4;
      roofFace(
        v,
        'canopy',
        [
          [2.3 * Math.cos(a), 4.3 + 1.3 * Math.sin(a), 0],
          [2.3 * Math.cos(a), 4.3 + 1.3 * Math.sin(a), 22],
          [2.3 * Math.cos(b), 4.3 + 1.3 * Math.sin(b), 22],
          [2.3 * Math.cos(b), 4.3 + 1.3 * Math.sin(b), 0],
        ],
        white,
      );
    }
  }
  for (const x of [-11, 33]) {
    B(q, 'copper', x, 18, 0, 3.9, 4.7, 3.9, copper);
    if (d) round(q, 'metal', x, 0, 22.7, 7.1, 0.035, dark, 4);
  }
  if (d) {
    for (let i = 0; i < 8; i++) {
      const x = -28 + i * 12.7,
        z = -69 + 0.123 * (x + 34) + 17;
      B(q, 'copper', x, 17.5, z, 5.5, 0.4, 4.4, copper);
    }
    B(q, 'brown', 11, 20, 0.3, 39, 0.6, 0.6, brown);
  }
  B(facing(q, 0, -87, -17), 'copper', 0, -0.8, 0, 28, 16.5, 18, copper);
}
export function hobokenTerminalSkyline(o) {
  coarseFerry(o, 0);
  const front = facing(o, 0, 0, 28.7);
  wall(front, 0, 29.4, -0.8, 18.4, [
    { x: 0, y: 0.2, w: 3.5, h: 3.5 },
    ...[-8, 0, 8].map((x) => ({ x, y: 6, w: 5, h: 8.2 })),
  ]);
  B(o, 'copper', -14.5, -0.8, 6, 0.4, 19.2, 45.4, copper);
  B(o, 'copper', 14.5, -0.8, 6, 0.4, 19.2, 45.4, copper);
  B(o, 'copper', 0, -0.8, -16, 29.4, 19.2, 0.4, copper);
  gable(o, 0, 0, 30.2, 33, 18.5, 23.5, copper, 0);
  B(o, 'roof', 0, 18.05, 22.35, 29.4, 0.35, 12.7, roof);
  B(o, 'copper', 1.5, -0.8, -35, 43, 10.8, 38, copper);
  B(o, 'brown', 24, 5.7, -10.5, 13.4, 0.32, 89, brown);
  B(o, 'brown', 0, 23, 0, 6.2, 31, 6.2, brown);
  for (let i = 0; i < 4; i++) {
    const q = facing(o, (i * tau) / 4);
    disc(q, 'dial', 0, 51.2, 3.44, 1.8288, white, 8);
    roofFace(
      q,
      'brown',
      [
        [-3.8, 62, 3.8],
        [3.8, 62, 3.8],
        [0, 67.2, 0],
      ],
      brown,
    );
  }
  B(o, 'brown', 0, 55.95, 0, 7.35, 0.55, 7.35, brown);
  for (const x of [-2.6, 2.6])
    for (const z of [-2.6, 2.6]) B(o, 'brown', x, 56.5, z, 0.62, 5.2, 0.62, brown);
  round(o, 'metal', 0, 0, 67.2, 1.38, 0.06, brown, 4);
}
const surfaces = {
  towerClockCase: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  towerClockInk: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.25 },
  towerDial: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78, metallic: 0 },
  towerCornice: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  towerHood: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  towerPilaster: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  towerBracket: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  towerScroll: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  copper: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.25 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.25 },
  brown: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.22 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.25 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.95, metallic: 0 },
  timber: { slot: 'foundation', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
  canopy: { slot: 'roof', graph: 'fabric_canvas', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.08 },
  dial: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78, metallic: 0 },
};
export const hobokenTerminalModel = {
  id: 'hoboken_terminal',
  key: 'hoboken_terminal',
  recipe: 'structure-hoboken-terminal.mjs',
  cell: 'dr/dr5',
  title: 'Hoboken Terminal',
  brief:
    'Joined surviving copper ferry/rail terminal, six real deep open elliptical ferry-slip arches with structural piers/columns, rear concourse, five gabled plaza pavilions/canopy, three-window limestone/copper waiting-room facade and high skylit roof, low south rooms/former restaurant, reconstructed brown four-face clock tower with open bell lantern, green roof belvederes, raised Lackawanna signs, eight roof monitors and five white curved gangways. Western platform/train sheds, neighboring buildings, boats and interiors excluded.',
  camera: [-235, 105, 185],
  lookAt: [-40, 24, 27],
  qaCameras: [
    { name: 'clock-case', position: [0, 52, 14], lookAt: [0, 51.2, 3.5] },
    { name: 'belfry-craft', position: [-10, 61, 13], lookAt: [0, 58.8, 0] },
    { name: 'front', position: [-280, 40, 90], lookAt: [-72, 22, 30] },
    { name: 'front-detail', position: [-28, 54, 40], lookAt: [0, 51.2, 0] },
    { name: 'back', position: [85, 70, 165], lookAt: [-35, 22, 30] },
    { name: 'base-detail', position: [0, 15, 75], lookAt: [0, 9, 28.7] },
    { name: 'ferry-detail', position: [-150, 20, 42], lookAt: [-93, 12, 32] },
    { name: 'plaza-detail', position: [5, 21, 115], lookAt: [-38, 11, 70] },
    { name: 'roof-detail', position: [-95, 220, 90], lookAt: [-55, 20, 28] },
  ],
  mediumFiContext: { scale: 1.6, cameraYaw: -2.512 },
  build: hobokenTerminal,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent USGS1m NJ_NE6County_B23 raster48017, NAVD88 datum1.3136m at dry plaza[0,36] outside resolved vestibule/canopy. Unchanged own envelope-1.954..+.467m at review-grid vertices; marine returns near-1.95m remain below decks, with authored pile supports extending to-6m. North entry/approach+.004..+.099m below threshold.2m. Bounded land/water contact preview; hydroflattened water is not measured tide/seabed and pile embedment/host compatibility remain uncertain. Footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hoboken-terminal.mjs',
    level: 'skyline',
    export: 'hobokenTerminalSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'hobokenTerminalDistrict', errorMeters: 1.0, surfaces },
      street: { export: 'hobokenTerminalStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'New reconstructed-tower clock cases/radial Roman numerals/marks/hands,stepped hoods/cornices,eight pilaster mouldings/eight brackets/sixteen original simplified scrolls use exact local PedroXing2012self-CC0native and two exact named self-CC0tower originals. Full fixed joined terminal/ferry/rail scope retained; broader cleared facade/roof/gangway coverage still pending. Earlier attribution/private imagery controls are historical and excluded. Fine craft,lantern/roof proportions,current condition and hidden surfaces remain medium-fi estimates.',
    'Selected2010/2015 surviving exterior and focused2011/2012 originals, primary site/floor plans, mapped parts and aerial. Own joined terminal differentiated from western platform sheds/baggage/Pullman buildings. Exact ornamental profiles, window layouts/roof heights and buried/marine pile depths remain estimates, not survey/scans.',
    'Replica clock tower225ft/68.58m follows reconstruction designer STV, consistent with historic nomination; operator203/230ft historical statements conflict. Four12ft dials follow operator reconstruction description. Tower is above main waiting room per primary description; plain north end, five plaza pavilions and six open slips remain distinct.',
    'Gangways fixed representative poses without boats, detached pontoons/dock equipment or tide animation. Interiors, western train-shed/platform roofs, neighboring baggage/YMCA/Pullman buildings, plaza/streets, flags/temporary signs/construction excluded. No reference pixels redistributed.',
    'Independent USGS1m bare-earth terrain retained unchanged; hydroflattened water is not seabed/tide survey. Marine pile embedment and other host terrain compatibility unverified. Footprint replacement disabled.',
  ],
};
