/** Mapped northern chapels and the separate, point-located Montu ruin precinct. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
export const karnakNorthCandidateId = 'N0489';
const linear = (hex) =>
  hex.match(/../g).map((v) => {
    const q = parseInt(v, 16) / 255;
    return q <= 0.04045 ? q / 12.92 : Math.pow((q + 0.055) / 1.055, 2.4);
  });
const ivory = linear('d8ccb0'),
  red = linear('95614e'),
  dark = linear('625e56');
function localFace(f, frame) {
  const { origin: o, u, v } = frame;
  return (role, ps, n, t) =>
    f(
      role,
      ps.map(([x, y, z]) => [o[0] + u[0] * x + v[0] * z, y, o[1] + u[1] * x + v[1] * z]),
      [u[0] * n[0] + v[0] * n[2], n[1], u[1] * n[0] + v[1] * n[2]],
      t,
    );
}
function surface(f, polygons, y, tint) {
  for (const poly of polygons) {
    const ps = poly.flat(),
      holes = [];
    let offset = poly[0].length;
    for (const h of poly.slice(1)) {
      holes.push(offset);
      offset += h.length;
    }
    const is = earcut(ps.flat(), holes, 2);
    for (let i = 0; i < is.length; i += 3)
      f(
        'stone',
        is.slice(i, i + 3).map((k) => [ps[k][0], y, ps[k][1]]),
        [0, 1, 0],
        tint,
      );
  }
}
function run(f, box, a, b, width, height, floor, role = 'wall', tint) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    g = localFace(f, { origin: a, u: [dx / l, dz / l], v: [-dz / l, dx / l] });
  box(g, role, l / 2, floor, 0, l, height, width, tint);
}
function steps(f, x0, x1, width, top, floor, detail, box, tint) {
  const count = detail <= 1 ? 1 : 5;
  for (let i = 0; i < count; i++) {
    const a = x0 + ((x1 - x0) * i) / count,
      b = x0 + ((x1 - x0) * (i + 1)) / count,
      y = floor + ((top - floor) * (i + 1)) / count;
    box(f, 'stone', (a + b) / 2, floor - 0.4, 0, Math.abs(b - a), y - floor + 0.4, width, tint);
  }
}

function whiteChapel(f, detail, { box }, data, floor) {
  const g = localFace(f, data.frame),
    l = data.length,
    w = data.width,
    y = floor + 1.1,
    h = 3.7;
  if (detail === 0) {
    surface(
      g,
      [
        [
          [
            [-l / 2, -w / 2],
            [l / 2, -w / 2],
            [l / 2, w / 2],
            [-l / 2, w / 2],
          ],
        ],
      ],
      floor + 5.4,
      ivory,
    );
    return;
  }
  box(g, 'stone', 0, floor - 0.4, 0, l, 1.5, w, ivory);
  const count = detail === 1 ? 2 : 4;
  for (let i = 0; i < count; i++)
    for (let j = 0; j < count; j++)
      box(
        g,
        'stone',
        -l / 2 + 0.55 + (i * (l - 1.1)) / (count - 1),
        y,
        -w / 2 + 0.55 + (j * (w - 1.1)) / (count - 1),
        0.8,
        h,
        0.8,
        ivory,
      );
  for (const sign of [-1, 1]) {
    if (detail >= 2)
      for (const s of [-1, 1])
        box(g, 'stone', sign * (l / 2 - 0.25), y, s * (w / 4 + 0.5), 0.5, 0.8, w / 2 - 1.1, ivory);
    steps(g, sign * (l / 2 + 3.2), (sign * l) / 2, 1.65, y, floor, detail, box, ivory);
    if (detail >= 2)
      for (const z of [-1.05, 1.05]) {
        const a = sign * (l / 2 + 3.2),
          b = (sign * l) / 2,
          lo = floor - 0.4,
          ha = floor + 0.55,
          hb = floor + 1.95;
        for (const s of [-1, 1])
          g(
            'stone',
            [
              [a, lo, z + s * 0.2],
              [b, lo, z + s * 0.2],
              [b, hb, z + s * 0.2],
              [a, ha, z + s * 0.2],
            ],
            [0, 0, s],
            ivory,
          );
        g(
          'stone',
          [
            [a, ha, z - 0.2],
            [b, hb, z - 0.2],
            [b, hb, z + 0.2],
            [a, ha, z + 0.2],
          ],
          [0, 1, 0],
          ivory,
        );
        for (const [x, h, n] of [
          [a, ha, b > a ? -1 : 1],
          [b, hb, b > a ? 1 : -1],
        ])
          g(
            'stone',
            [
              [x, lo, z - 0.2],
              [x, lo, z + 0.2],
              [x, h, z + 0.2],
              [x, h, z - 0.2],
            ],
            [n, 0, 0],
            ivory,
          );
        g(
          'stone',
          [
            [a, lo, z - 0.2],
            [b, lo, z - 0.2],
            [b, lo, z + 0.2],
            [a, lo, z + 0.2],
          ],
          [0, -1, 0],
          ivory,
        );
      }
  }
  box(g, 'stone', 0, y + h, 0, l + 0.45, 0.45, w + 0.45, ivory);
  if (detail >= 2) box(g, 'stone', 0, y + h + 0.45, 0, l + 0.7, 0.16, w + 0.7, ivory);
}

function barque(f, detail, { box }, data, floor) {
  const g = localFace(f, data.frame),
    l = data.length,
    w = data.width,
    y = floor + (data.red ? 0.45 : 0.15),
    h = data.height,
    tint = data.red ? red : ivory;
  if (detail === 0) {
    surface(
      g,
      [
        [
          [
            [-l / 2, -w / 2],
            [l / 2, -w / 2],
            [l / 2, w / 2],
            [-l / 2, w / 2],
          ],
        ],
      ],
      floor + h + 0.6,
      tint,
    );
    return;
  }
  box(
    g,
    data.red ? 'granite' : 'stone',
    0,
    floor - 0.4,
    0,
    l + 0.4,
    y - floor + 0.4,
    w + 0.4,
    data.red ? dark : ivory,
  );
  const wall = Math.min(0.8, w * 0.18),
    opening = Math.min(2.15, w * 0.46),
    side = (w - opening) / 2;
  if (detail === 1 && !data.red) {
    for (const sign of [-1, 1]) box(g, 'wall', 0, y, sign * (w / 2 - wall / 2), l, h, wall, tint);
    surface(
      g,
      [
        [
          [
            [-l / 2 - 0.15, -w / 2 - 0.15],
            [l / 2 + 0.15, -w / 2 - 0.15],
            [l / 2 + 0.15, w / 2 + 0.15],
            [-l / 2 - 0.15, w / 2 + 0.15],
          ],
        ],
      ],
      y + h + 0.4,
      ivory,
    );
    return;
  }
  for (const sign of [-1, 1])
    box(g, data.red ? 'granite' : 'wall', 0, y, sign * (w / 2 - wall / 2), l, h, wall, tint);
  for (const sign of [-1, 1]) {
    if (detail >= 2)
      for (const s of [-1, 1])
        box(
          g,
          data.red ? 'granite' : 'wall',
          sign * (l / 2 - wall / 2),
          y,
          (s * (opening + side)) / 2,
          wall,
          h,
          side,
          tint,
        );
    box(
      g,
      data.red ? 'granite' : 'stone',
      sign * (l / 2 - wall / 2),
      y + h * 0.7,
      0,
      wall,
      h * 0.3,
      opening,
      tint,
    );
    if (data.red)
      steps(g, sign * (l / 2 + 1.6), (sign * l) / 2, opening, y, floor, detail, box, dark);
  }
  if (data.red) {
    if (detail >= 2)
      for (const z of [-w / 2, w / 2]) box(g, 'granite', 0, y + h, z, l + 0.25, 0.35, 0.65, tint);
    if (detail >= 2)
      for (const x of [-l / 2, l / 2]) box(g, 'granite', x, y + h, 0, 0.65, 0.5, w + 0.4, tint);
    if (detail >= 2) {
      for (const sign of [-1, 1])
        box(g, 'granite', -l * 0.12, y, sign * (w / 4 + 0.45), 0.8, h, w / 2 - 1, tint);
      box(g, 'granite', -l * 0.12, y + h * 0.72, 0, 0.8, h * 0.28, 1.9, tint);
    }
  } else box(g, 'stone', 0, y + h, 0, l + 0.3, 0.4, w + 0.3, ivory);
}

function peristyle(f, detail, { box }, data, floor) {
  surface(f, data.polygons, floor);
  const posts = [];
  for (const [ri, path] of data.runs.entries()) {
    if (detail === 1 && ri === 3) continue;
    if (detail === 0) {
      continue;
    }
    const [a, b] = path,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      u = [dx / len, dz / len],
      v = [-u[1], u[0]],
      g = localFace(f, { origin: a, u, v }),
      count = detail === 1 ? 1 : Math.max(3, Math.round(len / 3.6) + 1);
    for (const sign of detail === 1 ? [0] : [-1, 1])
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? len / 2 : (i * len) / (count - 1),
          z = sign * 1.4,
          point = [a[0] + u[0] * x + v[0] * z, a[1] + u[1] * x + v[1] * z];
        if (posts.some((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1.7)) continue;
        posts.push(point);
        box(g, 'stone', x, floor, z, 0.95, detail === 1 ? 4.17 + ri * 0.04 : 3.55, 0.95);
        if (detail === 2) box(g, 'stone', x, floor + 3.55, z, 1.5, 0.62 + ri * 0.04, 1.5);
        if (detail >= 3) {
          box(g, 'stone', x, floor + 3.55, z, 1.25, 0.4, 1.25);
          box(g, 'stone', x, floor + 3.95, z, 1.5, 0.22 + ri * 0.04, 1.5);
        }
      }
    for (const sign of detail === 1 ? [0] : [-1, 1])
      box(
        g,
        'stone',
        len / 2,
        floor + 4.17 + ri * 0.04,
        sign * 1.4,
        len + 1.35,
        0.65,
        detail === 1 ? 3.5 : 1.55,
      );
  }
}

function ruin(f, detail, { box }, data, floor) {
  const g = localFace(f, data.frame),
    l = data.length,
    w = data.width;
  surface(
    g,
    [
      [
        [
          [-l / 2, -w / 2],
          [l / 2, -w / 2],
          [l / 2, w / 2],
          [-l / 2, w / 2],
        ],
      ],
    ],
    floor,
  );
  if (detail === 0) return;
  if (detail === 1) {
    for (const [a, b] of [
      [
        [-l / 2, -w / 2],
        [l / 2, -w / 2],
      ],
      [
        [l / 2, -w / 2],
        [l / 2, w / 2],
      ],
      [
        [l / 2, w / 2],
        [-l / 2, w / 2],
      ],
    ]) {
      const p = [
          [a[0], floor, a[1]],
          [b[0], floor, b[1]],
          [b[0], floor + data.height, b[1]],
          [a[0], floor + data.height, a[1]],
        ],
        n = [b[1] - a[1], 0, a[0] - b[0]];
      g('wall', p, n);
      g(
        'wall',
        p.toReversed(),
        n.map((v) => -v),
      );
    }
    return;
  }
  for (const sign of [-1, 1]) box(g, 'wall', 0, floor, sign * (w / 2 - 0.45), l, data.height, 0.9);
  box(g, 'wall', l / 2 - 0.45, floor, 0, 0.9, data.height, w);
  for (const sign of [-1, 1])
    box(g, 'wall', -l / 2 + 0.45, floor, sign * (w / 4 + 0.55), 0.9, data.height, w / 2 - 1.2);
  if (detail >= 2) {
    box(g, 'stone', -l / 2 + 0.45, floor + data.height * 0.7, 0, 1, data.height * 0.3, 2.2);
    for (const z of [-w * 0.23, w * 0.23])
      box(g, 'wall', l * 0.12, floor, z, 0.8, data.height * 0.65, w * 0.3);
  }
}

function kiosk(f, detail, { box }, data, floor) {
  const g = localFace(f, data.frame),
    l = data.length,
    w = data.width;
  surface(
    g,
    [
      [
        [
          [-l / 2, -w / 2],
          [l / 2, -w / 2],
          [l / 2, w / 2],
          [-l / 2, w / 2],
        ],
      ],
    ],
    floor,
  );
  if (detail === 0) return;
  const count = detail === 1 ? 2 : 4;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < count; i++)
      box(
        g,
        'stone',
        -l / 2 + 1 + (i * (l - 2)) / (count - 1),
        floor,
        sign * (w / 2 - 1.2),
        1.2,
        4.4,
        1.2,
      );
    box(g, 'stone', 0, floor + 4.4, sign * (w / 2 - 1.2), l, 0.6, 2.5);
  }
}

function montu(f, detail, { box, lathe }, data, floor) {
  const g = localFace(f, data.frame),
    l = data.length;
  box(g, 'flat', -3, floor - 0.15, 0, l - 6, 0.15, 5.2);
  if (detail === 0) {
    // Low wall fragments are subpixel at skyline distance; keep the route floor.
    return;
  }
  for (const [index, [a, b, width, height]] of data.walls.entries()) {
    if (detail === 1 && index >= 5) continue;
    const count = detail === 1 ? 1 : detail === 2 ? 2 : 5;
    for (let i = 0; i < count; i++) {
      const p = a.map((v, k) => v + ((b[k] - v) * i) / count),
        q = a.map((v, k) => v + ((b[k] - v) * (i + 1)) / count);
      run(
        g,
        box,
        p,
        q,
        width,
        height * (detail === 1 ? 1 : 0.75 + ((i + 2) % 4) * 0.09),
        floor - 0.2,
      );
    }
  }
  for (const z of [-6, 0, 6]) box(g, 'stone', -22, floor, z, 2.5, 3.4 + (z === 0 ? 0.4 : 0), 2.4);
  if (detail >= 2)
    for (const z of [-3, 3])
      lathe(
        g,
        -12,
        z,
        [
          [0, 1.15],
          [0.45, 1.15],
          [2.3, 0.88],
        ],
        detail < 3 ? 6 : 12,
      );
  if (detail >= 2) {
    for (const x of [2, 13, 24])
      for (const z of [-9, 9]) box(g, 'stone', x, floor, z, 1.4, 1.4 + (x % 3) * 0.3, 1.4);
    for (const x of [-7, 5, 17]) box(g, 'wall', x, floor, 20, 1.1, 2.15, 18);
  }
}

export function buildKarnakNorth(f, detail, primitives, rec) {
  const data = rec.north;
  if (!data) throw new Error('Karnak northern source parameters missing');
  whiteChapel(
    f.withGrade(`building:${data.white.mapFeatureId}`),
    detail,
    primitives,
    data.white,
    rec.floorY,
  );
  barque(
    f.withGrade(`building:${data.red.mapFeatureId}`),
    detail,
    primitives,
    data.red,
    rec.floorY,
  );
  for (const chapel of data.alabaster) {
    const g = f.withGrade(`building:${chapel.mapFeatureId}`);
    if (detail > 0) barque(g, detail, primitives, chapel, rec.floorY);
    else surface(g, [[chapel.outline]], rec.floorY);
  }
  peristyle(f.withGrade('peristyle'), detail, primitives, data.peristyle, rec.floorY);
  for (const chapel of data.ruins)
    ruin(f.withGrade(`building:${chapel.mapFeatureId}`), detail, primitives, chapel, rec.floorY);
  kiosk(
    f.withGrade(`building:${data.hakoris.mapFeatureId}`),
    detail,
    primitives,
    data.hakoris,
    rec.floorY,
  );
  montu(f.withGrade('montu'), detail, primitives, data.montu, rec.floorY);
}
