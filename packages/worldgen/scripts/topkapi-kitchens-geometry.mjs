/** 'palace_kitchens_topkapi_palace': Stone cooking halls, lead domes and chimneys, unroofed court and open colonnade. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function kitchenGrade(r, x, z) {
  const g = r.gradeGrid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.step[0])),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.step[1])),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.values[(j + dz) * g.width + i + dx];
  return (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - b) + (h(0, 1) * (1 - a) + h(1, 1) * a) * b;
}

export function buildTopkapiKitchens(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, normal) => face(role, points.map(P), D(normal)),
    grade = (x, z) => kitchenGrade(r, x, z),
    cylinder = (role, x, z, profile, sides, open = false) => {
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
      if (!open)
        for (const [ring, N] of [
          [rings[0], -1],
          [rings.at(-1), 1],
        ])
          for (let i = 0; i < sides; i++)
            f(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % sides]], [0, N, 0]);
    },
    pointed = (t, spring, rise) => spring + rise * Math.sqrt(Math.max(0, 1 - Math.abs(t))),
    panel = (role, cx, z, bottom, spring, rise, R, normal = 1) => {
      const p = [
        [cx - R, bottom, z],
        [cx + R, bottom, z],
      ];
      for (let i = 0, n = [2, 3, 5, 12][detail]; i <= n; i++) {
        const t = 1 - (2 * i) / n;
        p.push([cx + R * t, pointed(t, spring, rise), z]);
      }
      for (let i = 1; i < p.length - 1; i++) f(role, [p[0], p[i], p[i + 1]], [0, 0, normal]);
    },
    arch = (cx, z, R, spring, rise, top, thickness, role, depth = 0.3, surround = 'trim') => {
      for (let i = 0, n = [2, 3, 5, 12][detail]; i < n; i++) {
        const a = -1 + (2 * i) / n,
          b = -1 + (2 * (i + 1)) / n,
          ya = pointed(a, spring, rise),
          yb = pointed(b, spring, rise);
        for (const [d, sign] of [
          [z - depth / 2, -1],
          [z + depth / 2, 1],
        ]) {
          f(
            role,
            [
              [cx + a * R, ya, d],
              [cx + b * R, yb, d],
              [cx + b * R, top, d],
              [cx + a * R, top, d],
            ],
            [0, 0, sign],
          );
          if (detail)
            f(
              surround,
              [
                [cx + a * R, ya, d + sign * 0.01],
                [cx + b * R, yb, d + sign * 0.01],
                [cx + b * (R + thickness), yb + thickness, d + sign * 0.01],
                [cx + a * (R + thickness), ya + thickness, d + sign * 0.01],
              ],
              [0, 0, sign],
            );
        }
        f(
          'trim',
          [
            [cx + a * R, ya, z - depth / 2],
            [cx + b * R, yb, z - depth / 2],
            [cx + b * R, yb, z + depth / 2],
            [cx + a * R, ya, z + depth / 2],
          ],
          [0, -1, 0],
        );
      }
    };

  // Floors and exposed foundation walls share the same split edges and sampled heights.
  // A single long boundary quad would interpolate past the intermediate terrain controls.
  const floorFace = (role, points, normal) =>
    f(
      role,
      points.map(([x, y, z]) => [x, y + grade(x, z), z]),
      normal,
    );
  if (!detail) for (const p of r.body) prism(floorFace, 'floor', p, -2.5, 0.08);
  else {
    const boundary = r.body
      .flatMap((p) => [p.outline, ...p.holes])
      .flatMap((ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]));
    const onBoundary = ([x, z]) =>
      boundary.some(([a, b]) => {
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz);
        return (
          t >= -1e-6 && t <= 1.000001 && Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < 1e-5
        );
      });
    for (const p of r.floorCells) {
      prism(
        (role, points, normal) => {
          if (Math.abs(normal[1]) > 0.5) floorFace(role, points, normal);
        },
        'floor',
        p,
        -2.5,
        0.08,
      );
      for (const ring of [p.outline, ...p.holes])
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length];
          if (!onBoundary([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) continue;
          floorFace(
            'floor',
            [
              [a[0], -2.5, a[1]],
              [b[0], -2.5, b[1]],
              [b[0], 0.08, b[1]],
              [a[0], 0.08, a[1]],
            ],
            [b[1] - a[1], 0, a[0] - b[0]],
          );
        }
    }
  }

  const divisions = [-87, -70.7, -54.4, -38.1, -21.8, -5.5, 10.8, 27.1, 46.73, 66.36, 85.99];
  if (detail <= 1) {
    // Distant silhouette keeps all ten domes/chimneys and the open U, with grouped arcade spans.
    for (let i = 0; i < 10; i++) {
      const x = (divisions[i] + divisions[i + 1]) / 2,
        w = divisions[i + 1] - divisions[i],
        front = x < 27 ? 4.5 : -3.18,
        base = grade(x, front),
        top = base + 7.4;
      box(
        f,
        'wall',
        x,
        Math.min(base, grade(x, -16)) - 0.4,
        (front - 16.1) / 2,
        w,
        top - Math.min(base, grade(x, -16)) + 0.4,
        front + 16.1,
      );
      cylinder(
        'roof',
        x,
        -9.2,
        [
          [top, 5.8],
          [top + 2.6, 4.1],
          [top + 4.45, 0.06],
        ],
        detail ? 8 : 4,
      );
      const z = front - 1.6,
        rim = base + 14.4;
      cylinder(
        'trim',
        x,
        z,
        [
          [top, 0.86],
          [rim - 0.3, 0.86],
          [rim, 1.02],
        ],
        detail ? 6 : 4,
        true,
      );
      f(
        'dark',
        [
          [x - 0.66, rim - 0.44, z - 0.66],
          [x + 0.66, rim - 0.44, z - 0.66],
          [x + 0.66, rim - 0.44, z + 0.66],
          [x - 0.66, rim - 0.44, z + 0.66],
        ],
        [0, 1, 0],
      );
      if (detail)
        for (const u of [-4.2, 4.2]) {
          panel('dark', x + u, front + 0.01, base + 0.3, base + 2, 0.5, 0.82);
          panel('screen', x + u, front + 0.02, base + 3.5, base + 5.55, 0.8, 0.82);
        }
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2,
          b = ((j + 1) * Math.PI) / 2;
        f(
          'roof',
          [
            [x + Math.cos(a) * 1.02, rim, z + Math.sin(a) * 1.02],
            [x + Math.cos(b) * 1.02, rim, z + Math.sin(b) * 1.02],
            [x + Math.cos(b) * 0.66, rim, z + Math.sin(b) * 0.66],
            [x + Math.cos(a) * 0.66, rim, z + Math.sin(a) * 0.66],
          ],
          [0, 1, 0],
        );
      }
    }
    const start = -82.5,
      count = detail ? 14 : 7,
      step = 159.9 / count;
    for (let i = 0; i < count; i++) {
      const a = start + i * step,
        b = a + step,
        x = (a + b) / 2,
        g = grade(x, 20.2),
        ya = grade(a, 20.2),
        yb = grade(b, 20.2),
        rear = x < 11.8 ? 8.72 : 10.25;
      box(f, 'brick', x, grade(x, rear) - 0.3, 17.35, step, g - grade(x, rear) + 6.2, 0.45);
      arch(x, 20.2, step / 2 - 0.25, g + 3.85, 1.1, g + 5.9, 0, 'brick', 0.1);
      for (const xx of [a, ...(i === count - 1 ? [b] : [])]) {
        const y = grade(xx, 20.2);
        if (detail) {
          cylinder(
            'column',
            xx,
            20.2,
            [
              [y, 0.25],
              [y + 3.9, 0.25],
            ],
            6,
          );
          continue;
        }
        f(
          'column',
          [
            [xx - 0.23, y, 20.2],
            [xx + 0.23, y, 20.2],
            [xx + 0.23, y + 3.9, 20.2],
            [xx - 0.23, y + 3.9, 20.2],
          ],
          [0, 0, 1],
        );
        f(
          'column',
          [
            [xx, y, 19.97],
            [xx, y, 20.43],
            [xx, y + 3.9, 20.43],
            [xx, y + 3.9, 19.97],
          ],
          [1, 0, 0],
        );
      }
      for (const z of [rear, 21])
        f(
          'roof',
          [
            [a, ya + 5.9, z],
            [b, yb + 5.9, z],
            [b, yb + 7.4, 15],
            [a, ya + 7.4, 15],
          ],
          [0, 1, 0],
        );
    }
    box(f, 'wall', -85.1, grade(-85, 0) - 2.5, -1, 3.6, 9.4, 29.9);
    return;
  }

  // Main range. Bay floors/roof caps stay level locally; the foundation closes the original hillside below.
  const rooms = divisions.slice(1).map((v, i) => (v + divisions[i]) / 2);
  for (const [i, cx] of rooms.entries()) {
    const front = cx < 27 ? 4.5 : -3.18,
      back = -16.1,
      base = grade(cx, front),
      top = base + 7.4,
      w = divisions[i + 1] - divisions[i],
      rearBase = Math.min(base, grade(cx - w / 2, back), grade(cx + w / 2, back)) - 0.6,
      frontBase = Math.min(base, grade(cx - w / 2, front), grade(cx + w / 2, front)) - 0.6;
    box(f, 'wall', cx, rearBase, back + 0.22, w, top - rearBase, 0.44);
    for (const x of [cx - w / 2 + 0.22, cx + w / 2 - 0.22])
      box(f, 'wall', x, rearBase, (back + front) / 2, 0.44, top - rearBase, front - back);
    // The recessed lower doors and upper perforated windows sit in real wall openings.
    const openings = detail ? [-4.2, 4.2] : [0];
    const limits = [
      cx - w / 2,
      ...openings.flatMap((u) => [cx + u - 0.82, cx + u + 0.82]),
      cx + w / 2,
    ];
    for (let j = 0; j < limits.length - 1; j += 2)
      box(
        f,
        'wall',
        (limits[j] + limits[j + 1]) / 2,
        frontBase,
        front,
        limits[j + 1] - limits[j],
        top - frontBase,
        0.5,
      );
    for (const u of openings) {
      const x = cx + u,
        R = 0.82;
      box(f, 'wall', x, frontBase, front, R * 2, base + 0.3 - frontBase, 0.5);
      box(f, 'wall', x, base + 2.5, front, R * 2, 1.0, 0.5);
      panel('dark', x, front - 0.16, base + 0.3, base + 2.0, 0.5, R, 1);
      arch(x, front, R, base + 2.0, 0.5, base + 2.5, 0.11, 'wall', 0.5);
      panel('dark', x, front - 0.16, base + 3.5, base + 5.55, 0.8, R, 1);
      if (detail) panel('screen', x, front - 0.12, base + 3.5, base + 5.55, 0.8, R, 1);
      arch(x, front, R, base + 5.55, 0.8, top, 0.14, 'wall', 0.5, 'brick');
      if (detail >= 2)
        for (const xx of [-0.72, 0, 0.72])
          box(f, 'dark', x + xx, base + 0.3, front - 0.08, 0.045, 2.05, 0.06);
    }
    // Closed low roof and faceted lead cooking dome: the rim is seated on the cap at every LOD.
    box(f, 'roof', cx, top, (back + front) / 2, w, 0.22, front - back + 0.4);
    const domeZ = -9.2,
      radius = 5.65,
      rise = 3.8,
      sides = [4, 8, 12, 18][detail],
      bands = [2, 3, 5, 7][detail];
    cylinder(
      'wall',
      cx,
      domeZ,
      [
        [top + 0.1, radius + 0.15],
        [top + 0.65, radius + 0.15],
      ],
      sides,
    );
    const profile = [];
    for (let j = 0; j <= bands; j++) {
      const t = ((j / bands) * Math.PI) / 2;
      profile.push([top + 0.65 + rise * Math.sin(t), Math.max(0.06, radius * Math.cos(t))]);
    }
    cylinder('roof', cx, domeZ, profile, sides);
    // Tall cylindrical chimney with an annular rim and a real dark opening, not a solid cap.
    const chimneyZ = front - 1.6,
      chimneyBottom = top - 0.15,
      rim = base + 14.4,
      n = [4, 6, 10, 14][detail];
    cylinder(
      'trim',
      cx,
      chimneyZ,
      [
        [chimneyBottom, 0.86],
        [rim - 0.35, 0.86],
        [rim - 0.32, 1.02],
        [rim, 1.02],
      ],
      n,
      true,
    );
    for (let k = 0; k < n; k++) {
      const a = (k * 2 * Math.PI) / n,
        b = ((k + 1) * 2 * Math.PI) / n,
        point = (t, R, y) => [cx + R * Math.cos(t), y, chimneyZ + R * Math.sin(t)];
      f(
        'roof',
        [point(a, 1.02, rim), point(b, 1.02, rim), point(b, 0.66, rim), point(a, 0.66, rim)],
        [0, 1, 0],
      );
      f(
        'dark',
        [
          point(a, 0.66, rim),
          point(b, 0.66, rim),
          point(b, 0.66, rim - 1.2),
          point(a, 0.66, rim - 1.2),
        ],
        [-Math.cos(a), 0, -Math.sin(a)],
      );
    }
    cylinder(
      'dark',
      cx,
      chimneyZ,
      [
        [rim - 1.2, 0.66],
        [rim - 1.19, 0.66],
      ],
      n,
    );
    if (detail >= 2) box(f, 'trim', cx, base + 3.3, front + 0.35, 0.7, 0.25, 0.8);
    if (i === 0 || i === rooms.length - 1)
      box(f, 'trim', cx, top - 0.22, (back + front) / 2, w, 0.25, front - back + 0.6);
  }

  // Western court range: enclosed room strip at the rear, open pointed arcade along the Second Courtyard.
  const count = [7, 14, 28, 28][detail],
    start = -82.5,
    end = 77.4,
    step = (end - start) / count;
  for (let i = 0; i < count; i++) {
    const a = start + i * step,
      b = a + step,
      cx = (a + b) / 2,
      floor = grade(cx, 20.2),
      rear = cx < 11.8 ? 8.72 : 10.25,
      front = 20.7,
      base = Math.min(floor, grade(a, rear), grade(b, rear)) - 0.6,
      top = floor + 5.9;
    box(f, 'brick', cx, base, 17.35, step, top - base, 0.45);
    box(f, 'wall', cx, base, rear + 0.22, step, top - base, 0.44);
    if (detail) {
      panel('dark', cx, rear - 0.03, floor + 0.3, floor + 2.2, 0.7, 0.8, -1);
      arch(cx, rear - 0.1, 0.82, floor + 2.2, 0.7, floor + 3.1, 0.13, 'trim', 0.12);
      panel('dark', cx, 17.61, floor + 0.4, floor + 2.4, 0.6, 1.0);
    }
    for (const x of [a, ...(i === count - 1 ? [b] : [])]) {
      const g = grade(x, 20.2),
        n = [4, 6, 8, 12][detail];
      cylinder(
        'column',
        x,
        20.2,
        [
          [g, 0.32],
          [g + 0.18, 0.3],
          [g + 0.3, 0.2],
          [g + 3.55, 0.18],
          [g + 3.7, 0.3],
        ],
        n,
      );
      if (detail) box(f, 'trim', x, g + 3.7, 20.2, 0.68, 0.25, 0.68);
    }
    arch(cx, 20.2, step / 2 - 0.22, floor + 3.85, 1.1, floor + 5.9, 0.12, 'brick', 0.38);
    // Continuous hip strips. Edge heights use the existing grade profile, preventing gaps between bays.
    const ya = grade(a, 20.2),
      yb = grade(b, 20.2),
      ridge = (rear + front) / 2;
    for (const [z, N] of [
      [rear - 0.2, -1],
      [front + 0.3, 1],
    ])
      f(
        'roof',
        [
          [a, ya + 5.9, z],
          [b, yb + 5.9, z],
          [b, yb + 7.4, ridge],
          [a, ya + 7.4, ridge],
        ],
        [0, 1, N],
      );
    f(
      'roof',
      [
        [a, ya + 5.9, rear - 0.2],
        [b, yb + 5.9, rear - 0.2],
        [b, yb + 5.9, front + 0.3],
        [a, ya + 5.9, front + 0.3],
      ],
      [0, -1, 0],
    );
  }

  // Northern cross range closes the U. The service court remains open to the sky and at the southern end.
  const g = grade(-85, 0);
  box(f, 'wall', -85.1, g - 2.5, -1, 3.6, 9.1, 29.9);
  box(f, 'roof', -85.1, g + 6.6, -1, 3.9, 0.3, 30.3);
}
