import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  cladding: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42 },
};

const white = rgb('e0e2dd'),
  silver = rgb('a7b3b7'),
  whiteGrey = rgb('cdd3d1');
const dark = rgb('586166'),
  stone = rgb('9e9d93'),
  roof = rgb('a2a8a6');
const marine = ['427d8b', '378788', '4d919d', '4b7788'].map(rgb);
const glass = ['315d6f', '3e6b7b', '2b5367', '48798a', '346472'].map(rgb);
const facilities = site.outline;
const entry = wallFace(...site.atrium.wall);
const { sill, height, canopyHeight } = site.atrium;
const roofY = 12.31;

function panel(out, slot, f, u0, u1, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d), color);
}

function mural(out, f, u, h, r, i, detail) {
  const p = (x, y, z) => f.P(u + x * r, h + y * r, z);
  const n = [14, 21, 32, 44][detail];
  const rim = (angle, r, d) => p(r * Math.cos(angle), r * Math.sin(angle), d);
  for (let j = 0; j < n; j++) {
    const a = (j * 2 * Math.PI) / n,
      b = ((j + 1) * 2 * Math.PI) / n;
    tri(
      out,
      'trim',
      p(0, 0, 0.052),
      rim(a, 1, 0.052),
      rim(b, 1, 0.052),
      marine[(i + Number(j > n / 2)) % 4],
    );
  }
  const sign = i % 3 === 0 ? -1 : 1;
  const Q = (a, b, d = 0.059) => p(sign * a, b, d);
  const tc = (a, b, c, col) =>
    tri(out, 'trim', Q(...a), Q(...(sign === 1 ? b : c)), Q(...(sign === 1 ? c : b)), col);
  const body = [
    [-0.72, 0],
    [-0.39, -0.26],
    [0.23, -0.23],
    [0.67, -0.07],
    [0.7, 0.08],
    [0.31, 0.245],
    [-0.28, 0.235],
  ];
  const fish = [rgb('9fc1be'), rgb('a8a980'), rgb('c58a6f'), rgb('89acbc')][i % 4];
  for (const [j, a] of body.entries()) tc([0, 0], a, body[(j + 1) % body.length], fish);
  tc([-0.55, -0.012], [-0.86, 0.37], [-0.86, -0.31], fish);
  tc([0.05, 0.18], [0.22, 0.24], [-0.12, 0.57], fish);
  tc([-0.23, -0.14], [0.04, -0.42], [0.26, -0.14], rgb('385c70'));
  if (detail > 1) {
    tc([0.45, 0.101, 0.065], [0.56, 0.101, 0.065], [0.501, 0.18, 0.065], dark);
    for (let j = 0; j < 5; j++) {
      const a = -0.57 + j * 0.239,
        b = -0.65 + ((j + 2 * i) % 4) * 0.081;
      tc([a - 0.048, b], [a + 0.057, b + 0.105], [a - 0.086, b + 0.22], rgb('549595'));
    }
  }
}

function wallHeight(i) {
  if (i < 4) return i === 0 ? 13.36 : 13.08;
  if (i < 11) return 13.56 + 0.09 * (i - 4);
  return Math.min(15.75, 13.59 + 0.226 * (i - 12));
}

function walls(out, detail) {
  let plaque = 0;
  for (const [i, a] of facilities.entries()) {
    const f = wallFace(a, facilities[(i + 1) % facilities.length]);
    const length = f.length;
    if (i === 11) continue;
    const top = wallHeight(i);
    panel(out, 'foundation', f, 0, length, site.foundationBottom, 0.27, 0, stone);
    if (detail === 0 || length < 2) {
      panel(out, 'cladding', f, 0, length, 0.26, top, 0, white);
    } else {
      panel(out, 'cladding', f, 0, length, 0.26, top, 0, whiteGrey);
      const count = Math.max(1, Math.round(length / (detail === 1 ? 6.3 : 3.35)));
      for (let c = 0; c < count; c++) {
        const left = (c * length) / count,
          right = ((c + 1) * length) / count;
        for (const [y0, y1] of [
          [0.32, 6.53],
          [6.56, top - 0.07],
        ])
          panel(
            out,
            'cladding',
            f,
            left + 0.018,
            right - 0.018,
            y0,
            y1,
            0.026,
            c % 3 === 2 ? whiteGrey : white,
          );
      }
      fbox(out, 'trim', f, 0, length, top - 0.115, top, -0.32, 0.075, silver);
    }
    if (i >= 4 && length > 4.5) {
      const r = Math.min(1.79, length * 0.282);
      mural(out, f, length * 0.5, top * 0.607, r, plaque++, detail);
    }
    if (detail > 0 && i === 0) {
      for (const [offset, w, h] of [
        [12, 3.02, 3.8],
        [56, 2.21, 2.81],
        [76, 4.42, 4.1],
      ]) {
        fbox(out, 'trim', f, offset - w / 2, offset + w / 2, 0.27, h, 0, 0.075, dark);
        for (let j = 1; j < 8; j++) {
          const y = 0.27 + ((h - 0.27) * j) / 8;
          panel(
            out,
            'trim',
            f,
            offset - w / 2 + 0.05,
            offset + w / 2 - 0.05,
            y - 0.023,
            y + 0.023,
            0.09,
            silver,
          );
        }
      }
    }
  }
  cap(out, 'roof', facilities, roofY, roof);
  if (detail > 0) {
    for (const [i, a] of facilities.entries()) {
      if (i === 11) continue;
      const f = wallFace(a, facilities[(i + 1) % facilities.length]);
      panel(out, 'cladding', f, 0, f.length, roofY, wallHeight(i), -0.27, whiteGrey);
    }
    const back = wallFace(facilities[0], facilities[1]);
    for (const [i, u] of [18, 22, 26, 48, 52, 70].entries()) {
      const d = -8 - (i % 2) * 3;
      fbox(out, 'trim', back, u - 1.35, u + 1.35, roofY, roofY + 0.67, d - 1.12, d + 1.12, dark);
      fbox(
        out,
        'roof',
        back,
        u - 1.29,
        u + 1.29,
        roofY + 0.663,
        roofY + 0.736,
        d - 1.1,
        d + 1.1,
        silver,
      );
    }
  }
}

function atrium(out, detail) {
  const f = entry;
  const max = sill + height;
  const lean = (y) => -0.94 + (y - sill) * (1.39 / height);
  const grid = (u, y, d = 0) => f.P(u, y, lean(y) + d);
  const pane = (slot, a, b, y0, y1, d, color) =>
    quad4(out, slot, grid(a, y0, d), grid(b, y0, d), grid(b, y1, d), grid(a, y1, d), color);
  const a = 0.48,
    b = f.length - 0.48;
  const cols = [4, 9, 12, 12][detail],
    rows = [3, 5, 7, 8][detail];
  const X = (i) => a + ((b - a) * i) / cols,
    Y = (j) => sill + (height * j) / rows;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      pane('glass', X(i), X(i + 1), Y(j), Y(j + 1), 0, glass[(i + 2 * j) % glass.length]);
  for (let i = 0; i <= cols; i++)
    pane('trim', X(i) - 0.042, X(i) + 0.042, sill, max, 0.037, silver);
  for (let i = 0; i <= rows; i++) pane('trim', a, b, Y(i) - 0.041, Y(i) + 0.041, 0.04, silver);
  for (const [u0, u1] of [
    [0, a],
    [b, f.length],
  ]) {
    fbox(out, 'cladding', f, u0, u1, site.foundationBottom, canopyHeight, -1.12, 0.62, white);
  }
  panel(out, 'foundation', f, a, b, site.foundationBottom, sill, -0.94, stone);
  fbox(out, 'cladding', f, -0.32, f.length + 0.34, max, canopyHeight, -1.83, 2.73, white, {
    bottom: true,
  });
  fbox(
    out,
    'trim',
    f,
    -0.18,
    f.length + 0.18,
    canopyHeight - 0.15,
    canopyHeight + 0.15,
    -0.92,
    2.83,
    silver,
  );
  fbox(out, 'foundation', f, -0.24, f.length + 0.27, -1.35, sill, -1.27, 0.9, stone);
  const risers = detail === 0 ? 1 : 4;
  for (let i = 0; i < risers; i++) {
    const t = i / risers;
    fbox(
      out,
      'foundation',
      f,
      0.23,
      f.length - 0.2,
      -0.15,
      sill * (1 - t),
      0.9 + 0.4 * i,
      1.3 + 0.4 * i,
      stone,
    );
  }
  if (detail > 0) {
    const lateral = (f.length - 1.38) / 3;
    for (let i = 0; i <= 3; i++) {
      const u = 0.69 + i * lateral;
      beam(out, 'trim', f.P(u, sill + 0.9, 1), f.P(u, 0.99, 2.63), 0.05, 0.05, silver);
      for (const [y, d] of [
        [sill, 1.03],
        [0.11, 2.61],
      ])
        beam(out, 'trim', f.P(u, y, d), f.P(u, y + 0.865, d), 0.045, 0.045, silver);
    }
    for (const [i, u] of [f.length * 0.29, f.length * 0.71].entries()) {
      pane('glass', u - 1.41, u + 1.41, sill + 0.09, sill + 2.74, 0.062, glass[i ? 0 : 2]);
      for (const x of [u - 1.41, u, u + 1.41])
        pane('trim', x - 0.035, x + 0.035, sill, sill + 2.76, 0.091, dark);
      pane('trim', u - 1.46, u + 1.46, sill + 2.72, sill + 2.81, 0.09, dark);
      pane('trim', u - 0.26, u - 0.11, sill + 1.03, sill + 1.11, 0.127, silver);
      pane('trim', u + 0.11, u + 0.26, sill + 1.03, sill + 1.11, 0.127, silver);
    }
  }
}

function sign(out, detail) {
  panel(out, 'trim', entry, 0.22, entry.length - 0.22, 12.62, 15.24, 2.735, rgb('3b6c76'));
  if (detail < 1) return;
  const text = 'CAIRNS AQUARIUM',
    width = 11.65,
    y = 13.41,
    height = 0.91,
    depth = 2.773;
  const ink = rgb('e4e3d8');
  const mapped = deform(out, ([u, y, d]) => entry.P(u + entry.length / 2, y, d));
  lettering(mapped, text.replace(/[QU]/g, ' '), {
    width,
    y,
    height,
    z: depth,
    slot: 'trim',
    color: ink,
    stroke: 0.066,
  });
  for (const [i, ch] of [...text].entries()) {
    if (ch !== 'Q' && ch !== 'U') continue;
    const u = ((i - text.length / 2) * width) / text.length + entry.length / 2;
    const w = (width / text.length) * 0.74;
    const points =
      ch === 'Q'
        ? [
            [0, 0.22],
            [0, 0.78],
            [0.22, 1],
            [0.78, 1],
            [1, 0.78],
            [1, 0.22],
            [0.78, 0],
            [0.22, 0],
            [0, 0.22],
          ]
        : [
            [0, 1],
            [0, 0.19],
            [0.21, 0],
            [0.79, 0],
            [1, 0.19],
            [1, 1],
          ];
    beamPath(
      out,
      'trim',
      points.map(([x, h]) => entry.P(u + x * w, y + h * height, depth)),
      0.066,
      0.066,
      ink,
    );
    if (ch === 'Q')
      beam(
        out,
        'trim',
        entry.P(u + 0.62 * w, y + 0.29 * height, depth),
        entry.P(u + 1.07 * w, y - 0.07, depth),
        0.066,
        0.066,
        ink,
      );
  }
}

function build(out, detail) {
  walls(out, detail);
  atrium(out, detail);
  sign(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
