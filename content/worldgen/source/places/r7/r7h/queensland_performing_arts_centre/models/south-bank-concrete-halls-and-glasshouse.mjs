import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.95 },
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.94 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
  ripple: {
    slot: 'window',
    localRef: 'palette:#f9fcff',
    roughness: 0.28,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.56],
    doubleSided: true,
  },
};

const cream = rgb('bfc0ab'),
  pale = rgb('c7c6b3'),
  warm = rgb('b9b2a2'),
  stone = rgb('959286');
const steel = rgb('545e60'),
  glass = rgb('6c7975'),
  shaded = rgb('474d49'),
  light = rgb('b8a789');
const pane = ['7c8b87', 'a9b1a7', '748988', '899a94', '8b9993'].map(rgb);
const surfacesOf = (r) => r.map((a, i) => wallFace(a, r[(i + 1) % r.length]));
const average = (r) => r.reduce(([x, z], [a, b]) => [x + a / r.length, z + b / r.length], [0, 0]);

function at(f, u, d) {
  const [x, , z] = f.P(u, 0, d);
  return [x, z];
}
function plan(f, u, d, U, D) {
  return outwardRing([at(f, u, d), at(f, U, d), at(f, U, D), at(f, u, D)]);
}
function panel(out, slot, f, a, b, y, Y, d, color) {
  quad4(out, slot, f.P(a, y, d), f.P(b, y, d), f.P(b, Y, d), f.P(a, Y, d), color);
}
function slab(out, slot, ring, y, Y, color, top = slot, roof = color) {
  const footprint = outwardRing(cleanRing(ring));
  extrude(out, slot, footprint, y, Y, color, { top: false });
  cap(out, top, footprint, Y, roof);
}

function ribbon(out, f, u, U, y, Y, d, detail) {
  panel(out, 'glazing', f, u, U, y, Y, d, glass);
  if (detail === 0) return;
  const spans = Math.max(1, Math.floor((U - u) / (detail === 1 ? 5.5 : 2.42)));
  for (let i = 1; i < spans; i++) {
    const a = u + ((U - u) * i) / spans;
    panel(out, 'metal', f, a - 0.065, a + 0.065, y, Y, d + 0.018, steel);
  }
  if (detail > 1)
    panel(out, 'metal', f, u, U, (y + Y) * 0.5 - 0.064, (y + Y) * 0.5 + 0.064, d + 0.019, steel);
}

function oldPodium(out, detail) {
  const outer = outwardRing(site.outline);
  slab(out, 'paving', outer, -4.2, 0.9, stone);
  slab(out, 'concrete', outer, 0.9, 7.7, cream, 'panel', warm);
  if (detail === 0) return;
  for (const f of surfacesOf(outer)) {
    if (f.length < 2.45) continue;
    const l = f.length;
    ribbon(out, f, 0.32, l - 0.34, 4.72, 6.64, 0.023, detail);
    if (detail > 1) {
      const bays = Math.floor(l / 4.6);
      for (let i = 1; i < bays; i++) {
        const u = (i * l) / bays;
        fbox(out, 'panel', f, u - 0.17, u + 0.17, 4.39, 7.36, 0, 0.37, pale);
      }
    }
    if (l > 8.4) fbox(out, 'concrete', f, 0, l, 7.38, 7.83, -0.22, 0.37, pale);
  }
}

function oldHalls(out, detail) {
  oldPodium(out, detail);
  for (const [i, { outline, height }] of site.zoneShapes.entries()) {
    const r = outwardRing(cleanRing(outline)),
      c = average(r);
    if (detail === 0) {
      slab(out, 'concrete', r, 7.69, height, i % 2 ? warm : cream, 'panel', warm);
      continue;
    }
    slab(out, 'concrete', r, 7.69, height - 5.1, i % 2 ? warm : cream, 'panel', warm);
    const fine = r.map(([x, z]) => [x + (c[0] - x) * 0.115, z + (c[1] - z) * 0.115]);
    slab(out, 'panel', fine, height - 5.12, height, i % 2 ? pale : cream, 'panel', warm);
    for (const f of surfacesOf(r)) {
      const l = f.length;
      if (l < 3.35) continue;
      if (l > 6.25) {
        ribbon(out, f, 0.76, l - 0.76, 8.08, 10.74, 0.028, detail);
        if (detail > 0)
          ribbon(out, f, 1.25, l - 1.25, height - 10.87, height - 7.21, 0.037, detail);
      }
      if (detail > 1) {
        panel(out, 'panel', f, 0, l, height - 6.43, height - 6.18, 0.082, pale);
        for (let j = 2; j < l - 1; j += 4.25)
          panel(out, 'panel', f, j - 0.057, j + 0.057, 10.8, height - 5.14, 0.057, warm);
      }
    }
  }
}

function rakedFoyer(out, detail) {
  if (detail === 0) return;
  const main = wallFace(site.outline[33], site.outline[32]);
  const d = 0.067;
  for (let i = 0; i < 5; i++) {
    const u = i * 7.75 + 14.2,
      ramp = 11.73 + 2.2 * i;
    const width = 7.75;
    panel(out, 'glazing', main, u, u + width, 5.1, ramp, d, glass);
    fbox(out, 'concrete', main, u, u + width, ramp, ramp + 1.5, d - 0.39, d + 0.31, cream);
    if (detail > 0) {
      for (const x of [u, u + width / 2])
        panel(out, 'metal', main, x - 0.085, x + 0.085, 5.19, ramp, d + 0.054, steel);
      const a = 5.26 + i * 0.95,
        b = a + 2.63;
      quad4(
        out,
        'paving',
        main.P(u, a, d + 0.05),
        main.P(u + width, b, d + 0.05),
        main.P(u + width, b + 0.31, d + 0.05),
        main.P(u, a + 0.31, d + 0.05),
        stone,
      );
    }
  }
}

function curtain(out, f, detail, index) {
  const span = f.length,
    y = site.glassBase,
    Y = site.glassTop;
  const a = index === 0 ? 0.22 : 0,
    b = span - (index === 0 ? 0 : 0.32);
  const turns = index === 0 ? 5 : 3;
  const wave = (t) => 0.88 * Math.sin(t * turns * 2 * Math.PI) * Math.sin(t * Math.PI) + 0.12;
  const count = turns * [3, 8, 14, 20][detail];
  const original = (t, h, d = 0) => f.P(a + (b - a) * t, h, wave(t) + d);
  const deck = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const [x, , z] = original(t, 0);
    deck.push([x, z]);
  }
  const end = at(f, b, -6.4),
    start = at(f, a, -6.4);
  const apron = outwardRing([...deck, end, start]);
  slab(out, 'metal', apron, y - 0.2, y, steel);
  slab(out, 'metal', apron, Y, Y + 0.24, steel);
  if (detail > 0)
    slab(out, 'panel', apron, y + (Y - y) * 0.48 - 0.14, y + (Y - y) * 0.48 + 0.13, light);
  for (let i = 0; i < count; i++) {
    const t = i / count,
      T = (i + 1) / count;
    const tint =
      pane[
        Math.min(4, Math.floor((0.5 + 0.5 * Math.sin((t + T) * turns * Math.PI + 0.6)) * 4.999))
      ];
    quad4(
      out,
      detail ? 'ripple' : 'glazing',
      original(t, y),
      original(T, y),
      original(T, Y),
      original(t, Y),
      tint,
    );
    if (detail > 0 && i % [1, 2, 2, 1][detail] === 0) {
      const step = 0.061 / (b - a),
        end = Math.min(T, t + step);
      quad4(
        out,
        'metal',
        original(t, y, 0.027),
        original(end, y, 0.027),
        original(end, Y, 0.027),
        original(t, Y, 0.027),
        steel,
      );
    }
    if (detail > 1) {
      const h = y + (Y - y) * 0.48;
      quad4(
        out,
        'metal',
        original(t, h - 0.085, 0.034),
        original(T, h - 0.085, 0.034),
        original(T, h + 0.09, 0.034),
        original(t, h + 0.09, 0.034),
        steel,
      );
    }
  }
  for (const start of [0.12, 0.39, 0.64, 0.87]) {
    const u = a + (b - a) * start;
    fbox(out, 'panel', f, u - 0.49, u + 0.49, 0.49, y + 0.05, -5.19, -3.88, pale);
  }
}

function glasshouse(out, detail) {
  const outer = outwardRing(site.glasshouse);
  slab(out, 'paving', outer, -3.22, 0.28, stone);
  const f = site.glassFrames.map(({ origin, along, length }) => ({
    ...facade(origin, along),
    length,
  }));
  for (const r of site.glassBody)
    slab(out, 'panel', outwardRing(r), 0.21, site.glassBoxTop, pale, 'concrete', warm);
  for (const [i, front] of f.entries()) {
    curtain(out, front, detail, i);
    const l = front.length;
    const u = l * 0.16,
      U = l * 0.84;
    const y = 0.79,
      d = -5.41;
    fbox(out, 'panel', front, u, U, -0.06, y, d, -0.68, pale);
    ribbon(out, front, u + 0.65, U - 0.65, y + 0.08, site.glassBase - 0.14, d + 0.031, detail);
    const n = detail === 0 ? 3 : 7;
    for (let j = 0; j < n; j++) {
      const h = ((y + 0.03) * (j + 1)) / n;
      const setback = 0.49 * j;
      fbox(out, 'paving', front, u, U, -0.24, h, -4.18, 0.47 - setback, stone);
    }
  }
}

function build(out, detail) {
  oldHalls(out, detail);
  rakedFoyer(out, detail);
  glasshouse(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
