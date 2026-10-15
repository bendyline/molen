/** Dated operator exterior and plans; retain mapped chamfers and the signed street entrance. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  grid,
  localOutline,
  mappedSolid,
  panel,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export const altinoArantesRuntimeAssetId = 'molen.worldgen.structure.n0148_edificio_altino_arantes';
const frame = JSON.parse(
  readFileSync(structureSourcePath('n0148_edificio_altino_arantes', 'map-frame.json'), 'utf8'),
);
const parts = JSON.parse(
  readFileSync(structureSourcePath('n0148_edificio_altino_arantes', 'map-parts.json'), 'utf8'),
);
const pale = [0.91, 0.9, 0.865],
  glass = [0.23, 0.31, 0.31],
  grey = [0.48, 0.51, 0.49];

function clip(plan, axis, value, greater) {
  const result = [],
    inside = (p) => (greater ? p[axis] >= value : p[axis] <= value);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return result;
}
export function altinoPlans() {
  const ground = localOutline(frame),
    core = parts.upperCoreNative;
  let body = ground;
  for (const [axis, v, greater] of [
    [0, -17.3, true],
    [0, 20.7, false],
    [1, -7.7, true],
    [1, 7.7, false],
  ])
    body = clip(body, axis, v, greater);
  const mid = body.map(([x, z]) => [1.7 + (x - 1.7) * 0.82, z * 0.91]);
  return { ground, body, mid, core };
}

function windows(out, plan, y0, y1, detail) {
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1.4) continue;
    const tangent = [(b[0] - a[0]) / length, 0, (b[1] - a[1]) / length];
    const normal = [-tangent[2], 0, tangent[0]],
      columns = Math.max(1, Math.floor(length / 2.6));
    const rows = Math.max(1, Math.round((y1 - y0) / 3.8));
    for (let col = 0; col < columns; col++)
      for (let row = 0; row < rows; row++) {
        if (detail === 'district' && row % 2 === 1) continue;
        const u = (col + 0.5) / columns,
          y = y0 + ((row + 0.5) * (y1 - y0)) / rows;
        const center = [a[0] + u * (b[0] - a[0]), y, a[1] + u * (b[1] - a[1])];
        const w = Math.min(1.15, (length / columns) * 0.52),
          h = Math.min(2.25, ((y1 - y0) / rows) * 0.66);
        const p = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([s, t]) =>
          center.map(
            (v, k) =>
              v + (tangent[k] * s * w) / 2 + (k === 1 ? (t * h) / 2 : 0) + normal[k] * 0.035,
          ),
        );
        if (detail === 'current') panel(out, p, glass, 0.055, grey, 'cladding');
        else face(out, 'glass', p, glass);
        if (detail === 'current' || (detail === 'street' && row % 2 === 0))
          beam(
            out,
            'cladding',
            p[0].map((v, k) => v + normal[k] * 0.09),
            p[1].map((v, k) => v + normal[k] * 0.09),
            0.15,
            0.1,
            pale,
          );
      }
    for (let col = 1; col < columns; col++) {
      const u = col / columns,
        x = a[0] + u * (b[0] - a[0]) + normal[0] * 0.13,
        z = a[1] + u * (b[1] - a[1]) + normal[2] * 0.13;
      beam(out, 'cladding', [x, y0, z], [x, y1, z], 0.27, 0.28, pale);
    }
  }
}

function terrace(out, plan, y, detail) {
  if (detail === 'current' || detail === 'street')
    bandPlan(out, plan, y - 0.4, 0.4, 0.48, pale, 'cladding');
  else
    mappedSolid(
      out,
      'cladding',
      plan.map(([x, z]) => [1.7 + (x - 1.7) * 1.015, z * 1.015]),
      y - 0.4,
      y,
      pale,
    );
  if (detail === 'skyline') return;
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    beam(out, 'metal', [a[0], y + 0.85, a[1]], [b[0], y + 0.85, b[1]], 0.055, 0.055, grey);
    if (detail !== 'district') {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.2);
      for (let j = 0; j < n; j++) {
        const u = j / n,
          x = a[0] + u * (b[0] - a[0]),
          z = a[1] + u * (b[1] - a[1]);
        beam(out, 'metal', [x, y, z], [x, y + 0.85, z], 0.045, 0.045, grey);
      }
    }
  }
}

function lantern(out, detail) {
  const ring = (y, r) => radialRing(y, r, r, 8, [1.7, 0]);
  const layers = [
    [140.52, 3.35],
    [141.2, 3.35],
    [144.4, 3.03],
    [147.6, 3.2],
    [150.8, 3.55],
  ];
  mappedSolid(
    out,
    'cladding',
    ring(0, 3.55).map((p) => [p[0], p[2]]),
    140.52,
    141.2,
    pale,
  );
  loft(
    out,
    'glass',
    layers.slice(1).map(([y, r]) => ring(y, r)),
    glass,
  );
  for (let i = 0; i < 8; i++) {
    if (detail === 'skyline') {
      beam(out, 'cladding', ring(141.2, 3.35)[i], ring(150.8, 3.55)[i], 0.16, 0.16, pale);
      continue;
    }
    for (let j = 1; j < layers.length - 1; j++) {
      const a = ring(...layers[j]),
        b = ring(...layers[j + 1]);
      beam(out, 'cladding', a[i], b[i], 0.16, 0.16, pale);
      if (detail !== 'skyline') beam(out, 'cladding', a[i], a[(i + 1) % 8], 0.13, 0.13, pale);
      if (detail === 'current' || detail === 'street') {
        const k = (i + 1) % 8;
        grid(out, [a[i], a[k], b[k], b[i]], glass, 0.85, 1.1, 0.035, pale, 'cladding');
      }
    }
  }
  loft(out, 'cladding', [ring(150.8, 3.65), ring(151.8, 2.3), ring(152.22, 0.8)], pale);
  tube(out, 'metal', [1.7, 152.22, 0], [1.7, 161.22, 0], 0.12, grey, detail === 'skyline' ? 6 : 12);
  for (let stripe = 0; stripe < 13; stripe++) {
    const y = 158.8 - stripe * 0.18,
      n = detail === 'skyline' ? 1 : 4;
    for (let i = 0; i < n; i++) {
      const x0 = 1.82 + (i * 4.08) / n,
        x1 = 1.82 + ((i + 1) * 4.08) / n;
      const z0 = 0.2 * Math.sin((i * 7.8) / n),
        z1 = 0.2 * Math.sin(((i + 1) * 7.8) / n);
      const p = [
        [x0, y - 0.18, z0],
        [x1, y - 0.18, z1],
        [x1, y, z1],
        [x0, y, z0],
      ];
      const color = stripe % 2 ? pale : [0.055, 0.06, 0.06];
      face(out, 'canvas', p, color);
      face(out, 'canvas', p.toReversed(), color);
    }
  }
  const segments = detail === 'skyline' ? 1 : 4;
  const clothZ = (x) => {
    const u = ((x - 1.82) / 4.08) * segments,
      i = Math.floor(u),
      t = u - i;
    return (
      0.2 * ((1 - t) * Math.sin((i * 7.8) / segments) + t * Math.sin(((i + 1) * 7.8) / segments))
    );
  };
  // Split overlays at every cloth fold so neither face intersects its underlying stripes.
  const clothCuts = [1.83];
  for (let i = 1; i < segments; i++) {
    const x = 1.82 + (i * 4.08) / segments;
    if (x > 1.83 && x < 3.32) clothCuts.push(x);
  }
  clothCuts.push(3.32);
  const overlay = (polygon, sign, offset, color) => {
    for (let j = 0; j < clothCuts.length - 1; j++) {
      let part = clip(polygon, 0, clothCuts[j], true);
      part = clip(part, 0, clothCuts[j + 1], false);
      if (part.length < 3) continue;
      const points = part.map(([x, y]) => [x, y, clothZ(x) + sign * offset]);
      const oriented = sign > 0 ? points : points.toReversed();
      for (let k = 1; k < oriented.length - 1; k++)
        tri(out, 'canvas', [oriented[0], oriented[k], oriented[k + 1]], color);
    }
  };
  for (const sign of [-1, 1]) {
    const canton = [
      [1.83, 157.72],
      [3.32, 157.72],
      [3.32, 158.8],
      [1.83, 158.8],
    ];
    overlay(canton, sign, 0.007, [0.65, 0.03, 0.04]);
    if (detail === 'skyline') continue;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        b = ((i + 1) * Math.PI) / 8;
      const p = [
        [2.57, 158.26],
        [2.57 + 0.35 * Math.cos(a), 158.26 + 0.35 * Math.sin(a)],
        [2.57 + 0.35 * Math.cos(b), 158.26 + 0.35 * Math.sin(b)],
      ];
      overlay(p, sign, 0.012, pale);
    }
  }
}

function build(out, detail) {
  const plans = altinoPlans();
  mappedSolid(out, 'cladding', plans.ground, 0, 16.57, [0.79, 0.79, 0.755]);
  for (const [plan, y0, y1] of [
    [plans.body, 16.57, 91],
    [plans.mid, 91, 107.14],
    [plans.core, 107.14, 136.5],
  ]) {
    mappedSolid(out, 'cladding', plan, y0, y1, pale);
    if (detail !== 'skyline') windows(out, plan, y0, y1 - 0.4, detail);
    terrace(out, plan, y1, detail);
  }
  // The strong projecting front band at the26th-floor outlook is separate from the upper body.
  box(out, 'cladding', [-12, 90.6, -8.18], [15.4, 91.2, -6.5], pale);
  box(out, 'cladding', [-12, 99.5, -8.18], [15.4, 100.05, -6.5], pale);
  face(
    out,
    'glass',
    [
      [15.4, 91.2, -8.3],
      [-12, 91.2, -8.3],
      [-12, 99.5, -8.3],
      [15.4, 99.5, -8.3],
    ],
    glass,
  );
  if (detail !== 'skyline')
    for (let i = 0; i < 10; i++) {
      const x = -11.4 + i * 2.9;
      box(out, 'cladding', [x - 0.13, 91.2, -8.65], [x + 0.13, 99.5, -8.35], pale);
    }
  if (detail !== 'skyline')
    beam(out, 'cladding', [-12, 95.35, -8.36], [15.4, 95.35, -8.36], 0.12, 0.12, pale);
  mappedSolid(out, 'cladding', plans.core, 136.5, 140.52, pale);
  terrace(out, plans.core, 140.52, detail);
  lantern(out, detail);
  // entrance node5079752545 at native[4.159,-8.293], facing Rua João Brícola to the northwest.
  box(out, 'recess', [-0.34, 0.4, -8.345], [8.66, 10.8, -8.295], [0.075, 0.095, 0.105]);
  for (const x of [-0.34, 8.66])
    box(out, 'cladding', [x - 0.45, 0, -8.73], [x + 0.45, 12.3, -8.28], pale);
  box(out, 'cladding', [-0.79, 10.8, -8.73], [9.11, 12.3, -8.28], pale);
}
export const buildAltinoCurrent = (out) => build(out, 'current');
export const buildAltinoStreet = (out) => build(out, 'street');
export const buildAltinoDistrict = (out) => build(out, 'district');
export const buildAltinoSkyline = (out) => build(out, 'skyline');
