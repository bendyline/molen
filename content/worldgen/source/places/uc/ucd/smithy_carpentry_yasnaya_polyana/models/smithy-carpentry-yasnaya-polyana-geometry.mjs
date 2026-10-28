/** Log workshop, timber hood and an actually open side canopy on the mapped envelope. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildSmithy(face, detail, r) {
  const Y = r.floorY,
    H = 2.55,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    ring = r.body.outline;
  prism(f, 'brick', r.body, r.foundationY, Y);
  Q(
    'wall',
    ring.map(([x, z]) => [x, H, z]),
    [0, 1, 0],
  );
  for (let edge = 0; edge < ring.length; edge++) {
    const a = ring[edge],
      b = ring[(edge + 1) % ring.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      t = b.map((v, i) => (v - a[i]) / L),
      n = [-t[1], 0, t[0]],
      S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], y, a[1] + u * t[1] + d * n[2]],
      door = edge === 2 ? { u: L / 2, width: 2.3, bottom: 0, top: 2.12 } : null;
    const us = door ? [0, door.u - door.width / 2, door.u + door.width / 2, L] : [0, L],
      courses = detail >= 3 ? 11 : 6,
      ys = [
        ...new Set([
          0,
          H,
          ...(detail >= 2 ? Array.from({ length: courses + 1 }, (_, i) => (i * H) / courses) : []),
          ...(door ? [door.top] : []),
        ]),
      ].sort((a, b) => a - b);
    for (let i = 0; i < us.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const u0 = us[i],
          u1 = us[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1];
        if (door && i === 1 && y1 <= door.top) continue;
        if (detail >= 2) {
          const ym = (y0 + y1) / 2;
          Q('wall', [S(u0, y0), S(u1, y0), S(u1, ym, 0.055), S(u0, ym, 0.055)], n);
          Q('wall', [S(u0, ym, 0.055), S(u1, ym, 0.055), S(u1, y1), S(u0, y1)], n);
        } else Q('wall', [S(u0, y0), S(u1, y0), S(u1, y1), S(u0, y1)], n);
      }
    if (door) {
      const left = door.u - door.width / 2,
        right = door.u + door.width / 2,
        d = -0.24;
      Q('wood', [S(left, 0, d), S(right, 0, d), S(right, door.top, d), S(left, door.top, d)], n);
      Q(
        'trim',
        [S(left, 0), S(left, door.top), S(left, door.top, d), S(left, 0, d)],
        [t[0], 0, t[1]],
      );
      Q(
        'trim',
        [S(right, 0, d), S(right, door.top, d), S(right, door.top), S(right, 0)],
        [-t[0], 0, -t[1]],
      );
      Q(
        'trim',
        [S(left, door.top), S(right, door.top), S(right, door.top, d), S(left, door.top, d)],
        [0, -1, 0],
      );
      Q('brick', [S(left, 0, d), S(right, 0, d), S(right, 0), S(left, 0)], [0, 1, 0]);
      if (detail) {
        const band = (u0, u1, y0, y1, depth = 0.055) =>
          Q('trim', [S(u0, y0, depth), S(u1, y0, depth), S(u1, y1, depth), S(u0, y1, depth)], n);
        band(left - 0.09, left + 0.025, 0, door.top + 0.1);
        band(right - 0.025, right + 0.09, 0, door.top + 0.1);
        band(left - 0.09, right + 0.09, door.top - 0.02, door.top + 0.1);
        band(door.u - 0.025, door.u + 0.025, 0.02, door.top - 0.05, -0.22);
        if (detail >= 2)
          for (const y of [0.32, 1.75]) band(left + 0.12, right - 0.12, y, y + 0.07, -0.22);
      }
    }
  }
  // Weathered board hip roof follows the enclosed main range; the long rear is map-derived.
  const x0 = r.bodyX0 - 0.3,
    x1 = r.bodyX1 + 0.3,
    z0 = r.backZ - 0.3,
    z1 = r.frontZ + 0.3,
    xc = (x0 + x1) / 2,
    inset = (x1 - x0) / 2,
    A = [xc, H + 2.2, z0 + inset],
    C = [xc, H + 2.2, z1 - inset],
    q = [
      [x0, H, z0],
      [x1, H, z0],
      [x1, H, z1],
      [x0, H, z1],
    ];
  Q('roof', [q[0], q[1], A], [0, 1, -1]);
  Q('roof', [q[1], q[2], C, A], [1, 1, 0]);
  Q('roof', [q[2], q[3], C], [0, 1, 1]);
  Q('roof', [q[3], q[0], A, C], [-1, 1, 0]);
  Q('roof', q, [0, -1, 0]);
  B('brick', 3, 4, 1.5, 0.55, 1.25, 0.55);
  B('brick', 3, 5.25, 1.5, 0.68, 0.13, 0.66);
  // The left lean-to has only posts, beams and a thin roof: no wall or ground slab closes it.
  const c = r.canopy,
    roofY = (x) => 2.2 + ((x - c.x0) / (c.x1 - c.x0)) * 0.25,
    corners = [
      [c.x0, roofY(c.x0), c.z0],
      [c.x1, roofY(c.x1), c.z0],
      [c.x1, roofY(c.x1), c.z1],
      [c.x0, roofY(c.x0), c.z1],
    ],
    under = corners.map(([x, y, z]) => [x, y - 0.09, z]);
  Q('canopy', corners, [0, 1, 0]);
  Q('canopy', under, [0, -1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      'canopy',
      [under[i], under[j], corners[j], corners[i]],
      [corners[j][2] - corners[i][2], 0, corners[i][0] - corners[j][0]],
    );
  }
  for (const p of r.posts)
    prism(f, 'trim', { outline: p.outline, holes: [] }, r.foundationY, Y + p.top);
  if (detail) {
    for (const x of [c.x0 + 0.09, c.x1 - 0.09])
      B('trim', x, roofY(x) - 0.19, (c.z0 + c.z1) / 2, 0.14, 0.16, c.z1 - c.z0);
    for (const z of [c.z0 + 0.12, 0, c.z1 - 0.12]) {
      const a = [c.x0, roofY(c.x0) - 0.1, z],
        b = [c.x1, roofY(c.x1) - 0.1, z],
        ring = [
          [a[0], a[1] - 0.12, z - 0.055],
          [b[0], b[1] - 0.12, z - 0.055],
          [b[0], b[1], z - 0.055],
          [a[0], a[1], z - 0.055],
        ];
      Q('trim', ring, [0, 0, -1]);
      Q(
        'trim',
        ring.map(([x, y]) => [x, y, z + 0.055]),
        [0, 0, 1],
      );
      for (const [i, j, n] of [
        [0, 1, [0, -1, 0]],
        [1, 2, [1, 0, 0]],
        [2, 3, [0, 1, 0]],
        [3, 0, [-1, 0, 0]],
      ])
        Q(
          'trim',
          [
            ring[i],
            ring[j],
            [ring[j][0], ring[j][1], z + 0.055],
            [ring[i][0], ring[i][1], z + 0.055],
          ],
          n,
        );
    }
  }
  // Closed shallow door hood with two timber supports; the entry apron meets the recess.
  const h = r.hood,
    ps = [
      [h.x0, 2.45, r.frontZ - 0.04],
      [h.x1, 2.45, r.frontZ - 0.04],
      [h.x1, 2.25, h.z1],
      [h.x0, 2.25, h.z1],
    ],
    low = ps.map(([x, y, z]) => [x, y - 0.08, z]);
  Q('canopy', ps, [0, 1, 0]);
  Q('canopy', low, [0, -1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q('canopy', [low[i], low[j], ps[j], ps[i]], [ps[j][2] - ps[i][2], 0, ps[i][0] - ps[j][0]]);
  }
  for (const a of r.aprons) prism(f, 'brick', { outline: a.outline, holes: [] }, a.base, a.top);
  if (detail >= 2) {
    for (let i = 0; i < 11; i++)
      for (const [x, z] of ring) B('wall', x, ((i + 0.5) * H) / 11 - 0.08, z, 0.2, 0.16, 0.2);
    for (const x of [h.x0, h.x1])
      B('trim', x, 2.05, (r.frontZ + h.z1) / 2, 0.1, 0.1, h.z1 - r.frontZ);
  }
}
