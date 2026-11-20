import {
  arch,
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  base: surface('foundation', 'stone_ashlar'),
  stone: surface('wall', 'stone_sandstone'),
  band: surface('trim', 'stone_limestone'),
  court: surface('roof', 'stone_sandstone'),
  brick: surface('wall', 'brick'),
  shade: surface('wall', 'stone_sandstone'),
};
const C = palette({
  base: '665e49',
  stone: '84735a',
  aged: '6f604b',
  rim: '8c7d61',
  upper: '938064',
  court: '8a7c61',
  wear: '716a52',
  void: '403a30',
  brick: 'a38263',
  dim: '786a53',
  cap: 'a79777',
});
const ashlar = [C.stone, C.aged, C.rim, C.upper, C.wear];
const course = (seed, i, j = 0) => ashlar[((seed * 37 + i * 19 + j * 11) >>> 0) % ashlar.length];

function frame({ center, eastAngle }) {
  const c = Math.cos(eastAngle),
    s = Math.sin(eastAngle);
  const q = ([x, z]) => [center[0] + x * c - z * s, center[1] + x * s + z * c];
  return { q, box: (...args) => rect(...args).map(q) };
}

function slab(out, box, bottom, top, slot, color, capSlot = slot, capColor = color) {
  shell(out, box, typeof bottom === 'function' ? bottom : () => bottom, top, {
    wall: slot,
    color,
    roof: capSlot,
    roofColor: capColor,
  });
}

function joints(out, p, bottom, top, lod, seed, offset = 0.021) {
  const sign = areaSign(p);
  for (const [[a, b], side] of pairs(closed(p)).map((v, i) => [v, i])) {
    const w = edge(a, b, sign);
    const rows = lod < 2 ? 1 : Math.max(2, Math.round((top - bottom) / (lod === 2 ? 0.57 : 0.39)));
    const columns = lod < 2 ? 1 : Math.max(2, Math.round(w.length / (lod === 2 ? 4.9 : 2.55)));
    for (let row = 0; row < rows; row++) {
      const y0 = mix(bottom, top, row / rows),
        y1 = mix(bottom, top, (row + 1) / rows);
      for (let i = 0; i < columns; i++) {
        const u1 = mix(0, w.length, i / columns),
          u2 = mix(0, w.length, (i + 1) / columns);
        if (u2 - u1 < 0.1 || y1 - y0 < 0.06) continue;
        panel(
          out,
          'stone',
          w,
          u1 + 0.023,
          u2 - 0.023,
          y0 + 0.017,
          y1 - 0.028,
          offset,
          course(seed + side, i, row),
        );
      }
    }
  }
}

function flight(out, box, x0, x1, breadth, high, start, lod, rails = true) {
  const n = [2, 12, 20, 23][lod];
  for (let i = 0; i < n; i++) {
    const a = mix(x0, x1, i / n),
      b = mix(x0, x1, (i + 1) / n);
    slab(
      out,
      box(a, -breadth / 2, b, breadth / 2),
      start - 0.16,
      mix(high, start, (i + 0.28) / n),
      'stone',
      course(4, i),
      'court',
      C.rim,
    );
  }
  if (!rails) return;
  for (const side of [-1, 1]) {
    const z = (side * breadth) / 2,
      p = box(x0, z - 0.34, x1, z + 0.34);
    const low = (i) => i === 0 || i === 3;
    const t = p.map((q, i) => at(q, (low(i) ? high : start) + 0.33));
    const b = p.map((q) => at(q, start - 0.19));
    const sign = areaSign(p);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(out, 'base', [b[i], b[j], t[j], t[i]], edge(p[i], p[j], sign).normal, C.aged);
    }
    face(out, 'band', t, up, C.rim);
  }
}

function terracedShrines(out, q, lo, hi, level, faceWidth, lod) {
  // Preserve the pattern of compact votive stupas and end pinnacles. Irregular empty stretches show loss.
  const rhythm = [17.5, 4.6, 2.52, 1.84][lod];
  const r = 0.67 - level * 0.063,
    h = 1.61 - level * 0.102;
  const sides = [
    [lo, -faceWidth, lo, faceWidth],
    [-faceWidth, lo, faceWidth, lo],
    [-faceWidth, hi, faceWidth, hi],
    [hi, -faceWidth, hi, faceWidth],
  ];
  for (const [[x0, z0, x1, z1], side] of sides.map((arg, i) => [arg, i])) {
    if (lod === 0 && (side === 3 || level % 2 === 1)) continue;
    const n = Math.round((faceWidth * 2) / rhythm);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (side === 3 && Math.abs(t - 0.5) < 0.126) continue;
      if (
        (side === 1 && level >= 3 && t < 0.16) ||
        (side === 0 && level === 4 && t > 0.52 && t < 0.7) ||
        (side === 2 && level >= 3 && t > 0.77)
      )
        continue;
      const pos = q([mix(x0, x1, t), mix(z0, z1, t)]);
      const y = 3.5 + level * 0.88;
      const top = y + h * ((level + i + side * 3) % 13 === 0 ? 0.7 : 1);
      ring(
        out,
        'stone',
        pos,
        lod < 2
          ? [
              [y, r],
              [top, 0.028],
            ]
          : [
              [y, r],
              [y + 0.22, r],
              [y + h * 0.38, r * 0.77],
              [top, 0.028],
            ],
        [3, 4, 5, 6][lod],
        course(level + side, i),
      );
    }
  }
}

function vault(out, { q, box }, x0, x1, z0, z1, floor, lod) {
  const rise = (z1 - z0) * 0.5,
    spring = floor + 1.76;
  const width = z1 - z0,
    center = (z0 + z1) * 0.5;
  const sides = [q([x0, z0]), q([x0, z1]), q([x1, z1]), q([x1, z0])];
  for (const z of [z0, z1 - 0.74])
    slab(out, box(x0, z, x1, z + 0.74), floor, spring, 'stone', C.stone);
  const arc = (x, i) => {
    const a = (Math.PI * i) / n;
    return at(q([x, center + rise * Math.cos(a)]), spring + rise * Math.sin(a));
  };
  const n = [5, 7, 10, 14][lod];
  const sections = lod > 1 ? Math.ceil((x1 - x0) / 2.7) : 1;
  for (let row = 0; row < sections; row++)
    for (let i = 0; i < n; i++) {
      const a = mix(x0, x1, row / sections),
        b = mix(x0, x1, (row + 1) / sections);
      face(
        out,
        'stone',
        [arc(a, i), arc(b, i), arc(b, i + 1), arc(a, i + 1)],
        up,
        course(3, row, Math.floor(i / 3)),
      );
    }
  for (const [a, b, reverse] of [
    [sides[0], sides[1], -1],
    [sides[2], sides[3], -1],
  ]) {
    const w = edge(a, b, reverse);
    arch(
      out,
      w,
      width / 2,
      floor,
      spring,
      rise * 0.83,
      rise * 0.85,
      0.035,
      lod,
      { width: 0.35, inner: C.void, trim: C.cap },
      { inner: 'shade', trim: 'band' },
    );
  }
}

function centralStupa(out, { q, box }, lod) {
  const center = q([-5.7, 0.45]),
    foot = 7.43;
  slab(out, box(-12.05, -5.65, 0.5, 6.55), 6.3, foot, 'base', C.aged, 'court', C.rim);
  const segments = lod < 2 ? 8 : 16;
  ring(
    out,
    'stone',
    center,
    [
      [foot, 5.05],
      [foot + 0.43, 5.05],
      [foot + 0.5, 4.4],
      [foot + 1.16, 4.4],
      [foot + 1.22, 3.72],
      [foot + 1.82, 3.72],
    ],
    8,
    C.dim,
  );
  ring(
    out,
    'brick',
    center,
    [
      [foot + 1.82, 3.5],
      [foot + 2.52, 3.53],
      [foot + 3.28, 3.09],
      [foot + 4.35, 2.6],
      [foot + 5.02, 2.18],
      [foot + 5.33, 1.77],
      [foot + 6.07, 1.64],
      [foot + 6.72, 1.21],
      [foot + 7.45, 0.82],
      [foot + 8.06, 0.48],
    ],
    segments,
    C.brick,
  );
  ring(
    out,
    'band',
    center,
    [
      [foot + 8.06, 0.51],
      [foot + 8.27, 0.53],
      [foot + 8.56, 0.34],
      [foot + 9.32, 0.21],
      [foot + 9.98, 0.04],
    ],
    8,
    C.cap,
  );
  if (lod > 1) {
    ring(
      out,
      'band',
      center,
      [
        [foot + 1.21, 3.73],
        [foot + 1.32, 3.78],
        [foot + 1.39, 3.66],
      ],
      8,
      C.cap,
    );
    ring(
      out,
      'band',
      center,
      [
        [foot + 5.02, 2.18],
        [foot + 5.13, 2.22],
        [foot + 5.24, 1.98],
      ],
      segments,
      C.cap,
    );
  }
  // The east-facing image is represented by the stone throne and low seated silhouette at near levels.
  slab(out, box(0.6, -1.44, 3.4, 1.55), 6.58, 7.94, 'stone', C.dim, 'band', C.rim);
  ring(
    out,
    'stone',
    q([1.65, 0.05]),
    [
      [7.94, 1.12],
      [8.3, 1.16],
      [8.48, 0.71],
      [9.23, 0.56],
      [9.46, 0.32],
      [9.96, 0.33],
      [10.14, 0.09],
    ],
    lod < 2 ? 6 : 10,
    C.cap,
  );
}

function draw(out, lod, { surveyLocal: { width, depth, ...origin } }, grade) {
  const f = frame(origin),
    { q, box } = f;
  const base = box(-width / 2, -depth / 2, width / 2, depth / 2);
  slab(out, base, (p) => Math.min(-1.1, grade(p) - 0.25), 1.87, 'base', C.base, 'court', C.court);
  slab(out, box(-33.9, -35.08, 33.92, 35.09), 1.86, 2.63, 'stone', C.aged, 'band', C.rim);
  if (lod > 0) joints(out, base, -0.18, 1.86, lod, 3);
  for (let i = 0; i < 5; i++) {
    const r = 33.0 - i * 2.3,
      d = 34.36 - i * 2.3,
      low = 2.63 + i * 0.88,
      high = low + 0.88;
    // The east front is interrupted by the two-tier stair, not crossed by any decorative ranks.
    const deck = [
      [-r, -d],
      [r, -d],
      [r, -5.2],
      [r - 8.2 - i * 1.3, -5.2],
      [r - 8.2 - i * 1.3, 5.2],
      [r, 5.2],
      [r, d],
      [-r, d],
    ].map(q);
    slab(out, deck, low, high, 'stone', i % 2 ? C.aged : C.stone, 'court', C.court);
    const rim = deck.map((p) => p.map((v, j) => mix(origin.center[j], v, 1.006)));
    if (lod > 0) slab(out, rim, high - 0.13, high + 0.061, 'band', C.rim);
    if (lod > 1) joints(out, deck, low + 0.04, high - 0.19, lod, i + 4);
    terracedShrines(out, q, -r + 0.56, r - 0.56, i, d - 2.45, lod);
  }
  const approach = q([49, 0]);
  flight(out, box, 32.2, 52.9, 6.8, 3.18, Math.min(0.06, grade(approach) + 0.08), lod);
  slab(out, box(26.7, -6.2, 33.6, 6.2), 1.1, 3.21, 'stone', C.aged, 'court', C.rim);
  flight(out, box, 12.2, 28.1, 5.2, 6.92, 3.21, lod);
  slab(out, box(6.1, -4.6, 13.4, 4.6), 4.07, 6.99, 'stone', C.stone, 'court', C.court);
  vault(out, f, -27.0, -3.1, -27.1, -20.35, 6.1, lod);
  vault(out, f, 4.3, 23.3, -26.7, -19.6, 6.13, lod);
  vault(out, f, -24.2, 20.4, 19.75, 26.4, 6.03, lod);
  // Short uncapped fragments at the ends of the ranges, retaining open areas visible in the profile photographs.
  for (const [i, a, b, z] of [
    [0, -31, -27.03, -26.7],
    [1, -3.09, 1.8, -25.95],
    [2, 20.41, 24.2, 24.9],
    [3, -28.9, -24.22, 23.8],
  ]) {
    const runs = lod > 1 ? 3 : 1;
    for (let j = 0; j < runs; j++)
      slab(
        out,
        box(mix(a, b, j / runs), z, mix(a, b, (j + 1) / runs), z + 1.03),
        5.8,
        7.0 + ((i + j) % 3) * 0.32,
        'stone',
        course(i, j),
      );
  }
  centralStupa(out, f, lod);
}

const temple = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [92, 53, 83],
    lookAt: [3, 5, 0],
    yaw: 0.95,
    sun: [230, 510, 355],
    brief:
      'The terraced Koe-thaung temple ruin at Mrauk U, with its outer ranks of stone stupas, surviving vaults, east approach and upper shrine.',
    views: [
      { name: 'east-approach', position: [86, 13, -18], lookAt: [10, 5, 0] },
      { name: 'west-terraces', position: [-68, 18, -38], lookAt: [-10, 4, 0] },
      { name: 'vaults-and-upper-shrine', position: [5, 33, 62], lookAt: [0, 6, 0] },
      { name: 'south-profile', position: [-24, 11, 71], lookAt: [-4, 6, 7] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = temple;
export const model = { ...temple.model, category: 'religious', wikidataId: 'Q4236435' };
