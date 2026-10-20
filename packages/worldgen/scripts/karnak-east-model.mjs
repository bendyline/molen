/** Picture-guided eastern Amun exterior; controls live in the Karnak source frame. */
import './install-deterministic-math.mjs';

export const karnakEastCandidateId = 'N0489';

/** A battered wall follows its own mapped run, with a coarse broken top. */
function wallRun(f, path, width, height, detail, floor, seed = 0) {
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1],
      b = path[k],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    const count = detail <= 1 ? 1 : detail === 2 ? 2 : 6;
    const stations = Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count,
        h = height * (detail === 0 ? 1 : 0.78 + ((i * 3 + k + seed) % 5) * 0.055);
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], h };
    });
    const v = (q, side, top) => {
      const w = width / 2 - (top ? Math.min(width * 0.24, q.h * 0.045) : 0);
      return [q.p[0] + n[0] * side * w, floor + (top ? q.h : -0.55), q.p[1] + n[1] * side * w];
    };
    for (let i = 1; i < stations.length; i++) {
      const p = stations[i - 1],
        q = stations[i];
      for (const side of [-1, 1])
        f(
          'wall',
          [v(p, side, false), v(q, side, false), v(q, side, true), v(p, side, true)],
          [n[0] * side, 0, n[1] * side],
        );
      if (detail > 0)
        f('stone', [v(p, -1, true), v(q, -1, true), v(q, 1, true), v(p, 1, true)], [0, 1, 0]);
      f('wall', [v(p, -1, false), v(q, -1, false), v(q, 1, false), v(p, 1, false)], [0, -1, 0]);
    }
    for (const [q, sign] of detail === 0
      ? []
      : [
          [stations[0], -1],
          [stations.at(-1), 1],
        ])
      f(
        'wall',
        [v(q, -1, false), v(q, 1, false), v(q, 1, true), v(q, -1, true)],
        [((b[0] - a[0]) / length) * sign, 0, ((b[1] - a[1]) / length) * sign],
      );
  }
}

function obelisk(f, box, data, detail, floor) {
  const [x, z] = data.center,
    w = data.width,
    h = data.height,
    plinth = 0.85,
    shoulder = h - 2.7;
  if (detail > 0) box(f, 'granite', x, floor, z, w + 1.25, plinth, w + 1.25);
  const corners = (radius, y) => [
    [x - radius, y, z - radius],
    [x + radius, y, z - radius],
    [x + radius, y, z + radius],
    [x - radius, y, z + radius],
  ];
  const lo = corners(w / 2, floor + plinth),
    hi = corners(w * 0.32, floor + shoulder);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      normal = [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i];
    f('granite', [lo[i], lo[j], hi[j], hi[i]], normal);
    f('granite', [hi[i], hi[j], [x, floor + h, z]], normal);
  }
  f('granite', lo, [0, -1, 0]);
  if (detail >= 2) box(f, 'granite', x, floor - 0.25, z, w + 2.15, 0.25, w + 2.15);
}

/** Two genuine doorway voids under the roof; no photographic hieroglyph textures. */
function shrine(f, box, bounds, height, detail, floor, { role = 'wall', roof = true } = {}) {
  const [x0, z0, x1, z1] = bounds,
    z = (z0 + z1) / 2,
    x = (x0 + x1) / 2,
    width = z1 - z0;
  if (detail === 0) {
    if (!roof && height <= 5) return;
    box(f, role, x, floor, z, x1 - x0, height, width);
    return;
  }
  if (detail === 1) {
    if (roof) box(f, role, x, floor, z, x1 - x0, height + 0.5, width);
    else {
      for (const edge of [z0 + 0.45, z1 - 0.45]) box(f, role, x, floor, edge, x1 - x0, height, 0.9);
      for (const edge of [x0 + 0.45, x1 - 0.45]) box(f, role, edge, floor, z, 0.9, height, width);
    }
    return;
  }
  box(f, role, x, floor, z0 + 0.45, x1 - x0, height, 0.9);
  box(f, role, x, floor, z1 - 0.45, x1 - x0, height, 0.9);
  const opening = Math.min(2.15, width * 0.32),
    side = (width - opening) / 2;
  for (const end of [x0 + 0.45, x1 - 0.45]) {
    for (const sign of [-1, 1])
      box(f, role, end, floor, z + sign * (opening / 2 + side / 2), 0.9, height, side);
    box(f, role, end, floor + height * 0.62, z, 1, height * 0.38, opening);
  }
  if (roof) box(f, 'stone', x, floor + height, z, x1 - x0 + 0.25, 0.5, width + 0.25);
}

function akhmenu(f, primitives, data, detail, floor) {
  const { box, lathe } = primitives;
  const [x0, z0, x1, z1] = data.festivalHall;
  if (detail === 0)
    f(
      'stone',
      [
        [(x0 + x1) / 2 - 4.6, floor + 10, z0],
        [(x0 + x1) / 2 + 4.6, floor + 10, z0],
        [(x0 + x1) / 2 + 4.6, floor + 10, z1],
        [(x0 + x1) / 2 - 4.6, floor + 10, z1],
      ],
      [0, 1, 0],
    );
  else box(f, 'stone', (x0 + x1) / 2, floor + 9.2, (z0 + z1) / 2, 9.2, 0.8, z1 - z0);
  for (const x of [x0 + 1.45, x1 - 1.45])
    if (detail === 0)
      f(
        'stone',
        [
          [x - 1.5, floor + 8.4, z0],
          [x + 1.5, floor + 8.4, z0],
          [x + 1.5, floor + 8.4, z1],
          [x - 1.5, floor + 8.4, z1],
        ],
        [0, 1, 0],
      );
    else box(f, 'stone', x, floor + 7.6, (z0 + z1) / 2, 3, 0.8, z1 - z0);
  for (const z of [z0 + 0.7, z1 - 0.7]) box(f, 'wall', (x0 + x1) / 2, floor, z, x1 - x0, 7.6, 1.4);
  const count = detail <= 1 ? 2 : 10;
  for (const x of [185.7, 191.1])
    for (let i = 0; i < count; i++) {
      if (detail === 0 && x > 190) continue;
      const z = -22 + (i * 40) / (count - 1);
      if (detail === 0) {
        box(f, 'stone', x, floor, z, 1.5, 9.2, 1.5);
        continue;
      }
      if (detail === 1) {
        box(f, 'stone', x, floor, z, 1.7, 9.2, 1.7);
        continue;
      }
      // Coarse tent-pole capital profile; exact carving/paint is outside this exterior scope.
      const profile =
        detail < 3
          ? [
              [0, 0.83],
              [7.45, 0.65],
              [8.2, 1],
            ]
          : [
              [0, 0.94],
              [0.35, 0.94],
              [0.6, 0.8],
              [6.9, 0.62],
              [7.7, 1.03],
              [8.2, 0.72],
            ];
      lathe(f, x, z, profile, detail < 3 ? 4 : 12);
    }
  if (detail > 0) {
    for (const x of [185.7, 191.1]) box(f, 'stone', x, floor + 8.2, -2, 1.7, 1, 45);
    const outer = detail === 1 ? 3 : 12;
    for (const x of [182.2, 195.2])
      for (let i = 0; i < outer; i++)
        box(f, 'stone', x, floor, -23.5 + (i * 43) / (outer - 1), 1.1, 7.6, 1.2);
    if (detail >= 2)
      for (let i = 0; i < 10; i++)
        box(f, 'stone', 188.4, floor + 8.2, -22 + (i * 40) / 9, 6.8, 1, 1.3);
  }
  // Northern botanical chamber, southern Sokarian rooms and the rear range stay distinct.
  shrine(f, box, data.botanical, 5.3, detail, floor, { roof: false });
  shrine(f, box, data.sokarian, 5.8, detail, floor, { roof: false });
  shrine(f, box, data.southRange, 6.5, detail, floor);
  if (detail >= 2) {
    for (const z of [8.5, 16.8]) box(f, 'wall', 207, floor, z, 19, 4.3, 0.9);
    box(f, 'stone', 207, floor + 5.8, 5, 19, 0.5, 6.5);
    for (const x of [202.5, 212])
      lathe(
        f,
        x,
        -13,
        [
          [0, 0.8],
          [4.6, 0.65],
          [5.3, 1.1],
        ],
        detail === 2 ? 4 : 12,
      );
  }
}

function outerTemples(f, primitives, data, detail, floor) {
  const { box, lathe } = primitives;
  shrine(f, box, data.contra, 4.8, detail, floor, { roof: false });
  const [x0, z0, x1, z1] = data.ramesses;
  box(f, 'stone', (x0 + x1) / 2, floor - 0.5, (z0 + z1) / 2, x1 - x0, 0.5, z1 - z0);
  if (detail === 0) box(f, 'wall', (x0 + x1) / 2, floor, z0 + 1, x1 - x0, 5.5, 2);
  else {
    box(f, 'wall', (x0 + x1) / 2, floor, z0 + 0.7, x1 - x0, 5.5, 1.4);
    box(f, 'wall', (x0 + x1) / 2, floor, z1 - 0.7, x1 - x0, 3.4, 1.4);
    box(f, 'wall', x1 - 0.7, floor, (z0 + z1) / 2, 1.4, 5, z1 - z0);
    for (const z of [z0 + 3.5, z1 - 3.5]) box(f, 'stone', x0 + 1, floor, z, 2, 6.2, 3.8);
    box(f, 'stone', x0 + 1, floor + 5, (z0 + z1) / 2, 2, 1.2, z1 - z0 - 6);
    if (detail >= 2)
      for (const x of [263, 272])
        for (const z of [-9, 1]) box(f, 'stone', x, floor, z, 1.3, x === 263 ? 4.2 : 2.6, 1.3);
  }
  const [a, b, c, e] = data.easternColonnade;
  box(f, 'stone', (a + c) / 2, floor - 0.5, (b + e) / 2, c - a, 0.5, e - b);
  const n = detail <= 1 ? 2 : 4;
  for (const x of [291, 301])
    for (let i = 0; i < n; i++) {
      if (detail === 0 && x > 300) continue;
      const z = -11 + (i * 17) / (n - 1);
      if (detail <= 1) box(f, 'stone', x, floor, z, 1.6, 8.9, 1.6);
      else
        lathe(
          f,
          x,
          z,
          detail < 3
            ? [
                [0, 1.1],
                [7.8, 0.8],
                [8.9, 1.4],
              ]
            : [
                [0, 1.3],
                [0.4, 1.3],
                [0.6, 1],
                [7.5, 0.8],
                [8.5, 1.45],
                [8.9, 1.2],
              ],
          detail < 3 ? 4 : 12,
        );
    }
  if (detail > 0) for (const x of [291, 301]) box(f, 'stone', x, floor + 8.9, -2.5, 2.6, 1, 20);
}

export function buildKarnakEast(f, detail, primitives, rec) {
  const { box, lathe, pylon } = primitives,
    data = rec.east,
    floor = rec.floorY;
  if (!data) throw new Error('Karnak eastern source parameters missing');
  box(f, 'stone', 136, floor - 0.5, -5.7, 186, 0.5, 102);
  box(f, 'stone', 231.2, floor - 0.5, -9.6, 8.3, 0.5, 16.5);
  pylon(f, 59.5, -42.4, -14.6, 7.1, [11.2, 14.8, 16.5, 17.1, 15.2], detail);
  pylon(f, 59, -6.5, 35.8, 7.1, [15.7, 17.2, 13, 15.1, 12.8], detail);
  pylon(f, 83.6, -41.4, -11.7, 6.6, [9.5, 12, 11.3, 13.7, 10.2], detail);
  pylon(f, 81.1, -7.7, 36.6, 6.8, [11.9, 10.2, 13.4, 12, 10.4], detail);
  wallRun(
    f,
    [
      [96.7, -34.8],
      [96.1, -19.7],
    ],
    4.1,
    8.8,
    detail,
    floor,
  );
  wallRun(
    f,
    [
      [95.7, 3.8],
      [95.2, 16.9],
    ],
    3.5,
    8.3,
    detail,
    floor,
    2,
  );
  for (const ob of data.obelisks) obelisk(f, box, ob, detail, floor);
  if (detail > 0) {
    const zs = detail === 1 ? [-34, 29] : [-35, -27, -19, 0, 8, 16, 24, 31];
    for (const x of [65.7, 76.3])
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i],
          h = x < 70 ? 9.8 : i % 3 === 0 ? 2.2 : 6.3;
        if (detail === 1) {
          box(f, 'stone', x, floor, z, 2.4, h, 2.4);
          continue;
        }
        lathe(
          f,
          x,
          z,
          detail < 3
            ? [
                [0, 1],
                [h * 0.87, 0.83],
                [h, 1.22],
              ]
            : [
                [0, 1.25],
                [0.45, 1.25],
                [0.65, 1],
                [h * 0.82, 0.83],
                [h, 1.22],
              ],
          detail < 3 ? 4 : 12,
        );
      }
    if (detail >= 2) for (const z of [-33, 4, 24]) box(f, 'stone', 66, floor + 9.8, z, 2.7, 0.9, 8);
  }
  shrine(f, box, data.centralBark, 6.3, detail, floor, { role: 'granite' });
  shrine(f, box, data.kamutef, 2.5, detail, floor, { roof: false });
  shrine(f, box, data.northChamber, 4.8, detail, floor);
  wallRun(f, data.northWall, 4.1, 9.2, detail, floor);
  wallRun(f, data.southWall, 4.3, 10.2, detail, floor, 3);
  for (const path of data.eastWall) wallRun(f, path, 4.4, 9.4, detail, floor, 1);
  // The Middle Kingdom court stays open. Only low picture-guided room remnants edge it.
  if (detail > 0)
    for (const z of [-35.7, 25.7]) {
      box(f, 'wall', 151, floor, z, 50, 2.2, 1.1);
      if (detail >= 2)
        for (const x of [128, 142, 158, 174])
          box(f, 'wall', x, floor, z + (z < 0 ? 4 : -4), 1, 1.4 + (x % 3) * 0.45, 7.5);
    }
  akhmenu(f, primitives, data, detail, floor);
  outerTemples(f, primitives, data, detail, floor);
}
