/** Holy Sepulchre: mapped church ranges, unequal domes, bell tower and entrance facade. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sv/sv9/church_of_the_holy_sepulchre/',
    import.meta.url,
  ),
  read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  floor = frame.reconstruction.churchFloorY;
const palette = {
  stone: '#cdbb99',
  trim: '#e2d1ae',
  roof: '#bbb5a8',
  metal: '#8a9aa4',
  tile: '#b17c58',
  glass: '#4d6178',
  wood: '#79624b',
  gold: '#d8b65a',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]],
  lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const sign = (r) =>
  Math.sign(
    r.reduce((n, a, i) => {
      const b = r[(i + 1) % r.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
export function holySepulchreGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Holy Sepulchre footing outside retained DEM');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, polygon, direction) => {
    let p = polygon.map((v) => v.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function simplify(r, tol) {
  if (!tol) return r;
  const p = [...r];
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < p.length && p.length > 4; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        q = p[(i + 1) % p.length],
        dx = q[0] - a[0],
        dz = q[1] - a[1],
        len = Math.hypot(dx, dz),
        along = len ? ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (len * len) : 0,
        dist = len ? Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / len : 0;
      if (dist <= tol && along >= 0 && along <= 1) {
        p.splice(i, 1);
        i--;
      }
    }
  return p;
}
function cap(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(a, b), at(q, b), at(q, t), at(a, t)], [(q[1] - a[1]) * s, 0, (a[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function offsetRing(r, width, inward = true) {
  const s = sign(r) * (inward ? 1 : -1);
  return r.map((p, i) => {
    const a = unit(p.map((v, k) => v - r[(i + r.length - 1) % r.length][k])),
      b = unit(r[(i + 1) % r.length].map((v, k) => v - p[k])),
      n = [-a[1] * s, a[0] * s],
      m = [-b[1] * s, b[0] * s],
      den = Math.max(0.3, 1 + n[0] * m[0] + n[1] * m[1]);
    return p.map(
      (v, k) => v + Math.max(-2 * width, Math.min(2 * width, (width * (n[k] + m[k])) / den)),
    );
  });
}
function nearby(h, r) {
  const n = [-h.axis[1], h.axis[0]],
    ext = [0, 1].map(
      (k) => (Math.abs(h.axis[k]) * h.width) / 2 + (Math.abs(n[k]) * h.depth) / 2 + 0.15,
    );
  return [0, 1].every(
    (k) =>
      Math.min(...r.map((p) => p[k])) <= h.center[k] + ext[k] &&
      Math.max(...r.map((p) => p[k])) >= h.center[k] - ext[k],
  );
}
function band(face, a, b, w, y, slot, depth = 0) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      a.map((v, k) => v + (n[k] * w) / 2),
    ];
  if (depth) solid(face, r, (p) => (typeof y === 'function' ? y(p) : y) - depth, y, slot);
  else cap(face, r, y, slot);
}

const parts = frame.reconstruction.components;
const part = (id) => parts.find((p) => p.id === id);
const box = (face, slot, p, w, d, b, t) => solid(face, rect(...p, w, d), b, t, slot);
const center = (r) => [0, 1].map((k) => r.reduce((n, p) => n + p[k], 0) / r.length);
const regular = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos((i * 2 * Math.PI) / n),
    p[1] + r * Math.sin((i * 2 * Math.PI) / n),
  ]);
const remember = (h, d) => {
  if (d >= 3 && !holySepulchreOpenings.some((q) => q.name === h.name))
    holySepulchreOpenings.push(h);
  return h;
};
export const holySepulchreOpenings = [];
function detailRing(r, d) {
  if (d >= 2) return r;
  const p = center(r),
    n = d === 0 ? 8 : 12;
  return regular(p, r.reduce((s, q) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0) / r.length, n);
}
function profile(face, r, levels, slot, capTop = true) {
  const p = center(r);
  for (let i = 0; i < levels.length - 1; i++) {
    const [y, a] = levels[i],
      [yy, b] = levels[i + 1];
    for (let j = 0; j < r.length; j++) {
      const q = r[j],
        v = r[(j + 1) % r.length],
        atScale = (x, k) => x.map((z, l) => p[l] + (z - p[l]) * k);
      face(
        slot,
        [
          at(atScale(q, a), floor + y),
          at(atScale(v, a), floor + y),
          at(atScale(v, b), floor + yy),
          at(atScale(q, b), floor + yy),
        ],
        [q[0] - p[0], 0.1, q[1] - p[1]],
      );
    }
  }
  if (capTop) {
    const [y, a] = levels.at(-1);
    if (a > 0)
      cap(
        face,
        r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * a)),
        floor + y,
        slot,
      );
  }
}
function hip(face, r, eave, ridge, slot = 'tile') {
  const p = center(r),
    u = unit(r[1].map((v, k) => v - r[0][k])),
    a = p.map((v, k) => v - (u[k] * ridge) / 2),
    b = p.map((v, k) => v + (u[k] * ridge) / 2);
  for (let i = 0; i < r.length; i++) {
    const q = r[i],
      v = r[(i + 1) % r.length],
      forward = (v[0] - q[0]) * u[0] + (v[1] - q[1]) * u[1] > 0;
    face(
      slot,
      [
        at(q, floor + eave),
        at(v, floor + eave),
        at(forward ? b : a, floor + 30),
        at(forward ? a : b, floor + 30),
      ],
      [0, 1, 0],
    );
  }
}
const front = frame.reconstruction.facade,
  frontAxis = unit(front.b.map((v, k) => v - front.a[k])),
  frontNormal = [-frontAxis[1], frontAxis[0]],
  frontPoint = (t) => lerp(front.a, front.b, t);
const portal = {
  name: 'main-open-portal',
  center: frontPoint(0.23),
  axis: frontAxis,
  normal: frontNormal,
  width: 3.15,
  bottom: floor,
  height: 4.7,
  spring: 3.1,
  depth: 3.8,
  shape: 'round',
};
const sealed = { ...portal, name: 'sealed-right-portal', center: frontPoint(0.47) };
function facadeHoles(d) {
  const holes = [remember(portal, d)];
  if (d >= 2)
    for (const [t, w] of [
      [0.23, 3.1],
      [0.47, 3.1],
      [0.7, 2.6],
    ])
      holes.push(
        remember(
          {
            name: `front-upper-window-${t}`,
            center: frontPoint(t),
            axis: frontAxis,
            normal: frontNormal,
            width: w,
            bottom: floor + 8.2,
            height: 6.3,
            spring: 4.6,
            depth: 3.4,
            shape: 'round',
          },
          d,
        ),
      );
  return holes;
}
function archBand(face, h, d, slot = 'trim', thick = 0.25, offset = 0.09) {
  const a = openingShape(h, d),
    p = prepareOpening(h, 0, d),
    outer = a.map(([x, y]) => [
      (x * (h.width + thick * 2)) / h.width,
      h.bottom + ((y - h.bottom) * (h.height + thick)) / h.height,
    ]);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(
      slot,
      [
        p.point(...a[i], offset),
        p.point(...a[j], offset),
        p.point(...outer[j], offset),
        p.point(...outer[i], offset),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
function pane(face, h, d, offset = d === 1 ? 0.04 : -0.17) {
  const p = prepareOpening(h, 0, d),
    r = openingShape(h, d);
  face(
    'glass',
    r.map((q) => p.point(...q, offset)),
    [h.normal[0], 0, h.normal[1]],
  );
  if (d >= 2) {
    for (const side of [-1, 1]) {
      const x = side * h.width * 0.22;
      face(
        'trim',
        [
          p.point(x - 0.06, h.bottom + 0.15, 0.03),
          p.point(x + 0.06, h.bottom + 0.15, 0.03),
          p.point(x + 0.06, h.bottom + h.spring - 0.05, 0.03),
          p.point(x - 0.06, h.bottom + h.spring - 0.05, 0.03),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
    }
    for (const f of [0.32, 0.65]) {
      const y = h.bottom + h.spring * f;
      face(
        'trim',
        [
          p.point(-h.width * 0.45, y - 0.06, 0.03),
          p.point(h.width * 0.45, y - 0.06, 0.03),
          p.point(h.width * 0.45, y + 0.06, 0.03),
          p.point(-h.width * 0.45, y + 0.06, 0.03),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
    }
  }
}
function partMass(out, d, b, holes = []) {
  const hs = holes
      .filter((h) => b.polygons.some((p) => nearby(h, p.outline)))
      .map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d),
    top = floor + b.nominalHeight;
  for (const p of b.polygons)
    sides(
      face,
      simplify(p.outline, d === 1 ? 0.4 : 0.03),
      (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
      top,
      'stone',
    );
  for (const p of b.roofPolygons) cap(face, p.outline, top, 'roof', p.holes);
  // Every reveal is also cut by neighboring apertures, preserving intersecting window bays.
  for (const p of b.polygons)
    for (const h of hs)
      openingReveals(
        openingBuilder(
          {
            addTriangle(_s, ref, p, n, uv, col) {
              p = p.map((v) => v.map(Math.fround));
              if (
                Math.hypot(
                  ...cross(
                    p[1].map((v, k) => v - p[0][k]),
                    p[2].map((v, k) => v - p[0][k]),
                  ),
                ) < 1e-7
              )
                return;
              out.addTriangle('stone', ref, p, n, uv, col);
            },
          },
          hs.filter((q) => q !== h),
        ),
        p.outline,
        (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
        () => top,
        [h],
        d === 0 ? colors.stone.map((v, k) => v * means.stone[k]) : colors.stone,
      );
}
function domes(face, d) {
  for (const [id, large] of [
    [frame.reconstruction.largeDomeId, true],
    [frame.reconstruction.smallDomeId, false],
  ]) {
    const raw = part(id).polygons[0].outline,
      r = detailRing(raw, d),
      p = center(r),
      lo = large ? 20 : 24;
    const levels =
      d === 0
        ? [
            [lo, 1],
            [large ? 28 : 30, 0.85],
            [33, 0.2],
          ]
        : large
          ? [
              [20, 1],
              [23, 0.98],
              [27, 0.88],
              [30.5, 0.68],
              [32.4, 0.42],
              [33, 0.2],
            ]
          : [
              [24, 1],
              [26, 0.97],
              [29, 0.78],
              [31.7, 0.48],
              [33, 0.16],
            ];
    profile(face, r, levels, 'metal');
    const collar = regular(p, large ? 2.4 : 1.0, d === 0 ? 6 : d === 1 ? 8 : 12);
    sides(face, collar, floor + 33, floor + 33.55, large ? 'glass' : 'gold');
    profile(
      face,
      collar,
      [
        [33.55, 1.08],
        [34, 0],
      ],
      large ? 'metal' : 'gold',
    );
    if (!large) {
      box(face, 'gold', p, 0.28, 0.28, floor + 33.7, floor + 36.0);
      box(face, 'gold', p, 1.5, 0.28, floor + 35.2, floor + 35.5);
    }
    if (d >= 2) {
      const trim = raw.map((q) => q.map((v, k) => p[k] + (v - p[k]) * 1.035));
      sides(face, trim, floor + lo - 0.25, floor + lo + 0.2, 'trim');
    }
  }
}
function belfry(out, d) {
  const r = part(frame.reconstruction.bellId).polygons[0].outline,
    inner = offsetRing(r, d === 0 ? 1.6 : 1.2),
    holes = [],
    sgn = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = unit(b.map((v, k) => v - a[k])),
      n = [u[1] * sgn, -u[0] * sgn];
    for (const t of [0.31, 0.69])
      holes.push(
        remember(
          {
            name: `belfry-${i}-${t}`,
            center: lerp(a, b, t),
            axis: u,
            normal: n,
            width: d === 0 ? 2.0 : 2.4,
            bottom: floor + 22.7,
            height: 4.1,
            spring: 2.7,
            depth: 3.5,
            shape: 'round',
          },
          d,
        ),
      );
    const outside = lerp(a, b, 0.5).map((v, k) => v + n[k] * 0.5),
      neighborHeight = Math.max(
        0,
        ...parts
          .filter(
            (v) =>
              v.id !== frame.reconstruction.bellId &&
              v.polygons.some((p) => inside(outside, p.outline)),
          )
          .map((v) => v.nominalHeight),
      );
    if (d >= 2 && neighborHeight <= 13)
      holes.push(
        remember(
          {
            name: `bell-lower-window-${i}`,
            center: lerp(a, b, 0.5),
            axis: u,
            normal: n,
            width: 2.8,
            bottom: floor + Math.max(10.5, neighborHeight + 0.6),
            height: 5.2,
            spring: 3.6,
            depth: 3.5,
            shape: 'round',
          },
          d,
        ),
      );
  }
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  sides(
    face,
    r,
    (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
    floor + 28,
    'stone',
  );
  sides(face, inner, floor + 20, floor + 28, 'stone', true);
  cap(face, r, floor + 28, 'stone', [inner]);
  for (const h of hs)
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          out.addTriangle('stone', ref, p, n, uv, col);
        },
      },
      r,
      (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
      () => floor + 28,
      [h],
      d === 0 ? colors.stone.map((v, k) => v * means.stone[k]) : colors.stone,
    );
  const plain = writer(out, d);
  hip(
    plain,
    r.map((q) => {
      const p = center(r);
      return q.map((v, k) => p[k] + (v - p[k]) * 1.12);
    }),
    28,
    0.8,
  );
  if (d) {
    for (const h of holes.filter((h) => h.name.startsWith('belfry-')))
      archBand(plain, h, d, 'trim', 0.22);
    for (const h of holes.filter((h) => h.name.startsWith('bell-lower-'))) {
      pane(plain, h, d);
      archBand(plain, h, d, 'trim', 0.25);
    }
  }
  if (d >= 2) {
    const p = center(r);
    for (const yy of [11.0, 20.8]) {
      const rr = r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * 1.045));
      sides(plain, rr, floor + yy, floor + yy + 0.3, 'trim');
    }
  }
}
function smallCupola(face, d, id, radius, base, top) {
  const p = center(part(id).polygons[0].outline),
    r = regular(p, radius, d === 0 ? 6 : d === 1 ? 8 : 12);
  solid(face, r, floor + base - 3, floor + base, 'stone');
  profile(
    face,
    r,
    [
      [base, 1],
      [base + (top - base) * 0.45, 0.86],
      [top, 0.0],
    ],
    'roof',
  );
  if (d >= 2) {
    const rp = regular(p, radius * 1.03, 12);
    sides(face, rp, floor + base - 0.2, floor + base + 0.12, 'trim');
  }
}
function facade(face, d, holes) {
  if (!d) return;
  archBand(face, portal, d, 'trim', 0.35);
  archBand(face, sealed, d, 'trim', 0.35);
  // The right portal is represented as a sealed stone panel rather than a false passage.
  const closed = prepareOpening(sealed, 0, d);
  face(
    'stone',
    openingShape(sealed, d).map((q) => closed.point(...q, 0.05)),
    [frontNormal[0], 0, frontNormal[1]],
  );
  const ws =
    d === 1
      ? [0.23, 0.47, 0.7].map((t) => ({
          name: `district-front-pane-${t}`,
          center: frontPoint(t),
          axis: frontAxis,
          normal: frontNormal,
          width: t === 0.7 ? 2.6 : 3.1,
          bottom: floor + 8.2,
          height: 6.3,
          spring: 4.6,
          depth: 3.4,
          shape: 'round',
        }))
      : holes.filter((h) => h.name.startsWith('front-upper-window'));
  for (const h of ws) {
    pane(face, h, d);
    archBand(face, h, d, 'trim', d === 1 ? 0.25 : 0.3);
    if (d >= 2)
      archBand(
        face,
        { ...h, width: h.width + 0.7, height: h.height + 0.4, spring: h.spring + 0.15 },
        d,
        'stone',
        0.22,
        0.1,
      );
  }
  // Broad cornice and sparse terrace rail; finer roof ornament is excluded.
  band(face, front.a, front.b, 0.65, floor + 18.6, 'trim', 0.3);
  band(face, front.a, front.b, 0.6, floor + 20.1, 'trim', 0.3);
  if (d >= 2) {
    for (const t of [0.08, 0.35, 0.62, 0.96]) {
      const p = frontPoint(t);
      box(face, 'trim', p, 0.55, 0.55, floor + 4.8, floor + 17.4);
    }
    const p = frontPoint(0.47),
      a = p.map((v, k) => v + frontAxis[k] * -0.38 + frontNormal[k] * 0.35),
      b = p.map((v, k) => v + frontAxis[k] * 0.38 + frontNormal[k] * 0.35);
    box(face, 'wood', a, 0.13, 0.13, floor + 6.9, floor + 9.1);
    box(face, 'wood', b, 0.13, 0.13, floor + 6.9, floor + 9.1);
    for (const y of [7.1, 7.5, 7.9, 8.3, 8.7]) band(face, a, b, 0.11, floor + y, 'wood', 0.11);
  }
}
function stairs(face, d) {
  if (!d) return;
  for (const [a, b, y0, y1] of [
    [[-12.7, 7.5], [-8.2, -5.0], 20, 24],
    [[14, 7], [5.2, 0.4], 18.5, 24],
  ]) {
    const n = d === 1 ? 1 : d === 2 ? 12 : 24;
    for (let i = 0; i < n; i++)
      band(
        face,
        lerp(a, b, i / n),
        lerp(a, b, (i + 1) / n),
        1.5,
        floor + y0 + ((y1 - y0) * (i + 1)) / n,
        'stone',
        0.45,
      );
    if (d >= 2) {
      const u = unit(b.map((v, k) => v - a[k])),
        v = [-u[1], u[0]];
      for (const side of [-1, 1]) {
        band(
          face,
          a.map((x, k) => x + v[k] * side * 0.6),
          b.map((x, k) => x + v[k] * side * 0.6),
          0.22,
          (p) =>
            floor +
            y0 +
            (y1 - y0) *
              Math.max(
                0,
                Math.min(
                  1,
                  ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]) /
                    Math.hypot(...b.map((x, k) => x - a[k])),
                ),
              ) -
            0.12,
          'wood',
          0.25,
        );
        band(
          face,
          a.map((x, k) => x + v[k] * side * 0.72),
          b.map((x, k) => x + v[k] * side * 0.72),
          0.17,
          (p) =>
            floor +
            y0 +
            (y1 - y0) *
              Math.max(
                0,
                Math.min(
                  1,
                  Math.hypot(...p.map((x, k) => x - a[k])) /
                    Math.hypot(...b.map((x, k) => x - a[k])),
                ),
              ) +
            1.0,
          'wood',
          0.2,
        );
      }
    }
  }
}
function inside(p, r) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function secondaryWindows(face, d) {
  if (d < 2) return;
  const r = part(frame.reconstruction.mainId).polygons[0].outline,
    sgn = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    if (len < 5) continue;
    const u = unit(b.map((v, k) => v - a[k])),
      n = [u[1] * sgn, -u[0] * sgn],
      count = Math.max(1, Math.floor(len / (d === 2 ? 12 : 8)));
    for (let j = 0; j < count; j++) {
      const p = lerp(a, b, (j + 0.5) / count);
      if (p[1] > 5 && p[0] > -24 && p[0] < 17) continue;
      const q = p.map((v, k) => v - n[k] * 0.3),
        height = Math.max(
          11,
          ...parts
            .filter((v) => v.polygons.some((r) => inside(q, r.outline)))
            .map((v) => v.nominalHeight),
        );
      for (const yy of d >= 3 && height > 17 ? [5, 12.5] : [5])
        pane(
          face,
          {
            center: p,
            axis: u,
            normal: n,
            width: 1.15,
            bottom: floor + yy,
            height: 2.2,
            spring: 1.7,
            shape: 'round',
            depth: 1,
          },
          1,
          0.055,
        );
    }
  }
}
function skylineMasses(out) {
  const base = part(frame.reconstruction.mainId),
    face = writer(out, 0);
  solid(
    face,
    simplify(base.polygons[0].outline, 0.7),
    (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
    floor + 11,
    'stone',
  );
  for (const id of [
    frame.reconstruction.westernBodyId,
    frame.reconstruction.catholiconId,
    35185394752357,
    35185394752354,
  ]) {
    const p = part(id),
      r = simplify(p.polygons[0].outline, 0.8);
    solid(
      face,
      r,
      (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
      floor + p.nominalHeight,
      'stone',
    );
  }
}
function skylineBelfry(face) {
  const r = part(frame.reconstruction.bellId).polygons[0].outline;
  solid(
    face,
    r,
    (q) => Math.min(floor - 0.4, holySepulchreGround(...q) - 0.35),
    floor + 28,
    'stone',
  );
  hip(face, r, 28, 0.8);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = unit(b.map((v, k) => v - a[k])),
      n = [u[1] * sign(r), -u[0] * sign(r)];
    for (const t of [0.31, 0.69])
      pane(
        face,
        {
          center: lerp(a, b, t),
          axis: u,
          normal: n,
          width: 2.2,
          bottom: floor + 22.7,
          height: 4.1,
          spring: 2.7,
          depth: 3.5,
          shape: 'round',
        },
        0,
        0.04,
      );
  }
}
function build(out, d) {
  const face = writer(out, d),
    holes = facadeHoles(d);
  if (!d) skylineMasses(out);
  else
    for (const b of parts) {
      if (
        [
          frame.reconstruction.largeDomeId,
          frame.reconstruction.smallDomeId,
          frame.reconstruction.bellId,
          35185394752341,
          35185394752329,
        ].includes(b.id)
      )
        continue;
      partMass(out, d, b, holes);
    }
  domes(face, d);
  if (d === 0) skylineBelfry(face);
  else belfry(out, d);
  smallCupola(face, d, 35185394752341, 2.9, 13, 16);
  if (d) smallCupola(face, d, 35185394752329, 3.3, 10.5, 13);
  facade(face, d, holes);
  secondaryWindows(face, d);
  stairs(face, d);
  solid(
    face,
    frame.reconstruction.parvis,
    (q) => Math.min(floor - 0.25, holySepulchreGround(...q) - 0.3),
    floor,
    'roof',
  );
}
export const buildHolySepulchreSkyline = (out) => build(out, 0);
export const buildHolySepulchreDistrict = (out) => build(out, 1);
export const buildHolySepulchreStreet = (out) => build(out, 2);
export const buildHolySepulchreCloseup = (out) => build(out, 3);
export const holySepulchreStudy = {
  id: 'church_of_the_holy_sepulchre',
  key: 'church_of_the_holy_sepulchre',
  title: 'Church of the Holy Sepulchre',
  category: 'church',
  wikidataId: 'Q187702',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual connected church exterior with unequal mapped Rotunda/Catholicon domes, upper crown/cross, square paired-arch bell tower/red hip, two-level arched south facade, open entrance court, stepped mapped ranges, small chapel cupolas and roof terraces/stairs.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main outline/current parent and35 selected above-grade exterior controls, preserving mapped part/dome footprints and signed southern entrance.',
    architecturalHeights:
      'Mapped dome intervals20/24 to34m, bell30m, apse23m and west turret22m are preserved relative to estimated native church floor0.75m. Untagged range/terrace/small cupola heights, cross and facade/portal profiles are picture-led estimates; nativeY0 follows standardDEM770.4363m.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped main/part polygons and principal height intervals supply exterior scale; two inspected roof/facade pictures guide individual shape and roof colors.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Three existing shared256-square graphs supply weathered limestone, gray standing-seam metal and red tile, with linear tints and metric UVs. Glass, small wood rails/ladder and gold cross use vertex colors; no unique facade bitmap or embedded image.',
  importReason:
    'Preserve unequal dome/tower silhouette, irregular mapped ranges, arched facade and open court in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Exact-QID outline/current main and selected exterior part polygons control fit. Mapped principal height intervals are preserved; component roles, untagged range/terrace heights, cupola curves, roof stairs, doors, windows, rails and ladder are picture-led approximations.',
    'NativeY0 follows coarse standardDEM770.4363m. The estimated0.75m church/court plane, retaining foundations, terraces and stairs must bridge coarse sloping ground; precise street/church levels and joins are unverified. No surveyed or certified walking collision.',
    'Skyline preserves main compound, unequal domes, square bell/red cap, small front cupola and court, using dark surface belfry panes. District restores lower parts and open belfry arches; street/closeup add recessed front/visible bell panes, sparse inferred secondary surface windows, arch bands, eaves, joined roof stairs and a simplified ladder/cross. Full interiors, Aedicule/chapels, underground StHelena volume, exact sculpture/lettering and separate east police range are excluded.',
    'The two references show different roof conditions; gray metal principal domes and red bell tile follow the newer view, with simplified low-frequency shared surfaces. Surrounding city, visitors and vegetation remain host content. Physical laptop/phone measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'south-facade-and-portals', position: [5, 17, 52], lookAt: [-2, 10, 8], fov: 43 },
    { name: 'two-domes-and-terraces', position: [29, 51, 28], lookAt: [-12, 26, -9], fov: 43 },
    { name: 'belfry-and-red-hip', position: [-46, 31, 35], lookAt: [-15, 23, 15], fov: 43 },
    { name: 'rotunda-crown', position: [-55, 43, -15], lookAt: [-27, 27, -11], fov: 43 },
    {
      name: 'eastern-apse-and-small-cupolas',
      position: [64, 32, 18],
      lookAt: [25, 16, 3],
      fov: 43,
    },
    { name: 'northern-mapped-ranges', position: [-8, 37, -73], lookAt: [-5, 16, -19], fov: 43 },
  ],
};
