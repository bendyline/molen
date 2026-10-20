/** Three re-erected Venus Genetrix columns and their mapped low surviving remains. */
import { buildCorinthianColumn } from './corinthian-column-geometry.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';
export const venusGenetrixCandidateId = 'N0532';

function scroll(f, x, y, z, side, detail) {
  const n = detail === 3 ? 22 : 14,
    ps = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1),
        a = t * Math.PI * 3.1,
        r = 0.41 * (1 - t) + 0.05;
      return [x + r * Math.cos(a), y + r * Math.sin(a), z];
    });
  for (let i = 0; i < n - 1; i++) {
    const a = ps[i],
      b = ps[i + 1],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      c = dx / len,
      s = dy / len;
    box(
      (role, points, n) =>
        f(
          role,
          points.map(([u, v, w]) => [a[0] + c * u - s * v, a[1] + s * u + c * v, z + side * w]),
          [c * n[0] - s * n[1], s * n[0] + c * n[1], side * n[2]],
        ),
      'column',
      len / 2,
      -0.035,
      0.04,
      len,
      0.07,
      0.08,
    );
  }
}
function hoop(f, x, z, Y, detail, radius) {
  const n = [8, 12, 20, 28][detail],
    outer = Array.from({ length: n }, (_, i) => [
      x + (radius + 0.04) * Math.cos((i * 2 * Math.PI) / n),
      z + (radius + 0.04) * Math.sin((i * 2 * Math.PI) / n),
    ]),
    inner = Array.from({ length: n }, (_, i) => [
      x + (radius - 0.02) * Math.cos((i * 2 * Math.PI) / n),
      z + (radius - 0.02) * Math.sin((i * 2 * Math.PI) / n),
    ]).toReversed();
  prism(f, 'metal', { outline: outer, holes: [inner] }, Y, Y + 0.075);
}
export function buildVenusGenetrixRemnants(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (u, v) => sampleTerrain(c * u - s * v, s * u + c * v),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    ground = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u, grade(u, v) + y, v]),
        n,
      );
  for (const part of r.fragments)
    for (const p of part.localPolygons) prism(ground, 'core', p, -0.65, part.height);
  const beamControl = r.controls.find((p) => p.id === r.beamId);
  for (const p of beamControl.localPolygons)
    prism(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, y === 0 ? grade(x, z) - 0.65 : r.floorY, z]),
          n,
        ),
      'core',
      p,
      0,
      1,
    );
  for (const [i, [x, z]] of r.columns.entries()) {
    box(f, 'core', x, r.foundationBase, z, 1.8, r.floorY - r.foundationBase, 1.8);
    buildCorinthianColumn(
      (role, ps, n) => {
        const mean = (ps.reduce((sum, p) => sum + p[1], 0) / ps.length) * r.columnScaleY;
        if (
          role === 'shaft' &&
          ((i === 1 && mean > 2.6 && mean < 5.3) || (i !== 1 && mean > 5.2 && mean < 8.2))
        )
          role = 'column';
        f(
          role,
          ps.map(([u, y, v]) => [
            x + u * r.columnScaleXZ,
            r.floorY + y * r.columnScaleY,
            z + v * r.columnScaleXZ,
          ]),
          [n[0] / r.columnScaleXZ, n[1] / r.columnScaleY, n[2] / r.columnScaleXZ],
        );
      },
      0,
      0,
      detail,
      0,
    );
    if (detail >= 1 && i !== 1)
      for (const Y of r.repairBands)
        hoop(
          f,
          x,
          z,
          r.floorY + Y,
          detail,
          0.68 *
            (Y < 5.25
              ? 0.77
              : Y < 8.1
                ? 0.77 - ((Y - 5.25) / 2.85) * 0.06
                : 0.71 - ((Y - 8.1) / 1.8) * 0.05),
        );
  }
  const Y = r.floorY,
    b = r.beam,
    [x, z] = b.center;
  for (const [y, h, d] of detail === 0
    ? [
        [11.4, 0.6, 1.4],
        [12, 0.95, 1.55],
        [12.95, 0.35, 1.9],
      ]
    : [
        [11.4, 0.18, 1.35],
        [11.58, 0.18, 1.5],
        [11.76, 0.24, 1.63],
        [12, 0.93, 1.66],
        [12.93, 0.15, 1.8],
        [13.08, 0.22, 1.97],
      ])
    box(f, 'column', x, Y + y, z, b.length, h, d);
  // The conspicuously broken upper cornice has three surviving projecting masses.
  for (const [i, u] of [0.7, 3.9, 7.2].entries())
    loft(
      (role, points, n) =>
        f(
          role,
          points.map(([xx, y, zz]) => [
            xx,
            y + (y > Y + 13.4 ? 0.12 * Math.sin(xx * 2.6 + zz * 1.9 + i) : 0),
            z + 0.12 + (zz - z - 0.12) * 1.15,
          ]),
          n,
        ),
      'column',
      u,
      z + 0.12,
      [
        [Y + 13.3, 1.4],
        [Y + 13.65, 1.9],
        [Y + 14.15 + (i === 0 ? 0.22 : i === 1 ? 0 : -0.13), 1.55],
      ],
      true,
    );
  prism(
    (role, ps, n) =>
      f(
        role,
        ps.map(([xx, y, zz]) => [xx, y + (y > Y + 13.4 ? 0.16 * Math.sin(xx * 1.7 + zz) : 0), zz]),
        n,
      ),
    'core',
    rect(x, z - 0.48, b.length, 0.72),
    Y + 13.3,
    Y + 14.1,
  );
  if (detail >= 2) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++)
        scroll(f, 0.5 + k * 1.38, Y + 12.46, z + side * 0.85, side, detail);
      for (let k = 0; k < 19; k++)
        box(f, 'column', -0.05 + k * 0.46, Y + 12.96, z + side * 0.92, 0.16, 0.16, 0.15);
    }
  }
}
