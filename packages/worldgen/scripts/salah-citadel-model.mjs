/** Salah Ed-Din, Syria: the conserved and ruined citadel, not a medieval reconstruction. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sy/sy3/n0257_citadel_of_salah_ed_din/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.63, 0.57, 0.43],
  trim = [0.73, 0.67, 0.52],
  rock = [0.52, 0.5, 0.41];
const master = (o) => !o.detail,
  low = (o) => o.detail === 'skyline';
const near = (o) => !['skyline', 'district'].includes(o.detail);
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const tint = (c, n) => c.map((v) => v * n),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const face = (o, s, p, c = stone) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c = stone) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function polygon(p) {
  p = p.map((v) => [...v]);
  if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, p, y, s = 'limestone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, s, q, c);
  }
}
function solid(o, p, lo, hi, s = 'limestone', c = stone) {
  p = polygon(p);
  cap(o, p, hi, s, c);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [a[0], hi, a[1]],
        [b[0], hi, b[1]],
        [b[0], lo, b[1]],
      ],
      c,
    );
  }
}
const feature = (id) => polygon(map.mappedFeatures.find((v) => v.id === id).points);
function simplify(p, tolerance = 3) {
  const q = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = q.at(-1),
      b = p[i],
      c = p[i + 1];
    const d =
      Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) /
      (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1);
    if (d > tolerance) q.push(b);
  }
  q.push(p.at(-1));
  return q;
}
function ground(x, z) {
  const p = map.terrainProfile;
  let y = p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i][0]) {
      const t = Math.max(0, (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]));
      y = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      break;
    }
    y = p.at(-1)[1];
  }
  const m = map.ridgeMound,
    r = Math.max(
      0,
      1 - ((x - m.center[0]) / m.radii[0]) ** 2 - ((z - m.center[1]) / m.radii[1]) ** 2,
    );
  // The plan distinguishes a raised Byzantine core and a level eastern court.
  const southDrop = x > 50 && x < 160 ? Math.max(0, z - 18) * 0.22 : 0;
  y += m.height * r - Math.min(8, southDrop);
  let closest = 8,
    target = y;
  const terraces = [
    ...map.components.filter((c) => c.closed !== false),
    ...map.southTowers.map((t) => ({ points: feature(t.featureId), baseY: t.baseY })),
    { points: feature(map.masterTower.featureId), baseY: 42 },
  ];
  for (const c of terraces) {
    let distance = inside(x, z, c.points) ? 0 : Infinity;
    for (let i = 0; i < c.points.length; i++) {
      const a = c.points[i],
        b = c.points[(i + 1) % c.points.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = dx * dx + dz * dz;
      const t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)) : 0;
      distance = Math.min(distance, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
    }
    if (distance < closest) {
      closest = distance;
      target = c.baseY - 0.04;
    }
  }
  return y + (target - y) * (1 - closest / 8);
}
function floorOutline(c) {
  const p = polygon(c.points),
    center = [0, 1].map((k) => p.reduce((s, v) => s + v[k], 0) / p.length),
    pad = (c.thickness ?? 2) * 0.8;
  return p.map((v) => {
    const d = Math.hypot(v[0] - center[0], v[1] - center[1]) || 1;
    return v.map((n, i) => n + ((n - center[i]) / d) * pad);
  });
}
const floors = [
  ...map.components.filter((c) => c.closed !== false),
  ...map.southTowers.map((t) => ({ points: feature(t.featureId), baseY: t.baseY, thickness: 2.7 })),
  {
    points: feature(map.masterTower.featureId),
    baseY: 42,
    thickness: map.masterTower.wallThickness,
  },
].map((c) => ({ ...c, points: floorOutline(c) }));
const floorMasks = floors.flatMap((c) => {
  const ix = earcut(c.points.flat()),
    a = [];
  for (let i = 0; i < ix.length; i += 3) {
    const p = polygon(ix.slice(i, i + 3).map((j) => c.points[j]));
    a.push({
      p,
      min: [0, 1].map((k) => Math.min(...p.map((v) => v[k]))),
      max: [0, 1].map((k) => Math.max(...p.map((v) => v[k]))),
    });
  }
  return a;
});
function halfPlane(p, a, b, keepInside) {
  const result = [],
    side = (v) => (b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0]);
  for (let i = 0; i < p.length; i++) {
    const v = p[i],
      w = p[(i + 1) % p.length],
      sv = side(v),
      sw = side(w),
      iv = keepInside ? sv >= 0 : sv <= 0,
      iw = keepInside ? sw >= 0 : sw <= 0;
    if (iv) result.push(v);
    if (iv !== iw) {
      const t = sv / (sv - sw);
      result.push(mix(v, w, t));
    }
  }
  return result;
}
function outsideFloors(p) {
  let parts = [p];
  const min = [0, 1].map((k) => Math.min(...p.map((v) => v[k]))),
    max = [0, 1].map((k) => Math.max(...p.map((v) => v[k])));
  for (const { p: t, min: a, max: b } of floorMasks) {
    if (a[0] >= max[0] || b[0] <= min[0] || a[1] >= max[1] || b[1] <= min[1]) continue;
    const next = [];
    for (let q of parts) {
      for (let i = 0; i < 3 && q.length > 2; i++) {
        const a = t[i],
          b = t[(i + 1) % 3],
          outside = halfPlane(q, a, b, false);
        if (outside.length > 2 && Math.abs(area(outside)) > 0.00001) next.push(outside);
        q = halfPlane(q, a, b, true);
      }
    }
    parts = next;
    if (!parts.length) break;
  }
  return parts;
}
function terrain(o) {
  const rim = low(o) ? simplify(map.outline, 6) : map.outline;
  // Clip the outline triangulation to a regular grid before evaluating elevations.
  // Earcut's single-point holes are unsuitable for terrain: they create long skinny fans.
  const ix = earcut(rim.flat()),
    pitch = low(o) ? 1000 : near(o) ? 18 : 70;
  function clip(p, axis, value, greater) {
    const result = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        ina = greater ? a[axis] >= value : a[axis] <= value,
        inb = greater ? b[axis] >= value : b[axis] <= value;
      if (ina) result.push(a);
      if (ina !== inb) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        result.push(mix(a, b, t));
      }
    }
    return result;
  }
  for (let k = 0; k < ix.length; k += 3) {
    const triangle = ix.slice(k, k + 3).map((j) => rim[j]);
    const min = [0, 1].map(
      (i) => Math.floor(Math.min(...triangle.map((p) => p[i])) / pitch) * pitch,
    );
    const max = [0, 1].map((i) => Math.max(...triangle.map((p) => p[i])));
    for (let x = min[0]; x < max[0]; x += pitch)
      for (let z = min[1]; z < max[1]; z += pitch) {
        let p = triangle;
        for (const [axis, value, greater] of [
          [0, x, true],
          [0, x + pitch, false],
          [1, z, true],
          [1, z + pitch, false],
        ])
          p = clip(p, axis, value, greater);
        if (p.length < 3 || Math.abs(area(p)) < 0.00001) continue;
        for (const part of near(o) ? outsideFloors(p) : [p])
          for (let j = 1; j < part.length - 1; j++) {
            const v = [part[0], part[j], part[j + 1]];
            if (Math.abs(area(v)) < 0.00001) continue;
            const q = v.map((p) => [p[0], ground(...p), p[1]]);
            if (normalFor(...q)[1] < 0) q.reverse();
            tri(o, 'foliage', q, [0.39, 0.43, 0.27]);
          }
      }
  }
  const p = polygon(rim);
  const feet = p.map((v, i) => {
    const prev = p[(i + p.length - 1) % p.length],
      next = p[(i + 1) % p.length],
      dx = next[1] - prev[1],
      dz = prev[0] - next[0],
      len = Math.hypot(dx, dz) || 1;
    const offset = v[0] > 320 ? 2 : 7 + Math.sin(i * 0.72) * 2;
    return [v[0] + (dx / len) * offset, 0, v[1] + (dz / len) * offset];
  });
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      ya = ground(...a),
      yb = ground(...b),
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (len < 0.1) continue;
    const dx = (b[1] - a[1]) / len,
      dz = (a[0] - b[0]) / len;
    const footA = feet[i],
      footB = feet[(i + 1) % p.length];
    const q = [footA, [a[0], ya, a[1]], [b[0], yb, b[1]], footB];
    for (const inds of [
      [0, 1, 2],
      [2, 3, 0],
    ])
      tri(
        o,
        'weathered',
        inds.map((k) => q[k]),
        tint(rock, 0.88 + (i % 7) * 0.025),
      );
    if (fine(o) && len > 3) {
      const n = Math.max(1, Math.floor(len / 4));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.1) / n,
          u = Math.min(1, t + 0.62 / n),
          yy = 0.24 + ((i * 3 + j * 7) % 8) * 0.065;
        const v = mix(a, b, t),
          w = mix(a, b, u),
          y = (ya + (yb - ya) * t) * yy,
          h = Math.min(3.7, ya * 0.09);
        const r = [
          [v[0] + dx * 2.2, y, v[1] + dz * 2.2],
          [w[0] + dx * 1.9, y + h * 0.3, w[1] + dz * 1.9],
          [w[0] + dx * 1.7, y + h, w[1] + dz * 1.7],
          [v[0] + dx * 1.9, y + h * 0.75, v[1] + dz * 1.9],
        ];
        for (const inds of [
          [0, 1, 2],
          [2, 3, 0],
        ])
          tri(
            o,
            'weathered',
            inds.map((k) => r[k]),
            tint(rock, 0.84 + (j % 5) * 0.027),
          );
      }
    }
  }
  const m = map.moat,
    [a, b] = m.castleLip,
    [c, d] = m.outerLip;
  cap(o, [a, b, d, c], m.floorY, 'aggregate', [0.59, 0.56, 0.47]);
  const dx = d[0] - c[0],
    dz = d[1] - c[1],
    length = Math.hypot(dx, dz),
    nx = dz / length,
    nz = -dx / length;
  const n = low(o) ? 3 : near(o) ? 18 : 7;
  for (let i = 0; i < n; i++) {
    const a = mix(c, d, i / n),
      b = mix(c, d, (i + 1) / n),
      rough = (k) => (low(o) ? 0 : Math.sin((k / n) * 5) * 0.8 + Math.sin((k / n) * 13) * 0.4);
    const ha = m.lipY + rough(i),
      hb = m.lipY + rough(i + 1),
      v = [
        [a[0], m.floorY, a[1]],
        [a[0], ha, a[1]],
        [b[0], hb, b[1]],
        [b[0], m.floorY, b[1]],
      ];
    for (const ids of [
      [0, 1, 2],
      [2, 3, 0],
    ])
      tri(
        o,
        'weathered',
        ids.map((k) => v[k]),
        tint(rock, 0.9 + (i % 4) * 0.035),
      );
    const backA = [a[0] + nx * (18 + rough(i)), 0, a[1] + nz * (18 + rough(i))],
      backB = [b[0] + nx * (18 + rough(i + 1)), 0, b[1] + nz * (18 + rough(i + 1))];
    for (const q of [
      [v[1], backA, backB],
      [backB, v[2], v[1]],
    ]) {
      if (normalFor(...q)[1] < 0) q.reverse();
      tri(o, 'weathered', q, tint(rock, 1.05));
    }
    if (i === 0) tri(o, 'weathered', [v[0], backA, v[1]], rock);
    if (i === n - 1) tri(o, 'weathered', [v[3], v[2], backB], rock);
  }
  if (near(o))
    for (const path of map.paths)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i],
          len = Math.hypot(a[0] - b[0], a[1] - b[1]),
          nx = (b[1] - a[1]) / len,
          nz = (a[0] - b[0]) / len;
        const n = Math.max(1, Math.ceil(len / 2));
        for (let j = 0; j < n; j++) {
          const c = mix(a, b, j / n),
            d = mix(a, b, (j + 1) / n);
          const q = [
            [c[0] + nx, ground(...c) + 0.15, c[1] + nz],
            [d[0] + nx, ground(...d) + 0.15, d[1] + nz],
            [d[0] - nx, ground(...d) + 0.15, d[1] - nz],
            [c[0] - nx, ground(...c) + 0.15, c[1] - nz],
          ];
          for (const ids of [
            [0, 1, 2],
            [2, 3, 0],
          ]) {
            const t = ids.map((k) => q[k]);
            if (normalFor(...t)[1] < 0) t.reverse();
            tri(o, 'aggregate', t, [0.64, 0.6, 0.49]);
          }
        }
      }
}
function arch(x, y, w, h, steps = 10) {
  const p = [
      [x - w / 2, y],
      [x + w / 2, y],
    ],
    spring = y + h - w / 2;
  for (let i = 0; i <= steps; i++) {
    const a = (i * Math.PI) / steps;
    p.push([x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2]);
  }
  return p;
}
function inside(x, y, p) {
  let flag = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      flag = !flag;
  }
  return flag;
}
function facade(o, w, lo, hi, holes = [], slot = 'limestone', c = stone, depth = 1) {
  const rings = [
      [
        [0, lo],
        [w, lo],
        [w, hi],
        [0, hi],
      ],
      ...holes,
    ],
    p = rings.flat(),
    starts = [];
  let n = 4;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ix = earcut(p.flat(), starts);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  if (near(o))
    for (const h of holes) {
      for (let i = 0; i < h.length; i++) {
        const a = h[i],
          b = h[(i + 1) % h.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -depth],
            [a[0], a[1], -depth],
          ],
          trim,
        );
      }
    }
  if (!master(o)) return;
  // Mortar joints and shallow, uneven stone faces; only the master carries individual ashlar.
  const step = 0.59;
  for (let row = 0, y = lo + 0.07; y < hi - 0.25; row++, y += step) {
    for (let k = 0, x = -(row % 2) * 0.46; x < w; k++, x += 1.12) {
      const a = Math.max(0.015, x + 0.027),
        b = Math.min(w - 0.015, x + 1.08),
        top = Math.min(hi - 0.018, y + 0.55);
      if (
        b - a < 0.15 ||
        holes.some((h) =>
          [
            [a, y],
            [b, y],
            [a, top],
            [b, top],
            [(a + b) / 2, (y + top) / 2],
          ].some(([x, y]) => inside(x, y, h)),
        )
      )
        continue;
      const d = 0.025 + ((row * 7 + k * 11) % 5) * 0.012,
        col = tint(c, 0.91 + ((row * 13 + k * 7) % 11) * 0.014);
      face(
        o,
        slot,
        [
          [a, y, d],
          [b, y, d],
          [b, top, d],
          [a, top, d],
        ],
        col,
      );
      face(
        o,
        slot,
        [
          [a, top, d],
          [b, top, d],
          [b, top + 0.035, 0],
          [a, top + 0.035, 0],
        ],
        tint(col, 0.88),
      );
    }
  }
}
function wall(
  o,
  a,
  b,
  base,
  height,
  thickness = 1.8,
  { gate = false, slits = false, rough = true } = {},
) {
  const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (w < 0.05) return;
  const f = edgeFrame(o, a, b),
    h = base + height;
  if (low(o)) {
    face(f, 'limestone', [
      [0, base, thickness / 2],
      [w, base, thickness / 2],
      [w, h, thickness / 2],
      [0, h, thickness / 2],
    ]);
    face(f, 'limestone', [
      [w, base, -thickness / 2],
      [0, base, -thickness / 2],
      [0, h, -thickness / 2],
      [w, h, -thickness / 2],
    ]);
    face(f, 'limestone', [
      [0, h, thickness / 2],
      [w, h, thickness / 2],
      [w, h, -thickness / 2],
      [0, h, -thickness / 2],
    ]);
    return;
  }
  const holes = [];
  if (gate)
    holes.push(
      arch(w / 2, base, Math.min(3.2, w * 0.45), Math.min(5.6, height * 0.75), near(o) ? 12 : 5),
    );
  else if (slits && near(o) && height > 6)
    for (let x = 2.5; x < w - 2; x += 6)
      holes.push([
        [x - 0.17, h - 3.8],
        [x + 0.17, h - 3.8],
        [x + 0.17, h - 2.1],
        [x - 0.17, h - 2.1],
      ]);
  facade(frame(f, 0, 0, thickness / 2), w, base, h, holes, 'limestone', stone, thickness);
  const back = frame(f, w, 0, -thickness / 2, Math.PI),
    backHoles = holes.map((p) => p.map(([x, y]) => [w - x, y]).reverse());
  facade(back, w, base, h, backHoles, 'limestone', tint(stone, 0.92), thickness);
  face(
    f,
    'limestone',
    [
      [0, h, thickness / 2],
      [w, h, thickness / 2],
      [w, h, -thickness / 2],
      [0, h, -thickness / 2],
    ],
    trim,
  );
  for (const x of [0, w]) {
    const q = [
      [x, base, -thickness / 2],
      [x, base, thickness / 2],
      [x, h, thickness / 2],
      [x, h, -thickness / 2],
    ];
    if (x === 0) q.reverse();
    face(f, 'limestone', q);
  }
  if (rough && fine(o)) {
    const n = Math.max(1, Math.ceil(w / (master(o) ? 0.83 : 2.7)));
    for (let i = 0; i < n; i++) {
      const a = (i * w) / n,
        b = ((i + 1) * w) / n,
        ya = h + 0.035 + ((i * 11 + Math.floor(w)) % 13) * 0.022,
        yb = h + 0.035 + (((i + 1) * 11 + Math.floor(w)) % 13) * 0.022,
        t = thickness * 0.48;
      const top = [
        [a, ya, t],
        [b, yb, t],
        [b, yb, -t],
        [a, ya, -t],
      ];
      face(f, 'carved', top, tint(stone, 0.93));
      face(f, 'carved', [[a, h, t], [b, h, t], top[1], top[0]], tint(stone, 0.9));
      face(f, 'carved', [[b, h, -t], [a, h, -t], top[3], top[2]], tint(stone, 0.86));
    }
  }
}
function shell(
  o,
  p,
  base,
  height,
  thickness = 1.8,
  { gate = false, slits = false, roof = false, rough = true } = {},
) {
  p = polygon(p);
  for (let i = 0; i < p.length; i++)
    wall(o, p[(i + 1) % p.length], p[i], base, height, thickness, {
      gate: gate && (i === 0 || i === 2),
      slits,
      rough,
    });
  if (roof) cap(o, p, base + height - 0.35, 'plaster', [0.76, 0.72, 0.6]);
}
function ruined(o, c) {
  const p = c.closed === false ? c.points : polygon(c.points);
  if (low(o)) {
    if (
      c.name.startsWith('Palace') ||
      c.name.startsWith('Courtyard') ||
      c.name.startsWith('Industrial')
    )
      return;
    if (c.closed === false) {
      for (let i = 1; i < p.length; i++) wall(o, p[i - 1], p[i], c.baseY, c.height, c.thickness);
    } else shell(o, simplify(p, 1), c.baseY, c.height, c.thickness);
    return;
  }
  for (let i = 0; i < p.length - (c.closed === false ? 1 : 0); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      height = c.edgeHeights?.[i] ?? c.height * (0.83 + (i % 3) * 0.085);
    wall(o, b, a, c.baseY, height, c.thickness, { gate: c.kind === 'chapel' && i === 0 });
  }
  if (fine(o) && c.height < 8 && c.closed !== false) {
    const a = p[0],
      b = p[1],
      f = edgeFrame(o, a, b),
      length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (let k = 0; k < length; k += master(o) ? 1.8 : 4.3) {
      const z = c.thickness + 1 + ((Math.floor(k) * 17) % 7) * 0.22;
      box(
        f,
        'weathered',
        [k, c.baseY, z],
        [k + 0.5, c.baseY + 0.18 + (k % 3) * 0.07, z + 0.43],
        tint(rock, 0.94),
      );
    }
  }
}
function localRect(o, p) {
  const a = p[0],
    b = p[1],
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    f = edgeFrame(o, a, b);
  const dx = (b[0] - a[0]) / w,
    dz = (b[1] - a[1]) / w;
  const zz = p.map((v) => (v[0] - a[0]) * -dz + (v[1] - a[1]) * dx),
    min = Math.min(...zz),
    max = Math.max(...zz);
  return { f: frame(f, 0, 0, min), w, d: max - min };
}
function barrel(o, f, w, d, base, rise, slot = 'limestone', c = stone) {
  const n = low(o) ? 4 : near(o) ? 20 : 8,
    rings = [0, d].map((z) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = (i * Math.PI) / n;
        return [w / 2 - (Math.cos(t) * w) / 2, base + Math.sin(t) * rise, z];
      }),
    );
  for (let i = 0; i < n; i++) {
    const q = [rings[0][i], rings[1][i], rings[1][i + 1], rings[0][i + 1]];
    face(f, slot, q, c);
  }
  if (fine(o))
    for (let j = 0; j < n; j++) {
      const a = rings[0][j],
        b = rings[0][j + 1],
        q = [
          [a[0], a[1] - 0.5, 0],
          [b[0], b[1] - 0.5, 0],
          [b[0], b[1] - 0.5, d],
          [a[0], a[1] - 0.5, d],
        ];
      face(f, slot, q, tint(c, 0.88));
    }
  for (const z of [0, d])
    for (let i = 0; i < n; i++) {
      const q = [[w / 2, base, z], rings[z === 0 ? 0 : 1][i], rings[z === 0 ? 0 : 1][i + 1]];
      if (normalFor(...q)[2] > 0 !== (z === d)) q.reverse();
      tri(f, slot, q, c);
    }
}
function cistern(o, c) {
  const { f, w, d } = localRect(o, c.points);
  const rise = Math.min(w, d) * 0.3,
    base = c.baseY + c.height - rise;
  solid(o, c.points, c.baseY, base, 'limestone', stone);
  barrel(o, f, w, d, base, rise);
  if (near(o)) {
    for (const z of [d * 0.3, d * 0.7])
      box(
        f,
        'recess',
        [w * 0.44, base + rise - 0.03, z - 0.5],
        [w * 0.57, base + rise + 0.04, z + 0.5],
        [0.15, 0.15, 0.12],
      );
  }
}
function hall(o, c) {
  const p = polygon(c.points);
  shell(o, p, c.baseY, c.height, c.thickness, { slits: true, roof: !near(o) });
  if (!near(o)) return;
  const { f, w, d } = localRect(o, c.points),
    cols = 3,
    rows = 4,
    cellX = w / cols,
    cellZ = d / rows;
  // The roof's cross-vault cells share piers; both intrados and terrace remain modeled.
  for (let i = 1; i < cols; i++)
    for (let j = 1; j < rows; j++)
      box(
        f,
        'limestone',
        [i * cellX - 0.9, c.baseY, j * cellZ - 0.9],
        [i * cellX + 0.9, c.baseY + 5.5, j * cellZ + 0.9],
        stone,
      );
  const n = master(o) ? 10 : 4;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      for (let u = 0; u < n; u++)
        for (let v = 0; v < n; v++) {
          const pts = [
            [u, v],
            [u + 1, v],
            [u + 1, v + 1],
            [u, v + 1],
          ].map(([u, v]) => {
            const x = u / n,
              z = v / n;
            const rise =
              Math.max(
                Math.sqrt(Math.max(0, 1 - (x * 2 - 1) ** 2)),
                Math.sqrt(Math.max(0, 1 - (z * 2 - 1) ** 2)),
              ) * 2.7;
            return [(i + x) * cellX, c.baseY + 5.4 + rise, (j + z) * cellZ];
          });
          for (const ids of [
            [0, 1, 2],
            [2, 3, 0],
          ]) {
            const q = ids.map((k) => pts[k]);
            if (normalFor(...q)[1] > 0) q.reverse();
            tri(f, 'limestone', q, tint(stone, 0.92));
          }
        }
    }
  cap(o, p, c.baseY + c.height - 0.3, 'plaster', [0.74, 0.69, 0.55]);
}
function roofed(o, c) {
  if (low(o)) {
    solid(o, c.points, c.baseY, c.baseY + c.height);
    return;
  }
  shell(o, c.points, c.baseY, c.height, c.thickness, {
    roof: !c.ruinedTower,
    gate: c.kind === 'gate',
    slits: c.kind === 'tower' || c.kind === 'gate',
    rough: c.kind !== 'mosque',
  });
  if (c.kind === 'mosque' && near(o)) {
    const { f, w } = localRect(o, c.points);
    // Small paired windows and a separate mihrab projection on the south elevation.
    for (const x of [w * 0.22, w * 0.5, w * 0.78]) {
      box(
        f,
        'recess',
        [x - 0.28, c.baseY + 2.2, -c.thickness / 2 - 0.065],
        [x + 0.28, c.baseY + 3.25, -c.thickness / 2 - 0.025],
        [0.16, 0.16, 0.13],
      );
    }
    const mid = mix(c.points[2], c.points[3], 0.5);
    loft(
      o,
      'limestone',
      [
        radialRing(c.baseY, 1, 1, near(o) ? 16 : 8, mid),
        radialRing(c.baseY + 3.9, 1, 1, near(o) ? 16 : 8, mid),
      ],
      stone,
    );
  }
}
function minaret(o, c) {
  if (low(o)) {
    solid(o, c.points, c.baseY, c.baseY + c.height);
    return;
  }
  const p = polygon(c.points),
    h = c.baseY + c.height;
  solid(o, p, c.baseY, h - 2.3, 'limestone', stone);
  const center = [0, 1].map((k) => p.reduce((s, q) => s + q[k], 0) / p.length),
    scale = (v) => p.map((q) => q.map((n, i) => center[i] + (n - center[i]) * v));
  solid(o, scale(1.12), h - 2.6, h - 2.25, 'carved', trim);
  shell(o, p, h - 2.25, 1.95, 0.48, { gate: true, rough: false });
  cap(o, scale(1.03), h, 'metal', [0.26, 0.3, 0.28]);
  if (near(o))
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        w = Math.hypot(a[0] - b[0], a[1] - b[1]),
        f = edgeFrame(o, b, a);
      for (const y of [c.baseY + 4.8, c.baseY + 10, c.baseY + 14])
        box(
          f,
          'recess',
          [w / 2 - 0.15, y, 0.035],
          [w / 2 + 0.15, y + 1.1, 0.06],
          [0.13, 0.14, 0.12],
        );
      if (master(o)) facade(frame(f, 0, 0, 0.015), w, c.baseY, h - 2.7, [], 'limestone', stone);
    }
}
function bath(o, c) {
  roofed(o, c);
  if (!near(o)) return;
  const { f, w, d } = localRect(o, c.points),
    rows = c.name.includes('hot') ? 3 : 1;
  for (let j = 0; j < rows; j++) {
    const cx = w * 0.5,
      cz = (d * (j + 0.5)) / rows,
      r = Math.min(w * 0.28, (d / rows) * 0.29);
    const n = master(o) ? 24 : 12,
      rings = [];
    for (let k = 0; k <= 5; k++) {
      const t = (k * Math.PI) / 12;
      rings.push(
        radialRing(
          c.baseY + c.height - 0.2 + Math.sin(t) * r * 0.7,
          Math.cos(t) * r,
          Math.cos(t) * r,
          n,
          [cx, cz],
        ),
      );
    }
    loft(f, 'plaster', rings, [0.73, 0.68, 0.55]);
    if (fine(o))
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        box(
          f,
          'recess',
          [
            cx + Math.cos(a) * r * 0.47 - 0.12,
            c.baseY + c.height + r * 0.56,
            cz + Math.sin(a) * r * 0.47 - 0.12,
          ],
          [
            cx + Math.cos(a) * r * 0.47 + 0.12,
            c.baseY + c.height + r * 0.56 + 0.025,
            cz + Math.sin(a) * r * 0.47 + 0.12,
          ],
          [0.15, 0.14, 0.12],
        );
      }
  }
}
function portico(o, c) {
  if (low(o)) return;
  const { f, w, d } = localRect(o, c.points),
    n = Math.max(2, Math.round(w / 4.5));
  if (!near(o)) {
    solid(o, c.points, c.baseY, c.baseY + c.height, 'limestone', stone);
    return;
  }
  const holes = Array.from({ length: n }, (_, i) =>
    arch(((i + 0.5) * w) / n, c.baseY, w / n - 0.85, c.height - 0.35, master(o) ? 12 : 6),
  );
  facade(frame(f, 0, 0, -0.2), w, c.baseY, c.baseY + c.height, holes, 'limestone', stone, 0.7);
  facade(
    frame(f, w, 0, d + 0.2, Math.PI),
    w,
    c.baseY,
    c.baseY + c.height,
    holes,
    'limestone',
    stone,
    0.7,
  );
  for (let i = 0; i <= n; i++)
    box(
      f,
      'limestone',
      [Math.max(0, (i * w) / n - 0.38), c.baseY, 0],
      [Math.min(w, (i * w) / n + 0.38), c.baseY + c.height - 0.5, d],
      stone,
    );
  cap(o, c.points, c.baseY + c.height, 'plaster', [0.74, 0.71, 0.6]);
}
function roundTower(o, t) {
  const n = low(o) ? 6 : near(o) ? 32 : 10,
    levels = [
      [t.baseY, t.radius * 1.08],
      [t.baseY + 3, t.radius],
      [t.topY, t.radius],
    ];
  loft(
    o,
    'limestone',
    levels.map(([y, r]) => radialRing(y, r, r, n, t.center)),
    stone,
  );
  if (near(o)) {
    const [x, z] = t.center;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        f = frame(o, x + Math.sin(a) * t.radius, 0, z + Math.cos(a) * t.radius, a);
      box(
        f,
        'recess',
        [-0.13, t.topY - 3.5, 0.018],
        [0.13, t.topY - 1.9, 0.05],
        [0.13, 0.14, 0.12],
      );
    }
    if (master(o))
      for (let j = 0, y = t.baseY + 0.3; y < t.topY - 0.3; y += 0.62, j++)
        for (let i = 0; i < n; i++) {
          const a = ((i + (j % 2) * 0.5) * Math.PI * 2) / n,
            b = a + (Math.PI * 2) / n - 0.012,
            r = t.radius + 0.04;
          face(
            o,
            'limestone',
            [
              [x + Math.sin(a) * r, y, z + Math.cos(a) * r],
              [x + Math.sin(b) * r, y, z + Math.cos(b) * r],
              [x + Math.sin(b) * r, y + 0.56, z + Math.cos(b) * r],
              [x + Math.sin(a) * r, y + 0.56, z + Math.cos(a) * r],
            ],
            tint(stone, 0.9 + ((i + j * 3) % 9) * 0.019),
          );
        }
  }
}
function fortifications(o) {
  const p = low(o) ? simplify(map.outline, 6) : map.outline;
  // The western town walls survive at lower, broken heights. No continuous fantasy crenels.
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      x = (a[0] + b[0]) / 2;
    if (x > 285 || (x > 184 && (a[1] + b[1]) / 2 > 25)) continue;
    const y = Math.min(ground(...a), ground(...b)) - 0.3;
    wall(o, b, a, y, x < -80 ? 1.7 : x < 45 ? 3.8 : 3.1, x < -80 ? 1.5 : 2.1);
  }
  const m = map.masterTower,
    mp = feature(m.featureId);
  if (low(o)) solid(o, mp, m.baseY, m.topY);
  else shell(o, mp, m.baseY, m.topY - m.baseY, m.wallThickness, { roof: true, slits: true });
  // Shallow roof parapets, irregular wall heads and the exceptionally thick keep envelope.
  if (near(o)) {
    const p = polygon(mp);
    for (let i = 0; i < p.length; i++)
      wall(o, p[(i + 1) % p.length], p[i], m.topY, master(o) ? 0.85 : 0.65, 1.25, { rough: true });
  }
  for (const t of map.southTowers) {
    if (low(o)) solid(o, feature(t.featureId), t.baseY, t.topY);
    else
      shell(o, feature(t.featureId), t.baseY, t.topY - t.baseY, t.gate ? 2.7 : 2.1, {
        gate: t.gate,
        roof: !t.gate,
        slits: true,
      });
  }
  for (const t of map.roundTowers) roundTower(o, t);
  const n = map.needle,
    points = low(o) ? 5 : near(o) ? 18 : 8;
  loft(
    o,
    'weathered',
    [
      [n.baseY, n.radius * 1.4],
      [n.baseY + 9, n.radius * 0.94],
      [n.topY - n.masonryCapHeight, n.radius * 0.56],
    ].map(([y, r]) => radialRing(y, r, r * 0.78, points, n.center)),
    rock,
  );
  const [x, z] = n.center;
  box(
    o,
    'limestone',
    [x - 1.15, n.topY - n.masonryCapHeight, z - 0.95],
    [x + 1.15, n.topY, z + 0.95],
    stone,
  );
  if (fine(o))
    for (let y = n.topY - n.masonryCapHeight + 0.4; y < n.topY; y += 0.6)
      box(o, 'carved', [x - 1.18, y, z - 0.98], [x + 1.18, y + 0.08, z + 0.98], tint(stone, 0.8));
}
function fountain(o) {
  if (!near(o)) return;
  const q = map.fountain,
    n = master(o) ? 32 : 16,
    r = q.radius,
    [x, z] = q.center;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = [
      [x + Math.cos(a) * r, z + Math.sin(a) * r],
      [x + Math.cos(b) * r, z + Math.sin(b) * r],
      [x + Math.cos(b) * (r - 0.2), z + Math.sin(b) * (r - 0.2)],
      [x + Math.cos(a) * (r - 0.2), z + Math.sin(a) * (r - 0.2)],
    ];
    solid(o, p, q.baseY, q.baseY + 0.38, 'carved', trim);
  }
  cap(
    o,
    radialRing(q.baseY, r - 0.2, r - 0.2, n, q.center).map((v) => [v[0], v[2]]),
    q.baseY + 0.025,
    'aggregate',
    [0.58, 0.54, 0.43],
  );
  box(o, 'carved', [x - 0.19, q.baseY, z - 0.19], [x + 0.19, q.baseY + 0.55, z + 0.19], trim);
}
export function buildSalahRuntime(out, detail) {
  const o = {
    detail,
    addQuad: (...v) => out.addQuad(...v),
    addTriangle: (...v) => out.addTriangle(...v),
    addConvexPolygon: (...v) => out.addConvexPolygon(...v),
  };
  terrain(o);
  if (near(o)) for (const c of floors) solid(o, c.points, c.baseY - 8, c.baseY, 'weathered', rock);
  fortifications(o);
  for (const c of map.components) {
    if (low(o) && ['portico', 'bath'].includes(c.kind)) continue;
    if (c.kind === 'cistern') cistern(o, c);
    else if (c.kind === 'hall') hall(o, c);
    else if (c.kind === 'minaret') minaret(o, c);
    else if (c.kind === 'bath') bath(o, c);
    else if (c.kind === 'portico') portico(o, c);
    else if (['gate', 'mosque', 'tower', 'terrace'].includes(c.kind)) roofed(o, c);
    else ruined(o, c);
  }
  fountain(o);
}
export const buildSalahSkyline = (o) => buildSalahRuntime(o, 'skyline');
export const salahStudy = {
  id: 'N0257',
  key: 'citadel_of_salah_ed_din',
  title: 'Citadel of Salah Ed-Din',
  category: 'castle',
  wikidataId: 'Q277531',
  mapFrame: 'map-frame.json',
  build: (o) => buildSalahRuntime(o),
  brief:
    'Syrian citadel exterior on its long rocky ridge: square master tower, pillared hall, round front towers, open eastern moat with isolated needle, low western town walls, raised Byzantine ruins, cisterns, Ayyubid courtyard and baths, mosque and square minaret.',
  sourceFacts: {
    identity: 'Q277531, exact OSM relation/5579293',
    mappedEnvelopeMeters: [708.034, 154.522],
    masterTowerSideMeters: 24,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis: 'Mapped ridge and tower footprints with interpreted AKTC phased site and palace plans.',
    referenceState:
      'Conserved and ruined exterior documented by AKTC and the UNESCO nomination. Recent collapse and repairs are recorded as unresolved condition differences, not silently reconstructed as an intact medieval castle.',
  },
  scaleBasis:
    'Mapped horizontal meters; approximate primary-plan registration. Relative terrain and wall heights inferred from photographs; not surveyed.',
  refs: [
    'https://www.openstreetmap.org/relation/5579293',
    'https://s3.amazonaws.com/media.archnet.org/system/publications/contents/6721/original/DPC3576.pdf?1384801256=',
    'https://whc.unesco.org/document/168916',
    'https://whc.unesco.org/document/226794',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Original authored geometry informed by cited conservation plans; no third-party images or meshes embedded.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X toward the eastern moat, 24.466 degrees north of east',
    front: 'Master tower and rock-cut ditch toward +X; lower western ward toward -X',
    origin: 'Mapped ridge anchor; model base Y=0, eastern court Y=42',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft: bedrock terrain and precise orientation fit pending',
    notes:
      'Includes site rock and moat; does not include nearby modern village or a reconstructed drawbridge.',
  }),
  geographicNote:
    'Signed native map frame preserves known tower positions. Model terrain is relative and must be fitted to world terrain before approval.',
  limitations: [
    'Maximum exterior fidelity remains pending: exact ruin profiles, recently collapsed entrance roof and propping, chamber openings and masonry scars need additional current photographic review.',
    'Palace and unmapped walls are approximate plan traces; inferred terrain and levels require in-world review. replaceFootprint=false.',
    'This exterior includes visible vault and courtyard geometry, not a complete navigable interior. No reference photographs or bitmap textures are embedded.',
    'Detailed master plus four independent runtime models share reusable stone, plaster, metal and gravel surfaces. Physical laptop and phone tests remain pending.',
  ],
  camera: { position: [565, 305, 425], lookAt: [85, 31, 0], fov: 44 },
  qaCameras: [
    { name: 'whole-ridge-and-lower-town', position: [-65, 740, 25], lookAt: [-15, 20, 15] },
    { name: 'master-tower-and-rock-cut-moat', position: [430, 105, 104], lookAt: [340, 37, 8] },
    { name: 'needle-and-frankish-gate', position: [397, 52, -62], lookAt: [354, 34, -26] },
    { name: 'eastern-curtain-and-pillared-hall', position: [393, 71, 130], lookAt: [322, 47, 46] },
    { name: 'ayyubid-palace-and-courtyard', position: [261, 91, 45], lookAt: [215, 44, 6] },
    { name: 'mosque-square-minaret-and-baths', position: [262, 58, 67], lookAt: [223, 49, 24] },
    { name: 'byzantine-fortress-and-chapel', position: [83, 95, 58], lookAt: [147, 53, -6] },
    { name: 'north-cistern-and-inner-ramparts', position: [274, 81, -115], lookAt: [202, 45, -25] },
    { name: 'western-town-chapel-and-gates', position: [-157, 83, 95], lookAt: [-73, 27, 6] },
  ],
};
