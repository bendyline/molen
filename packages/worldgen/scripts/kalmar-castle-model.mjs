/** Kalmar: open Renaissance courtyard, distinct copper helmets and mapped outer defenses. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/u6/u65/n0296_kalmar_castle/',
    import.meta.url,
  ),
  read = (name) => JSON.parse(readFileSync(new URL(name, root))),
  frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  control = frame.controls,
  ground = control.platformY,
  c = Math.cos(control.planAngleRadians),
  s = Math.sin(control.planAngleRadians);
export const kalmarPlanPoint = (x, z) => [x * c + z * s, -x * s + z * c];
export const kalmarPalette = {
  stone: '#d4c6aa',
  plaster: '#eee4cb',
  trim: '#e8e3d4',
  patina: '#8bc0b3',
  roof: '#65717a',
  paving: '#b5b0a4',
  glass: '#4d6178',
  door: '#70604c',
  grass: '#8ca56a',
};
export const kalmarSurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.68, metallic: 0.15 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(kalmarPalette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const clean = (p) =>
    Math.hypot(...p[0].map((v, k) => v - p.at(-1)[k])) < 0.002 ? p.slice(0, -1) : p,
  area = (p) =>
    p.reduce((sum, a, i) => {
      const b = p[(i + 1) % p.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0),
  rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (center, radius, n, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
    });
function nativeBuilder(out) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      const rot = ([x, y, z]) => {
        const q = kalmarPlanPoint(x, z);
        return [q[0], y, q[1]].map(Math.fround);
      };
      const points = p.map(rot),
        normal = normalFor(...points);
      if (Math.hypot(...normal) < 0.5) return;
      out.addTriangle(slot, ref, points, normal, uv, color);
    },
  };
}
function face(o, p, color = 'stone', slot = 'rubble', target) {
  p = p.map((p) => p.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((v, x, k) => v + x * target[k], 0) < 0) p = [...p].reverse();
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
function triangulate(rings) {
  const q = rings.map(clean),
    p = q.flat(),
    holes = [];
  let j = q[0].length;
  for (const ring of q.slice(1)) {
    holes.push(j);
    j += ring.length;
  }
  const ix = earcut(p.flat(), holes, 2),
    triangles = [];
  for (let i = 0; i < ix.length; i += 3) triangles.push(ix.slice(i, i + 3).map((k) => p[k]));
  return triangles;
}
function cap(o, rings, y, color = 'stone', slot = 'rubble') {
  for (const t of triangulate(rings))
    face(
      o,
      t.map((p) => [p[0], y, p[1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function prism(
  o,
  rings,
  y0,
  y1,
  color = 'stone',
  slot = 'rubble',
  innerColor = color,
  innerSlot = slot,
  topCap = true,
) {
  rings = rings.map(clean);
  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j],
      sign = Math.sign(area(ring)) * (j ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      face(
        o,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        j ? innerColor : color,
        j ? innerSlot : slot,
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      );
    }
  }
  if (topCap) cap(o, rings, y1, color, slot);
}
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
function reveals(o, rings, y0, y1, holes, color = 'stone', slot = 'rubble') {
  for (const h of holes) {
    const target = cutOpenings(
        o,
        holes.filter((other) => other !== h),
      ),
      adapter = { addTriangle: (_s, r, p, n, uv, c) => target.addTriangle(slot, r, p, n, uv, c) };
    for (const t of triangulate(rings))
      openingReveals(
        adapter,
        t,
        () => y0,
        () => y1,
        [h],
        colors[color],
      );
  }
}
function wall(o, a, b, base, top, width, color = 'stone', slot = 'rubble') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  const ring = [
    [a[0] + (n[0] * width) / 2, a[1] + (n[1] * width) / 2],
    [b[0] + (n[0] * width) / 2, b[1] + (n[1] * width) / 2],
    [b[0] - (n[0] * width) / 2, b[1] - (n[1] * width) / 2],
    [a[0] - (n[0] * width) / 2, a[1] - (n[1] * width) / 2],
  ];
  prism(o, [ring], base, top, color, slot);
  return ring;
}
function pane(o, center, axis, normal, y, width, height, d, arch = false, color = 'glass') {
  const n = arch ? (d < 2 ? 3 : 6) : 1,
    at = (u, h, offset = 0.022) => [
      center[0] + axis[0] * u + normal[0] * offset,
      y + h,
      center[1] + axis[1] * u + normal[1] * offset,
    ],
    ring = [
      [-width / 2, 0],
      [width / 2, 0],
    ];
  if (arch)
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / n;
      ring.push([(Math.cos(a) * width) / 2, height - width / 2 + (Math.sin(a) * width) / 2]);
    }
  else ring.push([width / 2, height], [-width / 2, height]);
  face(
    o,
    ring.map((p) => at(...p)),
    color,
    'glass',
    [normal[0], 0, normal[1]],
  );
  if (d >= 3 && color === 'glass') {
    const w = 0.12;
    face(
      o,
      [at(-w / 2, 0, 0.04), at(w / 2, 0, 0.04), at(w / 2, height, 0.04), at(-w / 2, height, 0.04)],
      'trim',
      'carved',
      [normal[0], 0, normal[1]],
    );
    face(
      o,
      [
        at(-width / 2, height * 0.48, 0.04),
        at(width / 2, height * 0.48, 0.04),
        at(width / 2, height * 0.48 + w, 0.04),
        at(-width / 2, height * 0.48 + w, 0.04),
      ],
      'trim',
      'carved',
      [normal[0], 0, normal[1]],
    );
  }
}
function facadeWindows(o, ring, y0, d, inside = false, tower = false, top = Infinity) {
  if (!d) return;
  const p = clean(ring),
    sign = Math.sign(area(p)) * (inside ? -1 : 1);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < (tower ? 1.5 : 8)) continue;
    const axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      normal = [sign * axis[1], -sign * axis[0]],
      count = Math.max(1, Math.floor(len / (d === 1 ? 9 : 5.7))),
      floors = d === 1 ? [7.8, 13.5] : tower ? [5, 10.5, 16] : [3.3, 8.9, 14.1];
    for (let j = 0; j < count; j++)
      for (const [fi, y] of floors.entries()) {
        if (y0 + y + (tower ? 1.8 : 2.05) > top) continue;
        const t = (len * (j + 0.5)) / count,
          pos = [a[0] + axis[0] * t, a[1] + axis[1] * t];
        pane(
          o,
          pos,
          axis,
          normal,
          y0 + y,
          tower ? 0.9 : 1.25,
          tower ? 1.8 : 2.05,
          d,
          fi === floors.length - 1 && !inside,
        );
      }
  }
}
function compound(o, d) {
  const portal = prepareOpening(control.kure.portal, ground, d),
    holes = [portal],
    rings = [
      d === 0
        ? control.outline.filter(
            (_, i) =>
              ![
                1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 32, 33, 34, 35, 36,
                37, 47, 48, 49, 50, 51, 52, 53,
              ].includes(i),
          )
        : control.outline,
      control.court,
    ],
    top = ground + control.eaveHeight;
  // The palace roof closes the wings. A flat wall cap could conceal a roof gap.
  prism(cutOpenings(o, holes), rings, ground, top, 'stone', 'rubble', 'plaster', 'plaster', false);
  if (d) reveals(o, rings, ground, top, holes);
  cap(o, [control.court], ground + 0.025, 'paving', 'aggregate');
  facadeWindows(cutOpenings(o, holes), control.outline, ground, d);
  facadeWindows(cutOpenings(o, holes), control.court, ground, d, true);
}
function roofs(o) {
  const outer = control.roofOuter,
    inner = control.roofInner,
    eave = ground + control.eaveHeight,
    ridge = eave + control.roofRise,
    mid = outer.map((p, i) => p.map((v, k) => (v + inner[i][k]) / 2));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      m = mid[i],
      n = mid[j],
      wing = control.roofWings[i];
    // Each slope spans its actual mapped eave polyline, including irregular walls.
    // Paired four-corner envelopes left wide parts of the eastern/northern wings bare.
    for (const path of [wing.outer, wing.inner]) {
      const panel = [...path, n, m];
      for (const t of triangulate([panel]))
        face(
          o,
          t.map((p) => [p[0], p === m || p === n ? ridge : eave, p[1]]),
          'roof',
          'metal',
          [0, 1, 0],
        );
    }
  }
}
function loft(o, rings, color = 'patina', slot = 'patina') {
  for (let j = 0; j < rings.length - 1; j++) {
    const a = rings[j],
      b = rings[j + 1],
      n = a.points.length;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = a.points[i],
        q = a.points[k],
        r = b.points[k],
        t = b.points[i];
      face(
        o,
        [
          [p[0], a.y, p[1]],
          [q[0], a.y, q[1]],
          [r[0], b.y, r[1]],
          [t[0], b.y, t[1]],
        ],
        color,
        slot,
        // Outward means radial, including downward-facing flared undersides.
        // An upward bias reverses those faces and makes roof sections disappear.
        [(p[0] + q[0]) / 2 - a.center[0], 0, (p[1] + q[1]) / 2 - a.center[1]],
      );
    }
  }
  cap(o, [rings.at(-1).points], rings.at(-1).y, color, slot);
}
function roundLoft(o, center, radius, base, profile, n) {
  loft(
    o,
    profile.map(([y, r]) => ({
      y: base + y,
      center,
      points: circle(center, radius * r, n, Math.PI / n),
    })),
  );
}
function lantern(o, center, y0, y1, radius, n, d) {
  if (d === 1) n = 4;
  if (d === 0) {
    roundLoft(
      o,
      center,
      radius,
      y0,
      [
        [0, 1],
        [y1 - y0, 1],
      ],
      n,
    );
    return;
  }
  const p = circle(center, radius, n, Math.PI / n),
    thickness = d === 1 ? 0.5 : 0.32;
  for (const q of p)
    prism(
      o,
      [
        rect(
          q[0] - thickness / 2,
          q[1] - thickness / 2,
          q[0] + thickness / 2,
          q[1] + thickness / 2,
        ),
      ],
      y0,
      y1,
      'patina',
      'patina',
    );
  roundLoft(
    o,
    center,
    radius,
    y0,
    [
      [0, 1.13],
      [0.3, 1.13],
    ],
    n,
  );
  roundLoft(
    o,
    center,
    radius,
    y1 - 0.3,
    [
      [0, 1.13],
      [0.3, 1.13],
    ],
    n,
  );
}
function towers(o, d) {
  for (const t of control.towers) {
    const n = d === 0 ? 6 : d === 1 ? 8 : t.kind === 'dodecagonal-lantern' ? 12 : d === 2 ? 16 : 24,
      bodyTop = ground + t.height,
      body = circle(t.center, t.radius, n, Math.PI / n),
      h = t.roofRise;
    prism(o, [body], ground, bodyTop);
    if (d >= 2) facadeWindows(o, body, ground, d, false, true);
    const low = t.kind === 'low-bulb',
      profile =
        d === 0
          ? [
              [0, 1.12],
              [h * 0.35, 0.73],
              [h * (low ? 0.58 : 0.5), 0.31],
            ]
          : low
            ? [
                [0, 1.12],
                [0.4, 1.15],
                [h * 0.18, 0.88],
                [h * 0.45, 0.58],
                [h * 0.51, 0.29],
                [h * 0.58, 0.31],
              ]
            : [
                [0, 1.12],
                [0.45, 1.16],
                [h * 0.16, 0.89],
                [h * 0.4, 0.62],
                [h * 0.46, 0.31],
                [h * 0.5, 0.34],
              ];
    roundLoft(
      o,
      t.center,
      t.radius,
      bodyTop,
      d === 1 ? profile.filter((_, i) => ![1, 4].includes(i)) : profile,
      n,
    );
    const ly = bodyTop + h * (low ? 0.58 : 0.5),
      lr = t.radius * (low ? 0.2 : 0.26),
      lh = low ? h * 0.06 : h * 0.15;
    if (!low) lantern(o, t.center, ly, ly + lh, lr, d === 0 ? 6 : 8, d);
    roundLoft(
      o,
      t.center,
      lr,
      ly + lh,
      d === 0
        ? [
            [0, 1.4],
            [h * 0.16, 0.6],
            [h * 0.35, 0.035],
          ]
        : d === 1
          ? [
              [0, 1.4],
              [h * 0.11, 0.6],
              [h * 0.19, 0.95],
              [h * 0.35, 0.035],
            ]
          : [
              [0, 1.4],
              [h * 0.055, 1.25],
              [h * 0.11, 0.6],
              [h * 0.16, 0.5],
              [h * 0.19, 0.95],
              [h * 0.24, 0.42],
              [h * 0.32, 0.2],
              [h * 0.35, 0.035],
            ],
      d === 0 ? 6 : 8,
    );
  }
}
function kure(o, d) {
  const p = clean(control.kure.outline),
    top = ground + control.kure.height,
    center = [0, 1].map((k) => p.reduce((v, q) => v + q[k], 0) / p.length),
    ring = [p[0], p[2], p[3], p[5]],
    profile =
      d === 0
        ? [
            [0, 1.07],
            [5.5, 0.73],
            [8.6, 0.48],
          ]
        : [
            [0, 1.07],
            [0.5, 1.12],
            [1.8, 0.98],
            [5.5, 0.73],
            [7.7, 0.44],
            [8.6, 0.48],
          ];
  prism(o, [p], ground + control.eaveHeight, top);
  if (d >= 2) facadeWindows(o, p, ground + 10, d, false, true, top);
  loft(
    o,
    profile.map(([y, r]) => ({
      y: top + y,
      center,
      points: ring.map((p) => p.map((v, k) => center[k] + (v - center[k]) * r)),
    })),
  );
  const radius = 2.9,
    ly = top + 8.6,
    lh = 4.2;
  lantern(o, center, ly, ly + lh, radius, d === 0 ? 4 : 8, d);
  roundLoft(
    o,
    center,
    radius,
    ly + lh,
    d === 0
      ? [
          [0, 1.3],
          [2.1, 0.65],
          [5, 0.04],
        ]
      : [
          [0, 1.3],
          [0.8, 1.35],
          [2.1, 0.65],
          [2.6, 0.36],
          [3.1, 0.65],
          [4.3, 0.28],
          [5, 0.04],
        ],
    d === 0 ? 4 : 8,
  );
  if (d >= 2)
    for (const [a, b] of ring.map((p, i) => [p, ring[(i + 1) % ring.length]])) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = 0; i < 3; i++) {
        const pos = [
            a[0] + ((b[0] - a[0]) * (i + 0.5)) / 3,
            a[1] + ((b[1] - a[1]) * (i + 0.5)) / 3,
          ],
          dx = (b[0] - a[0]) / len,
          dz = (b[1] - a[1]) / len;
        wall(
          o,
          [pos[0] - 0.3 * dx, pos[1] - 0.3 * dz],
          [pos[0] + 0.3 * dx, pos[1] + 0.3 * dz],
          top - 1.25,
          top + 0.15,
          0.48,
          'stone',
          'carved',
        );
      }
    }
}
function gables(o, d) {
  for (const g of control.smallGables) {
    const x = g.center[0],
      z = g.center[1],
      w = g.width,
      h = ground + g.height,
      depth = g.depth;
    const ring =
      g.axis === 'x'
        ? rect(x - depth / 2, z - w / 2, x + depth / 2, z + w / 2)
        : rect(x - w / 2, z - depth / 2, x + w / 2, z + depth / 2);
    prism(o, [ring], ground, h);
    const steps = d === 0 ? 1 : d === 1 ? 2 : 5,
      half = w / 2;
    for (const sign of [-1, 1])
      for (let i = 0; i < steps; i++) {
        const u0 = (half * i) / steps,
          u1 = (half * (i + 1)) / steps,
          peak = g.rise * (1 - i / steps),
          y0 = h,
          y1 = h + peak,
          lo = Math.min(sign * u0, sign * u1),
          hi = Math.max(sign * u0, sign * u1);
        if (g.axis === 'x')
          prism(
            o,
            [rect(x + depth / 2 - 0.4, z + lo, x + depth / 2 + 0.1, z + hi)],
            y0,
            y1,
            'trim',
            'carved',
          );
        else
          prism(
            o,
            [rect(x + lo, z - depth / 2 - 0.1, x + hi, z - depth / 2 + 0.4)],
            y0,
            y1,
            'trim',
            'carved',
          );
      }
    if (g.axis === 'x') {
      face(
        o,
        [
          [x - depth / 2, h, z - half],
          [x - depth / 2, h + g.rise, z],
          [x + depth / 2, h + g.rise, z],
          [x + depth / 2, h, z - half],
        ],
        'roof',
        'metal',
        [0, 1, 0],
      );
      face(
        o,
        [
          [x - depth / 2, h + g.rise, z],
          [x - depth / 2, h, z + half],
          [x + depth / 2, h, z + half],
          [x + depth / 2, h + g.rise, z],
        ],
        'roof',
        'metal',
        [0, 1, 0],
      );
    } else {
      face(
        o,
        [
          [x - half, h, z - depth / 2],
          [x, h + g.rise, z - depth / 2],
          [x, h + g.rise, z + depth / 2],
          [x - half, h, z + depth / 2],
        ],
        'roof',
        'metal',
        [0, 1, 0],
      );
      face(
        o,
        [
          [x, h + g.rise, z - depth / 2],
          [x + half, h, z - depth / 2],
          [x + half, h, z + depth / 2],
          [x, h + g.rise, z + depth / 2],
        ],
        'roof',
        'metal',
        [0, 1, 0],
      );
    }
    if (d) facadeWindows(o, ring, ground, d);
  }
}
function well(o, d) {
  if (!d) return;
  const p = clean(control.well.outline),
    center = [0, 1].map((k) => p.reduce((v, q) => v + q[k], 0) / p.length),
    n = d === 1 ? 6 : 12;
  prism(o, [circle(center, 1.6, n)], ground + 0.025, ground + 0.42, 'trim', 'carved');
  prism(
    o,
    [circle(center, 0.93, n), circle(center, 0.67, n)],
    ground + 0.42,
    ground + 1.4,
    'trim',
    'carved',
  );
  for (const q of circle(center, 1.24, 4, Math.PI / 4))
    prism(o, [circle(q, d === 1 ? 0.22 : 0.16, 6)], ground + 0.42, ground + 3.65, 'trim', 'carved');
  prism(o, [circle(center, 1.75, 4, Math.PI / 4)], ground + 3.65, ground + 4.15, 'trim', 'carved');
  roundLoft(
    o,
    center,
    1.68,
    ground + 4.15,
    [
      [0, 1],
      [0.45, 0.6],
      [0.85, 0.025],
    ],
    d === 1 ? 4 : 8,
  );
}
function courtyardDetails(o, d) {
  well(o, d);
  if (d < 2) return;
  const ring = clean(control.court),
    sign = -Math.sign(area(ring));
  for (const i of [2, 5, 8]) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      normal = [sign * axis[1], -sign * axis[0]],
      pos = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      w = 2.6,
      top = ground + 4.8;
    pane(o, pos, axis, normal, ground + 0.2, w, 4.3, d, true, 'door');
    for (const sign of [-1, 1]) {
      const q = [
        pos[0] + axis[0] * sign * (w / 2 + 0.36),
        pos[1] + axis[1] * sign * (w / 2 + 0.36),
      ];
      wall(
        o,
        [q[0] - axis[0] * 0.24, q[1] - axis[1] * 0.24],
        [q[0] + axis[0] * 0.24, q[1] + axis[1] * 0.24],
        ground + 0.2,
        top,
        0.45,
        'trim',
        'carved',
      );
    }
    wall(
      o,
      [pos[0] - axis[0] * 2.1, pos[1] - axis[1] * 2.1],
      [pos[0] + axis[0] * 2.1, pos[1] + axis[1] * 2.1],
      top,
      top + 0.65,
      0.5,
      'trim',
      'carved',
    );
  }
  for (const i of [0, 1, 2, 3]) {
    const a = control.roofOuter[i],
      b = control.roofOuter[(i + 1) % 4],
      aa = control.roofInner[i],
      bb = control.roofInner[(i + 1) % 4];
    for (const t of [0.27, 0.58, 0.83]) {
      const x = (a[0] + (b[0] - a[0]) * t + aa[0] + (bb[0] - aa[0]) * t) / 2,
        z = (a[1] + (b[1] - a[1]) * t + aa[1] + (bb[1] - aa[1]) * t) / 2;
      prism(
        o,
        [rect(x - 0.42, z - 0.4, x + 0.42, z + 0.4)],
        ground + control.eaveHeight + control.roofRise - 0.45,
        ground + control.eaveHeight + control.roofRise + 2.3,
        'stone',
        'carved',
      );
    }
  }
}
function accessHoles(d) {
  const q =
      d === 1
        ? control.gateRoute.filter(
            (_, i) => i === 0 || i === 4 || i === control.gateRoute.length - 1,
          )
        : control.gateRoute,
    holes = [];
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i],
      b = q[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    holes.push(
      prepareOpening(
        {
          ...control.outerGate,
          width: d === 1 ? 5 : control.outerGate.width,
          center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
          depth: len + 0.6,
        },
        ground,
        d,
      ),
    );
  }
  return holes;
}
function defenses(o, d) {
  if (d === 0) {
    const outer = control.outerDefence.filter((_, i) => ![1, 2, 3].includes(i)),
      inner = [
        [-50, -44],
        [41, -44],
        [51, 31],
        [30, 50],
        [-25, 72],
        [-39, 17],
      ];
    prism(o, [control.coast], 0.3, 2.5, 'stone', 'rubble', 'stone', 'rubble', false);
    cap(o, [control.coast], 2.52, 'grass', 'foliage');
    prism(o, [outer, inner], 2.5, 7.7, 'stone', 'rubble', 'stone', 'rubble', false);
    cap(o, [outer, inner], 7.72, 'grass', 'foliage');
    cap(o, [inner, control.outline], ground + 0.02, 'grass', 'foliage');
    for (const t of control.bastions) {
      const p = clean(t.outline),
        center = [0, 1].map((k) => p.reduce((v, q) => v + q[k], 0) / p.length),
        radius =
          p.reduce((v, q) => v + Math.hypot(q[0] - center[0], q[1] - center[1]), 0) / p.length,
        ring = circle(center, radius, 6);
      prism(o, [ring], t.baseY, t.baseY + t.height);
      cap(o, [ring], t.baseY + t.height + 0.015, 'roof', 'metal');
    }
    return;
  }
  const coast = control.coast,
    outer = control.outerDefence,
    inner = control.innerDefence,
    holes = d ? accessHoles(d) : [],
    cut = cutOpenings(o, holes);
  prism(o, [coast], 0.3, 2.5, 'stone', 'rubble', 'stone', 'rubble', false);
  cap(o, [coast], 2.52, 'grass', 'foliage');
  prism(cut, [outer, inner], 2.5, 7.7, 'stone', 'rubble', 'stone', 'rubble', false);
  cap(cut, [outer, inner], 7.72, 'grass', 'foliage');
  if (d) reveals(o, [outer, inner], 2.5, 7.7, holes);
  prism(cut, [inner, control.outline], 2.5, ground, 'stone', 'rubble', 'stone', 'rubble', false);
  cap(cut, [inner, control.outline], ground + 0.02, 'grass', 'foliage');
  const p = clean(outer);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      top = 9.2,
      ring = wall(cut, a, b, 7.7, top, 1.1);
    reveals(o, [ring], 7.7, top, holes);
  }
  for (const t of control.bastions) {
    const ring = clean(t.outline),
      top = t.baseY + t.height;
    prism(o, [ring], t.baseY, top);
    cap(o, [ring], top + 0.015, 'roof', 'metal');
    if (d >= 2) facadeWindows(o, ring, t.baseY, d, false, true, top);
  }
}
function bridge(o, d) {
  const p =
      d === 1 ? [control.bridge.points[0], control.bridge.points.at(-1)] : control.bridge.points,
    w = control.bridge.width,
    y = control.bridge.height;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    wall(o, a, b, y - 0.24, y, w, 'door', 'aggregate');
    if (d)
      for (const sign of [-1, 1]) {
        const aa = [a[0] + ((n[0] * w) / 2) * sign, a[1] + ((n[1] * w) / 2) * sign],
          bb = [b[0] + ((n[0] * w) / 2) * sign, b[1] + ((n[1] * w) / 2) * sign];
        wall(o, aa, bb, y + 0.88, y + 1.06, 0.16, 'door', 'aggregate');
        for (let j = 0; j <= Math.ceil(len / (d === 1 ? 12 : 4.5)); j++) {
          const u = j / Math.ceil(len / (d === 1 ? 12 : 4.5)),
            x = aa[0] + (bb[0] - aa[0]) * u,
            z = aa[1] + (bb[1] - aa[1]) * u;
          prism(
            o,
            [rect(x - 0.09, z - 0.09, x + 0.09, z + 0.09)],
            y,
            y + 1.06,
            'door',
            'aggregate',
          );
        }
      }
    if (d >= 2 && len > 8)
      for (const t of [0.25, 0.7]) {
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        wall(
          o,
          [x - (n[0] * w) / 2, z - (n[1] * w) / 2],
          [x + (n[0] * w) / 2, z + (n[1] * w) / 2],
          0.3,
          y - 0.24,
          0.55,
          'stone',
          'rubble',
        );
      }
  }
  if (d)
    for (let i = 0; i < control.gateRoute.length - 1; i++)
      wall(
        o,
        control.gateRoute[i],
        control.gateRoute[i + 1],
        ground - 0.04,
        ground + 0.015,
        2.8,
        'paving',
        'aggregate',
      );
}
const parts = { compound, roofs, towers, kure, gables, courtyardDetails, defenses, bridge };
export const kalmarParts = Object.fromEntries(
  Object.entries(parts).map(([k, fn]) => [k, (out, d) => fn(nativeBuilder(out), d)]),
);
export function buildKalmarRuntime(out, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3,
    o = nativeBuilder(out);
  for (const fn of Object.values(parts)) fn(o, d);
}
export const buildKalmarSkyline = (out) => buildKalmarRuntime(out, 'skyline');
const camera = (name, position, lookAt) => ({
  name,
  position: (() => {
    const p = kalmarPlanPoint(position[0], position[2]);
    return [p[0], position[1], p[1]];
  })(),
  lookAt: (() => {
    const p = kalmarPlanPoint(lookAt[0], lookAt[2]);
    return [p[0], lookAt[1], p[1]];
  })(),
});
export const kalmarStudy = {
  id: 'N0296',
  key: 'kalmar_castle',
  title: 'Kalmar Castle',
  category: 'castle',
  wikidataId: 'Q648226',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildKalmarRuntime(o),
  surfaceOverrides: kalmarSurfaces,
  brief:
    'Open irregular Renaissance courtyard and four gabled wings,three round and one dodecagonal tower with distinct copper helmets,square Kuretornet with open lantern/old entrance,white Renaissance gables,original well canopy,mapped outer defenses and four cannon towers with western timber bridge.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: kalmarPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 8,
    identityFeatures: [
      'Four differentiated green copper helmets and tall square western lantern tower',
      'Irregular courtyard void surrounded by four dark gabled palace wings',
      'White Renaissance gables and grass outer defenses with four cannon towers',
    ],
  },
  sourceFacts: {
    exactCastleRelation: 1331955,
    openCourtyards: 1,
    cornerTowers: 4,
    outerCannonTowers: 4,
    publishedVerticalDimensions: false,
    surveyedVerticalDatum: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact-QID physical outline and courtyard plus mapped castle parts,coast,defense walls and western approach. Horizontal dimensions derive from attributed coordinates; all heights,roof profiles,apertures and ground section are original estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'surface-means.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own mapped traces © OpenStreetMap contributors,ODbL-1.0. Primary photographs are not redistributed.',
  sourceNotice:
    'Six existing256-square shared graphs with linear tints and central metric UV repeats; plain glass/grass. No new/embedded image,photo texture or downloaded mesh. Courtyard is a physical hole at every level.',
  dataAttribution: '© OpenStreetMap contributors; Statens fastighetsverk; Kalmar Slott.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: ground,
    reviewStatus:
      'Inactive draft; all vertical values are estimated. Real terrain/coast/moat/approach and current-state kitchen extension need review.',
  }),
  geographicNote:
    'Geometry is baked in native East/South coordinates with heading0. Internal plan angle is an authoring convenience and never placement orientation. Original platformY4.2 is a provisional attachment plane; outer coast/defenses extend below it. Physical vertical/site fit remains unverified.',
  limitations: refs.limitations,
  importReason:
    'Preserve courtyard void,distinct round/dodecagonal/square copper roof profiles,mapped gate passages and separate outer cannon-tower silhouettes through four authored levels.',
  mediumFiContext: { scale: '3.0', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: [185, 145, 200], lookAt: [0, 14, 0], fov: 43 },
  qaCameras: [
    camera('western-kuretornet', [-90, 29, -7], [-24, 28, -1]),
    camera('old-gate-passage', [-40, 6.3, -2], [-12, 6.3, -11]),
    camera('open-courtyard-plan', [5, 165, 0], [5, 5, 0]),
    camera('court-well-and-portals', [3, 10, 18], [8, 9, -10]),
    camera('sea-renaissance-gables', [103, 28, 0], [36, 18, 2]),
    camera('four-copper-helmets', [55, 64, 85], [0, 25, 0]),
    camera('western-timber-approach', [-119, 12, 29], [-66, 6, 3]),
  ],
};
