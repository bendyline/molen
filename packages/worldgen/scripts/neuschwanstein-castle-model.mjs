/** Neuschwanstein: original, individually arranged exterior from the official plan and photos. */
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const limestone = [0.83, 0.83, 0.78],
  trim = [0.93, 0.91, 0.82];
const roofColor = [0.17, 0.22, 0.24],
  glass = [0.12, 0.17, 0.17];
const sandstone = [0.83, 0.65, 0.38],
  brick = [0.65, 0.28, 0.16];
const timber = [0.39, 0.25, 0.11],
  copper = [0.5, 0.29, 0.16];
const near = (o) => !['skyline', 'district'].includes(o.detail);
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const master = (o) => !o.detail;
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const triangle = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    c,
  );
function transformed(out, x = 0, y = 0, z = 0, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rotate = ([a, b, d]) => [a * c + d * s, b, -a * s + d * c];
  return {
    detail: out.detail,
    runtimeLevel: out.runtimeLevel,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
        name,
        (slot, ref, points, n, uv, color) =>
          out[name](
            slot,
            ref,
            points.map((p) => {
              const q = rotate(p);
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
function disk(o, slot, x, y, z, r, color, n = 12) {
  const p = Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * Math.PI * 2) / n),
    y + r * Math.sin((i * Math.PI * 2) / n),
    z,
  ]);
  o.addConvexPolygon(slot, 'palette:#ffffff', p, [0, 0, 1], (p) => [p[0], p[1]], color);
}
function lathe(o, x, z, profile, color = limestone, slot = 'limestone', count = 32) {
  const n =
    o.detail === 'skyline'
      ? 6
      : o.detail === 'district'
        ? 8
        : o.detail === 'street'
          ? 12
          : o.detail === 'closeup'
            ? 20
            : count;
  loft(
    o,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    color,
  );
}
function cone(o, x, z, r, y0, y1, sides = 16) {
  const n = o.detail === 'skyline' ? 6 : o.detail === 'district' ? 8 : sides;
  for (let i = 0; i < n; i++) {
    const a = (-i * Math.PI * 2) / n,
      b = (-(i + 1) * Math.PI * 2) / n;
    triangle(
      o,
      'slate',
      [
        [x + Math.cos(a) * r, y0, z + Math.sin(a) * r],
        [x + Math.cos(b) * r, y0, z + Math.sin(b) * r],
        [x, y1, z],
      ],
      roofColor,
    );
  }
}
function archBand(o, x, spring, z, r, thickness, color = trim, slot = 'carved', depth = 0.22) {
  const n = master(o) ? 18 : o.detail === 'closeup' ? 6 : 4;
  const point = (a, rr, zz) => [x - rr * Math.cos(a), spring + rr * Math.sin(a), zz];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      slot,
      [point(a, r, z), point(b, r, z), point(b, r + thickness, z), point(a, r + thickness, z)],
      color,
    );
    if (fine(o))
      face(
        o,
        slot,
        [point(a, r, z - depth), point(b, r, z - depth), point(b, r, z), point(a, r, z)],
        color,
      );
  }
}
function openingHeight(w) {
  return w.height + w.width / 2 + 0.18;
}
function opening(o, w) {
  const { x, y, width, height: h, door = false } = w,
    r = width / 2,
    spring = y + h;
  const z = fine(o) ? -0.34 : 0.075,
    slot = door ? 'wood' : 'glass',
    color = door ? timber : glass;
  face(
    o,
    slot,
    [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, spring, z],
      [x - r, spring, z],
    ],
    color,
  );
  const n = master(o) ? 18 : o.detail === 'closeup' ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    triangle(
      o,
      slot,
      [
        [x, spring, z],
        [x + r * Math.cos(a), spring + r * Math.sin(a), z],
        [x + r * Math.cos(b), spring + r * Math.sin(b), z],
      ],
      color,
    );
  }
  if (o.detail === 'district' || o.runtimeLevel === 'street') return;
  if (fine(o)) {
    // Fill the stone haunch above the curved opening, within its rectangular wall cutout.
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      const x0 = x - r * Math.cos(a),
        x1 = x - r * Math.cos(b),
        y0 = spring + r * Math.sin(a),
        y1 = spring + r * Math.sin(b),
        top = y + openingHeight(w);
      face(
        o,
        'limestone',
        [
          [x0, y0, 0],
          [x1, y1, 0],
          [x1, top, 0],
          [x0, top, 0],
        ],
        limestone,
      );
    }
    if (master(o)) {
      for (const xx of [x - r, x + r])
        box(o, 'carved', [xx - 0.085, y - 0.06, -0.38], [xx + 0.085, spring, 0.15], trim);
      box(o, 'carved', [x - r - 0.14, y - 0.14, -0.38], [x + r + 0.14, y, 0.22], trim);
    } else {
      for (const xx of [x - r, x + r]) {
        face(
          o,
          'carved',
          [
            [xx - 0.085, y, 0.15],
            [xx + 0.085, y, 0.15],
            [xx + 0.085, spring, 0.15],
            [xx - 0.085, spring, 0.15],
          ],
          trim,
        );
        face(
          o,
          'carved',
          [
            [xx, y, -0.38],
            [xx, y, 0.15],
            [xx, spring, 0.15],
            [xx, spring, -0.38],
          ],
          trim,
        );
      }
      face(
        o,
        'carved',
        [
          [x - r, y, -0.38],
          [x + r, y, -0.38],
          [x + r, y, 0.2],
          [x - r, y, 0.2],
        ],
        trim,
      );
    }
  }
  archBand(o, x, spring, 0.16, r, 0.17);
  if (o.detail === 'street') {
    for (const xx of [x - r, x + r])
      face(
        o,
        'carved',
        [
          [xx - 0.06, y, 0.16],
          [xx + 0.06, y, 0.16],
          [xx + 0.06, spring, 0.16],
          [xx - 0.06, spring, 0.16],
        ],
        trim,
      );
    return;
  }
  if (master(o)) archBand(o, x, spring, 0.1, r + 0.2, 0.07);
  if (!door) {
    if (o.detail === 'closeup') {
      face(
        o,
        'wood',
        [
          [x - 0.032, y, z + 0.09],
          [x + 0.032, y, z + 0.09],
          [x + 0.032, spring + r - 0.04, z + 0.09],
          [x - 0.032, spring + r - 0.04, z + 0.09],
        ],
        timber,
      );
      const yy = y + h / 2;
      face(
        o,
        'wood',
        [
          [x - r + 0.04, yy - 0.026, z + 0.09],
          [x + r - 0.04, yy - 0.026, z + 0.09],
          [x + r - 0.04, yy + 0.026, z + 0.09],
          [x - r + 0.04, yy + 0.026, z + 0.09],
        ],
        timber,
      );
      return;
    }
    box(o, 'wood', [x - 0.032, y, z + 0.025], [x + 0.032, spring + r - 0.04, z + 0.09], timber);
    for (let j = 1; j <= (master(o) ? 4 : 1); j++) {
      const yy = y + (h * j) / (master(o) ? 5 : 2);
      box(
        o,
        'wood',
        [x - r + 0.04, yy - 0.026, z + 0.025],
        [x + r - 0.04, yy + 0.026, z + 0.09],
        timber,
      );
    }
  } else {
    for (let j = 1; j < 7; j++) {
      const xx = x - r + (width * j) / 7;
      box(
        o,
        'wood',
        [xx - 0.028, y, z + 0.01],
        [xx + 0.028, spring - 0.05, z + 0.06],
        [0.2, 0.12, 0.055],
      );
    }
    for (const yy of [y + h * 0.25, y + h * 0.72])
      box(
        o,
        'metal',
        [x - r + 0.12, yy - 0.06, z + 0.07],
        [x + r - 0.12, yy + 0.06, z + 0.1],
        roofColor,
      );
  }
}
function group(x, y, width = 2.5, height = 2.4, count = 2) {
  const pitch = width / count,
    gap = count === 1 ? 0 : 0.2;
  return Array.from({ length: count }, (_, i) => ({
    x: x - width / 2 + pitch * (i + 0.5),
    y,
    width: pitch - gap,
    height,
    groupIndex: i,
    groupX: x,
    groupWidth: width,
  }));
}
function wall(
  o,
  width,
  bottom,
  top,
  windows = [],
  slot = 'limestone',
  color = limestone,
  depth = 0.8,
) {
  if (!fine(o)) {
    box(o, slot, [-width / 2, bottom, -depth], [width / 2, top, 0], color);
    if (o.detail !== 'skyline')
      for (const w of windows) {
        if (o.detail === 'district' && w.groupIndex > 0) continue;
        opening(
          o,
          o.detail === 'district' && w.groupWidth ? { ...w, x: w.groupX, width: w.groupWidth } : w,
        );
      }
    return;
  }
  const ys = [
    ...new Set([bottom, top, ...windows.flatMap((w) => [w.y, w.y + openingHeight(w)])]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++) {
    const y0 = ys[j - 1],
      y1 = ys[j],
      mid = (y0 + y1) / 2;
    if (y0 < bottom || y1 > top) throw new Error('Neuschwanstein opening outside its wall');
    const spans = windows
      .filter((w) => mid > w.y && mid < w.y + openingHeight(w))
      .map((w) => [w.x - w.width / 2, w.x + w.width / 2])
      .sort((a, b) => a[0] - b[0]);
    let x = -width / 2;
    for (const [a, b] of [...spans, [width / 2, width / 2]]) {
      if (a < x - 1e-6 || b > width / 2 + 1e-6)
        throw new Error('Overlapping Neuschwanstein wall openings');
      if (a > x) {
        face(
          o,
          slot,
          [
            [x, y0, 0],
            [a, y0, 0],
            [a, y1, 0],
            [x, y1, 0],
          ],
          color,
        );
        if (master(o))
          face(
            o,
            slot,
            [
              [a, y0, -depth],
              [x, y0, -depth],
              [x, y1, -depth],
              [a, y1, -depth],
            ],
            color,
          );
      }
      x = b;
    }
  }
  for (const w of windows) opening(o, w);
}
function mass(o, x0, x1, z0, z1, y0, y1, openings = {}) {
  if (o.detail === 'skyline') {
    box(o, 'limestone', [x0, y0, z0], [x1, y1, z1], limestone);
    return;
  }
  for (const [key, x, z, a, w] of [
    ['south', (x0 + x1) / 2, z1, 0, x1 - x0],
    ['north', (x0 + x1) / 2, z0, Math.PI, x1 - x0],
    ['east', x1, (z0 + z1) / 2, Math.PI / 2, z1 - z0],
    ['west', x0, (z0 + z1) / 2, -Math.PI / 2, z1 - z0],
  ])
    wall(transformed(o, x, 0, z, a), w, y0, y1, openings[key] ?? []);
  box(o, 'limestone', [x0, y0, z0], [x1, y0 + 0.12, z1], limestone);
}
function ledge(o, width, y, depth = 0.25) {
  if (o.detail === 'skyline') return;
  box(o, 'carved', [-width / 2, y, -0.12], [width / 2, y + 0.18, depth], trim);
}
function arcadeFrieze(o, width, y) {
  ledge(o, width, y + 0.5, 0.24);
  if (!master(o)) return;
  const pitch = 0.9,
    count = Math.floor(width / pitch);
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / count;
    archBand(o, x, y, 0.11, 0.32, 0.1);
    if (fine(o)) box(o, 'carved', [x - 0.08, y - 0.3, 0], [x + 0.08, y, 0.18], trim);
  }
}
function roof(o, x0, x1, z0, z1, eave, ridge, hip = false) {
  const z = (z0 + z1) / 2,
    cut = hip ? Math.min((z1 - z0) / 2, (x1 - x0) / 4) : 0;
  box(o, 'limestone', [x0, eave - 0.3, z0], [x1, eave, z1], limestone);
  face(
    o,
    'slate',
    [
      [x0, eave, z0],
      [x0 + cut, ridge, z],
      [x1 - cut, ridge, z],
      [x1, eave, z0],
    ],
    roofColor,
  );
  face(
    o,
    'slate',
    [
      [x1, eave, z1],
      [x1 - cut, ridge, z],
      [x0 + cut, ridge, z],
      [x0, eave, z1],
    ],
    roofColor,
  );
  triangle(
    o,
    hip ? 'slate' : 'limestone',
    [
      [x0, eave, z0],
      [x0, eave, z1],
      [x0 + cut, ridge, z],
    ],
    hip ? roofColor : limestone,
  );
  triangle(
    o,
    hip ? 'slate' : 'limestone',
    [
      [x1, eave, z1],
      [x1, eave, z0],
      [x1 - cut, ridge, z],
    ],
    hip ? roofColor : limestone,
  );
  if (near(o)) {
    beam(
      o,
      'metal',
      [x0 + cut, ridge + 0.05, z],
      [x1 - cut, ridge + 0.05, z],
      0.18,
      0.16,
      roofColor,
    );
    for (const zz of [z0, z1])
      beam(o, 'metal', [x0, eave, zz], [x1, eave, zz], 0.15, 0.16, roofColor);
  }
}
function crenels(o, width, y, spacing = 1.2) {
  if (o.detail === 'skyline') return;
  box(o, 'carved', [-width / 2, y, -0.2], [width / 2, y + 0.65, 0.45], trim);
  if (o.detail === 'district') return;
  const n = Math.floor(width / spacing);
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / n;
    box(o, 'carved', [x - 0.35, y + 0.65, -0.2], [x + 0.35, y + 1.25, 0.45], trim);
  }
}
function circularCrown(o, x, z, r, y, slots = true) {
  lathe(
    o,
    x,
    z,
    [
      [y - 1.4, r - 0.35],
      [y - 0.2, r + 0.3],
      [y + 0.15, r + 0.35],
      [y + 1.3, r + 0.35],
    ],
    trim,
    'carved',
  );
  if (!fine(o)) return;
  const n = Math.round(r * (master(o) ? 6 : 4));
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      f = transformed(o, x + Math.sin(a) * r, 0, z + Math.cos(a) * r, a);
    box(f, 'carved', [-0.16, y - 1.65, -0.2], [0.16, y - 0.1, 0.35], trim);
    if (slots) {
      face(
        f,
        'recess',
        [
          [-0.23, y - 0.9, 0.18],
          [0.23, y - 0.9, 0.18],
          [0.23, y - 0.3, 0.18],
          [-0.23, y - 0.3, 0.18],
        ],
        glass,
      );
      box(f, 'carved', [-0.3, y + 1.2, -0.1], [0.3, y + 1.85, 0.6], trim);
    }
  }
}
function turret(o, x, z, r, y0, y1, cap, windowYs = []) {
  lathe(
    o,
    x,
    z,
    [
      [y0, r * 1.12],
      [y0 + 1, r],
      [y1, r],
    ],
    limestone,
  );
  if (o.detail !== 'skyline')
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        f = transformed(o, x + Math.sin(a) * (r + 0.06), 0, z + Math.cos(a) * (r + 0.06), a);
      for (const y of windowYs)
        opening(
          { ...f, detail: o.detail === 'district' ? 'district' : 'street' },
          { x: 0, y, width: 0.48, height: 1.05 },
        );
    }
  circularCrown(o, x, z, r, y1, false);
  cone(o, x, z, r + 0.24, y1 + 1.35, cap, 12);
  if (near(o)) tube(o, 'metal', [x, cap, z], [x, cap + 0.55, z], 0.045, roofColor, 4);
}
function dormer(o, x, y, z, sign) {
  if (o.detail === 'skyline') return;
  const f = transformed(o, x, y, z, sign > 0 ? 0 : Math.PI);
  wall(f, 1.05, 0, 1.6, [{ x: 0, y: 0.15, width: 0.55, height: 0.85 }], 'copper', copper, 0.9);
  triangle(
    f,
    'copper',
    [
      [-0.57, 1.6, 0],
      [0.57, 1.6, 0],
      [0, 2.5, 0],
    ],
    copper,
  );
  face(
    f,
    'copper',
    [
      [-0.57, 1.6, 0],
      [0, 2.5, 0],
      [0, 2.5, -1.6],
      [-0.57, 1.6, -1.6],
    ],
    copper,
  );
  face(
    f,
    'copper',
    [
      [0, 2.5, 0],
      [0.57, 1.6, 0],
      [0.57, 1.6, -1.6],
      [0, 2.5, -1.6],
    ],
    copper,
  );
}
function balcony(o, width, y, projection = 1.8) {
  box(o, 'carved', [-width / 2, y, -0.2], [width / 2, y + 0.28, projection], trim);
  if (!near(o)) return;
  for (let i = 0; i < 4; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / 4;
    beam(o, 'carved', [x, y - 1.1, 0], [x, y, projection - 0.2], 0.35, 0.45, trim);
  }
  box(
    o,
    'carved',
    [-width / 2, y + 1.3, projection - 0.18],
    [width / 2, y + 1.48, projection + 0.12],
    trim,
  );
  const n = Math.ceil(width / (o.detail === 'street' ? 1.2 : 0.48));
  for (let i = 0; i <= n; i++) {
    const x = -width / 2 + (width * i) / n;
    box(
      o,
      'carved',
      [x - 0.07, y + 0.28, projection - 0.07],
      [x + 0.07, y + 1.3, projection + 0.07],
      trim,
    );
  }
}
function gableDetails(o, width, eave, ridge) {
  if (!near(o)) return;
  for (const sign of [-1, 1])
    beam(o, 'carved', [(sign * width) / 2, eave, 0.2], [0, ridge + 0.1, 0.2], 0.35, 0.25, trim);
  for (const [y, w, n] of [
    [eave + 1.3, 4.4, 3],
    [eave + 5, 3.0, 2],
  ]) {
    const f = { ...o, detail: 'street' };
    for (const openingSpec of group(0, y, w, 1.4, n)) opening(f, openingSpec);
  }
  disk(o, 'recess', 0, eave + 8.4, 0.1, 0.37, glass, 12);
}
function palas(o) {
  // The main range and western Throne Hall have distinct plan axes.
  const rows = [9, 14.5, 20, 25.5, 31.2, 36.8];
  const longWindows = rows.flatMap((y, j) =>
    [-11.2, -5.6, 0, 5.6, 11.2].flatMap((x) =>
      group(x, y, j === 0 ? 1.6 : 2.55, j === 0 ? 1.8 : 2.25, j === 0 ? 1 : 2),
    ),
  );
  mass(o, -43, -13, -8.5, 9.3, 0, 41.5, {
    south: longWindows,
    north: longWindows,
    east: rows.flatMap((y, j) =>
      [-5.6, 0, 5.6].flatMap((x) =>
        group(x, y, j < 2 ? 1.4 : 3, j < 2 ? 1.9 : 2.3, j < 2 ? 1 : x === 0 ? 2 : 3),
      ),
    ),
  });
  roof(o, -43.3, -12.7, -8.8, 9.6, 41.7, 54.5);
  mass(o, -54, -13, -13.8, -8.5, 0, 38, {
    north: [9, 15, 21, 27, 33].flatMap((y) =>
      [-17, -11, -5, 1, 7, 13, 18].flatMap((x) => group(x, y, 2.3, 2.1, 2)),
    ),
  });
  roof(o, -54.2, -12.8, -14, -8.3, 38.2, 41.6, true);
  const western = transformed(o, -58, 0, 4.0, 0.21);
  const westLong = rows.flatMap((y, j) =>
    [-10, -4, 2, 8].flatMap((x) => group(x, y, j === 0 ? 1.5 : 2.5, 2.1, j === 0 ? 1 : 2)),
  );
  mass(western, -15, 15, -11.6, 11.6, 0, 41.5, {
    south: westLong,
    north: westLong,
    west: rows.flatMap((y, j) =>
      [-7, 0, 7].flatMap((x) => group(x, y, j < 2 ? 1.4 : 3.2, 2.2, j < 2 ? 1 : 3)),
    ),
  });
  roof(western, -15.3, 15.3, -11.9, 11.9, 41.7, 54.5);
  for (const [f, width] of [
    [transformed(o, -28, 0, 9.31), 30],
    [transformed(o, -28, 0, -8.51, Math.PI), 30],
    [transformed(western, 0, 0, 11.61), 30],
    [transformed(western, 0, 0, -11.61, Math.PI), 30],
  ]) {
    for (const y of [7.4, 18.7, 29.8, 41.15]) ledge(f, width, y);
    if (fine(o)) arcadeFrieze(f, width, 40.0);
  }
  for (const x of [-39, -32, -25, -18])
    for (const sign of [-1, 1]) dormer(o, x, 44.4, sign > 0 ? 7.5 : -6.7, sign);
  for (const x of [-10, -3, 4, 11])
    for (const sign of [-1, 1]) dormer(western, x, 44.8, sign * 9.5, sign);
  gableDetails(transformed(o, -12.68, 0, 0.4, Math.PI / 2), 18.4, 41.7, 54.5);
  gableDetails(transformed(western, -15.32, 0, 0, -Math.PI / 2), 23.8, 41.7, 54.5);
  // East courtyard bartizans are suspended above their corbelled bases.
  for (const z of [-7.8, 8.6]) {
    lathe(
      o,
      -12.1,
      z,
      [
        [22, 0.3],
        [25, 1.85],
        [26, 1.85],
        [26.4, 1.6],
        [41.7, 1.6],
        [42.2, 2],
      ],
      trim,
    );
    for (const y of [25.8, 33.8, 41.7]) circularCrown(o, -12.1, z, 1.65, y, false);
    cone(o, -12.1, z, 2.15, 43.05, 49.8, 8);
    if (near(o))
      for (const y of [27.2, 35])
        for (const a of [0, Math.PI / 2, Math.PI])
          opening(
            {
              ...transformed(o, -12.1 + Math.sin(a) * 1.63, 0, z + Math.cos(a) * 1.63, a),
              detail: 'street',
            },
            { x: 0, y, width: 0.55, height: 1.8 },
          );
  }
  balcony(transformed(o, -12.65, 0, 0.4, Math.PI / 2), 5.2, 35.8);
  // Southern and western projecting open galleries are characteristic of the Palas.
  for (const y of [22.6, 28.2, 33.8]) {
    const f = transformed(western, -15.4, 0, 0, -Math.PI / 2);
    balcony(f, 15, y, 1.6);
    if (near(o))
      for (let i = 0; i < 7; i++) {
        const x = -6.3 + i * 2.1;
        tube(f, 'carved', [x, y + 1.45, 1.42], [x, y + 3.25, 1.42], 0.14, trim, fine(o) ? 10 : 6);
        if (i < 6) archBand(f, x + 1.05, y + 3.0, 1.42, 0.91, 0.18);
      }
  }
  // Two primary stair towers, with intentionally unequal heights and crown profiles.
  stairTower(o, -51.8, -15.7, 3.35, 65);
  stairTower(o, -44.2, 8.7, 2.25, 59.2);
  for (const [x, z] of [
    [-42.6, -8.3],
    [-13.2, -8.3],
    [-42.6, 9.1],
    [-13.2, 9.1],
  ])
    turret(o, x, z, 0.75, 37.5, 42.0, 47.2, [39]);
}
function stairTower(o, x, z, r, tip) {
  const top = tip - 11;
  lathe(
    o,
    x,
    z,
    [
      [0, r + 1.1],
      [5, r + 0.25],
      [top - 11, r],
      [top - 10.5, r + 0.45],
      [top - 9, r + 0.45],
      [top - 8.8, r],
      [top - 1, r],
      [top, r + 0.28],
    ],
    limestone,
  );
  circularCrown(o, x, z, r, top - 11, false);
  circularCrown(o, x, z, r, top, false);
  lathe(
    o,
    x,
    z,
    [
      [top + 1.2, r * 0.82],
      [top + 4, r * 0.82],
    ],
    limestone,
  );
  cone(o, x, z, r * 0.96, top + 4, tip - 0.8);
  tube(
    o,
    'metal',
    [x, tip - 0.9, z],
    [x, tip, z],
    0.055,
    roofColor,
    o.detail === 'skyline' ? 4 : 6,
  );
  if (o.detail !== 'skyline')
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        f = transformed(o, x + Math.sin(a) * (r + 0.06), 0, z + Math.cos(a) * (r + 0.06), a);
      for (const y of [11, 20, 29, top - 6])
        opening(
          { ...f, detail: o.detail === 'district' ? 'district' : 'street' },
          { x: 0, y, width: 0.65, height: 1.4 },
        );
      opening({ ...f, detail: 'district' }, { x: 0, y: top + 1.7, width: 0.6, height: 1 });
    }
}
function bower(o) {
  mass(o, -15.8, 16.2, 10, 20, 0, 25.5, {
    south: [7.5, 13.3, 19.2].flatMap((y) =>
      [-12, -6, 0, 6, 12].flatMap((x) => group(x, y, 2.2, 2, 2)),
    ),
    north: [11.5, 19].flatMap((y) => [-12, -6, 0, 6, 12].flatMap((x) => group(x, y, 2.3, 2.5, 2))),
    east: [8, 15, 21].map((y) => ({ x: 0, y, width: 1.1, height: 1.9 })),
  });
  roof(o, -16.1, 16.5, 9.7, 20.3, 25.7, 31.2, true);
  for (const z of [10, 20]) {
    const f = transformed(o, 0.2, 0, z, z === 10 ? Math.PI : 0);
    for (const y of [6.5, 17.7, 25.2]) ledge(f, 32, y);
    if (fine(o)) arcadeFrieze(f, 32, 24);
  }
  for (const [x, z, r] of [
    [-9.1, 21.3, 2.15],
    [5.3, 21.2, 2.1],
  ]) {
    lathe(
      o,
      x,
      z,
      [
        [0, r + 0.6],
        [6, r + 0.5],
        [6.8, r],
        [25.5, r],
      ],
      limestone,
      'limestone',
      8,
    );
    for (const a of [-Math.PI / 4, 0, Math.PI / 4])
      for (const y of [8.5, 14.3, 20.2])
        for (const w of group(0, y, 1.25, 1.65, 2))
          opening(
            {
              ...transformed(o, x + Math.sin(a) * (r + 0.08), 0, z + Math.cos(a) * (r + 0.08), a),
              detail: 'street',
            },
            w,
          );
    cone(o, x, z, r + 0.2, 25.7, 30.5, 8);
  }
  balcony(transformed(o, -9.1, 0, 9.8, Math.PI), 5.1, 17.8);
}
function northRanges(o) {
  // Knights' House and lower connecting gallery, distinct from the tall Palas.
  mass(o, -15, 36.5, -14.1, -9.3, 0, 22.5, {
    south: [8.8, 15.8].flatMap((y) =>
      [-23, -17, -11, -5, 1, 7, 13, 19, 23].flatMap((x) => group(x, y, 2.5, 2.2, 2)),
    ),
    north: [7, 14.2].flatMap((y) =>
      [-23, -17, -11, -5, 1, 7, 13, 19, 23].flatMap((x) => group(x, y, 2.3, 1.9, 2)),
    ),
  });
  for (const z of [-14.1, -9.3])
    crenels(transformed(o, 10.75, 0, z, z < -10 ? Math.PI : 0), 51.5, 22.5);
  mass(o, -1.5, 14.8, -25, -14.1, 0, 27.7, {
    north: [7, 13.6, 20.3].flatMap((y) => [-5, 0, 5].flatMap((x) => group(x, y, 2.4, 2.4, 2))),
    south: [9.5, 16.2, 22].flatMap((y) => [-5, 0, 5].flatMap((x) => group(x, y, 2.6, 2.2, 2))),
    east: [8, 15, 21].flatMap((y) => group(0, y, 2.4, 2.2, 2)),
  });
  roof(o, -1.75, 15.05, -25.3, -13.8, 27.9, 34, true);
  const court = transformed(o, 6.65, 0, -9.25);
  triangle(
    court,
    'limestone',
    [
      [-8.2, 23, 0],
      [8.2, 23, 0],
      [0, 31, 0],
    ],
    limestone,
  );
  gableDetails(court, 16.4, 23, 31);
  for (const x of [-1.5, 14.8])
    for (const z of [-25, -14.1]) turret(o, x, z, 0.75, 24.5, 29, 33.5, [26]);
  turret(o, 16.0, -25, 1.65, 0, 31.2, 36.5, [7, 15, 23]);
  squareTower(o);
  mass(o, 44.5, 67.5, -20.5, -15.6, 5.5, 19.8, {
    south: [9, 15].flatMap((y) => [-9, -4.5, 0, 4.5, 9].flatMap((x) => group(x, y, 2, 2, 2))),
    north: [9, 15].flatMap((y) => [-9, -4.5, 0, 4.5, 9].flatMap((x) => group(x, y, 1.7, 1.7, 1))),
  });
  roof(o, 44.3, 67.7, -20.7, -15.4, 20, 23.8);
}
function squareTower(o) {
  mass(o, 35, 44.5, -21, -11.5, 0, 40.5, {
    south: [8, 17, 27, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
    north: [8, 17, 27, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
    east: [14, 25, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
    west: [14, 25, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
  });
  for (const [x, z, a] of [
    [39.75, -11.5, 0],
    [39.75, -21, Math.PI],
    [35, -16.25, -Math.PI / 2],
    [44.5, -16.25, Math.PI / 2],
  ]) {
    const f = transformed(o, x, 0, z, a);
    ledge(f, 10.6, 40.5, 0.55);
    if (near(o))
      for (const xx of [-3.5, 0, 3.5]) {
        archBand(f, xx, 37.2, 0.15, 1.1, 0.2);
        beam(f, 'carved', [xx, 35.5, 0], [xx, 40.5, 0.5], 0.35, 0.42, trim);
      }
  }
  lathe(
    o,
    39.75,
    -16.25,
    [
      [40.65, 3.35],
      [47, 3.35],
    ],
    limestone,
    'limestone',
    8,
  );
  circularCrown(o, 39.75, -16.25, 3.35, 47, false);
  cone(o, 39.75, -16.25, 3.75, 48.3, 53.8, 8);
  if (near(o)) tube(o, 'metal', [39.75, 53.8, -16.25], [39.75, 54.8, -16.25], 0.06, roofColor, 4);
}
function steppedGable(o, width, y, height, slot, color) {
  const steps = 7,
    step = width / (2 * steps);
  for (let i = 0; i < steps; i++) {
    const w = width - 2 * i * step;
    box(
      o,
      slot,
      [-w / 2, y + (i * height) / steps, -0.35],
      [w / 2, y + ((i + 1) * height) / steps, 0],
      color,
    );
    if (near(o))
      for (const sign of [-1, 1])
        box(
          o,
          'carved',
          [sign > 0 ? w / 2 - step : -w / 2, y + ((i + 1) * height) / steps, -0.4],
          [sign > 0 ? w / 2 : -w / 2 + step, y + ((i + 1) * height) / steps + 0.12, 0.16],
          trim,
        );
  }
}
function gatehouse(o) {
  // Local +Z is the red-brick outer east facade; local -Z is the yellow inner west facade.
  const g = transformed(o, 71, 0, 0, Math.PI / 2);
  const lower = [-15, -10, 10, 15].map((x) => ({ x, y: 8.8, width: 1.35, height: 2.6 }));
  const upper = [-15, -10, 10, 15].flatMap((x) => group(x, 15.2, 2.4, 2.3, 2));
  wall(transformed(g, 0, 0, 3.4), 38, 6.5, 21, [...lower, ...upper], 'brick', brick, 1);
  wall(
    transformed(g, 0, 0, -3.4, Math.PI),
    38,
    6.5,
    21,
    [...lower, ...upper],
    'sandstone',
    sandstone,
    1,
  );
  for (const x of [-19, 19])
    box(g, 'limestone', [x - 0.25, 6.5, -3.4], [x + 0.25, 21, 3.4], limestone);
  roof(g, -19.2, 19.2, -3.4, 3.4, 21.1, 22.3, true);
  // Raised central bay and stepped gable; the portal is closed by its observed timber doors.
  for (const [z, a, slot, color] of [
    [4.2, 0, 'limestone', limestone],
    [-3.75, Math.PI, 'sandstone', sandstone],
  ]) {
    const f = transformed(g, 0, 0, z, a);
    const windows =
      z < 0
        ? [...group(0, 16.3, 5.8, 2.5, 3), ...group(0, 22, 5.8, 2.3, 3)]
        : [-3.6, 3.6].flatMap((x) => [17, 23].map((y) => ({ x, y, width: 0.35, height: 1.05 })));
    wall(
      f,
      10.5,
      6.5,
      26.7,
      [{ x: 0, y: 6.5, width: 4.3, height: 5.1, door: true }, ...windows],
      slot,
      color,
      1.2,
    );
    steppedGable(
      f,
      11.5,
      26.7,
      7.2,
      slot === 'limestone' ? 'brick' : slot,
      slot === 'limestone' ? brick : color,
    );
    for (const yy of [14.2, 21.1, 26.3]) ledge(f, 11.5, yy, 0.32);
    if (z < 0) {
      balcony(f, 7, 21.05, 1.4);
      disk(f, 'carved', 0, 28.7, 0.18, 0.78, trim, 24);
      disk(f, 'metal', 0, 28.7, 0.2, 0.61, [0.13, 0.25, 0.29], 24);
      if (near(o)) {
        beam(f, 'carved', [0, 28.7, 0.23], [0, 29.13, 0.23], 0.06, 0.04, trim);
        beam(f, 'carved', [0, 28.7, 0.23], [-0.3, 28.53, 0.23], 0.06, 0.04, trim);
      }
    } else
      for (const x of [-4.5, 4.5]) {
        lathe(
          f,
          x,
          0.2,
          [
            [18, 0.1],
            [20.2, 1.0],
            [21.8, 1.0],
          ],
          trim,
        );
        circularCrown(f, x, 0.2, 1, 21.8, true);
      }
  }
  for (const x of [-5.5, 5.2]) box(g, 'limestone', [x, 21, -3.75], [x + 0.3, 26.7, 4.2], limestone);
  roof(transformed(g, 0, 0, 0.225, Math.PI / 2), -3.975, 3.975, -5.4, 5.4, 26.7, 33.9);
  for (const z of [-3.4, 3.4]) {
    for (const x of [-12.25, 12.25]) {
      const f = transformed(g, x, 0, z, z > 0 ? 0 : Math.PI);
      crenels(f, 13.5, 21.1);
      if (fine(o)) arcadeFrieze(f, 13.5, 20);
    }
  }
  for (const x of [-19.8, 19.8]) {
    lathe(
      g,
      x,
      1.4,
      [
        [5, 2.8],
        [25, 2.7],
      ],
      limestone,
    );
    circularCrown(g, x, 1.4, 2.7, 25, true);
    cone(g, x, 1.4, 2.4, 25.5, 30.8, 8);
    if (o.detail !== 'skyline')
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          f = transformed(g, x + Math.sin(a) * 2.77, 0, 1.4 + Math.cos(a) * 2.77, a);
        for (const y of [9, 16, 21])
          opening({ ...f, detail: 'street' }, { x: 0, y, width: 0.48, height: 1.2 });
      }
  }
}
function grounds(o) {
  // Retained court levels only. No invented natural mountain or unbuilt central keep.
  box(o, 'weathered', [-16, 0, -9.3], [43, 8.1, 19], [0.6, 0.62, 0.58]);
  box(o, 'limestone', [-15.7, 8.1, -9], [42.8, 8.2, 18.8], [0.76, 0.75, 0.68]);
  box(o, 'weathered', [43, 0, -15.6], [67.7, 6.5, 22.8], [0.61, 0.62, 0.56]);
  box(o, 'limestone', [43, 6.5, -15.6], [67.7, 6.58, 22.8], [0.75, 0.74, 0.68]);
  box(o, 'weathered', [67.5, 0, -22.7], [75.4, 6.5, 22.8], [0.61, 0.62, 0.56]);
  for (let i = 0; i < 8; i++)
    box(
      o,
      'limestone',
      [42.7 - i * 0.38, 6.5 + i * 0.2, 10.5],
      [43.2 - i * 0.38, 6.7 + i * 0.2, 18.7],
      trim,
    );
  for (const [a, b] of [
    [
      [16, 8.7, 19],
      [42.7, 8.7, 19],
    ],
    [
      [43, 7.1, 22.8],
      [67.7, 7.1, 22.8],
    ],
  ])
    beam(o, 'carved', a, b, 1, 0.65, trim);
  // Courtyard entrance stair along the northern gallery, with a real stepped profile.
  if (o.detail !== 'skyline')
    for (let i = 0; i < 24; i++)
      box(
        o,
        'limestone',
        [-13 + i * 0.38, 8.2 + i * 0.28, -8.8],
        [-12.5 + i * 0.38, 8.48 + i * 0.28, -5.3],
        trim,
      );
}
export const neuschwansteinParts = { grounds, palas, bower, northRanges, gatehouse };
export function buildNeuschwansteinRuntime(out, detail) {
  const o = { ...out, detail, runtimeLevel: detail };
  if (detail === 'district') {
    district(o);
    return;
  }
  for (const build of Object.values(neuschwansteinParts)) build(o);
}
function district(o) {
  buildNeuschwansteinSkyline(o);
  const facade = (f, xs, ys, width = 2.4, height = 2.2) => {
    for (const y of ys) for (const x of xs) opening(f, { x, y, width, height });
  };
  for (const [z, a] of [
    [9.31, 0],
    [-8.51, Math.PI],
  ])
    facade(
      transformed(o, -28, 0, z, a),
      [-11.2, -5.6, 0, 5.6, 11.2],
      [9, 14.5, 20, 25.5, 31.2, 36.8],
    );
  const west = transformed(o, -58, 0, 4, 0.21);
  for (const [z, a] of [
    [11.61, 0],
    [-11.61, Math.PI],
  ])
    facade(transformed(west, 0, 0, z, a), [-10, -4, 2, 8], [9, 14.5, 20, 25.5, 31.2, 36.8]);
  facade(
    transformed(o, -12.99, 0, 0.4, Math.PI / 2),
    [-5.6, 0, 5.6],
    [9, 14.5, 20, 25.5, 31.2, 36.8],
  );
  facade(
    transformed(o, -33.5, 0, -13.81, Math.PI),
    [-17, -11, -5, 1, 7, 13, 18],
    [9, 15, 21, 27, 33],
  );
  facade(transformed(o, 0.2, 0, 20.01), [-12, -6, 0, 6, 12], [7.5, 13.3, 19.2]);
  facade(transformed(o, 0.2, 0, 9.99, Math.PI), [-12, -6, 0, 6, 12], [11.5, 19]);
  facade(transformed(o, 10.75, 0, -9.29), [-23, -17, -11, -5, 1, 7, 13, 19, 23], [8.8, 15.8]);
  facade(transformed(o, 6.65, 0, -25.01, Math.PI), [-5, 0, 5], [7, 13.6, 20.3]);
  const g = transformed(o, 71, 0, 0, Math.PI / 2);
  for (const [z, a] of [
    [3.41, 0],
    [-3.41, Math.PI],
  ])
    facade(transformed(g, 0, 0, z, a), [-15, -10, 10, 15], [8.8, 15.2], 2.2, 2.3);
  for (const [z, a] of [
    [4.21, 0],
    [-3.76, Math.PI],
  ])
    opening(transformed(g, 0, 0, z, a), { x: 0, y: 6.5, width: 4.3, height: 5.1, door: true });
}
export function buildNeuschwansteinSkyline(out) {
  const o = { ...out, detail: 'skyline' };
  box(o, 'weathered', [-16, 0, -9.3], [43, 8.2, 19], [0.6, 0.62, 0.58]);
  box(o, 'weathered', [43, 0, -15.6], [67.7, 6.58, 22.8], [0.61, 0.62, 0.56]);
  box(o, 'weathered', [67.5, 0, -22.7], [75.4, 6.5, 22.8], [0.61, 0.62, 0.56]);
  mass(o, -43, -13, -8.5, 9.3, 0, 41.5);
  roof(o, -43.3, -12.7, -8.8, 9.6, 41.7, 54.5);
  mass(o, -54, -13, -13.8, -8.5, 0, 38);
  roof(o, -54.2, -12.8, -14, -8.3, 38.2, 41.6, true);
  const west = transformed(o, -58, 0, 4, 0.21);
  mass(west, -15, 15, -11.6, 11.6, 0, 41.5);
  roof(west, -15.3, 15.3, -11.9, 11.9, 41.7, 54.5);
  for (const [x, z, r, tip] of [
    [-51.8, -15.7, 3.35, 65],
    [-44.2, 8.7, 2.25, 59.2],
  ]) {
    lathe(
      o,
      x,
      z,
      [
        [0, r + 0.5],
        [tip - 7, r],
      ],
      limestone,
    );
    cone(o, x, z, r + 0.4, tip - 7, tip, 6);
  }
  mass(o, -15.8, 16.2, 10, 20, 0, 25.5);
  roof(o, -16.1, 16.5, 9.7, 20.3, 25.7, 31.2, true);
  mass(o, -15, 36.5, -14.1, -9.3, 0, 22.5);
  mass(o, -1.5, 14.8, -25, -14.1, 0, 27.7);
  roof(o, -1.75, 15.05, -25.3, -13.8, 27.9, 34, true);
  mass(o, 35, 44.5, -21, -11.5, 0, 40.5);
  lathe(
    o,
    39.75,
    -16.25,
    [
      [40.5, 3.35],
      [48.3, 3.35],
    ],
    limestone,
  );
  cone(o, 39.75, -16.25, 3.75, 48.3, 54.8, 6);
  mass(o, 44.5, 67.5, -20.5, -15.6, 5.5, 19.8);
  roof(o, 44.3, 67.7, -20.7, -15.4, 20, 23.8);
  const g = transformed(o, 71, 0, 0, Math.PI / 2);
  box(g, 'brick', [-19, 6.5, -3.4], [19, 21, 3.4], brick);
  box(g, 'sandstone', [-5.5, 6.5, -3.75], [5.5, 26.7, 4.2], sandstone);
  steppedGable(transformed(g, 0, 0, 4.2), 11.5, 26.7, 7.2, 'brick', brick);
  steppedGable(transformed(g, 0, 0, -3.75, Math.PI), 11.5, 26.7, 7.2, 'sandstone', sandstone);
  for (const x of [-19.8, 19.8]) {
    lathe(
      g,
      x,
      1.4,
      [
        [5, 2.8],
        [26.5, 3],
      ],
      limestone,
    );
    cone(g, x, 1.4, 2.4, 26.5, 30.8, 6);
  }
}
export const neuschwansteinStudy = {
  id: 'N0237',
  key: 'neuschwanstein_castle',
  title: 'Neuschwanstein Castle',
  category: 'castle',
  wikidataId: 'Q4152',
  build: (out) => buildNeuschwansteinRuntime(out),
  brief:
    'Individually arranged cranked Palas and Throne Hall, unequal spiral stair towers, open galleries, paired Romanesque windows, copper dormers, Bower, Knights’ House, Square Tower and red-brick/yellow-stone gatehouse around two open courts.',
  sourceFacts: {
    constructionStarted: 1869,
    gatehouseOccupied: 1873,
    palasToppingOut: 1880,
    bowerAndSquareTowerCompleted: 1892,
    wallConstruction: 'Brick with light limestone cladding',
    planSource: 'Bavarian Palace Administration labeled complex plan',
    cachedHeightMeters: 65,
    cachedHeightReliability:
      'Unreferenced Wikidata statement; treated as a provisional overall scale, not a surveyed elevation.',
  },
  reconstruction: {
    basis:
      'Individual exterior reconstructed from the official labeled plan and inspected south, northwest, outer-gate and courtyard photographs. The cached OSM boundary is a precinct. Plan parts are manually transcribed and approximately scaled inside that boundary, not surveyed building footprints.',
    planImageMetersPerPixelApprox: 0.194,
    planImageCenterPixels: [395, 155],
    palasWesternWingRotationRadians: 0.21,
    palasEaveY: 41.5,
    palasRidgeY: 54.5,
    mainStairTipY: 65,
    upperCourtY: 8.2,
    lowerCourtY: 6.5,
    datum:
      'Provisional lowest structural base, with raised retained courts. Real terrain/cliff contact is not established.',
  },
  scaleBasis:
    'OSM precinct establishes horizontal envelope and axis. Official plan establishes distinct parts. 65 m unreferenced cached height and photographic proportions are provisional vertical scale; no surveyed elevation drawing inspected.',
  refs: [
    'https://www.neuschwanstein.de/englisch/palace/history.htm',
    'https://www.neuschwanstein.de/englisch/palace/index.htm',
    'https://www.neuschwanstein.de/bilder/schloss/grundriss790.png',
    'https://commons.wikimedia.org/wiki/File:Schloss_Neuschwanstein_2013.jpg',
    'https://commons.wikimedia.org/wiki/File:Aerial_image_of_Neuschwanstein_Castle_(view_from_the_northwest).jpg',
    'https://commons.wikimedia.org/wiki/File:Schloss_Neuschwanstein_im_November_2020_(9).jpg',
    'https://commons.wikimedia.org/wiki/File:Neuschwanstein_pano1.jpg',
    'https://commons.wikimedia.org/wiki/File:Neuschwanstein_pano2.jpg',
    'https://www.openstreetmap.org/way/221601969',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X from western Palas toward eastern gatehouse',
    front: '+Z toward the southern Marienbrücke view',
    origin: 'Cached OSM precinct rectangle center at provisional lowest structural base',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'precinct axis and official plan; sloped terrain datum unresolved',
    notes:
      'The precinct outline establishes a broad map frame, not individual occupied footprints. The gatehouse is at native +X and western Palas at -X. Two retained courts have different levels; a single host terrain sample does not establish their cliff contact. Keep draft until terrain/reference elevation and occupied-range registration are reviewed.',
  }),
  geographicNote:
    'Geographic draft: the steep ridge, structural-base datum and individual occupied bounds need contextual review before world activation. The studio catalog model and its LODs remain inspectable.',
  limitations: [
    'Maximum exterior fidelity remains pending: plan transcription, floor heights, narrow roofs and tower profiles are photographic reconstructions, not measured elevations. The cached 65 m height has no cited source.',
    'The unbuilt central keep and chapel are excluded. Current gatehouse and later Bower/Square Tower are represented; scaffolding and temporary conservation work are not architectural features.',
    'Palas painted murals, heraldic portal relief, human/animal statues, carved capitals and exact tracery require dedicated sculptural/painting work. No substituted generic figure is claimed accurate.',
    'No natural mountain, moat, forest or interiors are included. The retained court levels and basement walls require sloped-terrain integration; the model is a geographic draft.',
    'All geometry is original. Reference images are linked, never embedded or copied into texture maps. Limestone, raw limestone, weathered limestone, sandstone, slate, copper, brick, painted metal and wood use canonical shared materials.',
  ],
  camera: { position: [-170, 105, 235], lookAt: [0, 27, 0], fov: 40 },
  qaCameras: [
    { name: 'southern-palas-and-bower', position: [-45, 38, 165], lookAt: [-27, 28, 3] },
    { name: 'northwest-towers', position: [-115, 70, -146], lookAt: [-14, 28, -6] },
    { name: 'palas-court-gable', position: [26, 31, 5], lookAt: [-13, 30, 0] },
    { name: 'western-open-galleries', position: [-109, 32, 23], lookAt: [-71, 28, 5] },
    { name: 'main-stair-crown', position: [-81, 54, -49], lookAt: [-52, 53, -16] },
    { name: 'knights-house-and-square-tower', position: [20, 36, -92], lookAt: [19, 25, -18] },
    { name: 'gatehouse-outer-brick', position: [128, 23, 7], lookAt: [74, 20, 0] },
    { name: 'gatehouse-inner-clock', position: [33, 24, 2], lookAt: [68, 22, 0] },
    { name: 'two-courtyards-and-roofs', position: [-5, 165, 55], lookAt: [0, 5, 0] },
  ],
};
