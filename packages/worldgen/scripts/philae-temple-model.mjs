/** 'temple_of_isis_in_philae': specific Philae pylons, sanctuary courts and occupied colonnades. */
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildPhilaeTemple(face, detail, r, sample) {
  const parts = new Map(r.parts.map((p) => [p.owner, p])),
    a = r.architecturalAngleRadians,
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(role, ps, n);
    },
    rotated = (angle, center = [0, 0]) => {
      const C = Math.cos(angle),
        S = Math.sin(angle);
      return (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [center[0] + C * x - S * z, y, center[1] + S * x + C * z]),
          [C * n[0] - S * n[2], n[1], S * n[0] + C * n[2]],
        );
    },
    local = rotated(a);
  const cut = (emit, holes) => {
    const b = openingBuilder(
      { addTriangle: (role, _ref, ps, n) => emit(role, ps, n) },
      holes.map((h) => prepareOpening(h, 0, detail)),
    );
    return (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++) {
        const t = [ps[0], ps[i], ps[i + 1]];
        if (Math.hypot(...normalFor(...t)) > 0.5)
          b.addTriangle(role, 'palette:#ffffff', t, n, [], []);
      }
    };
  };
  function column(g, x, z, F, height, kind = 0) {
    const n = detail === 0 ? 4 : detail === 1 ? 5 : detail === 2 ? 8 : 12,
      profile =
        detail === 0
          ? [
              [F, 1.25],
              [F + height, 1.25],
            ]
          : detail <= 1
            ? [
                [F, 0.99],
                [F + height - 1.15, 0.88],
                [F + height, 1.75],
              ]
            : [
                [F, 1.18],
                [F + 0.16, 1.18],
                [F + 0.28, 0.95],
                [F + height - 1.3, 0.82],
                [F + height - 1.05, 1.08],
                [F + height - 0.15, kind % 2 ? 1.65 : 1.95],
                [F + height, 1.7],
              ];
    loft(g, 'trim', x, z, profile, false, (w) =>
      Array.from({ length: n }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / n) * w) / 2,
        (Math.sin((i * Math.PI * 2) / n) * w) / 2,
      ]),
    );
    if (detail >= 2) {
      const petals = detail === 2 ? 4 : 8;
      for (let i = 0; i < petals; i++) {
        const angle = (i * Math.PI * 2) / petals,
          C = Math.cos(angle),
          S = Math.sin(angle),
          y = F + height - 1;
        g(
          'trim',
          [
            [x + C * 0.54, y, z + S * 0.54],
            [x + C * 0.9 - S * 0.17, y + 0.75, z + S * 0.9 + C * 0.17],
            [x + C * 0.9 + S * 0.17, y + 0.75, z + S * 0.9 - C * 0.17],
          ],
          [C, 0.2, S],
        );
      }
      box(g, 'trim', x, F + height, z, 1.65, 0.25, 1.65);
    }
  }
  function stroke(g, A, B, width, depth) {
    const du = B[0] - A[0],
      dy = B[1] - A[1],
      len = Math.hypot(du, dy),
      u = ((-dy / len) * width) / 2,
      v = ((du / len) * width) / 2;
    g(
      'trim',
      [
        [A[0] + u, A[1] + v, depth],
        [B[0] + u, B[1] + v, depth],
        [B[0] - u, B[1] - v, depth],
        [A[0] - u, A[1] - v, depth],
      ],
      [0, 0, 1],
    );
  }
  function relief(g, x, y, z, size) {
    const G = (role, ps, n) =>
      g(
        role,
        ps.map(([u, v, d]) => [x + u * size, y + v * size, z + d * size]),
        n,
      );
    for (const [A, B, w] of [
      [[-0.12, 0.35], [-0.08, 0.88], 0.18],
      [[-0.12, 0.38], [-0.28, 0], 0.07],
      [[0, 0.38], [0.22, 0], 0.07],
      [[-0.1, 0.78], [-0.4, 0.6], 0.065],
      [[-0.4, 0.6], [-0.52, 0.95], 0.065],
      [[0, 0.78], [0.33, 0.68], 0.065],
    ])
      stroke(G, A, B, w, 0);
    const head = Array.from({ length: 8 }, (_, i) => [
      Math.cos((i * Math.PI) / 4) * 0.12,
      1.04 + Math.sin((i * Math.PI) / 4) * 0.14,
      0,
    ]);
    for (let i = 1; i < 7; i++) G('trim', [head[0], head[i], head[i + 1]], [0, 0, 1]);
  }
  function pylon(p, first) {
    const F = parts.get(p.owner).floorY,
      g = rotated(p.angle, p.center),
      w = (p.width - p.gateWidth) / 2,
      holes = first
        ? [
            {
              center: [-11.2, 0],
              axis: [1, 0],
              depth: p.depth + 2,
              shape: 'rect',
              width: 2,
              bottom: F + 0.1,
              height: 4.5,
            },
          ]
        : [],
      emit = cut(g, holes);
    for (const sign of [-1, 1]) {
      const x = sign * (p.gateWidth / 2 + w / 2);
      loft(
        emit,
        'wall',
        x,
        0,
        [
          [F, w],
          [F + p.height - 0.7, w - 1.25],
          [F + p.height - 0.5, w - 0.95],
          [F + p.height, w - 0.6],
        ],
        false,
        (W) => rect(0, 0, W, p.depth - (w - W) * 0.6).outline,
      );
      if (detail >= 1) {
        for (const k of [-0.28, 0.28]) {
          const u = x + w * k;
          box(g, 'inset', u, F + 4.5, p.depth / 2 - 0.12, 0.42, p.height * 0.43, 0.04);
          for (const t of [-1, 1])
            box(g, 'trim', u + t * 0.32, F + 4.5, p.depth / 2, 0.12, p.height * 0.43, 0.16);
        }
        if (detail >= 2) {
          const G = (role, ps, n) =>
            emit(
              role,
              ps.map(([u, y, z]) => [u, y, z + p.depth / 2 - ((y - F) / p.height) * 0.375 + 0.025]),
              n,
            );
          relief(G, x, F + 1.0, 0, 4.4);
          for (let i = 0; i < 3; i++)
            relief(G, x - w * 0.3 + i * w * 0.3, F + p.height * 0.64, 0, 1.6);
          for (let row = 0; row < 5; row++)
            stroke(G, [x - w * 0.4, F + 1 + row * 2.3], [x + w * 0.4, F + 1 + row * 2.3], 0.035, 0);
        }
      }
    }
    box(g, 'wall', 0, F + p.gateHeight, 0, p.gateWidth + 1.2, 3, p.depth * 0.78);
    if (detail > 0)
      box(g, 'trim', 0, F + p.gateHeight + 3, 0, p.gateWidth + 1.8, 0.4, p.depth * 0.9);
    if (detail >= 2)
      for (const sign of [-1, 1])
        box(
          g,
          'trim',
          sign * (p.gateWidth / 2 + 0.15),
          F + 0.1,
          p.depth / 2 - 0.2,
          0.27,
          p.gateHeight,
          0.4,
        );
  }
  // Only occupied mapped controls carry level local footings; courts stay open.
  for (const p of r.parts) {
    if (p.owner === r.foreWest.owner || p.owner === r.foreEast.owner) continue;
    prism(f, 'wall', p.polygon, p.baseY, p.floorY + 0.08);
  }
  pylon(r.first, true);
  const main = parts.get(r.sanctuary.owner),
    F = main.floorY,
    p = r.second,
    tangent = [Math.cos(p.angle), Math.sin(p.angle)],
    holes = [
      {
        center: p.center,
        axis: tangent,
        depth: 13,
        shape: 'rect',
        width: p.gateWidth,
        bottom: F + 0.08,
        height: p.gateHeight,
      },
      {
        center: [-21.33, -43.97],
        axis: [0.514, -0.858],
        depth: 3.5,
        shape: 'rect',
        width: 1.8,
        bottom: F + 0.1,
        height: 3.2,
      },
    ],
    wall = cut(f, holes);
  prism(wall, 'wall', main.polygon, F + 0.08, F + r.sanctuary.height);
  prism(f, 'trim', main.polygon, F + r.sanctuary.height, F + r.sanctuary.height + 0.25);
  pylon(r.second, false);
  if (detail >= 1) {
    for (const ring of [main.polygon.outline, ...main.polygon.holes])
      for (let i = 0; i < ring.length; i++) {
        const A = ring[i],
          B = ring[(i + 1) % ring.length],
          L = Math.hypot(B[0] - A[0], B[1] - A[1]),
          g = rotated(Math.atan2(B[1] - A[1], B[0] - A[0]), [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]);
        box(g, 'trim', 0, F + r.sanctuary.height - 0.15, 0, L, 0.35, 0.45);
      }
  }
  for (const ring of main.polygon.holes) {
    const center = [0, 1].map((k) => ring.reduce((n, p) => n + p[k], 0) / ring.length);
    for (let i = 0; i < ring.length; i += detail === 0 ? 2 : 1) {
      const v = ring[i],
        x = center[0] + (v[0] - center[0]) * 0.72,
        z = center[1] + (v[1] - center[1]) * 0.72,
        base = sample(x, z) - 0.3;
      box(f, 'wall', x, base, z, 1.3, F + 0.12 - base, 1.3);
      column(f, x, z, F + 0.12, r.sanctuary.height - 0.32, i);
    }
  }
  function court(p, west) {
    const F = parts.get(p.owner).floorY,
      [x0, z0, x1, z1] = p.bounds,
      height = p.height,
      N = detail === 0 ? (west ? 1 : 2) : p.columns;
    if (west) {
      const cx = (x0 + x1) / 2;
      // Core behind a visible columned ambulatory and southern porch.
      const doorW = 1.65,
        coreW = 5.0,
        depth = z1 - z0 - 5;
      const core = rect(cx, (z0 + z1) / 2 - 1.5, coreW, depth),
        emit = cut(local, [
          {
            center: [cx, z1 - 4],
            axis: [1, 0],
            depth: 5,
            shape: 'rect',
            width: doorW,
            bottom: F + 0.12,
            height: 3,
          },
        ]);
      prism(emit, 'wall', core, F + 0.12, F + height - 0.6);
      box(local, 'inset', cx, F + 0.12, z1 - 6, doorW, 3, 0.06);
      for (const x of [x0 + 0.85, x1 - 0.85])
        for (let j = 0; j < N; j++)
          column(
            local,
            x,
            z0 + 1.2 + (j * (z1 - z0 - 2.4)) / Math.max(1, N - 1),
            F + 0.12,
            height - 0.42,
            j,
          );
    } else {
      box(local, 'wall', x1 - 0.35, F + 0.12, (z0 + z1) / 2, 0.7, height - 0.3, z1 - z0);
      for (let j = 0; j < N; j++)
        column(
          local,
          x0 + 0.75,
          z0 + 1 + (j * (z1 - z0 - 2)) / (N - 1),
          F + 0.12,
          height - 0.42,
          j,
        );
    }
    box(local, 'trim', (x0 + x1) / 2, F + height - 0.05, (z0 + z1) / 2, x1 - x0, 0.4, z1 - z0);
    if (detail >= 2)
      box(
        local,
        'trim',
        (x0 + x1) / 2,
        F + height + 0.35,
        (z0 + z1) / 2,
        x1 - x0 + 0.25,
        0.15,
        z1 - z0 + 0.1,
      );
  }
  court(r.westCourt, true);
  court(r.eastCourt, false);
  function colonnade(p) {
    const A = p.start,
      B = p.end,
      dx = B[0] - A[0],
      dz = B[1] - A[1],
      length = Math.hypot(dx, dz),
      t = [dx / length, dz / length],
      N =
        detail === 0
          ? Math.ceil(p.columns / 6)
          : detail === 1
            ? Math.ceil(p.columns * 0.75)
            : p.columns,
      positions = Array.from({ length: N }, (_, i) => [
        A[0] + (dx * i) / (N - 1),
        A[1] + (dz * i) / (N - 1),
      ]);
    const segments = detail === 0 ? 1 : detail === 1 ? 4 : 6,
      perp = [-t[1], t[0]],
      side = p.courtSide,
      gradeAt = (u) => sample(A[0] + dx * u, A[1] + dz * u),
      beamHeight = (u) => {
        const k = Math.min(segments - 1, Math.floor(u * segments)),
          v = u * segments - k;
        return gradeAt(k / segments) * (1 - v) + gradeAt((k + 1) / segments) * v + p.height;
      };
    function strip(role, U, V, d0, d1, loA, loB, hiA, hiB) {
      const ps = [
          [U[0] + perp[0] * d0, loA, U[1] + perp[1] * d0],
          [V[0] + perp[0] * d0, loB, V[1] + perp[1] * d0],
          [V[0] + perp[0] * d1, loB, V[1] + perp[1] * d1],
          [U[0] + perp[0] * d1, loA, U[1] + perp[1] * d1],
        ],
        top = ps.map((p, i) => [p[0], i === 0 || i === 3 ? hiA : hiB, p[2]]);
      f(role, ps, [0, -1, 0]);
      f(role, top, [0, 1, 0]);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4;
        f(role, [ps[j], ps[k], top[k], top[j]], [ps[k][2] - ps[j][2], 0, ps[j][0] - ps[k][0]]);
      }
    }
    for (let i = 0; i < N; i++) {
      const [x, z] = positions[i],
        F = sample(x, z) + 0.08;
      box(f, 'wall', x, F - 0.6, z, 1.4, 0.7, 1.4);
      column(f, x, z, F + 0.1, beamHeight(i / (N - 1)) - F - 0.1, i);
    }
    for (let i = 0; i < segments; i++) {
      const u = i / segments,
        v = (i + 1) / segments,
        U = [A[0] + dx * u, A[1] + dz * u],
        V = [A[0] + dx * v, A[1] + dz * v],
        Y = gradeAt(u),
        Z = gradeAt(v),
        d = side * (p.width - 0.6),
        edgeSamples = Array.from({ length: Math.ceil(length / segments) + 1 }, (_, k) => {
          const v = k / Math.ceil(length / segments),
            x = U[0] + (V[0] - U[0]) * v,
            z = U[1] + (V[1] - U[1]) * v;
          return Math.min(
            ...[-0.4, 0, 0.4].map((q) => sample(x + perp[0] * (d + q), z + perp[1] * (d + q))),
          );
        }),
        buried = Math.min(...edgeSamples) - 0.65;
      strip(
        'trim',
        U,
        V,
        -0.875,
        0.875,
        Y + p.height,
        Z + p.height,
        Y + p.height + 0.55,
        Z + p.height + 0.55,
      );
      strip('wall', U, V, d - 0.325, d + 0.325, buried, buried, Y + p.height, Z + p.height);
      strip(
        'wall',
        U,
        V,
        d / 2 - (p.width + 0.35) / 2,
        d / 2 + (p.width + 0.35) / 2,
        Y + p.height + 0.4,
        Z + p.height + 0.4,
        Y + p.height + 0.7,
        Z + p.height + 0.7,
      );
    }
    // Grade-following buried edge of the mapped narrow occupied foundation.
    const poly = parts.get(p.owner).polygon;
    for (let i = 0; i < poly.outline.length; i++) {
      const a = poly.outline[i],
        b = poly.outline[(i + 1) % poly.outline.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2,
        g = rotated(Math.atan2(b[1] - a[1], b[0] - a[0]), [x, z]),
        Y = sample(x, z);
      if (detail >= 1) box(g, 'wall', 0, Y - 0.55, 0, L, 0.65, 0.22);
    }
  }
  colonnade(r.foreWest);
  colonnade(r.foreEast);
}
