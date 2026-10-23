/** 'N0742_COUNCIL': Council hall, lead-domed bays, open portico and shared ornamental screens. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiCouncil(face, detail, r) {
  let frontOffset = 0;
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, p, n) =>
      face(
        role,
        p.map(([x, y, z]) => P([x, y, z + frontOffset])),
        D(n),
      ),
    adapter = {
      addQuad: (role, _ref, p, n) => f(role, p, n),
      addConvexPolygon: (role, _ref, p, n) => {
        for (let i = 1; i < p.length - 1; i++) f(role, [p[0], p[i], p[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    cyl = (role, x, z, profile, sides) => {
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
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
          );
        }
      if (role !== 'column' && role !== 'wall')
        for (const [ring, N] of [
          [rings[0], -1],
          [rings.at(-1), 1],
        ])
          for (let i = 0; i < sides; i++)
            f(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % sides]], [0, N, 0]);
    },
    pointed = (t, base, rise) => base + rise * Math.sqrt(Math.max(0, 1 - Math.abs(t))),
    archBand = (cx, z, R, spring, rise, width, role = 'trim') => {
      const n = [4, 6, 12, 20][detail];
      for (let i = 0; i < n; i++) {
        const a = -1 + (2 * i) / n,
          b = -1 + (2 * (i + 1)) / n,
          ya = pointed(a, spring, rise),
          yb = pointed(b, spring, rise);
        f(
          role,
          [
            [cx + a * R, ya, z],
            [cx + b * R, yb, z],
            [cx + b * (R + width), yb + width, z],
            [cx + a * (R + width), ya + width, z],
          ],
          [0, 0, 1],
        );
      }
      for (const sign of [-1, 1]) {
        const x = cx + sign * (R + width / 2);
        if (detail) box(f, role, x, 0.3, z - 0.03, width, spring - 0.3, 0.15);
        else
          f(
            role,
            [
              [x - width / 2, 0.3, z],
              [x + width / 2, 0.3, z],
              [x + width / 2, spring, z],
              [x - width / 2, spring, z],
            ],
            [0, 0, 1],
          );
      }
    },
    panel = (role, cx, z, points) => {
      for (let i = 1; i < points.length - 1; i++)
        f(
          role,
          [points[0], points[i], points[i + 1]].map(([x, y]) => [cx + x, y, z]),
          [0, 0, 1],
        );
    };
  for (const p of r.body) prism(f, 'floor', p, r.foundationBottom, 0);
  // The occupied floor and roof close the mapped member without extending into its neighbours.
  box(f, 'floor', 0, 0, 0.15, 25.8, 0.3, 10.4);
  box(f, 'wall', 0, 0.3, -4.85, 25.8, 5.65, 0.45);
  for (const x of [-12.7, 12.7]) box(f, 'wall', x, 0.3, 0.15, 0.45, 5.65, 10.4);
  if (detail) for (const x of [-4.3, 4.3]) box(f, 'wall', x, 0.3, 0.15, 0.22, 5.65, 10.4);
  // Front openings have actual depth. The lower doors open into enclosed rooms, not through the rear wall.
  const n = [4, 6, 12, 20][detail],
    R = 3.05,
    spring = 2.75,
    rise = 1.85;
  frontOffset = 3.5;
  for (const cx of r.rooms) {
    for (const sign of [-1, 1]) box(f, 'wall', cx + sign * 3.63, 0.3, 1.9, 1.16, 5.65, 0.4);
    for (let i = 0; i < n; i++) {
      const a = -1 + (2 * i) / n,
        b = -1 + (2 * (i + 1)) / n,
        ya = pointed(a, spring, rise),
        yb = pointed(b, spring, rise);
      for (const [z, N] of [
        [1.7, -1],
        [2.1, 1],
      ])
        f(
          'wall',
          [
            [cx + a * R, ya, z],
            [cx + b * R, yb, z],
            [cx + b * R, 5.95, z],
            [cx + a * R, 5.95, z],
          ],
          [0, 0, N],
        );
      f(
        'trim',
        [
          [cx + a * R, ya, 1.7],
          [cx + b * R, yb, 1.7],
          [cx + b * R, yb, 2.1],
          [cx + a * R, ya, 2.1],
        ],
        [0, -1, 0],
      );
    }
    archBand(cx, 2.13, R, spring, rise, 0.15);
    const fan = [
      [-R, 2.75],
      [R, 2.75],
    ];
    for (let i = 0; i <= n; i++) {
      const t = 1 - (2 * i) / n;
      fan.push([t * R, pointed(t, spring, rise)]);
    }
    panel('glazing', cx, 1.76, fan);
    if (detail) panel('screen', cx, 1.8, fan);
    // Lower window banks leave a genuine arched entrance, with glazing behind the shared screen.
    for (const sign of [-1, 1]) {
      box(f, 'glazing', cx + sign * 2.05, 0.65, 1.76, 1.85, 2.07, 0.05);
      if (detail) box(f, 'screen', cx + sign * 2.05, 0.65, 1.81, 1.85, 2.07, 0.025);
      box(f, 'wall', cx + sign * 2.05, 0.3, 1.9, 1.85, 0.35, 0.3);
      if (detail) {
        for (const y of [0.65, 2.72])
          bar(
            'gold',
            [cx + sign * 2.05 - 0.94, y, 1.85],
            [cx + sign * 2.05 + 0.94, y, 1.85],
            0.065,
          );
      }
    }
    const doorR = 1.08,
      doorSpring = 2.0,
      doorRise = 0.65;
    for (let i = 0; i < n; i++) {
      const a = -1 + (2 * i) / n,
        b = -1 + (2 * (i + 1)) / n,
        ya = pointed(a, doorSpring, doorRise),
        yb = pointed(b, doorSpring, doorRise);
      f(
        'wood',
        [
          [cx + a * doorR, ya, 1.78],
          [cx + b * doorR, yb, 1.78],
          [cx + b * doorR, 2.76, 1.78],
          [cx + a * doorR, 2.76, 1.78],
        ],
        [0, 0, 1],
      );
    }
    archBand(cx, 1.87, doorR, doorSpring, doorRise, 0.17, 'gold');
    if (detail)
      for (let i = 0; i < 3; i++) box(f, 'floor', cx, 0.1 * i, 2.45 - i * 0.2, 2.15, 0.1, 0.5);
    else box(f, 'floor', cx, 0, 2.25, 2.15, 0.3, 0.7);
    if (detail) {
      // Original frames and a simple circular crown; no copied inscriptions, tughra or floral paintings.
      for (const sign of [-1, 1]) {
        const x = cx + sign * 3.55;
        box(f, 'panel', x, 0.8, 2.14, 0.7, 3.6, 0.04);
        for (const dx of [-0.4, 0.4]) bar('gold', [x + dx, 0.7, 2.18], [x + dx, 4.5, 2.18], 0.055);
        for (const y of [0.7, 4.5]) bar('gold', [x - 0.4, y, 2.18], [x + 0.4, y, 2.18], 0.055);
      }
      bar('gold', [cx - 1.5, 3.05, 1.87], [cx + 1.5, 3.05, 1.87], 0.09);
      cyl(
        'gold',
        cx,
        1.85,
        [
          [3.05, 0.18],
          [3.3, 0.12],
          [3.55, 0.01],
        ],
        [4, 6, 8, 10][detail],
      );
    }
  }
  frontOffset = 0;
  // Actual attached courtyard and southwest-return portico.
  const xs = Array.from({ length: detail ? 9 : 5 }, (_, i) => -25 + (37.8 * i) / (detail ? 8 : 4)),
    column = (x, z) => {
      cyl(
        'column',
        x,
        z,
        detail >= 2
          ? [
              [0, 0.34],
              [0.22, 0.32],
              [0.35, 0.22],
              [3.65, 0.21],
              [3.8, 0.3],
            ]
          : [
              [0, 0.25],
              [3.8, 0.25],
            ],
        [4, 6, 10, 14][detail],
      );
      if (detail) {
        box(f, 'trim', x, 0, z, 0.72, 0.2, 0.72);
        box(f, 'trim', x, 3.8, z, 0.62, 0.42, 0.62);
      }
      if (detail >= 2) {
        for (const y of [0.24, 3.65])
          cyl(
            'gold',
            x,
            z,
            [
              [y, 0.29],
              [y + 0.1, 0.29],
            ],
            [6, 8, 10, 12][detail],
          );
        box(f, 'wood', x, 4.22, z, 0.7, 0.1, 0.7);
      }
    },
    porticoArch = (a, b) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = Math.hypot(dx, dz),
        perp = [-dz / L, dx / L],
        point = (t, y, w) => [a[0] + dx * t + perp[0] * w, y, a[1] + dz * t + perp[1] * w],
        n = [2, 4, 8, 14][detail];
      for (let i = 0; i < n; i++) {
        const t0 = i / n,
          t1 = (i + 1) / n,
          ya = pointed(-1 + 2 * t0, 4.2, 1.05),
          yb = pointed(-1 + 2 * t1, 4.2, 1.05);
        for (const w of [-0.15, 0.15])
          f(
            'trim',
            [point(t0, ya, w), point(t1, yb, w), point(t1, 5.5, w), point(t0, 5.5, w)],
            [perp[0] * Math.sign(w), 0, perp[1] * Math.sign(w)],
          );
        f(
          'trim',
          [point(t0, ya, -0.15), point(t1, yb, -0.15), point(t1, yb, 0.15), point(t0, ya, 0.15)],
          [0, -1, 0],
        );
      }
      if (detail >= 2) bar('wood', point(0, 4.17, 0), point(1, 4.17, 0), 0.07);
    };
  const frontZ = (x) => 10.3 + 0.0343 * x,
    front = xs.map((x) => [x, frontZ(x)]);
  for (const [x, z] of front) column(x, z);
  for (let i = 1; i < front.length; i++) porticoArch(front[i - 1], front[i]);
  const zs = detail ? [-12, -6.5, -1, 4.5] : [-12, -1.28],
    west = zs.map((z) => [-24.5 - (1.33 * (z + 12.91)) / 22.85 + 0.45, z]);
  west.push(front[0]);
  for (const [x, z] of west.slice(0, -1)) column(x, z);
  for (let i = 1; i < west.length; i++) porticoArch(west[i - 1], west[i]);
  const back = [west[0], [-19, -12], [-13.65, -12]];
  for (const [x, z] of back.slice(1)) column(x, z);
  for (let i = 1; i < back.length; i++) porticoArch(back[i - 1], back[i]);
  // Broad hipped lead cap and three compact domed working bays; roof inventory is an explicit approximation.
  const outer = [
      [-13.05, -5.1],
      [13.05, -5.1],
      [13.05, 5.5],
      [-13.05, 5.5],
    ],
    inner = [
      [-11.75, -3.8],
      [11.75, -3.8],
      [11.75, 2.45],
      [-11.75, 2.45],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      'roof',
      [
        [...outer[i].slice(0, 1), 5.65, outer[i][1]],
        [outer[j][0], 5.65, outer[j][1]],
        [inner[j][0], 6.4, inner[j][1]],
        [inner[i][0], 6.4, inner[i][1]],
      ],
      [0, 1, 0],
    );
    f(
      'wood',
      [
        [outer[i][0], 5.5, outer[i][1]],
        [outer[j][0], 5.5, outer[j][1]],
        [outer[j][0], 5.65, outer[j][1]],
        [outer[i][0], 5.65, outer[i][1]],
      ],
      [outer[j][1] - outer[i][1], 0, outer[i][0] - outer[j][0]],
    );
    if (detail)
      bar('trim', [outer[i][0], 5.49, outer[i][1]], [outer[j][0], 5.49, outer[j][1]], 0.12);
  }
  f(
    'roof',
    inner.map(([x, z]) => [x, 6.4, z]),
    [0, 1, 0],
  );
  f(
    'wood',
    outer.map(([x, z]) => [x, 5.5, z]),
    [0, -1, 0],
  );
  for (const p of r.porticoBody) prism(f, 'wood', p, 5.45, 5.5);
  if (!detail) for (const p of r.porticoBody) prism(f, 'roof', p, 5.5, 5.65);
  else {
    const hip = (outline, top) => {
      const c = outline.reduce((s, p) => s.map((v, k) => v + p[k] / outline.length), [0, 0]),
        upper = outline.map((p) => p.map((v, k) => c[k] + (v - c[k]) * 0.72));
      for (let i = 0; i < outline.length; i++) {
        const j = (i + 1) % outline.length;
        f(
          'roof',
          [
            [outline[i][0], 5.65, outline[i][1]],
            [outline[j][0], 5.65, outline[j][1]],
            [upper[j][0], top, upper[j][1]],
            [upper[i][0], top, upper[i][1]],
          ],
          [0, 1, 0],
        );
      }
      f(
        'roof',
        upper.map(([x, z]) => [x, top, z]),
        [0, 1, 0],
      );
    };
    hip(
      [
        [-25.5, 4.4],
        [13.35, 5.74],
        [13.24, 11.28],
        [-25.83, 9.94],
      ],
      6.35,
    );
    hip(
      [
        [-24.5, -12.91],
        [-13.02, -12.39],
        [-13.36, 5.74],
        [-25.83, 9.94],
      ],
      6.31,
    );
  }
  for (const x of r.rooms) {
    const sides = [8, 12, 16, 24][detail],
      profile = [];
    cyl(
      'wall',
      x,
      -1.5,
      [
        [6.35, 3.65],
        [7.15, 3.5],
      ],
      8,
    );
    for (let i = 0, count = [2, 4, 6, 8][detail]; i <= count; i++) {
      const t = (i * Math.PI) / (2 * count);
      profile.push([7.15 + 3.05 * Math.sin(t), Math.max(0.01, 3.5 * Math.cos(t))]);
    }
    cyl('roof', x, -1.5, profile, sides);
    cyl(
      'gold',
      x,
      -1.5,
      detail
        ? [
            [10.18, 0.1],
            [10.35, 0.18],
            [10.55, 0.08],
            [10.95, 0.01],
          ]
        : [
            [10.18, 0.12],
            [10.95, 0.01],
          ],
      [3, 4, 6, 8][detail],
    );
    if (detail >= 2)
      for (let i = 0; i < sides; i++) {
        const t = (i * 2 * Math.PI) / sides;
        for (let j = 1; j < profile.length; j++) {
          const p = profile
            .slice(j - 1, j + 1)
            .map(([y, R]) => [x + (R + 0.02) * Math.cos(t), y, -1.5 + (R + 0.02) * Math.sin(t)]);
          bar('roof', p[0], p[1], 0.03);
        }
      }
  }
  if (detail >= 2) {
    for (const [x, z] of front) bar('gold', [x, 4.35, z + 0.16], [x, 5.36, z + 0.16], 0.04);
    for (const y of [4.35, 5.36])
      bar(
        'gold',
        [front[0][0], y, front[0][1] + 0.16],
        [front.at(-1)[0], y, front.at(-1)[1] + 0.16],
        0.045,
      );
  }
}
