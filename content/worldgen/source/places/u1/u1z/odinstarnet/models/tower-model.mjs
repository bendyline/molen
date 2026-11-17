/** Odinstårnet's steel frame, public platforms and ground terrace, as seen in period photographs. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.22 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
};
const tone = {
  steel: [0.285, 0.315, 0.321],
  edge: [0.37, 0.406, 0.411],
  shadow: [0.17, 0.205, 0.217],
  slab: [0.62, 0.613, 0.558],
  step: [0.72, 0.696, 0.637],
  terrace: [0.73, 0.678, 0.57],
  cream: [0.85, 0.807, 0.7],
  white: [0.89, 0.864, 0.777],
  frame: [0.46, 0.45, 0.396],
  glass: [0.22, 0.289, 0.303],
  glassLight: [0.29, 0.353, 0.352],
  roof: [0.446, 0.47, 0.445],
  wood: [0.477, 0.343, 0.244],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t;
const vec = (a, b, t) => a.map((x, i) => mix(x, b[i], t));
const elevate = (v, y) => [v[0], y, v[2]];
const inset = (v, n) => v.map(([x, z]) => [x * n, z * n]);
const up = [0, 1, 0],
  tau = 2 * Math.PI;
const shape = (y, x, z, w, l, r) => chamferedRectangle(x, y, z, w, l, r);
const round = (out, slot, c, x, z, n, rows) =>
  loft(
    out,
    slot,
    rows.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    tone[c],
  );
const panel = (out, slot, color, p) =>
  out.addQuad(slot, '', p, normalFor(...p), undefined, tone[color]);
const member = (out, a, b, w, h, color = 'steel') => beam(out, 'steel', a, b, w, h, tone[color]);
function floor(out, slot, color, [lo, hi], outline) {
  loft(
    out,
    slot,
    [lo, hi].map((y) => outline.map(([x, z]) => [x, y, z])),
    tone[color],
  );
}
function guard(out, outline, y, d, height = 1.12) {
  if (d === 0) return;
  const head = outline.map(([x, z]) => [x, y + height, z]);
  beamPath(out, 'steel', head, 0.085, 0.075, tone.edge, true);
  if (d === 1) return;
  beamPath(
    out,
    'steel',
    head.map((p) => elevate(p, y + 0.51)),
    0.045,
    0.042,
    tone.steel,
    true,
  );
  for (let i = 0; i < head.length; i++) {
    const a = head[i],
      b = head[(i + 1) % head.length],
      length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const count = Math.ceil(length / (d === 2 ? 2.5 : 1.25));
    for (let k = 0; k < count; k++) {
      const p = vec(a, b, k / count);
      member(out, elevate(p, y), p, 0.06, 0.055);
    }
  }
}
function skylineBrace(out, a, b) {
  const rise =
    (0.24 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])) /
    Math.hypot(b[0] - a[0], b[2] - a[2]);
  const face = [
    elevate(a, a[1] - rise),
    elevate(b, b[1] - rise),
    elevate(b, b[1] + rise),
    elevate(a, a[1] + rise),
  ];
  panel(out, 'steel', 'steel', face);
  panel(out, 'steel', 'steel', face.toReversed());
}
function frame(out, d, low, high, width, bays, thick) {
  const r = width / 2,
    corners = [
      [-r, -r],
      [-r, r],
      [r, r],
      [r, -r],
    ];
  const p = (i, y) => [corners[i][0], y, corners[i][1]];
  const columnSides = d <= 1 ? 4 : d === 2 ? 12 : 20;
  for (let i = 0; i < 4; i++) {
    const [x, z] = corners[i];
    round(out, 'steel', 'steel', x, z, columnSides, [
      [low, thick],
      [high, thick],
    ]);
    if (d >= 2) {
      const rings = d >= 3 ? bays * 5 : bays;
      for (let k = 1; k <= rings; k++) {
        const y = mix(low, high, k / rings) - 0.3;
        round(out, 'steel', 'shadow', x, z, columnSides, [
          [y - 0.085, thick + 0.027],
          [y + 0.085, thick + 0.027],
        ]);
      }
    }
    const j = (i + 1) % 4;
    for (let k = 0; k < bays; k++) {
      const y = mix(low, high, k / bays),
        next = mix(low, high, (k + 1) / bays);
      const a = p(i, y),
        b = p(j, y),
        c = p(i, next),
        e = p(j, next);
      const w = low < 5 ? 0.28 : 0.22;
      if (d === 0) {
        skylineBrace(out, a, e);
        skylineBrace(out, b, c);
      } else if (d < 3) {
        member(out, a, e, w, w);
        member(out, b, c, w, w, 'edge');
      } else {
        // Each diagonal is a long paired-chord girder with short plate ties.
        for (const [u, v] of [
          [a, e],
          [b, c],
        ]) {
          const normal = i % 2 ? [0, 0, i === 1 ? 1 : -1] : [i === 0 ? -1 : 1, 0, 0];
          const chord = (p, s) => p.map((q, index) => q + normal[index] * s * 0.161);
          for (const sign of [-1, 1]) member(out, chord(u, sign), chord(v, sign), 0.139, 0.147);
          for (let n = 1; n <= (d === 4 ? 18 : 11); n++) {
            const q = vec(u, v, n / (d === 4 ? 19 : 12));
            member(out, chord(q, -1), chord(q, 1), 0.111, 0.108, 'edge');
          }
        }
        const middle = vec(a, e, 0.5);
        const normal = i % 2 ? [0, 0, i === 1 ? 1 : -1] : [i === 0 ? -1 : 1, 0, 0];
        const ends = [-1, 1].map((s) => middle.map((v, j) => v + s * normal[j] * 0.28));
        member(out, ...ends, 0.54, 0.49, 'shadow');
      }
      if (d >= 2 || (d === 1 && k % 2 === 0))
        member(out, a, b, low < 5 ? 0.39 : 0.3, low < 5 ? 0.44 : 0.33, 'shadow');
    }
  }
}
function envelope(out, outline, low, high, d) {
  // Use the radial plan for both the opaque bands and recessed glazing faces.
  for (let j = 0; j < outline.length; j++) {
    const a = outline[j],
      b = outline[(j + 1) % outline.length];
    const p = (t, y, d = 0) => [mix(a[0], b[0], t) * (1 + d), y, mix(a[1], b[1], t) * (1 + d)];
    const paint = (t, u, y, h, mat, color, offset = 0) =>
      panel(out, mat, color, [p(t, y, offset), p(u, y, offset), p(u, h, offset), p(t, h, offset)]);
    paint(0, 1, low, high, 'plaster', 'cream');
    const y = low + 0.72,
      head = high - 0.61;
    const count = d === 0 ? 1 : d === 1 ? 2 : 3;
    for (let k = 0; k < count; k++) {
      const x = (k + 0.12) / count,
        w = (k + 0.89) / count;
      paint(x, w, y, head, 'glazing', (j + k) % 3 ? 'glass' : 'glassLight', 0.004);
      if (d >= 2) {
        paint(x, w, y - 0.05, y + 0.077, 'steel', 'frame', 0.01);
        paint(x, w, head - 0.054, head + 0.05, 'steel', 'frame', 0.009);
        if (d >= 3)
          paint((x + w) / 2 - 0.011, (x + w) / 2 + 0.011, y, head, 'steel', 'frame', 0.009);
      }
    }
  }
}
function decks(out, d) {
  const count = d === 0 ? 8 : d === 1 ? 8 : 16;
  const deckOutline = (width) => shape(0, 0, 0, width, width, 0.8).map(([x, , z]) => [x, z]);
  for (const [y, w] of [
    [70, 19],
    [140, 12.9],
  ]) {
    const outline = deckOutline(w);
    floor(out, 'steel', 'shadow', [y - 0.78, y - 0.13], outline);
    floor(out, 'paving', 'slab', [y - 0.13, y], outline);
    guard(out, inset(outline, 0.982), y, d);
    if (d >= 1) {
      for (const z of [-w * 0.375, 0, w * 0.375])
        member(out, [-w * 0.437, y - 0.9, z], [w * 0.437, y - 0.9, z], 0.24, 0.49);
      for (const axis of [-1, 1])
        member(
          out,
          [axis * w * 0.29, y - 2.8, -axis * w * 0.29],
          [axis * w * 0.45, y - 0.64, -axis * w * 0.45],
          0.33,
          0.33,
        );
    }
  }
  const n = d === 0 ? 8 : 16,
    star = radialRing(0, 7.95, 7.95, n, [0, 0], Math.PI / 4).map(([x, , z], j) =>
      [x, z].map((v) => v * (j % 2 ? 0.77 : 1)),
    );
  envelope(out, star, 70.25, 74.55, d);
  // The star footprint is concave. Its roof is a radial fan, with each soffit in the same sector.
  const ring = (y, f) => inset(star, f).map(([x, z]) => [x, y, z]);
  const eaves = ring(74.64, 1.035),
    rim = ring(74.4, 1.035),
    hub = ring(75.58, 0.37);
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    panel(out, 'roof', 'roof', [eaves[j], eaves[k], hub[k], hub[j]]);
    panel(out, 'plaster', 'white', [rim[j], rim[k], eaves[k], eaves[j]]);
    const triangle = [hub[j], hub[k], [0, 75.58, 0]];
    out.addTriangle('roof', '', triangle, up, undefined, tone.roof);
    if (d >= 2) member(out, eaves[j], hub[j], 0.065, 0.06, 'edge');
  }
  const cabin = deckOutline(4.45).map(([x, z]) => [x - 2.02, z - 0.94]);
  envelope(out, cabin, 140.2, 143.55, d);
  floor(out, 'roof', 'roof', [143.53, 143.82], inset(cabin, 1.035));
  const conch = radialRing(0, 3.75, 3.55, count, [0.85, 0.92]).map(([x, , z]) => [x, z]);
  if (d === 0) {
    envelope(out, conch, 140.3, 143.28, d);
  } else {
    // Open outer walk around the small shelter inside the top pavilion.
    const wall = inset(conch, 0.71);
    envelope(out, wall, 140.25, 143.2, d);
    guard(out, conch, 140.17, d, 0.96);
  }
  floor(out, 'roof', 'roof', [143.22, 143.42], conch);
}
function lift(out, d) {
  const rails = [
    [-1.45, -0.9],
    [1.45, -0.9],
    [1.45, 1.55],
    [-1.45, 1.55],
  ];
  for (const [x, z] of rails)
    member(out, [x, 1.1, z], [x, 142.2, z], d === 0 ? 0.16 : 0.113, 0.17, 'shadow');
  if (d >= 2)
    for (let i = 0; i < 4; i++)
      for (let j = 2; j < 138; j += 4.5) {
        const [x, z] = rails[i],
          [x1, z1] = rails[(i + 1) % 4];
        member(out, [x, j, z], [x1, j, z1], 0.107, 0.13, 'edge');
      }
  for (const y of [1.02, 70.02, 140.07]) {
    const r = shape(y, 0, 0.28, 4.48, 3.8, 0.19).map(([x, , z]) => [x, z]);
    envelope(out, r, y, y + 3.02, d);
    floor(out, 'roof', 'roof', [y + 3.01, y + 3.18], r);
  }
}
function upperStair(out, d) {
  round(out, 'steel', 'shadow', 1.18, 0.36, d === 0 ? 6 : 12, [
    [143.39, 0.86],
    [153.7, 0.77],
  ]);
  const n = d === 0 ? 12 : d === 1 ? 20 : d === 2 ? 32 : 58;
  const point = (i, r, y) => [
    1.18 + Math.cos((i / n) * tau * 2.05) * r,
    y,
    0.36 + Math.sin((i / n) * tau * 2.05) * r,
  ];
  const rail = [];
  for (let i = 0; i < n; i++) {
    const y = mix(143.42, 153.44, i / n),
      next = point(i + 1, 2.15, y);
    const t = [point(i, 0.66, y), point(i, 2.15, y), next, point(i + 1, 0.66, y)].reverse();
    panel(out, 'steel', 'edge', t);
    if (d >= 2) {
      member(out, point(i, 2.154, y), point(i + 1, 2.154, y), 0.092, 0.132);
      if (d >= 3) member(out, point(i, 2.13, y), point(i, 2.13, y + 1), 0.045, 0.046);
    }
    rail.push(point(i, 2.13, y + 1));
  }
  rail.push(point(n, 2.13, 154.44));
  beamPath(out, 'steel', rail, 0.058, 0.065, tone.edge);
  round(out, 'steel', 'steel', 1.18, 0.36, d === 0 ? 8 : 16, [
    [153.38, 2.28],
    [153.65, 2.28],
  ]);
  guard(
    out,
    radialRing(0, 2.17, 2.17, d === 0 ? 6 : 12, [1.18, 0.36]).map(([x, , z]) => [x, z]),
    153.65,
    d,
    0.87,
  );
  // The aerial shows an intermediate trussed collar under a long thin top rod.
  const mast = [
    [-0.48, -0.48],
    [-0.48, 0.48],
    [0.48, 0.48],
    [0.48, -0.48],
  ];
  for (let i = 0; i < 4; i++) {
    const [x, z] = mast[i],
      [u, v] = mast[(i + 1) % 4];
    member(
      out,
      [1.18 + x, 153.7, 0.36 + z],
      [1.18 + x * 0.57, 166.0, 0.36 + z * 0.57],
      0.115,
      0.125,
    );
    if (d >= 1)
      for (let k = 0; k < 6; k++) {
        const q = k / 6,
          s = (k + 1) / 6;
        member(
          out,
          [1.18 + x * mix(1, 0.57, q), mix(153.7, 166, q), 0.36 + z * mix(1, 0.57, q)],
          [1.18 + u * mix(1, 0.57, s), mix(153.7, 166, s), 0.36 + v * mix(1, 0.57, s)],
          0.085,
          0.093,
          'edge',
        );
      }
  }
  round(out, 'steel', 'steel', 1.18, 0.36, d === 0 ? 4 : 9, [
    [165.8, 0.195],
    [170.65, 0.135],
    [177, 0.058],
  ]);
}
function ground(out, d) {
  const footing = shape(0, 0, 0, 25, 25, 0.48).map(([x, , z]) => [x, z]);
  floor(out, 'paving', 'slab', [-1.3, 0.58], footing);
  floor(out, 'paving', 'step', [0.56, 0.7], inset(footing, 0.968));
  for (const x of [-8.3, 8.3])
    for (const z of [-8.3, 8.3]) {
      const paving = shape(0, x, z, 3.38, 3.38, 0.27).map(([p, , q]) => [p, q]);
      floor(out, 'paving', 'step', [0.7, 1.51], paving);
      round(out, 'steel', 'shadow', x, z, d === 0 ? 6 : 12, [
        [1.5, 1.12],
        [1.69, 1.12],
        [1.76, 0.79],
      ]);
      if (d >= 2)
        for (const a of [-0.83, 0.83])
          for (const b of [-0.83, 0.83]) {
            round(out, 'steel', 'edge', x + a, z + b, 6, [
              [1.51, 0.127],
              [1.64, 0.127],
            ]);
          }
    }
  for (let i = 0; i < 4; i++) {
    box(
      out,
      'paving',
      [-2.62, -0.04 + i * 0.13, 13.99 - i * 0.45],
      [2.62, 0.25 + i * 0.13, 14.5 - i * 0.45],
      tone.step,
    );
  }
  const y = layout.apronY,
    outline = layout.apron.toReversed();
  floor(out, 'paving', 'slab', [-0.85, y], outline);
  floor(out, 'paving', 'terrace', [y - 0.07, y + 0.1], outline);
  // The pavilion is a low, open-sided southwest terrace with a curved rear canopy.
  const path = [
    [-35.5, 42.6],
    [-31.3, 40.93],
    [-27.3, 39.18],
    [-22.9, 37.9],
    [-20.3, 40.7],
  ];
  beamPath(
    out,
    'roof',
    path.map(([x, z]) => [x, y + 3.4, z]),
    0.48,
    0.26,
    tone.roof,
  );
  const rear = [
    ...path.slice(0, -1),
    [-21, 40.4],
    [-24.9, 46.4],
    [-29.5, 48.4],
    [-35.1, 46.9],
  ].toReversed();
  floor(out, 'roof', 'roof', [y + 3.24, y + 3.43], rear);
  for (const [x, z] of [
    [-35.25, 43.7],
    [-32.7, 43.3],
    [-30.0, 42.5],
    [-26.7, 41.35],
    [-23.78, 40.35],
  ]) {
    member(out, [x, y + 0.09, z], [x, y + 3.27, z], 0.15, 0.155, 'shadow');
  }
  if (d < 2) return;
  for (const [x, z] of [
    [-32, 47],
    [-27, 48],
    [-22.5, 46.25],
    [-32, 52],
    [-27, 52.5],
    [-22.5, 51],
    [-31, 56.6],
    [-26, 56.8],
    [-34.3, 57.6],
  ]) {
    round(out, 'paving', 'white', x, z, d >= 3 ? 12 : 6, [
      [y + 0.82, 0.73],
      [y + 0.93, 0.73],
    ]);
    member(out, [x, y + 0.1, z], [x, y + 0.82, z], 0.12, 0.12, 'shadow');
    for (const s of [-1, 1]) {
      box(
        out,
        'plaster',
        [x + s * 1.04 - 0.21, y + 0.43, z - 0.31],
        [x + s * 1.04 + 0.21, y + 0.52, z + 0.31],
        tone.wood,
      );
      if (d >= 3) member(out, [x + s * 1.3, y + 0.1, z], [x + s * 1.3, y + 0.88, z], 0.091, 0.082);
    }
  }
}
function build(out, d) {
  ground(out, d);
  frame(out, d, 1.73, 69.21, layout.dimensions.baseColumns, 5, 0.71);
  frame(out, d, 69.65, 139.28, layout.dimensions.upperColumns, 6, 0.45);
  lift(out, d);
  decks(out, d);
  upperStair(out, d);
}
export function buildSkyline(out) {
  const rectangle = (width, x = 0, z = 0) => {
    const r = width / 2;
    return [
      [x - r, z - r],
      [x - r, z + r],
      [x + r, z + r],
      [x + r, z - r],
    ];
  };
  floor(out, 'paving', 'step', [-1.3, 0.7], rectangle(25));
  for (const x of [-8.3, 8.3])
    for (const z of [-8.3, 8.3]) floor(out, 'paving', 'slab', [0.69, 1.74], rectangle(3.38, x, z));
  floor(out, 'paving', 'terrace', [-0.85, layout.apronY + 0.1], layout.apron.toReversed());
  const canopy = [
    [-35.5, 42.6],
    [-35.1, 46.9],
    [-26, 47],
    [-22.9, 37.9],
  ];
  floor(out, 'roof', 'roof', [layout.apronY + 3.24, layout.apronY + 3.43], canopy);
  for (const [x, z] of canopy)
    member(out, [x, layout.apronY + 0.1, z], [x, layout.apronY + 3.25, z], 0.14, 0.14);
  frame(out, 0, 1.73, 69.21, layout.dimensions.baseColumns, 5, 0.71);
  frame(out, 0, 69.65, 139.28, layout.dimensions.upperColumns, 6, 0.45);
  for (const x of [-1.45, 1.45]) member(out, [x, 0.69, 0], [x, 140, 0], 0.24, 0.24, 'shadow');
  for (const [y, w] of [
    [70, 19],
    [140, 12.9],
  ])
    floor(out, 'steel', 'edge', [y - 0.79, y], rectangle(w));
  const star = radialRing(0, 7.95, 7.95, 8, [0, 0], Math.PI / 4).map(([x, , z], j) =>
    [x, z].map((v) => v * (j % 2 ? 0.77 : 1)),
  );
  envelope(out, star, 70.25, 74.55, 0);
  for (let j = 0; j < star.length; j++) {
    const a = star[j],
      b = star[(j + 1) % star.length];
    out.addTriangle(
      'roof',
      '',
      [
        [a[0], 74.56, a[1]],
        [b[0], 74.56, b[1]],
        [0, 75.58, 0],
      ],
      up,
      undefined,
      tone.roof,
    );
  }
  envelope(out, rectangle(4.45, -2.02, -0.94), 140.2, 143.55, 0);
  floor(out, 'roof', 'roof', [143.52, 143.82], rectangle(4.49, -2.02, -0.94));
  round(out, 'steel', 'shadow', 1.18, 0.36, 6, [
    [141, 0.87],
    [153.71, 0.78],
  ]);
  round(out, 'steel', 'edge', 1.18, 0.36, 6, [
    [153.4, 2.27],
    [153.67, 2.27],
  ]);
  const stair = Array.from({ length: 13 }, (_, i) => {
    const angle = (i / 12) * tau * 2.05;
    return [1.18 + 2.1 * Math.cos(angle), mix(143.4, 153.5, i / 12), 0.36 + 2.1 * Math.sin(angle)];
  });
  for (let i = 0; i < 12; i++) {
    const [a, b] = stair.slice(i, i + 2);
    const face = [a, b, elevate(b, b[1] + 0.19), elevate(a, a[1] + 0.19)];
    panel(out, 'steel', 'steel', face);
    panel(out, 'steel', 'steel', face.toReversed());
  }
  round(out, 'steel', 'steel', 1.18, 0.36, 4, [
    [153.67, 0.37],
    [166, 0.205],
    [177, 0.058],
  ]);
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
export function buildTowerLevel(out, level) {
  if (level === 'skyline') buildSkyline(out);
  else build(out, levels[level]);
}
