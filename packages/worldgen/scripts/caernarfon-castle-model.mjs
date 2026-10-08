/** Present-day Caernarfon: polygonal towers, banded river walls and two open wards. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gck/n0273_caernarfon_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const caernarfonPalette = {
  stone: '#bcb6a4',
  band: '#989082',
  coping: '#c8bda1',
  paving: '#b5af9f',
  wood: '#b0a28e',
  glass: '#4d6178',
  metal: '#657078',
  grass: '#859f67',
};
const colors = Object.fromEntries(
  Object.entries(caernarfonPalette).map(([k, hex]) => [
    k,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const rect = (o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') =>
  box(o, slot, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], colors[col]);
function local(o, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, points, normal, uv, col) =>
        o[k](
          slot,
          ref,
          points.map((p) => {
            const q = rot(p);
            return [q[0] + x, q[1], q[2] + z];
          }),
          rot(normal),
          uv,
          col,
        ),
    ]),
  );
}
function face(o, points, col = 'stone', slot = 'limestone', target) {
  let p = points;
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (axis === 1 ? [v[0], v[2]] : axis === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function slab(o, poly, y, col = 'paving', slot = 'limestone') {
  const ids = earcut(poly.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [poly[j][0], y, poly[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const bandAt = (y, banded, d) =>
  banded &&
  (d === 1 ? [8.9] : [4.3, 8.9, 13.5, 18.1, 22.7, 27.3, 31.9]).some((lo) => y >= lo && y < lo + 0.9)
    ? 'band'
    : 'stone';

/** One polygon facet, with selected real apertures through both masonry faces. */
function facet(o, a, b, ia, ib, base, top, d, banded = false, holes = []) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [a[0] + b[0] - ia[0] - ib[0], 0, a[1] + b[1] - ia[1] - ib[1]];
  const at = (t, y, inner = false) => {
    const p = lerp(inner ? ia : a, inner ? ib : b, t);
    return [p[0], y, p[1]];
  };
  const ys = [
    ...new Set([
      base,
      top,
      ...(banded && d
        ? d === 1
          ? [8.9, 9.8]
          : [4.3, 5.2, 8.9, 9.8, 13.5, 14.4, 18.1, 19, 22.7, 23.6, 27.3, 28.2, 31.9, 32.8]
        : []),
      ...holes.flatMap((h) => [h.sill, h.head - 0.55, h.head]),
    ]),
  ]
    .filter((y) => y >= base && y <= top)
    .sort((a, b) => a - b);
  const draw = (u0, u1, y0, y1, col) => {
    face(o, [at(u0, y0), at(u1, y0), at(u1, y1), at(u0, y1)], col, 'limestone', normal);
    if (d >= 2)
      face(
        o,
        [at(u0, y0, true), at(u1, y0, true), at(u1, y1, true), at(u0, y1, true)],
        col,
        'limestone',
        normal.map((v) => -v),
      );
  };
  for (let j = 1; j < ys.length; j++) {
    const lo = ys[j - 1],
      hi = ys[j],
      col = bandAt((lo + hi) / 2, banded && d, d);
    const h = holes.find((h) => lo >= h.sill && hi <= h.head);
    if (!h) {
      draw(0, 1, lo, hi, col);
      continue;
    }
    const u0 = h.at - h.width / len / 2,
      u1 = h.at + h.width / len / 2;
    draw(0, u0, lo, hi, col);
    draw(u1, 1, lo, hi, col);
    if (lo >= h.head - 0.55) {
      // Shouldered lintel: broad corner pieces instead of tiny moulding or per-stone joints.
      const shoulder = Math.min(0.32 / len, (u1 - u0) * 0.24);
      draw(u0, u0 + shoulder, lo, hi, col);
      draw(u1 - shoulder, u1, lo, hi, col);
    }
  }
  for (const h of holes) {
    const u0 = h.at - h.width / len / 2,
      u1 = h.at + h.width / len / 2;
    const spring = h.head - 0.55,
      shoulder = Math.min(0.32 / len, (u1 - u0) * 0.24);
    const profile = [
      [u0, h.sill],
      [u0, spring],
      [u0 + shoulder, spring],
      [u0 + shoulder, h.head],
      [u1 - shoulder, h.head],
      [u1 - shoulder, spring],
      [u1, spring],
      [u1, h.sill],
    ];
    for (let i = 1; i < profile.length; i++) {
      const [u, y] = profile[i - 1],
        [v, yy] = profile[i];
      face(o, [at(u, y), at(v, yy), at(v, yy, true), at(u, y, true)], 'coping');
    }
    face(
      o,
      [at(u1, h.sill), at(u0, h.sill), at(u0, h.sill, true), at(u1, h.sill, true)],
      'coping',
      'limestone',
      [0, 1, 0],
    );
    if (h.glass && d >= 2) {
      const q = profile.map(([u, y]) => {
        const p = at(u, y, true);
        return p.map((v, i) => v + (normal[i] / Math.hypot(...normal)) * 0.03);
      });
      const ids = earcut(profile.flat(), [], 2);
      for (let i = 0; i < ids.length; i += 3)
        face(
          o,
          ids.slice(i, i + 3).map((j) => q[j]),
          'glass',
          'glass',
          normal,
        );
      if (d === 3) {
        const mid = at(h.at, h.sill, true),
          end = at(h.at, h.head, true);
        rect(o, mid[0], mid[1], mid[2], 0.32, end[1] - mid[1], 0.32, 'coping');
      }
    }
  }
  if (d === 1)
    face(
      o,
      [at(0, base, true), at(1, base, true), at(1, top, true), at(0, top, true)],
      'stone',
      'limestone',
      normal.map((v) => -v),
    );
  face(
    o,
    [at(0, top), at(1, top), at(1, top, true), at(0, top, true)],
    'coping',
    'limestone',
    [0, 1, 0],
  );
}
function battlements(o, poly, top, d, pitch = 3.25) {
  for (let i = 0; i < (poly.length === 2 ? 1 : poly.length); i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
    if (d === 1 && len < 3 && pitch >= 3) continue;
    if (d === 1 && pitch < 3 && i % 2 === 1) continue;
    const n = Math.max(1, Math.round(len / (d === 1 ? pitch * 2.2 : pitch)));
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) / n) * len,
        width = Math.min(1.55, (len / n) * 0.56);
      rect(q, x, top, 0, width, 1.4, 0.85, 'coping');
    }
  }
}
function polygonTower(
  o,
  poly,
  center,
  base,
  top,
  d,
  { banded = false, glass = false, floor = 2, turret = false } = {},
) {
  // Thick hollow tower shells; skyline uses a flat roof silhouette at its natural distant scale.
  const inner = poly.map((p) => lerp(center, p, turret ? 0.58 : 0.6));
  if (!d) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      face(
        o,
        [
          [a[0], base, a[1]],
          [b[0], base, b[1]],
          [b[0], top + 1.4, b[1]],
          [a[0], top + 1.4, a[1]],
        ],
        'stone',
        'limestone',
        [a[0] + b[0] - 2 * center[0], 0, a[1] + b[1] - 2 * center[1]],
      );
    }
    slab(o, poly, top + 1.4, 'stone');
    return;
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const holes =
      d >= 2 && len > (turret ? 1.6 : 3.8) && (turret || i % 2 === 0)
        ? (turret ? [base + 2] : [5.2, 12.2, ...(top > 24 ? [19.2] : [])])
            .filter((y) => y + (turret ? 2 : 3.6) < top)
            .map((sill) => ({
              at: 0.5,
              width: turret ? 0.6 : 1.65,
              sill,
              head: sill + (turret ? 2 : 3.6),
              glass,
            }))
        : [];
    facet(o, a, b, inner[i], inner[(i + 1) % poly.length], base, top, d, banded, holes);
  }
  slab(o, inner, floor, glass ? 'wood' : 'paving', glass ? 'wood' : 'limestone');
  battlements(o, poly, top, d, turret ? 2.3 : 3.6);
}
const octagon = (center, radius, angle = Math.PI / 8) =>
  Array.from({ length: 8 }, (_, i) => [
    center[0] + Math.cos(angle + (i * Math.PI) / 4) * radius,
    center[1] + Math.sin(angle + (i * Math.PI) / 4) * radius,
  ]);
function wall(o, a, b, base, top, d, { thick = 2.7, banded = false, windows = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  const aa = a.map((v, i) => v - (n[i] * thick) / 2),
    bb = b.map((v, i) => v - (n[i] * thick) / 2);
  const ia = a.map((v, i) => v + (n[i] * thick) / 2),
    ib = b.map((v, i) => v + (n[i] * thick) / 2);
  const count = windows && d >= 2 ? Math.floor(len / 6.8) : 0;
  const holes = Array.from({ length: count }, (_, i) => ({
    at: (i + 0.5) / count,
    width: 1.6,
    sill: 4.3,
    head: 7.7,
  }));
  // Separate bays prevent distant facade strips from turning into repeated framed little boxes.
  if (!count) facet(o, aa, bb, ia, ib, base, top, d || 1, banded && d > 0);
  else
    for (let i = 0; i < count; i++)
      facet(
        o,
        lerp(aa, bb, i / count),
        lerp(aa, bb, (i + 1) / count),
        lerp(ia, ib, i / count),
        lerp(ia, ib, (i + 1) / count),
        base,
        top,
        d,
        banded,
        [{ ...holes[i], at: 0.5 }],
      );
  for (const [p, pp] of [
    [aa, ia],
    [bb, ib],
  ])
    face(o, [
      [p[0], base, p[1]],
      [pp[0], base, pp[1]],
      [pp[0], top, pp[1]],
      [p[0], top, p[1]],
    ]);
  if (d) battlements(o, [aa, bb], top, d, 3.4);
}
function gateArch(o, width, sill, head, top, depth, d) {
  const spring = head - width * 0.45,
    n = d >= 2 ? 6 : 2;
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const u = -1 + (2 * i) / n;
    return [(u * width) / 2, spring + Math.sqrt(1 - Math.abs(u)) * (head - spring)];
  });
  if (sill) rect(o, 0, 0, 0, width, sill, depth);
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    for (const side of [-1, 1])
      face(
        o,
        [
          [a[0], a[1], (side * depth) / 2],
          [b[0], b[1], (side * depth) / 2],
          [b[0], top, (side * depth) / 2],
          [a[0], top, (side * depth) / 2],
        ],
        'stone',
        'limestone',
        [0, 0, side],
      );
    face(
      o,
      [
        [a[0], a[1], -depth / 2],
        [b[0], b[1], -depth / 2],
        [b[0], b[1], depth / 2],
        [a[0], a[1], depth / 2],
      ],
      'coping',
    );
  }
  slab(
    o,
    [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [width / 2, depth / 2],
      [-width / 2, depth / 2],
    ],
    top,
  );
}
function kingGate(o, d) {
  const g = frame.gates.king;
  for (const t of g.towers)
    polygonTower(o, octagon(t.center, t.radius), t.center, 0, g.frontTop, d, {
      glass: true,
      floor: g.deckHeight,
    });
  polygonTower(o, octagon(g.rear.center, g.rear.radius), g.rear.center, 0, g.rearTop, d, {
    glass: true,
    floor: 12.9,
  });
  const q = local(o, ...g.center, g.heading);
  gateArch(q, 4.9, 2, 8.5, d ? 19.1 : 26.4, 12, d);
  if (!d) return;
  // The upper north wall is retained, but the court side remains open after the 2023 work.
  const a = [-5.3, -5.9],
    b = [5.3, -5.9],
    ia = [-5.3, -4.3],
    ib = [5.3, -4.3];
  // Three real chapel apertures in the upper north wall; no painted window rectangles.
  for (let i = 0; i < 3; i++)
    facet(
      q,
      lerp(a, b, i / 3),
      lerp(a, b, (i + 1) / 3),
      lerp(ia, ib, i / 3),
      lerp(ia, ib, (i + 1) / 3),
      19.1,
      25,
      d,
      false,
      d >= 2 ? [{ at: 0.5, width: 1.25, sill: 20.2, head: 23.9, glass: true }] : [],
    );
  battlements(q, [a, b], 25, d);
  slab(
    o,
    [
      [-2.3, -18.3],
      [21.7, -17.2],
      [24.2, -12],
      [19.1, -6.2],
      [6.2, -5.7],
      [-5.3, -8.7],
    ],
    19.13,
    'wood',
    'wood',
  );
  const lower = octagon(g.rear.center, 4.0);
  slab(o, lower, 14.43, 'wood', 'wood');
  if (d >= 2) {
    // Low-reflection blue-grey lobby is a compact shared-style glazed box, not an opaque tower roof.
    rect(o, 2.5, 19.15, -16.3, 2.6, 3.5, 2.5, 'glass', 'glass');
    rect(o, 2.5, 22.65, -16.3, 3.0, 0.3, 2.9, 'metal', 'metal');
    for (const x of [1.2, 3.8])
      for (const z of [-17.55, -15.05]) rect(o, x, 19.15, z, 0.3, 3.5, 0.3, 'metal', 'metal');
    // Broad staircase blocks survive the model's0.26m closeup error threshold.
    for (let i = 0; i < 10; i++)
      rect(o, -3.5, 14.43 + i * 0.47, -8.0 - i * 0.76, 2.5, 0.5, 0.85, 'wood', 'wood');
    for (const [a, b] of [
      [
        [6.4, -5.8],
        [19, -6.3],
      ],
      [
        [19, -6.3],
        [23.8, -12],
      ],
      [
        [6.4, -5.8],
        [-4.9, -8.6],
      ],
    ]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const rail = local(
        o,
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        Math.atan2(a[1] - b[1], b[0] - a[0]),
      );
      for (const side of [-1, 1])
        face(
          rail,
          [
            [-len / 2, 19.15, 0],
            [len / 2, 19.15, 0],
            [len / 2, 20.15, 0],
            [-len / 2, 20.15, 0],
          ],
          'glass',
          'glass',
          [0, 0, side],
        );
      rect(rail, 0, 20.15, 0, len, 0.28, 0.3, 'wood', 'wood');
    }
  }
  if (d === 3) {
    for (const [cx, cz] of [
      [4, -18.8],
      [18.1, -16.8],
    ]) {
      for (let j = 0; j < 3; j++) {
        const r = 2.8 + j * 0.5;
        const arc = Array.from({ length: 5 }, (_, i) => [
          cx + Math.cos(Math.PI * (0.18 + (i * 0.64) / 4)) * r,
          cz - Math.sin(Math.PI * (0.18 + (i * 0.64) / 4)) * r,
        ]);
        for (let i = 1; i < arc.length; i++) {
          const a = arc[i - 1],
            b = arc[i],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const qq = local(
            o,
            (a[0] + b[0]) / 2,
            (a[1] + b[1]) / 2,
            Math.atan2(a[1] - b[1], b[0] - a[0]),
          );
          rect(qq, 0, 19.15 + j * 0.4, 0, len, 0.4, 0.6, 'wood', 'wood');
        }
      }
    }
  }
}
function queenGate(o, d) {
  const g = frame.gates.queen;
  for (const t of g.towers)
    polygonTower(o, octagon(t.center, t.radius), t.center, 0, g.top, d, {
      banded: true,
      floor: g.sill,
    });
  const q = local(o, ...g.center, g.heading);
  gateArch(q, 4.4, g.sill, g.head, g.top, 8.6, d);
  if (d) {
    // Keep the gate elevated: no invented medieval ramp or road through the basement.
    rect(q, 0, g.sill, -4.7, 4.2, 0.35, 2.8, 'paving');
  }
}
function ranges(o, d) {
  if (!d) return;
  // The great hall and kitchens survive as low foundations, rather than reconstructed roofs.
  for (const [a, b] of [
    [
      [-54.6, 16.9],
      [-45.8, 9.5],
    ],
    [
      [-45.8, 9.5],
      [-10.0, 2.7],
    ],
    [
      [-10.0, 2.7],
      [-6, 13],
    ],
    [
      [-66.1, -8.1],
      [-37.6, -17.9],
    ],
    [
      [-36.2, -19.3],
      [-3.8, -14.8],
    ],
    [
      [-3.8, -14.8],
      [-4.7, -7.2],
    ],
    [
      [23.2, -14.8],
      [37.3, -20.6],
    ],
    [
      [37.3, -20.6],
      [43.4, -14.0],
    ],
  ])
    wall(o, a, b, 2, d >= 2 ? 3.15 : 2.7, 0, { thick: 0.95 });
  if (d >= 2) {
    for (const x of [-28, -15]) {
      polygonTower(o, octagon([x, -11.5], 1.65), [x, -11.5], 2, 2.85, 1, { floor: 2.2 });
    }
    // Small interpretive dais in the upper ward, simplified as the present circular platform.
    slab(
      o,
      Array.from({ length: 12 }, (_, i) => [
        40 + Math.cos((i * Math.PI) / 6) * 4.4,
        0 + Math.sin((i * Math.PI) / 6) * 4.4,
      ]),
      2.08,
    );
  }
  if (d === 3) {
    // Selected eroded Eagle figures are coarse identity geometry, not tiny literal carving.
    for (const [x, z] of [
      [-81.5, -8.2],
      [-81.2, 3.7],
      [-69.8, -1.3],
    ]) {
      rect(o, x, 34.5, z, 0.7, 0.5, 0.6, 'coping');
      face(
        o,
        [
          [x - 0.7, 34.7, z],
          [x, 35, z - 0.35],
          [x + 0.7, 34.7, z],
          [x, 34.55, z + 0.35],
        ],
        'coping',
      );
    }
  }
}
export function buildCaernarfonRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  const outline = frame.geometry.outline.slice(0, -1);
  slab(o, outline, 2);
  if (d) {
    slab(
      o,
      [
        [-66, -5],
        [-36, -15],
        [-8, -10],
        [-5, 4],
        [-48, 13],
      ],
      2.03,
      'grass',
      'foliage',
    );
    slab(
      o,
      [
        [27, -9],
        [64, -13],
        [72, 5],
        [60, 18],
        [27, 11],
      ],
      2.03,
      'grass',
      'foliage',
    );
  }
  for (const t of frame.towers) {
    polygonTower(o, t.outline, t.center, 0, t.top, d, {
      banded: t.banded,
      glass: ['queen', 'chamberlain'].includes(t.name),
      floor: t.top - 0.8,
    });
    for (const [x, z] of t.turrets ?? []) {
      const top =
        t.name === 'eagle' ? 33.6 : t.name === 'queen' ? 29.6 : t.name === 'black' ? 28.4 : 29;
      polygonTower(
        o,
        octagon([x, z], t.name === 'eagle' ? 2.1 : 1.65),
        [x, z],
        t.top - 0.8,
        top,
        d,
        { banded: t.banded, turret: true, floor: top - 0.6 },
      );
    }
  }
  for (const c of frame.curtains)
    wall(o, c.a, c.b, 0, c.top, d, { banded: c.banded, windows: !!c.hall });
  kingGate(o, d);
  queenGate(o, d);
  ranges(o, d);
}
export const buildCaernarfonSkyline = (o) =>
  buildCaernarfonRuntime(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            s,
            r,
            p,
            n,
            uv,
            c.map((v) => v * (s === 'glass' || s === 'foliage' ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const caernarfonStudy = {
  id: 'N0273',
  key: 'caernarfon_castle',
  title: 'Caernarfon Castle',
  category: 'castle',
  wikidataId: 'Q275128',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildCaernarfonRuntime(o),
  brief:
    "Present-day Caernarfon: nine polygonal towers, three Eagle turrets, grey/warm banded river walls, two open wards, raised Queen's Gate and restored timber King's Gate decks.",
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: caernarfonPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Eagle Tower at the west end with three tall polygonal turrets',
      'Long figure-eight plan, polygonal towers and banded south/east limestone walls',
      "Town-facing King's Gate and elevated Queen's Gate; open wards and contemporary timber decks",
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/70264991 exact Q275128',
    mappedPlanMeters: [174.55, 65.474],
    publishedEagleWallThicknessMeters: 5.4864,
    publishedEagleTurrets: 3,
  },
  reconstruction: {
    basis: 'Mapped lobes, Cadw ground plan/inventory and current operator/architect photos',
    scope:
      'Castle exterior, open wards, low ruined ranges and2023 gatehouse surfaces; town walls, quay and bedrock excluded',
  },
  scaleBasis:
    'Mapped174.55×65.474m outline fixes plan. Overall35m maximum, tower/curtain elevations, court2m and gate deck19.1m are inferred from primary photos and architectural ratios; no surveyed height is claimed.',
  refs: [
    'https://cadw.gov.wales/visit/places-to-visit/castell-caernarfon',
    'https://cadw.gov.wales/more-about-castell-caernarfon',
    'https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?id=3814',
    'https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?id=3417&lang=en',
    'https://commons.wikimedia.org/wiki/File:Caernarfon_Castle_plan_labelled.png',
    'https://buttress.net/projects/caernarfon-castle-gatehouse',
    'https://buttress.net/journal/2023/08/30/detail-upper-deck-seating-caernarfon-castle',
    'https://www.openstreetmap.org/way/70264991',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Contains information from Cadw ground plan, Crown copyright, Open Government Licence v1.0; https://www.nationalarchives.gov.uk/doc/open-government-licence/version/1/. Reference photographs/drawings linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. Cadw plan: Crown copyright, Open Government Licence v1.0. Operator and Buttress photographs used as visual references only.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 2,
    notes:
      "Western Eagle Tower, north King's Gate and east Queen's Gate resolve the signed map axis. Relative elevations are inferred; actual terrain and approach fit remain pending.",
    reviewStatus: 'Research frame only; geographic contact pending',
  }),
  geographicNote:
    'Draft map alignment with resolved signed axes; no geographic activation until river bedrock, court datum and both gate approaches are reviewed.',
  limitations: [
    'Original medium-fi current exterior; tower interiors, fine carvings, galleries and stair systems abbreviated.',
    'All elevations and rear tower edges are approximate, not surveyed.',
    'Town walls, external bridge/quay and natural rock omitted.',
    'Actual terrain/gate approach fit, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    "Preserve polygonal tower rhythm, Eagle's three raised turrets and open figure-eight wards across all levels; shared materials carry broad masonry bands without unique textures.",
  mediumFiContext: { scale: '1.15', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-175, 100, 185], lookAt: [0, 12, 0], fov: 43 },
  qaCameras: [
    { name: 'river-curtain', position: [0, 70, 190], lookAt: [0, 12, 8] },
    { name: 'town-gate', position: [12, 65, -195], lookAt: [10, 14, -10] },
    { name: 'eagle-turrets', position: [-150, 60, 30], lookAt: [-62, 19, 0] },
    { name: 'east-gate-and-watch', position: [165, 60, 45], lookAt: [55, 13, 8] },
    { name: 'restored-kings-gate', position: [12, 34, 22], lookAt: [9, 17, -13] },
    { name: 'two-ward-plan', position: [0, 260, 1], lookAt: [0, 3, 0] },
  ],
};
