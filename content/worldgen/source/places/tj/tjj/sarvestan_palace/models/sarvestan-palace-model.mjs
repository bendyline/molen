import {
  at,
  cap,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  footing: surface('foundation', 'stone_sandstone_raw'),
  field: surface('wall', 'stone_sandstone_raw'),
  facing: surface('wall', 'stone_sandstone'),
  brick: surface('wall', 'brick'),
  dome: surface('roof', 'brick_stack'),
  cap: surface('trim', 'stone_sandstone_raw'),
  floor: surface('roof', 'earth_rammed'),
};
const C = palette({
  footing: '9d8056',
  cut: 'af8959',
  face: 'c4a475',
  shade: 'a38358',
  stone: 'b3976e',
  crust: 'ba9969',
  raw: 'c9a87a',
  cream: 'd0b183',
  brick: 'b18356',
  dark: '896645',
  recess: '614b36',
  floor: 'bba584',
});
const faces = [C.stone, C.face, C.cut, C.cream, C.shade, C.raw];
const tint = (i, j) =>
  faces[(((i * 31 + j * 47 + 27) % faces.length) + faces.length) % faces.length];
const lerp = (a, b, t) => a.map((n, i) => mix(n, b[i], t));
const toned = (base, i, j) => lerp(base, tint(i, j), 0.18);
function frame([a, b, c, d]) {
  const q = ([x, z]) =>
    lerp(lerp(a, b, (x + 18.5) / 37), lerp(d, c, (x + 18.5) / 37), (z + 22.5) / 45);
  return { q, p: (x, y, z) => at(q([x, z]), y), box: (...args) => rect(...args).map(q) };
}
function wall(out, f, x0, z0, x1, z1, t0, t1, material = 'field', color = C.face) {
  const poly = f.box(x0, z0, x1, z1);
  shell(out, poly, typeof t0 === 'function' ? t0 : () => t0, t1, {
    wall: material,
    color,
    roof: 'cap',
    roofColor: C.crust,
  });
}
function brokenWall(out, f, xa, xb, za, zb, base, reach, seed, lod) {
  const n = lod < 2 ? Math.ceil((xb - xa) / 3.25) : Math.ceil((xb - xa) / (lod === 2 ? 1.8 : 1.05));
  let prev = reach;
  for (let i = 0; i < n; i++) {
    const x0 = mix(xa, xb, i / n),
      x1 = mix(xa, xb, (i + 1) / n);
    const h = reach + (((i * 53 + seed * 13) % 17) - 8) * (lod < 2 ? 0.043 : 0.081);
    wall(out, f, x0, za, x1, zb, base, Math.min(h, prev + 0.38), 'field', toned(C.face, i, seed));
    prev = h;
  }
}
function portal(out, f, cx, z0, z1, y, w, spring, rise, ceiling, lod, reverse = false) {
  const { p } = f,
    n = [5, 8, 12, 16][lod],
    half = w * 0.5;
  const place = (x, Y, Z) => (reverse ? p(Z, Y, x) : p(x, Y, Z));
  const path = Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [cx - half * Math.cos(a), spring + rise * Math.sin(a)];
  });
  for (const [[a, h0], [b, h1]] of pairs(path)) {
    for (const [z, u] of [
      [z0, [0, 0, -1]],
      [z1, [0, 0, 1]],
    ]) {
      face(
        out,
        'facing',
        [place(a, h0, z), place(b, h1, z), place(b, ceiling, z), place(a, ceiling, z)],
        reverse ? [u[2], 0, 0] : u,
        C.face,
      );
    }
    face(
      out,
      'brick',
      [place(a, h0, z0), place(a, h0, z1), place(b, h1, z1), place(b, h1, z0)],
      [0, -1, 0],
      C.shade,
    );
  }
  const jamb = reverse ? [0, 0, 1] : [1, 0, 0];
  for (const side of [-1, 1]) {
    const x = cx + half * side;
    face(
      out,
      'field',
      [place(x, y, z0), place(x, y, z1), place(x, spring, z1), place(x, spring, z0)],
      jamb.map((v) => -side * v),
      C.face,
    );
  }
  face(
    out,
    'cap',
    [
      place(cx - half, ceiling, z0),
      place(cx + half, ceiling, z0),
      place(cx + half, ceiling, z1),
      place(cx - half, ceiling, z1),
    ],
    up,
    C.crust,
  );
  if (lod > 1)
    for (const [i, [[a, h0], [b, h1]]] of pairs(path).entries()) {
      const z = z0 - 0.033;
      face(
        out,
        'brick',
        [
          place(a, h0 + 0.025, z),
          place(b, h1 + 0.025, z),
          place(b + 0.05, h1 + 0.254, z),
          place(a - 0.05, h0 + 0.254, z),
        ],
        reverse ? [-1, 0, 0] : [0, 0, -1],
        i % 2 ? C.brick : C.crust,
      );
    }
}
function gatewayWall(out, f, left, right, cx, z0, z1, y, width, spring, rise, h, lod) {
  if (cx - width * 0.5 > left) wall(out, f, left, z0, cx - width * 0.5, z1, y, h, 'facing');
  if (cx + width * 0.5 < right) wall(out, f, cx + width * 0.5, z0, right, z1, y, h, 'facing');
  portal(out, f, cx, z0, z1, y, width, spring, rise, h, lod);
}
function curvedVault(out, f, cx, z0, z1, width, spring, height, lod, breakAt = -1) {
  const n = [5, 8, 12, 16][lod],
    pieces = lod < 2 ? 2 : Math.max(3, Math.ceil((z1 - z0) / 1.9));
  const rim = (i, z, inner) => {
    const a = (Math.PI * i) / n,
      r = width * 0.5 + (inner ? -0.3 : 0);
    return f.p(cx - r * Math.cos(a), spring + (height + (inner ? -0.28 : 0)) * Math.sin(a), z);
  };
  for (let j = 0; j < pieces; j++)
    for (let i = 0; i < n; i++) {
      if (j === pieces - 1 && breakAt > 0 && i >= breakAt && i < n - breakAt) continue;
      const a = mix(z0, z1, j / pieces),
        b = mix(z0, z1, (j + 1) / pieces);
      face(
        out,
        'field',
        [rim(i, a, false), rim(i + 1, a, false), rim(i + 1, b, false), rim(i, b, false)],
        up,
        lod > 1 ? toned(C.stone, i, j) : C.stone,
      );
      face(
        out,
        'brick',
        [rim(i, a, true), rim(i + 1, a, true), rim(i + 1, b, true), rim(i, b, true)],
        [0, -1, 0],
        C.shade,
      );
      if (j === 0 || j === pieces - 1) {
        const z = j === 0 ? a : b;
        const outer = rim(i, z, false),
          next = rim(i + 1, z, false);
        const inner = rim(i, z, true),
          last = rim(i + 1, z, true);
        face(out, 'cap', [outer, next, last, inner], [0, 0, j === 0 ? -1 : 1], C.crust);
      }
    }
}
function dome(out, f, x, z, y, r, h, lod, major = false) {
  const n = major ? [12, 18, 30, 44][lod] : [7, 12, 18, 26][lod],
    center = f.q([x, z]),
    scale = r / 6.1;
  const profile = [
    [y, r],
    [y + h * 0.25, r * 0.99],
    [y + h * 0.52, r * 0.87],
    [y + h * 0.74, r * 0.66],
    [y + h * 0.9, r * 0.4],
    [y + h * 0.985, r * 0.15],
  ];
  if (!major) {
    ring(out, 'dome', center, [...profile, [y + h, 0.035]], n, C.brick);
    return;
  }
  function pt(i, k) {
    const angle = (2 * Math.PI * (i % n)) / n,
      [H, R] = profile[k];
    const decay = (((i * 71) % 11) - 5) * scale * (k >= profile.length - 2 ? 0.085 : 0.018);
    return [
      center[0] + Math.cos(angle) * (R + decay * 0.42),
      H + decay,
      center[1] + Math.sin(angle) * (R + decay * 0.42),
    ];
  }
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = pt(i, j),
        b = pt(i + 1, j),
        c = pt(i + 1, j + 1),
        d = pt(i, j + 1);
      const radial = [a[0] + b[0] - 2 * center[0], 0.7, a[2] + b[2] - 2 * center[1]];
      if (j === 0 && i === Math.floor(n * 0.344)) {
        // The front drum window remains dark and recessed in the exposed brick.
        const inside = (p) => [mix(p[0], center[0], 0.17), p[1], mix(p[2], center[1], 0.17)];
        const aa = inside(a),
          bb = inside(b),
          cc = inside(c),
          dd = inside(d);
        face(out, 'field', [aa, bb, cc], radial, C.recess);
        face(out, 'field', [aa, cc, dd], radial, C.recess);
        face(out, 'dome', [a, aa, dd, d], radial, C.dark);
        face(out, 'dome', [b, c, cc, bb], radial, C.dark);
      } else {
        const tint = lod < 2 ? C.brick : toned(C.brick, i, j);
        face(out, 'dome', [a, b, c], radial, tint);
        face(out, 'dome', [a, c, d], radial, tint);
      }
    }
  const crown = Array.from({ length: n }, (_, i) => pt(i, profile.length - 1));
  for (const [a, b] of pairs([...crown, crown[0]]))
    face(out, 'cap', [a, b, [center[0], y + h * 0.963, center[1]]], up, C.dark);
}
function surfaceBreaks(out, f, x0, x1, z, y, h, n, lod) {
  if (lod < 1) return;
  for (let j = 0; j < (lod === 1 ? 2 : lod === 2 ? 4 : 6); j++)
    for (let i = 0; i < n; i++) {
      if ((i * 11 + j * 17) % 9 > 4) continue;
      const left = mix(x0, x1, (i + (j % 2) * 0.37) / n),
        w = (x1 - x0) / n;
      const g = y + (j * h) / 6,
        w0 = w * 0.81;
      face(
        out,
        'facing',
        [
          f.p(left, g, z - 0.022),
          f.p(Math.min(x1, left + w0), g + 0.035, z - 0.023),
          f.p(Math.min(x1, left + w0), g + h * 0.105, z - 0.024),
          f.p(left, g + h * 0.111, z - 0.026),
        ],
        [0, 0, -1],
        tint(i, j),
      );
    }
}
function draw(out, lod, { nativeCorners, innerCupolaRoomWidth, reportedOuterIwanWidth }, grade) {
  const f = frame(nativeCorners),
    y = grade(f.q([0, -5])) + 0.18;
  wall(
    out,
    f,
    -18.19,
    -21.95,
    18.19,
    22.22,
    (p) => Math.min(y - 0.19, grade(p) - 0.32),
    y,
    'footing',
    C.footing,
  );
  cap(out, 'floor', f.box(-18.19, -21.95, 18.19, 22.22), y + 0.015, C.floor);
  if (lod === 0) {
    for (const [x0, z0, x1, z1, h] of [
      [-18.4, -22.2, -13.96, -18.5, 3.45],
      [-11.84, -21.8, -5.27, -12.7, 6.6],
      [5.27, -22.5, 12.04, -12.7, 6.55],
      [14.16, -22.24, 18.4, -18.56, 3.5],
      [-18.46, -19.51, -17.25, 21.51, 4.3],
      [17.22, -19.5, 18.5, 22.3, 4.7],
      [-9.24, -12.45, -7.3, 3.2, 7.63],
      [7.3, -12.45, 9.24, 3.2, 7.63],
      [-18.14, 7.38, -8.9, 16.62, 4.51],
      [9.03, -19.93, 18.48, -10.45, 4.53],
      [-18.15, 21.37, -4.2, 22.5, 4.42],
      [4.5, 21.42, 18.1, 22.49, 4.25],
    ])
      wall(out, f, x0, z0, x1, z1, y, y + h);
    gatewayWall(out, f, -7.34, 7.34, 0, -13.2, -11.73, y, 2.72, y + 2.69, 1.4, y + 7.73, lod);
    wall(out, f, -7.39, -12.76, 7.39, 3.2, y + 7.02, y + 7.97, 'field', C.cut);
    dome(out, f, 0, -4.82, y + 7.62, 6.1, 7.08, lod, true);
    dome(out, f, -13.52, 12.0, y + 4.62, 3.62, 3.3, lod);
    dome(out, f, 13.76, -15.2, y + 4.62, 3.74, 3.62, lod);
    curvedVault(out, f, -13.45, -14.07, 7.9, 8.31, y + 3.75, 2.6, lod);
    curvedVault(out, f, 13.82, -8.3, 13.8, 7.0, y + 3.84, 2.49, lod);
    curvedVault(out, f, 0, 17.37, 21.67, 6.1, y + 3.1, 1.9, lod);
    return;
  }
  // Three original approach bays survive to different heights. Their outer roofs have collapsed.
  brokenWall(out, f, -18.42, -13.1, -22.18, -19.35, y, 3.42 + y, 7, lod);
  brokenWall(out, f, 13.05, 18.4, -22.24, -19.45, y, 3.22 + y, 8, lod);
  const r = reportedOuterIwanWidth * 0.5;
  for (const [a, b, seed] of [
    [-r - 3.72, -r, 5],
    [r, r + 3.72, 9],
  ]) {
    brokenWall(out, f, a, b, -22.5, -12.7, y, 6.65 + y, seed, lod);
    for (const x of [a + 0.7, b - 0.7])
      ring(
        out,
        'field',
        f.q([x, -22.37]),
        [
          [y, 0.38],
          [y + 3.9, 0.38],
          [y + 4.05, 0.18],
        ],
        lod < 2 ? 5 : 8,
        C.raw,
      );
  }
  for (const [x, z, h] of [
    [-12.9, -20.1, 4.72],
    [13.1, -20.45, 5.04],
  ]) {
    gatewayWall(out, f, x - 1.97, x + 1.97, x, z, z + 1.22, y, 2.16, y + 2.11, 1.05, y + h, lod);
  }
  const a = innerCupolaRoomWidth / 2 + 0.89;
  gatewayWall(out, f, -a, a, 0, -13.2, -11.73, y, 2.72, y + 2.69, 1.4, y + 5.87, lod);
  brokenWall(out, f, -a, a, -13.21, -11.69, y + 5.87, y + 6.95, 6, lod);
  surfaceBreaks(out, f, -a, -1.68, -13.2, y + 0.45, 4.1, 10, lod);
  surfaceBreaks(out, f, 1.68, a, -13.2, y + 0.42, 4.1, 10, lod);
  for (const sign of [-1, 1]) {
    const l = sign === 1 ? a : -a - 1.07,
      r = sign === 1 ? a + 1.07 : -a;
    wall(out, f, l, -12.45, r, 2.58, y, y + 7.4, 'field');
  }
  gatewayWall(out, f, -a, a, 0, 1.73, 3.3, y, 3.08, y + 2.8, 1.4, y + 7.35, lod);
  wall(out, f, -a, -12.76, a, 3.2, y + 6.93, y + 7.97, 'field', C.cut);
  dome(out, f, 0, -4.82, y + 7.62, 6.1, 7.08, lod, true);
  // The flank roofs stop around an open rear court. Broken projections retain clear floor divisions.
  for (const [l, r, z0, z1, h] of [
    [-18.46, -17.25, -19.51, 21.51, 4.3],
    [17.22, 18.5, -19.5, 22.3, 4.7],
    [-10.45, -9.17, -11.8, 9.0, 4.36],
    [9.45, 10.54, -13, 18.5, 4.5],
  ])
    brokenWall(out, f, l, r, z0, z1, y, y + h, Math.round(h * 17), lod);
  curvedVault(out, f, -13.45, -14.07, 7.9, 8.31, y + 3.75, 2.6, lod, 2);
  curvedVault(out, f, 13.82, -8.3, 13.8, 7.0, y + 3.84, 2.49, lod, 2);
  for (const [x, z, r, h] of [
    [-13.52, 12.0, 3.62, 3.3],
    [13.76, -15.2, 3.74, 3.62],
  ]) {
    const l = x - r - 1,
      b = x + r + 1,
      base = z - r - 1,
      far = z + r + 1;
    gatewayWall(out, f, l, b, x, base, base + 1.15, y, 1.95, y + 1.92, 1.06, y + 4.54, lod);
    wall(out, f, l, base + 1.1, l + 1.06, far, y, y + 4.52, 'field');
    wall(out, f, b - 1.04, base + 1.1, b, far, y, y + 4.52, 'field');
    wall(out, f, l, far - 1.15, b, far, y, y + 4.53, 'field');
    wall(out, f, l, base, b, far, y + 4.5, y + 4.78, 'field', C.cut);
    dome(out, f, x, z, y + 4.62, r, h, lod);
  }
  brokenWall(out, f, -18.15, -4.22, 21.37, 22.5, y, y + 4.42, 17, lod);
  brokenWall(out, f, 4.6, 18.1, 21.42, 22.49, y, y + 4.25, 12, lod);
  gatewayWall(out, f, -4.23, 4.62, 0, 21.25, 22.38, y, 3.32, y + 2.48, 1.28, y + 4.74, lod);
  for (const side of [-1, 1]) {
    const l = side === -1 ? -9.1 : 4.72,
      r = side === -1 ? -4.6 : 9.1;
    wall(out, f, l, 15.38, r, 16.94, y, y + 3.13, 'facing', C.stone);
    brokenWall(out, f, l, r, 19.98, 21.53, y, y + 3.45, 12 + side, lod);
  }
  curvedVault(out, f, 0, 17.37, 21.67, 6.1, y + 3.1, 1.9, lod);
}
const palace = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-61, 27, 56],
    lookAt: [0, 5, 0],
    yaw: 2.15,
    sun: [-300, 460, 400],
    brief:
      'Standing Sarvestan ruin with the fractured masonry of the front iwans, an exposed brick dome, vaulted side chambers and open court.',
    views: [
      { name: 'southwestern-iwans-and-base', position: [-44, 13, 42], lookAt: [-3, 4, 4] },
      { name: 'surviving-cupola-and-portals', position: [-31, 17, 28], lookAt: [0, 7, 3] },
      { name: 'courtyard-and-vaults', position: [27, 31, -35], lookAt: [5, 5, -7] },
      { name: 'small-domes-and-flank', position: [-21, 19, -39], lookAt: [-3, 4, -7] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = palace;
export const model = { ...palace.model, category: 'palace' };
