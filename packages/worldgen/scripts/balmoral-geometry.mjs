/** 'balmoral_castle': Balmoral's mapped connected ranges, clock tower and Baronial roofline. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildBalmoral(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    N = detail === 3 ? 16 : detail === 2 ? 12 : detail === 1 ? 8 : 6;
  function cylinder(role, x, z, lo, hi, r0, r1 = r0, n = N) {
    const rings = [lo, hi].map((y, k) =>
      Array.from({ length: n }, (_, i) => [
        x + (k ? r1 : r0) * Math.cos((i * Math.PI * 2) / n),
        y,
        z + (k ? r1 : r0) * Math.sin((i * Math.PI * 2) / n),
      ]),
    );
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f(
        role,
        [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
        [Math.cos(((i + 0.5) * Math.PI * 2) / n), 0, Math.sin(((i + 0.5) * Math.PI * 2) / n)],
      );
    }
    if (r0 > 0)
      for (let i = 1; i < n - 1; i++)
        f(role, [rings[0][0], rings[0][i], rings[0][i + 1]], [0, -1, 0]);
    if (r1 > 0)
      for (let i = 1; i < n - 1; i++)
        f(role, [rings[1][0], rings[1][i], rings[1][i + 1]], [0, 1, 0]);
  }
  function roof(x, z, w, d, lo, rise, alongX = true) {
    const g = (role, ps, n) =>
        f(
          role,
          ps.map(([a, y, b]) => (alongX ? [x + a, y, z + b] : [x + b, y, z + a])),
          alongX ? n : [n[2], n[1], n[0]],
        ),
      a = [-w / 2, lo, -d / 2],
      b = [w / 2, lo, -d / 2],
      c = [w / 2, lo, d / 2],
      e = [-w / 2, lo, d / 2],
      p = [-w / 2, lo + rise, 0],
      q = [w / 2, lo + rise, 0];
    g('roof', [a, b, q, p], [0, 1, -1]);
    g('roof', [p, q, c, e], [0, 1, 1]);
    g('wall', [a, p, e], [-1, 0, 0]);
    g('wall', [b, c, q], [1, 0, 0]);
    g('roof', [a, e, c, b], [0, -1, 0]);
  }
  function turret(x, z, base, height, radius, cone = 3, role = 'roof') {
    cylinder('wall', x, z, Y + base, Y + height, radius);
    if (detail) {
      cylinder('stone', x, z, Y + height - 0.65, Y + height - 0.25, radius + 0.12);
      cylinder('stone', x, z, Y + height - 0.25, Y + height + 0.12, radius + 0.22, radius + 0.12);
    }
    if (role === 'green' && detail) {
      const profile = [
        [0.12, radius + 0.23],
        [0.8, radius + 0.28],
        [2, radius],
        [3.3, radius * 0.57],
        [cone, radius * 0.05],
      ];
      for (let i = 0; i < profile.length - 1; i++)
        cylinder(
          role,
          x,
          z,
          Y + height + profile[i][0],
          Y + height + profile[i + 1][0],
          profile[i][1],
          profile[i + 1][1],
        );
    } else cylinder(role, x, z, Y + height + 0.12, Y + height + cone, radius + 0.23, 0);
  }
  const panel = (role, x0, x1, lo, hi, z) =>
    f(
      role,
      [
        [x0, lo, z],
        [x1, lo, z],
        [x1, hi, z],
        [x0, hi, z],
      ],
      [0, 0, 1],
    );
  function window(x, y, z, w, h, rotation = 0) {
    const co = Math.cos(rotation),
      si = Math.sin(rotation),
      g = (role, ps, n) =>
        f(
          role,
          ps.map(([u, v, d]) => [x + u * co + d * si, y + v, z - u * si + d * co]),
          [n[0] * co + n[2] * si, n[1], -n[0] * si + n[2] * co],
        ),
      pane = (role, x0, x1, lo, hi, d) =>
        g(
          role,
          [
            [x0, lo, d],
            [x1, lo, d],
            [x1, hi, d],
            [x0, hi, d],
          ],
          [0, 0, 1],
        );
    pane('glass', -w / 2, w / 2, 0, h, 0.025);
    if (detail > 1) {
      const t = 0.15;
      pane('stone', -w / 2 - t, w / 2 + t, -t, 0, 0.06);
      pane('stone', -w / 2 - t, w / 2 + t, h, h + t, 0.06);
      pane('stone', -w / 2 - t, -w / 2, 0, h, 0.06);
      pane('stone', w / 2, w / 2 + t, 0, h, 0.06);
      box(g, 'stone', 0, -0.18, 0.08, w + 0.45, 0.18, 0.24);
      pane('frame', -0.045, 0.045, 0, h, 0.07);
      pane('frame', -w / 2, w / 2, h * 0.48, h * 0.48 + 0.075, 0.07);
      if (detail === 3) pane('frame', -w / 2, w / 2, h * 0.76, h * 0.76 + 0.06, 0.07);
    }
  }
  function battlements(x, z, w, d, y) {
    for (const sign of [-1, 1]) {
      box(f, 'stone', x, Y + y, z + (sign * d) / 2, w, 0.6, 0.38);
      box(f, 'stone', x + (sign * w) / 2, Y + y, z, 0.38, 0.6, d);
    }
    if (!detail) return;
    const a = Math.max(2, Math.round(w / (detail === 1 ? 2.8 : 1.4))),
      b = Math.max(2, Math.round(d / (detail === 1 ? 2.8 : 1.4)));
    for (let i = 0; i <= a; i++)
      for (const sign of [-1, 1])
        box(f, 'stone', x - w / 2 + (i * w) / a, Y + y + 0.6, z + (sign * d) / 2, 0.75, 0.72, 0.5);
    for (let i = 1; i < b; i++)
      for (const sign of [-1, 1])
        box(f, 'stone', x + (sign * w) / 2, Y + y + 0.6, z - d / 2 + (i * d) / b, 0.5, 0.72, 0.75);
  }
  // The exact occupied floor seals the runtime ground cut while retaining the mapped courtyard.
  for (const p of r.floors) prism(f, 'wall', p, r.foundationY, Y, detail > 0);
  if (!detail) {
    box(f, 'wall', -31, Y, 21, 38, 11, 36);
    prism(
      f,
      'wall',
      {
        outline: [
          [-15, -31],
          [40, -31],
          [40, 1],
          [17, 1],
          [17, 17],
          [7, 17],
          [7, 14],
          [-14, 14],
          [-14, 1],
          [-15, 1],
        ],
        holes: [
          [
            [13, -20],
            [33, -20],
            [33, -9],
            [13, -9],
          ],
        ],
      },
      Y,
      Y + 6.5,
      false,
    );
    box(f, 'wall', 14, Y, 9.4, 12.6, 23, 14.8);
    for (const z of [8.6, 20.9, 33.2]) roof(-31, z, 38, 12.4, Y + 11, 4.6);
    roof(10, -26, 50, 10, Y + 6.5, 3.5);
    roof(37, -14, 34, 8, Y + 6.5, 3.2, false);
  } else {
    for (const band of r.bodyLevels)
      if (band.height !== 5) for (const p of band.polygons) prism(f, 'wall', p, Y, Y + band.height);
    for (const roof of r.roofPanels) {
      for (const t of roof.triangles)
        f(
          'roof',
          t.map(([x, y, z]) => [x, Y + y, z]),
          [0, 1, 0],
        );
      for (const ring of roof.edgeRings)
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length];
          if (Math.abs(a[1] - roof.base) + Math.abs(b[1] - roof.base) < 0.001) continue;
          f(
            'wall',
            [
              [a[0], Y + roof.base, a[2]],
              [b[0], Y + roof.base, b[2]],
              [b[0], Y + b[1], b[2]],
              [a[0], Y + a[1], a[2]],
            ],
            [b[2] - a[2], 0, a[0] - b[0]],
          );
        }
    }
  }
  // Long western residence and its supported round bartizans.
  for (const z of [3, 38.5]) turret(-50, z, 0, 13.2, 2.25, 4.8);
  for (const z of [14.5, 27.5]) turret(-50.6, z, 7.6, 12.8, 1.35, 3.2);
  for (const x of [-46.7, -39.4]) turret(x, 39.8, 7.4, 13.5, 1.25, 3.5);
  turret(-11.2, 38.6, 11, 17, 1.7, 4.4, 'green');
  // Clock tower: four corner cones and a circular observation crown.
  for (const x of [7.8, 19.3]) for (const z of [4, 16]) turret(x, z, 20, 25, 1.28, 4);
  cylinder('wall', 13.6, 10, Y + 23, Y + 26.6, 2.45);
  cylinder('stone', 13.6, 10, Y + 26.6, Y + 27.25, 2.75);
  if (detail)
    for (let i = 0; i < (detail === 1 ? 6 : 12); i++) {
      const a = (i * Math.PI * 2) / (detail === 1 ? 6 : 12);
      box(
        f,
        'stone',
        13.6 + 2.55 * Math.cos(a),
        Y + 27.25,
        10 + 2.55 * Math.sin(a),
        0.55,
        0.6,
        0.55,
      );
    }
  if (detail > 1) {
    cylinder('frame', 13.6, 10, Y + 27.2, Y + 32.2, 0.055, 0.045, 6);
    cylinder('stone', 13.6, 10, Y + 26.4, Y + 26.6, 2.85);
  }
  battlements(13.6, 10, 12.4, 13.3, 23);
  // South porte-cochere has a real arched recess, closed back and overhead masonry.
  const x0 = -46.78,
    x1 = -39.66,
    z0 = 39.39,
    z1 = 45.83,
    xc = (x0 + x1) / 2;
  if (!detail) box(f, 'wall', xc, Y, (z0 + z1) / 2, x1 - x0, 5, z1 - z0);
  else {
    box(f, 'wall', xc, Y, (z0 + z1 - 1.3) / 2, x1 - x0, 5, z1 - z0 - 1.3);
    const hole = [
        [-1.65, 0],
        [1.65, 0],
        [1.65, 2.8],
        ...Array.from({ length: 9 }, (_, i) => [
          1.65 * Math.cos((i * Math.PI) / 8),
          2.8 + 1.65 * Math.sin((i * Math.PI) / 8),
        ]),
        [-1.65, 0],
      ],
      q = {
        outline: [
          [-(x1 - x0) / 2, 0],
          [(x1 - x0) / 2, 0],
          [(x1 - x0) / 2, 5],
          [-(x1 - x0) / 2, 5],
        ],
        holes: [hole],
      },
      g = (role, ps, n) =>
        f(
          role,
          ps.map(([u, d, v]) => [xc + u, Y + v, z1 + d]),
          [n[0], n[2], n[1]],
        );
    prism(g, 'wall', q, -1.3, 0);
    const door = [
      [-1.65, Y],
      [1.65, Y],
      [1.65, Y + 2.8],
      ...Array.from({ length: 9 }, (_, i) => [
        1.65 * Math.cos((i * Math.PI) / 8),
        Y + 2.8 + 1.65 * Math.sin((i * Math.PI) / 8),
      ]),
    ];
    f(
      'door',
      door.map(([x, y]) => [xc + x, y, z1 - 1.29]),
      [0, 0, 1],
    );
    if (detail > 1) {
      for (let i = -2; i <= 2; i++)
        box(f, 'dark', xc + i * 0.55, Y + 0.1, z1 - 1.27, 0.055, 3.55, 0.035);
      box(f, 'dark', xc, Y + 1.4, z1 - 1.25, 3.1, 0.055, 0.055);
      box(f, 'dark', xc, Y + 2.8, z1 - 1.25, 3.1, 0.055, 0.055);
    }
  }
  battlements(xc, (z0 + z1) / 2, x1 - x0, z1 - z0, 5);
  for (let i = 0; i < 3; i++)
    box(f, 'stone', xc, Y - 0.66, z1 + 0.325 + (2 - i) * 0.65, 3.7, 0.22 * (i + 1), 0.65);
  // Main west-facing crow-step gables use thick, closed profiles.
  if (detail)
    for (const z of [8.6, 20.9, 33.2]) {
      const points = [
        [-6.2, 11],
        [6.2, 11],
      ];
      for (let i = 0; i < 6; i++) {
        const u = 6.2 - i * 1.03,
          h = 11 + (i + 1) * 0.77;
        points.push([u, h], [u - 1.03, h]);
      }
      for (let i = 0; i < 6; i++) {
        const u = -i * 1.03,
          h = 15.62 - i * 0.77;
        points.push([u, h], [u - 1.03, h]);
      }
      const g = (role, ps, n) =>
        f(
          role,
          ps.map(([u, d, v]) => [-50.4 + d, Y + v, z + u]),
          [n[1], n[2], n[0]],
        );
      prism(g, 'wall', { outline: points, holes: [] }, -0.12, 0.18);
    }
  if (detail) {
    for (const x of [-44, -30, -17]) {
      box(f, 'wall', x, Y + 12.5, 30.5, 1.3, 4.7, 1.5);
      box(f, 'stone', x, Y + 17.2, 30.5, 1.65, 0.3, 1.85);
    }
    for (const x of [-43, -31, -21]) {
      roof(x, 38.1, 5.2, 4, Y + 11.3, 3.5, false);
      panel('wall', x - 2.6, x + 2.6, Y + 9, Y + 11.3, 40.1);
      window(x, Y + 10, 40.12, 1.4, 2.0);
    }
    for (const y of [1.1, 4.9, 8.1]) {
      for (let x = -46; x <= -15; x += detail === 1 ? 8 : 4.6) window(x, Y + y, 39.55, 1.55, 2.4);
    }
    for (const y of [1.2, 6.4])
      for (let z = 6; z <= 36; z += detail === 1 ? 9 : 5.4)
        window(-50.3, Y + y, z, 1.85, 3.1, -Math.PI / 2);
    for (const y of [2, 6, 10, 14]) for (const x of [10, 17]) window(x, Y + y, 17.05, 1.05, 2.1);
    for (const y of [2, 6, 10, 14]) window(7.1, Y + y, 10, 1.05, 2.1, -Math.PI / 2);
    for (const z of [-28, -2])
      for (let x = -11; x < 40; x += 6.5) window(x, Y + 2, z, 1.0, 1.9, z < 0 ? Math.PI : 0);
    for (const x of [-15, 40])
      for (let z = -26; z < -4; z += 6)
        window(x, Y + 2, z, 1, 1.9, x < 0 ? -Math.PI / 2 : Math.PI / 2);
    for (const z of [4, 38.5])
      for (const y of [3, 7]) window(-52.27, Y + y, z, 1, 1.8, -Math.PI / 2);
    // Restrained continuous stone courses and window ledges.
    for (const y of [4.4, 7.7, 10.8]) {
      box(f, 'stone', -31, Y + y, 39.45, 38, 0.16, 0.22);
      box(f, 'stone', -50.4, Y + y, 21, 0.22, 0.16, 36);
    }
    for (const z of [3, 38.5, 14.5, 27.5])
      cylinder('stone', -50.3, z, Y + 10.5, Y + 10.8, z === 3 || z === 38.5 ? 2.42 : 1.5);
    if (detail > 1) {
      box(f, 'stone', 13.6, Y + 14, 17.7, 2.8, 0.23, 1.3);
      box(f, 'stone', 13.6, Y + 15.12, 18.28, 2.8, 0.12, 0.18);
      for (let i = 0; i < 5; i++)
        box(f, 'stone', 12.4 + i * 0.6, Y + 14.23, 18.28, 0.13, 0.9, 0.16);
      for (const x of [12.5, 14.7]) box(f, 'stone', x, Y + 13.35, 17.3, 0.3, 0.65, 0.55);
      const n = detail === 3 ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const x = 7.8 + (i * 11.6) / (n - 1),
          z = 4 + (i * 12) / (n - 1);
        for (const a of [3.1, 16.9]) box(f, 'stone', x, Y + 21.7, a, 0.28, 0.65, 0.42);
        for (const a of [6.9, 20.2]) box(f, 'stone', a, Y + 21.7, z, 0.42, 0.65, 0.28);
      }
    }
    // Static schematic clock faces: simple original ticks/hands, not a photographed dial.
    for (const side of ['south', 'west']) {
      const C = ([u, v, d]) =>
          side === 'south' ? [13.6 + u, Y + 18.2 + v, 17.1 + d] : [7.05 - d, Y + 18.2 + v, 10 + u],
        normal = side === 'south' ? [0, 0, 1] : [-1, 0, 0],
        circle = (role, radius, depth) => {
          const ps = Array.from({ length: 24 }, (_, i) =>
            C([
              radius * Math.cos((i * Math.PI) / 12),
              radius * Math.sin((i * Math.PI) / 12),
              depth,
            ]),
          );
          f(role, ps, normal);
        };
      circle('stone', 1.25, 0);
      circle('dark', 1.07, 0.025);
      if (detail > 1) {
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6,
            u = 0.88 * Math.sin(a),
            v = 0.88 * Math.cos(a);
          f(
            'frame',
            [
              C([u - 0.035, v - 0.09, 0.045]),
              C([u + 0.035, v - 0.09, 0.045]),
              C([u + 0.035, v + 0.09, 0.045]),
              C([u - 0.035, v + 0.09, 0.045]),
            ],
            normal,
          );
        }
        f(
          'frame',
          [
            C([-0.04, 0, 0.055]),
            C([-0.54, 0.48, 0.055]),
            C([-0.49, 0.54, 0.055]),
            C([0.04, 0, 0.055]),
          ],
          normal,
        );
        f(
          'frame',
          [
            C([-0.04, 0, 0.055]),
            C([0.62, 0.65, 0.055]),
            C([0.68, 0.59, 0.055]),
            C([0.04, 0, 0.055]),
          ],
          normal,
        );
      }
    }
  }
}
