import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  surfaces as courtSurfaces,
  dark,
  face,
  frame,
  gold,
  granite,
  hall,
  indigo,
  lattice,
  levels,
  marble,
  rectangle,
  red,
  courtRoof as roofShell,
  roofs,
  solid,
  courtBay as timberBay,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['canal', 'pond', 'island', 'kuoru']);
export const surfaces = {
  ...courtSurfaces,
  brick: { slot: 'wall', graph: 'brick_stack' },
  water: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.12 },
};
const marketBrick = [0.55, 0.54, 0.49];
const canalGreen = [0.084, 0.195, 0.173];
const gardenTile = [0.18, 0.21, 0.19];

function courtRoof(out, width, depth, y, rise, tint, detail, gabled = false) {
  if (detail === 0) {
    const eaves = rectangle(width, depth)
      .toReversed()
      .map(([x, z]) => [x, y, z]);
    const ridge = rectangle(width * (gabled ? 0.96 : 0.63), depth * 0.06)
      .toReversed()
      .map(([x, z]) => [x, y + rise, z]);
    loft(out, 'tile', [eaves, ridge], tint);
    return;
  }
  const lift = Math.min(0.58, depth * 0.057, rise * 0.155);
  roofShell(out, width, depth, y, rise, tint, detail, gabled, lift);
}

function courtBay(out, width, depth, y, height, bays, detail, options = {}) {
  if (detail !== 0) {
    timberBay(out, width, depth, y, height, bays, detail, options);
    return;
  }
  if (options.wall) {
    box(
      out,
      'plaster',
      [-width * 0.41, y, -depth * 0.34],
      [width * 0.41, y + height, depth * 0.27],
      red,
    );
    return;
  }
  for (const side of [-1, 1])
    for (const x of [-width * 0.41, width * 0.41]) {
      const z = side * depth * 0.37;
      beam(out, 'timber', [x, y, z], [x, y + height, z], 0.28, 0.28, red);
    }
}

function quays(out, rings, water) {
  for (const ring of rings) {
    const area = ring.reduce((sum, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return sum + x * b - z * a;
    }, 0);
    const direction = Math.sign(area);
    for (const [i, [x, z, y]] of ring.entries()) {
      const [a, b, h] = ring[(i + 1) % ring.length];
      if (Math.hypot(a - x, b - z) < 0.012 || Math.max(y, h) < water + 0.06) continue;
      const base = water - 0.22;
      const points = [
        [x, base, z],
        [a, base, b],
        [a, Math.max(water + 0.025, h), b],
        [x, Math.max(water + 0.025, y), z],
      ];
      face(out, 'stone', points, granite, [(z - b) * direction, 0, (a - x) * direction]);
    }
  }
}

function terrace(out, { path, side, width }, water, detail) {
  for (let i = 1; i < path.length; i++) {
    const [x, z, y] = path[i - 1];
    const [a, b, h] = path[i];
    const span = Math.hypot(a - x, b - z);
    if (span < 0.4) continue;
    const normal = [((b - z) / span) * side, (-(a - x) / span) * side];
    const near = [x, y, z];
    const far = [a, h, b];
    const bank = (p) => [p[0] + normal[0] * width, p[1], p[2] + normal[1] * width];
    face(out, 'stone', [near, far, bank(far), bank(near)], marble, up);
    const bottom = Math.min(water - 0.4, Math.min(y, h) - 0.3);
    face(out, 'stone', [[x, bottom, z], [a, bottom, b], far, near], granite, [
      -normal[0],
      0,
      -normal[1],
    ]);
    if (detail < 2) continue;
    beam(out, 'stone', near, far, 0.22, 0.15, marble);
  }
}

function shopFacade(out, w, d, h, stories, detail) {
  const facing = d * 0.38;
  box(out, 'brick', [-w * 0.46, 0, -d * 0.46], [w * 0.46, h, facing - 0.11], marketBrick);
  if (detail === 0) return;
  const bays = w > 9 ? 4 : w > 6 ? 3 : 2;
  const span = (w * 0.9) / bays;
  const entrance = Math.min(2.18, h * 0.64);
  for (let i = 0; i < bays; i++) {
    const x = span * (i + 0.5 - bays / 2);
    lattice(out, x, 0.27, facing, span * 0.82, entrance, detail, [0.17, 0.077, 0.045]);
    if (stories === 2) lattice(out, x, h * 0.58, facing + 0.02, span * 0.79, h * 0.31, detail);
    if (detail >= 2) {
      beam(
        out,
        'timber',
        [x - span * 0.41, 0.15, facing],
        [x - span * 0.41, h, facing],
        0.16,
        0.23,
        red,
      );
      if (i === bays - 1) {
        beam(
          out,
          'timber',
          [x, entrance + 0.29, facing],
          [x, entrance + 0.29, facing + 0.47],
          0.08,
          0.09,
          dark,
        );
        loft(
          out,
          'enamel',
          [
            [0, 0.105],
            [0.12, 0.19],
            [0.34, 0.17],
            [0.46, 0.099],
          ].map(([dy, r]) =>
            radialRing(entrance - 0.18 + dy, r, r * 0.9, detail >= 3 ? 8 : 5, [x, facing + 0.41]),
          ),
          [0.55, 0.112, 0.047],
        );
      }
    }
  }
  if (stories === 2)
    courtRoof(out, w * 1.01, Math.min(2.65, d * 0.49), h * 0.46, 0.94, roofs.grey, detail);
  if (detail >= 2) {
    box(
      out,
      'timber',
      [-w * 0.43, entrance + 0.16, facing + 0.04],
      [w * 0.43, entrance + 0.55, facing + 0.19],
      indigo,
    );
    beam(
      out,
      'enamel',
      [-w * 0.37, entrance + 0.28, facing + 0.2],
      [w * 0.37, entrance + 0.28, facing + 0.2],
      0.047,
      0.058,
      gold,
    );
  }
}

function marketShop(out, site, detail) {
  const { width: w, depth: d, angle, center } = site.frame;
  const plinth = 0.31;
  const raised = site.role === 'island_shop';
  solid(
    out,
    'stone',
    site.outline,
    raised ? Math.min(site.toe, 0.32) : site.toe,
    site.grade + plinth,
    granite,
  );
  const body = frame(out, center, site.grade + plinth, angle);
  const height = raised || w > 8.6 ? 5.44 : 3.19;
  if (raised) {
    for (const [x, z, shopWidth, shopDepth, floors] of site.shops) {
      const shop = frame(body, [x, z], 0, 0);
      const h = floors === 2 ? 5.1 : 3.15;
      shopFacade(shop, shopWidth, shopDepth, h, floors, detail);
      courtRoof(
        shop,
        shopWidth * 1.12,
        shopDepth * 1.05,
        h + 0.16,
        shopDepth * 0.27,
        roofs.grey,
        detail,
        true,
      );
    }
  } else {
    shopFacade(body, w, d, height, height > 4 ? 2 : 1, detail);
    courtRoof(
      body,
      w * 1.075,
      d * 1.17,
      height + 0.17,
      Math.min(1.66, d * 0.31),
      roofs.grey,
      detail,
      true,
    );
  }
}

function shortCrossing(out, crossing, detail) {
  const { ends, width, deckHeights, crown, water, style, offset, openings } = crossing;
  const first = ends[0][0];
  const last = ends[1][0];
  const length = last - first;
  const half = width * 0.5;
  const canal = style === 'canal';
  const path = frame(out, offset, 0, 0);
  const deck = (x) => {
    const t = (x - first) / length;
    return deckHeights[0] * (1 - t) + deckHeights[1] * t + crown * 4 * t * (1 - t);
  };
  const invert = Math.min(water - 0.58, ...deckHeights.map((h) => h - 1.3));
  const arches = canal
    ? [
        { center: -4.95, half: 1.54, rise: 1.85 },
        { center: 0.52, half: 3.03, rise: 3.83 },
        { center: 6.03, half: 1.51, rise: 1.85 },
      ]
    : openings;
  const strips = [];
  let edge = first;
  for (const arch of arches) {
    const left = arch.center - arch.half;
    const right = arch.center + arch.half;
    strips.push({ left: edge, right: left }, { left, right, arch });
    edge = right;
  }
  strips.push({ left: edge, right: last });
  for (const { left, right, arch } of strips) {
    const step = arch && canal ? [4, 9, 13, 18, 23][detail] : Math.max(1, detail);
    const point = (i) => {
      const t = i / step;
      const theta = Math.PI * t;
      const x =
        arch && canal ? arch.center - arch.half * Math.cos(theta) : left + (right - left) * t;
      const top = deck(x);
      const bottom = canal ? water - 0.18 + (arch?.rise ?? 0) * Math.sin(theta) : top - 0.44;
      return {
        x,
        top,
        bottom: arch ? Math.min(top - 0.39, bottom) : invert,
      };
    };
    for (let i = 0; i < step; i++) {
      const a = point(i);
      const b = point(i + 1);
      for (const side of [-1, 1]) {
        const z = side * half;
        face(
          path,
          'stone',
          [
            [a.x, a.bottom, z],
            [b.x, b.bottom, z],
            [b.x, b.top, z],
            [a.x, a.top, z],
          ],
          marble,
          [0, 0, side],
        );
        if (arch && detail >= 2) {
          const rim = z + side * 0.034;
          face(
            path,
            'marble',
            [
              [a.x, a.bottom, rim],
              [b.x, b.bottom, rim],
              [b.x, b.bottom + 0.22, rim],
              [a.x, a.bottom + 0.22, rim],
            ],
            marble,
            [0, 0, side],
          );
        }
      }
      face(
        path,
        'stone',
        [
          [a.x, a.top, -half],
          [a.x, a.top, half],
          [b.x, b.top, half],
          [b.x, b.top, -half],
        ],
        marble,
        up,
      );
      if (detail >= 1)
        face(
          path,
          'stone',
          [
            [a.x, a.bottom, -half],
            [b.x, b.bottom, -half],
            [b.x, b.bottom, half],
            [a.x, a.bottom, half],
          ],
          granite,
          [0, -1, 0],
        );
    }
    if (arch && !canal) {
      for (const [i, side] of [
        [0, 1],
        [step, -1],
      ]) {
        const { x, bottom } = point(i);
        face(
          path,
          'stone',
          [
            [x, invert, -half],
            [x, invert, half],
            [x, bottom, half],
            [x, bottom, -half],
          ],
          granite,
          [side, 0, 0],
        );
      }
    }
  }
  const posts = detail < 1 ? 0 : canal ? 15 : 11;
  const rail = canal ? 0.87 : 0.77;
  for (let i = 0; i < posts; i++) {
    const a = first + (length * i) / posts;
    const b = first + (length * (i + 1)) / posts;
    for (const side of [-1, 1]) {
      const z = side * (half - 0.14);
      beam(path, 'marble', [a, deck(a) + rail, z], [b, deck(b) + rail, z], 0.125, 0.155, marble);
      if (detail === 0) continue;
      beam(path, 'stone', [a, deck(a), z], [a, deck(a) + rail + 0.105, z], 0.23, 0.24, marble);
      if (detail >= 2) {
        const u = a + 0.12;
        const v = b - 0.12;
        beam(path, 'stone', [u, deck(u) + 0.24, z], [v, deck(v) + 0.24, z], 0.18, 0.3, marble);
      }
    }
  }
  if (!canal) fishGate(path, first + 1.1, deck(first + 1.1), width, detail);
}

function fishGate(out, x, y, width, detail) {
  const gate = frame(out, [x, 0], y, Math.PI / 2);
  const span = width * 0.48;
  for (const p of [-span, span]) {
    box(gate, 'stone', [p - 0.21, 0, -0.28], [p + 0.21, 2.91, 0.28], marble);
    box(gate, 'marble', [p - 0.29, 0, -0.37], [p + 0.29, 0.59, 0.37], marble);
    if (detail >= 2) {
      const s = Math.sign(p);
      face(
        gate,
        'marble',
        [
          [p, 2.21, 0.302],
          [p - s * 0.44, 2.69, 0.302],
          [p, 2.71, 0.302],
        ],
        granite,
        [0, 0, 1],
      );
    }
  }
  box(gate, 'stone', [-span - 0.26, 2.53, -0.32], [span + 0.26, 3.11, 0.32], marble);
  courtRoof(gate, width + 1.02, 1.46, 3.13, 0.58, gardenTile, detail, true);
}

function gardenPavilion(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const body = frame(out, center, site.grade + 0.43, angle);
  solid(out, 'stone', site.outline, site.toe, site.grade + 0.43, granite);
  const tall = site.role === 'pond_hall';
  const height = tall ? 4.66 : 3.27;
  courtBay(body, w * 0.99, d * 0.94, 0, height, tall ? 5 : w > 8 ? 3 : 2, detail, {
    wall: site.role === 'garden_hall',
    rail: tall,
    frontSteps: true,
    plaque: tall,
  });
  courtRoof(
    body,
    w * 1.08,
    d * 1.09,
    height + 0.31,
    Math.min(tall ? 3.05 : 1.8, d * 0.32),
    gardenTile,
    detail,
    tall,
  );
  if (tall) {
    for (const [x, z] of [
      [-w * 0.42, d * 0.46],
      [w * 0.42, d * 0.46],
    ]) {
      box(body, 'stone', [x - 0.28, -1.1, z - 0.27], [x + 0.28, 0.03, z + 0.27], marble);
    }
  }
}

function gardenGallery(out, lines, detail) {
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const [x, z, y] = line[i - 1];
      const [a, b, h] = line[i];
      const length = Math.hypot(a - x, b - z);
      if (length < 1) continue;
      const body = frame(out, [(x + a) / 2, (z + b) / 2], (y + h) / 2, Math.atan2(b - z, a - x));
      if (detail === 0) {
        courtRoof(body, length * 1.024, 2.89, 3.01, 0.94, gardenTile, 0, true);
        beam(body, 'timber', [0, 0, 0], [0, 3.02, 0], 0.38, 0.38, red);
        continue;
      }
      box(body, 'stone', [-length * 0.51, -0.72, -1.21], [length * 0.51, 0, 1.21], granite);
      courtBay(
        body,
        length,
        2.53,
        0,
        2.85,
        detail < 2 ? 2 : Math.max(2, Math.round(length / 2.6)),
        detail === 2 ? 1 : detail,
      );
      courtRoof(
        body,
        length * 1.025,
        2.89,
        3.01,
        0.94,
        gardenTile,
        detail === 1 ? 0 : detail,
        true,
      );
    }
}

function islandTemple(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const gate = site.role === 'temple_gate';
  const body = frame(out, center, site.grade + 0.75, angle);
  const h = gate ? 3.43 : 4.76;
  solid(out, 'stone', site.outline, site.toe - 0.38, site.grade + 0.75, granite);
  courtBay(body, w, d, 0, h, 3, detail, { wall: !gate, frontScreen: !gate, plaque: true });
  courtRoof(
    body,
    w * 1.06,
    d * 1.12,
    h + 0.29,
    Math.min(2.96, d * 0.34),
    roofs[site.roof],
    detail,
    true,
  );
  for (let i = 0; i < 4; i++) {
    const z = d * 0.46 + 0.36 * i;
    box(body, 'stone', [-w * 0.22, -0.72, z], [w * 0.22, -i * 0.16 + 0.01, z + 0.365], marble);
  }
}

function hanxu(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const terrace = frame(out, center, site.grade, angle);
  const crest = 5.8;
  const toe = rectangle(w * 1.04, d * 1.12);
  solid(terrace, 'stone', toe, -0.86, 0.68, granite);
  solid(out, 'stone', site.outline, site.toe - 0.31, site.grade + crest, granite);
  // The north terrace reads as layered rockwork, with a stair to the lower landing.
  const rocks = detail === 0 ? 3 : detail === 1 ? 7 : detail === 2 ? 23 : 45;
  for (let i = 0; i < rocks; i++) {
    const row = Math.floor(i / 9);
    const shift = ((i * 13) % 7) * 0.16;
    const x = w * (((i * 29) % 89) / 89 - 0.5);
    if (x > w * 0.11 && x < w * 0.31) continue;
    const z = d * 0.49 - row * 0.23 + shift;
    const y = Math.min(5.15, 0.55 + row * 1.04 + (i % 5) * 0.23);
    const span = (detail < 2 ? 3.5 : 1.7) + ((i * 13) % 7) * 0.14;
    const rock = frame(terrace, [x, z], y, i * 0.718);
    const size = (r) => radialRing(r[0], span * r[1], span * 0.54 * r[1], 5);
    loft(
      rock,
      'stone',
      [
        [-0.38, 0.89],
        [0.3, 1],
        [0.85, 0.52],
      ].map(size),
      [0.43 + shift * 0.065, 0.39 + shift * 0.064, 0.3 + shift * 0.054],
    );
  }
  const body = frame(terrace, [0, -d * 0.085], crest, 0);
  for (const side of [-1, 1]) {
    const wing = frame(body, [side * w * 0.233, -0.86], 0, 0);
    courtBay(wing, w * 0.5, d * 0.72, 0, 4.46, 3, detail, { wall: true, frontScreen: true });
    courtRoof(wing, w * 0.517, d * 0.81, 4.67, 2.4, roofs.grey, detail, true);
  }
  const porch = frame(body, [0, d * 0.34], 0, 0);
  courtBay(porch, w * 0.66, d * 0.43, 0, 3.22, 5, detail, { plaque: true });
  courtRoof(porch, w * 0.68, d * 0.46, 3.51, 1.3, roofs.grey, detail);
  const count = detail === 0 ? 3 : detail === 1 ? 9 : 28;
  for (let i = 0; i < count; i++) {
    const x = w * 0.22;
    const z = d * 0.47 + (i * 8.25) / count;
    const top = crest - ((crest - 0.28) * i) / count;
    box(terrace, 'marble', [x - 1.27, 0.08, z], [x + 1.27, top, z + 8.27 / count], marble);
    if (detail >= 2 && i % 5 === 0)
      for (const side of [-1, 1])
        beam(
          terrace,
          'stone',
          [x + side * 1.12, top, z],
          [x + side * 1.12, top + 0.78, z],
          0.19,
          0.19,
          marble,
        );
  }
}

function openOctagon(out, site, detail) {
  const { center } = site.frame;
  const radius = Math.max(
    ...site.outline.map(([x, z]) => Math.hypot(x - center[0], z - center[1])),
  );
  const phase = Math.atan2(site.outline[0][1] - center[1], site.outline[0][0] - center[0]);
  const body = frame(out, center, site.grade + 0.78, phase);
  solid(out, 'stone', site.outline, site.toe - 0.21, site.grade + 0.78, granite);
  const ring = (y, r, n = 8) => radialRing(y, radius * r, radius * r, n);
  const lower = 4.05;
  const doubled = detail >= 1;
  const supports = doubled
    ? [
        [0.85, 8, 0.31],
        [0.67, 16, 0.23],
        [0.43, 16, 0.25],
      ]
    : [
        [0.84, 8, 0.28],
        [0.43, 8, 0.25],
      ];
  for (const [r, count, thickness] of supports)
    for (const [x, , z] of ring(0, r, count)) {
      if (detail < 2) {
        beam(body, 'timber', [x, 0, z], [x, lower, z], thickness, thickness, red);
      } else {
        const n = count === 16 && r === 0.43 ? 4 : 8;
        loft(
          body,
          'timber',
          [
            radialRing(0.15, thickness / 2, thickness / 2, n, [x, z]),
            radialRing(lower, thickness / 2, thickness / 2, n, [x, z]),
          ],
          red,
        );
        box(body, 'stone', [x - 0.175, 0, z - 0.175], [x + 0.175, 0.16, z + 0.175], marble);
      }
    }
  const roof = (base, r, rise, crown) => {
    const rows =
      detail === 0
        ? [
            [0, 1],
            [1, crown],
          ]
        : [
            [0, 1],
            [0.24, 0.77],
            [0.63, 0.48],
            [1, crown],
          ];
    const rings = rows.map(([t, scale]) => ring(base + rise * t, r * scale));
    loft(body, 'tile', rings, roofs.grey);
    const fascia = ring(base - 0.13, r * 0.85);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      beam(body, 'timber', fascia[i], fascia[j], 0.22, 0.38, turquoise);
      if (detail < 2) continue;
      beam(
        body,
        'tile',
        rings[0][i],
        [rings[0][i][0] * 1.025, base + 0.38, rings[0][i][2] * 1.025],
        0.16,
        0.18,
        roofs.grey,
      );
      for (let k = 1; k < rings.length; k++)
        beam(body, 'tile', rings[k - 1][i], rings[k][i], 0.11, 0.16, roofs.grey);
    }
  };
  roof(lower, 1.047, 1.81, 0.41);
  const lantern = ring(5.06, 0.55);
  for (const [i, a] of lantern.entries()) {
    const b = lantern[(i + 1) % lantern.length];
    const top = ([x, , z]) => [x, 6.16, z];
    face(body, 'timber', [a, b, top(b), top(a)], indigo, [a[0] + b[0], 0, a[2] + b[2]]);
    if (detail >= 2) {
      beam(body, 'timber', [a[0], 5.66, a[2]], [b[0], 5.66, b[2]], 0.13, 0.23, turquoise);
      beam(body, 'timber', a, top(a), 0.18, 0.18, red);
    }
  }
  roof(6.08, 0.81, 2.89, 0.062);
  loft(
    body,
    'marble',
    [
      [8.96, 0.061],
      [9.18, 0.076],
      [9.5, 0.055],
      [9.62, 0.029],
    ].map(([y, r]) => ring(y, r)),
    granite,
  );
  if (detail >= 2)
    for (const [x, , z] of ring(0, 0.84))
      beam(body, 'timber', [x, lower - 0.35, z], [x, lower, z], 0.48, 0.42, indigo);
}

const roles = {
  shop: marketShop,
  island_shop: marketShop,
  garden_hall: gardenPavilion,
  garden_pavilion: gardenPavilion,
  pond_hall: gardenPavilion,
  dragon_temple: islandTemple,
  temple_gate: islandTemple,
  hanxu,
  kuoru: openOctagon,
};

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  if (layout.crossing) shortCrossing(out, layout.crossing, detail);
  for (const [outline, ...holes] of layout.channel ?? [])
    prism(
      (slot, points, normal) => {
        if (normal[1] > 0) face(out, slot, points, canalGreen, normal);
      },
      'water',
      { outline, holes },
      layout.crossing.water - 0.04,
      layout.crossing.water,
      false,
    );
  if (layout.banks) quays(out, layout.banks, layout.crossing.water);
  for (const item of layout.terraces ?? []) terrace(out, item, layout.crossing.water, detail);
  if (layout.galleries) gardenGallery(out, layout.galleries, detail);
  for (const site of layout.sites) (roles[site.role] ?? hall)(out, site, detail);
}
