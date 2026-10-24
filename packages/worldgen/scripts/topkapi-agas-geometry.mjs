/** 'mosque_of_the_agas_topkapi_palace': Banded masonry hall, pointed windows and shallow lead barrel roof. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiAgas(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    line = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = -tz,
        nz = tx;
      return {
        L,
        emit: (role, ps, n) =>
          f(
            role === 'wall' && n[2] <= 0 ? 'inner' : role,
            ps.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
            [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
          ),
      };
    },
    rise = (u, h, pointed) =>
      pointed
        ? (h * Math.sqrt(Math.max(0, 1 - ((Math.abs(u) + 1) / 2) ** 2))) / Math.sqrt(0.75)
        : h * Math.sqrt(Math.max(0, 1 - u * u)),
    panel = (emit, role, x, R, low, spring, h, d, pointed) => {
      const ps = [
          [x - R, low, d],
          [x + R, low, d],
        ],
        N = [2, 4, 8, 14][detail];
      for (let i = 0; i <= N; i++) {
        const u = 1 - (2 * i) / N;
        ps.push([x + u * R, spring + rise(u, h, pointed), d]);
      }
      for (let i = 1; i < ps.length - 1; i++) {
        const q = [ps[0], ps[i], ps[i + 1]];
        emit(role, q, [0, 0, 1]);
        if (detail && role === 'dark') emit(role, q.toReversed(), [0, 0, -1]);
      }
    },
    ring = (emit, role, x, R, spring, h, width, d, pointed) => {
      const N = [2, 4, 8, 14][detail];
      for (let i = 0; i < N; i++) {
        const a = -1 + (2 * i) / N,
          b = -1 + (2 * (i + 1)) / N;
        emit(
          role,
          [
            [x + R * a, spring + rise(a, h, pointed), d],
            [x + R * b, spring + rise(b, h, pointed), d],
            [x + (R + width) * b, spring + rise(b, h + width, pointed), d],
            [x + (R + width) * a, spring + rise(a, h + width, pointed), d],
          ],
          [0, 0, 1],
        );
      }
    },
    header = (emit, x, R, spring, h, top, pointed) => {
      const N = [2, 4, 8, 14][detail];
      for (let i = 0; i < N; i++) {
        const a = -1 + (2 * i) / N,
          b = -1 + (2 * (i + 1)) / N,
          x0 = x + R * a,
          x1 = x + R * b,
          y0 = spring + rise(a, h, pointed),
          y1 = spring + rise(b, h, pointed);
        for (const [d, sign] of [
          [0, 1],
          [-0.5, -1],
        ])
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
        emit(
          'trim',
          [
            [x0, y0, 0],
            [x1, y1, 0],
            [x1, y1, -0.5],
            [x0, y0, -0.5],
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
            [u, spring, 0],
            [u, spring, -0.5],
            [u, top, -0.5],
            [u, top, 0],
          ],
          [sign, 0, 0],
        );
    };
  for (const p of r.body) prism(f, 'floor', p, r.foundationBottom, r.floorY);
  const stairs = r.stairs,
    N = detail ? stairs.count : 2,
    dz = (stairs.outerZ - stairs.innerZ) / N;
  for (let i = 0; i < N; i++) {
    const top = stairs.bottomY + ((r.floorY - stairs.bottomY) * (i + 1)) / N;
    box(
      f,
      'floor',
      stairs.x,
      r.foundationBottom,
      stairs.outerZ - (i + 0.5) * dz,
      stairs.width,
      top - r.foundationBottom,
      dz + 0.005,
    );
  }

  for (const [index, a] of r.body[0].outline.entries()) {
    const b = r.body[0].outline[(index + 1) % r.body[0].outline.length],
      G = line(a, b),
      emit = G.emit,
      n = index === 1 ? 6 : Math.max(1, Math.round(G.L / 4.5)),
      step = G.L / n;

    if (detail <= 1) {
      const wall = (lo, hi) => {
        for (const [d, sign] of [
          [0, 1],
          [-0.5, -1],
        ])
          emit(
            'wall',
            [
              [lo, r.floorY, d],
              [hi, r.floorY, d],
              [hi, 10.9, d],
              [lo, 10.9, d],
            ],
            [0, 0, sign],
          );
      };
      const dx = 3.5 * step,
        R = Math.min(0.78, step * 0.27);
      if (index === 1) {
        wall(0, dx - R);
        wall(dx + R, G.L);
        header(emit, dx, R, 3.25, 0.75, 10.9, false);
        if (detail)
          for (const u of [dx - R + 0.04, dx + R - 0.04])
            box(emit, 'wood', u, r.floorY, -0.18, 0.08, 3, 0.12);
      } else wall(0, G.L);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * step;
        if (!(index === 1 && i === 3))
          panel(emit, 'dark', x, R, r.floorY + 0.5, 3.25, 0.75, 0.018, false);
        panel(emit, 'dark', x, R, 5.4, 8.65, 1, 0.018, true);
        if (detail) {
          for (const u of [-0.3, 0.3]) box(emit, 'grid', x + u, 5.4, 0.025, 0.05, 3.25, 0.05);
          for (const y of [6.2, 7.2, 8.2]) box(emit, 'grid', x, y, 0.025, R * 2, 0.05, 0.05);
        }
      }
      continue;
    }
    let edge = 0;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * step,
        door = index === 1 && i === 3,
        R = Math.min(0.78, step * 0.27),
        low = door ? r.floorY : r.floorY + 0.5;
      box(emit, 'wall', (edge + x - R) / 2, r.floorY, -0.25, x - R - edge, 10.9 - r.floorY, 0.5);
      edge = x + R;
      if (!door) box(emit, 'wall', x, r.floorY, -0.25, R * 2, low - r.floorY, 0.5);
      header(emit, x, R, 3.25, 0.75, 5.4, false);
      header(emit, x, R, 8.65, 1, 10.9, true);
      if (door) {
        for (const u of [x - R + 0.04, x + R - 0.04])
          box(emit, 'wood', u, r.floorY, -0.18, 0.08, 3.0, 0.12);
        // Closed lead hood and thin braces seated into the masonry.
        const hood = [
            [x - 1.1, 4.35, 0],
            [x + 1.1, 4.35, 0],
            [x + 1.1, 4.05, 1.05],
            [x - 1.1, 4.05, 1.05],
          ],
          underside = hood.map(([u, y, d]) => [u, y - 0.06, d]);
        emit('roof', hood, [0, 1, 0]);
        emit('roof', underside, [0, -1, 0]);
        for (let j = 0; j < 4; j++)
          emit(
            'roof',
            [hood[j], hood[(j + 1) % 4], underside[(j + 1) % 4], underside[j]],
            [
              [0, 0, -1],
              [1, 0, 0],
              [0, 0, 1],
              [-1, 0, 0],
            ][j],
          );
        const adapter = {
          addQuad: (role, _ref, ps, n) => emit(role, ps, n),
          addConvexPolygon: (role, _ref, ps, n) => {
            for (let j = 1; j < ps.length - 1; j++) emit(role, [ps[0], ps[j], ps[j + 1]], n);
          },
        };
        for (const u of [x - 1, x + 1])
          beam(adapter, 'dark', [u, 3.55, -0.025], [u, 4.07, 1], 0.06, 0.06, [1, 1, 1]);
      } else {
        panel(emit, 'dark', x, R, low, 3.25, 0.75, -0.29, false);
        panel(emit, 'screen', x, R, low, 3.25, 0.75, -0.16, false);
        ring(emit, 'trim', x, R, 3.25, 0.75, 0.18, 0.04, false);
        ring(emit, 'brick', x, R + 0.16, 3.25, 1.15, 0.19, 0.035, true);
      }
      panel(emit, 'dark', x, R, 5.4, 8.65, 1, -0.29, true);
      ring(emit, 'brick', x, R, 8.65, 1, 0.18, 0.025, true);
      for (const [lo, hi] of [
        [low, 3.25],
        [5.4, 8.65],
      ])
        for (const [u, sign] of [
          [x - R, 1],
          [x + R, -1],
        ])
          emit(
            'trim',
            [
              [u, lo, 0.015],
              [u, hi, 0.015],
              [u, hi, -0.3],
              [u, lo, -0.3],
            ],
            [sign, 0, 0],
          );
      for (const yy of [low, 5.4]) box(emit, 'trim', x, yy, 0.035, R * 2 + 0.18, 0.13, 0.15);
      const bars = detail === 1 ? [-0.3, 0.3] : [-0.4, 0, 0.4];
      for (const u of bars) box(emit, 'grid', x + u, 5.4, -0.1, 0.05, 3.25, 0.05);
      for (let y = 5.9; y < 8.65; y += detail === 1 ? 1 : 0.5)
        box(emit, 'grid', x, y, -0.1, R * 2, 0.05, 0.05);
      if (detail >= 2 && !door)
        for (const u of [-0.42, 0, 0.42])
          box(emit, 'dark', x + u, low, -0.09, 0.035, 3.25 - low, 0.04);
    }
    if (detail && edge < G.L)
      box(emit, 'wall', (edge + G.L) / 2, r.floorY, -0.25, G.L - edge, 10.9 - r.floorY, 0.5);
    if (detail) {
      box(emit, 'brick', G.L / 2, 10.7, 0.035, G.L, 0.12, 0.18);
      if (detail >= 2)
        for (let u = 0.16; u < G.L; u += detail === 2 ? 0.7 : 0.4)
          box(emit, 'brick', u, 10.82, 0.08, 0.17, 0.17, 0.22);
    }
  }
  prism(f, 'wall', r.body[0], 10.72, 10.9);

  const roof = r.roof,
    segments = [4, 6, 10, 16][detail],
    stations = [
      [-roof.halfLength, 0],
      [-roof.halfLength + 3, 1],
      [roof.halfLength - 3, 1],
      [roof.halfLength, 0],
    ],
    point = (x, u, s) => [
      x,
      10.9 + roof.rise * Math.sqrt(Math.max(0, 1 - u * u)) * s,
      roof.centerZ + u * roof.radius,
    ];
  for (let j = 0; j < stations.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = -1 + (2 * i) / segments,
        b = -1 + (2 * (i + 1)) / segments,
        [x0, s0] = stations[j],
        [x1, s1] = stations[j + 1];
      f(
        'roof',
        [point(x0, a, s0), point(x1, a, s1), point(x1, b, s1), point(x0, b, s0)],
        [0, 1, (a + b) / 2],
      );
    }
  // Roof thickness closes every perimeter edge; the main ceiling seals the occupied body below it.
  for (const z of [roof.centerZ - roof.radius, roof.centerZ + roof.radius])
    box(f, 'roof', 0, 10.86, z, roof.halfLength * 2, 0.12, 0.12);
  for (const x of [-roof.halfLength, roof.halfLength])
    box(f, 'roof', x, 10.86, roof.centerZ, 0.12, 0.12, roof.radius * 2);
  f(
    'trim',
    [
      [-roof.halfLength - 0.06, 10.865, roof.centerZ - roof.radius - 0.06],
      [roof.halfLength + 0.06, 10.865, roof.centerZ - roof.radius - 0.06],
      [roof.halfLength + 0.06, 10.865, roof.centerZ + roof.radius + 0.06],
      [-roof.halfLength - 0.06, 10.865, roof.centerZ + roof.radius + 0.06],
    ],
    [0, -1, 0],
  );
  if (detail)
    for (const x of [-roof.halfLength + 3, -4.5, 4.5, roof.halfLength - 3]) {
      const width = detail === 1 ? 0.14 : 0.2;
      for (let i = 0; i < segments; i++) {
        const a = -1 + (2 * i) / segments,
          b = -1 + (2 * (i + 1)) / segments;
        f(
          'dark',
          [
            point(x - width / 2, a, 1).map((v, k) => (k === 1 ? v + 0.045 : v)),
            point(x + width / 2, a, 1).map((v, k) => (k === 1 ? v + 0.045 : v)),
            point(x + width / 2, b, 1).map((v, k) => (k === 1 ? v + 0.045 : v)),
            point(x - width / 2, b, 1).map((v, k) => (k === 1 ? v + 0.045 : v)),
          ],
          [0, 1, (a + b) / 2],
        );
      }
    }
  const x = -roof.halfLength + 3,
    y = 10.9 + roof.rise,
    z = roof.centerZ;
  const n = [4, 6, 8, 10][detail],
    profile = [
      [y, 0.12],
      [y + 0.1, 0.17],
      [y + 0.22, 0.08],
      [y + 0.4, 0.12],
      [y + 0.55, 0.045],
      [y + 0.72, 0.02],
    ],
    rings = profile.map(([h, R]) =>
      Array.from({ length: n }, (_, i) => [
        x + R * Math.cos((i * 2 * Math.PI) / n),
        h,
        z + R * Math.sin((i * 2 * Math.PI) / n),
      ]),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      f(
        'finial',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
      );
    }
  for (const [ring, sign] of [
    [rings[0], -1],
    [rings.at(-1), 1],
  ])
    for (let i = 1; i < n - 1; i++) f('finial', [ring[0], ring[i], ring[i + 1]], [0, sign, 0]);
}
