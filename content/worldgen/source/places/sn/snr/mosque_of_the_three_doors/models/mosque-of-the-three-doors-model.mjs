/** Exterior of the Mosque of the Three Doors, Kairouan. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [hall, minaret] = frame.geometry.polygons;
const { hall: h, tower: t } = plan;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.84, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.81, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    ashlar: 'ba986e',
    warm: 'c2a17a',
    pale: 'd0b792',
    gold: 'b89a71',
    darker: '937456',
    reveal: 'aa875e',
    lime: 'b2a899',
    marble: 'c2b9aa',
    shaded: '766954',
    frieze: 'b79870',
    highlight: 'cfb58f',
    carving: 'a98964',
    timber: '4e3126',
    hardware: '826445',
    dark: '544538',
    tile: '426462',
    jade: '76928a',
    tileWhite: 'd7cba9',
    roof: 'aa987c',
    finial: '4d665e',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, f) => a + (b - a) * f;
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const front = (u, y, d = 0) => [u, y, hall[0][1] + d];

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    r = terrain.heightsMeters;
  return (
    lerp(lerp(r[j][i], r[j][i + 1], u - i), lerp(r[j + 1][i], r[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function panel(out, slot, p, normal, color) {
  const n = normalFor(...p);
  const points = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}

function polygon(out, slot, point, outer, depth, color, holes = []) {
  const points = [...outer],
    starts = [];
  for (const hole of holes) {
    starts.push(points.length);
    points.push(...hole);
  }
  const order = earcut(points.flat(), starts);
  const normal = normalFor(point(0, 0, depth), point(1, 0, depth), point(0, 1, depth));
  for (let i = 0; i < order.length; i += 3)
    panel(
      out,
      slot,
      order.slice(i, i + 3).map((j) => point(...points[j], depth)),
      normal,
      color,
    );
}

function cap(out, slot, ring, y, color) {
  const order = earcut(ring.flat());
  for (let i = 0; i < order.length; i += 3)
    panel(
      out,
      slot,
      order.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      [0, 1, 0],
      color,
    );
}

function edge(out, slot, a, b, low, high, color) {
  panel(
    out,
    slot,
    [
      [a[0], low(a), a[1]],
      [b[0], low(b), b[1]],
      [b[0], high, b[1]],
      [a[0], high, a[1]],
    ],
    [-(b[1] - a[1]), 0, b[0] - a[0]],
    color,
  );
}

function arch(x, center, rise, half, steps, overhang = 0.16) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = Math.PI + overhang - ((Math.PI + 2 * overhang) * i) / steps;
    return [x + half * Math.cos(a), center + rise * Math.sin(a)];
  });
}
const doorGround = (x) => grade(x, hall[0][1] + 0.25) + 0.075;

function facade(out, lod) {
  const archSteps = [5, 8, 13, 17][lod],
    base = Math.min(...hall.map((p) => grade(...p))) - 0.34;
  const doorTop = 5.17;
  const west = hall[0][0],
    east = hall[1][0];
  const lower = [[west, base]];
  const portals = h.portalCenters.map((x, i) => {
    const half = h.portalWidths[i] / 2;
    const radius = i === 1 ? 1.55 : 1.35;
    const center = h.portalSpringEstimate + 0.13;
    const inner = arch(x, center, radius, half, archSteps);
    const outer = arch(x, center, radius + 0.3, half + 0.23, archSteps);
    return { x, half, inner, outer };
  });
  for (const { inner } of portals)
    lower.push([inner[0][0], base], ...inner, [inner.at(-1)[0], base]);
  lower.push([east, base], [east, doorTop], [west, doorTop]);
  polygon(out, 'stone', front, lower, 0, palette.ashlar);
  for (const [i, { x, inner, outer }] of portals.entries()) {
    const backing = [[inner[0][0], base], [inner.at(-1)[0], base], ...inner.toReversed()];
    polygon(out, 'plaster', front, backing, -0.55, palette.lime);
    const reveal = [[inner[0][0], base], ...inner, [inner.at(-1)[0], base]];
    for (let j = 0; j < reveal.length - 1; j++) {
      const a = reveal[j],
        b = reveal[j + 1];
      panel(
        out,
        'stone',
        [front(...a), front(...b), front(...b, -0.565), front(...a, -0.565)],
        [b[1] - a[1], a[0] - b[0], 0],
        palette.reveal,
      );
    }
    for (let j = 0; j < archSteps; j++) {
      const shade = (j + i) % 5 === 0 ? palette.highlight : palette.warm;
      panel(
        out,
        'trim',
        [
          front(...inner[j], 0.073),
          front(...inner[j + 1], 0.073),
          front(...outer[j + 1], 0.103),
          front(...outer[j], 0.103),
        ],
        [0, 0, 1],
        shade,
      );
      panel(
        out,
        'trim',
        [
          front(...inner[j]),
          front(...inner[j + 1]),
          front(...inner[j + 1], 0.073),
          front(...inner[j], 0.073),
        ],
        [0, -1, 0],
        palette.darker,
      );
    }
    const sill = doorGround(x),
      doorHalf = i === 1 ? 0.69 : 0.61,
      top = sill + (i === 1 ? 2.79 : 2.56);
    const edgeWidth = i === 1 ? 0.21 : 0.14;
    polygon(
      out,
      'trim',
      front,
      rect(x - doorHalf - edgeWidth, sill, x + doorHalf + edgeWidth, top + 0.16),
      -0.44,
      i === 1 ? palette.marble : palette.warm,
    );
    polygon(
      out,
      'timber',
      front,
      rect(x - doorHalf, sill, x + doorHalf, top),
      -0.418,
      palette.timber,
    );
    box(
      out,
      'trim',
      [x - doorHalf - edgeWidth, sill - 0.09, 4.98],
      [x + doorHalf + edgeWidth, sill + 0.02, 5.58],
      palette.marble,
    );
    if (lod >= 1) {
      polygon(out, 'detail', front, rect(x - 0.012, sill, x + 0.012, top), -0.4, palette.dark);
      for (const sign of [-1, 1])
        for (const shift of [0.76, 1.66]) {
          const middle = x + sign * doorHalf * 0.5;
          polygon(
            out,
            'detail',
            front,
            rect(middle - 0.12, sill + shift, middle + 0.12, sill + shift + 0.036),
            -0.397,
            palette.hardware,
          );
        }
    }
  }
  const columns = [
    portals[0].inner[0][0] - 0.03,
    (portals[0].inner.at(-1)[0] + portals[1].inner[0][0]) / 2,
    (portals[1].inner.at(-1)[0] + portals[2].inner[0][0]) / 2,
    portals[2].inner.at(-1)[0] + 0.03,
  ];
  for (const [i, x] of columns.entries()) {
    const y = doorGround(x) - 0.1;
    const baseRadius = i === 1 || i === 2 ? 0.185 : 0.149;
    const shaftTop = h.portalSpringEstimate - 0.37;
    const section = [
      [y, baseRadius * 1.16],
      [y + 0.16, baseRadius],
      [shaftTop - 0.1, baseRadius * 0.81],
      [shaftTop, baseRadius],
      [shaftTop + 0.12, baseRadius * 1.3],
      [shaftTop + 0.24, baseRadius * 1.41],
    ];
    const shaft = lod === 0 ? [section[0], section[2], section[5]] : section;
    loft(
      out,
      'trim',
      shaft.map(([height, radius]) =>
        radialRing(height, radius, radius, [6, 8, 10, 12][lod], [x, 5.5]),
      ),
      i === 0 ? palette.marble : palette.highlight,
      { cap: lod > 0 },
    );
    if (lod >= 1)
      box(
        out,
        'trim',
        [x - baseRadius * 1.46, shaftTop + 0.22, 5.26],
        [x + baseRadius * 1.46, shaftTop + 0.31, 5.74],
        palette.warm,
      );
  }
  ornament(out, lod, portals, doorTop);
}

function ornament(out, lod, portals, bottom) {
  const left = -4.1,
    right = 6.43;
  for (let i = 0; i < h.friezeBandCount; i++) {
    const y = bottom + i * h.friezeBandHeight;
    box(
      out,
      'trim',
      [left, y, 5.465],
      [right, y + 0.49, 5.605],
      i === 2 ? palette.highlight : palette.frieze,
    );
    box(out, 'trim', [left, y + 0.449, 5.6], [right, y + 0.49, 5.645], palette.darker);
    if (lod === 0) continue;
    if (i === 2) {
      const count = [0, 14, 22, 26][lod];
      for (let j = 0; j < count; j++) {
        const x = lerp(left + 0.22, right - 0.22, j / (count - 1));
        const w = 0.14;
        polygon(
          out,
          'trim',
          front,
          [
            [x - w, y + 0.224],
            [x, y + 0.095],
            [x + w, y + 0.224],
            [x, y + 0.363],
          ],
          0.15,
          palette.carving,
        );
        if (lod >= 2) {
          const spokes = Array.from({ length: 8 }, (_, k) => {
            const a = (k * Math.PI) / 4;
            const r = k % 2 === 0 ? 0.095 : 0.044;
            return [x + r * Math.cos(a), y + 0.224 + r * Math.sin(a)];
          });
          polygon(out, 'trim', front, spokes, 0.163, palette.highlight);
        }
      }
    } else {
      // Shallow irregular fragments represent the eroded relief registers at map scale.
      const count = [0, 20, 43, 56][lod];
      for (let j = 0; j < count; j++) {
        const x = lerp(left + 0.08, right - 0.15, j / (count - 1));
        const width = 0.024 + ((j * 7 + i * 3) % 5) * 0.013;
        const height = 0.078 + ((j * 19 + i * 3) % 7) * 0.038;
        const rise = y + 0.083 + (j % 3) * 0.023;
        polygon(
          out,
          'trim',
          front,
          [
            [x, rise],
            [x + width, rise + 0.023],
            [x + width * 0.67, rise + height],
            [x + width * 0.07, rise + height - 0.015],
          ],
          0.132,
          palette.carving,
        );
        if (lod >= 2 && j % 3 !== 1)
          polygon(
            out,
            'trim',
            front,
            rect(x, rise - 0.006, x + width * 1.7, rise + 0.028),
            0.146,
            palette.highlight,
          );
      }
    }
  }
  if (lod >= 2)
    for (const { inner, outer } of portals) {
      for (let j = 0; j < outer.length - 1; j++) {
        const [x, y] = outer[j];
        if (y > bottom - 0.14) continue;
        const q = outer[j + 1];
        const center = (x + q[0]) / 2,
          height = Math.min(bottom - 0.085, (y + q[1]) / 2 + 0.15);
        polygon(
          out,
          'trim',
          front,
          [
            [center - 0.051, height],
            [center, height + 0.042],
            [center + 0.051, height],
            [center, height - 0.05],
          ],
          0.076,
          palette.carving,
        );
        if (lod >= 3) {
          const [u, v] = inner[j];
          const offset = inner[j + 1];
          polygon(
            out,
            'trim',
            front,
            [
              [u, v],
              [u + (offset[0] - u) * 0.065, v + (offset[1] - v) * 0.065],
              [x + 0.008, y + 0.008],
              [x - 0.002, y - 0.002],
            ],
            0.11,
            palette.darker,
          );
        }
      }
    }
  const cornice = h.facadeCrownEstimate;
  const count = lod === 0 ? 12 : h.corbelCount;
  for (let i = 0; i < count; i++) {
    const x = lerp(left + 0.16, right - 0.17, i / (count - 1));
    const w = lod === 0 ? 0.27 : 0.19;
    box(
      out,
      'trim',
      [x - w / 2, cornice - 0.57, 5.59],
      [x + w / 2, cornice - 0.19, 5.79],
      palette.carving,
    );
    if (lod >= 1)
      box(
        out,
        'trim',
        [x - w * 0.63, cornice - 0.43, 5.75],
        [x + w * 0.63, cornice - 0.23, 5.88],
        palette.warm,
      );
  }
  box(
    out,
    'trim',
    [left - 0.07, cornice - 0.26, 5.43],
    [right + 0.07, cornice - 0.12, 5.86],
    palette.darker,
  );
  box(
    out,
    'trim',
    [left - 0.12, cornice - 0.13, 5.37],
    [right + 0.13, cornice, 5.5 + h.corniceDepth],
    palette.highlight,
  );
}

function hallMass(out) {
  const ground = (p) => grade(...p) - 0.27;
  for (let i = 1; i < hall.length; i++)
    edge(
      out,
      'stone',
      hall[i],
      hall[(i + 1) % hall.length],
      ground,
      h.roofTopEstimate,
      palette.ashlar,
    );
  cap(
    out,
    'plaster',
    hall.map(([x, z]) => [x, z]),
    h.roofTopEstimate,
    palette.roof,
  );
  box(
    out,
    'stone',
    [hall[0][0], h.roofTopEstimate - 0.05, 4.76],
    [hall[1][0], h.facadeCrownEstimate - 0.13, 5.47],
    palette.ashlar,
  );
  box(
    out,
    'stone',
    [-4.13, h.roofTopEstimate, 5.44],
    [6.44, h.facadeCrownEstimate - 0.14, 5.52],
    palette.ashlar,
  );
}

function tower(out, lod) {
  const [west, east] = [minaret[0][0], minaret[1][0]],
    [frontZ, backZ] = [minaret[0][1], minaret[2][1]];
  const center = (west + east) / 2,
    middle = (frontZ + backZ) / 2;
  const north = (u, y, d = 0) => [center + u, y, frontZ + d];
  const right = (u, y, d = 0) => [east + d, y, middle - u];
  const side = frontZ - backZ,
    wallTop = t.balconyHeight;
  const base = Math.min(...minaret.map((p) => grade(...p))) - 0.34;
  const windowShape = (x) => {
    const arc = arch(x, t.pairedOpeningSillEstimate + 0.87, 0.44, 0.345, [4, 7, 9, 12][lod], 0.11);
    return [
      [arc[0][0], t.pairedOpeningSillEstimate],
      ...arc,
      [arc.at(-1)[0], t.pairedOpeningSillEstimate],
    ];
  };
  const windows = [-0.42, 0.42].map(windowShape);
  for (const [i, p] of [north, right].entries()) {
    const width = i === 0 ? east - west : side;
    polygon(
      out,
      'stone',
      p,
      rect(-width / 2, base, width / 2, wallTop),
      0,
      palette.ashlar,
      windows,
    );
    polygon(
      out,
      'detail',
      p,
      rect(-1.14, t.pairedOpeningSillEstimate - 0.15, 1.14, 9.58),
      -0.28,
      palette.dark,
    );
    for (const w of windows) {
      const normal = normalFor(p(0, 0), p(1, 0), p(0, 1));
      for (let j = 0; j < w.length; j++) {
        const a = w[j],
          b = w[(j + 1) % w.length];
        face(out, 'trim', [p(...b), p(...a), p(...a, -0.28), p(...b, -0.28)], palette.reveal);
      }
      polygon(
        out,
        'trim',
        p,
        rect(w[0][0] - 0.04, w[0][1] - 0.07, w.at(-1)[0] + 0.04, w[0][1] + 0.012),
        0.045,
        palette.highlight,
      );
      if (lod >= 1)
        for (let j = 1; j < w.length - 2; j++) {
          const a = w[j],
            b = w[j + 1];
          const widened = ([u, y]) => [u + (u - (w[0][0] + w.at(-1)[0]) / 2) * 0.22, y + 0.087];
          panel(
            out,
            'trim',
            [p(...a, 0.028), p(...b, 0.028), p(...widened(b), 0.032), p(...widened(a), 0.032)],
            normal,
            j % 2 ? palette.highlight : palette.darker,
          );
        }
    }
    polygon(
      out,
      'trim',
      p,
      rect(-0.052, t.pairedOpeningSillEstimate, 0.052, t.pairedOpeningSillEstimate + 0.92),
      0.048,
      palette.marble,
    );
    for (const y of [2.5, 3.8, 6.65]) {
      polygon(out, 'detail', p, rect(0.71, y, 0.81, y + 0.34), 0.011, palette.dark);
    }
  }
  edge(out, 'stone', minaret[2], minaret[3], () => base, wallTop, palette.ashlar);
  edge(out, 'stone', minaret[3], minaret[0], () => base, wallTop, palette.ashlar);
  cap(out, 'plaster', minaret, wallTop, palette.roof);
  const pieces = [
    [-1.23, 7.78, -0.99, 9.72],
    [0.99, 7.78, 1.23, 9.72],
    [-1.23, 9.45, 1.23, 9.72],
    [-1.23, 7.72, 1.23, 7.89],
  ];
  for (const [a, b, c, d] of pieces)
    polygon(out, 'tile', north, rect(a, b, c, d), 0.046, palette.tile);
  if (lod >= 1) {
    for (const sign of [-1, 1])
      for (let i = 0; i < 13; i++) {
        const y = 7.88 + i * 0.12,
          u = sign * 1.11;
        polygon(
          out,
          'tile',
          north,
          [
            [u - 0.072, y],
            [u, y + 0.053],
            [u + 0.072, y],
            [u, y - 0.053],
          ],
          0.062,
          i % 3 === 0 ? palette.tileWhite : palette.jade,
        );
      }
    for (let i = 0; i < 17; i++) {
      const u = -1.11 + i * 0.138,
        y = 9.59;
      polygon(
        out,
        'tile',
        north,
        [
          [u - 0.058, y],
          [u, y + 0.066],
          [u + 0.058, y],
          [u, y - 0.066],
        ],
        0.063,
        i % 2 ? palette.jade : palette.tileWhite,
      );
    }
  }
  for (const y of [4.55, 7.55, 10.87])
    box(
      out,
      'trim',
      [west - 0.055, y, backZ - 0.055],
      [east + 0.055, y + 0.105, frontZ + 0.055],
      palette.darker,
    );
  const merlons = lod === 0 ? 5 : 7;
  for (const [i, point] of [
    north,
    right,
    (u, y, d = 0) => [center - u, y, backZ - d],
    (u, y, d = 0) => [west - d, y, middle + u],
  ].entries()) {
    const count = i % 2 === 0 ? merlons : merlons - 2;
    for (let j = 0; j < count; j++) {
      const x = lerp(-1.65, 1.65, j / (count - 1)),
        w = lod === 0 ? 0.29 : 0.205;
      const p = [
        [x - w, wallTop],
        [x + w, wallTop],
        [x + w, wallTop + 0.26],
        [x, wallTop + t.merlonHeight],
        [x - w, wallTop + 0.26],
      ];
      polygon(out, 'trim', point, p, 0.045, palette.warm);
      if (lod === 0) continue;
      polygon(out, 'trim', point, p, -0.17, palette.warm);
      for (let k = 0; k < p.length; k++) {
        const a = p[k],
          b = p[(k + 1) % p.length];
        face(
          out,
          'trim',
          [point(...a, 0.045), point(...b, 0.045), point(...b, -0.17), point(...a, -0.17)],
          palette.highlight,
        );
      }
    }
  }
  const s = 0.68,
    capEaves = t.height - 0.51,
    capPeak = t.height - 0.1;
  box(
    out,
    'stone',
    [center - s, wallTop - 0.015, middle - s],
    [center + s, capEaves, middle + s],
    palette.warm,
  );
  const roof = [
    [center - s - 0.055, middle - s - 0.055],
    [center + s + 0.055, middle - s - 0.055],
    [center + s + 0.055, middle + s + 0.055],
    [center - s - 0.055, middle + s + 0.055],
  ];
  for (let i = 0; i < roof.length; i++) {
    const a = roof[i],
      b = roof[(i + 1) % roof.length];
    panel(
      out,
      'trim',
      [
        [a[0], capEaves, a[1]],
        [b[0], capEaves, b[1]],
        [center, capPeak, middle],
      ],
      [0, 1, 0],
      palette.roof,
    );
  }
  box(
    out,
    'detail',
    [center - 0.045, capPeak - 0.02, middle - 0.045],
    [center + 0.045, t.height, middle + 0.045],
    palette.finial,
  );
}

function build(out, lod) {
  hallMass(out);
  facade(out, lod);
  tower(out, lod);
}
export const mosqueSkyline = (out) => build(out, 0);
export const mosqueDistrict = (out) => build(out, 1);
export const mosqueStreet = (out) => build(out, 2);
export const mosqueCloseup = (out) => build(out, 3);
const recipe = 'mosque-of-the-three-doors-model.mjs';
const camera = [18, 13, 30],
  lookAt = [-0.9, 5.2, 2.4];
export const mosqueModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: mosqueCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Mosque of the Three Doors in Kairouan with three horseshoe portals, the carved west façade, and its tiled and crenellated northwest minaret.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-12, 29, 37],
  mediumFiContext: {
    scale: 1.04,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: hall,
    outlines: [hall, minaret],
    minimumCoverage: 0.92,
    basis: 'Approximate documented hall dimensions and northwest minaret position.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'plaster_lime',
    'stone_limestone',
    'tile_mosaic',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'three-portals-and-carved-frieze',
      position: [10.9, 4.9, 21.8],
      lookAt: [0.1, 4.75, 5.5],
    },
    {
      name: 'northwest-minaret-tile-and-merlons',
      position: [-15.7, 12.0, 16.5],
      lookAt: [-5.7, 9.6, 4.2],
    },
    {
      name: 'hall-roof-and-minaret-return',
      position: [14.6, 16.4, -18.2],
      lookAt: [-1.1, 5.0, 0.2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-mosque-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'mosqueSkyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'mosqueDistrict', 0.31],
        ['street', 'mosqueStreet', 0.1],
        ['closeup', 'mosqueCloseup', 0.041],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Map controls are ODbL. The exact Qualla façade photograph is in the public domain by the photographer’s declaration.',
};
