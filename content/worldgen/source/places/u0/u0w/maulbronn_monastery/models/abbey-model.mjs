/** Maulbronn roofs follow attributed footprint polygons and standard terrain. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const abbeySurfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone' },
  roof: { slot: 'roof', graph: 'tile_flat' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  glass: { slot: 'window', graph: 'window_punched' },
  slate: { slot: 'roof', graph: 'slate' },
};
const palette = {
  stone: 'b7a28b',
  dressed: 'd0b798',
  earth: 'a18d70',
  damp: '8f816c',
  pale: 'dbd1bc',
  cream: 'd3c7b1',
  oak: '634a37',
  wood: '463a32',
  shutter: '697b73',
  red: 'ab7056',
  rust: 'a06751',
  ochre: 'af795b',
  tileShade: '915843',
  glass: '4d5552',
  shadow: '5d5146',
  slate: '555b5c',
  edge: '746d61',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((h) => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff',
  tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t,
  point = ([x, z], y) => [x, y, z];
const center = (a, b) => a.map((v, i) => (v + b[i]) / 2);
function face(out, slot, color, points, normal) {
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (
    points.length === 4 &&
    Math.abs(n.reduce((s, v, i) => s + v * (points[3][i] - points[0][i]), 0)) > 0.00001
  ) {
    out.addTriangle(slot, ref, points.slice(0, 3), n, undefined, colors[color]);
    const tail = [points[0], points[2], points[3]];
    out.addTriangle(slot, ref, tail, normalFor(...tail), undefined, colors[color]);
  } else out.addConvexPolygon(slot, ref, points, n, (p) => [p[0], p[2]], colors[color]);
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    x = (b[0] - a[0]) / len,
    z = (b[1] - a[1]) / len;
  return {
    len,
    n: [z, 0, -x],
    p: (u, y, w = 0) => [a[0] + x * u + z * w, y, a[1] + z * u - x * w],
  };
}
function panel(out, f, slot, color, u, v, y, h, w = 0) {
  if (v - u < 0.025 || h - y < 0.025) return;
  face(out, slot, color, [f.p(u, y, w), f.p(v, y, w), f.p(v, h, w), f.p(u, h, w)], f.n);
}
function archShape(r, h, n, pointed) {
  return Array.from({ length: n + 1 }, (_, j) => {
    const a = (j * Math.PI) / n;
    return [r * Math.cos(a), h * (pointed ? Math.pow(Math.sin(a), 0.67) : Math.sin(a))];
  });
}
function archWindow(out, f, u, y, w, h, tier, pointed) {
  const spring = y + h * 0.56,
    base = y,
    r = w / 2,
    curve = archShape(r, h * 0.44, tier >= 3 ? 8 : 4, pointed);
  const ring = [[u - r, base], [u + r, base], ...curve.map(([a, b]) => [u + a, spring + b])];
  face(
    out,
    'glass',
    'glass',
    ring.map(([x, y]) => f.p(x, y, 0.038)),
    f.n,
  );
  const trim = pointed ? 0.15 : 0.13;
  panel(out, f, 'stone', 'dressed', u - r - trim, u - r, base, spring, 0.057);
  panel(out, f, 'stone', 'dressed', u + r, u + r + trim, base, spring, 0.057);
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = curve[i - 1],
      [c, d] = curve[i],
      outward = ([x, y]) =>
        f.p(u + x * (1 + trim / r), spring + y + trim * (y / (h * 0.44)), 0.059);
    face(
      out,
      'stone',
      'dressed',
      [
        f.p(u + a, spring + b, 0.059),
        f.p(u + c, spring + d, 0.059),
        outward([c, d]),
        outward([a, b]),
      ],
      f.n,
    );
  }
  if (tier >= 2)
    panel(out, f, 'stone', 'dressed', u - 0.045, u + 0.045, base, spring + h * 0.27, 0.072);
}
function squareWindow(out, f, u, y, w, h, tier, shutters) {
  const a = u - w / 2,
    b = u + w / 2;
  panel(out, f, 'glass', 'glass', a, b, y, y + h, 0.048);
  if (tier < 2) return;
  panel(out, f, 'stone', 'dressed', a - 0.12, b + 0.12, y - 0.09, y, 0.076);
  if (tier >= 3) panel(out, f, 'stone', 'dressed', a - 0.1, b + 0.1, y + h, y + h + 0.09, 0.078);
  if (shutters) {
    panel(out, f, 'timber', 'shutter', a - w * 0.28, a, y, y + h, 0.078);
    panel(out, f, 'timber', 'shutter', b, b + w * 0.28, y, y + h, 0.078);
  }
  if (tier >= 3) panel(out, f, 'stone', 'dressed', u - 0.025, u + 0.025, y, y + h, 0.077);
}
function simpleGable(
  out,
  corners,
  base,
  eave,
  rise,
  color,
  wallSlot = 'stone',
  wallColor = 'stone',
) {
  const p = corners.map((q) => point(q, eave)),
    a = point(center(corners[0], corners[3]), eave + rise),
    b = point(center(corners[1], corners[2]), eave + rise);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      normal = frame(corners[i], corners[j]).n;
    face(
      out,
      wallSlot,
      wallColor,
      [point(corners[i], base), point(corners[j], base), p[j], p[i]],
      normal,
    );
  }
  face(out, wallSlot, wallColor, [p[3], p[0], a], frame(corners[3], corners[0]).n);
  face(out, wallSlot, wallColor, [p[1], p[2], b], frame(corners[1], corners[2]).n);
  face(out, 'roof', color, [p[0], p[1], b, a], [0, 1, 0]);
  face(out, 'roof', color, [p[3], p[2], b, a], [0, 1, 0]);
}
function tower(out, b, tier) {
  const y = b.eave,
    c = b.corners.map((p) => point(p, y)),
    peak = point(b.center, y + b.rise);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      f = frame(b.corners[i], b.corners[j]);
    face(
      out,
      'stone',
      'stone',
      [point(b.corners[i], b.foundationY), point(b.corners[j], b.foundationY), c[j], c[i]],
      f.n,
    );
    face(out, 'roof', 'rust', [c[i], c[j], peak], [0, 1, 0]);
    if (tier) {
      squareWindow(out, f, f.len / 2, y - 2.15, Math.min(0.85, f.len * 0.3), 1.05, tier, false);
      if (tier >= 2 && f.len > 4)
        panel(out, f, 'stone', 'dressed', 0, f.len, y - 0.31, y - 0.19, 0.055);
    }
  }
}
function genericWall(out, b, edge, tier) {
  const { span, normal } = edge,
    style = b.style,
    timber = style === 'timber';
  const top = Math.min(span[0][2], span.at(-1)[2]),
    base = b.base,
    story = base + 2.65;
  const f = frame(span[0], span.at(-1));
  for (let i = 1; i < span.length; i++) {
    const [x, z, h, bottom] = span[i - 1],
      [a, k, g, floor] = span[i];
    const low = [x, bottom, z],
      low2 = [a, floor, k],
      high = [x, h, z],
      high2 = [a, g, k];
    if (timber && h > story + 0.1 && g > story + 0.1) {
      face(out, 'stone', 'earth', [low, low2, [a, story, k], [x, story, z]], normal);
      face(
        out,
        'plaster',
        b.key % 2 ? 'pale' : 'cream',
        [[x, story, z], [a, story, k], high2, high],
        normal,
      );
    } else
      face(out, 'stone', style === 'range' ? 'damp' : 'stone', [low, low2, high2, high], normal);
  }
  if (!tier || f.len < (b.suffix?.toString().startsWith('cloister-') ? 2.1 : 2.65)) return;
  const hall = style === 'church' || style === 'range',
    granary = style === 'granary',
    porch = style === 'porch';
  if (timber && f.len > 3) {
    const usable = top - story;
    if (usable < 0.35) return;
    const rows = Math.max(1, Math.min(tier === 2 ? 2 : 3, Math.floor(usable / 1.85))),
      count = Math.max(2, Math.round(f.len / (tier === 1 ? 3.35 : tier === 2 ? 4.0 : 2.75)));
    const stud = (a, y, b, z) =>
      beam(out, 'timber', f.p(a, y, 0.068), f.p(b, z, 0.068), 0.133, 0.153, colors.wood);
    for (let row = 0; row <= rows; row++)
      panel(
        out,
        f,
        'timber',
        'oak',
        0,
        f.len,
        story + (usable * row) / rows - 0.08,
        story + (usable * row) / rows + 0.08,
        0.079,
      );
    if (tier === 1) return;
    for (let i = 0; i <= count; i++)
      panel(
        out,
        f,
        'timber',
        'oak',
        Math.max(0, (f.len * i) / count - 0.067),
        Math.min(f.len, (f.len * i) / count + 0.067),
        story,
        top,
        0.076,
      );
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < count; i++) {
        const a = (f.len * i) / count,
          b = (f.len * (i + 1)) / count,
          y = story + (usable * row) / rows;
        const ht = usable / rows;
        if (ht > 1.4)
          squareWindow(
            out,
            f,
            (a + b) / 2,
            y + 0.35,
            Math.min(0.83, (b - a) * 0.4),
            Math.min(1.1, ht - 0.5),
            tier,
            true,
          );
        if (tier >= 3 && i % 2 === 0) stud(a + 0.11, y + 0.11, a + (b - a) * 0.26, y + ht - 0.12);
        if (tier >= 3 && i % 2 === 1) stud(b - 0.11, y + 0.11, b - (b - a) * 0.26, y + ht - 0.12);
      }
    if (tier >= 3)
      for (let i = 0; i < count; i += 2)
        squareWindow(out, f, (f.len * (i + 0.5)) / count, base + 0.78, 0.75, 1.08, tier, false);
    const mid = span.length === 3 ? span[1][2] : top;
    if (mid > top + 1.8 && tier >= 2) {
      panel(out, f, 'timber', 'oak', 0, f.len, top - 0.07, top + 0.08, 0.086);
      for (const fraction of [0.27, 0.5, 0.73]) {
        const maxY = top + (1 - 2 * Math.abs(fraction - 0.5)) * (mid - top);
        const x = f.len * fraction;
        panel(out, f, 'timber', 'oak', x - 0.08, x + 0.08, top, maxY - 0.14, 0.081);
      }
      if (tier >= 3 && mid - top > 2.2)
        squareWindow(out, f, f.len / 2, top + 0.47, 0.8, 1.15, tier, true);
    }
    return;
  }
  if (tier === 1 && !hall && !granary) return;
  const count = Math.min(
    tier === 1 ? 8 : 18,
    Math.max(1, Math.round(f.len / (tier === 2 ? (hall ? 5.8 : 4.8) : hall ? 4.4 : 3.2))),
  );
  for (let i = 0; i < count; i++) {
    const u = (f.len * (i + 0.5)) / count;
    if (hall && tier >= 2 && f.len > (tier === 2 ? 7.25 : 3.5))
      archWindow(
        out,
        f,
        u,
        base + (style === 'church' ? 3.1 : 2.1),
        Math.min(1.3, (f.len / count) * 0.57),
        Math.min(style === 'church' ? 4.25 : 2.7, top - base - 2.5),
        tier,
        true,
      );
    else
      squareWindow(
        out,
        f,
        u,
        base + (porch ? 1.65 : 1.85),
        Math.min(1.02, (f.len / count) * 0.5),
        1.05,
        tier,
        style === 'manor',
      );
    if (tier >= 3 && top - base > 7 && !hall)
      squareWindow(out, f, u, base + 4.2, 0.9, 1.27, tier, false);
  }
  if (granary && span.length === 3 && tier >= 2) {
    const y1 = span[1][2];
    for (let row = 0; row < 4; row++) {
      const y = top + 0.72 + row * 2.27,
        w = (((y1 - y) / (y1 - top)) * f.len) / 2;
      for (let u = f.len / 2 - w + 2; u < f.len / 2 + w - 1.15; u += 3.3)
        squareWindow(out, f, u, y, 1.02, 0.97, tier, false);
    }
  }
}
function dormers(out, b, tier) {
  if (tier < 2 || !['granary', 'timber', 'manor'].includes(b.style) || b.axis.ar < 75) return;
  if (tier === 2 && b.style !== 'granary' && b.axis.ar < 155) return;
  const a = b.axis,
    mid = (a.v0 + a.v1) / 2,
    L = a.u1 - a.u0,
    n = Math.min(b.style === 'granary' ? 9 : 5, Math.round(L / (tier === 2 ? 9.4 : 6.4)));
  const xy = (u, v) => [a.u[0] * u + a.v[0] * v, a.u[1] * u + a.v[1] * v];
  const pitch = (v) => b.eave + b.rise * (1 - Math.abs(v - mid) / ((a.v1 - a.v0) / 2));
  for (let i = 0; i < n; i++)
    for (const sign of [-1, 1]) {
      const u = a.u0 + (L * (i + 0.55)) / (n + 0.1),
        v = mix(mid, sign === 1 ? a.v1 : a.v0, 0.57),
        a0 = xy(u - 0.56, v),
        a1 = xy(u + 0.56, v),
        a2 = xy(u + 0.56, v - sign * 1.7),
        a3 = xy(u - 0.56, v - sign * 1.7),
        y = pitch(v);
      const corners = sign > 0 ? [a3, a2, a1, a0] : [a0, a1, a2, a3];
      const eave = y + 1.0,
        peak = y + 1.52,
        c = point(center(a0, a1), peak),
        q0 = point(a0, eave),
        q1 = point(a1, eave);
      const normal = [a.v[0] * sign, 0, a.v[1] * sign],
        f = sign > 0 ? frame(a1, a0) : frame(a0, a1);
      face(out, 'timber', 'oak', [point(a0, y - 0.06), point(a1, y - 0.06), q1, q0], normal);
      face(out, 'timber', 'oak', [q0, q1, c], normal);
      squareWindow(out, f, 0.56, y + 0.15, 0.61, 0.64, tier, false);
      face(
        out,
        'roof',
        'tileShade',
        [q0, c, point(center(a2, a3), peak - 0.05), point(a3, eave - 0.02)],
        [0, 1, 0],
      );
      face(
        out,
        'roof',
        'tileShade',
        [q1, c, point(center(a2, a3), peak - 0.05), point(a2, eave - 0.02)],
        [0, 1, 0],
      );
      if (tier >= 3)
        for (const [q, r] of [
          [a0, a3],
          [a1, a2],
        ])
          face(
            out,
            'timber',
            'oak',
            [
              point(q, y),
              point(r, pitch(v - sign * 1.7) - 0.06),
              point(r, eave - 0.02),
              point(q, eave),
            ],
            frame(corners[0], corners[1]).n,
          );
    }
}
function fountainRoof(out, b, tier) {
  const sides = tier < 2 ? 6 : 10,
    c = b.center,
    y = b.eave + 1.44;
  const roof = radialRing(y, 3.65, 3.45, sides, c, 0.23);
  for (let i = 0; i < sides; i++)
    face(out, 'roof', 'rust', [roof[i], roof[(i + 1) % sides], point(c, y + 3.4)], [0, 1, 0]);
}
function building(out, b, tier) {
  if (b.style === 'gate') return;
  if (b.style === 'tower') {
    tower(out, b, tier);
    return;
  }
  const roof = ['rust', 'red', 'ochre'][b.key % 3],
    timber = b.style === 'timber';
  if (tier === 0) {
    if ((b.axis.ar < 29 && b.key !== 62) || String(b.suffix).startsWith('cloister-')) return;

    simpleGable(
      out,
      b.corners,
      b.foundationY,
      b.eave,
      b.rise,
      roof,
      timber ? 'plaster' : 'stone',
      timber ? 'pale' : 'stone',
    );
    if (b.style === 'lavatorium') fountainRoof(out, b, tier);
    return;
  }
  for (const e of b.edges) genericWall(out, b, e, tier);
  for (const points of b.roofs) face(out, 'roof', roof, points, [0, 1, 0]);
  if (b.style === 'lavatorium') fountainRoof(out, b, tier);
  dormers(out, b, tier);
}
function churchNave(out, tier) {
  const corners = layout.naveCorners,
    base = 9.55,
    eave = 13.95,
    rise = 7.05;
  simpleGable(out, corners, base, eave, rise, 'red');
  const c = layout.peaks.spire;
  const steps = tier >= 2 ? 8 : 4;
  const rings = [
    [16.85, 1.27],
    [20.0, 1.45],
    [22.0, 1.15],
    [22.45, 1.33],
    [26.45, 0.29],
  ].map(([y, r]) => radialRing(y, r, r, steps, c, Math.PI / steps));
  loft(out, 'slate', rings, colors.slate, { cap: false });
  for (let i = 0; i < steps; i++)
    face(
      out,
      'slate',
      'slate',
      [rings.at(-1)[i], rings.at(-1)[(i + 1) % steps], point(c, 27.5)],
      [0, 1, 0],
    );
  if (tier >= 2) {
    const a = frame(corners[0], corners[1]),
      b = frame(corners[2], corners[3]);
    for (const f of [a, b])
      for (let i = 1; i <= 10; i++)
        archWindow(out, f, (f.len * i) / 11, 10.18, 0.82, 2.35, tier, true);
    beam(out, 'slate', point(c, 27.45), point(c, 28.39), 0.09, 0.09, colors.edge);
    beam(
      out,
      'slate',
      [c[0] - 0.38, 28.12, c[1]],
      [c[0] + 0.38, 28.12, c[1]],
      0.075,
      0.075,
      colors.edge,
    );
  }
}
function gate(out, tier) {
  const {
    x: [a, b],
    z: [c, d],
    center,
    base,
  } = layout.gate;
  const archWidth = 2.17,
    y = base + 0.45,
    spring = y + 2.05,
    rise = 1.48,
    top = y + 4.65,
    n = tier === 0 ? 5 : tier < 3 ? 8 : 14;
  const curve = archShape(archWidth, rise, n, false).map(([x, h]) => [center + x, spring + h]);
  const outer = curve.map(([x, h]) => [center + (x - center) * 1.11, spring + (h - spring) * 1.16]);
  const p = (x, [z, y]) => [x, y, z];
  for (const [x, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    for (let i = 1; i < curve.length; i++) {
      const j = i - 1,
        u = curve[j],
        v = curve[i],
        l = outer[j],
        r = outer[i];
      face(out, 'stone', 'dressed', [p(x, u), p(x, v), p(x, r), p(x, l)], [sign, 0, 0]);
      face(out, 'stone', 'stone', [p(x, l), p(x, r), [x, top, r[0]], [x, top, l[0]]], [sign, 0, 0]);
    }
    for (const [lo, hi] of [
      [c, outer.at(-1)[0]],
      [outer[0][0], d],
    ]) {
      face(
        out,
        'stone',
        'stone',
        [
          [x, base, lo],
          [x, base, hi],
          [x, top, hi],
          [x, top, lo],
        ],
        [sign, 0, 0],
      );
    }
    for (const s of [-1, 1]) {
      const low = center + s * archWidth,
        high = center + s * archWidth * 1.11;
      face(
        out,
        'stone',
        'dressed',
        [
          [x, base, low],
          [x, base, high],
          [x, spring, high],
          [x, spring, low],
        ],
        [sign, 0, 0],
      );
    }
  }
  for (let i = 1; i < curve.length; i++) {
    const u = curve[i - 1],
      v = curve[i];
    face(
      out,
      'stone',
      'shadow',
      [p(a, u), p(b, u), p(b, v), p(a, v)],
      [0, -1, (center - (u[0] + v[0]) / 2) * 0.45],
    );
  }
  for (const s of [-1, 1])
    for (const q of [center + s * archWidth, s < 0 ? c : d]) {
      const inward = q === c || q === d ? s : -s;
      face(
        out,
        'stone',
        'stone',
        [
          [a, base, q],
          [b, base, q],
          [b, q === c || q === d ? top : spring, q],
          [a, q === c || q === d ? top : spring, q],
        ],
        [0, 0, inward],
      );
    }
  const corners = [
      [a, c],
      [b, c],
      [b, d],
      [a, d],
    ],
    topP = corners.map((p) => point(p, top));
  const ridge = [point([a, center], top + 2.65), point([b, center], top + 2.65)];
  face(out, 'roof', 'rust', [topP[0], topP[1], ridge[1], ridge[0]], [0, 1, 0]);
  face(out, 'roof', 'rust', [topP[3], topP[2], ridge[1], ridge[0]], [0, 1, 0]);
  face(out, 'stone', 'stone', [topP[3], topP[0], ridge[0]], [-1, 0, 0]);
  face(out, 'stone', 'stone', [topP[1], topP[2], ridge[1]], [1, 0, 0]);
}
function walls(out, tier) {
  for (const [j, rows] of layout.walls.entries())
    for (let i = 1; i < rows.length; i++) {
      if (j === 1 && i === 5) continue;
      const [x, z, y] = rows[i - 1],
        [a, b, h] = rows[i],
        f = frame([x, z], [a, b]),
        height = j === 0 ? 1.12 : 1.72,
        w = 0.51;
      for (const s of [-1, 1]) {
        const pts = [
          f.p(0, y - 0.4, s * w),
          f.p(f.len, h - 0.4, s * w),
          f.p(f.len, h + height, s * w),
          f.p(0, y + height, s * w),
        ];
        face(
          out,
          'stone',
          'damp',
          pts,
          f.n.map((v) => v * s),
        );
      }
      if (tier)
        face(
          out,
          'stone',
          'dressed',
          [
            f.p(0, y + height, -w),
            f.p(f.len, h + height, -w),
            f.p(f.len, h + height, w),
            f.p(0, y + height, w),
          ],
          [0, 1, 0],
        );
    }
}
export function buildAbbeyLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error('Unknown Maulbronn tier ' + level);
  for (const b of layout.buildings) building(out, b, tier);
  if (tier === 0)
    simpleGable(
      out,
      [
        [5.4, 12.9],
        [42, 16],
        [41, 21],
        [4.7, 17.3],
      ],
      -1.4,
      6.15,
      3.5,
      'rust',
    );
  churchNave(out, tier);
  gate(out, tier);
  walls(out, tier);
}
export const buildAbbeySkyline = (out) => buildAbbeyLevel(out, 'skyline');
export const buildAbbeyDistrict = (out) => buildAbbeyLevel(out, 'district');
export const buildAbbeyStreet = (out) => buildAbbeyLevel(out, 'street');
export const buildAbbeyCloseup = (out) => buildAbbeyLevel(out, 'closeup');
