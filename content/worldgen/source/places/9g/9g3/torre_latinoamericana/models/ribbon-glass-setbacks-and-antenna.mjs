import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { letterAt } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  spandrel: { slot: 'wall', graph: 'metal_painted', roughness: 0.82 },
  frame: { slot: 'trim', graph: 'metal_stainless', roughness: 0.62 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'ribbon-glazing',
    roughness: 0.3,
    metallic: 0.2,
  },
};

const granite = rgb('a69480');
const graphite = rgb('5a6270');
const aluminum = rgb('b9bac0');
const pale = rgb('bdb7a9');
const crown = rgb('aea99d');
const pane = ['8e999c', '9c9f9b', '949995', 'a6a29a', '7f8f96', 'a2a4a4'].map(rgb);
const shade = rgb('586774');
const roof = rgb('b1aca0');
const light = rgb('e2dacc');
const charcoal = rgb('3d414d');
const red = rgb('b05243');
const floors = [8, 5, 27, 4];
const mix = (a, b, t) => a + (b - a) * t;

function faces(ring) {
  const r = outwardRing(ring);
  return r.map((p, i) => wallFace(p, r[(i + 1) % r.length]));
}

function panel(out, slot, f, u, U, y, Y, d, c) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), c);
}

function ribbon(out, f, y, Y, k, detail, orientation, firstFloor) {
  const h = Y - y;
  const floor = y + h * 0.245,
    ceiling = y + h * 0.876;
  const n =
    detail === 3 ? Math.round(f.length / 1.36) : detail === 2 ? Math.round(f.length / 2.25) : 1;
  const bay = f.length / n;
  for (let i = 0; i < n; i++) {
    const a = i * bay,
      b = (i + 1) * bay;
    const j = (i * 11 + k * 7 + orientation * 3 + (Math.floor(i / 3) % 3) * 2) % pane.length;
    panel(
      out,
      'glass',
      f,
      a + 0.029,
      b - 0.029,
      floor,
      ceiling,
      0.046,
      n === 1 ? pane[0] : pane[j],
    );
    if (detail === 3 && (i * 7 + k * 5 + orientation * 3) % 29 === 1) {
      panel(
        out,
        'glass',
        f,
        a + 0.076,
        b - 0.076,
        floor + 0.016,
        mix(floor, ceiling, 0.58),
        0.058,
        shade,
      );
    }
    if (detail > 1 && i > 0) {
      panel(out, 'frame', f, a - 0.026, a + 0.029, floor - 0.021, ceiling + 0.036, 0.072, aluminum);
    }
  }
  for (const v of [floor, ceiling]) {
    if (detail > 1)
      fbox(out, 'frame', f, -0.049, f.length + 0.045, v - 0.032, v + 0.046, 0.027, 0.147, aluminum);
    else panel(out, 'frame', f, 0, f.length, v - 0.033, v + 0.037, 0.079, aluminum);
  }
  if (firstFloor && detail > 0) {
    const n = Math.max(3, Math.round(f.length / 4.23));
    const span = f.length / n;
    for (let i = 1; i < n; i++) {
      const q = i * span;
      fbox(out, 'base', f, q - 0.17, q + 0.17, 0.06, Y + 0.13, 0.057, 0.35, granite);
    }
    fbox(out, 'frame', f, 0, f.length, Y - 0.24, Y - 0.11, 0.04, 0.77, aluminum);
  }
}

function terrace(out, ring, y, detail) {
  if (detail === 0) return;
  for (const f of faces(ring)) {
    fbox(out, 'frame', f, 0, f.length, y + 0.81, y + 0.88, -0.105, -0.036, aluminum);
    if (detail > 1) {
      fbox(out, 'frame', f, 0, f.length, y + 0.28, y + 0.333, -0.098, -0.05, aluminum);
      for (let i = 0, n = Math.ceil(f.length / (detail === 3 ? 2.0 : 3.22)); i <= n; i++) {
        const u = (i / n) * f.length;
        fbox(out, 'frame', f, u - 0.03, u + 0.03, y + 0.03, y + 0.854, -0.101, -0.043, aluminum);
      }
    }
  }
}

function stage(out, s, index, detail) {
  const { outline, base, height } = s;
  const bodyMin = index === 0 ? 0.04 : base;
  extrude(out, 'spandrel', outline, bodyMin, height, graphite, { top: false });
  cap(out, 'deck', outline, height, roof);
  if (index === 0) {
    extrude(out, 'base', outline, -3.35, bodyMin, granite, { top: false });
  }
  const count = floors[index];
  for (const [i, f] of faces(outline).entries()) {
    for (let floor = 0; floor < count; floor++) {
      if (detail === 0 && floor % 2 === 1) continue;
      const lo = mix(bodyMin, height, floor / count),
        hi = mix(bodyMin, height, (floor + 1) / count);
      ribbon(
        out,
        f,
        lo,
        hi,
        floor + i * 3,
        detail,
        i,
        index === 0 && floor === 0 && f.normal[0] < -0.55,
      );
      if (detail === 0 && floor + 1 < count) {
        const Y = mix(bodyMin, height, (floor + 2) / count);
        panel(
          out,
          'glass',
          f,
          0.016,
          f.length - 0.016,
          mix(hi, Y, 0.245),
          mix(hi, Y, 0.876),
          0.051,
          pane[2],
        );
      }
    }
  }
  terrace(out, outline, height, detail);
}

function text(out, f, word, w, y, h, z) {
  const t = word.replaceAll('O', '0');
  const u0 = (f.length - w) / 2,
    per = w / t.length,
    cols = t.length * 12,
    rows = 19;
  for (let row = 0; row < rows; row++) {
    let start = -1;
    for (let i = 0; i <= cols; i++) {
      const v = (row + 0.5) / rows;
      const ink = i < cols && letterAt(t, (i + 0.5) / 12, v, 0.121);
      if (ink && start < 0) start = i;
      if (ink || start < 0) continue;
      panel(
        out,
        'spandrel',
        f,
        u0 + (start / 12) * per,
        u0 + (i / 12) * per,
        y + (row / rows) * h,
        y + ((row + 1) / rows) * h,
        z,
        charcoal,
      );
      start = -1;
    }
  }
}

function lookout(out, s, detail) {
  const { outline, base, height } = s;
  extrude(out, 'deck', outline, base, height, crown, { top: false });
  cap(out, 'deck', outline, height, roof);
  for (const [i, f] of faces(outline).entries()) {
    panel(out, 'spandrel', f, 0.02, f.length - 0.02, height - 1.4, height - 1.16, 0.044, graphite);
    if (detail > 0) {
      for (let j = 0, n = Math.round(f.length / 1.54); j < n; j++) {
        const u = ((j + 0.5) * f.length) / n;
        panel(
          out,
          'glass',
          f,
          u - 0.57,
          u + 0.57,
          base + 0.63,
          base + 2.13,
          0.052,
          pane[(i + j) % pane.length],
        );
      }
      fbox(out, 'frame', f, 0, f.length, height - 0.45, height - 0.28, 0.026, 0.19, aluminum);
      if (detail > 1 && f.normal[0] < -0.56) {
        text(out, f, 'TORRE', f.length * 0.4, base + 3.9, 0.94, 0.063);
        text(out, f, 'LATINOAMERICANA', f.length * 0.91, base + 2.72, 0.88, 0.065);
      }
    }
  }
  terrace(out, outline, height, detail);
}

function antenna(out, detail) {
  const {
    center: [x, z],
    base,
    height,
    radius,
  } = site.antenna;
  if (detail === 0) {
    lathe(
      out,
      'frame',
      [x, z],
      [
        [base, radius, radius],
        [height - 0.13, 0.19, 0.19],
        [height, 0.19, 0.19],
      ],
      5,
      aluminum,
    );
    return;
  }
  const planes = detail === 1 ? 4 : 6,
    runs = detail === 3 ? 10 : 5;
  const at = (angle, r, y) => [x + r * Math.cos(angle), y, z + r * Math.sin(angle)];
  for (let i = 0; i < planes; i++) {
    const a = (i / planes) * Math.PI * 2,
      b = ((i + 1) / planes) * Math.PI * 2;
    beam(
      out,
      'frame',
      at(a, radius * 0.84, base),
      at(a, 0.235, height - 0.15),
      0.083,
      0.086,
      aluminum,
    );
    for (let j = 0; j < runs; j++) {
      const t = j / runs,
        q = (j + 1) / runs;
      const low = mix(base, height - 0.15, t),
        high = mix(base, height - 0.15, q);
      const r = mix(radius * 0.84, 0.235, t),
        R = mix(radius * 0.84, 0.235, q);
      beam(out, 'frame', at(a, r, low), at(b, r, low), 0.057, 0.057, aluminum);
      if (detail > 1) beam(out, 'frame', at(a, r, low), at(b, R, high), 0.046, 0.049, aluminum);
    }
  }
  lathe(
    out,
    'frame',
    [x, z],
    [
      [height - 0.16, 0.149, 0.149],
      [height, 0.12, 0.12],
    ],
    8,
    red,
  );
}

function build(out, detail) {
  for (const [index, s] of site.sections.entries()) {
    if (index === site.sections.length - 1) lookout(out, s, detail);
    else stage(out, s, index, detail);
  }
  antenna(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
