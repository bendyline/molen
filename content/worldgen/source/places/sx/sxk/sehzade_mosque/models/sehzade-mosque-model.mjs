import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  limestone: 'c5b599',
  warm: 'd0bda0',
  shade: 'ac9d86',
  trim: 'e0ceb0',
  marble: 'd1c7b3',
  rose: 'a57361',
  lead: '6d8394',
  ridge: '8497a3',
  deepLead: '657987',
  brass: 'a4915f',
  glass: '52606a',
  tile: '806b59',
  courtyard: 'aeaa9d',
  pool: '5b7180',
  darkIron: '5c5951',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.94),
  floor: surface('foundation', 'stone_ashlar', 0.96),
  roof: surface('roof', 'metal_standing_seam', 0.83, 0.17),
  metal: surface('trim', 'metal_bronze_cast', 0.73, 0.24),
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48, metallic: 0.07 },
};
const base = 0.65;
const rad = ([x, z], a, r) => [x + Math.cos(a) * r, z + Math.sin(a) * r];
const round = (out, slot, center, ys, n, tint) =>
  loft(
    out,
    slot,
    ys.map(([y, r]) => radialRing(y, r, r, n, center, Math.PI / 8)),
    tint,
  );
const sectionRing = (x, z, rx, rz, offset) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * i) / 4 + offset;
    return [x + Math.cos(a) * rx, z + Math.sin(a) * rz];
  });
const sunk = (p) => Math.min(base - 0.22, grade(p) - 0.26);
function mass(out, outline, lo, hi, slot, color) {
  shell(out, outline, typeof lo === 'number' ? () => lo : lo, hi, { wall: slot, color });
}

function finial(out, level, center, from, height) {
  const n = level >= 2 ? 9 : 5;
  round(
    out,
    'metal',
    center,
    [
      [from - 0.065, height * 0.093],
      [from + height * 0.33, height * 0.127],
      [from + height * 0.5, height * 0.037],
      [from + height * 0.73, height * 0.092],
      [from + height, 0.027],
    ],
    n,
    colors.brass,
  );
}

function dome(out, level, center, radius, from, to, kind = 'small', angle = 0) {
  const half = kind === 'half';
  const n =
    kind === 'major'
      ? [8, 16, 28, 42][level]
      : half
        ? [3, 5, 12, 19][level]
        : [4, 5, 11, 18][level];
  const steps =
    level === 0
      ? [0, 0.66, 1]
      : level === 1
        ? [0, 0.58, 1]
        : level === 2
          ? [0, 0.29, 0.56, 0.78, 0.92, 1]
          : [0, 0.23, 0.45, 0.65, 0.81, 0.93, 1];
  const point = (a, t) => {
    const curve = Math.max(0.025, Math.sqrt(1 - t * t));
    const rib = kind === 'ribbed' && level >= 2 ? 1 + 0.04 * Math.cos(12 * a) : 1;
    return at(rad(center, a, radius * curve * rib), mix(from, to, t));
  };
  const a0 = half ? angle - Math.PI / 2 : 0;
  const total = half ? Math.PI : 2 * Math.PI;
  for (const [p, q] of pairs(steps)) {
    for (let j = 0; j < n; j++) {
      const a = a0 + (total * j) / n,
        b = a0 + (total * (j + 1)) / n;
      const normal = [Math.cos((a + b) / 2), 0.45, Math.sin((a + b) / 2)];
      face(out, 'roof', [point(a, p), point(b, p), point(b, q), point(a, q)], normal, colors.lead);
    }
  }
  if (level >= 2 && (kind === 'major' || kind === 'ribbed')) {
    const ribs = kind === 'ribbed' ? 12 : level === 3 ? 24 : 12;
    for (let i = 0; i < ribs; i++) {
      const a = (2 * Math.PI * i) / ribs;
      for (const [t, u] of pairs(steps)) {
        const lift = (p) => [p[0] + Math.cos(a) * 0.025, p[1] + 0.025, p[2] + Math.sin(a) * 0.025];
        beam(out, 'roof', lift(point(a, t)), lift(point(a, u)), 0.035, 0.038, colors.ridge);
      }
    }
  }
  if (kind === 'major' || kind === 'ribbed')
    finial(out, level, center, to, kind === 'major' ? 1.19 : 0.81);
}

function window(out, level, w, u, bottom, spring, r, rise, stripe = false) {
  if (level < 2) {
    panel(out, 'glass', w, u - r, u + r, bottom, spring, 0.078, colors.glass);
    const head = [
      w.p(u - r, spring, 0.078),
      w.p(u + r, spring, 0.078),
      w.p(u + r * 0.57, spring + rise * 0.85, 0.078),
      w.p(u - r * 0.57, spring + rise * 0.85, 0.078),
    ];
    face(out, 'glass', head, w.normal, colors.glass);
    return;
  }
  arch(
    out,
    w,
    u,
    bottom,
    spring,
    r,
    rise,
    0.076,
    level === 2 ? 1 : level,
    {
      inner: colors.glass,
      trim: stripe ? colors.rose : colors.trim,
      width: level === 0 ? 0.1 : 0.145,
    },
    { inner: 'glass', trim: 'trim' },
  );
  if (level >= 2) {
    const bars = level === 3 ? 4 : 2;
    for (let i = 1; i <= bars; i++) {
      const x = mix(u - r, u + r, i / (bars + 1));
      panel(out, 'trim', w, x - 0.027, x + 0.027, bottom, spring + 0.11, 0.13, colors.marble);
    }
    panel(
      out,
      'trim',
      w,
      u - r,
      u + r,
      mix(bottom, spring, 0.62) - 0.026,
      mix(bottom, spring, 0.62) + 0.026,
      0.134,
      colors.marble,
    );
  }
}

function drum(out, level, [x, z], radius, lo, hi, n = 24) {
  const sides = level === 0 ? 8 : level === 1 ? 12 : n;
  const outline = Array.from({ length: sides }, (_, i) =>
    rad([x, z], (2 * Math.PI * i) / sides, radius),
  );
  mass(out, outline, lo, hi, 'stone', colors.shade);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, areaSign(outline));
    const u = w.length / 2;
    panel(out, 'trim', w, 0, w.length, hi - 0.19, hi + 0.04, 0.07, colors.trim);
    if (level >= 1)
      window(out, level, w, u, lo + 0.25, hi - 0.72, Math.min(0.67, w.length * 0.32), 0.44, true);
  }
}

function prayerHall(out, level) {
  const bounds = d.hallBounds;
  const [x0, z0, x1, z1] = bounds;
  const outline = rect(...bounds);
  const [x, z] = d.domeCenter;
  const dx = (x1 - x0) / 2;
  mass(out, outline, sunk, base + 14.2, 'stone', colors.limestone);
  const loftBounds = rect(x - 12.3, z - 12.2, x + 12.17, z + 12.16);
  mass(out, loftBounds, base + 13.9, base + 27.64, 'stone', colors.shade);
  const radius = d.domeDiameter / 2;
  drum(out, level, d.domeCenter, radius, base + 26.7, base + 29.24);
  dome(out, level, d.domeCenter, radius, base + 29.18, base + d.domeCrown, 'major');

  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * i) / 2,
      center = rad(d.domeCenter, angle, 10.6);
    const curve = Array.from({ length: level === 0 ? 5 : 11 }, (_, j) => {
      const n = level === 0 ? 4 : 10;
      return rad(center, angle - Math.PI / 2 + (Math.PI * j) / n, 9.0);
    });
    mass(out, curve, base + 13.99, base + 19.1, 'stone', colors.warm);
    dome(out, level, center, 9.03, base + 19.07, base + 25.9, 'half', angle);
    if (level >= 1) {
      for (const [a, b] of pairs(curve)) {
        const w = edge(a, b);
        window(
          out,
          level,
          w,
          w.length * 0.5,
          base + 15.88,
          base + 17.47,
          Math.min(0.62, w.length * 0.24),
          0.47,
        );
      }
    }
  }
  for (const ix of [-1, 1])
    for (const iz of [-1, 1]) {
      const cx = x + ix * 13.98,
        cz = z + iz * 13.5;
      mass(
        out,
        rect(cx - 3.6, cz - 3.49, cx + 3.6, cz + 3.49),
        base + 13.9,
        base + 16.25,
        'stone',
        colors.warm,
      );
      dome(out, level, [cx, cz], 3.57, base + 16.2, base + 19.45);
      const p = [x + ix * 9.14, z + iz * 9.14];
      round(
        out,
        'stone',
        p,
        [
          [base + 22.3, 2.15],
          [base + 27.18, 2.11],
          [base + 27.48, 2.24],
        ],
        level === 0 ? 5 : 12,
        colors.limestone,
      );
      dome(out, level, p, 2.24, base + 27.45, base + 29.27);
    }
  for (const [side, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b);
    panel(out, 'trim', w, 0, w.length, base + 13.94, base + 14.44, 0.12, colors.trim);
    const bins = side % 2 === 0 ? 7 : 6;
    for (let j = 0; j < bins; j++) {
      if (level === 0 && j % 2 === 1) continue;
      const u = ((j + 0.5) * w.length) / bins;
      window(out, level, w, u, base + 5.16, base + 8.73, 1.35, 1.34, j % 2 === 1);
      if (level >= 1) window(out, level, w, u, base + 1.43, base + 3.39, 1.14, 0.81);
      if (level >= 2)
        panel(out, 'trim', w, u - 1.45, u + 1.45, base + 4.83, base + 4.95, 0.108, colors.trim);
    }
    if (level >= 1) {
      const offset = side % 2 === 0 ? dx - 11.2 : 9.1;
      for (const u of [offset, w.length - offset]) {
        const [px, , pz] = w.p(u, 0, 0.57);
        block(out, 'stone', px - 0.78, base - 0.39, pz - 0.78, 1.56, 13.94, 1.56, colors.limestone);
      }
    }
  }
  const w = edge([x1, z1], [x0, z1]);
  const u = x1 - d.portalX;
  panel(out, 'trim', w, u - 3.05, u + 3.05, base, base + 10.55, 0.17, colors.trim);
  window(out, level, w, u, base + 0.17, base + 5.65, 1.52, 1.64, true);
  if (level > 1) {
    for (const dx of [-0.68, 0.68])
      panel(
        out,
        'trim',
        w,
        u + dx - 0.11,
        u + dx + 0.11,
        base + 6.52,
        base + 8.3,
        0.24,
        colors.shade,
      );
  }
}

function openArch(out, level, w, left, right, lo, spring, top) {
  const center = (left + right) / 2,
    r = (right - left) / 2;
  const rise = 1.09,
    n = [2, 4, 7, 10][level];
  let prev = [left, spring];
  for (let i = 1; i <= n; i++) {
    const angle = Math.PI * (1 - i / n);
    const cur = [center + r * Math.cos(angle), spring + rise * Math.sin(angle)];
    face(
      out,
      'stone',
      [w.p(prev[0], prev[1]), w.p(cur[0], cur[1]), w.p(cur[0], top), w.p(prev[0], top)],
      w.normal,
      colors.limestone,
    );
    if (level >= 1) {
      face(
        out,
        'trim',
        [
          w.p(prev[0], prev[1], 0.058),
          w.p(cur[0], cur[1], 0.058),
          w.p(cur[0] + (cur[0] - center) * 0.12, cur[1] + 0.14, 0.064),
          w.p(prev[0] + (prev[0] - center) * 0.12, prev[1] + 0.14, 0.064),
        ],
        w.normal,
        i % 2 === 0 ? colors.rose : colors.marble,
      );
    }
    prev = cur;
  }
  if (level >= 2) {
    panel(out, 'trim', w, left - 0.11, left, lo, spring, 0.06, colors.marble);
    panel(out, 'trim', w, right, right + 0.11, lo, spring, 0.06, colors.marble);
  }
}

function courtyard(out, level) {
  const [x0, z0, x1, z1] = d.courtBounds;
  const paving = rect(...d.courtBounds);
  mass(out, paving, sunk, base - 0.038, 'floor', colors.courtyard);
  const arms = [
    {
      inner: [
        [x0 + 6.6, 29.45],
        [x1 - 6.6, 29.45],
      ],
      outer: z1,
      axis: 1,
      n: 6,
    },
    {
      inner: [
        [x0 + 6.6, 2.3],
        [x0 + 6.6, 29.45],
      ],
      outer: x0,
      axis: 0,
      n: 5,
    },
    {
      inner: [
        [x1 - 6.6, 29.45],
        [x1 - 6.6, 2.3],
      ],
      outer: x1,
      axis: 0,
      n: 5,
    },
  ];
  const top = base + 5.8;
  for (const { inner, outer, axis, n } of arms) {
    const w = edge(...inner);
    const [p, q] = inner.map((point) => point.map((value, i) => (i === axis ? outer : value)));
    mass(out, [inner[0], inner[1], q, p], top - 0.21, top + 0.19, 'stone', colors.warm);
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * w.length) / n,
        width = w.length / n;
      const left = u - width * 0.43,
        right = u + width * 0.43;
      openArch(out, level, w, left, right, base, base + 3.44, top);
      const [px, , pz] = w.p((i * w.length) / n, 0, -0.045);
      block(out, 'stone', px - 0.37, base - 0.1, pz - 0.37, 0.74, 5.78, 0.74, colors.limestone);
      const [a, , b] = w.p(u, 0, 0);
      const center = axis === 0 ? [(a + outer) / 2, b] : [a, (b + outer) / 2];
      const r = Math.min(width * 0.45, 3.12);
      if (level !== 0 || i % 2 === 0) dome(out, level, center, r, top + 0.18, top + 2.34);
    }
    const [a, , b] = w.p(w.length, 0, -0.045);
    block(out, 'stone', a - 0.37, base - 0.13, b - 0.37, 0.74, 5.8, 0.74, colors.limestone);
    const shellWall = edge(p, q);
    if (axis === 0)
      panel(
        out,
        'stone',
        shellWall,
        0,
        shellWall.length,
        base - 0.15,
        top,
        0.015,
        colors.limestone,
      );
    else {
      const middle = shellWall.length * 0.5;
      panel(out, 'stone', shellWall, 0, middle - 2.1, base - 0.13, top, 0.015, colors.limestone);
      panel(
        out,
        'stone',
        shellWall,
        middle + 2.1,
        shellWall.length,
        base - 0.13,
        top,
        0.015,
        colors.limestone,
      );
      openArch(out, level, shellWall, middle - 2.1, middle + 2.1, base, base + 3.28, top);
    }
  }
  const [x, z] = d.fountain;
  const center = [x, z];
  round(
    out,
    'floor',
    center,
    [
      [base - 0.09, 2.42],
      [base + 0.2, 2.42],
      [base + 0.28, 2.02],
    ],
    8,
    colors.marble,
  );
  round(
    out,
    'glass',
    center,
    [
      [base + 0.26, 1.44],
      [base + 0.33, 1.43],
    ],
    8,
    colors.pool,
  );
  for (let i = 0; i < 8; i++) {
    const [x, z] = rad(center, (Math.PI * i) / 4 + Math.PI / 8, 1.84);
    round(
      out,
      'stone',
      [x, z],
      [
        [base + 0.27, 0.14],
        [base + 2.95, 0.14],
        [base + 3.08, 0.19],
      ],
      level >= 2 ? 8 : 4,
      colors.marble,
    );
  }
  dome(out, level, center, 2.22, base + 3.04, base + 4.06);
  if (level >= 2) finial(out, level, center, base + 4.06, 0.52);
}

function minaret(out, level, center) {
  const g = grade(center),
    h = g + d.minaretHeight;
  const n = [6, 8, 18, 30][level];
  const pedestal = sectionRing(...center, 2.26, 2.26, Math.PI / 4);
  mass(out, pedestal, g - 0.43, g + 5.39, 'stone', colors.shade);
  round(
    out,
    'stone',
    center,
    [
      [g + 4.65, 1.62],
      [g + 7.23, 1.24],
      [g + 33.92, 0.87],
    ],
    n,
    colors.limestone,
  );
  for (const y of d.balconies.map((v) => g + v)) {
    round(
      out,
      'stone',
      center,
      [
        [y - 0.95, 1.19],
        [y - 0.53, 1.42],
        [y - 0.18, 1.83],
        [y + 0.04, 1.93],
        [y + 0.2, 1.94],
        [y + 0.76, 1.85],
        [y + 0.86, 1.95],
      ],
      n,
      colors.warm,
    );
    if (level >= 1) {
      const count = [0, 7, 12, 24][level];
      for (let i = 0; i < count; i++) {
        const p = rad(center, (Math.PI * 2 * i) / count, 1.73);
        beam(out, 'trim', at(p, y + 0.12), at(p, y + 0.76), 0.11, 0.105, colors.trim);
      }
    }
  }
  round(
    out,
    'roof',
    center,
    [
      [g + 33.89, 0.92],
      [g + 36.79, 0.52],
      [h - 0.58, 0.066],
    ],
    n,
    colors.deepLead,
  );
  finial(out, level, center, h - 0.59, 0.59);
  if (level >= 2) {
    const count = level === 3 ? 12 : 7;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      for (const y of [g + 12.8, g + 16.6, g + 23.55, g + 30.06]) {
        const r = mix(1.24, 0.87, (y - g - 7.23) / 26.69);
        const p = rad(center, a, r + 0.055),
          q = rad(center, a + 0.15, r + 0.085);
        beam(out, 'trim', at(p, y - 0.54), at(q, y), 0.076, 0.075, colors.rose);
        beam(out, 'trim', at(q, y), at(p, y + 0.54), 0.076, 0.075, colors.rose);
      }
    }
  }
}
function mausoleum(out, level, tomb) {
  const { center, radius, sides, height, rise, open, fluted } = tomb;
  const y = grade(center);
  const ring = Array.from({ length: sides }, (_, i) =>
    rad(center, Math.PI * ((i * 2) / sides + 0.125), radius),
  );
  const eave = y + height;
  mass(out, ring, y - 0.33, y + 0.32, 'floor', colors.marble);
  if (open) {
    for (const [x, z] of ring)
      block(
        out,
        'stone',
        x - 0.29,
        y + 0.27,
        z - 0.29,
        0.58,
        height - 0.19,
        0.58,
        colors.limestone,
      );
    mass(out, ring, eave - 0.27, eave, 'stone', colors.limestone);
  } else {
    mass(out, ring, y + 0.29, eave, 'stone', colors.warm);
    for (const [i, [a, b]] of pairs(closed(ring)).entries()) {
      const w = edge(a, b, areaSign(ring));
      if (level !== 0 || i % 2 === 0)
        window(
          out,
          level,
          w,
          w.length / 2,
          y + 1.38,
          eave - 2.45,
          Math.min(1.02, w.length * 0.24),
          0.81,
          fluted,
        );
      if (level >= 1) {
        panel(out, 'trim', w, 0, w.length, eave - 0.36, eave + 0.07, 0.12, colors.marble);
        if (fluted) panel(out, 'trim', w, 0, w.length, y + 0.88, y + 1.12, 0.088, colors.rose);
      }
    }
  }
  dome(out, level, center, radius * 0.96, eave - 0.017, eave + rise, fluted ? 'ribbed' : 'small');
}
function build(out, level) {
  prayerHall(out, level);
  courtyard(out, level);
  for (const center of d.minarets) minaret(out, level, center);
  for (const tomb of d.tombs) mausoleum(out, level, tomb);
}
export function skyline(out) {
  const [x, z] = d.domeCenter;
  mass(out, rect(...d.hallBounds), sunk, base + 14.2, 'stone', colors.limestone);
  mass(
    out,
    rect(x - 12.3, z - 12.2, x + 12.17, z + 12.16),
    base + 14.1,
    base + 27.66,
    'stone',
    colors.shade,
  );
  round(
    out,
    'stone',
    d.domeCenter,
    [
      [base + 26.7, d.domeDiameter / 2],
      [base + 29.24, d.domeDiameter / 2],
    ],
    8,
    colors.shade,
  );
  dome(out, 0, d.domeCenter, d.domeDiameter / 2, base + 29.18, base + d.domeCrown, 'major');
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * i) / 2;
    const center = rad(d.domeCenter, angle, 10.6);
    const shoulder = Array.from({ length: 5 }, (_, j) =>
      rad(center, angle - Math.PI / 2 + (Math.PI * j) / 4, 9.0),
    );
    mass(out, shoulder, base + 13.99, base + 19.1, 'stone', colors.warm);
    dome(out, 0, center, 9.03, base + 19.07, base + 25.9, 'half', angle);
  }
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) {
      dome(out, 0, [x + dx * 13.98, z + dz * 13.5], 3.57, base + 14.22, base + 19.45);
      dome(out, 0, [x + dx * 9.14, z + dz * 9.14], 2.24, base + 27.28, base + 29.27);
    }
  for (const bounds of [
    [-18, 0, -11.4, 38.05],
    [20.8, 0, 27.4, 38.05],
    [-11.4, 29.45, 20.8, 38.05],
  ])
    mass(out, rect(...bounds), sunk, base + 5.81, 'stone', colors.warm);
  for (const px of [-14.8, 24.1])
    for (const pz of [6.7, 16.25, 25.8]) dome(out, 0, [px, pz], 2.55, base + 5.79, base + 8.14);
  for (const px of [-6.8, 5.06, 16.86]) dome(out, 0, [px, 33.2], 2.55, base + 5.82, base + 8.16);
  dome(out, 0, d.fountain, 2.22, base + 3.04, base + 4.06);
  round(
    out,
    'stone',
    d.fountain,
    [
      [base, 1.7],
      [base + 3.07, 1.7],
    ],
    4,
    colors.marble,
  );
  for (const center of d.minarets) {
    const y = grade(center);
    round(
      out,
      'stone',
      center,
      [
        [y - 0.27, 1.9],
        [y + 5.25, 1.78],
        [y + 7.28, 1.2],
        [y + 33.92, 0.87],
      ],
      4,
      colors.limestone,
    );
    for (const h of d.balconies)
      round(
        out,
        'stone',
        center,
        [
          [y + h - 0.62, 1.27],
          [y + h, 1.87],
          [y + h + 0.71, 1.84],
        ],
        4,
        colors.warm,
      );
    round(
      out,
      'roof',
      center,
      [
        [y + 33.89, 0.92],
        [y + d.minaretHeight, 0.045],
      ],
      4,
      colors.deepLead,
    );
  }
  for (const tomb of d.tombs) {
    const y = grade(tomb.center);
    round(
      out,
      'stone',
      tomb.center,
      [
        [y - 0.17, tomb.radius],
        [y + tomb.height, tomb.radius],
      ],
      tomb.sides,
      colors.warm,
    );
    dome(out, 0, tomb.center, tomb.radius * 0.96, y + tomb.height, y + tomb.height + tomb.rise);
  }
}
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'sehzade-mosque-model.mjs';
const camera = [131, 74, -156],
  lookAt = [5, 12.7, -33.9];
const errors = { district: 0.58, street: 0.19, closeup: 0.069 };
export const sehzadeMosqueAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  title: plan.title,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Native enclosure and courtyard levels with measured Ottoman massing and independent chief tomb point.',
  brief:
    'Sinan’s Şehzade Mosque with lead-covered central dome, four half-domes, two double-balconied minarets, arcaded court and nearby mausolea.',
  camera,
  lookAt,
  sunDirection: [84, 124, -72],
  mediumFiContext: {
    scale: 1,
    groundY: -0.7,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Native named Şehzade Mosque polygon covering the hall and forecourt.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_ashlar',
    'metal_standing_seam',
    'metal_bronze_cast',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'dome-cascade-and-tombs-from-street', position: [69, 38, -138], lookAt: [5, 14, -41] },
    { name: 'arcaded-court-and-fountain', position: [3, 15, 50], lookAt: [5, 9, 9] },
    {
      name: 'four-half-domes-and-counterweight-cupolas',
      position: [64, 66, -65],
      lookAt: [4, 22, -24],
    },
    { name: 'mehmed-and-neighboring-mausolea', position: [32, 18, -106], lookAt: [6, 6.9, -83] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sehzade-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.29,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
};
