/** Castel Nuovo: five crenellated towers,stacked marble entrance and open court. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/sr/sr6/n0289_castel_nuovo/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const castelNuovoPalette = {
  stone: '#bfb09c',
  trim: '#eee6d6',
  wall: '#eadfc6',
  roof: '#b9b3a1',
  wood: '#ba9875',
  recess: '#4d6178',
  paving: '#aaa59a',
};
const colors = Object.fromEntries(
  Object.entries(castelNuovoPalette).map(([k, h]) => [
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
function face(o, p, col = 'wall', slot = 'sandstone', target) {
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
function box(o, x, y, z, w, h, depth, col = 'stone', slot = 'sandstone') {
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
function polygon(o, loop, y, col, slot = 'sandstone') {
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
function rings(o, center, levels, n, col = 'stone', slot = 'sandstone', phase = 0, cap = true) {
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
  slot = 'sandstone',
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
const outer = frame.geometry.outline.slice(0, -1),
  court = frame.geometry.holes[0].slice(0, -1);
const flatMeans = {
  basalt: [0.540547, 0.565118, 0.537968],
  sandstone: [0.684938, 0.602377, 0.467682],
  marble: [0.916083, 0.916083, 0.916083],
  wood: [0.825128, 0.825128, 0.825128],
};
function strip(o, a, b, lo, hi, col = 'wall', slot = 'sandstone', inner = false) {
  const sign = winding(inner ? court : c.bodyOutline) * (inner ? -1 : 1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  if (l < 0.01) return;
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
    [(sign * dz) / l, 0, (-sign * dx) / l],
  );
}
function wall(o, a, b, inner, d) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    { q } = lineFrame(o, a, b),
    bottom = inner ? c.courtY : 2.2;
  const west = a[0] < -28 && b[0] < -28;
  const courtArcade = inner && length > 40 && (a[1] + b[1]) / 2 > 8 && d >= 2;
  const gallery = !inner && (a[1] + b[1]) / 2 > 25 && length > 20 && d >= 2;
  if (west && Math.min(a[1], b[1]) < 9.5 && Math.max(a[1], b[1]) > 3.5) {
    const cuts = [
      0,
      1,
      ...[3.5, 9.5].map((z) => (z - a[1]) / (b[1] - a[1])).filter((t) => t > 0 && t < 1),
    ].sort((a, b) => a - b);
    const point = (t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    for (let i = 1; i < cuts.length; i++) {
      const p = point(cuts[i - 1]),
        r = point(cuts[i]),
        z = (p[1] + r[1]) / 2;
      if (z > 3.5 && z < 9.5) {
        if (bottom < 5) strip(o, p, r, bottom, 5, 'stone', 'basalt', inner);
        strip(o, p, r, 15, 21, 'wall', 'sandstone', inner);
      } else strip(o, p, r, bottom, c.bodyHeight, 'wall', 'sandstone', inner);
    }
  } else if (courtArcade) {
    strip(o, a, b, 12.5, c.bodyHeight, 'wall', 'sandstone', true);
    arcade(q, length, 1.4, 5, 12.5, 9, length / 9 - 1.2, 9.5, 2, d, 'wall', 'sandstone');
    // Back wall stands away from the openings; arches have visible depth.
    box(q, 0, 5, -2.7, length, 7.5, 0.8, 'wall', 'sandstone');
  } else if (gallery) {
    strip(o, a, b, bottom, 25, 'wall', 'sandstone');
    const galleryLength = c.bodyOutline.reduce((sum, a, i) => {
      const b = c.bodyOutline[(i + 1) % c.bodyOutline.length];
      return sum + ((a[1] + b[1]) / 2 > 25 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0);
    }, 0);
    const bays = Math.round((c.exteriorGalleryBays * length) / galleryLength);
    arcade(q, length, 0.8, 25, 29.5, bays, length / bays - 0.65, 27, 1.35, d, 'wall', 'sandstone');
  } else strip(o, a, b, bottom, c.bodyHeight, 'wall', 'sandstone', inner);
  if (d < 1 || length < 9) return;
  const sign = winding(inner ? court : c.bodyOutline) * (inner ? -1 : 1),
    z = -sign * 0.09;
  const count = Math.max(1, Math.floor(length / (inner ? 8 : 12)));
  for (let j = 0; j < count; j++)
    for (const y of d === 1 ? [18] : inner ? [15, 22] : [11, 19]) {
      const x = ((j + 0.5) * length) / count - length / 2;
      pane(q, x, y, z, inner ? 1.4 : 1.1, inner ? 2.6 : 2.1, 0, false, -sign);
      if (d >= 3) {
        box(q, x, y - 0.3, z, 2, 0.3, 0.35, 'trim', 'sandstone');
      }
    }
}
function foundation(o, d) {
  const loop = d < 2 ? simple(outer, d === 0 ? 1.1 : 0.35) : outer;
  annulus(o, loop, court, 2.2, 2.2, 'stone', 'basalt');
  const sign = winding(loop);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], 2.2, b[1]],
        [a[0], 2.2, a[1]],
      ],
      'stone',
      'basalt',
      [(sign * dz) / l, 0, (-sign * dx) / l],
    );
  }
  if (d >= 2) {
    for (const [a, b] of [
      [
        [54, -21],
        [53, 25],
      ],
      [
        [17, 51],
        [-36, 29],
      ],
    ]) {
      const { q, length } = lineFrame(o, a, b);
      box(q, 0, 2.2, 0, length, 1.6, 1.4, 'stone', 'basalt');
      const bays = Math.floor(length / 3.2);
      for (let j = 0; j < bays; j++)
        box(q, ((j + 0.5) * length) / bays - length / 2, 3.8, 0, 1.6, 1.2, 1.4, 'stone', 'basalt');
    }
  }
}
function towers(o, d) {
  const n = [6, 8, 12, 16][d];
  for (const t of c.towers) {
    const q = local(o, t.center),
      r = t.radius,
      shaftTop = t.top - 5.5;
    rings(
      q,
      [0, 0],
      [
        [2.2, t.footRadius],
        [8, r],
        [shaftTop, r],
        [shaftTop + 1.5, r + 1.3],
        [t.top - 2, r + 1.3],
      ],
      n,
      'stone',
      'basalt',
    );
    const count = d === 0 ? 3 : d === 1 ? 6 : d === 2 ? 12 : 16;
    for (let j = 0; j < count; j++) {
      const a = (j * Math.PI * 2) / count,
        v = local(q, [Math.cos(a) * (r + 0.65), Math.sin(a) * (r + 0.65)], 0, Math.PI / 2 - a);
      box(v, 0, t.top - 2, 0, d === 0 ? 3 : 2, 2, 1.5, 'stone', 'basalt');
    }
    if (d < 1) continue;
    for (let j = 0; j < (d === 1 ? 4 : n); j++) {
      const a = ((j + 0.5) * Math.PI * 2) / (d === 1 ? 4 : n),
        v = local(q, [0, 0], 0, -a + Math.PI / 2),
        rr = r * Math.cos(Math.PI / n) + 0.06;
      for (const y of d === 1 ? [20] : [13, 23]) pane(v, 0, y, -rr, 0.65, 1.7, 0);
      if (d >= 2) box(v, 0, shaftTop - 0.75, -rr - 0.55, 0.7, 1.5, 1.2, 'stone', 'basalt');
    }
  }
}
function entrance(o, d) {
  const t = c.entrance,
    q = local(o, t.center, 0, Math.PI / 2),
    w = t.width;
  arcade(q, w, t.depth, 5, 15, 1, 5.8, 10.3, 3.4, d, 'trim', 'marble');
  box(q, 0, 15, 0, w, 6, t.depth, 'trim', 'marble');
  arcade(q, w, t.depth, 21, 32, 1, 5.8, 27.1, 3.4, d, 'trim', 'marble');
  box(q, 0, 32, 0, w, 3.5, t.depth, 'trim', 'marble');
  // One broad curved pediment; no copied relief meshes or thin flag staff.
  const arch = Array.from({ length: d >= 2 ? 9 : 5 }, (_, i) => {
    const a = (i * Math.PI) / (d >= 2 ? 8 : 4);
    return [w * 0.5 * Math.cos(a), 35.5 + 2.4 * Math.sin(a), -t.depth / 2 - 0.1];
  });
  face(
    q,
    [[-w / 2, 35.5, -t.depth / 2 - 0.1], [w / 2, 35.5, -t.depth / 2 - 0.1], ...arch],
    'trim',
    'marble',
    [0, 0, -1],
  );
  box(q, 0, 37.5, 0, 1, 1, 1, 'trim', 'marble');
  if (d >= 2) {
    for (const y of [5, 14.6, 20.6, 31.6, 35.2])
      box(q, 0, y, -t.depth / 2 - 0.2, w + 0.5, 0.4, 0.6, 'trim', 'marble');
    // Broad symbolic pilasters and relief bands stay above near-level error.
    for (const x of [-w / 2 + 0.55, w / 2 - 0.55])
      box(q, x, 5, -t.depth / 2 - 0.3, 0.65, 27, 0.65, 'trim', 'marble');
    for (let j = 0; j < 4; j++) {
      const x = (j - 1.5) * 1.6;
      pane(q, x, 32.4, -t.depth / 2 - 0.12, 1, 2.4, 0, true);
      if (d >= 3) {
        box(q, x, 33, -t.depth / 2 - 0.32, 0.55, 1.2, 0.45, 'trim', 'marble');
        rings(
          local(q, [x, -t.depth / 2 - 0.35]),
          [0, 0],
          [
            [34.2, 0.3],
            [34.7, 0.12],
          ],
          6,
          'trim',
          'marble',
        );
      }
    }
    if (d >= 3)
      for (let i = 0; i < 6; i++)
        box(q, (i - 2.5) * 1.05, 17, -t.depth / 2 - 0.25, 0.7, 2.4, 0.55, 'trim', 'marble');
    box(q, 0, 21, -t.depth / 2 - 0.2, 5.8, 0.65, 0.4, 'trim', 'marble');
  }
  const b = c.bridge;
  box(o, b.center[0], b.top - 0.5, b.center[1], b.width, 0.5, b.depth, 'wood', 'wood');
  if (d >= 1) {
    for (const z of [-1, 1])
      box(
        o,
        b.center[0],
        b.top,
        b.center[1] + (z * b.depth) / 2,
        b.width,
        0.8,
        0.45,
        'stone',
        'sandstone',
      );
    for (const x of [-69, -58]) box(o, x, 0, b.center[1], 2.5, 4.5, 3.5, 'stone', 'basalt');
  }
}
function hall(o, d) {
  const h = c.hall;
  box(o, h.center[0], 28, h.center[1], h.width, h.top - 28, h.depth, 'wall', 'sandstone');
  // Broad low roof over the documented octagonal internal vault; exterior is estimated.
  rings(
    o,
    h.center,
    [
      [h.top, 18],
      [h.roofTop, 1],
    ],
    8,
    'roof',
    'foliage',
  );
  if (d >= 1) {
    const q = local(o, [h.center[0], h.center[1] + h.depth / 2]);
    for (const x of [-8, 5]) pane(q, x, 29, 0.08, 2.1, 4.5, 0, true);
  }
  if (d >= 2) {
    // External northern court stair,estimated arrangement; chunky treads replace rails.
    for (let i = 0; i < 14; i++)
      box(o, 14, 5 + i * 0.5, -18 - i * 0.65, 4.5, 0.5, 1, 'wall', 'sandstone');
    box(o, 14, 11.5, -27.1, 5, 1, 3, 'wall', 'sandstone');
  }
}
function chapel(o, d) {
  const h = c.chapel;
  box(o, h.center[0], 28, h.center[1], h.width, h.top - 28, h.depth, 'wall', 'sandstone');
  if (d === 0) return;
  // Court front faces -X; rose window and portal are original broad geometry.
  const q = local(o, [20.4, 0], 0, Math.PI / 2),
    z = -0.12,
    n = d >= 2 ? 16 : 8,
    r = 2.7,
    cy = 22;
  const disk = Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * Math.PI * 2) / n),
    cy + r * Math.sin((i * Math.PI * 2) / n),
    z,
  ]);
  face(q, disk, 'recess', 'glass', [0, 0, -1]);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    face(
      q,
      [
        [r * Math.cos(a), cy + r * Math.sin(a), z - 0.04],
        [r * Math.cos(b), cy + r * Math.sin(b), z - 0.04],
        [(r + 0.5) * Math.cos(b), cy + (r + 0.5) * Math.sin(b), z - 0.04],
        [(r + 0.5) * Math.cos(a), cy + (r + 0.5) * Math.sin(a), z - 0.04],
      ],
      'trim',
      'marble',
      [0, 0, -1],
    );
  }
  pane(q, 0, 5, z, 3, 5.5, 0, true);
  pane(q, 0, 13, z, 1.8, 3.2, 0, true);
  if (d >= 2) {
    for (const x of [-2.1, 2.1]) box(q, x, 5, z - 0.1, 0.5, 6.3, 0.5, 'trim', 'marble');
    box(q, 0, 11.2, z - 0.1, 4.6, 0.55, 0.6, 'trim', 'marble');
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      const dx = Math.cos(a),
        dy = Math.sin(a),
        nx = -dy * 0.15,
        ny = dx * 0.15;
      face(
        q,
        [
          [nx, cy + ny, z - 0.12],
          [dx * 2.6 + nx, cy + dy * 2.6 + ny, z - 0.12],
          [dx * 2.6 - nx, cy + dy * 2.6 - ny, z - 0.12],
          [-nx, cy - ny, z - 0.12],
        ],
        'trim',
        'marble',
        [0, 0, -1],
      );
    }
    const back = local(o, [54.1, 5], 0, -Math.PI / 2);
    pane(back, 0, 16, -0.06, 3.2, 10, 0, true);
    for (const zt of [-4, 14])
      rings(
        o,
        [54, zt],
        [
          [24, 1.5],
          [31, 1.5],
          [32, 1],
        ],
        8,
        'wall',
        'sandstone',
      );
    // Two five-bay glazed loggias on the marine elevation,not empty arches.
    const east = local(o, [54.15, 22], 0, -Math.PI / 2);
    for (const y of [10, 18]) {
      arcade(east, 17, 0.7, y, y + 6, 5, 2.65, y + 3.6, 1.6, d, 'wall', 'sandstone');
      for (let j = 0; j < 5; j++) {
        const mid = (j - 2) * 3.4,
          span = 2.6,
          z = -0.33;
        const curve = Array.from({ length: 7 }, (_, i) => [
          mid + (i / 6 - 0.5) * span,
          y + 3.6 + 1.6 * Math.sin((Math.PI * i) / 6),
          z,
        ]);
        face(
          east,
          [[mid - span / 2, y + 0.2, z], [mid + span / 2, y + 0.2, z], ...curve.reverse()],
          'recess',
          'glass',
          [0, 0, -1],
        );
      }
    }
  }
}
function build(o, d) {
  foundation(o, d);
  polygon(o, court, c.courtY, 'paving', 'foliage');
  const b = c.bodyOutline;
  for (let i = 0; i < b.length; i++) wall(o, b[i], b[(i + 1) % b.length], false, d);
  for (let i = 0; i < court.length; i++) wall(o, court[i], court[(i + 1) % court.length], true, d);
  annulus(o, b, court, c.bodyHeight, c.bodyHeight, 'roof', 'foliage');
  towers(o, d);
  entrance(o, d);
  hall(o, d);
  chapel(o, d);
}
export const buildCastelNuovoRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildCastelNuovoSkyline = (o) =>
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
export const castelNuovoStudy = {
  id: 'N0289',
  key: 'castel_nuovo',
  title: 'Castel Nuovo',
  category: 'castle',
  wikidataId: 'Q781219',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildCastelNuovoRuntime(o),
  brief:
    'Five flat crenellated piperno towers on battered footings,tufo curtain wings,stacked pale marble entrance arch,open trapezoid courtyard,rose-window chapel,raised Barons Hall and nine court arcades.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: castelNuovoPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: flatMeans,
    materialBudget: 6,
    identityFeatures: [
      'Five round crenellated towers and battered footings',
      'Pale marble gate with two stacked actual openings',
      'Open trapezoid courtyard within tufo curtain wings',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/15009683 exactQ781219',
    mappedEnvelopeMeters: [120.337, 112.652],
    measuredExteriorHeightAvailable: false,
    mappedElevationNotHeight: 40,
    maximumHeightEstimateMeters: 40,
    documentedInteriorHallMeters: [26, 26, 28],
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Cached exact footing/court rings;all upper wall,tower,gate,chapel,hall and bridge controls are original photograph-based estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceNotice:
    'Mapped footings and court reproduce separately attributed OpenStreetMap data under ODbL-1.0. All other geometry is original approximate authoring. No downloaded mesh,research photograph or unique texture is embedded;four shared material graphs supply reusable surfaces.',
  sourceLicense:
    'Original geometry under repository license. Mapped rings © OpenStreetMap contributors,ODbL-1.0. Operator and photographer images are external research only,not redistributed or embedded.',
  dataAttribution:
    '© OpenStreetMap contributors;Municipality of Naples;Italian Ministry of Culture;Campania region;Italian Institute of Castles,Campania;primary photographers MM,currybet,Lalupa.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Inactive geographic draft;review pending',
    notes:
      'Undirected cached axis. Signed western gate direction,estimated upper volumes,height/terrain datum and completeness pending.',
  }),
  geographicNote:
    'Original approximate exterior on mapped footing/court rings;inactive until real-site review.',
  limitations: refs.limitations,
  importReason:
    'Retain five crenellated towers,pale stacked arch and open court within medium-fi runtime budgets.',
  mediumFiContext: { scale: '2', neighborStyle: 'molen.worldgen.catalog.italian_palazzo' },
  camera: { position: [-150, 82, 110], lookAt: [0, 18, 0], fov: 43 },
  qaCameras: [
    { name: 'western-gate-and-five-towers', position: [-155, 60, -85], lookAt: [0, 18, 0] },
    { name: 'two-stacked-marble-gate-openings', position: [-94, 25, 6.5], lookAt: [-48, 21, 6.5] },
    { name: 'open-court-hall-and-flat-tower-crowns', position: [80, 145, 100], lookAt: [0, 18, 0] },
    { name: 'court-chapel-rose-and-portal', position: [-9, 17, 0], lookAt: [21, 19, 0] },
    { name: 'nine-court-arcades', position: [-4, 16, -15], lookAt: [-3, 10, 19] },
    { name: 'marine-elevation-and-glazed-loggias', position: [96, 26, 25], lookAt: [53, 19, 17] },
  ],
};
