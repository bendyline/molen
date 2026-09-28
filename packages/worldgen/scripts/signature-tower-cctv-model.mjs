/** CCTV's continuous leaning loop. Meter units; +X north and +Z east. */
import { beam, cross, loft, normalFor, normalize, torus } from './authored-structure-mesh.mjs';
import { face, mappedCap, mappedSolid } from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const k = Math.tan(Math.PI / 30);
const roof = [233 * (1 + 0.34 * k) - 0.17 * 163, 0.17, -0.17];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const add = (a, b, s = 1) => a.map((v, i) => v + s * b[i]);
function clean(p) {
  return p.filter(
    (a, i) => Math.hypot(...a.map((v, j) => v - p[(i + p.length - 1) % p.length][j])) > 1e-6,
  );
}
function clip(p, n, d, inside = true) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    const da = dot(n, a) - d,
      db = dot(n, b) - d;
    const aa = inside ? da <= 1e-7 : da >= -1e-7;
    const bb = inside ? db <= 1e-7 : db >= -1e-7;
    if (aa) out.push(a);
    if (aa !== bb) out.push(mix(a, b, da / (da - db)));
  }
  return clean(out);
}
function area(p) {
  if (p.length < 3) return 0;
  let total = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const a = add(p[i], p[0], -1),
      b = add(p[i + 1], p[0], -1);
    total +=
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) /
      2;
  }
  return total;
}
// Four side bounds are x/z = intercept + slope*y; intersect them with the
// common sloped roof. This retains six-degree tilt without disconnected roofs.
function solid(id, x0, x1, z0, z1, low, cap) {
  const corners = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const at = ([x, z], y) => [x[0] + x[1] * y, y, z[0] + z[1] * y];
  const lower = corners.map((c) => at(c, low));
  const upper = corners.map(([x, z]) =>
    at([x, z], (cap[0] + cap[1] * x[0] + cap[2] * z[0]) / (1 - cap[1] * x[1] - cap[2] * z[1])),
  );
  const center = lower.concat(upper).reduce((a, p) => add(a, p, 1 / 8), [0, 0, 0]);
  const faces = [
    lower.toReversed(),
    upper,
    ...lower.map((p, i) => [p, lower[(i + 1) % 4], upper[(i + 1) % 4], upper[i]]),
  ].map((poly, index) => {
    let n = normalFor(poly[0], poly[1], poly[2]);
    if (dot(n, add(poly[0], center, -1)) < 0) {
      poly = poly.toReversed();
      n = n.map((v) => -v);
    }
    return { poly, n, d: dot(n, poly[0]), index };
  });
  return { id, faces };
}
function subtract(poly, volume) {
  let inside = poly;
  const outside = [];
  for (const f of volume.faces) {
    const part = clip(inside, f.n, f.d, false);
    if (area(part) > 0.0001) outside.push(part);
    inside = clip(inside, f.n, f.d);
    if (area(inside) < 0.0001) break;
  }
  return outside;
}
function exterior(volumes) {
  const result = [];
  for (let i = 0; i < volumes.length; i++)
    for (const f of volumes[i].faces) {
      let pieces = [f.poly];
      for (let j = 0; j < volumes.length; j++) {
        if (i === j) continue;
        if (
          i < j &&
          volumes[j].faces.some((g) => dot(f.n, g.n) > 0.999999 && Math.abs(f.d - g.d) < 1e-5)
        )
          continue;
        pieces = pieces.flatMap((p) => subtract(p, volumes[j]));
      }
      for (const poly of pieces)
        if (area(poly) > 0.005) result.push({ ...f, poly, owner: volumes[i].id });
    }
  return result;
}
function polygon(out, slot, poly, color, n) {
  for (let i = 1; i < poly.length - 1; i++) {
    if (area([poly[0], poly[i], poly[i + 1]]) < 1e-6) continue;
    out.addTriangle(
      slot,
      'palette:#ffffff',
      [poly[0], poly[i], poly[i + 1]],
      n,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      color,
    );
  }
}
// Convex piece coordinates use a level horizontal U axis and actual elevation V.
function panelFrame(f) {
  const u = [f.n[2], 0, -f.n[0]],
    len = Math.hypot(...u);
  for (let i = 0; i < 3; i++) u[i] /= len;
  const h = [f.n[0], 0, f.n[2]],
    h2 = dot(h, h);
  const base = h.map((v) => (v * f.d) / h2);
  const vertical = [(-f.n[0] * f.n[1]) / h2, 1, (-f.n[2] * f.n[1]) / h2];
  const point = (x, y, offset = 0) => add(add(add(base, u, x), vertical, y), f.n, offset);
  const uv = f.poly.map((p) => [dot(p, u), p[1], 0]);
  const min = [Math.min(...uv.map((p) => p[0])), Math.min(...uv.map((p) => p[1]))];
  const max = [Math.max(...uv.map((p) => p[0])), Math.max(...uv.map((p) => p[1]))];
  return { point, uv, min, max };
}
function clip2(poly, shape) {
  const signed = shape.reduce(
    (sum, p, i) =>
      sum + p[0] * shape[(i + 1) % shape.length][1] - shape[(i + 1) % shape.length][0] * p[1],
    0,
  );
  let result = poly;
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i],
      b = shape[(i + 1) % shape.length];
    const n = signed > 0 ? [b[1] - a[1], a[0] - b[0], 0] : [a[1] - b[1], b[0] - a[0], 0];
    result = clip(result, n, dot(n, a));
    if (result.length < 3) return [];
  }
  return result;
}
function lineClip(a, b, shape) {
  let lo = 0,
    hi = 1;
  const signed = shape.reduce(
    (sum, p, i) =>
      sum + p[0] * shape[(i + 1) % shape.length][1] - shape[(i + 1) % shape.length][0] * p[1],
    0,
  );
  for (let i = 0; i < shape.length; i++) {
    const p = shape[i],
      q = shape[(i + 1) % shape.length];
    const n = signed > 0 ? [q[1] - p[1], p[0] - q[0], 0] : [p[1] - q[1], q[0] - p[0], 0];
    const da = dot(n, a) - dot(n, p),
      db = dot(n, b) - dot(n, p);
    if (da > 1e-6 && db > 1e-6) return;
    if (da > 0) lo = Math.max(lo, da / (da - db));
    if (db > 0) hi = Math.min(hi, da / (da - db));
  }
  if (hi - lo < 1e-7) return;
  return [mix(a, b, lo), mix(a, b, hi)];
}
function facade(out, f) {
  const { point, uv, min, max } = panelFrame(f);
  const pitch = [1.42, 2.04];
  for (let x = Math.floor(min[0] / pitch[0]) * pitch[0]; x < max[0]; x += pitch[0])
    for (let y = Math.floor(min[1] / pitch[1]) * pitch[1]; y < max[1]; y += pitch[1]) {
      const pane = clip2(
        [
          [x, y, 0],
          [x + pitch[0], y, 0],
          [x + pitch[0], y + pitch[1], 0],
          [x, y + pitch[1], 0],
        ],
        uv,
      );
      if (area(pane) < 0.0001) continue;
      const tint =
        0.017 * Math.sin(Math.round(x / pitch[0]) * 1.7 + Math.round(y / pitch[1]) * 0.3);
      let color = [0.34 + tint, 0.4 + tint, 0.43 + tint];
      if ((y > 30 && y < 34) || (y > 182 && y < 186)) color = [0.29, 0.34, 0.36];
      const poly = pane.map(([u, v]) => point(u, v));
      if (dot(normalFor(poly[0], poly[1], poly[2]), f.n) < 0) poly.reverse();
      polygon(out, 'glass', poly, color, f.n);
    }
  const line = (a, b, width, color, depth = 0.035) => {
    const seg = lineClip(a, b, clip(uv, [0, -1, 0], -0.3));
    if (!seg) return;
    const [aa, bb] = seg.map(([u, y]) => point(u, y, depth / 2 + 0.018));
    if (Math.hypot(...add(bb, aa, -1)) <= 0.04) return;
    // The broad strap lies in the leaning facade. A world-up beam frame would
    // turn the 44 cm width into projection depth and expose only its thin edge.
    const axis = normalize(add(bb, aa, -1)),
      across = normalize(cross(f.n, axis));
    const ring = (center) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => add(add(center, across, (u * width) / 2), f.n, (v * depth) / 2));
    loft(out, 'metal', [ring(aa), ring(bb)], color);
  };
  const trim = [0.46, 0.5, 0.52];
  for (let x = Math.ceil(min[0] / pitch[0]) * pitch[0]; x < max[0]; x += pitch[0])
    line([x, min[1], 0], [x, max[1], 0], 0.032, trim);
  for (let y = Math.ceil(min[1] / pitch[1]) * pitch[1]; y < max[1]; y += pitch[1])
    line([min[0], y, 0], [max[0], y, 0], 0.04, trim);
  // Coarse diamonds are selectively subdivided at base and cantilever junctions.
  // Every finer member terminates on the parent diamond, not arbitrarily in glass.
  const step = 26,
    slope = 1.27,
    seen = new Set();
  const xy = (p, q) => [(p + q) / 2, ((p - q) * slope) / 2, 0];
  const ps = uv.map(([x, y]) => x + y / slope),
    qs = uv.map(([x, y]) => x - y / slope);
  const rib = (a, b, width) => {
    const key = [a, b]
      .map((p) => p.map((v) => v.toFixed(3)).join(','))
      .sort()
      .join('|');
    if (seen.has(key)) return;
    seen.add(key);
    line(a, b, width, [0.17, 0.2, 0.22], 0.12);
  };
  for (let p = Math.floor(Math.min(...ps) / step) * step; p <= Math.max(...ps); p += step)
    for (let q = Math.floor(Math.min(...qs) / step) * step; q <= Math.max(...qs); q += step) {
      const center = xy(p + step / 2, q + step / 2);
      const world = point(center[0], center[1]);
      const bend =
        center[1] > 134 &&
        center[1] < 211 &&
        (Math.abs(world[0] + 16) < 43 || Math.abs(world[2] + 20) < 43);
      const dense = center[1] < 72 || bend;
      const count = dense ? 2 : 1;
      for (let j = 0; j <= count; j++) {
        rib(
          xy(p + (j * step) / count, q),
          xy(p + (j * step) / count, q + step),
          j === 0 || j === count ? 0.44 : 0.36,
        );
        rib(
          xy(p, q + (j * step) / count),
          xy(p + step, q + (j * step) / count),
          j === 0 || j === count ? 0.44 : 0.36,
        );
      }
    }
}
function dish(out, x, z, radius) {
  const y = 46.2,
    rings = 8,
    sides = 48;
  for (let r = 0; r < rings; r++)
    for (let i = 0; i < sides; i++) {
      const p = (j, a) => {
        const rr = (radius * j) / rings;
        return [x + rr * Math.cos(a), y + 1.5 + (rr * rr) / (radius * 2.8), z + rr * Math.sin(a)];
      };
      const a = (i * 2 * Math.PI) / sides,
        b = ((i + 1) * 2 * Math.PI) / sides;
      const skin =
        r === 0 ? [p(0, a), p(1, b), p(1, a)] : [p(r, a), p(r, b), p(r + 1, b), p(r + 1, a)];
      polygon(out, 'metal', skin, [0.77, 0.78, 0.75], normalFor(...skin));
      const back = skin.map(([x, y, z]) => [x, y - 0.045, z]).toReversed();
      polygon(out, 'metal', back, [0.58, 0.61, 0.6], normalFor(...back));
      if (r === rings - 1)
        face(
          out,
          'metal',
          [
            p(rings, a),
            p(rings, b),
            add(p(rings, b), [0, -0.045, 0]),
            add(p(rings, a), [0, -0.045, 0]),
          ],
          [0.68, 0.7, 0.68],
        );
    }
  tube(out, 'metal', [x, 45.1, z], [x, y + 1.55, z], 0.25, [0.47, 0.49, 0.5], 16);
  for (const a of [0, 2.0944, 4.1888])
    beam(
      out,
      'metal',
      [x + Math.cos(a) * radius * 0.85, y + 1.8, z + Math.sin(a) * radius * 0.85],
      [x, y + 3.4, z],
      0.07,
      0.07,
      [0.44, 0.45, 0.45],
    );
}

export function buildCctv(out) {
  const bodies = [
    solid('northwest-tower', [24, -k], [84, -k], [-79, k], [-39, k], 0, roof),
    solid('southeast-tower', [-84, k], [-44, k], [27, -k], [79, -k], 0, roof),
    solid('north-podium', [24, -k], [84, -k], [-79, k], [79, -k], 0, [45, 0, 0]),
    solid('east-podium', [-84, k], [84, -k], [27, -k], [79, -k], 0, [45, 0, 0]),
    solid('west-overhang', [-84, k], [84, -k], [-79, k], [-39, k], 162, roof),
    solid('south-overhang', [-84, k], [-44, k], [-79, k], [79, -k], 162, roof),
  ];
  for (const f of exterior(bodies)) {
    if (Math.abs(f.n[1]) < 0.5) facade(out, f);
    else if (f.n[1] > 0) polygon(out, 'metal', f.poly, [0.49, 0.52, 0.53], f.n);
    else if (f.poly[0][1] > 150) {
      polygon(out, 'metal', f.poly, [0.38, 0.42, 0.44], f.n);
      // Visible cross-bracing is continued over the horizontal soffit.
      const shape = f.poly.map(([x, , z]) => [x, z, 0]);
      for (const direction of [-1, 1])
        for (let b = -170; b < 170; b += 18) {
          const s = lineClip([-130, direction * -130 + b, 0], [130, direction * 130 + b, 0], shape);
          if (s && Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > 0.05)
            beam(
              out,
              'metal',
              [s[0][0], 161.96, s[0][1]],
              [s[1][0], 161.96, s[1][1]],
              0.39,
              0.1,
              [0.17, 0.2, 0.22],
            );
        }
    }
  }
  // Circular public viewing windows on the overhang soffit, photographed by OMA.
  for (const [x, z, r] of [
    [-54, -41, 2.4],
    [-38, -42, 1.6],
    [-20, -43, 2.1],
    [1, -43, 1.45],
  ]) {
    const circle = Array.from({ length: 64 }, (_, i) => [
      x + r * Math.cos((i * Math.PI) / 32),
      z + r * Math.sin((i * Math.PI) / 32),
    ]);
    mappedCap(out, 'glass', circle, 161.87, [0.08, 0.14, 0.18], [], true);
    torus(out, 'metal', [x, 161.85, z], r + 0.04, 0.06, [0.64, 0.68, 0.68], 64);
  }
  // Rooftop broadcast dishes along the two lower connecting wings.
  for (const [x, z, r] of [
    [-18, 52, 3.2],
    [0, 52, 3.7],
    [20, 52, 4.1],
    [41, 52, 3.3],
    [53, 29, 3.8],
    [53, 9, 3],
    [53, -9, 2.7],
  ])
    dish(out, x, z, r);
  // The helipad sits level above the high northwest roof corner.
  const hx = 48,
    hz = -46,
    hy = 233.6,
    hr = 10.5;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = hx + 8.7 * Math.cos(a),
      z = hz + 8.7 * Math.sin(a);
    const base = roof[0] + roof[1] * x + roof[2] * z;
    beam(out, 'metal', [x, base, z], [x, hy - 0.2, z], 0.32, 0.32, [0.37, 0.4, 0.4]);
    beam(out, 'metal', [hx, base - 0.5, hz], [x, hy - 0.2, z], 0.19, 0.19, [0.39, 0.42, 0.42]);
  }
  const pad = Array.from({ length: 80 }, (_, i) => [
    hx + hr * Math.cos((i * Math.PI) / 40),
    hz + hr * Math.sin((i * Math.PI) / 40),
  ]);
  mappedSolid(out, 'metal', pad, hy - 0.18, hy, [0.28, 0.33, 0.32]);
  torus(out, 'metal', [hx, hy + 0.015, hz], 8.78, 0.05, [0.8, 0.8, 0.71], 80);
  for (const x of [hx - 2.2, hx + 2.2])
    box(
      out,
      'metal',
      [x - 0.2, hy + 0.015, hz - 3],
      [x + 0.2, hy + 0.03, hz + 3],
      [0.84, 0.85, 0.8],
    );
  box(
    out,
    'metal',
    [hx - 2.2, hy + 0.015, hz - 0.2],
    [hx + 2.2, hy + 0.03, hz + 0.2],
    [0.84, 0.85, 0.8],
  );
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    beam(
      out,
      'metal',
      [hx + hr * Math.cos(a), hy + 0.2, hz + hr * Math.sin(a)],
      [hx + hr * Math.cos(b), hy + 0.2, hz + hr * Math.sin(b)],
      0.04,
      0.04,
      [0.43, 0.47, 0.47],
    );
  }
  // Narrow metal/glass public entry below the northwest tower's western facade.
  const entry = [
    [38, 0, -79.2],
    [66, 0, -79.2],
    [66, 7.2, -78.45],
    [38, 7.2, -78.45],
  ];
  face(out, 'glass', entry.toReversed(), [0.19, 0.26, 0.28]);
  for (let x = 38; x <= 66; x += 2.8)
    beam(out, 'stainless', [x, 0.04, -79.27], [x, 7.2, -78.55], 0.09, 0.12, [0.76, 0.78, 0.77]);
  box(out, 'metal', [37, 7.1, -83], [67, 7.28, -78.2], [0.61, 0.65, 0.66]);
}
