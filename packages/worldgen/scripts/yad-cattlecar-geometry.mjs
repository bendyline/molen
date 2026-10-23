/** 'N0748_CATTLECAR': two-axle wagon, raised brake cabin and mapped cantilever railway. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYadCattlecar(face, detail, r) {
  const T = r.xAxis,
    Z = r.zAxis,
    Y = r.railY,
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => [
          x * T[0] + (z + r.trackZ) * Z[0],
          y,
          x * T[1] + (z + r.trackZ) * Z[1],
        ]),
        [n[0] * T[0] + n[2] * Z[0], n[1], n[0] * T[1] + n[2] * Z[1]],
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    alongX = (role, p, lo, hi) =>
      prism(
        (role, ps, n) =>
          f(
            role,
            ps.map(([z, x, y]) => [x, Y + y, z]),
            [n[1], n[2], n[0]],
          ),
        role,
        p,
        lo,
        hi,
        true,
      ),
    alongZ = (role, p, lo, hi) =>
      prism(
        (role, ps, n) =>
          f(
            role,
            ps.map(([x, z, y]) => [x, Y + y, z]),
            [n[0], n[2], n[1]],
          ),
        role,
        p,
        lo,
        hi,
        true,
      );
  function beam(role, a, b, w, d = w) {
    a = [a[0], Y + a[1], a[2]];
    b = [b[0], Y + b[1], b[2]];
    const delta = b.map((v, k) => v - a[k]),
      len = Math.hypot(...delta),
      axis = delta.map((v) => v / len),
      h = Math.hypot(axis[0], axis[2]),
      u = h > 1e-8 ? [-axis[2] / h, 0, axis[0] / h] : [1, 0, 0],
      v = [
        axis[1] * u[2] - axis[2] * u[1],
        axis[2] * u[0] - axis[0] * u[2],
        axis[0] * u[1] - axis[1] * u[0],
      ],
      offsets = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => u.map((c, k) => (c * w * s) / 2 + (v[k] * d * t) / 2)),
      A = offsets.map((q) => q.map((v, k) => v + a[k])),
      C = offsets.map((q) => q.map((v, k) => v + b[k]));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        role,
        [A[i], A[j], C[j], C[i]],
        offsets[i].map((v, k) => v + offsets[j][k]),
      );
    }
    f(
      role,
      A,
      axis.map((v) => -v),
    );
    f(role, C, axis);
  }
  const start = r.railStartX,
    end = r.railEndX,
    length = end - start,
    bays = detail ? 15 : 7,
    depth = (x) => 0.65 + (6.55 * (x - start)) / length,
    nodes = Array.from({ length: bays + 1 }, (_, i) => start + (length * i) / bays);
  // Both longitudinal trusses remain visibly open, with the deep land end buried in the bank.
  for (const z of [-1.1, 1.1]) {
    beam('steel', [start, -0.49, z], [end, -0.49, z], 0.24, 0.32);
    beam('steel', [start, -0.49 - depth(start), z], [end, -0.49 - depth(end), z], 0.22, 0.28);
    beam(
      'steel',
      [start - 1.15, -0.49 - depth(start), z],
      [start, -0.49 - depth(start), z],
      0.22,
      0.28,
    );
    for (let i = 0; i < nodes.length; i++) {
      const x = nodes[i];
      beam('steel', [x, -0.49, z], [x, -0.49 - depth(x), z], 0.2, 0.24);
      if (i < bays) beam('steel', [x, -0.49 - depth(x), z], [nodes[i + 1], -0.49, z], 0.19, 0.23);
      if (detail >= 2)
        for (const low of [false, true]) {
          const y = -0.49 - (low ? depth(x) : 0),
            p = {
              outline: [
                [-0.28, -0.2],
                [0.28, -0.2],
                [0.37, 0.08],
                [0.2, 0.25],
                [-0.2, 0.25],
                [-0.37, 0.08],
              ].map(([u, v]) => [x + u, y + v]),
              holes: [],
            };
          alongZ('steel', p, z < 0 ? z - 0.135 : z + 0.08, z < 0 ? z - 0.08 : z + 0.135);
        }
    }
  }
  for (let i = 0; i < bays; i += detail >= 2 ? 1 : 2) {
    const a = nodes[i],
      b = nodes[i + 1];
    beam('steel', [a, -0.49 - depth(a), -1.1], [b, -0.49 - depth(b), 1.1], 0.13);
    if (detail >= 2) beam('steel', [a, -0.49 - depth(a), 1.1], [b, -0.49 - depth(b), -1.1], 0.13);
  }
  const ties = [8, 32, 64, 76][detail];
  for (let i = 0; i < ties; i++) {
    const x = start + 0.15 + ((length - 0.3) * i) / (ties - 1);
    B('sleepers', x, -0.34, 0, 0.22, 0.18, 2.5);
  }
  for (const z of [-0.7175, 0.7175]) {
    if (detail) {
      B('steel', (start + end) / 2, -0.16, z, length, 0.025, 0.13);
      B('steel', (start + end) / 2, -0.135, z, length, 0.09, 0.035);
      B('steel', (start + end) / 2, -0.045, z, length, 0.045, 0.075);
    } else B('steel', (start + end) / 2, -0.16, z, length, 0.16, 0.1);
  }
  // A closed wagon shell, with actual side vent recesses and curved end closures.
  if (!detail) B('wood', 0, 1.04, 0, 8.6, 2.54, 2.68);
  else {
    B('wood', 0, 1.04, 0, 8.6, 0.12, 2.68);
    for (const side of [-1, 1]) {
      for (const p of r.sidePanels)
        alongZ('wood', p, side < 0 ? -1.34 : 1.24, side < 0 ? -1.24 : 1.34);
      for (const x of [-2.7, 2.7]) {
        B('dark', x, 3.08, side * 1.225, 0.8, 0.35, 0.025);
        if (detail >= 2)
          for (let i = 1; i < 4; i++)
            B('dark', x, 3.08 + (0.35 * i) / 4, side * 1.29, 0.8, 0.025, 0.04);
      }
      B('wood', 0, 1.16, side * 1.39, 2.4, 2.34, 0.1);
      if (detail) {
        for (const x of [-4.24, -3.2, -1.3, 1.3, 3.2, 4.24])
          B('steel', x, 1.14, side * 1.43, 0.065, 2.43, 0.06);
        for (const y of [1.15, 3.53]) B('steel', 0, y, side * 1.45, 8.6, 0.065, 0.065);
        for (const x of [-1.18, 1.18]) B('steel', x, 1.16, side * 1.47, 0.055, 2.34, 0.06);
        beam('steel', [-1.15, 1.22, side * 1.48], [1.15, 3.44, side * 1.48], 0.055);
        if (detail >= 2) {
          B('dark', 0.9, 2.04, side * 1.51, 0.06, 0.34, 0.045);
          B('steel', 0, 3.58, side * 1.51, 3.0, 0.07, 0.08);
        }
      }
    }
  }
  const segments = [4, 6, 10, 14][detail],
    roof = Array.from({ length: segments + 1 }, (_, i) => {
      const z = -1.41 + (2.82 * i) / segments;
      return [z, 3.58 + 0.38 * (1 - (z * z) / (1.41 * 1.41))];
    });
  alongX(
    'roof',
    { outline: [...roof, ...roof.toReversed().map(([z, y]) => [z, y - 0.085])], holes: [] },
    -4.4,
    4.4,
  );
  const endWall = {
    outline: [
      [-1.34, 1.14],
      [1.34, 1.14],
      ...roof.toReversed().map(([z, y]) => [z * 0.95, y - 0.085]),
    ],
    holes: [],
  };
  alongX('wood', endWall, -4.3, -4.2);
  alongX('wood', endWall, 4.2, 4.3);
  for (const z of [-1.05, 1.05]) B('dark', 0, 0.79, z, 8.9, 0.28, 0.16);
  for (const x of [-3.95, -2.55, 0, 2.55, 3.95]) B('dark', x, 0.83, 0, 0.15, 0.22, 2.25);
  const wheelSegments = [6, 10, 18, 26][detail],
    circle = (radius, cx, cy) => ({
      outline: Array.from({ length: wheelSegments }, (_, i) => {
        const a = (2 * Math.PI * i) / wheelSegments - Math.PI / 2;
        return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
      }),
      holes: [],
    });
  for (const x of [-2.55, 2.55]) {
    beam('dark', [x, 0.43, -0.95], [x, 0.43, 0.95], 0.13);
    for (const side of [-1, 1]) {
      const z = side * 0.76;
      alongZ('dark', circle(0.43, x, 0.43), z - 0.07, z + 0.07);
      if (detail >= 2) {
        alongZ(
          'dark',
          circle(0.46, x, 0.43),
          side < 0 ? z + 0.035 : z - 0.065,
          side < 0 ? z + 0.065 : z - 0.035,
        );
        alongZ('dark', circle(0.13, x, 0.43), z - 0.1, z + 0.1);
      }
      if (detail) B('dark', x, 0.51, side * 0.98, 0.38, 0.23, 0.18);
    }
  }
  if (detail)
    for (const side of [-1, 1])
      for (const z of [-0.88, 0.88]) {
        B('dark', side * 4.6, 0.86, z, 0.72, 0.15, 0.15);
        alongX('steel', circle(0.19, z, 1.0), side < 0 ? -4.98 : 4.91, side < 0 ? -4.91 : 4.98);
      }
  if (detail >= 2)
    for (const side of [-1, 1]) {
      B('steel', side * 4.9, 0.58, 0, 0.35, 0.36, 0.1);
      // A closed simple coupling loop; no fine chain inventory.
      for (const z of [-0.11, 0.11])
        beam('steel', [side * 5.07, 0.24, z], [side * 5.07, 0.63, z], 0.055);
      for (const y of [0.24, 0.63])
        beam('steel', [side * 5.07, y, -0.11], [side * 5.07, y, 0.11], 0.055);
    }
  // The raised brake cabin is integral to the land-facing end, not a generic flat wagon end.
  if (detail) {
    B('cabin', 4.46, 2.35, 0, 1.0, 0.12, 1.32);
    for (const z of [-0.65, 0.65]) B('cabin', 4.45, 2.42, z, 0.9, 1.93, 0.1);
  }
  alongX(
    'cabin',
    {
      outline: [
        [-0.65, 2.42],
        [0.65, 2.42],
        [0.65, 4.35],
        [0, 4.61],
        [-0.65, 4.35],
      ],
      holes: [],
    },
    4.0,
    detail ? 4.1 : 4.95,
  );
  if (detail) for (const p of r.cabinFrontPanels) alongX('cabin', p, 4.85, 4.95);
  for (const z of [-0.33, 0, 0.33]) {
    if (detail) B('glass', 4.8, 4.0, z, 0.025, 0.26, 0.22);
    else
      f(
        'glass',
        [
          [4.951, Y + 4, z - 0.11],
          [4.951, Y + 4.26, z - 0.11],
          [4.951, Y + 4.26, z + 0.11],
          [4.951, Y + 4, z + 0.11],
        ],
        [1, 0, 0],
      );
  }
  alongX(
    'roof',
    {
      outline: [
        [-0.78, 4.34],
        [0, 4.67],
        [0.78, 4.34],
        [0.78, 4.26],
        [0, 4.58],
        [-0.78, 4.26],
      ],
      holes: [],
    },
    3.92,
    5.04,
  );
  if (detail)
    for (const side of [-1, 1]) {
      const count = [0, 4, 7, 9][detail];
      for (const x of [4.42, 4.78])
        beam('dark', [x, 0.95, side * 1.25], [x, 2.36, side * 0.65], 0.075);
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        B('dark', 4.6, 0.98 + 1.37 * t, side * (1.22 - 0.55 * t), 0.42, 0.09, 0.2);
      }
      beam('dark', [4.86, 1.8, side * 1.3], [4.86, 3.37, side * 0.68], 0.045);
      beam('dark', [4.46, 1.8, side * 1.3], [4.46, 3.37, side * 0.68], 0.045);
      for (const x of [4.46, 4.86]) beam('dark', [x, 1.0, side * 1.3], [x, 1.8, side * 1.3], 0.045);
    }
}
