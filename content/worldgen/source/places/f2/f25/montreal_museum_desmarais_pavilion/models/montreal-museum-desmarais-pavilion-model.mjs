import {
  arch,
  areaSign,
  bands,
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
  rect,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  white: surface('wall', 'stone_marble', 0.88),
  masonry: surface('wall', 'brick_flemish', 0.92),
  cut: surface('trim', 'stone_limestone_raw', 0.88),
  roof: surface('roof', 'metal_painted', 0.83, 0.13),
  glass: surface('window', 'window_grid', 0.54, 0.05),
  bottom: surface('foundation', 'stone_ashlar', 0.93),
  metal: surface('trim', 'metal_painted', 0.76, 0.14),
};
const c = palette({
  white: 'e2dbcb',
  trim: 'c9bdab',
  masonry: 'ac9383',
  stone: 'c4b59e',
  roof: '9eaa9e',
  glass: '687a7c',
  metal: '687472',
  shade: '767f78',
  foundation: 'a6a097',
  panel: 'd7cfc0',
});
const front = plane(0.02, -1);
function weatheredOffice(out, lod, grade) {
  const lo = -34.1,
    hi = -0.75,
    roof = 20.1;
  const y = Math.min(grade([lo, -0.12]), grade([hi, -0.12])) - 0.4;
  trimBlock(out, 'bottom', front, lo, hi, y, 3.59, -0.35, 0.1, c.foundation);
  trimBlock(out, 'masonry', front, lo, hi, 3.56, 18.82, -0.32, 0.095, c.masonry);
  for (const [low, high, d] of [
    [3.56, 4.18, 0.34],
    [8.05, 8.27, 0.19],
    [11.52, 11.76, 0.16],
    [15.41, 15.62, 0.18],
    [18.55, 19.27, 0.54],
    [19.36, 20.01, 0.43],
  ])
    trimBlock(out, 'cut', front, lo - 0.1, hi + 0.1, low, high, -0.62, d, c.stone);
  const count = lod === 0 ? 6 : 10;
  for (let i = 0; i < count; i++) {
    const x = lo + 1.21 + ((hi - lo - 2.42) * (i + 0.5)) / count;
    for (const [floor, top, w] of [
      [0.62, 3.11, 1.3],
      [4.65, 7.2, 1.15],
      [8.68, 11.07, 1.03],
      [12.16, 14.66, 1.03],
      [16.03, 18.34, 0.94],
    ]) {
      if (lod === 0 && floor === 12.16) continue;
      opening(
        out,
        front,
        x - w * 0.5,
        x + w * 0.5,
        floor,
        top,
        'cut',
        c.glass,
        'glass',
        c.trim,
        lod,
        0.135,
      );
    }
    if (lod > 1 && i % 2 === 0) {
      for (const y of [4.12, 8.3, 11.8, 15.67])
        panel(out, 'cut', front, x - 1.25, x - 1.01, y, y + 3.42, 0.155, c.stone);
    }
  }
  block(out, 'roof', lo + 0.05, 19.97, 0.39, hi - lo - 0.1, 0.35, 11.33, c.roof);
  if (lod > 0)
    for (const x of [-29.5, -20.4, -9.3]) {
      block(out, 'masonry', x, roof, -0.16, 0.91, 1.18, 0.82, c.masonry);
    }
}
function oculus(out, w, x, y, lod) {
  const n = [6, 10, 14, 18][lod],
    r = 0.66;
  const p = (i, d, rad) =>
    w.p(x + rad * Math.cos((i * 2 * Math.PI) / n), y + rad * Math.sin((i * 2 * Math.PI) / n), d);
  face(
    out,
    'glass',
    Array.from({ length: n }, (_, j) => p(j, 0.058, r)),
    w.normal,
    c.glass,
  );
  if (lod > 0)
    for (let i = 0; i < n; i++)
      face(
        out,
        'cut',
        [p(i, 0.081, r), p(i + 1, 0.081, r), p(i + 1, 0.083, r + 0.14), p(i, 0.083, r + 0.14)],
        w.normal,
        c.trim,
      );
}
function marbleEntry(out, lod, grade) {
  const l = -0.72,
    r = 34.03,
    roof = 20.15;
  const center = 18.3,
    A = center - 7.52,
    B = center + 7.52,
    top = 15.92;
  const topWall = plane(0.04, -1),
    recess = plane(1.02, -1);
  const base = Math.min(grade([l, -0.04]), grade([r, -0.04])) - 0.64;
  trimBlock(out, 'white', front, l, A, base, roof, -0.9, 0.115, c.white);
  trimBlock(out, 'white', front, B, r, base, roof, -0.9, 0.115, c.white);
  trimBlock(out, 'white', topWall, A, B, top, roof, -0.1, 0.38, c.white);
  trimBlock(out, 'cut', front, l, r, 19.96, 20.38, -0.63, 0.4, c.trim);
  // Recessed entrance glazing and the tall marble porch projecting toward Sherbrooke.
  panel(out, 'glass', recess, A, B, 0.64, top, 0, c.glass);
  const n = [3, 5, 9, 13][lod];
  for (let i = 0; i <= n; i++) {
    const x = mix(A, B, i / n);
    panel(out, 'metal', recess, x - 0.075, x + 0.075, 0.66, top, 0.052, c.metal);
  }
  for (const h of [3.02, 6.07, 9.2, 12.34, 15.57])
    panel(out, 'metal', recess, A, B, h - 0.045, h + 0.045, 0.071, c.metal);
  for (const [x0, x1] of [
    [A - 0.13, A + 0.52],
    [B - 0.52, B + 0.13],
  ]) {
    trimBlock(out, 'white', front, x0, x1, 0.51, 15.97, -1.12, 1.29, c.white);
  }
  trimBlock(out, 'white', front, A, B, 15.67, 16.74, -0.85, 1.29, c.white);
  trimBlock(out, 'cut', front, A - 0.12, B + 0.12, 16.74, 17.0, -0.31, 1.43, c.trim);
  const seats = [l + 2.73, l + 5.56, r - 3.65, r - 1.5];
  for (const x of seats) oculus(out, front, x, 13.58, lod);
  const [pl, pr] = [center - 4.17, center + 4.17];
  for (const x of [center - 2.7, center - 0.9, center + 0.9, center + 2.7])
    opening(
      out,
      recess,
      x - 0.69,
      x + 0.69,
      0.81,
      2.94,
      'metal',
      c.glass,
      'glass',
      c.metal,
      lod,
      0.125,
    );
  trimBlock(out, 'metal', front, pl, pr, 3.03, 3.22, -0.18, 1.84, c.metal);
  stairs(
    out,
    grade,
    'bottom',
    pl - 0.43,
    pr + 0.43,
    -3.18,
    -0.02,
    0.69,
    lod > 1 ? 4 : 2,
    c.foundation,
  );
  if (lod > 1)
    for (const X of [2.67, 29.46]) {
      opening(
        out,
        front,
        X - 0.58,
        X + 0.58,
        0.4,
        2.64,
        'metal',
        c.glass,
        'glass',
        c.metal,
        lod,
        0.148,
      );
    }
}
function draw(out, lod, plan, grade) {
  const outline = plan.footprint,
    sign = areaSign(outline);
  const fromOutline = (i) => i < 5 || i > 9;
  shell(
    out,
    outline,
    (p) => grade(p) - 0.69,
    19.71,
    { wall: 'white', roof: 'roof', color: c.white, roofColor: c.panel },
    fromOutline,
  );
  for (const [[a, b], i] of pairs(closed(outline)).map((p, i) => [p, i])) {
    if (!fromOutline(i)) continue;
    const w = edge(a, b, sign);
    if (w.length < 2.5) continue;
    bands(
      out,
      w,
      0,
      w.length,
      [
        [2.82, 3.0],
        [19.33, 19.75],
      ],
      'cut',
      c.trim,
    );
    if (lod > 0 && w.length >= 6) {
      const n = Math.floor(w.length / 4.27);
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * w.length) / n;
        for (const [b, t] of [
          [4.6, 7.2],
          [8.5, 11.12],
          [12.34, 15.02],
        ])
          opening(out, w, u - 0.43, u + 0.43, b, t, 'cut', c.glass, 'glass', c.trim, lod, 0.075);
      }
    }
  }
  weatheredOffice(out, lod, grade);
  marbleEntry(out, lod, grade);
  shell(out, plan.connector, (p) => grade(p) - 0.66, 10.9, {
    wall: 'white',
    roof: 'roof',
    color: c.panel,
    roofColor: c.foundation,
  });
  const backSign = areaSign(plan.connector);
  for (const [a, b] of pairs(closed(plan.connector))) {
    const w = edge(a, b, backSign);
    if (w.length < 6) continue;
    bands(out, w, 0, w.length, [[10.63, 10.98]], 'cut', c.trim, 0.1);
    if (lod > 0)
      for (let j = 0; j < Math.floor(w.length / 4); j++) {
        const u = (j + 0.5) * 4;
        opening(out, w, u - 0.55, u + 0.55, 5.3, 7.87, 'cut', c.glass, 'glass', c.metal, lod, 0.05);
      }
  }
  if (lod > 0)
    for (const [x, z, w, d] of [
      [10.3, 14.1, 14.5, 6.1],
      [-7.18, 22.0, 8.5, 5.2],
      [-17.9, 54.3, 6.4, 11.3],
    ]) {
      block(out, 'roof', x, z > 50 ? 10.89 : 19.69, z, w, z > 50 ? 0.34 : 0.72, d, c.roof);
    }
}
export const { model, skyline, district, street, closeup } = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [67, 39, -68],
    lookAt: [0, 8, 25],
    yaw: 2.68,
    sun: [-460, 530, -410],
    views: [
      {
        name: 'sherbrooke-marble-entrance-and-old-façade',
        position: [6, 8.0, -49],
        lookAt: [2, 10.13, 1],
      },
      { name: 'new-sherbrooke-retained-storeys', position: [-44, 13, -32], lookAt: [-16, 11, 4] },
      { name: 'roof-and-southern-museum-connector', position: [56, 38, 82], lookAt: [-3, 9.9, 20] },
    ],
    brief:
      'Safdie’s Jean-Noël Desmarais Pavilion with its Vermont marble and glazed entry, retained New Sherbrooke brick and stone façade and rear museum connector.',
  },
  draw,
);
