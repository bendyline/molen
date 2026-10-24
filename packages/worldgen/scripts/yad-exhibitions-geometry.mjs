/** 'exhibitions_pavilion_yad_vashem': open court, stair-pierced end wall and curved planted wing. */
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYadExhibitions(face, detail, r) {
  const Y = r.floorY;
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]];
  const f = (role, ps, n) => face(role, ps.map(P), P(n));
  const curve = (x) => {
    const t = Math.max(0, Math.min(1, (x - 10) / 7));
    return 3 + 0.0045 * (x + 20) * (x + 20) + 4.7 * t * t * (3 - 2 * t);
  };
  const height = (x) => 0.32 + ((x + 20.22) / 37.22) * 6.36;
  const strip = (x1, x2, offset, width) => ({
    outline: [
      [x1, curve(x1) + offset - width / 2],
      [x2, curve(x2) + offset - width / 2],
      [x2, curve(x2) + offset + width / 2],
      [x1, curve(x1) + offset + width / 2],
    ],
    holes: [],
  });
  function slope(role, p, low, high) {
    const rings = [p.outline, ...p.holes],
      flat = rings.flat(),
      holes = [];
    let k = rings[0].length;
    for (const h of rings.slice(1)) {
      holes.push(k);
      k += h.length;
    }
    const ix = earcut(flat.flat(), holes),
      lo = flat.map(([x, z]) => [x, low(x), z]),
      hi = flat.map(([x, z]) => [x, high(x), z]);
    for (let i = 0; i < ix.length; i += 3) {
      f(
        role,
        ix.slice(i, i + 3).map((k) => lo[k]),
        [0, -1, 0],
      );
      f(
        role,
        ix.slice(i, i + 3).map((k) => hi[k]),
        [0, 1, 0],
      );
    }
    let o = 0;
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri],
        area = ring.reduce(
          (s, p, i) =>
            s + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
          0,
        ),
        sign = Math.sign(area) * (ri ? -1 : 1);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        f(
          role,
          [lo[o + i], lo[o + j], hi[o + j], hi[o + i]],
          [(ring[j][1] - ring[i][1]) * sign, 0, (ring[i][0] - ring[j][0]) * sign],
        );
      }
      o += ring.length;
    }
  }
  // Only occupied volumes have foundations. The original courtyard stays completely open.
  for (const p of r.end) prism(f, 'floor', p, r.foundationY, Y, true);
  for (const band of r.bands)
    for (const p of band.polygons) prism(f, 'concrete', p, Y + band.lo, Y + band.hi, true);
  for (const p of r.wing)
    slope(
      'concrete',
      p,
      () => r.foundationY,
      (x) => Y + height(x),
    );
  for (const p of r.planted)
    slope(
      'planting',
      p,
      (x) => Y + height(x) + 0.015,
      (x) => Y + height(x) + 0.065,
    );

  const count = [10, 24, 36, 44][detail];
  for (let i = 0; i < count; i++) {
    const x1 = -19.6 + (36.4 * i) / count,
      x2 = -19.6 + (36.4 * (i + 1)) / count;
    prism(f, 'floor', strip(x1, x2, 1.1, 1.7), Y + height(x1) - 0.1, Y + height(x2) + 0.08, true);
  }
  // One closed sweep per guard follows the same stations as its stair treads.
  // Adjacent sections share their ends; internal caps would add hidden geometry.
  for (const offset of [0.12, 2.08]) {
    const sections = Array.from({ length: count + 1 }, (_, i) => {
      const x = -19.6 + (36.4 * i) / count,
        z = curve(x) + offset,
        lo = Y + height(x) - 0.05,
        hi = Y + height(x) + 0.7;
      return [
        [x, lo, z - 0.09],
        [x, lo, z + 0.09],
        [x, hi, z + 0.09],
        [x, hi, z - 0.09],
      ];
    });
    for (let i = 0; i < count; i++)
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4,
          n = [
            [0, -1, 0],
            [0, 0, 1],
            [0, 1, 0],
            [0, 0, -1],
          ][k];
        f('concrete', [sections[i][k], sections[i + 1][k], sections[i + 1][j], sections[i][j]], n);
      }
    f('concrete', sections[0], [-1, 0, 0]);
    f('concrete', sections.at(-1), [1, 0, 0]);
  }
  // A true upper notch and smaller window show separate stair flights through the wall.
  const upper = [4, 8, 10, 14][detail];
  for (let i = 0; i < upper; i++) {
    const x1 = 17 + (4.2 * i) / upper,
      x2 = 17 + (4.2 * (i + 1)) / upper;
    box(f, 'floor', (x1 + x2) / 2, Y + 4.39, -12.3, x2 - x1, (2.41 * (i + 1)) / upper, 3.25);
  }
  const windowSteps = [3, 5, 7, 9][detail];
  for (let i = 0; i < windowSteps; i++) {
    const z1 = 5.1 + (2.2 * i) / windowSteps,
      z2 = 5.1 + (2.2 * (i + 1)) / windowSteps;
    box(f, 'floor', 18.2, Y + 2.1, (z1 + z2) / 2, 1.75, (2.5 * (i + 1)) / windowSteps, z2 - z1);
  }
  // The main portal is recessed in the -X wall, with closed doors behind the threshold.
  box(f, 'glass', 20.77, Y + 0.03, -6.8, 0.05, 4.17, 3.9);
  if (detail) {
    for (const z of [-8.68, -6.8, -4.92]) box(f, 'metal', 20.72, Y + 0.04, z, 0.09, 4.14, 0.1);
    box(f, 'metal', 20.72, Y + 4.1, -6.8, 0.09, 0.1, 3.85);
    box(f, 'banner', 16.96, Y + 0.3, -9.7, 0.07, 4.45, 0.65);
    box(f, 'floor', 16.91, Y + 3.7, -9.7, 0.025, 0.3, 0.65);
    if (detail >= 2) box(f, 'metal', 20.68, Y + 1.2, -6.8, 0.09, 0.1, 3.8);
    if (detail === 3)
      for (const z of [-7.35, -6.25]) box(f, 'metal', 20.61, Y + 1, z, 0.1, 0.55, 0.09);
  }
}
