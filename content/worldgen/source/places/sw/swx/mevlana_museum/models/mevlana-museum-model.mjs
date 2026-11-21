import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  stone: 'b1a28f',
  pale: 'c1b39d',
  trim: 'c7b99e',
  shade: '988978',
  pink: 'a28a76',
  lead: '9b9b8b',
  roof: '777c73',
  dark: '454847',
  glass: '575b55',
  wood: '6e6150',
  turquoise: '458f88',
  turquoiseLight: '64a49b',
  turquoiseShade: '437e7b',
  lapis: '3b5667',
  gold: 'b49a64',
  water: '718b81',
  paving: 'bfb5a2',
});
const surfaces = {
  wall: surface('wall', 'stone_ashlar', 0.94),
  trim: surface('trim', 'stone_sandstone', 0.91),
  lead: surface('roof', 'metal_painted', 0.86, 0.13),
  tile: surface('trim', 'tile_glazed', 0.65, 0.06),
  window: surface('window', 'storefront', 0.7, 0.04),
  wood: surface('door', 'wood_plain', 0.9),
  ornament: surface('trim', 'metal_painted', 0.72, 0.32),
};
const masonry = { wall: 'wall', roof: 'lead', color: color.stone, roofColor: color.lead };
const archColors = { inner: color.dark, trim: color.trim, width: 0.14 };
const archSlots = { inner: 'window', trim: 'trim' };

function radial(center, r, n, phase = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (2 * Math.PI * i) / n;
    return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
  });
}
function radialShell(out, center, profile, count, material, tint, phase = 0) {
  for (const [[base, r], [top, rt]] of pairs(profile)) {
    const ring = radial(center, r, count, phase),
      above = radial(center, rt, count, phase);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const w = edge(ring[i], ring[j]);
      const target = [w.normal[0], r - rt, w.normal[2]];
      face(
        out,
        material,
        [at(ring[i], base), at(ring[j], base), at(above[j], top), at(above[i], top)],
        target,
        typeof tint === 'function' ? tint(i) : tint,
      );
    }
  }
  const [y, r] = profile.at(-1);
  cap(
    out,
    material,
    radial(center, r, count, phase),
    y,
    typeof tint === 'function' ? tint(0) : tint,
  );
}
function dome(out, center, start, rise, radius, lod, refined = false) {
  const fractions =
    lod === 0
      ? [0, 0.69, 0.98]
      : lod === 1
        ? [0, 0.38, 0.69, 0.94, 0.995]
        : [0, 0.22, 0.42, 0.61, 0.77, 0.89, 0.96, 0.995];
  const profile = fractions.map((h) => [start + rise * h, radius * Math.sqrt(1 - h * h)]);
  const n = refined ? [8, 12, 16, 24][lod] : [6, 8, 12, 14][lod];
  radialShell(out, center, profile, n, 'lead', (i) => (i % 5 === 0 ? color.roof : color.lead));
  if (!refined) return;
  radialShell(
    out,
    center,
    [
      [start + rise - 0.02, 0.21],
      [start + rise + 0.21, 0.19],
      [start + rise + 0.44, 0.12],
      [start + rise + 0.59, 0.035],
    ],
    8,
    'ornament',
    color.gold,
  );
}
function octagonalRoom(out, center, radius, low, top, roof, lod) {
  const oct = radial(center, radius, 8, Math.PI / 8);
  shell(out, oct, () => low, top, masonry);
  radialShell(
    out,
    center,
    [
      [top - 0.18, radius + 0.13],
      [top + 0.04, radius + 0.13],
      [top + 0.1, radius],
    ],
    8,
    'trim',
    color.trim,
    Math.PI / 8,
  );
  if (lod > 0 && roof > 1.4) {
    for (const [a, b] of pairs(closed(oct))) {
      const w = edge(a, b),
        m = w.length / 2;
      arch(out, w, m, top - 1.43, top - 0.99, 0.38, 0.37, 0.025, lod, archColors, archSlots);
    }
  }
  dome(out, center, top + 0.09, roof, radius * 0.955, lod, roof > 2.1);
}

function bodyWalls(out, outline, y, eaves, lod, ground, group) {
  const s = areaSign(outline);
  for (const [index, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b, s);
    const ba = Math.min(ground(a) - 0.25, y - 0.24),
      bb = Math.min(ground(b) - 0.25, y - 0.24);
    face(
      out,
      'wall',
      [at(a, ba), at(b, bb), at(b, eaves), at(a, eaves)],
      w.normal,
      index % 4 === 0 ? color.pale : color.stone,
    );
    panel(out, 'trim', w, 0, w.length, eaves - 0.27, eaves, 0.09, color.trim);
    if (lod === 0 || w.length < 3.5) continue;
    panel(out, 'trim', w, 0, w.length, y + 0.22, y + 0.45, 0.06, color.shade);
    if (group === 'cells' && w.normal[0] < 0.15 && w.normal[2] < 0.15) continue;
    const n = Math.max(1, Math.round(w.length / (group === 'cells' ? 4.3 : 5.6)));
    for (let i = 0; i < n; i++) {
      const u = (w.length * (i + 0.5)) / n;
      opening(
        out,
        w,
        u - 0.48,
        u + 0.48,
        y + 1.13,
        y + 2.8,
        'trim',
        color.glass,
        'window',
        color.trim,
        lod,
        0.037,
      );
      if (group === 'main' && lod > 1)
        arch(out, w, u, eaves - 2.4, eaves - 1.75, 0.44, 0.47, 0.029, lod, archColors, archSlots);
    }
  }
  cap(out, 'lead', outline, eaves, color.lead);
}
function room(out, bounds, y, top) {
  const p = rect(...bounds);
  shell(out, p, () => y, top, masonry);
  const c = planarMid(p);
  const upper = p.map(([x, z]) => [mix(x, c[0], 0.13), mix(z, c[1], 0.14)]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    face(
      out,
      'lead',
      [
        at(p[i], top - 0.08),
        at(p[j], top - 0.08),
        at(upper[j], top + 0.85),
        at(upper[i], top + 0.85),
      ],
      up,
      color.roof,
    );
  }
  cap(out, 'lead', upper, top + 0.85, color.lead);
}
function greenCourse(out, center, r, y, profile, lod, slot = 'tile') {
  const lobes = lod === 0 ? 8 : 16;
  const steps = lod === 0 ? 2 : lod === 1 ? 3 : lod === 2 ? 4 : 6;
  const n = lobes * steps;
  const point = (height, scale, i) => {
    const phase = (i / n) * 2 * Math.PI,
      valley = (i / steps) * 2 * Math.PI;
    const radius = r * scale * (0.94 - 0.06 * Math.cos(valley));
    return [center[0] + radius * Math.cos(phase), y + height, center[1] + radius * Math.sin(phase)];
  };
  for (const [[low, size], [high, end]] of pairs(profile)) {
    for (let i = 0; i < n; i++) {
      const p = point(low, size, i),
        q = point(low, size, i + 1),
        u = point(high, end, i + 1),
        v = point(high, end, i);
      const mid = ((i + 0.5) / n) * 2 * Math.PI;
      const band =
        slot === 'tile'
          ? color.turquoiseShade.map((value, k) =>
              mix(value, color.turquoiseLight[k], 0.34 + ((i % steps) / steps) * 0.49),
            )
          : color.trim;
      face(out, slot, [p, q, u, v], [Math.cos(mid), Math.max(0, size - end), Math.sin(mid)], band);
    }
  }
}
function greenTower(out, d, lod) {
  const { greenCenter: center, greenRadius: r, floor: y } = d;
  const base = radial(center, r * 0.99, 8, Math.PI / 8);
  shell(out, base, () => y + 5.07, y + 9.01, masonry);
  radialShell(
    out,
    center,
    [
      [y + 8.43, r],
      [y + 8.94, r],
      [y + 9.29, r * 0.955],
    ],
    16,
    'trim',
    color.trim,
  );
  greenCourse(
    out,
    center,
    r,
    y,
    [
      [9.23, 0.962],
      [10.13, 0.97],
      [10.31, 1.0],
      [17.72, 1.0],
      [18.02, 1.02],
    ],
    lod,
  );
  radialShell(
    out,
    center,
    [
      [y + 17.84, r * 1.01],
      [y + 18.39, r * 1.025],
    ],
    lod === 0 ? 12 : 32,
    'tile',
    color.lapis,
  );
  const bandStart = y + 17.92;
  if (lod > 1) {
    const n = lod === 2 ? 24 : 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI,
        b = ((i + 1) / n) * 2 * Math.PI;
      const arm = (p, h, rad) => [center[0] + rad * Math.cos(p), h, center[1] + rad * Math.sin(p)];
      const m = (a + b) / 2,
        rad = r * 1.027;
      const pattern = [
        arm(a, bandStart + 0.18, rad),
        arm(m, bandStart + 0.36, rad),
        arm(b, bandStart + 0.18, rad),
        arm(m, bandStart + 0.06, rad),
      ];
      face(
        out,
        'tile',
        pattern,
        [Math.cos(m), 0, Math.sin(m)],
        i % 3 === 1 ? color.turquoiseLight : color.trim,
      );
    }
  }
  radialShell(
    out,
    center,
    [
      [y + 18.39, r * 1.04],
      [y + 18.66, r * 1.065],
      [y + 18.8, r * 1.025],
    ],
    lod === 0 ? 12 : 32,
    'trim',
    color.trim,
  );
  greenCourse(
    out,
    center,
    r,
    y,
    [
      [18.75, 1.027],
      [19.8, 0.82],
      [21.76, 0.51],
      [23.34, 0.253],
      [24.28, 0.057],
      [24.34, 0.037],
    ],
    lod,
  );
  radialShell(
    out,
    center,
    [
      [y + 24.26, 0.19],
      [y + 24.56, 0.14],
      [y + 24.71, 0.085],
      [y + d.greenHeight, 0.024],
    ],
    8,
    'ornament',
    color.gold,
  );
  if (lod > 1)
    beam(
      out,
      'ornament',
      [center[0] - 0.27, y + 24.69, center[1]],
      [center[0] + 0.23, y + 24.69, center[1]],
      0.048,
      0.057,
      color.gold,
    );
}
function minaret(out, d, lod) {
  const { minaret, minaretHeight, floor: y } = d;
  const n = [8, 10, 14, 18][lod];
  radialShell(
    out,
    minaret,
    [
      [y + 5.4, 1.51],
      [y + 8.0, 1.47],
      [y + 9.7, 1.21],
      [y + 15.38, 0.94],
      [y + 16.0, 1.12],
      [y + 16.56, 1.63],
      [y + 17.31, 1.64],
    ],
    n,
    'wall',
    color.pale,
  );
  radialShell(
    out,
    minaret,
    [
      [y + 15.92, 1.12],
      [y + 16.18, 1.27],
    ],
    n,
    'tile',
    color.turquoise,
  );
  radialShell(
    out,
    minaret,
    [
      [y + 16.68, 1.67],
      [y + 16.85, 1.69],
      [y + 17.35, 1.67],
    ],
    n,
    'trim',
    color.trim,
  );
  radialShell(
    out,
    minaret,
    [
      [y + 17.22, 0.97],
      [y + 20.42, 0.85],
      [y + 20.71, 0.86],
    ],
    n,
    'wall',
    color.pale,
  );
  radialShell(
    out,
    minaret,
    [
      [y + 20.48, 0.9],
      [y + 20.95, 0.9],
    ],
    n,
    'tile',
    color.turquoise,
  );
  radialShell(
    out,
    minaret,
    [
      [y + 20.89, 0.95],
      [y + 22.1, 0.79],
      [y + 24.76, 0.25],
      [y + minaretHeight - 0.34, 0.055],
    ],
    n,
    'lead',
    color.roof,
  );
  radialShell(
    out,
    minaret,
    [
      [y + minaretHeight - 0.43, 0.15],
      [y + minaretHeight - 0.18, 0.13],
      [y + minaretHeight, 0.018],
    ],
    8,
    'ornament',
    color.gold,
  );
}
function courtyardPortal(out, y, lod) {
  const w = edge([-21.85, 4.9], [-21.85, -15.7], 1);
  for (const c of [4, 10.3, 16.8]) {
    arch(
      out,
      w,
      c,
      y + 0.16,
      y + 3.78,
      1.55,
      1.62,
      0.08,
      lod,
      { ...archColors, width: 0.27 },
      archSlots,
    );
    if (lod > 1) {
      for (const x of [c - 1.68, c + 1.68])
        panel(out, 'trim', w, x - 0.14, x + 0.14, y + 0.16, y + 3.88, 0.14, color.trim);
      panel(out, 'wood', w, c - 1.13, c + 1.13, y + 0.3, y + 3.51, 0.12, color.wood);
    }
  }
}
function mainGroup(out, d, ground, lod) {
  const y = d.floor;
  bodyWalls(out, d.outline, y, y + 6.65, lod, ground, 'main');
  room(out, [-18.9, -18.7, -1.1, 4.49], y + 6.4, y + 8.05);
  room(out, [-0.8, -18.55, 20.5, 5.55], y + 6.4, y + 9.17);
  room(out, [-9.95, 5.98, 15.54, 14.9], y + 6.36, y + 8.02);
  octagonalRoom(out, [-8.72, -9.9], 5.99, y + 7.3, y + 9.58, 3.06, lod);
  octagonalRoom(out, [8.95, -10.22], 7.34, y + 8.9, y + 12.03, 3.51, lod);
  for (const item of [
    [-6.39, 5.22, 3.39],
    [3.12, 1.78, 3.15],
    [12.04, 10.43, 3.42],
    [12.7, 0.75, 3.1],
  ]) {
    const [x, z, r] = item;
    octagonalRoom(out, [x, z], r, y + 6.92, y + 8.41, 1.5, lod);
  }
  courtyardPortal(out, y, lod);
  greenTower(out, d, lod);
  minaret(out, d, lod);
}
const cellCenters = [
  ...Array.from({ length: 12 }, (_, i) => [-46.8, -25.7 + 3.56 * i]),
  ...Array.from({ length: 6 }, (_, i) => [-42.6 + 3.58 * i, -25.56]),
];
function lodge(out, d, ground, lod) {
  const y = d.floor;
  bodyWalls(out, d.cells, y, y + 3.94, lod, ground, 'cells');
  for (const [i, p] of cellCenters.entries()) {
    if (lod === 0 && i % 3) continue;
    dome(out, p, y + 3.85, 0.92, 1.39, lod === 0 ? 0 : 1, false);
    if (lod > 1)
      block(out, 'wall', p[0] - 0.55, y + 3.82, p[1] - 1.3, 0.47, 0.57, 0.48, color.pink);
  }
  room(out, [-49.7, 17.55, -31.5, 25.1], y + 3.81, y + 5.4);
  room(out, [-47.37, 26.23, -31.32, 37.34], y + 3.82, y + 5.68);
}
function smallTomb(out, outline, y, height, roof, ground, lod) {
  const center = planarMid(outline);
  shell(out, outline, (p) => Math.min(ground(p) - 0.21, y - 0.18), y + height, masonry);
  const radius =
    Math.min(...outline.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1]))) * 0.94;
  const ledge = outline.map((p) => [
    center[0] + (p[0] - center[0]) * 1.022,
    center[1] + (p[1] - center[1]) * 1.022,
  ]);
  shell(out, ledge, () => y + height - 0.2, y + height + 0.04, {
    wall: 'trim',
    color: color.trim,
    roofColor: color.trim,
  });
  dome(out, center, y + height + 0.03, roof, radius, lod, true);
  if (lod > 0) {
    for (const [a, b] of pairs(closed(outline))) {
      const w = edge(a, b, areaSign(outline));
      if (w.length < 1.65) continue;
      const u = w.length / 2;
      arch(out, w, u, y + 0.64, y + 2.12, 0.46, 0.46, 0.028, lod, archColors, archSlots);
    }
  }
}
function courtyardFountain(out, outline, y, lod) {
  const center = planarMid(outline);
  cap(out, 'trim', outline, y + 0.13, color.trim);
  const columns = radial(center, 3.53, 8, Math.PI / 8);
  for (const [x, z] of columns)
    radialShell(
      out,
      [x, z],
      [
        [y + 0.11, 0.24],
        [y + 0.36, 0.2],
        [y + 3.38, 0.155],
        [y + 3.59, 0.28],
      ],
      lod < 2 ? 6 : 8,
      'trim',
      color.trim,
    );
  radialShell(
    out,
    center,
    [
      [y + 3.53, 3.88],
      [y + 3.68, 4.06],
      [y + 3.87, 3.93],
    ],
    lod < 2 ? 12 : 24,
    'trim',
    color.trim,
  );
  dome(out, center, y + 3.8, 1.24, 3.9, lod, true);
  radialShell(
    out,
    center,
    [
      [y + 0.15, 1.92],
      [y + 0.26, 1.98],
      [y + 0.68, 1.84],
      [y + 0.7, 1.69],
    ],
    lod < 2 ? 10 : 16,
    'trim',
    color.pale,
  );
  cap(out, 'lead', radial(center, 1.62, lod < 2 ? 10 : 16), y + 0.59, color.water);
}
function drawOverview(out, d, ground, lod) {
  const y = d.floor;
  const profile = [
    [y + 9.07, d.greenRadius * 0.91],
    [y + 17.94, d.greenRadius],
    [y + 18.62, d.greenRadius * 1.03],
  ];
  bodyWalls(out, d.outline, y, y + 6.65, 0, ground, 'main');
  bodyWalls(out, d.cells, y, y + 3.94, 0, ground, 'cells');
  if (lod === 0) {
    block(out, 'wall', -14.3, y + 6.6, -15.6, 12.0, 2.98, 12.0, color.stone);
    block(out, 'wall', 2.05, y + 6.6, -17.4, 13.8, 5.43, 14.0, color.stone);
    dome(out, [-8.72, -9.9], y + 9.58, 3.06, 5.9, 0);
    dome(out, [8.95, -10.22], y + 12.03, 3.51, 7.14, 0);
  } else {
    room(out, [-18.9, -18.7, -1.1, 4.49], y + 6.4, y + 8.05);
    room(out, [-0.8, -18.55, 20.5, 5.55], y + 6.4, y + 9.17);
    room(out, [-9.95, 5.98, 15.54, 14.9], y + 6.36, y + 8.02);
    octagonalRoom(out, [-8.72, -9.9], 5.99, y + 7.3, y + 9.58, 3.06, 0);
    octagonalRoom(out, [8.95, -10.22], 7.34, y + 8.9, y + 12.03, 3.51, 0);
    for (const [x, z, r] of [
      [-6.39, 5.22, 3.39],
      [12.04, 10.43, 3.42],
    ])
      dome(out, [x, z], y + 8.19, 1.61, r, 0);
  }
  if (lod === 0) {
    radialShell(out, d.greenCenter, profile, 10, 'tile', color.turquoise);
    radialShell(
      out,
      d.greenCenter,
      [
        [y + 18.64, d.greenRadius * 1.03],
        [y + 24.41, 0.07],
      ],
      10,
      'tile',
      color.turquoise,
    );
    radialShell(
      out,
      d.minaret,
      [
        [y + 6.4, 1.45],
        [y + 16.2, 1.11],
        [y + 16.8, 1.68],
        [y + 17.19, 1.68],
        [y + 17.22, 0.93],
        [y + 20.88, 0.83],
      ],
      7,
      'wall',
      color.pale,
    );
    radialShell(
      out,
      d.minaret,
      [
        [y + 20.83, 0.96],
        [y + d.minaretHeight, 0.046],
      ],
      7,
      'lead',
      color.roof,
    );
  } else {
    greenTower(out, d, 1);
    minaret(out, d, 1);
    courtyardPortal(out, y, 1);
  }
  for (let i = 0; i < cellCenters.length; i += lod === 0 ? 6 : 1)
    dome(out, cellCenters[i], y + 3.87, 0.91, 1.38, 0);
  room(out, [-49.7, 17.55, -31.5, 25.1], y + 3.81, y + 5.4);
  room(out, [-47.37, 26.23, -31.32, 37.34], y + 3.82, y + 5.68);
  const center = planarMid(d.fountain);
  for (const [x, z] of radial(center, 3.52, lod === 0 ? 4 : 6))
    block(out, 'trim', x - 0.2, y + 0.11, z - 0.2, 0.4, 3.62, 0.4, color.trim);
  dome(out, center, y + 3.78, 1.25, 3.93, 0);
  for (const [outline, height, rise] of [
    [d.sinan, 5.54, 2.16],
    [d.fatma, 5.94, 2.35],
    [d.hasan, 5.42, 1.96],
  ]) {
    const center = planarMid(outline);
    shell(out, outline, (p) => Math.min(y - 0.18, ground(p) - 0.2), y + height, masonry);
    const radius =
      Math.min(...outline.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1]))) * 0.94;
    dome(out, center, y + height, rise, radius, lod === 0 ? 0 : 1);
  }
}
function draw(out, lod, d, ground) {
  if (lod < 2) {
    drawOverview(out, d, ground, lod);
    return;
  }
  const y = d.floor;
  mainGroup(out, d, ground, lod);
  lodge(out, d, ground, lod);
  courtyardFountain(out, d.fountain, y, lod);
  smallTomb(out, d.sinan, y, 5.54, 2.16, ground, lod);
  smallTomb(out, d.fatma, y, 5.94, 2.35, ground, lod);
  smallTomb(out, d.hasan, y, 5.42, 1.96, ground, lod);
}
const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-75, 58, 73],
    lookAt: [-12, 9, 4],
    yaw: -0.68,
    sun: [-100, 165, 107],
    brief:
      'The standing Mevlâna Museum in Konya, with its turquoise sixteen-fluted tower, lead domes, single minaret and dervish-cell court.',
    views: [
      { name: 'turquoise-green-dome-and-semahane', position: [49, 19, 39], lookAt: [0, 11, 5] },
      { name: 'court-fountain-and-dervish-cells', position: [-31, 15, 40], lookAt: [-35, 4, -9] },
      { name: 'historic-courtyard-and-tombs', position: [-44, 26, 43], lookAt: [-11, 7, 3] },
      {
        name: 'sixteen-tiled-flutes-and-single-minaret',
        position: [34, 23, 32],
        lookAt: [-3, 16, 3],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const d = plan.dimensions;
export const model = {
  ...museum.model,
  category: 'religious',
  recipeDependencies: [...museum.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Original museum exterior geometry derived from the exact CC0 Qualla photograph, mapped museum rooflines and documented architectural dimensions.',
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.cells, d.fountain, d.sinan, d.fatma, d.hasan],
    basis:
      'Six separately mapped museum roofs replace only coincident generated structures. Neighboring Selimiye Mosque is a distinct feature.',
  },
};
