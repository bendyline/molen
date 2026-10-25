/** 'boyana_church': Boyana's connected stone annex, brick arcades and tiled octagonal drum. */
import './install-deterministic-math.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildBoyana(face, detail, r) {
  const Y = r.floorY,
    { hx, hz } = r;
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]];
  const f = (role, ps, n) => face(role, ps.map(P), P(n));
  const B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const quad = (role, ps, n) =>
    f(
      role,
      ps.map(([x, y, z]) => [x, Y + y, z]),
      n,
    );
  const upper = { x: -0.8, width: 0.95, lo: 3.05, hi: 4.8, depth: 0.35 };

  // The mapped rectangular base stays closed; facade openings are emitted as
  // actual missing wall patches with closed reveals and a recessed back panel.
  prism(f, 'stone', rect(0, 0, hx * 2, hz * 2), r.foundationY, Y);
  function body(x0, x1, h, role, door) {
    const wall = (a, b, lo, hi) =>
      quad(
        role,
        [
          [a, lo, hz],
          [b, lo, hz],
          [b, hi, hz],
          [a, hi, hz],
        ],
        [0, 0, 1],
      );
    if (door && detail >= 2) {
      const l = door.x - door.width / 2,
        u = door.x + door.width / 2;
      wall(x0, l, 0, h);
      wall(u, x1, 0, h);
      wall(l, u, 0, door.lo);
      wall(l, u, door.hi, h);
      const z = hz - door.depth;
      quad(
        'dark',
        [
          [l, door.lo, z],
          [u, door.lo, z],
          [u, door.hi, z],
          [l, door.hi, z],
        ],
        [0, 0, 1],
      );
      quad(
        'render',
        [
          [l, door.lo, z],
          [l, door.lo, hz],
          [l, door.hi, hz],
          [l, door.hi, z],
        ],
        [1, 0, 0],
      );
      quad(
        'render',
        [
          [u, door.lo, hz],
          [u, door.lo, z],
          [u, door.hi, z],
          [u, door.hi, hz],
        ],
        [-1, 0, 0],
      );
      quad(
        'render',
        [
          [l, door.lo, hz],
          [l, door.lo, z],
          [u, door.lo, z],
          [u, door.lo, hz],
        ],
        [0, 1, 0],
      );
      quad(
        'render',
        [
          [l, door.hi, z],
          [l, door.hi, hz],
          [u, door.hi, hz],
          [u, door.hi, z],
        ],
        [0, -1, 0],
      );
    } else wall(x0, x1, 0, h);
    quad(
      role,
      [
        [x1, 0, -hz],
        [x0, 0, -hz],
        [x0, h, -hz],
        [x1, h, -hz],
      ],
      [0, 0, -1],
    );
    for (const [x, n] of [
      [x0, -1],
      [x1, 1],
    ])
      quad(
        role,
        [
          [x, 0, -hz],
          [x, 0, hz],
          [x, h, hz],
          [x, h, -hz],
        ],
        [n, 0, 0],
      );
    quad(
      role,
      [
        [x0, h, -hz],
        [x1, h, -hz],
        [x1, h, hz],
        [x0, h, hz],
      ],
      [0, 1, 0],
    );
  }
  body(-hx, -2.2, 5.6, 'stone');
  body(-2.2, 2.4, 6.3, 'wall', upper);
  body(2.4, hx, 3.8, 'wall');

  function gable(x0, x1, z0, z1, eave, ridge, alongX, wallRole) {
    const points = alongX
      ? [
          [x0, eave, z0],
          [x0, ridge, (z0 + z1) / 2],
          [x0, eave, z1],
          [x1, eave, z0],
          [x1, ridge, (z0 + z1) / 2],
          [x1, eave, z1],
        ]
      : [
          [x0, eave, z0],
          [(x0 + x1) / 2, ridge, z0],
          [x1, eave, z0],
          [x0, eave, z1],
          [(x0 + x1) / 2, ridge, z1],
          [x1, eave, z1],
        ];
    quad(wallRole, points.slice(0, 3), alongX ? [-1, 0, 0] : [0, 0, -1]);
    quad(wallRole, points.slice(3), alongX ? [1, 0, 0] : [0, 0, 1]);
    quad('roof', [points[0], points[3], points[4], points[1]], alongX ? [0, 1, -1] : [-1, 1, 0]);
    quad('roof', [points[1], points[4], points[5], points[2]], alongX ? [0, 1, 1] : [1, 1, 0]);
    // Close the eave overhang, including its underside. A top-only roof lets
    // the sky show through the joint when viewed from below at the doorway.
    quad(
      wallRole,
      [
        [x0, eave, z0],
        [x1, eave, z0],
        [x1, eave, z1],
        [x0, eave, z1],
      ],
      [0, -1, 0],
    );
    if (detail > 0) {
      const w = x1 - x0,
        d = z1 - z0;
      if (alongX) {
        B('render', (x0 + x1) / 2, eave - 0.16, z0, w, 0.16, 0.18);
        B('render', (x0 + x1) / 2, eave - 0.16, z1, w, 0.16, 0.18);
      } else {
        B('render', x0, eave - 0.16, (z0 + z1) / 2, 0.18, 0.16, d);
        B('render', x1, eave - 0.16, (z0 + z1) / 2, 0.18, 0.16, d);
      }
    }
  }
  gable(-hx - 0.16, -2.12, -hz - 0.18, hz + 0.18, 5.6, 6.7, true, 'stone');
  gable(-2.35, 2.55, -hz - 0.17, hz + 0.17, 6.3, 7.3, false, 'render');
  gable(2.35, hx + 0.16, -hz - 0.17, hz + 0.17, 3.8, 4.75, true, 'wall');
  // Raised eastern cross-gable is a separate closed volume, retaining its
  // lower tiled shoulders. Exact unseen roof junctions remain approximate.
  B('wall', 4.7, 3.8, 0, 1.8, 1.8, hz * 2);
  // The eastern church has a curved raised gable, rather than the straight
  // triangular gable on the later middle body.
  const crownSteps = detail === 0 ? 4 : 8;
  quad(
    'render',
    [
      [3.7, 5.6, -hz - 0.18],
      [5.7, 5.6, -hz - 0.18],
      [5.7, 5.6, hz + 0.18],
      [3.7, 5.6, hz + 0.18],
    ],
    [0, -1, 0],
  );
  for (let i = 0; i < crownSteps; i++) {
    const x0 = 3.7 + (2 * i) / crownSteps,
      x1 = 3.7 + (2 * (i + 1)) / crownSteps,
      y0 = 5.6 + 0.7 * Math.sin((Math.PI * i) / crownSteps) ** 2,
      y1 = 5.6 + 0.7 * Math.sin((Math.PI * (i + 1)) / crownSteps) ** 2;
    for (const side of [-1, 1])
      quad(
        'render',
        [
          [x0, 5.6, side * (hz + 0.18)],
          [x1, 5.6, side * (hz + 0.18)],
          [x1, y1, side * (hz + 0.18)],
          [x0, y0, side * (hz + 0.18)],
        ],
        [0, 0, side],
      );
    quad(
      'roof',
      [
        [x0, y0, -hz - 0.18],
        [x1, y1, -hz - 0.18],
        [x1, y1, hz + 0.18],
        [x0, y0, hz + 0.18],
      ],
      [y0 - y1, 1, 0],
    );
  }

  // The simplified map perimeter omits the small rounded apse shown in the
  // eastern reference. Its projection is reconstructed and separately masked.
  const apseRing = (radius) =>
    Array.from({ length: 9 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 8;
      return [hx + Math.cos(a) * radius, Math.sin(a) * radius];
    });
  prism(f, 'wall', { outline: apseRing(1.45), holes: [] }, r.foundationY, Y + 3.55);
  loft(
    f,
    'roof',
    hx,
    0,
    [
      [Y + 3.55, 3.1],
      [Y + 4.05, 0.12],
    ],
    false,
    (w) => apseRing(w / 2).map(([x, z]) => [x - hx, z]),
  );

  const drumRing = (radius) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      return [Math.cos(a) * radius, Math.sin(a) * radius];
    });
  prism(f, 'render', { outline: drumRing(1.6), holes: [] }, Y + 7, Y + 9);
  loft(
    f,
    'roof',
    0,
    0,
    [
      [Y + 8.96, 4.25],
      [Y + 9.12, 4.5],
      [Y + 9.9, 0.12],
    ],
    false,
    (w) => drumRing(w / 2),
  );
  B('dark', 0, 9.86, 0, 0.09, 0.64, 0.09);
  B('dark', 0, 10.24, 0, 0.46, 0.08, 0.09);
  if (!detail) return;

  B('dark', hx + 1.455, 1.65, 0, 0.035, 0.65, 0.16);

  // Closed blind arcades have raised brick arch rings; the back remains the
  // wall itself. These are not described as walk-through openings.
  function blindArch(x, z, base, spring, width, rise, side = 1) {
    const steps = detail === 1 ? 5 : detail === 2 ? 8 : 12,
      half = width / 2;
    for (const sign of [-1, 1])
      B('wall', x + sign * (half + 0.07), base, z + side * 0.075, 0.14, spring - base, 0.15);
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI) / steps,
        b = ((i + 1) * Math.PI) / steps;
      const A = [x + Math.cos(a) * half, spring + Math.sin(a) * rise, z + side * 0.16];
      const Bp = [x + Math.cos(b) * half, spring + Math.sin(b) * rise, z + side * 0.16];
      const C = [
        x + Math.cos(b) * (half + 0.16),
        spring + Math.sin(b) * (rise + 0.16),
        z + side * 0.16,
      ];
      const D = [
        x + Math.cos(a) * (half + 0.16),
        spring + Math.sin(a) * (rise + 0.16),
        z + side * 0.16,
      ];
      quad('wall', [A, Bp, C, D], [0, 0, side]);
      const back = (p) => [p[0], p[1], z];
      quad('wall', [A, back(A), back(Bp), Bp], [0, -1, side * 0.2]);
      quad('wall', [D, C, back(C), back(D)], [0, 1, side * 0.2]);
    }
  }
  for (const side of [-1, 1]) {
    const z = side * hz;
    for (const x of [3.15, 6.05]) blindArch(x, z, 0.15, 1.65, 1.05, 0.6, side);
    blindArch(4.7, z, 0.15, 3.0, 0.8, 0.5, side);
    for (const x of [0.6, 1.75]) blindArch(x, z, 2.15, 4.5, 0.65, 0.45, side);
    blindArch(-0.8, z, 4.95, 5.45, 1, 0.48, side);
    B('dark', 4.7, 2.6, z + side * 0.025, 0.15, 0.6, 0.03);
    B('dark', 4.7, 5.05, z + side * 0.025, 0.14, 0.45, 0.03);
    B('wood', -4.5, 3.8, z + side * 0.025, 0.7, 1.05, 0.035);
    if (detail > 1) {
      B('dark', -4.5, 3.82, z + side * 0.05, 0.5, 1, 0.045);
      B('wood', -4.5, 3.82, z + side * 0.08, 0.06, 1, 0.05);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 1) * Math.PI) / 4,
      n = [Math.cos(a), 0, Math.sin(a)],
      t = [-n[2], 0, n[0]],
      c = [n[0] * 1.48, 0, n[2] * 1.48];
    const pts = [
      [-0.12, 7.6],
      [0.12, 7.6],
      [0.12, 8.2],
      [0, 8.38],
      [-0.12, 8.2],
    ].map(([u, y]) => [c[0] + t[0] * u, y, c[2] + t[2] * u]);
    quad('dark', pts, n);
  }

  // The upper doorway is the actual photographed opening. At the district
  // level it becomes a closed surface proxy above the same stair silhouette.
  if (detail === 1)
    B('dark', upper.x, upper.lo, hz + 0.01, upper.width, upper.hi - upper.lo, 0.035);
  else {
    for (const sign of [-1, 1])
      B(
        'render',
        upper.x + sign * (upper.width / 2 + 0.08),
        upper.lo,
        hz + 0.02,
        0.16,
        upper.hi - upper.lo + 0.16,
        0.18,
      );
    B('render', upper.x, upper.hi, hz + 0.02, upper.width + 0.3, 0.16, 0.18);
    B('dark', upper.x + 0.16, 3.8, hz - upper.depth + 0.035, 0.04, 0.28, 0.045);
  }
  const landingZ = hz + 0.5;
  B('wood', upper.x, upper.lo - 0.2, landingZ, 1.35, 0.2, 1.05);
  const stairs = detail === 1 ? 6 : 12,
    start = -5.4,
    end = upper.x - 0.55,
    run = (end - start) / stairs;
  for (let i = 0; i < stairs; i++) {
    const hi = (upper.lo * (i + 1)) / stairs,
      low = detail === 1 ? r.foundationY - Y : Math.max(0.1, hi - 0.18);
    B('wood', start + (i + 0.5) * run, low, landingZ, run + 0.01, hi - low, 0.85);
  }
  if (detail > 1) {
    // A diagonal timber carries the treads; end posts seat below the local
    // original ground, rather than creating floating treads or a flat terrace.
    const beam = (role, a, b, width) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy),
        nx = ((-dy / l) * width) / 2,
        ny = ((dx / l) * width) / 2;
      const p = [
        [a[0] + nx, a[1] + ny],
        [a[0] - nx, a[1] - ny],
        [b[0] - nx, b[1] - ny],
        [b[0] + nx, b[1] + ny],
      ];
      for (const z of [landingZ - 0.35, landingZ + 0.35]) {
        quad(
          role,
          p.map(([x, y]) => [x, y, z - 0.06]),
          [0, 0, -1],
        );
        quad(
          role,
          p.map(([x, y]) => [x, y, z + 0.06]),
          [0, 0, 1],
        );
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          quad(
            role,
            [
              [...p[i], z - 0.06],
              [...p[j], z - 0.06],
              [...p[j], z + 0.06],
              [...p[i], z + 0.06],
            ].map(([x, y, z]) => [x, y, z]),
            [p[j][1] - p[i][1], p[i][0] - p[j][0], 0],
          );
        }
      }
    };
    beam('wood', [start, 0.1], [end, upper.lo - 0.15], 0.2);
    for (const x of [start, end])
      B(
        'wood',
        x,
        r.foundationY - Y,
        landingZ,
        0.16,
        (x === start ? 0.2 : upper.lo) - r.foundationY + Y,
        0.2,
      );
    for (const side of [-1, 1]) {
      const z = landingZ + side * 0.43;
      for (let i = 0; i <= 4; i++) {
        const x = start + ((end - start) * i) / 4,
          y = (upper.lo * i) / 4;
        B('dark', x, y, z, 0.06, 0.9, 0.06);
      }
      // Use closed thin prisms following the stair's rise, with the same rail
      // attached to the landing. The distant level omits these subpixel parts.
      const dx = end - start,
        dy = upper.lo,
        nx = (-dy / Math.hypot(dx, dy)) * 0.035,
        ny = (dx / Math.hypot(dx, dy)) * 0.035;
      const a = [start, 0.9],
        b = [end, upper.lo + 0.9],
        p = [
          [a[0] + nx, a[1] + ny],
          [a[0] - nx, a[1] - ny],
          [b[0] - nx, b[1] - ny],
          [b[0] + nx, b[1] + ny],
        ];
      for (const sideZ of [-0.035, 0.035])
        quad(
          'dark',
          p.map(([x, y]) => [x, y, z + sideZ]),
          [0, 0, sideZ],
        );
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quad(
          'dark',
          [
            [...p[i], z - 0.035],
            [...p[j], z - 0.035],
            [...p[j], z + 0.035],
            [...p[i], z + 0.035],
          ],
          [p[j][1] - p[i][1], p[i][0] - p[j][0], 0],
        );
      }
      B('dark', upper.x, upper.lo + 0.87, z, 1.35, 0.06, 0.06);
      B('dark', upper.x + 0.65, upper.lo, z, 0.06, 0.9, 0.06);
    }
  }
  if (detail === 3) {
    // Coarse stone/brick construction bands and a few supported tile ridges,
    // rather than individual bricks or thousands of separate roof tiles.
    for (const side of [-1, 1]) {
      for (const y of [1.3, 2.35]) B('stone', 0.1, y, side * (hz + 0.02), 4.6, 0.18, 0.08);
      B('render', -4.55, 2.7, side * (hz + 0.02), hx - 2.2, 0.08, 0.08);
    }
    B('roof', (-hx - 2.12) / 2, 6.66, 0, hx - 2.12, 0.12, 0.2);
  }
}
