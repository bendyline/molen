/** Photo-led log greenhouse with glazed roof, roof vents and a timber entry/fuel bay. */
import { box } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildGreenhouse(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y + Y, x * r.xAxis[1] + z * r.zAxis[1]],
    N = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), N(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, y, z, w, h, d),
    { x0, x1, z0, z1, entryStart, doorZ } = r,
    H = 1.25,
    peak = 3.15,
    roofZ0 = z0 - 0.22,
    roofZ1 = z1 + 0.22,
    roofX0 = x0 - 0.2,
    roofX1 = x1 + 0.2,
    roofY = (z) => H + (peak - H) * (1 - (Math.abs(z) / (roofZ1 - roofZ0)) * 2);
  const beam = (role, a, b, w) => {
    const d = b.map((v, i) => v - a[i]),
      L = Math.hypot(...d),
      t = d.map((v) => v / L),
      cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ],
      q = cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]),
      u = q.map((v) => v / Math.hypot(...q)),
      v = cross(t, u),
      corners = (p) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([s, k]) => p.map((x, i) => x + ((s * u[i] + k * v[i]) * w) / 2)),
      A = corners(a),
      C = corners(b);
    f(
      role,
      A,
      t.map((v) => -v),
    );
    f(role, C, t);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        n = A[i].map((v, k) => (v + A[j][k]) / 2 - a[k]),
        length = Math.hypot(...n);
      f(
        role,
        [A[i], A[j], C[j], C[i]],
        n.map((v) => v / length),
      );
    }
  };
  B('base', (x0 + x1) / 2, r.foundationY - Y, 0, x1 - x0, Y - r.foundationY - 0.05, z1 - z0);
  // A closed floor supports the reconstructed interior benches beneath the transparent roof.
  B('frame', 0, -0.05, 0, x1 - x0, 0.05, z1 - z0);
  const wall = (z, n) => {
    f(
      'log',
      [
        [x0, 0, z],
        [x1, 0, z],
        [x1, H, z],
        [x0, H, z],
      ],
      [0, 0, n],
    );
    if (detail >= 2)
      for (let i = 0; i < 6; i++) B('log', 0, ((i + 0.5) * H) / 6 - 0.055, z, x1 - x0, 0.11, 0.11);
    f(
      'frame',
      [
        [x0, H, z],
        [x1, H, z],
        [x1, roofY(z), z],
        [x0, roofY(z), z],
      ],
      [0, 0, n],
    );
    B('frame', 0, roofY(z) - 0.13, z, x1 - x0, 0.13, 0.13);
  };
  wall(z0, -1);
  wall(z1, 1);
  f(
    'log',
    [
      [x0, 0, z0],
      [x0, 0, z1],
      [x0, H, z1],
      [x0, H, z0],
    ],
    [-1, 0, 0],
  );
  // End gable at the glazed end remains translucent rather than an opaque painted triangle.
  f(
    'glass',
    [
      [x0, H, z0],
      [x0, H, z1],
      [x0, roofY(z1), z1],
      [x0, peak, 0],
      [x0, roofY(z0), z0],
    ],
    [-1, 0, 0],
  );
  const paneCount = detail === 0 ? 3 : detail === 1 ? 6 : 12,
    dx = (entryStart - roofX0) / paneCount;
  for (let side = 0; side < 2; side++) {
    const z = side ? roofZ1 : roofZ0,
      n = [0, 1, side ? 1 : -1];
    for (let i = 0; i < paneCount; i++) {
      const a = roofX0 + i * dx,
        b = roofX0 + (i + 1) * dx,
        vent = detail >= 2 && side === 1 && (i === 4 || i === 8);
      // Two open roof lights use real pane holes and hinges, not dark rectangles over glazing.
      if (vent) {
        const zz = z * 0.55,
          yy = roofY(zz),
          zz2 = z * 0.15,
          yy2 = roofY(zz2),
          lift = 0.38;
        f(
          'glass',
          [
            [a, H, z],
            [b, H, z],
            [b, yy, zz],
            [a, yy, zz],
          ],
          n,
        );
        f(
          'glass',
          [
            [a, yy2, zz2],
            [b, yy2, zz2],
            [b, peak, 0],
            [a, peak, 0],
          ],
          n,
        );
        f(
          'glass',
          [
            [a, yy + lift, zz],
            [b, yy + lift, zz],
            [b, yy2, zz2],
            [a, yy2, zz2],
          ],
          n,
        );
        for (const x of [a, b]) {
          beam('frame', [x, yy + lift, zz], [x, yy2, zz2], 0.055);
          beam('frame', [x, yy, zz], [x, yy + lift, zz], 0.04);
        }
        beam('frame', [a, yy + lift, zz], [b, yy + lift, zz], 0.055);
      } else
        f(
          'glass',
          [
            [a, H, z],
            [b, H, z],
            [b, peak, 0],
            [a, peak, 0],
          ],
          n,
        );
    }
    f(
      'board',
      [
        [entryStart, H, z],
        [roofX1, H, z],
        [roofX1, peak, 0],
        [entryStart, peak, 0],
      ],
      n,
    );
    // Whole rafters and purlins arrive with the district level; fine pane subframes stay near.
    const every = detail === 0 ? paneCount : 1;
    for (let i = 0; i <= paneCount; i += every) {
      const x = roofX0 + i * dx;
      beam('frame', [x, H - 0.05, z], [x, peak, 0], detail === 1 ? 0.1 : 0.07);
    }
    beam('frame', [entryStart, H, z], [entryStart, peak, 0], 0.12);
    beam('frame', [roofX1, H, z], [roofX1, peak, 0], 0.12);
    if (detail >= 2)
      for (const q of [0.33, 0.66]) {
        const zz = z * q;
        beam('frame', [roofX0, roofY(zz) + 0.015, zz], [entryStart, roofY(zz) + 0.015, zz], 0.055);
      }
  }
  beam('frame', [roofX0, peak, 0], [roofX1, peak, 0], 0.13);
  // Timber entry gable: a genuine door aperture and a fuel alcove occupy different bays.
  const doorLo = doorZ - 0.44,
    doorHi = doorZ + 0.44,
    alcoveLo = z0 + 0.35,
    alcoveHi = -0.55,
    halfAtDoor = (roofZ1 * (peak - 1.95)) / (peak - H),
    zs = [z0, alcoveLo, -halfAtDoor, alcoveHi, 0, doorLo, doorHi, halfAtDoor, z1].sort(
      (a, b) => a - b,
    ),
    ys = [0, 1.12, H, 1.95];
  for (let i = 0; i < zs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const a = zs[i],
        b = zs[i + 1],
        lo = ys[j],
        hi = ys[j + 1],
        z = (a + b) / 2,
        y = (lo + hi) / 2;
      if ((z > doorLo && z < doorHi && y < 1.95) || (z > alcoveLo && z < alcoveHi && y < 1.12))
        continue;
      const topA = Math.min(hi, roofY(a)),
        topB = Math.min(hi, roofY(b));
      if (lo >= Math.min(topA, topB)) continue;
      f(
        y < H ? 'log' : 'board',
        [
          [x1, lo, a],
          [x1, lo, b],
          [x1, topB, b],
          [x1, topA, a],
        ],
        [1, 0, 0],
      );
    }
  // Upper gable above the rectangular door-height bands closes up to the ridge.
  f(
    'board',
    [
      [x1, 1.95, -halfAtDoor],
      [x1, 1.95, halfAtDoor],
      [x1, peak, 0],
    ],
    [1, 0, 0],
  );
  for (const z of [doorLo, doorHi]) {
    B('frame', x1, 0, z, 0.16, 1.98, 0.12);
  }
  B('frame', x1, 1.94, doorZ, 0.16, 0.12, 1.05);
  // Open ninety-degree wooden leaf sits beside the clear doorway.
  B('board', x1 + 0.44, 0.03, doorLo, 0.88, 1.87, 0.06);
  if (detail)
    for (const y of [0.3, 1.58]) B('frame', x1 + 0.44, y, doorLo - 0.045, 0.78, 0.08, 0.055);
  // Alcove rear and sill seat original coarse split-log geometry; no copied photo texture.
  B('board', x1 - 0.62, 0, (alcoveLo + alcoveHi) / 2, 0.08, 1.12, alcoveHi - alcoveLo);
  B('frame', x1 - 0.3, 0, (alcoveLo + alcoveHi) / 2, 0.65, 0.12, alcoveHi - alcoveLo);
  if (detail >= 2) {
    const radius = 0.11,
      wood = (x, y, z) => {
        const sides = 6,
          A = Array.from({ length: sides }, (_, i) => [
            x,
            y + radius * Math.cos((i * Math.PI) / 3),
            z + radius * Math.sin((i * Math.PI) / 3),
          ]),
          C = A.map((p) => [p[0] - 0.5, p[1], p[2]]);
        f('frame', A, [1, 0, 0]);
        f('log', C, [-1, 0, 0]);
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides,
            n = [0, (A[i][1] + A[j][1]) / 2 - y, (A[i][2] + A[j][2]) / 2 - z];
          f('log', [A[i], A[j], C[j], C[i]], n);
        }
      };
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 7; col++)
        wood(x1 - 0.08, 0.24 + row * 0.23, alcoveLo + 0.14 + col * 0.23 + (row % 2) * 0.035);
  } else
    B('log', x1 - 0.32, 0.13, (alcoveLo + alcoveHi) / 2, 0.45, 0.85, alcoveHi - alcoveLo - 0.15);
  // Simple interior benches are reconstructed to give real structure through the clear roof.
  if (detail)
    for (const z of [-1.85, 1.85]) {
      B('board', -1, 0.65, z, entryStart - x0 - 0.8, 0.08, 0.7);
      for (const x of [x0 + 1, -1, entryStart - 1]) B('frame', x, 0.05, z, 0.09, 0.6, 0.65);
    }
  // Masonry chimney at the opposite end penetrates the glazing and is seated below its roof.
  B('plaster', x0 + 0.65, 0.25, -1.8, 0.48, 3.7, 0.48);
  B('plaster', x0 + 0.65, 3.95, -1.8, 0.61, 0.14, 0.61);
  if (detail >= 2) B('frame', x0 + 0.65, 4.09, -1.8, 0.36, 0.03, 0.36);
  B('base', x1 + 0.45, r.threshold.bottom - Y, doorZ, 0.9, Y - r.threshold.bottom, 1.05);
}
