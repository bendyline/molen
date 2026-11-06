/** Atlantic Bridge: mapped curved approaches, two inverted-Y pylons and dual cable planes. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const data = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url)));
const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = {
  concrete: linear('cbc9c0'),
  cable: linear('dbdbd0'),
  metal: linear('c5c7c4'),
  road: linear('575d60'),
  paint: linear('e8e3cd'),
  joint: linear('555a58'),
};
export const atlanticControls = {
  minX: -1570,
  maxX: 1570,
  channelCenter: -75,
  pylons: [-340, 190],
  mainSpan: 530,
  pylonTop: 212.5,
  deckTop: 77.8,
  deckDepth: 2.8,
  width: 32,
};
export const atlanticSurfaces = {
  skyline: {
    slot: 'wall',
    localRef: 'palette:#ffffff',
    roughness: 0.85,
    metallic: 0,
    doubleSided: true,
  },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  road: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.24 },
  cable: { slot: 'trim', graph: 'metal_stainless', roughness: 0.4, metallic: 0.65 },
  paint: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
};
function interpolate(points, x) {
  let j = points.findIndex((p) => p[0] >= x);
  if (j < 0) return points.at(-1)[1];
  if (j === 0) return points[0][1];
  const a = points[j - 1],
    b = points[j];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}
export const atlanticCenterZ = (x) => interpolate(data.centerline, x);
export const atlanticDeckY = (x) => interpolate(data.deckProfile, x);
function at(x, z = 0, y = atlanticDeckY(x)) {
  const dz =
      (atlanticCenterZ(Math.min(1570, x + 0.5)) - atlanticCenterZ(Math.max(-1570, x - 0.5))) /
      (x === -1570 || x === 1570 ? 0.5 : 1),
    scale = 1 / Math.hypot(1, dz);
  return [x - dz * scale * z, y, atlanticCenterZ(x) + scale * z];
}
function rectRing(x, y, z, w, d) {
  return [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
}
function quad(out, slot, p, color) {
  out.addQuad(
    slot,
    'palette:#ffffff',
    p,
    normalFor(p[0], p[1], p[2]),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function topStrip(out, slot, x0, x1, z0, z1, dy, color) {
  quad(
    out,
    slot,
    [
      at(x0, z0, atlanticDeckY(x0) + dy),
      at(x0, z1, atlanticDeckY(x0) + dy),
      at(x1, z1, atlanticDeckY(x1) + dy),
      at(x1, z0, atlanticDeckY(x1) + dy),
    ],
    color,
  );
}
function section(out, slot, xs, profile, color) {
  loft(
    out,
    slot,
    xs.map((x) => profile.map(([z, dy]) => at(x, z, atlanticDeckY(x) + dy))),
    color,
  );
}
function pylon(out, x) {
  const cz = atlanticCenterZ(x);
  box(out, 'concrete', [x - 9, 0, cz - 25], [x + 9, 4, cz + 25], colors.concrete);
  for (const sign of [-1, 1])
    loft(
      out,
      'concrete',
      [
        [4, 19.5, 5.8, 5.5],
        [73, 18, 5.0, 4.5],
        [195, 4.5, 3.4, 3.2],
        [212.5, 2.1, 3.1, 2.5],
      ].map(([y, z, w, d]) => rectRing(x, y, cz + sign * z, w, d)),
      colors.concrete,
    );
  box(out, 'concrete', [x - 2.5, 71.5, cz - 18.5], [x + 2.5, 75, cz + 18.5], colors.concrete);
  box(out, 'concrete', [x - 1.55, 210, cz - 3.35], [x + 1.55, 212.5, cz + 3.35], colors.concrete);
}
function stays(out, x, level) {
  const inside = x < -75 ? 1 : -1;
  const count = level === 'skyline' ? 4 : level === 'district' ? 8 : level === 'street' ? 17 : 33;
  const sides = level === 'master' ? 24 : level === 'closeup' ? 12 : level === 'street' ? 8 : 4;
  for (const direction of [-1, 1]) {
    const run = direction === inside ? 261 : 230,
      n = direction === inside ? count : Math.max(4, Math.round((count * 230) / 261));
    for (let i = 1; i <= n; i++)
      for (const side of [-1, 1]) {
        const f = i / n,
          endX = x + direction * run * f,
          anchorY = 117 + 88 * f;
        const a = [x, anchorY, atlanticCenterZ(x) + side * (18 - ((anchorY - 73) / 139.5) * 15.9)],
          b = at(endX, side * 15, atlanticDeckY(endX) + 0.3);
        if (level === 'skyline')
          quad(
            out,
            'cable',
            [
              [a[0] - 0.7, a[1], a[2]],
              [b[0] - 0.7, b[1], b[2]],
              [b[0] + 0.7, b[1], b[2]],
              [a[0] + 0.7, a[1], a[2]],
            ],
            colors.cable,
          );
        else {
          tubePath(
            out,
            'cable',
            [a, b],
            level === 'district' ? 0.25 : level === 'street' ? 0.14 : 0.11,
            colors.cable,
            sides,
          );
          if (level === 'closeup' || level === 'master') {
            const length = Math.hypot(...a.map((v, k) => v - b[k])),
              p = b.map((v, k) => v + ((a[k] - v) * 2.4) / length);
            tubePath(out, 'metal', [b, p], 0.23, colors.metal, sides);
            const c = at(endX, side * 15, atlanticDeckY(endX) + 0.25);
            box(
              out,
              'concrete',
              [c[0] - 0.7, c[1] - 0.2, c[2] - 0.5],
              [c[0] + 0.7, c[1] + 0.55, c[2] + 0.5],
              colors.concrete,
            );
          }
        }
      }
  }
}
function pier(out, x, level) {
  const y = atlanticDeckY(x) - 2.8,
    z = atlanticCenterZ(x);
  if (level === 'skyline') {
    box(out, 'concrete', [x - 2, 0, z - 11], [x + 2, y, z + 11], colors.concrete);
    return;
  }
  box(out, 'concrete', [x - 5, 0, z - 12], [x + 5, 2.2, z + 12], colors.concrete);
  for (const side of [-1, 1]) {
    const cz = z + side * 8;
    loft(
      out,
      'concrete',
      [
        rectRing(x, 2.2, cz, 3.8, 3.4),
        rectRing(x, Math.max(3, y - 4), cz, 3.3, 3.1),
        rectRing(x, y - 0.7, cz, 4.5, 5.5),
      ],
      colors.concrete,
    );
    if (level === 'master' || level === 'closeup')
      box(out, 'metal', [x - 1.4, y - 0.7, cz - 1.2], [x + 1.4, y, cz + 1.2], colors.joint);
  }
  box(out, 'concrete', [x - 2.3, y - 1.3, z - 14], [x + 2.3, y - 0.7, z + 14], colors.concrete);
}
function lights(out, level) {
  if (!['street', 'closeup', 'master'].includes(level)) return;
  const pitch = level === 'street' ? 120 : 40,
    sides = level === 'master' ? 16 : 8;
  for (let x = -1540; x < 1550; x += pitch) {
    const y = atlanticDeckY(x),
      z = atlanticCenterZ(x);
    tubePath(
      out,
      'metal',
      [
        [x, y + 0.9, z],
        [x, y + 13, z],
      ],
      0.12,
      colors.metal,
      sides,
    );
    for (const sign of [-1, 1]) {
      const points = Array.from({ length: 6 }, (_, i) => {
        const t = i / 5;
        return [x, y + 12 + 3.2 * Math.sin((t * Math.PI) / 2), z + sign * 6 * t * t];
      });
      tubePath(out, 'metal', points, 0.1, colors.metal, sides);
      box(
        out,
        'metal',
        [x - 0.35, y + 15.05, z + sign * 6 - 1],
        [x + 0.35, y + 15.35, z + sign * 6 + 1],
        colors.metal,
      );
    }
  }
}
export function buildAtlanticLevel(output, level = 'master') {
  const out =
    level === 'skyline'
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
            k,
            (_slot, ref, ...args) => output[k]('skyline', ref, ...args),
          ]),
        )
      : output;
  const step =
    level === 'skyline'
      ? 3140 / 12
      : level === 'district'
        ? 98.125
        : level === 'street'
          ? 49.0625
          : level === 'closeup'
            ? 24.53125
            : 12.265625;
  const count = Math.round(3140 / step),
    xs = Array.from({ length: count + 1 }, (_, i) => -1570 + (3140 * i) / count);
  section(
    out,
    'concrete',
    xs,
    [
      [-16, 0],
      [16, 0],
      [16, -0.45],
      [13.5, -2.8],
      [-13.5, -2.8],
      [-16, -0.45],
    ],
    colors.concrete,
  );
  for (let i = 1; i < xs.length; i++)
    topStrip(out, 'road', xs[i - 1], xs[i], -14.6, 14.6, 0.025, colors.road);
  section(
    out,
    'concrete',
    xs,
    [
      [-0.23, 1.05],
      [0.23, 1.05],
      [0.55, 0.03],
      [-0.55, 0.03],
    ],
    colors.concrete,
  );
  for (const side of [-1, 1]) {
    const z = side * 15.2;
    section(
      out,
      'concrete',
      xs,
      [
        [z - 0.2, 1.0],
        [z + 0.2, 1.0],
        [z + 0.45, 0.03],
        [z - 0.45, 0.03],
      ],
      colors.concrete,
    );
  }
  for (const x of atlanticControls.pylons) {
    pylon(out, x);
    stays(out, x, level);
  }
  for (const [a, b] of [
    [-1495, -600],
    [450, 1495],
  ]) {
    const count = Math.ceil((b - a) / 125);
    for (let i = 0; i <= count; i++) pier(out, a + ((b - a) * i) / count, level);
  }
  for (const x of [-1570, 1570]) {
    const z = atlanticCenterZ(x),
      y = atlanticDeckY(x);
    box(
      out,
      'concrete',
      [x - 5, Math.max(0, y - 8), z - 18],
      [x + 5, y - 2.8, z + 18],
      colors.concrete,
    );
  }
  if (['street', 'closeup', 'master'].includes(level)) {
    for (let x = -1560; x < 1560; x += 12)
      for (const z of [-7.5, 7.5])
        topStrip(out, 'paint', x, x + 4, z - 0.075, z + 0.075, 0.04, colors.paint);
    for (let i = 1; i < xs.length; i++)
      for (const z of [-13.2, -1.4, 1.4, 13.2])
        topStrip(out, 'paint', xs[i - 1], xs[i], z - 0.075, z + 0.075, 0.045, colors.paint);
  }
  if (level === 'closeup' || level === 'master') {
    for (let x = -596; x <= 450; x += 8) {
      const p = at(x, 0, atlanticDeckY(x) - 2.8);
      beam(
        out,
        'concrete',
        [p[0], p[1], p[2] - 13.5],
        [p[0], p[1], p[2] + 13.5],
        0.24,
        0.4,
        colors.concrete,
      );
    }
    for (const x of [-600, -475, 450, 575, 700, 825, 950, 1075, 1200, 1325, 1450])
      topStrip(out, 'road', x - 0.06, x + 0.06, -14.5, 14.5, 0.055, colors.joint);
  }
  lights(out, level);
}
export const buildAtlanticSkyline = (out) => buildAtlanticLevel(out, 'skyline');
export const buildAtlanticDistrict = (out) => buildAtlanticLevel(out, 'district');
export const buildAtlanticStreet = (out) => buildAtlanticLevel(out, 'street');
export const buildAtlanticCloseup = (out) => buildAtlanticLevel(out, 'closeup');
