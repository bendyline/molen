/** Exterior fabric of the open Baths of Caracalla. Geometry stays in the mapped bath frame. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sr/sr2/baths_of_caracalla/layout.json',
      import.meta.url,
    ),
  ),
);
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.95 },
  core: { slot: 'foundation', graph: 'stone_drywall', roughness: 1 },
  stone: { slot: 'trim', graph: 'stone_travertine', roughness: 0.96 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 1 },
};
const colors = {
  brick: [0.631, 0.365, 0.241],
  core: [0.48, 0.374, 0.276],
  stone: [0.62, 0.556, 0.43],
  earth: [0.445, 0.357, 0.271],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const hash = (a, b, c = 0) =>
  (((Math.imul(a + 173, 1296607) ^ Math.imul(b + 11, 13163011) ^ Math.imul(c + 47, 692177)) >>> 3) %
    8191) /
  8191;
const tint = (slot, tone) => colors[slot].map((v) => Math.min(1, v * tone));
function face(out, slot, tone, points, dir) {
  const p = points.map((v) => v.map(Math.fround));
  let n = normalFor(...p);
  if (Math.hypot(...n) < 0.5) return;
  if (n.reduce((sum, v, i) => sum + dir[i] * v, 0) < 0) {
    p.reverse();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, ref, p, n, undefined, tint(slot, tone));
}
function quad(out, slot, tone, a, b, c, d, dir) {
  face(out, slot, tone, [a, b, c], dir);
  face(out, slot, tone, [a, c, d], dir);
}
const area = (r) =>
  r.reduce((sum, p, i) => {
    const v = r[(i + 1) % r.length];
    return sum + p[0] * v[1] - p[1] * v[0];
  }, 0) / 2;
function triangulate(rings, render) {
  const starts = [],
    points = rings.flatMap((r, i) => {
      if (i) starts.push(rings.slice(0, i).reduce((n, p) => n + p.length, 0));
      return r;
    });
  const xy = points.flatMap(([x, y]) => [x, y]),
    ix = earcut(xy, starts, 2);
  for (let i = 0; i < ix.length; i += 3) render(ix.slice(i, i + 3).map((k) => points[k]));
}
function simplify(r, limit) {
  const clean = r.filter(
    (p, i) => !i || Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) > 0.005,
  );
  if (limit <= 0) return clean;
  const reduced = [...clean];
  while (reduced.length > 4) {
    let min = Infinity,
      index = -1;
    for (let i = 0; i < reduced.length; i++) {
      const a = reduced.at(i - 1),
        b = reduced[i],
        c = reduced[(i + 1) % reduced.length],
        dx = c[0] - a[0],
        dy = c[1] - a[1];
      const distance =
        Math.abs(dx * (a[1] - b[1]) - dy * (a[0] - b[0])) / (Math.hypot(dx, dy) || 1);
      if (distance < min && Math.hypot(dx, dy) < 36) {
        min = distance;
        index = i;
      }
    }
    if (min >= limit) break;
    reduced.splice(index, 1);
  }
  return reduced;
}
function mappedMass(out, row, tier, index) {
  if (tier === 0 && row.role === 'main baths') return;
  if (tier === 0 && row.role === 'enclosure ruins' && index % 3 !== 0) return;
  const rings = row.rings.map((r) => simplify(r, [1.48, 0.65, 0.2, 0.055, 0][tier]));
  const height = (p, i) =>
    p[2] + row.height + (hash(index, i) - 0.47) * Math.min(row.height * 0.57, 2.4);
  const crown = rings.map((r) => r.map((p, i) => [p[0], p[1], height(p, i)]));
  for (const [k, r] of rings.entries()) {
    const sign = Math.sign(area(r)) * (k === 0 ? 1 : -1);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length,
        [a, b] = [r[i], r[j]],
        dir = [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])];
      const c = crown[k][i],
        d = crown[k][j],
        base = [a[0], a[2] - 1.85, a[1]],
        end = [b[0], b[2] - 1.85, b[1]];
      const tone = 0.83 + hash(index, i, k) * 0.27;
      quad(
        out,
        row.height < 1 ? 'core' : 'brick',
        tone,
        base,
        end,
        [d[0], d[2], d[1]],
        [c[0], c[2], c[1]],
        dir,
      );
    }
  }
  triangulate(crown, (p) =>
    face(
      out,
      'core',
      0.94 + hash(index, 7) * 0.12,
      p.map(([x, z, y]) => [x, y, z]),
      up,
    ),
  );
}
function wallFrame(w) {
  const [x, z, g] = w.a,
    [bx, bz, bg] = w.b,
    L = Math.hypot(bx - x, bz - z),
    ux = (bx - x) / L,
    uz = (bz - z) / L;
  const n = [-uz, 0, ux],
    p = ([u, y], d = 0) => [x + ux * u + n[0] * d, mix(g, bg, u / L) + y, z + uz * u + n[2] * d];
  return { L, n, p };
}
function archRing(a, L, segments, outer = 0) {
  const c = a.u * L,
    r = a.w / 2 + outer;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (Math.PI * i) / segments;
    return [c - r * Math.cos(angle), a.spring + (a.rise + outer) * Math.sin(angle)];
  });
}
function ruinedProfile(w, L, k, tier) {
  const h = w.top,
    m = [3, 4, h.length, 12, 20][tier];
  return Array.from({ length: m }, (_, i) => {
    const t = i / (m - 1),
      v = t * (h.length - 1),
      a = Math.min(h.length - 2, Math.floor(v));
    return [
      L * t,
      mix(h[a], h[a + 1], v - a) +
        (i === 0 || i === m - 1 ? 0 : (hash(k, i, 3) - 0.5) * (tier >= 3 ? 1.7 : 0.8)),
    ];
  });
}
function archWall(out, w, index, tier) {
  const { L, n, p } = wallFrame(w),
    depth = w.width / 2,
    base = -1.8,
    tone = w.tone ?? 1,
    cap = ruinedProfile(w, L, index, tier);
  const principal = w.name.includes('frigidarium') || w.name.includes('Natatio monumental');
  const openings = tier === 0 ? (principal ? w.open.slice(0, 1) : []) : w.open;
  const segments = [4, 4, 11, 15, 20][tier];
  const cavities = openings.map((a) => {
    const arc = archRing(a, L, segments);
    return {
      a,
      arc,
      ring: [
        [arc[0][0], Math.max(a.sill, base)],
        [arc.at(-1)[0], Math.max(a.sill, base)],
        ...arc.toReversed(),
      ],
    };
  });
  const baseProfile = [[0, base]],
    holes = [];
  for (const c of cavities) {
    if (c.a.sill > -1) holes.push(c.ring);
    else baseProfile.push([c.arc[0][0], base], ...c.arc, [c.arc.at(-1)[0], base]);
  }
  const outline = [...baseProfile, [L, base], ...cap.toReversed()];
  for (const sign of [-1, 1]) {
    const dir = n.map((v) => v * sign),
      d = depth * sign;
    triangulate([outline, ...holes], (triangle) =>
      face(
        out,
        'brick',
        tone,
        triangle.map((x) => p(x, d)),
        dir,
      ),
    );
  }
  // The cliffed top and each opening return have real depth.
  for (const [k, ring] of [outline, ...holes].entries()) {
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length],
        du = b[0] - a[0],
        dy = b[1] - a[1];
      if (a[1] === base && b[1] === base) continue;
      const sign = k === 0 ? Math.sign(area(ring)) : -Math.sign(area(ring));
      const along = [-n[2], 0, n[0]];
      const dir = [-sign * along[0] * dy, -sign * du, -sign * along[2] * dy];
      const top = cap.includes(a) && cap.includes(b);
      quad(
        out,
        top ? 'core' : 'brick',
        tone * (top ? 0.82 + hash(index, j) * 0.2 : 0.88),
        p(a, -depth),
        p(b, -depth),
        p(b, depth),
        p(a, depth),
        dir,
      );
    }
  }
  if (tier === 0) return;
  for (const [i, c] of cavities.entries()) {
    const { arc, a } = c;
    if (a.blind) {
      triangulate([c.ring], (triangle) => {
        for (const dir of [n, n.map((v) => -v)])
          face(
            out,
            'core',
            0.75,
            triangle.map((v) => p(v, 0)),
            dir,
          );
      });
    }
    if (tier === 1) continue;
    const outer = archRing(a, L, segments, 0.59);
    for (let j = 0; j < segments; j++) {
      for (const side of [-1, 1]) {
        const dz = side * (depth + 0.034 + (tier > 2 ? 0.026 * hash(index, j, i) : 0)),
          dir = n.map((v) => v * side);
        const toneArch = 0.99 + hash(i, j, index) * 0.17;
        quad(
          out,
          'brick',
          toneArch,
          p(arc[j], dz),
          p(arc[j + 1], dz),
          p(outer[j + 1], dz),
          p(outer[j], dz),
          dir,
        );
      }
    }
  }
  if (tier < 2) return;
  // Lost brick facing exposes coarse core in irregular patches above and between the apertures.
  const capAt = (u) => {
    const j = Math.min(cap.length - 2, Math.floor((u / L) * (cap.length - 1)));
    return mix(cap[j][1], cap[j + 1][1], (u - cap[j][0]) / (cap[j + 1][0] - cap[j][0]));
  };
  const count = Math.max(2, Math.floor(L / (tier === 2 ? 12 : 6.5)));
  for (const side of [-1, 1]) {
    const dir = n.map((v) => v * side);
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.4 + hash(index, j, side) * 0.2) * L) / count;
      const w0 = (L / count) * (0.15 + hash(index, j, 5) * 0.27);
      const roof = Math.min(capAt(x - w0), capAt(x), capAt(x + w0));
      const over = cavities.filter((c) => x + w0 >= c.arc[0][0] && x - w0 <= c.arc.at(-1)[0]);
      const openingHeight = Math.max(1.8, ...over.map(({ a }) => a.spring + a.rise + 1));
      const y = openingHeight + (roof - openingHeight) * (0.48 + hash(index, j, side + 8) * 0.22);
      const h = Math.min(roof - y - 0.25, y - openingHeight, 0.7 + hash(index, j, 13) * 2.8);
      if (h < 0.39) continue;
      const sides = tier === 2 ? 7 : 12;
      const ring = Array.from({ length: sides }, (_, k) => {
        const angle = (2 * Math.PI * k) / sides,
          r = 0.69 + 0.34 * hash(index + j, k, side + 11);
        return [x + w0 * r * Math.cos(angle), y + h * r * Math.sin(angle)];
      });
      triangulate([ring], (tri) =>
        face(
          out,
          'core',
          tone * (0.89 + hash(index, j, side) * 0.21),
          tri.map((q) => p(q, side * (depth + 0.017))),
          dir,
        ),
      );
    }
  }
  for (let j = 0; j < cap.length - 1; j++) {
    const [a, b] = cap.slice(j, j + 2),
      u = (a[0] + b[0]) * 0.5;
    const h = (a[1] + b[1]) * 0.5;
    if (hash(index, j, 5) < 0.38) continue;
    const w = (b[0] - a[0]) * (0.22 + 0.2 * hash(index, j, 8)),
      depthScale = 0.28 + hash(index, j) * 0.4;
    const pos = p([u, h - 0.12]),
      height = 0.24 + hash(index, j, 7) * (tier === 4 ? 1.35 : 0.9);
    block(out, pos, w, depth * depthScale, height, index + j, 'core', tier);
  }
}
function block(out, pos, w, d, h, seed, slot, tier) {
  const [x, y, z] = pos,
    steps = tier >= 3 ? 3 : tier < 2 ? 1 : 2;
  const widths = [1, 0.91, 0.8, 0.7],
    depths = [1, 0.92, 0.85, 0.74];
  const ring = (j) => {
    const a = w * 0.5 * widths[j],
      b = d * 0.5 * depths[j],
      t = j / steps;
    return [
      [-a, -b],
      [a, -b],
      [a, b],
      [-a, b],
    ].map(([u, v], i) => [
      x + u + (hash(seed, i, j) - 0.5) * Math.min(w * 0.14, 0.42) * t,
      y + h * t + (hash(seed, i, 5) - 0.5) * h * 0.085 * t,
      z + v + (hash(seed, i, j + 1) - 0.5) * Math.min(d * 0.14, 0.45) * t,
    ]);
  };
  let last = ring(0);
  for (let j = 1; j <= steps; j++) {
    const next = ring(j);
    for (const [i, dir] of [
      [0, [0, 0, -1]],
      [1, [1, 0, 0]],
      [2, [0, 0, 1]],
      [3, [-1, 0, 0]],
    ]) {
      const k = (i + 1) % 4;
      quad(out, slot, 0.87 + hash(seed, i, j) * 0.25, last[i], last[k], next[k], next[i], dir);
    }
    last = next;
  }
  quad(out, 'core', 0.92, ...last, up);
}
function pier(out, p, index, tier) {
  const base = p.grade - 1.75;
  block(out, [p.x, base, p.z], p.w, p.d, p.height + 1.75, index, 'brick', tier);
  if (tier < 2) return;
  block(out, [p.x, base + 0.22, p.z], p.w * 1.12, p.d * 1.09, 2.7, index + 191, 'stone', tier);
  for (const [i, y] of [p.height * 0.29, p.height * 0.68].entries()) {
    const l = p.w * (1 - i * 0.105),
      d = p.d * (0.99 - i * 0.083);
    block(
      out,
      [p.x, base + y, p.z],
      l,
      d,
      0.52 + hash(index, i) * 0.36,
      index + i * 37,
      'brick',
      tier,
    );
  }
}
function apse(out, a, index, tier) {
  const segments = [5, 10, 17, 27, 38][tier],
    h = a.height;
  const make = (i, r, y) => {
    const ang = mix(a.a, a.b, i / segments);
    return [a.x + Math.cos(ang) * r, a.grade + y, a.z + Math.sin(ang) * r];
  };
  for (let i = 0; i < segments; i++) {
    const j = i + 1,
      ang = mix(a.a, a.b, (i + 0.5) / segments),
      dir = [Math.cos(ang), 0, Math.sin(ang)],
      ri = a.r - a.width / 2,
      ro = a.r + a.width / 2;
    const top = (k) =>
      h * (0.81 + 0.14 * Math.sin((Math.PI * k) / segments)) + (hash(index, k) - 0.5) * 1.8;
    const a0 = make(i, ri, -2),
      b0 = make(j, ri, -2),
      c0 = make(j, ro, -2),
      d0 = make(i, ro, -2);
    const a1 = make(i, ri, top(i)),
      b1 = make(j, ri, top(j)),
      c1 = make(j, ro, top(j)),
      d1 = make(i, ro, top(i));
    const tone = 0.88 + 0.19 * hash(index, i);
    quad(
      out,
      'brick',
      tone,
      a0,
      b0,
      b1,
      a1,
      dir.map((v) => -v),
    );
    quad(out, 'brick', tone * 0.96, d0, c0, c1, d1, dir);
    quad(out, 'core', tone, a1, b1, c1, d1, up);
    if (i === 0) quad(out, 'core', tone, a0, d0, d1, a1, [Math.sin(ang), 0, -Math.cos(ang)]);
    if (j === segments) quad(out, 'core', tone, b0, c0, c1, b1, [-Math.sin(ang), 0, Math.cos(ang)]);
  }
}
function paving(out, row, index, tier) {
  const [a, b, c, d] = row.corners;
  const u = (t) => a.map((v, i) => mix(v, b[i], t)),
    v = (t) => d.map((v, i) => mix(v, c[i], t));
  const m = (t, s, y) => {
    const p = u(t).map((v0, i) => mix(v0, v(t)[i], s));
    return [p[0], p[2] + y, p[1]];
  };
  const [bed, rim] = row.profile,
    spanX = b[0] - a[0],
    spanZ = d[1] - a[1];
  const count = tier === 1 ? 1 : tier === 2 ? 6 : Math.ceil(spanX / 2.8);
  for (let i = 0; i < count; i++) {
    const t = i / count,
      s = (i + 1) / count,
      tone = 0.84 + hash(index, i) * 0.17;
    quad(out, 'earth', tone, m(t, 0, bed), m(s, 0, bed), m(s, 1, bed), m(t, 1, bed), up);
    const dz = Math.min(0.13, 0.48 / spanZ);
    for (const edge of [0, 1 - dz])
      quad(
        out,
        'stone',
        tone * 1.07,
        m(t, edge, rim),
        m(s, edge, rim),
        m(s, edge + dz, rim),
        m(t, edge + dz, rim),
        up,
      );
  }
  for (const edge of [0, 1 - 0.48 / spanX])
    quad(
      out,
      'stone',
      1,
      m(edge, 0, rim + 0.01),
      m(edge + 0.48 / spanX, 0, rim + 0.01),
      m(edge + 0.48 / spanX, 1, rim + 0.01),
      m(edge, 1, rim + 0.01),
      up,
    );
}
export function buildCaracallaLevel(out, level) {
  const tier = levels[level];
  for (const [i, row] of layout.mapped.entries()) mappedMass(out, row, tier, i);
  for (const [i, w] of layout.walls.entries()) archWall(out, w, i, tier);
  for (const [i, p] of layout.piers.entries()) if (tier > 0 || i % 2 === 0) pier(out, p, i, tier);
  for (const [i, a] of layout.curves.entries()) apse(out, a, i, tier);
  if (tier > 0) for (const [i, p] of layout.interiors.entries()) paving(out, p, i, tier);
}
export const buildCaracallaSkyline = (out) => buildCaracallaLevel(out, 'skyline');
export const buildCaracallaDistrict = (out) => buildCaracallaLevel(out, 'district');
export const buildCaracallaStreet = (out) => buildCaracallaLevel(out, 'street');
export const buildCaracallaCloseup = (out) => buildCaracallaLevel(out, 'closeup');
