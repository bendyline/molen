/** Tokyo St. Mary's Cathedral: eight steel sails, cross skylight and detached concrete belfry. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/xn/xn7/st_marys_cathedral_tokyo/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  rec = frame.reconstruction,
  floor = rec.floorY;
const palette = {
  wall: '#c4bdab',
  trim: '#d5d0c0',
  roof: '#d9e1e2',
  door: '#936335',
  glass: '#344b54',
  accent: '#937c50',
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
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  unit = (v) => {
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  },
  at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const R = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
export function tokyoMaryGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Tokyo cathedral footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const footing = (p) => Math.min(floor - 0.3, tokyoMaryGround(...p) - 0.35);
function writer(out, d) {
  return (slot, points, direction, tint = colors[slot]) => {
    const p = points.map((v) => v.map(Math.fround));
    const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      const normal = normalFor(...t);
      if (direction && normal.reduce((s, v, k) => s + v * direction[k], 0) < 0) t = t.toReversed();
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
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let off = r.length;
  for (const h of holes) {
    starts.push(off);
    off += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function beam(face, a, b, w, slot = 'roof') {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u));
  const corners = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((n, k) => n + ((u[k] * s + v[k] * t) * w) / 2)),
    lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const spine = rec.controls.find((b) => b.id === rec.roles.roofSpine).polygons[0].outline;
function route(points, u) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(...p.map((v, k) => v - points[i][k]))),
    sum = lengths.reduce((a, b) => a + b, 0);
  let dist = u * sum;
  for (let i = 0; i < lengths.length; i++) {
    if (dist <= lengths[i] || i === lengths.length - 1)
      return lerp(points[i], points[i + 1], Math.min(1, dist / lengths[i]));
    dist -= lengths[i];
  }
  return points.at(-1);
}
export function tokyoMaryPanelPoint(index, u, t) {
  const p = rec.patches[index],
    top = lerp(p.junction, p.end, u),
    base = route(p.ground, u),
    w = t + 0.18 * Math.sin(Math.PI * t),
    xz = lerp(top, base, w),
    high = floor + rec.heights.center + (p.height - rec.heights.center) * u,
    low = Math.max(floor + 0.1, tokyoMaryGround(...base) + 0.12);
  return [xz[0], high * (1 - t) + low * t, xz[1]];
}
function sails(face, d) {
  const [nu, nt] = [
    [3, 4],
    [5, 6],
    [8, 10],
    [12, 16],
    [12, 16],
  ][d];
  for (let k = 0; k < rec.patches.length; k++) {
    const point = (i, j) => tokyoMaryPanelPoint(k, i / nu, j / nt);
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nt; j++) {
        const q = [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
        // Tip cells contain a vertical triangle: a pure +Y winding test is ambiguous there.
        // Orient each triangle against the local ruled-surface normal instead.
        const u = (i + 0.5) / nu,
          t = (j + 0.5) / nt,
          p = tokyoMaryPanelPoint(k, u, t),
          a = tokyoMaryPanelPoint(k, u + 0.0001, t),
          b = tokyoMaryPanelPoint(k, u, t + 0.0001);
        let normal = unit(
          cross(
            a.map((v, k) => v - p[k]),
            b.map((v, k) => v - p[k]),
          ),
        );
        if (normal[1] < 0) normal = normal.map((v) => -v);
        face('roof', q, normal);
        if (d >= 2)
          face(
            'roof',
            q.map((p) => [p[0], p[1] - 0.18, p[2]]),
            normal.map((v) => -v),
            colors.roof.map((v) => v * 0.65),
          );
      }
    if (d >= 1) {
      beam(face, point(0, 0), point(nu, 0), d >= 3 ? 0.22 : 0.25);
      for (let j = 0; j < nt; j++) beam(face, point(0, j), point(0, j + 1), 0.2);
      // Physical thickness closes the ground edge without a broad horizontal cap.
      if (d >= 2)
        for (let i = 0; i < nu; i++) {
          const a = point(i, nt),
            b = point(i + 1, nt);
          face('roof', [a, b, [b[0], b[1] - 0.18, b[2]], [a[0], a[1] - 0.18, a[2]]]);
        }
    }
  }
}
const arms = [
  { name: 'west', pair: [0, 11], joint: [1, 10], height: 30, normal: [-1, 0] },
  { name: 'south', pair: [2, 3], joint: [1, 4], height: 26.5, normal: [0, 1] },
  { name: 'east', pair: [5, 6], joint: [4, 7], height: 39.4, normal: [1, 0] },
  { name: 'north', pair: [8, 9], joint: [7, 10], height: 32, normal: [0, -1] },
];
export function tokyoMaryEnds() {
  return arms.map((a) => ({
    ...a,
    points: a.pair.map((i) => spine[i]),
    floorY: Math.max(floor + 0.1, ...a.pair.map((i) => tokyoMaryGround(...spine[i]) + 0.12)),
  }));
}
function crossGlass(face, d) {
  for (const arm of arms) {
    const a = spine[arm.joint[0]],
      b = spine[arm.joint[1]],
      p = spine[arm.pair[0]],
      q = spine[arm.pair[1]];
    face(
      'glass',
      [
        at(a, rec.heights.center - 0.12),
        at(b, rec.heights.center - 0.12),
        at(q, arm.height - 0.12),
        at(p, arm.height - 0.12),
      ],
      [0, 1, 0],
    );
    if (d >= 2) {
      const len = Math.hypot(...p.map((v, k) => v - a[k])),
        n = Math.ceil(len / 3.2);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        beam(
          face,
          at(lerp(a, p, t), rec.heights.center + (arm.height - rec.heights.center) * t + 0.03),
          at(lerp(b, q, t), rec.heights.center + (arm.height - rec.heights.center) * t + 0.03),
          0.1,
        );
      }
    }
  }
  cap(face, [spine[1], spine[4], spine[7], spine[10]], rec.heights.center - 0.12, 'glass');
  for (const end of tokyoMaryEnds()) {
    const [a, b] = end.points,
      n = end.normal,
      off = d >= 2 ? -0.22 : 0,
      p = a.map((v, k) => v + n[k] * off),
      q = b.map((v, k) => v + n[k] * off),
      bottom = end.floorY,
      top = floor + end.height;
    face(
      'glass',
      [
        [p[0], bottom, p[1]],
        [q[0], bottom, q[1]],
        [q[0], top, q[1]],
        [p[0], top, p[1]],
      ],
      [n[0], 0, n[1]],
    );
    if (d >= 1) {
      for (const v of [a, b]) beam(face, [v[0], bottom, v[1]], [v[0], top + 0.06, v[1]], 0.25);
      beam(face, [a[0], top, a[1]], [b[0], top, b[1]], 0.24);
      for (let y = bottom + 3.1; y < top; y += d >= 2 ? 3.1 : 6.2)
        beam(face, [p[0], y, p[1]], [q[0], y, q[1]], 0.12);
      if (d >= 2) {
        const mid = lerp(p, q, 0.5);
        beam(face, [mid[0], bottom, mid[1]], [mid[0], top, mid[1]], 0.13);
        for (const [v, w] of [
          [a, p],
          [b, q],
        ])
          face(
            'roof',
            [
              [v[0], bottom, v[1]],
              [w[0], bottom, w[1]],
              [w[0], top, w[1]],
              [v[0], top, v[1]],
            ],
            [n[0], 0, n[1]],
          );
      }
      const left = lerp(p, q, 0.15),
        right = lerp(p, q, 0.85),
        db = bottom + 0.03;
      face(
        'door',
        [
          [left[0] + n[0] * 0.04, db, left[1] + n[1] * 0.04],
          [right[0] + n[0] * 0.04, db, right[1] + n[1] * 0.04],
          [right[0] + n[0] * 0.04, db + 2.8, right[1] + n[1] * 0.04],
          [left[0] + n[0] * 0.04, db + 2.8, left[1] + n[1] * 0.04],
        ],
        [n[0], 0, n[1]],
      );
      if (d >= 2 && end.name === 'east') {
        const axis = unit(b.map((v, k) => v - a[k])),
          middle = lerp(a, b, 0.5),
          local = (dist) => middle.map((v, k) => v + n[k] * dist);
        for (let j = 0; j < 3; j++) {
          const C = local(0.45 + j * 0.45),
            ring = [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ].map(([u, v]) => [
              C[0] + axis[0] * u * 2.9 + n[0] * v * 0.23,
              C[1] + axis[1] * u * 2.9 + n[1] * v * 0.23,
            ]);
          solid(
            face,
            ring,
            (pp) => tokyoMaryGround(...pp) - 0.05,
            () => bottom - 0.05 - j * 0.13,
            'trim',
          );
        }
      }
    }
  }
}
export function tokyoMaryAnnexFields() {
  const fields = [];
  for (const [pi, p] of rec.annexPlans.entries())
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        len = Math.hypot(...b.map((v, k) => v - a[k]));
      if (len < 5) continue;
      const axis = unit(b.map((v, k) => v - a[k])),
        n = [axis[1] * sign(p.outline), -axis[0] * sign(p.outline)],
        mid = lerp(a, b, 0.5);
      if (Math.hypot(...mid.map((v, k) => v - rec.bell.center[k])) < 7) continue;
      fields.push({
        name: `annex-${pi}-${i}`,
        a,
        b,
        normal: n,
        axis,
        width: Math.min(len - 2, 7.5),
        center: mid,
        bottom: floor + 3,
        height: 1.35,
      });
    }
  return fields;
}
function annexes(face, d) {
  const fields = tokyoMaryAnnexFields();
  for (const p of rec.annexPlans) {
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        len = Math.hypot(...b.map((v, k) => v - a[k])),
        n = [(b[1] - a[1]) * sign(p.outline), 0, (a[0] - b[0]) * sign(p.outline)],
        h = fields.find((h) => h.a === a && h.b === b);
      if (h && d >= 2) {
        const lo = lerp(a, b, (len - h.width) / len / 2),
          hi = lerp(a, b, (len + h.width) / len / 2),
          bottom = floor + 3,
          top = bottom + h.height;
        face('wall', [at(a, footing), at(b, footing), at(b, 3), at(a, 3)], n);
        face('wall', [at(a, 4.35), at(b, 4.35), at(b, 6), at(a, 6)], n);
        for (const [s, t] of [
          [a, lo],
          [hi, b],
        ])
          face('wall', [at(s, 3), at(t, 3), at(t, 4.35), at(s, 4.35)], n);
        const inner = (p) => p.map((v, k) => v - h.normal[k] * 0.2),
          il = inner(lo),
          ir = inner(hi);
        for (const [s, t] of [
          [lo, il],
          [hi, ir],
        ])
          face('wall', [
            [s[0], bottom, s[1]],
            [t[0], bottom, t[1]],
            [t[0], top, t[1]],
            [s[0], top, s[1]],
          ]);
        for (const y of [bottom, top])
          face('wall', [
            [lo[0], y, lo[1]],
            [hi[0], y, hi[1]],
            [ir[0], y, ir[1]],
            [il[0], y, il[1]],
          ]);
        face(
          'glass',
          [
            [il[0], bottom, il[1]],
            [ir[0], bottom, ir[1]],
            [ir[0], top, ir[1]],
            [il[0], top, il[1]],
          ],
          n,
        );
        for (let j = 1; j < 3; j++) {
          const m = lerp(il, ir, j / 3);
          beam(face, [m[0], bottom, m[1]], [m[0], top, m[1]], 0.1);
        }
      } else {
        face('wall', [at(a, footing), at(b, footing), at(b, 6), at(a, 6)], n);
        if (h && d === 1) {
          const lo = lerp(a, b, (len - h.width) / len / 2),
            hi = lerp(a, b, (len + h.width) / len / 2);
          face(
            'glass',
            [at(lo, 3), at(hi, 3), at(hi, 4.35), at(lo, 4.35)].map((v) => [
              v[0] + h.normal[0] * 0.03,
              v[1],
              v[2] + h.normal[1] * 0.03,
            ]),
            n,
          );
        }
      }
    }
    for (const hole of p.holes) sides(face, hole, footing, 6, 'wall', true);
    cap(face, p.outline, 6, 'trim', p.holes);
    if (d >= 2) sides(face, p.outline, 5.8, 6.12, 'wall');
  }
  // Retain the full raw building plan for viewer coverage using side-only foundations.
  sides(face, rec.main.polygons[0].outline, footing, 0.15, 'trim');
}
export const tokyoMaryBellBase = () => tokyoMaryGround(...rec.bell.center) + 0.15;
function belfry(face, d) {
  const [x, z] = rec.bell.center,
    base = tokyoMaryBellBase(),
    y = (h) => base + h,
    r = (w, h) => R(x, z, w, h);
  solid(
    face,
    r(3.2, 2.6),
    () => base - 0.35,
    () => y(38.5),
    'trim',
  );
  // Two unequal concrete blades flank a real, open rectangular bell aperture.
  for (const sx of [-1, 1])
    solid(
      face,
      R(x + sx * 1.25, z, 0.7, 2.6),
      () => y(38.5),
      () => y(sx < 0 ? 55 : 59.7),
      'trim',
    );
  for (const h of [38.5, 51.5])
    solid(
      face,
      r(3.2, 2.6),
      () => y(h),
      () => y(h + 0.6),
      'trim',
    );
  solid(
    face,
    R(x + 1.25, z, 0.7, 0.55),
    () => y(59.7),
    () => y(61.1),
    'trim',
  );
  beam(face, [x + 1.25, y(59.5), z], [x + 1.25, y(61.6), z], 0.11, 'accent');
  beam(face, [x + 0.9, y(61.05), z], [x + 1.6, y(61.05), z], 0.11, 'accent');
  if (d >= 1) {
    // Four simplified suspended bell bodies are geometry, not a painted slot.
    for (const h of [40, 43.1, 46.2, 49.3]) {
      const seg = d >= 3 ? 10 : 6,
        top = 0.4,
        rad = 0.64,
        rings = [
          [h + 0.6, top],
          [h + 0.1, rad],
          [h - 0.08, rad + 0.08],
        ],
        pts = rings.map(([height, r]) =>
          Array.from({ length: seg }, (_, i) => [
            x + Math.cos((i / seg) * Math.PI * 2) * r,
            y(height),
            z + Math.sin((i / seg) * Math.PI * 2) * r,
          ]),
        );
      for (let j = 0; j < pts.length - 1; j++)
        for (let i = 0; i < seg; i++) {
          const k = (i + 1) % seg;
          face(
            'accent',
            [pts[j][i], pts[j][k], pts[j + 1][k], pts[j + 1][i]],
            [
              Math.cos(((i + 0.5) / seg) * Math.PI * 2),
              0,
              Math.sin(((i + 0.5) / seg) * Math.PI * 2),
            ],
          );
        }
      beam(face, [x, y(h + 0.8), z], [x, y(h - 0.2), z], 0.12, 'accent');
      beam(face, [x - 1, y(h + 0.85), z], [x + 1, y(h + 0.85), z], 0.13, 'roof');
    }
  }
}
function build(target, d) {
  const limit = d === 0 ? 30 : d === 1 ? 24 : 16,
    out = {
      addTriangle(slot, ref, p, n, uv, col) {
        const lens = [0, 1, 2].map((i) => Math.hypot(...p[i].map((v, k) => v - p[(i + 1) % 3][k]))),
          i = lens.indexOf(Math.max(...lens));
        if (lens[i] > limit) {
          const j = (i + 1) % 3,
            k = (i + 2) % 3,
            m = lerp(p[i], p[j], 0.5),
            u = lerp(uv[i], uv[j], 0.5);
          out.addTriangle(slot, ref, [p[i], m, p[k]], n, [uv[i], u, uv[k]], col);
          out.addTriangle(slot, ref, [m, p[j], p[k]], n, [u, uv[j], uv[k]], col);
          return;
        }
        target.addTriangle(slot, ref, p, n, uv, col);
      },
    },
    face = writer(out, d);
  sails(face, d);
  crossGlass(face, d);
  annexes(face, d);
  belfry(face, d);
}
export const buildTokyoMarySkyline = (o) => build(o, 0),
  buildTokyoMaryDistrict = (o) => build(o, 1),
  buildTokyoMaryStreet = (o) => build(o, 2),
  buildTokyoMaryCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const tokyoMaryStudy = {
  id: 'st_marys_cathedral_tokyo',
  key: 'st_mary_s_cathedral',
  title: "St. Mary's Cathedral",
  category: 'cathedral',
  wikidataId: 'Q1193480',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main and narrow cross skylight; long western spine edge fixes axis. Eight shell panels and independent belfry courtyard estimated from four inspected photos.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256-square stainless steel, concrete, granite and plain wood graphs. Linear silver/beige tints, metric UVs and flat architectural normals. Closed glazing and bell accents use geometric PBR colors. No embedded images, bespoke facade textures or baked shadows.',
  importReason:
    'Four authored browser tiers preserve eight curved sails, narrow cross skylight, tall glazed ends, low annexes and detached unequal-blade belfry in the signed Tokyo map frame.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three useful Commons building/belfry photos, one architect aerial and current standard PMTiles/DEM only. Eight ruled surfaces approximate the hypar shells; steel panel fabrication/joints, exact structural geometry, glass artwork, modern hidden annex/interior plans, bell count/proportions, sculpture, inscriptions, neighboring halls, surveyed paving/thresholds and certified walking excluded or approximate. Belfry/courtyard are explicitly picture-estimated rather than mapped. Physical laptop/phone timing pending.',
    'Skyline keeps eight sails, cross slots, annexes and open belfry silhouette. District adds cached surfaces, wood doors and coarse glazing/bells. Street adds shell inner thickness, skylight mullions, recessed closed glazing and annex ribbon openings; closeup/master refine curve tessellation and bells. Synthetic cottage context is a review fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('high-east-glazed-end-and-entry', [86, 36, 43], [30, 20, 0]),
    cam('eight-curved-sails-and-cross-skylight', [39, 98, 66], [7, 20, 0]),
    cam('western-long-arm-and-annexes', [-83, 43, 53], [-8, 18, 0]),
    cam('north-sail-and-glazing', [51, 42, -83], [17, 20, -9]),
    cam('detached-belfry-open-slot', [-52, 56, 62], [-13, 43, 16]),
    cam('roof-and-signed-plan', [0, 151, 1], [0, 18, 0]),
  ],
};
