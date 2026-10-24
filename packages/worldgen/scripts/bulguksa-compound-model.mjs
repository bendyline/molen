/** Bulguksa's mapped halls, raised courts, entrance bridges and distinct stone pagodas. */
export const bulguksaCandidateId = 'bulguksa';
const ring = (x, z, y) => [
  [-x, y, -z],
  [x, y, -z],
  [x, y, z],
  [-x, y, z],
];
function box(f, role, x, y, z, w, h, d) {
  const ps = ring(w / 2, d / 2, y).map((p) => [p[0] + x, p[1], p[2] + z]),
    qs = ps.map((p) => [p[0], y + h, p[2]]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      role,
      [ps[i], ps[j], qs[j], qs[i]],
      [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i],
    );
  }
  f(role, qs, [0, 1, 0]);
  f(role, ps, [0, -1, 0]);
}
function cylinder(f, role, x, y, z, r, h, n) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      p = [x + Math.cos(a) * r, y, z + Math.sin(a) * r],
      q = [x + Math.cos(b) * r, y, z + Math.sin(b) * r],
      s = [p[0], y + h, p[2]],
      t = [q[0], y + h, q[2]];
    f(role, [p, q, t, s], [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
    // Timber posts terminate inside the plinth and crossbeam.
    if (role !== 'wood') {
      f(role, [[x, y, z], q, p], [0, -1, 0]);
      f(role, [[x, y + h, z], s, t], [0, 1, 0]);
    }
  }
}
function facade(f, role, level, x, y, z, w, h, depth) {
  if (level !== 1) return box(f, role, x, y, z, w, h, depth);
  // At district distance the opaque wall supplies the panel's backing.
  if (w > depth) {
    const side = Math.sign(z),
      front = z + (side * depth) / 2;
    f(
      role,
      [
        [x - w / 2, y, front],
        [x + w / 2, y, front],
        [x + w / 2, y + h, front],
        [x - w / 2, y + h, front],
      ],
      [0, 0, side],
    );
  } else {
    const side = Math.sign(x),
      front = x + (side * w) / 2;
    f(
      role,
      [
        [front, y, z - depth / 2],
        [front, y, z + depth / 2],
        [front, y + h, z + depth / 2],
        [front, y + h, z - depth / 2],
      ],
      [side, 0, 0],
    );
  }
}
function beam(f, role, a, b, width) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2],
    length = Math.hypot(dx, dz);
  if (length < 1e-6) return;
  const nx = ((-dz / length) * width) / 2,
    nz = ((dx / length) * width) / 2,
    ps = [
      [a[0] + nx, a[1], a[2] + nz],
      [b[0] + nx, b[1], b[2] + nz],
      [b[0] - nx, b[1], b[2] - nz],
      [a[0] - nx, a[1], a[2] - nz],
    ],
    qs = ps.map((p) => [p[0], p[1] + width, p[2]]);
  f(role, qs, [0, 1, 0]);
  f(role, ps, [0, -1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      role,
      [ps[i], ps[j], qs[j], qs[i]],
      [ps[i][0] + ps[j][0] - (a[0] + b[0]), -dy, ps[i][2] + ps[j][2] - (a[2] + b[2])],
    );
  }
}
function roof(f, L, W, eave, d, role = 'roof') {
  const rise = W * 0.19,
    ix = Math.max(0.3, L / 2 - Math.min(0.7, L * 0.1)),
    iz = W * 0.22;
  if (d === 0) {
    const p = ring(L / 2, W / 2, eave),
      a = [-L * 0.3, eave + rise, 0],
      b = [L * 0.3, eave + rise, 0];
    f(role, [p[0], p[1], b, a], [0, 1, -1]);
    f(role, [p[3], p[2], b, a], [0, 1, 1]);
    f(role, [p[0], p[3], a], [-1, 1, 0]);
    f(role, [p[1], p[2], b], [1, 1, 0]);
    return;
  }
  const segments = d === 1 ? 1 : d === 2 ? 2 : 3,
    ts = d === 1 ? [0, 0.5, 1] : [0, 0.22, 0.48, 0.74, 1],
    rows = [];
  for (const t of ts) {
    const x = L / 2 + (ix - L / 2) * t,
      z = W / 2 + (iz - W / 2) * t,
      ps = [];
    for (let side = 0; side < 4; side++)
      for (let k = 0; k < segments; k++) {
        const u = k / segments,
          corners = ring(1, 1, 0),
          a = corners[side],
          b = corners[(side + 1) % 4],
          nx = a[0] + (b[0] - a[0]) * u,
          nz = a[2] + (b[2] - a[2]) * u;
        ps.push([
          nx * x,
          eave +
            rise * 0.55 * t +
            0.38 * Math.pow(1 - t, 2) * Math.pow(Math.abs(nx * nz), 2) -
            0.13 * Math.sin(Math.PI * t),
          nz * z,
        ]);
      }
    rows.push(ps);
  }
  for (let k = 1; k < rows.length; k++)
    for (let i = 0; i < rows[k].length; i++) {
      const j = (i + 1) % rows[k].length;
      f(
        role,
        [rows[k - 1][i], rows[k - 1][j], rows[k][j], rows[k][i]],
        [rows[k][i][0], 1, rows[k][i][2]],
      );
    }
  const a = [-ix, eave + rise, 0],
    b = [ix, eave + rise, 0],
    lo = ring(ix, iz, eave + rise * 0.55);
  f(role, [lo[0], lo[1], b, a], [0, 1, -1]);
  f(role, [lo[3], lo[2], b, a], [0, 1, 1]);
  f('trim', [lo[0], lo[3], a], [-1, 0, 0]);
  f('trim', [lo[1], lo[2], b], [1, 0, 0]);
  f(role, ring(L / 2, W / 2, eave - 0.12), [0, -1, 0]);
  const flat = ring(L / 2, W / 2, eave - 0.12);
  for (let side = 0; side < 4; side++)
    for (let k = 0; k < segments; k++) {
      const i = side * segments + k,
        j = (i + 1) % (4 * segments),
        a = flat[side],
        b = flat[(side + 1) % 4],
        p = [a[0] + ((b[0] - a[0]) * k) / segments, a[1], a[2] + ((b[2] - a[2]) * k) / segments],
        q = [
          a[0] + ((b[0] - a[0]) * (k + 1)) / segments,
          a[1],
          a[2] + ((b[2] - a[2]) * (k + 1)) / segments,
        ];
      f(
        role,
        [p, q, rows[0][j], rows[0][i]],
        [
          [0, 0, -1],
          [1, 0, 0],
          [0, 0, 1],
          [-1, 0, 0],
        ][side],
      );
    }
  if (d >= 2) {
    box(f, role, 0, eave + rise, 0, ix * 2 + 0.3, 0.18, 0.22);
    for (const sign of [-1, 1])
      beam(
        f,
        role,
        [sign * ix, eave + rise, 0.0],
        [sign * (L / 2 - 0.1), eave + 0.45, W / 2 - 0.12],
        0.14,
      );
  }
}
function hall(f, h, b, d) {
  const cx = (b[0] + b[2]) / 2,
    cz = (b[1] + b[3]) / 2,
    swap = b[3] - b[1] > b[2] - b[0],
    L = swap ? b[3] - b[1] : b[2] - b[0],
    W = swap ? b[2] - b[0] : b[3] - b[1],
    a = h.angle + (swap ? Math.PI / 2 : 0),
    c = Math.cos(a),
    s = Math.sin(a),
    hc = Math.cos(h.angle),
    hs = Math.sin(h.angle),
    o = [h.origin[0] + cx * hc - cz * hs, h.origin[1] + cx * hs + cz * hc],
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [o[0] + x * c - z * s, h.baseY + y, o[1] + x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      );
  const w = Math.max(0.3, L - 2),
    dep = Math.max(0.3, W - 2),
    open = ['gallery', 'gate', 'pavilion'].includes(h.kind),
    eave = h.eaveHeight + h.plinth;
  if (W > 2.4) {
    if (d === 0) box(at, 'wood', 0, 0, 0, w, eave - 0.3, dep);
    else {
      box(at, 'stone', 0, 0, 0, w + 0.5, h.plinth, dep + 0.5);
      if (!open) box(at, 'wood', 0, h.plinth, 0, w, eave - h.plinth - 0.3, dep);
    }
    if (d > 0) {
      const bays =
          d === 1
            ? open
              ? Math.max(1, Math.ceil(w / 15))
              : 1
            : Math.max(2, Math.ceil(w / (d === 2 ? 6 : 3.3))),
        sides = d === 1 ? 4 : d === 2 ? 6 : 8;
      for (let i = 0; i <= bays; i++)
        for (const z of [-dep / 2, dep / 2]) {
          const x = -w / 2 + (w * i) / bays;
          cylinder(at, 'wood', x, h.plinth, z, 0.18, eave - h.plinth - 0.18, sides);
          if (d >= 2 && (d >= 3 || i % 2 === 0)) {
            box(at, 'trim', x, eave - 0.65, z, 0.8, 0.2, 0.7);
            box(at, 'trim', x, eave - 0.4, z, 1.05, 0.2, 1.0);
            if (d >= 3) box(at, 'wood', x, eave - 0.2, z, 1.25, 0.15, 1.15);
          }
        }
      for (const z of [-dep / 2, dep / 2]) {
        facade(at, 'trim', d, 0, eave - 0.4, z, w + 0.5, 0.3, 0.35);
        if (!open)
          for (let i = 0; i < bays; i++) {
            const x = -w / 2 + (w * (i + 0.5)) / bays;
            facade(
              at,
              'panel',
              d,
              x,
              h.plinth + 0.55,
              z + Math.sign(z) * 0.025,
              (w / bays) * 0.78,
              Math.max(0.2, eave - h.plinth - 1.4),
              0.08,
            );
            if (d >= 3)
              for (const shift of [-0.22, 0, 0.22])
                box(
                  at,
                  'wood',
                  x + (shift * w) / bays,
                  h.plinth + 0.5,
                  z + Math.sign(z) * 0.08,
                  0.055,
                  eave - h.plinth - 1.2,
                  0.07,
                );
          }
      }
      if (!open)
        for (const x of [-w / 2, w / 2]) {
          facade(at, 'trim', d, x, eave - 0.4, 0, 0.35, 0.3, dep + 0.4);
          for (const z of [-dep * 0.25, dep * 0.25])
            facade(
              at,
              'panel',
              d,
              x + Math.sign(x) * 0.025,
              h.plinth + 0.55,
              z,
              0.08,
              Math.max(0.2, eave - h.plinth - 1.4),
              dep * 0.38,
            );
        }
    }
  }
  roof(at, L, W, eave, d);
}
function stairs(f, d, width, z0, z1, y0, y1, count) {
  const n =
    d === 0
      ? 1
      : d === 1
        ? Math.max(2, Math.ceil(count / 3))
        : d === 2
          ? Math.ceil(count / 2)
          : count;
  for (let i = 0; i < n; i++) {
    const a = z0 + ((z1 - z0) * i) / n,
      b = z0 + ((z1 - z0) * (i + 1)) / n,
      ya = y0 + ((y1 - y0) * i) / n,
      yb = y0 + ((y1 - y0) * (i + 1)) / n;
    f(
      'stone',
      [
        [-width / 2, ya, a],
        [width / 2, ya, a],
        [width / 2, yb, b],
        [-width / 2, yb, b],
      ],
      [0, 1, 0],
    );
    if (d > 0)
      f(
        'stone',
        [
          [-width / 2, ya, a],
          [width / 2, ya, a],
          [width / 2, ya - 0.18, a],
          [-width / 2, ya - 0.18, a],
        ],
        [0, 0, 1],
      );
  }
}
function bridge(f, b, d) {
  const c = Math.cos(b.angle),
    s = Math.sin(b.angle),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [b.point[0] + x * c - z * s, y, b.point[1] + x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    mid = (b.top + b.bottom) / 2,
    za = b.run * 0.44,
    zb = b.run * 0.56;
  stairs(at, d, b.width, 0, za, b.top, mid, b.steps[0]);
  stairs(at, d, b.width, zb, b.run, mid, b.bottom, b.steps[1]);
  box(at, 'stone', 0, mid - 0.3, (za + zb) / 2, b.width, 0.3, zb - za);
  if (b.arch) {
    const radius = Math.min(1.6, (mid - b.bottom) * 0.65),
      spring = mid - 0.45 - radius,
      z = (za + zb) / 2,
      n = d === 0 ? 4 : d === 1 ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        bb = ((i + 1) * Math.PI) / n,
        inner = (t) => [z + Math.cos(t) * radius, spring + Math.sin(t) * radius],
        outer = (t) => [z + Math.cos(t) * (radius + 0.42), spring + Math.sin(t) * (radius + 0.42)],
        p = inner(a),
        q = inner(bb),
        u = outer(a),
        v = outer(bb);
      for (const x of [-b.width / 2, b.width / 2])
        at(
          'stone',
          [
            [x, p[1], p[0]],
            [x, q[1], q[0]],
            [x, v[1], v[0]],
            [x, u[1], u[0]],
          ],
          [Math.sign(x), 0, 0],
        );
      at(
        'stone',
        [
          [-b.width / 2, p[1], p[0]],
          [b.width / 2, p[1], p[0]],
          [b.width / 2, q[1], q[0]],
          [-b.width / 2, q[1], q[0]],
        ],
        [0, -Math.sin((a + bb) / 2), -Math.cos((a + bb) / 2)],
      );
      at(
        'stone',
        [
          [-b.width / 2, u[1], u[0]],
          [b.width / 2, u[1], u[0]],
          [b.width / 2, v[1], v[0]],
          [-b.width / 2, v[1], v[0]],
        ],
        [0, Math.sin((a + bb) / 2), Math.cos((a + bb) / 2)],
      );
    }
    for (const sign of [-1, 1])
      box(
        at,
        'stone',
        0,
        b.bottom - 0.35,
        z + sign * (radius + 0.42),
        b.width,
        Math.max(0.5, spring - b.bottom + 0.35),
        0.84,
      );
  } else
    for (const z of [za - 0.45, zb + 0.45])
      for (const x of [-b.width / 2 + 0.25, b.width / 2 - 0.25])
        box(at, 'stone', x, b.bottom - 0.35, z, 0.5, mid - b.bottom + 0.35, 0.7);
  if (d === 0) return;
  for (const sign of [-1, 1]) {
    const x = sign * (b.width / 2 + 0.1),
      nodes = [
        [x, b.top + 0.8, 0],
        [x, mid + 0.8, za],
        [x, mid + 0.8, zb],
        [x, b.bottom + 0.8, b.run],
      ];
    for (let k = 1; k < nodes.length; k++) beam(at, 'stone', nodes[k - 1], nodes[k], 0.16);
    const n = d < 2 ? 3 : 7;
    for (let i = 0; i <= n; i++) {
      const z = (b.run * i) / n,
        y =
          z < za
            ? b.top + ((mid - b.top) * z) / za
            : z < zb
              ? mid
              : mid + ((b.bottom - mid) * (z - zb)) / (b.run - zb);
      box(at, 'stone', x, y - 0.05, z, 0.23, 0.98, 0.23);
    }
  }
}
function stoneCap(f, w, y, rise, d) {
  const a = ring(w / 2, w / 2, y),
    b = ring(w * 0.25, w * 0.25, y + rise);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      'stone',
      [a[i], a[j], b[j], b[i]],
      [
        [0, 1, -1],
        [1, 1, 0],
        [0, 1, 1],
        [-1, 1, 0],
      ][i],
    );
  }
  f('stone', b, [0, 1, 0]);
  if (d > 0) box(f, 'stone', 0, y - 0.12, 0, w, 0.12, w);
}
function pagoda(f, p, d, axis) {
  const c = Math.cos(axis),
    s = Math.sin(axis),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [
          p.point[0] + x * c - z * s,
          p.baseY + y,
          p.point[1] + x * s + z * c,
        ]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    n = d === 0 ? 4 : d === 1 ? 6 : 10;
  if (d <= 1) {
    const profile = (levels) => {
      for (let k = 1; k < levels.length; k++) {
        const a = ring(levels[k - 1][1], levels[k - 1][1], levels[k - 1][0]);
        const b = ring(levels[k][1], levels[k][1], levels[k][0]);
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          at(
            'stone',
            [a[i], a[j], b[j], b[i]],
            [
              [0, 0.2, -1],
              [1, 0.2, 0],
              [0, 0.2, 1],
              [-1, 0.2, 0],
            ][i],
          );
        }
      }
      at('stone', ring(levels.at(-1)[1], levels.at(-1)[1], levels.at(-1)[0]), [0, 1, 0]);
    };
    if (p.kind === 'solid')
      profile([
        [0, 2.2],
        [1.4, 2],
        [1.4, 1.15],
        [3.2, 1.85],
        [4.4, 1.45],
        [5.4, 1.1],
        [8.2, 0.04],
      ]);
    else if (p.kind === 'open') {
      box(at, 'stone', 0, 0, 0, 5.6, 1.8, 5.6);
      for (const x of [-1.35, 1.35])
        for (const z of [-1.35, 1.35]) box(at, 'stone', x, 1.8, z, 0.55, 2.75, 0.55);
      stoneCap(at, 5.1, 4.55, 0.65, 0);
      profile([
        [5.2, 1.5],
        [6.2, 1.1],
        [7.6, 0.8],
        [8.3, 1.3],
        [10.4, 0.04],
      ]);
    } else
      profile([
        [0, 0.7],
        [0.3, 0.4],
        [1.4, 0.65],
        [1.8, 0.75],
        [2.1, 0.05],
      ]);
    return;
  }
  if (p.kind === 'solid') {
    for (const [w, y, h] of [
      [4.4, 0, 0.35],
      [4, 0.35, 0.9],
      [4.3, 1.25, 0.2],
      [2.3, 1.45, 1.5],
      [1.7, 3.5, 0.7],
      [1.2, 4.65, 0.5],
    ])
      box(at, 'stone', 0, y, 0, w, h, w);
    stoneCap(at, 3.7, 2.95, 0.55, d);
    stoneCap(at, 2.9, 4.2, 0.45, d);
    stoneCap(at, 2.2, 5.15, 0.35, d);
    const count = d === 0 ? 3 : 8;
    for (let i = 0; i < count; i++)
      cylinder(at, 'stone', 0, 5.5 + (i * 2.7) / count, 0, 0.35 * (1 - i / count) + 0.06, 0.18, n);
    cylinder(at, 'stone', 0, 5.5, 0, 0.08, 2.7, n);
  } else if (p.kind === 'open') {
    box(at, 'stone', 0, 0, 0, 5.6, 0.35, 5.6);
    box(at, 'stone', 0, 0.35, 0, 3.3, 1.35, 3.3);
    box(at, 'stone', 0, 1.7, 0, 4, 0.25, 4);
    for (const x of [-1.35, 1.35])
      for (const z of [-1.35, 1.35]) box(at, 'stone', x, 1.95, z, 0.55, 2.6, 0.55);
    stoneCap(at, 5.1, 4.55, 0.65, d);
    box(at, 'stone', 0, 5.2, 0, 3.2, 0.25, 3.2);
    if (d > 0) {
      for (const x of [-1.3, 1.3])
        for (const z of [-1.3, 1.3]) box(at, 'stone', x, 5.45, z, 0.18, 0.8, 0.18);
      for (const z of [-1.3, 1.3]) box(at, 'stone', 0, 6.0, z, 2.8, 0.15, 0.15);
      for (const x of [-1.3, 1.3]) box(at, 'stone', x, 6.0, 0, 0.15, 0.15, 2.8);
    }
    cylinder(at, 'stone', 0, 6.15, 0, 1.02, 0.65, n);
    cylinder(at, 'stone', 0, 6.8, 0, 0.7, 0.8, n);
    stoneCap(at, 2.6, 7.6, 0.7, d);
    for (let i = 0; i < (d === 0 ? 3 : 6); i++)
      cylinder(
        at,
        'stone',
        0,
        8.3 + (i * 2.1) / (d === 0 ? 3 : 6),
        0,
        0.35 * (1 - i / (d === 0 ? 3 : 6)) + 0.07,
        0.2,
        n,
      );
    cylinder(at, 'stone', 0, 8.3, 0, 0.07, 2.1, n);
    if (d > 0)
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          co = Math.cos(a),
          si = Math.sin(a),
          face = (role, ps, n) =>
            at(
              role,
              ps.map(([x, y, z]) => [x * co - z * si, y, x * si + z * co]),
              [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
            );
        stairs(face, d, 1.25, 2.8, 1.65, 0.35, 1.7, 6);
      }
  } else {
    cylinder(at, 'stone', 0, 0, 0, 0.7, 0.25, n);
    cylinder(at, 'stone', 0, 0.25, 0, 0.4, 0.5, n);
    cylinder(at, 'stone', 0, 0.75, 0, 0.65, 0.7, n);
    stoneCap(at, 1.5, 1.45, 0.4, d);
    cylinder(at, 'stone', 0, 1.85, 0, 0.15, 0.25, n);
  }
}
export function buildBulguksa(f, d, r) {
  // A lower occupied pocket can expose a neighboring terrace's foundation.
  // Continue retaining faces below every pocket, rather than stopping at DEM endpoints.
  const foundationBase =
    Math.min(
      ...r.renderFloors.flatMap((floor) => floor.edges.flatMap((e) => [e.bottomA, e.bottomB])),
    ) - 0.5;
  for (const floor of r.renderFloors) {
    for (const t of floor.triangles)
      f(
        'ground',
        t.map((p) => [p[0], floor.height, p[1]]),
        [0, 1, 0],
      );
    for (const e of floor.edges)
      f(
        'stone',
        [
          [e.a[0], floor.height, e.a[1]],
          [e.b[0], floor.height, e.b[1]],
          [e.b[0], foundationBase, e.b[1]],
          [e.a[0], foundationBase, e.a[1]],
        ],
        [e.b[1] - e.a[1], 0, e.a[0] - e.b[0]],
      );
    // The coarse DEM may stand above the walk beneath an entrance bridge.
    // Inward retaining faces close that cut bank without filling the open vault.
    for (const edge of floor.cutBanks ?? [])
      f(
        'stone',
        [
          [edge.a[0], floor.height, edge.a[1]],
          [edge.b[0], floor.height, edge.b[1]],
          [edge.b[0], edge.topB, edge.b[1]],
          [edge.a[0], edge.topA, edge.a[1]],
        ],
        [edge.a[1] - edge.b[1], 0, edge.b[0] - edge.a[0]],
      );
  }
  for (const h of r.halls) for (const b of h.rectangles) hall(f, h, b, d);
  for (const b of r.bridges) bridge(f, b, d);
  for (const p of r.pagodas) pagoda(f, p, d, r.mainAxisRadians);
}
