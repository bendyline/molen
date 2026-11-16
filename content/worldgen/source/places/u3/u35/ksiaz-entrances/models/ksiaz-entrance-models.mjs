/** Independent source-specific forecourt components; ksiaz_castle_and_park_complex remains a partial site. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const ksiazEntranceModels = [
  { id: 'KSI_A01', key: 'ksiaz_gatehouse', title: 'Książ gatehouse', way: 236837152 },
  { id: 'KSI_A02', key: 'ksiaz_north_officina', title: 'Książ northern side wing', way: 236837153 },
  { id: 'KSI_A03', key: 'ksiaz_south_officina', title: 'Książ southern side wing', way: 236837154 },
  { id: 'KSI_A04', key: 'ksiaz_zamkowy_hotel', title: 'Hotel Zamkowy at Książ', way: 236837151 },
];
export const ksiazEntranceSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  sandstoneTread: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.88, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.7 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
};
export const ksiazEntrancePalette = {
  wall: '#e9ce98',
  trim: '#eee5cd',
  stone: '#c9b392',
  roof: '#a85d48',
  bronze: '#817466',
  glass: '#4d6178',
  door: '#967556',
};
const colors = Object.fromEntries(
  Object.entries(ksiazEntrancePalette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const frames = new Map(
  ksiazEntranceModels.map((model) => [
    model.key,
    JSON.parse(readFileSync(new URL(`../../${model.key}/map-frame.json`, import.meta.url))),
  ]),
);
const means = JSON.parse(
  readFileSync(new URL('../../ksiaz_castle_and_park_complex/surface-means.json', import.meta.url)),
);
function face(o, p, color = 'wall', slot = 'plaster', target) {
  p = p.map((v) => v.map(Math.fround));
  if (target && normalFor(...p.slice(0, 3)).reduce((n, v, i) => n + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const triangle = [p[0], p[i], p[i + 1]],
      normal = normalFor(...triangle);
    if (Math.hypot(...normal) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      triangle,
      normal,
      triangle.map((v) => [v[0], v[1]]),
      colors[color],
    );
  }
}
function local(o, center, angle = 0) {
  const rotate = ([x, y, z]) => [
    x * Math.cos(angle) + z * Math.sin(angle),
    y,
    -x * Math.sin(angle) + z * Math.cos(angle),
  ];
  return {
    addTriangle: (s, r, p, n, uv, col) =>
      o.addTriangle(
        s,
        r,
        p.map((v) => {
          const q = rotate(v);
          return [q[0] + center[0], q[1], q[2] + center[1]];
        }),
        rotate(n),
        uv,
        col,
      ),
  };
}
function box(o, x, y, z, w, h, depth, color = 'trim', slot = 'plaster') {
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
    face(o, p, color, slot, n);
}
function hip(o, x, y, z, w, depth, rise) {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    inset = Math.min(depth / 2, w * 0.28),
    r0 = [a + inset, y + rise, z],
    r1 = [b - inset, y + rise, z];
  for (const p of [
    [[a, y, u], [b, y, u], r1, r0],
    [[b, y, v], [a, y, v], r0, r1],
    [[a, y, v], [a, y, u], r0],
    [[b, y, u], [b, y, v], r1],
  ])
    face(o, p, 'roof', 'tile', [0, 1, 0]);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((n, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
}
function cap(o, loop, y, color = 'wall', slot = 'plaster', normal = [0, 1, 0]) {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], y, loop[k][1]]),
      color,
      slot,
      normal,
    );
}
function pane(o, x, y, z, w, h, d, arched = false) {
  const p = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
  ];
  if (arched) {
    p.push([x + w / 2, y + h - w / 2, z]);
    const n = d >= 2 ? 6 : 4;
    for (let i = 1; i <= n; i++) {
      const a = (i * Math.PI) / n;
      p.push([x + (Math.cos(a) * w) / 2, y + h - w / 2 + (Math.sin(a) * w) / 2, z]);
    }
  } else p.push([x + w / 2, y + h, z], [x - w / 2, y + h, z]);
  face(o, p, 'glass', 'glass', [0, 0, z < 0 ? -1 : 1]);
  if (d >= 2) {
    box(o, x, y - 0.25, z, w + 0.4, 0.25, 0.24);
    box(o, x, y + h, z, w + 0.4, 0.22, 0.24);
    if (d === 3) box(o, x, y, z, 0.14, h, 0.14);
  }
}
function profile(o, center, levels, n, color, slot) {
  const rings = levels.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => [
      center[0] + r * Math.cos((i * Math.PI * 2) / n),
      y,
      center[1] + r * Math.sin((i * Math.PI * 2) / n),
    ]),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = rings[j - 1][i],
        b = rings[j - 1][k];
      face(o, [a, b, rings[j][k], rings[j][i]], color, slot, [
        (a[0] + b[0]) / 2 - center[0],
        0,
        (a[2] + b[2]) / 2 - center[1],
      ]);
    }
  cap(
    o,
    rings.at(-1).map((v) => [v[0], v[2]]),
    levels.at(-1)[0],
    color,
    slot,
  );
}
// Convex clipping builds a joined pitched surface over each component's own mapped ring.
function joinedRoofs(o, loop, base, patches, _d, wallColor = 'wall', closeRaisedEdges = false) {
  const eps = 1e-7;
  function clip(p, signed) {
    const result = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        da = signed(a),
        db = signed(b);
      if (da >= -eps) result.push(a);
      if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
        const t = da / (da - db);
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return result;
  }
  function lines(p) {
    const s = winding(p);
    return p.map((a, i) => {
      const b = p[(i + 1) % p.length];
      return (q) => s * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
    });
  }
  function intersection(p, cut) {
    for (const line of lines(cut)) p = clip(p, line);
    return p;
  }
  function area(p) {
    return (
      Math.abs(
        p.reduce((n, a, i) => {
          const b = p[(i + 1) % p.length];
          return n + a[0] * b[1] - b[0] * a[1];
        }, 0),
      ) / 2
    );
  }
  function subtract(p, cut) {
    const out = [];
    for (const line of lines(cut)) {
      const outside = clip(p, (q) => -line(q));
      if (outside.length >= 3 && area(outside) > eps) out.push(outside);
      p = clip(p, line);
      if (p.length < 3) break;
    }
    return out;
  }
  const surfaces = [];
  const capture = {
    addTriangle: (_s, _r, p) => {
      const [a, b, c] = p,
        n = normalFor(a, b, c);
      if (Math.abs(n[1]) < eps) return;
      surfaces.push({
        poly: p.map((v) => [v[0], v[2]]),
        height: (q) => a[1] - (n[0] * (q[0] - a[0]) + n[2] * (q[1] - a[2])) / n[1],
      });
    },
  };
  for (const [x, y, z, w, depth, rise, angle = 0, shape = 'hip'] of patches) {
    const roof = local(capture, [x, z], angle);
    if (shape === 'gable') {
      for (const side of [-1, 1])
        face(
          roof,
          [
            [0, y + rise, -depth / 2],
            [(side * w) / 2, y, -depth / 2],
            [(side * w) / 2, y, depth / 2],
            [0, y + rise, depth / 2],
          ],
          'roof',
          'tile',
          [0, 1, 0],
        );
    } else hip(roof, 0, y, 0, w, depth, rise);
  }
  const ix = earcut(loop.flat()),
    plan = [];
  for (let i = 0; i < ix.length; i += 3) plan.push(ix.slice(i, i + 3).map((k) => loop[k]));
  for (const poly of plan) surfaces.push({ poly, height: () => base });
  const outsidePlanes = closeRaisedEdges
    ? surfaces.map((surface) => ({ ...surface, edges: lines(surface.poly) }))
    : [];
  function closeRoofReturn(a, b, current, edgeSign) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.00001) return;
    const normal = [(edgeSign * dz) / length, 0, (-edgeSign * dx) / length];
    const across = [(a[0] + b[0]) / 2 + 0.001 * normal[0], (a[1] + b[1]) / 2 + 0.001 * normal[2]];
    const neighbor = outsidePlanes.filter((plane) =>
      plane.edges.every((edge) => edge(across) >= -eps),
    );
    const upper = (p) => current.height(p);
    const lower = (p) =>
      Math.min(upper(p), Math.max(base, ...neighbor.map((plane) => plane.height(p))));
    if (Math.max(upper(a) - lower(a), upper(b) - lower(b)) < 0.015) return;
    face(
      o,
      [
        [a[0], lower(a), a[1]],
        [b[0], lower(b), b[1]],
        [b[0], upper(b), b[1]],
        [a[0], upper(a), a[1]],
      ],
      wallColor,
      'plaster',
      normal,
    );
  }
  for (let i = 0; i < surfaces.length; i++) {
    const current = surfaces[i];
    let pieces = [current.poly];
    for (let j = 0; j < surfaces.length && pieces.length; j++) {
      if (i === j) continue;
      const other = surfaces[j],
        cut = clip(other.poly, (q) => other.height(q) - current.height(q) - (j < i ? -eps : eps));
      if (cut.length < 3 || area(cut) < eps) continue;
      pieces = pieces.flatMap((p) => (area(intersection(p, cut)) < eps ? [p] : subtract(p, cut)));
    }
    for (const piece of pieces)
      for (const triangle of plan) {
        const p = intersection(piece, triangle);
        if (p.length < 3 || area(p) < eps) continue;
        face(
          o,
          p.map((v) => [v[0], current.height(v), v[1]]),
          'roof',
          'tile',
          [0, 1, 0],
        );
        for (let k = 0; k < p.length; k++) {
          let boundary = false;
          for (let m = 0; m < loop.length; m++) {
            const a = p[k],
              b = p[(k + 1) % p.length],
              u = loop[m],
              v = loop[(m + 1) % loop.length],
              dx = v[0] - u[0],
              dz = v[1] - u[1],
              l2 = dx * dx + dz * dz;
            if (l2 < eps) continue;
            const on = (q) =>
              Math.abs(dx * (q[1] - u[1]) - dz * (q[0] - u[0])) / Math.sqrt(l2) < 1e-5 &&
              (q[0] - u[0]) * dx + (q[1] - u[1]) * dz >= -eps &&
              (q[0] - u[0]) * dx + (q[1] - u[1]) * dz <= l2 + eps;
            if (!on(a) || !on(b)) continue;
            boundary = true;
            if (Math.max(current.height(a), current.height(b)) > base + eps)
              face(
                o,
                [
                  [a[0], base, a[1]],
                  [b[0], base, b[1]],
                  [b[0], current.height(b), b[1]],
                  [a[0], current.height(a), a[1]],
                ],
                wallColor,
                'plaster',
                [winding(loop) * dz, 0, -winding(loop) * dx],
              );
          }
          if (closeRaisedEdges && !boundary)
            closeRoofReturn(p[k], p[(k + 1) % p.length], current, winding(p));
        }
      }
  }
}
function body(
  o,
  loop,
  height,
  d,
  { raisedEnds = false, color = 'wall', skipPane = () => false, entry } = {},
) {
  const sign = winding(loop);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.1) continue;
    const normal = [sign * dz, 0, -sign * dx];
    const point = (s, y) => {
      const p =
        s === 0 ? a : s === length ? b : [a[0] + (s * dx) / length, a[1] + (s * dz) / length];
      return [p[0], y, p[1]];
    };
    const panel = (start, end, low, high) =>
      face(
        o,
        [point(start, low), point(end, low), point(end, high), point(start, high)],
        color,
        'plaster',
        normal,
      );
    const offset = entry?.center.map((v, k) => v - a[k]);
    const along = offset && (offset[0] * dx + offset[1] * dz) / length;
    const cutEntry =
      d &&
      offset &&
      Math.abs((offset[0] * dz - offset[1] * dx) / length) < 0.001 &&
      along > 0.9 &&
      along < length - 0.9;
    if (cutEntry) {
      panel(0, along - 0.9, 0, height);
      panel(along + 0.9, length, 0, height);
      panel(along - 0.9, along + 0.9, 3, height);
      panel(along - 0.9, along + 0.9, 0, 0.1);
    } else panel(0, length, 0, height);
    if (d === 0 || length < 5) continue;
    const q = local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], -Math.atan2(dz, dx)),
      n = Math.max(1, Math.floor(length / (d === 1 ? 8 : 4.3)));
    for (let k = 0; k < n; k++) {
      const x = -length / 2 + ((k + 0.5) * length) / n,
        worldX = (a[0] + b[0]) / 2 + (x * dx) / length,
        worldZ = (a[1] + b[1]) / 2 + (x * dz) / length;
      for (const y of raisedEnds && Math.abs(worldX) < 14 ? [1.2] : [1.2, 6.4])
        if (!skipPane(worldX, worldZ, y)) pane(q, x, y, -sign * 0.07, 1.35, y > 5 ? 2.2 : 2.7, d);
    }
    if (d >= 2) {
      const spans = cutEntry
        ? [
            [0, along - 0.9],
            [along + 0.9, length],
          ]
        : [[0, length]];
      for (const [start, end] of spans)
        box(
          q,
          (start + end - length) / 2,
          0.2,
          -sign * 0.05,
          end - start,
          0.3,
          0.18,
          'stone',
          'sandstone',
        );
    }
  }
  cap(o, loop, height, color);
}
function bounds(loop) {
  return {
    min: [0, 1].map((i) => Math.min(...loop.map((p) => p[i]))),
    max: [0, 1].map((i) => Math.max(...loop.map((p) => p[i]))),
  };
}
function buildGatehouse(o, frame, d) {
  const loop = frame.geometry.outline.slice(0, -1),
    c = frame.controls;
  // Round map end bays are carried by low masonry; octagonal upper tower profiles are photographic.
  body(o, loop, c.bodyHeight, d, {
    color: 'trim',
    skipPane: (x, z) =>
      x > 4 || c.towerCenters.some((p) => Math.hypot(x - p[0], z - p[1]) < c.towerRadius + 0.6),
  });
  joinedRoofs(o, loop, c.bodyHeight, [[0, c.bodyHeight, 0, 32, 12, 5, Math.PI / 2]], d, 'trim');
  for (const p of c.towerCenters) {
    profile(
      o,
      p,
      [
        [c.bodyHeight, c.towerRadius],
        [15, c.towerRadius],
      ],
      d === 0 ? 6 : 8,
      'trim',
      'plaster',
    );
    profile(
      o,
      p,
      [
        [15, 4.65],
        [17.5, 3.7],
        [19.2, 2.35],
        [20.5, 2.15],
        [22, 0.18],
      ],
      d === 0 ? 6 : 8,
      'bronze',
      'bronze',
    );
    if (d >= 1)
      for (const k of [0, 1, 2, 3]) {
        // Pane planes coincide with octagonal faces, rather than tangent vertices.
        const phi = Math.PI / 8 + (k * Math.PI) / 2,
          q = local(o, p, Math.PI / 2 - phi),
          radius = c.towerRadius * Math.cos(Math.PI / 8);
        pane(q, 0, 9, radius + 0.07, 1.15, 2.5, d);
        // Lower round bays use their mapped walls; an upper octagon's pane would be buried here.
        const mapped = radialBoundary(loop, p, phi, c.towerRadius + 1.5);
        if (mapped) pane(local(o, mapped.center, mapped.angle), 0, 3, 0.08, 1.15, 2.5, d);
        if (d >= 2) box(q, 0, 14.6, radius, 3.5, 0.45, 0.3);
      }
  }
  const q = local(o, [5.8, 0], Math.PI / 2);
  // Central library facade has a tall arched window and shallow arched pediment.
  if (d >= 1) {
    pane(q, 0, 3.1, 0.08, 3.5, 5.5, d, true);
    face(
      q,
      [
        [-5, 9, 0.2],
        [5, 9, 0.2],
        [4, 10.2, 0.2],
        [2, 11.3, 0.2],
        [0, 11.7, 0.2],
        [-2, 11.3, 0.2],
        [-4, 10.2, 0.2],
      ],
      'trim',
      'plaster',
      [0, 0, 1],
    );
    for (const z of [-10, -6, 6, 10]) {
      const [edgeX, angle] = boundaryAt(loop, 1, z, 1),
        bay = local(o, [edgeX, z], angle);
      for (const y of [1.2, 6.4]) pane(bay, 0, y, 0.08, 1.4, y > 5 ? 2.2 : 2.7, d);
    }
    if (d >= 2) {
      for (const x of [-2.25, 2.25]) box(q, x, 0, 0.2, 0.4, 9, 0.35);
      box(q, 0, 9, 0.22, 10, 0.35, 0.35);
    }
  }
}
function radialBoundary(loop, center, phi, maxDistance) {
  const dx = Math.cos(phi),
    dz = Math.sin(phi),
    hits = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      ex = b[0] - a[0],
      ez = b[1] - a[1],
      ax = a[0] - center[0],
      az = a[1] - center[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-6) continue;
    const distance = (ax * ez - az * ex) / den,
      t = (ax * dz - az * dx) / den;
    if (distance > 0 && distance < maxDistance && t >= 0 && t <= 1) {
      const nx = winding(loop) * ez,
        nz = -winding(loop) * ex;
      if (nx * dx + nz * dz > 0)
        hits.push({
          distance,
          center: [center[0] + distance * dx, center[1] + distance * dz],
          angle: Math.atan2(nx, nz),
        });
    }
  }
  return hits.sort((a, b) => a.distance - b.distance)[0];
}
// Intersect a facade with the attributed ring; details follow the real wall plane.
function boundaryAt(loop, axis, coordinate, facing) {
  const other = 1 - axis,
    hits = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-6) continue;
    const t = (coordinate - a[axis]) / delta;
    if (t < 0 || t > 1) continue;
    const x = a[other] + t * (b[other] - a[other]),
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const nx = winding(loop) * dz,
      nz = -winding(loop) * dx;
    if ((axis === 1 ? nx : nz) * facing > 0) hits.push([x, Math.atan2(nx, nz)]);
  }
  if (!hits.length) throw Error('Facade coordinate lies outside the mapped ring');
  return hits.sort((a, b) => facing * (b[0] - a[0]))[0];
}
function door(o, d, width = 1.8, inset = 0) {
  const z = inset ? -inset : 0.09;
  face(
    o,
    [
      [-width / 2, 0.1, z],
      [width / 2, 0.1, z],
      [width / 2, 3, z],
      [-width / 2, 3, z],
    ],
    'door',
    'timber',
    [0, 0, 1],
  );
  if (inset) {
    const a = -width / 2,
      b = width / 2;
    for (const [x, side] of [
      [a, 1],
      [b, -1],
    ])
      face(
        o,
        [
          [x, 0.1, z],
          [x, 0.1, 0],
          [x, 3, 0],
          [x, 3, z],
        ],
        'trim',
        'plaster',
        [side, 0, 0],
      );
    face(
      o,
      [
        [a, 3, z],
        [a, 3, 0],
        [b, 3, 0],
        [b, 3, z],
      ],
      'trim',
      'plaster',
      [0, -1, 0],
    );
    face(
      o,
      [
        [a, 0.1, z],
        [a, 0.1, 0],
        [b, 0.1, 0],
        [b, 0.1, z],
      ],
      'stone',
      'sandstone',
      [0, 1, 0],
    );
  }
  if (d >= 2) {
    for (const x of [-width / 2 - 0.14, width / 2 + 0.14]) box(o, x, 0, 0.08, 0.28, 3.25, 0.22);
    box(o, 0, 3, 0.08, width + 0.55, 0.25, 0.22);
  }
}
function buildOfficina(o, frame, d) {
  const loop = frame.geometry.outline.slice(0, -1),
    c = frame.controls,
    { min, max } = bounds(loop),
    length = max[0] - min[0],
    depth = max[1] - min[1],
    cx = (min[0] + max[0]) / 2,
    cz = (min[1] + max[1]) / 2;
  const entranceX = 18; // Photographic interpretation in the outer end pavilion.
  body(o, loop, c.bodyHeight, d, {
    raisedEnds: true,
    entry: frame.siteFit?.apron,
    skipPane: (x, z, y) => y < 5 && z * c.courtFacing > 0 && Math.abs(x - entranceX) < 1.8,
  });
  if (d >= 1) {
    const [z, angle] = boundaryAt(loop, 0, entranceX, c.courtFacing);
    door(local(o, [entranceX, z], angle), d, 1.8, frame.siteFit?.apron ? 0.24 : 0);
  }
  const ends = [cx - length / 2 + 4.5, cx + length / 2 - 4.5];
  joinedRoofs(
    o,
    loop,
    c.bodyHeight,
    [
      [cx, c.bodyHeight, cz, length, depth, 4.4],
      ...ends.map((x) => [x, c.endHeight, cz, 9, depth, 4.4]),
    ],
    d,
    'wall',
    !!frame.siteFit,
  );
  if (d >= 1)
    for (const facing of [-1, 1]) {
      const z = cz + facing * (depth * 0.36),
        count = d === 1 ? 3 : 7;
      for (let i = 0; i < count; i++) {
        const x = cx - 14 + (i * 28) / (count - 1),
          q = local(o, [x, z]);
        box(q, 0, 6.5, 0, 2.35, 2.4, 2.2, 'wall', 'plaster');
        if (frame.siteFit) dormerCap(q, d);
        else hip(q, 0, 8.9, 0, 2.65, 2.5, 0.8);
        pane(q, 0, 6.8, facing * 1.16, 1.1, 1.5, d, true);
      }
      if (d >= 2)
        for (const x of [-14, 14]) {
          const q = local(o, [x, cz + (facing * depth) / 2]);
          box(q, 0, 0, 0, 0.55, c.bodyHeight, 0.3);
        }
    }
  if (d >= 2) for (const x of ends) box(o, x, 12.2, cz, 1.1, 3.2, 1.3, 'trim', 'plaster');
}
function dormerCap(o, detail) {
  const count = detail === 1 ? 4 : 8;
  const arc = Array.from({ length: count + 1 }, (_, i) => {
    const angle = (Math.PI * i) / count;
    return [1.32 * Math.cos(angle), 8.87 + 0.66 * Math.sin(angle)];
  });
  for (const side of [-1, 1])
    face(
      o,
      arc.map(([x, y]) => [x, y, side * 1.25]),
      'trim',
      'plaster',
      [0, 0, side],
    );
  for (let i = 0; i < count; i++) {
    const [x, y] = arc[i],
      [u, v] = arc[i + 1];
    face(
      o,
      [
        [x, y, -1.25],
        [u, v, -1.25],
        [u, v, 1.25],
        [x, y, 1.25],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  }
  face(
    o,
    [
      [-1.32, 8.87, -1.25],
      [1.32, 8.87, -1.25],
      [1.32, 8.87, 1.25],
      [-1.32, 8.87, 1.25],
    ],
    'trim',
    'plaster',
    [0, -1, 0],
  );
}
function buildHotel(o, frame, d) {
  const loop = frame.geometry.outline.slice(0, -1),
    c = frame.controls,
    { min, max } = bounds(loop),
    width = max[0] - min[0],
    length = max[1] - min[1];
  const entrance = frame.siteFit?.apron;
  body(o, loop, c.bodyHeight, d, {
    entry: entrance,
    skipPane: (x, z, y) => x > 0 && Math.abs(z) < 2 && y < 5,
  });
  joinedRoofs(
    o,
    loop,
    c.bodyHeight,
    [
      [0, c.bodyHeight, 0, length, width, c.roofRise, Math.PI / 2],
      [2.65, c.bodyHeight, 0, 7.4, 9.1, 2.26, Math.PI / 2, 'gable'],
    ],
    d,
    'trim',
    true,
  );
  for (const [i, a] of loop.entries()) {
    const b = loop[(i + 1) % loop.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const facade = local(
      o,
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      -Math.atan2(b[1] - a[1], b[0] - a[0]),
    );
    if (d >= 1) box(facade, 0, 5.23, 0, length, 0.24, 0.18, 'stone', 'sandstone');
    box(facade, 0, c.bodyHeight - 0.24, 0, length, 0.25, 0.22, 'trim', 'plaster');
  }
  if (d >= 1) {
    const [x, angle] = boundaryAt(loop, 1, 0, 1);
    const front = local(o, entrance?.center ?? [x, 0], entrance?.angle ?? angle);
    door(front, d, 1.8, entrance ? 0.27 : 0);
    for (const z of [-7.1, 7.1]) {
      const r = local(o, [max[0] - 2.0, z], Math.PI / 2);
      box(r, 0, 9.94, 0, 1.88, 1.51, 2.36, 'wall', 'plaster');
      hip(r, 0, 11.45, 0, 2.08, 2.58, 0.64);
      pane(r, 0, 10.22, 1.22, 0.92, 1.1, d);
    }
  }
  for (const z of [-4.4, 4.4]) {
    box(o, 0.08, 13.0, z, 1.04, 2.12, 1.28, 'trim', 'plaster');
    if (d >= 2) box(o, 0.08, 15.08, z, 1.24, 0.18, 1.48, 'stone', 'sandstone');
  }
}
function groundedEntrance(o, frame) {
  const { footingBottom, apron } = frame.siteFit;
  const loop = frame.geometry.outline.slice(0, -1);
  const sign = winding(loop);
  for (let i = 0; i < loop.length; i++) {
    const [x, z] = loop[i],
      [u, v] = loop[(i + 1) % loop.length];
    face(
      o,
      [
        [x, footingBottom, z],
        [u, footingBottom, v],
        [u, 0, v],
        [x, 0, z],
      ],
      'stone',
      'sandstone',
      [sign * (v - z), 0, sign * (x - u)],
    );
  }
  cap(o, loop, footingBottom, 'stone', 'sandstone', [0, -1, 0]);
  if (!apron) return;
  const q = local(o, apron.center, apron.angle);
  const a = -apron.width / 2,
    b = apron.width / 2;
  const [leftGround, rightGround] = apron.toeHeights;
  const bottom = Math.min(leftGround, rightGround) - 0.14;
  for (const [start, end, top] of [
    [-0.07, 0.4, 0.1],
    [0.4, 0.8, -0.055],
    [0.8, 1.18, -0.205],
  ])
    box(
      q,
      0,
      bottom,
      (start + end) / 2,
      apron.width,
      top - bottom,
      end - start,
      'stone',
      'sandstoneTread',
    );
  face(
    q,
    [
      [a, leftGround, 1.18],
      [b, rightGround, 1.18],
      [b, rightGround + 0.008, apron.depth],
      [a, leftGround + 0.008, apron.depth],
    ],
    'stone',
    'sandstoneTread',
    [0, 1, 0],
  );
  for (const [x, toe, side] of [
    [a, leftGround, -1],
    [b, rightGround, 1],
  ])
    face(
      q,
      [
        [x, bottom, 1.18],
        [x, bottom, apron.depth],
        [x, toe + 0.008, apron.depth],
        [x, toe, 1.18],
      ],
      'stone',
      'sandstoneTread',
      [side, 0, 0],
    );
}
export function buildKsiazEntrance(o, key, level = 'closeup') {
  const frame = frames.get(key);
  if (!frame) throw Error(`Unknown Książ entrance component ${key}`);
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw Error(`Unknown runtime level ${level}`);
  if (key === 'ksiaz_gatehouse') buildGatehouse(o, frame, d);
  else if (key === 'ksiaz_zamkowy_hotel') buildHotel(o, frame, d);
  else buildOfficina(o, frame, d);
  if (frame.siteFit) groundedEntrance(o, frame);
}
export function buildKsiazEntranceSkyline(o, key) {
  buildKsiazEntrance(
    {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          col.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    key,
    'skyline',
  );
}
