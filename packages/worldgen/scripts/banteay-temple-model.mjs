/** banteay_srei: pink sandstone towers, curved pediments, libraries and surviving enclosures. */
import earcut from 'earcut';
export const banteayCandidateId = 'banteay_srei';

function box(f, role, x, y, z, w, h, d) {
  const a = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([u, v]) => [x + u, y, z + v]),
    b = a.map(([u, v, t]) => [u, v + h, t]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
}
// Follow the retained coarse terrain without floating long, constant-height walls.
function enclosureStrip(f, role, x, z, w, d, h, detail, sample) {
  const alongX = w >= d,
    length = Math.max(w, d),
    count = detail < 2 ? Math.max(2, Math.ceil(length / 24)) : Math.ceil(length / 6);
  for (let k = 0; k < count; k++) {
    const cx = x + (alongX ? ((k + 0.5) / count - 0.5) * w : 0),
      cz = z + (alongX ? 0 : ((k + 0.5) / count - 0.5) * d),
      sw = alongX ? w / count : w,
      sd = alongX ? d : d / count,
      corners = [
        [cx - sw / 2, cz - sd / 2],
        [cx + sw / 2, cz - sd / 2],
        [cx + sw / 2, cz + sd / 2],
        [cx - sw / 2, cz + sd / 2],
      ],
      bottom = corners.map(([u, v]) => [u, sample(u, v) - 1, v]),
      top = corners.map(([u, v]) => [u, sample(u, v) + h, v]);
    for (let i = 0; i < 4; i++) {
      const internal = alongX
        ? (i === 1 && k < count - 1) || (i === 3 && k > 0)
        : (i === 0 && k > 0) || (i === 2 && k < count - 1);
      if (internal) continue;
      const j = (i + 1) % 4;
      f(
        role,
        [bottom[i], bottom[j], top[j], top[i]],
        [top[j][2] - top[i][2], 0, top[i][0] - top[j][0]],
      );
    }
    f(role, bottom, [0, -1, 0]);
    f(detail ? 'weathered' : role, top, [0, 1, 0]);
  }
}
function pose(f, x, y, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([u, v, w]) => [x + u * c - w * s, y + v, z + u * s + w * c]),
      [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
    );
}
function loft(f, role, y0, y1, w0, d0, w1, d1, detail) {
  const ring = (y, w, d) =>
    detail === 0
      ? [
          [-w / 2, y, -d / 2],
          [w / 2, y, -d / 2],
          [w / 2, y, d / 2],
          [-w / 2, y, d / 2],
        ]
      : [
          [-w * 0.5, y, -d * 0.3],
          [-w * 0.3, y, -d * 0.3],
          [-w * 0.3, y, -d * 0.5],
          [w * 0.3, y, -d * 0.5],
          [w * 0.3, y, -d * 0.3],
          [w * 0.5, y, -d * 0.3],
          [w * 0.5, y, d * 0.3],
          [w * 0.3, y, d * 0.3],
          [w * 0.3, y, d * 0.5],
          [-w * 0.3, y, d * 0.5],
          [-w * 0.3, y, d * 0.3],
          [-w * 0.5, y, d * 0.3],
        ];
  const a = ring(y0, w0, d0),
    b = ring(y1, w1, d1);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  const ix = earcut(b.flatMap((p) => [p[0], p[2]]));
  for (let i = 0; i < ix.length; i += 3)
    f(
      role,
      ix.slice(i, i + 3).map((k) => b[k]),
      [0, 1, 0],
    );
}
function pediment(f, x, y, z, w, h, detail) {
  const outline =
      detail === 0
        ? [
            [-0.5, 0],
            [0.5, 0],
            [0, 1],
          ]
        : detail === 1
          ? [
              [-0.5, 0],
              [-0.4, 0.4],
              [-0.2, 0.65],
              [0, 1],
              [0.2, 0.65],
              [0.4, 0.4],
              [0.5, 0],
            ]
          : [
              [-0.5, 0],
              [-0.48, 0.22],
              [-0.37, 0.45],
              [-0.29, 0.48],
              [-0.2, 0.75],
              [-0.12, 0.81],
              [0, 1],
              [0.12, 0.81],
              [0.2, 0.75],
              [0.29, 0.48],
              [0.37, 0.45],
              [0.48, 0.22],
              [0.5, 0],
            ],
    a = outline.map(([u, v]) => [x + u * w, y + v * h, z]),
    b = a.map(([u, v, t]) => [u, v, t + 0.28]),
    ix = earcut(outline.flat());
  for (let i = 0; i < ix.length; i += 3) {
    f(
      'carved',
      ix.slice(i, i + 3).map((k) => a[k]),
      [0, 0, -1],
    );
    f(
      'stone',
      ix.slice(i, i + 3).map((k) => b[k]),
      [0, 0, 1],
    );
  }
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    f('stone', [a[i], a[j], b[j], b[i]], [a[j][1] - a[i][1], a[i][0] - a[j][0], 0]);
  }
  if (detail >= 2) {
    // Broad original scrolling/rim forms imply architectural carving, not copied narratives.
    for (let i = 0; i < outline.length - 1; i++) {
      const [u, v] = outline[i],
        [p, q] = outline[i + 1],
        dx = (p - u) * w,
        dy = (q - v) * h,
        len = Math.hypot(dx, dy),
        nx = (-dy / len) * 0.12,
        ny = (dx / len) * 0.12;
      f(
        'stone',
        [
          [x + u * w + nx, y + v * h + ny, z + 0.32],
          [x + p * w + nx, y + q * h + ny, z + 0.32],
          [x + p * w - nx, y + q * h - ny, z + 0.32],
          [x + u * w - nx, y + v * h - ny, z + 0.32],
        ],
        [0, 0, 1],
      );
    }
    for (const hand of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const px = x + hand * (0.16 + i * 0.1) * w,
          py = y + (0.25 + i * 0.15) * h;
        box(f, 'stone', px, py, z + 0.3, w * 0.1, h * 0.12, 0.14);
      }
  }
}
function finial(f, y, scale, detail) {
  const levels =
      detail === 0
        ? [
            [0, 0.32],
            [0.8, 0.06],
          ]
        : [
            [0, 0.25],
            [0.15, 0.4],
            [0.32, 0.44],
            [0.5, 0.3],
            [0.7, 0.22],
            [1, 0.06],
          ],
    n = detail === 0 ? 6 : detail === 1 ? 8 : 12;
  const rings = levels.map(([h, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [Math.cos(a) * r * scale, y + h * scale, Math.sin(a) * r * scale];
    }),
  );
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        'stone',
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  f('stone', rings.at(-1), [0, 1, 0]);
}
function stairs(f, w, d, detail) {
  const n = detail === 0 ? 1 : detail === 1 ? 3 : 6;
  for (let i = 0; i < n; i++)
    box(
      f,
      'stone',
      0,
      -0.35,
      d / 2 + ((n - i - 0.5) * 1.8) / n,
      w * 0.4,
      0.35 + ((i + 1) * 0.85) / n,
      1.8 / n,
    );
}
function tower(f, p, detail) {
  const w = p.width,
    d = p.depth,
    h = p.height,
    base = 0.85,
    body = h * 0.36;
  if (detail === 0) {
    box(f, 'stone', 0, -0.7, 0, w + 0.9, 1.6, d + 0.9);
    box(f, 'stone', 0, base, 0, w, body, d);
  } else {
    for (let i = 0; i < 3; i++)
      box(
        f,
        i === 0 ? 'weathered' : 'stone',
        0,
        -0.8 + i * 0.55,
        0,
        w + 1.1 - i * 0.25,
        0.55,
        d + 1.1 - i * 0.25,
      );
    const t = 0.65,
      door = 1.3;
    for (const side of [-1, 1]) {
      box(f, 'stone', side * (w / 2 - t / 2), base, 0, t, body, d);
      box(f, 'stone', side * (w / 4 + door / 4), base, d / 2 - t / 2, (w - door) / 2, body, t);
    }
    box(f, 'stone', 0, base, -d / 2 + t / 2, w, body, t);
    box(f, 'stone', 0, base + 2.55, d / 2 - t / 2, door, body - 2.55, t);
    box(f, 'carved', 0, base, d / 2 - 1.3, door, 2.55, 0.3);
    for (let side = 0; side < 4; side++) {
      const q = pose(f, 0, 0, 0, (side * Math.PI) / 2),
        depth = side % 2 ? w : d,
        width = side % 2 ? d : w;
      for (const hand of [-1, 1])
        box(q, 'stone', hand * (width / 2 - 0.35), base, depth / 2 + 0.08, 0.4, body, 0.28);
      if (side !== 0)
        for (const hand of [-1, 1])
          box(q, 'carved', hand * 0.31, base + 0.12, depth / 2 + 0.05, 0.58, 2.35, 0.08);
      for (const hand of [-1, 1])
        box(q, 'stone', hand * 0.82, base, depth / 2 + 0.16, 0.3, 2.75, 0.25);
      box(q, 'carved', 0, base + 2.55, depth / 2 + 0.16, 2.2, 0.3, 0.35);
      pediment(q, 0, base + 2.85, depth / 2 + 0.17, 2.4, 1.45, detail);
    }
    stairs(f, w, d, detail);
  }
  const tiers = detail === 0 ? 3 : 4,
    roofHeight = h - body - 1.0;
  for (let i = 0; i < tiers; i++) {
    const scale = 1 - (i / (tiers + 1)) * 0.72,
      ww = w * scale,
      dd = d * scale,
      y = base + body + (i * roofHeight) / tiers,
      th = roofHeight / tiers;
    loft(f, 'stone', y, y + th, ww + 0.35, dd + 0.35, ww * 0.78, dd * 0.78, detail === 0 ? 0 : 1);
    if (detail >= 1) box(f, 'weathered', 0, y + th * 0.77, 0, ww * 0.88, 0.23, dd * 0.88);
    if (detail >= 2)
      for (let side = 0; side < 4; side++) {
        const q = pose(f, 0, 0, 0, (side * Math.PI) / 2),
          depth = side % 2 ? ww : dd;
        pediment(
          q,
          0,
          y + 0.12,
          depth * 0.45,
          Math.max(0.8, ww * 0.45),
          th * 0.8,
          detail === 3 ? 2 : 0,
        );
      }
  }
  finial(f, base + body + roofHeight, 1.05, detail);
}
function roof(f, w, d, y, h, detail) {
  const profile =
      detail === 0
        ? [
            [-0.5, 0],
            [0, 1],
            [0.5, 0],
          ]
        : [
            [-0.5, 0],
            [-0.46, 0.2],
            [-0.33, 0.6],
            [-0.18, 0.85],
            [0, 1],
            [0.18, 0.85],
            [0.33, 0.6],
            [0.46, 0.2],
            [0.5, 0],
          ],
    front = profile.map(([x, v]) => [x * w, y + v * h, d / 2]),
    back = front.map(([x, v]) => [x, v, -d / 2]),
    ix = earcut(profile.flat());
  for (let i = 0; i < front.length - 1; i++) {
    f(
      'stone',
      [front[i], front[i + 1], back[i + 1], back[i]],
      [front[i][0] + front[i + 1][0], 1, 0],
    );
  }
  for (let i = 0; i < ix.length; i += 3) {
    f(
      'stone',
      ix.slice(i, i + 3).map((k) => front[k]),
      [0, 0, 1],
    );
    f(
      'stone',
      ix.slice(i, i + 3).map((k) => back[k]),
      [0, 0, -1],
    );
  }
  if (detail >= 1)
    for (const side of [-1, 1]) {
      const q = pose(f, 0, 0, 0, side === 1 ? 0 : Math.PI);
      pediment(q, 0, y - 0.25, d / 2, w + 0.5, h + 0.35, detail);
    }
}
function library(f, p, detail) {
  const base = 0.55,
    w = p.width,
    d = p.depth,
    body = p.height * 0.58;
  box(f, 'weathered', 0, -0.8, 0, w + 0.65, 1.35, d + 0.65);
  if (detail === 0) box(f, 'stone', 0, base, 0, w, body, d);
  else {
    for (const side of [-1, 1]) box(f, 'stone', side * (w / 2 - 0.25), base, 0, 0.5, body, d);
    box(f, 'stone', 0, base, -d / 2 + 0.25, w, body, 0.5);
    for (const side of [-1, 1])
      box(f, 'stone', side * (w / 4 + 0.3), base, d / 2 - 0.25, w / 2 - 0.6, body, 0.5);
    box(f, 'stone', 0, base + 1.8, d / 2 - 0.25, 1.2, body - 1.8, 0.5);
    box(f, 'carved', 0, base, d / 2 - 1.2, 1.2, 1.8, 0.25);
    if (detail >= 2)
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          box(
            f,
            'carved',
            side * (w / 2 + 0.02),
            base + 0.6,
            (-0.33 + i * 0.33) * d,
            0.04,
            1.2,
            0.65,
          );
  }
  roof(f, w + 0.3, d + 0.3, base + body, p.height - body, detail);
  if (detail) stairs(f, w, d, detail);
}
function gate(f, p, detail) {
  const w = p.width,
    d = p.depth,
    ruined = p.kind === 'ruinedGate',
    h = p.height,
    door = 1.7;
  box(f, 'weathered', 0, -0.7, 0, w + 0.45, 0.95, d + 0.45);
  for (const side of [-1, 1])
    box(
      f,
      'stone',
      side * (w / 4 + door / 4),
      0.25,
      0,
      (w - door) / 2,
      ruined ? h * (side === 1 ? 0.72 : 1) : h * 0.58,
      d,
    );
  if (!ruined) {
    box(f, 'carved', 0, h * 0.5, 0, door, h * 0.15, d);
    if (detail === 0) {
      pediment(f, 0, h * 0.65, d / 2, w, h * 0.35, 0);
    } else {
      for (const side of [-1, 1]) {
        const q = pose(f, 0, 0, 0, side === 1 ? 0 : Math.PI);
        pediment(q, 0, h * 0.65, d / 2, w, h * 0.35, detail);
      }
      box(f, 'stone', 0, h * 0.62, 0, w + 0.35, 0.25, d + 0.2);
    }
  } else if (detail >= 2) {
    box(f, 'carved', -w * 0.22, h * 0.75, d / 2, 0.9, 0.45, 0.35);
    pediment(f, -w * 0.28, h * 0.6, d / 2, w * 0.35, 0.8, 0);
  }
}
export function buildBanteayTemple(face, detail, r, sample) {
  const [x0, z0, x1, z1] = r.commonCourt,
    ps = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    top = ps.map(([x, z]) => [x, sample(x, z) + 0.35, z]);
  face('weathered', top, [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = top[i],
      b = top[j];
    face(
      'weathered',
      [[a[0], a[1] - 1, a[2]], [b[0], b[1] - 1, b[2]], b, a],
      [b[2] - a[2], 0, a[0] - b[0]],
    );
  }
  for (const p of r.parts) {
    const f = pose(
      face,
      p.center[0],
      p.baseY,
      p.center[1],
      p.kind === 'library' ? Math.PI / 2 : -Math.PI / 2,
    );
    if (p.kind === 'tower') tower(f, p, detail);
    else if (p.kind === 'library' || p.kind === 'mandapa') library(f, p, detail);
    else gate(f, p, detail);
  }
  for (const e of r.enclosures) {
    const [a, b, c, d] = e.bounds,
      mid = 4.2,
      gap = 3.2;
    const segments = [
      [(a + c) / 2, b, c - a, e.thickness],
      [(a + c) / 2, d, c - a, e.thickness],
      ...[a, c].flatMap((x) => [
        [x, (b + mid - gap / 2) / 2, e.thickness, mid - gap / 2 - b],
        [x, (mid + gap / 2 + d) / 2, e.thickness, d - mid - gap / 2],
      ]),
    ];
    for (const [x, z, w, depth] of segments) {
      enclosureStrip(face, e.role, x, z, w, depth, e.height, detail, sample);
    }
  }
}
