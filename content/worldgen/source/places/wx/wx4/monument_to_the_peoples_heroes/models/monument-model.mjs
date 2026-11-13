import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const inscription = JSON.parse(
  readFileSync(new URL('./inscription-geometry.json', import.meta.url)),
);
export const monumentSurfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.85 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.81 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.89 },
  gilt: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.49, metallic: 0.47 },
};

const palette = {
  granite: 'b8afa4',
  shade: 'a19789',
  light: 'c9c1b4',
  seam: '978e83',
  marble: 'ddd4c0',
  carvings: 'd4cbba',
  pearl: 'e5ddcc',
  shadow: 'b8aa94',
  paving: 'a09b8e',
  gold: 'af872b',
  muted: '9e854c',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [
    name,
    hex.match(/../g).map((pair) => {
      const x = Number.parseInt(pair, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const detailByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff';
const up = [0, 1, 0];
const at = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const center = (ring) => ring[0].map((_, i) => ring.reduce((s, p) => s + p[i], 0) / ring.length);
const edgeLength = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const scaled = (ring, scale) => {
  const p = center(ring);
  return ring.map((q) => mix(p, q, scale));
};
function face(out, slot, tint, points, towards) {
  let n = normalFor(...points);
  if (n.reduce((s, x, i) => s + x * towards[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, colors[tint]);
  else out.addQuad(slot, ref, points, n, undefined, colors[tint]);
}
function slab(out, slot, tint, { outline, triangles }, bottom, top) {
  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length];
    face(
      out,
      slot,
      tint,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [a[1] - b[1], 0, b[0] - a[0]],
    );
  }
  for (const tri of triangles)
    face(
      out,
      slot,
      tint,
      tri.map((i) => at(outline[i], top)),
      up,
    );
}
function mold(out, slot, tint, ring, rows) {
  loft(
    out,
    slot,
    rows.map(([y, s]) => scaled(ring, s).map((p) => at(p, y))),
    colors[tint],
  );
}
function field(a, b) {
  const tangent = b.map((v, i) => (v - a[i]) / edgeLength(a, b));
  const outward = [-tangent[1], 0, tangent[0]];
  return {
    n: outward,
    width: edgeLength(a, b),
    point: (u, y, d = 0) => [
      a[0] + u * tangent[0] + d * outward[0],
      y,
      a[1] + u * tangent[1] + d * outward[2],
    ],
  };
}
function panel(out, f, slot, tint, u0, u1, y0, y1, d = 0) {
  const p = f.point;
  face(out, slot, tint, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], f.n);
}
function bar(out, f, slot, tint, a, b, width, depth, offset = 0) {
  beam(out, slot, f.point(...a, offset), f.point(...b, offset), width, depth, colors[tint]);
}
function prism(out, f, slot, tint, u0, u1, y0, y1, depth, offset = 0) {
  const p = f.point;
  loft(
    out,
    slot,
    [y0, y1].map((y) => [
      p(u0, y, offset - depth / 2),
      p(u0, y, offset + depth / 2),
      p(u1, y, offset + depth / 2),
      p(u1, y, offset - depth / 2),
    ]),
    colors[tint],
  );
}

function plaza(out, detail) {
  const { inner, panels } = layout.apron;
  face(
    out,
    'paving',
    'paving',
    inner.map((p) => at(p, 0.04)),
    up,
  );
  const stride = detail === 0 ? 5 : detail === 1 ? 2 : 1;
  let i = 0;
  while (i < panels.length) {
    const a = panels[i];
    let j = i;
    while (
      j + 1 < panels.length &&
      j - i + 1 < stride &&
      (a.seam[0][0] === a.seam[1][0]
        ? panels[j + 1].seam[1][0] === a.seam[0][0]
        : panels[j + 1].seam[1][1] === a.seam[0][1])
    )
      j++;
    const b = panels[j];
    const strips = [
      [
        at(a.level[0], 0.04),
        at(b.level[1], 0.04),
        at(b.seam[1], b.seamY[1]),
        at(a.seam[0], a.seamY[0]),
      ],
      [
        at(a.seam[0], a.seamY[0]),
        at(b.seam[1], b.seamY[1]),
        at(b.edge[1], b.edgeY[1]),
        at(a.edge[0], a.edgeY[0]),
      ],
    ];
    for (const [p, q, r, s] of strips) {
      face(out, 'paving', 'paving', [p, q, r], up);
      face(out, 'paving', 'paving', [p, r, s], up);
    }
    i = j + 1;
  }
}
function stair(out, s, detail) {
  const { outer, inner, low, height, steps } = s;
  const count = detail === 0 ? 1 : detail === 1 ? 5 : steps;
  const forward = [inner[0][0] - outer[0][0], 0, inner[0][1] - outer[0][1]];
  const across = [outer[1][0] - outer[0][0], 0, outer[1][1] - outer[0][1]];
  if (detail === 0) {
    const [a, b] = outer,
      [c, d] = inner;
    face(out, 'granite', 'light', [at(a, low), at(b, low), at(d, height), at(c, height)], up);
    for (const [p, q, sign] of [
      [a, c, -1],
      [b, d, 1],
    ])
      face(
        out,
        'granite',
        'shade',
        [at(p, low), at(q, height), at(q, low)],
        across.map((x) => sign * x),
      );
    return;
  }
  for (let i = 0; i < count; i++) {
    const u = i / count,
      v = (i + 1) / count;
    const [a, b] = outer.map((p, k) => mix(p, inner[k], u));
    const [c, e] = outer.map((p, k) => mix(p, inner[k], v));
    const y = low + (height - low) * v,
      previous = low + (height - low) * u;
    face(
      out,
      'granite',
      i % 3 === 0 ? 'light' : 'granite',
      [at(a, y), at(b, y), at(e, y), at(c, y)],
      up,
    );
    face(
      out,
      'granite',
      'shade',
      [at(a, previous), at(b, previous), at(b, y), at(a, y)],
      forward.map((x) => -x),
    );
    for (const [p, q, sign] of [
      [a, c, -1],
      [b, e, 1],
    ])
      face(
        out,
        'granite',
        'shade',
        [at(p, low - 0.08), at(q, low - 0.08), at(q, y), at(p, y)],
        across.map((x) => sign * x),
      );
  }
  for (let i = 0; i < 2; i++) {
    const f = field(mix(outer[i], outer[1 - i], 0.022), mix(inner[i], inner[1 - i], 0.022));
    handrail(out, f, low, height, detail, true);
  }
}
function handrail(out, f, low, high, detail, sloped = false) {
  const { width: w } = f;
  const count = Math.max(1, Math.round(w / (detail === 1 ? 4.8 : 2.05)));
  const y = (u) => low + (high - low) * (u / w);
  if (detail === 1) {
    bar(out, f, 'marble', 'marble', [0, low + 0.77], [w, high + 0.77], 0.14, 0.22);
    for (let i = 0; i <= count; i++) {
      const u = (w * i) / count;
      prism(out, f, 'marble', 'pearl', u - 0.095, u + 0.095, y(u), y(u) + 0.95, 0.25);
    }
    return;
  }
  for (let i = 0; i <= count; i++) {
    const u = (w * i) / count,
      base = y(u);
    prism(out, f, 'marble', 'marble', u - 0.13, u + 0.13, base - 0.025, base + 1.09, 0.28);
    prism(out, f, 'marble', 'pearl', u - 0.17, u + 0.17, base + 0.88, base + 1.01, 0.34);
    if (detail >= 3)
      prism(out, f, 'marble', 'pearl', u - 0.107, u + 0.107, base + 1.09, base + 1.18, 0.24);
    if (i === count) continue;
    const a = u + 0.095,
      b = (w * (i + 1)) / count - 0.095;
    if (b - a < 0.25) continue;
    bar(out, f, 'marble', 'marble', [a, y(a) + 0.29], [b, y(b) + 0.29], 0.22, 0.18);
    bar(out, f, 'marble', 'pearl', [a, y(a) + 0.79], [b, y(b) + 0.79], 0.115, 0.21);
    if (sloped || detail === 2) {
      const m = (a + b) / 2;
      bar(out, f, 'marble', 'marble', [m, y(m) + 0.32], [m, y(m) + 0.78], 0.12, 0.17);
    } else {
      for (const u of [mix([a], [b], 0.27)[0], (a + b) / 2, mix([a], [b], 0.73)[0]]) {
        prism(out, f, 'marble', 'marble', u - 0.07, u + 0.07, y(u) + 0.35, y(u) + 0.74, 0.16);
        prism(out, f, 'marble', 'pearl', u - 0.115, u + 0.115, y(u) + 0.43, y(u) + 0.52, 0.18);
      }
    }
  }
}

function reliefFigure(out, f, u, y, scale, index, detail) {
  const tilt = [-0.19, 0.13, 0.24, -0.22, 0.04][index % 5] * scale;
  const depth = 0.1 + (index % 3) * 0.027,
    torso = 0.27 * scale;
  const p = f.point;
  const robe = [
    p(u - torso * 0.68, y, depth),
    p(u + torso * 0.82, y, depth),
    p(u + tilt + torso, y + scale * 0.69, depth + 0.04),
    p(u + tilt - torso, y + scale * 0.69, depth + 0.04),
  ];
  face(out, 'marble', index % 3 === 0 ? 'carvings' : 'pearl', robe, f.n);
  if (detail >= 3) {
    face(
      out,
      'marble',
      'carvings',
      [robe[0], p(u, y, depth + 0.045), p(u + tilt * 0.3, y + scale * 0.5, depth + 0.1)],
      f.n,
    );
    face(
      out,
      'marble',
      'marble',
      [p(u, y, depth + 0.045), robe[1], p(u + tilt * 0.3, y + scale * 0.5, depth + 0.1)],
      f.n,
    );
  }
  sphere(
    out,
    'marble',
    p(u + tilt, y + scale * 0.84, depth + 0.04),
    [scale * 0.103, scale * 0.14, scale * 0.103],
    colors.pearl,
    detail >= 4 ? 8 : 6,
    detail >= 4 ? 5 : 3,
  );
  const side = index % 2 === 0 ? 1 : -1;
  bar(
    out,
    f,
    'marble',
    'marble',
    [u + tilt, y + scale * 0.6],
    [u + tilt + side * 0.42 * scale, y + scale * (index % 4 === 0 ? 0.87 : 0.36)],
    0.1 * scale,
    0.09 * scale,
    depth + 0.04,
  );
  if (detail >= 3 && index % 5 === 1) {
    bar(
      out,
      f,
      'marble',
      'carvings',
      [u + side * 0.22, y + 0.08],
      [u + side * 0.54, y + scale * 1.04],
      0.061,
      0.076,
      depth + 0.13,
    );
    panel(
      out,
      f,
      'marble',
      'marble',
      u + side * 0.54 - 0.17,
      u + side * 0.54 + 0.17,
      y + scale * 0.88,
      y + scale * 1.1,
      depth + 0.14,
    );
  }
}
function reliefs(out, detail, ring) {
  for (const [i, a] of ring.entries()) {
    const f = field(a, ring[(i + 1) % ring.length]),
      cells = i % 2 === 0 ? 2 : 3;
    for (let j = 0; j < cells; j++) {
      const a = (f.width * j) / cells + 0.19,
        b = (f.width * (j + 1)) / cells - 0.19,
        w = b - a;
      panel(out, f, 'marble', 'shadow', a, b, 4.82, 8.42, 0.027);
      panel(out, f, 'marble', 'carvings', a + 0.12, b - 0.12, 5.02, 8.23, 0.046);
      if (detail < 2) continue;
      const horizon = 6.28 + 0.26 * ((i + j) % 3);
      face(
        out,
        'marble',
        'marble',
        [
          f.point(a + 0.18, horizon - 0.2, 0.058),
          f.point(b - 0.18, horizon - 0.38, 0.058),
          f.point(b - 0.18, horizon + 0.21, 0.058),
          f.point(a + w * 0.43, horizon + 0.58, 0.058),
        ],
        f.n,
      );
      const count = detail === 2 ? 5 : detail === 3 ? 9 : 13;
      for (let k = 0; k < count; k++) {
        const u = a + 0.42 + ((w - 0.84) * (k + 0.44 + (k % 3) * 0.17)) / count;
        const y = 5.17 + ((k + i + j) % 4) * 0.25;
        reliefFigure(out, f, u, y, 1.2 + ((k * 7 + i * 3 + j) % 9) * 0.1, k + i * 5 + j, detail);
      }
      if (detail >= 3) {
        for (const y of [5.02, 8.23])
          bar(out, f, 'marble', 'pearl', [a + 0.08, y], [b - 0.08, y], 0.09, 0.11, 0.12);
        for (const u of [a + 0.08, b - 0.08])
          bar(out, f, 'marble', 'pearl', [u, 5.02], [u, 8.23], 0.09, 0.11, 0.12);
      }
    }
  }
}
function glyphColumn(out, f, text, u, y, cell, advance, resolution, tint, depth) {
  const source = inscription.glyphs[resolution];
  const s = cell / resolution;
  for (const [i, char] of Array.from(text).entries()) {
    const top = y - advance * i;
    for (const [a, b, c, d] of source[char])
      panel(
        out,
        f,
        'gilt',
        tint,
        u - cell / 2 + a * s,
        u - cell / 2 + c * s,
        top - d * s,
        top - b * s,
        depth,
      );
  }
}
function inscriptions(out, detail, ring) {
  if (detail === 0) return;
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % 4],
      f = field(a, b);
    if (Math.abs(f.n[0]) < 0.8) continue;
    const north = f.n[0] < 0,
      mid = f.width / 2;
    panel(out, f, 'granite', 'light', 0.47, f.width - 0.47, 15.37, 33.88, 0.042);
    if (north) {
      glyphColumn(
        out,
        f,
        inscription.front,
        mid + 0.19,
        32.35,
        1.49,
        1.98,
        detail >= 3 ? 40 : 16,
        'gold',
        0.059,
      );
      if (detail >= 2)
        glyphColumn(
          out,
          f,
          inscription.frontCredit,
          mid - 1.41,
          21.87,
          0.4,
          0.51,
          16,
          'muted',
          0.059,
        );
    } else if (detail >= 2) {
      const columns = inscription.rearColumns,
        space = 0.63;
      glyphColumn(out, f, inscription.rearTitle, mid + 2.19, 32.68, 0.63, 0.88, 24, 'muted', 0.059);
      for (const [j, line] of columns.entries()) {
        const u = mid + 1.36 - j * space;
        if (detail >= 3)
          glyphColumn(out, f, line, u, 32.63, 0.47, 0.645, detail >= 4 ? 24 : 16, 'muted', 0.059);
        else
          for (let k = 0; k < line.length; k++)
            panel(
              out,
              f,
              'gilt',
              'muted',
              u - 0.13,
              u + 0.1,
              32.55 - k * 0.645,
              32.76 - k * 0.645,
              0.059,
            );
      }
    }
  }
}
function floralBand(out, detail, ring) {
  if (detail === 0) return;
  for (const [i, a] of ring.entries()) {
    const f = field(a, ring[(i + 1) % ring.length]);
    const count = Math.round(f.width / (detail === 1 ? 0.71 : 0.38));
    for (let j = 0; j < count; j++) {
      const u = (f.width * (j + 0.5)) / count;
      const p = f.point;
      face(
        out,
        'marble',
        'light',
        [
          p(u - 0.16, 34.96, 0.025),
          p(u, 34.74, 0.075),
          p(u + 0.17, 35.15, 0.1),
          p(u + 0.07, 36.05, 0.06),
        ],
        f.n,
      );
      if (detail >= 3)
        bar(out, f, 'marble', 'carvings', [u, 35.03], [u + 0.1, 35.85], 0.075, 0.071, 0.09);
    }
  }
}
function wreaths(out, detail, ring) {
  if (detail < 2) return;
  for (const [i, a] of ring.entries()) {
    const f = field(a, ring[(i + 1) % 4]);
    if (Math.abs(f.n[0]) > 0.8) continue;
    const u = f.width / 2,
      y = 30.82,
      p = f.point,
      count = detail >= 3 ? 19 : 11;
    for (const sign of [-1, 1]) {
      for (let k = 0; k < count; k++) {
        const t = k / (count - 1),
          x = u + sign * (0.16 + Math.sin(t * 2.28) * 1.31),
          h = y - 1.03 + 2.35 * t;
        const [width, rise] = [0.17 + 0.08 * t, 0.25 + 0.11 * t];
        face(
          out,
          'marble',
          k % 2 === 0 ? 'carvings' : 'shadow',
          [
            p(x - sign * width, h - rise, 0.055),
            p(x + sign * width, h - 0.08, 0.13),
            p(x + sign * 0.13, h + rise, 0.07),
            p(x - sign * width * 0.8, h + 0.08, 0.083),
          ],
          f.n,
        );
      }
      bar(
        out,
        f,
        'marble',
        'carvings',
        [u, y - 0.94],
        [u + sign * 0.6, y - 1.35],
        0.115,
        0.11,
        0.054,
      );
    }
    if (detail >= 3)
      for (let j = 0; j < 6; j++) {
        const u0 = u - 0.48 + j * 0.19;
        bar(out, f, 'marble', 'marble', [u0, y - 0.28], [u0 + 0.12, y + 0.62], 0.1, 0.08, 0.048);
      }
  }
}
export function buildMonumentLevel(out, level) {
  const detail = detailByLevel[level];
  const { forms, stairs, rails } = layout;
  plaza(out, detail);
  slab(out, 'granite', 'shade', forms.outerDeck, 0.025, 1.82);
  slab(out, 'granite', 'light', forms.outerDeck, 1.82, 2);
  slab(out, 'granite', 'shade', forms.innerDeck, 1.99, 3.8);
  slab(out, 'granite', 'light', forms.innerDeck, 3.8, 4);
  for (const s of stairs) stair(out, s, detail);
  if (detail >= 1)
    for (const { height, runs } of rails)
      for (const [a, b] of runs) handrail(out, field(a, b), height, height, detail);
  const relief = forms.reliefs.outline,
    plinth = forms.plinth.outline,
    shaft = forms.shaft.outline;
  mold(out, 'granite', 'granite', relief, [
    [4, 1.02],
    [4.52, 1.02],
    [4.8, 0.978],
    [8.42, 0.978],
    [8.51, 1.018],
    [9, 1.018],
  ]);
  if (detail >= 1) reliefs(out, detail, scaled(relief, 0.978));
  mold(out, 'granite', 'granite', plinth, [
    [9, 1.27],
    [9.25, 1.27],
    [9.69, 1.06],
    [10.04, 1.04],
    [11.36, 1.04],
    [11.51, 1.13],
    [12, 1.13],
  ]);
  if (detail >= 3) {
    for (const [i, a] of scaled(plinth, 1.04).entries()) {
      const ring = scaled(plinth, 1.04),
        f = field(a, ring[(i + 1) % 4]),
        n = Math.round(f.width / 0.45);
      for (let j = 0; j < n; j++) {
        const u = (f.width * (j + 0.5)) / n;
        face(
          out,
          'marble',
          'carvings',
          [
            f.point(u - 0.15, 10.22, 0.02),
            f.point(u, 10.1, 0.07),
            f.point(u + 0.19, 10.71, 0.075),
            f.point(u - 0.04, 10.94, 0.02),
          ],
          f.n,
        );
      }
    }
  }
  const narrow = scaled(shaft, 0.916);
  // Keep one planar field over the taper so the gold characters sit on the stone.
  const lower = scaled(shaft, 1.028);
  const section = (y) => lower.map((p, i) => mix(p, narrow[i], (y - 12) / 22.65));
  loft(
    out,
    'granite',
    [lower.map((p) => at(p, 12)), narrow.map((p) => at(p, 34.65))],
    colors.granite,
  );
  if (detail >= 1) {
    const c = center(shaft);
    const shell = {
      addQuad(slot, material, points, normal, uv, color) {
        const adjusted = points.map(([x, y, z]) => {
          const t = (y - 23) / 22.65;
          return [x - (x - c[0]) * 0.112 * t, y, z - (z - c[1]) * 0.112 * t];
        });
        out.addQuad(slot, material, adjusted, normalFor(...adjusted), uv, color);
      },
    };
    inscriptions(shell, detail, section(23));
    wreaths(out, detail, section(30.75));
  }
  mold(out, 'granite', 'granite', narrow, [
    [34.64, 1],
    [34.78, 1.025],
    [35.92, 1.03],
    [36.16, 1.06],
    [36.44, 1.14],
    [36.73, 1.15],
    [36.95, 1.29],
    [37.56, 1.29],
    [37.7, 1.17],
    [37.79, 1.17],
  ]);
  floralBand(out, detail, scaled(narrow, 1.04));
  mold(out, 'granite', 'light', narrow, [
    [37.785, 0.94],
    [37.94, 0.9],
  ]);
  if (detail >= 2) {
    const cap = scaled(narrow, 1.16);
    for (const [i, a] of cap.entries()) {
      const f = field(a, cap[(i + 1) % 4]);
      for (let j = 0; j < 7; j++) {
        const u = (f.width * (j + 0.5)) / 7;
        prism(out, f, 'granite', 'shade', u - 0.023, u + 0.023, 37.01, 37.47, 0.024, 0.24);
      }
    }
  }
}
export const buildMonumentSkyline = (out) => buildMonumentLevel(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonumentLevel(out, 'district');
export const buildMonumentStreet = (out) => buildMonumentLevel(out, 'street');
export const buildMonumentCloseup = (out) => buildMonumentLevel(out, 'closeup');
