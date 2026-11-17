import {
  arch,
  areaSign,
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
  rect,
  ring,
  shell,
  south,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  rough: surface('wall', 'stone_limestone_weathered', 0.96),
  cut: surface('trim', 'stone_sandstone_raw', 0.92),
  pale: surface('wall', 'stone_marble', 0.89),
  glass: surface('window', 'window_grid', 0.63, 0.03),
  door: surface('door', 'wood_plain', 0.83),
  roof: surface('roof', 'slate', 0.9),
  base: surface('foundation', 'concrete_plain', 0.96),
};
const c = palette({
  stone: 'afa18e',
  trim: 'b39b7a',
  light: 'c2aa85',
  shadow: '746956',
  door: '765e49',
  glass: '64777a',
  roof: '666d70',
  white: 'd9d4c5',
  roofWhite: 'bab9af',
  base: 'a49c8e',
  dark: '44423a',
});
const front = plane(0, 1);
function stoneArch(
  out,
  w,
  x,
  bottom,
  spring,
  rx,
  rise,
  lod,
  kind = 'glass',
  recess = 0.06,
  pad = 0.23,
) {
  const color = kind === 'door' ? c.door : kind === 'glass' ? c.glass : c.dark;
  arch(
    out,
    w,
    x,
    bottom,
    spring,
    rx,
    rise,
    recess,
    lod,
    { inner: color, trim: c.light, width: pad },
    { inner: kind, trim: 'cut' },
  );
}
function lanternPinnacle(out, x, z, y, lod) {
  const profile = [
    [y, 0.38],
    [y + 0.24, 0.4],
    [y + 0.42, 0.33],
    [y + 0.73, 0.28],
    [y + 1.13, 0.2],
    [y + 1.63, 0.14],
    [y + 1.75, 0.036],
  ];
  ring(out, 'cut', [x, z], profile, [6, 8, 10, 14][lod], c.trim);
}
function turretRoof(out, points, y, peak) {
  const n = points.length;
  const cx = points.reduce((s, p) => s + p[0], 0) / n,
    cz = points.reduce((s, p) => s + p[1], 0) / n;
  for (const [a, b] of pairs(closed(points)))
    face(
      out,
      'roof',
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [cx, peak, cz],
      ],
      up,
      c.roof,
    );
}
function bellTower(out, lod, grade) {
  const l = -18.35,
    r = -11.16,
    frontZ = 0.22,
    back = -8.16,
    x = (l + r) * 0.5;
  const w = plane(frontZ, 1);
  const tower = rect(l, frontZ, r, back);
  shell(out, tower, (p) => grade(p) - 0.62, 32.55, {
    wall: 'rough',
    roof: 'roof',
    color: c.stone,
    roofColor: c.roof,
  });
  if (lod > 0) {
    for (const [u, v] of [
      [l, l + 0.71],
      [r - 0.71, r],
    ])
      trimBlock(out, 'rough', w, u, v, 1.25, 31.52, -0.12, 0.31, c.stone);
  }
  stairs(out, grade, 'base', l + 0.38, r - 0.24, 3.36, 0.42, 1.79, lod > 0 ? 7 : 3, c.base);
  stoneArch(out, w, x, 1.83, 4.7, 1.94, 1.04, lod, 'door', 0.051, 0.5);
  bands(
    out,
    w,
    l,
    r,
    [
      [6.14, 6.54],
      [9.68, 9.88],
      [15.8, 16.15],
      [20.8, 21.13],
      [25.75, 26.05],
      [28.15, 28.58],
      [31.51, 32.4],
    ],
    'cut',
    c.trim,
  );
  for (const [y, t] of [
    [8.16, 11.27],
    [12.09, 15.71],
    [16.38, 19.45],
  ]) {
    const count = lod === 0 ? 2 : 3;
    for (let j = 0; j < count; j++) {
      const k = x + (j - (count - 1) * 0.5) * 1.28;
      stoneArch(out, w, k, y, t - 0.43, 0.37, 0.44, lod, 'glass', 0.041, 0.14);
    }
  }
  stoneArch(out, w, x, 22.13, 25.65, 1.7, 1.48, lod, 'cut', 0.045, 0.44);
  // A carved balcony and upper arcaded crown stand forward of the bell opening.
  trimBlock(out, 'cut', w, l - 0.16, r + 0.16, 21.95, 22.44, -0.12, 0.54, c.light);
  if (lod > 0) {
    for (let j = 0; j < 10; j++) {
      const t = l + 0.48 + j * 0.69;
      panel(out, 'cut', w, t - 0.09, t + 0.09, 22.41, 23.22, 0.46, c.trim);
    }
    trimBlock(out, 'cut', w, l - 0.14, r + 0.14, 23.18, 23.35, -0.1, 0.51, c.light);
    for (let j = 0; j < 10; j++) {
      const t = l + 0.45 + j * 0.69;
      trimBlock(out, 'cut', w, t - 0.12, t + 0.12, 28.42, 29.01, -0.1, 0.39, c.trim);
    }
  }
  const row = lod === 0 ? 5 : 10;
  for (let j = 0; j < row; j++) {
    const px = l + 0.47 + ((r - l - 0.9) * j) / (row - 1);
    stoneArch(out, w, px, 29.44, 31.15, lod === 0 ? 0.33 : 0.2, 0.4, lod, 'cut', 0.06, 0.075);
  }
  const sidewall = edge([l, back], [l, frontZ], -1);
  if (lod > 0)
    for (const y of [8.4, 12.35, 16.5, 22.4])
      stoneArch(out, sidewall, 4.1, y, y + 2.3, 0.54, 0.49, lod, 'glass', 0.053, 0.19);
  for (const px of [l + 0.3, r - 0.31])
    for (const z of [frontZ - 0.15, back + 0.45]) lanternPinnacle(out, px, z, 32.13, lod);
}
function entranceRose(out, lod) {
  const w = plane(-0.04, 1),
    x = -0.85;
  trimBlock(out, 'rough', w, -7.58, 6.05, 0.15, 18.58, -0.55, 0.17, c.stone);
  face(
    out,
    'rough',
    [w.p(-7.43, 18.57, 0.16), w.p(5.98, 18.57, 0.16), w.p(-0.82, 25.33, 0.16)],
    south,
    c.stone,
  );
  const apex = [-0.82, 25.34];
  for (const [a, b] of [
    [[-7.45, 18.6], apex],
    [apex, [5.98, 18.6]],
  ]) {
    face(
      out,
      'cut',
      [
        w.p(a[0], a[1], 0.27),
        w.p(b[0], b[1], 0.27),
        w.p(b[0], b[1] + 0.25, 0.27),
        w.p(a[0], a[1] + 0.25, 0.27),
      ],
      south,
      c.light,
    );
  }
  for (const px of [-7.34, 5.78]) lanternPinnacle(out, px, 0.25, 19.0, lod);
  trimBlock(out, 'pale', w, x - 3.33, x + 3.33, 2.34, 2.91, -0.18, 0.58, c.white);
  opening(out, w, x - 2.17, x + 2.17, 0.25, 2.31, 'cut', c.glass, 'glass', c.white, lod, 0.13);
  for (const y of [4.12, 8.1])
    for (const d of [-2.55, -1.29, 0, 1.29, 2.55])
      stoneArch(out, w, x + d, y, y + 1.69, 0.4, 0.33, lod, 'glass', 0.194, 0.12);
  stoneArch(out, w, x, 11.28, 12.47, 3.75, 3.83, lod, 'cut', 0.175, 0.43);
  const sunY = 12.23,
    count = lod === 0 ? 5 : 9;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * (i + 0.55)) / (count + 0.1);
    const p = w.p(x + 3.05 * Math.cos(a), sunY + 3.05 * Math.sin(a), 0.218);
    const radius = lod === 0 ? 0.42 : 0.38;
    const ring = Array.from({ length: lod === 0 ? 5 : 10 }, (_, i) => [
      p[0] + radius * Math.cos((i * 2 * Math.PI) / (lod === 0 ? 5 : 10)),
      p[1] + radius * Math.sin((i * 2 * Math.PI) / (lod === 0 ? 5 : 10)),
      p[2],
    ]);
    face(out, 'glass', ring, south, c.glass);
    if (lod > 1) {
      const l = { u: x + 1.28 * Math.cos(a), y: sunY + 1.28 * Math.sin(a) },
        r = { u: x + 2.52 * Math.cos(a), y: sunY + 2.52 * Math.sin(a) };
      face(
        out,
        'glass',
        [
          w.p(l.u - 0.13, l.y, 0.228),
          w.p(r.u - 0.19, r.y, 0.228),
          w.p(r.u + 0.19, r.y + 0.13, 0.228),
          w.p(l.u + 0.13, l.y + 0.08, 0.228),
        ],
        south,
        c.glass,
      );
    }
  }
  bands(
    out,
    w,
    -7.43,
    5.98,
    [
      [7.48, 7.67],
      [11.06, 11.37],
      [18.14, 18.66],
    ],
    'cut',
    c.trim,
    0.22,
  );
  for (const [dx, h] of [
    [-1.34, 20.2],
    [0, 20.62],
    [1.36, 20.2],
  ])
    stoneArch(out, w, x + dx, 18.55, h, 0.47, 0.53, lod, 'glass', 0.201, 0.12);
}
function sidePavilions(out, lod, grade) {
  const right = rect(6.05, -0.07, 12.18, -8.2);
  shell(out, right, (p) => grade(p) - 0.55, 16.57, {
    wall: 'rough',
    roof: 'roof',
    color: c.stone,
    roofColor: c.roof,
  });
  turretRoof(out, right, 16.52, 22.17);
  stairs(out, grade, 'base', 6.87, 11.37, 3.14, 0.41, 1.53, lod > 0 ? 7 : 3, c.base);
  stoneArch(out, front, 9.15, 1.53, 4.43, 1.44, 1.32, lod, 'door', 0.07, 0.34);
  for (const t of [7.46, 8.62, 9.77, 10.88]) {
    stoneArch(out, front, t, 8.01, 9.77, 0.31, 0.3, lod, 'glass', 0.06, 0.09);
    stoneArch(out, front, t, 11.53, 13.53, 0.36, 0.34, lod, 'glass', 0.06, 0.12);
  }
  bands(
    out,
    front,
    6.1,
    12.2,
    [
      [6.27, 6.54],
      [10.26, 10.44],
      [15.64, 16.08],
    ],
    'cut',
    c.trim,
    0.1,
  );
  const small = [
    [-12.15, -1.55],
    [-12.17, 1.54],
    [-10.63, 3.05],
    [-8.67, 3.02],
    [-7.06, 1.55],
    [-7.03, -1.5],
  ];
  shell(out, small, (p) => grade(p) - 0.58, 10.68, {
    wall: 'rough',
    roof: 'roof',
    color: c.stone,
    roofColor: c.roof,
  });
  turretRoof(out, small, 10.61, 14.2);
  const s = areaSign(small);
  for (const [[a, b], i] of pairs(closed(small)).map((p, i) => [p, i])) {
    if (i === 0 || i === 4 || i === 5) continue;
    const w = edge(a, b, s),
      x = w.length * 0.51;
    stoneArch(out, w, x, 6.02, 8.45, 0.4, 0.46, lod, 'glass', 0.07, 0.15);
    opening(out, w, x - 0.32, x + 0.32, 2.48, 3.8, 'cut', c.glass, 'glass', c.trim, lod, 0.08);
    bands(
      out,
      w,
      0,
      w.length,
      [
        [4.48, 4.78],
        [9.89, 10.33],
      ],
      'cut',
      c.light,
      0.08,
    );
  }
}
function roofAndGallery(out, lod, plan, grade) {
  const outline = plan.footprint;
  const roof = 13.98;
  // Keep the two later forms anchored to the full native outline behind the street façade.
  shell(
    out,
    outline,
    (p) => grade(p) - 0.65,
    roof,
    { wall: 'rough', roof: 'roof', color: c.stone, roofColor: c.roof },
    (i) => i < 5,
  );
  const twin = [
    [-14.1, -18.25],
    [8.28, -18.25],
    [12.6, -24.78],
    [14.88, -24.75],
    [15.18, -47.19],
    [-17.77, -47.67],
    [-17.97, -22.2],
  ];
  shell(out, twin, (p) => grade(p) - 0.6, 19.36, {
    wall: 'pale',
    roof: 'base',
    color: c.white,
    roofColor: c.roofWhite,
  });
  const s = areaSign(twin);
  for (const [a, b] of pairs(closed(twin))) {
    const w = edge(a, b, s);
    if (w.length < 8 || lod === 0) continue;
    bands(
      out,
      w,
      0.27,
      w.length - 0.27,
      [
        [4.16, 4.3],
        [8.44, 8.57],
        [12.7, 12.83],
        [17.0, 17.13],
        [19.02, 19.26],
      ],
      'cut',
      c.white,
      0.04,
    );
    if (lod > 1)
      for (let k = 0; k < Math.floor(w.length / 5.2); k++) {
        const x = 2.24 + 5.2 * k;
        panel(out, 'cut', w, x - 0.021, x + 0.021, 6.8, 18.8, 0.062, c.roofWhite);
      }
  }
  const lf = -13.4,
    rr = 8.22,
    b = -21.5,
    f = -0.23,
    peak = 24.52;
  face(
    out,
    'roof',
    [
      [lf, 14.1, f],
      [-0.81, peak, f],
      [-0.81, peak, b],
      [lf, 14.1, b],
    ],
    up,
    c.roof,
  );
  face(
    out,
    'roof',
    [
      [-0.81, peak, f],
      [rr, 14.1, f],
      [rr, 14.1, b],
      [-0.81, peak, b],
    ],
    up,
    c.roof,
  );
  if (lod === 3) {
    for (const x of [-6.4, 3.7]) block(out, 'roof', x, 19.35, -38.0, 2.95, 0.63, 4.29, c.roofWhite);
  }
}
function draw(out, lod, plan, grade) {
  roofAndGallery(out, lod, plan, grade);
  bellTower(out, lod, grade);
  entranceRose(out, lod);
  sidePavilions(out, lod, grade);
}
export const { model, skyline, district, street, closeup } = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [48, 38, 59],
    lookAt: [-3, 11, -13],
    views: [
      { name: 'romanesque-concert-hall', position: [-2, 8.1, 40], lookAt: [-2.1, 14.8, -0.6] },
      { name: 'stone-arcades-and-rose-window', position: [21, 16.8, 33], lookAt: [-5, 13.1, -3] },
      {
        name: 'rear-marble-gallery-and-slate-roof',
        position: [-46, 33, -55],
        lookAt: [-4, 10, -18],
      },
    ],
    brief:
      'The former Erskine and American Church in rough limestone and warm sandstone, with tall Romanesque bell tower, radial tracery and the attached contemporary marble galleries.',
  },
  draw,
);
