import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const front = 28.64;
const colors = {
  basalt: rgb('5d5c55'),
  basaltDeep: rgb('4f514d'),
  basaltBelt: rgb('74736a'),
  border: rgb('8e8473'),
  sandstone: rgb('aaa08b'),
  sandstoneInset: rgb('817c70'),
  roof: rgb('677b71'),
  roofCap: rgb('788879'),
  glass: rgb('46534e'),
  door: rgb('40342b'),
  dark: rgb('292e2c'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  dress: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.11 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
};
function box(out, slot, lo, hi, color, bottom = false) {
  abox(out, slot, lo, hi, color, { bottom });
}
function panel(out, slot, F, u0, u1, y0, y1, offset, color) {
  quad4(
    out,
    slot,
    F.P(u0, y0, offset),
    F.P(u1, y0, offset),
    F.P(u1, y1, offset),
    F.P(u0, y1, offset),
    color,
  );
}

function roofRectangle(x0, x1, z0, z1, y) {
  return [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
  ];
}
function hipRoof(out, bounds, eave, peak, ridgeRatio = 0.54, level = 0) {
  const [x0, x1, z0, z1] = bounds;
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2,
    alongZ = z1 - z0 > x1 - x0;
  const dx = alongZ ? 0.12 : ((x1 - x0) * ridgeRatio) / 2;
  const dz = alongZ ? ((z1 - z0) * ridgeRatio) / 2 : 0.12;
  const e = roofRectangle(x0 - 0.31, x1 + 0.31, z0 - 0.31, z1 + 0.31, eave);
  const p = roofRectangle(x - dx, x + dx, z - dz, z + dz, peak);
  loft(out, 'roof', [e, p], colors.roof, { cap: false });
  quad4(out, 'roof', p[0], p[1], p[2], p[3], colors.roofCap);
  if (level === 0) return;
  for (let i = 0; i < e.length; i++) {
    const j = (i + 1) % e.length;
    const a = e[i],
      b = e[j];
    beam(out, 'dress', a, b, 0.17, 0.16, colors.basaltBelt);
    if (level < 2) continue;
    const steps = Math.ceil(Math.hypot(a[0] - b[0], a[2] - b[2]) / (level === 3 ? 1.1 : 2.3));
    const mix = (u, v, t) => u.map((c, k) => c + (v[k] - c) * t + (k === 1 ? 0.032 : 0));
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      beam(out, 'roof', mix(a, b, t), mix(p[i], p[j], t), 0.024, 0.025, colors.roofCap);
    }
  }
}
function row(
  out,
  f,
  centers,
  sill,
  w,
  h,
  level,
  { arched = false, mullions = 1, shutters = false } = {},
) {
  for (const u of centers) {
    if (level === 0 || (level === 1 && !arched)) {
      const fill = shutters ? colors.sandstoneInset : colors.glass;
      panel(out, 'window', f, u - w / 2, u + w / 2, sill, sill + h, 0.028, fill);
      if (level === 1) {
        panel(
          out,
          'dress',
          f,
          u - w / 2 - 0.08,
          u + w / 2 + 0.08,
          sill + h,
          sill + h + 0.13,
          0.035,
          colors.border,
        );
      }
      continue;
    }
    opening(out, f, u, sill, w, h, {
      head: arched ? 'round' : 'flat',
      glassSlot: shutters ? 'timber' : 'window',
      frameSlot: 'dress',
      frame: colors.border,
      glass: shutters ? colors.sandstoneInset : colors.glass,
      frameWidth: w < 1.1 ? 0.087 : 0.117,
      frameDepth: 0.12,
      sill: true,
      mullions: level > 1 ? mullions : 0,
      transoms: level > 1 ? 1 : 0,
      mullionColor: colors.sandstoneInset,
    });
  }
}
function cornice(out, f, u0, u1, y, level) {
  fbox(out, 'dress', f, u0, u1, y - 0.16, y + 0.13, -0.05, 0.26, colors.basaltBelt);
  if (level < 2) return;
  const count = Math.max(3, Math.round((u1 - u0) / (level === 3 ? 0.43 : 0.72)));
  for (let j = 0; j < count; j++) {
    const u = u0 + ((u1 - u0) * (j + 0.5)) / count;
    fbox(out, 'dress', f, u - 0.079, u + 0.079, y - 0.38, y - 0.11, 0.012, 0.15, colors.border);
  }
}
function oculus(out, f, u, h, r, level) {
  const n = [8, 12, 16, 22][level],
    ctr = f.P(u, h, 0.047);
  const circle = (radius, t, d) => f.P(u + radius * Math.cos(t), h + radius * Math.sin(t), d);
  for (let j = 0; j < n; j++) {
    const a = (2 * Math.PI * j) / n,
      b = (2 * Math.PI * (j + 1)) / n;
    const q = circle(r, a, 0.061),
      p = circle(r, b, 0.061);
    tri(out, 'window', ctr, q, p, colors.dark);
    if (level > 0)
      quad4(
        out,
        'dress',
        q,
        circle(r + 0.083, a, 0.078),
        circle(r + 0.083, b, 0.078),
        p,
        colors.border,
      );
  }
}
function dormer(out, F, u, base, half, rise, depth, level, windows) {
  const p = (a, y, d) => F.P(u + a, y, d);
  const band = base + 0.93;
  fbox(out, 'stone', F, u - half, u + half, base, band, -depth, 0.039, colors.basalt);
  tri(
    out,
    'stone',
    p(-half, band, 0.041),
    p(half, band, 0.041),
    p(0, band + rise, 0.041),
    colors.basalt,
  );
  for (const side of [-1, 1]) {
    const a = p(half * side, band, 0.12),
      b = p(0, band + rise, 0.13);
    const c = p(half * side, band, -depth),
      d = p(0, band + rise, -depth);
    const top = side < 0 ? [a, b, d, c] : [c, d, b, a];
    quad4(out, 'roof', ...top, colors.roof);
    beam(out, 'dress', a, b, 0.145, 0.185, colors.basaltBelt);
  }
  oculus(out, F, u, band + rise * 0.53, 0.235, level);
  const every = (half * 1.61) / windows;
  const positions = Array.from({ length: windows }, (_, n) => u - half * 0.805 + (n + 0.5) * every);
  row(out, F, positions, base + 0.14, Math.min(0.62, every - 0.1), 0.52, level, { mullions: 0 });
}
function hall(out, level) {
  const x0 = 7.62,
    x1 = 21.17,
    z0 = -18.68,
    z1 = front;
  const eave = plan.dimensions.hawaiianHallEaveM,
    peak = plan.dimensions.hawaiianHallRoofPeakM;
  box(out, 'stone', [x0, -0.63, z0], [x1, eave, z1], colors.basalt);
  const face = facade([(x0 + x1) / 2, z1], [1, 0]);
  const side = facade([x1, 0], [0, -1]);
  const rear = facade([(x0 + x1) / 2, z0], [-1, 0]);
  hipRoof(out, [x0, x1, z0, z1], eave, peak, 0.63, level);
  for (const [f, a, b] of [
    [face, -6.78, 6.78],
    [rear, -6.78, 6.78],
    [side, -z1, -z0],
  ]) {
    cornice(out, f, a, b, eave - 0.04, level);
    if (level > 0) {
      for (const y of [3.12, 6.42]) {
        fbox(out, 'dress', f, a, b, y - 0.1, y + 0.12, -0.04, 0.1, colors.basaltBelt);
      }
    }
  }
  for (const [sill, w, h] of [
    [1.03, 2.43, 1.63],
    [4.02, 2.53, 1.82],
    [7.01, 3.34, 3.04],
  ]) {
    row(out, face, [-3.41, 3.41], sill, w, h, level, { mullions: 2 });
    if (level > 0) row(out, rear, [-3.42, 3.42], sill, w * 0.76, h, level);
    const east =
      level === 0 ? [-23, -12, -1, 10] : [-23.64, -17.23, -10.82, -4.41, 2.0, 8.41, 14.82];
    row(out, side, east, sill, w * 0.7, h, level, { mullions: 1, shutters: sill < 2.0 });
  }
  for (const u of [-3.55, 3.55]) dormer(out, face, u, eave - 0.04, 1.79, 2.15, 2.5, level, 4);
  for (const u of [-15.97, 8.79]) dormer(out, side, u, eave - 0.04, 2.49, 2.37, 3.7, level, 4);
}
function hallWings(out, level) {
  const parts = [
    { b: [-11.34, -5.24, 10.33, front], eave: 5.69, peak: 8.24, color: colors.basaltDeep },
    { b: [2.05, 7.65, 12.6, front], eave: 8.76, peak: 11.72, color: colors.basalt },
    {
      b: [-9.48, 4.25, -18.84, 9.7],
      eave: plan.dimensions.pacificHallEaveM,
      peak: plan.dimensions.pacificHallRoofPeakM,
      color: colors.basaltDeep,
    },
    { b: [4.21, 7.65, -14.86, 15.1], eave: 8.55, peak: 10.85, color: colors.basalt },
    { b: [-5.95, 2.09, 1.09, 13.1], eave: 8.27, peak: 10.4, color: colors.basalt },
  ];
  for (const part of parts) {
    const [x0, x1, z0, z1] = part.b;
    box(out, 'stone', [x0, -0.66, z0], [x1, part.eave, z1], part.color);
    hipRoof(out, part.b, part.eave, part.peak, 0.54, level);
  }
  const left = facade([-11.34, 0], [0, 1]);
  row(out, left, [13.6, 18.9, 24.95], 1.9, 1.04, 2.27, level, { arched: true, shutters: true });
  const low = facade([-8.35, front], [1, 0]);
  dormer(out, low, 0, 5.75, 1.69, 1.58, 2.5, level, 2);
  const center = facade([4.77, front], [1, 0]);
  row(out, center, [-1.38, 1.3], 1.1, 1.22, 2.5, level, { mullions: 1 });
  row(out, center, [-1.38, 1.3], 5.08, 1.25, 2.85, level, { arched: true });
  if (level === 0) return;
  const pacific = facade([-9.48, -5], [0, 1]);
  for (const [sill, h] of [
    [1.33, 1.45],
    [4.16, 2.31],
    [7.48, 1.68],
  ]) {
    row(out, pacific, [-10.4, -4.96, 0.48, 5.92, 11.36], sill, 1.55, h, level, {
      arched: sill > 6,
      mullions: 1,
    });
  }
}

function porch(out, center, level) {
  const f = facade([center, front + 1.28], [1, 0]);
  const centers = [-1.52, 1.52],
    radius = 1.32,
    spring = 2.07,
    soffit = 4.07;
  for (const u of [-3.17, 0, 3.17]) {
    fbox(out, 'stone', f, u - 0.26, u + 0.26, 0.42, 2.12, -1.18, 0.13, colors.border);
    for (const y of [0.44, 1.96])
      fbox(out, 'dress', f, u - 0.32, u + 0.32, y, y + 0.15, -1.23, 0.18, colors.sandstone);
  }
  for (const u of centers) {
    const n = [5, 9, 14, 18][level];
    const arch = (a, rad, d) => f.P(u - rad * Math.cos(a), spring + rad * Math.sin(a), d);
    for (let j = 0; j < n; j++) {
      const a = (Math.PI * j) / n,
        b = (Math.PI * (j + 1)) / n;
      const inner0 = arch(a, radius, 0.16),
        inner1 = arch(b, radius, 0.16);
      const out0 = arch(a, radius + 0.22, 0.16),
        out1 = arch(b, radius + 0.22, 0.16);
      quad4(
        out,
        'dress',
        inner0,
        inner1,
        out1,
        out0,
        j % 3 === 0 ? colors.sandstone : colors.border,
      );
      quad4(
        out,
        'dress',
        inner1,
        inner0,
        arch(a, radius, -1.1),
        arch(b, radius, -1.1),
        colors.sandstoneInset,
      );
      quad4(
        out,
        'stone',
        out0,
        out1,
        [out1[0], soffit, out1[2]],
        [out0[0], soffit, out0[2]],
        colors.basalt,
      );
    }
    panel(out, 'window', f, u - radius, u + radius, 0.43, 3.44, -1.43, colors.dark);
    if (level > 0) {
      fbox(out, 'timber', f, u - 0.9, u + 0.9, 0.43, 2.56, -1.4, -1.36, colors.door);
    }
  }
  fbox(out, 'dress', f, -3.48, 3.48, 4.03, 4.31, -1.52, 0.38, colors.basaltBelt, { bottom: true });
  fbox(out, 'stone', f, -3.35, 3.35, 4.28, 4.51, -1.41, 0.3, colors.basalt);
  for (let j = 0; j < 3; j++) {
    fbox(
      out,
      'dress',
      f,
      -3.72 + j * 0.14,
      3.72 - j * 0.14,
      -0.28,
      0.17 + j * 0.13,
      -1.62,
      0.85 - j * 0.26,
      colors.sandstoneInset,
    );
  }
  if (level > 1) {
    for (let u = -2.92; u < 3.02; u += 0.39) {
      fbox(out, 'dress', f, u - 0.06, u + 0.06, 4.31, 4.52, 0.29, 0.35, colors.border);
    }
  }
}
function tower(out, level) {
  const x0 = -5.23,
    x1 = 2.05,
    center = (x0 + x1) / 2,
    z0 = 15.4,
    z1 = front;
  const eave = plan.dimensions.entranceTowerEaveM,
    peak = plan.dimensions.entranceTowerPeakM;
  box(out, 'stone', [x0, -0.6, z0], [x1, eave, z1], colors.basaltDeep);
  hipRoof(out, [x0, x1, z0, z1], eave, peak, 0.04, level);
  const face = facade([center, z1], [1, 0]);
  for (const [y, h] of [
    [5.25, 2.14],
    [7.72, 2.92],
  ])
    row(out, face, [-2.09, -0.7, 0.7, 2.09], y, 0.87, h, level, { arched: y > 7 });
  cornice(out, face, -3.64, 3.64, eave, level);
  const a = face.P(-2.87, eave + 0.05, 0.18),
    b = face.P(0, eave + 2.8, 0.18),
    c = face.P(2.87, eave + 0.05, 0.18);
  tri(out, 'stone', a, c, b, colors.basalt);
  beam(out, 'dress', a, b, 0.13, 0.18, colors.border);
  beam(out, 'dress', b, c, 0.13, 0.18, colors.border);
  const geom = (u, y, d) => {
    const [x, h, z] = face.P(u, y, d);
    return [x, h, z];
  };
  quad4(
    out,
    'roof',
    geom(-2.87, eave + 0.05, 0.17),
    geom(0, eave + 2.8, 0.17),
    geom(0, eave + 2.8, -2.85),
    geom(-2.87, eave + 0.05, -2.85),
    colors.roof,
  );
  quad4(
    out,
    'roof',
    geom(0, eave + 2.8, 0.17),
    geom(2.87, eave + 0.05, 0.17),
    geom(2.87, eave + 0.05, -2.85),
    geom(0, eave + 2.8, -2.85),
    colors.roof,
  );
  if (level > 1) {
    panel(out, 'dress', face, -1.77, 1.77, eave + 0.42, eave + 0.58, 0.199, colors.basaltBelt);
    oculus(out, face, 0, eave + 1.17, 0.19, level);
  }
  porch(out, center, level);
}
function build(out, level) {
  hallWings(out, level);
  hall(out, level);
  tower(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'bishop-museum-main-building-model.mjs';
const camera = [54, 26, 72],
  lookAt = [4.8, 7.8, 6.0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Bishop Museum Main Building',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Basalt museum with deep copper roofs, Hawaiian Hall’s stone dormers and a double-arched entrance tower.',
  camera,
  lookAt,
  sunDirection: [-32, 57, 73],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Native Hawaiian Hall Complex footprint and original northeast entrance.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_sandstone', 'metal_standing_seam', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'northeast-lawn-front-and-dormers', position: [3, 7.1, 64], lookAt: [4, 7.12, 24] },
    {
      name: 'double-arched-entrance-and-copper-tower',
      position: [-19, 4.3, 48],
      lookAt: [-0.8, 7.1, 24],
    },
    { name: 'pacific-hall-and-hawaiian-hall-flank', position: [50, 14, -42], lookAt: [2, 7, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bishop-museum-main-building-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.052, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and NOAA/USGS elevation under source attribution terms.',
};
