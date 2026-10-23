/** 'N0742_FELICITY': Mapped gate, lead dome, four-column canopy and flanking arcades. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box } from './khmer-structure-geometry.mjs';

export function felicityGrade(r, x, z) {
  const profile = r.floorProfile;
  let i = 1;
  while (i < profile.length - 1 && x > profile[i][0]) i++;
  const [a, b] = [profile[i - 1], profile[i]],
    t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
  return a[1] + (b[1] - a[1]) * t + (z - r.frontControlZ) * r.crossSlope;
}

/** Clip an already triangulated face to a coordinate band; every result remains convex. */
function clip(points, axis, bound, sign) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      da = (a[axis] - bound) * sign,
      db = (b[axis] - bound) * sign;
    if (da >= -1e-9) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}

export function buildTopkapiFelicity(face, detail, r) {
  const cx = 3.8,
    grade = (x, z) => felicityGrade(r, x, z),
    P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + grade(x, z),
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, n) => face(role, points.map(P), D(n)),
    fixed = (role, points, n, base = grade(cx, 1)) =>
      f(
        role,
        points.map(([x, y, z]) => [x, y + base - grade(x, z), z]),
        n,
      ),
    adapter = {
      addQuad: (role, _ref, p, n) => f(role, p, n),
      addConvexPolygon: (role, _ref, p, n) => {
        for (let i = 1; i < p.length - 1; i++) f(role, [p[0], p[i], p[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    bands = r.floorProfile.map((p) => p[0]),
    body = r.body[0].outline,
    ids = earcut(body.flat()),
    pieces = [];
  for (let i = 0; i < ids.length; i += 3)
    for (let j = 1; j < bands.length; j++) {
      const p = clip(
        clip(
          ids.slice(i, i + 3).map((k) => body[k]),
          0,
          bands[j - 1],
          1,
        ),
        0,
        bands[j],
        -1,
      );
      if (p.length >= 3) pieces.push(p);
    }
  for (const p of pieces)
    for (let i = 1; i < p.length - 1; i++) {
      f(
        'floor',
        [p[0], p[i], p[i + 1]].map(([x, z]) => [x, 0, z]),
        [0, 1, 0],
      );
      if (detail)
        f(
          'floor',
          [p[0], p[i], p[i + 1]].map(([x, z]) => [x, -1.5, z]),
          [0, -1, 0],
        );
    }
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length],
      cuts = [0, 1];
    for (const x of bands) if ((a[0] - x) * (b[0] - x) < 0) cuts.push((x - a[0]) / (b[0] - a[0]));
    cuts.sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const p = [cuts[k - 1], cuts[k]].map((t) => a.map((v, j) => v + (b[j] - v) * t));
      f(
        'floor',
        [
          [p[0][0], -1.5, p[0][1]],
          [p[1][0], -1.5, p[1][1]],
          [p[1][0], 0, p[1][1]],
          [p[0][0], 0, p[0][1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
  // A continuous soffit and clipped roof close the exact notched footprint, including the canopy.
  const roof = (z) =>
      detail === 0
        ? 6.2
        : z > 9.5
          ? 6.1 + (16.4 - z) * 0.055
          : 6.1 + Math.max(0, 1 - Math.abs(z - 1) / 8) * 0.85,
    zBands = detail === 0 ? [-5.4, 16.5] : [-5.4, -3, 0, 3, 6, 9.5, 13, 16.5];
  for (const p of pieces) {
    for (let i = 1; i < p.length - 1; i++)
      f(
        'wood',
        [p[0], p[i], p[i + 1]].map(([x, z]) => [x, 5.8, z]),
        [0, -1, 0],
      );
    for (let j = 1; j < zBands.length; j++) {
      const q = clip(clip(p, 1, zBands[j - 1], 1), 1, zBands[j], -1);
      for (let i = 1; i < q.length - 1; i++)
        f(
          'roof',
          [q[0], q[i], q[i + 1]].map(([x, z]) => [x, roof(z), z]),
          [0, 1, 0],
        );
    }
  }
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length],
      N = [b[1] - a[1], 0, a[0] - b[0]],
      cuts = [0, 1];
    for (const x of bands) if ((a[0] - x) * (b[0] - x) < 0) cuts.push((x - a[0]) / (b[0] - a[0]));
    for (const z of zBands) if ((a[1] - z) * (b[1] - z) < 0) cuts.push((z - a[1]) / (b[1] - a[1]));
    cuts.sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const p = [cuts[k - 1], cuts[k]].map((t) => a.map((v, j) => v + (b[j] - v) * t));
      f(
        'roof',
        [
          [p[0][0], 5.8, p[0][1]],
          [p[1][0], 5.8, p[1][1]],
          [p[1][0], roof(p[1][1]), p[1][1]],
          [p[0][0], roof(p[0][1]), p[0][1]],
        ],
        N,
      );
      if (detail >= 2) bar('trim', [p[0][0], 5.75, p[0][1]], [p[1][0], 5.75, p[1][1]], 0.15);
    }
  }
  const cylinder = (role, x, z, profile, sides, base = grade(x, z)) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: sides }, (_, i) => [
          x + R * Math.cos((i * 2 * Math.PI) / sides),
          y,
          z + R * Math.sin((i * 2 * Math.PI) / sides),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < sides; i++) {
          const k = (i + 1) % sides;
          fixed(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
            base,
          );
        }
      if (role !== 'column' && role !== 'trim')
        for (const [ring, N] of [
          [rings[0], -1],
          [rings.at(-1), 1],
        ])
          for (let i = 0; i < sides; i++)
            fixed(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % sides]], [0, N, 0], base);
    },
    column = (x, z, pale = false, tall = false) => {
      const h = tall ? 5.15 : 3.65,
        sides = [4, 6, 10, 12][detail];
      cylinder(
        pale ? 'trim' : 'column',
        x,
        z,
        detail >= 2
          ? [
              [0, 0.37],
              [0.25, 0.35],
              [0.35, 0.24],
              [h - 0.2, 0.22],
              [h, 0.29],
            ]
          : [
              [0, 0.27],
              [h, 0.27],
            ],
        sides,
      );
      if (detail) box(f, 'trim', x, h, z, 0.64, 0.35, 0.64);
      if (detail >= 2) {
        box(f, 'trim', x, 0, z, 0.78, 0.18, 0.78);
        box(f, 'wood', x, h + 0.35, z, 0.75, 0.12, 0.75);
      }
      if (detail >= 2)
        for (const y of [0.26, h - 0.13])
          cylinder(
            'gold',
            x,
            z,
            [
              [y, 0.29],
              [y + 0.1, 0.29],
            ],
            sides,
          );
    },
    arch = (a, b, z0, z1, pointed = true) => {
      const half = (b - a) / 2,
        n = [2, 4, 8, 12][detail],
        crown = (t) => {
          if (!pointed) return 3.6 + 1.45 * Math.sqrt(Math.max(0, 1 - t * t));
          return 3.6 + 1.5 * Math.sqrt(Math.max(0, 1 - Math.abs(t)));
        };
      for (let i = 0; i < n; i++) {
        const ta = -1 + (2 * i) / n,
          tb = -1 + (2 * (i + 1)) / n,
          x0 = (a + b) / 2 + ta * half,
          x1 = (a + b) / 2 + tb * half,
          y0 = crown(ta),
          y1 = crown(tb);
        for (const z of [z0, z1])
          f(
            'trim',
            [
              [x0, y0, z],
              [x1, y1, z],
              [x1, 5.8, z],
              [x0, 5.8, z],
            ],
            [0, 0, z === z0 ? -1 : 1],
          );
        f(
          'trim',
          [
            [x0, y0, z0],
            [x1, y1, z0],
            [x1, y1, z1],
            [x0, y0, z1],
          ],
          [0, -1, 0],
        );
      }
      if (detail >= 2) bar('wood', [a, 3.8, (z0 + z1) / 2], [b, 3.8, (z0 + z1) / 2], 0.08);
    },
    frontZ = (x) => {
      const hits = [];
      for (let i = 0; i < body.length; i++) {
        const a = body[i],
          b = body[(i + 1) % body.length];
        if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) {
          if (Math.abs(a[0] - b[0]) > 1e-7)
            hits.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
        }
      }
      return Math.max(...hits) - 0.48;
    };
  // The long wings remain one physical member, following the retained standard ground controls.
  for (const [left, right, nearBays] of [
    [-47.4, -4.65, 8],
    [12.3, 48.4, 7],
  ]) {
    for (let i = 1; i < bands.length; i++) {
      const a = Math.max(left, bands[i - 1]),
        b = Math.min(right, bands[i]);
      if (b > a) {
        if (detail) box(f, 'wing', (a + b) / 2, 0, 1, b - a, 5.8, 1);
        else
          for (const z of [0.5, 1.5])
            f(
              'wing',
              [
                [a, 0, z],
                [b, 0, z],
                [b, 5.8, z],
                [a, 5.8, z],
              ],
              [0, 0, z === 0.5 ? -1 : 1],
            );
      }
    }
    const count = detail ? nearBays : 2;
    for (const rear of [false, true]) {
      const xs = Array.from({ length: count + 1 }, (_, i) => left + ((right - left) * i) / count);
      for (const x of xs) column(x, rear ? -4.65 : frontZ(x));
      for (let i = 1; i < xs.length; i++) {
        // The mapped front edge steps back at wing junctions; keep each bay on its supported roof.
        const z = rear
          ? -4.65
          : Math.min(frontZ(xs[i - 1]), frontZ(xs[i]), frontZ((xs[i - 1] + xs[i]) / 2));
        arch(xs[i - 1], xs[i], z - 0.18, z + 0.18);
      }
    }
  }
  // Central gate walls enclose the full-depth route. No dark panel substitutes for the opening.
  const R = 1.55,
    spring = 2.7,
    rise = 0.75,
    curve = (x) => spring + rise * Math.sqrt(Math.max(0, 1 - (x / R) * (x / R))),
    z0 = -2,
    z1 = 7.3;
  box(f, 'wall', (-4.35 + cx - R) / 2, 0, (z0 + z1) / 2, cx - R + 4.35, 5.8, z1 - z0);
  box(f, 'wall', (12 + cx + R) / 2, 0, (z0 + z1) / 2, 12 - cx - R, 5.8, z1 - z0);
  for (let i = 0, n = [4, 6, 12, 20][detail]; i < n; i++) {
    const a = -R + (2 * R * i) / n,
      b = -R + (2 * R * (i + 1)) / n,
      ya = curve(a),
      yb = curve(b);
    for (const [z, N] of [
      [z0, -1],
      [z1, 1],
    ])
      f(
        'wall',
        [
          [cx + a, ya, z],
          [cx + b, yb, z],
          [cx + b, 5.8, z],
          [cx + a, 5.8, z],
        ],
        [0, 0, N],
      );
    f(
      'trim',
      [
        [cx + a, ya, z0],
        [cx + b, yb, z0],
        [cx + b, yb, z1],
        [cx + a, ya, z1],
      ],
      [0, -1, 0],
    );
    for (const [z, N] of [
      [z0 - 0.025, -1],
      [z1 + 0.025, 1],
    ])
      f(
        'trim',
        [
          [cx + a, ya, z],
          [cx + b, yb, z],
          [cx + b * 1.16, yb + 0.25, z],
          [cx + a * 1.16, ya + 0.25, z],
        ],
        [0, 0, N],
      );
  }
  for (const N of [-1, 1]) {
    const z = N === 1 ? 7.35 : -2.05;
    for (const sign of [-1, 1]) {
      box(f, 'trim', cx + sign * (R + 0.13), 0, z, 0.26, 2.75, 0.15);
      if (detail) {
        box(f, 'wood', cx + sign * 3.3, 0.7, z, 0.85, 3.85, 0.1);
        box(f, 'panel', cx + sign * 3.3, 3.65, z + N * 0.07, 0.75, 0.68, 0.08);
      }
    }
    if (detail) {
      box(f, 'panel', cx, 4.45, z, 5.9, 0.55, 0.08);
      for (const y of [4.45, 5])
        bar('gold', [cx - 2.95, y, z + N * 0.05], [cx + 2.95, y, z + N * 0.05], 0.05);
    }
  }
  for (const x of [-3.65, 11.3]) for (const z of [8.55, 15.55]) column(x, z, true, true);
  for (const z of [8.55, 15.55]) box(f, 'trim', cx, 5.6, z, 15.9, 0.22, 0.32);
  for (const x of [-3.65, 11.3]) box(f, 'trim', x, 5.6, 12.05, 0.32, 0.22, 7.4);
  const rearXs = [-3.8, 1.15, 6.45, 11.5];
  for (const x of rearXs) column(x, -4.65);
  for (let i = 1; i < rearXs.length; i++) arch(rearXs[i - 1], rearXs[i], -4.83, -4.47);
  if (detail)
    for (const [a, b] of [
      [-4, 1.1],
      [6.5, 11.7],
    ]) {
      box(f, 'trim', (a + b) / 2, 0.03, -4.7, b - a, 0.18, 0.25);
      box(f, 'trim', (a + b) / 2, 1.05, -4.7, b - a, 0.15, 0.28);
      const count = Math.ceil((b - a) / 0.65);
      for (let i = 0; i <= count; i++)
        box(f, 'trim', a + ((b - a) * i) / count, 0.2, -4.7, 0.16, 0.85, 0.2);
    }
  // Low polygonal drum, real faceted dome and the five distinctive roof finials.
  const sides = [8, 12, 16, 24][detail],
    domeBase = grade(cx, 1);
  cylinder(
    'roof',
    cx,
    1,
    [
      [6.8, 4.3],
      [7.1, 4.3],
      [8.15, 4.1],
    ],
    8,
    domeBase,
  );
  const dome = [];
  for (let i = 0, n = [3, 4, 6, 8][detail]; i <= n; i++) {
    const t = (i * Math.PI) / (2 * n);
    dome.push([8.15 + 3.35 * Math.sin(t), Math.max(0.01, 4.1 * Math.cos(t))]);
  }
  cylinder('roof', cx, 1, dome, sides, domeBase);
  cylinder(
    'gold',
    cx,
    1,
    detail
      ? [
          [11.48, 0.16],
          [11.65, 0.24],
          [11.8, 0.12],
          [12, 0.18],
          [12.25, 0.11],
          [12.65, 0.06],
          [12.95, 0.01],
        ]
      : [
          [11.48, 0.2],
          [12.95, 0.01],
        ],
    [3, 6, 8, 10][detail],
    domeBase,
  );
  for (const x of [-3.3, 3.3])
    for (const z of [-3.1, 3.1])
      cylinder(
        'gold',
        cx + x,
        1 + z,
        detail
          ? [
              [7.85, 0.14],
              [8.15, 0.22],
              [8.3, 0.1],
              [8.65, 0.16],
              [8.85, 0.07],
              [9.35, 0.01],
            ]
          : [
              [7.85, 0.18],
              [9.35, 0.01],
            ],
        [3, 4, 6, 8][detail],
        domeBase,
      );
  if (detail >= 2) {
    for (let i = 0; i < sides; i++) {
      const t = (i * 2 * Math.PI) / sides,
        points = dome.map(([y, R]) => [
          cx + (R + 0.025) * Math.cos(t),
          y,
          1 + (R + 0.025) * Math.sin(t),
        ]);
      for (let j = 1; j < points.length; j++) {
        const adjusted = points
          .slice(j - 1, j + 1)
          .map(([x, y, z]) => [x, y + domeBase - grade(x, z), z]);
        bar('roof', adjusted[0], adjusted[1], 0.035);
      }
    }
    // Original neutral coffer rhythm only; painted ceiling scenes and inscriptions are excluded.
    for (let i = 0; i < 10; i++)
      bar('gold', [-3.5 + i * 1.6, 5.77, 8.7], [-3.5 + i * 1.6, 5.77, 15.5], 0.025);
  }
}
