/** Kievyan's paired arch vaults, transverse portals and cast-iron rosettes. */
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.34, 0.352, 0.324],
  concrete = [0.58, 0.58, 0.535],
  iron = [0.1, 0.125, 0.113];
const half = 136.152,
  road = 58.3,
  soffit = 56.25;
const bottom = (x) => 5.5 + 48 * (1 - (x / 57.5) ** 2);
const top = (x) => bottom(x) + 2.7 + 1.2 * (x / 57.5) ** 2;

// Convex cross-section, extruded with outward normals; callers partition curved regions.
function prism(out, slot, points, z0, z1, color) {
  const area = points.reduce(
    (s, p, i) =>
      s + p[0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * p[1],
    0,
  );
  if (Math.abs(area) < 1e-10) return;
  const p = area > 0 ? points : points.toReversed(),
    a = p.map(([x, y]) => [x, y, z0]),
    b = p.map(([x, y]) => [x, y, z1]);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    a.toReversed(),
    [0, 0, -1],
    (p) => [p[0], p[1]],
    color,
  );
  out.addConvexPolygon(slot, 'palette:#ffffff', b, [0, 0, 1], (p) => [p[0], p[1]], color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      q = [a[i], a[j], b[j], b[i]];
    quad(out, slot, q, normalFor(...q), color);
  }
}
function transverse(out, x) {
  const p = ([u, y, v]) => [x + v, y, -u],
    n = ([u, y, v]) => [v, y, -u];
  return {
    addQuad: (s, r, ps, nn, uv, c) => out.addQuad(s, r, ps.map(p), n(nn), uv, c),
    addTriangle: (s, r, ps, nn, uv, c) => out.addTriangle(s, r, ps.map(p), n(nn), uv, c),
    addConvexPolygon: (s, r, ps, nn, uv, c) => out.addConvexPolygon(s, r, ps.map(p), n(nn), uv, c),
  };
}
function blocks(out, a, b, low, high, z0, z1, lower = () => low) {
  for (let row = 0, y = low; y < high; row++, y += 0.42) {
    for (let x = a - (row % 2) * 0.38; x < b; x += 0.76) {
      const x0 = Math.max(a, x + 0.01),
        x1 = Math.min(b, x + 0.745),
        h = Math.min(high, y + 0.404);
      if (x1 <= x0) continue;
      const cuts = [x0, (x0 + x1) / 2, x1];
      for (let i = 1; i < cuts.length; i++) {
        const aa = cuts[i - 1],
          bb = cuts[i],
          l0 = Math.max(y + 0.012, lower(aa)),
          l1 = Math.max(y + 0.012, lower(bb));
        if (Math.min(l0, l1) >= h) continue;
        let p = [
          [aa, l0],
          [bb, l1],
          [bb, h],
          [aa, h],
        ];
        if (l0 >= h)
          p = [
            [aa + ((h - l0) / (l1 - l0)) * (bb - aa), h],
            [bb, l1],
            [bb, h],
          ];
        else if (l1 >= h)
          p = [
            [aa, l0],
            [aa + ((h - l0) / (l1 - l0)) * (bb - aa), h],
            [aa, h],
          ];
        const tint = stone.map((v) => v + 0.047 * Math.sin(x * 19.1 + row * 31.8));
        for (const z of [z0, z1]) prism(out, 'basalt', p, z - 0.025, z + 0.025, tint);
      }
    }
  }
}
function portal(out, x, low) {
  const t = transverse(out, x),
    inner = 6.7,
    sy = 46.3,
    ry = 6.7,
    width = 3;
  for (const sign of [-1, 1]) {
    const a = sign < 0 ? -11.4 : inner,
      b = sign < 0 ? -inner : 11.4;
    box(t, 'basalt', [a, low, -width], [b, soffit, width], stone);
    blocks(t, a, b, low, soffit, -width - 0.015, width + 0.015);
  }
  const lower = (u) => sy + ry * Math.sqrt(Math.max(0, 1 - (u / inner) ** 2));
  for (let i = 0; i < 144; i++) {
    const a = -inner * Math.cos((Math.PI * i) / 144),
      b = -inner * Math.cos((Math.PI * (i + 1)) / 144);
    prism(
      t,
      'basalt',
      [
        [a, lower(a)],
        [b, lower(b)],
        [b, soffit],
        [a, soffit],
      ],
      -width,
      width,
      stone,
    );
  }
  blocks(t, -inner, inner, sy, soffit, -width - 0.025, width + 0.025, lower);
  // Dressed voussoirs edge the transverse inspection passage, with recessed joints.
  for (const z of [-width - 0.055, width + 0.055])
    for (let i = 0; i < 51; i++) {
      const a = (Math.PI * (i + 0.017)) / 51,
        b = (Math.PI * (i + 0.983)) / 51;
      const p = (q, r) => [-(inner + r) * Math.cos(q), sy + (ry + r) * Math.sin(q)];
      prism(
        t,
        'basalt',
        [p(a, 0), p(b, 0), p(b, 0.52), p(a, 0.52)],
        z - 0.04,
        z + 0.04,
        stone.map((v) => v + 0.07),
      );
    }
  for (const side of [-1, 1])
    box(
      out,
      'basalt',
      [x - 3.25, 55.7, side < 0 ? -12.9 : 11.4],
      [x + 3.25, 57.85, side < 0 ? -11.4 : 12.9],
      stone,
    );
}
function vaults(out) {
  for (const [z0, z1] of [
    [-11.3, -1.0],
    [1.0, 11.3],
  ]) {
    const rings = [];
    for (let i = 0; i <= 320; i++) {
      const x = -57.5 + (115 * i) / 320;
      rings.push([
        [x, bottom(x), z0],
        [x, top(x), z0],
        [x, top(x), z1],
        [x, bottom(x), z1],
      ]);
    }
    loft(out, 'concrete', rings, concrete);
    // Cast-panel joints follow both exposed vault sidewalls and broad soffits.
    for (let i = 0; i < 80; i++) {
      const a = -57.5 + ((i + 0.015) * 115) / 80,
        b = -57.5 + ((i + 0.985) * 115) / 80;
      for (const z of [z0 - 0.018, z1 + 0.018])
        prism(
          out,
          'concrete',
          [
            [a, bottom(a) + 0.012],
            [b, bottom(b) + 0.012],
            [b, top(b) - 0.012],
            [a, top(a) - 0.012],
          ],
          z - 0.018,
          z + 0.018,
          concrete.map((v) => v + Math.sin(i * 13.7) * 0.028),
        );
      for (let j = 0; j < 5; j++) {
        const za = z0 + 0.025 + (j * (z1 - z0)) / 5,
          zb = z0 + ((j + 1) * (z1 - z0)) / 5 - 0.025;
        const q = [
          [a, bottom(a) - 0.012, za],
          [b, bottom(b) - 0.012, za],
          [b, bottom(b) - 0.012, zb],
          [a, bottom(a) - 0.012, zb],
        ];
        quad(
          out,
          'concrete',
          q,
          normalFor(...q),
          concrete.map((v) => v - 0.02 + Math.sin(i * 17 + j * 11) * 0.025),
        );
      }
    }
    for (const sign of [-1, 1])
      for (const ax of [11.5, 21, 30.5, 40, 49.5]) {
        const x = sign * ax,
          low = Math.min(top(x - 0.6), top(x + 0.6));
        for (const z of [z0 + 0.6, z1 - 0.6]) {
          box(out, 'concrete', [x - 0.6, low, z - 0.6], [x + 0.6, soffit, z + 0.6], concrete);
          box(
            out,
            'concrete',
            [x - 0.75, low, z - 0.74],
            [x + 0.75, low + 0.34, z + 0.74],
            concrete.map((v) => v - 0.05),
          );
          for (let y = low + 1.2; y < soffit; y += 1.25)
            box(
              out,
              'concrete',
              [x - 0.605, y, z - 0.605],
              [x + 0.605, y + 0.016, z + 0.605],
              concrete.map((v) => v - 0.1),
            );
        }
        beam(out, 'concrete', [x, soffit - 0.4, z0], [x, soffit - 0.4, z1], 0.7, 0.7, concrete);
      }
    // Paired arch-top maintenance paths and rails; central crown merges into deck.
    for (const z of [z0 + 0.14, z1 - 0.14])
      for (const sign of [-1, 1]) {
        for (const [a, b] of [
          [25, 29.72],
          [31.28, 39.22],
          [40.78, 48.72],
          [50.28, 57.5],
        ]) {
          const count = Math.ceil((b - a) / 1.1);
          for (let i = 0; i < count; i++) {
            const xa = sign * (a + ((b - a) * i) / count),
              xb = sign * (a + ((b - a) * (i + 1)) / count);
            tube(out, 'iron', [xa, top(xa) + 0.95, z], [xb, top(xb) + 0.95, z], 0.027, iron, 8);
            tube(out, 'iron', [xa, top(xa) + 0.47, z], [xb, top(xb) + 0.47, z], 0.019, iron, 8);
            if (i % 2 === 0)
              tube(out, 'iron', [xa, top(xa), z], [xa, top(xa) + 0.98, z], 0.029, iron, 10);
          }
          const x = sign * b;
          tube(out, 'iron', [x, top(x), z], [x, top(x) + 0.98, z], 0.029, iron, 10);
        }
      }
    for (const sign of [-1, 1]) {
      const x = sign * 59;
      box(
        out,
        'concrete',
        [x - 4, 0, z0 - 0.7],
        [x + 4, 7.4, z1 + 0.7],
        concrete.map((v) => v - 0.07),
      );
    }
  }
  for (const x of [-64, 64]) portal(out, x, 5);
  for (const x of [-100, 100]) portal(out, x, 26);
  // Transverse ties between the two vaults, visible beneath the center slit.
  for (const x of [-43, -28, 0, 28, 43])
    box(out, 'concrete', [x - 0.5, bottom(x) + 0.8, -1], [x + 0.5, top(x) - 0.3, 1], concrete);
}
function approaches(out) {
  for (const sign of [-1, 1]) {
    // End wall has a longitudinal access arch seen in the city's whole-bridge photos.
    const c = sign * 120,
      rx = 5.8,
      sy = 44,
      low = 35.5;
    const lo = sign < 0 ? -half : 103,
      hi = sign < 0 ? -103 : half;
    const lower = (x) =>
      Math.abs(x - c) < rx ? sy + 5.8 * Math.sqrt(1 - ((x - c) / rx) ** 2) : low;
    const cuts = [lo, hi, c - rx, c + rx];
    for (let i = 0; i <= 100; i++) cuts.push(c - rx * Math.cos((Math.PI * i) / 100));
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i];
      if (b - a < 1e-7) continue;
      prism(
        out,
        'basalt',
        [
          [a, lower(a + 1e-7)],
          [b, lower(b - 1e-7)],
          [b, soffit],
          [a, soffit],
        ],
        -11.4,
        11.4,
        stone,
      );
    }
    blocks(out, lo, hi, low, soffit, -11.44, 11.44, lower);
    for (const z of [-11.49, 11.49])
      for (let i = 0; i < 45; i++) {
        const a = (Math.PI * (i + 0.016)) / 45,
          b = (Math.PI * (i + 0.984)) / 45,
          p = (q, r) => [c - (rx + r) * Math.cos(q), sy + (5.8 + r) * Math.sin(q)];
        prism(
          out,
          'basalt',
          [p(a, 0), p(b, 0), p(b, 0.6), p(a, 0.6)],
          z - 0.045,
          z + 0.045,
          stone.map((v) => v + 0.045),
        );
      }
    for (const x of [sign * 68, sign * 97])
      box(out, 'concrete', [x - 0.6, 54.9, -11.8], [x + 0.6, 56.5, 11.8], concrete);
  }
  for (let z = -11.25; z <= 11.3; z += 1.5)
    box(out, 'concrete', [-half, 56.25, z - 0.2], [half, 57.68, z + 0.2], concrete);
  box(out, 'concrete', [-half, 57.65, -12.75], [half, 58.05, 12.75], concrete);
  for (const z of [-12.6, 12.6]) {
    box(
      out,
      'basalt',
      [-half, 57.37, z - 0.25],
      [half, 57.71, z + 0.25],
      stone.map((v) => v + 0.08),
    );
    box(
      out,
      'basalt',
      [-half, 57.91, z - 0.4],
      [half, 58.14, z + 0.4],
      stone.map((v) => v + 0.09),
    );
  }
}
function roadDeck(out) {
  const lanes = [-6.8, -3.4, 3.4, 6.8],
    joints = [-100, -64, 64, 100];
  const dashes = [];
  for (let x = -half + 2; x < half; x += 8) dashes.push([x, Math.min(half, x + 3)]);
  const xs = [
    ...new Set([-half, half, ...dashes.flat(), ...joints.flatMap((x) => [x - 0.05, x + 0.05])]),
  ].sort((a, b) => a - b);
  const zs = [
    -10.2,
    10.2,
    ...lanes.flatMap((z) => [z - 0.055, z + 0.055]),
    -0.15,
    -0.065,
    0.065,
    0.15,
  ].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      const x = (xs[i] + xs[i - 1]) / 2,
        z = (zs[j] + zs[j - 1]) / 2;
      const joint = joints.some((a) => Math.abs(x - a) < 0.05),
        paint =
          (Math.abs(z) > 0.065 && Math.abs(z) < 0.15) ||
          (lanes.some((a) => Math.abs(z - a) < 0.055) && dashes.some(([a, b]) => x > a && x < b));
      quad(
        out,
        joint ? 'iron' : paint ? 'marking' : 'road',
        [
          [xs[i - 1], road, zs[j - 1]],
          [xs[i - 1], road, zs[j]],
          [xs[i], road, zs[j]],
          [xs[i], road, zs[j - 1]],
        ],
        [0, 1, 0],
        joint ? iron : paint ? [0.87, 0.87, 0.82] : [0.155, 0.165, 0.158],
      );
    }
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -12.9 : 10.2,
      z1 = side < 0 ? -10.2 : 12.9;
    box(out, 'paving', [-half, 58.05, z0], [half, 58.62, z1], [0.62, 0.62, 0.57]);
    for (let x = -half; x < half; x += 0.9)
      for (let j = 0; j < 3; j++) {
        box(
          out,
          'paving',
          [x + 0.013, 58.621, z0 + 0.015 + j * 0.9],
          [Math.min(half, x + 0.884), 58.655, z0 + (j + 1) * 0.9 - 0.015],
          [0.64, 0.64, 0.595].map((v) => v + 0.032 * Math.sin(x * 11 + j * 19)),
        );
      }
    for (let x = -half + 4; x < half; x += 9) {
      const z = side * 10.23;
      box(out, 'iron', [x - 0.36, 58.31, z - 0.12], [x + 0.36, 58.35, z + 0.12], iron);
      for (let i = 0; i < 8; i++)
        box(
          out,
          'steel',
          [x - 0.32 + i * 0.088, 58.351, z - 0.1],
          [x - 0.3 + i * 0.088, 58.368, z + 0.1],
          [0.3, 0.32, 0.3],
        );
    }
  }
}
function ringSlice(out, points, z, depth) {
  const ordered = points.toReversed();
  const a = ordered.map(([x, y]) => [x, y, z - depth / 2]);
  const b = ordered.map(([x, y]) => [x, y, z + depth / 2]);
  // No internal radial caps between adjacent sectors of one continuous casting.
  for (const ps of [a.toReversed(), b, [a[0], a[1], b[1], b[0]], [a[2], a[3], b[3], b[2]]])
    quad(out, 'iron', ps, normalFor(...ps), iron);
}
function ribbon(out, cx, cy, z, radius, width, segments = 48) {
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments,
      b = (2 * Math.PI * (i + 1)) / segments;
    const p = (t, d) => [cx + (radius + d) * Math.cos(t), cy + (radius + d) * Math.sin(t)];
    ringSlice(
      out,
      [p(a, -width / 2), p(b, -width / 2), p(b, width / 2), p(a, width / 2)],
      z,
      0.054,
    );
  }
}
function rosette(out, x, y, z) {
  // The open eight-point center and raised beads follow the owner's July2026 clip.
  for (let i = 0; i < 64; i++) {
    const a = (i * 2 * Math.PI) / 64,
      b = ((i + 1) * 2 * Math.PI) / 64;
    const p = (t, outer) => {
      const r = outer ? 0.22 + 0.024 * Math.cos(8 * t) : 0.073 + 0.027 * Math.cos(8 * t);
      return [x + r * Math.cos(t), y + r * Math.sin(t)];
    };
    ringSlice(out, [p(a, false), p(b, false), p(b, true), p(a, true)], z, 0.076);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      xx = x + 0.155 * Math.cos(a),
      yy = y + 0.155 * Math.sin(a);
    for (const side of [-1, 1])
      for (let j = 0; j < 12; j++) {
        const p = (k, q) => [
          xx + 0.038 * Math.sin((k * Math.PI) / 4) * Math.cos(q),
          yy + 0.038 * Math.sin((k * Math.PI) / 4) * Math.sin(q),
          z + side * (0.038 + 0.018 * Math.cos((k * Math.PI) / 4)),
        ];
        const a = (j * Math.PI) / 6,
          b = ((j + 1) * Math.PI) / 6;
        let ps = [p(0, 0), p(1, a), p(1, b)];
        if (side < 0) ps.reverse();
        out.addTriangle(
          'iron',
          'palette:#ffffff',
          ps,
          normalFor(...ps),
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          iron.map((v) => v + 0.025),
        );
        ps = [p(1, a), p(2, a), p(2, b), p(1, b)];
        if (side < 0) ps.reverse();
        quad(
          out,
          'iron',
          ps,
          normalFor(...ps),
          iron.map((v) => v + 0.025),
        );
      }
  }
}
function railings(out) {
  for (const side of [-1, 1]) {
    const z = side * 12.68,
      y = 58.66;
    for (const h of [0.09, 1.25])
      box(out, 'iron', [-half, y + h - 0.047, z - 0.07], [half, y + h + 0.047, z + 0.07], iron);
    const count = 76,
      pitch = (half * 2) / count;
    for (let i = 0; i <= count; i++) {
      const x = -half + i * pitch;
      box(out, 'iron', [x - 0.105, y, z - 0.1], [x + 0.105, y + 1.32, z + 0.1], iron);
      for (const h of [0.12, 1.11])
        box(out, 'iron', [x - 0.138, y + h, z - 0.128], [x + 0.138, y + h + 0.11, z + 0.128], iron);
      box(out, 'iron', [x - 0.15, y + 1.28, z - 0.15], [x + 0.15, y + 1.36, z + 0.15], iron);
      for (const sign of [-1, 1])
        for (const xx of [-0.055, 0.055])
          box(
            out,
            'iron',
            [x + xx - 0.011, y + 0.28, z + sign * 0.113 - 0.012],
            [x + xx + 0.011, y + 0.98, z + sign * 0.113 + 0.012],
            iron.map((v) => v + 0.025),
          );
      if (i === count) continue;
      for (let j = 0; j < 5; j++) {
        const xx = x + (pitch * (j + 0.5)) / 5;
        ribbon(out, xx, y + 0.67, z, 0.53, 0.04);
        rosette(out, xx, y + 0.67, z);
        if (j < 4) {
          const xm = xx + pitch / 10;
          rosette(out, xm, y + 0.91, z);
          rosette(out, xm, y + 0.43, z);
        }
      }
    }
  }
}
function lamps(out) {
  for (const side of [-1, 1])
    for (let x = -half + 10; x < half; x += 24) {
      const z = side * 11.85,
        y = 58.65;
      box(out, 'iron', [x - 0.23, y, z - 0.23], [x + 0.23, y + 0.32, z + 0.23], iron);
      tube(out, 'iron', [x, y + 0.3, z], [x, y + 7.6, z], 0.073, iron, 20);
      for (const sign of [-1, 1]) {
        const pts = Array.from({ length: 21 }, (_, i) => {
          const t = i / 20;
          return [x + sign * 1.5 * t, y + 6.5 + 1.3 * Math.sin((t * Math.PI) / 2), z];
        });
        for (let i = 1; i < pts.length; i++) tube(out, 'iron', pts[i - 1], pts[i], 0.038, iron, 12);
        sphere(out, 'iron', [x + sign * 1.48, y + 7.8, z], [0.29, 0.11, 0.13], iron, 20, 10);
        sphere(
          out,
          'marking',
          [x + sign * 1.48, y + 7.72, z],
          [0.23, 0.035, 0.1],
          [0.85, 0.88, 0.82],
          16,
          8,
        );
      }
      tube(out, 'iron', [x, y + 7.55, z], [x, y + 8.35, z], 0.032, iron, 12);
      for (const sign of [-1, 1])
        beam(out, 'iron', [x, y + 6.7, z], [x + sign * 0.35, y + 7.5, z], 0.02, 0.027, iron);
    }
}
export function buildKievyan(out) {
  vaults(out);
  approaches(out);
  roadDeck(out);
  railings(out);
  lamps(out);
}
export const kievyanStudy = {
  id: 'N0024',
  key: 'great_bridge_of_hrazdan',
  title: 'Great Bridge of Hrazdan (Kievyan Bridge)',
  wikidataId: 'Q3114751',
  mapFrameDocument: 'map-frame.json',
  build: buildKievyan,
  brief:
    'Paired broad concrete arch vaults, open spandrel posts, basalt-faced transverse pier portals, approach access arches, deck girders and open cast-iron rosette railings.',
  refs: [
    'https://visityerevan.am/places/details/819/en/',
    'https://www.yerevan.am/en/news/kiewyan-kamowrjn-amboghjowt-yamb-norogvowm-e/',
    'https://www.yerevan.am/hy/news/kiewyan-kamrji-himnanorogowmn-ent-ats-k-i-mej-e/',
    'https://www.yerevan.am/edfiles/video/KIEVYAN%20KAMURJ%2007.07.mp4',
    'https://commons.wikimedia.org/wiki/File:Great_Hrazdan_Bridge,_Yerevan.jpg',
    'https://commons.wikimedia.org/wiki/File:Kievyan_003.jpg',
    'https://commons.wikimedia.org/wiki/File:Hrazdan_bridge.JPG',
    'https://www.openstreetmap.org/relation/15750527',
  ],
  sourceFacts: {
    ownerPublishedLengthMeters: 364,
    ownerPublishedWidthMeters: 26,
    ownerPublishedHeightMeters: 58.3,
    owner2024LengthMeters: 351,
    mappedOutlineMeters: [272.304, 25.194],
    openingYear: 1956,
    architect: 'Grigor Aghababyan',
    construction: 'Reinforced concrete with cast-iron handrails; city tourism inventory.',
  },
  reconstruction: {
    archClearSpanMeters: 115,
    archSpanStatus:
      'Photo-scaled reconstruction; repeated unsourced115m captions are not treated as engineering measurements.',
    vaultCount: 2,
    vaultWidthMeters: 10.3,
    modeledLengthMeters: 272.304,
    notes:
      'Mapped exposed structure is retained separately from differing owner totals which include approaches. Paired vault widths, five spandrel posts per half, portal dimensions and vertical position are photographic reconstructions. Stable existing deck state is represented; current repairs do not prove completion.',
  },
  nativeAxes: {
    x: 'northeast toward Kievyan Street',
    y: 'up from reconstructed arch-foot foundation level',
    z: 'southeast/downstream',
  },
  geographic: (mapped) => ({
    anchor: mapped.anchor,
    heading: mapped.heading,
    elevationMode: 'terrain-contact',
    notes:
      'Exact named identity relation15750527 establishes plan. Direction is checked against road axis and gorge aerial. River datum, approach lengths and terrain fit remain pending.',
  }),
  limitations: [
    'No survey drawing found for internal member dimensions. Arch profile, transverse vault widths and pier spacing require further primary drawing confirmation.',
    'Owner totals364m and351m disagree; exposed map outline272.304m is modeled without stretching the arch to those totals. Approach extent remains under review.',
    'Current2026 owner repair footage documents rail pattern and joint work, but does not establish final completed roadway or lighting changes.',
    'Terrain elevation and full bank contacts need actual gorge terrain review; flat capture is not geographic approval.',
  ],
  camera: { position: [145, 82, 170], lookAt: [0, 31, 0], fov: 45 },
  qaCameras: [
    { name: 'downstream-elevation', position: [0, 35, 230], lookAt: [0, 29, 0], fov: 46 },
    { name: 'paired-vaults', position: [28, 14, 48], lookAt: [0, 39, 0], fov: 59 },
    { name: 'arch-soffit', position: [0, 15, 4], lookAt: [0, 52, 0], fov: 60 },
    { name: 'open-spandrels', position: [42, 43, 30], lookAt: [39, 42, 7], fov: 48 },
    { name: 'transverse-portal', position: [82, 39, 27], lookAt: [64, 41, 0], fov: 55 },
    { name: 'masonry-courses', position: [72, 48, 10], lookAt: [67, 48, 9], fov: 48 },
    { name: 'rosette-railing', position: [5, 59.75, 16], lookAt: [2.7, 59.32, 12.68], fov: 47 },
    { name: 'cast-iron-post', position: [-0.1, 59.8, 14.7], lookAt: [0, 59.45, 12.68], fov: 47 },
    { name: 'street-lamp', position: [-120, 65, 23], lookAt: [-126.152, 64.5, 11.85], fov: 46 },
    { name: 'road-deck', position: [100, 67, 3], lookAt: [-20, 58.4, 0], fov: 51 },
    { name: 'approach-access-arch', position: [126, 49, 32], lookAt: [120, 47, 0], fov: 52 },
    { name: 'maintenance-path', position: [-42, 35, -3], lookAt: [-40, top(-40), -1], fov: 47 },
  ],
};
