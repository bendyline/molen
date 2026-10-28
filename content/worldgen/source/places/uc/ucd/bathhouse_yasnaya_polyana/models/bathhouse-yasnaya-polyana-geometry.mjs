/** Roofless pond bathing enclosure. Fine twig grain comes from the shared thatch graph. */
import { box } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildBathhouse(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    beam = (role, a, b, width, depth = width) => {
      const delta = b.map((v, i) => v - a[i]),
        L = Math.hypot(...delta),
        t = delta.map((v) => v / L),
        c = cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]),
        u = c.map((v) => v / Math.hypot(...c)),
        v = cross(t, u),
        corners = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([s, q]) => p.map((x, i) => x + (s * u[i] * width) / 2 + (q * v[i] * depth) / 2)),
        aa = corners(a),
        bb = corners(b);
      f(
        role,
        aa,
        t.map((x) => -x),
      );
      f(role, bb, t);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          n = aa[i].map((x, k) => (x + aa[j][k]) / 2 - a[k]);
        f(
          role,
          [aa[i], aa[j], bb[j], bb[i]],
          n.map((x) => x / Math.hypot(...n)),
        );
      }
    },
    ring = r.body.outline;
  for (const p of r.posts)
    box(f, 'frame', ...[p.center[0], p.bottom, p.center[1]], 0.15, p.top - p.bottom, 0.15);
  for (const p of r.gangwaySupports)
    box(f, 'frame', p.center[0], p.bottom, p.center[1], 0.18, p.top - p.bottom, 0.18);

  for (let edge = 0; edge < 4; edge++) {
    const a = ring[edge],
      b = ring[(edge + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      t = b.map((x, i) => (x - a[i]) / L),
      n = [-t[1], t[0]],
      S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], Y + y, a[1] + u * t[1] + d * n[1]],
      spans =
        edge === 0
          ? [
              [0, L / 2 - 0.53],
              [L / 2 + 0.53, L],
            ]
          : [[0, L]];
    // A narrow perimeter walk leaves the actual pond exposed throughout the center.
    beam('deck', S(0, -0.055, -0.225), S(L, -0.055, -0.225), 0.45, 0.11);
    for (const [lo, hi] of spans) {
      beam('wattle', S(lo, 1.375), S(hi, 1.375), 0.1, 1.95);
      beam('frame', S(lo, 0.33, -0.015), S(hi, 0.33, -0.015), 0.07, 0.09);
      beam('frame', S(lo, 2.36, -0.015), S(hi, 2.36, -0.015), 0.07, 0.07);
      if (detail) {
        const count = Math.ceil((hi - lo) / (detail === 1 ? 0.7 : 0.4));
        for (let i = 0; i <= count; i++) {
          const u = lo + ((hi - lo) * i) / count;
          beam('frame', S(u, -0.25, -0.018), S(u, 2.65, -0.018), 0.035, 0.035);
        }
        // Closed diagonal timber braces under the screens read from the pond side.
        beam('frame', S(lo + 0.12, -0.55, -0.06), S(Math.min(hi, lo + 1.1), 0.33, -0.06), 0.065);
      }
      if (detail >= 2) {
        const courses = detail === 3 ? 12 : 8,
          sections = Math.ceil((hi - lo) / (detail === 3 ? 1 : 1.5));
        for (let row = 0; row < courses; row++)
          for (let i = 0; i < sections; i++) {
            const u0 = lo + ((hi - lo) * i) / sections,
              u1 = lo + ((hi - lo) * (i + 1)) / sections,
              y = 0.49 + (row * 1.77) / (courses - 1),
              d0 = 0.065 + ((i + row) % 2) * 0.02,
              d1 = 0.065 + ((i + row + 1) % 2) * 0.02;
            beam('wattle', S(u0, y, d0), S(u1, y + 0.012, d1), 0.035, 0.035);
          }
      }
    }
    // Sparse plank seams are geometry only at the two near levels.
    if (detail >= 2)
      for (let u = 0.38; u < L; u += 0.4)
        beam('deck', S(u, 0.002, -0.04), S(u, 0.002, -0.41), 0.015, 0.012);
  }
  // A timber leaf stands open beside the short-end doorway, leaving its center clear.
  box(f, 'deck', r.x0 - 0.5, Y + 0.05, r.doorZ - 0.56, 1, 2.2, 0.045);
  if (detail) {
    for (const height of [0.3, 2.02])
      box(f, 'frame', r.x0 - 0.5, Y + height, r.doorZ - 0.6, 1, 0.09, 0.06);
    beam(
      'frame',
      [r.x0 - 0.94, Y + 0.3, r.doorZ - 0.63],
      [r.x0 - 0.06, Y + 2.08, r.doorZ - 0.63],
      0.065,
    );
  }
  const start = [r.gangwayStart[0], r.gangwayStartY - 0.055, r.gangwayStart[1]],
    landingEnd = [r.stairStartX, r.gangwayStartY - 0.055, r.doorZ];
  beam('deck', start, landingEnd, r.gangwayWidth, 0.11);
  for (const step of r.gangwaySteps)
    box(
      f,
      'deck',
      (step.x0 + step.x1) / 2,
      step.top - 0.11,
      r.doorZ,
      step.x1 - step.x0,
      0.11,
      r.gangwayWidth,
    );
  for (const side of [-1, 1]) {
    const z = r.doorZ + side * 0.3;
    beam(
      'frame',
      [r.gangwayStart[0], r.gangwayStartY - 0.18, z],
      [r.stairStartX, r.gangwayStartY - 0.18, z],
      0.1,
      0.16,
    );
    beam(
      'frame',
      [r.stairStartX, r.gangwaySteps[0].top - 0.17, z],
      [r.gangwayEnd[0], Y - 0.17, z],
      0.1,
      0.16,
    );
  }
  if (detail) {
    // Reconstructed bathing ladder descends inside the pool; no invented floor underneath.
    const x = r.x1 - 0.8,
      z = r.z1 - 0.6;
    for (const side of [-1, 1])
      beam(
        'frame',
        [x + side * 0.26, Y + 0.45, z + 0.25],
        [x + side * 0.26, r.waterY - 0.8, z - 0.2],
        0.07,
      );
    for (let i = 0; i < 5; i++) {
      const q = (i + 0.5) / 5,
        y = Y + 0.2 - q * 1.1,
        zz = z + 0.16 - q * 0.4;
      beam('frame', [x - 0.26, y, zz], [x + 0.26, y, zz], 0.055);
    }
  }
  if (detail >= 2)
    for (let u = 0.4; u < r.bankLandingLength; u += 0.4) {
      const x = r.gangwayStart[0] + u,
        z = r.doorZ,
        y = r.gangwayStartY + 0.002;
      beam(
        'deck',
        [x - 0.44 * r.gangwayZ[0], y, z - 0.44 * r.gangwayZ[1]],
        [x + 0.44 * r.gangwayZ[0], y, z + 0.44 * r.gangwayZ[1]],
        0.015,
        0.012,
      );
    }
}
