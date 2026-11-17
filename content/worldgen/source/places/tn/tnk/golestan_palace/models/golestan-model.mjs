/** The eight palace ensembles and garden of Golestan before the March 2026 damage. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.87 },
  limestone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.78 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.8 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.56 },
  tile: { slot: 'trim', graph: 'tile_glazed', roughness: 0.56 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.68 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.68 },
  mirror: { slot: 'trim', graph: 'metal_stainless_polished', roughness: 0.33 },
};
const paint = {
  sand: [0.61, 0.429, 0.244],
  cream: [0.82, 0.733, 0.564],
  stone: [0.62, 0.586, 0.493],
  white: [0.83, 0.826, 0.761],
  amber: [0.73, 0.466, 0.136],
  ochre: [0.657, 0.397, 0.14],
  yellow: [0.78, 0.582, 0.159],
  indigo: [0.143, 0.261, 0.43],
  turquoise: [0.125, 0.533, 0.501],
  teal: [0.117, 0.344, 0.306],
  red: [0.6, 0.251, 0.211],
  sage: [0.458, 0.533, 0.273],
  silver: [0.63, 0.69, 0.675],
  glass: [0.191, 0.217, 0.193],
  dark: [0.15, 0.103, 0.067],
  wood: [0.32, 0.186, 0.104],
  roof: [0.43, 0.388, 0.306],
  plum: [0.392, 0.25, 0.23],
  lawn: [0.38, 0.47, 0.245],
};
const tint = (name, f = 1) => paint[name].map((v) => v * f);
const up = [0, 1, 0];
const phase = (n) => ((n * 101 + 141) % 157) / 157;
function axes([cx, cy, cz], [fx, fz]) {
  const len = Math.hypot(fx, fz);
  fx /= len;
  fz /= len;
  return (x, y, z) => [cx + fz * x + fx * z, cy + y, cz - fx * x + fz * z];
}
function photoFrame(b) {
  const origin = b.footprint.reduce(
    (sum, p) => sum.map((v, i) => v + p[i] / b.footprint.length),
    [0, 0],
  );
  const [fx, fz] = b.facade.front;
  const outline = b.footprint.map(([x, z]) => [
    (x - origin[0]) * fz - (z - origin[1]) * fx,
    (x - origin[0]) * fx + (z - origin[1]) * fz,
  ]);
  const front = Math.max(...outline.map((p) => p[1]));
  const convert = axes([origin[0], b.grade, origin[1]], [fx, fz]);
  function frontAt(x) {
    const intersections = outline.flatMap(([u, v], i) => {
      const [a, c] = outline[(i + 1) % outline.length];
      return x >= Math.min(u, a) && x <= Math.max(u, a) && Math.abs(a - u) > 1e-5
        ? [v + ((c - v) * (x - u)) / (a - u)]
        : [];
    });
    return intersections.length ? Math.max(...intersections) : front;
  }
  const P = (x, y, z) => convert(x, y, front + z);
  const bay = (u) => {
    const f = frontAt(u);
    return (x, y, z) => convert(x, y, f + z);
  };
  return { P, bay, n: [fx, 0, fz] };
}
function face(out, slot, p, c, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    normal = normal.map((v) => -v);
  }
  if (p.length === 3) out.addTriangle(slot, '', p, normal, undefined, c);
  else out.addQuad(slot, '', p, normal, undefined, c);
}
function polygon(out, slot, points, convert, color, normal, holes = []) {
  const all = [...points, ...holes.flat()];
  const offsets = holes.map(
    (_, i) => points.length + holes.slice(0, i).reduce((sum, r) => sum + r.length, 0),
  );
  const triangles = earcut(all.flat(), offsets, 2);
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((j) => convert(...all[j])),
      color,
      normal,
    );
}
function rect(out, slot, P, x0, y0, x1, y1, z, color, n) {
  face(out, slot, [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], color, n);
}
function block(out, slot, P, x, y, z, w, h, d, color, chamfer = 0.08) {
  const ring = (e) =>
    (chamfer
      ? chamferedRectangle(x, e, z, w, d, chamfer)
      : [
          [x - w / 2, e, z - d / 2],
          [x - w / 2, e, z + d / 2],
          [x + w / 2, e, z + d / 2],
          [x + w / 2, e, z - d / 2],
        ]
    ).map(([a, b, c]) => P(a, b, c));
  loft(out, slot, [ring(y), ring(y + h)], color);
}
function skirting(out, slot, b, y, color) {
  for (let j = 0; j < b.footprint.length; j++) {
    const a = b.footprint[j],
      c = b.footprint[(j + 1) % b.footprint.length];
    const dx = c[0] - a[0],
      dz = c[1] - a[1],
      d = Math.hypot(dx, dz);
    const O = [dx / d, dz / d];
    beam(
      out,
      slot,
      [a[0] - O[0] * 0.06, y, a[1] - O[1] * 0.06],
      [c[0] + O[0] * 0.06, y, c[1] + O[1] * 0.06],
      0.2,
      0.18,
      color,
    );
  }
}
function cap(out, slot, b, top, color) {
  polygon(out, slot, b.footprint, (x, z) => [x, top, z], color, up);
}
function shell(out, b, detail, slot = 'brick') {
  const top = b.grade + b.height,
    color = tint(slot === 'plaster' ? 'cream' : 'sand');
  const shape = b.footprint;
  const area = shape.reduce((sum, p, i) => {
    const n = shape[(i + 1) % shape.length];
    return sum + p[0] * n[1] - p[1] * n[0];
  }, 0);
  for (let i = 0; i < shape.length; i++) {
    const [x, z] = shape[i],
      [a, c] = shape[(i + 1) % shape.length];
    const n = [(c - z) * Math.sign(area), 0, (x - a) * Math.sign(area)];
    face(
      out,
      slot,
      [
        [x, b.foundation, z],
        [a, b.foundation, c],
        [a, top, c],
        [x, top, z],
      ],
      color,
      n,
    );
  }
  cap(out, 'roof', b, top, tint('roof'));
  if (detail > 0)
    for (const height of [0.7, b.height - 0.34])
      skirting(out, 'limestone', b, b.grade + height, tint('stone', height > 2 ? 1 : 0.94));
}

function archRing(w, h, segments) {
  const spring = h * 0.6;
  return [
    [-w, 0],
    [w, 0],
    [w, spring],
    ...Array.from({ length: segments }, (_, i) => {
      const angle = ((i + 1) * Math.PI) / segments;
      return [w * Math.cos(angle), spring + (h - spring) * Math.sin(angle)];
    }),
  ];
}
function framedArch(out, P, n, x, y, z, w, h, detail, wooden = true, pane = 'glass') {
  const inner = archRing(w, h, detail >= 3 ? 10 : detail === 2 ? 6 : 4);
  if (detail === 1) {
    polygon(out, 'wood', inner, (u, v) => P(x + u, y + v, z + 0.035), tint(pane), n);
    return;
  }
  const outer = archRing(w + 0.19, h + 0.29, detail >= 3 ? 10 : 6).map(([u, v]) => [u, v - 0.12]);
  polygon(out, 'limestone', outer, (u, v) => P(x + u, y + v, z + 0.02), tint('cream'), n, [inner]);
  polygon(out, 'wood', inner, (u, v) => P(x + u, y + v, z + 0.035), tint(pane), n);
  if (detail < 2 || !wooden) return;
  const crown = h * 0.6,
    color = tint('wood', 1.15),
    thick = detail >= 3 ? 0.054 : 0.071;
  const line = (u, v, a, b) =>
    beam(out, 'wood', P(x + u, y + v, z + 0.062), P(x + a, y + b, z + 0.062), thick, thick, color);
  line(0, 0.02, 0, h - 0.031);
  line(-w + 0.06, crown, w - 0.06, crown);
  if (detail >= 3) {
    for (const a of [-0.5, 0.5]) line(a * w, 0, a * w, crown + (h - crown) * 0.81);
    line(-w + 0.064, crown * 0.55, w - 0.064, crown * 0.55);
    for (const t of [0.32, 0.68]) {
      const u = Math.sin((t * Math.PI) / 2) * w * 0.9,
        v = crown + (h - crown) * Math.cos((t * Math.PI) / 2) * 0.9;
      line(0, crown, u, v);
      line(0, crown, -u, v);
    }
  }
}
function framedPanel(out, P, n, x, y, z, w, h, detail, shade, seed) {
  rect(out, 'mosaic', P, x - w, y, x + w, y + h, z, tint(shade, 0.91 + phase(seed) * 0.13), n);
  if (detail < 2) return;
  const diag = (X, Y, r, s, color) =>
    face(
      out,
      'tile',
      [
        P(X - r, Y, z + 0.017),
        P(X, Y - s, z + 0.017),
        P(X + r, Y, z + 0.017),
        P(X, Y + s, z + 0.017),
      ],
      tint(color),
      n,
    );
  const rows = detail >= 3 ? 3 : 1;
  for (let i = 0; i < rows; i++) {
    const v = y + (h * (i + 1)) / (rows + 1),
      r = Math.min(w * 0.5, h * 0.19),
      s = Math.min(h * 0.155, w * 0.54);
    diag(x, v, r, s, i % 2 ? 'amber' : 'indigo');
    if (detail >= 3) {
      const r2 = 0.44 * r,
        s2 = 0.46 * s;
      diag(x, v + 0.59 * s, r2, s2, 'turquoise');
      diag(x, v - 0.59 * s, r2, s2, 'turquoise');
    }
  }
}

function column(out, P, x, y, z, h, r, detail, twist = false) {
  const sides = detail >= 3 ? 10 : 6;
  const levels = detail >= 3 && twist ? 8 : 2;
  const profile = [
    [0, r * 1.48],
    [0.13, r * 1.48],
    [0.26, r],
    ...Array.from({ length: levels }, (_, i) => [
      ((h - 0.46) * (i + 1)) / levels,
      r * (1 - (0.105 * (i + 1)) / levels),
    ]),
    [h - 0.16, r * 1.32],
    [h, r * 1.4],
  ];
  loft(
    out,
    'limestone',
    profile.map(([a, b], i) =>
      radialRing(y + a, b, b, sides, [x, z], twist ? i * 0.26 : 0).map(([u, v, w]) => P(u, v, w)),
    ),
    tint('white'),
  );
}
function trim(out, P, x0, x1, y, z, slot, color, width = 0.14) {
  beam(out, slot, P(x0, y, z), P(x1, y, z), width, width, tint(color));
}
function balustrade(out, P, x0, x1, y, z, detail) {
  for (const h of [0.11, 0.85]) trim(out, P, x0, x1, y + h, z, 'wood', 'wood', 0.095);
  if (detail < 2) return;
  const count = Math.max(2, Math.ceil((x1 - x0) / (detail >= 3 ? 0.48 : 0.82)));
  for (let i = 0; i <= count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    beam(
      out,
      'wood',
      P(x, y + 0.11, z),
      P(x, y + 0.85, z),
      0.058,
      0.058,
      tint('wood', 0.82 + phase(i) * 0.23),
    );
  }
}
function veranda(
  out,
  P,
  n,
  width,
  y,
  height,
  depth,
  columns,
  detail,
  { mirrored = false, steps = false } = {},
) {
  const half = width / 2;
  block(
    out,
    'limestone',
    P,
    0,
    y - 0.24,
    -depth * 0.5,
    width + 0.42,
    0.24,
    depth + 0.3,
    tint('stone'),
  );
  if (steps) {
    const bottom = steps === true ? 0 : steps;
    const count = Math.max(3, Math.ceil((y - bottom) / 0.31));
    const rise = (y - bottom) / count;
    for (let k = 0; k < count; k++)
      block(
        out,
        'limestone',
        P,
        0,
        bottom - 0.14,
        0.37 * k + 0.23,
        width * 0.58,
        y - bottom + 0.14 - rise * k,
        0.38,
        tint('stone', 1 + k * 0.035),
        0,
      );
  }
  const ceiling = mirrored ? 'mirror' : 'plaster';
  block(
    out,
    ceiling,
    P,
    0,
    y + height,
    -depth * 0.5,
    width + 0.4,
    0.28,
    depth + 0.25,
    tint(mirrored ? 'silver' : 'cream'),
  );
  for (let i = 0; i < columns; i++) {
    const x = -half + 0.35 + ((width - 0.7) * i) / (columns - 1);
    column(out, P, x, y, -0.14, height, 0.21, detail, mirrored);
  }
  if (detail < 2) return;
  if (mirrored)
    for (let i = 0; i < 8; i++) {
      const x = -half + (width * (i + 0.5)) / 8;
      beam(
        out,
        'wood',
        P(x, y + height - 0.055, -0.06),
        P(x, y + height - 0.055, -depth + 0.11),
        0.035,
        0.036,
        tint('wood'),
      );
    }
  for (let i = 0; i < 3; i++)
    framedArch(
      out,
      P,
      n,
      (i - 1) * width * 0.29,
      y + 0.14,
      -depth + 0.07,
      width * 0.09,
      height * 0.75,
      Math.min(detail, 2),
      true,
    );
}

function galleryFacade(out, b, P, bayFrame, n, detail) {
  const main = b.key === 'main',
    mirror = b.key === 'mirror',
    diamond = b.key === 'diamond',
    tent = b.key === 'tent',
    abyaz = b.key === 'abyaz';
  const width = b.facade.width,
    half = width / 2;
  if (detail === 0) return;
  const columns = main
    ? detail === 1
      ? 9
      : detail === 2
        ? 16
        : 21
    : mirror
      ? 4
      : diamond
        ? 5
        : tent
          ? 3
          : 8;
  const margin = main ? 3 : 1.05;
  const step = (width - margin * 2) / columns;
  const scale = abyaz ? 0.84 : 1;
  const lower = (diamond || tent ? b.height * 0.41 : b.height * 0.38) * scale;
  const upperY = lower + 0.87,
    upperH = b.height * 0.45;
  const plinth = 0.76;
  const coating = abyaz ? 'plaster' : 'mosaic';
  for (let i = 0; i < columns; i++) {
    const u = -half + margin + step * (i + 0.5),
      w = Math.min(step * 0.33, 1.28);
    const faceAt = bayFrame(u);
    const bay = abyaz
      ? 'silver'
      : main
        ? i % 5 === 2
          ? 'turquoise'
          : i % 3 === 0
            ? 'indigo'
            : 'yellow'
        : mirror
          ? 'indigo'
          : i % 2
            ? 'sage'
            : 'turquoise';
    const detailHere = main && detail === 3 && i % 2 === 0 ? 2 : detail;
    if (!abyaz)
      rect(
        out,
        coating,
        faceAt,
        u - step * 0.48,
        plinth,
        u + step * 0.48,
        b.height - 0.43,
        0.092,
        tint(main ? (i % 3 === 0 ? 'indigo' : 'yellow') : 'ochre', main ? 0.78 : 0.89),
        n,
      );
    if (detail >= 2 && !abyaz) {
      framedPanel(
        out,
        faceAt,
        n,
        u,
        upperY - 0.06,
        0.103,
        Math.min(1.6, step * 0.455),
        upperH + 0.1,
        detailHere,
        bay,
        i * 3,
      );
      if (i % 3 === 0 || !main)
        framedPanel(
          out,
          faceAt,
          n,
          u,
          plinth + 0.03,
          0.101,
          Math.min(1.6, step * 0.455),
          lower - 0.63,
          detailHere,
          i % 2 ? 'amber' : 'indigo',
          i,
        );
    }
    framedArch(
      out,
      faceAt,
      n,
      u,
      upperY,
      0.16,
      w,
      upperH,
      detailHere,
      true,
      abyaz ? 'silver' : 'glass',
    );
    if (detail >= 2 || i % 2 === 0)
      framedArch(
        out,
        faceAt,
        n,
        u,
        plinth,
        0.16,
        w * 0.85,
        lower - 0.49,
        main ? Math.min(detailHere, 2) : detailHere,
        !tent,
        abyaz ? 'dark' : 'wood',
      );
    if (detail >= 2 && (abyaz || mirror) && i % 2 === 0)
      column(out, faceAt, u - step * 0.5, plinth, 0.42, b.height - 0.98, 0.16, Math.min(detail, 2));
  }
  if (main && detail >= 2) {
    const at = (x, y, z) => P(x - 15, y, z + 1.5);
    veranda(out, at, n, 15, 1, 4.5, 1.54, 4, Math.min(detail, 2));
  }
  if ((diamond || tent) && detail >= 2) {
    const at = (x, y, z) => P(x, y, z + 0.86);
    veranda(out, at, n, width * 0.96, 0.54, 3.3, 0.85, diamond ? 5 : 4, Math.min(detail, 2));
  }
  if (abyaz && detail >= 2) {
    const pediment = [
      [-6, 0],
      [6, 0],
      [0, 2.82],
    ];
    polygon(
      out,
      'limestone',
      pediment,
      (u, v) => P(u, b.height - 0.34 + v, 0.72),
      tint('white'),
      n,
    );
    trim(out, P, -6, 6, b.height - 0.36, 0.72, 'limestone', 'white', 0.3);
  }
}

function sunPalace(out, P, n, d) {
  const groundHeight = 12.1;
  const span = 35.5;
  if (d > 0) {
    for (const x of [-25, -19, -12, 12, 19, 25]) {
      framedPanel(
        out,
        P,
        n,
        x,
        1.31,
        0.14,
        2.6,
        9.9,
        d >= 3 && Math.abs(x) < 20 ? 3 : Math.min(d, 2),
        x < 0 ? 'ochre' : 'yellow',
        Math.abs(x),
      );
      framedArch(out, P, n, x, 2.65, 0.23, 1.48, 5.6, d >= 2 ? 2 : 1, true);
      if (d >= 2) framedPanel(out, P, n, x, 8.84, 0.18, 1.91, 1.61, d, 'turquoise', x + 32);
    }
    if (d >= 3) {
      for (const x of [-28, -22, -16, -9.8, 9.8, 16, 22, 28]) {
        framedPanel(out, P, n, x, 0.87, 0.26, 0.51, 10.11, d, x % 2 ? 'ochre' : 'indigo', x + 37);
        for (const h of [1.32, 4.42, 7.51, 10.3]) {
          const ring = Array.from({ length: 8 }, (_, i) => [
            x + 0.42 * Math.cos((i * Math.PI) / 4),
            h + 0.49 * Math.sin((i * Math.PI) / 4),
          ]);
          polygon(
            out,
            'tile',
            ring,
            (u, v) => P(u, v, 0.287),
            tint(h < 8 ? 'yellow' : 'turquoise'),
            n,
          );
        }
      }
      for (const x of [-19, 19]) {
        const ring = Array.from({ length: 12 }, (_, i) => [
          x + 1.1 * Math.cos((i * Math.PI) / 6),
          8.94 + 0.73 * Math.sin((i * Math.PI) / 6),
        ]);
        polygon(out, 'tile', ring, (u, v) => P(u, v, 0.305), tint('indigo'), n);
        rect(out, 'mosaic', P, x - 0.54, 8.7, x + 0.54, 9.14, 0.33, tint('amber'), n);
      }
    }
    const front = (x, y, z) => P(x, y, z + 3.0);
    veranda(out, front, n, 17, 1.31, 7.9, 3.0, 4, d, { mirrored: true, steps: -0.67 });
    if (d >= 2) balustrade(out, front, -8.29, 8.29, 1.35, -0.28, d);
    trim(out, P, -29, 29, 11.23, 0.31, 'tile', 'amber', 0.43);
  }
  block(out, 'brick', P, 0, groundHeight - 0.35, -7.4, span, 6.2, 12.1, tint('sand'));
  if (d > 0)
    for (const x of [-4.4, 0, 4.4]) {
      framedPanel(out, P, n, x, 12.22, -1.3, 1.95, 5.28, d, 'yellow', x + 6);
      framedArch(out, P, n, x, 13.2, -1.19, 1.44, 3.5, d, true, x === 0 ? 'indigo' : 'teal');
    }
  if (d >= 2) balustrade(out, P, -10.4, 10.4, 18.3, -1.25, d);
  for (const side of [-1, 1]) {
    const x = side * 11.5,
      base = 17.95,
      w = 11.25,
      z = -7.1;
    const back = z - 3.7,
      edge = z + 4.15;
    block(out, 'brick', P, x, base - 0.34, back, w, 13.15, 2.83, tint('sand'), d === 0 ? 0 : 0.08);
    for (const k of [-1, 1])
      block(
        out,
        'brick',
        P,
        x + k * (w / 2 - 0.49),
        base - 0.34,
        z,
        1.02,
        13.15,
        10.22,
        tint('sand', 1.06),
        d === 0 ? 0 : 0.08,
      );
    for (const y of [18.05, 23.92, 29.93]) {
      if (d === 0 && y === 23.92) continue;
      block(out, 'mosaic', P, x, y, z, w + 0.18, 0.66, 11.22, tint('yellow'), d === 0 ? 0 : 0.08);
      if (d === 0 || y > 29) continue;
      for (const u of [-3.58, 0, 3.58]) {
        beam(
          out,
          'wood',
          P(x + u, y + 0.63, edge + 0.45),
          P(x + u, y + 5.86, edge + 0.45),
          0.162,
          0.15,
          tint('red', 0.91),
        );
        if (u === 0) framedArch(out, P, n, x + u, y + 0.79, back + 1.52, 1.65, 4.25, d, true);
      }
      if (y < 29) balustrade(out, P, x - 4.98, x + 4.98, y + 0.63, edge + 1.11, d);
      if (d >= 2 && y < 29)
        for (const u of [-4.45, 4.45])
          framedPanel(
            out,
            P,
            n,
            x + u,
            y + 1.91,
            back + 1.58,
            0.55,
            2.9,
            d,
            'turquoise',
            Math.abs(x) + u,
          );
    }
    block(
      out,
      'roof',
      P,
      x,
      30.65,
      z,
      w + 1.24,
      0.37,
      12.2,
      tint('roof', 0.77),
      d === 0 ? 0 : 0.08,
    );
    const cupWidth = 4.62,
      cupDepth = 4.82;
    if (d > 0) block(out, 'wood', P, x, 31.02, z, cupWidth, 0.37, cupDepth, tint('wood', 0.96));
    for (const u of [-1, 1])
      for (const v of [-1, 1])
        beam(
          out,
          'wood',
          P(x + u * 2, 31.31, z + v * 1.95),
          P(x + u * 2, 34.01, z + v * 1.95),
          0.22,
          0.225,
          tint('wood'),
        );
    const ring = (h, w, l) =>
      chamferedRectangle(x, h, z, w, l, 0.12).map(([u, v, w]) => P(u, v, w));
    loft(
      out,
      'roof',
      [ring(34, 5.42, 5.62), ring(34.37, 5.48, 5.69), ring(35.1, 4.2, 4.45)],
      tint('roof', 0.75),
    );
  }
  block(out, 'brick', P, 0, 18.22, -8.6, 3.2, 8.36, 3.36, tint('sand'));
  block(out, 'roof', P, 0, 26.5, -8.6, 4.46, 0.42, 4.44, tint('roof', 0.79));
  if (d > 0) {
    const faceZ = -6.87;
    const points = Array.from({ length: d >= 2 ? 14 : 8 }, (_, i) => {
      const r = (2 * Math.PI * i) / (d >= 2 ? 14 : 8);
      return [1.12 * Math.cos(r), 24.84 + 1.12 * Math.sin(r)];
    });
    polygon(out, 'limestone', points, (u, v) => P(u, v, faceZ), tint('cream'), n);
    beam(
      out,
      'wood',
      P(0, 24.84, faceZ + 0.02),
      P(-0.33, 25.23, faceZ + 0.02),
      0.046,
      0.047,
      tint('dark'),
    );
    beam(
      out,
      'wood',
      P(0, 24.84, faceZ + 0.02),
      P(0.55, 25.06, faceZ + 0.02),
      0.043,
      0.044,
      tint('dark'),
    );
  }
}

function windcatchers(out, b, P, n, d) {
  const width = b.facade.width;
  if (d > 0)
    for (let i = 0; i < 7; i++) {
      const u = (i - 3) * 4.46;
      framedPanel(out, P, n, u, 0.76, 0.082, 1.99, 7.36, d, i % 3 === 1 ? 'indigo' : 'ochre', i);
      framedArch(out, P, n, u, 1.3, 0.138, i === 3 ? 1.49 : 1.17, 5.42, d, true);
    }
  if (d >= 2) {
    const front = (x, y, z) => P(x, y, z + 1.28);
    veranda(out, front, n, 12.6, 0.76, 4.52, 1.3, 4, Math.min(d, 2), { steps: true });
  }
  for (const [x, z, scale] of [
    [-13.5, -3.72, 1],
    [13.5, -3.72, 1],
    [-13.5, -12.9, 0.91],
    [13.5, -12.9, 0.91],
  ]) {
    const ring = (h, w, l) =>
      chamferedRectangle(x, h * scale, z, w, l, 0.09).map(([u, v, w]) => P(u, v, w));
    const start = 6.71,
      capY = 19.1;
    loft(out, 'tile', [ring(start, 3.6, 3.62), ring(capY, 2.7, 2.72)], tint('turquoise', 0.9));
    if (d > 0) {
      loft(out, 'mosaic', [ring(9.41, 3.45, 3.46), ring(9.58, 3.46, 3.47)], tint('yellow'));
      loft(
        out,
        'mosaic',
        [ring(capY - 0.2, 2.98, 2.99), ring(capY + 0.24, 3.0, 3.01)],
        tint('ochre'),
      );
    }
    if (d === 0)
      block(out, 'limestone', P, x, capY * scale, z, 2.5, 2.6 * scale, 2.5, tint('glass'), 0);
    else
      for (const u of [-1, 1])
        for (const v of [-1, 1])
          beam(
            out,
            'limestone',
            P(x + u * 1.18, capY * scale, z + v * 1.18),
            P(x + u * 1.18, (capY + 2.6) * scale, z + v * 1.18),
            0.235,
            0.231,
            tint('cream'),
          );
    if (d >= 2)
      for (const side of [-1, 1])
        for (const a of [-0.62, 0, 0.62]) {
          const y = capY * scale,
            h = (capY + 2.55) * scale;
          beam(
            out,
            'limestone',
            P(x + a, y, z + side * 1.26),
            P(x + a, h, z + side * 1.26),
            0.15,
            0.15,
            tint('cream', 0.95),
          );
          beam(
            out,
            'limestone',
            P(x + side * 1.26, y, z + a),
            P(x + side * 1.26, h, z + a),
            0.15,
            0.15,
            tint('cream', 0.95),
          );
        }
    loft(
      out,
      'roof',
      [ring(capY + 2.57, 3.31, 3.34), ring(capY + 2.91, 3.34, 3.36), ring(capY + 3.37, 2.62, 2.63)],
      tint('roof', 0.86),
    );
  }
  if (d >= 2)
    trim(out, P, -width * 0.48, width * 0.48, b.height - 0.29, 0.14, 'mosaic', 'amber', 0.29);
}

function throne(out, b, P, n, d) {
  const width = b.facade.width;
  if (d === 0) return;
  const porch = (x, y, z) => P(x - 7, y, z + 3.21);
  veranda(out, porch, n, 16.4, 1.6, 7.9, 3.27, 4, d, {
    mirrored: true,
    steps: d >= 2 ? -0.87 : false,
  });
  if (d >= 2) {
    const end = (x, y, z) => porch(x, y, z - 1.83);
    block(out, 'limestone', end, 0, 1.62, 0, 5.7, 0.19, 2.06, tint('white'));
    block(out, 'limestone', end, 0, 2.53, -0.25, 4.23, 0.115, 1.28, tint('white'));
    block(out, 'limestone', end, 0, 2.61, -0.8, 4.28, 0.24, 0.24, tint('cream'));
    for (const k of [-1, 1]) {
      block(out, 'limestone', end, k * 2.17, 2.64, -0.26, 0.18, 0.58, 1.36, tint('white'));
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 1.03,
          y = 2.0,
          z = k * 0.47;
        if (d >= 3) {
          sphere(out, 'limestone', end(x, y, z), [0.16, 0.36, 0.145], tint('white', 0.94), 7, 5);
          sphere(out, 'limestone', end(x, y + 0.36, z), [0.106, 0.13, 0.104], tint('white'), 6, 4);
        } else column(out, end, x, 1.76, z, 0.74, 0.1, 1);
      }
    }
    for (const x of [-7.2, 7.2]) {
      framedPanel(out, porch, n, x, 1.68, -3.03, 0.67, 6.76, d, 'indigo', Math.abs(x));
      rect(out, 'mirror', porch, x - 0.45, 3.43, x + 0.45, 7.06, -2.99, tint('silver', 0.93), n);
    }
  }
  for (const [i, u] of [-22, -18, 5, 10, 15, 20, 24].entries()) {
    framedPanel(out, P, n, u, 0.91, 0.165, 1.81, 8.22, d, i % 2 ? 'turquoise' : 'indigo', i * 2);
    framedArch(out, P, n, u, 1.03, 0.221, 1.22, 5.36, d, true);
  }
  if (d >= 2) trim(out, P, -width * 0.49, width * 0.49, 9.52, 0.14, 'tile', 'turquoise', 0.36);
}

function garden(out, d) {
  const { poolRim, gardenGrade } = layout;
  const count = poolRim.length;
  for (let i = 0; i < count; i++) {
    const [x, y, z] = poolRim[i],
      [u, v, w] = poolRim[(i + 1) % count];
    const len = Math.hypot(u - x, w - z),
      xOffset = ((w - z) / len) * 0.19,
      zOffset = ((x - u) / len) * 0.19;
    if (d === 0 && len < 2.5) continue;
    face(
      out,
      'limestone',
      [
        [x + xOffset, y, z + zOffset],
        [u + xOffset, v, w + zOffset],
        [u - xOffset, v, w - zOffset],
        [x - xOffset, y, z - zOffset],
      ],
      tint('stone'),
      up,
    );
    if (d >= 2)
      face(
        out,
        'limestone',
        [
          [x + xOffset, y, z + zOffset],
          [x + xOffset, y - 0.27, z + zOffset],
          [u + xOffset, v - 0.27, w + zOffset],
          [u + xOffset, v, w + zOffset],
        ],
        tint('stone', 0.86),
      );
  }
  if (d > 0) {
    for (const [x, z, h] of [
      [-9.28, 36.75, poolRim[2][1]],
      [-8.29, 77.3, gardenGrade],
      [-6.29, 136.58, poolRim[19][1]],
    ]) {
      const ring = (y, r) => radialRing(y, r, r, d >= 2 ? 12 : 7, [x, z]);
      loft(
        out,
        'limestone',
        [ring(h - 0.17, 1.0), ring(h + 0.22, 0.9), ring(h + 0.28, 0.64), ring(h + 0.54, 0.35)],
        tint('cream'),
      );
      if (d >= 2) loft(out, 'tile', [ring(h + 0.55, 0.32), ring(h + 0.62, 0.308)], tint('teal'));
    }
  }
}

function build(out, d) {
  for (const b of layout.buildings) {
    const { P, bay, n } = photoFrame(b);
    shell(out, b, d === 1 ? 0 : d, b.key === 'abyaz' ? 'plaster' : 'brick');
    if (b.key === 'throne') throne(out, b, P, n, d);
    else if (b.key === 'shams') sunPalace(out, P, n, d);
    else if (b.key === 'badgir') windcatchers(out, b, P, n, d);
    else galleryFacade(out, b, P, bay, n, d);
  }
  garden(out, d);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
