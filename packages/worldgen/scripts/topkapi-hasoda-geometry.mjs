/** 'has_oda_kogusu_topkapi_palace': Mapped dormitory range, open pointed colonnade and low lead crowns. */

import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiHasoda(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    y = r.floorY,
    line = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        n = [t[1], -t[0]];
      return {
        L,
        point: (u) => [a[0] + u * t[0], a[1] + u * t[1]],
        emit: (role, ps, N) =>
          f(
            role,
            ps.map(([u, h, d]) => [a[0] + t[0] * u + n[0] * d, h, a[1] + t[1] * u + n[1] * d]),
            [t[0] * N[0] + n[0] * N[2], N[1], t[1] * N[0] + n[1] * N[2]],
          ),
      };
    },
    rect = (emit, role, x0, x1, lo, hi, d) => {
      const ps = [
        [x0, lo, d],
        [x1, lo, d],
        [x1, hi, d],
        [x0, hi, d],
      ];
      emit(role, ps, [0, 0, 1]);
      if (role === 'dark' && detail >= 2) emit(role, ps.toReversed(), [0, 0, -1]);
    },
    rise = (u, height, pointed) =>
      height *
      (pointed
        ? Math.sqrt(Math.max(0, 1 - ((Math.abs(u) + 1) / 2) ** 2)) / Math.sqrt(0.75)
        : Math.sqrt(Math.max(0, 1 - u * u))),
    header = (emit, role, cx, R, spring, h, top, depth, pointed) => {
      const N = [2, 4, 8, 14][detail];
      for (let i = 0; i < N; i++) {
        const a = -1 + (2 * i) / N,
          b = -1 + (2 * (i + 1)) / N,
          x0 = cx + a * R,
          x1 = cx + b * R,
          y0 = spring + rise(a, h, pointed),
          y1 = spring + rise(b, h, pointed);
        for (const [d, sign] of [
          [depth / 2, 1],
          [-depth / 2, -1],
        ])
          emit(
            role,
            [
              [x0, y0, d],
              [x1, y1, d],
              [x1, top, d],
              [x0, top, d],
            ],
            [0, 0, sign],
          );
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
      for (const [x, sign] of [
        [cx - R, -1],
        [cx + R, 1],
      ])
        emit(
          role,
          [
            [x, spring, -depth / 2],
            [x, spring, depth / 2],
            [x, top, depth / 2],
            [x, top, -depth / 2],
          ],
          [sign, 0, 0],
        );
    },
    archedPane = (emit, cx, R, low, spring, h, d) => {
      const ps = [
          [cx - R, low, d],
          [cx + R, low, d],
        ],
        N = [2, 4, 8, 14][detail];
      for (let i = 0; i <= N; i++) {
        const u = 1 - (2 * i) / N;
        ps.push([cx + R * u, spring + rise(u, h, false), d]);
      }
      for (let i = 1; i < ps.length - 1; i++) {
        const p = [ps[0], ps[i], ps[i + 1]];
        emit('dark', p, [0, 0, 1]);
        emit('dark', p.toReversed(), [0, 0, -1]);
      }
    },
    turned = (role, x, z, profile, n) => {
      const rings = profile.map(([h, R]) =>
        Array.from({ length: n }, (_, i) => [
          x + R * Math.cos((i * Math.PI * 2) / n),
          h,
          z + R * Math.sin((i * Math.PI * 2) / n),
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
      for (const [ring, sign] of [...(detail ? [[rings[0], -1]] : []), [rings.at(-1), 1]])
        for (let i = 1; i < n - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], [0, sign, 0]);
    };

  // Only the occupied mapped parent opens terrain; the outside court stays with the host.
  for (const p of r.body) prism(f, 'floor', p, r.foundationBottom, y);
  for (const p of r.room) {
    prism(f, 'wood', p, y + 5.62, y + 5.8);
    for (let j = 0; j < p.outline.length; j++) {
      const a = p.outline[j],
        b = p.outline[(j + 1) % p.outline.length],
        G = line(a, b),
        emit = G.emit;
      if (G.L < 2.5) {
        box(emit, 'wall', G.L / 2, y, -0.25, G.L, 5.8, 0.5);
        continue;
      }
      const bays = Math.max(1, Math.round(G.L / 4.2)),
        step = G.L / bays,
        front = Math.abs(a[1] - 8.3) < 0.001 && Math.abs(b[1] - 8.3) < 0.001 && G.L > 20;
      if (detail <= 1) {
        const door = (Math.floor(bays / 2) + 0.5) * step,
          R = 0.85;
        if (front) {
          box(emit, 'wall', (door - R) / 2, y, -0.25, door - R, 5.8, 0.5);
          box(emit, 'wall', (door + R + G.L) / 2, y, -0.25, G.L - door - R, 5.8, 0.5);
          box(emit, 'wall', door, y + 3.25, -0.25, R * 2, 2.55, 0.5);
        } else box(emit, 'wall', G.L / 2, y, -0.25, G.L, 5.8, 0.5);
        for (let i = 0; i < bays; i++) {
          const x = (i + 0.5) * step;
          if (!(front && i === Math.floor(bays / 2)))
            rect(emit, 'dark', x - 0.65, x + 0.65, y + 0.7, y + 2.65, 0.018);
          if (detail) archedPane(emit, x, 0.65, y + 3.9, y + 4.5, 0.48, 0.018);
        }
        continue;
      }
      let edge = 0;
      for (let i = 0; i < bays; i++) {
        const x = (i + 0.5) * step,
          door = front && i === Math.floor(bays / 2),
          R = Math.min(door ? 0.85 : 0.65, step * 0.25),
          lo = door ? y : y + 0.7,
          hi = y + (door ? 3.25 : 2.65);
        box(emit, 'wall', (edge + x - R) / 2, y, -0.25, x - R - edge, 5.8, 0.5);
        edge = x + R;
        if (!door) box(emit, 'wall', x, y, -0.25, R * 2, 0.7, 0.5);
        box(emit, 'wall', x, hi, -0.25, R * 2, y + 3.9 - hi, 0.5);
        if (detail >= 2) {
          header(
            (role, ps, n) =>
              emit(
                role,
                ps.map(([u, h, d]) => [u, h, d - 0.25]),
                n,
              ),
            'wall',
            x,
            R,
            y + 4.5,
            0.48,
            y + 5.8,
            0.5,
            false,
          );
          archedPane(emit, x, R, y + 3.9, y + 4.5, 0.48, -0.29);
          for (const yy of [y + 3.9, ...(door ? [] : [lo])]) {
            box(emit, 'trim', x, yy - 0.08, 0.025, R * 2 + 0.2, 0.12, 0.16);
            for (const sign of [-1, 1])
              box(
                emit,
                'trim',
                x + sign * (R + 0.055),
                yy,
                -0.06,
                0.11,
                (yy === lo ? hi : y + 4.5) - yy,
                0.16,
              );
          }
          for (const sign of [-1, 1])
            emit(
              'trim',
              [
                [x + sign * R, lo, 0],
                [x + sign * R, hi, 0],
                [x + sign * R, hi, -0.5],
                [x + sign * R, lo, -0.5],
              ],
              [-sign, 0, 0],
            );
        } else {
          box(emit, 'wall', x, y + 3.9, -0.25, R * 2, 1.9, 0.5);
          archedPane(emit, x, R, y + 3.9, y + 4.5, 0.48, 0.015);
        }
        if (door) {
          if (detail)
            for (const sign of [-1, 1])
              box(emit, 'wood', x + sign * (R - 0.045), y, -0.25, 0.09, 3.25, 0.42);
        } else {
          rect(emit, 'dark', x - R, x + R, lo, hi, detail >= 2 ? -0.3 : 0.015);
          if (detail >= 2) {
            rect(emit, 'screen', x - R, x + R, lo, hi, -0.12);
            if (detail === 3)
              for (const u of [-0.35, 0, 0.35])
                box(emit, 'dark', x + u, lo, -0.08, 0.035, hi - lo, 0.035);
          }
        }
      }
      if (edge < G.L) box(emit, 'wall', (edge + G.L) / 2, y, -0.25, G.L - edge, 5.8, 0.5);
    }
  }

  // Clipped planar hip faces retain the notched source boundary, without a precinct-sized slab.
  for (const panel of r.roofPatches) {
    const indices = earcut(panel.flatMap((p) => [p[0], p[2]]));
    for (let i = 0; i < indices.length; i += 3)
      f(
        'roof',
        indices.slice(i, i + 3).map((k) => panel[k]),
        [0, 1, 0],
      );
    for (let i = 0; i < panel.length; i++) {
      const a = panel[i],
        b = panel[(i + 1) % panel.length];
      f(
        'roof',
        [a, b, [b[0], y + 5.76, b[2]], [a[0], y + 5.76, a[2]]],
        [b[2] - a[2], 0, a[0] - b[0]],
      );
    }
  }
  for (const p of r.arcade) prism(f, 'roof', p, y + 5.65, y + 5.82);

  const G = line(...r.arcadeLine),
    emit = G.emit,
    step = G.L / r.arcadeBays,
    n = [4, 6, 10, 14][detail];
  for (let i = 0; i <= r.arcadeBays; i++) {
    const [x, z] = G.point(i * step),
      profile = detail
        ? [
            [y, 0.38],
            [y + 0.16, 0.38],
            [y + 0.24, 0.24],
            [y + 2.96, 0.22],
            [y + 3.06, 0.3],
            [y + 3.18, 0.37],
            [y + 3.25, 0.39],
          ]
        : [
            [y, 0.26],
            [y + 3.25, 0.26],
          ];
    turned('column', x, z, profile, n);
    if (detail) box(emit, 'trim', i * step, y + 3.2, 0, 0.78, 0.15, 0.78);
  }
  for (let i = 0; i < r.arcadeBays; i++) {
    const u = (i + 0.5) * step,
      R = step / 2 - 0.28;
    header(emit, 'wall', u, R, y + 3.25, 1.85, y + 5.7, 0.46, true);
    for (const sign of [-1, 1])
      box(emit, 'wall', u + sign * (step / 2 - 0.14), y + 3.25, 0, 0.28, 2.45, 0.46);
    if (detail >= 2) box(emit, 'dark', u, y + 3.45, -0.08, step, 0.055, 0.055);
    const [x, z] = G.point(u),
      roofZ = z - 2.35;
    if (detail)
      turned(
        'trim',
        x,
        roofZ,
        [
          [y + 5.8, 1.65],
          [y + 6.08, 1.65],
        ],
        detail === 1 ? 6 : 8,
      );
    const rings = [1, 3, 4, 6][detail],
      profile = [];
    for (let j = 0; j <= rings; j++) {
      const a = (j * Math.PI) / (rings * 2);
      profile.push([y + 6.08 + 0.8 * Math.sin(a), Math.max(0.035, 1.72 * Math.cos(a))]);
    }
    turned('roof', x, roofZ, profile, [4, 8, 12, 16][detail]);
  }
  if (detail) {
    box(emit, 'trim', G.L / 2, y + 5.64, 0.03, G.L, 0.12, 0.6);
    box(emit, 'roof', G.L / 2, y + 5.76, 0.02, G.L, 0.08, 0.64);
  }
}
