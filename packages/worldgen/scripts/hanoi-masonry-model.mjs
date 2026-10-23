/** N0626: mapped terraces, pierced parapets, rosette shaft and open octagonal crown. */
import earcut from 'earcut';
import { cross, normalize } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildHanoiMasonry(face, detail, r) {
  const P = ([x, y, z]) => [
      r.center[0] + x * r.xAxis[0] + z * r.zAxis[0],
      r.floorY + y,
      r.center[1] + x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    beam = (role, a, b, width, depth = width) => {
      const axis = normalize(b.map((v, k) => v - a[k])),
        u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
        v = cross(axis, u),
        ring = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([x, y]) => p.map((q, k) => q + (x * u[k] * width) / 2 + (y * v[k] * depth) / 2)),
        A = ring(a),
        B = ring(b);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        f(
          role,
          [A[i], A[j], B[j], B[i]],
          A[i].map((q, k) => q + A[j][k] - 2 * a[k]),
        );
      }
      f(
        role,
        A,
        axis.map((v) => -v),
      );
      f(role, B, axis);
    },
    polygon = (role, rings, map, normal) => {
      const flat = rings.flat(),
        starts = [];
      let count = rings[0].length;
      for (const ring of rings.slice(1)) {
        starts.push(count);
        count += ring.length;
      }
      const ix = earcut(flat.flat(), starts);
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((k) => map(flat[k])),
          normal,
        );
    },
    inset = (ps, amount) => {
      const c = ps.reduce((a, p) => a.map((v, k) => v + p[k] / ps.length), [0, 0]),
        radius = Math.min(...ps.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])));
      return ps.map((p) => p.map((v, k) => c[k] + (v - c[k]) * (1 - amount / radius)));
    },
    round = (x, y, radius, n) =>
      Array.from({ length: n }, (_, i) => [
        x + radius * Math.cos((i * Math.PI * 2) / n),
        y + radius * Math.sin((i * Math.PI * 2) / n),
      ]);

  // Actual mapped terrace outlines; walk decks sit below their parapet tops.
  for (let k = 0; k < r.terraces.length; k++) {
    const t = r.terraces[k],
      low = t.outline,
      top = inset(low, 0.65),
      area = low.reduce(
        (s, p, i) => s + p[0] * low[(i + 1) % low.length][1] - p[1] * low[(i + 1) % low.length][0],
        0,
      ),
      sign = Math.sign(area);
    polygon('stone', [top], ([x, z]) => [x, t.floor, z], [0, 1, 0]);
    if (!k) polygon('brick', [low], ([x, z]) => [x, t.bottom, z], [0, -1, 0]);
    for (let i = 0; i < low.length; i++) {
      const j = (i + 1) % low.length,
        a = low[i],
        b = low[j],
        A = top[i],
        B = top[j],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
        n = [u[1] * sign, 0, -u[0] * sign],
        wall = ([s, y], depth = 0) => {
          const q = (y - t.bottom) / (t.floor - t.bottom),
            w = s / length;
          return [
            a[0] * (1 - w) * (1 - q) +
              b[0] * w * (1 - q) +
              A[0] * (1 - w) * q +
              B[0] * w * q +
              n[0] * depth,
            y,
            a[1] * (1 - w) * (1 - q) +
              b[1] * w * (1 - q) +
              A[1] * (1 - w) * q +
              B[1] * w * q +
              n[2] * depth,
          ];
        },
        outer = [
          [0, t.bottom],
          [length, t.bottom],
          [length, t.floor],
          [0, t.floor],
        ],
        holes = [];
      if (k === 0 && i === 0 && detail > 0) {
        const arch = [
          [length / 2 - 0.9, 0.08],
          [length / 2 + 0.9, 0.08],
          [length / 2 + 0.9, 1.4],
        ];
        for (let j = 1; j <= 8; j++) {
          const a = (j * Math.PI) / 8;
          arch.push([length / 2 + 0.9 * Math.cos(a), 1.4 + 0.68 * Math.sin(a)]);
        }
        holes.push(arch);
        polygon('inset', [arch], (p) => wall(p, -0.32), n);
        for (let j = 0; j < arch.length; j++) {
          const a = arch[j],
            b = arch[(j + 1) % arch.length],
            mid = a.map((v, i) => (v + b[i]) / 2);
          f(
            'plaster',
            [wall(a), wall(b), wall(b, -0.32), wall(a, -0.32)],
            [u[0] * (length / 2 - mid[0]), 1 - mid[1], u[1] * (length / 2 - mid[0])],
          );
        }
      }
      polygon('brick', [outer, ...holes], (p) => wall(p), n);
      const l = Math.hypot(B[0] - A[0], B[1] - A[1]),
        tangent = [(B[0] - A[0]) / l, (B[1] - A[1]) / l],
        at = (s, y, d = 0) => [
          A[0] + tangent[0] * s + n[0] * d,
          y,
          A[1] + tangent[1] * s + n[2] * d,
        ],
        gate = (k === 1 && i === 2) || (k === 2 && i === 0),
        gap = gate ? 1.2 : 0,
        spans = gate
          ? [
              [0, l / 2 - gap],
              [l / 2 + gap, l],
            ]
          : [[0, l]];
      for (const [start, end] of spans) {
        beam('plaster', at(start, t.floor + 0.09), at(end, t.floor + 0.09), 0.18, 0.24);
        beam('plaster', at(start, t.top - 0.07), at(end, t.top - 0.07), 0.16, 0.29);
        if (detail === 0) {
          f(
            'plaster',
            [
              at(start, t.floor + 0.14),
              at(end, t.floor + 0.14),
              at(end, t.top - 0.14),
              at(start, t.top - 0.14),
            ],
            n,
          );
        } else {
          const count = Math.max(
            1,
            Math.round((end - start) / (detail === 1 ? 3.6 : detail === 2 ? 2.0 : 1.6)),
          );
          for (let j = 0; j <= count; j++) {
            const s = start + ((end - start) * j) / count;
            beam(
              'plaster',
              at(s, t.floor + 0.14),
              at(s, t.top - 0.14),
              detail === 1 ? 0.17 : 0.11,
              0.2,
            );
            if (j < count && detail >= 2) {
              const next = start + ((end - start) * (j + 1)) / count,
                middle = (s + next) / 2,
                y = (t.floor + t.top) / 2;
              for (const pair of detail === 2
                ? [
                    [at(s + 0.1, t.floor + 0.16), at(next - 0.1, t.top - 0.16)],
                    [at(s + 0.1, t.top - 0.16), at(next - 0.1, t.floor + 0.16)],
                  ]
                : [
                    [at(s + 0.1, y), at(middle, t.top - 0.16)],
                    [at(middle, t.top - 0.16), at(next - 0.1, y)],
                    [at(next - 0.1, y), at(middle, t.floor + 0.16)],
                    [at(middle, t.floor + 0.16), at(s + 0.1, y)],
                  ])
                beam('plaster', ...pair, 0.075, 0.12);
            }
          }
        }
      }
      // Bounded supported flights end at a level landing and an actual rail gap.
      if (gate) {
        const previous = r.terraces[k - 1],
          run = k === 1 ? 5.1 : 3.6,
          end = 1.1,
          steps = [2, 5, 12, 16][detail],
          map = ([x, y, z]) => at(l / 2 + x, y, z),
          sf = (role, ps, normal) =>
            f(role, ps.map(map), [
              tangent[0] * normal[0] + n[0] * normal[2],
              normal[1],
              tangent[1] * normal[0] + n[2] * normal[2],
            ]);
        for (let j = 0; j < steps; j++)
          box(
            sf,
            'stone',
            0,
            previous.floor,
            end + run * (1 - (j + 0.5) / steps),
            2.0,
            ((t.floor - previous.floor) * (j + 1)) / steps,
            run / steps + 0.015,
          );
        box(sf, 'stone', 0, t.floor - 0.22, 0.46, 2.0, 0.22, 1.55);
      }
    }
  }

  const center = r.shaftCenter,
    n = 8,
    ring = (radius) =>
      Array.from({ length: n }, (_, i) => [
        center[0] + Math.cos(r.phaseRadians + (i * Math.PI) / 4) * radius,
        center[1] + Math.sin(r.phaseRadians + (i * Math.PI) / 4) * radius,
      ]),
    bottom = ring(r.shaftRadius),
    top = ring(r.shaftTopRadius);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = bottom[i],
      b = bottom[j],
      A = top[i],
      B = top[j],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      normal = [u[1], 0, -u[0]],
      wall = ([s, y], depth = 0) => {
        const q = (y - r.shaftBottom) / (r.shaftTop - r.shaftBottom),
          w = s / length;
        return [
          a[0] * (1 - w) * (1 - q) +
            b[0] * w * (1 - q) +
            A[0] * (1 - w) * q +
            B[0] * w * q +
            normal[0] * depth,
          y,
          a[1] * (1 - w) * (1 - q) +
            b[1] * w * (1 - q) +
            A[1] * (1 - w) * q +
            B[1] * w * q +
            normal[2] * depth,
        ];
      },
      outer = [
        [0, r.shaftBottom],
        [length, r.shaftBottom],
        [length, r.shaftTop],
        [0, r.shaftTop],
      ],
      holes =
        detail === 0
          ? []
          : Array.from({ length: 6 }, (_, j) =>
              round(length / 2, 13.7 + j * 2.6, 0.33, [4, 6, 8, 12][detail]),
            );
    polygon('brick', [outer, ...holes], (p) => wall(p), normal);
    for (const hole of holes) {
      const y = hole.reduce((s, p) => s + p[1] / hole.length, 0),
        outside = round(length / 2, y, 0.45, hole.length);
      polygon('plaster', [outside, hole], (p) => wall(p, 0.02), normal);
      polygon('inset', [hole], (p) => wall(p, -0.24), normal);
      for (let k = 0; k < hole.length; k++) {
        const a = hole[k],
          b = hole[(k + 1) % hole.length],
          mid = a.map((v, i) => (v + b[i]) / 2);
        f(
          'plaster',
          [wall(a, 0.02), wall(b, 0.02), wall(b, -0.24), wall(a, -0.24)],
          [u[0] * (length / 2 - mid[0]), y - mid[1], u[1] * (length / 2 - mid[0])],
        );
      }
      if (detail >= 2)
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          beam(
            'plaster',
            wall([length / 2, y], -0.06),
            wall([length / 2 + 0.3 * Math.cos(a), y + 0.3 * Math.sin(a)], -0.06),
            0.045,
          );
        }
    }
  }

  // A real hollow crown: eight rectangular mouths, inward reveals, floor and roof underside.
  prism(f, 'brick', { outline: ring(r.crownRadius) }, r.crownBottom - 0.12, r.crownBottom + 0.45);
  const crown = ring(r.crownRadius),
    inner = ring(r.crownRadius - 0.32),
    lo = r.crownBottom + 0.45,
    hi = r.crownTop - 0.25;
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8,
      a = crown[i],
      b = crown[j],
      A = inner[i],
      B = inner[j],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      normal = [u[1], 0, -u[0]],
      outer = [
        [0, lo],
        [length, lo],
        [length, hi],
        [0, hi],
      ],
      hole = [
        [length / 2 - 0.65, lo + 0.22],
        [length / 2 + 0.65, lo + 0.22],
        [length / 2 + 0.65, hi - 0.28],
        [length / 2 - 0.65, hi - 0.28],
      ],
      wall = ([s, y], inside = false) => {
        const w = s / length,
          p = inside ? A : a,
          q = inside ? B : b;
        return [p[0] * (1 - w) + q[0] * w, y, p[1] * (1 - w) + q[1] * w];
      };
    polygon('plaster', [outer, hole], (p) => wall(p), normal);
    polygon(
      'plaster',
      [outer, hole],
      (p) => wall(p, true),
      normal.map((v) => -v),
    );
    for (let k = 0; k < 4; k++) {
      const a = hole[k],
        b = hole[(k + 1) % 4],
        mid = a.map((v, i) => (v + b[i]) / 2);
      f(
        'plaster',
        [wall(a), wall(b), wall(b, true), wall(a, true)],
        [u[0] * (length / 2 - mid[0]), (lo + hi) / 2 - mid[1], u[1] * (length / 2 - mid[0])],
      );
    }
  }
  prism(f, 'stone', { outline: ring(r.crownRadius + 0.2) }, r.crownTop - 0.25, r.crownTop);
  const poleRadius = detail === 0 ? 0.1 : 0.075,
    pole = Array.from({ length: 8 }, (_, i) => [
      center[0] + Math.cos((i * Math.PI) / 4) * poleRadius,
      center[1] + Math.sin((i * Math.PI) / 4) * poleRadius,
    ]);
  prism(f, 'metal', { outline: pole }, r.crownTop, r.height);

  // Original geometric national flag; no unique image atlas or copied lettering.
  const width = 3.8,
    height = 2.55,
    flagTop = 40.5,
    cols = detail === 0 ? 1 : 4,
    rows = detail === 0 ? 1 : 2,
    wave = (x) => (detail === 0 ? 0 : x <= 2.85 ? 0.04 * x : 0.114 + 0.25 * (x - 2.85)),
    flag = ([x, y], side = 0) => [center[0] + x, flagTop - y, center[1] + wave(x) + side];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const ps = [
        [(i * width) / cols, (j * height) / rows],
        [((i + 1) * width) / cols, (j * height) / rows],
        [((i + 1) * width) / cols, ((j + 1) * height) / rows],
        [(i * width) / cols, ((j + 1) * height) / rows],
      ];
      for (const side of [-1, 1])
        f(
          'flag',
          ps.map((p) => flag(p)),
          [0, 0, side],
        );
    }
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rad = i % 2 ? 0.25 : 0.6;
    return [width * 0.48 + Math.cos(a) * rad, height * 0.49 + Math.sin(a) * rad];
  });
  for (const side of [-1, 1]) polygon('star', [star], (p) => flag(p, side * 0.014), [0, 0, side]);
}
