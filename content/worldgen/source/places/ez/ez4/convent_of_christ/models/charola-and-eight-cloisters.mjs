import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  courtyardWalls,
  facadeWindows,
  openArcade,
  roofedWing,
} from '../../../../../../../../packages/worldgen/scripts/courtyard-landmark-geometry.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93 },
  foundation: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
};
const limestone = rgb('b9a987');
const trim = rgb('c5b796');
const plaster = rgb('d1c3a4');
const sandstone = rgb('a69b80');
const tile = rgb('a7664c');
const floor = rgb('a9a18d');
const dark = rgb('4b524f');
const windows = {
  glassSlot: 'glass',
  glass: dark,
  frame: trim,
  frameSlot: 'stone',
  frameWidth: 0.16,
};
const local = ([x, , z]) => [x, z];
const center = (ring) =>
  ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);

function charola(out, detail) {
  const walls = courtyardWalls(site.charola);
  if (detail) extrude(out, 'foundation', site.charola, -2.85, 2.55, sandstone, { top: false });
  extrude(out, 'stone', site.charola, detail ? 2.55 : -2.85, 21.35, limestone, { top: false });
  const inward = (p, a) => {
    const c = center(site.charola);
    return p.map((v, i) => v * a + c[i] * (1 - a));
  };
  const inner = site.charola.map((p) => inward(p, 0.67));
  extrude(out, 'stone', site.charola, 21.3, 22.15, trim, {
    top: true,
    holes: [inner],
    topSlot: 'foundation',
    topColor: sandstone,
  });
  const upper = site.charola.map((p) => inward(p, 0.58));
  const cap = center(site.charola);
  for (const wall of walls) {
    const a = wall.origin,
      b = local(wall.P(wall.length, 0));
    const c = inward(b, 0.58),
      d = inward(a, 0.58);
    quad4(
      out,
      'roof',
      [a[0], 22.08, a[1]],
      [b[0], 22.08, b[1]],
      [c[0], 23.2, c[1]],
      [d[0], 23.2, d[1]],
      tile,
    );
    tri(out, 'roof', [d[0], 23.2, d[1]], [c[0], 23.2, c[1]], [cap[0], 24.18, cap[1]], tile);
    if (wall.origin[0] < 12) continue;
    const n = detail > 0 ? Math.max(2, Math.round(wall.length / 1.67)) : 1;
    for (let i = 0; i < n; i++) {
      const u = (wall.length * (i + 0.5)) / n,
        w = (wall.length * 0.28) / n;
      fbox(out, 'stone', wall, u - w, u + w, 22.06, 23.62, -0.84, 0.15, trim);
    }
    if (detail) fbox(out, 'foundation', wall, -0.32, 0.59, -0.62, 6.15, -0.16, 0.93, sandstone);
    fbox(out, 'stone', wall, -0.24, 0.52, 6.13, 20.48, -0.12, 0.55, limestone);
    if (detail > 1 || (detail === 1 && wall.normal[1] > 0.2)) {
      opening(out, wall, wall.length * 0.5, 11.3, 1.04, 5.03, {
        ...windows,
        head: 'round',
        frameWidth: detail > 1 ? 0.15 : 0,
        sill: detail > 1,
      });
    }
  }
  const bell = wallFace([13.02, 10.28], [16.35, 13.03]);
  fbox(out, 'stone', bell, 0.05, 3.12, -0.55, 26.15, -2.93, 0.17, limestone);
  opening(out, bell, 1.55, 22.78, 1.05, 2.62, {
    ...windows,
    head: 'round',
    frameWidth: detail > 0 ? 0.14 : 0,
    d: 0.19,
  });
  const p = local(bell.P(1.6, 0, -1.4));
  lathe(
    out,
    'roof',
    p,
    [
      [26.08, 2.1, 2.05],
      [28.1, 0, 0],
    ],
    4,
    tile,
    { rotation: 0.72 },
  );
}

function manuelineNave(out, detail) {
  roofedWing(out, site.churchWing, 'stone', limestone, 'roof', tile);
  const long = wallFace([10.34, 7.19], [-8, 6.9]);
  const south = wallFace([-8, 6.9], [10.34, 7.19]);
  for (const [f, n] of [
    [south, 4],
    [wallFace([12.48, -5.02], [-7.74, -5.49]), 4],
  ]) {
    for (let i = 0; i <= n; i++) {
      const u = (f.length * i) / n;
      if (detail) fbox(out, 'stone', f, u - 0.42, u + 0.42, 6.5, 20.96, -0.2, 0.73, trim);
      tower(out, 'stone', local(f.P(u, 0, 0.44)), 0.55, 4, 20.85, 22.65, trim, { rotation: 0.78 });
      if (detail > 1)
        lathe(
          out,
          'stone',
          local(f.P(u, 0, 0.44)),
          [
            [22.65, 0.44, 0.44],
            [24.05, 0.11, 0.11],
            [24.33, 0, 0],
          ],
          5,
          trim,
        );
    }
    if (detail)
      facadeWindows(out, f, 11.2, 2.55, 7.6, n, detail, { ...windows, head: 'round', mullions: 2 });
  }
  const west = wallFace([-7.74, -5.49], [-8, 6.9]);
  const u = west.length * 0.51;
  opening(out, west, u, 9.1, 2.65, 6.15, {
    ...windows,
    head: 'tudor',
    mullions: detail > 1 ? 2 : 0,
    transoms: detail > 1 ? 1 : 0,
    d: 0.1,
    frameWidth: 0.32,
  });
  fbox(out, 'stone', west, u - 1.87, u + 1.87, 8.77, 9.19, -0.1, 0.45, trim);
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    const rope = (i) =>
      west.P(
        u + side * (1.54 + 0.22 * Math.cos(i * 0.72)),
        8.82 + i * 0.31,
        0.34 + 0.19 * Math.sin(i * 0.72),
      );
    const n = detail === 2 ? 22 : 25;
    for (let i = 0; i < n; i++) beam(out, 'stone', rope(i), rope(i + 1), 0.14, 0.18, trim);
    for (let i = 0; i < 4; i++) {
      const x = u + side * (1.87 + 0.1 * (i % 2)),
        y = 9.49 + i * 1.43;
      const p = local(west.P(x, 0, 0.49));
      lathe(
        out,
        'stone',
        p,
        [
          [y - 0.23, 0.12, 0.11],
          [y, 0.27, 0.21],
          [y + 0.28, 0.06, 0.07],
        ],
        6,
        trim,
      );
    }
  }
  lathe(
    out,
    'stone',
    local(west.P(u, 0, 0.32)),
    [
      [15.65, 0.22, 0.2],
      [16.12, 0.57, 0.31],
      [16.72, 0.52, 0.25],
      [17.14, 0.16, 0.14],
    ],
    8,
    trim,
  );
  fbox(out, 'stone', west, u - 0.13, u + 0.13, 16.9, 17.88, 0.27, 0.47, trim);
  fbox(out, 'stone', west, u - 0.43, u + 0.43, 17.43, 17.64, 0.25, 0.47, trim);
  opening(out, long, long.length * 0.63, 15.7, 0.61, 2.35, { ...windows, head: 'round' });
}

function cloisters(out, detail) {
  for (const wing of site.wings) roofedWing(out, wing, 'lime', plaster, 'roof', tile);
  for (const [i, c] of site.courts.entries()) {
    const isRoyal = c.id === 462184098;
    const pad = isRoyal ? -0.27 : c.id === 462184116 ? -0.85 : -1.24;
    extrude(out, 'foundation', c.ring, pad - 0.36, pad, floor);
    const walls = courtyardWalls(c.ring).map((f) => wallFace(local(f.P(f.length, 0)), f.origin));
    for (const f of walls) {
      if (f.length < 3.4) continue;
      const n = Math.max(1, Math.round(f.length / (isRoyal ? 4.6 : 4.05)));
      if (isRoyal) {
        openArcade(out, f, {
          count: n,
          bottom: pad,
          top: 4.26,
          spring: 2.17,
          depth: 1.3,
          slot: 'stone',
          color: trim,
          steps: detail > 1 ? 6 : 3,
          openRatio: 0.355,
          shallow: detail < 2,
        });
        if (detail)
          openArcade(out, f, {
            count: n,
            bottom: 4.31,
            top: 8.58,
            spring: 6.62,
            depth: 1.08,
            slot: 'stone',
            color: limestone,
            steps: detail > 1 ? 6 : 3,
            openRatio: 0.365,
            shallow: detail < 2,
          });
        if (detail) fbox(out, 'stone', f, 0, f.length, 4.18, 4.48, -1.4, 0.28, trim);
        if (detail) fbox(out, 'stone', f, 0, f.length, 8.53, 8.98, -1.34, 0.25, trim);
        if (detail === 3)
          for (let i = 1; i < n; i++) {
            const u = (f.length * i) / n;
            fbox(out, 'stone', f, u - 0.17, u + 0.17, 0.45, 8.52, -0.15, 0.29, trim);
          }
      } else if (detail > 0) {
        const arched = {
          ...windows,
          head: i < 3 && detail > 1 ? 'round' : 'flat',
          mullions: 0,
          transoms: 0,
        };
        facadeWindows(
          out,
          f,
          pad + 0.66,
          Math.min(1.68, (f.length / n) * 0.45),
          2.15,
          n,
          detail > 1 ? 2 : 1,
          arched,
        );
        if (detail > 1) facadeWindows(out, f, 4.1, 1.05, 2.06, n, 1, windows);
      }
    }
  }
  for (const { ring, holes } of site.terrace) {
    extrude(out, 'foundation', ring, 7.99, 8.69, floor, { holes, topSlot: 'foundation' });
  }
  const south = wallFace([-25.19, 53.22], [6.6, 53.71]);
  fbox(out, 'lime', south, 0, south.length, 4.39, 8.14, -1.2, -0.035, plaster);
  for (const [a, b] of [
    [0, 10.35],
    [23.4, south.length],
  ]) {
    fbox(out, 'lime', south, a, b, -2.2, 4.4, -1.2, -0.035, plaster);
  }
  fbox(out, 'stone', south, 10.35, 23.4, -1.31, 4.4, -2.25, -2.13, sandstone);
  openArcade(out, south, {
    count: 2,
    start: 10.35,
    end: 23.4,
    bottom: -1.3,
    top: 4.4,
    spring: 1.1,
    depth: 2.1,
    slot: 'stone',
    color: limestone,
    steps: detail > 1 ? 8 : 3,
    openRatio: 0.41,
    shallow: detail < 2,
  });
  fbox(out, 'stone', south, 0, south.length, 8.45, 9.12, -0.83, 0.24, trim);
  if (detail > 0) facadeWindows(out, south, 4.92, 1.63, 2.45, 7, detail, windows);
  const southWing = site.wings.find((wing) => wing.eave === 11.2);
  const facadeStyle = { ...windows, head: 'flat', mullions: 0, transoms: 0, d: 0.19 };
  for (const wall of courtyardWalls(southWing.ring)) {
    if (wall.origin[1] < 47 || wall.normal[1] < 0.95 || wall.length < 5) continue;
    const face = wallFace(local(wall.P(0, 0, 0.56)), local(wall.P(wall.length, 0, 0.56)));
    const count = Math.round(wall.length / (detail === 1 ? 6.5 : 4.35));
    openArcade(out, face, {
      count,
      bottom: -0.48,
      top: 10.25,
      spring: 7.06,
      depth: 0.79,
      slot: 'stone',
      color: limestone,
      steps: detail > 1 ? 5 : 3,
      openRatio: 0.4,
      shallow: detail < 2,
    });
    fbox(out, 'foundation', face, 0, face.length, -2.74, -0.49, -0.97, 0.11, sandstone);
    if (detail > 1) {
      facadeWindows(out, wall, 0.18, 0.92, 1.75, count, 1, facadeStyle);
      facadeWindows(out, wall, 3.84, 1.07, 1.92, count, 1, facadeStyle);
    }
  }
}

function chapterHouse(out, detail) {
  if (!detail) {
    extrude(
      out,
      'foundation',
      [
        [4.35, 39],
        [21.5, 39],
        [20.5, 74.7],
        [4.4, 74],
      ],
      -3.6,
      8.15,
      sandstone,
      { holes: [site.ruinCourt] },
    );
    return;
  }
  extrude(out, 'foundation', site.ruin, -3.6, 6.9, sandstone, { holes: [site.ruinCourt] });
  extrude(out, 'stone', site.ruin, 6.85, 8.15, limestone, { holes: [site.ruinCourt] });
  for (const wall of courtyardWalls(site.ruin)) {
    if (wall.length > 2.5)
      fbox(out, 'foundation', wall, 0.11, 0.8, -2.8, 7.54, -0.11, 0.69, sandstone);
    if (detail && wall.length > 8)
      opening(out, wall, wall.length * 0.52, 1.35, 1.17, 3.98, {
        ...windows,
        head: 'pointed',
        frameWidth: detail > 1 ? 0.13 : 0,
      });
  }
}

function skylineWings(out) {
  const core = [
    [-118, -43],
    [83, -45],
    [99, -14],
    [74, 17],
    [39, 13],
    [6, 14],
    [0, 51],
    [-91, 49],
    [-91, -7],
    [-118, -10],
  ];
  const courts = site.courts
    .filter((c) =>
      [462184096, 462184095, 462184100, 462184099, 462184098, 967592944].includes(c.id),
    )
    .map((c) => c.ring);
  extrude(out, 'lime', core, -4.1, 10.1, plaster, {
    holes: courts,
    topSlot: 'roof',
    topColor: tile,
  });
  gableRoof(out, 'roof', [-86, 47], [-28, 48], 8, 10.12, 14.8, tile, {
    overhang: 0.2,
    endSlot: 'lime',
    endColor: plaster,
  });
  gableRoof(out, 'roof', [-89, -43], [-14, -43], 6, 10.12, 15.1, tile, {
    overhang: 0.2,
    endSlot: 'lime',
    endColor: plaster,
  });
  gableRoof(out, 'roof', [-27, -34], [-27, -11], 6, 10.12, 15.8, tile, {
    overhang: 0.16,
    endSlot: 'lime',
    endColor: plaster,
  });
  gableRoof(out, 'roof', [31, -39], [81, -39], 8, 10.12, 13.84, tile, {
    overhang: 0.16,
    endSlot: 'lime',
    endColor: plaster,
  });
}

function build(target, detail) {
  const out = withFootprintCaps(target);
  if (detail) cloisters(out, detail);
  else skylineWings(out);
  charola(out, detail);
  manuelineNave(out, detail);
  chapterHouse(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
