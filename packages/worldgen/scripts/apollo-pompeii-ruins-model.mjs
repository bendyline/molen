/** 'N0547': Pompeii Apollo's standing podium, broken colonnades and open precinct. */
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildApolloPompeiiRuins(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    grade = (x, z) => sample(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    F = r.podium.floorY,
    px = r.podium.center[0],
    C = r.court;
  function shaft(role, x, z, y, h, radius, fluted = true) {
    const n =
      detail === 0
        ? 4
        : !fluted || h < 0.1
          ? detail === 1
            ? 6
            : 8
          : detail === 1
            ? 6
            : detail === 2
              ? 16
              : 48;
    const profile =
      detail < 3 || h < 0.5
        ? [
            [y, radius * 2],
            [y + h, radius * 1.77],
          ]
        : [
            [y, radius * 2],
            [y + h * 0.42, radius * 1.94],
            [y + h, radius * 1.77],
          ];
    loft(f, role, x, z, profile, false, (w) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n,
          q = fluted && detail >= 2 ? ((detail === 2 ? i % 2 === 0 : i % 3 === 0) ? 0.88 : 1) : 1;
        return [(Math.cos(a) * w * q) / 2, (Math.sin(a) * w * q) / 2];
      }),
    );
  }
  function column(x, z, y, h, full = false, temple = false) {
    const role = temple ? 'wall' : 'trim',
      radius = temple ? 0.43 : 0.37;
    if (detail > 0) {
      box(f, 'trim', x, y - 0.08, z, radius * 2.45, 0.16, radius * 2.45);
      if (detail >= 2) shaft('trim', x, z, y + 0.08, 0.16, radius * 1.08, false);
    }
    shaft(role, x, z, y + 0.16, h - 0.3, radius);
    if (full) {
      if (temple && detail >= 2) {
        shaft('trim', x, z, y + h - 0.5, 0.38, radius * 1.22, false);
        for (let j = 0; j < (detail === 3 ? 8 : 4); j++) {
          const a = (j * Math.PI * 2) / (detail === 3 ? 8 : 4),
            X = Math.cos(a),
            Z = Math.sin(a);
          f(
            'trim',
            [
              [x + X * 0.39, y + h - 0.64, z + Z * 0.39],
              [x + X * 0.65 - Z * 0.14, y + h - 0.13, z + Z * 0.65 + X * 0.14],
              [x + X * 0.65 + Z * 0.14, y + h - 0.13, z + Z * 0.65 - X * 0.14],
            ],
            [X, 0.1, Z],
          );
        }
      }
      box(f, 'trim', x, y + h - 0.13, z, temple ? 1.3 : 0.98, 0.22, temple ? 1.3 : 0.98);
    } else if (detail >= 2) {
      // Offset worn crown stones keep the current ruin silhouette visibly broken.
      box(f, role, x + 0.04, y + h - 0.12, z - 0.03, radius * 1.7, 0.12, radius * 1.56);
    }
    if (detail === 3)
      for (let j = 1; j < Math.ceil(h / 1.05); j++)
        shaft(
          'trim',
          x,
          z,
          y + (j * h) / Math.ceil(h / 1.05) - 0.016,
          0.033,
          radius * (1 - (0.1 * j) / Math.ceil(h / 1.05)),
          true,
        );
  }
  function perimeterWall(x, z, w, d, h) {
    const low = Math.min(...rect(x, z, w, d).outline.map((p) => grade(...p))) - 0.5;
    box(f, 'wall', x, low, z, w, grade(x, z) + h - low, d);
  }
  // Open precinct: narrow wall runs only, with south entry and untouched northeast map shell.
  for (const sign of [-1, 1])
    for (let j = 0; j < 6; j++) {
      const z = -22.25 + j * 8.9;
      if (sign === 1 && j === 0) continue;
      perimeterWall(sign * C.wallX, z, 0.6, 8.9, [3.3, 2.5, 3.0, 2.2, 2.6, 1.6][j]);
    }
  perimeterWall(0, C.northZ, 33.7, 0.6, 3.25);
  for (const sign of [-1, 1]) perimeterWall(sign * 9.5, C.southZ, 14, 0.6, 1.5);
  prism(
    (role, ps, n) => {
      if (detail > 0 && n[1] > 0.5) return;
      f(role, ps, n);
    },
    'wall',
    rect(px, -11, r.podium.width, r.podium.length),
    r.podium.baseY,
    F,
  );
  if (detail > 0) {
    box(f, 'trim', px, F - 0.2, -11, 12.65, 0.2, 22.05);
    // Sparse pale repair blocks and courses are modeled, with shared continuous stone grain.
    for (const side of [-1, 1])
      for (let j = 0; j < (detail === 3 ? 8 : 4); j++) {
        const z = -0.9 - j * (detail === 3 ? 2.7 : 5.4),
          y = F - 0.55 - (j % 3) * 0.45;
        box(f, 'trim', px + side * 6.28, y, z, 0.07, 0.28, 0.7 + (j % 2) * 0.25);
      }
  }
  const steps = detail === 0 ? 4 : detail === 1 ? 8 : 16,
    bottom = grade(px, 4.8) + 0.04;
  for (let i = 0; i < steps; i++) {
    const z = 4.8 - ((i + 0.5) * 4.8) / steps,
      top = bottom + ((F - bottom) * (i + 1)) / steps;
    box(
      f,
      i < steps * 0.38 ? 'trim' : 'brick',
      px,
      Math.min(grade(px, z) - 0.3, bottom - 0.15),
      z,
      6,
      top - Math.min(grade(px, z) - 0.3, bottom - 0.15),
      4.8 / steps + 0.008,
    );
  }
  for (const sign of [-1, 1]) {
    column(px + sign * 5.5, -0.55, F, 6.3, true, true);
    for (let j = 0; j < 6; j++)
      column(
        px + sign * 5.5,
        -4.1 - j * 3.35,
        F,
        [0.9, 1.65, 1.1, 0.65, 1.35, 0.8][(j + (sign < 0 ? 2 : 0)) % 6],
        false,
        true,
      );
  }
  for (let j = 1; j < 5; j++)
    column(px - 5.5 + j * 2.2, -0.55, F, [1.2, 0.7, 1.55, 0.95][j - 1], false, true);
  // Roofless cella with a true south entry; no conjectural roof or pediment.
  const cell = r.cella,
    back = cell.center[1] - cell.length / 2,
    front = cell.center[1] + cell.length / 2;
  for (const sign of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const z = back + ((j + 0.5) * cell.length) / 3,
        h = [2.55, 2.15, 1.75][j];
      box(f, 'wall', px + sign * (cell.width / 2 - 0.35), F, z, 0.7, h, cell.length / 3);
      box(
        f,
        'roof',
        px + sign * (cell.width / 2 - 0.35),
        F + h,
        z,
        0.82,
        0.12,
        cell.length / 3 + 0.03,
      );
    }
    box(f, 'wall', px + sign * 2.25, F, front, 2.3, 1.9, 0.75);
    box(f, 'roof', px + sign * 2.25, F + 1.9, front, 2.42, 0.12, 0.88);
  }
  box(f, 'wall', px, F, back, cell.width, 2.6, 0.75);
  box(f, 'roof', px, F + 2.6, back, cell.width + 0.15, 0.12, 0.9);
  if (detail >= 2) {
    // Tile-cap rolls, original generic repeat, not a copied wall painting.
    for (const sign of [-1, 1])
      for (let j = 0; j < 24; j++) {
        const z = back + ((j + 0.5) * cell.length) / 24,
          h = [2.55, 2.15, 1.75][Math.min(2, Math.floor(j / 8))];
        shaft('roof', px + sign * (cell.width / 2 - 0.35), z, F + h + 0.12, 0.08, 0.16, false);
      }
  }
  const count = C.stations,
    Z = (i) => C.z0 + (i * (C.z1 - C.z0)) / (count - 1),
    eastStart = Z(C.entablatureStartIndex),
    eastEnd = Z(C.entablatureEndIndex),
    eastFloor = Math.max(...[5, 6, 7, 8].map((i) => grade(C.columnX, Z(i)))) + 0.04;
  for (const sign of [-1, 1])
    for (let i = 0; i < count; i++) {
      if (detail === 0 && i % 2 === 1 && i !== 5 && i !== 7) continue;
      const x = sign * C.columnX,
        z = Z(i),
        segment = sign === 1 && i >= 5 && i <= 8,
        y = segment ? eastFloor : grade(x, z) + 0.03,
        h = segment
          ? 4.4
          : [1.8, 3.8, 1.25, 3.25, 2.1, 3.8, 4.05, 1.55, 3.8, 2.2, 1.5, 3.6][
              (i + (sign < 0 ? 3 : 0)) % 12
            ];
      if (detail > 0) box(f, 'trim', x, grade(x, z) - 0.4, z, 1.15, y - grade(x, z) + 0.46, 1.15);
      column(x, z, y, h, h >= 3.6);
    }
  if (detail > 0)
    for (const z of [C.z0, C.z1])
      for (let i = 1; i < 6; i++) {
        const x = -C.columnX + (i * C.columnX) / 3,
          y = grade(x, z) + 0.04,
          h = [2.4, 1.1, 3.6, 1.55, 2.1][i - 1];
        column(x, z, y, h, h >= 3.6);
      }
  // Only the photographed east four-column segment carries a surviving entablature.
  for (const [offset, w, h] of [
    [0, 0.88, 0.22],
    [0.22, 1.05, 0.65],
    [0.87, 1.17, 0.16],
  ])
    box(
      f,
      'trim',
      C.columnX,
      eastFloor + 4.4 + offset,
      (eastStart + eastEnd) / 2,
      w,
      h,
      eastEnd - eastStart + 0.95,
    );
  if (detail >= 2)
    for (let j = 0; j < 13; j++) {
      const z = eastStart - 0.1 + (j * (eastEnd - eastStart + 0.2)) / 12;
      for (const sign of [-1, 1])
        for (let k = 0; k < 3; k++)
          box(
            f,
            'wall',
            C.columnX + sign * 0.535,
            eastFloor + 4.67,
            z - 0.1 + k * 0.1,
            0.025,
            0.45,
            0.045,
          );
    }
  for (let i = 5; i <= 8; i++) box(f, 'trim', C.columnX, eastFloor + 5.43, Z(i), 0.42, 0.36, 0.44);
  // Central altar on its occupied mapped footing, outside the temple stair.
  const [ax, az] = r.altar.center,
    ay = r.altar.floorY;
  prism((role, ps, n) => face(role, ps, n), 'trim', r.altar.polygon, ay - 0.65, ay);
  for (const [dy, w, h, d] of [
    [0, 3.4, 0.18, 2.25],
    [0.18, 3.03, 0.18, 1.9],
    [0.36, 2.72, 1.12, 1.5],
    [1.48, 3.05, 0.13, 1.78],
    [1.61, 3.3, 0.13, 1.96],
  ])
    box(f, 'trim', ax, ay + dy, az, w, h, d);
  if (detail > 0)
    for (const sign of [-1, 1]) {
      const roll = (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [ax + sign * 1.27 + x, ay + 1.84 + z, az + y]),
          [n[0], n[2], n[1]],
        );
      loft(
        roll,
        'trim',
        0,
        0,
        [
          [-0.82, 0.37],
          [0.82, 0.37],
        ],
        false,
        (w) =>
          Array.from({ length: detail === 3 ? 16 : 8 }, (_, i) => [
            (Math.cos((i * Math.PI * 2) / (detail === 3 ? 16 : 8)) * w) / 2,
            (Math.sin((i * Math.PI * 2) / (detail === 3 ? 16 : 8)) * w) / 2,
          ]),
      );
    }
  const [sx, sz] = r.sundial.center,
    sy = grade(sx, sz) + 0.04;
  shaft('trim', sx, sz, sy - 0.35, 0.48, 0.49, false);
  shaft('trim', sx, sz, sy + 0.13, r.sundial.height - 0.55, 0.29, false);
  box(f, 'trim', sx, sy + 4.24, sz, 0.94, 0.15, 0.75);
  if (detail >= 1) {
    for (const sign of [-1, 1]) shaft('trim', sx + sign * 0.38, sz, sy + 4.0, 0.2, 0.22, false);
    const n = detail === 3 ? 16 : 8,
      y = sy + 4.47;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      const p = (a, radius, h) => [sx + Math.cos(a) * radius, y + h, sz + Math.sin(a) * radius];
      f(
        'trim',
        [p(a, 0.5, 0.22), p(b, 0.5, 0.22), p(b, 0.13, 0), p(a, 0.13, 0)],
        [-Math.cos(a), 1, -Math.sin(a)],
      );
    }
    box(f, 'bronze', sx, y + 0.01, sz, 0.035, 0.38, 0.035);
  }
  if (detail > 0) {
    const [x, z] = r.replica.center,
      y = grade(x, z) + 0.05;
    box(f, 'wall', x, y - 0.4, z, 0.75, 1.25, 0.75);
    box(f, 'trim', x, y + 0.85, z, 0.9, 0.13, 0.86);
    const G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, v, w]) => [x + u, y + 0.98 + v, z + w]),
        n,
      );
    loft(
      G,
      'bronze',
      0,
      0,
      [
        [0.74, 0.27],
        [1.16, 0.38],
        [1.39, 0.32],
      ],
      false,
      (w) =>
        Array.from({ length: 8 }, (_, i) => [
          (Math.cos((i * Math.PI) / 4) * w) / 2,
          Math.sin((i * Math.PI) / 4) * w * 0.36,
        ]),
    );
    const bone = (A, B, radius) => {
      const d = B.map((v, i) => v - A[i]),
        len = Math.hypot(...d),
        n = d.map((v) => v / len),
        u = Math.abs(n[1]) > 0.85 ? [1, 0, 0] : [-n[2], 0, n[0]],
        ul = Math.hypot(...u),
        U = u.map((v) => v / ul),
        V = [n[1] * U[2] - n[2] * U[1], n[2] * U[0] - n[0] * U[2], n[0] * U[1] - n[1] * U[0]],
        count = detail === 3 ? 8 : 6;
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count,
          p = (C, a, q) =>
            C.map((v, k) => v + (U[k] * Math.cos(a) + V[k] * Math.sin(a)) * radius * q);
        G(
          'bronze',
          [p(A, a, 1), p(A, b, 1), p(B, b, 0.82), p(B, a, 0.82)],
          U.map((v, k) => v * Math.cos(a) + V[k] * Math.sin(a)),
        );
      }
    };
    for (const [A, B, rad] of [
      [[-0.08, 0.78, 0], [-0.13, 0.43, 0.04], 0.085],
      [[-0.13, 0.43, 0.04], [-0.16, 0.02, 0.02], 0.065],
      [[0.08, 0.78, 0], [0.16, 0.39, -0.08], 0.085],
      [[0.16, 0.39, -0.08], [0.27, 0.03, -0.14], 0.06],
      [[-0.16, 1.3, 0], [-0.4, 1.12, 0.05], 0.065],
      [[-0.4, 1.12, 0.05], [-0.57, 1.38, 0.07], 0.05],
      [[0.16, 1.3, 0], [0.4, 1.2, -0.05], 0.065],
      [[0.4, 1.2, -0.05], [0.43, 1.02, -0.12], 0.05],
    ])
      bone(A, B, rad);
    loft(
      G,
      'bronze',
      0,
      0,
      [
        [1.43, 0.16],
        [1.51, 0.27],
        [1.7, 0.26],
        [1.77, 0.12],
      ],
      false,
      (w) =>
        Array.from({ length: 8 }, (_, i) => [
          (Math.cos((i * Math.PI) / 4) * w) / 2,
          Math.sin((i * Math.PI) / 4) * w * 0.4,
        ]),
    );
  }
}
