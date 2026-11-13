/** Millennium of Russia at Novgorod Kremlin, with authored sculpture and four exterior levels. */
import { readFileSync } from 'node:fs';
import {
  beam,
  sphere,
  torus,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  profile,
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { color, face, figure, localFrame, radial, trefoilCross } from './bronze-figures.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite' },
  gravel: { slot: 'foundation', graph: 'gravel' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.66, metallic: 0.31 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.25 },
  lantern: { slot: 'window', localRef: 'palette:#c0b28a', roughness: 0.58 },
};
const TAU = Math.PI * 2,
  up = [0, 1, 0],
  lod = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const tiers = [12, 20, 30, 48, 96];
const H = (y) => layout.deck + y;
const mix = (a, b, t) => a + (b - a) * t;
const circle = (count, fn) => Array.from({ length: count }, (_, i) => fn((i * TAU) / count, i));
const lathe = (out, rows, sides, center) =>
  profile(
    out,
    rows.map(([y, r, slot, tint]) => [y, r, r, slot, color[tint]]),
    sides,
    center,
  );

function plinth(out, d) {
  const rows = [
    [-0.28, 4.46, 'granite', 'stone'],
    [0.13, 4.5, 'granite', 'stone'],
    [1.12, 4.49, 'granite', 'stone'],
    [1.29, 4.35, 'granite', 'paving'],
    [1.4, 4.23, 'granite', 'stone'],
    [1.54, 4.17, 'granite', 'paving'],
    [1.61, 4.09, 'bronze', 'dark'],
    [3.16, 4.12, 'bronze', 'dark'],
    [3.25, 4.42, 'bronze', 'shade'],
    [3.38, 4.53, 'granite', 'stone'],
    [3.59, 4.52, 'granite', 'stone'],
    [3.72, 4.3, 'granite', 'stone'],
    [3.99, 4.1, 'granite', 'stone'],
    [4.11, 3.89, 'bronze', 'patina'],
    [4.31, 3.6, 'bronze', 'patina'],
    [4.6, 3.36, 'bronze', 'shade'],
    [4.88, 3.2, 'bronze', 'patina'],
    [5.14, 3.15, 'bronze', 'cast'],
    [5.25, 3.25, 'bronze', 'patina'],
    [5.36, 3.35, 'bronze', 'shade'],
    [5.5, 3.33, 'bronze', 'cast'],
    [layout.upperStage, 3.25, 'bronze', 'cast'],
  ];
  const selected =
    d === 0
      ? rows.filter((_, i) => [0, 2, 5, 7, 9, 12, 15, 17, 19, 21].includes(i))
      : d === 1
        ? rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1)
        : rows;
  lathe(
    out,
    selected.map(([y, r, ...v]) => [H(y), r, ...v]),
    tiers[d],
  );
  if (d < 2) return;
  const n = [0, 0, 22, 50, 96][d];
  circle(n, (a, i) => {
    const tint = i % 5 === 0 ? 'edge' : 'patina';
    const stations = [
      [4.12, 3.89],
      [4.3, 3.63],
      [4.59, 3.39],
      [4.87, 3.23],
      [5.15, 3.18],
    ];
    tubePath(
      out,
      'bronze',
      stations.map(([y, r], j) => radial(a + 0.032 * Math.sin((Math.PI * j) / 4), r + 0.013, H(y))),
      0.034,
      color[tint],
      d === 4 ? 6 : 4,
    );
  });
  if (d > 1)
    circle(d > 2 ? 96 : 48, (a, i) => {
      const P = (da, y, r) => radial(a + da, r, H(y));
      const leaf = [
        P(-0.022, 5.3, 3.327),
        P(0.012, 5.34, 3.362),
        P(0.047, 5.41, 3.335),
        P(-0.009, 5.38, 3.364),
      ];
      face(out, 'bronze', i % 3 === 0 ? 'edge' : 'patina', leaf, radial(a, 1, 0));
    });
}
function frieze(out, d) {
  const total = layout.reliefCounts.reduce((a, b) => a + b, 0);
  let next = 0;
  for (const [group, count] of layout.reliefCounts.entries()) {
    for (let i = 0; i < count; i++) {
      const j = next++,
        a = (TAU * (j + 0.5)) / total + 0.02;
      const seated = i % 6 === 3 || i % 13 === 6;
      const h = (seated ? 1.02 : 1.41) + 0.1 * Math.sin(j * 1.17) + 0.047 * Math.cos(j * 3.67);
      const y = H(1.6 + (i % 4 === 1 ? 0.05 : 0)),
        r = 4.105 + (i % 3 === 1 ? 0.041 : 0);
      if (d < 2) {
        if (j % (d === 0 ? 5 : 2)) continue;
        const p = localFrame(radial(a, r, y), a);
        const outline =
          d === 0
            ? [
                [-0.15, 0.1, 0],
                [0.15, 0.1, 0],
                [0.12, h, 0],
                [-0.1, h, 0],
              ]
            : [
                [-0.14, 0, 0],
                [0.13, 0, 0],
                [0.12, h * 0.69, 0],
                [0.065, h * 0.76, 0],
                [0.06, h * 0.92, 0],
                [0.02, h, 0],
                [-0.065, h * 0.94, 0],
                [-0.07, h * 0.76, 0],
                [-0.13, h * 0.68, 0],
              ];
        for (let k = 1; k + 1 < outline.length; k++)
          face(
            out,
            'bronze',
            j % 4 ? 'patina' : 'cast',
            [p(outline[0]), p(outline[k]), p(outline[k + 1])],
            radial(a, 1, 0),
          );
        continue;
      }
      if (d === 2 && j % 3 === 1) continue;
      const clothing = ['robe', 'cloak', 'mail', 'coat'][group];
      const head =
        group === 2 && i % 2 === 0 ? 'helmet' : i % 7 === 2 ? 'cap' : i % 8 === 0 ? 'hood' : 'bare';
      const gesture = ['offer', 'guard', 'rest', 'prayer', 'point', 'sceptre'][(i + group * 2) % 6];
      figure(
        out,
        radial(a, r, y),
        a + 0.19 * Math.sin(i * 2.3),
        {
          h,
          garment: clothing,
          head,
          gesture,
          pose: seated ? 'kneel' : i % 4 === 2 ? 'stride' : 'stand',
        },
        d,
        { relief: true, depth: 0.38 },
      );
    }
  }
}

function orb(out, d) {
  const o = layout.orb;
  const center = [0, H(o.y), 0],
    segments = tiers[d];
  const core =
    d === 0
      ? [
          [5.61, 2.12],
          [8.17, 1.38],
        ]
      : [
          [5.61, 2.22],
          [6.02, 2.02],
          [7.12, 1.59],
          [8.17, 1.38],
        ];
  lathe(
    out,
    core.map(([y, r]) => [H(y), r, 'bronze', 'shade']),
    Math.min(22, segments),
  );
  sphere(out, 'bronze', center, [o.rx, o.ry, o.rx], color.patina, segments, [5, 9, 15, 22, 36][d]);
  const point = (a, t, offset = 0.008) =>
    radial(a, (o.rx + offset) * Math.cos(t), H(o.y) + (o.ry + offset) * Math.sin(t));
  for (const t of d === 0 ? [] : d === 1 ? [0] : [-0.076, 0.076]) {
    const r = o.rx * Math.cos(t);
    torus(
      out,
      'bronze',
      [0, H(o.y + o.ry * Math.sin(t)), 0],
      r + 0.016,
      0.024,
      color.edge,
      d === 3 ? 36 : segments,
      d === 4 ? 7 : 5,
    );
  }
  if (d < 2) return;
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const meridian = Array.from({ length: 20 }, (_, i) => point(a, -1.06 + (2.44 * i) / 19, 0.024));
    tubePath(out, 'bronze', meridian, 0.035, color.edge, 5);
  }
  const marks = [0, 0, 23, 43, 88][d];
  circle(marks, (a, i) => {
    const A = point(a, -0.052, 0.036),
      B = point(a, 0.05, 0.036);
    tube(out, 'bronze', A, B, i % 4 === 0 ? 0.023 : 0.015, color.edge, 4);
    if (d > 1 && i % 3 !== 1)
      tube(
        out,
        'bronze',
        point(a - 0.017, 0.008, 0.037),
        point(a + 0.025, 0.008, 0.037),
        0.012,
        color.edge,
        4,
      );
  });
  if (d > 2)
    for (const lat of [-0.57, -0.28, 0.3, 0.6, 0.93]) {
      const count = Math.max(8, Math.round((d === 4 ? 29 : 12) * Math.cos(lat)));
      circle(count, (a, i) => {
        const da = (TAU / count) * 0.38,
          t = 0.086;
        const knots = [
          [a - da, lat],
          [a - da * 0.48, lat + t * 0.63],
          [a, lat + t],
          [a + da * 0.55, lat + t * 0.57],
          [a + da, lat],
          [a, lat - t],
        ];
        tubePath(
          out,
          'bronze',
          knots.map(([x, y]) => point(x, y, 0.029)),
          0.014,
          i % 4 === 0 ? color.edge : color.seam,
          4,
          true,
        );
      });
    }
}

function statuary(out, d) {
  const figureDetail = d === 2 ? 1 : d === 3 ? 2 : d;
  for (const group of layout.groups)
    for (const f of group.people) {
      if (d < 2 && f !== group.people[0]) continue;
      const point = localFrame([0, H(layout.upperStage) - 0.025, 0], group.angle)([f.x, 0, f.z]);
      const yaw = group.angle + (f.pose === 'recline' ? 0.31 : f.pose === 'kneel' ? -0.24 : 0);
      figure(out, point, yaw, f, figureDetail);
    }
  const angel = {
    h: 3.09,
    garment: 'robe',
    head: 'laurel',
    pose: 'stand',
    gesture: 'bless',
    object: 'wings',
  };
  const woman = {
    h: 2.11,
    garment: 'robe',
    head: 'hood',
    pose: 'kneel',
    gesture: 'offer',
    object: 'round shield',
  };
  figure(out, [0.24, H(11.33), -0.09], -0.24, angel, figureDetail);
  figure(out, [-1.07, H(10.81), 0.25], 0.86, woman, figureDetail);
  trefoilCross(out, [0.1, H(11.29), 0.42], -0.11, layout.height - 11.29, d);
}

function site(out, d) {
  const { points, radius = layout.plazaRadius, fenceRadius, fenceBays } = layout;
  const sample = (a) => {
    const t = ((((a / TAU) % 1) + 1) % 1) * points.length,
      i = Math.floor(t) % points.length;
    return mix(points[i], points[(i + 1) % points.length], t - Math.floor(t));
  };
  const floor = (a, r) => layout.deck + (sample(a) * r) / radius;
  const P = (a, r, y = 0) => radial(a, r, floor(a, r) + y);
  const N = [12, 24, 48, 72, 120][d];
  circle(N, (a) => {
    const b = a + TAU / N;
    face(out, 'granite', 'paving', [[0, layout.deck, 0], P(a, 5.55), P(b, 5.55)], up);
    face(out, 'gravel', 'gravel', [P(a, 5.55), P(a, radius), P(b, radius), P(b, 5.55)], up);
    face(
      out,
      'granite',
      'stone',
      [P(a, radius), P(a, radius, -0.28), P(b, radius, -0.28), P(b, radius)],
      radial((a + b) / 2, 1, 0),
    );
  });
  if (d > 1)
    for (const a of [0, Math.PI]) {
      const path = (r, x) => P(a + Math.atan2(x, r), Math.hypot(x, r), 0.016);
      for (let i = 0; i < 5; i++) {
        const r = mix(5.42, 14.26, i / 5),
          s = mix(5.42, 14.26, (i + 1) / 5);
        face(
          out,
          'granite',
          'paving',
          [path(r, -0.48), path(r, 0.48), path(s, 0.48), path(s, -0.48)],
          up,
        );
      }
    }
  const R = fenceRadius,
    post = (a, y) => P(a, R, y);
  if (d === 0) {
    circle(12, (a) => {
      const b = a + TAU / 12;
      face(
        out,
        'iron',
        'iron',
        [post(a, 0.91), post(b, 0.91), post(b, 1.07), post(a, 1.07)],
        radial(a, 1, 0),
      );
    });
    return;
  }
  const rails = d < 3 ? [0.2, 1.08] : [0.1, 0.34, 0.83, 1.08];
  for (const y of rails)
    tubePath(
      out,
      'iron',
      circle(d === 1 ? 20 : fenceBays, (a) => post(a, y)),
      y > 1 ? 0.043 : 0.032,
      color.iron,
      d > 2 ? 6 : 4,
      true,
    );
  circle(d < 3 ? fenceBays / 2 : fenceBays, (a) => {
    const [x, y, z] = post(a, 0);
    if (d < 3) {
      beam(out, 'iron', [x, y, z], [x, y + 1.13, z], 0.1, 0.1, color.iron);
      return;
    }
    const vertical = [
      [y - 0.055, 0.095],
      [y + 0.07, 0.105],
      [y + 0.13, 0.073],
      [y + 0.99, 0.062],
      [y + 1.105, 0.083],
    ];
    lathe(
      out,
      vertical.map(([h, r]) => [h, r, 'iron', 'iron']),
      d === 4 ? 6 : 4,
      [x, z],
    );
    sphere(
      out,
      'iron',
      [x, y + 1.15, z],
      [0.075, 0.077, 0.075],
      color.iron,
      d === 4 ? 6 : 4,
      d === 4 ? 5 : 3,
    );
  });
  const pickets = [0, 0, 1, 4, 6][d];
  if (pickets)
    circle(fenceBays, (a) => {
      const step = TAU / fenceBays / (pickets + 1);
      for (let i = 1; i <= pickets; i++) {
        const t = a + i * step;
        tube(out, 'iron', post(t, 0.17), post(t, 1.06), d > 2 ? 0.019 : 0.026, color.iron, 4);
        if (d < 3 || (d === 3 && i % 2 === 0)) continue;
        for (const y of [0.24, 0.95]) {
          const x = 0.107 / R,
            w = 0.086;
          const count = d === 3 ? 6 : 8;
          const shape = Array.from({ length: count }, (_, j) =>
            post(t + x * Math.cos((j * TAU) / count), y + w * Math.sin((j * TAU) / count)),
          );
          tubePath(out, 'iron', shape, 0.013, color.iron, d === 3 ? 3 : 4, true);
        }
      }
    });
  for (const a of layout.lampAngles) {
    const [x, y, z] = P(a, 15.32, -0.14);
    if (d === 1) {
      beam(out, 'iron', [x, y, z], [x, y + 3.43, z], 0.1, 0.1, color.iron);
      beam(out, 'lantern', [x, y + 3.23, z], [x, y + 3.57, z], 0.24, 0.24, color.glass);
      continue;
    }
    const rows =
      d === 2
        ? [
            [0, 0.185],
            [0.24, 0.108],
            [0.58, 0.053],
            [3.21, 0.065],
          ]
        : [
            [0, 0.185],
            [0.12, 0.18],
            [0.19, 0.125],
            [0.44, 0.081],
            [0.58, 0.053],
            [2.71, 0.043],
            [3.02, 0.073],
            [3.21, 0.088],
          ];
    lathe(
      out,
      rows.map(([h, r]) => [y + h, r, 'iron', 'iron']),
      d > 1 ? 10 : 6,
      [x, z],
    );
    lathe(
      out,
      [
        [3.18, 0.09, 'iron', 'iron'],
        [3.28, 0.118, 'iron', 'iron'],
        [3.3, 0.115, 'lantern', 'glass'],
        [3.57, 0.169, 'lantern', 'glass'],
        [3.6, 0.175, 'iron', 'iron'],
        [3.75, 0.083, 'iron', 'iron'],
        [3.83, 0.032, 'iron', 'iron'],
      ].map(([h, r, ...v]) => [y + h, r, ...v]),
      6,
      [x, z],
    );
    if (d > 1)
      circle(6, (b) => {
        const p = (r, h) => [x + r * Math.cos(b), y + h, z + r * Math.sin(b)];
        tube(out, 'iron', p(0.118, 3.29), p(0.17, 3.59), 0.012, color.iron, 4);
      });
  }
}
export function buildMonument(out, level = 'master') {
  const detail = lod[level];
  if (detail === undefined) throw Error('Unknown monument level ' + level);
  site(out, detail);
  plinth(out, detail);
  frieze(out, detail);
  orb(out, detail);
  statuary(out, detail);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');
