/** The Birch Memorial Clock Tower at Ipoh, with open bell and lantern stages. */
import {
  block,
  cap,
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
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  plaster: surface('wall', 'plaster_lime', 0.88),
  stone: surface('foundation', 'stone_limestone_raw', 0.92),
  trim: surface('roof', 'metal_painted', 0.79, 0.08),
  art: surface('trim', 'plaster_tadelakt', 0.93),
  metal: surface('door', 'metal_bronze_cast', 0.64, 0.29),
};
const c = palette({
  white: 'eeebdf',
  trim: 'e2ded0',
  base: 'ccc7b8',
  shadow: 'c2bdae',
  line: 'aaa599',
  black: '424849',
  iron: '505557',
  inner: '686765',
  cream: 'dec9a7',
  gold: '97825b',
  dial: '3d4545',
  ink: 'e5dfcc',
  bell: '534d3e',
  terra: 'd8ceba',
  earth: '8b604a',
  sand: 'b19b67',
  indigo: '526778',
  wine: '815747',
  olive: '726b50',
  dark: '665740',
});

const normals = [
  [0, 0, 1],
  [1, 0, 0],
  [0, 0, -1],
  [-1, 0, 0],
];
function facade(side, distance) {
  const normal = normals[side];
  return {
    normal,
    p: (u, y, d = 0) => [
      u * normal[2] + (distance + d) * normal[0],
      y,
      -u * normal[0] + (distance + d) * normal[2],
    ],
  };
}

function tier(out, width, y0, y1, material, color) {
  const h = width / 2;
  block(out, material, -h, y0, -h, width, y1 - y0, width, color);
}

function profile(out, sections, material, color) {
  for (const [[y, a], [top, b]] of pairs(sections)) {
    for (let side = 0; side < 4; side++) {
      const aWall = facade(side, a * 0.5),
        bWall = facade(side, b * 0.5);
      face(
        out,
        material,
        [aWall.p(-a * 0.5, y), aWall.p(a * 0.5, y), bWall.p(b * 0.5, top), bWall.p(-b * 0.5, top)],
        aWall.normal,
        color,
      );
    }
  }
  const [top, width] = sections.at(-1),
    h = width * 0.5;
  cap(out, material, rect(-h, -h, h, h), top, color);
}

function pedestal(out, lod, plan, grade) {
  const { baseWidth: w, base } = plan,
    h = w / 2;
  shell(out, rect(-h, -h, h, h), (p) => grade(p) - 0.35, base, { wall: 'stone', color: c.base });
  tier(out, w, base - 0.035, base + 0.13, 'plaster', c.trim);
  tier(out, 3.77, base + 0.09, plan.friezeBottom - 0.16, 'plaster', c.white);
  tier(out, 3.93, plan.friezeBottom - 0.22, plan.friezeBottom + 0.045, 'trim', c.iron);
  if (lod === 0) return;
  const levels = lod > 1 ? [0.79, 1.29, 1.79, 2.31, 2.86, 3.38, 3.87] : [0.8, 1.78, 2.86, 3.86];
  for (let side = 0; side < 4; side++) {
    const w = facade(side, 1.888);
    for (const y of levels) panel(out, 'art', w, -1.89, 1.89, y, y + 0.019, 0.008, c.line);
  }
}

function paintedFrieze(out, lod, plan) {
  const { friezeBottom: bottom, friezeTop: top } = plan;
  tier(out, 3.61, bottom, top, 'plaster', c.trim);
  tier(out, 4.04, top - 0.03, top + 0.14, 'trim', c.black);
  profile(
    out,
    [
      [top + 0.14, 4.04],
      [top + 0.27, 3.72],
    ],
    'plaster',
    c.shadow,
  );
  const colors = [c.wine, c.olive, c.earth, c.indigo, c.sand, c.dark, c.indigo, c.wine, c.olive];
  for (let side = 0; side < 4; side++) {
    const w = facade(side, 1.812);
    panel(out, 'art', w, -1.64, 1.64, bottom + 0.08, top - 0.085, 0.007, c.cream);
    if (lod === 0) continue;
    const n = lod === 1 ? 6 : 11;
    for (let i = 0; i < n; i++) {
      const u = mix(-1.49, 1.49, i / (n - 1)),
        y = bottom + 0.12;
      const h = 0.54 + ((i * 7 + side * 3) % 5) * 0.052,
        width = lod === 1 ? 0.16 : 0.105 + (i % 3) * 0.016;
      const pigment = colors[(i + side * 2) % colors.length];
      face(
        out,
        'art',
        [
          w.p(u - width, y, 0.016),
          w.p(u + width, y, 0.016),
          w.p(u + width * 0.69, y + h, 0.016),
          w.p(u - width * 0.64, y + h, 0.016),
        ],
        w.normal,
        pigment,
      );
      panel(out, 'art', w, u - 0.057, u + 0.055, y + h - 0.011, y + h + 0.106, 0.02, c.sand);
      if (lod > 1 && i % 3 !== 1) {
        const d = i % 3 === 0 ? -1 : 1;
        face(
          out,
          'art',
          [
            w.p(u, y + h - 0.25, 0.018),
            w.p(u + d * 0.093, y + h - 0.29, 0.018),
            w.p(u + d * 0.141, y + h - 0.17, 0.018),
            w.p(u + d * 0.05, y + h - 0.1, 0.018),
          ],
          w.normal,
          pigment,
        );
      }
    }
  }
}

function disk(out, w, x, y, r, offset, segments, material, color) {
  const vertices = Array.from({ length: segments }, (_, i) => {
    const a = (i * 2 * Math.PI) / segments;
    return w.p(x + r * Math.cos(a), y + r * Math.sin(a), offset);
  });
  face(out, material, vertices, w.normal, color);
}

function radialMark(out, w, y, r0, r1, angle, half, offset, color) {
  const s = Math.sin(angle),
    co = Math.cos(angle);
  const p = (r, d) => w.p(r * s + d * co, y + r * co - d * s, offset);
  face(out, 'art', [p(r0, -half), p(r0, half), p(r1, half), p(r1, -half)], w.normal, color);
}

function circumferentialCrown(out, side, wallDistance, width, base, rise, stroke, lod) {
  const w = facade(side, wallDistance),
    n = [3, 6, 10, 14][lod];
  const curve = (x) => base + rise * (1 - x * x);
  for (let i = 0; i < n; i++) {
    const a = (2 * i) / n - 1,
      b = (2 * (i + 1)) / n - 1,
      l = a * width * 0.5,
      r = b * width * 0.5,
      yL = curve(a),
      yR = curve(b);
    face(
      out,
      'trim',
      [w.p(l, yL - stroke, 0.075), w.p(r, yR - stroke, 0.075), w.p(r, yR, 0.11), w.p(l, yL, 0.11)],
      w.normal,
      c.black,
    );
    face(
      out,
      'trim',
      [w.p(l, yL, 0.11), w.p(r, yR, 0.11), w.p(r, yR, 0.002), w.p(l, yL, 0.002)],
      [0, 1, 0],
      c.iron,
    );
  }
}

function clocks(out, lod, plan) {
  const y = 10.45,
    n = [8, 20, 28, 40][lod];
  profile(
    out,
    [
      [plan.friezeTop + 0.265, 3.56],
      [6.3, 3.25],
      [11.36, 3.25],
    ],
    'plaster',
    c.white,
  );
  tier(out, 3.61, 11.34, 11.51, 'trim', c.black);
  profile(
    out,
    [
      [11.51, 3.61],
      [11.66, 3.96],
      [11.81, 3.96],
    ],
    'trim',
    c.black,
  );
  for (let side = 0; side < 4; side++) {
    const w = facade(side, 1.638);
    panel(out, 'trim', w, -1.603, -1.46, 6.38, 11.33, 0.015, c.iron);
    panel(out, 'trim', w, 1.46, 1.603, 6.38, 11.33, 0.015, c.iron);
    panel(out, 'art', w, -0.78, 0.78, 9.45, 11.52, 0.009, c.shadow);
    disk(out, w, 0, y, 0.84, 0.033, n, 'metal', c.gold);
    disk(out, w, 0, y, 0.742, 0.046, n, 'trim', c.dial);
    if (lod === 0) disk(out, w, 0, y, 0.57, 0.052, 8, 'art', c.shadow);
    else {
      disk(out, w, 0, y, 0.52, 0.054, n, 'art', c.inner);
      for (let mark = 0; mark < 12; mark++) {
        const a = (mark * Math.PI) / 6;
        radialMark(out, w, y, 0.55, 0.69, a, 0.043, 0.057, c.ink);
        if (lod > 2 && mark % 3 === 0)
          radialMark(out, w, y, 0.55, 0.69, a + 0.09, 0.019, 0.058, c.ink);
      }
    }
    radialMark(out, w, y, 0, 0.55, Math.PI * 0.07, 0.028, 0.067, c.ink);
    radialMark(out, w, y, 0, 0.37, Math.PI * 0.71, 0.043, 0.069, c.ink);
    circumferentialCrown(out, side, 1.997, 2.78, 11.54, 0.62, 0.16, lod);
    if (side === 2 && lod > 0) {
      const dir = facade(side, 1.632);
      panel(out, 'art', dir, -0.43, 0.43, 7.18, 8.45, 0.018, c.base);
      panel(out, 'trim', dir, -0.32, 0.32, 7.26, 8.37, 0.024, c.inner);
    }
  }
}

function openArchStage(out, lod, { base, top, width, pier, opening, rise }) {
  const extent = width * 0.5;
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const u = x * (extent - pier * 0.5),
        v = z * (extent - pier * 0.5);
      block(out, 'plaster', u - pier / 2, base, v - pier / 2, pier, top - base, pier, c.white);
      if (lod > 0) {
        block(
          out,
          'plaster',
          u - pier * 0.6,
          base,
          v - pier * 0.6,
          pier * 1.2,
          0.11,
          pier * 1.2,
          c.trim,
        );
        block(
          out,
          'plaster',
          u - pier * 0.59,
          top - rise - 0.1,
          v - pier * 0.59,
          pier * 1.18,
          0.12,
          pier * 1.18,
          c.trim,
        );
      }
    }
  const n = [2, 8, 12, 14][lod],
    x0 = opening * 0.5,
    spring = top - rise - 0.11;
  for (let side = 0; side < 4; side++) {
    const w = facade(side, extent - 0.052),
      inner = facade(side, extent - 0.28);
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = (i * 2) / n - 1;
      return [x0 * t, spring + rise * Math.sqrt(Math.max(0, 1 - t * t))];
    });
    for (const [a, b] of pairs(pts)) {
      face(
        out,
        'plaster',
        [w.p(...a), w.p(...b), w.p(b[0], top), w.p(a[0], top)],
        w.normal,
        c.white,
      );
      face(
        out,
        'plaster',
        [w.p(...a), inner.p(...a), inner.p(...b), w.p(...b)],
        [0, -1, 0],
        c.shadow,
      );
    }
    for (const sign of [-1, 1]) {
      panel(
        out,
        'plaster',
        w,
        Math.min(sign * x0, sign * extent),
        Math.max(sign * x0, sign * extent),
        base,
        top,
        -0.006,
        c.white,
      );
    }
  }
}

function statues(out, lod, y) {
  const poses = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [[sx, sz], i] of poses.map((v, i) => [v, i])) {
    const x = sx * 1.52,
      z = sz * 1.52,
      pos = [x, z];
    block(out, 'plaster', x - 0.27, y, z - 0.26, 0.54, 0.28, 0.52, c.trim);
    if (lod === 0) {
      ring(
        out,
        'art',
        pos,
        [
          [y + 0.24, 0.17],
          [y + 1.13, 0.14],
          [y + 1.2, 0.071],
          [y + 1.38, 0.1],
          [y + 1.47, 0.029],
        ],
        4,
        c.terra,
      );
      continue;
    }
    const count = 6;
    ring(
      out,
      'art',
      pos,
      [
        [y + 0.24, 0.17],
        [y + 0.48, 0.148],
        [y + 0.83, 0.12],
        [y + 0.99, 0.18],
        [y + 1.19, 0.12],
        [y + 1.24, 0.065],
      ],
      count,
      c.terra,
    );
    ring(
      out,
      'art',
      [x + 0.015, z - 0.012],
      [
        [y + 1.2, 0.066],
        [y + 1.28, 0.107],
        [y + 1.41, 0.091],
        [y + 1.47, 0.029],
      ],
      count,
      c.terra,
    );
    if (lod > 1) {
      block(out, 'art', x + sx * 0.1 - 0.045, y + 0.67, z - 0.051, 0.09, 0.42, 0.1, c.terra);
      if (i !== 1)
        block(out, 'art', x - sx * 0.22 - 0.034, y + 0.5, z - 0.035, 0.068, 1.0, 0.07, c.base);
    }
  }
}

function crown(out, lod, plan) {
  const { belfry, lantern, dome, height, mainBellDiameter } = plan;
  const bellRadius = mainBellDiameter * 0.5;
  tier(out, 3.23, belfry, belfry + 0.235, 'plaster', c.trim);
  openArchStage(out, lod, {
    base: belfry + 0.21,
    top: 14.69,
    width: 2.88,
    pier: 0.4,
    opening: 1.25,
    rise: 0.61,
  });
  statues(out, lod, belfry + 0.12);
  ring(
    out,
    'metal',
    [0, 0],
    [
      [12.45, bellRadius],
      [12.53, bellRadius],
      [12.76, 0.8],
      [13.14, 0.62],
      [13.53, 0.47],
      [13.69, 0.32],
    ],
    lod === 0 ? 8 : 16,
    c.bell,
  );
  block(out, 'trim', -0.075, 13.59, -0.077, 0.15, 0.64, 0.154, c.black);
  if (lod > 1)
    for (const [x, z] of [
      [-0.48, -0.52],
      [0.48, -0.52],
      [-0.48, 0.52],
      [0.48, 0.52],
    ])
      ring(
        out,
        'metal',
        [x, z],
        [
          [13.81, 0.2],
          [13.93, 0.16],
          [14.12, 0.092],
        ],
        8,
        c.bell,
      );
  tier(out, 2.94, 14.58, 14.78, 'plaster', c.trim);
  for (let side = 0; side < 4; side++)
    circumferentialCrown(out, side, 1.521, 3.08, 14.58, 0.59, 0.102, lod);
  profile(
    out,
    [
      [14.73, 2.72],
      [15.25, 2.13],
      [15.49, 1.94],
    ],
    'plaster',
    c.white,
  );
  tier(out, 1.99, lantern - 0.18, lantern + 0.1, 'trim', c.black);
  openArchStage(out, lod, {
    base: lantern + 0.07,
    top: dome - 0.12,
    width: 1.66,
    pier: 0.3,
    opening: 0.51,
    rise: 0.29,
  });
  tier(out, 1.88, dome - 0.16, dome + 0.035, 'trim', c.black);
  const n = [8, 12, 20, 28][lod];
  ring(
    out,
    'plaster',
    [0, 0],
    [
      [dome, 0.82],
      [dome + 0.24, 0.78],
      [dome + 0.56, 0.64],
      [dome + 0.81, 0.43],
      [dome + 0.96, 0.19],
      [dome + 1.11, 0.09],
    ],
    n,
    c.white,
  );
  ring(
    out,
    'plaster',
    [0, 0],
    [
      [dome + 1.07, 0.09],
      [dome + 1.22, 0.12],
      [dome + 1.33, 0.071],
      [dome + 1.55, 0.061],
      [height, 0.018],
    ],
    lod === 0 ? 4 : 8,
    c.trim,
  );
}

function draw(out, lod, plan, grade) {
  pedestal(out, lod, plan, grade);
  paintedFrieze(out, lod, plan);
  clocks(out, lod, plan);
  crown(out, lod, plan);
}

const tower = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [19, 9, 25],
    lookAt: [0, 9.5, 0],
    yaw: 0.68,
    sun: [340, 610, 390],
    brief:
      'A white square clock tower with inset painted panels, four dark clock faces, a black curved cornice, open belfry with corner figures, small lantern and tall pale finial.',
    views: [
      { name: 'plaza-plinth-and-painted-band', position: [11, 4, 21], lookAt: [0, 7, 0] },
      { name: 'four-dials-and-bell-stage', position: [8, 12, 11], lookAt: [0, 12.2, 0] },
      { name: 'lantern-and-corner-figures', position: [-8, 17, -10], lookAt: [0, 14.95, 0] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = tower;
export const model = { ...tower.model, category: 'tower' };
