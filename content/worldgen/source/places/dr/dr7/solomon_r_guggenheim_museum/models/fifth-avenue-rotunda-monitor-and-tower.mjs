import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95 },
  stone: { slot: 'wall', graph: 'stone_travertine', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.94 },
  glass: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.45, metallic: 0.1 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  vent: { slot: 'trim', graph: 'metal_perforated_square', roughness: 0.85 },
  pavement: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = (u, y, d) => F.P(u, y, d);
const at = ([u, d]) => {
  const [x, , z] = P(u, 0, d);
  return [x, z];
};
const tau = 2 * Math.PI;
const white = rgb('d5d1c3');
const light = rgb('e0ddcd');
const shade = rgb('b0aea4');
const roof = rgb('62635d');
const glass = rgb('546369');
const skylight = rgb('9ba8a4');
const shallow = rgb('7d8989');
const edge = rgb('939286');
const stone = rgb('9c978b');
const base = rgb('949388');
const dark = rgb('404b4d');
const { rotunda, monitor, highTower } = site;

function rect(u, d, U, D) {
  return [
    [u, d],
    [U, d],
    [U, D],
    [u, D],
  ].map(at);
}
function box(out, slot, u, U, y, Y, d, D, color) {
  fbox(out, slot, F, u, U, y, Y, d, D, color, { bottom: true });
}
function block(out, slot, outline, y, Y, tint, capSlot = slot, capColor = tint) {
  extrude(out, slot, outline, y, Y, tint, { top: false });
  cap(out, capSlot, outline, Y, capColor);
}
function radial(out, slot, [u, d], profile, n, color, options) {
  lathe(
    out,
    slot,
    at([u, d]),
    profile.map(([y, r]) => [y, r, r]),
    n,
    color,
    options,
  );
}
function face(out, slot, F, u, U, y, Y, d, color) {
  quad4(out, slot, F.P(u, y, d), F.P(U, y, d), F.P(U, Y, d), F.P(u, Y, d), color);
}

function foundation(out, detail) {
  block(out, 'pavement', site.outline, -1.42, 0.088, base);
  const basePlan = [
    [0.17, -0.87],
    [12.95, -0.88],
    [12.96, -3.1],
    [19.41, -3.12],
    [19.44, -6.14],
    [33.47, -6.21],
    [33.47, -9.36],
    [58.15, -9.42],
    [58.21, -16.73],
    [60.78, -16.78],
    [60.84, -34.19],
    [30.67, -34.33],
    [30.64, -29.53],
    [0.16, -29.71],
  ].map(at);
  block(out, 'concrete', basePlan, 0.03, 4.08, white, 'roof', roof);
  if (detail > 0) {
    face(out, 'glass', F, 19.35, 33.45, 0.19, 3.57, -6.08, glass);
    const tiles = detail === 1 ? 4 : 10;
    for (let i = 0; i <= tiles; i++) {
      const u = 19.35 + (i * 14.1) / tiles;
      box(out, 'steel', u - 0.039, u + 0.039, 0.15, 3.56, -6.071, -5.975, dark);
    }
  }
  box(out, 'pavement', 20.12, 30.24, -0.29, 0.094, -6.13, 2.12, base);
}

function frontRibbon(out, detail) {
  const front = site.local.slice(11).reverse();
  const trace =
    detail === 0
      ? front.filter((_, i) => i % 3 === 0 || i === front.length - 1)
      : detail === 1
        ? front.filter((_, i) => i % 2 === 0 || i === front.length - 1)
        : front;
  const y = 3.53,
    Y = 7.35;
  for (let i = 1; i < trace.length; i++) {
    const [u, d] = trace[i - 1],
      [U, D] = trace[i];
    const width = ([x, z]) =>
      Math.min(6.12, Math.max(0.78, 21.48 + z)) * Math.min(1, 0.5 + x * 0.06);
    const A = P(u, y, d),
      B = P(U, y, D),
      a = P(u, y, d - width(trace[i - 1])),
      b = P(U, y, D - width(trace[i]));
    const C = P(u, Y, d),
      E = P(U, Y, D),
      c = P(u, Y, d - width(trace[i - 1])),
      e = P(U, Y, D - width(trace[i]));
    quad4(out, 'concrete', A, B, E, C, white);
    quad4(out, 'roof', C, E, e, c, roof);
    quad4(out, 'concrete', b, B, A, a, shade);
    quad4(out, 'concrete', b, a, c, e, white);
  }
  const canopy = [
    [21.47, -0.2],
    [32.98, -0.2],
    [33.55, 4.87],
    [22.55, 4.65],
  ].map(at);
  block(out, 'concrete', canopy, 3.17, 3.489, white, 'roof', roof);
  fan(
    out,
    'concrete',
    outwardRing(canopy)
      .reverse()
      .map(([x, z]) => [x, 3.17, z]),
    shade,
  );
  if (detail > 1) {
    for (let i = 0; i < 15; i++) {
      const u = 22.43 + i * 0.686;
      box(out, 'steel', u - 0.067, u + 0.057, 3.11, 3.186, 0.42, 4.53, edge);
    }
  }
}

function lowMonitor(out, detail) {
  const c = monitor.center;
  const n = [10, 15, 27, 42][detail];
  radial(
    out,
    'concrete',
    c,
    [
      [0.04, 6.91],
      [3.44, 6.91],
      [3.62, monitor.radius],
      [7.39, monitor.radius],
      [7.52, 8.28],
    ],
    n,
    white,
  );
  radial(
    out,
    'glass',
    c,
    [
      [7.48, 7.86],
      [9.37, 7.86],
    ],
    n,
    glass,
    { capTop: false },
  );
  box(out, 'concrete', 0.53, 18.96, 9.38, 10.59, -19.35, -0.83, white);
  radial(
    out,
    'glass',
    c,
    [
      [10.58, 7.62],
      [13.39, 7.62],
    ],
    n,
    glass,
    { capTop: false },
  );
  radial(
    out,
    'concrete',
    c,
    [
      [13.33, 7.77],
      [13.49, 8.34],
      [monitor.top, 8.25],
    ],
    n,
    light,
  );
  radial(
    out,
    'roof',
    c,
    [
      [monitor.top + 0.005, 7.95],
      [monitor.top + 0.064, 7.95],
    ],
    n,
    roof,
  );
  const side = [c[0] + 0.47, c[1] - 0.29];
  radial(
    out,
    'glass',
    side,
    [
      [14.41, 2.8],
      [15.35, 2.63],
      [15.62, 0.24],
    ],
    detail === 0 ? 7 : 12,
    shallow,
    { capBottom: true },
  );
  if (detail > 0) {
    const count = detail === 1 ? 18 : 34;
    for (let j = 0; j < count; j++) {
      const a = (j * tau) / count,
        rad = [Math.cos(a), Math.sin(a)];
      const along = [rad[1], -rad[0]];
      const A = at([c[0] + rad[0] * 7.64, c[1] + rad[1] * 7.64]);
      const n = wallFace(A, at([c[0] + rad[0] * 7.64 + along[0], c[1] + rad[1] * 7.64 + along[1]]));
      fbox(out, 'steel', n, -0.037, 0.037, 10.55, 13.42, -0.009, 0.067, edge);
      if (detail > 2) {
        const B = at([c[0] + rad[0] * 7.91, c[1] + rad[1] * 7.91]);
        const L = wallFace(
          B,
          at([c[0] + rad[0] * 7.91 + along[0], c[1] + rad[1] * 7.91 + along[1]]),
        );
        fbox(out, 'steel', L, -0.036, 0.036, 7.51, 9.37, -0.012, 0.055, edge);
      }
    }
  }
}

function crescent(out, slot, profile, detail, tint, wave) {
  const count = [10, 20, 42, 64][detail];
  for (let j = 1; j < profile.length; j++) {
    const [y, r] = profile[j - 1],
      [Y, R] = profile[j];
    for (let i = 0; i < count; i++) {
      const a = (i * tau) / count,
        b = ((i + 1) * tau) / count;
      const point = (angle, y, r) =>
        P(
          rotunda.center[0] + r * Math.cos(angle),
          y + wave * Math.sin(angle - 0.19),
          rotunda.center[1] + r * Math.sin(angle),
        );
      // The footprint is in the museum's avenue frame, preserving right-handed winding.
      quad4(out, slot, point(a, y, r), point(a, Y, R), point(b, Y, R), point(b, y, r), tint);
    }
  }
}

function centralRotunda(out, detail) {
  const c = rotunda.center;
  const n = [10, 20, 42, 64][detail];
  radial(
    out,
    'concrete',
    c,
    [
      [0.08, 11.15],
      [3.51, 11.27],
      [5.14, 12.18],
      [6.79, 13.22],
    ],
    n,
    white,
  );
  const bands = [
    { base: 6.72, top: 10.94, a: 12.41, r: 13.79 },
    { base: 11.15, top: 15.26, a: 13.09, r: 15.08 },
    { base: 15.53, top: 19.53, a: 14.31, r: 16.53 },
    { base: 19.84, top: 23.43, a: 15.76, r: 17.93 },
    { base: 23.76, top: rotunda.roof, a: 17.37, r: rotunda.radius },
  ];
  for (const [i, { base, top, a, r }] of bands.entries()) {
    const curve =
      detail < 2
        ? [
            [base, a],
            [top, r],
          ]
        : [
            [base, a],
            [base + 0.385, a + 0.234],
            [base + (top - base) * 0.65, a + (r - a) * 0.76],
            [top, r],
          ];
    const wave = i === bands.length - 1 ? 0.08 : 0.28;
    crescent(out, 'concrete', curve, detail, i % 2 === 0 ? white : light, wave);
    if (i !== bands.length - 1) {
      const next = bands[i + 1];
      crescent(
        out,
        'glass',
        [
          [top - 0.07, r - 0.61],
          [next.base + 0.06, next.a - 0.24],
        ],
        detail,
        dark,
        wave,
      );
    }
  }
  radial(
    out,
    'roof',
    c,
    [
      [rotunda.roof - 0.2, rotunda.radius - 0.19],
      [rotunda.roof - 0.118, rotunda.radius - 0.19],
    ],
    n,
    roof,
  );
  const R = rotunda.skylightRadius,
    Y = rotunda.roof;
  const frame = [
    [Y - 0.028, R],
    [Y + 0.28, R],
    [Y + 0.675, R * 0.78],
    [Y + 1.04, R * 0.43],
    [rotunda.top, 0.42],
  ];
  radial(
    out,
    'glass',
    c,
    frame,
    detail === 0 ? 12 : detail === 1 ? 20 : detail === 2 ? 32 : 44,
    skylight,
  );
  if (detail > 0) {
    const spokes = detail === 1 ? 14 : 28;
    for (let i = 0; i < spokes; i++) {
      const a = (i * tau) / spokes;
      for (let j = 1; j < frame.length; j++) {
        const [y, r] = frame[j - 1],
          [Y, R] = frame[j];
        const p = (y, r, t) => P(c[0] + r * Math.cos(t), y + 0.015, c[1] + r * Math.sin(t));
        quad4(
          out,
          'steel',
          p(y, r, a + 0.005),
          p(Y, R, a + 0.006),
          p(Y, R, a - 0.006),
          p(y, r, a - 0.005),
          edge,
        );
      }
    }
  }
  box(out, 'concrete', 25.88, 30.55, 20.93, 30.48, -17.44, -11.73, white);
  box(out, 'roof', 26.14, 30.34, 30.29, 30.43, -17.17, -12.01, roof);
  if (detail > 1) {
    for (const [u, d] of [
      [35, -26.12],
      [34.7, -5.38],
      [49.82, -25.84],
      [53.02, -8.76],
    ]) {
      radial(
        out,
        'roof',
        [u, d],
        [
          [rotunda.roof - 0.11, 0.43],
          [rotunda.roof + 0.25, 0.39],
          [rotunda.roof + 0.49, 0.22],
        ],
        10,
        edge,
      );
    }
  }
}

function tower(out, detail) {
  const outline = highTower.outline.map(at);
  const top = highTower.height;
  block(out, 'stone', outline, 0.07, top, stone, 'roof', roof);
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const l = f.length;
    fbox(out, 'stone', f, -0.03, l + 0.035, top - 0.54, top + 0.068, -0.11, 0.06, shade);
    if (detail === 0) continue;
    const long = l > 20;
    const strips = long ? 10 : 4;
    for (let j = 1; j < strips; j++) {
      const x = (l * j) / strips;
      face(out, 'steel', f, x - 0.013, x + 0.019, 2.16, top - 0.72, 0.015, edge);
    }
    for (let y = 3.57; y < top - 0.6; y += detail === 1 ? 5.11 : 2.56) {
      face(out, 'steel', f, 0.016, l - 0.014, y, y + 0.024, 0.015, edge);
    }
    const w = long ? l * 0.34 : l * 0.51;
    const u = l * (long ? 0.36 : 0.52);
    if (long) {
      for (let j = 0; j < 4; j++) {
        const y = 22.68 + j * 2.82;
        face(out, 'vent', f, u - w / 2, u + w / 2, y, y + 0.286, 0.034, dark);
      }
    } else {
      face(out, 'vent', f, u - w / 2, u + w / 2, 24.23, 34.04, 0.037, dark);
    }
    if (detail > 2) {
      for (let j = 0; j < strips; j++) {
        const x = ((j + 0.5) * l) / strips;
        face(
          out,
          'stone',
          f,
          x - (l / strips) * 0.48,
          x + (l / strips) * 0.48,
          top - 3.05,
          top - 1.83,
          0.029,
          shade,
        );
      }
    }
  }
  if (detail > 0) {
    for (const [u, d, w, h] of [
      [4.21, -26.35, 2.21, 0.5],
      [16.74, -25.42, 3.33, 0.61],
      [26.43, -24.25, 2.62, 0.74],
    ]) {
      box(out, 'roof', u - w / 2, u + w / 2, top - 0.09, top + h, d - 1.03, d + 1.02, edge);
    }
  }
}

function connector(out, detail) {
  box(out, 'concrete', 15.41, 30.6, 6.88, 11.9, -22.36, -5.71, white);
  box(out, 'roof', 15.49, 30.47, 11.86, 12.043, -22.3, -5.78, roof);
  if (detail > 1) {
    for (const u of [21.38, 23.68, 25.92]) {
      const center = P(u, 10.38, -5.68);
      const circle = Array.from({ length: 14 }, (_, i) => {
        const θ = (i * tau) / 14;
        return P(u + 0.49 * Math.cos(θ), 10.38 + 0.49 * Math.sin(θ), -5.677);
      });
      for (let i = 0; i < circle.length; i++)
        tri(out, 'glass', center, circle[i], circle[(i + 1) % circle.length], dark);
    }
  }
}

function build(out, detail) {
  foundation(out, detail);
  frontRibbon(out, detail);
  lowMonitor(out, detail);
  centralRotunda(out, detail);
  tower(out, detail);
  connector(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
