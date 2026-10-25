/** dendera_temple_complex: southwest Hathor kiosk, mapped roof rooms and the upper terrace stair. */
import {
  denderaBox as box,
  denderaCavetto as cavetto,
  denderaColumn as column,
} from './dendera-temple-model.mjs';
export const denderaRoofCandidateId = 'dendera_temple_complex';
function translated(face, x, y, z, scale = 1) {
  return (role, ps, n) =>
    face(
      role,
      ps.map(([u, v, w]) => [x + u * scale, y + v * scale, z + w * scale]),
      n,
    );
}
export function buildDenderaRoof(face, detail, r) {
  if (!r.roofParts) return;
  const base = r.roofDeckY;
  for (const part of r.roofParts) {
    const [x, z] = part.center,
      w = part.width,
      d = part.depth;
    if (part.kind === 'six-column-Hathor-kiosk') {
      box(face, 'stone', x, base, z, w, 0.18, d);
      const scale = 0.28,
        f = translated(face, x, base + 0.18, z, scale),
        xs = [-(w / 2 - 0.55) / scale, (w / 2 - 0.55) / scale],
        zs = detail === 0 ? [0] : [-(d / 2 - 0.55), 0, d / 2 - 0.55];
      for (const v of zs)
        for (const u of xs) {
          if (detail === 0) box(face, 'stone', x + u * scale, base + 0.18, z + v, 0.75, 4.34, 0.75);
          else column(f, u, v / scale, detail === 1 ? 0 : detail === 2 ? 1 : 3, true);
        }
      const roof = base + 0.18 + 15.5 * scale;
      box(face, 'stone', x, roof, z, w + 0.35, 0.55, d + 0.35);
      if (detail === 0) continue;
      for (const side of [-1, 1]) {
        box(
          face,
          'stone',
          x + side * (w / 4 + 0.22),
          base + 0.18,
          z + d / 2 - 0.3,
          w / 2 - 0.75,
          1.45,
          0.6,
        );
        box(face, 'stone', x + side * (w / 2 - 0.3), base + 0.18, z, 0.6, 1.45, d - 0.5);
      }
      box(face, 'stone', x, base + 0.18, z - d / 2 + 0.3, w, 1.45, 0.6);
      if (detail >= 2) {
        for (const side of [-1, 1]) {
          box(face, 'stone', x + side * 0.63, base + 0.18, z + d / 2 - 0.25, 0.35, 2.1, 0.75);
          cavetto(face, x + side * 0.63, base + 2.28, z + d / 2 - 0.25, 0.35, 0.75, 1);
        }
      }
    } else {
      const h = part.estimatedWallHeight;
      if (detail <= 1) {
        box(face, 'stone', x, base, z, w, h, d);
        continue;
      }
      box(face, 'stone', x, base, z, w, 0.12, d);
      const t = 0.6;
      for (const side of [-1, 1]) box(face, 'stone', x + side * (w / 2 - t / 2), base, z, t, h, d);
      box(face, 'stone', x, base, z - d / 2 + t / 2, w, h, t);
      for (const side of [-1, 1])
        box(face, 'stone', x + side * (w / 4 + 0.5), base, z + d / 2 - t / 2, w / 2 - 1, h, t);
      box(face, 'stone', x, base + 2.0, z + d / 2 - t / 2, 2, h - 2, t);
      // Room roofs retain the mapped small masses, with visible door recesses.
      box(face, 'stone', x, base + h, z, w, 0.3, d);
      if (detail >= 2) cavetto(face, x, base + h + 0.3, z, w, d, 1);
    }
  }
  if (detail >= 1) {
    for (const side of [-1, 1])
      box(
        face,
        'stone',
        side * (r.backWidth / 2 - 0.3),
        base,
        -r.frontDepth - r.backDepth / 2,
        0.6,
        0.75,
        r.backDepth,
      );
    box(face, 'stone', 0, base, -r.frontDepth - r.backDepth + 0.3, r.backWidth, 0.75, 0.6);
  }
  const x0 = -15,
    run = 11,
    rise = 18.35 - base,
    count = detail === 0 ? 1 : detail === 1 ? 6 : detail === 2 ? 14 : 21;
  for (let i = 0; i < count; i++)
    box(
      face,
      'stone',
      x0 + ((i + 0.5) * run) / count,
      base,
      -25.8,
      run / count,
      (rise * (i + 1)) / count,
      1.6,
    );
  if (detail >= 3) {
    for (const x of [x0, x0 + run])
      box(face, 'metal', x, base + ((x - x0) / run) * rise, -24.85, 0.12, 1.0, 0.12);
    const a = [x0, base + 1, -24.85],
      b = [x0 + run, base + rise + 1, -24.85],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy),
      u = [(-dy / length) * 0.06, (dx / length) * 0.06, 0];
    const ps = [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([s, t]) => [a[0] + s * u[0], a[1] + s * u[1], a[2] + t * 0.06]);
    const qs = ps.map((p) => [p[0] + dx, p[1] + dy, p[2]]);
    face('metal', ps, [-dx, -dy, 0]);
    face('metal', qs, [dx, dy, 0]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(
        'metal',
        [ps[i], ps[j], qs[j], qs[i]],
        [i === 0 ? 1 : i === 2 ? -1 : 0, 0, i === 1 ? 1 : i === 3 ? -1 : 0],
      );
    }
  }
}
