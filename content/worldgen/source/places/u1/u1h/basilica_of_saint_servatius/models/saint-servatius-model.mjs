/** Present twin-spire basilica and its open court in Maastricht. All coordinates are in metres. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.9, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    limestone: 'cdbfa4',
    choir: 'b9ac92',
    light: 'dbccaa',
    stone: '8f8f80',
    ledge: 'a8997b',
    bronze: '63524a',
    slate: '4c5564',
    darkSlate: '39434f',
    glass: '313b45',
    dark: '272c32',
    tracery: 'bfb294',
    mortar: '736856',
    court: '7a8959',
  }).map(([name, color]) => [name, rgb(color)]),
);
const base = -2.85;
const lerp = (a, b, t) => a + (b - a) * t;

function wall(out, y0, y1, x0, x1, z0, z1, color = c.limestone, surface = 'limestone') {
  box(out, surface, [x0, y0, z0], [x1, y1, z1], color);
}

function moulding(out, x0, x1, z0, z1, y, extension = 0.22, thickness = 0.27) {
  wall(
    out,
    y,
    y + thickness,
    x0 - extension,
    x1 + extension,
    z0 - extension,
    z1 + extension,
    c.ledge,
    'trim',
  );
}

function gable(
  out,
  x0,
  x1,
  z0,
  z1,
  eave,
  rise,
  ridgeAlongX = true,
  color = c.slate,
  masonry = c.limestone,
) {
  if (!ridgeAlongX) {
    gable(transform(out, -Math.PI / 2), z0, z1, -x1, -x0, eave, rise, true, color, masonry);
    return;
  }
  const middle = (z0 + z1) / 2;
  const a = [x0, eave, z0],
    b = [x1, eave, z0],
    d = [x1, eave, z1],
    e = [x0, eave, z1];
  const r = [x0, eave + rise, middle],
    s = [x1, eave + rise, middle];
  face(out, 'slate', [a, r, s, b], color);
  face(out, 'slate', [r, e, d, s], color);
  triangle(out, 'limestone', [a, e, r], masonry);
  triangle(out, 'limestone', [b, s, d], masonry);
}

function roofCap(out, x, z, y, half, height, topHalf = 0) {
  const ring = (yy, width) => [
    [x - width, yy, z - width],
    [x - width, yy, z + width],
    [x + width, yy, z + width],
    [x + width, yy, z - width],
  ];
  const low = ring(y, half);
  const high = ring(y + height, topHalf);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (topHalf)
      face(out, 'slate', [low[i], low[j], high[j], high[i]], i === 0 ? c.darkSlate : c.slate);
    else
      triangle(out, 'slate', [low[i], low[j], [x, y + height, z]], i === 0 ? c.darkSlate : c.slate);
  }
}

function faceAt(out, a, b) {
  return transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);
}

function archHeight(u, pointed) {
  const x = Math.abs(u);
  return pointed ? Math.sqrt(4 - Math.pow(1 + x, 2)) / Math.sqrt(3) : Math.sqrt(1 - x * x);
}

function arch(out, x, bottom, width, spring, rise, lod, options = {}) {
  const {
    pointed = false,
    inset = c.glass,
    surround = c.tracery,
    bands = 1,
    mullions = 0,
  } = options;
  const steps = lod >= 3 ? 12 : lod === 2 ? 6 : 4;
  const w = width / 2;
  const p = (i, extension = 0, z = 0.025) => {
    const u = Math.cos((Math.PI * i) / steps);
    return [x + u * (w + extension), spring + archHeight(u, pointed) * (rise + extension), z];
  };
  if (inset) {
    face(
      out,
      'pane',
      [
        [x - w, bottom, 0.022],
        [x + w, bottom, 0.022],
        [x + w, spring, 0.022],
        [x - w, spring, 0.022],
      ],
      inset,
    );
    for (let i = 0; i < steps; i++)
      triangle(out, 'pane', [[x, spring, 0.025], p(i), p(i + 1)], inset);
  }
  if (lod === 0 || (lod === 1 && width < 4)) return;
  const depth = lod >= 2 ? 0.11 : 0.065;
  const border = width > 3 ? 0.25 : 0.12;
  for (let j = 0; j < bands; j++) {
    const inner = j * border,
      outer = (j + 1) * border,
      z = depth * (j + 1);
    const stone = j % 2 === 0 ? surround : c.ledge;
    for (let i = 0; i < steps; i++) {
      face(
        out,
        'trim',
        [p(i, inner, z), p(i, outer, z + depth), p(i + 1, outer, z + depth), p(i + 1, inner, z)],
        stone,
      );
    }
    for (const sign of [-1, 1]) {
      const jamb = [x + sign * (w + inner), x + sign * (w + outer)].sort((a, b) => a - b);
      const a = jamb[0],
        b = jamb[1],
        front = z + depth;
      face(
        out,
        'trim',
        [
          [a, bottom, front],
          [b, bottom, front],
          [b, spring, front],
          [a, spring, front],
        ],
        stone,
      );
      if (lod === 3) {
        const x = sign === 1 ? a : b;
        const edge = [
          [x, bottom, z],
          [x, bottom, front],
          [x, spring, front],
          [x, spring, z],
        ];
        face(out, 'trim', sign === 1 ? edge : edge.toReversed(), stone);
      }
    }
  }
  if (inset && lod >= 2) {
    wall(
      out,
      bottom - 0.15,
      bottom - 0.025,
      x - w - 0.15,
      x + w + 0.15,
      0.004,
      0.25,
      c.ledge,
      'trim',
    );
    const verticals = lod === 2 ? Math.min(1, mullions) : mullions;
    for (let i = 1; i <= verticals; i++) {
      const u = -1 + (2 * i) / (verticals + 1);
      const xx = x + u * w;
      wall(
        out,
        bottom,
        spring + 0.78 * rise * archHeight(u, pointed),
        xx - 0.056,
        xx + 0.056,
        0.036,
        0.18,
        surround,
        'trim',
      );
    }
    if (mullions > 1) {
      wall(
        out,
        lerp(bottom, spring, 0.66),
        lerp(bottom, spring, 0.66) + 0.075,
        x - w,
        x + w,
        0.039,
        0.17,
        c.tracery,
        'trim',
      );
      if (lod >= 3 && pointed) {
        for (const side of [-1, 1]) {
          const cx = x + side * w * 0.32;
          const h = spring + rise * 0.28;
          const r = 0.18 * w;
          const nodes = Array.from({ length: 17 }, (_, i) => {
            const a = (Math.PI * i) / 8;
            const rr = r * (0.81 + 0.19 * Math.cos(4 * a));
            return [cx + rr * Math.cos(a), h + rr * Math.sin(a), 0.11];
          });
          for (let i = 0; i < nodes.length - 1; i++)
            beam(out, 'trim', nodes[i], nodes[i + 1], 0.068, 0.09, surround);
        }
      }
    }
  }
}

function facesOf(out, x0, x1, z0, z1) {
  return [
    [faceAt(out, [x0, z1], [x1, z1]), x1 - x0],
    [faceAt(out, [x1, z1], [x1, z0]), z1 - z0],
    [faceAt(out, [x1, z0], [x0, z0]), x1 - x0],
    [faceAt(out, [x0, z0], [x0, z1]), z1 - z0],
  ];
}

function crossFinial(out, x, y, z, scale) {
  wall(
    out,
    y,
    y + 1.26 * scale,
    x - 0.067 * scale,
    x + 0.067 * scale,
    z - 0.067 * scale,
    z + 0.067 * scale,
    c.bronze,
    'pane',
  );
  wall(
    out,
    y + 0.74 * scale,
    y + 0.87 * scale,
    x - 0.4 * scale,
    x + 0.4 * scale,
    z - 0.065 * scale,
    z + 0.065 * scale,
    c.bronze,
    'pane',
  );
}

function belfry(out, x, z, lod) {
  const { eave, masonryTop, spireTop } = plan.westwork;
  const half = 4.65,
    y = 1.08;
  wall(out, eave - 1, masonryTop + y, x - half, x + half, z - half, z + half, c.choir);
  moulding(out, x - half, x + half, z - half, z + half, 28.2 + y, 0.23, 0.34);
  moulding(out, x - half, x + half, z - half, z + half, 32.0 + y, 0.19, 0.29);
  moulding(out, x - half, x + half, z - half, z + half, masonryTop - 0.5 + y, 0.38, 0.51);
  for (const [side, len] of facesOf(out, x - half, x + half, z - half, z + half)) {
    if (lod === 0) {
      wall(side, 34 + y, 37.6 + y, 1.7, len - 1.7, 0.01, 0.08, c.dark, 'pane');
      continue;
    }
    for (const offset of [0.21, 0.5, 0.79]) {
      arch(side, len * offset, 32.9 + y, 1.54, 36.45 + y, 0.94, lod, { inset: c.dark });
      if (lod >= 2)
        arch(side, len * offset, 25.9 + y, 1.45, 27.3 + y, 0.63, lod, {
          inset: c.mortar,
          surround: c.ledge,
        });
    }
  }
  const lantern = masonryTop + 3.4 + y,
    neck = masonryTop + 7.9 + y,
    top = spireTop + y;
  roofCap(out, x, z, masonryTop + y, half + 0.12, 3.4, 2.65);
  wall(out, lantern - 0.03, neck, x - 2.65, x + 2.65, z - 2.65, z + 2.65, c.slate, 'slate');
  roofCap(out, x, z, neck, 2.82, top - neck);
  if (lod > 0) {
    for (const [side, len] of facesOf(out, x - 2.65, x + 2.65, z - 2.65, z + 2.65)) {
      for (const ratio of [0.25, 0.5, 0.75])
        arch(side, len * ratio, lantern + 0.6, 0.56, neck - 0.95, 0.33, 1, {
          inset: c.dark,
          surround: c.slate,
        });
      if (lod >= 2) {
        triangle(
          side,
          'slate',
          [
            [0.19, neck - 0.08, 0.05],
            [len - 0.19, neck - 0.08, 0.05],
            [len / 2, neck + 2.8, -0.58],
          ],
          c.slate,
        );
        arch(side, len / 2, neck + 0.25, 0.82, neck + 0.94, 0.38, 1, {
          inset: c.dark,
          surround: c.slate,
        });
      }
    }
    crossFinial(out, x, top, z, 0.85);
  }
}

function westwork(out, lod) {
  const x0 = -42.25,
    x1 = -28.4,
    z0 = -20.8,
    z1 = 13.48,
    y = 1.08;
  const eave = plan.westwork.eave + y;
  wall(out, base, 3.25, x0, x1, z0, z1, c.stone, 'foundation');
  wall(out, 3.25, eave, x0, x1, z0, z1, c.choir);
  for (const height of [3.15, 8.0, 14.5, 21.0])
    moulding(out, x0, x1, z0, z1, height + y, 0.19, 0.28);
  gable(out, x0 - 0.25, x1 + 0.1, z0 - 0.26, z1 + 0.28, eave, 5.2, false, c.darkSlate, c.choir);
  belfry(out, -35.65, -15.2, lod);
  belfry(out, -35.65, 7.65, lod);
  const west = faceAt(out, [x0, z0], [x0, z1]);
  if (lod === 0) return;
  const divisions = [1.1, 5.2, 9.9, 14.4, 19.3, 24.1, 29.4, 33.3];
  for (const xx of divisions)
    wall(west, 2.25, eave - 0.53, xx - 0.17, xx + 0.17, 0.01, 0.35, c.ledge, 'trim');
  for (let i = 0; i < divisions.length - 1; i++) {
    const mid = (divisions[i] + divisions[i + 1]) * 0.5;
    arch(west, mid, 3.65, 3.25, 6.0, 1.35, lod, { inset: null, surround: c.ledge });
    arch(west, mid, 4.12, 0.86, 6.14, 0.47, lod);
    if (lod >= 2) {
      for (const s of [-1, 1])
        arch(west, mid + s * 0.88, 9.52, 1.4, 11.65, 0.72, lod, {
          inset: c.mortar,
          surround: c.ledge,
        });
      arch(west, mid, 15.4, 1.45, 17.08, 0.78, lod);
    }
  }
  const south = faceAt(out, [x0, z1], [x1, z1]);
  for (const xx of [2.6, 6.9, 11.2]) {
    arch(south, xx, 3.0, 2.45, 6.3, 1.22, lod, { inset: null, surround: c.ledge });
    arch(south, xx, 9.7, 1.3, 11.9, 0.68, lod);
    if (lod > 1) arch(south, xx, 15.1, 1.6, 17.0, 0.76, lod, { mullions: 1 });
  }
}

function pinnacle(out, x, z, y, lod) {
  wall(out, y - 1.5, y + 0.21, x - 0.22, x + 0.22, z - 0.22, z + 0.22, c.ledge, 'trim');
  const p = [
    [x - 0.26, y + 0.19, z - 0.26],
    [x - 0.26, y + 0.19, z + 0.26],
    [x + 0.26, y + 0.19, z + 0.26],
    [x + 0.26, y + 0.19, z - 0.26],
  ];
  for (let i = 0; i < 4; i++)
    triangle(out, 'trim', [p[i], p[(i + 1) % 4], [x, y + 1.43, z]], c.ledge);
  if (lod === 3)
    wall(out, y + 0.46, y + 0.68, x - 0.24, x + 0.24, z - 0.24, z + 0.24, c.ledge, 'trim');
}

function buttress(out, x, z, bottom, top, lod) {
  wall(out, bottom, top - 2.4, x - 0.43, x + 0.43, z - 0.45, z + 0.68, c.choir);
  wall(out, top - 2.4, top, x - 0.31, x + 0.31, z - 0.38, z + 0.32, c.choir);
  if (lod > 0) {
    wall(out, bottom + 1.65, bottom + 1.88, x - 0.51, x + 0.51, z - 0.5, z + 0.78, c.ledge, 'trim');
    pinnacle(out, x, z, top, lod);
  }
}

function parapet(out, x0, x1, z, y, lod) {
  wall(out, y, y + 0.19, x0, x1, z - 0.2, z + 0.2, c.ledge, 'trim');
  if (lod < 2) return;
  wall(out, y + 0.97, y + 1.16, x0, x1, z - 0.13, z + 0.13, c.ledge, 'trim');
  const count = Math.round((x1 - x0) / 0.84);
  for (let i = 1; i < count; i++) {
    const x = lerp(x0, x1, i / count);
    wall(out, y + 0.17, y + 1.0, x - 0.09, x + 0.09, z - 0.092, z + 0.09, c.ledge, 'trim');
  }
}

function southPortico(out, lod) {
  const x0 = -29.7,
    x1 = -10.34,
    z0 = 9.7,
    z1 = 21.19,
    y = 1;
  const middle = -22.95;
  wall(out, base, y + 2.8, x0, x1, z0, z1, c.stone, 'foundation');
  wall(out, y + 2.8, 15.4, x0, x1, z0, z1, c.limestone);
  gable(out, x0 - 0.19, -16.15, z0 - 0.1, z1, 15.4, 5.1, false, c.slate, c.choir);
  gable(out, -16.15, x1 + 0.2, z0 - 0.1, z1, 15.4, 2.2, false);
  const towardSouth = faceAt(out, [x0, z1], [x1, z1]);
  if (lod > 0) {
    arch(towardSouth, middle - x0, 1.35, 9.1, 9.75, 4.35, lod, {
      pointed: true,
      bands: 3,
      mullions: 3,
      surround: c.ledge,
      inset: c.dark,
    });
    for (const x of [-26, -22.95, -19.9])
      arch(towardSouth, x - x0, 15.32, 1.23, 16.75, 0.68, lod, { mullions: 1 });
    arch(towardSouth, x1 - x0 - 3.13, 3.85, 3.63, 9.9, 2.15, lod, {
      pointed: true,
      bands: 2,
      mullions: 3,
    });
    for (const x of [x0 + 0.52, -16.13, x1 - 0.22]) buttress(out, x, z1, base, 15.9, lod);
    const east = faceAt(out, [x1, z1], [x1, z0]);
    for (const x of [3.26, 7.47])
      arch(east, x, 3.47, 1.61, 9.94, 1.41, lod, { pointed: true, mullions: 1 });
    if (lod >= 2) {
      wall(
        towardSouth,
        7.4,
        7.61,
        middle - x0 - 4.47,
        middle - x0 + 4.47,
        0.13,
        0.38,
        c.bronze,
        'trim',
      );
      parapet(out, -16.15, x1, 21.19, 15.45, lod);
      for (let step = 0; step < 3; step++) {
        wall(
          out,
          base,
          1.36 - step * 0.16,
          middle - 4.35,
          middle + 4.35,
          z1,
          z1 + 0.32 * (step + 1),
          c.stone,
          'foundation',
        );
      }
      crossFinial(out, middle, 20.55, z1 + 0.12, 0.62);
    }
  } else wall(towardSouth, 1.3, 12.4, 2.9, 10.3, 0.01, 0.08, c.dark, 'pane');
}

function nave(out, lod) {
  const { eave, ridge } = plan.nave;
  wall(out, base, eave, -29.2, 32.35, -10.55, 6.5);
  gable(out, -29.5, 32.63, -10.87, 6.8, eave, ridge - eave);
  wall(out, base, 2.9, -11.2, 16.0, 6.05, 15.35, c.stone, 'foundation');
  wall(out, 2.9, 15.72, -11.2, 16.0, 6.05, 15.35);
  face(
    out,
    'slate',
    [
      [-11.2, 18.35, 6.02],
      [-11.2, 15.75, 15.53],
      [16, 15.75, 15.53],
      [16, 18.35, 6.02],
    ],
    c.slate,
  );
  parapet(out, -11.2, 16, 15.35, 15.72, lod);
  wall(out, base, 14, -28.6, 16.8, -18.6, -10.2);
  face(
    out,
    'slate',
    [
      [-28.6, 14.05, -18.72],
      [-28.6, 17.1, -10.22],
      [16.8, 17.1, -10.22],
      [16.8, 14.05, -18.72],
    ],
    c.slate,
  );
  if (lod === 0) return;
  const south = faceAt(out, [-11.2, 15.35], [16, 15.35]);
  for (let i = 0; i < 5; i++) {
    const x = (i + 0.5) * 5.44;
    arch(south, x, 3.85, 3.24, 10.77, 2.74, lod, {
      pointed: true,
      bands: lod > 1 ? 2 : 1,
      mullions: i === 4 ? 2 : 3,
    });
    buttress(out, x - 11.2 - 2.59, 15.35, base, 16.41, lod);
  }
  for (const x of [-5.95, 0.8, 7.65, 14.28]) {
    const southPath = [
      [x, 20.9, 6.58],
      [x, 20.47, 9.64],
      [x, 19.24, 12.15],
      [x, 17.16, 14.76],
    ];
    const northPath = southPath.map(([a, b, z]) => [a, b - 0.72, -z - 4]);
    for (const path of [southPath, northPath]) {
      if (lod === 1) beam(out, 'trim', path[0], path[3], 0.49, 0.81, c.ledge);
      else
        for (let i = 0; i < path.length - 1; i++)
          beam(out, 'trim', path[i], path[i + 1], 0.48, 0.87, c.ledge);
    }
  }
  if (lod > 1) {
    const clear = faceAt(out, [-29.2, 6.5], [32.35, 6.5]);
    const clearNorth = faceAt(out, [32.35, -10.55], [-29.2, -10.55]);
    for (const side of [clear, clearNorth]) {
      for (let i = 0; i < 8; i++) arch(side, 7.45 + i * 5.43, 18.98, 1.15, 21.45, 0.69, lod);
    }
  }
}

function transept(out, lod) {
  const x0 = 15.0,
    x1 = 36.4,
    z0 = -34.3,
    z1 = 19.23,
    eave = 19.95;
  wall(out, base, 3.28, x0, x1, z0, z1, c.stone, 'foundation');
  wall(out, 3.28, eave, x0, x1, z0, z1, c.choir);
  moulding(out, x0, x1, z0, z1, 3.25);
  gable(out, x0 - 0.16, x1 + 0.18, z0, z1, eave, 11.25, false, c.slate, c.limestone);
  if (lod > 0) {
    for (const side of [faceAt(out, [x0, z1], [x1, z1]), faceAt(out, [x1, z0], [x0, z0])]) {
      arch(side, 10.7, 8.07, 5.48, 17.62, 4.23, lod, { pointed: true, bands: 2, mullions: 3 });
      arch(side, 10.7, 0.27, 3.8, 4.09, 1.89, lod, {
        pointed: true,
        bands: 2,
        mullions: 1,
        inset: c.dark,
      });
      arch(side, 10.7, 24.04, 1.27, 25.78, 0.68, lod);
    }
    for (const x of [15.2, 19.5, 30.32, 35.98]) {
      buttress(out, x, z1, base, 19.6, lod);
      buttress(out, x, z0, base, 19.6, lod);
    }
  }
}

function choirTower(out, x, z, lod) {
  const h = 3.77,
    top = 25.26;
  wall(out, base, top, x - h, x + h, z - h, z + h, c.choir);
  for (const y of [2.6, 11.62, 19.05, 24.92])
    moulding(out, x - h, x + h, z - h, z + h, y, 0.15, 0.27);
  roofCap(out, x, z, top, h + 0.11, 4.9);
  if (lod === 0) return;
  for (const [side, len] of facesOf(out, x - h, x + h, z - h, z + h)) {
    for (const r of [0.19, 0.39, 0.61, 0.81])
      arch(side, len * r, 20.22, 0.85, 22.75, 0.48, lod, { inset: c.dark });
    if (lod >= 2) {
      for (const r of [0.1, 0.53, 0.9])
        wall(side, 2.7, 19.05, len * r - 0.12, len * r + 0.12, 0.01, 0.19, c.ledge, 'trim');
      arch(side, len * 0.41, 13.11, 0.94, 16.25, 0.52, lod);
    }
  }
  crossFinial(out, x, top + 4.9, z, 0.45);
}

function apse(out, lod) {
  wall(out, base, 21.22, 31.6, 42.7, -10.35, 5.47, c.choir);
  gable(out, 31.45, 42.72, -10.55, 5.69, 21.22, 8.04);
  choirTower(out, 37.83, -9.35, lod);
  choirTower(out, 37.83, 4.25, lod);
  const x = 41.7,
    z = -2.53,
    rx = 6.9,
    rz = 6.08,
    segmentCount = lod >= 2 ? 24 : 12;
  const p = (t, y, s = 1) => [x + Math.cos(t) * rx * s, y, z + Math.sin(t) * rz * s];
  for (let i = 0; i < segmentCount; i++) {
    const a = Math.PI * (i / segmentCount - 0.5),
      b = Math.PI * ((i + 1) / segmentCount - 0.5);
    for (const [y0, y1, material, color, s] of [
      [base, 2.9, 'foundation', c.stone, 1],
      [2.9, 19.55, 'limestone', c.choir, 1],
      [10.05, 10.29, 'trim', c.ledge, 1.028],
      [18.92, 19.09, 'trim', c.ledge, 1.038],
      [19.55, 19.84, 'trim', c.ledge, 1.047],
    ]) {
      face(out, material, [p(b, y0, s), p(a, y0, s), p(a, y1, s), p(b, y1, s)], color);
    }
    triangle(out, 'slate', [p(b, 19.84, 1.055), p(a, 19.84, 1.055), [x, 27.3, z]], c.slate);
  }
  const tangent = (t, y) => {
    const a = p(t, y, 1.006),
      b = p(t - 0.025, y, 1.006);
    return faceAt(out, [a[0], a[2]], [b[0], b[2]]);
  };
  if (lod > 0) {
    for (let i = 0; i < 9; i++) {
      const theta = Math.PI * ((i + 0.5) / 9 - 0.5);
      const front = tangent(theta, 0);
      arch(front, 0, 15.79, 1.47, 17.69, 0.52, lod, {
        inset: c.mortar,
        surround: c.ledge,
        mullions: 1,
      });
      if (i % 2 === 0) arch(front, 0, 5.44, 0.86, 8.4, 0.54, lod, { inset: c.dark });
      if (i === 2 || i === 4 || i === 6)
        arch(front, 0, 11.13, 1.18, 13.54, 0.69, lod, { inset: c.glass });
    }
  }
}

const cloisterOuter = [
  [-31.5, -67.38],
  [17.8, -71.65],
  [18.4, -18.92],
  [-37.63, -21.18],
];
const cloisterCourt = [
  [-16.6, -57.55],
  [14.2, -55.6],
  [9.16, -22.38],
  [-20.85, -22.21],
];
const cloisterRanges = [
  { corners: [0, 3], kind: 'west' },
  { corners: [3, 2], kind: 'south' },
  { corners: [2, 1], kind: 'east' },
  { corners: [1, 0], kind: 'north' },
].map(({ corners, kind }) => ({
  outer: corners.map((i) => cloisterOuter[i]),
  inner: corners.map((i) => cloisterCourt[i]),
  kind,
}));

function topPoint(point, y) {
  return [point[0], y, point[1]];
}
function lengthBetween(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function arcade(out, a, b, y, lod) {
  const span = lengthBetween(a, b),
    local = faceAt(out, a, b);
  const n = Math.max(3, Math.round(span / 4.25)),
    unit = span / n;
  if (lod < 2) {
    wall(local, base, y, 0, span, -0.5, 0, c.choir);
    if (lod === 1)
      for (let i = 0; i < n; i++)
        arch(local, (i + 0.5) * unit, 0.36, unit - 0.64, y - 2.52, 1.39, 0, { inset: c.dark });
    return;
  }
  for (let i = 0; i < n; i++) {
    const center = (i + 0.5) * unit;
    const w = unit / 2 - 0.32;
    const spring = y - 2.54,
      rise = 1.42;
    const segments = lod === 3 ? 8 : 4;
    const arc = (index) => {
      const a = (Math.PI * index) / segments;
      return [center + w * Math.cos(a), spring + rise * Math.sin(a), 0.033];
    };
    wall(local, base, y, center - unit / 2, center - w, -0.63, 0.032, c.choir);
    wall(local, base, y, center + w, center + unit / 2, -0.63, 0.032, c.choir);
    for (let j = 0; j < segments; j++) {
      const p = arc(j),
        q = arc(j + 1);
      face(local, 'limestone', [q, p, [p[0], y, 0.033], [q[0], y, 0.033]], c.choir);
      face(local, 'foundation', [p, q, [q[0], q[1], -0.62], [p[0], p[1], -0.62]], c.ledge);
    }
    arch(local, center, 0.36, w * 2, spring, rise, lod, { inset: null, surround: c.ledge });
    if (lod >= 2) {
      wall(
        local,
        0.25,
        0.58,
        center - unit / 2,
        center - unit / 2 + 0.56,
        -0.71,
        0.2,
        c.ledge,
        'trim',
      );
      wall(
        local,
        0.25,
        0.58,
        center + unit / 2 - 0.56,
        center + unit / 2,
        -0.71,
        0.2,
        c.ledge,
        'trim',
      );
    }
  }
}

function range(out, lod, outer, inner, kind) {
  const [a, b] = outer,
    [u, v] = inner;
  const y = 8.75,
    pitch = 4.05;
  const t = (p, q, f) => p.map((j, i) => lerp(j, q[i], f));
  const edge = (a, b, low, high, material, color) => {
    face(
      out,
      material,
      [topPoint(a, low), topPoint(b, low), topPoint(b, high), topPoint(a, high)],
      color,
    );
  };
  const r = t(a, u, 0.46),
    s = t(b, v, 0.46);
  edge(a, b, base, 2.07, 'foundation', c.stone);
  edge(a, b, 2.07, y, 'limestone', c.choir);
  face(
    out,
    'slate',
    [topPoint(a, y), topPoint(b, y), topPoint(s, y + pitch), topPoint(r, y + pitch)],
    c.slate,
  );
  face(
    out,
    'slate',
    [topPoint(r, y + pitch), topPoint(s, y + pitch), topPoint(v, y), topPoint(u, y)],
    c.darkSlate,
  );
  arcade(out, v, u, y, lod);
  if (lod >= 2 && kind !== 'south') {
    const ext = faceAt(out, a, b),
      span = lengthBetween(a, b),
      n = Math.round(span / 5.5);
    for (let i = 0; i < n; i++)
      arch(ext, ((i + 0.5) * span) / n, 3.1, 1.05, 5.82, 0.63, lod, { mullions: 1 });
  }
}

function courtGarden(out, lod) {
  if (lod === 0) return;
  const [nw, ne, se, sw] = cloisterCourt;
  const point = (t, v) => {
    const [x, z] = [0, 1].map((k) => lerp(lerp(nw[k], ne[k], t), lerp(sw[k], se[k], t), v));
    const u = (x - terrain.origin[0]) / terrain.stepMeters;
    const w = (z - terrain.origin[1]) / terrain.stepMeters;
    const i = Math.floor(u),
      j = Math.floor(w);
    const a = terrain.heightsMeters[j],
      b = terrain.heightsMeters[j + 1];
    const y =
      lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), w - j) -
      terrain.modelDatumElevationMeters;
    return [x, y + 0.085, z];
  };
  const segments = lod === 1 ? 3 : 7;
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const u = lerp(0.115, 0.885, column / segments),
        v = lerp(0.115, 0.885, row / segments);
      const nextU = lerp(0.115, 0.885, (column + 1) / segments),
        nextV = lerp(0.115, 0.885, (row + 1) / segments);
      face(
        out,
        'pane',
        [point(u, nextV), point(nextU, nextV), point(nextU, v), point(u, v)],
        c.court,
      );
    }
  }
}

function cloister(out, lod) {
  courtGarden(out, lod);
  for (const { outer, inner, kind } of cloisterRanges) range(out, lod, outer, inner, kind);
  wall(out, base, 8.93, -36.1, -31.6, -69.11, -49.6, c.choir);
  gable(out, -36.3, -31.3, -69.33, -49.45, 8.93, 3.5, false);
  wall(out, base, 9.1, 16.25, 25.91, -88.2, -67.7, c.choir);
  gable(out, 16.02, 26.13, -88.43, -67.49, 9.1, 3.85, false);
  wall(out, base, 8.86, 16.0, 29.95, -41.5, -30.1, c.choir);
  gable(out, 15.82, 30.16, -41.68, -29.93, 8.86, 3.9);
}

function build(out, lod) {
  westwork(out, lod);
  nave(out, lod);
  southPortico(out, lod);
  transept(out, lod);
  apse(out, lod);
  cloister(out, lod);
}
export const saintServatiusSkyline = (out) => build(out, 0);
export const saintServatiusDistrict = (out) => build(out, 1);
export const saintServatiusStreet = (out) => build(out, 2);
export const saintServatiusCloseup = (out) => build(out, 3);

const recipe = 'saint-servatius-model.mjs';
const camera = [-111, 63, 101],
  lookAt = [-1, 18, -18];
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const main = [
  [-42.22, -21.1],
  [-27.9, -21.1],
  [-27.9, -18.6],
  [14.8, -18.6],
  [14.8, -34.15],
  [36.7, -34.15],
  [36.7, -12.52],
  [41.2, -12.52],
  [41.2, -8.85],
  [45.6, -7.7],
  [48.7, -3.1],
  [47.1, 1.3],
  [42.2, 3.58],
  [41.4, 7.1],
  [36.8, 7.1],
  [36.1, 19.4],
  [15.4, 19.4],
  [15.4, 15.27],
  [-10.42, 15.27],
  [-10.42, 21.2],
  [-28.0, 21.2],
  [-28.0, 13.45],
  [-42.22, 13.45],
];
export const saintServatiusModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'cathedral',
  build: saintServatiusCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: main,
    outlines: [
      main,
      ...cloisterRanges.map(({ outer, inner }) => [...outer, ...inner.toReversed()]),
      rect(15.9, 25.75, -87.4, -71.3),
    ],
    minimumCoverage: 0.85,
    basis:
      'Masks the main church and attached mapped ranges while preserving the open cloister court and separate Sint-Janskerk.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Maastricht limestone and dark sandstone basilica with paired west spires, a glazed Gothic Bergportaal, steep slate roof, arcaded east apse and adjoining cloister.',
  camera,
  lookAt,
  sunDirection: [-100, 120, 120],
  portableGroundY: 0,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.82,
    cameraYaw: 0.3,
    focus: { center: [-1, 14, -15] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'southwest-towers-and-portal', position: camera, lookAt },
    { name: 'bergportaal-and-southern-chapels', position: [-8, 13, 58], lookAt: [-19, 12, 18] },
    { name: 'apse-and-two-choir-towers', position: [77, 25, 42], lookAt: [34, 13, -3] },
    { name: 'cloister-court-and-westwork', position: [-21, 38, -82], lookAt: [-6, 7, -40] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'basilica-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'saintServatiusSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'saintServatiusDistrict', 0.8],
        ['street', 'saintServatiusStreet', 0.29],
        ['closeup', 'saintServatiusCloseup', 0.08],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by cleared Qualla CC0 photography and public-domain plate 47. OpenStreetMap geometry ODbL 1.0.',
  limitations: plan.limitations,
};
