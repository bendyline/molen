/** 'halberdiers_quarters_topkapi_palace': Notched service range, narrow timber court and pierced chimney cowls. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiHalberdiers(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    ringArea = (ps) =>
      ps.reduce(
        (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
        0,
      ),
    line = (a, b, sign = 1) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        n = [t[1] * sign, -t[0] * sign];
      return {
        L,
        t,
        n,
        point: (u, d = 0) => [a[0] + u * t[0] + d * n[0], a[1] + u * t[1] + d * n[1]],
        emit: (role, ps, N) =>
          f(
            role,
            ps.map(([u, y, d]) => [a[0] + t[0] * u + n[0] * d, y, a[1] + t[1] * u + n[1] * d]),
            [t[0] * N[0] + n[0] * N[2], N[1], t[1] * N[0] + n[1] * N[2]],
          ),
      };
    },
    panel = (emit, role, cx, half, lo, hi, d, back = false) => {
      const ps = [
        [cx - half, lo, d],
        [cx + half, lo, d],
        [cx + half, hi, d],
        [cx - half, hi, d],
      ];
      emit(role, ps, [0, 0, 1]);
      if (back) emit(role, ps.toReversed(), [0, 0, -1]);
    },
    adapter = (emit) => ({
      addQuad: (role, _ref, ps, n) => emit(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) emit(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    });

  const wallBlock = (emit, role, x, y, z, w, h, d) => {
    if (detail) {
      box(emit, role, x, y, z, w, h, d);
      return;
    }
    for (const [depth, sign] of [
      [z + d / 2, 1],
      [z - d / 2, -1],
    ])
      emit(
        role,
        [
          [x - w / 2, y, depth],
          [x + w / 2, y, depth],
          [x + w / 2, y + h, depth],
          [x - w / 2, y + h, depth],
        ],
        [0, 0, sign],
      );
  };

  for (const part of r.parts) {
    const y = part.floorY,
      top = y + part.eaves;
    for (const p of part.body) {
      prism(
        (role, ps, n) => f(Math.abs(n[1]) > 0.5 ? role : 'wall', ps, n),
        'floor',
        p,
        part.foundationBottom,
        y,
      );
      prism(
        (role, ps, n) => {
          if (detail || n[1] < -0.5) f(n[1] > 0.5 ? 'roof' : role, ps, n);
        },
        'wood',
        p,
        top - 0.14,
        top,
      );
      for (const [ringIndex, ring] of [p.outline, ...p.holes].entries()) {
        const hole = ringIndex > 0,
          sign = Math.sign(ringArea(ring)) * (hole ? -1 : 1),
          role = hole ? 'render' : 'wall';
        for (let j = 0; j < ring.length; j++) {
          const a = ring[j],
            b = ring[(j + 1) % ring.length],
            G = line(a, b, sign),
            emit = G.emit;
          if (G.L < 2.2) {
            wallBlock(emit, role, G.L / 2, y, -0.24, G.L, part.eaves, 0.48);
            continue;
          }
          const fountainBay =
            hole && Math.abs(a[0] - r.fountain.x) < 0.05 && Math.abs(b[0] - r.fountain.x) < 0.05;
          const bays = Math.max(1, Math.round(G.L / (hole ? 3.8 : 5.3))),
            step = G.L / bays,
            entry = hole && Math.abs(a[1] - 15.5) < 0.001 && Math.abs(b[1] - 15.5) < 0.001,
            door = entry ? (r.stairs.x - a[0]) / G.t[0] : null,
            bands =
              part.floors === 2
                ? [
                    [y, y + 3.4, 0],
                    [y + 3.4, top, hole ? 0.5 : 0],
                  ]
                : [[y, top, 0]];
          for (const [lo, hi, offset] of bands) {
            const windows = [];
            for (let k = 0; k < bays; k++) {
              const x = (k + 0.5) * step,
                isDoor = entry && lo === y && Math.abs(x - door) < step / 2,
                center = isDoor ? door : x,
                half = isDoor ? 0.84 : Math.min(0.65, step * 0.24),
                low = isDoor ? y : lo + (part.floors === 1 ? 1.2 : 0.6),
                high = isDoor
                  ? y + 2.7
                  : Math.min(hi - 0.55, low + (part.floors === 1 ? 2.1 : 1.85));
              if (fountainBay && lo === y && Math.abs(G.point(center)[1] - r.fountain.z) < 1.8)
                continue;
              windows.push({ x: center, half, low, high, door: isDoor });
            }
            if (detail <= 1) {
              if (entry && lo === y) {
                for (const [u0, u1] of [
                  [0, door - 0.84],
                  [door + 0.84, G.L],
                ])
                  wallBlock(emit, role, (u0 + u1) / 2, lo, offset - 0.24, u1 - u0, hi - lo, 0.48);
                wallBlock(emit, role, door, y + 2.7, offset - 0.24, 1.68, hi - y - 2.7, 0.48);
              } else wallBlock(emit, role, G.L / 2, lo, offset - 0.24, G.L, hi - lo, 0.48);
            } else {
              const cuts = [...new Set([lo, hi, ...windows.flatMap((w) => [w.low, w.high])])].sort(
                (a, b) => a - b,
              );
              for (let k = 1; k < cuts.length; k++) {
                const low = cuts[k - 1],
                  high = cuts[k],
                  blocked = windows
                    .filter((w) => (low + high) / 2 > w.low && (low + high) / 2 < w.high)
                    .sort((a, b) => a.x - b.x);
                let edge = 0;
                for (const w of [...blocked, { x: G.L, half: 0 }]) {
                  if (w.x - w.half > edge + 0.0001)
                    box(
                      emit,
                      role,
                      (edge + w.x - w.half) / 2,
                      low,
                      offset - 0.24,
                      w.x - w.half - edge,
                      high - low,
                      0.48,
                    );
                  edge = w.x + w.half;
                }
              }
            }
            for (const [wi, w] of windows.entries()) {
              if (!detail && wi % 2 && !w.door) continue;
              if (!w.door) {
                panel(
                  emit,
                  'dark',
                  w.x,
                  w.half,
                  w.low,
                  w.high,
                  offset + (detail >= 2 ? -0.29 : 0.015),
                  detail >= 2,
                );
                if (detail === 3) {
                  for (const sign of [-1, 1])
                    box(
                      emit,
                      'wood',
                      w.x + sign * (w.half - 0.035),
                      w.low,
                      offset - 0.13,
                      0.07,
                      w.high - w.low,
                      0.13,
                    );
                  for (const h of [w.low, w.high - 0.07])
                    box(emit, 'wood', w.x, h, offset - 0.13, w.half * 2, 0.07, 0.13);
                  if (detail === 3) {
                    for (const u of [-0.3, 0, 0.3])
                      box(
                        emit,
                        'dark',
                        w.x + u,
                        w.low,
                        offset - 0.04,
                        0.035,
                        w.high - w.low,
                        0.035,
                      );
                    box(
                      emit,
                      'dark',
                      w.x,
                      (w.low + w.high) / 2,
                      offset - 0.04,
                      w.half * 2,
                      0.035,
                      0.035,
                    );
                  }
                }
              } else if (detail)
                for (const sign of [-1, 1])
                  box(emit, 'wood', w.x + sign * 0.8, y, -0.18, 0.08, 2.7, 0.32);
            }
          }
          if (hole && detail) {
            box(emit, 'wood', G.L / 2, y + 3.32, 0.22, G.L, 0.15, 0.58);
            if (detail)
              for (let u = 0.7; u < G.L - 0.4; u += detail === 1 ? 5.5 : 3.4) {
                if (fountainBay && Math.abs(G.point(u)[1] - r.fountain.z) < 1.8) continue;
                const out = adapter(emit);
                beam(out, 'wood', [u, y + 1.25, -0.02], [u, y + 2.5, 0.2], 0.14, 0.18, [1, 1, 1]);
                beam(out, 'wood', [u, y + 2.5, 0.2], [u, y + 3.32, 0.5], 0.14, 0.18, [1, 1, 1]);
              }
          }
          if (detail >= 2 && !hole)
            for (let u = 0.2; u < G.L; u += detail === 2 ? 1.6 : 0.8)
              box(emit, 'brick', u, top - 0.16, 0.04, 0.19, 0.16, 0.19);
        }
      }
    }
    for (const rings of part.roof) {
      const points = rings.flat(),
        holes = [];
      let k = rings[0].length;
      for (const h of rings.slice(1)) {
        holes.push(k);
        k += h.length;
      }
      const ix = earcut(
        points.flatMap((p) => [p[0], p[2]]),
        holes,
      );
      for (let i = 0; i < ix.length; i += 3)
        f(
          'roof',
          ix.slice(i, i + 3).map((k) => points[k]),
          [0, 1, 0],
        );
      for (const [ringIndex, ring] of rings.entries())
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            sign = ringIndex ? -1 : 1;
          f(
            'roof',
            [a, b, [b[0], top - 0.02, b[2]], [a[0], top - 0.02, a[2]]],
            [(b[2] - a[2]) * sign, 0, (a[0] - b[0]) * sign],
          );
        }
    }
  }

  const roofHeight = (part, x, z) => {
    for (const rings of part.roof) {
      const ps = rings.flat(),
        holes = [];
      let k = rings[0].length;
      for (const h of rings.slice(1)) {
        holes.push(k);
        k += h.length;
      }
      const ix = earcut(
        ps.flatMap((p) => [p[0], p[2]]),
        holes,
      );
      for (let i = 0; i < ix.length; i += 3) {
        const [a, b, c] = ix.slice(i, i + 3).map((k) => ps[k]),
          D = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]),
          u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / D,
          v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / D;
        if (u >= -0.0001 && v >= -0.0001 && u + v <= 1.0001)
          return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
      }
    }
    throw new Error('Chimney control is outside an actual roof');
  };
  for (const c of r.chimneys.filter((c) => detail || c.part === 3 || c.part === 1)) {
    const y = roofHeight(r.parts[c.part], c.x, c.z) - 0.06,
      top = y + 1.5,
      R = detail ? 0.55 : 0.6;
    const p = {
      outline: [
        [c.x - R, c.z - R],
        [c.x + R, c.z - R],
        [c.x + R, c.z + R],
        [c.x - R, c.z + R],
      ],
      holes:
        detail >= 2
          ? [
              [
                [c.x - 0.27, c.z - 0.27],
                [c.x - 0.27, c.z + 0.27],
                [c.x + 0.27, c.z + 0.27],
                [c.x + 0.27, c.z - 0.27],
              ],
            ]
          : [],
    };
    prism(f, 'brick', p, y, top);
    if (detail >= 2)
      for (let i = 0, n = detail === 2 ? 6 : 8; i < n; i++) {
        const a = (i * 2 * Math.PI) / n;
        box(f, 'floor', c.x + 0.48 * Math.cos(a), top, c.z + 0.48 * Math.sin(a), 0.15, 0.47, 0.15);
      }
    else box(f, 'floor', c.x, top, c.z, R * 2 + 0.1, 0.45, R * 2 + 0.1);
    const n = detail === 0 ? 4 : detail === 1 ? 6 : 8,
      rings = [
        [top + 0.43, R + 0.11],
        [top + 0.63, 0.04],
      ].map(([h, radius]) =>
        Array.from({ length: n }, (_, i) => [
          c.x + radius * Math.cos((i * 2 * Math.PI) / n),
          h,
          c.z + radius * Math.sin((i * 2 * Math.PI) / n),
        ]),
      );
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f(
        'roof',
        [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
        [rings[0][i][0] - c.x, 0.3, rings[0][i][2] - c.z],
      );
    }
    for (const [ring, sign] of [
      [rings[0], -1],
      [rings[1], 1],
    ])
      for (let i = 1; i < n - 1; i++) f('roof', [ring[0], ring[i], ring[i + 1]], [0, sign, 0]);
  }

  const stair = r.stairs,
    head = r.parts.at(-1),
    N = detail ? stair.count : 2,
    step = (stair.z1 - stair.z0) / N;
  for (let i = 0; i < N; i++) {
    const top = stair.lo + ((stair.hi - stair.lo) * (i + 1)) / N;
    box(
      f,
      'floor',
      stair.x,
      head.foundationBottom,
      stair.z0 + (i + 0.5) * step,
      stair.width,
      top - head.foundationBottom,
      step + 0.003,
    );
  }

  if (detail) {
    const y = r.fountain.groundY,
      F = (role, ps, n) =>
        f(
          role,
          ps.map(([u, h, d]) => [r.fountain.x - d, h, r.fountain.z + u]),
          [-n[2], n[1], n[0]],
        ),
      out = adapter(F),
      R = 0.72,
      spring = y + 1.55,
      rise = 0.55;
    panel(F, 'tile', 0, 1.05, y + 0.1, y + 2.35, 0.015);
    for (const x of [-0.88, 0.88]) box(F, 'floor', x, y + 0.1, 0.2, 0.2, 2.2, 0.4);
    for (let i = 0, n = detail === 1 ? 4 : detail === 2 ? 8 : 12; i < n; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / n,
        b = -Math.PI / 2 + (Math.PI * (i + 1)) / n,
        p = [
          [R * Math.sin(a), spring + rise * Math.cos(a), 0.38],
          [R * Math.sin(b), spring + rise * Math.cos(b), 0.38],
          [(R + 0.2) * Math.sin(b), spring + (rise + 0.2) * Math.cos(b), 0.38],
          [(R + 0.2) * Math.sin(a), spring + (rise + 0.2) * Math.cos(a), 0.38],
        ];
      F('floor', p, [0, 0, 1]);
      F('floor', [p[0], p[1], [p[1][0], p[1][1], 0.025], [p[0][0], p[0][1], 0.025]], [0, -1, 0]);
    }
    box(F, 'floor', 0, y + 0.75, 0.22, 1.9, 0.15, 0.5);
    // A real shallow bowl: the inner profile descends below the rim rather than closing it with a lid.
    const profile = [
        [y - 0.08, 0.22],
        [y + 0.42, 0.18],
        [y + 0.66, 0.5],
        [y + 0.78, 0.55],
        [y + 0.78, 0.45],
        [y + 0.5, 0.22],
        [y + 0.48, 0.035],
      ],
      n = [0, 8, 12, 16][detail];
    for (let j = 1; j < profile.length; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n,
          b = ((i + 1) * 2 * Math.PI) / n,
          P = (k, a) => [
            Math.cos(a) * profile[k][1],
            profile[k][0],
            0.9 + Math.sin(a) * profile[k][1],
          ];
        F(
          'floor',
          [P(j - 1, a), P(j - 1, b), P(j, b), P(j, a)],
          j >= 4 ? [-Math.cos(a), 1, -Math.sin(a)] : [Math.cos(a), 0.01, Math.sin(a)],
        );
      }
    beam(out, 'dark', [0, y + 1.25, 0.04], [0, y + 1.25, 0.3], 0.06, 0.06, [1, 1, 1]);
  }
}
