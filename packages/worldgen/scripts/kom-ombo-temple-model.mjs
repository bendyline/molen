/** Kom Ombo: paired axes, floral hypostyle, broken courts and mapped ancillary remains. */
import earcut from 'earcut';

function box(f, role, x, y, z, w, h, d) {
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [x + (u * w) / 2, y, z + (v * d) / 2]),
    b = a.map(([x, y, z]) => [x, y + h, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
}
function rotate(f, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (role, p, n) =>
    f(
      role,
      p.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function prism(f, role, p, bottom, top) {
  const at = (p, y) => [p[0], typeof y === 'function' ? y(...p) : y, p[1]],
    ix = earcut(p.flat()),
    area = p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = Math.sign(area);
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((j) => p[j]);
    f(
      role,
      t.map((p) => at(p, top)),
      [0, 1, 0],
    );
    f(
      role,
      t.map((p) => at(p, bottom)),
      [0, -1, 0],
    );
  }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    f(
      role,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
}
function lathe(f, role, x, z, profile, n, lobed = false) {
  const rings = profile.map(([y, r], j) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (lobed && j > profile.length - 4 ? 1 + 0.08 * Math.cos(8 * a) : 1);
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        [
          (profile[k][0] - profile[k - 1][0]) * Math.cos(a),
          profile[k - 1][1] - profile[k][1],
          (profile[k][0] - profile[k - 1][0]) * Math.sin(a),
        ],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
function column(f, u, v, y, detail, height = 10.7, stump = false) {
  if (detail === 0) {
    lathe(
      f,
      'stone',
      u,
      v,
      [
        [y, 0.95],
        [y + height, stump ? 0.87 : 1.15],
      ],
      4,
    );
    return;
  }
  const h = height,
    n = [4, 6, 14, 24][detail];
  const profile = stump
    ? [
        [y, 1.1],
        [y + 0.3, 1.1],
        [y + 0.4, 0.91],
        [y + h, 0.88],
      ]
    : [
        [y, 1.12],
        [y + 0.32, 1.12],
        [y + 0.47, 0.94],
        [y + h * 0.74, 0.82],
        [y + h * 0.79, 1.0],
        [y + h * 0.86, 1.14],
        [y + h * 0.95, 1.55],
        [y + h, 1.56],
      ];
  lathe(f, 'stone', u, v, profile, n, !stump && detail >= 2);
  if (!stump) {
    box(f, 'stone', u, y + h, v, 2.6, 0.4, 2.6);
    if (detail >= 2)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          ca = Math.cos(a),
          sa = Math.sin(a),
          point = (radius, yy, w) => [u + radius * ca - w * sa, y + yy, v + radius * sa + w * ca],
          p = [
            point(1.02, h * 0.8, 0),
            point(1.32, h * 0.88, -0.36),
            point(1.68, h * 0.98, -0.46),
            point(1.76, h + 0.05, 0),
            point(1.68, h * 0.98, 0.46),
            point(1.32, h * 0.88, 0.36),
          ];
        f('stone', p, [ca, 0.15, sa]);
      }
  }
}
function wall(f, a, b, y, h, width = 1.5, detail = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    nx = ((-dz / l) * width) / 2,
    nz = ((dx / l) * width) / 2,
    p = [
      [a[0] - nx, a[1] - nz],
      [b[0] - nx, b[1] - nz],
      [b[0] + nx, b[1] + nz],
      [a[0] + nx, a[1] + nz],
    ];
  prism(f, 'masonry', p, y, (x, z) => y + h + (detail >= 2 ? 0.12 * Math.sin((x + z) * 1.37) : 0));
}
function portal(f, u, v, y, w, h, detail) {
  for (const s of [-1, 1]) box(f, 'masonry', u, y, v + s * (w / 2 + 0.55), 1.7, h, 1.1);
  box(f, 'stone', u, y + h, v, 2, 0.75, w + 2.2);
  if (detail >= 2)
    for (const s of [-1, 1])
      box(f, 'stone', u - 0.9, y + 0.2, v + s * (w / 2 + 0.05), 0.15, h - 0.2, 0.25);
}
function cornice(f, u, y, v, width, detail) {
  box(f, 'stone', u, y, v, 2.8, 0.6, width);
  if (!detail) return;
  const p = [
      [u - 1.4, y + 0.6],
      [u - 1.45, y + 0.9],
      [u - 1.7, y + 1.3],
      [u - 1.95, y + 1.55],
      [u + 1.4, y + 1.55],
      [u + 1.4, y + 0.6],
    ],
    a = p.map(([x, y]) => [x, y, v - width / 2]),
    b = p.map(([x, y]) => [x, y, v + width / 2]),
    sign = Math.sign(
      p.reduce((sum, a, i) => {
        const b = p[(i + 1) % p.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    );
  f('stone', a, [0, 0, -1]);
  f('stone', b, [0, 0, 1]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    f(
      'stone',
      [a[i], a[j], b[j], b[i]],
      [sign * (p[j][1] - p[i][1]), sign * (p[i][0] - p[j][0]), 0],
    );
  }
  if (detail >= 2) {
    const x = u - 1.405,
      cy = y + 0.3,
      center = [x, cy, v],
      n = detail === 2 ? 12 : 20;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      f(
        'stone',
        [
          center,
          [x, cy + 0.46 * Math.cos(a), v + 0.65 * Math.sin(a)],
          [x, cy + 0.46 * Math.cos(b), v + 0.65 * Math.sin(b)],
        ],
        [-1, 0, 0],
      );
    }
    for (const s of [-1, 1])
      f(
        'stone',
        [
          [x, cy + 0.05, v + s * 0.5],
          [x, cy + 0.32, v + s * 2.3],
          [x, cy - 0.16, v + s * 1.1],
        ],
        [-1, 0, 0],
      );
  }
}
function well(f, p, sample, detail) {
  const c = p.reduce((a, q) => a.map((v, i) => v + q[i] / p.length), [0, 0]),
    base = Math.max(...p.map((p) => sample(...p))) + 0.12,
    top = base + 1.25,
    inner = p.map((q) => q.map((v, i) => c[i] + (v - c[i]) * 0.63));
  prism(f, 'masonry', p, Math.min(...p.map((p) => sample(...p))) - 0.55, base);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      a = p[i],
      b = p[j],
      u = inner[i],
      v = inner[j],
      area = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0),
      sign = Math.sign(area);
    f(
      'stone',
      [
        [a[0], base, a[1]],
        [b[0], base, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
    f(
      'stone',
      [
        [u[0], base, u[1]],
        [v[0], base, v[1]],
        [v[0], top, v[1]],
        [u[0], top, u[1]],
      ],
      [-sign * (v[1] - u[1]), 0, sign * (v[0] - u[0])],
    );
    f(
      'stone',
      [
        [a[0], top, a[1]],
        [b[0], top, b[1]],
        [v[0], top, v[1]],
        [u[0], top, u[1]],
      ],
      [0, 1, 0],
    );
  }
  if (detail >= 2) prism(f, 'ground', inner, base, base + 0.015);
}

export function buildKomOmboTemple(face, detail, r, sample) {
  const f = rotate(face, r.architecturalAngleRadians),
    y = r.floorY,
    c = r.mainCenterV,
    co = Math.cos(r.architecturalAngleRadians),
    si = Math.sin(r.architecturalAngleRadians),
    local = ([x, z]) => [co * x + si * z, -si * x + co * z];
  prism(f, 'stone', r.mainFloorOutline, -12, y);
  prism(f, 'ground', r.forecourtOutline, -12, r.frontY);
  const n = detail ? [1, 8, 14, 18][detail] : 1;
  for (let i = 0; i < n; i++)
    box(
      f,
      'stone',
      3 + ((i + 0.5) * 10.5) / n,
      r.frontY,
      c,
      10.5 / n + 0.01,
      ((i + 1) * (y - r.frontY)) / n,
      16,
    );
  for (const u of [18, 28]) for (const v of [-1, 6, 13, 20, 27]) column(f, u, v, y, detail);
  for (const u of [35, 41]) for (const v of [6, 13, 20]) column(f, u, v, y, detail, 8.1);
  // Two lintel/cornice runs keep the double entrance legible and leave its openings clear.
  for (const u of [18, 28]) for (const v of [5.5, 20.5]) cornice(f, u, y + 11.1, v, 14, detail);
  for (const v of [6, 20]) box(f, 'stone', 23, y + 11.1, v, 10.2, 1.1, 2.0);
  if (detail) {
    box(f, 'stone', 21, y + 12.2, 7.5, 6.2, 0.75, 8.4);
    box(f, 'stone', 26, y + 12.2, 18, 6.1, 0.75, 7.2);
  }
  for (const [a, b] of [
    [
      [-2, -3],
      [-2, 3],
    ],
    [
      [-2, 23],
      [-2, 31],
    ],
    [
      [18, -2],
      [18, 4.7],
    ],
    [
      [18, 21.3],
      [18, 29],
    ],
  ])
    wall(f, a, b, a[0] < 0 ? r.frontY : y, 4.6, 1.5, detail);
  for (const u of [32, 43])
    for (const v of [9.5, 16.5]) portal(f, u, v, y, 2.8, u === 32 ? 6.4 : 4.7, detail);
  for (const [a, b, h] of [
    [[30, 4.7], [43, 4.7], 5.1],
    [[30, 25.0], [43, 25.0], 5.7],
    [[43, 6.7], [57, 6.7], 3.9],
    [[43, 20], [57, 20], 4.3],
    [[44, 13.3], [57, 13.3], 3.5],
    [[57, 6.7], [57, 20], 3.7],
  ])
    wall(f, a, b, y, h, 1.35, detail);
  for (const u of detail ? [0, 9] : [0])
    for (const [i, v] of [-2, 7.5, 22, 31].entries())
      column(f, u, v, r.frontY, detail, 1.8 + ((i + (u ? 1 : 0)) % 3) * 1.05, true);
  for (const b of r.controls.filter((b) => b.kind !== 'main'))
    for (const p of b.polygons) {
      if (b.kind === 'well') {
        well(face, p.outline, sample, detail);
        continue;
      }
      const heights = p.outline.map((q) => sample(...q)),
        bottom = Math.min(...heights) - 0.65,
        pts = p.outline.map(local),
        isEnclosure = b.kind === 'enclosure';
      if (isEnclosure)
        prism(
          face,
          'masonry',
          p.outline,
          bottom,
          (x, z) => sample(x, z) + (b.id === 35185199117670 ? 2.1 : 2.8),
        );
      else {
        const base = Math.max(...heights) + 0.1;
        if (detail) {
          prism(face, 'stone', p.outline, bottom, base + 0.4);
          for (let i = 0; i < pts.length; i++)
            wall(
              f,
              pts[i],
              pts[(i + 1) % pts.length],
              base + 0.4,
              1.6 + (i % 3) * 0.45,
              0.6,
              detail,
            );
        } else prism(face, 'masonry', p.outline, bottom, base + 1.8);
      }
    }
  if (detail >= 2)
    for (let i = 0; i < 12; i++) {
      const u = 5 + (i % 4) * 4,
        v = -4 + Math.floor(i / 4) * 18;
      box(f, 'stone', u, r.frontY + 0.02, v, 0.8 + (i % 2) * 0.5, 0.35 + (i % 3) * 0.2, 0.9);
    }
}
