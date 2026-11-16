/** The Getty hilltop, from the arrival plaza to the pavilion courts and Central Garden. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  travertine: { slot: 'wall', graph: 'stone_travertine', roughness: 0.85 },
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.91 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.08 },
  landscape: { slot: 'roof', localRef: 'palette:#eeeeef', roughness: 0.95 },
};
const hex = {
  sand: 'd1c3aa',
  pale: 'dfd7c5',
  paper: 'e3e0d5',
  roof: 'd3d4cb',
  shadow: 'aca08c',
  curb: 'b9ae98',
  warm: 'c7b89f',
  window: '66848e',
  windowDark: '527479',
  windowLight: '8da4a9',
  white: 'dedfd8',
  gray: '8c8f89',
  rail: 'a3aaa5',
  drain: '7d807a',
  water: '647e71',
  hedge: '677948',
  hedgeDark: '52673b',
  leaf: '7f8a51',
  trunk: '7b6751',
  soil: 'b4a68b',
  glassRoof: '7d979e',
  paleGlass: 'a6b6b9',
};
const tint = Object.fromEntries(
  Object.entries(hex).map(([key, h]) => [
    key,
    h.match(/../g).map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const dists = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  _down = [0, -1, 0],
  TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const p = ([x, z], y) => [x, y, z];
function tri(out, slot, key, a, want) {
  let n = normalFor(...a);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((s, v, i) => s + v * want[i], 0) < 0) {
    a = a.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', a, n, undefined, tint[key]);
}
function face(out, slot, key, [a, b, c, d], want) {
  tri(out, slot, key, [a, b, c], want);
  tri(out, slot, key, [a, c, d], want);
}
function plane(out, slot, key, polygon, h) {
  const flat = polygon.flat(),
    holes = [];
  for (let i = 0, k = 0; i < polygon.length; i++) {
    if (i) holes.push(k);
    k += polygon[i].length;
  }
  const index = earcut(flat.flat(), holes, 2);
  for (let i = 0; i < index.length; i += 3)
    tri(
      out,
      slot,
      key,
      index.slice(i, i + 3).map((j) => p(flat[j], h)),
      up,
    );
}
function ground(x, z) {
  const { origin, step, width, height, samples } = layout.siteGrid;
  const [u, v] = [x, z].map((x, i) =>
    Math.max(0, Math.min((i ? height : width) - 1.001, (x - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    k = j * width + i;
  return mix(
    mix(samples[k], samples[k + 1], u - i),
    mix(samples[k + width], samples[k + width + 1], u - i),
    v - j,
  );
}
function edge(a, b) {
  const [x, z] = a,
    L = Math.hypot(b[0] - x, b[1] - z),
    u = (b[0] - x) / L,
    v = (b[1] - z) / L;
  return { L, n: [v, 0, -u], at: (t, y, d = 0) => [x + u * t + v * d, y, z + v * t - u * d] };
}
function panel(out, e, slot, key, a, b, y, h, d = 0) {
  if (b - a < 0.025 || h - y < 0.025) return;
  face(out, slot, key, [e.at(a, y, d), e.at(b, y, d), e.at(b, h, d), e.at(a, h, d)], e.n);
}
function perimeter(out, ring, slot, tone, y, h) {
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring[i], ring[(i + 1) % ring.length]);
    panel(out, e, slot, tone, 0, e.L, y, h);
  }
}
function rect(cx, cz, w, d) {
  return [
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
  ];
}
function body(out, slot, tone, ring, y, h) {
  perimeter(out, ring, slot, tone, y, h);
  plane(out, slot, tone, [ring], h);
}
function slimRing(ring, eps) {
  const result = ring.slice();
  while (result.length > 4) {
    let smallest = eps,
      index = -1;
    for (let i = 0; i < result.length; i++) {
      const [x, z] = result[i],
        a = result[(i + result.length - 1) % result.length],
        b = result[(i + 1) % result.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        l2 = dx * dx + dz * dz;
      const t =
        l2 < 0.0001 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      const dist = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
      if (dist < smallest) {
        smallest = dist;
        index = i;
      }
    }
    if (index < 0) break;
    result.splice(index, 1);
  }
  return result;
}
function visualBand(b, i) {
  if (b.type === 'research') return i < 26 ? 'ribbon' : i >= 43 && i <= 58 ? 'ribbon' : 'stone';
  if (b.type === 'entry')
    return (i >= 20 && i < 31) || (i >= 36 && i < 50) ? 'full' : i % 8 < 3 ? 'ribbon' : 'stone';
  if (b.type === 'cafe' || b.type === 'admin' || b.type === 'auditorium')
    return i % 4 !== 2 ? 'ribbon' : 'stone';
  if (b.type === 'connector') return i % 4 !== 1 ? 'full' : 'stone';
  if (b.type === 'exhibitions') return i === 0 || i === 2 ? 'stone' : 'ribbon';
  return i % 5 <= 1 ? 'stone' : i % 5 === 2 ? 'ribbon' : 'stone';
}
function glazing(out, e, min, max, d, type) {
  const separated = type === 'full',
    rows = separated ? Math.max(1, Math.floor((max - min) / 4.2)) : Math.round((max - min) / 4.8);
  for (let j = 0; j < rows; j++) {
    const y = min + ((j + 0.35) * (max - min)) / rows,
      h = min + ((j + 0.85) * (max - min)) / rows;
    const side = Math.min(0.46, e.L * 0.09),
      A = side,
      B = e.L - side;
    panel(out, e, 'glass', j % 2 ? 'windowDark' : 'window', A, B, y, h, 0.012);
    if (d >= 2) {
      const n = Math.min(22, Math.ceil((B - A) / (d === 2 ? 2.95 : separated ? 1.18 : 1.62)));
      panel(out, e, 'frame', 'white', A - 0.035, B + 0.035, y - 0.042, y + 0.035, 0.038);
      panel(out, e, 'frame', 'white', A - 0.035, B + 0.035, h - 0.031, h + 0.047, 0.039);
      for (let i = 0; i <= n; i++) {
        const x = mix(A, B, i / n);
        panel(out, e, 'frame', i % 4 ? 'white' : 'paper', x - 0.034, x + 0.034, y, h, 0.043);
      }
      if (d >= 3)
        for (let i = 1; i < n; i += 3) {
          const x = mix(A, B, i / n),
            g = (B - A) / n;
          panel(out, e, 'glass', 'windowLight', x + 0.065, x + g * 0.34, y + 0.06, h - 0.065, 0.02);
        }
    }
  }
}
function building(out, b, d) {
  const outline = d < 3 ? slimRing(b.outline, [2.8, 0.77, 0.49][d]) : b.outline;
  for (let i = 0; i < outline.length; i++) {
    const e = edge(outline[i], outline[(i + 1) % outline.length]);
    const bottom =
      d > 0
        ? Math.min(ground(...outline[i]), ground(...outline[(i + 1) % outline.length])) - 0.62
        : b.below;
    const facadeIndex = b.outline.indexOf(outline[i]);
    panel(
      out,
      e,
      'travertine',
      i % 4 ? 'sand' : 'warm',
      0,
      e.L,
      b.type === 'connector' && b.key === '88767'
        ? b.floor - 0.48
        : Math.min(bottom, b.floor - 0.35),
      b.roof,
    );
    if (d === 0 || e.L < 1.0) continue;
    const mode = visualBand(b, facadeIndex);
    if (mode !== 'stone' && e.L > 2.3) glazing(out, e, b.floor + 0.08, b.roof - 0.6, d, mode);
    if (d >= 2 && e.L > 4) {
      panel(out, e, 'travertine', 'pale', 0, e.L, b.roof - 0.28, b.roof + 0.015, 0.065);
      panel(out, e, 'deck', 'curb', 0, e.L, b.floor - 0.6, b.floor - 0.18, 0.039);
      if (b.type === 'entry' || b.type === 'cafe')
        for (let h = b.floor + 3.2; h < b.roof - 1; h += 4.28) {
          panel(out, e, 'frame', 'white', 0, e.L, h, h + 0.44, 0.09);
        }
      if (d >= 3 && (b.type === 'research' || b.type === 'entry') && bottom < b.floor - 3.6) {
        const base = b.floor - 3.1;
        panel(out, e, 'travertine', 'warm', 0, e.L, bottom, base, 0.027);
        panel(out, e, 'travertine', 'pale', 0, e.L, base, base + 0.27, 0.069);
      }
      if (d >= 3 && mode === 'stone' && e.L > 12) {
        for (let j = 1; j < Math.floor(e.L / 3); j++) {
          const a = (e.L * j) / Math.floor(e.L / 3);
          panel(
            out,
            e,
            'travertine',
            j % 3 ? 'pale' : 'warm',
            a - 0.05,
            a + 0.05,
            b.floor + 1.2,
            b.roof - 0.31,
            0.013,
          );
        }
      }
    }
  }
  plane(out, 'deck', 'roof', [outline], b.roof);
}
function roofParts(out, b, d) {
  if (d === 0) return;
  const bounds = [0, 1].map((i) => [
    Math.min(...b.outline.map((p) => p[i])),
    Math.max(...b.outline.map((p) => p[i])),
  ]);
  const W = bounds[0][1] - bounds[0][0],
    D = bounds[1][1] - bounds[1][0],
    [x, z] = b.outline.reduce(
      ([x, z], [u, v]) => [x + u / b.outline.length, z + v / b.outline.length],
      [0, 0],
    );
  if (b.type === 'entry' || b.type === 'research' || b.type === 'cafe' || b.type === 'auditorium')
    return;
  if (b.type === 'pavilion' || b.type === 'exhibitions' || b.type === 'admin') {
    const [w, h] = [Math.min(14, W * 0.32), Math.min(16, D * 0.39)];
    const cap = rect(x, z, w, h),
      y = b.roof;
    body(out, 'frame', 'paper', cap, y - 0.025, y + 0.36);
    const n = d >= 3 ? 6 : d === 2 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const A = x - w * 0.4 + (w * 0.8 * i) / n,
        B = x - w * 0.4 + (w * 0.8 * (i + 1)) / n;
      const y0 = y + 0.4,
        y1 = y + 0.79;
      const a = z - h * 0.34,
        k = z + h * 0.34;
      face(
        out,
        'glass',
        'glassRoof',
        [
          [A, y0, a],
          [B, y0, a],
          [B, y1, k],
          [A, y1, k],
        ],
        up,
      );
      if (d >= 2) beam(out, 'frame', [A, y0 + 0.02, a], [A, y1 + 0.02, k], 0.072, 0.06, tint.white);
    }
    if (d >= 2)
      for (let j = 0; j < 3; j++) {
        const cx = x + (j - 1) * w * 0.19,
          cz = z + h * 0.39;
        box(
          out,
          'deck',
          [cx - 0.34, y + 0.38, cz - 0.36],
          [cx + 0.34, y + 0.73, cz + 0.3],
          tint.gray,
        );
      }
  }
}
function platform(out, d) {
  if (d < 2) return;
  for (const polygon of layout.baseUnion) {
    const ring = d === 2 ? slimRing(polygon[0], 0.58) : polygon[0];
    const center = ring.reduce(
      ([x, z], [u, v]) => [x + u / ring.length, z + v / ring.length],
      [0, 0],
    );
    const h = Math.min(6.32, Math.max(-8, ground(...center) + 0.17));
    plane(out, 'deck', 'pale', [ring, ...polygon.slice(1)], h);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        e = edge(a, b),
        base0 = Math.min(h - 0.12, ground(...a) - 0.42),
        base1 = Math.min(h - 0.12, ground(...b) - 0.42);
      face(
        out,
        'travertine',
        'warm',
        [e.at(0, base0), e.at(e.L, base1), e.at(e.L, h), e.at(0, h)],
        e.n,
      );
    }
  }
}
function round(out, slot, tone, x, z, w, d, y, h, n) {
  loft(out, slot, [radialRing(y, w, d, n, [x, z]), radialRing(h, w, d, n, [x, z])], tint[tone]);
}
function annulus(out, x, z, y, r0, r1, start, end, n, slot, tone) {
  const f = (a, r) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const t = mix(start, end, i / n),
      u = mix(start, end, (i + 1) / n);
    face(out, slot, tone, [f(t, r0), f(t, r1), f(u, r1), f(u, r0)], up);
  }
}
function rotunda(out, d) {
  const [x, z] = [39, 26],
    R = 9.7,
    y = 19.4,
    n = d === 0 ? 9 : d === 1 ? 16 : d === 2 ? 27 : 42;
  round(out, 'frame', 'white', x, z, R, R, y, y + 0.46, n);
  round(out, 'glass', 'glassRoof', x, z, R - 0.26, R - 0.26, y + 0.451, y + 2.72, n);
  round(out, 'frame', 'white', x, z, R + 0.11, R + 0.11, y + 2.7, y + 3.07, n);
  if (d >= 2) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU,
        X = x + (R - 0.235) * Math.cos(a),
        Z = z + (R - 0.235) * Math.sin(a);
      beam(out, 'frame', [X, y + 0.43, Z], [X, y + 2.7, Z], 0.105, 0.132, tint.white);
    }
    for (let j = -4; j <= 4; j++) {
      const q = j * 1.82,
        D = Math.sqrt((R - 0.65) * (R - 0.65) - q * q);
      beam(
        out,
        'frame',
        [x + q, y + 3.085, z - D],
        [x + q, y + 3.085, z + D],
        0.105,
        0.125,
        tint.white,
      );
    }
    for (const k of [-1, 0, 1])
      beam(
        out,
        'frame',
        [x - 8.2, y + 3.073, z + k * 2.67],
        [x + 8.2, y + 3.073, z + k * 2.67],
        0.098,
        0.11,
        tint.white,
      );
  }
}
function research(out, d) {
  const b = layout.parts.find((part) => part.type === 'research');
  const perimeter = b.outline.slice(0, 30);
  // Tie each ribbon to the as-mapped arc, leaving the east opening clear.
  for (const [y, width] of [
    [5.75, 0.93],
    [10.78, 0.76],
    [15.95, 0.59],
    [20.19, 0.48],
  ]) {
    if (d === 0 || (d === 1 && (y === 10.78 || y === 20.19))) continue;
    for (let i = 0; i < perimeter.length - 1; i++) {
      const a = perimeter[i],
        c = perimeter[i + 1];
      const rim = ([x, z]) => {
        const dx = x + 74,
          dz = z - 27,
          length = Math.hypot(dx, dz);
        return [x + (width * dx) / length, z + (width * dz) / length];
      };
      const outer = edge(rim(a), rim(c));
      face(out, 'frame', 'white', [p(a, y), outer.at(0, y), outer.at(outer.L, y), p(c, y)], up);
      panel(out, outer, 'frame', 'paper', 0, outer.L, y - 0.3, y);
      if (d >= 3 && outer.L > 1.5) {
        panel(out, outer, 'frame', 'rail', 0, outer.L, y + 0.65, y + 0.73);
        const posts = Math.ceil(outer.L / (d === 4 ? 1.3 : 2.5));
        for (let j = 0; j < posts; j++) {
          const center = (outer.L * (j + 0.5)) / posts;
          beam(
            out,
            'frame',
            outer.at(center, y),
            outer.at(center, y + 0.7),
            0.081,
            0.088,
            tint.rail,
          );
        }
      }
    }
  }
}
function pathSurface(out, points, w, tone, yAt) {
  for (let i = 1; i < points.length; i++) {
    const A = points[i - 1],
      B = points[i],
      e = edge(A, B),
      a = yAt(A, i - 1),
      b = yAt(B, i);
    face(
      out,
      'deck',
      tone,
      [e.at(0, a, w / 2), e.at(e.L, b, w / 2), e.at(e.L, b, -w / 2), e.at(0, a, -w / 2)],
      up,
    );
  }
}
function arrival(out, d) {
  const a = layout.tram;
  const canopy = rect(a[0] - 2, a[1] - 4, 8.3, 29.9),
    y = 10.1;
  body(out, 'frame', 'paper', canopy, y - 0.38, y);
  if (d >= 1) {
    for (const x of [-5.5, 1.45])
      for (let i = 0; i < 5; i++) {
        const z = a[1] - 16.6 + 6.0 * i;
        beam(
          out,
          'frame',
          [a[0] + x, ground(a[0] + x, z) - 0.14, z],
          [a[0] + x, y - 0.13, z],
          0.22,
          0.27,
          tint.white,
        );
      }
    for (let i = 1; i < layout.terracePoints.length; i++) {
      const A = layout.terracePoints[i - 1],
        B = layout.terracePoints[i],
        e = edge(A, B);
      const grade = (t) => {
        const [x, , z] = e.at(t * e.L, 0);
        return Math.min(6.22, ground(x, z) + 0.18);
      };
      const stairs = i === 2 || i === 3;
      const n =
        stairs && d >= 2
          ? Math.max(3, Math.ceil((grade(1) - grade(0)) / 0.19))
          : Math.ceil(e.L / (d === 1 ? 8 : 3.4));
      const w = i < 3 ? 5.3 : 3.8;
      const height = (t) => (stairs ? mix(grade(0), grade(1), t) : grade(t));
      for (let j = 0; j < n; j++) {
        const a = (e.L * j) / n,
          b = (e.L * (j + 1)) / n,
          low = height(j / n),
          high = height((j + 1) / n);
        const h = stairs && d >= 2 ? high : low;
        const c = e.at(a, h, -w / 2),
          f = e.at(a, h, w / 2),
          g = e.at(b, high, w / 2),
          m = e.at(b, high, -w / 2);
        face(out, 'deck', 'pale', [c, m, g, f], up);
        if (stairs && d >= 2) {
          const t = e.at(a - 0.1, 0),
            mid = e.at(a, 0),
            toward = [t[0] - mid[0], 0, t[2] - mid[2]];
          face(
            out,
            'travertine',
            'curb',
            [c, f, e.at(a, low, w / 2), e.at(a, low, -w / 2)],
            toward,
          );
          for (const side of [-w / 2, w / 2]) {
            const L = e.at(a, h, side),
              R = e.at(b, high, side),
              [lx, , lz] = L,
              [rx, , rz] = R;
            face(
              out,
              'travertine',
              'warm',
              [
                L,
                R,
                [rx, Math.min(high - 0.17, ground(rx, rz) - 0.26), rz],
                [lx, Math.min(h - 0.17, ground(lx, lz) - 0.26), lz],
              ],
              e.n.map((v) => v * Math.sign(side)),
            );
          }
        }
      }
    }
  }
}
function garden(out, d) {
  const [x, z] = layout.gardenCenter,
    y = layout.gardenGrade + 0.47;
  const n = d === 0 ? 10 : d === 1 ? 24 : d === 2 ? 42 : 64;
  const outline = layout.gardenRing;
  annulus(out, x, z, y - 0.22, 13.6, 16.3, 0, TAU, n, 'deck', 'curb');
  if (d >= 1) {
    // Plant rings are above the mapped pool and leave bright water between beds.
    for (const [dx, dz, rx, rz] of [
      [0, 1.6, 4.7, 4.9],
      [-5.2, -4.1, 4.25, 4.1],
      [5.3, -4, 4.3, 4.2],
    ]) {
      const p = [x + dx, z + dz],
        span = TAU * (d >= 2 ? 1.16 : 1.01),
        segments = d >= 3 ? 47 : d === 2 ? 31 : 18;
      const points = Array.from({ length: segments + 1 }, (_, i) => {
        const t = i / segments,
          r = mix(0.25, 0.98, t),
          a = t * span;
        return [p[0] + Math.cos(a) * rx * r, y + 0.14 + 0.1 * t, p[1] + Math.sin(a) * rz * r];
      });
      beamPath(out, 'landscape', points, 0.78, 0.56, tint.hedgeDark);
      if (d >= 2)
        beamPath(
          out,
          'landscape',
          points.map(([x, y, z]) => [x, y + 0.19, z]),
          0.47,
          0.31,
          tint.hedge,
        );
    }
    for (let i = 0; i < 4; i++) {
      const r = 16.5 + i * 1.45;
      annulus(
        out,
        x,
        z,
        y + 0.39 + i * 0.4,
        r,
        r + 1.4,
        -0.22,
        Math.PI + 0.35,
        n,
        'deck',
        i % 2 ? 'pale' : 'warm',
      );
    }
    const stem = outline.slice(0, -1).filter((_, i) => i % (d >= 3 ? 2 : 7) === 0);
    for (const [i, pt] of stem.entries()) {
      const x = pt[0] + (pt[0] - layout.gardenCenter[0]) * 0.43,
        z = pt[1] + (pt[1] - layout.gardenCenter[1]) * 0.43,
        g = ground(x, z) + 0.12;
      round(out, 'landscape', 'trunk', x, z, 0.17, 0.18, g, g + 2.25, 6);
      sphere(
        out,
        'landscape',
        [x, g + 3.1, z],
        [1.47, 1.82, 1.58],
        tint[i % 3 ? 'hedge' : 'leaf'],
        d >= 3 ? 10 : 7,
        d >= 3 ? 6 : 4,
      );
    }
    if (d >= 3) {
      const rim = outline.slice(0, -1).map(([u, v]) => [x + (u - x) * 1.025, z + (v - z) * 1.025]);
      for (let i = 0; i < rim.length; i++) {
        const a = rim[i],
          b = rim[(i + 1) % rim.length],
          h = ground(...a),
          k = ground(...b);
        if (Math.min(h, k) < y + 0.34) continue;
        face(
          out,
          'travertine',
          'warm',
          [p(a, y - 0.37), p(a, h + 0.12), p(b, k + 0.12), p(b, y - 0.37)],
          [x - a[0], 0, z - a[1]],
        );
      }
    }
  }
}
function courtyard(out, d) {
  const c = layout.boulderFountain,
    x = c[0],
    z = c[1];
  const y = Math.max(ground(x, z) + 0.13, -1.75),
    n = d === 0 ? 8 : d >= 2 ? 24 : 14;
  annulus(out, x, z, y + 0.33, 4.95, 5.33, 0, TAU, n, 'travertine', 'pale');
  if (!d) return;
  for (let i = 0; i < (d >= 3 ? 12 : 6); i++) {
    const a = (i / 6) * TAU + Math.sin(i * 2.6) * 0.39,
      r = 2.3 + Math.sin(i * 1.35) * 1.27;
    sphere(
      out,
      'travertine',
      [x + Math.cos(a) * r, y + 0.32, z + Math.sin(a) * r],
      [0.47 + 0.16 * (i % 3), 0.36 + 0.24 * (i % 5), 0.53],
      tint[i % 3 ? 'pale' : 'sand'],
      d >= 3 ? 8 : 6,
      d >= 3 ? 5 : 4,
    );
  }
  if (d >= 2) {
    const [x, z] = layout.court;
    pathSurface(
      out,
      [
        [x - 13, z - 29],
        [x - 4, z - 17],
        [x + 1, z],
      ],
      2.65,
      'pale',
      (p) => Math.min(6.45, ground(...p) + 0.13),
    );
  }
}
export function buildMuseumLevel(out, level) {
  const d = dists[level];
  if (d === undefined) throw Error('Unknown Getty detail level');
  platform(out, d);
  for (const part of layout.parts) {
    building(out, part, d);
    roofParts(out, part, d);
  }
  rotunda(out, d);
  research(out, d);
  arrival(out, d);
  garden(out, d);
  courtyard(out, d);
}
export const buildSkyline = (out) => buildMuseumLevel(out, 'skyline');
export const buildDistrict = (out) => buildMuseumLevel(out, 'district');
export const buildStreet = (out) => buildMuseumLevel(out, 'street');
export const buildCloseup = (out) => buildMuseumLevel(out, 'closeup');
export const buildMaster = (out) => buildMuseumLevel(out, 'master');
