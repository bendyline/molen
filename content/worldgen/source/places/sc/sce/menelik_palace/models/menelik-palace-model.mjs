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
  ring,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  masonry: surface('foundation', 'stone_ashlar'),
  wall: surface('wall', 'plaster_lime'),
  stone: surface('trim', 'stone_sandstone'),
  roof: surface('roof', 'metal_corrugated', 0.76, 0.08),
  drum: surface('wall', 'stone_limestone'),
  dome: surface('roof', 'metal_painted', 0.64, 0.2),
  glass: surface('window', 'window_grid', 0.48),
  wood: surface('door', 'wood_painted_lap'),
};
const C = palette({
  footing: '8b7c6e',
  dressed: 'c8bba4',
  pale: 'd9ccb2',
  wall: 'dfd5bc',
  dark: '52605a',
  coolRoof: '777f76',
  clayRoof: '925941',
  rust: 'aa6f53',
  bronze: '8b865d',
  silver: 'a9ada6',
  mortar: 'a99c86',
  cedar: '705648',
  olive: '64786b',
  darkPot: '777a65',
});

const forWalls = (p, callback) =>
  pairs(closed(p)).forEach(([a, b], i) => {
    callback(edge(a, b, areaSign(p)), i);
  });
const between = (points, i, j, t) => points[i].map((v, k) => mix(v, points[j][k], t));
const scale = (points, center, n) => points.map((p) => p.map((v, i) => mix(center[i], v, n)));
const foundation = (out, p, floor, grade) =>
  shell(out, p, (q) => grade(q) - 0.62, floor, { wall: 'masonry', color: C.footing });

function roof(out, p, y, rise, color, inset = 0.69) {
  const inner = scale(p, planarMid(p), inset),
    sign = areaSign(p);
  for (const [i, [a, b]] of pairs(closed(p)).entries()) {
    const j = (i + 1) % p.length;
    face(
      out,
      'roof',
      [at(a, y), at(b, y), at(inner[j], y + rise), at(inner[i], y + rise)],
      edge(a, b, sign).normal,
      color,
    );
  }
  cap(out, 'roof', inner, y + rise, color);
}

function hipped(out, p, y, rise, color, ends = 0.14) {
  const left = between(p, 0, 3, 0.5),
    right = between(p, 1, 2, 0.5);
  const a = left.map((t, i) => mix(t, right[i], ends)),
    b = left.map((t, i) => mix(t, right[i], 1 - ends));
  for (const [index, [c, d]] of pairs(closed(p)).entries()) {
    const tip =
      index === 0
        ? [at(b, y + rise), at(a, y + rise)]
        : index === 2
          ? [at(a, y + rise), at(b, y + rise)]
          : [at(index === 1 ? b : a, y + rise)];
    face(out, 'roof', [at(c, y), at(d, y), ...tip], edge(c, d, areaSign(p)).normal, color);
  }
}

function fringe(out, p, y, lod, color = C.pale) {
  forWalls(p, (w) => {
    trimBlock(out, 'stone', w, 0, w.length, y - 0.31, y, 0.04, 0.23, color);
    if (lod < 2) return;
    const n = Math.ceil(w.length / (lod === 3 ? 0.91 : 1.42));
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * w.length) / n;
      trimBlock(out, 'stone', w, u - 0.12, u + 0.12, y - 0.51, y - 0.28, 0.04, 0.21, color);
    }
  });
}

function wallOpenings(out, p, floor, eave, lod, mode) {
  forWalls(p, (w, i) => {
    if (w.length < 3.1) return;
    const n = Math.max(
      1,
      Math.round(w.length / ((mode === 'banquet' ? 5 : 3.0) * (lod === 0 ? 1.9 : 1))),
    );
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * w.length) / n,
        high = eave - floor;
      const wide = mode === 'banquet' ? 1.11 : 0.79;
      if (mode === 'residence') {
        for (const a of [floor + 0.63, floor + 3.75])
          opening(
            out,
            w,
            u - wide,
            u + wide,
            a,
            a + 1.89,
            'wood',
            C.dark,
            'glass',
            C.olive,
            lod,
            0.063,
          );
      } else {
        const bay = (i === 0 || i === 3) && j === Math.floor(n / 2),
          low = floor + (bay ? 0.28 : 1.11);
        arch(
          out,
          w,
          u,
          low,
          floor + high * 0.58,
          wide,
          wide * 0.9,
          0.058,
          lod === 1 && j % 2 === 0 ? 0 : Math.max(0, lod - 1),
          { width: 0.13, inner: C.dark, trim: C.pale },
          { inner: 'glass', trim: 'stone' },
        );
        if (lod >= 2) {
          panel(
            out,
            'wood',
            w,
            u - 0.029,
            u + 0.029,
            low,
            floor + high * 0.58 + wide * 0.62,
            0.095,
            C.cedar,
          );
          panel(
            out,
            'wood',
            w,
            u - wide,
            u + wide,
            floor + high * 0.52,
            floor + high * 0.52 + 0.047,
            0.09,
            C.cedar,
          );
        }
      }
    }
  });
}

function quarter(out, p, grade, lod) {
  const center = planarMid(p),
    floor = Math.max(...p.map(grade)) + 0.29,
    eave = floor + 6.85;
  foundation(out, p, floor, grade);
  shell(out, p, () => floor, eave, { wall: 'wall', color: C.wall });
  roof(out, scale(p, center, 1.085), eave - 0.035, 3.31, C.coolRoof, 0.22);
  wallOpenings(out, p, floor, eave, lod, 'residence');
  forWalls(p, (w) => {
    if (w.length <= 3) return;
    panel(out, 'wood', w, 0, w.length, floor + 3.24, floor + 3.42, 0.12, C.olive);
  });
  if (lod > 0) {
    fringe(out, p, eave, lod);
    forWalls(p, (w) => {
      if (w.length < 3.1) return;
      for (const u of [0.21, w.length - 0.21])
        trimBlock(out, 'wood', w, u - 0.1, u + 0.1, floor, floor + 6.64, 0.055, 0.19, C.olive);
    });
  }
}

function throne(out, p, grade, lod) {
  const center = planarMid(p),
    floor = Math.max(...p.map(grade)) + 0.32,
    eave = floor + 7.15;
  foundation(out, p, floor, grade);
  shell(out, p, () => floor, eave, { wall: 'wall', color: C.wall });
  // Main rectangular hip and attached low entrance and side roofs follow the plan wings.
  hipped(out, rect(-84.1, 12.45, -49.9, -21.18), eave - 0.055, 4.6, C.clayRoof, 0.26);
  hipped(out, rect(-56.28, 8.91, -39.37, -26.06), eave - 0.075, 3.68, C.clayRoof, 0.2);
  hipped(out, rect(-61.1, 15.69, -50.8, 6.82), eave - 0.085, 1.6, C.clayRoof, 0.2);
  wallOpenings(out, p, floor, eave, lod, 'throne');
  if (lod > 0) fringe(out, p, eave, lod);
  if (lod > 1) {
    forWalls(p, (w) => {
      if (w.length > 3)
        panel(out, 'stone', w, 0.12, w.length - 0.12, floor + 0.43, floor + 0.6, 0.08, C.pale);
    });
    for (const x of [-56.1, -54.4, -52.6])
      block(out, 'stone', x - 0.1, floor + 0.24, 15.42, 0.2, 3.36, 0.28, C.dressed);
  }
  if (lod === 3) {
    const [x, z] = center;
    block(out, 'masonry', x + 0.41, eave + 2.0, z - 4.2, 0.63, 1.9, 0.66, C.mortar);
  }
}

function banquet(out, p, grade, lod) {
  const floor = Math.max(...p.map(grade)) + 0.3,
    eave = floor + 8.45;
  foundation(out, p, floor, grade);
  shell(out, p, () => floor, eave, { wall: 'wall', color: C.wall });
  const center = planarMid(p),
    q = scale([p[0], p[4], p[3], p[2]], center, 1.018);
  hipped(out, q, eave - 0.035, 8.0, C.clayRoof, 0.09);
  if (lod > 0) {
    const n = lod === 1 ? 3 : 5;
    const a = q[0],
      b = q[1],
      sign = areaSign(q),
      w = edge(a, b, sign);
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * w.length) / n,
        half = Math.min(3.25, (w.length / n) * 0.42),
        tip = eave + 2.24 + 0.15 * (j % 2);
      const polygon = [w.p(u - half, eave, 0.42), w.p(u + half, eave, 0.42), w.p(u, tip, 0.42)];
      face(out, 'wall', polygon, w.normal, C.wall);
      const dl = w.p(u - half - 0.15, eave - 0.09, -4.45),
        dr = w.p(u + half + 0.15, eave - 0.09, -4.45),
        peak = w.p(u, tip + 0.13, -4.45);
      const l = w.p(u - half - 0.15, eave - 0.09, 0.58),
        r = w.p(u + half + 0.15, eave - 0.09, 0.58),
        p0 = w.p(u, tip + 0.13, 0.58);
      face(out, 'roof', [l, p0, peak, dl], [0, 1, 0], C.rust);
      face(out, 'roof', [p0, r, dr, peak], [0, 1, 0], C.clayRoof);
      if (lod > 1)
        arch(
          out,
          w,
          u,
          eave + 0.18,
          eave + 0.69,
          0.31,
          0.42,
          0.48,
          lod - 1,
          { width: 0.08, inner: C.dark, trim: C.dressed },
          { inner: 'glass', trim: 'stone' },
        );
    }
    fringe(out, p, eave, lod);
  }
  wallOpenings(out, p, floor, eave, lod, 'banquet');
}

function drumDome(out, x, z, y, r, segments, lod, small = false) {
  const dz = small ? 1.37 : 3.24,
    w = small ? 1.62 : 2.68;
  ring(
    out,
    'drum',
    [x, z],
    [
      [y, r],
      [y + w, r],
    ],
    segments,
    C.dressed,
  );
  const base = y + w;
  const rim = [
    [base, r],
    [base + 0.21, r * 1.03],
    [base + 0.48, r * 0.99],
  ];
  const b = base + 0.45;
  const profile =
    lod > 1
      ? [
          [b, r],
          [b + dz * 0.38, r * 0.91],
          [b + dz * 0.69, r * 0.72],
          [b + dz * 0.91, r * 0.45],
          [b + dz, r * 0.15],
        ]
      : [
          [b, r],
          [b + dz * 0.67, r * 0.7],
          [b + dz, r * 0.14],
        ];
  if (lod > 0) ring(out, 'stone', [x, z], rim, segments, C.pale);
  ring(out, 'dome', [x, z], profile, segments, C.silver);
  if (lod >= 2) {
    const walls = Array.from({ length: segments }, (_, i) => [
      x + r * 0.999 * Math.cos((i * 2 * Math.PI) / segments),
      z + r * 0.999 * Math.sin((i * 2 * Math.PI) / segments),
    ]);
    forWalls(walls, (wall, i) => {
      if (i % 2 !== 0 || wall.length < 0.63) return;
      arch(
        out,
        wall,
        wall.length * 0.5,
        y + 0.29,
        y + w * 0.64,
        wall.length * 0.28,
        0.24,
        0.071,
        lod - 1,
        { width: 0.068, inner: C.dark, trim: C.pale },
        { inner: 'glass', trim: 'stone' },
      );
    });
  }
  const finial = b + dz;
  if (small) {
    block(out, 'dome', x - 0.078, finial - 0.05, z - 0.078, 0.156, 0.68, 0.156, C.bronze);
  } else {
    const rr = r * 0.147;
    ring(
      out,
      'stone',
      [x, z],
      [
        [finial, rr],
        [finial + 1.25, rr],
        [finial + 1.42, rr * 0.62],
        [finial + 1.59, rr * 0.22],
      ],
      segments,
      C.dressed,
    );
    block(out, 'dome', x - 0.083, finial + 1.54, z - 0.077, 0.166, 0.84, 0.154, C.bronze);
    block(out, 'dome', x - 0.28, finial + 2.11, z - 0.068, 0.56, 0.145, 0.136, C.bronze);
  }
}

function baeta(out, p, grade, lod) {
  const [x, z] = planarMid(p),
    floor = Math.max(...p.map(grade)) + 0.43,
    eave = floor + 8.75;
  const floorRing = scale(p, [x, z], 1.021);
  foundation(out, floorRing, floor, grade);
  shell(out, p, () => floor, eave, { wall: 'drum', color: C.mortar });
  shell(out, scale(p, [x, z], 1.025), () => eave - 0.42, eave + 0.17, {
    wall: 'stone',
    color: C.dressed,
  });
  forWalls(p, (w, i) => {
    const count = lod === 0 ? 3 : 5,
      step = w.length / count;
    for (let j = 0; j < count; j++) {
      const u = step * (j + 0.5);
      const low = floor + (i === 2 && j === Math.floor(count / 2) ? 0.12 : 1.14);
      arch(
        out,
        w,
        u,
        low,
        floor + 4.54,
        step * 0.302,
        step * 0.29,
        0.075,
        lod === 3 ? 2 : lod > 0 ? 1 : 0,
        { width: 0.22, inner: C.dark, trim: C.pale },
        { inner: 'glass', trim: 'stone' },
      );
      if (lod > 1) {
        trimBlock(
          out,
          'stone',
          w,
          u - step * 0.35,
          u + step * 0.35,
          low - 0.19,
          low + 0.02,
          0.04,
          0.18,
          C.dressed,
        );
        panel(out, 'wood', w, u - 0.035, u + 0.035, low + 0.14, floor + 4.97, 0.113, C.darkPot);
      }
    }
    if (lod > 0)
      for (const low of [floor + 0.39, floor + 5.96, eave - 1.01])
        trimBlock(out, 'stone', w, 0, w.length, low, low + 0.19, 0.02, 0.17, C.dressed);
  });
  const n = [8, 12, 16, 24][lod];
  drumDome(out, x, z, eave + 0.07, 6.19, n, lod);
  for (const q of scale(p, [x, z], 0.69))
    drumDome(out, q[0], q[1], eave + 0.07, 1.89, [6, 8, 12, 16][lod], lod, true);
}

function draw(out, lod, { footprints }, grade) {
  [quarter, throne, banquet, baeta].forEach((fn, i) => {
    fn(out, footprints[i].points, grade, lod);
  });
}

const palace = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-172, 83, 143],
    lookAt: [1, 4, 5],
    yaw: 2.03,
    sun: [-210, 550, 390],
    brief:
      'Historic imperial residence, Throne House, Banquet Hall and domed Baeta Maryam mausoleum on the Great Ghebbi ridge in Addis Ababa.',
    views: [
      { name: 'palace-hill-and-halls', position: [-98, 55, 126], lookAt: [-20, 0, 14] },
      { name: 'baeta-maryam-domes-and-arcade', position: [162, 15, 0], lookAt: [124, 7, -47] },
      { name: 'residence-and-throne-house', position: [28, 21, 40], lookAt: [-30, 5, -17] },
      { name: 'banquet-hall-roofs', position: [-100, 17, 5], lookAt: [-88, -1, 64] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = palace;
export const model = { ...palace.model, category: 'palace' };
