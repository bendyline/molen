import { readFileSync } from 'node:fs';
import {
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const trophySurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.95 },
  dressed: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.83 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.74 },
};
const palette = {
  rubble: [0.56, 0.52, 0.45],
  dust: [0.54, 0.5, 0.43],
  rubbleLight: [0.58, 0.54, 0.47],
  limestone: [0.71, 0.68, 0.6],
  ashlarLight: [0.79, 0.75, 0.66],
  ashlarDark: [0.61, 0.58, 0.51],
  marble: [0.85, 0.82, 0.73],
  marbleShade: [0.74, 0.72, 0.63],
  letter: [0.33, 0.3, 0.24],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  turn = Math.PI * 2,
  ref = 'palette:#ffffff';
const dirt = (i, j) => (Math.imul(i + 193, 0x45d9f3b) ^ Math.imul(j + 229, 0x119de1f3)) >>> 0;
const offset = (i, j) => ((dirt(i, j) % 101) / 100 - 0.5) * 2;
function face(out, slot, tint, points, orientation) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * orientation[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, normal, undefined, palette[tint]);
  else out.addQuad(slot, ref, points, normal, undefined, palette[tint]);
}
function box(out, slot, tint, x, z, y, w, d, h, bevel = 0) {
  const ring = (height) =>
    bevel
      ? chamferedRectangle(x, height, z, w, d, bevel)
      : [
          [x - w / 2, height, z - d / 2],
          [x - w / 2, height, z + d / 2],
          [x + w / 2, height, z + d / 2],
          [x + w / 2, height, z - d / 2],
        ];
  loft(out, slot, [ring(y), ring(y + h)], palette[tint]);
}
function slab(out, ring, bottom, top) {
  const at = (p, y) => [p[0], y, p[1]];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      out,
      'dressed',
      'limestone',
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
    );
  }
  face(
    out,
    'dressed',
    'limestone',
    ring.map((p) => at(p, top)),
    [0, 1, 0],
  );
  face(
    out,
    'dressed',
    'ashlarDark',
    ring.map((p) => at(p, bottom)),
    [0, -1, 0],
  );
}
function coreShape(out, detail) {
  const { profiles, crest, topRadius, topCenter } = layout.core,
    n = [16, 24, 32, 48, 64][detail];
  const last = profiles.at(-1);
  const regular = profiles.flatMap((p, i) => {
    if (i === 0 || detail < 2) return [p];
    const q = profiles[i - 1],
      k = detail === 2 ? 2 : 4;
    return Array.from({ length: k }, (_, j) => {
      const t = (j + 1) / k,
        mix = (a, b) => a + (b - a) * t;
      return {
        y: mix(q.y, p.y),
        rx: mix(q.rx, p.rx),
        rz: mix(q.rz, p.rz),
        c: p.c.map((v, k) => mix(q.c[k], v)),
      };
    });
  });
  const ring = (profile, index) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * turn,
        q = (i / n) * crest.length,
        b = Math.floor(q);
      const height = profile.top
        ? crest[b] + (crest[(b + 1) % crest.length] - crest[b]) * (q - b)
        : profile.y;
      const ripple = (profile.top ? 0.15 : detail > 1 ? 0.13 : 0.16) * offset(i, index);
      return [
        profile.c[0] + Math.sin(a) * (profile.rx + ripple),
        height + (profile.top ? 0 : detail > 1 ? 0.08 * offset(i, index + 90) : 0),
        profile.c[1] - Math.cos(a) * (profile.rz + ripple),
      ];
    });
  const rings = [
    ...regular,
    { ...last, y: 27.6, rx: 7.12, rz: 6.83 },
    { y: 35, rx: topRadius[0], rz: topRadius[1], c: topCenter, top: true },
  ].map(ring);
  for (let j = 1; j < rings.length; j++) {
    const low = rings[j - 1],
      high = rings[j];
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = low[i],
        b = low[k],
        c = high[k],
        d = high[i];
      const outward = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2 - layout.core.center[1]];
      const tint =
        detail < 2 ? 'rubble' : ['rubble', 'rubble', 'rubbleLight', 'dust'][dirt(i, j) % 4];
      face(out, 'rubble', tint, [a, b, c], outward);
      face(out, 'rubble', tint, [a, c, d], outward);
    }
  }
  const top = rings.at(-1);
  const interior = [topCenter[0], 31.4, topCenter[1]];
  for (let i = 0; i < n; i++)
    face(out, 'rubble', 'rubbleLight', [interior, top[i], top[(i + 1) % n]], [0, 1, 0]);
}
const radialPoint = ([cx, cz], r, a, y) => [cx + Math.sin(a) * r, y, cz - Math.cos(a) * r];
function curvedCourse(out, slot, tint, { center, start, end }, r0, r1, y, h, n) {
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n,
      m = (a + b) / 2;
    const A = radialPoint(center, r0, a, y),
      B = radialPoint(center, r0, b, y),
      C = radialPoint(center, r1, b, y),
      D = radialPoint(center, r1, a, y);
    const raise = (p) => [p[0], p[1] + h, p[2]];
    const [a1, b1, c1, d1] = [A, B, C, D].map(raise),
      outside = [Math.sin(m), 0, -Math.cos(m)];
    face(out, slot, tint, [D, C, c1, d1], outside);
    face(
      out,
      slot,
      tint,
      [A, B, b1, a1],
      outside.map((v) => -v),
    );
    face(out, slot, tint, [a1, b1, c1, d1], [0, 1, 0]);
    face(out, slot, tint, [A, B, C, D], [0, -1, 0]);
    if (i === 0) face(out, slot, tint, [A, D, d1, a1], [-Math.cos(a), 0, -Math.sin(a)]);
    if (i === n - 1) face(out, slot, tint, [B, C, c1, b1], [Math.cos(b), 0, Math.sin(b)]);
  }
}
function crownMasonry(out, detail) {
  if (detail < 2) return;
  const { crest, topRadius, topCenter } = layout.core;
  const heightAt = (a) => {
    const k = ((((a / turn) % 1) + 1) % 1) * crest.length,
      i = Math.floor(k);
    return crest[i] + (crest[(i + 1) % crest.length] - crest[i]) * (k - i);
  };
  const ranges = [
    [1.91, 3.2],
    [-0.72, -0.16],
  ];
  for (const [start, end] of ranges) {
    const count = Math.floor((end - start) / 0.167),
      width = (end - start) / count;
    for (let i = 0; i < count; i++) {
      const a = start + (i + 0.5) * width,
        top = heightAt(a);
      for (const row of [0, 1]) {
        const y = top - 0.71 - row * 0.78,
          r0 = topRadius[0] + 0.22 + row * 0.033,
          r1 = topRadius[1] + 0.22 + row * 0.046;
        const p = (t, h) => [topCenter[0] + Math.sin(t) * r0, h, topCenter[1] - Math.cos(t) * r1];
        const seg = detail === 2 ? 4 : 7,
          angle = width * 0.43;
        for (let j = 0; j < seg; j++) {
          const t0 = (Math.PI * j) / seg,
            t1 = (Math.PI * (j + 1)) / seg;
          const point = (t, k) => p(a + Math.cos(t) * angle * k, y + Math.sin(t) * 0.44 * k);
          const points = [point(t0, 0.72), point(t1, 0.72), point(t1, 1), point(t0, 1)];
          face(out, 'dressed', 'ashlarLight', points, [Math.sin(a), 0, -Math.cos(a)]);
        }
      }
    }
  }
}
function column(out, x, z, base, height, full, detail) {
  const n = [7, 9, 14, 22, 28][detail];
  const radius = full ? 0.67 : 0.62;
  const shaft = (y, r, drum = 0) =>
    radialRing(y, r, r, n, [x, z]).map(([px, py, pz], i) => [
      px + (px - x) * 0.019 * offset(i, drum),
      py,
      pz + (pz - z) * 0.019 * offset(i, drum),
    ]);
  const lathe = (rows, tint, drum = 0) =>
    loft(
      out,
      'dressed',
      rows.map(([y, r]) => shaft(base + y, r, drum)),
      palette[tint],
    );
  if (detail === 0) {
    lathe(
      [
        [0, radius + 0.12],
        [height, radius - 0.055],
      ],
      'limestone',
    );
    return;
  }
  lathe(
    [
      [0, radius + 0.22],
      [0.12, radius + 0.22],
      [0.33, radius + 0.07],
    ],
    'ashlarLight',
  );
  const from = 0.31,
    to = height - (full ? 0.62 : 0.07),
    drums = Math.ceil((to - from) / (detail === 1 ? 2.12 : 1.36));
  for (let i = 0; i < drums; i++) {
    const a = from + ((to - from) * i) / drums,
      b = from + ((to - from) * (i + 1)) / drums;
    const r = radius * (1 - (0.13 * i) / drums);
    const tint =
      detail < 2
        ? 'limestone'
        : ['ashlarLight', 'limestone', 'limestone', 'marbleShade'][dirt(i, Math.round(x * 10)) % 4];
    if (detail >= 3)
      lathe(
        [
          [a, r - 0.025],
          [a + 0.055, r],
          [b - 0.048, r - 0.006],
          [b, r - 0.034],
        ],
        tint,
        i,
      );
    else
      lathe(
        [
          [a, r],
          [b, r - 0.015],
        ],
        tint,
        i,
      );
  }
  if (full)
    lathe(
      [
        [to - 0.09, radius * 0.86],
        [to + 0.16, radius * 0.94],
        [to + 0.31, radius * 1.17],
        [height, radius * 1.17],
      ],
      'ashlarLight',
      14,
    );
}
const letters = {
  A: [
    [0, 0, 0.5, 1, 1, 0],
    [0.24, 0.42, 0.76, 0.42],
  ],
  C: [[1, 0.87, 0.72, 1, 0.28, 0.95, 0, 0.67, 0, 0.3, 0.28, 0.04, 0.72, 0, 1, 0.15]],
  D: [[0, 0, 0, 1, 0.55, 1, 0.92, 0.72, 1, 0.5, 0.91, 0.21, 0.55, 0, 0, 0]],
  E: [
    [1, 1, 0, 1, 0, 0, 1, 0],
    [0, 0.52, 0.82, 0.52],
  ],
  F: [
    [0, 0, 0, 1, 1, 1],
    [0, 0.52, 0.82, 0.52],
  ],
  G: [
    [
      1, 0.87, 0.73, 1, 0.26, 0.95, 0, 0.68, 0, 0.3, 0.25, 0.05, 0.73, 0, 1, 0.17, 1, 0.49, 0.57,
      0.49,
    ],
  ],
  I: [
    [0.5, 0, 0.5, 1],
    [0.18, 0, 0.82, 0],
    [0.18, 1, 0.82, 1],
  ],
  L: [[0, 1, 0, 0, 1, 0]],
  M: [[0, 0, 0, 1, 0.5, 0.38, 1, 1, 1, 0]],
  N: [[0, 0, 0, 1, 1, 0, 1, 1]],
  O: [[0.22, 0, 0, 0.3, 0, 0.7, 0.22, 1, 0.78, 1, 1, 0.7, 1, 0.3, 0.78, 0, 0.22, 0]],
  P: [[0, 0, 0, 1, 0.65, 1, 1, 0.85, 1, 0.65, 0.65, 0.53, 0, 0.53]],
  Q: [
    [0.22, 0, 0, 0.3, 0, 0.7, 0.22, 1, 0.78, 1, 1, 0.7, 1, 0.3, 0.78, 0, 0.22, 0],
    [0.55, 0.22, 1, -0.08],
  ],
  R: [
    [0, 0, 0, 1, 0.64, 1, 1, 0.84, 0.95, 0.65, 0.65, 0.53, 0, 0.53],
    [0.45, 0.53, 1, 0],
  ],
  S: [
    [1, 0.86, 0.74, 1, 0.24, 1, 0, 0.8, 0.08, 0.61, 0.88, 0.44, 1, 0.23, 0.75, 0, 0.22, 0, 0, 0.14],
  ],
  T: [
    [0, 1, 1, 1],
    [0.5, 1, 0.5, 0],
  ],
  V: [[0, 1, 0.5, 0, 1, 1]],
  X: [
    [0, 0, 1, 1],
    [0, 1, 1, 0],
  ],
};
// Main dedication and selected lines in Roman lettering.
const dedication = [
  'IMPERATORI CAESARI DIVI FILIO AVGVSTO',
  'PONT MAXIM IMP XIIII TRIB POT XVII',
  'SENATVS POPVLVSQVE ROMANVS',
  'QVOD EIVS DVCTV AVSPICIISQVE GENTES ALPINAE',
  'OMNES QVAE A MARI SVPERO AD INFERVM PERTINEBANT',
  'SVB IMPERIVM P R SVNT REDACTAE',
];
function inscription(out, front, detail) {
  const { z, panel, reliefs } = front;
  const [cx, cy] = panel.center;
  box(out, 'marble', 'marble', cx, z - 0.073, cy - panel.h / 2, panel.w, 0.165, panel.h, 0.018);
  if (!detail) return;
  for (const [inset, tint] of [
    [0, 'ashlarLight'],
    [0.2, 'marbleShade'],
  ]) {
    const x = panel.w / 2 - inset,
      y = panel.h / 2 - inset,
      p = z - 0.178 - inset * 0.08;
    beamPath(
      out,
      'marble',
      [
        [cx - x, cy - y, p],
        [cx + x, cy - y, p],
        [cx + x, cy + y, p],
        [cx - x, cy + y, p],
      ],
      0.105,
      0.07,
      palette[tint],
      true,
    );
  }
  if (detail >= 2) {
    dedication.slice(0, detail === 2 ? 3 : 6).forEach((line, index) => {
      const height = index < 3 ? 0.36 : 0.25,
        width = height * 0.62,
        spacing = width * 1.42,
        x0 = cx + (line.length * spacing - spacing + width) * 0.5,
        y = cy + 2.32 - index * 0.56;
      [...line].forEach((char, i) => {
        for (const stroke of letters[char] ?? []) {
          const points = [];
          for (let j = 0; j < stroke.length; j += 2)
            points.push([
              x0 - i * spacing - stroke[j] * width,
              y + stroke[j + 1] * height,
              z - 0.168,
            ]);
          beamPath(out, 'marble', points, detail >= 3 ? 0.022 : 0.028, 0.006, palette.letter);
        }
      });
    });
  }
  for (const x of reliefs) {
    box(out, 'marble', 'marbleShade', x, z - 0.052, cy - 2.9, 2.47, 0.14, 5.8, 0.06);
    if (detail < 2) continue;
    const p = z - 0.19;
    box(out, 'marble', 'marble', x, p, cy - 1.9, 0.39, 0.18, 4.16, 0.04);
    box(out, 'marble', 'ashlarLight', x, p - 0.05, cy - 0.36, 1.29, 0.23, 1.46, 0.16);
    beamPath(
      out,
      'marble',
      [
        [x - 1, cy + 1.1, p],
        [x - 0.68, cy + 0.74, p - 0.05],
        [x, cy + 0.48, p - 0.12],
        [x + 0.68, cy + 0.73, p - 0.05],
        [x + 1, cy + 1.1, p],
      ],
      0.19,
      0.16,
      palette.marble,
    );
    const count = detail >= 3 ? 7 : 4;
    for (let i = 0; i < count; i++) {
      const k = i / (count - 1) - 0.5;
      beamPath(
        out,
        'marble',
        [
          [x + k * 0.92, cy + 0.29, p - 0.19],
          [x + k * 0.85, cy - 0.48, p - 0.23],
          [x + k * 1.27, cy - 1.35, p - 0.15],
        ],
        0.093,
        0.077,
        palette.ashlarLight,
      );
    }
  }
}
function podium(out, detail) {
  slab(out, layout.outline, layout.foundationBottom, 0.24);
  let y = 0.23;
  for (const p of layout.podium) {
    box(out, 'dressed', 'limestone', ...p.c, y, p.w, p.d, p.y - y, 0.1);
    y = p.y - 0.008;
  }
  const f = layout.front,
    [left, right] = f.span,
    cx = (left + right) / 2,
    w = right - left;
  box(out, 'rubble', 'rubble', cx, -5.44, y, w - 0.16, 15.78, f.top - y, 0.13);
  const moldings =
    detail === 0
      ? [[12.35, 13.02, 0.51]]
      : [
          [2.85, 3.36, 0.33],
          [4.22, 4.49, 0.21],
          [10.98, 11.16, 0.13],
          [11.55, 11.84, 0.21],
          [12.24, 12.52, 0.33],
          [12.66, 13.02, 0.51],
        ];
  for (const [bottom, top, lip] of moldings) {
    box(
      out,
      'dressed',
      'ashlarLight',
      cx,
      -5.48 - lip / 2,
      bottom,
      w + lip,
      15.73 + lip,
      top - bottom,
      0.08,
    );
  }
  inscription(out, f, detail);
  // Side courses break away in different places on either flank and leave the eastern rubble exposed.
  for (const side of [-1, 1]) {
    for (let course = 0; course < 7; course += detail === 0 ? 2 : 1) {
      const z = -10.3 + course * 0.48,
        yy = 2.78 + course * 1.11,
        bound = 16.25 - course * 0.61,
        inner = 10.66 - course * 0.19;
      const length = 18.8 - course * 1.79 + (side === 1 ? 1.17 : 0);
      const count = detail === 0 ? 1 : Math.ceil(length / (detail === 1 ? 5.8 : 2.24));
      for (let j = 0; j < count; j++) {
        const d = length / count,
          coord = z + (j + 0.5) * d,
          tint = ['limestone', 'ashlarLight', 'ashlarDark'][dirt(j, course + (side + 1) * 4) % 3];
        box(
          out,
          'dressed',
          tint,
          side * (bound + inner) * 0.5,
          coord,
          yy,
          (bound - inner) * 1.01,
          d - (count > 1 ? 0.067 : 0),
          1.17 + offset(j, course) * 0.1,
          detail >= 2 ? 0.105 : 0,
        );
      }
    }
  }
  for (let course = 0; course < (detail === 0 ? 1 : 4); course++) {
    const d = 5.1 - course * 0.55;
    box(
      out,
      'rubble',
      'rubble',
      1.1,
      11.65 - course * 0.33,
      2.8 + course * 0.86,
      26.55 - course * 2.1,
      d,
      0.99,
      0.25,
    );
  }
}
export function buildTrophyLevel(out, level) {
  const detail = levels[level],
    a = layout.arcade;
  podium(out, detail);
  coreShape(out, detail);
  crownMasonry(out, detail);
  curvedCourse(
    out,
    'dressed',
    'ashlarLight',
    { ...a, start: -1.35, end: 1.18 },
    5.36,
    9.37,
    12.73,
    0.38,
    [8, 12, 17, 24, 32][detail],
  );
  for (const angle of a.angles) {
    const [x, , z] = radialPoint(a.center, a.radius, angle, 0);
    column(out, x, z, a.lower, a.soffit - a.lower, true, detail);
  }
  for (const [angle, h] of a.broken) {
    const [x, , z] = radialPoint(a.center, a.radius, angle, 0);
    column(out, x, z, a.lower, h, false, detail);
  }
  const soffit = a.soffit - 0.025,
    segments = [9, 13, 20, 27, 32][detail];
  const courses =
    detail === 0
      ? [[0, 2.66, 9.5]]
      : detail === 1
        ? [
            [0, 0.54, 9.36],
            [0.54, 0.95, 9.1],
            [1.49, 1.17, 9.55],
          ]
        : [
            [0, 0.35, 9.24],
            [0.35, 0.19, 9.42],
            [0.54, 0.95, 9.1],
            [1.49, 0.23, 9.23],
            [1.72, 0.34, 9.49],
            [2.06, 0.31, 9.62],
            [2.37, 0.29, 9.29],
          ];
  for (const [base, h, r] of courses) {
    curvedCourse(
      out,
      'dressed',
      base === 0.54 ? 'limestone' : 'ashlarLight',
      a,
      4.92,
      r,
      soffit + base,
      h,
      segments,
    );
  }
  if (detail >= 2) {
    const count = detail === 2 ? 12 : 17;
    for (let i = 0; i < count; i++) {
      const angle = a.start + ((a.end - a.start) * (i + 0.52)) / count;
      const [x, y, z] = radialPoint(a.center, 9.085, angle, soffit + 0.58);
      for (const dx of [-0.093, 0, 0.093])
        box(out, 'dressed', 'ashlarLight', x + dx, z, y, 0.054, 0.15, 0.73, 0.012);
    }
  }
}

export const buildTrophySkyline = (out) => buildTrophyLevel(out, 'skyline');
export const buildTrophyDistrict = (out) => buildTrophyLevel(out, 'district');
export const buildTrophyStreet = (out) => buildTrophyLevel(out, 'street');
export const buildTrophyCloseup = (out) => buildTrophyLevel(out, 'closeup');
