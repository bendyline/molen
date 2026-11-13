/** Shirvanshah Palace in Baku. Local metres, with separate intact and ruined precincts. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/tp/tp5/palace_of_the_shirvanshahs/layout.json',
      import.meta.url,
    ),
  ),
);
const limestone = { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 };
const paving = { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 };
const masonry = { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95 };
const wood = { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.92 };
export const surfaces = {
  wall: masonry,
  ruin: masonry,
  trim: limestone,
  roof: limestone,
  paving,
  base: paving,
  wood,
  shade: wood,
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
};
const colors = {
  wall: [0.7, 0.61, 0.45],
  ruin: [0.55, 0.46, 0.34],
  trim: [0.8, 0.73, 0.56],
  roof: [0.62, 0.55, 0.41],
  paving: [0.52, 0.48, 0.39],
  base: [0.48, 0.417, 0.32],
  wood: [0.21, 0.135, 0.075],
  shade: [0.14, 0.105, 0.075],
  iron: [0.145, 0.161, 0.125],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  tau = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const range = (n) => Array.from({ length: n }, (_, i) => i);
function writer(out) {
  return (role, points, dir, tone = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((a, v, k) => a + v * dir[k], 0) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        'palette:#ffffff',
        p,
        n,
        undefined,
        colors[role].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
function cap(f, role, ring, y, normal = up) {
  const indices = earcut(ring.flat());
  for (let k = 0; k < indices.length; k += 3)
    f(
      role,
      indices.slice(k, k + 3).map((i) => [ring[i][0], y, ring[i][1]]),
      normal,
    );
}
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
function frame(a, b, sign = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz),
    nx = (sign * dz) / w,
    nz = (-sign * dx) / w;
  const point = (u, y, t = 0) => [a[0] + (dx * u) / w + nx * t, y, a[1] + (dz * u) / w + nz * t];
  return { w, n: [nx, 0, nz], point, a, b };
}
function centered(x, z, w, angle) {
  const a = [Math.cos(angle) * w * 0.5, Math.sin(angle) * w * 0.5];
  return frame([x - a[0], z - a[1]], [x + a[0], z + a[1]]);
}
function wallPanel(f, role, s, x0, x1, y0, y1, d = 0, tone = 1) {
  if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
  f(
    role,
    [s.point(x0, y0, d), s.point(x1, y0, d), s.point(x1, y1, d), s.point(x0, y1, d)],
    s.n,
    tone,
  );
}
function slab(f, role, s, x0, x1, y0, y1, from, to) {
  if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
  const outline = [
    [x0, from],
    [x1, from],
    [x1, to],
    [x0, to],
  ].map(([u, d]) => {
    const [x, , z] = s.point(u, 0, d);
    return [x, z];
  });
  prism(f, role, { outline }, y0, y1, false);
}
const arch = (u, base, spring, rise) =>
  base + spring + rise * (0.72 * Math.sqrt(Math.max(0, 1 - u * u)) + 0.28 * (1 - Math.abs(u)));
/** Pointed masonry opening, with jambs, a continuous soffit and optional recessed door. */
function gateway(
  f,
  s,
  { base = 0, opening, height, depth = 0.64, spring, rise, segments, door = false, trim = true },
) {
  const mid = s.w / 2,
    lo = mid - opening / 2,
    hi = mid + opening / 2;
  if (segments === 2) {
    wallPanel(f, 'wall', s, 0, lo, base, height);
    wallPanel(f, 'wall', s, hi, s.w, base, height);
    const crown = base + spring + rise;
    for (const [a, b, p, q] of [
      [lo, mid, base + spring, crown],
      [mid, hi, crown, base + spring],
    ]) {
      f('wall', [s.point(a, p), s.point(b, q), s.point(b, height), s.point(a, height)], s.n);
    }
    return;
  }
  slab(f, 'wall', s, 0, lo, base, height, -depth, 0);
  slab(f, 'wall', s, hi, s.w, base, height, -depth, 0);
  for (let i = 0; i < segments; i++) {
    const u = i / segments,
      v = (i + 1) / segments,
      a = mix(lo, hi, u),
      b = mix(lo, hi, v);
    const p = arch(u * 2 - 1, base, spring, rise),
      q = arch(v * 2 - 1, base, spring, rise);
    for (const [d, n] of [
      [0, s.n],
      [-depth, s.n.map((a) => -a)],
    ]) {
      f(
        'wall',
        [s.point(a, p, d), s.point(b, q, d), s.point(b, height, d), s.point(a, height, d)],
        n,
      );
    }
    f('trim', [s.point(a, p), s.point(b, q), s.point(b, q, -depth), s.point(a, p, -depth)], down);
    if (trim) {
      f(
        'trim',
        [
          s.point(a, p, 0.026),
          s.point(b, q, 0.026),
          s.point(b, q + 0.19, 0.026),
          s.point(a, p + 0.19, 0.026),
        ],
        s.n,
        0.94 + (i % 3) * 0.03,
      );
    }
    if (door)
      f(
        'wood',
        [
          s.point(a, base, -depth + 0.025),
          s.point(b, base, -depth + 0.025),
          s.point(b, q, -depth + 0.025),
          s.point(a, p, -depth + 0.025),
        ],
        s.n,
        0.86 + (i % 2) * 0.12,
      );
  }
  f(
    'roof',
    [
      s.point(lo, height),
      s.point(hi, height),
      s.point(hi, height, -depth),
      s.point(lo, height, -depth),
    ],
    up,
  );
  if (trim) {
    for (const x of [lo - 0.2, hi]) wallPanel(f, 'trim', s, x, x + 0.2, base, base + spring, 0.029);
    slab(f, 'trim', s, 0.03, s.w - 0.03, height, height + 0.14, -depth - 0.08, 0.1);
  }
}
function circle(x, z, r, n, phase = 0) {
  return range(n).map((i) => [
    x + r * Math.cos(phase + (tau * i) / n),
    z + r * Math.sin(phase + (tau * i) / n),
  ]);
}
/** Ring profile stores world-space height and radius. Small crown rings close pointed roofs. */
function rings(f, role, x, z, profile, n, phase = 0) {
  const row = profile.map(([y, r]) => circle(x, z, r, n, phase).map(([x, z]) => [x, y, z]));
  for (let j = 1; j < row.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = [row[j - 1][i], row[j - 1][k], row[j][k], row[j][i]];
      f(
        role,
        p,
        [
          p[0][0] + p[1][0] - 2 * x,
          profile[j][1] < profile[j - 1][1] ? 1 : 0,
          p[0][2] + p[1][2] - 2 * z,
        ],
        0.965 + (i % 3) * 0.028,
      );
    }
  const [y, r] = profile.at(-1);
  cap(f, role, circle(x, z, r, n, phase), y);
}
function dome(f, x, z, y, r, h, detail, pointed = false, phase = 0) {
  const count = [2, 4, 8, 13, 16][detail],
    sides = [6, 10, 16, 22, 24][detail];
  const p = range(count).map((i) => {
    const angle = (Math.PI * 0.5 * i) / count;
    return [y + h * Math.sin(angle), r * Math.cos(angle) * (pointed ? 1 - (0.33 * i) / count : 1)];
  });
  p.push([y + h, 0.034]);
  rings(f, 'roof', x, z, p, sides, phase);
  if (detail >= 3) {
    for (const t of [0.16, 0.36, 0.57]) {
      const a = Math.asin(t),
        b = r * Math.cos(a) * (pointed ? 1 - (0.33 * a) / (Math.PI * 0.5) : 1);
      rings(
        f,
        'trim',
        x,
        z,
        [
          [y + h * t - 0.036, b + 0.026],
          [y + h * t + 0.025, b - 0.004],
        ],
        sides,
        phase,
      );
    }
  }
}
function stairs(f, s, detail) {
  const axis = frame(s.a, s.b),
    steps = detail <= 1 ? Math.min(4, s.steps) : s.steps;
  for (let i = 0; i < steps; i++) {
    const a = (axis.w * i) / steps,
      b = (axis.w * (i + 1)) / steps,
      h = mix(s.from, s.to, (i + 1) / steps);
    slab(f, 'paving', axis, a, b, s.from - 0.23, h, -s.width * 0.5, s.width * 0.5);
  }
  if (detail >= 2)
    for (const offset of [-s.width * 0.54, s.width * 0.54]) {
      const at = (u, y, t) => axis.point(u, y, offset + t),
        w = axis.w;
      const p = [
        at(0, s.from + 0.42, 0),
        at(w, s.to + 0.42, 0),
        at(w, s.to + 0.42, 0.22),
        at(0, s.from + 0.42, 0.22),
      ];
      f('trim', p, up);
      for (const [t, n] of [
        [0, axis.n.map((v) => -v)],
        [0.22, axis.n],
      ])
        f(
          'wall',
          [
            at(0, s.from - 0.2, t),
            at(w, s.from - 0.2, t),
            at(w, s.to + 0.42, t),
            at(0, s.from + 0.42, t),
          ],
          n,
        );
    }
}
function surround(f, role, outline, base, height, thickness, gaps = new Map()) {
  for (let i = 0; i < outline.length; i++) {
    const s = frame(outline[i], outline[(i + 1) % outline.length]);
    for (const [lo, hi] of gaps.get(i) ?? [[0, 1]])
      slab(f, role, s, s.w * lo, s.w * hi, base, height, -thickness * 0.5, thickness * 0.5);
  }
}
function lattice(f, s, u, base, w, h, detail) {
  wallPanel(f, 'shade', s, u, u + w, base, base + h, 0.016);
  if (detail < 2) return;
  const inset = 0.09;
  for (const x of [u - inset, u + w])
    wallPanel(f, 'trim', s, x, x + inset, base - inset, base + h + inset, 0.045);
  for (const y of [base - inset, base + h]) wallPanel(f, 'trim', s, u, u + w, y, y + inset, 0.045);
  if (detail < 3) return;
  const n = detail === 4 ? 5 : 4;
  for (let i = 1; i < n; i++)
    wallPanel(
      f,
      'trim',
      s,
      u + (i * w) / n - 0.025,
      u + (i * w) / n + 0.025,
      base,
      base + h,
      0.034,
    );
  for (let i = 1; i < 2 * n; i++)
    wallPanel(
      f,
      'trim',
      s,
      u,
      u + w,
      base + (i * h) / (2 * n) - 0.017,
      base + (i * h) / (2 * n) + 0.017,
      0.036,
    );
}
function residence(f, detail) {
  const ring = layout.outlines.palace,
    lo = layout.palaceBase,
    hi = layout.palaceRoof;
  const sign = Math.sign(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  if (detail > 0) prism(f, 'base', { outline: ring }, -0.85, lo, false);
  const wing = [...ring.slice(0, 4)],
    body = [ring[0], ...ring.slice(3)],
    lowRoof = hi - 2.65;
  cap(f, 'roof', wing, lowRoof);
  cap(f, 'roof', body, hi);
  const connector = frame(ring[3], ring[0], sign);
  wallPanel(f, 'wall', connector, 0, connector.w, lowRoof, hi);
  for (let i = 0; i < ring.length; i++) {
    const s = frame(ring[i], ring[(i + 1) % ring.length], sign);
    const roof = i < 3 ? lowRoof : hi;
    wallPanel(f, 'wall', s, 0, s.w, detail === 0 ? -0.85 : lo, roof);
    if (detail === 0) continue;
    if (i === 3) {
      const a = s.point(7.75, 0, 0.88),
        b = s.point(14.4, 0, 0.88),
        portal = frame([a[0], a[2]], [b[0], b[2]], sign);
      gateway(f, portal, {
        base: lo,
        opening: 3.65,
        height: hi + 0.69,
        spring: 5.8,
        rise: 2.15,
        depth: 0.93,
        segments: [2, 4, 6, 12, 16][detail],
        door: true,
      });
      if (detail >= 2)
        for (const inset of [0.3, 0.52])
          for (const u of [inset, portal.w - inset - 0.12])
            wallPanel(f, 'trim', portal, u, u + 0.12, lo + 0.49, hi + 0.15, 0.056);
      continue;
    }
    const count = Math.max(1, Math.round(s.w / 3.8));
    for (let j = 0; j < count; j++) {
      const u = (s.w * (j + 0.5)) / count;
      if (s.w < 1.2) continue;
      if (detail >= 2) lattice(f, s, u - 0.37, lo + 2.45, 0.74, 1.47, detail);
      if (detail >= 3 && i % 3 !== 1 && i >= 3)
        lattice(f, s, u - 0.39, lo + 5.38, 0.78, 1.7, detail);
      lattice(f, s, u - 0.31, roof - 2.3, 0.62, 0.87, detail);
    }
    if (detail >= 2) slab(f, 'trim', s, 0, s.w, roof - 0.16, roof + 0.085, -0.17, 0.09);
  }
  dome(f, ...layout.palaceDome, detail);
}
function divankhana(f, detail) {
  const [x, z, court, core, outer] = layout.pavilion,
    phase = Math.PI / 8 + 0.44;
  const path = circle(x, z, outer, 8, phase),
    columnTop = court + 3.87;
  prism(f, 'paving', { outline: path }, court - 0.34, court, false);
  prism(f, 'wall', { outline: circle(x, z, core, 8, phase) }, court, court + 3.57, false);
  prism(f, 'trim', { outline: path }, columnTop, columnTop + 0.36, false);
  dome(f, x, z, columnTop + 0.36, core, 2.95, detail, false, phase);
  for (let i = 0; i < 8; i++) {
    const s = frame(path[i], path[(i + 1) % 8]);
    gateway(f, s, {
      base: court,
      opening: s.w * 0.71,
      height: columnTop,
      spring: 2.41,
      rise: 0.98,
      depth: 0.52,
      segments: [2, 4, 6, 10, 14][detail],
      trim: detail > 0,
    });
    if (detail >= 2) {
      for (const [t, w, h] of [
        [0, 0.51, 0.24],
        [2.34, 0.4, 0.17],
      ])
        slab(f, 'trim', s, 0, w, court + t, court + t + h, -0.64, 0.09);
      const corePath = circle(x, z, core, 8, phase),
        a = corePath[i],
        b = corePath[(i + 1) % 8],
        inner = frame(a, b);
      if (i % 2 === 0) lattice(f, inner, inner.w * 0.5 - 0.36, court + 0.94, 0.72, 1.32, detail);
    }
  }
  const portal = centered(20.78, -22.2, 4.62, 0.52);
  if (detail > 0)
    gateway(f, portal, {
      base: court - 0.74,
      opening: 2.0,
      height: court + 5.85,
      spring: 3.7,
      rise: 1.6,
      depth: 1.0,
      segments: [2, 4, 6, 10, 14][detail],
    });
  const R = layout.outlines.cloister;
  prism(f, 'wall', { outline: R }, 2.45, 6.82, false);
  if (detail > 0)
    for (const i of [3, 4, 5]) {
      const s = frame(R[i], R[(i + 1) % R.length]),
        n = Math.round(s.w / 3.45);
      for (let j = 0; j < n; j++) {
        const a = s.point((s.w * j) / n, 0, 1.05),
          b = s.point((s.w * (j + 1)) / n, 0, 1.05),
          g = frame([a[0], a[2]], [b[0], b[2]]);
        gateway(f, g, {
          base: 3.1,
          opening: g.w * 0.73,
          height: 6.6,
          spring: 2.11,
          rise: 0.88,
          depth: 0.4,
          segments: [2, 4, 6, 8, 12][detail],
          trim: detail >= 2,
        });
      }
    }
}
function tombsAndMosque(f, detail) {
  const [x, z, y, r, h] = layout.tomb,
    [mx, mz, my, mr, mh] = layout.mosque;
  prism(f, 'wall', { outline: layout.outlines.royalTomb }, -0.92, y + 4.76, false);
  prism(f, 'wall', { outline: layout.outlines.mosque }, -0.88, my + 4.9, false);
  dome(f, x, z, y + 4.76, r, h, detail, true);
  dome(f, mx, mz, my + 4.9, mr, mh, detail, true);
  if (detail > 0) {
    dome(f, -17.8, -1.1, my + 4.9, 1.64, 1.73, detail);
    const [t, m] = [
      frame(layout.outlines.royalTomb[3], layout.outlines.royalTomb[0]),
      frame(layout.outlines.mosque[4], layout.outlines.mosque[0]),
    ];
    for (const [side, b, scale] of [
      [t, y, 1],
      [m, my, 0.93],
    ]) {
      const u = side.w * 0.47,
        a = side.point(u - 2.18, 0, 0.44),
        c = side.point(u + 2.18, 0, 0.44),
        s = frame([a[0], a[2]], [c[0], c[2]]);
      gateway(f, s, {
        base: b,
        opening: 1.75 * scale,
        height: b + 4.83,
        spring: 2.05,
        rise: 1.1,
        depth: 0.48,
        segments: [2, 4, 6, 10, 14][detail],
        door: true,
      });
      if (detail >= 2)
        for (const offset of [-3.3, 2.76])
          lattice(f, side, u + offset, b + 1.7, 0.45, 1.04, detail);
    }
  }
  const [tx, tz, ty, tr] = layout.minaret,
    n = [8, 12, 14, 20, 24][detail];
  rings(
    f,
    'wall',
    tx,
    tz,
    [
      [my - 0.65, tr * 1.19],
      [ty + 1.1, tr * 1.14],
      [ty + 13.1, tr],
      [ty + 13.8, tr * 0.92],
    ],
    n,
  );
  const corbels = [
    [ty + 13.4, tr * 0.96],
    [ty + 14.26, tr * 1.3],
    [ty + 14.75, tr * 1.53],
    [ty + 15.03, tr * 1.57],
  ];
  rings(f, 'trim', tx, tz, corbels, n);
  rings(
    f,
    'wall',
    tx,
    tz,
    [
      [ty + 15.04, tr * 0.78],
      [ty + 18.19, tr * 0.71],
    ],
    n,
  );
  dome(f, tx, tz, ty + 18.19, tr * 0.71, 1.19, detail, true);
  if (detail >= 2) {
    const ring = circle(tx, tz, tr * 1.49, n);
    surround(f, 'iron', ring, ty + 15.84, ty + 15.91, 0.065);
    for (let i = 0; i < n; i++) block(f, 'iron', ...ring[i], 0.062, 0.062, ty + 15.03, ty + 15.86);
  }
  const [bx, bz, by, br] = layout.bakuvi,
    R = layout.outlines.bakuvi;
  prism(f, 'wall', { outline: R }, Math.min(1.18, by - 0.76), by + 3.77, false);
  rings(
    f,
    'trim',
    bx,
    bz,
    [
      [by + 3.7, br],
      [by + 3.87, br * 1.04],
      [by + 4.08, br * 0.96],
    ],
    8,
    0.03,
  );
  rings(
    f,
    'roof',
    bx,
    bz,
    [
      [by + 4.07, br * 0.95],
      [by + 5.0, br * 0.7],
      [by + 7.14, 0.055],
    ],
    8,
    0.03,
  );
  if (detail > 0) {
    const s = frame(R[6], R[7]);
    lattice(f, s, s.w * 0.32, by + 1.63, 0.57, 1.02, detail);
    if (detail >= 2) slab(f, 'trim', s, 0, s.w, by + 0.12, by + 0.29, -0.12, 0.085);
  }
}
function ruinsAndTerraces(f, detail) {
  for (const C of layout.courts) {
    if (detail > 0) prism(f, 'base', { outline: C.outline }, C.bottom, C.top - 0.12, false);
    prism(
      f,
      'paving',
      { outline: C.outline },
      detail === 0 ? C.bottom : C.top - 0.12,
      C.top,
      false,
    );
  }
  for (const s of detail === 0 ? layout.stairs.slice(0, 2) : layout.stairs) stairs(f, s, detail);
  const ruin = layout.ruin,
    y = layout.ruinBase;
  const gaps = new Map([
    [
      0,
      [
        [0, 0.2],
        [0.57, 1],
      ],
    ],
    [
      2,
      [
        [0, 0.44],
        [0.68, 1],
      ],
    ],
  ]);
  surround(f, 'ruin', ruin, y, y + 1.89, 0.65, gaps);
  if (detail >= 1)
    for (let i = 0; i < ruin.length; i++) {
      const s = frame(ruin[i], ruin[(i + 1) % ruin.length]);
      for (const [a, b, h] of [
        [0, 0.17, 0.45],
        [0.71, 0.9, 0.28],
      ])
        slab(f, 'ruin', s, s.w * a, s.w * b, y + 1.88, y + 1.88 + h, -0.31, 0.31);
    }
  for (const g of detail === 0 ? layout.gates.slice(0, 1) : layout.gates) {
    const s = frame(g.a, g.b);
    gateway(f, s, {
      base: g.base,
      opening: g.width,
      height: g.top,
      spring: (g.top - g.base) * 0.49,
      rise: (g.top - g.base) * 0.29,
      depth: g.depth,
      segments: [2, 4, 6, 10, 14][detail],
      door: g.name === 'Rasul Baba Gate',
      trim: detail > 0,
    });
    if (detail >= 2) {
      const top = g.top - 0.68;
      for (const u of [0.42, s.w - 0.58])
        wallPanel(f, 'trim', s, u, u + 0.14, g.base + 0.35, top, 0.046);
      wallPanel(f, 'trim', s, 0.45, s.w - 0.45, top - 0.16, top, 0.044);
      if (g.name === 'Murad Gate')
        for (const u of range(12))
          wallPanel(
            f,
            'trim',
            s,
            1.9 + u * 0.187,
            2.0 + u * 0.187,
            top - 0.31,
            top - 0.24,
            0.075,
            0.8,
          );
    }
  }
  const gate = layout.gates[0];
  for (const [a, b] of [
    [[40.75, 43.93], gate.a],
    [gate.b, [50.42, 28.42]],
  ]) {
    const s = frame(a, b);
    slab(f, 'wall', s, 0, s.w, 0.61, gate.top - 0.89, -0.73, 0.02);
    if (detail >= 2) slab(f, 'trim', s, 0, s.w, gate.top - 0.89, gate.top - 0.72, -0.8, 0.12);
  }
  const R = layout.bathOutline,
    by = layout.bathBase;
  if (detail > 0) prism(f, 'base', { outline: R }, -0.48, by - 0.08, false);
  prism(f, 'paving', { outline: R }, by - 0.08, by, false);
  surround(
    f,
    'ruin',
    R,
    by,
    by + 1.45,
    0.65,
    new Map([
      [
        5,
        [
          [0, 0.28],
          [0.48, 1],
        ],
      ],
    ]),
  );
  if (detail > 0)
    for (const [a, b, offset] of [
      [[-46.9, -35.1], [-35.4, -35.1], 0.25],
      [[-46.9, -28.8], [-33.0, -28.8], 0.15],
      [[-46.7, -22.8], [-34.1, -22.8], 0.33],
      [[-43.4, -37.6], [-43.4, -16.4], 0.4],
      [[-37.6, -33], [-37.6, -16.2], 0.05],
    ]) {
      const s = frame(a, b);
      for (const [u, v] of [
        [0, 0.43],
        [0.55, 1],
      ])
        slab(f, 'ruin', s, s.w * u, s.w * v, by, by + 0.84 + offset, -0.35, 0.35);
    }
  if (detail >= 2) {
    for (const [x, z, r] of [
      [-46, -31, 1.6],
      [-40.55, -25, 2.05],
      [-39.8, -19, 1.4],
    ]) {
      const outer = circle(x, z, r, 10),
        inner = circle(x, z, r - 0.28, 10);
      prism(f, 'ruin', { outline: outer, holes: [inner] }, by + 0.021, by + 0.4, false);
    }
    for (let i = 0; i < 7; i++)
      block(f, 'ruin', 23.0 + i * 1.19, 41.16, 0.86, 0.44, y, y + 0.47 + (i % 3) * 0.12);
  }
}
export function buildShirvanshahLevel(out, level) {
  const detail = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (detail < 0) throw Error('Unknown Shirvanshah model level ' + level);
  const f = writer(out);
  ruinsAndTerraces(f, detail);
  residence(f, detail);
  divankhana(f, detail);
  tombsAndMosque(f, detail);
}
export const buildShirvanshahSkyline = (out) => buildShirvanshahLevel(out, 'skyline');
export const buildShirvanshahDistrict = (out) => buildShirvanshahLevel(out, 'district');
export const buildShirvanshahStreet = (out) => buildShirvanshahLevel(out, 'street');
export const buildShirvanshahCloseup = (out) => buildShirvanshahLevel(out, 'closeup');
