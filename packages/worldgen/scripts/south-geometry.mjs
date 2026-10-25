/** 'south_building_royal_observatory_greenwich': cruciform terracotta observatory, mansards, chimneys and copper dome. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildSouth(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (m, ps, n) => face(m, ps.map(P), P(n)),
    B = (m, x, y, z, w, h, d) => box(f, m, x, Y + y, z, w, h, d),
    n = detail === 0 ? 12 : detail === 1 ? 20 : detail === 2 ? 32 : 48,
    ring = (radius, count = n, phase = Math.PI / count) =>
      Array.from({ length: count }, (_, i) => [
        Math.cos(phase + (i / count) * Math.PI * 2) * radius,
        Math.sin(phase + (i / count) * Math.PI * 2) * radius,
      ]),
    mass = (m, ps, normal) => f(normal[1] > 0.5 ? 'stone' : m, ps, normal);
  for (const p of r.footing) prism(f, 'plinth', p, r.foundationY, Y);
  if (detail === 0) for (const p of r.floors) prism(mass, 'wall', p, Y, Y + 7.8);
  else {
    for (const p of r.lower) prism(mass, 'wall', p, Y, Y + 2.9);
    for (const p of r.floors) prism(mass, 'wall', p, Y + 2.9, Y + 7.8);
  }
  B('dark', detail === 0 ? -15.72 : -14.39, 0, 0, 0.08, 2.9, 1.4);
  if (detail > 0) B('stone', -15.02, 2.8, 0, 1.38, 0.14, 1.4);
  // Three actual 0.2m approach treads, independent of the unchanged terrain mesh.
  for (let i = 0; i < 3; i++)
    box(f, 'stone', -16.35 + i * 0.35, -0.08, 0, 0.35, 0.28 + i * 0.2, 1.5);

  const facadeEdges = (polys) =>
    polys.flatMap((p) => {
      const a = p.outline,
        winding = Math.sign(
          a.reduce((s, u, i) => {
            const v = a[(i + 1) % a.length];
            return s + u[0] * v[1] - u[1] * v[0];
          }, 0),
        );
      return a.map((u, i) => {
        const v = a[(i + 1) % a.length],
          dx = v[0] - u[0],
          dz = v[1] - u[1],
          len = Math.hypot(dx, dz);
        return {
          u,
          v,
          len,
          normal: [(winding * dz) / len, (-winding * dx) / len],
          tangent: [dx / len, dz / len],
        };
      });
    });
  const edges = facadeEdges(r.floors),
    lowerEdges = facadeEdges(r.lower);
  const panel = (role, center, normal, width, height, y, depth = 0.04) => {
    const tangent = [-normal[1], normal[0]],
      point = (u, v) => [
        center[0] + normal[0] * depth + tangent[0] * u,
        Y + y + v,
        center[1] + normal[1] * depth + tangent[1] * u,
      ];
    f(
      role,
      [
        point(-width / 2, 0),
        point(width / 2, 0),
        point(width / 2, height),
        point(-width / 2, height),
      ],
      [normal[0], 0, normal[1]],
    );
  };
  function light(center, normal, width, y, height, rich = true) {
    panel('glass', center, normal, width, height, y, 0.05);
    if (!detail) return;
    const tangent = [-normal[1], normal[0]],
      shift = (d) => center.map((v, k) => v + tangent[k] * d);
    for (const sign of [-1, 1])
      panel(
        'stone',
        shift(sign * (width / 2 + 0.09)),
        normal,
        0.18,
        height + 0.22,
        y - 0.06,
        0.075,
      );
    panel('stone', center, normal, width + 0.4, 0.16, y - 0.16, 0.09);
    panel('stone', center, normal, width + 0.4, 0.18, y + height, 0.09);
    if (detail > 1 && rich) {
      panel('frame', center, normal, 0.055, height, y, 0.1);
      panel('frame', center, normal, width, 0.06, y + height * 0.72, 0.1);
      if (width > 1.5)
        for (const sign of [-1, 1])
          panel('frame', shift((sign * width) / 6), normal, 0.055, height, y, 0.1);
      panel('arch', center, normal, 0.25, 0.24, y + height + 0.16, 0.1);
    }
  }
  const courses =
    detail === 0
      ? [
          [1.7, 0.3],
          [4, 0.3],
          [6.9, 0.3],
        ]
      : [
          [0.45, 0.22],
          [1.55, 0.28],
          [2.65, 0.24],
          [3.8, 0.32],
          [4.95, 0.27],
          [6.05, 0.28],
          [7.35, 0.32],
        ];
  for (const [y, h] of courses)
    for (const e of y < 2.9 && detail > 0 ? lowerEdges : edges) {
      if (detail === 0 && e.len < 6) continue;
      const ps = [e.u, e.v].map((p) => [p[0] + e.normal[0] * 0.025, p[1] + e.normal[1] * 0.025]);
      f(
        'stone',
        [
          [ps[0][0], Y + y, ps[0][1]],
          [ps[1][0], Y + y, ps[1][1]],
          [ps[1][0], Y + y + h, ps[1][1]],
          [ps[0][0], Y + y + h, ps[0][1]],
        ],
        [e.normal[0], 0, e.normal[1]],
      );
    }
  for (const e of edges.filter((e) => e.len > 2.35)) {
    const count = detail === 0 ? 1 : Math.max(1, Math.floor(e.len / 3.6));
    for (let i = 0; i < count; i++) {
      const center = e.u.map((v, k) => v + ((e.v[k] - v) * (i + 0.5)) / count),
        canted =
          Math.abs(center[0]) < 8 &&
          Math.abs(center[1]) < 8 &&
          Math.abs(e.normal[0] * e.normal[1]) > 0.3,
        width = canted ? Math.min(2.4, e.len - 0.4) : e.len < 3.1 ? 1.65 : 1.13;
      if (detail === 0) {
        light(center, e.normal, width, 4.45, 2.35);
        continue;
      }
      if (!(center[0] < -15 && Math.abs(center[1]) < 1)) light(center, e.normal, width, 0.68, 2.25);
      light(center, e.normal, width, 4.35, 2.65);
    }
  }
  // Four connected mansard arms retain the map's re-entrant corners.
  function mansard(axis, lo, hi, half) {
    const point = (u, y, v) => (axis === 'z' ? [u, Y + y, v] : [v, Y + y, u]),
      rect = (w, a, b, y) => [point(-w, y, a), point(w, y, a), point(w, y, b), point(-w, y, b)],
      rings = [rect(half, lo, hi, 7.8), rect(half * 0.59, lo + 0.9, hi - 0.9, 10.65)];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        mid = rings[0][i].map((v, k) => (v + rings[0][j][k]) / 2),
        center = point(0, 7.8, (lo + hi) / 2);
      f(
        'tiles',
        [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
        [mid[0] - center[0], 2, mid[2] - center[2]],
      );
    }
    f('roof', rings[1], [0, 1, 0]);
    f('stone', rings[0], [0, -1, 0]);
  }
  for (const [axis, lo, hi, half] of [
    ['z', -15.2, -1.8, 3.1],
    ['z', 1.8, 15.1, 3.1],
    ['x', -15.6, -1.8, 3],
    ['x', 1.8, 15.45, 3],
  ])
    mansard(axis, lo, hi, half);
  const core = { outline: ring(4.75, 8), holes: [] };
  prism(f, 'wall', core, Y + 7.8, Y + 11.3);
  prism(f, 'arch', { outline: ring(4.86), holes: [] }, Y + 11.3, Y + 14);
  if (detail > 0) {
    for (const [y, h] of [
      [11.25, 0.18],
      [13.85, 0.2],
    ])
      prism(f, 'stone', { outline: ring(4.92), holes: [ring(4.7)] }, Y + y, Y + y + h);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2,
        normal = [Math.cos(a), Math.sin(a)];
      light(
        normal.map((v) => v * 4.42),
        normal,
        1.7,
        8.15,
        2.25,
        false,
      );
    }
    const panels = detail === 1 ? 8 : 16;
    for (let i = 0; i < panels; i++) {
      const a = (i / panels) * Math.PI * 2,
        normal = [Math.cos(a), Math.sin(a)],
        T = ([u, y, depth]) => [
          normal[0] * (4.8 + depth) - normal[1] * u,
          Y + y,
          normal[1] * (4.8 + depth) + normal[0] * u,
        ],
        emit = (m, ps, n) =>
          f(m, ps.map(T), [
            -normal[1] * n[0] + normal[0] * n[2],
            n[1],
            normal[0] * n[0] + normal[1] * n[2],
          ]);
      box(emit, 'stone', 0, 11.65, -0.02, 1.35, 1.8, 0.34);
      panel(
        'arch',
        normal.map((v) => v * 4.97),
        normal,
        1.13,
        1.56,
        11.77,
        0.015,
      );
      const rosette = ring(0.2, 8, 0).map(([u, v]) => T([u, 12.55 + v, 0.2]));
      f('stone', rosette, [normal[0], 0, normal[1]]);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2,
        normal = [Math.cos(a), Math.sin(a)],
        T = ([u, y, depth]) => [
          normal[0] * (4.9 + depth) - normal[1] * u,
          Y + y,
          normal[1] * (4.9 + depth) + normal[0] * u,
        ],
        vertical = (m, ps, n) =>
          f(
            m,
            ps.map(([u, depth, y]) => T([u, y, depth])),
            [-normal[1] * n[0] + normal[0] * n[1], n[2], normal[0] * n[0] + normal[1] * n[1]],
          );
      prism(
        vertical,
        'tiles',
        {
          outline: [
            [-1.1, 10.6],
            [1.1, 10.6],
            [0.7, 12.25],
            [-0.7, 12.25],
          ],
          holes: [],
        },
        -0.25,
        0.25,
      );
      prism(
        vertical,
        'stone',
        {
          outline: ring(0.32, 12, 0).map(([u, v]) => [u, 11.45 + v]),
          holes: [ring(0.23, 12, 0).map(([u, v]) => [u, 11.45 + v])],
        },
        0.2,
        0.28,
      );
      f(
        'glass',
        ring(0.23, 12, 0).map(([u, v]) => T([u, 11.45 + v, 0.29])),
        [normal[0], 0, normal[1]],
      );
    }
  }
  const profile =
      detail === 0
        ? [
            [14, 4.9],
            [15.8, 4.55],
            [17.4, 3.15],
            [18.4, 1.35],
            [18.8, 0.25],
          ]
        : [
            [14, 4.9],
            [14.8, 4.83],
            [15.8, 4.55],
            [16.7, 4],
            [17.4, 3.15],
            [18.1, 2.15],
            [18.6, 1.05],
            [18.8, 0.25],
          ],
    dome = profile.map(([y, radius]) => ring(radius).map(([x, z]) => [x, Y + y, z]));
  for (let j = 0; j < dome.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = ((i + 1) / n) * Math.PI * 2;
      f(
        'roof',
        [dome[j][i], dome[j][k], dome[j + 1][k], dome[j + 1][i]],
        [Math.cos(a), 0.7, Math.sin(a)],
      );
    }
  f('roof', dome.at(-1), [0, 1, 0]);
  f('roof', dome[0], [0, -1, 0]);
  if (detail > 1)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        t = [-Math.sin(a) * 0.018, 0, Math.cos(a) * 0.018],
        p = ([y, radius]) => [
          Math.cos(a) * (radius + 0.025),
          Y + y,
          Math.sin(a) * (radius + 0.025),
        ];
      for (let j = 0; j < profile.length - 1; j++) {
        const u = p(profile[j]),
          v = p(profile[j + 1]);
        f(
          'seam',
          [
            u.map((v, k) => v + t[k]),
            u.map((v, k) => v - t[k]),
            v.map((v, k) => v - t[k]),
            v.map((v, k) => v + t[k]),
          ],
          [Math.cos(a), 0.7, Math.sin(a)],
        );
      }
    }
  B('dark', 0, 18.78, 0, 0.12, 1.5, 0.12);
  B('stone', 0, 18.8, 0, 0.45, 0.22, 0.45);
  // Four pavilions; the less-visible ends use an explicitly repeated facade treatment.
  const ends = [
    { normal: [1, 0], center: [14.65, 0] },
    { normal: [-1, 0], center: [-14.9, 0] },
    { normal: [0, -1], center: [0, -14.65] },
    { normal: [0, 1], center: [0, 14.8] },
  ];
  function dormer(center, normal, width, base = 7.8, top = 11.5) {
    const T = ([u, y, v]) => [
        center[0] - normal[1] * u + normal[0] * v,
        Y + y,
        center[1] + normal[0] * u + normal[1] * v,
      ],
      local = (m, ps, n) =>
        f(m, ps.map(T), [
          -normal[1] * n[0] + normal[0] * n[2],
          n[1],
          normal[0] * n[0] + normal[1] * n[2],
        ]);
    box(local, 'arch', 0, base, 0, width, top - base, 0.7);
    prism(
      (m, ps, n) =>
        local(
          m,
          ps.map(([x, y, z]) => [x, z, y]),
          [n[0], n[2], n[1]],
        ),
      'stone',
      {
        outline: [
          [-width * 0.58, top],
          [width * 0.58, top],
          [0, top + 0.65],
        ],
        holes: [],
      },
      -0.45,
      0.45,
    );
    if (detail > 0)
      light(
        center.map((v, k) => v + normal[k] * 0.39),
        normal,
        width * 0.5,
        base + 0.45,
        top - base - 0.7,
        false,
      );
  }
  for (const end of ends) {
    dormer(end.center, end.normal, 2.3);
    const tangent = [-end.normal[1], end.normal[0]];
    for (const sign of [-1, 1]) {
      const c = end.center.map((v, k) => v - end.normal[k] * 1.8 + tangent[k] * sign * 2.2);
      B('wall', c[0], 8.2, c[1], 0.68, 5.8, 0.78);
      if (detail > 0) {
        B('stone', c[0], 13.8, c[1], 0.9, 0.22, 1);
        if (detail > 1)
          for (const y of [9.1, 10.5, 11.9, 13.1]) B('stone', c[0], y, c[1], 0.71, 0.18, 0.81);
      }
    }
  }
  if (detail > 1)
    for (const axis of ['x', 'z'])
      for (const sign of [-1, 1])
        for (const at of [-9, 9]) {
          const normal = axis === 'x' ? [0, sign] : [sign, 0],
            center = axis === 'x' ? [at, sign * 2.85] : [sign * 2.85, at];
          dormer(center, normal, 1.2, 7.8, 10.2);
        }
  if (detail > 1) {
    const quoinAt = (point, normal) => {
      const tangent = [-normal[1], normal[0]],
        coordinate = point[0] * tangent[0] + point[1] * tangent[1],
        hits = [];
      for (const e of edges) {
        const a = e.u[0] * tangent[0] + e.u[1] * tangent[1],
          b = e.v[0] * tangent[0] + e.v[1] * tangent[1];
        if (Math.abs(b - a) < 1e-8) continue;
        const t = (coordinate - a) / (b - a);
        if (t >= 0 && t <= 1) hits.push(e.u.map((v, k) => v + (e.v[k] - v) * t));
      }
      if (!hits.length) throw Error('Missing mapped quoin support');
      return hits
        .sort((a, b) => (b[0] - a[0]) * normal[0] + (b[1] - a[1]) * normal[1])[0]
        .map((v, k) => v + normal[k] * 0.035);
    };
    for (const end of ends) {
      const tangent = [-end.normal[1], end.normal[0]];
      for (const sign of [-1, 1])
        for (let y = 0.45, row = 0; y < 7.5; y += 0.62, row++) {
          const c = quoinAt(
            end.center.map((v, k) => v + tangent[k] * sign * 2.65),
            end.normal,
          );
          B('stone', c[0], y, c[1], row % 2 ? 0.42 : 0.6, 0.3, row % 2 ? 0.6 : 0.42);
        }
    }
    // Compact dark iron roof cresting, with posts joined to a continuous sill and top rail.
    for (const axis of ['x', 'z'])
      for (const sign of [-1, 1]) {
        const pos = axis === 'x' ? [0, sign * 1.8] : [sign * 1.8, 0],
          w = axis === 'x' ? 26 : 0.055,
          d = axis === 'x' ? 0.055 : 26;
        B('dark', pos[0], 10.65, pos[1], w, 0.07, d);
        B('dark', pos[0], 11.1, pos[1], w, 0.07, d);
        for (let at = -12; at <= 12; at += detail === 2 ? 3 : 1.5)
          B(
            'dark',
            axis === 'x' ? at : pos[0],
            10.7,
            axis === 'x' ? pos[1] : at,
            0.045,
            0.43,
            0.045,
          );
      }
  }
}
