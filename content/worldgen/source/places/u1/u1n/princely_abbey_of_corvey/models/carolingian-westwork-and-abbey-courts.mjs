import {
  courtyardWalls,
  facadeWindows,
  openArcade,
  roofedWing,
} from '../../../../../../../../packages/worldgen/scripts/courtyard-landmark-geometry.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  ribbon,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  masonry: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.96 },
  rough: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.89 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88 },
  redRoof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.96 },
};
const lime = rgb('d1c5ae'),
  limestone = rgb('a89a82'),
  red = rgb('957862'),
  stone = rgb('8e8175'),
  rubble = rgb('948577');
const roof = rgb('77736b'),
  grey = rgb('666667'),
  terracotta = rgb('a57459'),
  green = rgb('779184');
const glazing = rgb('586360'),
  timber = rgb('5f5748');
const windows = {
  glassSlot: 'dark',
  frameSlot: 'masonry',
  glass: glazing,
  frame: red,
  frameWidth: 0.1,
};
const local = ([x, , z]) => [x, z];
const center = (r) => r.reduce(([x, z], [a, b]) => [x + a / r.length, z + b / r.length], [0, 0]);
const roofAxis = facade([0, 0], site.churchAxis);

function topCross(out, [x, z], y, size, detail) {
  const f = facade([x, z], site.churchAxis);
  fbox(out, 'dark', f, -0.065, 0.065, y, y + size, -0.065, 0.065, grey, { bottom: true });
  if (detail)
    fbox(
      out,
      'dark',
      f,
      -size * 0.28,
      size * 0.28,
      y + size * 0.57,
      y + size * 0.72,
      -0.065,
      0.065,
      grey,
      { bottom: true },
    );
  if (detail === 3)
    lathe(
      out,
      'copper',
      [x, z],
      [
        [y + 0.19, 0.12, 0.12],
        [y + 0.29, 0.19, 0.19],
        [y + 0.43, 0.09, 0.09],
      ],
      6,
      green,
    );
}

function westwork(out, detail) {
  const y = 1.15;
  extrude(out, 'rough', site.westwork, -1.37, 17.35, stone);
  roofedWing(out, site.westRoof, 'rough', stone, 'slate', roof);
  const walls = courtyardWalls(site.westwork),
    west = walls.filter((f) => f.normal[0] < -0.5).sort((a, b) => b.length - a.length)[0];
  if (west && west.length > 2.1) {
    const u = west.length * 0.52;
    opening(out, west, u, y, 1.78, 3.98, {
      ...windows,
      glassSlot: 'wood',
      glass: timber,
      frame: limestone,
      frameWidth: detail ? 0.21 : 0,
      sill: !!detail,
      head: 'round',
      d: 0.115,
    });
    if (detail) {
      opening(out, west, u, 6.15, 1, 1.81, { ...windows, head: 'round', d: 0.12 });
      facadeWindows(out, west, 12.28, 1.03, 2.6, Math.max(2, Math.round(west.length / 3)), detail, {
        ...windows,
        head: 'round',
        frame: limestone,
        d: 0.14,
      });
      fbox(out, 'masonry', west, 0.08, west.length - 0.08, 16.19, 16.52, -0.02, 0.19, limestone);
      const next = wallFace(local(west.P(0, 0, 0.16)), local(west.P(west.length, 0, 0.16)));
      for (const j of [1, 2, 3])
        fbox(
          out,
          'masonry',
          next,
          (j * west.length) / 4 - 0.08,
          (j * west.length) / 4 + 0.08,
          11.52,
          16.81,
          -0.07,
          0.08,
          limestone,
        );
    }
  }
  for (const ring of site.towers) {
    const c = center(ring);
    const f = courtyardWalls(ring);
    extrude(out, 'rough', ring, -1.48, 20.62, stone);
    for (const wall of f) {
      if (wall.length < 1.5) continue;
      openArcade(out, wall, {
        count: 2,
        bottom: 20.55,
        top: 27.88,
        spring: 24.22,
        depth: 0.7,
        slot: 'rough',
        color: rubble,
        steps: detail > 1 ? 6 : 3,
        openRatio: 0.345,
        shallow: detail < 2,
      });
      if (detail) {
        facadeWindows(out, wall, 15.19, 0.73, 2.05, 2, detail, {
          ...windows,
          head: 'round',
          frame: limestone,
        });
        fbox(out, 'masonry', wall, 0.02, wall.length - 0.02, 20.15, 20.52, -0.06, 0.23, limestone);
        fbox(out, 'masonry', wall, 0.02, wall.length - 0.02, 26.85, 27.08, -0.1, 0.12, stone);
      }
    }
    const angle = Math.atan2(roofAxis.along[1], roofAxis.along[0]) + Math.PI / 4;
    const top = [
      [27.84, 3.62, 3.62],
      [30.13, 2.8, 2.8],
      [34.25, 1.67, 1.67],
      [44.57, 0.09, 0.09],
      [44.85, 0, 0],
    ];
    lathe(out, 'slate', c, detail ? top : [top[0], top[1], top[3], top[4]], 4, grey, {
      rotation: angle,
    });
    topCross(out, c, 44.57, 1.26, detail);
  }
}

function nave(out, detail) {
  for (const w of detail ? site.churchWings : site.churchWings.slice(0, 2)) {
    roofedWing(out, w, 'rough', rubble, 'slate', roof);
    if (!detail) continue;
    for (const wall of courtyardWalls(w.ring)) {
      if (wall.length < 4.4) continue;
      const n = Math.max(1, Math.round(wall.length / (detail === 1 ? 9.25 : 7.1)));
      facadeWindows(
        out,
        wall,
        Math.max(3.3, w.eave * 0.32),
        1.85,
        Math.min(7.33, w.eave * 0.37),
        n,
        detail,
        {
          ...windows,
          head: detail === 1 ? 'flat' : 'round',
          frame: limestone,
          mullions: detail > 1 ? 2 : 0,
        },
      );
      if (detail > 1)
        for (let i = 1; i < n; i++) {
          const u = (i * wall.length) / n;
          fbox(out, 'rough', wall, u - 0.29, u + 0.29, 0.17, w.eave * 0.76, -0.1, 0.58, stone);
        }
    }
  }
  const p = site.roofLantern;
  const drum = tower(out, 'copper', p, 2.65, detail ? 8 : 5, 24.4, 27.31, green, {
    rotation: 0.16,
  });
  lathe(
    out,
    'copper',
    p,
    [
      [27.25, 2.75, 2.75],
      [28.07, 2.64, 2.64],
      [29.35, 1.39, 1.39],
      [30.36, 0.67, 0.67],
      [31.79, 0.56, 0.56],
      [33.2, 0, 0],
    ].filter((_, i) => detail || i === 0 || i === 2 || i === 5),
    detail ? 8 : 5,
    green,
  );
  if (detail > 1)
    for (const wall of courtyardWalls(drum))
      opening(out, wall, wall.length * 0.53, 25.13, 0.69, 1.25, {
        ...windows,
        head: 'round',
        frame: green,
      });
  topCross(out, p, 33.15, 0.94, detail);
}

function wingFacade(out, w, detail, upper, nearCourt) {
  const c = upper ? lime : rubble;
  roofedWing(out, w, upper ? 'wall' : 'rough', c, 'slate', roof);
  if (!detail) return;
  for (const wall of courtyardWalls(w.ring)) {
    if (wall.length < (nearCourt ? 12.8 : 14)) continue;
    const n = Math.max(
      2,
      Math.round(wall.length / (detail === 1 ? (upper ? 4.9 : 6.12) : upper ? 4.0 : 5.05)),
    );
    const lower = upper ? 1.1 : 0.9;
    const style = { ...windows, frame: upper ? red : limestone, mullions: 0, transoms: 0 };
    facadeWindows(out, wall, lower, upper ? 1.42 : 1.31, 2.15, n, detail === 3 ? 2 : 1, style);
    facadeWindows(
      out,
      wall,
      upper ? 5.12 : 3.98,
      upper ? 1.48 : 1.42,
      upper ? 2.75 : 1.91,
      n,
      detail === 3 ? 2 : 1,
      style,
    );
    if (upper) {
      facadeWindows(out, wall, 9.18, 1.32, 1.53, n, detail === 3 ? 2 : 1, style);
      fbox(out, 'masonry', wall, 0.13, wall.length - 0.13, 11.69, 11.95, -0.07, 0.12, limestone);
    }
    if (detail > 1 && wall.length > 28 && upper) {
      const sourceNormal = wall.normal;
      const plane = wallFace(local(wall.P(0, 0, -2.1)), local(wall.P(wall.length, 0, -2.1)));
      if (Math.abs(sourceNormal[0]) > 0.7)
        for (let i = 0; i < Math.round(wall.length / 21); i++) {
          const x = ((i + 0.55) * wall.length) / Math.round(wall.length / 21);
          fbox(out, 'rough', plane, x - 0.48, x + 0.48, 15.08, 19.35, -0.7, 0, stone);
          fbox(out, 'rough', plane, x - 0.63, x + 0.63, 19.24, 19.55, -0.86, 0.13, stone);
        }
      const central = wall.length * 0.5;
      opening(out, wall, central, 0, 2.5, 4.04, {
        ...style,
        glassSlot: 'wood',
        glass: timber,
        frameWidth: 0.21,
        head: 'round',
        d: 0.14,
      });
      tri(
        out,
        'masonry',
        wall.P(central - 1.56, 4.06, 0.16),
        wall.P(central + 1.56, 4.06, 0.16),
        wall.P(central, 4.87, 0.16),
        limestone,
      );
    }
  }
}
function palace(out, detail) {
  for (const [i, { wing: w }] of site.palaceWings.entries())
    wingFacade(out, w, detail, i < 4, i < 4);
  if (detail) for (const w of site.fill) roofedWing(out, w, 'rough', rubble, 'redRoof', terracotta);
  for (const [i, r] of site.cornerTowers.entries()) {
    const c = center(r),
      lower = i === 2 ? 1.1 : 1.54,
      cap = i === 2 ? 15.8 : 17.2;
    extrude(out, 'wall', r, -1.3, cap, lime);
    lathe(
      out,
      'slate',
      c,
      [
        [cap, 3.45, 3.45],
        [cap + 0.65, 3.55, 3.55],
        [cap + 2.16, 2.32, 2.32],
        [cap + 3.51, 1.28, 1.28],
        [cap + 4.18, 0.98, 0.98],
      ],
      detail > 1 ? 8 : 4,
      grey,
      { rotation: 0.58 },
    );
    lathe(
      out,
      'copper',
      c,
      [
        [cap + 4.12, 0.96, 0.96],
        [cap + 5.15, 0.99, 0.99],
        [cap + 5.93, 0.48, 0.48],
        [cap + 6.66, 0.18, 0.18],
        [cap + 7.48, 0, 0],
      ],
      detail > 1 ? 8 : 4,
      green,
      { rotation: 0.58 },
    );
    if (detail) {
      ribbon(out, 'masonry', r, cap - 0.54, cap - 0.31, limestone, {
        offset: 0.125,
        minLength: 1,
        inset: 0,
      });
      for (const f of courtyardWalls(r).filter((f) => f.length > 2.7))
        for (let j = 0; j < 3; j++) {
          opening(out, f, f.length * 0.53, lower + j * 3.5, 1.13, 1.62, {
            ...windows,
            frameWidth: detail > 1 ? 0.12 : 0,
            sill: detail > 1,
          });
        }
    }
  }
}

function build(mesh, detail) {
  const out = withFootprintCaps(mesh);
  palace(out, detail);
  nave(out, detail);
  westwork(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
