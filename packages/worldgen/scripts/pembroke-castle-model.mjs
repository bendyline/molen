/** Pembroke: domed circular keep, oblique gatehouse, open ruined halls and a walled Wogan mouth. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/gc/gch/n0295_pembroke_castle/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  control = frame.controls,
  ground = control.platformY;
export const pembrokePalette = {
  wall: '#d2c9b4',
  rock: '#b7b0a0',
  paving: '#b9b3a4',
  timber: '#967a55',
  slate: '#818b96',
  grass: '#8da365',
  water: '#75b0c4',
  stone: '#e1d7bb',
};
export const pembrokeSurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(pembrokePalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const area = (p) =>
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  clean = (p) => (Math.hypot(...p[0].map((v, k) => v - p.at(-1)[k])) < 0.002 ? p.slice(0, -1) : p);
function face(o, p, color = 'wall', slot = 'rubble', target) {
  p = p.map((p) => p.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) p = [...p].reverse();
    break;
  }
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((p) => [p[0], p[2]]),
      colors[color],
    );
  }
}
// Reject triangles outside any convex aperture plane before clipping. This avoids
// multiplying unrelated wall/crown triangles while preserving real intersections.
function cutOpenings(out, holes) {
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const touching = holes.filter(
        (h) =>
          !h.planes.some((v) =>
            p.every((q) => q[0] * v[0] + q[1] * v[1] + q[2] * v[2] + v[3] < -1e-7),
          ),
      );
      openingBuilder(out, touching).addTriangle(slot, ref, p, n, uv, color);
    },
  };
}
function cap(o, rings, y, color = 'wall', slot = 'rubble', up = 1) {
  const q = rings.map(clean),
    p = q.flat(),
    holes = [];
  let j = q[0].length;
  for (const r of q.slice(1)) {
    holes.push(j);
    j += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]),
      color,
      slot,
      [0, up, 0],
    );
}
function prism(o, rings, y0, y1, color = 'wall', slot = 'rubble', bottom = false) {
  rings = rings.map(clean);
  for (let j = 0; j < rings.length; j++) {
    const p = rings[j],
      sign = Math.sign(area(p)) * (j ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      face(
        o,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        color,
        slot,
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      );
    }
  }
  cap(o, rings, y1, color, slot);
  if (bottom) cap(o, rings, y0, color, slot, -1);
}
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (c, r, n, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * 2 * Math.PI) / n;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    });
function wall(o, a, b, base, top, width, holes = [], d = 3, color = 'wall', slot = 'rubble') {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [-dz / l, dx / l],
    ring = [
      [a[0] + (n[0] * width) / 2, a[1] + (n[1] * width) / 2],
      [b[0] + (n[0] * width) / 2, b[1] + (n[1] * width) / 2],
      [b[0] - (n[0] * width) / 2, b[1] - (n[1] * width) / 2],
      [a[0] - (n[0] * width) / 2, a[1] - (n[1] * width) / 2],
    ],
    prepared = holes.map((h) =>
      prepareOpening({ ...h, axis: [dx, dz], depth: width + 0.04 }, base, d),
    );
  prism(cutOpenings(o, prepared), [ring], base, top, color, slot);
  openingReveals(
    { addTriangle: (_s, r, p, n, uv, c) => o.addTriangle(slot, r, p, n, uv, c) },
    ring,
    () => base,
    () => top,
    prepared,
    colors[color],
  );
}
function crenels(o, a, b, y, width, d) {
  if (!d) return;
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, dz / len],
    count = Math.max(1, Math.floor(len / [6, 6, 3.8, 3.1][d])),
    step = len / count;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.25) * step,
      w = step * 0.43;
    wall(
      o,
      [a[0] + u[0] * t, a[1] + u[1] * t],
      [a[0] + u[0] * (t + w), a[1] + u[1] * (t + w)],
      y,
      y + 1.1,
      width,
      [],
      d,
    );
  }
}
function annulus(o, c, r, inner, y0, y1, n, holes = [], _d = 3, color = 'wall') {
  const outer = circle(c, r, n),
    inside = circle(c, inner, n),
    cut = cutOpenings(o, holes);
  prism(cut, [outer, inside], y0, y1, color);
  if (holes.length)
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      openingReveals(
        o,
        [outer[i], outer[next], inside[next], inside[i]],
        () => y0,
        () => y1,
        holes,
        colors[color],
      );
    }
}
function sector(o, c, r, inner, a, b, y0, y1, color = 'wall', slot = 'rubble') {
  const p = [
    [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)],
    [c[0] + r * Math.cos(b), c[1] + r * Math.sin(b)],
    [c[0] + inner * Math.cos(b), c[1] + inner * Math.sin(b)],
    [c[0] + inner * Math.cos(a), c[1] + inner * Math.sin(a)],
  ];
  prism(o, [p], y0, y1, color, slot);
}
function tower(o, t, d, base = ground) {
  const n = [4, 8, 16, 20][d],
    r = t.radius,
    inner = Math.max(0.8, r - (t.wallThickness ?? 1.35)),
    top = base + t.height,
    body = d ? top - 1.2 : top,
    holes = [];
  if (d >= 2) {
    for (const theta of [0.45, 2.3, 4.1, 5.6])
      for (const y of [t.height * 0.3, t.height * 0.66]) {
        const radius = (r + inner) / 2;
        holes.push(
          prepareOpening(
            {
              center: [
                t.center[0] + radius * Math.cos(theta),
                t.center[1] + radius * Math.sin(theta),
              ],
              axis: [-Math.sin(theta), Math.cos(theta)],
              depth: r - inner + 0.6,
              width: 0.32,
              bottom: y,
              height: 1.3,
            },
            base,
            d,
          ),
        );
      }
  }
  annulus(o, t.center, r, inner, base, body, n, holes, d);
  cap(o, [circle(t.center, inner, n)], top - 2.5, 'paving', 'aggregate');
  if (d) {
    const count = [0, 6, 10, 12][d];
    for (let i = 0; i < count; i++)
      sector(
        o,
        t.center,
        r,
        inner,
        (i * 2 * Math.PI) / count,
        ((i + 0.48) * 2 * Math.PI) / count,
        body,
        top,
      );
  }
}
function keep(o, d) {
  const t = control.keep,
    n = [8, 10, 20, 28][d],
    r = t.radius,
    inner = r - t.wallThickness,
    holes = [];
  if (d) {
    const theta = 0.67,
      radial = (r + inner) / 2;
    for (const [bottom, width, height] of [
      [4.2, 1.8, 3.1],
      [0, 1.25, 2.65],
    ])
      holes.push(
        prepareOpening(
          {
            center: [
              t.center[0] + radial * Math.cos(theta),
              t.center[1] + radial * Math.sin(theta),
            ],
            axis: [-Math.sin(theta), Math.cos(theta)],
            depth: r - inner + 1,
            width,
            bottom,
            height,
            spring: height * 0.7,
            shape: 'round',
          },
          ground,
          d,
        ),
      );
    if (d >= 2)
      for (const theta of [0.67, 2.18, 3.71, 5.3])
        for (const bottom of [10.2, 16.7])
          holes.push(
            prepareOpening(
              {
                center: [
                  t.center[0] + radial * Math.cos(theta),
                  t.center[1] + radial * Math.sin(theta),
                ],
                axis: [-Math.sin(theta), Math.cos(theta)],
                depth: r - inner + 0.7,
                width: 0.5,
                bottom,
                height: 1.6,
              },
              ground,
              d,
            ),
          );
  }
  annulus(o, t.center, r, inner, ground, ground + t.crownBase, n, holes, d);
  if (!d) annulus(o, t.center, r, inner, ground + t.crownBase, ground + t.height, n);
  else {
    const count = [0, 8, 14, 18][d];
    for (let i = 0; i < count; i++)
      sector(
        o,
        t.center,
        r,
        inner,
        (i * 2 * Math.PI) / count,
        ((i + 0.5) * 2 * Math.PI) / count,
        ground + t.crownBase,
        ground + t.height,
      );
  }
  const bands = [2, 3, 5, 7][d],
    segments = n;
  for (let j = 0; j < bands; j++) {
    const a = (j * Math.PI) / 2 / bands,
      b = ((j + 1) * Math.PI) / 2 / bands,
      ra = inner * Math.cos(a),
      rb = inner * Math.cos(b),
      ya = ground + t.domeBase + t.domeRise * Math.sin(a),
      yb = ground + t.domeBase + t.domeRise * Math.sin(b);
    for (let i = 0; i < segments; i++) {
      const u = (i * 2 * Math.PI) / segments,
        v = ((i + 1) * 2 * Math.PI) / segments;
      face(
        o,
        [
          [t.center[0] + ra * Math.cos(u), ya, t.center[1] + ra * Math.sin(u)],
          [t.center[0] + ra * Math.cos(v), ya, t.center[1] + ra * Math.sin(v)],
          [t.center[0] + rb * Math.cos(v), yb, t.center[1] + rb * Math.sin(v)],
          [t.center[0] + rb * Math.cos(u), yb, t.center[1] + rb * Math.sin(u)],
        ],
        'stone',
        'carved',
        [Math.cos((u + v) / 2), 1, Math.sin((u + v) / 2)],
      );
    }
  }
  if (d >= 2) {
    for (const y of [7.2, 15.5, 20.5])
      annulus(o, t.center, r + 0.13, r, ground + y, ground + y + 0.2, n);
    const theta = 0.67,
      u = [Math.cos(theta), Math.sin(theta)],
      v = [-u[1], u[0]],
      steps = 14;
    for (let i = 0; i < steps; i++) {
      const a = 13.6 - i * 0.36,
        b = a - 0.36,
        h = ((i + 1) * 4.2) / steps,
        p = [
          [t.center[0] + u[0] * a - v[0], t.center[1] + u[1] * a - v[1]],
          [t.center[0] + u[0] * a + v[0], t.center[1] + u[1] * a + v[1]],
          [t.center[0] + u[0] * b + v[0], t.center[1] + u[1] * b + v[1]],
          [t.center[0] + u[0] * b - v[0], t.center[1] + u[1] * b - v[1]],
        ];
      prism(o, [p], ground, ground + h, 'paving', 'aggregate');
    }
  }
}
function gatehouse(o, d) {
  const t = control.gatehouse,
    holes = d ? [prepareOpening(t.portal, ground, d)] : [],
    out = cutOpenings(o, holes),
    p = d
      ? clean(t.outline)
      : [
          [33, 44],
          [36, 40],
          [49, 35],
          [52, 36],
          [56, 47],
          [45, 51],
          [44, 55],
          [39, 57],
        ];
  prism(out, [p, t.inner], ground, ground + t.height - 1.1);
  if (d) {
    for (const ring of d === 1 ? [t.inner] : [p, t.inner])
      for (let i = 0; i < ring.length; i++)
        crenels(out, ring[i], ring[(i + 1) % ring.length], ground + t.height - 1.1, 0.8, d);
    const sign = Math.sign(area(t.inner));
    const voidPlanes = t.inner.map((a, i) => {
      const b = t.inner[(i + 1) % t.inner.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      return [-dz * sign, 0, dx * sign, (dz * a[0] - dx * a[1]) * sign];
    });
    openingReveals(
      cutOpenings(o, [{ planes: voidPlanes }]),
      p,
      () => ground,
      () => ground + t.height,
      holes,
      colors.wall,
    ); // Clip away reveals within the roofless central void.
  }
  for (const v of t.towers) tower(o, v, d);
  if (d >= 1) {
    const g = t.barbican,
      n = [0, 8, 14, 18][d],
      p = (angle) => [
        g.center[0] + g.radius * (g.axis[0] * Math.cos(angle) + g.normal[0] * Math.sin(angle)),
        g.center[1] + g.radius * (g.axis[1] * Math.cos(angle) + g.normal[1] * Math.sin(angle)),
      ];
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      if (a < 1.18 && b > 0.84) continue;
      wall(o, p(a), p(b), ground - 1.4, ground + g.height, 1.1, [], d);
      crenels(o, p(a), p(b), ground + g.height, 1.1, d);
    }
    const axis = t.portal.axis,
      normal = [-axis[1], axis[0]];
    const leaf = t.portal.center.map((v, k) => v + normal[k] * 3.5);
    wall(
      o,
      leaf.map((v, k) => v - axis[k] * 1.5),
      leaf.map((v, k) => v + axis[k] * 1.5),
      ground + 3.15,
      ground + 4.0,
      0.13,
      [],
      d,
      'timber',
      'wood',
    );
  }
}
function curtains(o, d) {
  for (const s of control.curtains)
    for (let i = 0; i < s.points.length - 1; i++) {
      const a = s.points[i],
        b = s.points[i + 1];
      wall(o, a, b, ground, ground + s.height, 1.65, [], d);
      crenels(o, a, b, ground + s.height, 1.65, d);
    }
  if (d) {
    for (const [x0, z0, x1, z1, h] of [
      [-54, 28, -48, 34, 10],
      [-50, 26, -45, 31, 11],
      [-17, 58, -6, 62, 12.5],
      [12, 57, 15, 61, 13.8],
    ]) {
      const out = rect(x0, z0, x1, z1),
        inn = rect(x0 + 0.8, z0 + 0.8, x1 - 0.8, z1 - 0.8);
      prism(o, [out, inn], ground, ground + h);
    }
  }
}
function hall(o, h, d) {
  const [a, b] = h.north,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, dz / len],
    n = [-u[1], u[0]],
    backA = a.map((v, k) => v + n[k] * h.depth),
    backB = b.map((v, k) => v + n[k] * h.depth),
    ring = [a, b, backB, backA];
  for (let i = 0; i < 4; i++) {
    const A = ring[i],
      B = ring[(i + 1) % 4],
      holes = [];
    if (d) {
      const count =
        d === 1
          ? i === 0
            ? Math.min(3, h.windows)
            : 1
          : i === 0
            ? h.windows
            : i === 2
              ? Math.max(1, h.windows - 1)
              : 1;
      for (let j = 0; j < count; j++)
        holes.push({
          center: A.map((v, k) => v + ((B[k] - v) * (j + 1)) / (count + 1)),
          width: i % 2 === 0 ? 1.55 : 1.2,
          bottom: i === 0 ? 5.2 : 3.9,
          height: 4.1,
          spring: 2.8,
          shape: 'pointed',
        });
    }
    wall(o, A, B, h.baseY, h.baseY + h.height, h.thickness, holes, d);
    if (d >= 2 || (d === 1 && i === 0)) crenels(o, A, B, h.baseY + h.height, h.thickness, d);
  }
  cap(o, [ring], h.baseY + 0.08, 'paving', 'aggregate');
  if (d >= 2)
    for (const towerControl of [
      { ...h, point: a },
      { ...h, point: b },
    ])
      tower(
        o,
        {
          center: towerControl.point,
          radius: 1.25,
          height: towerControl.height + 1.2,
          wallThickness: 0.7,
        },
        d,
        towerControl.baseY,
      );
}
function halls(o, d) {
  for (const h of control.halls) hall(o, h, d);
  hall(o, control.westernHall, d);
  const w = frame.geometry.rawFeatures.find((f) => f.id === 23086731);
  if (w) {
    const p = clean(w.points),
      lo = [0, 1].map((k) => Math.min(...p.map((p) => p[k]))),
      hi = [0, 1].map((k) => Math.max(...p.map((p) => p[k])));
    prism(
      o,
      [
        rect(...[lo[0], lo[1], hi[0], hi[1]]),
        rect(lo[0] + 0.9, lo[1] + 0.9, hi[0] - 0.9, hi[1] - 0.9),
      ],
      ground,
      ground + 12.8,
    );
  }
  tower(o, control.dungeon, d);
  tower(o, control.dungeon.latrine, d);
  wall(o, [-6, -32], [-0.8, -24.8], ground, ground + 12.6, 2.2, [], d);
  if (d)
    for (const v of control.lowWalls) {
      const f = frame.geometry.rawFeatures.find((f) => f.id === v.id);
      prism(o, [f.points], ground, ground + v.height);
    }
}
function modernAndAnne(o, d) {
  const s = control.stAnne;
  prism(o, [s.points], ground, ground + s.height);
  cap(o, [s.points], ground + s.roofHeight, 'slate', 'slate');
  for (const center of [
    [35.6, -30.2],
    [45.4, -34.3],
  ])
    tower(o, { center, radius: 1.55, height: 7.2, wallThickness: 0.7 }, d);
  const cafe = control.cafe;
  prism(o, [cafe.outline], ground, ground + cafe.height);
  cap(o, [cafe.outline], ground + cafe.roofHeight, 'slate', 'slate');
  if (d >= 2) {
    const p = clean(cafe.outline);
    wall(o, p[0], p[1], ground + 0.65, ground + 2.75, 0.07, [], d, 'water', 'glass');
  }
  if (d) {
    const m = control.greatMap,
      [x, z] = m.center,
      p = rect(x - m.width / 2, z - m.depth / 2, x + m.width / 2, z + m.depth / 2);
    cap(o, [p], ground + 0.04, 'paving', 'aggregate');
    cap(
      o,
      [rect(x - m.width / 2 + 1, z - m.depth / 2 + 1, x + m.width / 2 - 1, z + m.depth / 2 - 1)],
      ground + 0.06,
      'water',
      'glass',
    );
    const island = [
      [-3, -12],
      [0, -13],
      [2, -9],
      [1, -5],
      [4, -3],
      [3, 0],
      [6, 3],
      [5, 7],
      [2, 10],
      [-2, 11],
      [-4, 8],
      [-3, 6],
      [-5, 4],
      [-4, 1],
      [-1, -2],
      [-2, -6],
    ].map((p) => [p[0] + x, p[1] + z]);
    cap(o, [island], ground + 0.075, 'grass', 'foliage');
    cap(
      o,
      [
        [
          [-8, 0],
          [-5, -2],
          [-4, 1],
          [-5, 5],
          [-8, 6],
          [-10, 3],
        ].map((p) => [p[0] + x, p[1] + z]),
      ],
      ground + 0.075,
      'grass',
      'foliage',
    );
  }
}
function groundAndWogan(o, d) {
  const t = control.wogan,
    front = prepareOpening(
      {
        center: t.center,
        axis: t.axis,
        depth: 38,
        width: t.width,
        height: t.height,
        bottom: t.floorY,
      },
      0,
      d,
    ),
    cut = cutOpenings(o, [front]),
    p = control.outline,
    sign = Math.sign(area(p));
  cap(o, [p], ground, 'grass', 'foliage');
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      A = a.map((v) => v * 1.045),
      B = b.map((v) => v * 1.045);
    face(
      cut,
      [
        [A[0], 0.4, A[1]],
        [B[0], 0.4, B[1]],
        [b[0], ground, b[1]],
        [a[0], ground, a[1]],
      ],
      'rock',
      'carved',
      n,
    );
  }
  if (d) {
    const a = t.center.map((v, k) => v - (t.axis[k] * t.frontWidth) / 2),
      b = t.center.map((v, k) => v + (t.axis[k] * t.frontWidth) / 2),
      holes = [
        { center: t.center, width: 3.1, bottom: 0, height: 2.8, spring: 1.9, shape: 'pointed' },
        ...[-5.5, 5.5].map((u) => ({
          center: t.center.map((v, k) => v + t.axis[k] * u),
          width: 1.15,
          bottom: 2.8,
          height: 2.0,
          spring: 1.25,
          shape: 'pointed',
        })),
      ];
    wall(o, a, b, t.floorY, t.floorY + t.frontWallHeight, 1.25, holes, d);
    const back = t.center.map((v, k) => v - t.normal[k] * t.depth),
      rearA = back.map((v, k) => v - (t.axis[k] * t.width) / 2),
      rearB = back.map((v, k) => v + (t.axis[k] * t.width) / 2);
    face(
      o,
      [
        [a[0], t.floorY, a[1]],
        [b[0], t.floorY, b[1]],
        [rearB[0], t.floorY, rearB[1]],
        [rearA[0], t.floorY, rearA[1]],
      ],
      'rock',
      'carved',
      [0, 1, 0],
    );
    for (const [A, B, aim] of [
      [a, rearA, t.axis],
      [rearB, b, t.axis.map((v) => -v)],
      [rearA, rearB, t.normal],
    ])
      face(
        o,
        [
          [A[0], t.floorY, A[1]],
          [B[0], t.floorY, B[1]],
          [B[0], t.floorY + t.height, B[1]],
          [A[0], t.floorY + t.height, A[1]],
        ],
        'rock',
        'carved',
        [aim[0], 0, aim[1]],
      );
    face(
      o,
      [
        [a[0], t.floorY + t.height, a[1]],
        [rearA[0], t.floorY + t.height, rearA[1]],
        [rearB[0], t.floorY + t.height, rearB[1]],
        [b[0], t.floorY + t.height, b[1]],
      ],
      'rock',
      'carved',
      [0, -1, 0],
    );
  }
  if (d) {
    for (const [a, b, width] of [
      [[47, 56], [43, 39], 3.2],
      [[43, 39], [1, -15], 3],
      [[-25, -18], [-43, 10], 2],
    ])
      wall(o, a, b, ground + 0.012, ground + 0.03, width, [], d, 'paving', 'aggregate');
  }
}
export const pembrokeParts = { groundAndWogan, keep, gatehouse, curtains, halls, modernAndAnne };
function build(o, d) {
  for (const part of Object.values(pembrokeParts)) part(o, d);
}
export const buildPembrokeRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildPembrokeSkyline = (o) =>
  build(
    {
      addTriangle: (s, r, p, n, uv, c) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          c.map((v, k) => v * (means[s]?.[k] ?? 1)),
        ),
    },
    0,
  );
export const pembrokeStudy = {
  id: 'N0295',
  key: 'pembroke_castle',
  title: 'Pembroke Castle',
  category: 'castle',
  wikidataId: 'Q1422235',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildPembrokeRuntime(o),
  brief:
    '25m circular limestone keep with domed crown, asymmetric oblique gatehouse and low curved barbican, hollow perimeter towers and irregular curtain ring, roofless Great/Norman/western halls, mostly lost inner-gate footings, StAnne projection, original cliff/promontory with walled Wogan mouth and schematic visitor map.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: pembrokePalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Tall circular keep and recessed domed crown',
      'Offset gatehouse and oblique passage with curved low barbican',
      'Open irregular ward and roofless northern hall cluster over a steep promontory',
    ],
  },
  sourceFacts: {
    keepHeightMeters: 25,
    keepDiameterMeters: 16,
    wogan: refs.publishedDimensions.woganMeters,
    surveyedVerticalDatum: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Own attributed nearby mapped wall/tower traces and oblique passage; published keep25×16m and cave23×18×5m. Exact map identity is a node, not a surveyed site polygon. Remaining dimensions and vertical section are estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: [
    'map-frame.json',
    'relief-grid.json',
    'surface-means.json',
    'reference-metadata.json',
  ],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own map traces © OpenStreetMap contributors,ODbL-1.0. Reference photographs/plans/3D navigation imagery not redistributed.',
  sourceNotice:
    'Five existing256-square shared graphs, linear palette and central metric repeats. No new/embedded textures, copied map artwork or downloaded meshes. Preserve unresolved cave-section/DEM discrepancy.',
  dataAttribution:
    '© OpenStreetMap contributors; Cadw; Pembroke Castle Trust; RCAHMW/Toby Driver; Dinnis et al2023/British Cave Research Association; Mapzen/NASA/USGS terrain data.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: ground,
    reviewStatus:
      'Inactive draft; node/component association, provisional cliff/cave section, actual terrain blending and current-state fit pending',
  }),
  geographicNote:
    'Native+X east/+Z south encodes the actual mapped oblique passage with heading0. PlatformY15 is a provisional attachment plane; cliff/Wogan extend below. Raw coarseDEM is retained separately. Real vertical registration/cutout and site association require review.',
  limitations: refs.limitations,
  importReason:
    'Preserve open tower/hall crowns, domed keep and physically clear oblique gate aperture with four independently authored detail levels.',
  mediumFiContext: { scale: '3.0', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: [175, 140, 185], lookAt: [0, 22, 0], fov: 43 },
  qaCameras: [
    { name: 'domed-great-keep', position: [-8, 53, 0], lookAt: [-26, 32, -28] },
    { name: 'oblique-great-gate', position: [62, 20.5, 89], lookAt: [44, 20, 46] },
    { name: 'open-wards-plan', position: [0, 220, 1], lookAt: [0, 15, 0] },
    { name: 'northern-roofless-halls', position: [12, 49, -100], lookAt: [6, 26, -44] },
    { name: 'wogan-north-mouth', position: [23, 12, -82], lookAt: [7, 10, -52.5] },
    { name: 'south-wall-towers', position: [-24, 42, 125], lookAt: [4, 25, 51] },
    { name: 'western-hall-and-footings', position: [-99, 42, -25], lookAt: [-43, 23, -38] },
  ],
};
