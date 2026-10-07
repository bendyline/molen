/** 30 Rockefeller Plaza: mapped Art Deco slab, carved portals and three-tier observation crown. */
import { ShapeUtils, Vector2 } from 'three';
import { loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const stone = [0.73, 0.71, 0.66],
  silver = [0.19, 0.215, 0.225],
  glass = [0.13, 0.185, 0.2],
  bronze = [0.51, 0.35, 0.14];
function clean(plan) {
  let p = plan;
  for (let k = 0; k < 4; k++)
    p = p.filter((b, i) => {
      const a = p[(i + p.length - 1) % p.length],
        c = p[(i + 1) % p.length];
      const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return (
        l < 0.02 ||
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / l > 0.028
      );
    });
  return clockwise(p);
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.04);
}
function inside([x, z], plan) {
  let hit = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}
function exposed(block, blocks, start) {
  const result = [];
  for (const { a, b, len, n } of edges(block.plan)) {
    const d = [b[0] - a[0], b[1] - a[1]],
      cuts = [0, 1];
    for (const other of blocks) {
      if (other === block) continue;
      for (const { a: p, b: q } of edges(other.plan)) {
        const e = [q[0] - p[0], q[1] - p[1]],
          den = d[0] * e[1] - d[1] * e[0];
        if (Math.abs(den) > 1e-8) {
          const t = ((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]) / den,
            u = ((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / den;
          if (t > 1e-7 && t < 1 - 1e-7 && u >= -1e-6 && u <= 1 + 1e-6) cuts.push(t);
        }
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (len * len),
          distance = Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / len;
        if (distance < 0.09 && t > 1e-7 && t < 1 - 1e-7) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      if ((cuts[k] - cuts[k - 1]) * len < 0.065) continue;
      const aa = lerp(a, b, cuts[k - 1]),
        bb = lerp(a, b, cuts[k]),
        mid = lerp(aa, bb, 0.5),
        outside = [mid[0] + n[0] * 0.065, mid[1] + n[2] * 0.065],
        insidePoint = [mid[0] - n[0] * 0.065, mid[1] - n[2] * 0.065],
        coincident = blocks.filter(
          (o) => o !== block && inside(insidePoint, o.plan) && !inside(outside, o.plan),
        );
      // Nested map parts often repeat the same outward edge. Only its tallest
      // owner emits the facade; otherwise every low part stacks a duplicate skin.
      if (
        coincident.some(
          (o) =>
            o.top > block.top + 0.01 || (Math.abs(o.top - block.top) < 0.01 && o.id < block.id),
        )
      )
        continue;
      const bottom = Math.max(
        start,
        ...blocks.filter((o) => o !== block && inside(outside, o.plan)).map((o) => o.top),
      );
      if (bottom < block.top - 0.03) result.push({ a: aa, b: bb, n, bottom, top: block.top });
    }
  }
  return result;
}
function frame(a, b, n) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / l, 0, (b[1] - a[1]) / l];
  return (x, y, d = 0) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[2] * x + n[2] * d];
}
function panel(out, at, x0, x1, y0, y1, slot, color, depth = 0) {
  if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return;
  face(
    out,
    slot,
    [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    color,
  );
}
function raised(out, at, x0, x1, y0, y1, depth, color = stone, slot = 'limestone') {
  const p = [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    q = [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)];
  face(out, slot, p, color);
  for (let i = 0; i < 4; i++) face(out, slot, [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]], color);
}
function windows(out, a, b, n, lo, hi, ground = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frame(a, b, n),
    step = ground ? 3.7 : 2.42,
    count = Math.max(1, Math.round(len / step)),
    bw = len / count;
  if (hi - lo < 2.6 || bw < 0.8) {
    panel(out, at, 0, len, lo, hi, 'limestone', stone);
    return;
  }
  for (let i = 0; i < count; i++) {
    const c = (i + 0.5) * bw,
      w = Math.min(ground ? 2.9 : 1.38, bw * 0.68),
      a = c - w / 2,
      b = c + w / 2,
      y0 = ground ? lo + 0.38 : lo + 0.42,
      y1 = ground ? hi - 0.5 : hi - 1.15;
    panel(out, at, i * bw, a, lo, hi, 'limestone', stone);
    panel(out, at, b, (i + 1) * bw, lo, hi, 'limestone', stone);
    panel(out, at, a, b, lo, y0, 'metal', silver, -0.13);
    panel(out, at, a, b, y1, hi, 'metal', silver, -0.13);
    const p = [at(a, y0), at(b, y0), at(b, y1), at(a, y1)],
      q = [at(a, y0, -0.17), at(b, y0, -0.17), at(b, y1, -0.17), at(a, y1, -0.17)];
    for (let k = 0; k < 4; k++)
      face(out, 'limestone', [p[k], q[k], q[(k + 1) % 4], p[(k + 1) % 4]], stone);
    // 3.5 cm mullions are below the closeup's error on a 260 m tower: the window is its glass.
    face(out, 'glass', q, glass);
    // The aluminum spandrels are recessed behind the continuous stone piers. Their 6 cm ribs and
    // the piers' 11 cm edge mouldings are below every runtime level's error, so they are omitted.
  }
}
function leaf(out, at, c, base, w, h) {
  // Closed cast-aluminum pointed leaves with back faces. Their eyelets and ribs are a few
  // centimetres across, below the closeup's error, so the leaves are solid.
  for (const sign of [-1, 1]) {
    const cx = c + sign * w * 0.245;
    const outer = [
      [cx - w * 0.225, base],
      [cx + w * 0.225, base],
      [cx + w * 0.225, base + h * 0.72],
      [cx, base + h],
      [cx - w * 0.225, base + h * 0.72],
    ];
    const holes = [];
    const all = [...outer, ...holes.flat()],
      indices = ShapeUtils.triangulateShape(
        outer.map((p) => new Vector2(...p)),
        holes.map((r) => r.map((p) => new Vector2(...p))),
      );
    for (const idx of indices) {
      let p = idx.map((i) => all[i]);
      if ((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]) < 0)
        p = p.reverse();
      tri(
        out,
        'metal',
        p.map((q) => at(...q, 0.17)),
        silver,
      );
      tri(
        out,
        'metal',
        [...p].reverse().map((q) => at(...q, 0.06)),
        silver,
      );
    }
    for (const ring of [outer, ...holes])
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        face(
          out,
          'metal',
          [at(...a, 0.17), at(...a, 0.06), at(...b, 0.06), at(...b, 0.17)],
          silver,
        );
      }
  }
}
function parapet(out, a, b, n, y, kind = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frame(a, b, n),
    count = Math.max(1, Math.round(len / 2.42)),
    bw = len / count;
  if (len < 0.55) return;
  raised(out, at, 0, len, y - 0.22, y + 0.05, 0.1);
  for (let i = 0; i < count; i++) {
    const c = (i + 0.5) * bw,
      w = Math.min(1.38, bw * 0.68);
    if (kind) {
      leaf(out, at, c, y - 0.75, w, kind === 4 ? 2.1 : 1.28);
    } else
      for (let k = -2; k <= 2; k++)
        raised(
          out,
          at,
          c + (k * w) / 5 - 0.04,
          c + (k * w) / 5 + 0.04,
          y - 0.8,
          y + 0.13 - Math.abs(k) * 0.08,
          0.08,
          [0.39, 0.43, 0.43],
          'metal',
        );
    // The low pointed back rail remains open between its thin cast-metal arches.
    const p0 = at(c - bw * 0.44, y + 0.08, -0.2),
      p1 = at(c, y + 0.59, -0.2),
      p2 = at(c + bw * 0.44, y + 0.08, -0.2);
    tube(out, 'metal', p0, p1, 0.026, silver, 5);
    tube(out, 'metal', p1, p2, 0.026, silver, 5);
  }
}
function polygonRelief(out, at, points, depth, color) {
  // A relief stroke is a small convex faceted piece. Shared limestone retains
  // its grain while vertex tints carry the carved figure and polychrome field.
  const area = points.reduce(
    (sum, p, i) =>
      sum + p[0] * points[(i + 1) % points.length][1] - p[1] * points[(i + 1) % points.length][0],
    0,
  );
  if (area < 0) points = [...points].reverse();
  const p = points.map(([x, y]) => at(x, y, depth));
  for (const indices of ShapeUtils.triangulateShape(
    points.map((p) => new Vector2(...p)),
    [],
  )) {
    let q = indices.map((i) => points[i]);
    if ((q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) < 0)
      q = q.reverse();
    tri(
      out,
      'carved',
      q.map((p) => at(...p, depth)),
      color,
    );
  }
  for (let i = 0; i < p.length; i++)
    face(
      out,
      'carved',
      [
        p[i],
        at(...points[i], 0.015),
        at(...points[(i + 1) % p.length], 0.015),
        p[(i + 1) % p.length],
      ],
      color,
    );
}
function relief(out, at, c, y, w, h, kind) {
  panel(out, at, c - w / 2, c + w / 2, y, y + h, 'metal', [0.27, 0.105, 0.085], 0.02);
  const path = (pts, r = 0.035, color = bronze, depth = 0.1) => {
    for (let i = 1; i < pts.length; i++)
      tube(
        out,
        'metal',
        at(c + pts[i - 1][0] * w, y + pts[i - 1][1] * h, depth),
        at(c + pts[i][0] * w, y + pts[i][1] * h, depth),
        r,
        color,
        6,
      );
  };
  // Stylized sun/cloud contours follow the documented three different compositions.
  for (let j = 0; j < 5; j++) {
    const u = j * 0.11;
    path(
      [
        [-0.49, 0.18 + u],
        [-0.35, 0.22 + u],
        [-0.29, 0.32 + u],
        [-0.12, 0.36 + u],
        [0.05, 0.42 + u],
        [0.25, 0.55 + u],
        [0.49, 0.57 + u],
      ],
      0.035,
      [0.66, 0.46, 0.18],
      0.08,
    );
  }
  const body = [
    [-0.09, 0.25],
    [0.19, 0.2],
    [0.29, 0.4],
    [0.16, 0.56],
    [-0.07, 0.57],
    [-0.16, 0.41],
  ];
  const faceted = (pts, depth = 0.22, color = [0.72, 0.69, 0.59]) =>
    polygonRelief(
      out,
      at,
      pts.map(([x, v]) => [c + x * w, y + v * h]),
      depth,
      color,
    );
  const round = (cx, cy, rx, ry, depth = 0.3) => {
    const proxy = {
      addQuad(slot, _ref, p, _n, _uv, color) {
        face(
          out,
          slot,
          p.map((p) => at(...p)),
          color,
        );
      },
      addTriangle(slot, _ref, p, _n, _uv, color) {
        tri(
          out,
          slot,
          p.map((p) => at(...p)),
          color,
        );
      },
    };
    sphere(
      proxy,
      'carved',
      [c + cx * w, y + cy * h, depth],
      [rx * w, ry * h, 0.11],
      [0.73, 0.705, 0.65],
      20,
      12,
    );
  };
  if (kind === 0) {
    faceted(body);
    round(0.035, 0.46, 0.15, 0.19, 0.26);
    faceted(
      [
        [-0.12, 0.58],
        [-0.35, 0.72],
        [-0.41, 0.85],
        [-0.3, 0.88],
        [-0.12, 0.73],
        [0.06, 0.57],
      ],
      0.3,
    );
    faceted(
      [
        [0.14, 0.56],
        [0.23, 0.7],
        [0.47, 0.81],
        [0.49, 0.91],
        [0.2, 0.82],
        [-0.01, 0.67],
      ],
      0.26,
    );
    round(0.06, 0.84, 0.085, 0.11, 0.35);
    faceted(
      [
        [-0.02, 0.8],
        [0.14, 0.8],
        [0.13, 0.65],
        [0.035, 0.55],
        [-0.025, 0.64],
      ],
      0.41,
    );
    round(0.055, 0.813, 0.022, 0.035, 0.48);
    for (const u of [0.015, 0.095])
      path(
        [
          [u - 0.018, 0.853],
          [u + 0.018, 0.85],
        ],
        0.021,
        [0.34, 0.32, 0.27],
        0.44,
      );
    for (let k = 0; k < 7; k++)
      path(
        [
          [0.015 + k * 0.016, 0.72],
          [0.005 + k * 0.013, 0.59],
          [-0.04 + k * 0.013, 0.52],
        ],
        0.022,
        [0.48, 0.47, 0.4],
        0.43,
      );
    path(
      [
        [-0.02, 0.27],
        [-0.25, 0.08],
        [0.22, 0.08],
        [-0.02, 0.27],
      ],
      0.04,
      [0.69, 0.49, 0.21],
      0.35,
    );
    for (let k = -2; k <= 2; k++)
      path(
        [
          [0.05 + k * 0.029, 0.87],
          [0.04 + k * 0.055, 0.99],
        ],
        0.035,
        bronze,
        0.38,
      );
  } else {
    const flip = kind === 1 ? 1 : -1,
      pts = [
        [-0.4, 0.22],
        [-0.08, 0.28],
        [0.07, 0.48],
        [0.35, 0.63],
        [0.42, 0.83],
        [0.16, 0.83],
        [-0.04, 0.61],
        [-0.22, 0.5],
      ];
    faceted(
      pts.map(([x, v]) => [x * flip, v]),
      0.28,
    );
    faceted(
      [
        [-0.25, 0.53],
        [-0.35, 0.62],
        [-0.33, 0.82],
        [-0.19, 0.88],
        [-0.09, 0.73],
        [-0.12, 0.58],
      ].map(([x, v]) => [x * flip, v]),
      0.38,
    );
    round(-0.23 * flip, 0.745, 0.105, 0.125, 0.39);
    for (let k = 0; k < 4; k++)
      path(
        [
          [-0.5 * flip, 0.13 + k * 0.09],
          [0.45 * flip, 0.36 + k * 0.12],
        ],
        0.021,
        [0.74, 0.51, 0.18],
        0.33,
      );
  }
}
function mainEntrance(out, a, b, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frame(a, b, n),
    centers = [len / 2 - 6.2, len / 2, len / 2 + 6.2],
    widths = [3.96, 4.2672, 3.96],
    heights = [8.2296, 11.2776, 8.2296],
    cuts = [0];
  for (let i = 0; i < 3; i++) cuts.push(centers[i] - widths[i] / 2, centers[i] + widths[i] / 2);
  cuts.push(len);
  for (let i = 1; i < cuts.length; i += 2) raised(out, at, cuts[i - 1], cuts[i], 0, 15, 0.18);
  for (let j = 0; j < 3; j++) {
    const c = centers[j],
      w = widths[j],
      h = heights[j],
      x0 = c - w / 2,
      x1 = c + w / 2,
      inner = -0.7;
    panel(out, at, x0, x1, h, 15, 'limestone', stone, 0.18);
    face(
      out,
      'limestone',
      [at(x0, 0, 0.18), at(x0, 0, inner), at(x0, h, inner), at(x0, h, 0.18)],
      stone,
    );
    face(
      out,
      'limestone',
      [at(x1, 0, inner), at(x1, 0, 0.18), at(x1, h, 0.18), at(x1, h, inner)],
      stone,
    );
    face(
      out,
      'limestone',
      [at(x0, h, 0.18), at(x0, h, inner), at(x1, h, inner), at(x1, h, 0.18)],
      stone,
    );
    const artHeight = j === 1 ? 3.6 : 2.25,
      artY = h - artHeight;
    const back = (x, y, d = 0) => at(x, y, inner + d);
    relief(out, back, c, artY, w, artHeight, j === 1 ? 0 : j === 0 ? 1 : 2);
    grid(
      out,
      [at(x0, 2.65, inner), at(x1, 2.65, inner), at(x1, artY, inner), at(x0, artY, inner)],
      glass,
      0.7112,
      0.4572,
      0.018,
      silver,
      'stainless',
    );
    if (j === 1) {
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI * 0.7 + (i * Math.PI * 1.4) / 18,
          b = a + (Math.PI * 1.4) / 18;
        tube(
          out,
          'metal',
          at(c + 1.85 * Math.cos(a), 4.6 + 2.25 * Math.sin(a), inner + 0.06),
          at(c + 1.85 * Math.cos(b), 4.6 + 2.25 * Math.sin(b), inner + 0.06),
          0.045,
          bronze,
          6,
        );
      }
    }
    // Closed cylindrical revolving-door casing, sill and four static radial leaves.
    const center = at(c, 0, inner + 0.35),
      r = Math.min(0.95, w * 0.23);
    for (const yy of [0.06, 2.6])
      loft(
        out,
        'metal',
        [
          radialRing(yy, r, r, 24, [center[0], center[2]]),
          radialRing(yy + 0.1, r, r, 24, [center[0], center[2]]),
        ],
        bronze,
      );
    for (let k = 0; k < 16; k++) {
      const u = (k * Math.PI) / 8,
        v = ((k + 1) * Math.PI) / 8;
      if (Math.cos((u + v) / 2) < -0.1) continue;
      const pp = [
        at(c + r * Math.sin(u), 0.16, inner + 0.35 + r * Math.cos(u)),
        at(c + r * Math.sin(v), 0.16, inner + 0.35 + r * Math.cos(v)),
        at(c + r * Math.sin(v), 2.6, inner + 0.35 + r * Math.cos(v)),
        at(c + r * Math.sin(u), 2.6, inner + 0.35 + r * Math.cos(u)),
      ];
      face(out, 'clear_glass', pp, [0.62, 0.74, 0.77]);
    }
    tube(out, 'metal', at(c, 0.16, inner + 0.35), at(c, 2.6, inner + 0.35), 0.045, bronze, 8);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.2,
        q = at(c + r * Math.sin(a), 0.16, inner + 0.35 + r * Math.cos(a)),
        p = at(c + r * Math.sin(a), 2.6, inner + 0.35 + r * Math.cos(a));
      face(
        out,
        'clear_glass',
        [at(c, 0.16, inner + 0.35), q, p, at(c, 2.6, inner + 0.35)],
        [0.67, 0.74, 0.75],
      );
      tube(out, 'metal', q, p, 0.029, bronze, 6);
    }
    for (const [l, r] of [
      [x0, c - 1.05],
      [c + 1.05, x1],
    ])
      if (r - l > 0.08)
        grid(
          out,
          [at(l, 0.05, inner), at(r, 0.05, inner), at(r, 2.65, inner), at(l, 2.65, inner)],
          glass,
          1.1,
          3,
          0.055,
          bronze,
        );
  }
}
function deckGlass(out, plan, y) {
  for (const { a, b, n, len } of edges(plan)) {
    const at = frame(a, b, n),
      count = Math.ceil(len / 1.524);
    for (let i = 0; i < count; i++) {
      const x0 = (i * len) / count + 0.015,
        x1 = ((i + 1) * len) / count - 0.015;
      panel(out, at, x0, x1, y + 0.05, y + 2.5908, 'clear_glass', [0.62, 0.76, 0.79], -0.06);
      for (const x of [x0, x1])
        tube(
          out,
          'stainless',
          at(x, y + 0.05, -0.06),
          at(x, y + 2.5908, -0.06),
          0.008,
          [0.78, 0.84, 0.83],
          4,
        );
    }
  }
}
const rectangle = (x0, x1, z0, z1) =>
  clockwise([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
function roof(out, highest) {
  const plan = highest.plan,
    lower = 248.1,
    mid = 254.4,
    upper = 257.55;
  mappedCap(out, 'concrete', plan, lower, [0.56, 0.52, 0.46]);
  deckGlass(out, plan, lower);
  const core = rectangle(6, 65, -6.4, 7.1),
    top = rectangle(11, 60, -4.4, 5.1);
  for (const { a, b, n, len } of edges(core)) {
    const at = frame(a, b, n);
    windows(out, a, b, n, lower, mid, true);
    parapet(out, a, b, n, mid, 4);
    for (let x = 0.35; x < len; x += 2.42) raised(out, at, x - 0.14, x + 0.14, lower, mid, 0.16);
  }
  mappedCap(out, 'concrete', core, mid, [0.54, 0.49, 0.43]);
  deckGlass(out, core, mid);
  mappedSolid(out, 'limestone', top, mid, upper, stone);
  mappedCap(out, 'concrete', top, upper, [0.59, 0.54, 0.48]);
  for (const { a, b, n } of edges(top)) parapet(out, a, b, n, upper - 0.57, 4);
  // Upper deck historic parapet stays below the architectural850ft tip.
  for (const [x, z] of [
    [19, 0],
    [48, 0],
  ]) {
    loft(
      out,
      'metal',
      [
        radialRing(upper, 1.1, 0.76, 24, [x, z]),
        radialRing(upper + 0.48, 1.3, 0.88, 24, [x, z]),
        radialRing(upper + 0.8, 1.3, 0.88, 24, [x, z]),
      ],
      [0.5, 0.53, 0.51],
    );
    mappedCap(
      out,
      'recess',
      radialRing(upper + 0.82, 1.17, 0.75, 24, [x, z]).map((p) => [p[0], p[2]]),
      upper + 0.82,
      [0.1, 0.12, 0.12],
    );
  }
  //2024 west Skylift in its lowered static pose. Three nested drums keep the
  // machinery readable without presenting a moving attraction as a building spire.
  const x = 15,
    z = 0.3;
  for (let k = 0; k < 3; k++) {
    const r = 2.05 - k * 0.29,
      y = upper + 0.08 + k * 0.13;
    loft(
      out,
      'metal',
      [radialRing(y, r, r, 64, [x, z]), radialRing(y + 0.2, r, r, 64, [x, z])],
      bronze,
    );
    for (let j = 0; j < 32; j++) {
      const a = (j * Math.PI) / 16;
      tube(
        out,
        'metal',
        [x + r * Math.cos(a), y, z + r * Math.sin(a)],
        [x + r * Math.cos(a), y + 0.2, z + r * Math.sin(a)],
        0.018,
        [0.69, 0.5, 0.21],
        5,
      );
    }
  }
  const deck = radialRing(upper + 0.53, 2.26, 2.26, 64, [x, z]);
  loft(out, 'metal', [deck, radialRing(upper + 0.64, 2.26, 2.26, 64, [x, z])], bronze);
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 24,
      b = ((i + 1) * Math.PI) / 24;
    face(
      out,
      'clear_glass',
      [
        [x + 2.2 * Math.cos(a), upper + 0.64, z + 2.2 * Math.sin(a)],
        [x + 2.2 * Math.cos(b), upper + 0.64, z + 2.2 * Math.sin(b)],
        [x + 2.2 * Math.cos(b), upper + 1.5, z + 2.2 * Math.sin(b)],
        [x + 2.2 * Math.cos(a), upper + 1.5, z + 2.2 * Math.sin(a)],
      ],
      [0.67, 0.8, 0.81],
    );
    tube(
      out,
      'metal',
      [x + 2.2 * Math.cos(a), upper + 1.5, z + 2.2 * Math.sin(a)],
      [x + 2.2 * Math.cos(b), upper + 1.5, z + 2.2 * Math.sin(b)],
      0.025,
      bronze,
      5,
    );
  }
  // North69F Beam: fixed lowered seven-place I-girder, central lifting support.
  box(out, 'metal', [25, mid + 0.1, -6.3], [30.2, mid + 0.25, -5.75], silver);
  box(out, 'metal', [25, mid + 0.25, -6.065], [30.2, mid + 0.64, -5.985], silver);
  box(out, 'metal', [25, mid + 0.64, -6.3], [30.2, mid + 0.76, -5.75], silver);
  for (let k = 0; k < 7; k++) {
    const xx = 25.35 + k * 0.75;
    box(
      out,
      'recess',
      [xx - 0.24, mid + 0.76, -6.27],
      [xx + 0.24, mid + 0.88, -5.83],
      [0.09, 0.1, 0.1],
    );
    tube(
      out,
      'metal',
      [xx - 0.21, mid + 0.89, -6.25],
      [xx - 0.21, mid + 1.28, -6.25],
      0.023,
      bronze,
      5,
    );
    tube(
      out,
      'metal',
      [xx + 0.21, mid + 0.89, -6.25],
      [xx + 0.21, mid + 1.28, -6.25],
      0.023,
      bronze,
      5,
    );
  }
  // Exterior east-end stairs connect the successive exposed roofs.
  for (const [lo, hi, topX, bottomX] of [
    [lower, mid, 65, 71.5],
    [mid, upper, 60, 64.5],
  ]) {
    const count = Math.ceil((hi - lo) / 0.18),
      run = bottomX - topX;
    for (let i = 0; i < count; i++)
      box(
        out,
        'concrete',
        [bottomX - ((i + 1) * run) / count, lo, -0.9],
        [bottomX - (i * run) / count, lo + ((i + 1) * (hi - lo)) / count, 1.5],
        [0.61, 0.59, 0.53],
      );
    for (const z of [-1, 1.6]) {
      tube(out, 'stainless', [bottomX, lo + 1, z], [topX, hi + 1, z], 0.034, [0.6, 0.64, 0.64], 6);
      for (let i = 0; i <= 4; i++)
        tube(
          out,
          'stainless',
          [bottomX - (i * run) / 4, lo + (i * (hi - lo)) / 4, z],
          [bottomX - (i * run) / 4, lo + (i * (hi - lo)) / 4 + 1, z],
          0.026,
          [0.6, 0.64, 0.64],
          6,
        );
    }
  }
}
export function buildRockefeller(out, m) {
  const base = clean(localOutline(m)),
    parts = partsEvidence('n0190_30_rockefeller_plaza')
      .filter((p) => p.type === 'way' && p.tags?.['building:part'])
      .map((p) => ({
        id: p.id,
        plan: clean(partPlan(m, p)),
        bottom: Number(p.tags.min_height || 0),
        top: Number(p.tags.height),
      }));
  const highest = parts.find((p) => p.id === 145341259);
  highest.top = 248.1;
  mappedSolid(out, 'foundation', base, 0, 0.1, [0.35, 0.34, 0.3]);
  for (const { a, b, n, len } of edges(base)) {
    if (n[0] > 0.98 && len > 18 && len < 22) {
      mainEntrance(out, a, b, n);
      continue;
    }
    windows(out, a, b, n, 0.1, 5, true);
    windows(out, a, b, n, 5, 10, true);
    const at = frame(a, b, n);
    raised(out, at, 0, len, 0.1, 1.05, 0.025, [0.26, 0.27, 0.26], 'stone');
  }
  mappedCap(out, 'concrete', base, 10, [0.47, 0.44, 0.38]);
  for (const p of parts) {
    if (p.top <= 10) continue;
    const visible = exposed(p, parts, Math.max(10, p.bottom));
    for (const { a, b, n, bottom, top } of visible) {
      const low = n[0] > 0.97 && (a[0] + b[0]) / 2 > 80 ? Math.max(15, bottom) : bottom;
      const levels = [
        low,
        ...Array.from({ length: 72 }, (_, i) => 10 + i * 3.5052).filter(
          (y) => y > low + 0.08 && y < top - 0.08,
        ),
        top,
      ];
      for (let j = 1; j < levels.length; j++) windows(out, a, b, n, levels[j - 1], levels[j]);
      if (p !== highest)
        parapet(out, a, b, n, top, top > 230 ? 4 : n[0] > 0.9 && top > 100 ? 2 : 0);
    }
    if (p !== highest) mappedCap(out, 'concrete', p.plan, p.top, [0.49, 0.47, 0.42]);
  }
  // Low NBC studio and west block roofs retain restrained service screens and
  // planted terrace beds; equipment sits on the actual exposed horizontal roofs.
  for (const [x, z, w, d, y] of [
    [-39, -18, 14, 7, 43],
    [-39, 18, 14, 7, 43],
    [-69, 0, 12, 13, 70],
  ]) {
    box(out, 'metal', [x - w / 2, y + 0.12, z - d / 2], [x + w / 2, y + 1.8, z + d / 2], silver);
    for (let i = 0; i < Math.ceil(w / 0.55); i++)
      box(
        out,
        'metal',
        [x - w / 2 + i * 0.55, y + 0.3, z - d / 2 - 0.07],
        [x - w / 2 + i * 0.55 + 0.08, y + 1.65, z - d / 2 - 0.025],
        [0.59, 0.6, 0.57],
      );
  }
  roof(out, highest);
}
