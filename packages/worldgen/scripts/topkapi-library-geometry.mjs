/** 'N0742_LIBRARY': Cross-plan marble library, pointed portico, lead domes and paired stairs. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiLibrary(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, normal) => face(role, points.map(P), P(normal)),
    line = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = -tz,
        nz = tx;
      return {
        L,
        emit: (role, points, normal) =>
          f(
            role,
            points.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
            [tx * normal[0] + nx * normal[2], normal[1], tz * normal[0] + nz * normal[2]],
          ),
      };
    },
    panel = (emit, role, points) => {
      emit(role, points, [0, 0, 1]);
      if (role === 'dark' && detail) emit(role, points.toReversed(), [0, 0, -1]);
    },
    rect = (emit, role, x, w, low, high, d) =>
      panel(emit, role, [
        [x - w / 2, low, d],
        [x + w / 2, low, d],
        [x + w / 2, high, d],
        [x - w / 2, high, d],
      ]),
    pointed = (u, rise) =>
      (rise * Math.sqrt(Math.max(0, 1 - ((Math.abs(u) + 1) / 2) ** 2))) / Math.sqrt(0.75),
    archPanel = (emit, role, x, R, low, spring, rise, d) => {
      const ps = [
          [x - R, low, d],
          [x + R, low, d],
        ],
        n = [2, 4, 8, 14][detail];
      for (let i = 0; i <= n; i++) {
        const u = 1 - (2 * i) / n;
        ps.push([x + u * R, spring + pointed(u, rise), d]);
      }
      for (let i = 1; i < ps.length - 1; i++) panel(emit, role, [ps[0], ps[i], ps[i + 1]]);
    },
    header = (emit, x, R, spring, rise, top, depth = 0.44) => {
      const n = [2, 4, 8, 14][detail];
      for (let i = 0; i < n; i++) {
        const a = -1 + (2 * i) / n,
          b = -1 + (2 * (i + 1)) / n,
          x0 = x + R * a,
          x1 = x + R * b,
          y0 = spring + pointed(a, rise),
          y1 = spring + pointed(b, rise);
        for (const [d, sign] of [
          [depth / 2, 1],
          [-depth / 2, -1],
        ]) {
          emit(
            'wall',
            [
              [x0, y0, d],
              [x1, y1, d],
              [x1, top, d],
              [x0, top, d],
            ],
            [0, 0, sign],
          );
          if (detail >= 2)
            emit(
              'trim',
              [
                [x0, y0, d + sign * 0.012],
                [x1, y1, d + sign * 0.012],
                [x + (R + 0.16) * b, y1 + 0.16, d + sign * 0.012],
                [x + (R + 0.16) * a, y0 + 0.16, d + sign * 0.012],
              ],
              [0, 0, sign],
            );
        }
        emit(
          'trim',
          [
            [x0, y0, depth / 2],
            [x1, y1, depth / 2],
            [x1, y1, -depth / 2],
            [x0, y0, -depth / 2],
          ],
          [0, -1, 0],
        );
      }
      for (const [u, sign] of [
        [x - R, -1],
        [x + R, 1],
      ])
        emit(
          'wall',
          [
            [u, spring, -depth / 2],
            [u, spring, depth / 2],
            [u, top, depth / 2],
            [u, top, -depth / 2],
          ],
          [sign, 0, 0],
        );
    },
    cylinder = (role, x, z, profile, n) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: n }, (_, i) => [
          x + R * Math.cos((i * 2 * Math.PI) / n),
          y,
          z + R * Math.sin((i * 2 * Math.PI) / n),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n;
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
          );
        }
      for (const [ring, sign] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ])
        for (let i = 1; i < n - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], [0, sign, 0]);
    },
    dome = (d, main = false) => {
      if (main)
        cylinder(
          'wall',
          d.x,
          d.z,
          [
            [d.base - 0.7, d.radius * 0.94],
            [d.base, d.radius * 0.94],
          ],
          8,
        );
      const n = main ? [8, 12, 20, 28][detail] : [6, 8, 14, 20][detail],
        rings = main ? [3, 4, 6, 9][detail] : [2, 3, 4, 6][detail],
        profile = [];
      for (let i = 0; i <= rings; i++) {
        const a = (i * Math.PI) / 2 / rings;
        profile.push([d.base + d.rise * Math.sin(a), Math.max(0.035, d.radius * Math.cos(a))]);
      }
      cylinder('roof', d.x, d.z, profile, n);
      const y = d.base + d.rise,
        finial = detail
          ? [
              [y, 0.2],
              [y + 0.14, 0.22],
              [y + 0.27, 0.09],
              [y + 0.42, 0.17],
              [y + 0.56, 0.07],
              [y + 0.75, 0.12],
              [y + 0.9, 0.035],
            ]
          : [
              [y, 0.13],
              [y + 0.8, 0.025],
            ];
      cylinder('gold', d.x, d.z, finial, detail ? 8 : 4);
      if (detail >= 2) {
        const cy = y + 1.04,
          N = detail === 2 ? 8 : 14;
        for (let i = 0; i < N; i++) {
          const a = 0.15 * Math.PI + (i * 1.7 * Math.PI) / N,
            b = 0.15 * Math.PI + ((i + 1) * 1.7 * Math.PI) / N;
          for (const [z, sign] of [
            [d.z + 0.025, 1],
            [d.z - 0.025, -1],
          ])
            f(
              'gold',
              [
                [d.x + 0.2 * Math.sin(a), cy + 0.2 * Math.cos(a), z],
                [d.x + 0.2 * Math.sin(b), cy + 0.2 * Math.cos(b), z],
                [d.x + 0.14 * Math.sin(b), cy + 0.14 * Math.cos(b), z],
                [d.x + 0.14 * Math.sin(a), cy + 0.14 * Math.cos(a), z],
              ],
              [0, 0, sign],
            );
        }
      }
    };

  // The occupied basement and stair footprints alone seal the host-ground cutout.
  for (const p of r.body) prism(f, 'floor', p, r.foundationBottom, r.floorY);
  for (const stair of r.stairs) {
    const count = detail ? stair.count : 2,
      step = (stair.outer - stair.inner) / count;
    for (let i = 0; i < count; i++) {
      const y = stair.bottomY + ((r.floorY - stair.bottomY) * (i + 1)) / count,
        x = stair.sign * (stair.outer - (i + 0.5) * step);
      box(
        f,
        'floor',
        x,
        r.foundationBottom,
        stair.z,
        step + 0.01,
        y - r.foundationBottom,
        stair.width,
      );
    }
    if (detail >= 2)
      for (const z of [stair.z - stair.width / 2, stair.z + stair.width / 2]) {
        const a = [stair.sign * stair.outer, stair.bottomY + 0.65, z],
          b = [stair.sign * stair.inner, r.floorY + 0.65, z],
          G = line([a[0], z], [b[0], z]);
        G.emit(
          'trim',
          [
            [0, a[1] - 0.2, -0.09],
            [G.L, b[1] - 0.2, -0.09],
            [G.L, b[1], -0.09],
            [0, a[1], -0.09],
          ],
          [0, 0, -1],
        );
        G.emit(
          'trim',
          [
            [0, a[1] - 0.2, 0.09],
            [G.L, b[1] - 0.2, 0.09],
            [G.L, b[1], 0.09],
            [0, a[1], 0.09],
          ],
          [0, 0, 1],
        );
        G.emit(
          'trim',
          [
            [0, a[1], -0.09],
            [G.L, b[1], -0.09],
            [G.L, b[1], 0.09],
            [0, a[1], 0.09],
          ],
          [0, 1, 0],
        );
      }
  }

  // Exact mapped cross plan; only the front portico is open.
  for (const [index, a] of r.main.outline.entries()) {
    const b = r.main.outline[(index + 1) % r.main.outline.length],
      G = line(a, b),
      emit = G.emit,
      mainHeader = (role, points, normal) =>
        emit(
          role,
          points.map(([x, y, d]) => [x, y, d - 0.22]),
          normal,
        ),
      count = Math.max(1, Math.round(G.L / 3)),
      step = G.L / count,
      isEntrance = index === 1;
    if (!detail) {
      if (isEntrance) {
        for (const sign of [-1, 1])
          box(
            emit,
            'wall',
            G.L / 2 + sign * (G.L / 4 + 0.5),
            r.floorY,
            -0.22,
            G.L / 2 - 1,
            10.9 - r.floorY,
            0.44,
          );
        header(mainHeader, G.L / 2, 1, 5.4, 0.75, 10.9);
      } else box(emit, 'wall', G.L / 2, r.floorY, -0.22, G.L, 10.9 - r.floorY, 0.44);
      for (let i = 0; i < count; i++) {
        if (isEntrance && i === Math.floor(count / 2)) continue;
        const x = (i + 0.5) * step,
          R = Math.min(0.68, step * 0.27);
        rect(emit, 'dark', x, R * 2, 3, 5.7, 0.015);
        archPanel(emit, 'dark', x, R, 7.15, 9.65, 0.7, 0.015);
      }
      continue;
    }
    let edge = 0;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * step,
        door = isEntrance && i === Math.floor(count / 2),
        R = door ? 1 : Math.min(0.68, step * 0.27);
      box(emit, 'wall', (edge + x - R) / 2, r.floorY, -0.22, x - R - edge, 10.9 - r.floorY, 0.44);
      edge = x + R;
      if (door) {
        header(mainHeader, x, R, 5.4, 0.75, 10.9);
        for (const sign of [-1, 1])
          box(emit, 'wood', x + sign * (R - 0.03), r.floorY, -0.16, 0.07, 3.1, 0.1);
        rect(emit, 'dark', x, 2.7, 7.5, 8.2, 0.025);
        if (detail >= 2) {
          const N = detail === 2 ? 8 : 14;
          for (let j = 0; j < N; j++) {
            const a = (j * Math.PI) / N,
              b = ((j + 1) * Math.PI) / N;
            emit(
              'trim',
              [
                [x, 6.45, 0.06],
                [x + 1.3 * Math.cos(a), 6.45 + 1.1 * Math.sin(a), 0.06],
                [x + 1.3 * Math.cos(b), 6.45 + 1.1 * Math.sin(b), 0.06],
              ],
              [0, 0, 1],
            );
          }
        }
      } else if (detail === 1) {
        box(emit, 'wall', x, r.floorY, -0.22, R * 2, 10.9 - r.floorY, 0.44);
        rect(emit, 'dark', x, R * 2, 3.0, 5.7, 0.015);
        archPanel(emit, 'dark', x, R, 7.15, 9.65, 0.7, 0.015);
      } else {
        box(emit, 'wall', x, r.floorY, -0.22, R * 2, 3 - r.floorY, 0.44);
        box(emit, 'wall', x, 5.7, -0.22, R * 2, 1.45, 0.44);
        header(mainHeader, x, R, 9.65, 0.7, 10.9);
        rect(emit, 'dark', x, R * 2, 3, 5.7, -0.29);
        archPanel(emit, 'dark', x, R, 7.15, 9.65, 0.7, -0.29);
        for (const [u, sign] of [
          [x - R, 1],
          [x + R, -1],
        ])
          for (const [low, high] of [
            [3, 5.7],
            [7.15, 9.65],
          ])
            emit(
              'trim',
              [
                [u, low, 0.01],
                [u, high, 0.01],
                [u, high, -0.3],
                [u, low, -0.3],
              ],
              [sign, 0, 0],
            );
        for (const yy of [3, 5.7, 7.15]) box(emit, 'trim', x, yy, 0.045, R * 2 + 0.18, 0.12, 0.16);
        for (const u of detail === 2 ? [-0.34, 0.34] : [-0.45, 0, 0.45]) {
          box(emit, 'gold', x + u, 3, -0.12, 0.04, 2.7, 0.04);
          box(emit, 'trim', x + u, 7.15, -0.12, 0.045, 2.5, 0.04);
        }
        for (const yy of detail === 2 ? [4.35] : [3.6, 4.35, 5.1])
          box(emit, 'gold', x, yy, -0.12, R * 2, 0.04, 0.04);
        for (const yy of [7.8, 8.6, 9.4]) box(emit, 'trim', x, yy, -0.12, R * 2, 0.045, 0.04);
      }
      if (detail >= 2) rect(emit, 'dark', x, Math.min(1.05, step * 0.45), 0.25, 1.25, 0.035);
    }
    if (edge < G.L)
      box(emit, 'wall', (edge + G.L) / 2, r.floorY, -0.22, G.L - edge, 10.9 - r.floorY, 0.44);
    box(emit, 'trim', G.L / 2, 10.8, 0.04, G.L, 0.23, 0.2);
    if (detail >= 2) box(emit, 'trim', G.L / 2, 2.05, 0.04, G.L, 0.16, 0.18);
  }
  prism(f, 'wall', r.main, 10.75, 10.9);

  const front = r.portico.front,
    G = line(...front),
    xs = Array.from({ length: 4 }, (_, i) => front[0][0] + ((front[1][0] - front[0][0]) * i) / 3),
    z = front[0][1];
  for (const x of xs) {
    cylinder(
      'column',
      x,
      z,
      detail
        ? [
            [r.floorY, 0.32],
            [2.4, 0.38],
            [2.6, 0.28],
            [7.7, 0.25],
            [7.8, 0.36],
          ]
        : [
            [r.floorY, 0.31],
            [7.8, 0.27],
          ],
      detail ? [0, 8, 12, 16][detail] : 4,
    );
    box(f, 'trim', x, 7.8, z, 0.7, 0.5, 0.7);
    if (detail)
      for (const [y, R] of [
        [2.62, 0.29],
        [7.58, 0.27],
      ])
        cylinder(
          'dark',
          x,
          z,
          [
            [y, R],
            [y + 0.1, R],
          ],
          detail === 1 ? 8 : 12,
        );
  }
  for (let i = 0; i < 3; i++) {
    const L = G.L / 3;
    header(G.emit, L * (i + 0.5), L / 2, 8.3, 2.15, 10.9, 0.4);
    if (detail >= 2) box(G.emit, 'dark', L * (i + 0.5), 8.22, 0, L, 0.055, 0.06);
    if (i !== 1) box(G.emit, 'trim', L * (i + 0.5), r.floorY, 0, L - 0.65, 0.65, 0.35);
  }
  for (const x of [xs[0], xs.at(-1)]) {
    const side = line([x, z], [x, r.portico.backZ]);
    header(side.emit, side.L / 2, side.L / 2, 8.3, 2.15, 10.9, 0.4);
  }
  prism(f, 'trim', r.portico.outline, 10.9, 11.08);
  for (const d of r.portico.domes) dome(d);

  // Three shallow barrel roofs meet the central domed square.
  for (const v of r.vaults) {
    const emit =
        v.axis === 'x'
          ? (role, ps, n) =>
              f(
                role,
                ps.map(([u, y, w]) => [u, y, w]),
                n,
              )
          : (role, ps, n) =>
              f(
                role,
                ps.map(([u, y, w]) => [w, y, u]),
                [n[2], n[1], n[0]],
              ),
      N = [2, 4, 8, 14][detail];
    for (let i = 0; i < N; i++) {
      const a = -1 + (2 * i) / N,
        b = -1 + (2 * (i + 1)) / N,
        y0 = 11 + v.rise * Math.sqrt(Math.max(0, 1 - a * a)),
        y1 = 11 + v.rise * Math.sqrt(Math.max(0, 1 - b * b)),
        w0 = v.center + a * v.radius,
        w1 = v.center + b * v.radius;
      emit(
        'roof',
        [
          [v.start, y0, w0],
          [v.end, y0, w0],
          [v.end, y1, w1],
          [v.start, y1, w1],
        ],
        [0, 1, (a + b) / 2],
      );
      for (const [u, sign] of [
        [v.start, -1],
        [v.end, 1],
      ])
        emit(
          'roof',
          [
            [u, 10.9, w0],
            [u, 10.9, w1],
            [u, y1, w1],
            [u, y0, w0],
          ],
          [sign, 0, 0],
        );
    }
  }
  dome(r.dome, true);

  // The front fountain is a low-relief geometric interpretation, without copied artwork.
  const fountain = r.fountain,
    emit = line([fountain.x, fountain.z], [fountain.x + 1, fountain.z]).emit;
  box(
    f,
    'trim',
    fountain.x,
    fountain.bottomY,
    fountain.z,
    2.75,
    r.floorY + 0.25 - fountain.bottomY,
    0.65,
  );
  archPanel(emit, 'gold', 0, 0.55, fountain.bottomY + 0.7, r.floorY - 0.25, 0.4, 0.34);
  box(f, 'floor', fountain.x, fountain.bottomY + 0.06, fountain.z + 0.48, 1.8, 0.05, 0.78);
  for (const z of [fountain.z + 0.09, fountain.z + 0.87])
    box(f, 'trim', fountain.x, fountain.bottomY + 0.11, z, 1.8, 0.16, 0.09);
  for (const x of [fountain.x - 0.855, fountain.x + 0.855])
    box(f, 'trim', x, fountain.bottomY + 0.11, fountain.z + 0.48, 0.09, 0.16, 0.78);
  if (detail) {
    for (const x of [-0.88, 0.88])
      box(emit, 'trim', x, fountain.bottomY, 0.36, 0.12, r.floorY + 0.25 - fountain.bottomY, 0.16);
    box(emit, 'gold', 0, r.floorY + 0.25, 0.34, 2.7, 0.09, 0.12);
    archPanel(emit, 'gold', 0, 1.15, r.floorY + 0.35, r.floorY + 0.35, 0.75, 0.34);
    box(emit, 'dark', 0, fountain.bottomY + 0.65, 0.39, 0.1, 0.1, 0.18);
  }
}
