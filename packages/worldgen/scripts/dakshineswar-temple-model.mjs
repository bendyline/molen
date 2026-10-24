/** dakshineswar_kali_temple: nine-spired Bengali temple and open riverfront compound. */
import earcut from 'earcut';
export const dakshineswarCandidateId = 'dakshineswar_kali_temple';
function prism(f, role, p, lo, hi) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, typeof lo === 'function' ? lo(x, z) : lo, z]),
    high = flat.map(([x, z]) => [x, typeof hi === 'function' ? hi(x, z) : hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => low[k]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
function lathe(f, role, x, z, profile, n, flutes = 0) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (1 - (flutes ? (0.028 * (1 + Math.cos(a * flutes))) / 2 : 0));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
function panel(f, role, outline, holes, front, back) {
  const rings = [outline, ...holes],
    points = rings.flat(),
    offsets = [];
  let k = outline.length;
  for (const h of holes) {
    offsets.push(k);
    k += h.length;
  }
  const indices = earcut(points.flat(), offsets);
  for (let i = 0; i < indices.length; i += 3)
    for (const [z, n] of [
      [front, 1],
      [back, -1],
    ])
      f(
        role,
        indices.slice(i, i + 3).map((k) => [...points[k], z]),
        [0, 0, n],
      );
  for (const [ri, ring] of rings.entries()) {
    const area = ring.reduce((n, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(area) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      f(
        role,
        [
          [...a, front],
          [...b, front],
          [...b, back],
          [...a, back],
        ],
        [(b[1] - a[1]) * sgn, (a[0] - b[0]) * sgn, 0],
      );
    }
  }
}
export function buildDakshineswarTemple(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    pose = ([u, v]) => [c * u - s * v, s * u + c * v],
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    grade = (u, v) => sample(...pose([u, v])),
    box = (g, role, x, y, z, w, h, d) => prism(g, role, rect(x, z, w, d), y, y + h),
    segments = [1, 2, 6, 12][detail];
  // Three mapped perimeter wings, with an open courtyard rather than the native solid shell.
  for (const p of r.gallery) {
    prism(
      f,
      'cream',
      p,
      (u, v) => grade(u, v) - 0.65,
      (u, v) => grade(u, v) + 4.5,
    );
    if (detail > 0)
      prism(
        f,
        'red',
        p,
        (u, v) => grade(u, v) + 4.5,
        (u, v) => grade(u, v) + 4.75,
      );
  }
  function bowed(g, a, base, low, rise, trim = true) {
    const divisions = detail === 0 && trim ? 2 : segments;
    const y = (x, z) => low + rise * (2 - (x / a) * (x / a) - (z / a) * (z / a));
    for (let side = 0; side < 4; side++) {
      const co = Math.cos((side * Math.PI) / 2),
        si = Math.sin((side * Math.PI) / 2),
        P = ([u, h, v]) => [co * u - si * v, h, si * u + co * v],
        n = [-si, 0, co];
      for (let i = 0; i < divisions; i++) {
        const u = -a + (2 * a * i) / divisions,
          v = -a + (2 * a * (i + 1)) / divisions,
          ya = y(u, a),
          yb = y(v, a);
        g(
          'cream',
          [
            [u, base, a],
            [v, base, a],
            [v, yb, a],
            [u, ya, a],
          ].map(P),
          n,
        );
        g(
          'cream',
          [
            [0, y(0, 0), 0],
            [u, ya, a],
            [v, yb, a],
          ].map(P),
          [0, 1, 0],
        );
        if (trim)
          for (const [dy, h, role] of detail === 0
            ? [[0, 0.15, 'red']]
            : [
                [0, 0.14, 'red'],
                [-0.24, 0.1, 'cream'],
                [-0.47, 0.09, 'red'],
              ]) {
            const p = [
              [u, ya + dy, a + 0.09],
              [v, yb + dy, a + 0.09],
              [v, yb + dy + h, a + 0.09],
              [u, ya + dy + h, a + 0.09],
            ].map(P);
            g(role, p, n);
            g(
              role,
              p.map((p) => [p[0], p[1], p[2]]).toReversed(),
              n.map((v) => -v),
            );
          }
      }
      if (trim && detail >= 2)
        for (const dy of [-1.2, -1.65])
          for (let k = 0; k < 15; k++) {
            const u = -a + 0.6 + (k * (2 * a - 1.2)) / 14,
              yy = y(u, a) + dy;
            g(
              'red',
              [
                [u - 0.08, yy, a + 0.012],
                [u + 0.08, yy, a + 0.012],
                [u + 0.08, yy + 0.19, a + 0.012],
                [u - 0.08, yy + 0.19, a + 0.012],
              ].map(P),
              n,
            );
          }
    }
    // Close the overhanging underside against the narrower wall block.
    g(
      'cream',
      [
        [-a, base, -a],
        [a, base, -a],
        [a, base, a],
        [-a, base, a],
      ],
      [0, -1, 0],
    );
  }
  function niche(g, x, z, width, height, rotation = 0) {
    const co = Math.cos(rotation),
      si = Math.sin(rotation),
      G = (role, ps, n) =>
        g(
          role,
          ps.map(([u, y, v]) => [x + co * u - si * v, y, z + si * u + co * v]),
          [co * n[0] - si * n[2], n[1], si * n[0] + co * n[2]],
        ),
      half = width * 0.36,
      spring = height * 0.48,
      rad = width * 0.36,
      arc = Array.from({ length: segments + 1 }, (_, i) => {
        const a = (i * Math.PI) / segments;
        return [Math.cos(a) * half, spring + Math.sin(a) * rad];
      }),
      hole = [[-half, 0.2], [half, 0.2], ...arc],
      outer = [
        [-width / 2, 0],
        [width / 2, 0],
        [width / 2, height],
        [-width / 2, height],
      ];
    panel(G, 'cream', outer, [hole], 0.28, 0);
    for (let k = 1; k < hole.length - 1; k++)
      G(
        'dark',
        [hole[0], hole[k], hole[k + 1]].map(([u, y]) => [u, y, 0.005]),
        [0, 0, 1],
      );
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i],
        b = arc[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = -(b[1] - a[1]) / len,
        ny = (b[0] - a[0]) / len;
      G(
        'red',
        [
          [a[0], a[1], 0.3],
          [b[0], b[1], 0.3],
          [b[0] + nx * 0.12, b[1] + ny * 0.12, 0.3],
          [a[0] + nx * 0.12, a[1] + ny * 0.12, 0.3],
        ],
        [0, 0, 1],
      );
    }
    if (detail === 3) {
      for (const side of [-1, 1]) {
        box(G, 'red', side * (half + 0.08), 0.2, 0.31, 0.12, spring - 0.2, 0.08);
        box(G, 'cream', side * (half + 0.22), 0.1, 0.32, 0.12, spring + 0.05, 0.12);
      }
    } else
      for (const side of [-1, 1])
        G(
          'red',
          [
            [side * (half + 0.02), 0.2, 0.3],
            [side * (half + 0.14), 0.2, 0.3],
            [side * (half + 0.14), spring, 0.3],
            [side * (half + 0.02), spring, 0.3],
          ],
          [0, 0, 1],
        );
    if (detail === 3)
      for (const dx of [-half * 0.45, half * 0.45])
        box(G, 'stone', dx, 0.2, 0.045, 0.04, spring + rad * 0.65, 0.04);
  }
  function spire(g, x, z, y, radius, shaft, crown) {
    const n = [4, 6, 8, 16][detail],
      profile =
        detail === 0
          ? [
              [y, radius],
              [y + shaft, radius],
              [y + shaft + crown * 0.6, radius * 0.6],
              [y + shaft + crown, 0.04],
            ]
          : [
              [y, radius],
              [y + 0.17, radius * 1.08],
              [y + 0.27, radius],
              [y + shaft - 0.2, radius * 0.92],
              [y + shaft, radius * 1.07],
              [y + shaft + crown * 0.24, radius * 0.96],
              [y + shaft + crown * 0.55, radius * 0.72],
              [y + shaft + crown * 0.82, radius * 0.34],
              [y + shaft + crown, 0.04],
            ];
    lathe(g, 'cream', x, z, profile, n);
    if (detail >= 1) {
      lathe(
        g,
        'red',
        x,
        z,
        [
          [y + 0.1, radius * 1.09],
          [y + 0.2, radius * 1.09],
        ],
        n,
      );
      const rings = detail === 1 ? 1 : detail === 2 ? 3 : 9;
      for (let k = 1; k < rings; k++) {
        const t = k / rings,
          rr = t < 0.24 ? 1 - t * 0.16 : t < 0.55 ? 1.145 - t * 0.77 : 1.184 - t * 1.03;
        lathe(
          g,
          'stone',
          x,
          z,
          [
            [y + shaft + crown * t, radius * rr + 0.035],
            [y + shaft + crown * t + 0.06, radius * rr + 0.035],
          ],
          n,
        );
      }
      if (detail >= 2)
        for (const [dx, dz] of [
          [radius, 0],
          [-radius, 0],
          [0, radius],
          [0, -radius],
        ])
          box(g, 'red', x + dx * 0.94, y + 0.35, z + dz * 0.94, 0.07, shaft - 0.7, 0.07);
    }
    if (detail > 0)
      lathe(
        g,
        'stone',
        x,
        z,
        [
          [y + shaft + crown, 0.13],
          [y + shaft + crown + 0.18, 0.2],
          [y + shaft + crown + 0.4, 0.1],
          [y + shaft + crown + 0.65, 0.025],
        ],
        detail === 0 ? 4 : 8,
      );
  }
  const m = r.main,
    G = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x + m.center[0], y + m.floorY + 2.2, z + m.center[1]]),
        n,
      ),
    base = m.foundationBase - m.floorY - 2.2;
  box(G, 'stone', 0, base, 0, 19.6, -base, 19.6);
  if (detail > 0) box(G, 'cream', 0, -0.3, 0, 20, 0.3, 20);
  for (let i = 0; i < (detail === 0 ? 2 : 6); i++) {
    const count = detail === 0 ? 2 : 6,
      h = 2.2 / count;
    box(G, 'stone', 0, base, 10.2 + i * 0.42, 5.2, -base - i * h, 1.2);
  }
  box(G, 'cream', 0, 0, 0, 17.2, 6.4, 17.2);
  bowed(G, 9, 6.4, 8.4, 1.8);
  box(G, 'cream', 0, 9.5, 0, 9.8, 3.9, 9.8);
  bowed(G, 5.2, 13.4, 15, 1.15);
  if (detail >= 1) {
    for (let side = 0; side < (detail === 1 ? 1 : 4); side++) {
      const a = (side * Math.PI) / 2;
      for (const u of [-7.2, -3.6, 0, 3.6, 7.2]) {
        const co = Math.cos(a),
          si = Math.sin(a);
        niche(G, co * u - si * 8.6, si * u + co * 8.6, 3.6, 6.35, a);
      }
      for (const u of detail === 1 ? [] : [-2.8, 0, 2.8]) {
        const co = Math.cos(a),
          si = Math.sin(a),
          H = (role, ps, n) =>
            G(
              role,
              ps.map(([x, y, z]) => [x, y + 9.6, z]),
              n,
            );
        niche(H, co * u - si * 4.91, si * u + co * 4.91, 2.6, 3.75, a);
      }
      const co = Math.cos(a),
        si = Math.sin(a),
        Q = ([u, y, v]) => [co * u - si * v, y, si * u + co * v];
      for (const u of [-8.65, 8.65])
        for (let j = 0; j < 6; j++) {
          const ps = [
            Q([u - 0.25, j * 1.1, 8.95]),
            Q([u + 0.25, j * 1.1, 8.95]),
            Q([u + 0.25, j * 1.1 + 0.95, 8.95]),
            Q([u - 0.25, j * 1.1 + 0.95, 8.95]),
          ];
          G('red', ps, [-si, 0, co]);
        }
      if (detail >= 2)
        for (const u of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
          G(
            'red',
            [
              Q([u - 0.045, 3.5, 8.96]),
              Q([u + 0.045, 3.5, 8.96]),
              Q([u + 0.045, 6.25, 8.96]),
              Q([u - 0.045, 6.25, 8.96]),
            ],
            [-si, 0, co],
          );
        }
      if (detail >= 2)
        for (let k = 0; k < 19; k++) {
          const u = -8.55 + k * 0.95,
            yy = 8.4 + 1.8 * (1 - (u / 9) * (u / 9));
          box(
            (role, ps, n) =>
              G(role, ps.map(Q), [co * n[0] - si * n[2], n[1], si * n[0] + co * n[2]]),
            'cream',
            u,
            yy + 0.1,
            9,
            0.12,
            0.52,
            0.12,
          );
        }
    }
  }
  for (const x of [-7.15, 7.15]) for (const z of [-7.15, 7.15]) spire(G, x, z, 9.7, 1.22, 3, 3.6);
  for (const x of [-3.85, 3.85]) for (const z of [-3.85, 3.85]) spire(G, x, z, 16, 1.02, 2.65, 3.1);
  spire(G, 0, 0, 17.3, 1.95, 5.35, 5.6);
  // Separate Natmandir, north shrine and twelve paired rows of smaller riverfront temples.
  for (const [part, kind] of [
    [r.hall, 'hall'],
    [r.north, 'north'],
    ...r.shrines.map((p) => [p, 'riverfront']),
  ]) {
    const H = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [part.center[0] + u, part.floorY + y, part.center[1] + v]),
          n,
        ),
      half = part.width / 2;
    if (detail > 0)
      box(
        H,
        'stone',
        0,
        part.foundationBase - part.floorY,
        0,
        part.width,
        part.floorY - part.foundationBase + 0.3,
        part.depth,
      );
    const height = kind === 'hall' ? 6 : kind === 'north' ? 5.5 : 3.7;
    if (detail === 0)
      box(
        H,
        'cream',
        0,
        part.foundationBase - part.floorY,
        0,
        part.width,
        height + part.floorY - part.foundationBase,
        part.depth,
      );
    else box(H, 'cream', 0, 0.3, 0, part.width - 0.2, height - 0.3, part.depth - 0.2);
    if (kind === 'riverfront') {
      const R = (role, ps, n) =>
        H(
          role,
          ps.map(([x, y, z]) => [x, y, (z * part.depth) / part.width]),
          n,
        );
      bowed(
        (role, ps, n) => R(role === 'cream' ? 'red' : role, ps, n),
        half,
        height,
        height + 0.2,
        1.3,
        false,
      );
      if (detail >= 1) {
        box(H, 'cream', 0, height + 0.7, 0, 3.2, 1.1, 3.2);
        bowed(
          (role, ps, n) => H(role === 'cream' ? 'red' : role, ps, n),
          1.8,
          height + 1.6,
          height + 1.8,
          0.8,
          false,
        );
      }
      if (detail >= 2) {
        niche(H, half - 0.12, 0, 2.7, 3.6, -Math.PI / 2);
        if (detail === 3) niche(H, -half + 0.12, 0, 2.7, 3.6, Math.PI / 2);
      }
    } else {
      if (detail === 0)
        H(
          'red',
          [
            [-half - 0.15, height + 0.005, -part.depth / 2 - 0.15],
            [half + 0.15, height + 0.005, -part.depth / 2 - 0.15],
            [half + 0.15, height + 0.005, part.depth / 2 + 0.15],
            [-half - 0.15, height + 0.005, part.depth / 2 + 0.15],
          ],
          [0, 1, 0],
        );
      else box(H, 'red', 0, height, 0, part.width + 0.3, 0.26, part.depth + 0.3);
      if (detail >= 2) {
        for (let k = 0; k < 5; k++)
          niche(
            H,
            -half + 1.8 + (k * (part.width - 3.6)) / 4,
            part.depth / 2 - 0.1,
            (part.width - 1) / 5,
            height - 0.1,
          );
        for (let k = 0; k < 6; k++)
          niche(
            H,
            half - 0.1,
            -part.depth / 2 + 2 + (k * (part.depth - 4)) / 5,
            3,
            height - 0.1,
            -Math.PI / 2,
          );
      }
    }
  }
  if (detail === 3) {
    // Simple low balcony rails and a sparse rhythm on the low courtyard rooms.
    for (const x of [-9.6, 9.6])
      for (let k = 0; k < 12; k++) box(G, 'stone', x, 0.1, -9 + k * 1.6, 0.08, 0.8, 0.08);
    for (const z of [-40, 73])
      for (let u = -45; u <= -3; u += 3.5) {
        const gr = grade(u, z);
        box(f, 'red', u, gr + 0.6, z, 0.9, 2.5, 0.2);
      }
  }
}
