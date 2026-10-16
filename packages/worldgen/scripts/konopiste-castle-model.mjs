/** Konopiště: two mapped courts,red roofs,round keep and square-topped corner rooms. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u2/u2f/n0288_konopiste_castle/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const konopistePalette = {
  stone: '#c9bba5',
  trim: '#eee6d6',
  wall: '#e8e3d4',
  roof: '#a5644b',
  wood: '#be9980',
  shutter: '#575c62',
  recess: '#4d6178',
  paving: '#aaa59a',
  metal: '#819991',
};
const colors = Object.fromEntries(
  Object.entries(konopistePalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, p, col = 'wall', slot = 'plaster', target) {
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const a = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (a === 1 ? [v[0], v[2]] : a === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function box(o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function local(o, center, y = 0, a = 0) {
  const rot = ([x, h, z]) => [
    Math.cos(a) * x + Math.sin(a) * z,
    h,
    -Math.sin(a) * x + Math.cos(a) * z,
  ];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, col) =>
        o[k](
          s,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + center[0], q[1] + y, q[2] + center[1]];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function lineFrame(o, a, b, y = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    length: Math.hypot(dx, dz),
    q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y, -Math.atan2(dz, dx)),
  };
}
function polygon(o, loop, y, col, slot = 'limestone') {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], y, loop[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function rings(o, center, levels, n, col = 'stone', slot = 'limestone', phase = 0, cap = true) {
  const circle = ([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
    });
  for (let j = 1; j < levels.length; j++) {
    const a = circle(levels[j - 1]),
      b = circle(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = [a[i], a[k], b[k], b[i]],
        target = [(a[i][0] + a[k][0]) / 2 - center[0], 0, (a[i][2] + a[k][2]) / 2 - center[1]];
      face(o, p, col, slot, target);
    }
  }
  if (cap) {
    const r = circle(levels.at(-1));
    polygon(
      o,
      r.map((p) => [p[0], p[2]]),
      r[0][1],
      col,
      slot,
    );
  }
}
/** A real opening: pier masses, spandrels and soffits leave the arch empty. */
function arcade(
  o,
  length,
  depth,
  bottom,
  top,
  bays,
  span,
  spring,
  rise,
  d,
  col = 'stone',
  slot = 'limestone',
  pointed = false,
) {
  const pitch = length / bays,
    pier = pitch - span;
  box(o, -length / 2 + pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  box(o, length / 2 - pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  for (let i = 1; i < bays; i++)
    box(o, -length / 2 + i * pitch, bottom, 0, pier, top - bottom, depth, col, slot);
  for (let j = 0; j < bays; j++) {
    const mid = -length / 2 + (j + 0.5) * pitch,
      steps = d >= 2 ? 6 : 4;
    const curve = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const half = span / 2,
        radius = (half * half + rise * rise) / (2 * half),
        offset = Math.min(t, 1 - t) * span - radius;
      return [
        mid + (t - 0.5) * span,
        spring +
          (pointed
            ? Math.sqrt(Math.max(0, radius * radius - offset * offset))
            : rise * Math.sin(Math.PI * t)),
      ];
    });
    for (let i = 0; i < steps; i++) {
      const a = curve[i],
        b = curve[i + 1];
      for (const s of [-1, 1])
        face(
          o,
          [
            [a[0], a[1], (s * depth) / 2],
            [b[0], b[1], (s * depth) / 2],
            [b[0], top, (s * depth) / 2],
            [a[0], top, (s * depth) / 2],
          ],
          col,
          slot,
          [0, 0, s],
        );
      face(
        o,
        [
          [a[0], a[1], -depth / 2],
          [b[0], b[1], -depth / 2],
          [b[0], b[1], depth / 2],
          [a[0], a[1], depth / 2],
        ],
        col,
        slot,
        [0, -1, 0],
      );
    }
  }
  face(
    o,
    [
      [-length / 2, top, -depth / 2],
      [length / 2, top, -depth / 2],
      [length / 2, top, depth / 2],
      [-length / 2, top, depth / 2],
    ],
    col,
    slot,
    [0, 1, 0],
  );
}
function pane(o, x, y, z, w, h, d, pointed = false, outward) {
  const p = pointed
    ? [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h * 0.65, z],
        [x, y + h, z],
        [x - w / 2, y + h * 0.65, z],
      ]
    : [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ];
  face(o, p, 'recess', 'glass', [0, 0, outward ?? (z < 0 ? -1 : 1)]);
  if (d >= 3) {
    box(o, x, y - 0.3, z, w + 0.6, 0.3, 0.3, 'trim');
    if (!pointed) box(o, x, y + h, z, w + 0.6, 0.3, 0.3, 'trim');
    box(o, x, y, z, 0.3, h, 0.3, 'trim');
  }
}

function hip(o, x, y, z, length, depth, rise, col = 'roof', slot = 'tile', pyramid = false) {
  const a = x - length / 2,
    b = x + length / 2,
    u = z - depth / 2,
    v = z + depth / 2;
  const inset = pyramid ? length / 2 : Math.min(depth / 2, length * 0.28),
    r0 = [a + inset, y + rise, z],
    r1 = [b - inset, y + rise, z];
  for (const p of [
    [[a, y, u], [b, y, u], r1, r0],
    [[b, y, v], [a, y, v], r0, r1],
    [[a, y, v], [a, y, u], r0],
    [[b, y, u], [b, y, v], r1],
  ])
    face(o, p, col, slot, [0, 1, 0]);
}
const outer = frame.geometry.outline.slice(0, -1);
const courts = frame.geometry.holes.map((p) => p.slice(0, -1));
const flatMeans = {
  plaster: [0.856015, 0.827728, 0.727643],
  limestone: [0.7539, 0.710243, 0.616244],
  tile: [0.559267, 0.552465, 0.529503],
  wood: [0.825128, 0.825128, 0.825128],
};
function winding(loop) {
  return Math.sign(
    loop.reduce((s, p, i) => {
      const q = loop[(i + 1) % loop.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
}
// Remove only small plan deviations at far levels; the master retains all mapped vertices.
function simple(loop, tolerance) {
  const out = loop.map((p) => [...p]);
  for (let pass = 0; pass < 4; pass++) {
    let removed = false;
    for (let i = out.length - 1; i >= 0 && out.length > 4; i--) {
      const p = out[i],
        a = out[(i + out.length - 1) % out.length],
        b = out[(i + 1) % out.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < tolerance) {
        out.splice(i, 1);
        removed = true;
      }
    }
    if (!removed) break;
  }
  return out;
}
function annulus(o, a, b, ay, by, col, slot) {
  const vertices = [...a.map((p) => [p[0], ay, p[1]]), ...b.map((p) => [p[0], by, p[1]])];
  const ix = earcut(
    vertices.flatMap((p) => [p[0], p[2]]),
    [a.length],
  );
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => vertices[k]),
      col,
      slot,
      [0, 1, 0],
    );
}
function bodyCap(o, loops) {
  const vertices = [...loops[0], ...courts[0], ...courts[1]],
    holes = [loops[0].length, loops[0].length + courts[0].length];
  const ix = earcut(vertices.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [vertices[k][0], c.bodyHeight, vertices[k][1]]),
      'wall',
      'plaster',
      [0, 1, 0],
    );
}
function walls(o, loop, inner, courtIndex, d) {
  const sign = winding(loop) * (inner ? -1 : 1);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.1) continue;
    const n = [(sign * dz) / length, 0, (-sign * dx) / length],
      { q } = lineFrame(o, a, b),
      z = -sign * 0.08;
    const loggia =
      d >= 2 &&
      inner &&
      courtIndex === 1 &&
      a[0] < -22 &&
      b[0] < -22 &&
      a[1] > -1.1 &&
      b[1] > -1.1 &&
      a[1] < 5.3 &&
      b[1] < 5.3 &&
      length > 1.5;
    const levels = loggia
      ? [
          [0, 4.8, 'stone', 'limestone'],
          [4.8, 12.8, 'wall', 'plaster'],
          [18.5, 22, 'wall', 'plaster'],
        ]
      : [
          [0, 4.8, 'stone', 'limestone'],
          [4.8, 22, 'wall', 'plaster'],
        ];
    for (const [lo, hi, col, slot] of levels)
      face(
        o,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        col,
        slot,
        n,
      );
    if (loggia) {
      arcade(
        q,
        length,
        0.65,
        12.8,
        18.5,
        1,
        length - 0.65,
        16.1,
        1.6,
        d,
        'trim',
        'limestone',
        true,
      );
      box(q, 0, 12.6, 0, length, 0.3, 0.9, 'trim');
    }
    if (d < 1 || length < 3.1 || loggia) continue;
    const count = Math.max(1, Math.floor(length / c.windowPitch)),
      floors = d === 1 ? [12.2, 18.1] : c.windowFloors;
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * length) / count - length / 2;
      for (const y of floors) {
        pane(q, x, y, z, 1.3, 2.7, 0);
        if (d >= 2) {
          for (const s of [-1, 1]) box(q, x + s * 0.93, y, z, 0.45, 2.7, 0.16, 'shutter', 'wood');
          box(q, x, y - 0.22, z, 2.05, 0.28, 0.4, 'trim', 'limestone');
          if (d >= 3) {
            box(q, x, y + 2.7, z, 2.05, 0.3, 0.38, 'trim', 'limestone');
            for (const s of [-1, 1])
              box(q, x + s * 0.74, y, z, 0.2, 2.7, 0.25, 'trim', 'limestone');
          }
        }
      }
    }
    if (d >= 2) box(q, 0, 21.25, z, length, 0.55, 0.5, 'trim', 'plaster');
  }
}
function roofs(o, d) {
  for (const area of c.roofAreas) {
    const hole = courts[area.hole];
    // Convex enclosing ridge keeps earcut's hole fully inside its boundary.
    // Nearest-edge projections of concave courtyard bays can self-intersect.
    const minX = Math.min(...hole.map((p) => p[0])),
      maxX = Math.max(...hole.map((p) => p[0]));
    const minZ = Math.min(...hole.map((p) => p[1])),
      maxZ = Math.max(...hole.map((p) => p[1]));
    const innerBox = [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ];
    const ridge = innerBox.map((p, i) => [
      p[0] + (area.outer[i][0] - p[0]) * 0.53,
      p[1] + (area.outer[i][1] - p[1]) * 0.53,
    ]);
    annulus(o, area.outer, ridge, 22, 28, 'roof', 'tile');
    annulus(o, ridge, hole, 28, 22, 'roof', 'tile');
  }
  // Central crosswing roof joins the two annuli above their shared lower edge.
  hip(local(o, [3.7, -0.9], 0, Math.PI / 2), 0, 22, 0, 41, 10.3, 6, 'roof', 'tile');
  if (d >= 1) {
    for (const x of [-20, 12]) dormer(local(o, [x, 19.2]), d);
    if (d >= 2) {
      for (const x of [-9, 23]) {
        const q = local(o, [x, 16.6]);
        box(q, 0, 24, 0, 1.5, 2.5, 1.2, 'wood', 'wood');
        pane(q, 0, 24.4, 0.62, 0.7, 1.35, 0);
        hip(q, 0, 26.5, 0, 1.9, 1.8, 1.8, 'shutter', 'wood', true);
      }
      for (const [x, z] of [
        [-16, -16],
        [17, -16],
        [-29, 14],
        [4, -12],
      ]) {
        box(o, x, 27, z, 1.5, 3.1, 1.4, 'wall', 'plaster');
        box(o, x, 30.1, z, 1.9, 0.35, 1.8, 'trim');
      }
    }
  }
}
function dormer(o, d) {
  // Broad stepped Gothic gables are identity geometry; fine cresting is omitted.
  box(o, 0, 23.3, 0, 4.6, 3.5, 1.5, 'wall', 'plaster');
  box(o, 0, 26.8, 0, 4.6, 1.2, 0.5, 'wall', 'plaster');
  box(o, 0, 28, 0, 3.1, 1.15, 0.5, 'wall', 'plaster');
  box(o, 0, 29.15, 0, 1.3, 1.2, 0.5, 'wall', 'plaster');
  pane(o, 0, 24.2, 0.81, 1.6, 2.6, 0);
  hip(o, 0, 26.6, -1.4, 4.6, 3.7, 2, 'roof', 'tile');
  if (d >= 3)
    for (const x of [-1.28, 1.28]) box(o, x, 24.2, 0.83, 0.45, 2.6, 0.2, 'shutter', 'wood');
}
function corners(o, d) {
  const n = [8, 8, 12, 16][d];
  for (const t of c.corners) {
    const q = local(o, t.center),
      w = t.radius * 2 + 0.7;
    rings(
      q,
      [0, 0],
      [
        [22, t.radius],
        [24, t.radius],
      ],
      n,
      'wall',
      'plaster',
    );
    box(q, 0, 24, 0, w, 4, w, 'wall', 'plaster');
    hip(q, 0, 28, 0, w + 1, w + 1, 6, 'roof', 'tile', true);
    rings(
      q,
      [0, 0],
      [
        [34, 0.23],
        [35, 0.04],
      ],
      6,
      'metal',
      'wood',
    );
    if (d < 1) continue;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const v = local(q, [0, 0], 0, a);
      pane(v, 0, 25.6, -w / 2 - 0.07, 0.7, 1.3, 0);
      for (const y of [6.4, 12.2, 18.1]) pane(v, 0, y, -t.radius - 0.07, 1.3, 2.6, 0);
      if (d >= 2) {
        box(v, 0, 24, -w / 2 - 0.1, w, 0.25, 0.26, 'wood', 'wood');
        box(v, 0, 27.7, -w / 2 - 0.1, w, 0.25, 0.26, 'wood', 'wood');
        // Two wide painted diagonal bands: symbolic timber pattern,not rail geometry.
        for (const s of [-1, 1])
          face(
            v,
            [
              [-w * 0.43, 24.4 + (s > 0 ? 0 : 2.9), -w / 2 - 0.16],
              [w * 0.43, 24.4 + (s > 0 ? 2.9 : 0), -w / 2 - 0.16],
              [w * 0.43, 24.7 + (s > 0 ? 2.9 : 0), -w / 2 - 0.16],
              [-w * 0.43, 24.7 + (s > 0 ? 0 : 2.9), -w / 2 - 0.16],
            ],
            'wood',
            'wood',
            [0, 0, -1],
          );
      }
    }
  }
}
function keep(o, d) {
  const t = c.keep,
    q = local(o, t.center),
    n = [8, 8, 12, 16][d];
  rings(
    q,
    [0, 0],
    [
      [22, t.radius],
      [34, t.radius],
    ],
    n,
    'wall',
    'plaster',
  );
  rings(
    q,
    [0, 0],
    [
      [34, t.radius],
      [35, 8.2],
      [38, 8.2],
    ],
    n,
    'wall',
    'plaster',
  );
  rings(
    q,
    [0, 0],
    [
      [38, 8.6],
      [48, 0.18],
    ],
    n,
    'roof',
    'tile',
  );
  rings(
    q,
    [0, 0],
    [
      [48, 0.18],
      [49, 0.3],
      [49.5, 0.025],
    ],
    6,
    'metal',
    'wood',
  );
  if (d < 1) return;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / n,
      v = local(q, [0, 0], 0, -a + Math.PI / 2),
      r = 8.2 * Math.cos(Math.PI / n) + 0.055;
    pane(v, 0, 35.6, -r, 0.65, 1.5, 0);
    if (d >= 2) {
      box(v, 0, 33.5, -t.radius - 0.4, 0.7, 1.4, 0.85, 'trim');
      pane(v, 0, 29, -t.radius * Math.cos(Math.PI / n) - 0.06, 0.65, 2, 0);
    }
    if (d >= 3) box(v, 0, 38, -r, 0.9, 0.25, 0.3, 'trim');
  }
}
function terrace(o, d) {
  const t = c.terrace,
    q = local(o, t.center);
  if (d < 2) box(q, 0, 0, 0, t.width, t.top, t.depth, 'stone', 'limestone');
  else {
    const front = local(q, [0, t.depth / 2 - 0.4]);
    arcade(front, t.width, 0.8, 0, t.top, t.bays, 4.65, 2.65, 1.7, d);
    for (let i = 0; i < t.bays; i++)
      pane(front, ((i + 0.5) * t.width) / t.bays - t.width / 2, 0.4, -0.43, 4.6, 3.9, 0, true, 1);
    for (const s of [-1, 1]) box(q, s * (t.width / 2 - 0.4), 0, 0, 0.8, t.top, t.depth, 'stone');
    box(q, 0, t.top, 0, t.width + 0.8, 0.45, t.depth + 0.5, 'trim');
    for (const s of [-1, 1])
      box(q, s * (t.width / 2 - 0.3), t.top + 0.45, 0, 0.45, 0.9, t.depth, 'trim');
    // Solid low parapets stay resolvable across street-distance views.
    box(q, 0, t.top + 0.45, t.depth / 2, t.width + 0.8, 0.9, 0.45, 'trim');
    box(q, 0, t.top + 0.45, 2.4, 10, 1.1, 2.5, 'stone');
    for (let i = 0; i < 8; i++)
      box(q, -t.width / 2 + 3 + i * 0.7, i * 0.6, t.depth / 2 + 2, 1.4, 0.6, 4, 'stone');
  }
}
function build(o, d) {
  const loop = d < 2 ? simple(outer, d === 0 ? 0.5 : 0.15) : outer;
  for (const p of courts) polygon(o, p, c.courtY + 0.025, 'paving', 'foliage');
  walls(o, loop, false, -1, d);
  for (const [i, p] of courts.entries()) walls(o, p, true, i, d);
  bodyCap(o, [loop]);
  roofs(o, d);
  corners(o, d);
  keep(o, d);
  terrace(o, d);
}
export const buildKonopisteRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildKonopisteSkyline = (o) =>
  build(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, col) =>
          o[k](
            'silhouette',
            r,
            p,
            n,
            uv,
            col.map((v, i) => v * (flatMeans[s]?.[i] ?? 1)),
          ),
      ]),
    ),
    0,
  );
export const konopisteStudy = {
  id: 'N0288',
  key: 'konopiste_castle',
  title: 'Konopiště Castle',
  category: 'castle',
  wikidataId: 'Q744016',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildKonopisteRuntime(o),
  brief:
    'Cream quadrangular castle with two mapped open courts,terracotta pitched roofs,dominant round keep with corbelled upper gallery/red cone,square-topped corner rooms with broad timber crosses,stepped gabled dormers,stone terrace and open pointed courtyard loggia.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: konopistePalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: flatMeans,
    materialBudget: 6,
    identityFeatures: [
      'Two open courtyard rings and cream quadrangular wings',
      'Large round keep with overhanging gallery/red cone',
      'Square-topped corner rooms with red pyramids and stepped facade dormers',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/282741 exactQ744016',
    mappedEnvelopeMeters: [83.567, 50.131],
    mappedLevelsRejected: 1,
    measuredHeightAvailable: false,
    bodyEaveEstimateMeters: 22,
    roofRidgeEstimateMeters: 28,
    keepMaximumEstimateMeters: 49.5,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Cached exact mapped wall/courtyard rings;all heights and separate roof/tower/terrace controls are original photo-based estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license. Mapped rings © OpenStreetMap contributors,ODbL-1.0. Operator/photographer images are private external research only,not redistributed or embedded.',
  dataAttribution:
    '© OpenStreetMap contributors;National Heritage Institute/official Konopiště operator;primary photographers Lukáš Kalista and Sergey Ashmarin (external references).',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Inactive geographic draft;review pending',
    notes:
      'Undirected cached axis. Signed southern-facade direction,estimated tower/roof/terrace fit,height/terrain datum and completeness pending.',
  }),
  geographicNote:
    'Current original approximate exterior on cached mapped wall rings;inactive until real-site review.',
  limitations: refs.limitations,
  importReason:
    'Retain twin open courts,round conical keep and square-topped corner rooms in compact source-authored LODs.',
  mediumFiContext: { scale: '2', neighborStyle: 'molen.worldgen.catalog.bohemian_townhouse' },
  camera: { position: [112, 79, 127], lookAt: [0, 19, 1], fov: 43 },
  qaCameras: [
    { name: 'southern-terrace-corners-and-keep', position: [95, 42, 95], lookAt: [3, 20, 6] },
    { name: 'round-keep-gallery-and-cone', position: [85, 47, -18], lookAt: [34.3, 35, 1.2] },
    { name: 'two-open-courtyards', position: [48, 114, 64], lookAt: [0, 16, 0] },
    { name: 'western-court-open-pointed-loggia', position: [-8, 17, -5], lookAt: [-25, 15, 2] },
    {
      name: 'stepped-dormers-and-timber-tower-room',
      position: [-56, 33, 63],
      lookAt: [-24, 25, 19],
    },
    { name: 'northern-wing-and-corner-towers', position: [-84, 48, -76], lookAt: [0, 19, -5] },
  ],
};
