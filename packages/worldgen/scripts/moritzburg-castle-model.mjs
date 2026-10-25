/** Moritzburg: four domes, connected palace ranges, chapel and mapped island approaches. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/u3/u31/moritzburg_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const palette = {
  wall: '#eddaa1',
  trim: '#eee7d6',
  roof: '#b76549',
  stone: '#cfc5b1',
  spire: '#646c78',
  metal: '#9eaa9c',
  glass: '#4d6178',
  lawn: '#8aa065',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((s) => {
        const v = parseInt(s, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const part = (id) => frame.reconstruction.buildings.find((b) => b.id === id);
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const mid = (r) => [0, 1].map((k) => r.reduce((v, p) => v + p[k], 0) / r.length);
const unit = (v) => {
  const length = Math.hypot(...v);
  return v.map((x) => x / length);
};
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
// The bridge axis is native +X southward, +Z westward; this helper describes photo-led details.
const plan = ([east, south]) => [south, -east];
const towerIds = [35184618864349, 35184618864353, 35184618864361, 35184618864365];
const pavilionIds = [
  35184415209388, 35184415209389, 35184415209393, 35184415209394, 35184415209395, 35184415209396,
  35184415209431, 35184415333763,
];
const ranges = [
  { id: 35184618864333, eave: 23.5, ridge: 29 },
  { id: 35184618864334, eave: 23.5, ridge: 29 },
  { id: 35184618864336, eave: 23.5, ridge: 29 },
  { id: 35184618864339, eave: 23.5, ridge: 29 },
  { id: 35184618864330, eave: 27, ridge: 34 },
  { id: 35184618864329, eave: 25.5, ridge: 34 },
  { id: 35184618864320, eave: 22.5, ridge: 29 },
];
export function moritzburgGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Moritzburg footing outside retained DEM');
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
function writer(out, detail) {
  return (surface, points, direction) => {
    let p = points.map((q) => q.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((v, n, k) => v + n * direction[k], 0) < 0)
      p = p.reverse();
    const color =
      detail === 0 ? colors[surface].map((v, k) => v * means[surface][k]) : colors[surface];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        surface,
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
function cap(face, ring, y, surface, holes = []) {
  const points = [...ring, ...holes.flat()],
    starts = [];
  let offset = ring.length;
  for (const hole of holes) {
    starts.push(offset);
    offset += hole.length;
  }
  const indices = earcut(points.flat(), starts, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      surface,
      indices.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, ring, bottom, top, surface, inward = false) {
  const sign =
    Math.sign(
      ring.reduce((sum, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return sum + a[0] * b[1] - a[1] * b[0];
      }, 0),
    ) * (inward ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      surface,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
    );
  }
}
function solid(face, ring, bottom, top, surface, holes = []) {
  sides(face, ring, bottom, top, surface);
  for (const hole of holes) sides(face, hole, bottom, top, surface, true);
  cap(face, ring, top, surface, holes);
}
function band(face, a, b, width, y, surface, depth = 0) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]];
  const ring = [
    a.map((v, k) => v - (n[k] * width) / 2),
    b.map((v, k) => v - (n[k] * width) / 2),
    b.map((v, k) => v + (n[k] * width) / 2),
    a.map((v, k) => v + (n[k] * width) / 2),
  ];
  if (depth) solid(face, ring, (p) => (typeof y === 'function' ? y(p) : y) - depth, y, surface);
  else cap(face, ring, y, surface);
}
function circle(center, radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI) / count;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  });
}
function profile(face, center, rings, count, surface) {
  for (let j = 1; j < rings.length; j++) {
    const [r0, y0] = rings[j - 1],
      [r1, y1] = rings[j],
      lower = circle(center, r0, count),
      upper = circle(center, r1, count);
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count;
      face(
        surface,
        [at(lower[i], y0), at(lower[k], y0), at(upper[k], y1), at(upper[i], y1)],
        [lower[i][0] - center[0], 1, lower[i][1] - center[1]],
      );
    }
  }
  const [radius, y] = rings.at(-1);
  if (radius > 0.001) cap(face, circle(center, radius, count), y, surface);
}
function contains(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function hidden(p, y, ownId) {
  if (
    towerIds.some(
      (id) =>
        id !== ownId &&
        y < 26 &&
        Math.hypot(...p.map((v, k) => v - mid(part(id).outline)[k])) < 6.85,
    )
  )
    return true;
  return ranges.some((r) => r.id !== ownId && y < r.eave && contains(p, part(r.id).outline));
}
function facadePatch(face, p, u, n, width, bottom, height, surface, offset = 0.04) {
  const a = p.map((v, k) => v - (u[k] * width) / 2 + n[k] * offset),
    b = p.map((v, k) => v + (u[k] * width) / 2 + n[k] * offset);
  face(
    surface,
    [at(a, bottom), at(b, bottom), at(b, bottom + height), at(a, bottom + height)],
    [n[0], 0, n[1]],
  );
}
function window(face, detail, p, u, n, bottom, height, width = 1.35) {
  facadePatch(face, p, u, n, width, bottom, height, 'glass');
  if (detail < 2) return;
  const frameWidth = 0.16;
  for (const side of [-1, 1])
    facadePatch(
      face,
      p.map((v, k) => v + (u[k] * side * (width + frameWidth)) / 2),
      u,
      n,
      frameWidth,
      bottom - frameWidth,
      height + frameWidth * 2,
      'trim',
      0.11,
    );
  for (const y of [bottom - frameWidth, bottom + height])
    facadePatch(face, p, u, n, width, y, frameWidth, 'trim', 0.11);
  if (detail >= 3) {
    facadePatch(face, p, u, n, 0.075, bottom, height, 'trim', 0.12);
    facadePatch(face, p, u, n, width, bottom + height * 0.63, 0.08, 'trim', 0.12);
  }
}
function wallsWithWindows(face, detail, ring, bottom, eave, id, pavilion = false) {
  solid(face, ring, bottom, eave, 'wall');
  if (detail === 0) return;
  const sign = Math.sign(
    ring.reduce((v, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return v + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      length = Math.hypot(...b.map((v, k) => v - a[k]));
    if (length < 2.7) continue;
    const u = unit(b.map((v, k) => v - a[k])),
      n = [u[1] * sign, -u[0] * sign],
      bays = Math.max(1, Math.floor(length / (pavilion ? 3.8 : 3.2)));
    for (let j = 0; j < bays; j++) {
      const p = mix(a, b, (j + 0.5) / bays),
        outer = p.map((v, k) => v + n[k] * 0.18);
      const rows = pavilion
        ? [[bottom + 1.2, 1.9]]
        : [
            [6.8, 2.65],
            [12.25, 3.4],
            [18.2, 3.4],
          ];
      if (!pavilion && eave > 26) rows.push([24, 1.9]);
      for (const [y, h] of rows)
        if (y + h < eave && (pavilion || !hidden(outer, y + h / 2, id)))
          window(face, detail, p, u, n, y, h, pavilion ? 1 : 1.35);
      if (detail >= 2 && !hidden(outer, 16, id) && !pavilion) {
        const pilaster = mix(a, b, j / bays);
        facadePatch(face, pilaster, u, n, 0.38, bottom + 0.5, eave - bottom - 0.8, 'trim', 0.08);
      }
    }
    if (detail >= 2) {
      const p = mix(a, b, 0.5);
      if (
        pavilion ||
        !hidden(
          p.map((v, k) => v + n[k] * 0.18),
          eave - 0.35,
          id,
        )
      )
        facadePatch(face, p, u, n, length, eave - 0.38, 0.36, 'trim', 0.1);
    }
  }
}
function hipRoof(face, ring, eave, ridge, detail, id, pavilion = false) {
  const center = mid(ring);
  let longest = 0;
  for (let i = 1; i < ring.length; i++)
    if (
      Math.hypot(...ring[(i + 1) % ring.length].map((v, k) => v - ring[i][k])) >
      Math.hypot(...ring[(longest + 1) % ring.length].map((v, k) => v - ring[longest][k]))
    )
      longest = i;
  const a = ring[longest],
    b = ring[(longest + 1) % ring.length],
    u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    projections = ring.map((p) =>
      [0, 1].map((k) => (p[0] - center[0]) * [u, n][k][0] + (p[1] - center[1]) * [u, n][k][1]),
    ),
    length = Math.max(...projections.map((p) => p[0])) - Math.min(...projections.map((p) => p[0])),
    width = Math.max(...projections.map((p) => p[1])) - Math.min(...projections.map((p) => p[1])),
    halfRidge = Math.max(0.2, (length - width) / 2),
    end = (sign) => center.map((v, k) => v + u[k] * halfRidge * sign);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length],
      dot = (v) => (v[0] - center[0]) * u[0] + (v[1] - center[1]) * u[1],
      r0 = end(dot(p) < 0 ? -1 : 1),
      r1 = end(dot(q) < 0 ? -1 : 1);
    face('roof', [at(p, eave), at(q, eave), at(r1, ridge), at(r0, ridge)], [0, 1, 0]);
  }
  if (detail < 2 || pavilion) return;
  // Sparse dormers sit on broad roof facets, away from joins hidden by higher ranges.
  for (const side of [-1, 1]) {
    const count = Math.max(1, Math.floor(length / 11));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5,
        p = center.map((v, k) => v + u[k] * length * t * 0.75 + n[k] * side * width * 0.29),
        y = eave + (ridge - eave) * 0.42;
      if (hidden(p, y + 1.6, id)) continue;
      const r = [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => p.map((v, k) => v + u[k] * sx * 0.7 + n[k] * sz * 0.85)),
      );
      const outline = [r[0], r[2], r[3], r[1]];
      solid(face, outline, y - 0.25, y + 1.25, 'wall');
      const roofTop = outline.map((q) => q.map((v, k) => p[k] + (v - p[k]) * 0.05));
      for (let j = 0; j < 4; j++)
        face(
          'roof',
          [
            at(outline[j], y + 1.25),
            at(outline[(j + 1) % 4], y + 1.25),
            at(roofTop[(j + 1) % 4], y + 2.2),
            at(roofTop[j], y + 2.2),
          ],
          [0, 1, 0],
        );
      facadePatch(
        face,
        p.map((v, k) => v + n[k] * side * 0.86),
        u,
        n.map((v) => v * side),
        0.62,
        y + 0.2,
        0.9,
        'glass',
      );
    }
  }
  if (detail >= 3) {
    for (const sign of [-1, 1]) {
      const p = center.map((v, k) => v + u[k] * halfRidge * sign * 0.7);
      const r = [
        [-0.5, -0.4],
        [0.5, -0.4],
        [0.5, 0.4],
        [-0.5, 0.4],
      ].map((q) => p.map((v, k) => v + u[k] * q[0] + n[k] * q[1]));
      if (!hidden(p, ridge + 1, id)) solid(face, r, ridge - 0.5, ridge + 1.5, 'trim');
    }
  }
}
function domedTower(face, detail, id) {
  const center = mid(part(id).outline),
    radius = 6.93,
    count = [6, 12, 16, 24, 32][detail],
    ring = circle(center, radius, count);
  solid(face, ring, 5, 26, 'wall');
  if (detail >= 1) {
    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) * 2 * Math.PI) / 8,
        n = [Math.cos(angle), Math.sin(angle)],
        u = [-n[1], n[0]],
        p = center.map((v, k) => v + n[k] * radius);
      for (const y of [6.8, 11.7, 16.7, 21.7])
        if (
          !hidden(
            p.map((v, k) => v + n[k] * 0.2),
            y + 1.4,
            id,
          )
        )
          window(face, detail, p, u, n, y, 2.7, 1.28);
      if (detail >= 2) {
        const q = center.map((v, k) => v + circle([0, 0], radius, 8)[i][k]),
          outward = unit(q.map((v, k) => v - center[k]));
        if (
          !hidden(
            q.map((v, k) => v + outward[k] * 0.2),
            15,
            id,
          )
        )
          facadePatch(face, q, [-outward[1], outward[0]], outward, 0.44, 9.7, 16, 'trim', 0.12);
      }
    }
  }
  const dome =
    detail === 0
      ? [
          [7.15, 26],
          [7.1, 29],
          [4.4, 33.6],
          [1.7, 35],
        ]
      : [
          [7.15, 26],
          [7.35, 27.6],
          [7.1, 29.8],
          [6.15, 31.8],
          [4.5, 33.6],
          [1.7, 35],
        ];
  profile(face, center, dome, count, 'roof');
  if (detail >= 2) {
    profile(
      face,
      center,
      [
        [7.12, 25.7],
        [7.35, 25.9],
        [7.35, 26.15],
      ],
      count,
      'trim',
    );
    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) * 2 * Math.PI) / 8,
        n = [Math.cos(angle), Math.sin(angle)],
        u = [-n[1], n[0]],
        p = center.map((v, k) => v + n[k] * 7.34);
      window(face, detail, p, u, n, 27.25, 1.35, 0.65);
    }
  }
  profile(
    face,
    center,
    [
      [1, 35],
      [1, 37],
    ],
    detail === 0 ? 4 : 8,
    'trim',
  );
  profile(
    face,
    center,
    [
      [1.2, 37],
      [0.65, 37.5],
      [0.12, 38.1],
      [0.02, 39],
    ],
    detail === 0 ? 4 : 8,
    'metal',
  );
  if (detail >= 2) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2,
        n = [Math.cos(angle), Math.sin(angle)],
        p = center.map((v, k) => v + n[k]);
      facadePatch(face, p, [-n[1], n[0]], n, 0.52, 35.4, 1.1, 'glass');
    }
  }
}
function chapelSpire(face, detail) {
  const center = mid(part(35184618864385).outline),
    count = detail === 0 ? 4 : detail >= 3 ? 16 : 8;
  profile(
    face,
    center,
    [
      [2.1, 27.4],
      [2.1, 30.3],
      [1.1, 32.5],
      [1.5, 33.1],
      [1.35, 35],
      [0.65, 37],
      [0.65, 38.2],
      [0.06, 42.4],
    ],
    count,
    'spire',
  );
  if (detail >= 2)
    profile(
      face,
      center,
      [
        [0.08, 42.4],
        [0.08, 43],
      ],
      6,
      'metal',
    );
}
function clipPlan(ring, axis, threshold, keepAbove) {
  const result = [],
    distance = (p) => (p[0] * axis[0] + p[1] * axis[1] - threshold) * (keepAbove ? 1 : -1);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      da = distance(a),
      db = distance(b);
    if (da >= -1e-8) result.push(a);
    if (da > 0 !== db > 0 && Math.abs(da - db) > 1e-9) result.push(mix(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i) => i === 0 || Math.hypot(...p.map((v, k) => v - result[i - 1][k])) > 1e-6,
  );
}
function terrace(face, detail) {
  const terrace = part(52776578541393),
    base = frame.reconstruction.islandY;
  const holes = detail === 0 ? [] : terrace.holes;
  solid(face, terrace.outline, base, 5, 'stone', holes);
  // The mapped stair cut-outs remain separate from the cap; each is a rising flight.
  for (const hole of holes) {
    const c = mid(hole),
      outward = unit(c),
      radial = hole.map((p) => p[0] * outward[0] + p[1] * outward[1]),
      low = Math.min(...radial),
      high = Math.max(...radial),
      height = (p) =>
        base + (5 - base) * (1 - (p[0] * outward[0] + p[1] * outward[1] - low) / (high - low));
    const count = [1, 3, 12, 18, 24][detail];
    for (let j = 0; j < count; j++) {
      const start = low + ((high - low) * j) / count,
        end = low + ((high - low) * (j + 1)) / count,
        strip = clipPlan(clipPlan(hole, outward, start, true), outward, end, false);
      if (strip.length < 3) continue;
      solid(face, strip, base - 0.02, height(outward.map((v) => v * start)), 'stone');
    }
  }
  // Two axial retaining ramps carry a constant terrace landing then descend toward the island.
  for (const id of [35184618864316, 35184618864317]) {
    const r = part(id).outline,
      sign = Math.sign(mid(r)[0]),
      top = (p) => 5 - Math.max(0, Math.min(1, (Math.abs(p[0]) - 50) / 35)) * 4.4;
    solid(face, r, base - 0.1, top, 'stone');
    if (detail >= 2) {
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        if (Math.abs(b[0] - a[0]) > 2)
          band(face, a, b, detail >= 3 ? 0.25 : 0.4, (p) => top(p) + 0.65, 'stone', 0.65);
      }
      const start = [sign * 51, mid(r)[1]],
        end = [sign * 85, mid(r)[1]];
      band(face, start, end, 4.2, (p) => top(p) + 0.015, 'stone');
    }
  }
  if (detail >= 1) {
    for (let i = 0; i < terrace.outline.length; i++) {
      const a = terrace.outline[i],
        b = terrace.outline[(i + 1) % terrace.outline.length];
      if (Math.hypot(...b.map((v, k) => v - a[k])) < 3) continue;
      const u = unit(b.map((v, k) => v - a[k])),
        n = [u[1], -u[0]],
        bays = Math.max(1, Math.floor(Math.hypot(...b.map((v, k) => v - a[k])) / 3.8));
      for (let j = 0; j < bays; j++)
        window(face, detail, mix(a, b, (j + 0.5) / bays), u, n, 1.15, 1.9, 1.1);
      if (detail >= 2 && Math.abs(a[0]) < 46 && Math.abs(b[0]) < 46)
        band(face, a, b, 0.45, 5.75, 'stone', 0.75);
    }
  }
}
function island(face, detail) {
  const r = frame.reconstruction.island,
    top = frame.reconstruction.islandY;
  // A single lawn cap avoids depth fighting with a hidden stone cap at distant views.
  sides(face, r, (p) => Math.min(top - 0.2, moritzburgGround(...p) - 0.15), top, 'stone');
  cap(face, r, top + 0.012, 'lawn');
  if (detail >= 1) {
    // Photo-led broad paths loop around the terrace and connect all paired approach pavilions.
    const loop = [
      [-91, -96],
      [83, -96],
      [91, -80],
      [91, 88],
      [83, 105],
      [-87, 105],
      [-93, 87],
      [-93, -79],
    ].map(plan);
    for (let i = 0; i < loop.length; i++)
      band(face, loop[i], loop[(i + 1) % loop.length], 3.1, top + 0.035, 'stone');
    for (const [a, b] of [
      [
        [-98, 0],
        [-51, 0],
      ],
      [
        [51, 0],
        [99, 0],
      ],
      [
        [-3, -124],
        [-3, -84],
      ],
      [
        [-1, 87],
        [-1, 130],
      ],
    ])
      band(face, plan(a), plan(b), 4.4, top + 0.045, 'stone');
  }
  for (const id of pavilionIds) {
    const r = part(id).outline;
    wallsWithWindows(face, detail, r, top, top + 4.3, id, true);
    hipRoof(face, r, top + 4.3, top + 6, detail, id, true);
  }
  for (const bridge of frame.reconstruction.bridges) {
    const [a, b] = bridge.centerline,
      u = unit(b.map((v, k) => v - a[k])),
      n = [-u[1], u[0]];
    band(face, a, b, 6.2, top + 0.12, 'stone', 0.45);
    if (detail >= 1)
      for (const side of [-1, 1]) {
        const p = a.map((v, k) => v + n[k] * side * 2.95),
          q = b.map((v, k) => v + n[k] * side * 2.95);
        band(face, p, q, 0.33, top + 1.13, 'stone', 1.05);
      }
  }
}
function build(out, detail) {
  const face = writer(out, detail);
  island(face, detail);
  terrace(face, detail);
  for (const range of ranges) {
    const r = part(range.id).outline;
    wallsWithWindows(face, detail, r, 5, range.eave, range.id);
    hipRoof(face, r, range.eave, range.ridge, detail, range.id);
  }
  for (const id of towerIds) domedTower(face, detail, id);
  chapelSpire(face, detail);
}
export const buildMoritzburgSkyline = (out) => build(out, 0);
export const buildMoritzburgDistrict = (out) => build(out, 1);
export const buildMoritzburgStreet = (out) => build(out, 2);
export const buildMoritzburgCloseup = (out) => build(out, 3);
export const moritzburgStudy = {
  id: 'moritzburg_castle',
  key: 'moritzburg_castle',
  title: 'Moritzburg Castle',
  category: 'castle',
  wikidataId: 'Q156803',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Moritzburg island palace: four pale cylindrical towers with red rounded domes, lanterns and finials; connected hipped palace ranges, projecting east entrance and separate dark west chapel spire; stone terrace, curved stair cut-outs, two axial retaining ramps, eight paired pavilions and two short mapped bridge gaps.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID low palace plan plus 25 current PMTiles component polygons, full island park and two bridge centerlines.',
    architecturalHeights:
      'Mapped parts provide approximate29/34m range tops,35m dome parts and43m chapel finial. Eaves, profiles and window rhythm are photo-led estimates.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Current mapped plans establish approximate palace84x71m, terrace102x99m and island210x254m; the retained0.8m low-part height is not applied to the palace.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square shared graphs supply plaster, ceramic tile, sandstone, slate and painted metal; glass and lawn use linear vertex tints. Metric UVs, no unique bitmap or embedded photograph.',
  importReason:
    'Preserve four recognizable dome towers, connected palace massing, chapel spire and island approaches in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped components establish approximate scale and facing; eaves, dome profiles, window/dormer rhythm and material colors are exterior-picture estimates.',
    'The0.8m exact-QID part is a low plan only. Component heights are approximate mapped data, not certified building surveys.',
    'The park polygon maps grass areas; the rectangular island retaining edge is a photo-led estimate against pavilion/bridge locations. Terrace stairs, island levels, short bridge engineering and coarse DEM/water joins are approximate; no terrain carving or surveyed lake level.',
    'Long land causeways, lake, formal gardens beyond the island, site trees, detailed interiors and certified walkable collision are excluded.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'four-domes-and-palace', position: [91, 63, -94], lookAt: [0, 20, 0], fov: 43 },
    { name: 'chapel-spire-and-west-ranges', position: [-67, 54, 82], lookAt: [0, 23, 28], fov: 43 },
    {
      name: 'east-projecting-range-and-stairs',
      position: [42, 32, -85],
      lookAt: [0, 13, -30],
      fov: 43,
    },
    { name: 'south-ramp-pavilion-pair', position: [172, 33, -40], lookAt: [87, 3, 0], fov: 43 },
    { name: 'north-pavilion-bridge', position: [-177, 28, 31], lookAt: [-113, 3, 3], fov: 43 },
    { name: 'mapped-island-and-palace-plan', position: [0, 320, 0.1], lookAt: [0, 0, 0], fov: 48 },
  ],
};
