/** Windsor's individually mapped wards and buildings. No imported third-party mesh. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcp/n0239_windsor_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.69, 0.68, 0.59],
  trim = [0.82, 0.78, 0.63],
  dark = [0.12, 0.17, 0.17];
const slate = [0.25, 0.28, 0.27],
  brick = [0.59, 0.31, 0.22],
  wood = [0.13, 0.12, 0.1];
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const master = (o) => !o.detail;
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function transform(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rotate = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, color) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rotate(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rotate(n),
            uv,
            color,
          ),
      ]),
    ),
  };
}
const area = (p) =>
  p.reduce((a, v, i) => {
    const q = p[(i + 1) % p.length];
    return a + v[0] * q[1] - q[0] * v[1];
  }, 0) / 2;
function ring(id, tolerance = 0) {
  const f = map.features.find((f) => f.id === `way/${id}`);
  if (!f) throw new Error(`Missing Windsor footprint ${id}`);
  const p = f.points.map((v) => [...v]);
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  // Remove only vertices near the adjacent edge; do not replace concave courts with hulls.
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length];
      const dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz);
      const d = len ? Math.abs(dx * (a[1] - b[1]) - (a[0] - b[0]) * dz) / len : 0;
      if (
        d < tolerance &&
        Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) <
          len + 2 * tolerance
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, rings, y, slot, color) {
  const points = rings.flat(),
    holes = [];
  let count = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const indices = earcut(points.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3) {
    let p = indices.slice(i, i + 3).map((k) => [points[k][0], y, points[k][1]]);
    if (normalFor(...p)[1] < 0) p = p.reverse();
    tri(o, slot, p, color);
  }
}
function prism(o, p, y0, y1, slot = 'limestone', color = stone, holes = []) {
  cap(o, [p, ...holes], y1, slot, color);
  for (const r of [p, ...holes.map((p) => (area(p) > 0 ? [...p].reverse() : p))])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        o,
        slot,
        [
          [a[0], y1, a[1]],
          [b[0], y1, b[1]],
          [b[0], y0, b[1]],
          [a[0], y0, a[1]],
        ],
        color,
      );
    }
}
function lineFrame(o, a, b, y = 0) {
  return transform(o, a[0], y, a[1], Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
}
function strip(o, p, y, width = 0.28, height = 0.25, slot = 'carved', color = trim) {
  if (o.detail === 'closeup') {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = ((b[1] - a[1]) * width) / 2 / len,
        dz = (-(b[0] - a[0]) * width) / 2 / len;
      face(
        o,
        slot,
        [
          [a[0] + dx, y + height / 2, a[1] + dz],
          [b[0] + dx, y + height / 2, b[1] + dz],
          [b[0] + dx, y - height / 2, b[1] + dz],
          [a[0] + dx, y - height / 2, a[1] + dz],
        ],
        color,
      );
      face(
        o,
        slot,
        [
          [a[0] - dx, y + height / 2, a[1] - dz],
          [b[0] - dx, y + height / 2, b[1] - dz],
          [b[0] + dx, y + height / 2, b[1] + dz],
          [a[0] + dx, y + height / 2, a[1] + dz],
        ],
        color,
      );
    }
    return;
  }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    beam(o, slot, [...a.slice(0, 1), y, a[1]], [b[0], y, b[1]], width, height, color);
  }
}
function arch(o, x, y, w, h, depth = 0.06, lights = 2, slot = 'glass') {
  const r = w / 2,
    spring = y + h - r * 0.78,
    top = y + h;
  const segments = master(o) ? 8 : 2;
  const outline = [
    [x - r, y],
    [x + r, y],
    [x + r, spring],
  ];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    outline.push([x + r * (1 - t), spring + (top - spring) * Math.sin((t * Math.PI) / 2)]);
  }
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    outline.push([x - r * t, spring + (top - spring) * Math.cos((t * Math.PI) / 2)]);
  }
  capVertical(o, outline, depth, slot, slot === 'wood' ? wood : dark);
  if (o.detail === 'district') return;
  if (o.detail === 'street') return;
  if (o.detail === 'closeup') {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.0001) continue;
      const dx = ((b[1] - a[1]) * 0.12) / len,
        dy = (-(b[0] - a[0]) * 0.12) / len;
      const p = [
        [a[0], a[1], depth + 0.1],
        [b[0], b[1], depth + 0.1],
        [b[0] + dx, b[1] + dy, depth + 0.1],
        [a[0] + dx, a[1] + dy, depth + 0.1],
      ];
      if (normalFor(...p)[2] < 0) p.reverse();
      face(o, 'carved', p, trim);
    }
    for (let i = 1; i < lights; i++) {
      const xx = x - r + (w * i) / lights;
      face(
        o,
        'carved',
        [
          [xx - 0.05, y, depth + 0.11],
          [xx + 0.05, y, depth + 0.11],
          [xx + 0.05, spring, depth + 0.11],
          [xx - 0.05, spring, depth + 0.11],
        ],
        trim,
      );
    }
    return;
  }
  // Raised jambs, hood mould and transom retain a distinct stone reveal in near views.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    beam(
      o,
      'carved',
      [a[0], a[1], depth + 0.14],
      [b[0], b[1], depth + 0.14],
      0.17,
      fine(o) ? 0.22 : 0.1,
      trim,
    );
  }
  if (fine(o)) {
    for (let i = 1; i < lights; i++)
      box(
        o,
        'carved',
        [x - r + (w * i) / lights - 0.055, y, depth + 0.05],
        [x - r + (w * i) / lights + 0.055, spring + 0.15, depth + 0.22],
        trim,
      );
    box(
      o,
      'carved',
      [x - r, y + h * 0.48, depth + 0.04],
      [x + r, y + h * 0.48 + 0.1, depth + 0.24],
      trim,
    );
    if (master(o)) {
      for (let i = 1; i < lights; i++) {
        const xx = x - r + (w * i) / lights;
        for (const sign of [-1, 1])
          beam(
            o,
            'carved',
            [xx, spring - 0.5, depth + 0.15],
            [xx + ((sign * w) / lights) * 0.45, spring + 0.3, depth + 0.15],
            0.075,
            0.09,
            trim,
          );
      }
      for (let yy = y + 0.5; yy < spring; yy += 0.65)
        box(
          o,
          'metal',
          [x - r + 0.1, yy, depth + 0.02],
          [x + r - 0.1, yy + 0.025, depth + 0.08],
          [0.28, 0.28, 0.24],
        );
    }
  }
}
function capVertical(o, p, z, slot, color) {
  const ix = earcut(p.flat(), [], 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], z]);
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, color);
  }
}
function rectWindow(o, x, y, w, h, frameSlot = 'carved') {
  face(
    o,
    'glass',
    [
      [x - w / 2, y, 0.08],
      [x + w / 2, y, 0.08],
      [x + w / 2, y + h, 0.08],
      [x - w / 2, y + h, 0.08],
    ],
    dark,
  );
  if (o.detail === 'district' || o.detail === 'street') return;
  const color = frameSlot === 'wood' ? wood : trim;
  for (const [a, b] of [
    [
      [x - w / 2, y],
      [x - w / 2, y + h],
    ],
    [
      [x + w / 2, y],
      [x + w / 2, y + h],
    ],
    [
      [x - w / 2, y],
      [x + w / 2, y],
    ],
    [
      [x - w / 2, y + h],
      [x + w / 2, y + h],
    ],
    [
      [x, y],
      [x, y + h],
    ],
    [
      [x - w / 2, y + h * 0.6],
      [x + w / 2, y + h * 0.6],
    ],
  ]) {
    if (master(o)) beam(o, frameSlot, [...a, 0.18], [...b, 0.18], 0.12, 0.18, color);
    else {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy),
        u = (dy * 0.05) / len,
        v = (-dx * 0.05) / len;
      const p = [
        [a[0] - u, a[1] - v, 0.16],
        [a[0] + u, a[1] + v, 0.16],
        [b[0] + u, b[1] + v, 0.16],
        [b[0] - u, b[1] - v, 0.16],
      ];
      if (normalFor(...p)[2] < 0) p.reverse();
      face(o, frameSlot, p, color);
    }
  }
}
function battlements(o, p, y, spacing = 2.6) {
  if (['skyline', 'district', 'street'].includes(o.detail)) return;
  strip(o, p, y - 0.4, 0.65, 0.55);
  let distance = spacing / 2;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = lineFrame(o, a, b);
    for (; distance < len; distance += spacing) {
      const x = distance;
      box(f, 'limestone', [x - 0.57, y, -0.42], [x + 0.57, y + 1.0, 0.42], stone);
      if (master(o))
        box(f, 'carved', [x - 0.62, y + 0.98, -0.47], [x + 0.62, y + 1.11, 0.47], trim);
    }
    distance -= len;
  }
}
function facade(o, p, y0, y1, { spacing = 5.7, levels = 2, lights = 2, width = 1.7 } = {}) {
  if (o.detail === 'skyline') return;
  for (let i = 0; i < p.length; i++) {
    // Ring is CCW in XZ. Its outer face is local -Z, hence reverse the edge.
    const a = p[(i + 1) % p.length],
      b = p[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < spacing * 0.75) continue;
    const f = lineFrame(o, a, b),
      n = Math.max(1, Math.floor(len / spacing));
    for (let j = 0; j < n; j++)
      for (let k = 0; k < levels; k++) {
        const h = (y1 - y0 - 2) / levels,
          yy = y0 + 1.4 + k * h;
        if (levels === 3 && k > 0)
          rectWindow(
            f,
            (len * (j + 0.5)) / n,
            yy,
            k === 1 ? width * 1.35 : width,
            k === 1 ? 3.6 : 2.4,
          );
        else arch(f, (len * (j + 0.5)) / n, yy, width, Math.min(3.6, h - 1.1), 0.075, lights);
      }
  }
}
function mappedRange(
  o,
  id,
  y,
  height,
  { holes = [], crenels = true, windows = true, slot = 'limestone', color = stone } = {},
) {
  const tol =
    o.detail === 'skyline'
      ? 3
      : o.detail === 'district'
        ? 1.5
        : o.detail === 'street'
          ? 0.55
          : o.detail === 'closeup'
            ? 0.45
            : 0.08;
  const p = ring(id, tol),
    inner = holes.map((id) => ring(id, tol));
  if (y > 0) prism(o, p, 0, y, 'weathered', stone, inner);
  prism(o, p, y, y + height, slot, color, inner);
  if (windows) facade(o, p, y, y + height, { levels: height > 18 ? 3 : height > 9 ? 2 : 1 });
  if (crenels) battlements(o, p, y + height);
  if (master(o)) {
    strip(o, p, y + 0.8, 0.35, 0.3);
    strip(o, p, y + height - 1.2, 0.3, 0.23);
  }
  if (fine(o)) for (const h of inner) facade(o, [...h].reverse(), y, y + height, { levels: 2 });
  return p;
}
function roof(o, x0, x1, z0, z1, y, ridge, hip = true) {
  const m = (z0 + z1) / 2,
    d = hip ? Math.min((z1 - z0) / 2, (x1 - x0) / 3) : 0;
  face(
    o,
    'slate',
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1 - d, ridge, m],
      [x0 + d, ridge, m],
    ].reverse(),
    slate,
  );
  face(
    o,
    'slate',
    [
      [x1, y, z1],
      [x0, y, z1],
      [x0 + d, ridge, m],
      [x1 - d, ridge, m],
    ].reverse(),
    slate,
  );
  for (const [x, xx] of [
    [x0, x0 + d],
    [x1, x1 - d],
  ])
    tri(
      o,
      hip ? 'slate' : 'limestone',
      [
        [x, y, z0],
        [xx, ridge, m],
        [x, y, z1],
      ],
      hip ? slate : stone,
    );
  if (fine(o)) beam(o, 'metal', [x0 + d, ridge, m], [x1 - d, ridge, m], 0.18, 0.2, slate);
}
function pitchedLink(o, a, b, width, y, rise) {
  const f = lineFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  roof(f, 0, len, -width / 2, width / 2, y, y + rise, false);
}
function round(o, x, z, r, y, h, { cone = false } = {}) {
  const n =
    o.detail === 'skyline'
      ? 8
      : o.detail === 'district'
        ? 12
        : o.detail === 'street'
          ? 20
          : master(o)
            ? 64
            : 32;
  loft(o, 'limestone', [radialRing(y, r, r, n, [x, z]), radialRing(y + h, r, r, n, [x, z])], stone);
  if (cone) {
    for (let i = 0; i < n; i++)
      tri(
        o,
        'slate',
        [
          [
            x + r * Math.cos((-i * 2 * Math.PI) / n),
            y + h,
            z + r * Math.sin((-i * 2 * Math.PI) / n),
          ],
          [
            x + r * Math.cos((-(i + 1) * 2 * Math.PI) / n),
            y + h,
            z + r * Math.sin((-(i + 1) * 2 * Math.PI) / n),
          ],
          [x, y + h + r * 0.9, z],
        ],
        slate,
      );
  } else {
    const p = radialRing(0, r + 0.16, r + 0.16, n, [x, z])
      .map((p) => [p[0], p[2]])
      .reverse();
    battlements(o, p, y + h);
  }
}

function upperWard(o) {
  mappedRange(o, 131179513, 4, 20.5);
  mappedRange(o, 87148387, 4, 19);
  // Individually placed ranges behind the crenellated parapets, leaving the quadrangle empty.
  for (const [a, b, w, y, r] of [
    [[26, -58], [73, -54], 14, 24.3, 6.4],
    [[91, -56], [148, -41], 16, 24.3, 6.4],
    [[151, -25], [134, 47], 13, 24.3, 5],
    [[36, 40], [132, 58], 13, 24.3, 5.2],
    [[3, -66], [15, -45], 11, 23, 4.2],
  ])
    pitchedLink(o, a, b, w, y, r);
  const towers = [
    [515637769, 4, 25],
    [1163471155, 4, 26],
    [1163471156, 4, 26],
    [1163471159, 4, 29],
    [1163471160, 4, 24],
    [1163471161, 4, 26],
    [1163471162, 4, 32],
    [1163471163, 4, 37],
    [1163471164, 4, 28],
    [1163471165, 4, 24],
    [1163471166, 4, 23],
  ];
  for (const [id, y, h] of towers) {
    const p = mappedRange(o, id, y, h);
    if (o.detail !== 'skyline') strip(o, p, y + h - 1.8, 0.9, 0.6);
  }
  for (const id of [1163471152, 1163471153]) mappedRange(o, id, 4, 26);
  // Norman gate: open passage under a high stone bridge, not a filled rectangular tower.
  const n = transform(o, 1, 4, -34, 0.4);
  box(n, 'limestone', [-7, 0, -4], [-2, 18, 4], stone);
  box(n, 'limestone', [2, 0, -4], [7, 18, 4], stone);
  box(n, 'limestone', [-2, 8, -4], [2, 18, 4], stone);
  for (const x of [-5.5, 5.5]) round(n, x, 4, 2.2, 0, 20);
  if (o.detail !== 'skyline') for (const x of [-5, 5]) arch(n, x, 10, 1.2, 3, 4.1, 1);
  if (fine(o)) {
    // South gate and courtyard elevation: broad paired lower windows and fine attic openings.
    for (const [a, b] of [
      [
        [36, 40],
        [129, 57],
      ],
      [
        [130, 40],
        [147, -24],
      ],
      [
        [135, -28],
        [88, -40],
      ],
    ]) {
      const f = lineFrame(o, a, b, 4),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let x = 4; x < len - 2; x += 5.7) arch(f, x, 15.6, 1.15, 2.2, 0.6, 1);
    }
    for (const [x, z, y] of [
      [31, -59, 24],
      [49, -57, 24],
      [98, -54, 24],
      [120, -48, 24],
      [141, -39, 24],
      [143, -7, 24],
      [137, 22, 24],
      [46, 40, 24],
      [87, 48, 24],
      [116, 53, 24],
    ])
      chimney(o, x, z, y, 3.6, 1.7, 8);
  }
}
function chimney(o, x, z, y, w = 2, d = 1.4, h = 4) {
  box(o, 'brick', [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], brick);
  box(
    o,
    'carved',
    [x - w / 2 - 0.2, y + h - 0.3, z - d / 2 - 0.2],
    [x + w / 2 + 0.2, y + h, z + d / 2 + 0.2],
    trim,
  );
  if (master(o))
    for (let xx = x - w / 2 + 0.4; xx < x + w / 2; xx += 0.65)
      tube(o, 'brick', [xx, y + h, z], [xx, y + h + 0.55, z], 0.22, brick, 8);
}
function keep(o) {
  // Artificial Norman motte is represented independently of unsurveyed natural terrain.
  const n = o.detail === 'district' ? 16 : o.detail === 'street' ? 24 : master(o) ? 80 : 40;
  loft(
    o,
    'weathered',
    [radialRing(0, 29, 27, n, [-17, -10]), radialRing(11.8, 17, 16, n, [-17, -10])],
    [0.51, 0.53, 0.44],
  );
  const p = ring(92729166, o.detail === 'district' ? 1.0 : 0.05);
  prism(o, p, 11.8, 38.5);
  battlements(o, p, 38.5, 3.4);
  // Upper projecting corbel table and sparse lancets, unlike the densely fenestrated palace.
  if (o.detail !== 'district') {
    for (const y of [17.5, 24.8, 35.8, 38.2])
      strip(o, p, y, y > 35 ? 0.6 : 0.28, y > 35 ? 0.38 : 0.24);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        x = -16.3 + 15.05 * Math.cos(a),
        z = -10.4 + 14.45 * Math.sin(a),
        f = transform(o, x, 0, z, Math.PI / 2 - a);
      if (i % 2 === 0) {
        arch(f, 0, 18.6, 1.0, 3.2, 0.1, 1);
        arch(f, 0, 27.8, 0.75, 2.5, 0.1, 1);
      }
      if (fine(o)) {
        for (let j = 0; j < 3; j++) {
          const b = a + ((j - 1) * Math.PI) / 36;
          beam(
            o,
            'carved',
            [-16.3 + 14.9 * Math.cos(b), 34.8, -10.4 + 14.3 * Math.sin(b)],
            [-16.3 + 15.5 * Math.cos(b), 36.5, -10.4 + 14.9 * Math.sin(b)],
            0.38,
            0.45,
            trim,
          );
        }
        if (i % 2 === 0) box(f, 'carved', [-0.9, 11.8, -0.2], [-0.4, 25.4, 0.45], trim);
      }
    }
  }
  mappedRange(o, 1163089930, 12, 30, { windows: false });
  tube(o, 'metal', [-8, 41.9, -18], [-8, 52, -18], 0.12, [0.32, 0.32, 0.27], 6);
}
function lowerWard(o) {
  mappedRange(o, 131188498, 0, 11.5, { holes: [1163025667, 1163025669, 1163025668, 1162821751] });
  for (const [id, y, h] of [
    [131174660, 0, 11],
    [131174665, 0, 10],
    [131174664, 0, 8],
    [131174663, 0, 8],
    [131174661, 0, 7],
    [131174662, 0, 9.3],
    [1163043326, 0, 9.3],
    [1163043273, 0, 10.8],
    [131185777, 0, 9],
  ])
    mappedRange(o, id, y, h);
  for (const [a, b, w, y, r] of [
    [[-246, -26], [-176, -43], 9, 11.5, 3.8],
    [[-172, -44], [-105, -53], 10, 11.5, 4.4],
    [[-152, -32], [-148, -9], 11, 11.5, 4],
    [[-130, -43], [-122, -10], 10, 11.5, 4],
    [[-260, -13], [-252, 0], 12, 10, 5],
    [[-250, 60], [-234, 80], 10, 8, 4],
    [[-182, 73], [-143, 54], 12, 9.3, 4],
    [[-131, 44], [-108, 30], 11, 9.3, 4],
    [[-82, 27], [-65, 42], 9, 10.8, 3.5],
    [[-51, 35], [-12, 37], 7, 9, 3.6],
  ])
    pitchedLink(o, a, b, w, y, r);
  for (const [id, h] of [
    [131228046, 19],
    [131174667, 13],
    [1163043327, 16],
    [131175692, 19],
    [1449512369, 16],
    [131188506, 17],
    [131188501, 15],
  ])
    mappedRange(o, id, 0, h);
  round(o, -282.1, 5.4, 7, 18.8, 1, { cone: true });
  round(o, -260, 51, 6.4, 0, 13);
  if (fine(o))
    for (const [x, z, y] of [
      [-239, -29, 11],
      [-221, -33, 11],
      [-202, -38, 11],
      [-177, -43, 11],
      [-161, -45, 11],
      [-136, -49, 11],
      [-116, -51, 11],
      [-171, 67, 9],
      [-155, 59, 9],
      [-123, 39, 9],
      [-112, 34, 9],
      [-81, 29, 10],
    ])
      chimney(o, x, z, y, 2, 1.4, 7);
  // Henry VIII gateway: two mapped half-octagonal towers with an actual gap between.
  for (const id of [929918943, 929918945]) mappedRange(o, id, 0, 16.2);
  const gate = ring(929918944, 0.1);
  prism(o, gate, 6.8, 12.3);
  if (fine(o)) {
    const f = transform(o, -196.5, 0, 89.6, 0.15);
    arch(f, 0, 7.7, 2.5, 2.6, 0.2, 3);
    for (const s of [-1, 1])
      box(f, 'metal', [s * 2.1 - 0.12, 0.1, -2], [s * 2.1 + 0.12, 6.8, 0.4], dark);
  }
}
function cloister(o) {
  const p = mappedRange(o, 131174658, 0, 7.6, {
    crenels: false,
    windows: false,
    slot: 'brick',
    color: brick,
  });
  // Follow the bent horseshoe around an open court, with roof ridges on each occupied range.
  const line = [
    [-278, 7],
    [-265, 1],
    [-269, 18],
    [-265, 33],
    [-257, 43],
    [-221, 32],
  ];
  for (let i = 1; i < line.length; i++) pitchedLink(o, line[i - 1], line[i], 8, 7.6, 3.0);
  if (o.detail === 'district') return;
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + 1) % p.length],
      b = p[i],
      len = Math.hypot(a[0] - b[0], a[1] - b[1]),
      f = lineFrame(o, a, b);
    if (len < 2) continue;
    for (let x = 2; x < len - 0.8; x += 4.5)
      for (const y of [0.85, 4.7]) rectWindow(f, x, y, 1.4, 2.1, 'wood');
    for (const yy of [0.6, 3.8, 7.1]) box(f, 'wood', [0, yy, 0.05], [len, yy + 0.17, 0.2], wood);
    for (let x = 0.35; x < len; x += 1.35) {
      box(f, 'wood', [x, 0.6, 0.04], [x + 0.14, 7.5, 0.2], wood);
      if (fine(o))
        for (const sign of [-1, 1])
          beam(f, 'wood', [x, 4, 0.21], [x + sign * 0.65, 5.3, 0.21], 0.13, 0.12, wood);
    }
  }
  if (fine(o))
    for (const [x, z] of [
      [-273, 7],
      [-272, 16],
      [-270, 28],
      [-261, 39],
      [-250, 40],
      [-239, 37],
      [-228, 33],
    ])
      chimney(o, x, z, 7.2, 2.8, 1.6, 6.4);
}
function pinnacle(o, x, z, y, h = 4) {
  if (!fine(o)) return;
  box(o, 'carved', [x - 0.3, y, z - 0.3], [x + 0.3, y + h * 0.65, z + 0.3], trim);
  const p = [
    [x - 0.4, y + h * 0.65, z - 0.4],
    [x + 0.4, y + h * 0.65, z - 0.4],
    [x + 0.4, y + h * 0.65, z + 0.4],
    [x - 0.4, y + h * 0.65, z + 0.4],
  ];
  for (let i = 0; i < 4; i++) tri(o, 'carved', [p[i], p[(i + 1) % 4], [x, y + h, z]], trim);
}
function chapel(o) {
  // Local chapel axis follows the mapped nave from west (-X) to east (+X), rotated 10 degrees.
  const c = transform(o, -182, 0, 10, -0.1745);
  // Lower aisles, higher nave/choir, and unequal projecting transepts remain distinct.
  box(c, 'limestone', [-35, 0, -11], [33, 12.5, 11], stone);
  box(c, 'limestone', [-34, 12.5, -6.4], [32, 24, 6.4], stone);
  box(c, 'limestone', [-8, 0, -17], [7, 24, 18], stone);
  roof(c, -34, 32, -6.4, 6.4, 24, 25.8, false);
  const tr = transform(c, -0.5, 0, 0, Math.PI / 2);
  roof(tr, -17, 18, -7.5, 7.5, 24, 25.8, false);
  for (const z of [-11, 11]) {
    const f = transform(c, 0, 0, z, z > 0 ? 0 : Math.PI);
    for (let x = -30; x < 32; x += 6.8) {
      if (Math.abs(x) < 10) continue;
      arch(f, x, 3.5, 4.8, 7.2, 0.1, 4);
    }
    const clerestory = transform(c, 0, 0, z > 0 ? 6.4 : -6.4, z > 0 ? 0 : Math.PI);
    for (let x = -30; x < 32; x += 6.8) {
      if (Math.abs(x) < 9) continue;
      arch(clerestory, x, 15, 4.7, 7.4, 0.1, 4);
    }
    if (o.detail !== 'district')
      for (let x = -33; x < 34; x += 6.8) {
        box(c, 'carved', [x - 0.4, 0, z - 0.6], [x + 0.4, 13.5, z + 0.6], trim);
        pinnacle(c, x, z, 13.5, 2.7);
        pinnacle(c, x, z > 0 ? 6.6 : -6.6, 24, 4);
        if (fine(o)) beam(c, 'carved', [x, 13, z], [x, 21, z > 0 ? 6.4 : -6.4], 0.52, 0.55, trim);
      }
  }
  // Broad west window, projecting south transept glazing, and window-filled east end.
  for (const [x, a] of [
    [-35, -Math.PI / 2],
    [33, Math.PI / 2],
  ]) {
    const f = transform(c, x, 0, 0, a);
    arch(f, 0, 9.5, 9, 12.5, 0.15, 9);
    arch(f, 0, 0.4, 3.2, 6.5, 0.15, 2, 'wood');
  }
  for (const [z, a] of [
    [18, 0],
    [-17, Math.PI],
  ]) {
    const f = transform(c, -0.5, 0, z, a);
    arch(f, 0, 3.5, 8, 7, 0.15, 6);
    arch(f, 0, 14, 8.2, 8.4, 0.15, 6);
  }
  for (const x of [-35, 33])
    for (const z of [-10.5, 10.5]) {
      const h = x < 0 ? 29.5 : 25.5;
      box(c, 'limestone', [x - 1.15, 0, z - 1.15], [x + 1.15, h, z + 1.15], stone);
      round(c, x, z, 1.25, h, 0.6, { cone: true });
      if (fine(o)) tube(c, 'metal', [x, h + 1.7, z], [x, h + 3.2, z], 0.045, [0.6, 0.48, 0.22], 5);
    }
  // Low open parapet arcade, explicit geometry at close range.
  if (fine(o))
    for (const z of [-6.5, 6.5]) {
      beam(c, 'carved', [-34, 25, z], [32, 25, z], 0.2, 0.25, trim);
      for (let x = -34; x < 32; x += 0.72)
        box(c, 'carved', [x, 24, z - 0.1], [x + 0.12, 25, z + 0.1], trim);
    }
  const al = transform(o, -133.2, 0, 0, -0.1745);
  box(al, 'limestone', [-13, 0, -6], [13, 13, 6], stone);
  roof(al, -13, 13, -6, 6, 13, 17, false);
  for (const [z, a] of [
    [6, 0],
    [-6, Math.PI],
  ]) {
    const f = transform(al, 0, 0, z, a);
    for (const x of [-9, -3, 3, 9]) {
      arch(f, x, 4, 3.9, 7.5, 0.1, 3);
      pinnacle(al, x + 2.7, z, 13, 2.5);
    }
  }
}
function precinct(o) {
  // Thin mapped terrace revetments; their footprint is not treated as an occupied building.
  for (const [id, h] of [
    [1163431314, 4],
    [1163454515, 4],
    [1163431316, 2],
    [1163043272, 4],
    [1163122469, 8],
    [1163043295, 8],
  ])
    mappedRange(o, id, 0, h, { crenels: false, windows: false });
  const garden = ring(162997835, o.detail === 'district' ? 2 : 0.1);
  prism(o, garden, 0, 4, 'glass', [0.3, 0.38, 0.36]);
  if (fine(o)) {
    facade(o, garden, 0, 4, { spacing: 3, width: 1.7, levels: 1 });
    for (let x = 190; x < 270; x += 8) box(o, 'metal', [x, 0, -58], [x + 0.13, 4, -57.8], dark);
  }
}
export const windsorParts = { upperWard, keep, lowerWard, cloister, chapel, precinct };
export function buildWindsorRuntime(out, detail) {
  const o = { ...out, detail };
  if (detail === 'district') {
    buildWindsorSkyline(o);
    for (const [a, b, y] of [
      [[26, -76], [150, -49], 4, 21],
      [[130, 69], [29, 48], 4, 21],
      [[-180, 77], [-140, 55], 0, 12],
      [[-105, -55], [-242, -29], 0, 12],
    ]) {
      const f = lineFrame(o, a, b),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let x = 4; x < len - 2; x += 7)
        for (let k = 0; k < 2; k++) arch(f, x, y + 2 + k * 6, 1.7, 3, 0.1, 2);
    }
    return;
  }
  for (const fn of Object.values(windsorParts)) fn(o);
}
export function buildWindsorSkyline(out) {
  const o = { ...out, detail: 'skyline' };
  // Separate named masses keep open wards legible at sub-pixel facade scale.
  for (const [id, y, h] of [
    [131179513, 4, 21],
    [87148387, 4, 20],
    [131188498, 0, 12],
    [131174658, 0, 10],
    [131174662, 0, 13],
    [1163043326, 0, 13],
    [131174663, 0, 10],
  ]) {
    const p = ring(id, 5);
    prism(o, p, y, y + h, 'limestone', stone, id === 131188498 ? [ring(1162821751, 2)] : []);
  }
  for (const [x, z, w, d, h] of [
    [23, 41, 23, 20, 30],
    [55, 55, 12, 15, 31],
    [75, 57, 12, 15, 31],
    [140, 66, 21, 21, 34],
    [164, -37, 21, 18, 36],
    [162, -51, 14, 15, 42],
    [83, -66, 16, 18, 34],
    [-282, 5, 15, 16, 25],
    [-228, 92, 13, 13, 15],
    [-94, 28, 15, 16, 20],
    [-104, -55, 15, 13, 18],
    [-193, 86, 11, 15, 17],
    [-205, 87, 11, 15, 17],
  ])
    box(o, 'limestone', [x - w / 2, 0, z - d / 2], [x + w / 2, h, z + d / 2], stone);
  round(o, -16.3, -10.4, 15.2, 0, 40);
  box(o, 'limestone', [-11, 35, -22], [-5, 43, -14], stone);
  tube(o, 'metal', [-8, 43, -18], [-8, 52, -18], 0.15, dark, 3);
  const c = transform(o, -182, 0, 10, -0.1745);
  box(c, 'limestone', [-35, 0, -11], [33, 13, 11], stone);
  box(c, 'limestone', [-35, 13, -6.5], [33, 26, 6.5], stone);
  box(c, 'limestone', [-8, 0, -17], [7, 25, 18], stone);
  for (const z of [-11, 11]) box(c, 'limestone', [-36, 0, z - 1], [-34, 32, z + 1], stone);
  box(o, 'limestone', [-146, 0, -6], [-120, 16, 6], stone);
  for (const [a, b, w, y, rise] of [
    [[26, -58], [73, -54], 14, 25, 6],
    [[91, -56], [148, -41], 16, 25, 6],
    [[151, -25], [134, 47], 13, 25, 5],
    [[36, 40], [132, 58], 13, 25, 5],
    [[-246, -26], [-176, -43], 9, 12, 4],
    [[-172, -44], [-105, -53], 10, 12, 4],
    [[-182, 73], [-143, 54], 12, 13, 1],
    [[-131, 44], [-108, 30], 11, 13, 1],
  ])
    pitchedLink(o, a, b, w, y, rise);
}
export const windsorStudy = {
  id: 'N0239',
  key: 'windsor_castle',
  title: 'Windsor Castle',
  category: 'castle',
  wikidataId: 'Q42646',
  build: (out) => buildWindsorRuntime(out),
  brief:
    'Individually arranged Upper, Middle and Lower Wards: mapped palace ranges and named towers, open quadrangle, Round Tower and artificial motte, Saint George’s and Albert Memorial chapels, timber-and-brick Horseshoe Cloister and Henry VIII gateway.',
  sourceFacts: {
    stoneCastleConstruction: '1165–1179',
    saintGeorgesChapelConstruction: '1475–1511',
    majorExteriorRemodelling: '1800–1830',
    footprints: 'Individual OpenStreetMap ways and courtyard holes, retrieved 2026-10-04',
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'Meter-scale mapped building footprints in the cached signed precinct frame, with separately reconstructed Gothic elevations, roofs, chimneys and corbelled tower crowns from inspected aerial, quadrangle, Round Tower, chapel and cloister photographs.',
    verticalDatum:
      'Provisional base; upper ranges begin at +4 m, artificial motte top +11.8 m. No surveyed cross-site levels.',
    roundTowerCrownY: 39.61,
    flagpoleTipY: 52,
    heights: 'Photographic estimates; do not treat as measured building heights.',
  },
  scaleBasis:
    'Horizontal coordinates are individual mapped footprints. Heights, roofs, window spacing and ground steps are reconstructed estimates. Natural hill and cross-site slope remain outside this asset.',
  refs: [
    'https://www.rct.uk/visit/windsor-castle/who-built-windsor-castle',
    'https://historicengland.org.uk/listing/the-list/list-entry/1117776',
    'https://www.openstreetmap.org/way/23580556',
    'https://commons.wikimedia.org/wiki/File:Aerial_view_of_Windsor_Castle.jpg',
    'https://commons.wikimedia.org/wiki/File:Windsor_Castle_Upper_Ward_Quadrangle_Corrected_2-_Nov_2006.jpg',
    'https://commons.wikimedia.org/wiki/File:Windsor_Castle_Round_Tower.JPG',
    'https://commons.wikimedia.org/wiki/File:St._Georges_Chapel,_Windsor_Castle_(1)_v2.jpg',
    'https://commons.wikimedia.org/wiki/File:Horseshoe_Cloister_-_2026.jpg',
  ],
  sourceDocuments: ['map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Individual building geometry in map-parts.json derives from © OpenStreetMap contributors, ODbL-1.0. Its source URL, signed meter frame and retrieval date are recorded with the data. Reference photographs are linked only; no pixels are redistributed in the model.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X from Lower Ward toward Upper Ward and East Terrace Garden',
    front: '+Z toward the Long Walk',
    origin: 'Cached OSM precinct center; provisional structural base',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Individual map footprints; real terrain and vertical datum pending',
    notes:
      'Preserve the cached anchor and signed heading without scaling. Precinct includes open gardens and courtyards: never replace its entire polygon with a building. Cross-site levels need terrain integration before world activation.',
  }),
  geographicNote:
    'Draft only: per-building horizontal placement uses mapped meter coordinates, but terrain datum and vertical elevations are provisional. Viewer activation and footprint replacement remain disabled pending geographic fit review.',
  limitations: [
    'Maximum exterior fidelity is pending. This is an original exterior reconstruction, not a surveyed as-built model. Heights, facade bay spacing, roof profiles and corner details need elevation verification.',
    'Chapel tracery is geometric but simplified; heraldic beasts, statues, heraldry, gates and sculptural capitals require dedicated individually verified detail. No generic statue is claimed to represent them.',
    'No interiors, natural hill, foliage, temporary works or royal flags are supplied. Artificial motte, structural walls and terrace revetments use provisional elevations. The open grounds require real terrain contact.',
    'Chapel and Albert Chapel volumes follow manually aligned mapped envelopes; palace and residential ranges use exact individual plan vertices with tolerance reduction. Roofing is independently reconstructed.',
    'Shared limestone, raw limestone, weathered limestone, slate, wood, brick and painted-metal graphs are reused; glazing is local PBR. No new bitmap textures or copied photographic pixels.',
  ],
  camera: { position: [-270, 240, 480], lookAt: [-25, 16, 0], fov: 42 },
  qaCameras: [
    { name: 'upper-ward-south', position: [75, 48, 230], lookAt: [82, 19, 0] },
    { name: 'upper-quadrangle', position: [12, 29, -14], lookAt: [95, 19, 46] },
    { name: 'north-state-apartments', position: [90, 58, -180], lookAt: [86, 24, -47] },
    { name: 'round-tower-crown', position: [-77, 52, 68], lookAt: [-16, 28, -10] },
    { name: 'chapel-south', position: [-217, 27, 98], lookAt: [-181, 15, 10] },
    { name: 'chapel-west-window', position: [-260, 23, 20], lookAt: [-215, 17, 4] },
    { name: 'horseshoe-cloister', position: [-240, 10, 12], lookAt: [-258, 6, 37] },
    { name: 'henry-viii-gate', position: [-201, 13, 134], lookAt: [-197, 8, 85] },
    { name: 'wards-and-open-courts', position: [-30, 610, 120], lookAt: [-25, 0, 0] },
  ],
};
