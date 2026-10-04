/** Original Montsoreau exterior reconstruction; metric dimensions below are provisional. */
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.84, 0.81, 0.7];
const trim = [0.9, 0.87, 0.77];
const slate = [0.26, 0.29, 0.31];
const glass = [0.1, 0.14, 0.14];
const wood = [0.3, 0.22, 0.14];
const ref = 'palette:#ffffff';
const near = (o) => !['skyline', 'district'].includes(o.detail);
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const master = (o) => !o.detail;
const face = (o, slot, p, color) => quad(o, slot, p, normalFor(...p), color);
function triangle(o, slot, p, color) {
  o.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    color,
  );
}
function frame(out, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rotate = ([a, y, b]) => [a * c + b * s, y, -a * s + b * c];
  return {
    detail: out.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
        name,
        (slot, ref, points, normal, uv, color) =>
          out[name](
            slot,
            ref,
            points.map((p) => {
              const q = rotate(p);
              return [q[0] + x, q[1], q[2] + z];
            }),
            rotate(normal),
            uv,
            color,
          ),
      ]),
    ),
  };
}
function ring(o, slot, x, z, radius, y0, y1, color, sides = 8) {
  const points = (y) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i * Math.PI * 2) / sides + Math.PI / sides;
      return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
    });
  loft(o, slot, [points(y0), points(y1)], color);
}
function cone(o, x, z, radius, y0, y1) {
  const p = Array.from({ length: 8 }, (_, i) => {
    const a = (-i * Math.PI) / 4 + Math.PI / 8;
    return [x + Math.cos(a) * radius, y0, z + Math.sin(a) * radius];
  });
  for (let i = 0; i < 8; i++) triangle(o, 'slate', [p[i], p[(i + 1) % 8], [x, y1, z]], slate);
}
// Local wall front is +Z. Openings have actual reveals at street/closeup/master levels.
function window(o, w, z = 0) {
  const { x, y, width = 1.6, height = 2.4, door = false, paired = false } = w;
  const left = x - width / 2,
    right = x + width / 2,
    top = y + height;
  face(
    o,
    door ? 'wood' : 'glass',
    [
      [left, y, z - 0.36],
      [right, y, z - 0.36],
      [right, top, z - 0.36],
      [left, top, z - 0.36],
    ],
    door ? wood : glass,
  );
  if (!near(o)) return;
  if (o.detail === 'street') {
    const panel = (a, b, c, d) =>
      face(
        o,
        'carved',
        [
          [a, b, z + 0.06],
          [c, b, z + 0.06],
          [c, d, z + 0.06],
          [a, d, z + 0.06],
        ],
        trim,
      );
    panel(left - 0.16, y - 0.16, left, top + 0.16);
    panel(right, y - 0.16, right + 0.16, top + 0.16);
    panel(left, y - 0.16, right, y);
    panel(left, top, right, top + 0.16);
    if (!door) {
      panel(x - 0.08, y, x + 0.08, top);
      if (!paired) panel(left, y + height * 0.61 - 0.08, right, y + height * 0.61 + 0.08);
    }
    return;
  }
  const t = fine(o) ? 0.19 : 0.16;
  for (const xx of [left, right])
    box(o, 'carved', [xx - t / 2, y - t, z - 0.4], [xx + t / 2, top + t, z + 0.14], trim);
  for (const yy of [y, top])
    box(o, 'carved', [left - 0.16, yy - 0.09, z - 0.4], [right + 0.16, yy + 0.09, z + 0.2], trim);
  if (!door) {
    box(o, 'carved', [x - 0.085, y, z - 0.31], [x + 0.085, top, z + 0.07], trim);
    if (!paired)
      box(
        o,
        'carved',
        [left, y + height * 0.61 - 0.08, z - 0.31],
        [right, y + height * 0.61 + 0.08, z + 0.07],
        trim,
      );
    if (fine(o)) {
      for (const xx of [left + 0.065, right - 0.065])
        box(o, 'wood', [xx - 0.045, y + 0.06, z - 0.33], [xx + 0.045, top - 0.06, z - 0.26], wood);
      for (let j = 1; j <= (master(o) ? 5 : 2); j++) {
        const yy = y + (height * j) / (master(o) ? 6 : 3);
        box(
          o,
          'wood',
          [left + 0.05, yy - 0.018, z - 0.3],
          [right - 0.05, yy + 0.018, z - 0.265],
          wood,
        );
      }
      for (const xx of [x - width * 0.25, x + width * 0.25])
        box(o, 'wood', [xx - 0.018, y, z - 0.3], [xx + 0.018, top, z - 0.265], wood);
    }
  } else if (fine(o)) {
    for (let j = 1; j < 7; j++)
      box(
        o,
        'wood',
        [left + (j * width) / 7 - 0.012, y, z - 0.345],
        [left + (j * width) / 7 + 0.012, top, z - 0.3],
        [0.18, 0.14, 0.1],
      );
  }
  if (fine(o)) {
    box(
      o,
      'carved',
      [left - 0.28, top + 0.16, z - 0.08],
      [right + 0.28, top + 0.3, z + 0.22],
      trim,
    );
    for (const xx of [left - 0.18, right + 0.18])
      box(o, 'carved', [xx - 0.045, y - 0.12, z + 0.08], [xx + 0.045, top + 0.16, z + 0.21], trim);
  }
}
function wall(o, width, bottom, top, windows = [], depth = 0.8) {
  if (!near(o)) {
    box(o, 'limestone', [-width / 2, bottom, -depth], [width / 2, top, -0.4], stone);
    if (o.detail !== 'skyline') for (const w of windows) window(o, w);
    return;
  }
  // Split at each opening, keeping horizontal and vertical stone boundaries watertight.
  const ys = [
    ...new Set([bottom, top, ...windows.flatMap((w) => [w.y, w.y + (w.height ?? 2.4)])]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++) {
    const y0 = ys[j - 1],
      y1 = ys[j],
      mid = (y0 + y1) / 2;
    const holes = windows
      .filter((w) => mid > w.y && mid < w.y + (w.height ?? 2.4))
      .map((w) => [w.x - (w.width ?? 1.6) / 2, w.x + (w.width ?? 1.6) / 2])
      .sort((a, b) => a[0] - b[0]);
    let x = -width / 2;
    for (const [left, right] of [...holes, [width / 2, width / 2]]) {
      if (left > x) {
        face(
          o,
          'limestone',
          [
            [x, y0, 0],
            [left, y0, 0],
            [left, y1, 0],
            [x, y1, 0],
          ],
          stone,
        );
        face(
          o,
          'limestone',
          [
            [left, y0, -depth],
            [x, y0, -depth],
            [x, y1, -depth],
            [left, y1, -depth],
          ],
          stone,
        );
      }
      x = right;
    }
  }
  for (const w of windows) window(o, w);
}
function rectangle(o, x0, x1, z0, z1, y0, y1, openings = {}) {
  if (o.detail === 'skyline') {
    box(o, 'limestone', [x0, y0, z0], [x1, y1, z1], stone);
    return;
  }
  wall(frame(o, (x0 + x1) / 2, z1), x1 - x0, y0, y1, openings.south);
  wall(frame(o, (x0 + x1) / 2, z0, Math.PI), x1 - x0, y0, y1, openings.north);
  wall(frame(o, x1, (z0 + z1) / 2, Math.PI / 2), z1 - z0, y0, y1, openings.east);
  wall(frame(o, x0, (z0 + z1) / 2, -Math.PI / 2), z1 - z0, y0, y1, openings.west);
  box(o, 'limestone', [x0, y0, z0], [x1, y0 + 0.2, z1], stone);
}
function cornice(o, width, y, gaps = []) {
  if (o.detail === 'skyline') return;
  box(o, 'carved', [-width / 2 - 0.18, y, -0.75], [width / 2 + 0.18, y + 0.3, 0.28], trim);
  if (!near(o)) return;
  const count = Math.floor(width / 0.92);
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / count;
    if (gaps.some((center) => Math.abs(x - center) < 1.55)) continue;
    for (let k = 0; k < (fine(o) ? 3 : 1); k++) {
      const levels = fine(o) ? 3 : 1;
      box(
        o,
        'carved',
        [x - 0.18, y - 0.75 + (k * 0.65) / levels, -0.1],
        [x + 0.18, y - 0.75 + ((k + 1) * 0.65) / levels, 0.05 + ((k + 1) * 0.23) / levels],
        trim,
      );
    }
  }
}
function roof(o, x0, x1, z0, z1, eave, ridge) {
  const z = (z0 + z1) / 2;
  face(
    o,
    'slate',
    [
      [x0, eave, z0],
      [x0, ridge, z],
      [x1, ridge, z],
      [x1, eave, z0],
    ],
    slate,
  );
  face(
    o,
    'slate',
    [
      [x1, eave, z1],
      [x1, ridge, z],
      [x0, ridge, z],
      [x0, eave, z1],
    ],
    slate,
  );
  triangle(
    o,
    'limestone',
    [
      [x0, eave, z0],
      [x0, eave, z1],
      [x0, ridge, z],
    ],
    stone,
  );
  triangle(
    o,
    'limestone',
    [
      [x1, eave, z1],
      [x1, eave, z0],
      [x1, ridge, z],
    ],
    stone,
  );
  if (near(o)) {
    beam(o, 'metal', [x0, ridge + 0.03, z], [x1, ridge + 0.03, z], 0.16, 0.12, slate);
    for (const zz of [z0, z1]) beam(o, 'metal', [x0, eave, zz], [x1, eave, zz], 0.13, 0.13, slate);
  }
}
function pinnacle(o, x, y, z, scale = 1) {
  box(
    o,
    'carved',
    [x - 0.14 * scale, y, z - 0.14 * scale],
    [x + 0.14 * scale, y + scale, z + 0.14 * scale],
    trim,
  );
  const p = [
    [x - 0.2 * scale, y + scale, z - 0.2 * scale],
    [x + 0.2 * scale, y + scale, z - 0.2 * scale],
    [x + 0.2 * scale, y + scale, z + 0.2 * scale],
    [x - 0.2 * scale, y + scale, z + 0.2 * scale],
  ];
  for (let i = 0; i < 4; i++)
    triangle(o, 'carved', [p[i], [x, y + 2.1 * scale, z], p[(i + 1) % 4]], trim);
  if (fine(o)) {
    for (const yy of [y + scale, y + 1.65 * scale])
      box(
        o,
        'carved',
        [x - 0.26 * scale, yy, z - 0.24 * scale],
        [x + 0.26 * scale, yy + 0.12 * scale, z + 0.24 * scale],
        trim,
      );
    if (master(o))
      for (const sign of [-1, 1])
        beam(
          o,
          'carved',
          [x, y + 0.45 * scale, z],
          [x + sign * 0.24 * scale, y + 0.72 * scale, z],
          0.14 * scale,
          0.14 * scale,
          trim,
        );
  }
}
function dormer(o, x) {
  // A two-level stone window bay rises through the eaves into a crocketed Gothic gable.
  const d = frame(o, x, 0.32);
  wall(
    d,
    2.8,
    19.8,
    26.7,
    [
      { x: 0, y: 20.25, width: 1.6, height: 2.15 },
      { x: 0, y: 24.05, width: 1.45, height: 2.1 },
    ],
    1.8,
  );
  triangle(
    d,
    'carved',
    [
      [-1.4, 26.7, 0],
      [1.4, 26.7, 0],
      [0, 29.8, 0],
    ],
    trim,
  );
  face(
    d,
    'slate',
    [
      [-1.4, 26.7, 0],
      [0, 29.8, 0],
      [0, 29.8, -2.8],
      [-1.4, 26.7, -2.8],
    ],
    slate,
  );
  face(
    d,
    'slate',
    [
      [0, 29.8, 0],
      [1.4, 26.7, 0],
      [1.4, 26.7, -2.8],
      [0, 29.8, -2.8],
    ],
    slate,
  );
  if (!near(o)) return;
  for (const sign of [-1, 1]) {
    beam(d, 'carved', [sign * 1.45, 26.55, 0.16], [0, 29.95, 0.16], 0.23, 0.25, trim);
    pinnacle(d, sign * 1.43, 25.6, 0.06, 0.85);
    if (fine(o))
      for (let i = 1; i <= 6; i++) {
        const t = i / 7,
          x = sign * 1.45 * (1 - t),
          y = 26.55 + t * 3.4;
        beam(d, 'carved', [x, y, 0.13], [x + sign * 0.21, y + 0.25, 0.24], 0.15, 0.17, trim);
        if (master(o))
          beam(
            d,
            'carved',
            [x + sign * 0.21, y + 0.25, 0.24],
            [x + sign * 0.16, y + 0.43, 0.28],
            0.13,
            0.13,
            trim,
          );
      }
  }
  pinnacle(d, 0, 29.8, 0.08, 0.65);
}
function squareTower(o, x0, x1, z0, z1) {
  const row = (xs) =>
    [8.8, 14.4, 21.2].flatMap((y) => xs.map((x) => ({ x, y, width: 1.45, height: 2.3 })));
  rectangle(o, x0, x1, z0, z1, 0, 27.1, {
    north: row([0]),
    east: row([0]),
    west: row([0]),
    south: row([0]),
  });
  for (const [x, z, a, width] of [
    [(x0 + x1) / 2, z0, Math.PI, x1 - x0],
    [(x0 + x1) / 2, z1, 0, x1 - x0],
    [x0, (z0 + z1) / 2, -Math.PI / 2, z1 - z0],
    [x1, (z0 + z1) / 2, Math.PI / 2, z1 - z0],
  ]) {
    const f = frame(o, x, z, a);
    cornice(f, width, 26.8);
    box(f, 'limestone', [-width / 2 - 0.18, 27.1, -0.2], [width / 2 + 0.18, 28.3, 0.26], stone);
    box(f, 'carved', [-width / 2 - 0.23, 28.3, -0.3], [width / 2 + 0.23, 28.48, 0.32], trim);
  }
  box(o, 'slate', [x0, 27.05, z0], [x1, 27.15, z1], slate);
}
function polygonStair(o, x, z, radius, bottom, top, renaissance) {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const f = frame(
      o,
      x + Math.sin(a) * radius * Math.cos(Math.PI / 8),
      z + Math.cos(a) * radius * Math.cos(Math.PI / 8),
      a,
    );
    const width = 2 * radius * Math.sin(Math.PI / 8);
    // The wall-facing half is unperforated; no repeated blind windows inside the building.
    const openings =
      i <= 2 || i >= 6
        ? renaissance
          ? [7.5, 11.9, 16.3, 20.7].map((y) => ({
              x: 0,
              y,
              width: 1.25,
              height: 2.7,
              paired: true,
            }))
          : [6, 10, 14, 18, 22, 26]
              .filter((_, j) => i === 0 || (j + i) % 3 === 0)
              .map((y) => ({ x: 0, y, width: 0.7, height: 1.1 }))
        : [];
    if (renaissance && i === 0)
      openings.push({ x: 0, y: 4.7, width: 1.3, height: 2.3, door: true });
    wall(f, width, bottom, top, openings, 0.45);
    if (renaissance && near(o)) {
      for (const yy of [7.1, 11.5, 15.9, 20.3, 24.6])
        box(f, 'carved', [-width / 2, yy, 0], [width / 2, yy + 0.16, 0.15], trim);
      for (const xx of [-width / 2 + 0.13, width / 2 - 0.13]) {
        box(f, 'carved', [xx - 0.07, 4.5, 0], [xx + 0.07, 25.1, 0.17], trim);
        if (fine(o))
          for (const yy of [10.9, 15.3, 19.7, 24.1]) {
            box(f, 'carved', [xx - 0.16, yy, 0.02], [xx + 0.16, yy + 0.24, 0.24], trim);
            // Small candelabra relief; figurative medallions remain a documented fidelity gap.
            tube(f, 'carved', [xx, yy - 1, 0.1], [xx, yy - 0.45, 0.1], 0.07, trim, 6);
          }
      }
      for (const yy of [26, 26.57])
        for (const xx of [-0.48, 0.48])
          tube(f, 'slate', [xx, yy, 0.01], [xx, yy, 0.035], 0.2, slate, fine(o) ? 16 : 8);
    }
  }
  if (renaissance) {
    ring(o, 'carved', x, z, radius + 0.12, 25.3, 25.55, trim);
    ring(o, 'carved', x, z, radius + 0.12, 27.0, 27.18, trim);
    box(o, 'slate', [x - 1.5, 25.25, z - 1.5], [x + 1.5, 25.35, z + 1.5], slate);
  } else {
    ring(o, 'carved', x, z, radius + 0.2, top - 0.25, top, trim);
    cone(o, x, z, radius + 0.45, top, 37.5);
    if (o.detail !== 'skyline') tube(o, 'metal', [x, 37.3, z], [x, 38.4, z], 0.06, slate, 6);
    else tube(o, 'metal', [x, 37.3, z], [x, 38.4, z], 0.08, slate, 4);
  }
}
function buildings(o) {
  const north = [-7.6, -2.5, 2.6, 7.7];
  const south = [-7.7, -0.9, 6.0];
  rectangle(o, -25.1, 17.0, -24.05, -11.2, 0, 20.8, {
    north: [8.8, 14.4].flatMap((y) => north.map((x) => ({ x, y, width: 1.6, height: 2.7 }))),
    south: [5.2, 11.3].flatMap((y) => south.map((x) => ({ x, y, width: 1.8, height: 2.7 }))),
  });
  roof(o, -15.1, 5.2, -24.1, -10.75, 21.0, 30.8);
  // Rear slate skirts meet the back walls below the two open terrace parapets.
  for (const [x0, x1] of [
    [-24.9, -15.1],
    [5.2, 16.8],
  ])
    face(
      o,
      'slate',
      [
        [x0, 21, -10.75],
        [x1, 21, -10.75],
        [x1, 28.2, -15.7],
        [x0, 28.2, -15.7],
      ],
      slate,
    );
  for (const [z, a, xs] of [
    [-24.12, Math.PI, [-7.6, -2.5, 2.6, 7.7]],
    [-11.05, 0, south],
  ]) {
    const f = frame(o, -4.05, z, a);
    cornice(f, 42.1, 20.6, xs);
    for (const x of xs) dormer(f, x);
  }
  squareTower(o, -25.3, -15.1, -26.4, -15.7);
  squareTower(o, 5.2, 17.1, -26.35, -15.7);
  // The battered river plinth differs from the sheer upper walls.
  for (const [x0, x1, z] of [
    [-25.3, -15.1, -26.4],
    [-15.1, 5.2, -24.05],
    [5.2, 17.1, -26.35],
  ]) {
    face(
      o,
      'limestone',
      [
        [x1, 0, z - 0.75],
        [x0, 0, z - 0.75],
        [x0, 3.8, z],
        [x1, 3.8, z],
      ],
      [0.6, 0.58, 0.5],
    );
    triangle(
      o,
      'limestone',
      [
        [x0, 0, z],
        [x0, 3.8, z],
        [x0, 0, z - 0.75],
      ],
      stone,
    );
    triangle(
      o,
      'limestone',
      [
        [x1, 0, z - 0.75],
        [x1, 3.8, z],
        [x1, 0, z],
      ],
      stone,
    );
  }
  // Lower west return and its distinctly lower lean-to roof.
  rectangle(o, -26, -16.9, -15.5, -2.8, 0, 13.8, {
    south: [{ x: 0, y: 7.2, width: 1.5, height: 2.2 }],
    west: [
      { x: -2, y: 7 },
      { x: 2, y: 7 },
    ],
  });
  face(
    o,
    'slate',
    [
      [-26.3, 14, -2.5],
      [-16.7, 14, -2.5],
      [-16.7, 20.6, -15.5],
      [-26.3, 20.6, -15.5],
    ],
    slate,
  );
  triangle(
    o,
    'limestone',
    [
      [-26, 13.8, -15.5],
      [-26, 13.8, -2.8],
      [-26, 20.45, -15.5],
    ],
    stone,
  );
  triangle(
    o,
    'limestone',
    [
      [-16.9, 13.8, -2.8],
      [-16.9, 13.8, -15.5],
      [-16.9, 20.45, -15.5],
    ],
    stone,
  );
  rectangle(o, -31.45, -25.3, -21.7, -11.5, 0, 13.8);
  roof(o, -31.6, -25.15, -21.8, -11.3, 14, 18.4);
  // Eastern return has its own floor levels and ridge at right angles to the main range.
  rectangle(o, 9.6, 19.2, -14.4, 3.4, 0, 21.2, {
    west: [-4.8, 0, 4.8].flatMap((x) =>
      [7, 13.1, 18.2].map((y) => ({ x, y, width: 1.5, height: 2.2 })),
    ),
    east: [-4.8, 0, 4.8].flatMap((x) => [7, 13.1].map((y) => ({ x, y, width: 1.5, height: 2.2 }))),
    south: [
      { x: 0, y: 6, width: 1.5, height: 2.2 },
      { x: 0, y: 13, width: 1.3, height: 2.1 },
      { x: 0, y: 18.4, width: 1.1, height: 1.7 },
    ],
  });
  roof(frame(o, 14.4, -5.5, Math.PI / 2), -9.15, 9.15, -5.05, 5.05, 21.3, 29.9);
  for (const x of [9.6, 19.2])
    cornice(frame(o, x, -5.5, x < 14 ? -Math.PI / 2 : Math.PI / 2), 17.8, 20.95);
  polygonStair(o, -15.8, -9.1, 2.05, 0, 29.8, false);
  polygonStair(o, 6.9, -9.3, 2.65, 4.5, 27.0, true);
  for (const [x, z, bottom, top] of [
    [-21.5, -16.8, 27, 33.5],
    [-12, -17.4, 30.6, 34.7],
    [-2, -17.4, 30.6, 34.2],
    [8, -17.4, 29, 34.4],
    [14.5, -6, 29.8, 33.5],
  ]) {
    box(o, 'limestone', [x - 0.58, bottom, z - 0.72], [x + 0.58, top, z + 0.72], stone);
    if (near(o)) {
      box(o, 'carved', [x - 0.7, top - 0.25, z - 0.85], [x + 0.7, top, z + 0.85], trim);
      box(o, 'recess', [x - 0.36, top, z - 0.5], [x + 0.36, top + 0.03, z + 0.5], glass);
    }
  }
}
function precinct(o) {
  // This is a raised courtyard, not a building filling the whole OSM castle boundary.
  box(o, 'limestone', [-25.1, 0, -11.4], [21.0, 4.5, 17.5], [0.66, 0.63, 0.53]);
  box(o, 'limestone', [-15.7, 4.5, -8.9], [9.6, 4.54, 17.5], [0.75, 0.72, 0.63]);
  for (const [a, b] of [
    [
      [-25.1, 5.05, 17.5],
      [21, 5.05, 17.5],
    ],
    [
      [21, 5.05, 3.4],
      [21, 5.05, 17.5],
    ],
    [
      [-25.1, 5.05, -2.8],
      [-25.1, 5.05, 17.5],
    ],
  ]) {
    beam(o, 'limestone', a, b, 1.1, 0.65, stone);
    if (near(o))
      beam(
        o,
        'carved',
        a.map((v, i) => (i === 1 ? v + 0.61 : v)),
        b.map((v, i) => (i === 1 ? v + 0.61 : v)),
        0.15,
        0.78,
        trim,
      );
  }
}
export function buildMontsoreauRuntime(out, detail) {
  const o = { ...out, detail };
  precinct(o);
  buildings(o);
}
export function buildMontsoreauSkyline(out) {
  // Preserve silhouette and empty court while omitting subpixel openings and brackets.
  buildMontsoreauRuntime(out, 'skyline');
}
export const montsoreauStudy = {
  id: 'N0236',
  key: 'chateau_de_montsoreau',
  title: 'Château de Montsoreau',
  category: 'castle',
  wikidataId: 'Q1143049',
  build: (out) => buildMontsoreauRuntime(out),
  brief:
    'Tuffeau Loire castle with river-facing square terrace towers, asymmetric return wings, four northern and three courtyard Gothic dormers, slate roofs, machicolations, western pointed stair roof and eastern Renaissance stair with slate-disc balustrade.',
  sourceFacts: {
    mainConstructionCentury: 15,
    renaissanceStairDateRange: [1510, 1530],
    mainRangeUpperFloors: 2,
    squareTowersHaveAdditionalFloor: true,
    riverDormersObserved: 4,
    courtyardDormersObserved: 3,
    greatHallLengthMeters: 17,
    ownerReportedTerraceHeightMeters: 35,
    ownerTerraceHeightDatum: 'Unspecified; not adopted as a measured building elevation.',
  },
  reconstruction: {
    basis:
      'Individual reconstruction from the regional Inventaire Général exterior survey photographs and descriptions, owner publication and signed OSM castle precinct. The precinct polygon is not a building outline. Plan subdivisions, elevations, roof pitches, window sizes and ornament are photographic estimates.',
    mainEaveY: 21,
    mainRidgeY: 30.8,
    squareTowerParapetY: 28.48,
    courtY: 4.5,
    westernStairFinialY: 38.4,
    datum: 'Provisional road/base level; no surveyed vertical datum.',
    occupiedPlanBasis:
      'Distinct wall masses fitted inside the northern OSM precinct edge; open court retained to the south.',
  },
  scaleBasis:
    'Cached exact-QID OSM precinct bounds provide horizontal scale. Vertical dimensions are photographic estimates; the published 35 m terrace statement has an unresolved datum.',
  refs: [
    'https://gertrude.paysdelaloire.fr/dossier/IA49009670',
    'https://www.chateau-montsoreau.com/wordpress/fr/100-chateau-100-contemporain/le-chateau/',
    'https://pop.culture.gouv.fr/notice/merimee/IA49009670',
    'https://www.openstreetmap.org/way/175416989',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east along the signed cached precinct frame',
    front: '-Z toward the Loire; +Z toward the courtyard',
    origin: 'Cached precinct rectangle center at provisional road/base datum',
  },
  geographic: () => ({
    reviewStatus:
      'precinct-registered preview; surveyed heights, terrain and occupied footprint fit pending',
    replaceFootprint: false,
    notes:
      'The exact-QID way/175416989 is the castle precinct, not an occupied building footprint. Its signed frame anchors the distinct northern ranges and open southern court. Do not stretch a single building mass to this boundary. Base datum, retaining walls and eastern/western extensions need terrain-context review.',
  }),
  geographicNote:
    'Preview only: correct castle identity and signed river/courtyard axis; real terrain and surveyed elevations remain pending.',
  limitations: [
    'Maximum fidelity is pending: the Renaissance stair figurative panels, medallions, deer and putti are not sculpted; candelabra and Gothic crockets are reconstructed relief.',
    'No measured plan or section was inspected. The historical Salleron reference is an exterior view. Owner terrace height has an unresolved datum, so all vertical dimensions remain provisional.',
    'Roof junctions, occupied plan subdivisions, window positions and retaining-wall limits are estimates from exterior views inside an OSM precinct boundary. Physical terrain, moat, road and surrounding village are not part of this asset.',
    'Current square towers have flat terraces; historical pavilion roofs are deliberately not reconstructed. No interior rooms, movable shutters or engineering certification.',
    'Original geometry and shared limestone, raw limestone, slate, wood and painted-metal surfaces. Reference photographs are linked only; no copied images or per-model texture bitmaps.',
  ],
  camera: { position: [-64, 45, 75], lookAt: [-5, 17, -8], fov: 40 },
  qaCameras: [
    { name: 'river-elevation', position: [-3, 20, -103], lookAt: [-3, 17, -19] },
    { name: 'river-dormers', position: [-3, 29, -44], lookAt: [-3, 26, -23] },
    { name: 'court-elevation', position: [-5, 21, 69], lookAt: [-5, 19, -9] },
    { name: 'western-stair', position: [-33, 27, 10], lookAt: [-16, 24, -9] },
    { name: 'renaissance-stair', position: [-2, 19, 9], lookAt: [7, 17, -9] },
    { name: 'cross-window-and-corbel', position: [-4, 17, -0.5], lookAt: [-7.6, 17, -11] },
    { name: 'eastern-return', position: [42, 26, 33], lookAt: [13, 17, -3] },
    { name: 'roof-and-open-court', position: [-10, 90, 12], lookAt: [-5, 5, -4] },
  ],
};
