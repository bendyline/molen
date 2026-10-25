/** Shared metric grade interpolation and sealed, split-edge floors for terrain-specific landmarks. */
import { prism } from './khmer-structure-geometry.mjs';

export function sampleLandmarkGrade(r, x, z) {
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

export function buildGradedLandmarkFloor(face, r, split = true) {
  const grade = (x, z) => sampleLandmarkGrade(r, x, z),
    emit = (role, points, normal) =>
      face(
        role,
        points.map(([x, y, z]) => [x, y + grade(x, z), z]),
        normal,
      );
  if (!split) {
    for (const p of r.body) prism(emit, 'floor', p, -2.5, 0.08);
    return;
  }
  const boundary = r.body
      .flatMap((p) => [p.outline, ...p.holes])
      .flatMap((ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]])),
    onBoundary = ([x, z]) =>
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
        if (Math.abs(normal[1]) > 0.5) emit(role, points, normal);
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
        if (onBoundary([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]))
          emit(
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
