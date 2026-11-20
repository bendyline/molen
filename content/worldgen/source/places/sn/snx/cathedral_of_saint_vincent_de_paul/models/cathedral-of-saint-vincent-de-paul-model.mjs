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
  plane,
  rect,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  stone: 'dbcba9',
  white: 'efe3c8',
  trim: 'd4be96',
  warm: 'c7a77c',
  cool: 'aaa297',
  roof: '81776d',
  roofTan: 'a0846d',
  deep: '8e7e69',
  dark: '574f42',
  glass: '435d6e',
  blue: '596f88',
  green: '58736d',
  wine: '875965',
  gold: 'b79b58',
  metal: '6b6252',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.89),
  trim: surface('trim', 'stone_ashlar', 0.88),
  base: surface('foundation', 'stone_limestone_weathered', 0.91),
  tile: surface('roof', 'tile_ceramic', 0.87),
  glass: surface('window', 'storefront', 0.53, 0.035),
  wood: surface('door', 'wood_plain', 0.86),
  metal: surface('trim', 'metal_painted', 0.74, 0.15),
};
const up = [0, 1, 0],
  down = [0, -1, 0];
const archSurfaces = { inner: 'glass', trim: 'trim' };
const archPalette = { inner: color.glass, trim: color.trim, width: 0.13 };

function gable(out, x0, x1, z0, z1, eaves, ridge, axis = 'z') {
  const mid = axis === 'z' ? (x0 + x1) / 2 : (z0 + z1) / 2;
  if (axis === 'z') {
    const a = [x0, eaves, z0],
      b = [x1, eaves, z0],
      c = [x1, eaves, z1],
      d = [x0, eaves, z1],
      u = [mid, ridge, z0],
      v = [mid, ridge, z1];
    face(out, 'tile', [a, u, v, d], up, color.roofTan);
    face(out, 'tile', [u, b, c, v], up, color.roof);
    face(out, 'stone', [a, u, b], [0, 0, -1], color.stone);
    face(out, 'stone', [d, c, v], [0, 0, 1], color.stone);
  } else {
    const a = [x0, eaves, z0],
      b = [x1, eaves, z0],
      c = [x1, eaves, z1],
      d = [x0, eaves, z1],
      u = [x0, ridge, mid],
      v = [x1, ridge, mid];
    face(out, 'tile', [a, b, v, u], up, color.roofTan);
    face(out, 'tile', [u, v, c, d], up, color.roof);
    face(out, 'stone', [a, d, u], [-1, 0, 0], color.stone);
    face(out, 'stone', [b, v, c], [1, 0, 0], color.stone);
  }
}

function perimeter(out, d, grade, lod) {
  const y = d.floorY,
    eaves = y + 11.75,
    sign = areaSign(d.outline);
  for (const [i, [a, b]] of pairs(closed(d.outline)).entries()) {
    // The open front porch and the projecting tower bases complete this side.
    if (i >= 11 && i <= 16 && i !== 16) continue;
    const wall = edge(a, b, sign);
    const base = Math.min(grade(a), grade(b), y) - 0.46;
    panel(out, 'base', wall, 0, wall.length, base, y + 0.48, 0, color.cool);
    panel(out, 'stone', wall, 0, wall.length, y + 0.48, eaves, 0, color.stone);
    if (!lod) continue;
    panel(out, 'trim', wall, 0, wall.length, eaves - 0.41, eaves + 0.04, 0.084, color.white);
    if (wall.length > 4.45) {
      const n = Math.max(1, Math.round(wall.length / 6.25));
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) * wall.length) / n;
        const sill = y + (i <= 5 ? 4.75 : 5.51);
        arch(out, wall, x, sill, sill + 2.85, 0.62, 0.68, 0.04, lod - 1, archPalette, archSurfaces);
        if (lod > 1)
          trimBlock(
            out,
            'trim',
            wall,
            x - 0.75,
            x + 0.75,
            sill - 0.15,
            sill + 0.037,
            0.017,
            0.21,
            color.trim,
          );
      }
    }
  }
  cap(out, 'tile', d.outline, eaves, color.roof);

  const l = -8.37,
    r = 7.69,
    back = -20.98,
    front = 39.36;
  block(
    out,
    'stone',
    l,
    eaves - 0.15,
    back,
    r - l,
    d.naveRoofEaves - 11.59,
    front - back,
    color.stone,
  );
  gable(
    out,
    l - 0.18,
    r + 0.18,
    back - 0.14,
    front + 0.14,
    y + d.naveRoofEaves,
    y + d.naveRoofRidge,
  );
  block(out, 'stone', -18.74, eaves - 0.04, -13.55, 34.96, 2.43, 13.33, color.stone);
  gable(out, -18.88, 16.32, -13.64, -0.19, y + 14.13, y + 19.69, 'x');

  const backRing = d.outline.slice(0, 7);
  const apseCenter = [-0.73, -20.72];
  const apseSlope = backRing.map(([x, z]) =>
    at([mix(apseCenter[0], x, 0.61), mix(apseCenter[1], z, 0.69)], eaves + 2.48),
  );
  for (let i = 0; i < backRing.length - 1; i++)
    face(
      out,
      'tile',
      [
        at(backRing[i], eaves + 0.015),
        at(backRing[i + 1], eaves + 0.015),
        apseSlope[i + 1],
        apseSlope[i],
      ],
      up,
      color.roofTan,
    );
  cap(
    out,
    'tile',
    apseSlope.map(([x, , z]) => [x, z]),
    eaves + 2.48,
    color.roof,
  );

  if (lod) {
    for (const [x, sign] of [
      [l, -1],
      [r, 1],
    ]) {
      const wall = edge([x, back], [x, front], sign);
      for (const z of [-17.8, 3.3, 9.0, 14.8, 20.6, 26.4, 32.2])
        opening(
          out,
          wall,
          z - back - 0.57,
          z - back + 0.57,
          eaves + 0.64,
          eaves + 2.15,
          'trim',
          color.glass,
          'glass',
          color.trim,
          lod - 1,
          0.042,
        );
    }
  }
}

function cupola(out, center, base, top, size, lod, tint) {
  const n = [8, 12, 20, 28][lod];
  const ring = (fraction, scale) =>
    radialRing(mix(base, top, fraction), size * scale, size * scale, n, center);
  const profile = [
    [0, 0.94],
    [0.13, 1.04],
    [0.31, 1.0],
    [0.49, 0.86],
    [0.62, 0.79],
    [0.79, 0.61],
    [0.92, 0.34],
    [1, 0.09],
  ];
  const detail =
    lod < 2 ? profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1) : profile;
  loft(
    out,
    'tile',
    detail.map(([h, s]) => ring(h, s)),
    tint,
  );
  if (lod > 1) {
    for (const [height, scale] of [
      [0.21, 1.045],
      [0.53, 0.864],
      [0.76, 0.67],
    ])
      loft(out, 'trim', [ring(height - 0.01, scale), ring(height + 0.015, scale)], color.trim);
  }
}

function cross(out, x, y, z, h, breadth, double) {
  const size = Math.max(0.095, breadth * 0.1);
  beam(out, 'metal', [x, y, z], [x, y + h, z], size, size, color.metal);
  const arms = double
    ? [
        [0.54, 1],
        [0.78, 0.75],
      ]
    : [[0.68, 1]];
  for (const [at, scale] of arms)
    beam(
      out,
      'metal',
      [x - breadth * 0.5 * scale, y + h * at, z],
      [x + breadth * 0.5 * scale, y + h * at, z],
      size,
      size,
      color.metal,
    );
}

function crossing(out, d, lod) {
  const [x, z] = d.domeCenter,
    eaves = d.floorY + 18.8;
  const n = lod > 1 ? 16 : 8;
  const drum = (y, r) => radialRing(y, r, r, n, [x, z], Math.PI / 8);
  loft(out, 'stone', [drum(eaves, 5.43), drum(eaves + 4.61, 4.96)], color.white);
  loft(out, 'trim', [drum(eaves + 4.39, 5.06), drum(eaves + 4.82, 5.19)], color.trim);
  cupola(out, [x, z], eaves + 4.77, eaves + 8.74, 4.89, lod, color.roofTan);
  if (lod) {
    const outside = drum(eaves, 5.4).map(([a, , b]) => [a, b]);
    for (let i = 0; i < n; i += lod > 1 ? 2 : 1) {
      const w = edge(outside[i], outside[(i + 1) % n], 1);
      arch(
        out,
        w,
        w.length / 2,
        eaves + 2.11,
        eaves + 3.22,
        0.36,
        0.3,
        0.046,
        lod - 1,
        archPalette,
        archSurfaces,
      );
    }
    cross(out, x, eaves + 8.69, z, 0.96, 0.66, false);
  }
}

function colonnette(out, x, z, bottom, height, radius, lod) {
  const n = lod > 2 ? 9 : 6;
  const r = (y, scale) => radialRing(y, radius * scale, radius * scale, n, [x, z]);
  loft(
    out,
    'trim',
    [
      r(bottom, 1.37),
      r(bottom + 0.22, 1.28),
      r(bottom + 0.34, 0.91),
      r(bottom + height - 0.38, 0.85),
      r(bottom + height - 0.25, 1.21),
      r(bottom + height, 1.29),
    ],
    color.white,
  );
}

function tower(out, center, dimensions, width, lod, grade) {
  const [x, z] = center,
    y = dimensions.floorY,
    eave = y + dimensions.towerEaves;
  const front = dimensions.frontZ,
    back = z - 4.33;
  const l = x - width / 2,
    r = x + width / 2;
  const bottom = Math.min(...rect(l, back, r, front).map(grade), y) - 0.44;
  block(out, 'stone', l, bottom, back, width, eave - bottom, front - back, color.stone);
  for (const [h, thick, over] of [
    [0.45, 0.57, 0.2],
    [8.03, 0.26, 0.2],
    [15.48, 0.32, 0.29],
    [22.06, 0.33, 0.41],
    [28.8, 0.29, 0.37],
    [29.43, 0.36, 0.56],
  ]) {
    if (lod || h > 21)
      block(
        out,
        'trim',
        l - over,
        y + h,
        back - over,
        width + 2 * over,
        thick,
        front - back + 2 * over,
        h > 28 ? color.white : color.trim,
      );
  }
  const ring = (h, scale) =>
    rect(x - (width * scale) / 2, z - 4.22 * scale, x + (width * scale) / 2, z + 4.22 * scale).map(
      (p) => at(p, h),
    );
  loft(out, 'trim', [ring(eave, 1), ring(eave + 0.58, 0.78)], color.trim);
  cupola(
    out,
    [x, z],
    eave + 0.48,
    y + dimensions.towerCrown,
    Math.min(3.28, width * 0.463),
    lod,
    color.roofTan,
  );
  cross(out, x, y + dimensions.towerCrown - 0.04, z, 1.89, 1.13, true);
  if (!lod) return;

  const sides = rect(l, back, r, front);
  for (const [a, b] of pairs(closed(sides))) {
    const wall = edge(a, b, areaSign(sides)),
      mid = wall.length / 2;
    for (const level of [y + 3.1, y + 9.64, y + 16.94]) {
      arch(
        out,
        wall,
        mid,
        level,
        level + 2.16,
        0.57,
        0.63,
        0.052,
        lod - 1,
        archPalette,
        archSurfaces,
      );
      if (lod > 1)
        panel(
          out,
          'trim',
          wall,
          mid - 0.755,
          mid + 0.755,
          level - 0.11,
          level + 0.028,
          0.128,
          color.white,
        );
    }
    for (const offset of [-1.06, 1.06]) {
      const u = mid + offset;
      arch(
        out,
        wall,
        u,
        y + 23.31,
        y + 26.54,
        0.73,
        0.71,
        0.041,
        lod - 1,
        { ...archPalette, inner: color.dark, trim: color.white },
        archSurfaces,
      );
      if (lod > 1)
        for (const h of [24.12, 24.81, 25.51, 26.19])
          panel(out, 'wood', wall, u - 0.71, u + 0.71, y + h, y + h + 0.089, 0.082, color.deep);
    }
    if (lod > 1) {
      for (const u of [0.59, wall.length - 0.59])
        panel(out, 'trim', wall, u - 0.29, u + 0.29, y + 1.04, eave - 0.17, 0.103, color.white);
      for (let i = 1; i < 7; i++) {
        const u = (i * wall.length) / 7;
        trimBlock(
          out,
          'trim',
          wall,
          u - 0.13,
          u + 0.13,
          y + 28.49,
          y + 29.14,
          -0.01,
          0.18,
          color.trim,
        );
      }
    }
  }
}

function rose(out, x, y, z, radius, lod) {
  const n = [10, 17, 25, 34][lod];
  const w = plane(z, 1);
  const circle = (r) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return w.p(x + r * Math.cos(a), y + r * Math.sin(a));
    });
  const core = circle(radius),
    outer = circle(radius + 0.31);
  face(out, 'glass', core, w.normal, color.glass);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(out, 'trim', [core[i], outer[i], outer[j], core[j]], w.normal, color.white);
  }
  if (!lod) return;
  const petals = [color.blue, color.green, color.wine, color.gold];
  const count = lod === 1 ? 8 : 12;
  for (let i = 0; i < count; i++) {
    const t = (Math.PI * 2 * i) / count;
    const point = (r, a = t) => [x + r * Math.cos(a), y + r * Math.sin(a), z + 0.035];
    const delta = (Math.PI / count) * 0.51;
    face(
      out,
      'glass',
      [
        point(radius * 0.28),
        point(radius * 0.64, t - delta),
        point(radius * 0.91),
        point(radius * 0.64, t + delta),
      ],
      w.normal,
      petals[i % petals.length],
    );
    if (lod > 1)
      beam(out, 'trim', point(radius * 0.29), point(radius * 0.94), 0.096, 0.082, color.trim);
  }
  const hub = circle(radius * 0.24).map(([a, b]) => [a, b, z + 0.053]);
  face(out, 'trim', hub, w.normal, color.trim);
  panel(
    out,
    'trim',
    w,
    x - 0.12,
    x + 0.12,
    y - radius * 0.16,
    y + radius * 0.17,
    0.085,
    color.white,
  );
  panel(out, 'trim', w, x - 0.36, x + 0.36, y - 0.09, y + 0.09, 0.085, color.white);
}

function porch(out, d, grade, lod) {
  const y = d.floorY,
    x = -0.74,
    front = d.porchZ,
    l = -6.24,
    r = 4.75;
  const z = front + 0.11,
    leftDoor = l + 0.35,
    rightDoor = r - 0.35;
  block(out, 'stone', l, y - 0.46, z - 0.93, r - l, 19.8, 0.94, color.stone);
  const frontWall = plane(z + 0.014, 1);
  const ridge = y + 23.92;
  face(
    out,
    'stone',
    [
      [l, y + 18.9, z],
      [r, y + 18.9, z],
      [x, ridge, z],
    ],
    [0, 0, 1],
    color.stone,
  );
  for (const [a, b] of [
    [
      [l, y + 18.72, z + 0.08],
      [x, ridge + 0.12, z + 0.08],
    ],
    [
      [x, ridge + 0.12, z + 0.08],
      [r, y + 18.72, z + 0.08],
    ],
  ])
    beam(out, 'trim', a, b, 0.31, 0.32, color.white);
  if (lod) {
    arch(
      out,
      frontWall,
      x,
      y + 8.18,
      y + 12.36,
      4.12,
      4.96,
      0.022,
      lod - 1,
      { inner: color.stone, trim: color.white, width: 0.25 },
      { inner: 'stone', trim: 'trim' },
    );
    panel(out, 'trim', frontWall, x - 4.02, x + 4.02, y + 7.02, y + 8.06, 0.073, color.gold);
    if (lod > 1) {
      for (let i = 0; i < 13; i++) {
        const u = x - 3.65 + i * 0.605;
        const h = y + 7.43 + (i % 3) * 0.08;
        face(
          out,
          'trim',
          [
            [u - 0.11, h, z + 0.12],
            [u, h - 0.16, z + 0.12],
            [u + 0.11, h, z + 0.12],
            [u, h + 0.16, z + 0.12],
          ],
          [0, 0, 1],
          i % 3 === 0 ? color.warm : color.white,
        );
      }
    }
  }
  rose(out, x, y + 13.25, z + 0.095, 3.08, lod);
  const shellZ = z + 1.8;
  const porchWall = plane(shellZ, 1);
  const spring = y + 4.74,
    top = y + 6.68,
    axis = 2.71,
    half = 1.03;
  for (const center of [x - axis, x, x + axis]) {
    const circle = Array.from({ length: [5, 8, 12, 15][lod] + 1 }, (_, i) => {
      const a = Math.PI * (1 - i / [5, 8, 12, 15][lod]);
      return [center + half * Math.cos(a), spring + 1.1 * Math.sin(a)];
    });
    for (const [i, [[a, b], [c, h]]] of pairs(circle).entries()) {
      face(
        out,
        'stone',
        [porchWall.p(a, b), porchWall.p(c, h), porchWall.p(c, top), porchWall.p(a, top)],
        porchWall.normal,
        color.stone,
      );
      face(
        out,
        'trim',
        [porchWall.p(a, b), porchWall.p(c, h), porchWall.p(c, h, -1.68), porchWall.p(a, b, -1.68)],
        down,
        color.deep,
      );
      if (lod)
        face(
          out,
          'trim',
          [
            porchWall.p(a, b, 0.073),
            porchWall.p(c, h, 0.073),
            porchWall.p(c, h + 0.2, 0.073),
            porchWall.p(a, b + 0.2, 0.073),
          ],
          porchWall.normal,
          i % 2 ? color.white : color.warm,
        );
    }
    arch(
      out,
      frontWall,
      center,
      y + 0.37,
      y + 3.42,
      0.87,
      0.89,
      0.035,
      Math.max(0, lod - 1),
      { inner: color.dark, trim: color.trim, width: 0.15 },
      { inner: 'wood', trim: 'trim' },
    );
  }
  for (const u of [x - 4.06, x - 1.35, x + 1.35, x + 4.06]) {
    panel(out, 'stone', porchWall, u - 0.34, u + 0.34, spring, top, 0, color.stone);
    if (!lod)
      block(
        out,
        'trim',
        u - 0.22,
        y + 0.18,
        shellZ - 0.25,
        0.44,
        spring - y - 0.15,
        0.52,
        color.white,
      );
    else
      for (const offset of [lod > 1 ? -0.19 : 0, 0.19])
        colonnette(out, u + offset, shellZ - 0.16, y + 0.24, spring - y - 0.24, 0.155, lod);
  }
  block(out, 'trim', l + 0.18, y + 6.56, z - 0.04, r - l - 0.36, 0.33, 2.07, color.white);
  const yard = Math.max(grade([x, 44.21]), Math.min(y + 0.14, grade([x, 42.4])));
  const foot = Math.min(yard, y - 0.08) - 0.17;
  for (let i = 0; i < 4; i++) {
    const rise = mix(yard, y + 0.24, (i + 1) / 4);
    block(
      out,
      'base',
      leftDoor,
      foot,
      shellZ + (3 - i) * 0.43,
      rightDoor - leftDoor,
      Math.max(0.14, rise - foot),
      0.45,
      color.cool,
    );
  }
}

function build(out, lod, dimensions, grade) {
  perimeter(out, dimensions, grade, lod);
  crossing(out, dimensions, lod);
  porch(out, dimensions, grade, lod);
  for (const [i, center] of dimensions.towerCenters.entries())
    tower(out, center, dimensions, i === 0 ? 7.49 : 8.24, lod, grade);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Tunis cathedral with its patterned limestone façade, triple columned porch, rose window, twin tiara-shaped bell towers, crossing dome and rounded apse.',
    camera: [66, 54, 119],
    lookAt: [0, 13, 11],
    yaw: 0.63,
    sun: [-280, 540, 560],
    views: [
      { name: 'square-and-tiara-cupolas', position: [-31, 18, 98], lookAt: [0, 15.5, 30] },
      { name: 'triple-porch-and-rose-window', position: [-1, 7.0, 68], lookAt: [0, 12.2, 39] },
      { name: 'crossing-dome-and-apse', position: [37, 49, -71], lookAt: [0.1, 12, -12] },
      { name: 'nave-and-north-transept', position: [-61, 30, -18], lookAt: [-0.2, 12.3, -2] },
    ],
  },
  build,
);
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const { skyline, district, street, closeup } = asset;
export const model = {
  ...asset.model,
  category: 'religious',
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'The named survey outline of the Cathedral of Saint Vincent de Paul in Tunis.',
  },
};
