import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  limestone: surface('wall', 'stone_limestone'),
  base: surface('foundation', 'stone_ashlar'),
  slate: surface('roof', 'metal_standing_seam', 0.77, 0.14),
  glass: surface('window', 'window_punched', 0.61),
  wood: surface('door', 'wood_plain'),
  bronze: surface('trim', 'metal_bronze_cast', 0.73, 0.24),
};
const C = palette({
  wall: 'bcb6ab',
  pearl: 'ccc6b8',
  eave: 'c2bcae',
  base: 'a9a294',
  louver: '6e6f68',
  glass: '696f70',
  timber: '6a5242',
  roof: '8c9594',
  roofDark: '7f8989',
  gray: '9a9b92',
  bronze: '6c7d73',
  dark: '6c665d',
});
const front = -23.59;
const center = -1.52;
const basementTop = 6.58;
const roofBase = 15.27;

function cornice(out, w, l, r, y, width, lod) {
  if (r - l < 0.22) return;
  if (lod === 0) {
    panel(out, 'limestone', w, l, r, y, y + width, 0.07, C.pearl);
    return;
  }
  trimBlock(out, 'limestone', w, l, r, y, y + width, -0.06, width * 0.77, C.pearl);
  if (lod >= 2)
    trimBlock(out, 'limestone', w, l, r, y + width * 0.79, y + width, -0.08, width, C.eave);
}

function dentils(out, w, l, r, y, lod) {
  if (lod < 2 || r - l < 2.2) return;
  const count = Math.ceil((r - l) / (lod === 3 ? 0.33 : 0.79));
  const step = (r - l) / count;
  for (let i = 0; i < count; i++) {
    const u = l + step * (i + 0.47);
    trimBlock(
      out,
      'limestone',
      w,
      u - step * 0.24,
      u + step * 0.24,
      y,
      y + 0.18,
      0.036,
      0.19,
      C.pearl,
    );
  }
}

function window(out, w, l, r, low, high, lod, offset = 0.052) {
  opening(out, w, l, r, low, high, 'wood', C.glass, 'glass', C.dark, lod, offset);
  if (lod >= 1) {
    const middle = mix(low, high, 0.67);
    for (const y of [middle, mix(low, high, 0.26)])
      panel(out, 'wood', w, l, r, y - 0.04, y + 0.04, offset + 0.049, C.timber);
  }
  if (lod >= 2) {
    for (const [y0, y1, amount] of [
      [low - 0.18, low - 0.03, 0.24],
      [high + 0.05, high + 0.18, 0.2],
    ])
      trimBlock(out, 'limestone', w, l - 0.13, r + 0.13, y0, y1, 0.01, amount, C.pearl);
  }
}

function rustication(out, w, grade, lod) {
  if (lod === 0) return;
  const spacing = lod === 1 ? 1.27 : 0.57;
  const [x, , z] = w.p(w.length / 2, 0);
  for (let y = 0.73; y < basementTop - 0.2; y += spacing) {
    if (y < grade([x, z]) - 0.37) continue;
    panel(out, 'base', w, 0.025, w.length - 0.025, y, y + 0.036, 0.044, C.dark);
  }
}

function tallBays(out, lod, outline, grade) {
  const sign = areaSign(outline);
  for (const [index, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b, sign);
    if (w.length < 0.31) continue;
    rustication(out, w, grade, lod);
    if (w.length > 1.2) {
      cornice(out, w, 0.03, w.length - 0.03, basementTop - 0.26, 0.28, lod);
      cornice(out, w, 0.03, w.length - 0.03, roofBase - 0.45, 0.42, lod);
    }
    if (index < 5 || index >= 30 || lod === 0) continue;
    const isApse = index >= 13 && index < 24;
    const pierBay = [6, 10, 25, 29].includes(index);
    const length = w.length;
    if (length < 1.2) continue;
    const n = isApse ? 1 : Math.max(1, Math.round(length / (pierBay ? 2.64 : 3.67)));
    const step = length / n;
    const half = Math.min(isApse ? 0.9 : 0.91, step * 0.35);
    for (let i = 0; i < n; i++) {
      const u = step * (i + 0.5);
      window(out, w, u - half, u + half, basementTop + 0.66, roofBase - 1.28, lod);
      if (lod >= 2) {
        const ground = grade([w.p(u, 0)[0], w.p(u, 0)[2]]);
        const lower = Math.max(1.1, ground + 0.47);
        if (lower + 1.02 < basementTop - 0.44)
          window(
            out,
            w,
            u - half * 0.74,
            u + half * 0.74,
            lower,
            Math.min(lower + 2.3, basementTop - 0.54),
            lod,
          );
      }
    }
    if (lod >= 2) {
      const xp = isApse ? 0.095 : 0.21,
        width = isApse ? 0.29 : 0.38;
      trimBlock(
        out,
        'limestone',
        w,
        xp,
        Math.min(length - 0.045, xp + width),
        basementTop + 0.09,
        roofBase - 0.46,
        0.012,
        0.21,
        C.pearl,
      );
      if (pierBay) dentils(out, w, 0.12, length - 0.12, roofBase - 0.54, lod);
    }
  }
}

function acroterion(out, w, u, y, scale, lod) {
  const r = scale * 0.52;
  const lobes = [
    [-r, 0.03],
    [-r * 0.95, scale * 0.26],
    [-r * 0.56, scale * 0.57],
    [-r * 0.34, scale * 0.72],
    [0, scale],
    [r * 0.34, scale * 0.72],
    [r * 0.56, scale * 0.57],
    [r * 0.95, scale * 0.26],
    [r, 0.03],
  ];
  for (const [[a, p], [b, q]] of pairs(lobes))
    face(
      out,
      'bronze',
      [w.p(u, y + 0.02, 0.13), w.p(u + a, y + p, 0.14), w.p(u + b, y + q, 0.14)],
      w.normal,
      C.bronze,
    );
  if (lod === 3)
    for (const i of [-1, 0, 1])
      beam(
        out,
        'bronze',
        w.p(u + i * 0.18, y, 0.18),
        w.p(u + i * 0.095, y + scale * 0.62, 0.18),
        0.044,
        0.051,
        C.gray,
      );
}

function pediment(out, w, l, r, y, h, depth, lod) {
  const u = (l + r) / 2;
  const bg = [w.p(l, y), w.p(r, y), w.p(u, y + h)];
  face(out, 'limestone', bg, w.normal, C.wall);
  const back = [w.p(l, y, -depth), w.p(r, y, -depth), w.p(u, y + h, -depth)];
  face(
    out,
    'limestone',
    back,
    w.normal.map((n) => -n),
    C.wall,
  );
  for (const [i, j] of [
    [0, 2],
    [2, 1],
  ]) {
    face(out, 'slate', [bg[i], bg[j], back[j], back[i]], up, C.roof);
    beam(
      out,
      'limestone',
      w.p(i === 0 ? l : u, i === 0 ? y : y + h, 0.12),
      w.p(j === 1 ? r : u, j === 1 ? y : y + h, 0.12),
      0.29,
      0.37,
      C.pearl,
    );
  }
  cornice(out, w, l - 0.155, r + 0.155, y - 0.25, 0.31, lod);
  if (lod > 0) {
    acroterion(out, w, u, y + h, 1.02, lod);
    for (const x of [l, r]) acroterion(out, w, x, y + 0.02, 0.5, lod);
  }
}

function rosette(out, w, center, y, r, lod) {
  const n = lod >= 3 ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = (t, radius, d) => w.p(center + radius * Math.cos(t), y + radius * Math.sin(t), d);
    const off = 0.18;
    face(
      out,
      'limestone',
      [
        w.p(center, y, off + 0.035),
        p(a, r * 0.56, off),
        p((a + b) / 2, r, off),
        p(b, r * 0.56, off),
      ],
      w.normal,
      i % 2 ? C.pearl : C.eave,
    );
  }
}

function column(out, x, z, low, high, lod, radius) {
  const n = [7, 8, 12, 16][lod];
  block(
    out,
    'limestone',
    x - radius * 1.34,
    low - 0.12,
    z - radius * 1.34,
    radius * 2.68,
    0.18,
    radius * 2.68,
    C.pearl,
  );
  ring(
    out,
    'limestone',
    [x, z],
    [
      [low, radius * 1.22],
      [low + 0.3, radius],
      [high - 0.51, radius * 0.83],
      [high - 0.38, radius],
      [high - 0.03, radius * 1.25],
    ],
    n,
    C.pearl,
  );
  if (lod === 3)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        p = [Math.cos(a), Math.sin(a)];
      beam(
        out,
        'limestone',
        [x + p[0] * radius, low + 0.24, z + p[1] * radius],
        [x + p[0] * radius * 0.83, high - 0.51, z + p[1] * radius * 0.83],
        0.022,
        0.025,
        C.eave,
      );
    }
}

function entrance(out, lod, grade, columns) {
  const lo = center - 6.81,
    hi = center + 6.81,
    z = front - 0.035;
  const w = plane(z, -1);
  const top = 18.63;
  block(
    out,
    'limestone',
    lo,
    roofBase - 0.22,
    z - 0.02,
    hi - lo,
    top - roofBase + 0.25,
    4.12,
    C.wall,
  );
  cornice(out, w, lo - 0.05, hi + 0.05, roofBase - 0.35, 0.43, lod);
  cornice(out, w, lo - 0.19, hi + 0.19, top - 0.51, 0.42, lod);
  dentils(out, w, lo + 0.1, hi - 0.1, top - 0.68, lod);
  pediment(out, w, lo - 0.38, hi + 0.38, top + 0.02, 2.85, 5.23, lod);

  if (lod > 0)
    for (let i = 0; i < 9; i++) rosette(out, w, mix(lo + 0.74, hi - 0.74, i / 8), 17.19, 0.39, lod);

  const reveal = plane(z - 0.02, -1);
  const step = 10.55 / 3;
  for (let i = 0; i < 3; i++) {
    const x = center + (i - 1) * step;
    window(
      out,
      reveal,
      x - step * 0.41,
      x + step * 0.41,
      basementTop + 0.25,
      roofBase - 1.1,
      lod,
      0.037,
    );
  }
  const shaftDepth = z - 0.38;
  for (let i = 0; i < columns; i++)
    column(
      out,
      center + (i - (columns - 1) / 2) * step,
      shaftDepth,
      basementTop + 0.36,
      roofBase - 1.24,
      lod,
      0.46,
    );
  for (const x of [lo + 0.24, hi - 0.24]) {
    trimBlock(
      out,
      'limestone',
      w,
      x - 0.51,
      x + 0.51,
      basementTop + 0.13,
      roofBase - 0.68,
      -0.01,
      0.44,
      C.pearl,
    );
    if (lod > 0)
      trimBlock(
        out,
        'limestone',
        w,
        x - 0.59,
        x + 0.59,
        roofBase - 1.19,
        roofBase - 0.69,
        0.09,
        0.47,
        C.eave,
      );
  }
  cornice(out, w, lo, hi, basementTop + 0.03, 0.29, lod);
  cornice(out, w, lo, hi, roofBase - 1.28, 0.39, lod);

  const topStep = Math.max(0.44, grade([center, front - 0.24]) + 0.43);
  const door = 1.62;
  opening(
    out,
    w,
    center - door,
    center + door,
    topStep,
    topStep + 3.75,
    'limestone',
    C.timber,
    'wood',
    C.pearl,
    lod,
    0.09,
  );
  trimBlock(
    out,
    'limestone',
    w,
    center - 1.91,
    center + 1.91,
    topStep + 3.78,
    topStep + 4.64,
    0.03,
    0.33,
    C.pearl,
  );
  if (lod >= 2)
    for (const x of [-1.04, 0, 1.04]) rosette(out, w, center + x, topStep + 4.18, 0.28, lod);
  for (const x of [center - 4.28, center + 4.28])
    window(out, w, x - 0.63, x + 0.63, Math.max(topStep, 1.03), 4.35, lod, 0.086);
  for (const x of [-10.57, 8.12]) {
    const wing = plane(-19.6, -1);
    window(out, wing, x - 0.65, x + 0.65, basementTop + 0.64, roofBase - 2.13, lod);
    if (lod >= 1) window(out, wing, x - 0.57, x + 0.57, 1.34, 4.9, lod);
  }
  stairs(
    out,
    grade,
    'limestone',
    center - 3.02,
    center + 3.02,
    front - 3.44,
    front - 0.13,
    topStep,
    lod > 1 ? 5 : 3,
    C.base,
  );
}

function roofRange(out, lod, x0, x1, frontZ, backZ, y, ridgeY) {
  const mid = (x0 + x1) / 2;
  for (const x of [x0, x1])
    face(
      out,
      'slate',
      [
        [x, y, frontZ],
        [mid, ridgeY, frontZ],
        [mid, ridgeY, backZ],
        [x, y, backZ],
      ],
      up,
      C.roof,
    );
  for (const [z, n] of [
    [frontZ, -1],
    [backZ, 1],
  ])
    face(
      out,
      'limestone',
      [
        [x0, y, z],
        [x1, y, z],
        [mid, ridgeY, z],
      ],
      [0, 0, n],
      C.wall,
    );
  if (lod > 0)
    beam(out, 'slate', [mid, ridgeY, frontZ], [mid, ridgeY, backZ], 0.14, 0.17, C.roofDark);
}

function roofscape(out, lod, outline, apse) {
  roofRange(out, lod, -11.76, 9.55, -20.04, 11.66, roofBase - 0.041, 18.65);
  for (const [i, offset] of [
    [6, 0.29],
    [10, 0.27],
    [25, 0.27],
    [29, 0.23],
  ]) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const w = edge(a, b, areaSign(outline));
    const rise = i === 6 || i === 29 ? 1.84 : 1.44;
    pediment(out, w, -offset, w.length + offset, roofBase - 0.005, rise, 2.15, lod);
  }
  const mid = [-1.1, 11.69];
  const eave = roofBase - 0.08,
    ridge = eave + 3.06;
  for (const [a, b] of pairs(apse)) {
    const [x, z] = a,
      [u, v] = b;
    face(
      out,
      'slate',
      [
        [x, eave, z],
        [u, eave, v],
        [mid[0], ridge, mid[1]],
      ],
      up,
      C.roofDark,
    );
    if (lod === 3) beam(out, 'slate', [x, eave, z], [mid[0], ridge, mid[1]], 0.07, 0.072, C.gray);
  }
  for (const [x, z, h, w, d] of [
    [-10.09, -12.7, 4.7, 1.37, 1.48],
    [7.8, -5.3, 4.1, 1.29, 1.43],
    [-9.4, 7.4, 3.8, 1.1, 1.38],
  ]) {
    block(out, 'limestone', x, roofBase - 0.35, z, w, h, d, C.wall);
    if (lod > 0)
      block(
        out,
        'limestone',
        x - 0.11,
        roofBase + h - 0.56,
        z - 0.1,
        w + 0.22,
        0.24,
        d + 0.2,
        C.pearl,
      );
  }
}

function build(out, lod, d, grade) {
  shell(out, d.outline, (p) => grade(p) - 0.45, basementTop, {
    wall: 'base',
    color: C.base,
    roofColor: C.base,
  });
  shell(out, d.outline, () => basementTop, roofBase, {
    wall: 'limestone',
    color: C.wall,
    roof: 'slate',
    roofColor: C.roof,
  });
  tallBays(out, lod, d.outline, grade);
  entrance(out, lod, grade, d.upperCentralColumns);
  roofscape(out, lod, d.outline, d.apse);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'McGill’s standing 1882 Redpath Museum, with a limestone Classical Revival portico raised over a banded base, side pediments, tall windows, and the rounded glazed rear gallery.',
    camera: [31, 20, -56],
    lookAt: [-1.5, 10.7, -4.5],
    sun: [-270, 410, -550],
    yaw: -0.72,
    views: [
      { name: 'limestone-temple-front', position: [-1.6, 9, -48], lookAt: [-1.55, 11, -23] },
      { name: 'side-porticoes', position: [37, 19, -16], lookAt: [8.4, 10, -1.5] },
      { name: 'rounded-rear-gallery', position: [18, 20, 52], lookAt: [-1.5, 10, 14] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Replace the overlapping generic mass only within the mapped Redpath Museum outline.',
};
