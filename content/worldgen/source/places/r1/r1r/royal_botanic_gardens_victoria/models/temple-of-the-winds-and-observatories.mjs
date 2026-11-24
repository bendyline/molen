import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97 },
  footing: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  zinc: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.59, metallic: 0.28 },
  board: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.92 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};

const cream = rgb('cdc0a1');
const creamTrim = rgb('e1d4ae');
const foundation = rgb('716b59');
const zinc = rgb('adbac7');
const slate = rgb('777a71');
const templeStone = rgb('b7b4a4');
const templeDome = rgb('adada6');
const deep = rgb('414750');
const xz = ([x, , z]) => [x, z];
const point = ([x, z], y) => [x, y, z];
const tau = 2 * Math.PI;
const at = ([x, z], r, t) => [x + r * Math.cos(t), z + r * Math.sin(t)];

function radial(out, surface, center, levels, sides, color, options) {
  lathe(
    out,
    surface,
    center,
    levels.map(([y, r]) => [y, r, r]),
    sides,
    color,
    options,
  );
}

function block(out, slot, outline, y, Y, color, roofSlot = slot, roofColor = color) {
  extrude(out, slot, outline, y, Y, color, { top: false });
  cap(out, roofSlot, outline, Y, roofColor);
}

function silverDome(out, center, grade, radius, height, detail) {
  const steps = [2, 5, 8, 10][detail];
  const sides = [12, 20, 32, 48][detail];
  const layers = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i * Math.PI) / (2 * steps);
    return [grade + height * Math.sin(angle), i === steps ? 0 : radius * Math.cos(angle)];
  });
  radial(out, 'zinc', center, layers, sides, zinc, { capTop: false });
  if (detail > 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12;
      for (let j = 0; j < steps - 1; j++) {
        const [y, r] = layers[j],
          [Y, R] = layers[j + 1];
        quad4(
          out,
          'zinc',
          point(at(center, r + 0.017, a + 0.009), y),
          point(at(center, R + 0.017, a + 0.009), Y),
          point(at(center, R + 0.017, a - 0.009), Y),
          point(at(center, r + 0.017, a - 0.009), y),
          rgb('c3ced4'),
        );
      }
    }
    const slit = [-0.105, 0.105];
    for (let i = 0; i < steps - 2; i++) {
      const [y, r] = layers[i],
        [Y, R] = layers[i + 1];
      const z = r + 0.035,
        Z = R + 0.035;
      quad4(
        out,
        'zinc',
        point(at(center, z, slit[1]), y),
        point(at(center, Z, slit[1]), Y),
        point(at(center, Z, slit[0]), Y),
        point(at(center, z, slit[0]), y),
        rgb('8d9aa3'),
      );
    }
  }
}

function templeCapital(out, center, y, angle, detail) {
  const side = detail > 2 ? 7 : 5;
  for (let i = 0; i < side; i++) {
    const a = angle + (i - (side - 1) / 2) * 0.25;
    const root = point(at(center, 0.317, a), y - 0.49);
    const middle = point(at(center, 0.435, a + 0.09 * (i % 2 === 0 ? 1 : -1)), y - 0.2);
    const tip = point(at(center, 0.632, a), y + 0.02);
    const width = 0.12 - i * 0.008;
    const bevel = point(at(center, 0.478, a), y - 0.22);
    const left = point(at(center, 0.465, a - width), y - 0.23);
    const right = point(at(center, 0.465, a + width), y - 0.23);
    tri(out, 'stone', root, left, bevel, templeStone);
    tri(out, 'stone', root, bevel, right, templeStone);
    tri(out, 'stone', left, middle, tip, templeStone);
    tri(out, 'stone', middle, right, tip, templeStone);
  }
}

function temple(out, detail) {
  const { center, grade: g, outline, columns, rotation } = site.temple;
  const sides = [12, 20, 36, 48][detail];
  block(out, 'stone', outline, g - 1.3, g + 0.04, rgb('908d7c'));
  radial(
    out,
    'stone',
    center,
    [
      [g + 0.03, 4.34],
      [g + 0.22, 4.34],
    ],
    sides,
    templeStone,
  );
  radial(
    out,
    'stone',
    center,
    [
      [g + 0.2, 4.08],
      [g + 0.42, 4.08],
    ],
    sides,
    templeStone,
  );
  radial(
    out,
    'stone',
    center,
    [
      [g + 0.4, 3.83],
      [g + 0.63, 3.83],
    ],
    sides,
    templeStone,
  );
  radial(
    out,
    'stone',
    center,
    [
      [g + 0.61, 3.64],
      [g + 0.84, 3.64],
    ],
    sides,
    templeStone,
  );
  const frieze = g + 4.18;
  for (let i = 0; i < columns; i++) {
    const a = rotation + (i * tau) / columns;
    const c = at(center, 2.94, a);
    const profile =
      detail === 0
        ? [
            [g + 0.83, 0.37],
            [frieze, 0.34],
          ]
        : detail === 1
          ? [
              [g + 0.83, 0.41],
              [g + 1.03, 0.36],
              [frieze - 0.54, 0.31],
              [frieze, 0.47],
            ]
          : [
              [g + 0.83, 0.44],
              [g + 0.91, 0.44],
              [g + 0.96, 0.384],
              [g + 1.02, 0.37],
              [g + 1.13, 0.35],
              [frieze - 0.69, 0.298],
              [frieze - 0.58, 0.323],
              [frieze - 0.26, 0.395],
              [frieze - 0.11, 0.469],
              [frieze, 0.492],
            ];
    radial(out, 'stone', c, profile, detail === 0 ? 6 : detail === 1 ? 8 : 12, templeStone, {
      capTop: false,
    });
    if (detail > 1) templeCapital(out, c, frieze - 0.09, a, detail);
  }
  const band =
    detail === 0
      ? [
          [frieze, 3.63],
          [g + 4.59, 3.63],
        ]
      : [
          [frieze, 3.65],
          [g + 4.25, 3.76],
          [g + 4.34, 3.74],
          [g + 4.37, 3.55],
          [g + 4.59, 3.56],
          [g + 4.64, 3.71],
          [g + 4.72, 3.66],
          [g + 4.724, 3.332],
        ];
  radial(out, 'stone', center, band, sides, templeStone, { capBottom: true, capTop: false });
  const steps = [3, 5, 8, 12][detail];
  const base = g + (detail === 0 ? 4.58 : 4.71);
  const segments = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i * Math.PI) / (2 * steps);
    return [base + 2.21 * Math.sin(a), i === steps ? 0 : 3.34 * Math.cos(a)];
  });
  radial(out, 'slate', center, segments, sides, templeDome, { capTop: false });
  if (detail > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8;
      for (let j = 0; j < steps - 1; j++) {
        const [y, r] = segments[j],
          [Y, R] = segments[j + 1];
        quad4(
          out,
          'stone',
          point(at(center, r + 0.025, a + 0.013), y),
          point(at(center, R + 0.025, a + 0.013), Y),
          point(at(center, R + 0.025, a - 0.013), Y),
          point(at(center, r + 0.025, a - 0.013), y),
          templeStone,
        );
      }
    }
  }
  const apex = base + 2.89;
  radial(
    out,
    'stone',
    center,
    [
      [base + 2.11, 0.81],
      [base + 2.24, 0.79],
      [base + 2.29, 0.26],
      [apex - 0.13, 0.116],
      [apex - 0.09, 0.138],
      [apex, 0.04],
    ],
    detail === 0 ? 6 : 12,
    templeStone,
  );
}

function sill(out, f, u, y, w) {
  fbox(
    out,
    'stone',
    f,
    u - w / 2 - 0.18,
    u + w / 2 + 0.18,
    y - 0.19,
    y - 0.02,
    -0.02,
    0.19,
    creamTrim,
  );
}

function sash(out, f, u, y, width, height, detail, head = 'round') {
  if (detail === 1) {
    const h = width / 2;
    const spring = y + height - h;
    const shape =
      head === 'round'
        ? [
            [u - h, y],
            [u + h, y],
            ...roundArch(h, 4)
              .reverse()
              .map(([x, dy]) => [u + x, spring + dy]),
          ]
        : [
            [u - h, y],
            [u + h, y],
            [u + h, y + height],
            [u - h, y + height],
          ];
    fan(
      out,
      'glazing',
      shape.map(([x, v]) => f.P(x, v, 0.026)),
      deep,
    );
    return;
  }
  opening(out, f, u, y, width, height, {
    head,
    d: 0.018,
    frameWidth: detail === 0 ? 0 : 0.127,
    frameDepth: 0.092,
    glassSlot: 'glazing',
    glass: deep,
    frameSlot: 'stone',
    frame: creamTrim,
    sill: false,
    mullions: detail > 1 ? 1 : 0,
    transoms: detail > 1 ? 1 : 0,
  });
  if (detail > 0) sill(out, f, u, y, width);
}

function mould(out, f, y, Y, depth, color) {
  fbox(out, 'stone', f, -0.015, f.length + 0.015, y, Y, -0.05, depth, color);
}

function observatory(out, detail) {
  const { outline, grade: g } = site.observatory;
  const shell = g + 5.12;
  block(out, 'footing', outline, g - 0.78, g + 0.5, foundation);
  block(out, 'wall', outline, g + 0.49, shell, cream, 'slate', slate);
  for (const [x, z, X, Z] of site.observatory.wings) {
    abox(out, 'wall', [x, shell - 0.04, z], [X, shell + 0.68, Z], cream, { bottom: false });
    abox(
      out,
      'slate',
      [x - 0.11, shell + 0.66, z - 0.11],
      [X + 0.11, shell + 0.93, Z + 0.11],
      slate,
      { bottom: false },
    );
  }
  const ring = outwardRing(outline);
  const faces = ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
  for (const f of faces) {
    const {
      length: w,
      normal: [nx],
    } = f;
    if (w < 2.7) continue;
    if (detail > 0) {
      mould(out, f, g + 0.5, g + 0.72, 0.145, creamTrim);
      if (detail > 1) mould(out, f, shell - 0.33, shell - 0.17, 0.195, creamTrim);
      mould(out, f, shell - 0.16, shell + 0.05, 0.245, creamTrim);
    }
    if (w < 4.15 || detail === 0) continue;
    const n = Math.max(1, Math.round(w / 4.45));
    const spacing = w / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * spacing;
      if (nx < -0.55 && f.origin[1] < 145.5 && w >= 4.15) {
        sash(out, f, u, g + 1.29, 1.32, 2.78, detail);
        if (detail > 1) {
          for (const d of [-0.93, 0.93])
            fbox(
              out,
              'stone',
              f,
              u + d - 0.075,
              u + d + 0.075,
              g + 0.87,
              g + 4.63,
              0.035,
              0.147,
              creamTrim,
            );
          fbox(out, 'stone', f, u - 0.87, u + 0.87, g + 0.86, g + 1.19, 0.045, 0.18, creamTrim);
        }
      } else if (w > 4.65)
        sash(
          out,
          f,
          u,
          g + 1.32,
          1.03,
          nx > 0.5 ? 1.74 : 2.03,
          detail,
          nx > 0.5 ? 'flat' : 'round',
        );
    }
    if (nx > -0.6 || w < 6 || detail < 2) continue;
    mould(out, f, shell + 0.53, shell + 0.69, 0.16, creamTrim);
    mould(out, f, shell + 0.05, shell + 0.18, 0.13, creamTrim);
    const posts = Math.floor(w / (detail > 1 ? 0.64 : 1.14));
    for (let i = 0; i <= posts; i++) {
      const u = (w * i) / posts;
      fbox(
        out,
        'stone',
        f,
        u - 0.073,
        u + 0.073,
        shell + 0.18,
        shell + 0.54,
        -0.07,
        0.12,
        creamTrim,
      );
    }
  }
  if (detail > 0) {
    for (const [x, z] of [
      [-165.28, 138.31],
      [-158.6, 145.1],
      [-140.4, 133.83],
    ]) {
      abox(out, 'wall', [x - 0.28, shell, z - 0.26], [x + 0.28, shell + 1.44, z + 0.26], cream, {
        bottom: false,
      });
      abox(
        out,
        'stone',
        [x - 0.36, shell + 1.39, z - 0.35],
        [x + 0.36, shell + 1.57, z + 0.35],
        creamTrim,
        { bottom: false },
      );
    }
  }
}

function astrograph(out, detail) {
  const { outline, center, grade: g } = site.astrograph;
  const top = g + 4.84;
  block(out, 'footing', outline, g - 0.64, g + 0.38, foundation);
  block(out, 'wall', outline, g + 0.37, top, cream, 'slate', slate);
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (detail > 0) {
      mould(out, f, top - 0.24, top + 0.042, 0.23, creamTrim);
      mould(out, f, g + 2.71, g + 2.83, 0.09, creamTrim);
      sash(out, f, f.length * 0.5, g + 0.89, 1.02, 1.63, detail, 'flat');
      const [x, , z] = f.P(f.length * 0.5, g + 3.69, 0.028);
      const radius = 0.238;
      const points = Array.from({ length: 10 }, (_, j) => {
        const angle = (j * tau) / 10;
        return [
          x + f.along[0] * Math.cos(angle) * radius,
          g + 3.69 + Math.sin(angle) * radius,
          z + f.along[1] * Math.cos(angle) * radius,
        ];
      });
      for (let j = 0; j < points.length; j++)
        tri(out, 'glazing', [x, g + 3.69, z], points[j], points[(j + 1) % points.length], deep);
    }
  }
  radial(
    out,
    'stone',
    center,
    [
      [top - 0.04, 2.85],
      [top + 0.26, 2.85],
    ],
    detail === 0 ? 12 : 24,
    creamTrim,
  );
  silverDome(out, center, top + 0.26, 2.81, 2.94, detail);
}

function linkedHouses(out, detail) {
  const { grade: g, north, south, bridge } = site.transit;
  const sides = [8, 14, 28, 36][detail];
  const [[ax, az], [bx, bz]] = bridge;
  const f = facade([ax, az], [bx - ax, bz - az]);
  block(out, 'footing', bridge, g - 0.95, g + 0.25, foundation);
  block(out, 'board', bridge, g + 0.24, g + 2.48, cream, 'zinc', zinc);
  const roof = bridge.map((p, i) => point(p, g + (i === 0 || i === 3 ? 2.77 : 2.52)));
  quad4(out, 'zinc', roof[3], roof[2], roof[1], roof[0], zinc);
  const wallFacingEast = wallFace(bridge[2], bridge[1]);
  if (detail > 0)
    sash(out, wallFacingEast, wallFacingEast.length * 0.46, g + 0.84, 0.61, 1.07, detail);
  if (detail > 1) fbox(out, 'stone', f, 0.1, 0.37, g + 0.3, g + 2.72, -0.2, 0.1, creamTrim);
  const nr = north.radius,
    sr = south.radius;
  radial(
    out,
    'footing',
    north.center,
    [
      [g - 0.96, nr],
      [g + 0.22, nr],
    ],
    sides,
    foundation,
  );
  radial(
    out,
    'wall',
    north.center,
    [
      [g + 0.21, nr],
      [g + 2.45, nr],
      [g + 2.53, nr + 0.044],
    ],
    sides,
    cream,
    { capTop: false },
  );
  silverDome(out, north.center, g + 2.54, nr, 2.19, detail);
  radial(
    out,
    'footing',
    south.center,
    [
      [g - 0.95, sr],
      [g + 0.2, sr],
    ],
    sides,
    foundation,
  );
  const band =
    detail === 0
      ? [
          [g + 0.18, sr],
          [g + 4.45, sr - 0.15],
        ]
      : [
          [g + 0.18, sr],
          [g + 2.55, sr],
          [g + 2.65, sr + 0.11],
          [g + 2.78, sr + 0.11],
          [g + 2.9, sr],
          [g + 3.06, sr + 0.065],
          [g + 3.15, sr + 0.065],
          [g + 3.22, sr - 0.12],
          [g + 4.43, sr - 0.12],
        ];
  radial(out, 'wall', south.center, band, sides, cream, { capTop: false });
  radial(
    out,
    'zinc',
    south.center,
    [
      [g + 4.42, sr + 0.11],
      [g + 4.55, sr + 0.12],
      [g + 5.33, 0.08],
    ],
    detail === 0 ? 12 : 24,
    zinc,
  );
  if (detail > 0) {
    for (const a of [0.14, 1.88, 3.16]) {
      const normal = [Math.cos(a), Math.sin(a)];
      const wall = facade(at(south.center, sr - 0.114, a), [normal[1], -normal[0]]);
      sash(out, wall, 0, g + 3.23, 0.53, 1.0, detail, 'flat');
    }
  }
}

function build(out, detail) {
  observatory(out, detail);
  astrograph(out, detail);
  linkedHouses(out, detail);
  temple(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
