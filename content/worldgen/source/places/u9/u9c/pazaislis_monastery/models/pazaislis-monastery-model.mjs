import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { cap } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const outline = frame.geometry.outline;
const wings = frame.features.slice(1).map((part) => part.points);
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.91 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.87 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.14 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.56, metallic: 0.26 },
};
const stone = rgb('b8afa2');
const lightStone = rgb('c5bcb0');
const pale = rgb('d8cdb8');
const white = rgb('e6ddc5');
const paving = rgb('969284');
const plinth = rgb('a19889');
const dark = rgb('383c3b');
const glass = rgb('596970');
const gold = rgb('c6a96b');
const metal = rgb('666e6d');
const red = rgb('9a5e49');
const sealingMetal = rgb('7b8580');
const westFront = [
  outline[5],
  outline[4],
  outline[3],
  outline[2],
  outline[1],
  outline[0],
  outline[22],
];
const towerWall = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x - w / 2, z + d / 2],
  [x + w / 2, z + d / 2],
  [x + w / 2, z - d / 2],
];
const faces = (shape) => {
  const ring = outwardRing(shape);
  return ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
};

function solid(out, slot, ring, bottom, top, tint, covered = true) {
  extrude(out, slot, ring, bottom, top, tint, { top: false });
  if (!covered) cap(out, slot, ring, top, tint);
}

function panel(out, slot, f, u0, u1, y0, y1, d, tint) {
  quad4(out, slot, f.P(u0, y0, d), f.P(u1, y0, d), f.P(u1, y1, d), f.P(u0, y1, d), tint);
}

function arch(out, f, u, y, w, h, lod, options = {}) {
  const {
    aperture = glass,
    depth = 0.035,
    inlay = true,
    frameTint = lightStone,
    door = false,
  } = options;
  const r = w / 2;
  const spring = y + h - r;
  const arc = roundArch(r, [3, 5, 8, 12][lod]);
  const pt = (dx, dy, d) => f.P(u + dx, spring + dy, d);
  fan(
    out,
    'dark',
    [
      f.P(u - r, y, depth),
      f.P(u + r, y, depth),
      ...arc
        .slice()
        .reverse()
        .map(([x, dy]) => pt(x, dy, depth)),
    ],
    aperture,
  );
  if (!lod || !inlay) return;
  const rim = Math.min(0.24, 0.12 * w);
  const extent = r + rim;
  const outer = roundArch(extent, arc.length - 1);
  fbox(out, 'trim', f, u - extent, u - r, y - 0.06, spring, depth - 0.02, depth + 0.12, frameTint);
  fbox(out, 'trim', f, u + r, u + extent, y - 0.06, spring, depth - 0.02, depth + 0.12, frameTint);
  for (let i = 0; i < arc.length - 1; i++) {
    const [a, b] = arc.slice(i, i + 2);
    const [c, d] = outer.slice(i, i + 2);
    quad4(
      out,
      'trim',
      pt(...b, depth + 0.13),
      pt(...a, depth + 0.13),
      pt(...c, depth + 0.13),
      pt(...d, depth + 0.13),
      frameTint,
    );
  }
  fbox(
    out,
    'trim',
    f,
    u - extent - 0.08,
    u + extent + 0.08,
    y - 0.18,
    y,
    depth - 0.04,
    depth + 0.21,
    frameTint,
  );
  if (aperture === glass && lod >= 2) {
    const bars = lod === 3 ? 3 : 1;
    for (let i = 1; i <= bars; i++) {
      const x = u + w * (i / (bars + 1) - 0.5);
      panel(out, 'trim', f, x - 0.035, x + 0.035, y, spring + 0.16, depth + 0.024, pale);
    }
    panel(out, 'trim', f, u - r, u + r, spring - 0.11, spring - 0.05, depth + 0.024, pale);
  }
  if (door && lod === 3) {
    for (const dx of [-r * 0.64, 0, r * 0.64]) {
      panel(
        out,
        'iron',
        f,
        u + dx - 0.026,
        u + dx + 0.026,
        y,
        spring,
        depth + 0.035,
        rgb('544a3d'),
      );
    }
  }
}

function strip(out, f, y, height, depth, tint = lightStone) {
  fbox(out, 'trim', f, 0, f.length, y, y + height, -0.12, depth, tint);
}

function pilaster(out, f, u, y0, y1, w, lod) {
  fbox(out, 'trim', f, u - w / 2, u + w / 2, y0, y1, -0.025, 0.19, lightStone);
  if (lod < 2) return;
  fbox(out, 'trim', f, u - w * 0.65, u + w * 0.65, y0, y0 + 0.36, 0.04, 0.34, stone);
  fbox(out, 'trim', f, u - w * 0.74, u + w * 0.74, y1 - 0.68, y1, 0.02, 0.41, pale);
  if (lod === 3) {
    fbox(out, 'trim', f, u - w * 0.82, u + w * 0.82, y1 - 0.16, y1, 0.025, 0.5, lightStone);
    for (const q of [-0.24, 0, 0.24]) {
      panel(
        out,
        'trim',
        f,
        u + q * w - 0.035,
        u + q * w + 0.035,
        y1 - 0.51,
        y1 - 0.19,
        0.425,
        stone,
      );
    }
  }
}

function dial(out, f, u, y, lod) {
  const n = [8, 12, 24, 40][lod];
  const radius = 1.46;
  const point = (a, r, d = 0.085) => f.P(u + r * Math.cos(a), y + r * Math.sin(a), d);
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n);
  fan(
    out,
    'dark',
    angles.map((a) => point(a, radius)),
    dark,
  );
  if (!lod) return;
  for (let i = 0; i < n; i++) {
    const a = angles[i];
    const b = angles[(i + 1) % n];
    quad4(
      out,
      'iron',
      point(a, radius, 0.11),
      point(b, radius, 0.11),
      point(b, radius - 0.07, 0.11),
      point(a, radius - 0.07, 0.11),
      gold,
    );
  }
  for (const [angle, length] of [
    [1.22, 0.73],
    [3.39, 1.1],
  ]) {
    beam(out, 'iron', f.P(u, y, 0.14), point(angle, length, 0.14), 0.062, 0.06, gold);
  }
  if (lod === 3) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(out, 'iron', point(a, 1.03, 0.13), point(a, 1.31, 0.13), 0.065, 0.045, gold);
    }
  }
}

function cross(out, x, top, z, scale, lod) {
  beam(out, 'iron', [x, top - 2.3 * scale, z], [x, top, z], 0.12 * scale, 0.13 * scale, dark);
  if (lod > 0) {
    beam(
      out,
      'iron',
      [x - 0.66 * scale, top - 0.65 * scale, z],
      [x + 0.66 * scale, top - 0.65 * scale, z],
      0.1 * scale,
      0.1 * scale,
      dark,
    );
  }
}

function westernElevation(out, lod) {
  const nave = [
    outline[0],
    outline[1],
    outline[2],
    outline[3],
    outline[4],
    outline[5],
    outline[7],
    outline[8],
    outline[9],
    outline[10],
    [10.9, -8.2],
    [-11.45, -8.2],
    outline[17],
    outline[18],
    outline[19],
    outline[20],
    outline[22],
  ];
  solid(out, 'base', outline, -2.6, 0.66, plinth);
  solid(out, 'plaster', nave, 0.66, 23.1, white, false);
  for (const face of faces(nave)) {
    if (face.origin[1] > 18 && face.P(face.length, 0, 0)[2] > 18) {
      fbox(out, 'sandstone', face, 0, face.length, 0.66, 23.1, -0.12, 0.02, stone);
      if (lod) {
        strip(out, face, 16.4, 0.66, 0.32);
        strip(out, face, 18.8, 1.1, 0.6, lightStone);
        strip(out, face, 22.25, 0.78, 0.49, lightStone);
      }
    } else if (lod > 1 && Math.abs(face.normal[0]) > 0.56 && face.length > 4.5) {
      const center = face.length / 2;
      const visibleBase = face.origin[1] > 8 ? 11.45 : 10.9;
      arch(out, face, center, visibleBase + 1.4, 1.67, 3.58, lod, { frameTint: pale });
      strip(out, face, 22.45, 0.43, 0.32, pale);
      if (lod === 3) {
        pilaster(out, face, 0.39, visibleBase, 22.39, 0.43, lod);
        pilaster(out, face, face.length - 0.39, visibleBase, 22.39, 0.43, lod);
      }
    }
  }
  const entry = facade([0.79, 20.65], [1, -0.025]);
  arch(out, entry, 0, 1.2, 2.77, 5.25, lod, { aperture: rgb('514338'), depth: 0.11, door: true });
  arch(out, entry, 0.05, 9.1, 2.36, 4.45, lod, { depth: 0.11 });
  if (lod > 0) {
    fbox(out, 'trim', entry, -2.1, 2.1, 6.45, 6.77, -0.44, 0.5, pale);
    fbox(out, 'sandstone', entry, -1.35, 1.35, 6.79, 8.16, -0.32, 0.4, lightStone);
    panel(out, 'dark', entry, -0.93, 0.93, 6.97, 8.0, 0.42, paving);
    const crest = [
      [-0.73, 20.74],
      [0.05, 20.26],
      [0.83, 20.74],
      [0.87, 21.54],
      [0.42, 21.81],
      [-0.28, 21.79],
      [-0.81, 21.53],
    ];
    fan(
      out,
      'trim',
      crest.map(([u, y]) => entry.P(u, y, 0.36)),
      lightStone,
    );
    if (lod >= 2) {
      panel(out, 'trim', entry, -0.075, 0.075, 20.61, 21.6, 0.42, pale);
      for (const s of [-1, 1]) {
        beam(
          out,
          'trim',
          entry.P(0, 20.95, 0.41),
          entry.P(s * 0.45, 21.39, 0.41),
          0.12,
          0.12,
          pale,
        );
      }
    }
    for (let i = 1; i <= 3; i++) {
      const z = 22.5 + i * 0.28;
      abox(
        out,
        'base',
        [-2.15 - i * 0.19, 0.38, 20.12],
        [3.76 + i * 0.19, 1.22 - i * 0.185, z],
        paving,
        { bottom: false },
      );
    }
  }
  if (lod < 2) return;
  for (let n = 0; n < westFront.length - 1; n++) {
    const a = westFront[n],
      b = westFront[n + 1];
    const f = wallFace(a, b);
    if (n !== 2 && n !== 3)
      pilaster(out, f, f.length * 0.5, 1.15, 16.55, n === 0 || n === 5 ? 1.21 : 0.66, lod);
    if (n >= 1 && n <= 4) {
      const amount = lod === 3 ? Math.ceil(f.length / 0.53) : Math.ceil(f.length / 0.95);
      for (let j = 0; j < amount; j++) {
        const u = ((j + 0.5) * f.length) / amount;
        fbox(out, 'trim', f, u - 0.095, u + 0.095, 23.08, 23.66, 0.04, 0.22, lightStone);
      }
      strip(out, f, 23.66, 0.19, 0.29);
    }
  }
}

function towerShaft(out, x, lod) {
  const z = 18.08;
  const key = towerWall(x, z, 6.7, 8.24);
  const upstage = towerWall(x, z - 0.03, 5.8, 7.46);
  solid(out, 'sandstone', key, 0.61, 23.0, stone);
  solid(out, 'sandstone', upstage, 22.98, 34.5, stone);
  for (const f of faces(key)) {
    if (lod) {
      strip(out, f, 19.14, 0.59, 0.42, pale);
      strip(out, f, 22.34, 0.67, 0.46, lightStone);
    }
    if (f.normal[1] > 0.5 || (x < 0 && f.normal[0] < -0.5) || (x > 0 && f.normal[1] < -0.5)) {
      dial(out, f, f.length * 0.5, 21.0, lod);
    }
    if (lod > 1) {
      for (const u of [0.85, f.length - 0.85]) pilaster(out, f, u, 2.1, 16.7, 0.84, lod);
    }
  }
  for (const f of faces(upstage)) {
    const u = f.length / 2;
    if (lod || f.normal[1] > 0.5) arch(out, f, u, 26.23, 2.4, 5.05, lod, { aperture: dark });
    if (lod) {
      strip(out, f, 24.25, 0.3, 0.19);
      strip(out, f, 33.82, 0.7, 0.52);
    }
    if (lod > 0) {
      pilaster(out, f, 0.59, 24.56, 33.79, 0.77, lod);
      pilaster(out, f, f.length - 0.59, 24.56, 33.79, 0.77, lod);
    }
    if (lod > 1 && f.normal[1] > 0.5) {
      for (let i = 0; i < (lod === 3 ? 7 : 4); i++) {
        const s = u - 1.03 + i * (lod === 3 ? 0.34 : 0.68);
        fbox(out, 'trim', f, s - 0.066, s + 0.066, 26.23, 27.14, 0.09, 0.27, lightStone);
      }
    }
  }
  lathe(
    out,
    'metal',
    [x, z],
    [
      [34.49, 4.67, 5.87],
      [35.0, 3.98, 5.02],
      [36.4, 2.7, 3.36],
      [37.32, 1.44, 1.65],
      [38.55, 0.55, 0.62],
    ],
    4,
    metal,
    { rotation: Math.PI / 4 },
  );
  cross(out, x, 40.03, z, 0.73, lod);
}

function dome(out, lod) {
  const center = [-0.04, 1.64];
  const rotation = Math.PI / 6;
  const drum = tower(out, 'plaster', center, 11.66, 6, 22.5, 32.54, white, {
    rotation,
    top: false,
  });
  tower(out, 'trim', center, 11.92, 6, 22.59, 23.28, pale, { rotation, top: false });
  tower(out, 'trim', center, 12.08, 6, 31.72, 32.62, lightStone, { rotation, top: false });
  for (const f of faces(drum)) {
    arch(out, f, f.length * 0.5, 25.15, 2.69, 4.92, lod);
    if (lod > 0)
      for (const u of [1.08, f.length - 1.08]) pilaster(out, f, u, 23.76, 31.73, 0.74, lod);
  }
  const profile = [
    [32.58, 12.1, 12.1],
    [33.18, 12.01, 12.01],
    [34.0, 11.76, 11.76],
    [35.32, 11.05, 11.05],
    [37.13, 9.53, 9.53],
    [38.85, 7.75, 7.75],
    [40.37, 5.67, 5.67],
    [41.66, 3.31, 3.31],
    [42.37, 2.15, 2.15],
  ];
  lathe(out, 'metal', center, lod < 2 ? profile.filter((_, i) => i % 2 === 0) : profile, 6, metal, {
    rotation,
  });
  const lantern = tower(out, 'plaster', center, 2.28, 6, 42.02, 46.23, white, {
    rotation,
    top: false,
  });
  for (const f of faces(lantern))
    arch(out, f, f.length / 2, 42.85, 0.79, 2.92, lod, { aperture: dark });
  tower(out, 'trim', center, 2.45, 6, 45.96, 46.31, pale, { rotation, top: false });
  lathe(
    out,
    'metal',
    center,
    [
      [46.26, 2.46, 2.46],
      [46.87, 2.0, 2.0],
      [47.7, 1.44, 1.44],
      [48.48, 0.2, 0.2],
    ],
    lod === 3 ? 12 : 6,
    sealingMetal,
    { rotation },
  );
  cross(out, center[0], 50.0, center[1], 0.91, lod);
}

function hip(out, x0, x1, z0, z1, bottom, top, slot, tint) {
  const dx = x1 - x0,
    dz = z1 - z0;
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const a = [x0, bottom, z0],
    b = [x0, bottom, z1],
    c = [x1, bottom, z1],
    d = [x1, bottom, z0];
  const hx = Math.max(0, (dx - dz) * 0.5);
  const hz = Math.max(0, (dz - dx) * 0.5);
  const e = [x - hx, top, z - hz],
    f = [x + hx, top, z + hz];
  if (hz > 0.01) {
    quad4(out, slot, a, b, f, e, tint);
    quad4(out, slot, d, e, f, c, tint);
    tri(out, slot, b, c, f, tint);
    tri(out, slot, d, a, e, tint);
  } else if (hx > 0.01) {
    quad4(out, slot, b, c, f, e, tint);
    quad4(out, slot, a, e, f, d, tint);
    tri(out, slot, a, b, e, tint);
    tri(out, slot, c, d, f, tint);
  } else {
    tri(out, slot, a, b, e, tint);
    tri(out, slot, b, c, e, tint);
    tri(out, slot, c, d, e, tint);
    tri(out, slot, d, a, e, tint);
  }
}

function eastRange(out, lod) {
  const choir = [
    [-10.98, 0.3],
    [-10.98, -21.82],
    [11.04, -21.82],
    [11.04, 0.3],
  ];
  const gallery = [
    [-16.105, -6.544],
    outline[13],
    outline[14],
    [16.321, -7.122],
    [11.0, -7.13],
    [11.0, -19.8],
    [-11.0, -19.8],
    [-11.0, -6.55],
  ];
  solid(out, 'plaster', choir, 0.64, 18.06, white);
  solid(out, 'plaster', gallery, 0.64, 10.35, pale, false);
  hip(out, -11.25, 11.25, -22.2, 1.4, 18.03, 23.22, 'metal', metal);
  hip(out, -16.4, 16.6, -25.85, -19.72, 10.32, 12.62, 'clay', red);
  hip(out, -16.4, -10.35, -22.4, -6.21, 10.33, 12.35, 'clay', red);
  hip(out, 10.4, 16.56, -22.4, -6.83, 10.33, 12.35, 'clay', red);
  const rear = wallFace(outline[13], outline[14]);
  for (let i = 0; lod && i < 7; i++) {
    const u = 3.36 + i * 4.21;
    arch(out, rear, u, 2.22, 1.65, 2.42, lod, { aperture: dark, frameTint: pale, inlay: lod > 1 });
    arch(out, rear, u, 6.15, 1.25, 2.3, lod, { frameTint: pale, inlay: lod > 1 });
  }
  if (lod > 0) strip(out, rear, 9.94, 0.36, 0.28);
  const center = [13.72, -23.05];
  const chamber = tower(out, 'plaster', center, 2.54, 4, 9.32, 24.62, white, {
    rotation: Math.PI / 4,
    top: false,
  });
  for (const f of faces(chamber))
    arch(out, f, f.length * 0.5, 19.5, 1.33, 3.65, lod, { aperture: dark });
  lathe(
    out,
    'metal',
    center,
    [
      [24.56, 2.74, 2.74],
      [25.24, 2.27, 2.27],
      [28.15, 0.22, 0.22],
    ],
    4,
    metal,
    { rotation: Math.PI / 4 },
  );
  cross(out, center[0], 29.32, center[1], 0.57, lod);
}

function cloister(out, ring, side, lod) {
  const floor = side < 0 ? -0.49 : 0.63;
  const top = floor + 7.38;
  const wall = (a, b) => (side > 0 ? [a, b] : [-b, -a]);
  solid(out, 'base', ring, -3.1, floor + 0.33, plinth);
  solid(out, 'plaster', ring, floor + 0.33, top, white, false);
  const forward = side < 0 ? 18.63 : 18.12;
  const back = side < 0 ? -20.22 : -20.67;
  const courtFront = side < 0 ? 11.72 : 11.2;
  const courtBack = side < 0 ? -6.59 : -7.12;
  const outerX = side < 0 ? 50.01 : 49.43;
  const innerX = side < 0 ? 36.46 : 36.63;
  const volumes = [
    [10.7, outerX + 0.18, courtFront - 0.17, forward + 0.26, top + 2.78],
    [15.92, outerX + 0.16, back - 0.23, courtBack + 0.19, top + 4.16],
    [innerX - 0.18, outerX + 0.18, courtBack - 0.3, courtFront + 0.3, top + 4.07],
    [40.74, outerX + 0.28, forward - 2.38, forward + 2.75, top + 2.27],
  ];
  for (const [x0, x1, z0, z1, ridge] of volumes)
    hip(out, ...wall(x0, x1), z0, z1, top - 0.03, ridge, 'clay', red);
  if (!lod) return;
  for (const f of faces(ring)) {
    if (f.length < 6) continue;
    const n = Math.floor(f.length / 3.12);
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * f.length) / n;
      arch(out, f, u, floor + 1.23, 1.03, 1.69, lod, { frameTint: pale, inlay: lod > 1 });
      if (lod >= 2) {
        const y = floor + 4.56;
        panel(out, 'dark', f, u - 0.44, u + 0.44, y, y + 1.46, 0.032, glass);
        fbox(out, 'trim', f, u - 0.58, u + 0.58, y - 0.12, y, -0.08, 0.17, pale);
        if (lod === 3) {
          for (const j of [-1, 1]) {
            const center = u + 0.49 * j;
            panel(out, 'trim', f, center - 0.06, center + 0.06, y, y + 1.55, 0.051, pale);
          }
          panel(out, 'trim', f, u - 0.035, u + 0.035, y, y + 1.43, 0.053, lightStone);
        }
      }
    }
    if (lod > 1) strip(out, f, top - 0.37, 0.35, 0.18, pale);
  }
}

function build(out, lod) {
  westernElevation(out, lod);
  towerShaft(out, -7.82, lod);
  towerShaft(out, 8.59, lod);
  dome(out, lod);
  eastRange(out, lod);
  cloister(out, wings[0], -1, lod);
  cloister(out, wings[1], 1, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'pazaislis-monastery-model.mjs';
const camera = [68, 30, 109];
const lookAt = [0, 19.2, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Baroque church and attached cloister houses at Pažaislis Monastery, with a concave sandstone front, paired clock towers and a hexagonal dome.',
  camera,
  lookAt,
  sunDirection: [32, 71, 59],
  mediumFiContext: {
    scale: 1.5,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    outlines: [outline, ...wings],
    minimumCoverage: 0.9,
    basis: 'Native mapped church footprint and the two mapped attached cloister ranges.',
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'plaster_lime',
    'stone_limestone_weathered',
    'stone_ashlar',
    'metal_standing_seam',
    'tile_ceramic',
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-clock-towers-and-dome', position: camera, lookAt },
    { name: 'concave-sandstone-portal', position: [0, 12.8, 50.5], lookAt: [0, 17.2, 19] },
    { name: 'east-gallery-and-connectors', position: [-66, 37, -81], lookAt: [0, 17, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'pazaislis-monastery-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by public-domain Qualla and firsthand source images, OpenStreetMap ODbL building geometry and open Mapzen terrain.',
};
