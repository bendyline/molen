/** N0527: granite entrance, red arched compound and slender pagoda at A-Ma. */
import earcut from 'earcut';
export const amaCandidateId = 'N0527';
function prism(f, role, p, lo, hi) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, lo, z]),
    high = flat.map(([x, z]) => [x, hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => low[k]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
function lathe(f, role, x, z, profile, n, flutes = 0) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (1 - (flutes ? (0.028 * (1 + Math.cos(a * flutes))) / 2 : 0));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
const B = (f, role, x, y, z, w, h, d) => prism(f, role, rect(x, z, w, d), y, y + h);
function ellipsoid(f, role, x, y, z, rx, ry, rz, n, bands) {
  const G = (role, ps, target) =>
    f(
      role,
      ps.map(([u, v, w]) => [x + u * rx, y + v * ry, z + w * rz]),
      [target[0] / rx, target[1] / ry, target[2] / rz],
    );
  lathe(
    G,
    role,
    0,
    0,
    Array.from({ length: bands + 1 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / bands;
      return [Math.sin(a), Math.max(0.005, Math.cos(a))];
    }),
    n,
  );
}
function xyPrism(f, role, outline, holes, z0, z1) {
  const rings = [outline, ...holes],
    flat = rings.flat(),
    starts = [];
  let k = outline.length;
  for (const h of holes) {
    starts.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), starts),
    front = flat.map(([x, y]) => [x, y, z1]),
    back = flat.map(([x, y]) => [x, y, z0]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => front[k]),
      [0, 0, 1],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => back[k]),
      [0, 0, -1],
    );
  }
  let o = 0;
  for (let ri = 0; ri < rings.length; ri++) {
    const r = rings[ri],
      area = r.reduce((s, a, i) => {
        const b = r[(i + 1) % r.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sign = Math.sign(area) * (ri ? -1 : 1);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      f(
        role,
        [front[o + i], front[o + j], back[o + j], back[o + i]],
        [(r[j][1] - r[i][1]) * sign, (r[i][0] - r[j][0]) * sign, 0],
      );
    }
    o += r.length;
  }
}
function archFacade(
  f,
  width,
  height,
  z,
  opening,
  spring,
  detail,
  role = 'plaster',
  windows = false,
) {
  const count = [4, 8, 12, 18][detail],
    r = opening / 2,
    outline = [
      [-width / 2, 0],
      [-r, 0],
      ...Array.from({ length: count + 1 }, (_, i) => {
        const a = Math.PI - (i * Math.PI) / count;
        return [r * Math.cos(a), spring + r * Math.sin(a)];
      }),
      [r, 0],
      [width / 2, 0],
      [width / 2, height],
      [-width / 2, height],
    ],
    holes = windows
      ? [
          [-3.7, -2.1],
          [2.1, 3.7],
        ].map(([a, b]) => [
          [a, 0.7],
          [b, 0.7],
          [b, 2.75],
          [a, 2.75],
        ])
      : [];
  xyPrism(f, role, outline, holes, z - 0.6, z);
  if (detail >= 1) {
    for (const side of [-1, 1]) B(f, 'stone', side * (r + 0.13), 0.05, z + 0.08, 0.24, spring, 0.2);
    for (let i = 0; i < count; i++) {
      const a = Math.PI - (i * Math.PI) / count,
        b = Math.PI - ((i + 1) * Math.PI) / count,
        shape = [
          [r * Math.cos(a), spring + r * Math.sin(a)],
          [(r + 0.26) * Math.cos(a), spring + (r + 0.26) * Math.sin(a)],
          [(r + 0.26) * Math.cos(b), spring + (r + 0.26) * Math.sin(b)],
          [r * Math.cos(b), spring + r * Math.sin(b)],
        ];
      xyPrism(f, 'stone', shape, [], z - 0.02, z + 0.17);
    }
    if (windows)
      for (const side of [-1, 1]) {
        const x = side * 2.9;
        for (const edge of [-1, 1]) B(f, 'stone', x + edge * 0.88, 0.55, z + 0.1, 0.16, 2.38, 0.18);
        B(f, 'stone', x, 0.55, z + 0.1, 1.9, 0.15, 0.18);
        B(f, 'stone', x, 2.82, z + 0.1, 1.9, 0.15, 0.18);
        if (detail >= 2) {
          for (let k = 0; k < 4; k++)
            B(f, 'timber', x - 0.6 + k * 0.4, 0.7, z - 0.05, 0.07, 2.05, 0.12);
          for (let k = 0; k < 6; k++) B(f, 'timber', x, 0.82 + k * 0.34, z - 0.05, 1.6, 0.07, 0.12);
        }
      }
  }
}
function roof(f, part, detail, role = 'roof', overhang = 0.65) {
  const w = part.width + overhang * 2,
    d = part.depth + overhang * 2,
    H = part.bodyHeight,
    rise = part.roofRise,
    nu = [2, 4, 8, 12][detail],
    nv = [1, 2, 4, 6][detail],
    at = (u, v) => [
      u,
      H + rise * Math.pow(1 - Math.abs(v) / (d / 2), 2) + 0.48 * Math.pow(Math.abs(u) / (w / 2), 4),
      v,
    ];
  for (const side of [-1, 1])
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = -w / 2 + (i * w) / nu,
          b = a + w / nu,
          v = (side * j * d) / 2 / nv,
          V = (side * (j + 1) * d) / 2 / nv;
        f(role, [at(a, v), at(b, v), at(b, V), at(a, V)], [0, 1, 0]);
      }
  const rim = [];
  for (let i = 0; i <= nu; i++) rim.push(at(-w / 2 + (i * w) / nu, -d / 2));
  for (let j = 1; j <= nv * 2; j++) rim.push(at(w / 2, -d / 2 + (j * d) / (nv * 2)));
  for (let i = 1; i <= nu; i++) rim.push(at(w / 2 - (i * w) / nu, d / 2));
  for (let j = 1; j < nv * 2; j++) rim.push(at(-w / 2, d / 2 - (j * d) / (nv * 2)));
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i],
      b = rim[(i + 1) % rim.length];
    f(
      'timber',
      [[a[0], H - 0.12, a[2]], [b[0], H - 0.12, b[2]], b, a],
      [b[2] - a[2], 0, a[0] - b[0]],
    );
  }
  f(
    'timber',
    rect(0, 0, w, d).outline.map(([u, v]) => [u, H - 0.12, v]),
    [0, -1, 0],
  );
}
function tube(f, role, points, radius, detail) {
  const n = detail >= 2 ? 6 : 4,
    rings = points.map((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)],
        t = b.map((v, k) => v - a[k]),
        length = Math.hypot(...t);
      for (let k = 0; k < 3; k++) t[k] /= length;
      let u = [t[2], 0, -t[0]],
        ul = Math.hypot(...u);
      if (ul < 0.01) {
        u = [1, 0, 0];
        ul = 1;
      }
      u = u.map((v) => v / ul);
      const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
      return Array.from({ length: n }, (_, k) => {
        const a = (k * Math.PI * 2) / n;
        return p.map((q, j) => q + radius * (u[j] * Math.cos(a) + v[j] * Math.sin(a)));
      });
    });
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n,
        normal = rings[i][k].map((v, q) => v - points[i][q]);
      f(role, [rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]], normal);
    }
  f(
    role,
    rings[0],
    points[0].map((v, k) => v - points[1][k]),
  );
  f(
    role,
    rings.at(-1),
    points.at(-1).map((v, k) => v - points.at(-2)[k]),
  );
}
function crest(f, width, y, detail) {
  if (detail === 0) return;
  const count = detail >= 2 ? 10 : 5;
  for (const side of [-1, 1]) {
    const pts = Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      return [
        side * (0.7 + t * (width * 0.42 - 0.7)),
        y + 0.15 + 0.85 * Math.pow(t, 2) + 0.25 * Math.sin(t * Math.PI * 2),
        0,
      ];
    });
    tube(f, 'roof', pts, 0.13, detail);
    const head = pts[1];
    ellipsoid(f, 'gold', head[0], head[1] + 0.2, 0, 0.21, 0.21, 0.18, detail >= 2 ? 8 : 6, 3);
  }
  lathe(
    f,
    'gold',
    0,
    0,
    [
      [y, 0.21],
      [y + 0.45, 0.17],
      [y + 0.6, 0.24],
      [y + 0.9, 0.05],
    ],
    detail >= 2 ? 8 : 6,
  );
  ellipsoid(f, 'roof', 0, y + 1.1, 0, 0.2, 0.2, 0.2, detail >= 2 ? 8 : 6, 3);
}
function lion(f, x, z, Y, detail, base) {
  const G = (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, v]) => [x + u, Y + y, z + v]),
      n,
    );
  B(G, 'stone', 0, base - Y, 0, 0.9, Y - base + 0.35, 1.05);
  if (detail === 0) {
    B(G, 'stone', 0, 0.35, 0, 0.65, 1, 0.7);
    return;
  }
  const n = detail >= 2 ? 10 : 6;
  ellipsoid(G, 'stone', 0, 0.8, -0.08, 0.36, 0.52, 0.4, n, 4);
  ellipsoid(G, 'stone', 0, 1.36, 0.18, 0.36, 0.34, 0.33, n, 4);
  ellipsoid(G, 'stone', 0, 1.31, 0.43, 0.22, 0.17, 0.2, n, 3);
  for (const side of [-1, 1]) {
    B(G, 'stone', side * 0.22, 0.35, 0.33, 0.23, 0.18, 0.65);
    ellipsoid(G, 'stone', side * 0.25, 1.59, 0.1, 0.12, 0.13, 0.11, n, 3);
  }
}
function pagoda(f, p, detail) {
  const [x, z] = p.center,
    G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + u, p.floorY + y, z + v]),
        n,
      ),
    n = detail >= 2 ? 8 : 6;
  B(G, 'stone', 0, p.foundationBase - p.floorY, 0, 2.5, p.floorY - p.foundationBase + 0.28, 2.5);
  const tiers = detail === 0 ? 4 : p.tiers;
  for (let k = 0; k < tiers; k++) {
    const y = 0.28 + (k * (p.height - 0.7)) / tiers,
      r = 1.07 * (1 - (0.65 * k) / tiers),
      h = (p.height - 0.7) / tiers;
    lathe(
      G,
      'plaster',
      0,
      0,
      [
        [y, r],
        [y + h * 0.77, r * 0.96],
      ],
      n,
    );
    lathe(
      G,
      'roof',
      0,
      0,
      [
        [y + h * 0.72, r * 1.23],
        [y + h * 0.92, r * 0.8],
      ],
      n,
    );
    if (detail >= 1)
      for (const side of [-1, 1])
        B(G, 'stone', side * r * 0.72, y + h * 0.18, r * 0.71, r * 0.3, h * 0.42, 0.07);
  }
  lathe(
    G,
    'gold',
    0,
    0,
    [
      [p.height - 0.4, 0.23],
      [p.height, 0.04],
    ],
    n,
  );
}
export function buildAmaTemple(face, detail, r) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
  for (const p of r.parts) {
    const [x, z] = p.center,
      G = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [x + u, p.floorY + y, z + v]),
          n,
        ),
      W = p.width,
      D = p.depth,
      H = p.bodyHeight,
      isFront = p.name === 'red-arched-front-hall',
      isGate = p.name === 'granite-north-entrance';
    B(G, 'stone', 0, p.foundationBase - p.floorY, 0, W, p.floorY - p.foundationBase + 0.18, D);
    if (isFront) {
      archFacade(G, W, H, D / 2, 3, 2.2, detail, 'plaster', true);
      archFacade(G, W, H, -D / 2 + 0.6, 3, 2.2, detail, 'plaster');
      for (const side of [-1, 1]) B(G, 'plaster', side * (W / 2 - 0.3), 0.18, 0, 0.6, H - 0.18, D);
      B(G, 'gold', 0, 4.5, D / 2 + 0.16, 3.8, 0.58, 0.1);
    } else if (isGate) {
      const opening = 2.4;
      for (const side of [-1, 1])
        B(G, 'stone', (side * (W + opening)) / 4, 0.18, D / 2 - 0.4, (W - opening) / 2, 3.3, 0.8);
      B(G, 'stone', 0, 3.48, D / 2 - 0.4, W, 0.62, 0.8);
      for (const side of [-1, 1]) B(G, 'timber', side * 1.3, 0.18, D / 2 + 0.03, 0.16, 2.9, 0.18);
      B(G, 'gold', 0, 3.58, D / 2 + 0.08, 3.5, 0.45, 0.12);
      if (detail >= 1)
        for (const side of [-1, 1]) {
          ellipsoid(
            G,
            'lantern',
            side * 1.7,
            3.2,
            D / 2 + 0.45,
            0.35,
            0.42,
            0.32,
            detail >= 2 ? 12 : 8,
            4,
          );
          B(G, 'gold', side * 1.7, 2.58, D / 2 + 0.45, 0.06, 0.28, 0.06);
        }
    } else if (p.name === 'north-upper-pavilion') {
      B(G, 'plaster', 0, 0.18, -D / 2 + 0.3, W, H - 0.18, 0.6);
      for (const side of [-1, 1]) {
        B(G, 'plaster', side * (W / 2 - 0.3), 0.18, 0, 0.6, H - 0.18, D);
        B(G, 'timber', side * W * 0.32, 0.18, D / 2 - 0.25, 0.26, H - 0.18, 0.26);
      }
      B(G, 'timber', 0, H - 0.25, D / 2 - 0.25, W, 0.24, 0.3);
    } else {
      B(G, 'plaster', 0, 0.18, 0, W, H - 0.18, D);
      if (detail >= 1) {
        for (const side of [-1, 1])
          B(G, 'timber', side * W * 0.35, 0.18, D / 2 + 0.05, 0.23, H - 0.25, 0.26);
      }
    }
    roof(G, p, detail, p.name === 'upper-east-hall' ? 'grayRoof' : 'roof');
    if (isFront || isGate) crest(G, W, H + p.roofRise, detail);
    if (isFront || isGate) {
      const steps = detail === 0 ? 3 : 7,
        run = isGate ? 3.8 : 4.8,
        rise = isGate ? 1.5 : 2.0;
      for (let k = 0; k < steps; k++) {
        const top = -rise + ((k + 1) * rise) / steps,
          base = p.approachBase - p.floorY;
        B(
          G,
          'stone',
          0,
          base,
          D / 2 + ((steps - k - 0.5) * run) / steps,
          4,
          top - base + 0.12,
          run / steps + 0.02,
        );
      }
      if (detail >= 1)
        for (const side of [-1, 1]) {
          const points = Array.from({ length: 4 }, (_, k) => [
            side * 1.98,
            (-rise * k) / 3 + 0.88,
            D / 2 + (k * run) / 3,
          ]);
          tube(G, 'stone', points, 0.1, detail);
          for (let k = 0; k < 4; k++) {
            const base = p.approachBase - p.floorY,
              y = (-rise * k) / 3;
            B(G, 'stone', side * 1.98, base, D / 2 + (k * run) / 3, 0.18, y - base + 0.9, 0.18);
          }
        }
      if (isGate) for (const q of p.lions) lion(f, ...q.center, q.floorY, detail, q.foundationBase);
    }
  }
  pagoda(f, r.pagoda, detail);
}
