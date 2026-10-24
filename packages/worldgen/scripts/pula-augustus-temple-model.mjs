/** 'temple_of_augustus': Specific six-column Pula temple, smooth shafts, rubble cella and plain pediment. */
import { buildCorinthianColumn } from './corinthian-column-geometry.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildPulaAugustusTemple(emit, detail, r, sampleTerrain) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    pose = ([x, y, z]) => [r.center[0] + c * x - s * z, y, r.center[1] + s * x + c * z],
    f = (role, ps, n) => emit(role, ps.map(pose), [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]]),
    grade = (x, z) => {
      const p = pose([x, 0, z]);
      return sampleTerrain(p[0], p[2]);
    },
    Y = r.floorY,
    H = r.columnHeight;
  const footprint = rect(0, -0.525, 8.5, 17.25);
  prism(
    (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, y === 0 ? grade(x, z) - 0.55 : Y, z]),
        n,
      ),
    'stone',
    footprint,
    0,
    1,
  );
  if (detail > 0)
    for (const [y, w, d] of [
      [Y - 0.12, 8.7, 17.45],
      [Y, 8.55, 17.3],
    ])
      box(f, 'stone', 0, y, -0.525, w, 0.14, d);

  function round(role, x, z, profile, n) {
    loft(
      f,
      role,
      x,
      z,
      profile.map(([y, rad]) => [y, rad * 2]),
      false,
      (w) =>
        Array.from({ length: n }, (_, i) => [
          (Math.cos((i * Math.PI * 2) / n) * w) / 2,
          (Math.sin((i * Math.PI * 2) / n) * w) / 2,
        ]),
    );
  }
  for (const [x, z] of r.columns) {
    if (detail === 0) {
      box(f, 'stone', x, Y, z, 1.15, 0.18, 1.15);
      round(
        'shaft',
        x,
        z,
        [
          [Y + 0.18, 0.45],
          [Y + H - 0.85, 0.36],
        ],
        8,
      );
      round(
        'stone',
        x,
        z,
        [
          [Y + H - 0.85, 0.38],
          [Y + H - 0.18, 0.65],
        ],
        8,
      );
      box(f, 'stone', x, Y + H - 0.18, z, 1.4, 0.18, 1.4);
    } else {
      const sy = H / 15.2,
        sx = r.columnScaleXZ;
      buildCorinthianColumn(
        (role, ps, n) => {
          if (role === 'shaft') return; // Pula has smooth monolithic shafts, not the helper's flutes.
          f(
            'stone',
            ps.map(([u, y, v]) => [x + u * sx, Y + y * sy, z + v * sx]),
            [n[0] / sx, n[1] / sy, n[2] / sx],
          );
        },
        0,
        0,
        detail === 1 ? 0 : detail,
        0,
      );
      round(
        'shaft',
        x,
        z,
        [
          [Y + 0.74 * sy, 0.785 * sx],
          [Y + 3.5 * sy, 0.8 * sx],
          [Y + 10.8 * sy, 0.71 * sx],
          [Y + 13.2 * sy, 0.66 * sx],
        ],
        detail === 1 ? 12 : detail === 2 ? 20 : 24,
      );
    }
  }
  // Three solid cella sides; the front stone wall has a real portal and a recessed closed leaf.
  box(f, 'wall', -3.55, Y, -3.15, 0.6, H, 10.9);
  box(f, 'wall', 3.55, Y, -3.15, 0.6, H, 10.9);
  box(f, 'wall', 0, Y, -8.3, 7.1, H, 0.6);
  for (const x of [-2.4, 2.4]) box(f, 'wall', x, Y, 2.0, 2.9, H, 0.6);
  box(f, 'wall', 0, Y + 4.2, 2.0, 1.9, H - 4.2, 0.6);
  box(f, 'wood', 0, Y + 0.12, 1.63, 1.87, 4.08, 0.1);
  if (detail > 0) {
    for (const x of [-1.1, 1.1]) box(f, 'stone', x, Y, 2.36, 0.3, 4.47, 0.32);
    box(f, 'stone', 0, Y + 4.2, 2.4, 2.7, 0.36, 0.4);
    for (const x of [-3.62, 3.62])
      for (const z of [-8.3, 2.0]) {
        box(f, 'stone', x, Y, z, 0.5, H, 0.72);
        box(f, 'stone', x, Y + H - 0.66, z, 0.78, 0.66, 0.92);
      }
    for (const x of [-3.55, 3.55]) box(f, 'stone', x, Y + 0.16, -3.15, 0.76, 0.3, 10.9);
    for (const x of [-0.47, 0.47]) {
      box(f, 'wood', x, Y + 0.38, 1.72, 0.78, 3.5, 0.06);
      if (detail >= 2)
        for (const y of [0.6, 1.7, 2.8]) box(f, 'wood', x, Y + y, 1.76, 0.68, 0.68, 0.04);
    }
  }
  // An opaque timber ceiling over the portico, with clear walking space below.
  box(f, 'wood', 0, Y + H + 0.01, 4.75, 6.5, 0.12, 5.8);
  if (detail >= 2)
    for (const z of [2.7, 3.8, 4.9, 6, 7.1]) box(f, 'wood', 0, Y + H - 0.15, z, 6.5, 0.16, 0.18);
  const rear = -8.8,
    front = 7.9,
    depth = front - rear,
    mid = (front + rear) / 2;
  for (const [y, h, w, d] of detail === 0
    ? [
        [H, 0.9, 8.5, depth + 0.2],
        [H + 0.9, 0.95, 9.1, depth + 0.65],
      ]
    : [
        [H, 0.2, 8.25, depth],
        [H + 0.2, 0.24, 8.4, depth + 0.15],
        [H + 0.44, 0.22, 8.55, depth + 0.25],
        [H + 0.66, 0.66, 8.5, depth + 0.2],
        [H + 1.32, 0.17, 8.65, depth + 0.35],
        [H + 1.49, 0.2, 8.9, depth + 0.55],
        [H + 1.69, 0.16, 9.1, depth + 0.65],
      ]) {
    // Front/back lintels and side returns leave the deep portico structurally legible.
    for (const z of [mid - d / 2, mid + d / 2]) box(f, 'stone', 0, Y + y, z, w, h, 0.48);
    for (const x of [-w / 2 + 0.24, w / 2 - 0.24]) box(f, 'stone', x, Y + y, mid, 0.48, h, d);
  }
  const baseline = Y + H + 1.85,
    peak = baseline + 1.9;
  function triangle(role, z, half, lo, hi, thick) {
    const p = [
      [-half, lo],
      [half, lo],
      [0, hi],
    ];
    for (const zz of [z - thick / 2, z + thick / 2])
      f(
        role,
        p.map(([x, y]) => [x, y, zz]),
        [0, 0, zz > z ? 1 : -1],
      );
    for (let i = 0; i < 3; i++) {
      const a = p[i],
        b = p[(i + 1) % 3];
      f(
        role,
        [
          [a[0], a[1], z - thick / 2],
          [b[0], b[1], z - thick / 2],
          [b[0], b[1], z + thick / 2],
          [a[0], a[1], z + thick / 2],
        ],
        [b[1] - a[1], a[0] - b[0], 0],
      );
    }
  }
  for (const z of [-8.95, 8.05]) triangle('stone', z, 4.35, baseline, peak, 0.28);
  function slope(role, a, b, z, len, thick) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy),
      co = dx / l,
      si = dy / l;
    box(
      (role, ps, n) =>
        f(
          role,
          ps.map(([u, v, w]) => [a[0] + co * u - si * v, a[1] + si * u + co * v, w]),
          [co * n[0] - si * n[1], si * n[0] + co * n[1], n[2]],
        ),
      role,
      l / 2,
      -thick / 2,
      z,
      l,
      thick,
      len,
    );
  }
  for (const side of [-1, 1]) {
    slope('roof', [side * 4.48, baseline + 0.12], [0, peak + 0.12], -0.45, 17.65, 0.16);
    for (const z of [-9.15, 8.25]) {
      slope('stone', [side * 4.6, baseline - 0.04], [0, peak + 0.08], z, 0.42, 0.24);
      if (detail > 0)
        slope('stone', [side * 4.65, baseline - 0.22], [0, peak - 0.1], z + 0.03, 0.55, 0.15);
    }
  }
  box(f, 'roof', 0, peak + 0.12, -0.45, 0.22, 0.14, 17.7);
  if (detail > 0) {
    const count = detail === 1 ? 10 : 18,
      sideCount = detail === 1 ? 17 : 31;
    for (const z of [-9.05, 8.15])
      for (let i = 0; i < count; i++)
        box(f, 'stone', -4.1 + ((i + 0.5) * 8.2) / count, Y + H + 1.2, z, 0.2, 0.23, 0.48);
    for (const x of [-4.4, 4.4])
      for (let i = 0; i < sideCount; i++)
        box(f, 'stone', x, Y + H + 1.2, -8.7 + ((i + 0.5) * 16.5) / sideCount, 0.48, 0.23, 0.2);
    if (detail >= 2)
      for (const z of [-9.1, 8.2])
        for (const side of [-1, 1])
          for (let i = 0; i < 12; i++) {
            const x = side * (0.3 + i * 0.35),
              y = peak - (Math.abs(x) * 1.9) / 4.6;
            box(f, 'stone', x, y - 0.24, z, 0.22, 0.15, 0.38);
          }
  }
  // Seven approximate treads and solid cheeks; all lower edges meet retained grade.
  const count = detail === 0 ? 3 : 7,
    run = 2.0;
  for (let i = 0; i < count; i++) {
    const z = 8.15 + ((i + 0.5) * run) / count,
      ground = grade(0, z),
      top = Y - ((Y - ground) * i) / count,
      bottom = Math.min(ground - 0.25, top - 0.1);
    box(f, 'stone', 0, bottom, z, 5.1, top - bottom, run / count + 0.02);
  }
  for (const x of [-2.8, 2.8]) {
    const z0 = 8.05,
      z1 = 10.25,
      lo = Math.min(grade(x, z0), grade(x, z1)) - 0.35,
      high0 = Y + 0.12,
      high1 = grade(x, z1) + 0.1;
    const ps = [
      [x - 0.24, lo, z0],
      [x + 0.24, lo, z0],
      [x + 0.24, high0, z0],
      [x - 0.24, high0, z0],
      [x - 0.24, lo, z1],
      [x + 0.24, lo, z1],
      [x + 0.24, high1, z1],
      [x - 0.24, high1, z1],
    ];
    for (const [ix, n] of [
      [
        [0, 1, 2, 3],
        [0, 0, -1],
      ],
      [
        [4, 7, 6, 5],
        [0, 0, 1],
      ],
      [
        [0, 4, 5, 1],
        [0, -1, 0],
      ],
      [
        [3, 2, 6, 7],
        [0, 1, 0.3],
      ],
      [
        [0, 3, 7, 4],
        [-1, 0, 0],
      ],
      [
        [1, 5, 6, 2],
        [1, 0, 0],
      ],
    ])
      f(
        'stone',
        ix.map((i) => ps[i]),
        n,
      );
  }
}
