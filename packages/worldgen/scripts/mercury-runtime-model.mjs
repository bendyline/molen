/** Mercury City Tower: seven independent mapped slopes, copper glazing and white folded bands. */
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { normalFor } from './authored-structure-mesh.mjs';
import {
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'mercury_city_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  closeup: { dx: 1.42, dy: 4.05 },
  street: { dx: 3.4, dy: 9 },
  district: { dx: 14, dy: 27 },
  skyline: { dx: 0, dy: 0 },
};
function cleanPlan(plan, tolerance = 0.12) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function facetedGlazing(
  out,
  polygon,
  { dx = 1.52, dy = 4.4196, tint = [0.43, 0.55, 0.59], trim = [0.66, 0.71, 0.72] } = {},
) {
  const normal = normalFor(polygon[0], polygon[1], polygon[2]),
    horizontal = Math.hypot(normal[0], normal[2]);
  if (horizontal < 0.0001) {
    const plan = polygon.map((p) => [p[0], p[2]]);
    mappedCap(out, 'metal', plan, polygon[0][1], [0.46, 0.5, 0.5]);
    return;
  }
  const u = [normal[2] / horizontal, 0, -normal[0] / horizontal],
    d = polygon[0].reduce((s, v, i) => s + v * normal[i], 0);
  const uv = polygon.map((p) => [p[0] * u[0] + p[2] * u[2], p[1]]);
  const world = ([a, b]) => {
    const t = (d - normal[1] * b) / (horizontal * horizontal);
    return [a * u[0] + t * normal[0], b, a * u[2] + t * normal[2]];
  };
  const clip = (poly, axis, bound, sign) => {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = (a[axis] - bound) * sign,
        db = (b[axis] - bound) * sign;
      if (da >= -1e-8) result.push(a);
      if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8))
        result.push(lerp(a, b, da / (da - db)));
    }
    return result.filter(
      (p, i, a) =>
        Math.hypot(p[0] - a[(i + 1) % a.length][0], p[1] - a[(i + 1) % a.length][1]) > 1e-5,
    );
  };
  if (!dx || !dy) {
    for (let j = 1; j < polygon.length - 1; j++)
      tri(out, 'glass', [polygon[0], polygon[j], polygon[j + 1]], tint);
    return;
  }
  const x0 = Math.floor(Math.min(...uv.map((p) => p[0])) / dx),
    x1 = Math.ceil(Math.max(...uv.map((p) => p[0])) / dx);
  const y0 = Math.floor(Math.min(...uv.map((p) => p[1])) / dy),
    y1 = Math.ceil(Math.max(...uv.map((p) => p[1])) / dy);
  const safeTri = (slot, p, color) => {
    const f = p.map((q) => q.map(Math.fround)),
      a = f[1].map((v, i) => v - f[0][i]),
      b = f[2].map((v, i) => v - f[0][i]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) >
      1e-6
    )
      tri(out, slot, f, color);
  };
  // One glass facet and its frames as strips clipped to it, just proud of the glass, instead of
  // an inset pane and frame ring per cell. Strip widths match the old 0.957 / 0.978 cell insets.
  const fill = (poly, slot, color, lift = 0) => {
    if (poly.length < 3) return;
    const points = poly.map((v) => world(v).map((x, i) => x + normal[i] * lift));
    for (const ids of ShapeUtils.triangulateShape(
      poly.map((v) => new Vector2(...v)),
      [],
    )) {
      let t = ids.map((i) => points[i]);
      if (normalFor(...t).reduce((s, v, i) => s + v * normal[i], 0) < 0) t = t.toReversed();
      safeTri(slot, t, color);
    }
  };
  fill(uv, 'glass', tint);
  const wx = dx * 0.0215,
    wy = dy * 0.011;
  for (let x = x0; x <= x1; x++)
    fill(clip(clip(uv, 0, x * dx - wx, 1), 0, x * dx + wx, -1), 'metal', trim, 0.02);
  for (let y = y0; y <= y1; y++)
    fill(clip(clip(uv, 1, y * dy - wy, 1), 1, y * dy + wy, -1), 'metal', trim, 0.02);
  // The facet's own edges carry the frame of the cells they cut.
  const winding = Math.sign(
    uv.reduce(
      (s, p, i) => s + p[0] * uv[(i + 1) % uv.length][1] - p[1] * uv[(i + 1) % uv.length][0],
      0,
    ),
  );
  for (let i = 0; i < uv.length; i++) {
    const a = uv[i],
      b = uv[(i + 1) % uv.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-5) continue;
    const across = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? wy : wx;
    const inward = [
      (-(b[1] - a[1]) / length) * winding * across,
      ((b[0] - a[0]) / length) * winding * across,
    ];
    fill(
      [a, b, [b[0] + inward[0], b[1] + inward[1]], [a[0] + inward[0], a[1] + inward[1]]],
      'metal',
      trim,
      0.02,
    );
  }
}

function clipPolygonPlane(poly, distance, sign = 1) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = distance(a) * sign,
      db = distance(b) * sign;
    if (da >= -1e-7) result.push(a);
    if ((da > 1e-7 && db < -1e-7) || (da < -1e-7 && db > 1e-7))
      result.push(lerp(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i, a) => Math.hypot(...p.map((v, k) => v - a[(i + 1) % a.length][k])) > 1e-5,
  );
}
function subtractConvexVolume(poly, planes) {
  const outside = [];
  let inside = poly;
  for (const distance of planes) {
    const piece = clipPolygonPlane(inside, distance, -1);
    if (piece.length > 2) outside.push(piece);
    inside = clipPolygonPlane(inside, distance);
    if (inside.length < 3) break;
  }
  return outside;
}
function validPolygon(poly) {
  if (poly.length < 3) return false;
  let area = 0;
  for (let i = 1; i < poly.length - 1; i++) {
    const a = poly[i].map((v, k) => v - poly[0][k]),
      b = poly[i + 1].map((v, k) => v - poly[0][k]);
    area += Math.hypot(
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    );
  }
  return area > 0.0001;
}
function buildMercury(out, m, level) {
  const c = settings[level];
  const key = 'mercury_city_tower',
    gold = [0.66, 0.29, 0.085],
    dark = [0.15, 0.12, 0.095],
    white = [0.84, 0.86, 0.85];
  const blocks = partsEvidence(key)
    .filter((p) => p.tags['building:part'])
    .map((p) => {
      const plan = cleanPlan(partPlan(m, p), 0.02),
        height = +p.tags.height + (p.id === 547413255 ? 0.824 : 0),
        rise = +(p.tags['roof:height'] ?? 0);
      const theta = (+(p.tags['roof:direction'] ?? 0) * Math.PI) / 180;
      const e = Math.sin(theta),
        s = -Math.cos(theta),
        d = [
          e * Math.cos(m.heading) - s * Math.sin(m.heading),
          e * Math.sin(m.heading) + s * Math.cos(m.heading),
        ];
      const values = plan.map((q) => q[0] * d[0] + q[1] * d[1]),
        lo = Math.min(...values),
        span = Math.max(...values) - lo;
      const roof = (q) => height - (rise ? (rise * (q[0] * d[0] + q[1] * d[1] - lo)) / span : 0);
      const triangles = ShapeUtils.triangulateShape(
        plan.map((q) => new Vector2(...q)),
        [],
      ).map((ids) => {
        let ring = ids.map((i) => plan[i]);
        if (
          (ring[1][0] - ring[0][0]) * (ring[2][1] - ring[0][1]) -
            (ring[1][1] - ring[0][1]) * (ring[2][0] - ring[0][0]) >
          0
        )
          ring = ring.toReversed();
        return ring;
      });
      // A convex footprint is one clipping volume. Cutting it into triangles adds
      // unnecessary coplanar fragment boundaries on every exposed wall and roof.
      const turns = plan
        .map((a, i) => {
          const b = plan[(i + 1) % plan.length],
            c = plan[(i + 2) % plan.length];
          return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        })
        .filter((v) => Math.abs(v) > 1e-7);
      const volumes = turns.every((v) => v * turns[0] >= 0) ? [plan] : triangles;
      return { id: p.id, plan, roof, height, rise, triangles, volumes };
    });
  // Subtract neighboring mapped solids before glazing their exposed planes. This avoids
  // coplanar walls fighting at the nested setbacks and keeps the sloped roofs closed.
  const exposed = (polygon, owner) => {
    const n = normalFor(polygon[0], polygon[1], polygon[2]);
    let pieces = [polygon];
    for (let index = 0; index < blocks.length; index++) {
      if (index === owner) continue;
      const b = blocks[index],
        bias = index > owner ? -0.0005 : 0.0005;
      for (const ring of b.volumes) {
        const planes = edges(ring).map(
          ({ a, n: outward }) =>
            (q) =>
              -(
                (q[0] + n[0] * bias - a[0]) * outward[0] +
                (q[2] + n[2] * bias - a[1]) * outward[2]
              ),
        );
        planes.push((q) => b.roof([q[0], q[2]]) - q[1] - 0.001);
        pieces = pieces.flatMap((p) => subtractConvexVolume(p, planes)).filter(validPolygon);
      }
    }
    return pieces;
  };
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.22, [0.27, 0.25, 0.22]);
  blocks.forEach((b, index) => {
    for (const { a, c: unused, b: end, n } of edges(b.plan)) {
      void unused;
      const wall = [
        [a[0], 0.22, a[1]],
        [end[0], 0.22, end[1]],
        [end[0], b.roof(end), end[1]],
        [a[0], b.roof(a), a[1]],
      ];
      for (const p of exposed(wall, index))
        facetedGlazing(out, p, { dx: c.dx, dy: c.dy, tint: gold, trim: dark });
      // White folded-aluminum bands follow the actual three-dimensional setback edge.
      for (const p of exposed(
        [
          [a[0], b.roof(a) - 1.2, a[1]],
          [end[0], b.roof(end) - 1.2, end[1]],
          [end[0], b.roof(end), end[1]],
          [a[0], b.roof(a), a[1]],
        ],
        index,
      )) {
        for (let j = 1; j < p.length - 1; j++)
          tri(
            out,
            'metal',
            [p[0], p[j], p[j + 1]].map((q) => shift(q, n, 0.035).map(Math.fround)),
            white,
          );
      }
      const mid = lerp(a, end, 0.025),
        corner = [
          [a[0], 0.23, a[1]],
          [mid[0], 0.23, mid[1]],
          [mid[0], b.roof(mid), mid[1]],
          [a[0], b.roof(a), a[1]],
        ];
      for (const p of exposed(corner, index))
        for (let j = 1; j < p.length - 1; j++)
          tri(
            out,
            'metal',
            [p[0], p[j], p[j + 1]].map((q) => shift(q, n, 0.045).map(Math.fround)),
            white,
          );
    }
    for (const t of b.triangles) {
      const polygon = t.map((q) => [q[0], b.roof(q), q[1]]);
      for (const p of exposed(polygon, index)) {
        if (b.id === 547413255)
          facetedGlazing(out, p, { dx: c.dx, dy: c.dy, tint: [0.58, 0.27, 0.09], trim: dark });
        else
          for (let j = 1; j < p.length - 1; j++)
            tri(
              out,
              'metal',
              [p[0], p[j], p[j + 1]].map((q) => q.map(Math.fround)),
              [0.76, 0.78, 0.76],
            );
      }
    }
  });
  const top = blocks.find((p) => p.id === 547413255);
  // The owner identifies the four dark LED faces on floors67–68, total1350 m².
  for (const { a, b, n, len } of edges(top.plan)) {
    if (len < 7) continue;
    const aa = lerp(a, b, 0.035),
      bb = lerp(a, b, 0.965);
    const p = [
      [aa[0], 294, aa[1]],
      [bb[0], 294, bb[1]],
      [bb[0], 304.5, bb[1]],
      [aa[0], 304.5, aa[1]],
    ].map((q) => shift(q, n, 0.075));
    for (const poly of exposed(p, blocks.indexOf(top)))
      facetedGlazing(out, poly, {
        dx: c.dx,
        dy: c.dy ? Math.max(3.5, c.dy) : 0,
        tint: [0.055, 0.065, 0.064],
        trim: [0.17, 0.19, 0.18],
      });
  }
  // Bronze street glazing and the pointed eastern entrance follow the mapped nose.
  const nose = blocks.find((p) => p.id === 1279791780);
  for (const { a, b, n } of edges(nose.plan)) {
    if (Math.max(a[0], b[0]) < 39) continue;
    facetedGlazing(
      out,
      [
        [a[0], 0.24, a[1]],
        [b[0], 0.24, b[1]],
        [b[0], 7.1, b[1]],
        [a[0], 7.1, a[1]],
      ].map((q) => shift(q, n, 0.09)),
      {
        tint: [0.32, 0.22, 0.14],
        dx: c.dx ? Math.max(1.6, c.dx) : 0,
        dy: c.dy ? Math.max(3.45, c.dy) : 0,
        trim: white,
      },
    );
  }
}

function skylineOutput(out) {
  return {
    addTriangle(slot, _ref, points, normal, uv, color) {
      const graph = scope.surfaceOverrides[slot]?.graph,
        mean = scope.sourceFacts.surfaceMeans[graph] ?? [1, 1, 1];
      out.addTriangle(
        'glass',
        'palette:#ffffff',
        points,
        normal,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    },
    addQuad(slot, _ref, points, normal, uv, color) {
      const graph = scope.surfaceOverrides[slot]?.graph,
        mean = scope.sourceFacts.surfaceMeans[graph] ?? [1, 1, 1];
      out.addQuad(
        'glass',
        'palette:#ffffff',
        points,
        normal,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    },
  };
}

export const buildMercuryCloseup = (out) => buildMercury(out, map, 'closeup');
export const buildMercuryStreet = (out) => buildMercury(out, map, 'street');
export const buildMercuryDistrict = (out) => buildMercury(out, map, 'district');
export const buildMercurySkyline = (out) => buildMercury(skylineOutput(out), map, 'skyline');
