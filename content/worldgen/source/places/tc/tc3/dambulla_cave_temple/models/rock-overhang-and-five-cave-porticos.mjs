import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.98 },
  floor: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  shade: { slot: 'door', graph: 'wood_vertical', roughness: 0.95 },
};

const limestone = rgb('a99c82'),
  paving = rgb('9b917b'),
  wall = rgb('ded9ca'),
  white = rgb('d7d2c3');
const shade = rgb('50483d'),
  slate = rgb('696e6a'),
  trim = rgb('c4bead');
const tones = ['6f6960', '69665f', '747169', '716d65', '695f54', '79726a'].map(rgb);
const REF = 'palette:#ffffff';
const xz = ([x, , z]) => [x, z];
const lerp = (a, b, t) => a + (b - a) * t;
const grade = ([x, z]) => Math.max(-0.61, Math.min(1.48, (x + 137.2) * 0.0219 - 0.48 + z * 0.0048));
const facadePanel = (out, slot, f, u, U, y, Y, d, tone) =>
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), tone);

function terrace(out) {
  const { apron } = site;
  if (!out.addCap('floor', REF, apron, [], grade, [0, 1, 0], (p) => p, paving))
    throw new Error('Dambulla: courtyard cap failed');
  for (const [i, [x, z]] of apron.entries()) {
    const [a, b] = apron[(i + 1) % apron.length];
    quad4(
      out,
      'floor',
      [a, -2.25, b],
      [x, -2.25, z],
      [x, grade([x, z]), z],
      [a, grade([a, b]), b],
      limestone,
    );
  }
}

function arch(out, f, mid, half, base, spring, rise, top, depth, detail) {
  const { P } = f,
    samples = roundArch(half, [3, 5, 8, 10][detail]);
  const profile = samples.map(([x, y]) => [mid + x, spring + (y * rise) / half]);
  const a = mid - half,
    b = mid + half;
  for (let i = 0; i < profile.length - 1; i++) {
    const [u, y] = profile[i],
      [v, Y] = profile[i + 1];
    const A = P(u, y, 0.02),
      B = P(v, Y, 0.02);
    quad4(out, 'plaster', A, B, P(v, top, 0.02), P(u, top, 0.02), wall);
    quad4(
      out,
      'plaster',
      P(v, Y, -depth),
      P(u, y, -depth),
      P(u, top, -depth),
      P(v, top, -depth),
      white,
    );
    quad4(out, 'trim', P(u, y, -depth), P(v, Y, -depth), B, A, trim);
    if (detail > 0)
      quad4(
        out,
        'trim',
        P(u, y, 0.089),
        P(v, Y, 0.089),
        P(v, Y + 0.093, 0.087),
        P(u, y + 0.093, 0.087),
        white,
      );
  }
  const w = detail > 0 ? 0.24 : 0.23;
  for (const [u, U] of [
    [a - w, a],
    [b, b + w],
  ]) {
    fbox(out, 'plaster', f, u, U, base, spring + 0.035, -depth, 0.045, wall);
    if (detail > 1) {
      fbox(
        out,
        'trim',
        f,
        u - 0.055,
        U + 0.055,
        spring - 0.121,
        spring + 0.067,
        -depth,
        0.118,
        white,
      );
      fbox(out, 'trim', f, u - 0.069, U + 0.069, base, base + 0.2, -depth, 0.111, white);
    }
  }
}

function screen(out, f, mid, base, top, kind, detail) {
  const w = kind === 'curved' ? 1.89 : 1.74;
  const front = 0.68,
    back = -0.73,
    y = base + 3.23;
  for (const [a, b] of [
    [mid - w, mid - 1.14],
    [mid + 1.14, mid + w],
  ]) {
    fbox(out, 'plaster', f, a, b, base, top, -0.62, front, white);
    fbox(out, 'trim', f, a - 0.11, b + 0.11, base, base + 0.28, -0.76, front + 0.12, trim);
    if (detail)
      for (const h of [base + 1.11, y - 0.17, top - 0.39])
        fbox(out, 'trim', f, a - 0.092, b + 0.092, h, h + 0.13, -0.64, front + 0.13, wall);
  }
  const sf = facade(xz(f.P(0, 0, front)), f.along);
  arch(out, sf, mid, 1.15, base, y - 0.62, 0.68, top, front - back, detail);
  fbox(out, 'trim', sf, mid - w - 0.11, mid + w + 0.11, top - 0.18, top + 0.04, -0.61, 0.13, wall);
  if (kind === 'gable') {
    const p = [sf.P(mid - w, top, 0), sf.P(mid + w, top, 0), sf.P(mid, top + 1.36, 0)];
    fan(out, 'plaster', p, wall);
    if (detail) for (let i = 0; i < 2; i++) beam(out, 'trim', p[i], p[2], 0.139, 0.16, white);
  } else {
    const head = roundArch(w, [4, 7, 10, 12][detail]);
    fan(
      out,
      'plaster',
      [
        sf.P(mid - w, top, 0),
        sf.P(mid + w, top, 0),
        ...head
          .toReversed()
          .slice(1, -1)
          .map(([u, y]) => sf.P(mid + u, top + y * 0.82, 0)),
      ],
      wall,
    );
    lathe(
      out,
      'trim',
      xz(sf.P(mid, 0, -0.22)),
      [
        [top + 1.36, 0.24, 0.19],
        [top + 1.71, 0.22, 0.19],
        [top + 2.25, 0.03, 0.03],
      ],
      detail > 0 ? 8 : 5,
      white,
    );
  }
}

function caveFront(out, run, detail) {
  const f = wallFace(run.a, run.b),
    { P, length } = f,
    L = run.level + 0.6,
    H = run.roof + run.level;
  const stairLoc = ((run.door + 0.5) / run.count) * length,
    b = run.count,
    span = length / b;
  const near = -0.32,
    back = -4.67;
  const steps = [1, 4, 5, 7][detail];
  fbox(
    out,
    'floor',
    f,
    -0.11,
    length + 0.09,
    -1.4,
    detail ? L : L + 0.145,
    back,
    near + 0.42,
    limestone,
  );
  if (detail)
    fbox(out, 'floor', f, -0.08, length + 0.08, L - 0.09, L + 0.145, back, near + 0.53, paving);
  if (detail > 0)
    fbox(out, 'trim', f, -0.065, length + 0.068, L + 0.14, L + 0.23, back, near + 0.49, trim);
  if (detail === 0) {
    fbox(out, 'plaster', f, 0, stairLoc - 1.13, L, H, -0.55, 0.03, wall);
    fbox(out, 'plaster', f, stairLoc + 1.13, length, L, H, -0.55, 0.03, wall);
    arch(out, f, stairLoc, 1.13, L + 0.13, L + 2.48, run.archRise, H, 0.49, detail);
  } else {
    // The sill stops at each entrance, leaving a walkable opening to the rear cave door.
    for (let i = 0; i < b; i++) {
      const mid = (i + 0.5) * span,
        half = Math.min(1.19, span * 0.388);
      const full = i === run.door,
        base = full ? L + 0.13 : L + 1.29;
      if (!full)
        fbox(out, 'plaster', f, i * span, (i + 1) * span, L + 0.13, base, -0.59, 0.04, wall);
      arch(out, f, mid, half, base, L + 2.74 - run.archRise * 0.12, run.archRise, H, 0.61, detail);
      const right = i * span;
      fbox(out, 'plaster', f, right - 0.14, right + 0.16, L + 0.1, H - 0.095, -0.54, 0.12, white);
    }
  }
  const base = L + 0.138,
    floor = run.level;
  for (let j = 0; j < steps; j++) {
    const t = (j + 1) / steps;
    fbox(
      out,
      'floor',
      f,
      stairLoc - 1.43,
      stairLoc + 1.44,
      floor - 0.71,
      lerp(floor, base, t),
      -0.24,
      1.75 - (1.64 * j) / steps,
      paving,
    );
  }
  fbox(out, 'shade', f, 0, length, L - 0.08, H + 0.82, -4.9, -4.66, shade);
  fbox(
    out,
    'shade',
    f,
    stairLoc - 1.16,
    stairLoc + 1.16,
    base,
    base + 2.48,
    -4.54,
    -4.51,
    rgb('464035'),
  );
  if (detail > 0) {
    const f0 = facade(xz(P(0, 0, -4.42)), f.along);
    for (const u of [stairLoc - 1.27, stairLoc + 1.27])
      fbox(out, 'trim', f0, u - 0.08, u + 0.08, base, base + 2.58, -0.085, 0.033, limestone);
  }
  const y = H + 0.11;
  const end = run.endLevel - run.level;
  quad4(
    out,
    'roof',
    P(-0.29, y, 0.42),
    P(length + 0.29, y + end, 0.42),
    P(length + 0.29, y + end + run.slope, -5.24),
    P(-0.29, y + run.slope, -5.24),
    slate,
  );
  fbox(out, 'roof', f, -0.29, length + 0.29, H - 0.048, y, 0.27, 0.45, slate);
  if (run.screen) screen(out, f, stairLoc, L + 0.146, H + 0.41, run.screen, detail);
}

function rock(out, detail) {
  const stations = [];
  for (const [i, run] of site.runs.entries()) {
    const f = wallFace(run.a, run.b),
      n = [2, 4, 7, 12][detail];
    for (let j = 0; j < n; j++) {
      const t = j / n;
      stations.push([f, f.length * t, (i + t) / site.runs.length]);
    }
    if (i === site.runs.length - 1) stations.push([f, f.length, 1]);
  }
  const points = stations.map(([f, u, t]) => {
    const h =
      0.44 * Math.sin(t * 46.9 + 0.81) +
      0.37 * Math.sin(t * 81.7 + 0.12) +
      0.28 * Math.cos(t * 23.1);
    const v = 1.05 * Math.sin(t * 5.93) + 0.26 * Math.cos(t * 40.1);
    const roof = 9.17 + 1.03 * Math.sin(t * 6.9) + 0.47 * h;
    const height = 39.1 - 22 * Math.pow(t, 1.69) + 2.83 * Math.sin(t * 4.8);
    return [
      f.P(u, roof - 0.93, -6.11),
      f.P(u, roof, 0.58 + 0.46 * h),
      f.P(u, roof + 3.56 + v, 1.01 + 0.53 * h),
      f.P(u, roof + 10.08 + 0.86 * h, -0.58 + v),
      f.P(u, lerp(roof, height, 0.66) + 1.1 * v, -5.96 + 0.77 * h),
      f.P(u, height, -18.17 + (t > 0.72 ? 2.5 : 0) + 1.02 * v),
      f.P(u, height - 1.08, -37.7 + v),
    ];
  });
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const floor = ([x, , z]) => [x, grade([x, z]) - 0.58, z];
    quad4(out, 'rock', floor(a[0]), floor(b[0]), b[0], a[0], tones[4]);
    for (let j = 0; j < a.length - 1; j++) {
      const c = tones[j === 0 ? 4 : (Math.floor(i / 3) + j * 3) % tones.length];
      tri(out, 'rock', a[j], b[j], b[j + 1], c);
      tri(out, 'rock', a[j], b[j + 1], a[j + 1], c);
    }
  }
  for (const [row, reverse] of [
    [points[0], true],
    [points.at(-1), false],
  ]) {
    const foot = [row[0][0], 0.17, row[0][2] - 0.86];
    for (let j = 0; j < row.length - 1; j++) {
      const order = reverse ? [row[j + 1], row[j], foot] : [row[j], row[j + 1], foot];
      tri(out, 'rock', ...order, tones[(j + 2) % tones.length]);
    }
  }
}

function entryPavilion(out, detail) {
  const r = site.pavilion,
    edges = r.map((a, i) => wallFace(a, r[(i + 1) % r.length])).sort((a, b) => b.length - a.length);
  const f = edges[0],
    origin = f.origin;
  const uv = r.map(([x, z]) => [
    f.along[0] * (x - origin[0]) + f.along[1] * (z - origin[1]),
    f.normal[0] * (x - origin[0]) + f.normal[1] * (z - origin[1]),
  ]);
  const a = Math.min(...uv.map((p) => p[0])),
    b = Math.max(...uv.map((p) => p[0]));
  const c = Math.min(...uv.map((p) => p[1])),
    d = Math.max(...uv.map((p) => p[1]));
  const y = grade(origin) + 0.27,
    H = y + 4.24;
  extrude(out, 'plaster', r, y - 0.98, H, wall, { topSlot: 'roof', topColor: slate });
  const m = (c + d) * 0.5;
  gableRoof(
    out,
    'roof',
    xz(f.P(a + 0.24, 0, m)),
    xz(f.P(b - 0.24, 0, m)),
    d - c - 0.19,
    H,
    H + 2.05,
    slate,
    { overhang: 0.32, endSlot: 'plaster', endColor: white },
  );
  if (detail > 0) {
    const u = (a + b) * 0.5;
    facadePanel(out, 'shade', f, u - 1.31, u + 1.31, y, y + 2.77, 0.026, shade);
    fbox(out, 'trim', f, u - 1.42, u - 1.25, y, y + 2.88, -0.09, 0.15, white);
    fbox(out, 'trim', f, u + 1.25, u + 1.42, y, y + 2.88, -0.09, 0.15, white);
  }
}

function build(sink, detail) {
  const out = withFootprintCaps(sink);
  terrace(out);
  rock(out, detail);
  for (const run of site.runs) caveFront(out, run, detail);
  entryPavilion(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
