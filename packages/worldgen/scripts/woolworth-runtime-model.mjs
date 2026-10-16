/** Full mapped Woolworth parcel; compound copper crown and a genuinely recessed Tudor portal. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  ringAt,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0157_woolworth_building',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'), 'utf8')),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'), 'utf8')),
  parts = partsEvidence(key),
  cream = [1, 0.98, 0.9],
  limestone = [0.87, 0.85, 0.78],
  copper = [0.33, 0.5, 0.41],
  glass = [0.17, 0.22, 0.23],
  center = [14.25, 0.1];
const plan = (id) =>
  partPlan(
    map,
    parts.find((p) => p.id === id),
  );
const edges = (p) =>
  p
    .map((a, i) => {
      const b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.02);
const wall = (a, b, lo, hi) => [
  [a[0], lo, a[1]],
  [b[0], lo, b[1]],
  [b[0], hi, b[1]],
  [a[0], hi, a[1]],
];

// Convex Tudor opening in (z,y). Subtract it from every forward facade layer, not just glass.
const opening = [
  [-4, 0.15],
  [4, 0.15],
  [4, 7.2],
  [3.9, 8],
  [3.45, 8.75],
  [2.6, 9.55],
  [1.45, 10.35],
  [0, 10.8],
  [-1.45, 10.35],
  [-2.6, 9.55],
  [-3.45, 8.75],
  [-3.9, 8],
  [-4, 7.2],
];
function clipped(poly, a, b, side) {
  const value = (p) => side * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[2] - a[0]));
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      v = value(p),
      w = value(q);
    if (v >= -1e-9) result.push(p);
    if (v >= -1e-9 !== w >= -1e-9) result.push(lerp(p, q, v / (v - w)));
  }
  return result;
}
function subtractPortal(poly) {
  let remaining = poly;
  const outside = [];
  for (let i = 0; i < opening.length; i++) {
    const a = opening[i],
      b = opening[(i + 1) % opening.length],
      p = clipped(remaining, a, b, -1);
    if (p.length >= 3) outside.push(p);
    remaining = clipped(remaining, a, b, 1);
    if (remaining.length < 3) break;
  }
  return outside;
}
function portalSafe(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, ref, points, normal, uv, color) => {
      if (!points.every((p) => p[0] > 28.6) || Math.min(...points.map((p) => p[1])) > 11.1) {
        out[method](component, ref, points, normal, uv, color);
        return;
      }
      for (const polygon of subtractPortal(points))
        for (let i = 2; i < polygon.length; i++) {
          const ps = [polygon[0], polygon[i - 1], polygon[i]],
            a = ps[1].map((v, k) => v - ps[0][k]),
            b = ps[2].map((v, k) => v - ps[0][k]);
          if (
            Math.hypot(
              a[1] * b[2] - a[2] * b[1],
              a[2] * b[0] - a[0] * b[2],
              a[0] * b[1] - a[1] * b[0],
            ) < 1e-7
          )
            continue;
          out.addTriangle(
            component,
            ref,
            ps,
            normalFor(...ps),
            [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            color,
          );
        }
    };
  return wrapped;
}
function flatTrim(out, component, a, b, n, width, color) {
  const length = Math.hypot(...a.map((v, i) => b[i] - v)),
    t = b.map((v, i) => (v - a[i]) / length),
    s = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
  face(
    out,
    component,
    [
      shift(a, s, -width / 2),
      shift(b, s, -width / 2),
      shift(b, s, width / 2),
      shift(a, s, width / 2),
    ],
    color,
  );
}
function gothicWall(out, p, y0, y1, dy, component, color, level) {
  mappedSolid(out, component, p, y0, y1, color);
  if (level === 'skyline') return;
  const fine = level === 'source',
    near = fine || level === 'closeup',
    district = level === 'district';
  for (const { a, b, n, len } of edges(p)) {
    const roofCovered = y1 === 120 && a[0] < 0 && b[0] < 0 && len > 8;
    const count = Math.max(1, Math.round(len / 2.8)),
      t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
    for (let i = 0; i < count; i++) {
      const c = lerp(a, b, (i + 0.5) / count),
        at = (x, y, d = 0.065) => [c[0] + t[0] * x + n[0] * d, y, c[1] + t[2] * x + n[2] * d],
        w = Math.min(1.36, (len / count) * 0.58);
      if (district) {
        face(
          out,
          'glass',
          [at(-w / 2, y0 + 1), at(w / 2, y0 + 1), at(w / 2, y1 - 2), at(-w / 2, y1 - 2)],
          glass,
        );
        continue;
      }
      for (let y = y0 + 1; y < y1 - 2; y += dy) {
        const h = Math.min(2.25, y1 - y - 0.4),
          pointed = y > y1 - dy * 2,
          q = pointed
            ? [
                at(-w / 2, y),
                at(w / 2, y),
                at(w / 2, y + h * 0.64),
                at(0, y + h),
                at(-w / 2, y + h * 0.64),
              ]
            : [at(-w / 2, y), at(w / 2, y), at(w / 2, y + h), at(-w / 2, y + h)];
        if (roofCovered && y + h > 113) continue;
        for (let k = 1; k < q.length - 1; k++) tri(out, 'glass', [q[0], q[k], q[k + 1]], glass);
        if (near) {
          for (let k = 0; k < q.length; k++) {
            const aa = shift(q[k], n, 0.03),
              bb = shift(q[(k + 1) % q.length], n, 0.03);
            if (fine && pointed) beam(out, component, aa, bb, 0.11, 0.15, color);
            else flatTrim(out, component, aa, bb, n, 0.11, color);
          }
          if (pointed)
            flatTrim(out, component, at(0, y, 0.1), at(0, y + h * 0.75, 0.1), n, 0.07, color);
          if (fine)
            beam(
              out,
              component,
              at(-w * 0.65, y - 0.14, 0.17),
              at(w * 0.65, y - 0.14, 0.17),
              0.18,
              0.28,
              color,
            );
          else
            face(
              out,
              component,
              [
                at(-w * 0.65, y - 0.23, 0.2),
                at(w * 0.65, y - 0.23, 0.2),
                at(w * 0.65, y - 0.05, 0.2),
                at(-w * 0.65, y - 0.05, 0.2),
              ],
              color,
            );
        }
        if (pointed && level !== 'street')
          face(
            out,
            component,
            [
              at(-w * 0.65, y + h + 0.08, 0.12),
              at(w * 0.65, y + h + 0.08, 0.12),
              at(w * 0.65, y + h + 0.23, 0.12),
              at(-w * 0.65, y + h + 0.23, 0.12),
            ],
            [0.21, 0.34, 0.48],
          );
      }
      const c2 = lerp(a, b, i / count);
      if (near)
        beam(
          out,
          component,
          shift([c2[0], y0, c2[1]], n, 0.15),
          shift([c2[0], roofCovered ? 113 : y1, c2[1]], n, 0.15),
          0.18,
          0.31,
          color,
        );
    }
    if (district)
      for (let y = y0 + 3.25; y < y1 - 1; y += dy)
        face(
          out,
          component,
          wall(a, b, y, y + dy - 2.25).map((p) => shift(p, n, 0.08)),
          color,
        );
  }
  if (level !== 'district')
    for (const y of [y0 + 0.35, y1 - 0.5]) bandPlan(out, p, y, 0.34, 0.44, color, component);
}
function finial(out, x, z, y, h, r, level) {
  const profile =
      level === 'skyline'
        ? [
            [y, r],
            [y + h, 0.025],
          ]
        : level === 'district'
          ? [
              [y, r],
              [y + h * 0.32, r * 1.15],
              [y + h, 0.025],
            ]
          : [
              [y, r],
              [y + h * 0.25, r],
              [y + h * 0.32, r * 1.15],
              [y + h * 0.85, r * 0.15],
              [y + h, 0.025],
            ],
    sides = level === 'skyline' || level === 'district' ? 4 : level === 'street' ? 6 : 8;
  loft(
    out,
    'cladding',
    profile.map(([yy, rr]) => radialRing(yy, rr, rr, sides, [x, z])),
    cream,
  );
}
function crown(out, level) {
  const p = plan(274782341),
    top = p.map((q) => lerp(q, center, 0.67)),
    coarse = level === 'skyline' || level === 'district',
    ring = (p, y) => ringAt(p, y);
  loft(out, 'patina', [ring(p, 194), ring(top, 224)], copper);
  // The owner photo and designation report show an upper window lantern, not one uninterrupted cone.
  mappedSolid(out, 'cladding', top, 224, 236.2, cream);
  for (const { a, b, n, len } of edges(top)) {
    const aa = lerp(a, b, 0.19),
      bb = lerp(a, b, 0.81),
      q = wall(aa, bb, 225, 233.8).map((p) => shift(p, n, 0.07));
    face(out, 'glass', q, glass);
    if (!coarse)
      flatTrim(
        out,
        'cladding',
        shift([aa[0], 233.8, aa[1]], n, 0.09),
        shift([bb[0], 233.8, bb[1]], n, 0.09),
        n,
        0.18,
        cream,
      );
    if (len > 1.1 && !coarse)
      beam(
        out,
        'cladding',
        shift([a[0], 224, a[1]], n, 0.1),
        shift([a[0], 236.2, a[1]], n, 0.1),
        0.2,
        0.25,
        cream,
      );
  }
  loft(
    out,
    'patina',
    [
      ring(top, 236.2),
      ring(
        top.map((q) => lerp(q, center, 0.96)),
        237.8,
      ),
    ],
    copper,
  );
  finial(out, ...center, 237.8, 3.6016, 0.3, level);
  if (level === 'skyline') return;
  // Vertical glazed dormer faces and their roof returns intersect the sloping copper envelope.
  for (const { a, b, n, len } of edges(p).filter((e) => e.len > 7.5))
    for (const y of coarse ? [210] : [205, 213, 219]) {
      const f = ((y - 194) / 30) * 0.67,
        c = lerp(lerp(a, b, 0.5), center, f),
        t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
        at = (s, yy, d) => [c[0] + s * t[0] + d * n[0], yy, c[1] + s * t[2] + d * n[2]],
        lower = [
          at(-0.72, y, 0.48),
          at(0.72, y, 0.48),
          at(0.72, y + 1.8, 0.48),
          at(-0.72, y + 1.8, 0.48),
        ],
        apex = at(0, y + 2.45, 0.48);
      panel(out, lower, glass, 0.14, cream, 'cladding');
      tri(out, 'cladding', [lower[3], lower[2], apex], cream);
      face(
        out,
        'patina',
        [lower[3], apex, at(0, y + 2.45, -1.4), at(-0.72, y + 1.8, -1.4)],
        copper,
      );
      face(out, 'patina', [apex, lower[2], at(0.72, y + 1.8, -1.4), at(0, y + 2.45, -1.4)], copper);
      for (const s of [-1, 1])
        face(
          out,
          'cladding',
          [
            at(s * 0.72, y, 0.48),
            at(s * 0.72, y + 1.8, 0.48),
            at(s * 0.72, y + 1.8, -1.4),
            at(s * 0.72, y, -1.4),
          ],
          cream,
        );
    }
}
function portal(out, level) {
  const far = level === 'skyline' || level === 'district',
    path = opening.map(([z, y]) => [29.136, y, z]),
    back = path.map((p) => [28.35, p[1], p[2]]);
  // Reverse the (z,y) loop so its front face points +X toward Broadway.
  for (let i = 1; i < back.length - 1; i++)
    tri(out, 'recess', [back[0], back[i + 1], back[i]], [0.07, 0.08, 0.085]);
  for (let i = 0; i < path.length; i++)
    face(
      out,
      'limestone',
      [path[i], back[i], back[(i + 1) % path.length], path[(i + 1) % path.length]],
      limestone,
    );
  const n = [1, 0, 0];
  for (const offset of far ? [0] : [0, 0.22, 0.44])
    for (let i = 1; i < path.length; i++) {
      const p = path[i],
        q = path[(i + 1) % path.length],
        a = [
          29.15 + offset * 0.18,
          p[1] + (p[1] > 7 ? offset : 0),
          p[2] + Math.sign(p[2]) * offset,
        ],
        b = [
          29.15 + offset * 0.18,
          q[1] + (q[1] > 7 ? offset : 0),
          q[2] + Math.sign(q[2]) * offset,
        ];
      if (far) flatTrim(out, 'limestone', a, b, n, 0.28, limestone);
      else beam(out, 'limestone', a, b, 0.28, 0.3, limestone);
    }
  if (far) return;
  const door = (z0, z1, y0, y1) =>
    panel(
      out,
      [
        [28.47, y0, z1],
        [28.47, y0, z0],
        [28.47, y1, z0],
        [28.47, y1, z1],
      ],
      glass,
      0.12,
      [0.5, 0.32, 0.17],
      'bronze',
    );
  for (const [a, b] of [
    [-3.75, -1.65],
    [-1.45, 1.45],
    [1.65, 3.75],
  ])
    door(a, b, 0.2, 3.5);
  for (const [a, b] of [
    [-3.65, -1.35],
    [-1.18, 1.18],
    [1.35, 3.65],
  ])
    door(a, b, 3.75, 7.3);
  loft(
    out,
    'bronze',
    [radialRing(0.2, 1.2, 1.2, 12, [28.25, 0]), radialRing(3.5, 1.2, 1.2, 12, [28.25, 0])],
    [0.5, 0.32, 0.17],
  );
  // Dark glazing on the front half keeps the revolving enclosure legible without rendering its interior.
  for (const { a, b } of edges(
    Array.from({ length: 7 }, (_, i) => [
      28.25 + Math.cos(-Math.PI / 2 + (i * Math.PI) / 6) * 1.22,
      Math.sin(-Math.PI / 2 + (i * Math.PI) / 6) * 1.22,
    ]).toReversed(),
  ))
    face(out, 'glass', wall(a, b, 0.4, 3.35), glass);
  box(out, 'limestone', [28.94, 11.6, -4.8], [29.75, 12.25, 4.8], limestone);
  for (let z = -4.5; z <= 4.5; z += 0.75)
    box(out, 'limestone', [29.42, 12.25, z - 0.12], [29.64, 13.15, z + 0.12], limestone);
}
function structure(out, level) {
  const safe = portalSafe(out),
    base = localOutline(map),
    fine = level === 'source',
    coarse = level === 'skyline' || level === 'district';
  gothicWall(safe, base, 0, 17.6, 4.2, 'limestone', limestone, level);
  gothicWall(safe, base, 17.6, 113, 3.77, 'cladding', cream, level);
  const roofEdges = edges(base),
    roofTop = base.map((p, i) => {
      if (p[0] > 0) return p;
      const a = roofEdges[(i + roofEdges.length - 1) % roofEdges.length].n,
        b = roofEdges[i].n,
        scale = 2.5 / (1 + a[0] * b[0] + a[2] * b[2]);
      return [p[0] - (a[0] + b[0]) * scale, p[1] - (a[2] + b[2]) * scale];
    });
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length,
      { a, b } = roofEdges[i],
      c = roofTop[i],
      d = roofTop[j];
    face(
      out,
      a[0] < 0 && b[0] < 0 ? 'patina' : 'cladding',
      [
        [a[0], 113, a[1]],
        [b[0], 113, b[1]],
        [d[0], 120, d[1]],
        [c[0], 120, c[1]],
      ],
      a[0] < 0 && b[0] < 0 ? copper : cream,
    );
  }
  mappedCap(out, 'cladding', roofTop, 120, cream);
  // The lower wings retain a shallow copper mansard with dormers. Its dimensions are reconstructed.
  for (const { a, b, n, len } of edges(base).filter((e) => e.a[0] < 0 && e.b[0] < 0 && e.len > 8)) {
    if (!coarse)
      for (let i = 1; i < Math.floor(len / 7); i++) {
        const c = lerp(a, b, i / Math.floor(len / 7)),
          t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
          at = (s, y) => [c[0] + t[0] * s - n[0] * 0.15, y, c[1] + t[2] * s - n[2] * 0.15];
        panel(
          out,
          [at(-0.65, 114), at(0.65, 114), at(0.65, 116), at(-0.65, 116)],
          glass,
          0.13,
          cream,
          'cladding',
        );
        tri(out, 'cladding', [at(-0.8, 116), at(0.8, 116), at(0, 117)], cream);
      }
  }
  // Physical polished granite water table; this is not a baked contact shadow.
  for (const { a, b, n } of edges(base))
    face(
      safe,
      'stone',
      wall(a, b, 0, 2.1336).map((p) => shift(p, n, 0.045)),
      [0.62, 0.62, 0.6],
    );
  for (const [edgeIndex, { len }] of roofEdges.entries()) {
    const count = coarse ? 1 : Math.max(1, Math.floor(len / 8));
    for (let i = 0; i < count + (coarse ? 0 : 1); i++) {
      const q = lerp(roofTop[edgeIndex], roofTop[(edgeIndex + 1) % roofTop.length], i / count);
      finial(out, ...q, 120, 4.3, 0.58, level);
    }
  }
  for (const id of [274782323, 274782344]) {
    const p = parts.find((p) => p.id === id);
    gothicWall(out, plan(id), +p.tags.min_height, +p.tags.height, 3.7, 'cladding', cream, level);
  }
  for (const id of [
    274782327, 274782330, 274782332, 274782336, 274782325, 274782329, 274782334, 274782339,
  ]) {
    const p = parts.find((p) => p.id === id),
      q = plan(id),
      top = +p.tags.height,
      roof = +p.tags['roof:height'],
      c = q.reduce((s, p) => s.map((v, i) => v + p[i] / q.length), [0, 0]);
    gothicWall(out, q, +p.tags.min_height, top - roof, 3.8, 'cladding', cream, level);
    loft(
      out,
      'patina',
      [
        ringAt(q, top - roof),
        ringAt(
          q.map((p) => lerp(p, c, 0.99)),
          top,
        ),
      ],
      copper,
    );
    if (level !== 'district') finial(out, ...c, top, 0.9, 0.18, level);
  }
  crown(out, level);
  portal(out, level);
  // Fine source retains 3D sill and arch sections; browser derivatives use flat trim instead.
  if (fine)
    for (const { a, len, n } of edges(plan(274782341)))
      if (len > 7.5)
        beam(
          out,
          'patina',
          shift([a[0], 194, a[1]], n, 0.04),
          [center[0] + (a[0] - center[0]) * 0.33, 224, center[1] + (a[1] - center[1]) * 0.33],
          0.18,
          0.2,
          copper,
        );
}
export function buildWoolworthReviewedMaster(out) {
  structure(out, 'source');
}
export function buildWoolworthCloseup(out) {
  structure(out, 'closeup');
}
export function buildWoolworthStreet(out) {
  structure(out, 'street');
}
export function buildWoolworthDistrict(out) {
  structure(out, 'district');
}
export function buildWoolworthSkyline(out) {
  const graphs = {
      limestone: 'stone_limestone',
      cladding: 'tile_ceramic',
      patina: 'metal_copper',
      stone: 'stone_granite',
      bronze: 'metal_bronze_cast',
    },
    wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const mean = scope.sourceFacts.surfaceMeans[graphs[component]];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  structure(wrapped, 'skyline');
}
