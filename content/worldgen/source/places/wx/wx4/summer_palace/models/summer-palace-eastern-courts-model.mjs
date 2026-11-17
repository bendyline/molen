import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { guardian } from './summer-palace-entrance-model.mjs';
import {
  courtRoof,
  surfaces as courtSurfaces,
  dark,
  face,
  frame,
  gold,
  indigo,
  levels,
  marble,
  red,
  roofs,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['wenchang-gallery', 'yelu-shrine']);
export const surfaces = {
  ...courtSurfaces,
  brick: { slot: 'wall', graph: 'brick_stack' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.58, metallic: 0.65 },
};
const brick = [0.375, 0.39, 0.37];
const paving = [0.56, 0.535, 0.48];
const glazedGreen = [0.125, 0.254, 0.184];

function deck(out, strips, detail) {
  if (detail === 0) return;
  for (const strip of strips)
    for (let j = 1; j < strip.length; j++) {
      const [[a, b], [c, d]] = strip.slice(j - 1, j + 1);
      face(out, 'stone', [a, b, d], paving, up);
      face(out, 'stone', [a, d, c], paving, up);
    }
}

function panel(out, x, z, w, h, detail, tint = glazedGreen) {
  box(out, 'timber', [x - w / 2, 0.24, z - 0.08], [x + w / 2, h, z + 0.08], red);
  if (detail < 2) return;
  const v = z + 0.097;
  box(out, 'timber', [x - w * 0.432, 0.91, v - 0.02], [x + w * 0.432, h - 0.13, v + 0.01], tint);
  const n = detail >= 3 ? 8 : 3;
  for (let i = 1; i < n; i++) {
    const u = x + w * 0.868 * (i / n - 0.5);
    beam(out, 'timber', [u, 0.93, v + 0.035], [u, h - 0.15, v + 0.035], 0.045, 0.048, red);
  }
  for (let i = 1; i < n - 1; i++) {
    const y = 0.93 + ((h - 1.08) * i) / (n - 1);
    beam(
      out,
      'timber',
      [x - w * 0.43, y, v + 0.044],
      [x + w * 0.43, y, v + 0.044],
      0.039,
      0.06,
      red,
    );
  }
}

function cornice(out, w, d, h, bays, detail, decorated) {
  const half = w * 0.425;
  const step = (2 * half) / bays;
  for (const sign of [-1, 1]) {
    const z = sign * d * 0.39;
    beam(out, 'timber', [-half - 0.04, h, z], [half + 0.04, h, z], 0.28, 0.43, indigo);
    if (detail === 0 && !decorated) continue;
    for (let i = 0; i <= bays; i++) {
      const x = -half + step * i;
      if (detail === 0 && i > 0 && i < bays && i % 2) continue;
      beam(out, 'timber', [x, 0, z], [x, h, z], 0.29, 0.31, red);
      if (detail < 2) continue;
      box(out, 'marble', [x - 0.2, 0, z - 0.2], [x + 0.2, 0.18, z + 0.2], marble);
      beam(out, 'timber', [x, h - 0.13, z - 0.21], [x, h - 0.13, z + 0.21], 0.39, 0.22, turquoise);
      if (decorated)
        beam(out, 'timber', [x, h + 0.081, z - 0.29], [x, h + 0.081, z + 0.29], 0.46, 0.17, red);
    }
    if (detail < 2 || !decorated) continue;
    for (let i = 0; i < bays; i++) {
      const x = -half + (i + 0.5) * step,
        edge = z + sign * 0.163;
      face(
        out,
        'timber',
        [
          [x - step * 0.34, h - 0.15, edge],
          [x + step * 0.34, h - 0.15, edge],
          [x + step * 0.28, h + 0.13, edge],
          [x - step * 0.28, h + 0.13, edge],
        ],
        turquoise,
        [0, 0, sign],
      );
      const front = edge + sign * 0.015;
      for (const u of [x - step * 0.17, x, x + step * 0.17])
        face(
          out,
          'enamel',
          [
            [u - 0.13, h - 0.01, front],
            [u, h - 0.11, front],
            [u + 0.13, h - 0.01, front],
            [u, h + 0.084, front],
          ],
          gold,
          [0, 0, sign],
        );
    }
  }
}

function plaque(out, width, y, z) {
  box(out, 'enamel', [-width / 2, y - 0.23, z - 0.06], [width / 2, y + 0.23, z + 0.06], gold);
  box(
    out,
    'timber',
    [-width / 2 + 0.052, y - 0.18, z + 0.055],
    [width / 2 - 0.052, y + 0.18, z + 0.081],
    dark,
  );
}

function stairs(out, width, edge, height, run, detail) {
  if (height <= 0.075) return;
  const n = detail === 0 ? 1 : Math.max(2, Math.round(height / 0.158));
  for (let i = 0; i < n; i++) {
    const start = edge + (run * i) / n,
      end = edge + (run * (i + 1)) / n;
    box(
      out,
      'stone',
      [-width / 2, -height - 0.37, start],
      [width / 2, (-height * i) / n, end],
      paving,
    );
  }
}

function plainTileRoof(out, w, d, y, rise) {
  const half = w / 2;
  const run = d / 2;
  for (const sign of [-1, 1]) {
    face(
      out,
      'tile',
      [
        [-half, y, sign * run],
        [half, y, sign * run],
        [half, y + rise, 0],
        [-half, y + rise, 0],
      ],
      roofs.grey,
      up,
    );
    face(
      out,
      'brick',
      [
        [sign * half, y, -run],
        [sign * half, y, run],
        [sign * half, y + rise, 0],
      ],
      brick,
      [sign, 0, 0],
    );
  }
}

function hall(out, site, detail) {
  const { center, width: w, depth: d, angle } = site.frame;
  const h = site.eave;
  const tall = site.role === 'display-hall' || site.role === 'memorial';
  const main = site.role === 'display-hall';
  const bays = site.bays;
  const toe = site.toe - site.grade - site.plinth;
  const floor = site.grade + site.plinth;
  const body = frame(out, center, floor, angle);
  solid(out, 'stone', site.outline, site.toe, floor, paving);
  if (main) {
    const inset = d * 0.09;
    const rear = frame(body, [0, -inset], 0, 0);
    const r = d * 0.82;
    box(rear, 'brick', [-w * 0.43, 0, -r * 0.46], [w * 0.43, h, r * 0.35], brick);
    if (detail === 0) plainTileRoof(rear, w * 1.02, r * 1.12, h, 2.88);
    else {
      cornice(rear, w, r, h, bays, detail, true);
      courtRoof(rear, w * 1.02, r * 1.12, h + 0.25, 2.88, roofs.grey, detail, true, 0.47);
    }
    const porch = frame(body, [0, d * 0.35], 0, 0),
      pw = w * 0.6,
      pd = d * 0.36;
    cornice(porch, pw, pd, h * 0.83, 3, detail, true);
    courtRoof(porch, pw * 1.08, pd * 1.24, h * 0.83 + 0.25, 1.53, roofs.grey, detail, true, 0.27);
    if (detail >= 2) plaque(porch, 1.9, h * 0.83 - 0.36, pd * 0.4);
  } else {
    box(body, 'plaster', [-w * 0.425, 0, -d * 0.41], [w * 0.425, h, d * 0.12], red);
    for (const sign of [-1, 1]) {
      const x = sign * w * 0.409;
      box(body, 'brick', [x - 0.16, 0, -d * 0.1], [x + 0.16, h, d * 0.37], brick);
    }
    if (detail >= 1 || tall) cornice(body, w, d, h, bays, detail, tall);
    if (detail < 2 && !tall) plainTileRoof(body, w, d, h, site.rise);
    else
      courtRoof(
        body,
        w * 1.04,
        d * 1.065,
        h + 0.24,
        site.rise,
        roofs.grey,
        detail,
        tall,
        Math.min(0.42, site.rise * 0.185),
      );
    if (detail >= 1)
      for (let i = 0; i < bays; i++)
        panel(
          body,
          0.85 * w * ((i + 0.5) / bays - 0.5),
          d * 0.271,
          (0.78 * w) / bays,
          h - 0.35,
          detail,
        );
    if (tall && detail >= 1) plaque(body, 1.73, h - 0.28, d * 0.437);
  }
  const steps = site.steps;
  if (steps) stairs(body, steps.width, d * 0.5, Math.min(-toe, steps.height), steps.run, detail);
}

function wing(out, { center, width: w, depth: d, angle, grade, toe }, detail) {
  const body = frame(out, center, grade, angle);
  const h = 3.4;
  const z = -d * 0.2,
    thickness = 0.42,
    half = w * 0.5;
  box(body, 'brick', [-half, 0, z - thickness], [half, h, z + thickness], brick);
  box(body, 'stone', [-half, toe - grade, -d * 0.5], [half, 0, d * 0.5], paving);
  const bays = Math.max(2, Math.round(w / (detail < 2 ? 8.5 : detail === 2 ? 5.1 : 3.9)));
  if (detail === 0) {
    plainTileRoof(body, w, d, h, 2.19);
  } else {
    const zin = d * 0.376;
    const halfWall = half - 0.16;
    beam(body, 'timber', [-halfWall, h - 0.12, zin], [halfWall, h - 0.12, zin], 0.27, 0.34, indigo);
    for (let i = 0; i <= bays; i++) {
      const x = w * (i / bays - 0.5);
      beam(body, 'timber', [x, 0, zin], [x, h - 0.08, zin], 0.25, 0.28, red);
      if (detail >= 3) {
        box(body, 'marble', [x - 0.16, 0, zin - 0.16], [x + 0.16, 0.17, zin + 0.16], marble);
        beam(
          body,
          'timber',
          [x, h - 0.13, zin - 0.27],
          [x, h - 0.13, zin + 0.27],
          0.44,
          0.17,
          turquoise,
        );
      }
    }
    courtRoof(body, w * 1.01, d * 1.095, h + 0.16, 2.14, roofs.grey, detail, true, 0.38);
  }
}

function standGate(out, gate, detail) {
  const { center, width: w, depth: d, height: h, angle, grade, toe, closed } = gate;
  const body = frame(out, center, grade, angle);
  const bays = 3;
  const step = (w * 0.85) / bays;
  box(body, 'stone', [-w * 0.5, toe - grade, -d * 0.5], [w * 0.5, 0, d * 0.5], paving);
  cornice(body, w, d, h, bays, detail, true);
  for (const sign of [-1, 1]) {
    const x = sign * step;
    box(body, 'brick', [x - step * 0.48, 0, d * 0.19], [x + step * 0.48, 0.88, d * 0.4], brick);
    panel(body, x, d * 0.3, step * 0.97, h - 0.43, detail);
  }
  if (closed)
    for (const side of [-1, 1]) {
      const x = side * step * 0.234;
      box(
        body,
        'timber',
        [x - step * 0.23, 0, d * 0.31],
        [x + step * 0.23, h - 0.28, d * 0.42],
        red,
      );
      if (detail >= 2)
        beam(
          body,
          'enamel',
          [x - side * step * 0.14, 1.05, d * 0.429],
          [x - side * step * 0.14, 1.24, d * 0.429],
          0.12,
          0.08,
          gold,
        );
    }
  if (closed) {
    const z = d * 0.461;
    box(body, 'timber', [-0.268, h - 0.72, z - 0.035], [0.268, h + 0.205, z + 0.08], red);
    box(body, 'enamel', [-0.203, h - 0.65, z + 0.073], [0.203, h + 0.13, z + 0.09], gold);
    box(body, 'timber', [-0.165, h - 0.614, z + 0.089], [0.165, h + 0.094, z + 0.11], indigo);
    if (detail >= 2)
      for (const x of [-0.48, -0.22, 0.22, 0.48]) {
        const z = d * 0.424;
        beam(body, 'enamel', [x, h - 0.7, z], [x, h - 0.7, z + 0.085], 0.088, 0.093, gold);
      }
  } else plaque(body, Math.min(2.5, step * 0.85), h - 0.2, d * 0.455);
  courtRoof(
    body,
    w * 1.1,
    d * 1.11,
    h + 0.25,
    gate.rise,
    roofs.grey,
    detail,
    true,
    gate.rise * 0.186,
  );
  stairs(body, step * 1.14, d * 0.5, gate.steps, gate.run, detail);
}

function precinctWall(out, { points, y, toe, height }, detail) {
  for (let i = 1; i < points.length; i++) {
    const [x, z] = points[i - 1],
      [u, v] = points[i];
    const w = Math.hypot(u - x, v - z);
    const body = frame(out, [(x + u) / 2, (z + v) / 2], y, Math.atan2(v - z, u - x));
    box(body, 'brick', [-w / 2, toe - y, -0.31], [w / 2, height, 0.31], brick);
    if (detail === 0) continue;
    const ridge = height + 0.42;
    for (const sign of [-1, 1])
      face(
        body,
        'tile',
        [
          [-w / 2 - 0.03, height, sign * 0.41],
          [w / 2 + 0.03, height, sign * 0.41],
          [w / 2 + 0.03, ridge, 0],
          [-w / 2 - 0.03, ridge, 0],
        ],
        roofs.grey,
        up,
      );
    if (detail >= 2)
      beam(
        body,
        'tile',
        [-w / 2 - 0.03, ridge, 0],
        [w / 2 + 0.03, ridge, 0],
        0.11,
        0.12,
        roofs.grey,
      );
  }
}

function memorialStone(out, { center, grade, angle }, detail) {
  const body = frame(out, center, grade, angle);
  box(body, 'marble', [-0.63, -0.16, -0.53], [0.63, 0.19, 0.53], marble);
  const n = detail >= 3 ? 12 : 6;
  loft(
    body,
    'marble',
    [
      [0.19, 0.32, 0.25],
      [0.48, 0.29, 0.22],
      [0.61, 0.23, 0.19],
      [1.08, 0.25, 0.18],
      [1.21, 0.17, 0.13],
    ].map(([y, rx, rz]) => radialRing(y, rx, rz, n)),
    marble,
  );
  sphere(body, 'marble', [0, 1.37, 0], [0.14, 0.205, 0.14], marble, n, detail >= 3 ? 6 : 4);
  if (detail < 2) return;
  box(body, 'marble', [-0.2, 1.47, -0.145], [0.2, 1.56, 0.14], marble);
  for (const x of [-0.18, 0.18])
    beam(body, 'marble', [x, 0.68, 0.193], [x * 0.32, 1.08, 0.213], 0.121, 0.107, marble);
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level],
    court = layout.eastCourts;
  deck(out, court.paving, detail);
  for (const site of layout.sites) if (site.role !== 'gallery-ring') hall(out, site, detail);
  for (const range of court.wings) wing(out, range, detail);
  standGate(out, court.gate, detail);
  for (const wall of court.walls) precinctWall(out, wall, detail);
  if (detail >= 1) for (const lion of court.lions) guardian(out, lion, detail === 1 ? 0 : detail);
  if (court.stele && detail > 0) memorialStone(out, court.stele, detail);
}
