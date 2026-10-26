/** 'volkonsky_house_yasnaya_polyana': actual connected house, low links and wide end pavilions. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildVolkonsky(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, y, z, w, h, d);
  const clip = (ring, A, B, C) => {
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        ha = A * a[0] + B * a[1] + C,
        hb = A * b[0] + B * b[1] + C;
      if (ha >= -1e-9) out.push(a);
      if (ha >= 0 !== hb >= 0) {
        const t = ha / (ha - hb);
        out.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    return out;
  };
  const cap = (role, p, height, down = false) =>
    prism(
      (_, ps, n) => {
        if (n[1] > 0.5)
          f(
            role,
            ps.map(([x, , z]) => [x, typeof height === 'function' ? height([x, z]) : height, z]),
            [0, down ? -1 : 1, 0],
          );
      },
      role,
      p,
      -0.01,
      0,
      false,
    );
  const bounds = (p) => {
    const xs = p.outline.map((q) => q[0]),
      zs = p.outline.map((q) => q[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  };
  const roof = (p, eave, rise, kind) => {
    const b = bounds(p),
      hx = (b.x1 - b.x0) / 2,
      hz = (b.z1 - b.z0) / 2;
    const planes =
      kind === 'gable'
        ? [
            [1 / hx, 0, -b.x0 / hx],
            [-1 / hx, 0, b.x1 / hx],
          ]
        : kind === 'link'
          ? [
              [0, 1 / hz, -b.z0 / hz],
              [0, -1 / hz, b.z1 / hz],
            ]
          : [
              [1 / hx, 0, -b.x0 / hx],
              [-1 / hx, 0, b.x1 / hx],
              [0, 0.25, -b.z0 * 0.25],
              [0, -0.25, b.z1 * 0.25],
            ];
    const h = (q) =>
      eave + rise * Math.max(0, Math.min(...planes.map(([A, B, C]) => A * q[0] + B * q[1] + C)));
    for (let i = 0; i < planes.length; i++) {
      let ring = p.outline;
      for (let j = 0; j < planes.length; j++)
        if (i !== j) ring = clip(ring, ...planes[j].map((v, k) => v - planes[i][k]));
      if (ring.length >= 3) cap('roof', { outline: ring, holes: [] }, h);
    }
    // Close every gable/hip boundary, including the unequal-height internal roof joints.
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        mid = a.map((v, k) => (v + b[k]) / 2);
      for (const [u, v] of [
        [a, mid],
        [mid, b],
      ])
        f(
          'wall',
          [
            [u[0], eave, u[1]],
            [v[0], eave, v[1]],
            [v[0], h(v), v[1]],
            [u[0], h(u), u[1]],
          ],
          [b[1] - a[1], 0, a[0] - b[0]],
        );
    }
    cap('roof', p, eave, true);
    return { h, b };
  };
  const rounded = (cx, base, z, width, stem, sign = 1, role = 'glass') => {
    const radius = width / 2,
      spring = base + stem,
      n = detail === 0 ? 4 : detail === 1 ? 6 : detail === 2 ? 10 : 16;
    f(
      role,
      [
        [cx - radius, base, z],
        [cx + radius, base, z],
        [cx + radius, spring, z],
        [cx - radius, spring, z],
      ],
      [0, 0, sign],
    );
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI,
        b = ((i + 1) / n) * Math.PI,
        p = [cx + Math.cos(a) * radius, spring + Math.sin(a) * radius, z],
        q = [cx + Math.cos(b) * radius, spring + Math.sin(b) * radius, z];
      f(role, [[cx, spring, z], p, q], [0, 0, sign]);
      if (detail) {
        const outer = p.map((v, k) =>
            k === 0 ? cx + (v - cx) * 1.07 : k === 1 ? spring + (v - spring) * 1.07 : v,
          ),
          other = q.map((v, k) =>
            k === 0 ? cx + (v - cx) * 1.07 : k === 1 ? spring + (v - spring) * 1.07 : v,
          );
        f('trim', [p, q, other, outer], [0, 0, sign]);
      }
    }
    if (detail) {
      for (const x of [-radius, -radius / 3, radius / 3, radius])
        B('trim', cx + x, base, z + sign * 0.035, 0.075, stem, 0.07);
      B('trim', cx, spring, z + sign * 0.035, width, 0.075, 0.07);
      if (detail >= 2) B('trim', cx, base + stem * 0.5, z + sign * 0.04, width, 0.06, 0.07);
    }
  };
  const window = (x, y, z, width, height, sign = 1, side = false) => {
    const P = ([u, v, d]) => (side ? [x + d, y + v, z + u] : [x + u, y + v, z + d]),
      n = side ? [sign, 0, 0] : [0, 0, sign],
      panel = (role, x0, y0, x1, y1, d) =>
        f(
          role,
          [
            [x0, y0, d],
            [x1, y0, d],
            [x1, y1, d],
            [x0, y1, d],
          ].map(P),
          n,
        );
    panel('glass', -width / 2, 0, width / 2, height, sign * 0.035);
    for (const [a, b, c, d] of [
      [-width / 2 - 0.08, -0.08, -width / 2, height + 0.08],
      [width / 2, -0.08, width / 2 + 0.08, height + 0.08],
      [-width / 2, height, width / 2, height + 0.1],
      [-width / 2, -0.1, width / 2, 0.01],
    ])
      panel('trim', a, b, c, d, sign * 0.07);
    if (detail >= 2) {
      panel('trim', -0.035, 0, 0.035, height, sign * 0.09);
      panel('trim', -width / 2, height * 0.66, width / 2, height * 0.66 + 0.055, sign * 0.09);
    }
  };
  const body = (p, floor, height, key) => {
    const top = floor + height;
    cap('base', p, r.foundationY, true);
    cap('wall', p, top);
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        d = b.map((v, k) => (v - a[k]) / len),
        normal = [d[1], 0, -d[0]],
        point = (t, y, depth = 0) => [
          a[0] + d[0] * t - normal[0] * depth,
          y,
          a[1] + d[1] * t - normal[2] * depth,
        ];
      const door = r.entrances.find((e) => {
        if ((key === 'main') !== (e.x === 0)) return false;
        if (key !== 'main' && key !== `end${e.x > 0 ? 1 : -1}`) return false;
        if (e.side) return normal[0] > 0.8 && Math.abs(a[0] - e.x) < 0.5;
        return (
          normal[2] > 0.8 &&
          Math.abs((a[1] + b[1]) / 2 - e.z) < 0.5 &&
          e.x > Math.min(a[0], b[0]) &&
          e.x < Math.max(a[0], b[0])
        );
      });
      const t = door ? (door.side ? (door.z - a[1]) / d[1] : (door.x - a[0]) / d[0]) : 0,
        w = door ? (door.x === 0 ? 1.8 : 1.65) : 0,
        lo = door?.floorY,
        hi = door ? lo + (door.x === 0 ? 2.6 : door.side ? 2.3 : 1.8) : 0;
      for (const [role, low, high] of [
        ['base', r.foundationY, floor],
        ['wall', floor, top],
      ]) {
        const rectangles =
          !door || hi <= low || lo >= high
            ? [[0, len, low, high]]
            : [
                [0, t - w / 2, low, high],
                [t + w / 2, len, low, high],
                ...[
                  [low, Math.min(lo, high)],
                  [Math.max(hi, low), high],
                ]
                  .filter(([u, v]) => v - u > 1e-7)
                  .map(([u, v]) => [t - w / 2, t + w / 2, u, v]),
              ];
        for (const [x0, x1, y0, y1] of rectangles)
          if (x1 > x0 + 1e-7 && y1 > y0 + 1e-7)
            f(role, [point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)], normal);
      }
      if (door) {
        const deep = 0.4;
        for (const side of [-1, 1])
          f(
            'wall',
            [
              point(t + (side * w) / 2, lo),
              point(t + (side * w) / 2, hi),
              point(t + (side * w) / 2, hi, deep),
              point(t + (side * w) / 2, lo, deep),
            ],
            [-side * d[0], 0, -side * d[1]],
          );
        f(
          'trim',
          [
            point(t - w / 2, hi),
            point(t + w / 2, hi),
            point(t + w / 2, hi, deep),
            point(t - w / 2, hi, deep),
          ],
          [0, -1, 0],
        );
        f(
          door.x < 0 ? 'trim' : 'wood',
          [
            point(t - w / 2 + 0.04, lo, deep),
            point(t + w / 2 - 0.04, lo, deep),
            point(t + w / 2 - 0.04, hi - 0.04, deep),
            point(t - w / 2 + 0.04, hi - 0.04, deep),
          ],
          normal,
        );
        f(
          'base',
          [
            point(t - w / 2, lo),
            point(t + w / 2, lo),
            point(t + w / 2, lo, deep),
            point(t - w / 2, lo, deep),
          ],
          [0, 1, 0],
        );
        if (!door.side) {
          B('trim', door.x, hi + 0.08, door.z, 2.4, 0.18, 0.42);
          f(
            'trim',
            [
              [door.x - 1.3, hi + 0.2, door.z + 0.1],
              [door.x, hi + 0.8, door.z + 0.1],
              [door.x + 1.3, hi + 0.2, door.z + 0.1],
            ],
            [0, 0, 1],
          );
          f(
            'roof',
            [
              [door.x - 1.35, hi + 0.2, door.z + 0.22],
              [door.x, hi + 0.88, door.z + 0.22],
              [door.x, hi + 0.88, door.z - 0.5],
              [door.x - 1.35, hi + 0.2, door.z - 0.5],
            ],
            [-1, 1, 0],
          );
          f(
            'roof',
            [
              [door.x + 1.35, hi + 0.2, door.z + 0.22],
              [door.x, hi + 0.88, door.z + 0.22],
              [door.x, hi + 0.88, door.z - 0.5],
              [door.x + 1.35, hi + 0.2, door.z - 0.5],
            ],
            [1, 1, 0],
          );
        }
      }
    }
  };
  const dormer = (cx, front, base, width) => {
    const w = width / 2,
      z = front,
      peak = base + width * 0.65;
    for (const depth of [0, 1.3])
      f(
        'wall',
        [
          [cx - w, base, z - depth],
          [cx + w, base, z - depth],
          [cx + w, base + 0.65, z - depth],
          [cx, peak, z - depth],
          [cx - w, base + 0.65, z - depth],
        ],
        [0, 0, depth ? -1 : 1],
      );
    for (const sign of [-1, 1]) B('wall', cx + sign * w, base, z - 0.65, 0.12, 0.65, 1.3);
    for (const sign of [-1, 1]) {
      f(
        'roof',
        [
          [cx, peak + 0.1, z + 0.1],
          [cx, peak + 0.1, z - 1.3],
          [cx + sign * (w + 0.15), base + 0.5, z - 1.3],
          [cx + sign * (w + 0.15), base + 0.5, z + 0.1],
        ],
        [sign, 1, 0],
      );
    }
    if (detail) rounded(cx, base + 0.1, z + 0.04, width * 0.74, 0.1, 1);
  };
  const main = r.main[0],
    mb = bounds(main),
    mx = (mb.x0 + mb.x1) / 2;
  body(main, r.floorY, r.eave, 'main');
  const mainRoof = roof(main, r.floorY + r.eave, r.roofRise, 'gable');
  for (const sign of [-1, 1]) {
    const z = sign > 0 ? mb.z1 + 0.06 : mb.z0 - 0.06,
      eave = r.floorY + r.eave;
    f(
      'wall',
      [
        [mb.x0, eave, z],
        [mx, eave + r.roofRise, z],
        [mb.x1, eave, z],
      ],
      [0, 0, sign],
    );
    if (detail) rounded(mx, eave + 0.25, z + sign * 0.04, 3.1, 0.1, sign);
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? mb.x0 : mb.x1;
      f(
        'trim',
        [
          [x, eave - 0.05, z + sign * 0.1],
          [mx, eave + r.roofRise + 0.05, z + sign * 0.1],
          [mx, eave + r.roofRise + 0.23, z + sign * 0.1],
          [x, eave + 0.14, z + sign * 0.1],
        ],
        [0, 0, sign],
      );
    }
  }
  for (const p of r.parts) {
    const poly = p.polygons[0],
      b = bounds(poly),
      cx = (b.x0 + b.x1) / 2,
      eave = p.floorY + p.wallHeight;
    body(poly, p.floorY, p.wallHeight, p.kind + p.sign);
    roof(poly, eave, p.roofRise, p.kind);
    if (p.kind === 'end') dormer(cx, b.z1 - 1.7, eave + 0.65, 2.9);
    else dormer(p.sign * 14.5, b.z1 - 1.45, eave + 0.45, 1.7);
  }
  for (const [x, z, y] of [
    [2, -2, mainRoof.h([2, -2]) - 0.2],
    [27, -3, r.parts.find((p) => p.kind === 'end' && p.sign === 1).floorY + 6],
  ]) {
    B('wall', x, y, z, 0.65, 1.35, 0.65);
    B('trim', x, y + 1.12, z, 0.78, 0.14, 0.78);
    B('roof', x, y + 1.3, z, 0.86, 0.13, 0.86);
  }
  for (const a of r.aprons)
    prism(f, 'base', { outline: a.outline, holes: [] }, r.foundationY, a.top);
  for (const s of r.steps) prism(f, 'base', { outline: s.outline, holes: [] }, s.base, s.top);
  if (!detail) return;
  for (const sign of [-1, 1]) {
    const z = sign > 0 ? mb.z1 + 0.07 : mb.z0 - 0.07;
    for (const x of [-3.7, 0, 3.7]) {
      if (sign < 0 || x !== 0) window(x, r.floorY + 0.5, z, 1.05, 1.6, sign);
      if (x === 0) rounded(x, r.floorY + 3.9, z, 1.05, 1.1, sign);
      else window(x, r.floorY + 3.85, z, 1.05, 1.7, sign);
    }
    B('trim', mx, r.floorY + 3.2, z, 11.7, 0.18, 0.24);
    B('trim', mx, r.floorY + 6.35, z, 12.1, 0.25, 0.28);
  }
  for (const p of r.parts) {
    const poly = p.polygons[0],
      b = bounds(poly),
      floor = p.floorY,
      cx = (b.x0 + b.x1) / 2,
      atX = (x, sign) => {
        const zs = [];
        for (let i = 0; i < poly.outline.length; i++) {
          const a = poly.outline[i],
            b = poly.outline[(i + 1) % poly.outline.length];
          if (Math.abs(b[0] - a[0]) < 1e-8) continue;
          const t = (x - a[0]) / (b[0] - a[0]);
          if (t >= 0 && t <= 1) zs.push(a[1] + (b[1] - a[1]) * t);
        }
        return (sign > 0 ? Math.max(...zs) : Math.min(...zs)) + sign * 0.055;
      };
    for (const sign of [-1, 1]) {
      const z = sign > 0 ? b.z1 + 0.055 : b.z0 - 0.055,
        xs = p.kind === 'end' ? [cx - 2.2, cx + 2.2] : [p.sign * 9, p.sign * 14, p.sign * 19];
      for (const x of xs) {
        const actualZ = atX(x, sign);
        window(x, floor + 0.65, actualZ, 1.05, 1.55, sign);
        if (p.kind === 'end')
          window(x, Math.max(r.foundationY + 0.12, floor - 0.8), actualZ, 0.95, 0.58, sign);
      }
      B('trim', cx, floor + p.wallHeight - 0.1, z, b.x1 - b.x0 + 0.2, 0.22, 0.24);
    }
    if (p.kind === 'end') {
      const side = p.sign > 0 ? b.x1 + 0.07 : b.x0 - 0.07;
      for (const z of [-5.2, 3.5]) window(side, floor + 0.65, z, 1.05, 1.55, p.sign, true);
    }
  }
  if (detail >= 2) {
    for (const [x, z, h, floor] of [
      [mb.x0 + 0.2, mb.z1, 6.5, r.floorY],
      [mb.x1 - 0.2, mb.z1, 6.5, r.floorY],
      ...r.parts
        .filter((p) => p.kind === 'end')
        .flatMap((p) => {
          const b = bounds(p.polygons[0]);
          return [
            [b.x0 + 0.3, b.z1, 4.2, p.floorY],
            [b.x1 - 0.3, b.z1, 4.2, p.floorY],
          ];
        }),
    ]) {
      for (let i = 0; i < Math.floor(h / 0.45); i++)
        B('trim', x, floor + i * 0.45, z + 0.08, 0.85, 0.055, 0.12);
      B('roof', x + 0.5, r.foundationY, z + 0.12, 0.085, floor + h - r.foundationY, 0.085);
    }
    for (const x of [-4.9, 4.9]) B('trim', x, r.floorY + 0.15, mb.z1 + 0.09, 0.35, 6.25, 0.16);
    if (detail === 3)
      for (const x of [-3.6, 3.6]) {
        const y = r.floorY + 3.1,
          z = mb.z1 + 0.1,
          n = 12;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2,
            b = ((i + 1) / n) * Math.PI * 2;
          f(
            'trim',
            [
              [x, y, z],
              [x + Math.cos(a) * 0.24, y + Math.sin(a) * 0.24, z],
              [x + Math.cos(b) * 0.24, y + Math.sin(b) * 0.24, z],
            ],
            [0, 0, 1],
          );
        }
      }
  }
}
