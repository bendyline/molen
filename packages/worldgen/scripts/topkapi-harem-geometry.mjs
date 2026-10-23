/** 'N0742_HAREM': Multi-court Harem, stepped lead roofs, principal domes and the tiled Twin Kiosk. */

import { buildGradedLandmarkFloor, sampleLandmarkGrade } from './graded-landmark-site.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiHarem(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    grade = (x, z) => sampleLandmarkGrade(r, x, z),
    cylinder = (role, x, z, profile, n, emit = f) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: n }, (_, i) => [
          x + R * Math.cos((i * Math.PI * 2) / n),
          y,
          z + R * Math.sin((i * Math.PI * 2) / n),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n;
          emit(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
          );
        }
      for (const [ring, sign] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ])
        for (let i = 0; i < n; i++)
          emit(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % n]], [0, sign, 0]);
    },
    roofY = (zone, [x, z]) =>
      zone.base +
      zone.eaves +
      zone.rise *
        Math.max(0, 1 - Math.abs((zone.axisIndex ? z : x) - zone.roofMid) / zone.roofHalf),
    pointed = (u, spring, rise) => spring + rise * Math.sqrt(Math.max(0, 1 - Math.abs(u))),
    panel = (emit, role, x, z, bottom, spring, rise, R) => {
      const p = [
        [x - R, bottom, z],
        [x + R, bottom, z],
      ];
      for (let i = 0, n = [2, 3, 5, 10][detail]; i <= n; i++) {
        const t = 1 - (2 * i) / n;
        p.push([x + t * R, pointed(t, spring, rise), z]);
      }
      for (let i = 1; i < p.length - 1; i++) emit(role, [p[0], p[i], p[i + 1]], [0, 0, 1]);
    },
    header = (emit, role, cx, R, spring, rise, top, depth = 0.35) => {
      for (let i = 0, n = [2, 3, 5, 10][detail]; i < n; i++) {
        const a = -1 + (2 * i) / n,
          b = -1 + (2 * (i + 1)) / n,
          ya = pointed(a, spring, rise),
          yb = pointed(b, spring, rise);
        emit(
          role,
          [
            [cx + a * R, ya, 0],
            [cx + b * R, yb, 0],
            [cx + b * R, top, 0],
            [cx + a * R, top, 0],
          ],
          [0, 0, 1],
        );
        emit(
          'stone',
          [
            [cx + a * R, ya, 0],
            [cx + b * R, yb, 0],
            [cx + b * R, yb, -depth],
            [cx + a * R, ya, -depth],
          ],
          [0, -1, 0],
        );
      }
    },
    faceFor = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = tz,
        nz = -tx;
      return {
        L,
        nx,
        nz,
        emit: (role, ps, n) =>
          f(
            role,
            ps.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
            [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
          ),
      };
    },
    rect = (emit, role, a, b, lo, hi, d = 0) => {
      if (b - a > 1e-5 && hi - lo > 1e-5)
        emit(
          role,
          [
            [a, lo, d],
            [b, lo, d],
            [b, hi, d],
            [a, hi, d],
          ],
          [0, 0, 1],
        );
    },
    rectangularWindow = (emit, x, lo, hi, R, depth = 0.35) => {
      rect(emit, 'door', x - R, x + R, lo, hi, -depth);
      for (const [u, sign] of [
        [x - R, 1],
        [x + R, -1],
      ])
        emit(
          'stone',
          [
            [u, lo, 0],
            [u, hi, 0],
            [u, hi, -depth],
            [u, lo, -depth],
          ],
          [sign, 0, 0],
        );
      for (const [y, sign] of [
        [lo, 1],
        [hi, -1],
      ])
        emit(
          'stone',
          [
            [x - R, y, 0],
            [x + R, y, 0],
            [x + R, y, -depth],
            [x - R, y, -depth],
          ],
          [0, sign, 0],
        );
      if (detail >= 2) {
        for (const u of [x - R, x + R])
          rect(emit, 'stone', u - 0.07, u + 0.07, lo - 0.08, hi + 0.08, 0.035);
        for (const y of [lo, hi]) rect(emit, 'stone', x - R, x + R, y - 0.07, y + 0.07, 0.035);
      }
      if (detail >= 3) {
        rect(emit, 'stone', x - 0.025, x + 0.025, lo, hi, -0.24);
        rect(emit, 'stone', x - R, x + R, (lo + hi) / 2 - 0.025, (lo + hi) / 2 + 0.025, -0.24);
      }
    };

  if (!detail) {
    for (const zone of r.zones)
      for (const p of zone.patches)
        prism(
          (_role, ps, n) => f(n[1] > 0.5 ? 'roof' : 'wall', ps, n),
          'wall',
          p,
          r.foundationBottom - 1,
          zone.base + zone.eaves,
        );
  } else {
    buildGradedLandmarkFloor(f, r, detail >= 2);
    for (const zone of r.zones) {
      for (const p of zone.patches)
        prism(
          (_role, ps, n) => {
            if (
              Math.abs(n[1]) < 0.5 &&
              zone.facades.some((e) => {
                const m = ps.reduce(
                    (s, p) => [s[0] + p[0] / ps.length, s[1] + p[2] / ps.length],
                    [0, 0],
                  ),
                  dx = e.b[0] - e.a[0],
                  dz = e.b[1] - e.a[1],
                  t = ((m[0] - e.a[0]) * dx + (m[1] - e.a[1]) * dz) / (dx * dx + dz * dz);
                return (
                  t >= -1e-5 &&
                  t <= 1.00001 &&
                  Math.hypot(m[0] - e.a[0] - t * dx, m[1] - e.a[1] - t * dz) < 1e-4
                );
              })
            )
              return;
            f(n[1] > 0.5 ? 'roof' : 'wall', ps, n);
          },
          'wall',
          p,
          r.foundationBottom - 1,
          zone.base + zone.eaves,
        );
      for (const p of zone.roofFaces)
        prism(
          (_role, ps, n) => {
            if (n[1] > 0.5)
              f(
                'roof',
                ps.map(([x, , z]) => [x, roofY(zone, [x, z]), z]),
                n,
              );
          },
          'roof',
          p,
          0,
          1,
        );
      for (const p of zone.patches)
        for (const ring of [p.outline, ...p.holes])
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i],
              b = ring[(i + 1) % ring.length],
              ya = roofY(zone, a),
              yb = roofY(zone, b),
              lo = zone.base + zone.eaves;
            f(
              'roof',
              [
                [a[0], lo, a[1]],
                [b[0], lo, b[1]],
                [b[0], yb, b[1]],
                [a[0], ya, a[1]],
              ],
              [b[1] - a[1], 0, a[0] - b[0]],
            );
          }
      if (zone.custom) continue;
      for (const edge of zone.facades) {
        const G = faceFor(edge.a, edge.b),
          emit = G.emit,
          L = G.L,
          top = zone.base + zone.eaves,
          base = zone.base,
          n = Math.max(1, Math.round(L / [20, 12, 6.5, 4.6][detail])),
          step = L / n,
          arcade = edge.court === 2 && (G.nx > 0.6 || G.nz > 0.6);
        if (detail === 1) {
          rect(emit, 'wall', 0, L, r.foundationBottom - 1, top);
          for (let i = 0; i < n; i++)
            for (const y of [base + 1.2, base + 5.5])
              rect(emit, 'door', (i + 0.5) * step - 0.6, (i + 0.5) * step + 0.6, y, y + 1.7, 0.025);
          continue;
        }
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * step,
            a = i * step,
            b = a + step,
            R = Math.min(0.72, step * 0.22),
            lower = base + 1.2,
            middle = base + 3.0,
            upper = base + 5.5,
            spring = base + 6.9,
            crown = base + 7.6;
          if (arcade) {
            const A = step / 2 - 0.25,
              y = base + 0.1;
            for (const u of [a, ...(i === n - 1 ? [b] : [])]) {
              const px = edge.a[0] + (u * (edge.b[0] - edge.a[0])) / L,
                pz = edge.a[1] + (u * (edge.b[1] - edge.a[1])) / L,
                bottom = Math.min(y - 0.2, grade(px, pz) - 0.05);
              cylinder(
                'column',
                u,
                0,
                [
                  [bottom, 0.3],
                  [bottom + 0.18, 0.24],
                  [y + 2.45, 0.22],
                  [y + 2.75, 0.3],
                ],
                detail === 2 ? 8 : 12,
                emit,
              );
              box(emit, 'stone', u, y + 2.55, 0, 0.65, 0.28, 0.65);
            }
            header(emit, 'wall', x, A, base + 2.8, 1.15, base + 4.6, 2.0);
            rect(emit, 'tile', a, b, r.foundationBottom - 1, base + 4.55, -2.0);
            box(emit, 'stone', x, base + 4.45, -1, step, 0.15, 2);
            rect(emit, 'wall', a, b, base + 4.6, upper);
          } else {
            rect(emit, 'wall', a, x - R, r.foundationBottom - 1, top);
            rect(emit, 'wall', x + R, b, r.foundationBottom - 1, top);
            rect(emit, 'wall', x - R, x + R, r.foundationBottom - 1, lower);
            rectangularWindow(emit, x, lower, middle, R);
            rect(emit, 'wall', x - R, x + R, middle, upper);
          }
          if (arcade) {
            rect(emit, 'wall', a, x - R, upper, top);
            rect(emit, 'wall', x + R, b, upper, top);
          }
          panel(emit, 'door', x, -0.35, upper, spring, 0.7, R);
          panel(emit, 'screen', x, -0.3, upper, spring, 0.7, R);
          for (const [u, sign] of [
            [x - R, 1],
            [x + R, -1],
          ])
            emit(
              'stone',
              [
                [u, upper, 0],
                [u, spring, 0],
                [u, spring, -0.35],
                [u, upper, -0.35],
              ],
              [sign, 0, 0],
            );
          header(emit, 'wall', x, R, spring, 0.7, crown);
          rect(emit, 'wall', x - R, x + R, crown, top);
          if (edge.court >= 0) {
            if (!arcade) rect(emit, 'tile', a, b, base + 0.4, base + 0.75, 0.025);
            rect(emit, 'stone', a, b, base + 4.75, base + 4.9, 0.025);
          }
        }
        if (detail >= 3) box(emit, 'stone', L / 2, top - 0.18, 0.12, L, 0.2, 0.55);
      }
    }
    // Photo-led Twin Kiosk: a deep lower arcade, alternating upper masonry and a projecting tiled bay.
    const twin = r.zones.find((z) => z.custom),
      base = twin.base,
      a = r.twinFront.a,
      b = r.twinFront.b,
      G = faceFor(a, b),
      emit = G.emit,
      L = G.L;
    // The other mapped outer edge is the short north return; close it with matching stone.
    for (const e of twin.facades)
      if (Math.abs((e.a[0] + e.b[0]) / 2 + 60.3) > 0.6) {
        const q = faceFor(e.a, e.b);
        rect(q.emit, 'stone', 0, q.L, r.foundationBottom - 1, base + 12.8);
      }
    for (let i = 0; i < 3; i++) {
      const step = L / 3,
        x = (i + 0.5) * step,
        R = step / 2 - 0.6;
      rect(emit, 'stone', i * step, x - R, r.foundationBottom - 1, base + 6.1);
      rect(emit, 'stone', x + R, (i + 1) * step, r.foundationBottom - 1, base + 6.1);
      header(emit, 'stone', x, R, base + 2.75, 2.0, base + 6.1, 3.0);
      rect(emit, 'stone', i * step, (i + 1) * step, r.foundationBottom - 1, base + 0.12);
      rect(emit, 'door', i * step, (i + 1) * step, base + 0.12, base + 6.0, -3.0);
      if (detail >= 2) {
        for (const yy of [base + 0.25, base + 1.0])
          box(emit, 'stone', x, yy, -1.8, R * 2, 0.12, 0.2);
        for (let j = 0; j < 5; j++)
          box(emit, 'stone', x - R + ((j + 0.5) * R * 2) / 5, base + 0.3, -1.8, 0.14, 0.7, 0.18);
      }
    }
    box(emit, 'stone', L / 2, base + 6, -1.4, L, 0.25, 3.2);
    const windows = detail === 1 ? 4 : 6,
      step = L / windows;
    for (let i = 0; i < windows; i++) {
      const x = (i + 0.5) * step,
        R = 0.7,
        lo = base + 6.9,
        hi = base + 8.8,
        upper = base + 10.1,
        spring = base + 11.35;
      const stripeRect = (a, b, low, high) => {
        const pitch = detail === 1 ? 1 : 0.5;
        for (let y = low; y < high - 1e-5; y += pitch)
          rect(
            emit,
            Math.floor((y - base) / pitch) % 2 ? 'brick' : 'stone',
            a,
            b,
            y,
            Math.min(high, y + pitch),
          );
      };
      stripeRect(i * step, x - R, base + 6.25, base + 12.8);
      stripeRect(x + R, (i + 1) * step, base + 6.25, base + 12.8);
      stripeRect(x - R, x + R, base + 6.25, lo);
      rectangularWindow(emit, x, lo, hi, R);
      stripeRect(x - R, x + R, hi, upper);
      panel(emit, 'door', x, -0.35, upper, spring, 0.65, R);
      panel(emit, 'screen', x, -0.3, upper, spring, 0.65, R);
      header(emit, 'brick', x, R, spring, 0.65, base + 12.8);
    }
    if (detail >= 1) {
      const center = 17.5,
        width = 11.7;
      box(emit, 'tile', center, base + 6.2, 0.65, width, 6.5, 1.45);
      for (let i = 0; i < 4; i++) {
        const x = center - width / 2 + ((i + 0.5) * width) / 4;
        rect(emit, 'door', x - 1.0, x + 1.0, base + 6.9, base + 8.7, 1.39);
        panel(emit, 'door', x, 1.39, base + 10.0, base + 11.4, 0.7, 1.0);
        panel(emit, 'screen', x, 1.43, base + 10.0, base + 11.4, 0.7, 1.0);
        for (const u of [x - 1.03, x + 1.03])
          rect(emit, 'stone', u - 0.07, u + 0.07, base + 6.8, base + 12.2, 1.46);
        if (detail >= 2) box(emit, 'stone', x, base + 5.55, 0.2, 0.55, 0.65, 1.2);
      }
      box(emit, 'roof', center, base + 12.7, 0.6, width + 0.5, 0.25, 2.0);
    }
  }

  // Main picture-led roof landmarks. Their supporting drums extend into the occupied body, never float.
  for (const dome of r.domes) {
    const zone = r.zones.find((z) => z.id === dome.zone),
      y = zone.base + zone.eaves + 0.35,
      sides = [6, 8, 12, 22][detail],
      bands = [2, 3, 5, 8][detail];
    cylinder(
      'stone',
      dome.x,
      dome.z,
      [
        [r.foundationBottom - 1, dome.radius],
        [y, dome.radius],
        [y + 0.5, dome.radius],
      ],
      sides,
    );
    const profile = Array.from({ length: bands + 1 }, (_, i) => {
      const t = ((i / bands) * Math.PI) / 2;
      return [y + 0.5 + dome.rise * Math.sin(t), Math.max(0.05, dome.radius * Math.cos(t))];
    });
    cylinder('roof', dome.x, dome.z, profile, sides);
    if (detail >= 1)
      cylinder(
        'gold',
        dome.x,
        dome.z,
        [
          [y + 0.5 + dome.rise, 0.12],
          [y + 1.15 + dome.rise, 0.055],
        ],
        detail >= 2 ? 6 : 4,
      );
  }
  const bath = r.zones.find((z) => z.id === 'central-apartments');
  for (const [x, z] of detail ? r.baths : []) {
    const y = bath.base + bath.eaves + 0.2;
    cylinder(
      'roof',
      x,
      z,
      [
        [y - 0.25, 2],
        [y + 1.3, 1.6],
        [y + 2.2, 0.06],
      ],
      [4, 6, 8, 12][detail],
    );
  }
  for (const [i, [x, z]] of r.chimneys.entries()) {
    if (!detail && i % 2) continue;
    const zone =
        r.zones.find(
          (q) => x >= q.bounds[0] && x <= q.bounds[2] && z >= q.bounds[1] && z <= q.bounds[3],
        ) ?? bath,
      y = zone.base + zone.eaves + zone.rise,
      w = detail ? 0.9 : 1.1;
    const bottom = detail ? y - zone.rise - 0.2 : r.foundationBottom;
    box(f, 'stone', x, bottom, z, w, y + 2.4 - bottom, w);
    if (detail) box(f, 'roof', x, y + 2.2, z, w + 0.25, 0.25, w + 0.25);
  }
}
