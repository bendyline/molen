import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  courtyardWalls,
  facadeWindows,
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
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.96 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.93 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
  oak: { slot: 'door', graph: 'wood_plain', roughness: 0.9 },
  paved: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  garden: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    roughness: 0.97,
    name: 'museum-garden-planting',
  },
};
const brick = rgb('916752'),
  stone = rgb('c3b59b'),
  limestone = rgb('a89a81'),
  darkStone = rgb('8c8a81');
const slate = rgb('62636a'),
  oak = rgb('5c5247'),
  slatePane = rgb('67747a'),
  courtyardPane = rgb('4f5b59');
const greenery = rgb('546849'),
  shrubs = rgb('657d49'),
  soil = rgb('7e7e59'),
  cobble = rgb('a6a28e');
const local = ([x, , z]) => [x, z];
const center = (ring) =>
  ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);
const innerWalls = (ring) =>
  courtyardWalls(ring).map((f) => wallFace(local(f.P(f.length, 0)), f.origin));
const window = {
  glassSlot: 'dark',
  frameSlot: 'stone',
  glass: courtyardPane,
  frame: stone,
  frameWidth: 0.1,
};
const push = (f, u, y, d) => local(f.P(u, y, d));

function dormer(out, f, u, y, width, detail, stepped) {
  const u0 = u - width / 2,
    u1 = u + width / 2,
    d = -0.86;
  if (detail < 2) {
    tri(
      out,
      stepped ? 'brick' : 'stone',
      f.P(u0, y, d),
      f.P(u1, y, d),
      f.P(u, y + 1.7, d),
      stepped ? brick : stone,
    );
    return;
  }
  fbox(
    out,
    stepped ? 'brick' : 'stone',
    f,
    u0,
    u1,
    y - 1.15,
    y + 1.22,
    d - 1.5,
    d,
    stepped ? brick : stone,
  );
  const color = stepped ? brick : stone;
  for (let i = 0; i < (stepped ? 4 : 2); i++) {
    const w = width * (0.42 - i * (stepped ? 0.1 : 0.15));
    const a = y + 1.21 + i * 0.27;
    fbox(out, stepped ? 'brick' : 'stone', f, u - w, u + w, a, a + 0.29, d - 1.81, d + 0.02, color);
    if (detail > 1)
      fbox(
        out,
        'stone',
        f,
        u - w - 0.06,
        u + w + 0.06,
        a + 0.25,
        a + 0.32,
        d - 1.83,
        d + 0.095,
        stone,
      );
  }
  const front = wallFace(push(f, 0, 0, d), push(f, f.length, 0, d));
  opening(out, front, u, y - 0.44, width * 0.53, 1.46, {
    ...window,
    head: stepped ? 'flat' : 'round',
    mullions: detail > 1 ? 1 : 0,
    frameWidth: 0.11,
    d: 0.035,
  });
  gableRoof(
    out,
    'slate',
    push(f, u, 0, d - 0.15),
    push(f, u, 0, d - 2.3),
    width,
    y + 0.9,
    y + 1.64,
    slate,
    { overhang: 0.06, endSlot: stepped ? 'brick' : 'stone', endColor: color, ends: [false, false] },
  );
}

function marketFacade(out, detail) {
  const f = wallFace(...site.street);
  const span = 44.09,
    end = 44.3,
    start = 0.4,
    yTop = 10.09;
  const quad = (s, a, b, c, d, e, fill) =>
    quad4(out, s, f.P(a, c, e), f.P(b, c, e), f.P(b, d, e), f.P(a, d, e), fill);
  // Two native front edges set the street wall. The dressed masonry follows each edge with its own plane.
  const faceF = site.outline.slice(18, 22).reverse();
  for (let i = 0; i < faceF.length - 1; i++) {
    const side = wallFace(faceF[i], faceF[i + 1]);
    quad4(
      out,
      'stone',
      side.P(0, -0.38, 0.07),
      side.P(side.length, -0.38, 0.07),
      side.P(side.length, yTop, 0.07),
      side.P(0, yTop, 0.07),
      limestone,
    );
    fbox(out, 'stone', side, 0, side.length, 9.86, 10.25, -0.06, 0.38, stone);
  }
  // Local deviations in the masonry line are retained in the frontage survey.
  for (const [y, Y] of [
    [0.09, 0.37],
    [3.67, 3.85],
    [7.76, 7.93],
  ])
    fbox(out, 'stone', f, start, end, y, Y, -0.11, 0.19, stone);
  const centerBay = span * 0.31;
  const h = 3.57,
    pedimentWidth = 5.65;
  quad('stone', centerBay - pedimentWidth, centerBay + pedimentWidth, 8.08, yTop, 0.21, limestone);
  tri(
    out,
    'stone',
    f.P(centerBay - pedimentWidth, yTop, 0.22),
    f.P(centerBay + pedimentWidth, yTop, 0.22),
    f.P(centerBay, yTop + 2.22, 0.22),
    stone,
  );
  for (const k of [-1, 1]) {
    beam(
      out,
      'stone',
      f.P(centerBay, yTop + 2.24, 0.28),
      f.P(centerBay + k * pedimentWidth, yTop, 0.28),
      0.24,
      0.19,
      stone,
    );
  }
  opening(out, f, centerBay, 0.17, 2.86, h, {
    ...window,
    head: 'round',
    glassSlot: 'oak',
    glass: oak,
    frame: darkStone,
    frameWidth: 0.3,
    d: 0.45,
  });
  if (detail === 0) return;
  const style = { ...window, head: 'tudor', glass: slatePane, frame: stone, frameWidth: 0.093 };
  for (let i = 0; i < 12; i++) {
    const u = 0.73 + (span * (i + 0.5)) / 12;
    if (Math.abs(u - centerBay) < 1.95) continue;
    const setback = i < 7 ? 0.42 : 0.66;
    opening(out, f, u, 0.72, 1.44, 2.84, {
      ...style,
      frameWidth: detail > 1 ? 0.093 : 0,
      sill: detail > 1,
      glass: courtyardPane,
      d: setback,
      mullions: detail > 1 ? 1 : 0,
      transoms: detail > 2 ? 2 : 0,
    });
    opening(out, f, u, 4.15, 1.54, 2.87, {
      ...style,
      frameWidth: detail > 1 ? 0.093 : 0,
      sill: detail > 1,
      d: setback,
      mullions: detail > 1 ? 1 : 0,
      transoms: detail > 2 ? 2 : 0,
    });
    opening(out, f, u, 8.2, 1.54, 1.43, {
      ...style,
      frameWidth: detail > 1 ? 0.093 : 0,
      sill: detail > 1,
      d: setback,
      mullions: detail > 1 ? 1 : 0,
    });
    if (detail > 1) {
      const q = u - span / 24;
      fbox(out, 'stone', f, q - 0.16, q + 0.16, 0.3, 9.91, 0.11, setback + 0.19, stone);
      for (const d of [-0.35, 0, 0.35])
        fbox(
          out,
          'dark',
          f,
          u + d - 0.023,
          u + d + 0.023,
          0.89,
          3.3,
          setback + 0.095,
          setback + 0.13,
          darkStone,
        );
      opening(out, f, u, -0.01, 1.14, 0.52, {
        ...style,
        frameWidth: 0,
        sill: false,
        glass: courtyardPane,
        d: setback,
        head: 'round',
      });
    }
  }
  opening(out, f, centerBay, 8.06, 1.34, 2.22, {
    ...window,
    head: 'round',
    glass: slatePane,
    d: 0.44,
    mullions: 1,
  });
  for (const s of [-1, 1]) {
    fbox(
      out,
      'stone',
      f,
      centerBay + s * 1.7 - 0.18,
      centerBay + s * 1.7 + 0.18,
      0.22,
      3.77,
      0.16,
      0.92,
      darkStone,
    );
    fbox(
      out,
      'stone',
      f,
      centerBay + s * 1.7 - 0.25,
      centerBay + s * 1.7 + 0.25,
      0.14,
      0.49,
      0.07,
      0.97,
      darkStone,
    );
  }
  fbox(out, 'stone', f, centerBay - 2.04, centerBay + 2.04, 3.74, 4.03, 0.21, 0.89, darkStone);
  lathe(
    out,
    'stone',
    push(f, centerBay, 0, 0.25),
    [
      [4.05, 0.21, 0.31],
      [4.53, 0.43, 0.36],
      [4.78, 0.17, 0.28],
    ],
    7,
    darkStone,
  );
  if (detail > 1) {
    for (const u of [24, 30.15, 37, 41.75]) dormer(out, f, u, 11.25, 1.41, detail, false);
  }
}

function court(out, detail) {
  extrude(out, 'paved', site.court, -0.31, 0.02, cobble);
  const far = innerWalls(site.court);
  for (const f of far) {
    if (f.length < 5) continue;
    const n = Math.max(2, Math.round(f.length / 2.52));
    if (detail) {
      const h = 3.1;
      facadeWindows(out, f, 0.82, 1.23, h, n, detail, window);
      facadeWindows(out, f, 4.7, 1.25, h, n, detail, window);
      for (const y of [3.97, 8.32])
        fbox(out, 'stone', f, 0, f.length, y, y + 0.11, -0.01, 0.1, stone);
      if (f.length > 8)
        for (let i = 0; i < Math.max(2, n / 2); i++)
          dormer(out, f, ((i + 0.52) * f.length) / Math.ceil(n / 2), 9.62, 1.35, detail, true);
      if (detail === 3)
        for (let i = 1; i < n; i++) {
          const u = (i * f.length) / n;
          fbox(out, 'stone', f, u - 0.105, u + 0.105, 1.08, 7.73, 0.012, 0.096, limestone);
        }
    }
  }
  for (const [i, r] of site.garden.entries()) {
    const c = center(r);
    const reduced = (scale) =>
      r.map((p) => [c[0] + (p[0] - c[0]) * scale, c[1] + (p[1] - c[1]) * scale]);
    extrude(out, 'garden', r, 0.024, 0.115, soil);
    if (detail)
      extrude(out, 'garden', r, 0.111, 0.41, i % 2 ? greenery : shrubs, { holes: [reduced(0.79)] });
    if (detail > 1) {
      const vertices = reduced(0.64);
      for (const p of [c, ...vertices.filter((_, i) => i % 2 === 0)]) {
        lathe(
          out,
          'garden',
          p,
          [
            [0.11, 0.19, 0.19],
            [0.38, 0.24, 0.23],
            [0.59, 0.07, 0.09],
          ],
          5,
          shrubs,
        );
      }
    }
  }
  const well = [-16.24, -22.51];
  lathe(
    out,
    'stone',
    well,
    [
      [0.009, 0.58, 0.58],
      [0.14, 0.61, 0.61],
      [0.24, 0.39, 0.39],
      [0.96, 0.36, 0.36],
      [1.02, 0.46, 0.46],
      [1.14, 0.46, 0.46],
    ],
    detail > 1 ? 8 : 5,
    darkStone,
  );
  if (detail) {
    for (const f of far.filter((w) => w.length > 10)) {
      const x = f.length * 0.67;
      fbox(out, 'oak', f, x - 0.65, x + 0.65, 0.4, 0.52, 0.35, 0.78, oak);
      fbox(out, 'oak', f, x - 0.65, x + 0.65, 0.58, 0.92, 0.35, 0.43, oak);
      for (const y of [-0.52, 0.52])
        fbox(out, 'oak', f, x + y - 0.067, x + y + 0.067, 0.11, 0.42, 0.39, 0.69, oak);
    }
  }
}
function build(target, detail) {
  const out = withFootprintCaps(target);
  for (const wing of site.wings) roofedWing(out, wing, 'brick', brick, 'slate', slate);
  marketFacade(out, detail);
  court(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
