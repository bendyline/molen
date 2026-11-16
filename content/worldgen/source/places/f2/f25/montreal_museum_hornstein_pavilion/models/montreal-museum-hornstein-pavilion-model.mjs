import {
  arch,
  areaSign,
  at,
  bands,
  block,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  ring,
  shell,
  south,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  marble: surface('wall', 'stone_marble', 0.88),
  carved: surface('trim', 'stone_limestone_raw', 0.84),
  base: surface('foundation', 'stone_ashlar', 0.91),
  glass: surface('window', 'window_grid', 0.57, 0.04),
  door: surface('door', 'wood_plain', 0.82),
  seam: surface('roof', 'metal_painted', 0.82, 0.12),
};
const c = palette({
  marble: 'dfd9c8',
  trim: 'ebe1cc',
  shade: 'b9ab94',
  roof: 'b5b4a1',
  green: '7e978b',
  bronze: '775c47',
  glass: '6c7774',
  joint: 'c7bfaf',
  carve: 'c1ae92',
});
const front = plane(0, 1);
function entrance(out, lod, grade) {
  const steps = lod === 0 ? 4 : lod === 1 ? 7 : 11;
  stairs(out, grade, 'base', -15.25, 15.25, 4.4, 0.28, 2.13, steps, c.marble);
  block(out, 'base', -13.6, 1.9, -2.4, 27.2, 0.24, 2.75, c.trim);
  for (const x of [-15.5, 14.05]) {
    block(out, 'base', x, Math.min(-0.68, grade([x, 3.9]) - 0.55), 0.02, 1.45, 2.95, 4.54, c.joint);
    if (lod > 0) block(out, 'carved', x - 0.08, 2.54, -0.02, 1.61, 0.21, 4.67, c.trim);
  }
  const recess = plane(-2.3, 1);
  panel(out, 'marble', recess, -11.05, 11.05, 2.12, 12.91, 0, c.marble);
  for (const x of [-6.05, 0, 6.05]) {
    arch(
      out,
      recess,
      x,
      2.22,
      5.48,
      1.42,
      1.61,
      0.026,
      lod,
      { inner: c.bronze, trim: c.shade, width: 0.23 },
      { inner: 'door', trim: 'carved' },
    );
    if (lod > 1) {
      panel(out, 'carved', recess, x - 0.036, x + 0.036, 2.24, 5.39, 0.06, c.shade);
      panel(out, 'carved', recess, x - 1.24, x + 1.24, 5.38, 5.45, 0.06, c.shade);
    }
  }
  for (const x of [-9.35, 9.35]) {
    opening(
      out,
      recess,
      x - 0.42,
      x + 0.42,
      3.26,
      4.57,
      'carved',
      c.glass,
      'glass',
      c.shade,
      lod,
      0.04,
    );
  }
  for (const x of [-8.75, -2.92, 2.92, 8.75]) {
    const style = [6, 10, 16, 20][lod];
    const z = 0.19;
    block(out, 'carved', x - 0.91, 2.13, z - 0.91, 1.82, 0.23, 1.82, c.trim);
    ring(
      out,
      'carved',
      [x, z],
      [
        [2.35, 0.81],
        [2.51, 0.86],
        [2.67, 0.66],
        [lod === 0 ? 2.81 : 2.79, 0.66],
        [11.32, 0.53],
        [11.48, 0.67],
        [11.72, 0.68],
        [11.83, 0.85],
      ],
      style,
      c.marble,
    );
    block(out, 'carved', x - 0.88, 11.78, z - 0.68, 1.76, 0.31, 1.36, c.trim);
    if (lod > 1)
      for (const side of [-1, 1]) {
        const y = 11.56,
          cap = x + side * 0.7,
          pt = plane(z + 0.57, 1);
        const angles = Array.from({ length: 9 }, (_, j) => (j * Math.PI) / 4);
        for (const [a, b] of pairs(angles)) {
          const p = (t, r) => pt.p(cap + r * Math.cos(t), y + r * Math.sin(t), 0.033);
          face(out, 'carved', [p(a, 0.22), p(b, 0.22), p(b, 0.15), p(a, 0.15)], south, c.shade);
        }
      }
  }
  for (const z of [-0.54, -1.71]) {
    for (const x of [-10.9, 10.44]) block(out, 'marble', x, 2.12, z, 0.46, 10.55, 0.43, c.trim);
  }
  trimBlock(out, 'carved', front, -11.07, 11.07, 12.03, 12.35, -2.43, 0.72, c.trim);
  trimBlock(out, 'marble', front, -11.65, 11.65, 12.35, 13.75, -2.34, 0.38, c.marble);
  trimBlock(out, 'carved', front, -12.04, 12.04, 13.69, 14.16, -2.46, 0.87, c.trim);
  trimBlock(out, 'marble', front, -11.82, 11.82, 14.18, 15.24, -1.25, 0.43, c.marble);
  panel(out, 'seam', front, -11.82, 11.82, 15.2, 15.34, 0.45, c.green);
  if (lod > 0)
    for (const x of [-3.58, 0, 3.58]) {
      block(out, 'seam', x - 0.038, 15.29, -1.39, 0.075, 3.02, 0.075, c.green);
    }
}
function streetPiers(out, lod, grade) {
  for (const [l, r, x] of [
    [-19.95, -11.03, -15.22],
    [11.03, 19.95, 15.22],
  ]) {
    const foot = Math.min(grade([l, 0]), grade([r, 0])) - 0.58;
    const wall = Math.min(foot, -0.81);
    trimBlock(out, 'base', front, l, r, wall, 3.27, -0.73, 0.06, c.joint);
    trimBlock(out, 'marble', front, l, r, 3.24, 13.63, -0.63, 0.09, c.marble);
    trimBlock(out, 'carved', front, l - 0.17, r + 0.17, 13.62, 14.36, -0.97, 0.39, c.trim);
    trimBlock(out, 'marble', front, l, r, 14.34, 16.04, -1.62, 0.09, c.marble);
    panel(out, 'seam', front, l - 0.07, r + 0.07, 15.94, 16.14, 0.16, c.green);
    bands(
      out,
      front,
      l,
      r,
      [
        [0.28, 0.48],
        [3.13, 3.41],
        [12.45, 12.55],
      ],
      'carved',
      c.trim,
    );
    for (const end of [l + 0.25, r - 0.38])
      panel(out, 'carved', front, end, end + 0.24, 3.4, 12.5, 0.17, c.joint);
    opening(
      out,
      front,
      x - 1.07,
      x + 1.07,
      5.23,
      10.05,
      'carved',
      c.glass,
      'glass',
      c.shade,
      lod,
      0.145,
    );
    opening(
      out,
      front,
      x - 0.53,
      x + 0.53,
      0.58,
      1.98,
      'carved',
      c.glass,
      'glass',
      c.shade,
      lod,
      0.12,
    );
    if (lod > 0) {
      trimBlock(out, 'carved', front, x - 1.48, x + 1.48, 10.1, 10.4, 0.04, 0.4, c.trim);
      trimBlock(out, 'carved', front, x - 1.37, x + 1.37, 4.99, 5.21, 0.04, 0.32, c.trim);
      panel(out, 'carved', front, x - 2.02, x + 2.02, 10.54, 12.11, 0.14, c.trim);
      panel(out, 'carved', front, x - 1.75, x + 1.75, 10.76, 11.87, 0.19, c.carve);
    }
    if (lod > 1) {
      for (let j = 0; j < 7; j++) {
        const u = x - 1.46 + j * 0.43;
        const h = [0.51, 0.74, 0.59, 0.78, 0.56, 0.71, 0.64][j];
        const points = [
          [u - 0.1, 10.85],
          [u - 0.17, 11.04],
          [u - 0.11, 10.92 + h],
          [u + 0.02, 11.02 + h],
          [u + 0.2, 10.98 + h * 0.57],
          [u + 0.12, 10.84],
        ];
        face(
          out,
          'carved',
          points.map(([v, y]) => front.p(v, y, 0.224)),
          south,
          j % 2 ? c.joint : c.shade,
        );
      }
    }
  }
}
function draw(out, lod, plan, grade) {
  const points = plan.footprint;
  const select = (i) => !(i === 10 || i === 11);
  const roof = 13.95;
  shell(
    out,
    points,
    (p) => grade(p) - 0.66,
    roof,
    { wall: 'marble', roof: 'seam', color: c.marble, roofColor: c.roof },
    select,
  );
  const s = areaSign(points);
  for (const [[a, b], i] of pairs(closed(points)).map((p, i) => [p, i])) {
    if (!select(i)) continue;
    const w = edge(a, b, s);
    if (w.length < 1.7) continue;
    bands(
      out,
      w,
      0,
      w.length,
      [
        [3.13, 3.37],
        [13.22, 13.62],
        [13.7, 13.99],
      ],
      'carved',
      c.trim,
      0.068,
    );
    if (lod > 0 && w.length > 7) {
      const n = Math.max(1, Math.floor(w.length / 6.5));
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) * w.length) / n;
        opening(
          out,
          w,
          x - 0.6,
          x + 0.6,
          6.21,
          9.86,
          'carved',
          c.glass,
          'glass',
          c.shade,
          lod,
          0.04,
        );
        if (lod > 1) panel(out, 'carved', w, x - 0.77, x + 0.77, 9.88, 10.12, 0.095, c.trim);
      }
    }
  }
  block(out, 'seam', -7.8, 13.93, -19.06, 14.6, 0.92, 9.6, c.green);
  streetPiers(out, lod, grade);
  entrance(out, lod, grade);
  if (lod > 1)
    for (const x of [-9.45, 9.45]) {
      block(out, 'seam', x - 0.04, 1.31, 2.24, 0.091, 0.91, 0.091, c.shade);
      block(out, 'seam', x - 0.04, 2.13, 0.85, 0.091, 0.31, 1.53, c.shade);
      const a = [x - 0.034, 1.68, 3.15],
        b = [x + 0.034, 1.68, 3.15],
        d = [x - 0.034, 2.43, 1.02],
        e = [x + 0.034, 2.43, 1.02];
      face(out, 'seam', [a, b, e, d], up, c.shade);
    }
}

export const { model, skyline, district, street, closeup } = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [54, 30, 61],
    lookAt: [0, 6.4, -15],
    views: [
      { name: 'sherbrooke-ionic-portico', position: [1, 7.3, 40], lookAt: [0, 8.4, -1] },
      {
        name: 'marble-entablature-and-front-steps',
        position: [-21, 12.7, 26],
        lookAt: [5, 7.1, -1.8],
      },
      { name: 'norton-gallery-return', position: [49, 23, -38], lookAt: [5, 7.4, -19] },
    ],
    brief:
      'The 1912 white Vermont marble Hornstein Pavilion with a four-column Ionic portico, oak arches and the monumental Sherbrooke Street stair.',
  },
  draw,
);
