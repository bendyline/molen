/** 'visitors_centre_yad_vashem': pale square frame, recessed colonnades and notched car-park entrance. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYadVisitors(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    poly = (outline) => ({ outline, holes: [] }),
    rectangle = (center, u, n, width, depth) =>
      poly(
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([a, b]) =>
          center.map((v, k) => v + (u[k] * a * width) / 2 + (n[k] * b * depth) / 2),
        ),
      ),
    post = (role, center, u, n, width, depth, lo, hi) =>
      prism(f, role, rectangle(center, u, n, width, depth), lo, hi, true);

  prism(f, 'floor', poly(r.outer), r.foundationY, Y, true);
  prism(f, 'glass', poly(r.inner), Y + 0.02, Y + 7.4, true);
  prism(f, 'concrete', poly(r.outer), Y + 7.4, Y + 8.45, true);
  for (const p of r.upperRoof) prism(f, 'concrete', p, Y + 8.45, Y + 9.2, true);
  for (const p of r.roofPanels) prism(f, 'roof', p, Y + 9.205, Y + 9.235, true);

  // Shared corner piers are solid, rather than overlapping full edge members.
  for (let i = 0; i < 4; i++) {
    const p = r.outer[i],
      prev = r.sides[(i + 3) % 4].u.map((v) => -v),
      next = r.sides[i].u,
      w = 1.6;
    prism(
      f,
      'concrete',
      poly([
        p,
        p.map((v, k) => v + prev[k] * w),
        p.map((v, k) => v + prev[k] * w + next[k] * w),
        p.map((v, k) => v + next[k] * w),
      ]),
      Y,
      Y + 7.4,
      true,
    );
  }
  for (const side of r.sides) {
    for (let j = 1; j < 6; j++) {
      const center = side.a.map((v, k) => v + (side.u[k] * side.length * j) / 6 - side.n[k] * 0.9);
      post('concrete', center, side.u, side.n, 1.1, 1.8, Y, Y + 7.4);
    }
  }
  // The entrance notch is backed by inset glass; it is not an open hole in the roof.
  box(f, 'glass', 11.3, Y + 7.4, 2.3, 0.1, 1.75, 4.6);
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const a = r.inner[i],
        b = r.inner[(i + 1) % 4],
        side = r.sides[i],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.ceil(L / (detail === 1 ? 3.2 : 1.35)),
        w = detail === 1 ? 0.18 : 0.1;
      for (let j = 0; j <= count; j++) {
        const center = a.map((v, k) => v + ((b[k] - v) * j) / count + side.n[k] * 0.06);
        post('metal', center, side.u, side.n, w, 0.14, Y + 0.06, Y + 7.35);
      }
      for (let y = 1.65; y < 7.35; y += detail === 1 ? 3.3 : 1.65) {
        const center = a.map((v, k) => (v + b[k]) / 2 + side.n[k] * 0.065);
        post('metal', center, side.u, side.n, L, 0.14, Y + y, Y + y + w);
      }
    }
    // Closed car-park doors sit behind the east colonnade, below the fascia notch.
    for (const z of [1.05, 2.3, 3.55]) box(f, 'metal', 12.08, Y + 0.06, z, 0.16, 2.65, 0.12);
    box(f, 'metal', 12.08, Y + 2.65, 2.3, 0.16, 0.12, 2.62);
    box(f, 'metal', 11.39, Y + 8.48, 2.3, 0.12, 0.12, 4.6);
  }

  // Exact clipped, merged lattice preserves the entrance notch at every level.
  const w = detail === 0 ? 0.38 : detail === 1 ? 0.23 : 0.14;
  for (const p of r.roofBars[detail]) prism(f, 'metal', p, Y + 9.225, Y + 9.225 + w, true);
  // A selected end bay carries louvres; distant levels retain a broad muted panel.
  if (detail < 2) box(f, 'screen', 10.6, Y + 0.15, 11.94, 2.6, 7.1, 0.08);
  else for (let x = 9.3; x < 11.95; x += 0.3) box(f, 'screen', x, Y + 0.15, 11.96, 0.12, 7.1, 0.15);
}
