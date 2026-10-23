/** 'N0742_AUDIENCE': Enclosed audience pavilion, round arcade, granite shafts and broad coffered canopy. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiAudience(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, normal) => face(role, points.map(P), D(normal)),
    cylinder = (role, x, z, profile, n, bottom = true) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: n }, (_, i) => [
          x + R * Math.cos((i * 2 * Math.PI) / n),
          y,
          z + R * Math.sin((i * 2 * Math.PI) / n),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n,
            surface = role === 'column' && detail && j === rings.length - 1 ? 'gold' : role;
          f(
            surface,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
          );
        }
      for (const [ring, sign] of [...(bottom ? [[rings[0], -1]] : []), [rings.at(-1), 1]])
        for (let i = 0; i < n; i++)
          f(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % n]], [0, sign, 0]);
    },
    line = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = tz,
        nz = -tx;
      return {
        L,
        emit: (role, ps, n) =>
          f(
            role,
            ps.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
            [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
          ),
      };
    },
    rect = (emit, role, x0, x1, y0, y1, d = 0) => {
      const points = [
        [x0, y0, d],
        [x1, y0, d],
        [x1, y1, d],
        [x0, y1, d],
      ];
      emit(role, points, [0, 0, 1]);
      if (role === 'dark') emit(role, points.toReversed(), [0, 0, -1]);
    },
    archPanel = (emit, role, cx, R, low, spring, rise, d) => {
      const p = [
        [cx - R, low, d],
        [cx + R, low, d],
      ];
      for (let i = 0, n = [2, 4, 8, 14][detail]; i <= n; i++) {
        const u = 1 - (2 * i) / n;
        p.push([cx + u * R, spring + rise * Math.sqrt(Math.max(0, 1 - u * u)), d]);
      }
      for (let i = 1; i < p.length - 1; i++) {
        const triangle = [p[0], p[i], p[i + 1]];
        emit(role, triangle, [0, 0, 1]);
        if (role === 'dark') emit(role, triangle.toReversed(), [0, 0, -1]);
      }
    },
    header = (emit, cx, R, spring, rise, top, depth = 0.5, voussoirs = false) => {
      for (let i = 0, n = [2, 4, 8, 14][detail]; i < n; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / n,
          b = -Math.PI / 2 + (Math.PI * (i + 1)) / n,
          x0 = cx + R * Math.sin(a),
          x1 = cx + R * Math.sin(b),
          y0 = spring + rise * Math.cos(a),
          y1 = spring + rise * Math.cos(b);
        for (const [d, sign] of [
          [depth / 2, 1],
          [-depth / 2, -1],
        ]) {
          emit(
            'wall',
            [
              [x0, y0, d],
              [x1, y1, d],
              [x1, top, d],
              [x0, top, d],
            ],
            [0, 0, sign],
          );
          if (voussoirs && detail)
            emit(
              i % 2 ? 'column' : 'trim',
              [
                [x0, y0, d + sign * 0.012],
                [x1, y1, d + sign * 0.012],
                [cx + (R + 0.22) * Math.sin(b), y1 + 0.22, d + sign * 0.012],
                [cx + (R + 0.22) * Math.sin(a), y0 + 0.22, d + sign * 0.012],
              ],
              [0, 0, sign],
            );
        }
        emit(
          'trim',
          [
            [x0, y0, depth / 2],
            [x1, y1, depth / 2],
            [x1, y1, -depth / 2],
            [x0, y0, -depth / 2],
          ],
          [0, -1, 0],
        );
      }
    };

  // A bounded raised podium; the deep protective base is hidden by a host's better ground when available.
  for (const p of r.deck) prism(f, 'floor', p, r.foundationBottom, r.floorY);
  const stair = r.stairs,
    steps = detail ? stair.count : 2,
    dz = (stair.outerZ - stair.innerZ) / steps;
  for (let i = 0; i < steps; i++) {
    const top = stair.bottomY + ((r.floorY - stair.bottomY) * (i + 1)) / steps;
    box(
      f,
      'floor',
      stair.x,
      r.foundationBottom,
      stair.outerZ - (i + 0.5) * dz,
      stair.width,
      top - r.foundationBottom,
      dz,
    );
  }

  // All working column positions survive every level. Capitals and collars refine nearby.
  for (const [x, z] of r.columns) {
    const profile =
      detail === 0
        ? [
            [r.floorY, 0.35],
            [6.1, 0.32],
          ]
        : detail === 1
          ? [
              [r.floorY, 0.35],
              [5.97, 0.32],
              [6.1, 0.4],
            ]
          : [
              [r.floorY, 0.47],
              [1.38, 0.47],
              [1.56, 0.35],
              [5.88, 0.31],
              [5.97, 0.4],
              [6.1, 0.4],
            ];
    cylinder('column', x, z, profile, [4, 6, 10, 14][detail], detail !== 0);
    if (detail) box(f, 'trim', x, 6.1, z, 0.95, 0.45, 0.95);
    else {
      for (const [d, n] of [
        [-0.475, -1],
        [0.475, 1],
      ]) {
        f(
          'trim',
          [
            [x - 0.475, 6.1, z + d],
            [x + 0.475, 6.1, z + d],
            [x + 0.475, 6.55, z + d],
            [x - 0.475, 6.55, z + d],
          ],
          [0, 0, n],
        );
        f(
          'trim',
          [
            [x + d, 6.1, z - 0.475],
            [x + d, 6.1, z + 0.475],
            [x + d, 6.55, z + 0.475],
            [x + d, 6.55, z - 0.475],
          ],
          [n, 0, 0],
        );
      }
    }
  }
  for (const e of r.arcades) {
    const G = line(e.a, e.b);
    header(G.emit, G.L / 2, G.L / 2, 6.55, 1.65, 8.65, 0.48, true);
    if (detail >= 2) box(G.emit, 'dark', G.L / 2, 6.42, 0, G.L, 0.055, 0.065);
    if (detail >= 3) {
      const x = e.a[0],
        z = e.a[1],
        n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n;
        f(
          'dark',
          [
            [x, 8.06, z + 0.26],
            [x + 0.17 * Math.cos(a), 8.06 + 0.17 * Math.sin(a), z + 0.26],
            [x + 0.17 * Math.cos(b), 8.06 + 0.17 * Math.sin(b), z + 0.26],
          ],
          [0, 0, 1],
        );
      }
    }
  }

  // Low open balustrade; leave the centre front bay clear for the mapped approach and steps.
  for (const e of r.rails) {
    const G = line(e.a, e.b),
      emit = G.emit;
    if (!detail) {
      rect(emit, 'trim', 0, G.L, r.floorY + 0.12, r.floorY + 1.08);
      continue;
    }
    for (const y of [r.floorY + 0.12, r.floorY + 0.98])
      box(emit, 'trim', G.L / 2, y, 0, G.L, 0.16, 0.32);
    const n = detail === 1 ? 2 : detail === 2 ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * G.L) / n;
      if (detail === 1) box(emit, 'trim', u, r.floorY + 0.26, 0, 0.2, 0.72, 0.2);
      else {
        const w = detail === 2 ? 0.2 : 0.24;
        box(emit, 'trim', u, r.floorY + 0.26, 0, w, 0.18, 0.22);
        box(emit, 'trim', u, r.floorY + 0.44, 0, w * 0.6, 0.36, 0.16);
        box(emit, 'trim', u, r.floorY + 0.8, 0, w, 0.18, 0.22);
      }
    }
  }

  // The chamber is enclosed behind the portico; the front doorway opens into it, the rear leaf is closed.
  const room = r.room,
    hw = room.width / 2,
    hd = room.depth / 2;
  for (let side = 0; side < 4; side++) {
    const L = side % 2 ? room.depth : room.width,
      turn = ([u, y, d]) =>
        [
          [room.x + u, y, room.z + hd + d],
          [room.x + hw + d, y, room.z - u],
          [room.x - u, y, room.z - hd - d],
          [room.x - hw - d, y, room.z + u],
        ][side],
      normal = ([u, y, d]) =>
        [
          [u, y, d],
          [d, y, -u],
          [-u, y, -d],
          [-d, y, u],
        ][side],
      emit = (role, p, n) => f(role, p.map(turn), normal(n));
    if (!detail && side !== 0) {
      box(emit, 'wall', 0, r.floorY, -0.24, L, room.wallTop - r.floorY, 0.48);
      continue;
    }
    if (detail === 1) {
      if (side === 0 || side === 2) {
        const R = 1.1;
        for (const sign of [-1, 1])
          box(
            emit,
            'wall',
            sign * (L / 4 + R / 2),
            r.floorY,
            -0.24,
            L / 2 - R,
            room.wallTop - r.floorY,
            0.48,
          );
        header(emit, 0, R, 3.5, 0.8, room.wallTop, 0.48);
        if (side === 2) box(emit, 'wood', 0, r.floorY, -0.1, R * 2, 4.3 - r.floorY, 0.12);
      } else box(emit, 'wall', 0, r.floorY, -0.24, L, room.wallTop - r.floorY, 0.48);
      const count = side % 2 ? 4 : 5;
      for (let i = 0; i < count; i++) {
        if ((side === 0 || side === 2) && i === 2) continue;
        const x = -L / 2 + ((i + 0.5) * L) / count;
        rect(emit, 'dark', x - 0.73, x + 0.73, 2.0, 4.1, 0.015);
        archPanel(emit, 'dark', x, 0.73, 5.45, 6.95, 0.7, 0.015);
      }
      rect(emit, 'tile', -L / 2, L / 2, 4.65, 4.88, 0.035);
      box(emit, 'wood', 0, room.wallTop - 0.15, 0.04, L, 0.2, 0.22);
      continue;
    }
    const count = detail ? (side % 2 ? 4 : 5) : 1,
      step = L / count;
    let edge = -L / 2;
    for (let i = 0; i < count; i++) {
      const x = -L / 2 + (i + 0.5) * step,
        door = (side === 0 || side === 2) && i === Math.floor(count / 2),
        R = door ? 1.1 : 0.73,
        lo = door ? r.floorY : 2.0,
        spring = door ? 3.5 : 6.95,
        rise = door ? 0.8 : 0.7;
      box(
        emit,
        'wall',
        (edge + x - R) / 2,
        r.floorY,
        -0.24,
        x - R - edge,
        room.wallTop - r.floorY,
        0.48,
      );
      edge = x + R;
      if (door) {
        header(emit, x, R, spring, rise, room.wallTop, 0.48);
        if (side === 2) box(emit, 'wood', x, lo, -0.1, R * 2, spring + rise - lo, 0.12);
        if (detail) {
          for (const u of [x - R - 0.13, x + R + 0.13])
            box(emit, 'trim', u, r.floorY, 0.08, 0.22, 3.1, 0.18);
          rect(emit, 'dark', x - 1.45, x + 1.45, 4.5, 5.2, 0.04);
          for (const yy of [4.5, 5.2]) box(emit, 'gold', x, yy, 0.09, 2.95, 0.055, 0.08);
        }
      } else {
        box(emit, 'wall', x, r.floorY, -0.24, R * 2, 2.0 - r.floorY, 0.48);
        box(emit, 'wall', x, 4.1, -0.24, R * 2, 1.35, 0.48);
        header(emit, x, R, spring, rise, room.wallTop, 0.48);
        rect(emit, 'dark', x - R, x + R, 2.0, 4.1, -0.31);
        archPanel(emit, 'dark', x, R, 5.45, spring, rise, -0.31);
        for (const [u, sign] of [
          [x - R, 1],
          [x + R, -1],
        ]) {
          emit(
            'trim',
            [
              [u, 2.0, 0.01],
              [u, 4.1, 0.01],
              [u, 4.1, -0.32],
              [u, 2.0, -0.32],
            ],
            [sign, 0, 0],
          );
          emit(
            'trim',
            [
              [u, 5.45, 0.01],
              [u, spring, 0.01],
              [u, spring, -0.32],
              [u, 5.45, -0.32],
            ],
            [sign, 0, 0],
          );
        }
        if (detail >= 2)
          for (const yy of [2.0, 4.1, 5.45])
            box(emit, 'trim', x, yy, 0.045, R * 2 + 0.2, 0.12, 0.18);
        if (detail >= 3) {
          for (const u of [-0.5, 0, 0.5]) box(emit, 'gold', x + u, 2, -0.18, 0.035, 2.1, 0.04);
          for (const yy of [2.5, 3.2, 3.9]) box(emit, 'gold', x, yy, -0.18, R * 2, 0.035, 0.04);
        }
      }
    }
    if (edge < L / 2)
      box(
        emit,
        'wall',
        (edge + L / 2) / 2,
        r.floorY,
        -0.24,
        L / 2 - edge,
        room.wallTop - r.floorY,
        0.48,
      );
    if (detail) {
      rect(emit, 'tile', -L / 2, L / 2, 4.65, 4.88, 0.035);
      box(emit, 'wood', 0, room.wallTop - 0.15, 0.04, L, 0.2, 0.22);
    }
  }
  box(f, 'wood', room.x, room.wallTop - 0.15, room.z, room.width, 0.15, room.depth);

  // Closed shallow hip canopy and its pale coffered soffit, on the actual mapped outer outline.
  const profiles = detail
      ? [
          [8.85, 1],
          [9.12, 0.97],
          [10.35, 0.63],
          [11.1, 0.1],
        ]
      : [
          [8.85, 1],
          [10.25, 0.6],
          [11.1, 0.1],
        ],
    rings = profiles.map(([y, scale]) =>
      r.roofShape.map((p) => [
        r.center[0] + (p[0] - r.center[0]) * scale,
        y,
        r.center[1] + (p[1] - r.center[1]) * scale,
      ]),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      f(
        'roof',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [rings[j][i][0] - r.center[0], 0.1, rings[j][i][2] - r.center[1]],
      );
    }
  for (const [ring, role, sign] of [
    [rings[0], 'wall', -1],
    [rings.at(-1), 'roof', 1],
  ])
    for (let i = 1; i < ring.length - 1; i++)
      f(role, [ring[0], ring[i], ring[i + 1]], [0, sign, 0]);
  if (detail) {
    for (const z of [-13, 11.8]) box(f, 'wood', 0.2, 8.65, z, 27.8, 0.18, 0.28);
    for (const x of [-14, 14]) box(f, 'wood', x, 8.65, -0.6, 0.28, 0.18, 24.8);
  }
  if (detail >= 2) {
    const step = detail === 2 ? 2.3 : 1.15,
      xmin = -13.8,
      xmax = 13.8,
      zmin = -12.7,
      zmax = 11.6;
    for (let x = xmin; x <= xmax; x += step)
      box(f, 'gold', x, 8.78, -0.55, 0.045, 0.05, zmax - zmin);
    for (let z = zmin; z <= zmax; z += step) box(f, 'gold', 0, 8.78, z, xmax - xmin, 0.05, 0.045);
    if (detail >= 3)
      for (let x = xmin + step / 2; x < xmax; x += step)
        for (let z = zmin + step / 2; z < zmax; z += step) {
          if (Math.abs(x - room.x) < hw && Math.abs(z - room.z) < hd) continue;
          cylinder(
            'gold',
            x,
            z,
            [
              [8.7, 0.1],
              [8.77, 0.12],
            ],
            6,
          );
        }
  }
}
