/** Mut's separate open ruin ranges and the concave Isheru lake. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
export const karnakMutCandidateId = 'N0489';

function localFace(f, { origin, u, v }) {
  return (role, points, normal, tint) =>
    f(
      role,
      points.map(([x, y, z]) => [
        origin[0] + u[0] * x + v[0] * z,
        y,
        origin[1] + u[1] * x + v[1] * z,
      ]),
      [u[0] * normal[0] + v[0] * normal[2], normal[1], u[1] * normal[0] + v[1] * normal[2]],
      tint,
    );
}
function surface(f, role, polygons, y, up = true) {
  for (const polygon of polygons) {
    const points = polygon.flat(),
      holes = [];
    let n = polygon[0].length;
    for (const ring of polygon.slice(1)) {
      holes.push(n);
      n += ring.length;
    }
    const indices = earcut(points.flat(), holes, 2);
    for (let i = 0; i < indices.length; i += 3)
      f(
        role,
        indices.slice(i, i + 3).map((k) => [points[k][0], y, points[k][1]]),
        [0, up ? 1 : -1, 0],
      );
  }
}
function floorRect(f, x0, z0, x1, z1, y) {
  surface(
    f,
    'flat',
    [
      [
        [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ],
      ],
    ],
    y,
  );
}
/** A continuous irregular wall profile, rather than overlapping loose boxes. */
function wall(f, _box, a, b, width, height, floor, detail) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    g = localFace(f, { origin: a, u: [dx / l, dz / l], v: [-dz / l, dx / l] }),
    count = detail <= 2 ? 1 : 4;
  if (detail === 0) {
    const ps = [
      [0, floor, 0],
      [l, floor, 0],
      [l, floor + height, 0],
      [0, floor + height, 0],
    ];
    g('wall', ps, [0, 0, 1]);
    g('wall', ps.toReversed(), [0, 0, -1]);
    return;
  }
  if (detail === 1) {
    for (const s of [-1, 1])
      g(
        'wall',
        [
          [0, floor - 0.25, (s * width) / 2],
          [l, floor - 0.25, (s * width) / 2],
          [l, floor + height, (s * width) / 2],
          [0, floor + height, (s * width) / 2],
        ],
        [0, 0, s],
      );
    g(
      'stone',
      [
        [0, floor + height, -width / 2],
        [l, floor + height, -width / 2],
        [l, floor + height, width / 2],
        [0, floor + height, width / 2],
      ],
      [0, 1, 0],
    );
    return;
  }
  const stations = Array.from({ length: count + 1 }, (_, i) => [
      (l * i) / count,
      floor + height * (0.72 + ((i + 2) % 4) * 0.09),
    ]),
    base = floor - 0.25;
  for (let i = 0; i < count; i++) {
    const [a, ha] = stations[i],
      [b, hb] = stations[i + 1];
    for (const s of [-1, 1])
      g(
        'wall',
        [
          [a, base, (s * width) / 2],
          [b, base, (s * width) / 2],
          [b, hb, (s * width) / 2],
          [a, ha, (s * width) / 2],
        ],
        [0, 0, s],
      );
    g(
      'stone',
      [
        [a, ha, -width / 2],
        [b, hb, -width / 2],
        [b, hb, width / 2],
        [a, ha, width / 2],
      ],
      [0, 1, 0],
    );
    g(
      'wall',
      [
        [a, base, -width / 2],
        [b, base, -width / 2],
        [b, base, width / 2],
        [a, base, width / 2],
      ],
      [0, -1, 0],
    );
  }
  for (const [i, s] of [
    [0, -1],
    [count, 1],
  ]) {
    const [x, h] = stations[i];
    g(
      'wall',
      [
        [x, base, -width / 2],
        [x, h, -width / 2],
        [x, h, width / 2],
        [x, base, width / 2],
      ],
      [s, 0, 0],
    );
  }
}
function doorway(f, box, x, width, height, opening, floor, detail, depth = 1.8) {
  const wing = (width - opening) / 2;
  for (const s of [-1, 1])
    wall(
      f,
      box,
      [x, (s * opening) / 2],
      [x, s * (opening / 2 + wing)],
      depth,
      height * (s < 0 ? 0.88 : 1),
      floor,
      detail,
    );
  if (detail > 0)
    box(f, 'stone', x, floor + height * 0.68, 0, depth, Math.max(0.45, height * 0.2), opening);
}
function stub(f, box, lathe, x, z, h, detail, r = 0.72) {
  if (detail === 1) {
    box(f, 'stone', x, 0.15, z, r * 1.8, h, r * 1.8);
    return;
  }
  const profile =
    detail === 2
      ? [
          [0, r * 1.13],
          [h, r * 0.9],
        ]
      : [
          [0, r * 1.16],
          [0.2, r * 1.16],
          [0.28, r],
          [h * 0.65, r * 0.95],
          [h, r * 0.9],
        ];
  lathe(f, x, z, profile, detail === 2 ? 4 : 8, 'stone');
}
function lake(f, detail, data, floor) {
  const outline = detail <= 1 ? data.farOutline : data.outline,
    outer = detail <= 1 ? data.farOuter : data.outer;
  surface(f, 'water', [[outline]], floor + data.waterY);
  surface(f, 'flat', detail <= 1 ? data.farBankPolygons : data.bankPolygons, floor);
  if (detail === 0) return;
  surface(f, 'flat', [[outer]], floor + data.baseY);
  surface(f, 'flat', [[outer, outline]], floor + data.baseY, false);
  for (const [ring, inner] of [
    [outline, true],
    [outer, false],
  ])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        sign = inner ? -1 : 1;
      f(
        'flat',
        [
          [a[0], floor + data.baseY, a[1]],
          [b[0], floor + data.baseY, b[1]],
          [b[0], floor, b[1]],
          [a[0], floor, a[1]],
        ],
        [(sign * (b[1] - a[1])) / l, 0, (-sign * (b[0] - a[0])) / l],
      );
    }
}
function statue(f, box, lathe, x, z, detail) {
  // Original coarse seated Sekhmet silhouette: no copied carvings or exact inventory.
  if (detail === 2) {
    box(f, 'granite', x, 0.15, z, 1.15, 0.24, 1.4);
    box(f, 'granite', x, 0.39, z, 0.85, 1.57, 0.95);
    box(f, 'granite', x, 1.96, z, 0.64, 0.56, 0.52);
    return;
  }
  box(f, 'granite', x, 0.15, z, 1.15, 0.24, 1.4);
  box(f, 'granite', x, 0.39, z + 0.18, 0.85, 1.05, 0.85);
  box(f, 'granite', x, 0.39, z - 0.38, 0.75, 0.56, 0.6);
  box(f, 'granite', x, 1.31, z, 0.64, 0.65, 0.52);
  if (detail >= 3) {
    lathe(
      f,
      x,
      z,
      [
        [1.81, 0.27],
        [2.07, 0.36],
        [2.38, 0.3],
      ],
      8,
      'granite',
    );
    for (const s of [-1, 1]) box(f, 'granite', x + s * 0.23, 2.45, z, 0.14, 0.16, 0.16);
  } else box(f, 'granite', x, 1.96, z, 0.64, 0.56, 0.52);
}
function mainTemple(f, detail, { box, lathe }, data, floor) {
  const g = localFace(f, data.frame);
  surface(f, 'flat', data.floorPolygons, floor);
  // Independent tapered ranges keep the dry peninsula clear of the crescent.
  for (const [a, b, w, h] of [
    [[-43, -28], [26, -28], 1.8, 1.7],
    [[-43, 28], [26, 28], 1.8, 1.9],
    [[26, -20], [51, -20], 1.8, 1.6],
    [[26, 20], [51, 20], 1.8, 2.1],
    [[51, -11], [78, -11], 1.5, 1.4],
    [[51, 11], [78, 11], 1.5, 1.6],
    [[78, -11], [78, 11], 1.5, 1.9],
  ]) {
    if (detail === 0) continue;
    wall(g, box, a, b, w, h, floor, detail);
  }
  doorway(g, box, -5, 56, 4.7, 5.6, floor, detail, 4.1);
  if (detail === 0) return;
  doorway(g, box, 26, 40, 3.8, 4.8, floor, detail, 2.5);
  doorway(g, box, 51, 22, 2.8, 3.6, floor, detail, 1.7);
  floorRect(localFace(f.withGrade('mut-approach'), data.frame), -78, -2.2, -43, 2.2, floor);
  // Both porches are mostly column stubs; only four taller remnants are authored.
  for (const s of [-1, 1])
    for (const row of detail === 1 ? [1] : [0, 1])
      for (let i = 0; i < (detail === 1 ? 2 : 6); i++) {
        const x = -37 + i * (detail === 1 ? 25 : 5),
          z = s * (12 + row * 9),
          h = [2, 4].includes(i) && row === 0 ? 3.4 : 0.7 + ((i + row) % 3) * 0.46;
        stub(g, box, lathe, x, z, h, detail, 0.9);
      }
  if (detail >= 2) {
    for (const s of [-1, 1])
      for (const x of [31, 39, 46])
        stub(g, box, lathe, x, s * 9, 1.1 + (x % 3) * 0.35, detail, 0.74);
    for (const x of [58, 66, 72])
      for (const s of [-1, 1])
        wall(g, box, [x, s * 2.3], [x, s * 10], 1.1, 1.2 + (x % 4) * 0.15, floor, detail);
    for (const s of [-1, 1]) wall(g, box, [54, s * 3], [76, s * 3], 0.95, 1.6, floor, detail);
    for (const s of [-1, 1])
      for (let i = 0; i < 8; i++) statue(g, box, lathe, -31 + i * 6, s * (i < 5 ? 25 : 17), detail);
    // A few doorway jambs and supported sill fragments; the upper court stays open.
    for (const s of [-1, 1]) box(g, 'stone', -9, floor, s * 3.5, 1.5, 3.2, 1.8);
    box(g, 'stone', 43, floor, 13, 3.2, 0.7, 1.6);
  }
}
function openRange(f, detail, { box, lathe }, data, floor) {
  const g = localFace(f, data.frame),
    l = data.length,
    w = data.width;
  surface(f, 'flat', [[data.outline]], floor);
  for (const s of [-1, 1])
    wall(g, box, [-l / 2, (s * w) / 2], [l / 2, (s * w) / 2], 1.4, 2.3, floor, detail);
  wall(g, box, [l / 2, -w / 2], [l / 2, w / 2], 1.4, 2.1, floor, detail);
  doorway(g, box, -l / 2 + 1, w, 3.6, 3.2, floor, detail, 2.8);
  if (detail === 0) return;
  doorway(g, box, -l * 0.04, w - 2.8, 2.8, 2.8, floor, detail);
  if (detail >= 2) {
    for (const x of [l * 0.16, l * 0.3]) {
      doorway(g, box, x, w - 2.8, 1.9, 2.5, floor, detail, 1.1);
    }
    for (const s of [-1, 1])
      wall(g, box, [l * 0.02, s * w * 0.22], [l / 2 - 1, s * w * 0.22], 1, 1.4, floor, detail);
    for (const s of [-1, 1])
      for (let i = 0; i < 5; i++)
        stub(
          g,
          box,
          lathe,
          -l * 0.35 + i * l * 0.06,
          s * w * 0.31,
          0.8 + (i % 3) * 0.4,
          detail,
          0.64,
        );
  }
}
export function buildKarnakMut(f, detail, primitives, rec) {
  const data = rec.mut;
  if (!data) throw new Error('Karnak Mut parameters missing');
  lake(f.withGrade('isheru'), detail, data.lake, rec.floorY);
  mainTemple(f.withGrade('mut'), detail, primitives, data.main, rec.floorY);
  openRange(f.withGrade('ramessesIII'), detail, primitives, data.ramessesIII, rec.floorY);
  openRange(f.withGrade('templeA'), detail, primitives, data.templeA, rec.floorY);
  const gate = localFace(f.withGrade('propylon'), data.propylon.frame);
  surface(f.withGrade('propylon'), 'flat', [[data.propylon.outline]], rec.floorY);
  doorway(
    gate,
    primitives.box,
    0,
    data.propylon.width,
    data.propylon.height,
    data.propylon.opening,
    rec.floorY,
    detail,
    data.propylon.depth,
  );
  {
    const g = localFace(f.withGrade('chapelB'), data.chapelB.frame),
      l = data.chapelB.length,
      w = data.chapelB.width;
    floorRect(g, -l / 2, -w / 2, l / 2, w / 2, rec.floorY);
    if (detail < 3) return;
    for (const s of [-1, 1])
      wall(
        g,
        primitives.box,
        [-l / 2, (s * w) / 2],
        [l / 2, (s * w) / 2],
        0.9,
        0.9,
        rec.floorY,
        detail,
      );
    wall(g, primitives.box, [l / 2, -w / 2], [l / 2, w / 2], 0.9, 1.2, rec.floorY, detail);
  }
}
